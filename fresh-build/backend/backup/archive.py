#!/usr/bin/env python3
"""Encrypted DB + private object archive preflight. Never cut over live data here.

Inputs come from a separate trusted capture job: a pg_dump file, an inventory
of Storage bucket/path/sha256/bytes, and downloaded object bytes. The archive
is rejected unless each listed object exists and matches exactly. CMS needs a
separately held X.509 encryption certificate and matching recovery private key.
"""

import argparse
import hashlib
import hmac
import io
import json
import os
import pathlib
import re
import shutil
import subprocess
import tarfile
import tempfile


def digest(data):
    return hashlib.sha256(data).hexdigest()


def digest_stream(source):
    hashed = hashlib.sha256()
    size = 0
    while chunk := source.read(1024 * 1024):
        hashed.update(chunk)
        size += len(chunk)
    return size, hashed.hexdigest()


def digest_file(path):
    with path.open('rb') as source:
        return digest_stream(source)


def hmac_file(path, secret):
    tagged = hmac.new(secret, digestmod=hashlib.sha256)
    with path.open('rb') as source:
        while chunk := source.read(1024 * 1024):
            tagged.update(chunk)
    return tagged.hexdigest()


def path_for(root, bucket, name):
    if not isinstance(bucket, str) or not isinstance(name, str):
        raise ValueError('invalid object path')
    parts = name.split('/')
    if not re.fullmatch(r'[a-z0-9][a-z0-9_-]{0,63}', bucket) or any(
        p in ('', '.', '..') for p in parts
    ) or name.startswith('/') or '\\' in name:
        raise ValueError('invalid object path')
    return root / bucket / pathlib.Path(*parts)


def validate_inventory(inventory, objects_root):
    if not isinstance(inventory, list) or len(inventory) > 100000:
        raise ValueError('invalid inventory')
    seen = set()
    for item in inventory:
        if not isinstance(item, dict) or set(item) != {'bucket', 'path', 'sha256', 'bytes'}:
            raise ValueError('invalid inventory entry')
        bucket, name = item['bucket'], item['path']
        key = (bucket, name)
        if key in seen:
            raise ValueError('duplicate inventory entry')
        seen.add(key)
        source = path_for(objects_root, bucket, name)
        if source.is_symlink() or not source.is_file():
            raise ValueError('missing object bytes')
        data = source.read_bytes()
        if len(data) != item['bytes'] or digest(data) != item['sha256']:
            raise ValueError('object digest mismatch')
    actual = set()
    if objects_root.exists():
        for source in objects_root.rglob('*'):
            if source.is_symlink():
                raise ValueError('object symlink prohibited')
            if source.is_file():
                relative = source.relative_to(objects_root)
                if len(relative.parts) < 2:
                    raise ValueError('invalid object path')
                actual.add((relative.parts[0], '/'.join(relative.parts[1:])))
    if actual != seen:
        raise ValueError('inventory does not match object set')


def add_bytes(archive, name, data):
    info = tarfile.TarInfo(name)
    info.size = len(data)
    info.mode = 0o600
    archive.addfile(info, io.BytesIO(data))


def add_file(archive, name, source):
    info = tarfile.TarInfo(name)
    info.size = source.stat().st_size
    info.mode = 0o600
    with source.open('rb') as input_file:
        archive.addfile(info, input_file)


