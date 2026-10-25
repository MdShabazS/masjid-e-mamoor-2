#!/usr/bin/env python3
"""Verify the project source archive and restore its contents to a clean directory."""

import argparse
import hashlib
import json
import pathlib
import tarfile
import tempfile


def verify(archive_path: pathlib.Path, destination: pathlib.Path) -> int:
    checksum_path = archive_path.with_name(archive_path.name + ".sha256")
    expected_checksum, filename = checksum_path.read_text().strip().split("  ", 1)
    if filename != archive_path.name:
        raise ValueError("Checksum filename differs from archive")
    actual_checksum = hashlib.sha256(archive_path.read_bytes()).hexdigest()
    if actual_checksum != expected_checksum:
        raise ValueError("Archive checksum mismatch")

    with tarfile.open(archive_path, "r:gz") as archive:
        members = archive.getmembers()
        names = [member.name for member in members]
        if len(names) != len(set(names)) or names.count("BACKUP_MANIFEST.json") != 1:
            raise ValueError("Duplicate or missing archive member")
        for member in members:
            path = pathlib.PurePosixPath(member.name)
            if (not member.isfile() or path.is_absolute() or ".." in path.parts
                    or member.name.startswith("./")):
                raise ValueError(f"Unsafe archive member: {member.name}")
        manifest = json.load(archive.extractfile("BACKUP_MANIFEST.json"))
        expected_files = manifest["files"]
        if set(names) != set(expected_files) | {"BACKUP_MANIFEST.json"}:
            raise ValueError("Archive members differ from manifest")
        for name, digest in expected_files.items():
            content = archive.extractfile(name).read()
            if hashlib.sha256(content).hexdigest() != digest:
                raise ValueError(f"File checksum mismatch: {name}")
            target = destination / name
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(content)
    if not (destination / "fresh-build" / "package.json").is_file():
        raise ValueError("Fresh build package manifest missing from restored source")
    return len(expected_files)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("archive", type=pathlib.Path)
    args = parser.parse_args()
    with tempfile.TemporaryDirectory(prefix="masjid-source-restore-") as temp:
        count = verify(args.archive, pathlib.Path(temp))
        print(f"Verified checksum, {count} file digests, and clean source restore")
