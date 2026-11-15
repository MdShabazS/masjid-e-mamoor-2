import pathlib
import tempfile
import unittest
from unittest.mock import patch

import db_fixture_preflight as preflight


class FixturePreflightTests(unittest.TestCase):
    def test_committed_fixture_and_duplicate_migration_are_rejected(self):
        with tempfile.TemporaryDirectory() as folder:
            root = pathlib.Path(folder)
            (root / "supabase/migrations").mkdir(parents=True)
            (root / "tests").mkdir()
            (root / "supabase/migrations/20261015132733_schema.sql").write_text("begin; commit;")
            for name in preflight.FIXTURES:
                (root / "tests" / name).write_text("begin; select 1; rollback;")
            with patch.object(preflight, "ROOT", root):
                self.assertEqual(preflight.check(), (1, len(preflight.FIXTURES)))
                (root / "tests/identity_roles.sql").write_text("begin; commit;")
                with self.assertRaisesRegex(ValueError, "transaction boundary"):
                    preflight.check()
                (root / "tests/identity_roles.sql").write_text("begin; rollback;")
                (root / "supabase/migrations/20261015132733_duplicate.sql").write_text("select 1;")
                with self.assertRaisesRegex(ValueError, "duplicate migration"):
                    preflight.check()
