import tempfile
import unittest
from pathlib import Path

from check_public_bundle import check_public_roots


CANARY = "mem2-synthetic-server-only-canary-8a9f0b68"


class PublicBundleTests(unittest.TestCase):
    def test_clean_web_and_android_exports(self):
        with tempfile.TemporaryDirectory() as directory:
            web = Path(directory) / "web"
            android = Path(directory) / "android"
            web.mkdir()
            android.mkdir()
            (web / "app.js").write_text("public code")
            (android / "bundle.js").write_text("public android code")
            self.assertEqual(check_public_roots([web, android], [CANARY]), (2, []))

    def test_detects_secret_in_public_asset_without_echoing_it(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "app.js").write_text(f"const leaked='{CANARY}';")
            checked, errors = check_public_roots([root], [CANARY])
            self.assertEqual(checked, 1)
            self.assertEqual(len(errors), 1)
            self.assertIn("Server-only canary found", errors[0])
            self.assertNotIn(CANARY, errors[0])

    def test_requires_canary_and_nonempty_export(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            self.assertTrue(check_public_roots([root], [])[1])
            self.assertTrue(check_public_roots([root], [CANARY])[1])


if __name__ == "__main__":
    unittest.main()
