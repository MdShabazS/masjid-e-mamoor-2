import unittest
import base64
import json

from check_release_config import check_config


REF = "abcdefghijklmnopqrst"
WEB = "https://staging.masjidemamoor.org"
VALID = {
    "NEXT_PUBLIC_SUPABASE_URL": f"https://{REF}.supabase.co",
    "EXPO_PUBLIC_SUPABASE_URL": f"https://{REF}.supabase.co",
    "SUPABASE_URL": f"https://{REF}.supabase.co",
    "EXPO_PUBLIC_WEB_API_URL": WEB,
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY": "sb_publishable_synthetic_12345678901234567890",
    "EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY": "sb_publishable_synthetic_12345678901234567890",
    "SUPABASE_PUBLISHABLE_KEY": "sb_publishable_synthetic_12345678901234567890",
    "SUPABASE_SERVICE_ROLE_KEY": "sb_secret_synthetic_12345678901234567890",
}


class ReleaseConfigTests(unittest.TestCase):
    def check(self, values):
        return check_config(values, environment="staging", project_ref=REF, web_origin=WEB)

    def test_matching_release_config_passes(self):
        self.assertEqual(self.check(VALID), [])

    def test_mixed_project_and_web_origin_fail(self):
        values = {**VALID, "EXPO_PUBLIC_SUPABASE_URL": "https://differentprojectref.supabase.co", "EXPO_PUBLIC_WEB_API_URL": "https://dev.masjidemamoor.org"}
        errors = self.check(values)
        self.assertTrue(any("EXPO_PUBLIC_SUPABASE_URL" in error for error in errors))
        self.assertTrue(any("EXPO_PUBLIC_WEB_API_URL" in error for error in errors))

    def test_public_secret_and_key_drift_fail_without_echo(self):
        secret = "sb_secret_NEVER_PRINT_THIS_VALUE_123456789"
        values = {**VALID, "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY": secret}
        errors = self.check(values)
        self.assertTrue(any("secret key in a public slot" in error for error in errors))
        self.assertTrue(any("public Supabase keys differ" in error for error in errors))
        self.assertNotIn(secret, " ".join(errors))

    def test_legacy_service_role_jwt_in_public_slot_fails(self):
        payload = base64.urlsafe_b64encode(json.dumps({"role": "service_role"}).encode()).decode().rstrip("=")
        values = {**VALID, "EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY": f"header.{payload}.signature"}
        self.assertTrue(any("EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: secret key" in error for error in self.check(values)))

    def test_local_http_and_placeholder_fail(self):
        values = {**VALID, "SUPABASE_URL": "http://localhost:54321", "EXPO_PUBLIC_WEB_API_URL": "https://your-web-host.example"}
        errors = self.check(values)
        self.assertTrue(any("SUPABASE_URL" in error for error in errors))
        self.assertTrue(any("EXPO_PUBLIC_WEB_API_URL" in error for error in errors))

    def test_missing_service_key_and_public_equal_private_fail(self):
        values = {**VALID, "SUPABASE_SERVICE_ROLE_KEY": ""}
        self.assertTrue(any("SUPABASE_SERVICE_ROLE_KEY" in error for error in self.check(values)))
        values["SUPABASE_SERVICE_ROLE_KEY"] = values["SUPABASE_PUBLISHABLE_KEY"]
        self.assertTrue(any("service role key matches" in error for error in self.check(values)))

    def test_arbitrary_or_wrong_role_keys_fail_without_echo(self):
        bad = "NOT_A_SUPABASE_KEY_NEVER_PRINT"
        values = {**VALID, "SUPABASE_SERVICE_ROLE_KEY": bad}
        errors = self.check(values)
        self.assertTrue(any("expected Supabase secret" in error for error in errors))
        self.assertNotIn(bad, " ".join(errors))

        values = {**VALID, "SUPABASE_PUBLISHABLE_KEY": bad}
        errors = self.check(values)
        self.assertTrue(any("expected Supabase publishable" in error for error in errors))
        self.assertNotIn(bad, " ".join(errors))

    def test_legacy_key_roles_are_scoped(self):
        def jwt(role):
            payload = base64.urlsafe_b64encode(json.dumps({"role": role}).encode()).decode().rstrip("=")
            return f"header.{payload}.signature"

        anon = jwt("anon")
        service = jwt("service_role")
        values = {**VALID, "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY": anon,
                  "EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY": anon,
                  "SUPABASE_PUBLISHABLE_KEY": anon,
                  "SUPABASE_SERVICE_ROLE_KEY": service}
        self.assertEqual(self.check(values), [])
        values["SUPABASE_SERVICE_ROLE_KEY"] = anon
        self.assertTrue(any("expected Supabase secret" in error for error in self.check(values)))


if __name__ == "__main__":
    unittest.main()
