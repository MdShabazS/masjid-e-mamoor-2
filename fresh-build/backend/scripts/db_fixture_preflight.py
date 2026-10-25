#!/usr/bin/env python3
"""Fail closed if a SQL fixture can commit test records or inventory drifts."""

import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parents[1]
FIXTURES = [
    "identity_roles.sql", "monthly_contributions.sql", "finance_foundation.sql",
    "phase4_corrections.sql", "phase4_beneficiary_versions.sql", "phase6_money.sql", "phase6_cash_tasks.sql", "phase7_report.sql",
    "phase8_tasks.sql", "phase9_meetings.sql", "phase10_content.sql",
    "receipt_handoff_audit.sql",
    "security_catalog.sql", "eight_role_reads.sql",
]


def check() -> tuple[int, int]:
    migrations = sorted((ROOT / "supabase/migrations").glob("*.sql"))
    fixtures = sorted((ROOT / "tests").glob("*.sql"))
    if not migrations or len({p.name[:14] for p in migrations}) != len(migrations):
        raise ValueError("Missing migrations or duplicate migration timestamp")
    if {p.name for p in fixtures} != set(FIXTURES):
        raise ValueError("SQL fixture inventory differs from runner")
    for fixture in fixtures:
        # This conservative guard is not a SQL parser. Keep fixtures free of
        # extra top-level transaction statements and review the diff manually.
        source = re.sub(r"--[^\n]*", "", fixture.read_text()).strip().lower()
        if (not re.match(r"^begin\s*;", source)
                or not re.search(r"rollback\s*;\s*$", source)
                or len(re.findall(r"\bbegin\s*;", source)) != 1
                or len(re.findall(r"\brollback\s*;", source)) != 1
                or re.search(r"\bcommit\s*;", source)):
            raise ValueError(f"Fixture transaction boundary unsafe: {fixture.name}")
    return len(migrations), len(fixtures)


if __name__ == "__main__":
    migrations, fixtures = check()
    print(f"Inventory checked: {migrations} migrations, {fixtures} rollback-only fixtures")
