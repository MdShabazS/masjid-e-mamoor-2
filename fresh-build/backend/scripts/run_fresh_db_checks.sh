#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
python3 scripts/db_fixture_preflight.py
if [[ -z "${FRESH_BUILD_TEST_DATABASE_URL:-}" ]]; then
  echo 'Set FRESH_BUILD_TEST_DATABASE_URL to an isolated disposable Postgres database.' >&2
  exit 2
fi
if [[ "${FRESH_BUILD_TEST_DATABASE_CONFIRM:-}" != 'disposable' ]]; then
  echo 'Set FRESH_BUILD_TEST_DATABASE_CONFIRM=disposable after checking the target is isolated.' >&2
  exit 2
fi
if ! command -v psql >/dev/null; then
  echo 'psql is required for real role and migration fixtures.' >&2
  exit 2
fi
for fixture in tests/identity_roles.sql tests/monthly_contributions.sql \
  tests/finance_foundation.sql tests/phase4_corrections.sql \
  tests/phase4_beneficiary_versions.sql \
  tests/phase6_money.sql tests/phase6_cash_tasks.sql tests/phase7_report.sql tests/phase8_tasks.sql \
  tests/receipt_handoff_audit.sql \
  tests/phase9_meetings.sql tests/phase10_content.sql \
  tests/security_catalog.sql tests/eight_role_reads.sql; do
  echo "Running $fixture"
  psql -X "$FRESH_BUILD_TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f "$fixture"
done
echo 'All fresh DB fixtures passed.'
