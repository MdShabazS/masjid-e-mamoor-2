import unittest

from connector_fixture_sql import render


class ConnectorFixtureTests(unittest.TestCase):
    def test_gset_value_remains_transaction_local(self):
        source = "begin;\nselect 'abc' as captured_id \\gset\nselect :'captured_id';\nrollback;\n"
        result = render(source)
        self.assertIn("set_config('connector_fixture.captured_id'", result)
        self.assertIn("current_setting('connector_fixture.captured_id', true)", result)
        self.assertTrue(result.rstrip().endswith("rollback;"))

    def test_rejects_unbound_variable_and_commit(self):
        with self.assertRaisesRegex(ValueError, "unbound"):
            render("begin;\nselect :'missing';\nrollback;")
        with self.assertRaisesRegex(ValueError, "must not commit"):
            render("begin;\ncommit;\nrollback;")


if __name__ == "__main__":
    unittest.main()