def write_private_file(destination, data):
    descriptor = os.open(destination, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(descriptor, 'wb') as output:
        output.write(data)


def write_private_stream(destination, source):
    descriptor = os.open(destination, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(descriptor, 'wb') as output:
        shutil.copyfileobj(source, output, length=1024 * 1024)


def mac_secret(path):
    secret = path.read_bytes()
    if len(secret) < 32:
        raise ValueError('MAC key must be at least 32 bytes')
    return secret


def build(dump, inventory_file, objects_root, certificate, output, mac_key):
    secret = mac_secret(mac_key)
    inventory = json.loads(inventory_file.read_text())
    validate_inventory(inventory, objects_root)
    if not dump.is_file() or dump.is_symlink() or dump.stat().st_size == 0:
        raise ValueError('database dump missing')
    with dump.open('rb') as source:
        if source.read(5) != b'PGDMP':
            raise ValueError('expected pg_dump custom-format dump')
    db_size, db_digest = digest_file(dump)
    metadata = {'version': 1, 'database': {'bytes': db_size, 'sha256': db_digest},
                'objects': sorted(inventory, key=lambda x: (x['bucket'], x['path']))}
    with tempfile.TemporaryDirectory(prefix='mem2-backup-') as temp:
        os.chmod(temp, 0o700)
        tar = pathlib.Path(temp) / 'payload.tar'
        with tarfile.open(tar, 'w') as archive:
            add_bytes(archive, 'MANIFEST.json', json.dumps(metadata, sort_keys=True).encode())
            add_file(archive, 'database.dump', dump)
            for item in metadata['objects']:
                add_file(archive, f"objects/{item['bucket']}/{item['path']}",
                         path_for(objects_root, item['bucket'], item['path']))
        # Refuse a source file that changed after its inventory digest was taken.
        with tarfile.open(tar) as archive:
            for name, item in [('database.dump', metadata['database'])] + [
                (f"objects/{entry['bucket']}/{entry['path']}", entry)
                for entry in metadata['objects']
            ]:
                with archive.extractfile(name) as source:
                    size, sha256 = digest_stream(source)
                if (size, sha256) != (item['bytes'], item['sha256']):
                    raise ValueError('source changed during archive capture')
        output.parent.mkdir(parents=True, exist_ok=True)
        subprocess.run(['openssl', 'cms', '-encrypt', '-binary', '-aes-256-cbc',
                        '-in', str(tar), '-out', str(output), '-outform', 'DER',
                        str(certificate)], check=True, capture_output=True)
        os.chmod(output, 0o600)
    sidecar = output.with_name(output.name + '.sha256')
    sidecar.write_text(digest_file(output)[1] + '  ' + output.name + '\n')
    os.chmod(sidecar, 0o600)
    tag = hmac_file(output, secret)
    mac_path = output.with_name(output.name + '.hmac')
    mac_path.write_text(tag + '\n')
    os.chmod(mac_path, 0o600)
    return metadata


def verify(encrypted, certificate, private_key, mac_key, staging=None):
    sidecar = encrypted.with_name(encrypted.name + '.sha256')
    if not sidecar.is_file() or sidecar.read_text().split()[0] != digest_file(encrypted)[1]:
        raise ValueError('archive checksum mismatch')
    mac_path = encrypted.with_name(encrypted.name + '.hmac')
    expected = hmac_file(encrypted, mac_secret(mac_key))
    if not mac_path.is_file() or not hmac.compare_digest(mac_path.read_text().strip(), expected):
        raise ValueError('archive authentication failed')
    with tempfile.TemporaryDirectory(prefix='mem2-verify-') as temp:
        os.chmod(temp, 0o700)
        tar = pathlib.Path(temp) / 'payload.tar'
        subprocess.run(['openssl', 'cms', '-decrypt', '-binary', '-inform', 'DER',
                        '-in', str(encrypted), '-recip', str(certificate),
                        '-inkey', str(private_key), '-out', str(tar)],
                       check=True, capture_output=True)
        with tarfile.open(tar) as archive:
            names = archive.getnames()
            if len(names) != len(set(names)) or not {'MANIFEST.json', 'database.dump'} <= set(names):
                raise ValueError('invalid archive members')
            if any(not m.isfile() or m.issym() or m.islnk() for m in archive):
                raise ValueError('unsafe archive member')
            manifest = json.load(archive.extractfile('MANIFEST.json'))
            if manifest.get('version') != 1 or not isinstance(manifest.get('objects'), list):
                raise ValueError('invalid manifest')
            expected = {'MANIFEST.json', 'database.dump'}
            for item in manifest['objects']:
                expected.add(f"objects/{item['bucket']}/{item['path']}")
                path_for(pathlib.Path(temp), item['bucket'], item['path'])
            if set(names) != expected:
                raise ValueError('missing or extra archive member')
            with archive.extractfile('database.dump') as source:
                db_size, db_digest = digest_stream(source)
            if db_size != manifest['database']['bytes'] or db_digest != manifest['database']['sha256']:
                raise ValueError('database digest mismatch')
            for item in manifest['objects']:
                data = archive.extractfile(f"objects/{item['bucket']}/{item['path']}").read()
                if len(data) != item['bytes'] or digest(data) != item['sha256']:
                    raise ValueError('object digest mismatch')
            if staging is not None:
                if staging.is_symlink():
                    raise ValueError('staging symlink prohibited')
                if staging.exists() and any(staging.iterdir()):
                    raise ValueError('staging directory must be empty')
                staging.mkdir(parents=True, exist_ok=True, mode=0o700)
                os.chmod(staging, 0o700)
                for name in sorted(expected - {'MANIFEST.json'}):
                    destination = staging / name
                    directory = staging
                    for part in destination.parent.relative_to(staging).parts:
                        directory = directory / part
                        directory.mkdir(mode=0o700, exist_ok=True)
                        os.chmod(directory, 0o700)
                    with archive.extractfile(name) as source:
                        write_private_stream(destination, source)
                write_private_file(staging / 'MANIFEST.json',
                                   json.dumps(manifest, indent=2).encode())
            return manifest


def main():
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest='action', required=True)
    make = sub.add_parser('build')
    for name in ('dump', 'inventory', 'objects', 'certificate', 'output', 'mac-key'):
        make.add_argument('--' + name, type=pathlib.Path, required=True)
    check = sub.add_parser('verify')
    for name in ('archive', 'certificate', 'private-key', 'mac-key'):
        check.add_argument('--' + name, type=pathlib.Path, required=True)
    check.add_argument('--staging', type=pathlib.Path)
    args = parser.parse_args()
    if args.action == 'build':
        build(args.dump, args.inventory, args.objects, args.certificate, args.output, args.mac_key)
    else:
        verify(args.archive, args.certificate, args.private_key, args.mac_key, args.staging)


if __name__ == '__main__':
    main()
