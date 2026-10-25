import hashlib
import json
import pathlib
import subprocess
import tempfile
import unittest

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
            dump.write_bytes(b'PGDMPtest-fixture-only')
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
            build(dump, inventory, objects, cert, encrypted, mac)
            result = verify(encrypted, cert, key, mac, staging)
            self.assertEqual(result['objects'], [record])
            self.assertEqual((staging / 'database.dump').read_bytes(), dump.read_bytes())
            self.assertEqual((staging / 'objects/qr-private/current.png').read_bytes(), qr.read_bytes())
            qr.unlink()
            with self.assertRaisesRegex(ValueError, 'missing object bytes'):
                build(dump, inventory, objects, cert, root / 'bad.cms', mac)
            tampered = bytearray(encrypted.read_bytes())
            tampered[-1] ^= 1
            encrypted.write_bytes(tampered)
            with self.assertRaisesRegex(ValueError, 'checksum mismatch'):
                verify(encrypted, cert, key, mac, root / 'empty-staging')
            self.assertFalse((root / 'empty-staging').exists())


if __name__ == '__main__':
    unittest.main()
