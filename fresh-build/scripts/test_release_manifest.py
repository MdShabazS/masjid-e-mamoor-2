import json
import pathlib
import tempfile
import unittest
from unittest.mock import patch

import release_manifest as release


class ReleaseManifestTests(unittest.TestCase):
    def test_apk_signer_output_variants_and_debug_rejection(self):
        with tempfile.TemporaryDirectory() as folder:
            apk = pathlib.Path(folder) / "release.apk"
            apk.write_bytes(b"apk fixture")
            badging = "package: name='org.masjidemamoor.app' versionCode='2' versionName='1.0.1'\n"
            digest = "a" * 64
            with patch.object(release, "android_tool", return_value=pathlib.Path("sdk-tool")), \
                 patch.object(release.subprocess, "check_output") as output:
                for label in ("Signer #1", "V2 Signer"):
                    output.side_effect = [badging,
                        f"{label}: certificate DN: CN=Masjid Release, O=Masjid\n"
                        f"{label}: certificate SHA-256 digest: {digest}\n"]
                    self.assertEqual(release.inspected_apk(apk),
                        ("org.masjidemamoor.app", 2, digest))
                output.side_effect = [badging,
                    "V2 Signer: certificate DN: CN=Android Debug, OU=Android\n"
                    f"V2 Signer: certificate SHA-256 digest: {digest}\n"]
                with self.assertRaisesRegex(ValueError, "non-debug signing certificate"):
                    release.inspected_apk(apk)

    def test_upgrade_requires_signer_package_and_monotonic_version(self):
        with tempfile.TemporaryDirectory() as folder:
            base = pathlib.Path(folder)
            config = base / "app.json"
            config.write_text(json.dumps({"expo": {"version": "1.0.1", "android": {
                "package": "org.masjidemamoor.app", "versionCode": 2}}}))
            current, previous = base / "current.apk", base / "previous.apk"
            current.write_bytes(b"signed build fixture")
            previous.write_bytes(b"older fixture")
            with patch.object(release, "APP", config), patch.object(release, "inspected_apk") as inspect:
                inspect.side_effect = [("org.masjidemamoor.app", 2, "a" * 64),
                                       ("org.masjidemamoor.app", 1, "a" * 64)]
                result = release.manifest(apk=current, previous_apk=previous, first_install=False,
                    web_url="https://masjid-release.org", apk_url="https://masjid-release.org/app.apk")
                self.assertTrue(result["upgradeChecked"])
                self.assertEqual(result["versionCode"], 2)
                inspect.side_effect = [("org.masjidemamoor.app", 2, "a" * 64),
                                       ("org.masjidemamoor.app", 1, "b" * 64)]
                with self.assertRaisesRegex(ValueError, "same package and signer"):
                    release.manifest(apk=current, previous_apk=previous, first_install=False,
                        web_url="https://masjid-release.org", apk_url="https://masjid-release.org/app.apk")

    def test_placeholder_package_and_insecure_url_are_blocked(self):
        with self.assertRaisesRegex(ValueError, "final Android package"):
            release.manifest(apk=pathlib.Path("absent.apk"), previous_apk=None,
                first_install=True, web_url="https://masjid-release.org",
                apk_url="https://masjid-release.org/app.apk")
        for url in ("http://masjid.example.org/app.apk", "https://example.invalid/app.apk"):
            with self.assertRaises(ValueError):
                release.secure_url(url)


if __name__ == "__main__":
    unittest.main()
