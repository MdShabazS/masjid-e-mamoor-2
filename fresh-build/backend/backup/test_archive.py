import hashlib
import json
import pathlib
import stat
import subprocess
import tempfile
import unittest
from unittest.mock import patch

import archive
from archive import build, verify


class BackupPreflightTests(unittest.TestCase):
    def test_encrypted_roundtrip_and_failure_before_staging(self):
        with tempfile.TemporaryDirectory() as root_name:
            root = pathlib.Path(root_name)
            cert, key = root / 'cert.pem', root / 'private.pem'
            subprocess.run(['openssl', 'req', '-x509', '-newkey', 'rsa:2048', '-nodes',
                            '-subj', '/CN=Masjid recovery test', '-keyout', str(key),
                            '-out', str(cert), '-days', '1'],
                           check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            mac = root / 'mac.key'
            mac.write_bytes(b'test-only-MAC-key-material-32-bytes-xyz')
            dump = root / 'database.dump'
            dump.write_bytes(b'PGDMP' + b'x' * (2 * 1024 * 1024 + 17))
            objects = root / 'objects'
            (objects / 'qr-private').mkdir(parents=True)
            qr = objects / 'qr-private' / 'current.png'
            qr.write_bytes(b'fake-image-fixture')
            inventory = root / 'inventory.json'
            record = {'bucket': 'qr-private', 'path': 'current.png',
                      'sha256': hashlib.sha256(qr.read_bytes()).hexdigest(),
                      'bytes': qr.stat().st_size}
            inventory.write_text(json.dumps([record]))
            encrypted, staging = root / 'archive.cms', root / 'staging'
            original_read_bytes = pathlib.Path.read_bytes

            def reject_large_file_read(path):
                if path in (dump, encrypted):
                    raise AssertionError('database dump and encrypted archive must be streamed')
                return original_read_bytes(path)

            with patch.object(pathlib.Path, 'read_bytes', reject_large_file_read):
                build(dump, inventory, objects, cert, encrypted, mac)
            staging.mkdir(mode=0o755)
            with patch.object(pathlib.Path, 'read_bytes', reject_large_file_read):
                result = verify(encrypted, cert, key, mac, staging)
            self.assertEqual(result['objects'], [record])
            self.assertEqual((staging / 'database.dump').read_bytes(), dump.read_bytes())
            self.assertEqual((staging / 'objects/qr-private/current.png').read_bytes(), qr.read_bytes())
            for directory in (staging, staging / 'objects', staging / 'objects/qr-private'):
                self.assertEqual(stat.S_IMODE(directory.stat().st_mode), 0o700)
            for private_file in (staging / 'MANIFEST.json', staging / 'database.dump',
                                 staging / 'objects/qr-private/current.png'):
                self.assertEqual(stat.S_IMODE(private_file.stat().st_mode), 0o600)
            qr.unlink()
            with self.assertRaisesRegex(ValueError, 'missing object bytes'):
                build(dump, inventory, objects, cert, root / 'bad.cms', mac)
            tampered = bytearray(encrypted.read_bytes())
            tampered[-1] ^= 1
            encrypted.write_bytes(tampered)
            with self.assertRaisesRegex(ValueError, 'checksum mismatch'):
                verify(encrypted, cert, key, mac, root / 'empty-staging')
            self.assertFalse((root / 'empty-staging').exists())

    def test_source_change_during_tar_capture_is_rejected(self):
        with tempfile.TemporaryDirectory() as root_name:
            root = pathlib.Path(root_name)
            dump = root / 'database.dump'
            dump.write_bytes(b'PGDMPinitial')
            objects = root / 'objects'
            objects.mkdir()
            inventory = root / 'inventory.json'
            inventory.write_text('[]')
            mac = root / 'mac.key'
            mac.write_bytes(b'test-only-MAC-key-material-32-bytes-xyz')
            output = root / 'archive.cms'
            original_add_file = archive.add_file

            def mutate_before_add(tar, name, source):
                if name == 'database.dump':
                    dump.write_bytes(b'PGDMPchanged')
                return original_add_file(tar, name, source)

            with patch.object(archive, 'add_file', mutate_before_add):
                with self.assertRaisesRegex(ValueError, 'source changed during archive capture'):
                    build(dump, inventory, objects, root / 'unused-cert.pem', output, mac)
            self.assertFalse(output.exists())


if __name__ == '__main__':
    unittest.main()
