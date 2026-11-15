import copy
import unittest

from check_dependency_audit import check_audit

GLOB = "https://github.com/advisories/GHSA-3g3m-2fjr-6pw4"


def sample():
    return {
        "metadata": {"vulnerabilities": {"info": 0, "low": 0, "moderate": 2, "high": 0, "critical": 0, "total": 2}},
        "vulnerabilities": {
            "glob": {"severity": "moderate", "via": [{"url": GLOB}]},
            "@expo/config-plugins": {"severity": "moderate", "via": ["glob"]},
        },
    }


class DependencyAuditTests(unittest.TestCase):
    def test_reviewed_moderates_and_clean_audit_pass(self):
        self.assertEqual(check_audit(sample()), [])
        clean = sample()
        clean["metadata"]["vulnerabilities"].update(moderate=0, total=0)
        clean["vulnerabilities"] = {}
        self.assertEqual(check_audit(clean), [])

    def test_new_advisory_or_package_fails(self):
        unknown = sample()
        unknown["vulnerabilities"]["glob"]["via"][0]["url"] = "https://github.com/advisories/GHSA-new"
        self.assertTrue(check_audit(unknown))
        package = sample()
        package["vulnerabilities"]["other"] = {"severity": "moderate", "via": ["glob"]}
        package["metadata"]["vulnerabilities"].update(moderate=3, total=3)
        self.assertTrue(check_audit(package))

    def test_any_high_or_low_fails_even_for_a_reviewed_package(self):
        for level in ("high", "low"):
            audit = sample()
            audit["vulnerabilities"]["glob"]["severity"] = level
            audit["metadata"]["vulnerabilities"].update({"moderate": 1, level: 1})
            self.assertTrue(check_audit(audit))

    def test_old_expo_57_findings_no_longer_pass(self):
        audit = {
            "metadata": {"vulnerabilities": {"info": 0, "low": 0, "moderate": 0, "high": 1, "critical": 0, "total": 1}},
            "vulnerabilities": {
                "node-forge": {"severity": "high", "via": [{"url": "https://github.com/advisories/GHSA-86w9-cpqp-85rv"}]},
            },
        }
        self.assertTrue(check_audit(audit))

    def test_critical_or_audit_error_fails(self):
        critical = copy.deepcopy(sample())
        critical["vulnerabilities"]["glob"]["severity"] = "critical"
        critical["metadata"]["vulnerabilities"].update(moderate=1, critical=1)
        self.assertTrue(check_audit(critical))
        self.assertTrue(check_audit({"error": {"code": "ENOTFOUND"}}))

    def test_inconsistent_counts_fail(self):
        audit = sample()
        audit["metadata"]["vulnerabilities"]["moderate"] = 1
        self.assertTrue(check_audit(audit))
        low = sample()
        low["metadata"]["vulnerabilities"]["low"] = 1
        self.assertTrue(check_audit(low))


if __name__ == "__main__":
    unittest.main()
