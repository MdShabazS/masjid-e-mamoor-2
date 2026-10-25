import copy
import unittest

from check_dependency_audit import check_audit


def sample():
    return {
        "metadata": {"vulnerabilities": {"info": 0, "low": 0, "moderate": 0, "high": 2, "critical": 0, "total": 2}},
        "vulnerabilities": {
            "node-forge": {"severity": "high", "via": [{"url": "https://github.com/advisories/GHSA-86w9-cpqp-85rv"}]},
            "@expo/cli": {"severity": "high", "via": ["node-forge"]},
        },
    }


class DependencyAuditTests(unittest.TestCase):
    def test_known_highs_and_clean_audit_pass(self):
        self.assertEqual(check_audit(sample()), [])
        clean = sample()
        clean["metadata"]["vulnerabilities"].update(high=0, total=0)
        clean["vulnerabilities"] = {}
        self.assertEqual(check_audit(clean), [])

    def test_new_advisory_or_package_fails(self):
        unknown = sample()
        unknown["vulnerabilities"]["node-forge"]["via"][0]["url"] = "https://github.com/advisories/GHSA-new"
        self.assertTrue(check_audit(unknown))
        package = sample()
        package["vulnerabilities"]["other"] = {"severity": "high", "via": []}
        package["metadata"]["vulnerabilities"].update(high=3, total=3)
        self.assertTrue(check_audit(package))

    def test_critical_or_audit_error_fails(self):
        critical = copy.deepcopy(sample())
        critical["vulnerabilities"]["node-forge"]["severity"] = "critical"
        critical["metadata"]["vulnerabilities"].update(high=1, critical=1)
        self.assertTrue(check_audit(critical))
        self.assertTrue(check_audit({"error": {"code": "ENOTFOUND"}}))

    def test_inconsistent_counts_fail(self):
        audit = sample()
        audit["metadata"]["vulnerabilities"]["high"] = 1
        self.assertTrue(check_audit(audit))


if __name__ == "__main__":
    unittest.main()
