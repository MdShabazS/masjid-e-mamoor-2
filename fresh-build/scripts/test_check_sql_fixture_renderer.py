"""Guard the hosted rendering of rollback-only SQL fixtures."""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from render_sql_fixture import render  # noqa: E402


class FixtureRendererTests(unittest.TestCase):
    def test_captured_values_are_transaction_local(self):
        source = "begin;\nselect 'abc' as item, 'def' as other \\gset\nselect :'item', :'other';\nrollback;\n"
        result = render(source)
        self.assertIn("set_config('fixture.' || kv.key, kv.value, true)", result)
        self.assertIn("current_setting('fixture.item', true)", result)
        self.assertIn("current_setting('fixture.other', true)", result)
        self.assertTrue(result.endswith("rollback;\n"))

    def test_every_checked_in_fixture_renders(self):
        root = Path(__file__).parents[1] / "backend" / "tests"
        for path in sorted(root.glob("*.sql")):
            with self.subTest(path=path.name):
                source = path.read_text()
                result = render(source)
                self.assertTrue(result.rstrip().endswith("rollback;"))
                self.assertNotIn(r"\gset", result)


if __name__ == "__main__":
    unittest.main()
