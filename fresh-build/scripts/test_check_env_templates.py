import unittest
import tempfile
from pathlib import Path

from check_env_templates import check_app


class EnvironmentTemplateTests(unittest.TestCase):
    def test_current_templates_cover_referenced_variables(self):
        for app in ("web", "android"):
            with self.subTest(app=app):
                self.assertEqual(check_app(app), [])

    def test_reports_missing_variables_and_public_secrets(self):
        with tempfile.TemporaryDirectory() as directory:
            app = Path(directory) / "apps" / "web"
            app.mkdir(parents=True)
            (app / ".env.example").write_text("NEXT_PUBLIC_SERVICE_ROLE_KEY=\n")
            (app / "server.js").write_text(
                "const url = process.env.SUPABASE_URL;\n"
                "const key = process.env.SUPABASE_SERVICE_ROLE_KEY;\n"
            )

            errors = check_app("web", Path(directory))

        self.assertEqual(len(errors), 2)
        self.assertTrue(any("secret variable uses a public prefix" in error for error in errors))
        self.assertTrue(any("SUPABASE_URL" in error and "SUPABASE_SERVICE_ROLE_KEY" in error for error in errors))

    def test_scans_nested_source_but_skips_generated_build_trees(self):
        with tempfile.TemporaryDirectory() as directory:
            app = Path(directory) / "apps" / "web"
            (app / "src" / "lib").mkdir(parents=True)
            (app / ".next" / "types").mkdir(parents=True)
            (app / ".env.example").write_text("SOURCE_KEY=\n")
            (app / "src" / "lib" / "config.ts").write_text("process.env.SOURCE_KEY\n")
            (app / ".next" / "types" / "generated.ts").write_text("process.env.GENERATED_KEY\n")

            self.assertEqual(check_app("web", Path(directory)), [])


if __name__ == "__main__":
    unittest.main()
