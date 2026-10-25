# Hosted rollback-only SQL fixture sweep — 25 October 2026

**Target:** isolated Supabase development project `necattvpncnsrfcrwpjn`, with 30 fresh-build migrations applied. This is a synthetic development database, not staging or production.

The SQL API cannot execute psql's `\gset` meta command. `backend/scripts/connector_fixture_sql.py` rendered each fixture into transaction-local SQL variable captures. Each rendered fixture retained its `BEGIN` and `ROLLBACK`; no fixture was committed. The converted `phase7_report.sql` fixture, including its two JSON artifact-claim captures, ran successfully.

All 14 fixtures passed on the hosted project: `identity_roles`, `monthly_contributions`, `finance_foundation`, `phase4_corrections`, `phase4_beneficiary_versions`, `phase6_money`, `phase6_cash_tasks`, `phase7_report`, `phase8_tasks`, `receipt_handoff_audit`, `phase9_meetings`, `phase10_content`, `security_catalog` and `eight_role_reads`.

After the sweep, readback returned zero Auth users, app users, finance effects, report runs, receipt handoff events, approved consent versions and Storage objects. The receipt handoff policy remained disabled. The same 14 fixtures had passed after a clean local reset in the preceding receipt-handoff slice.

This proves database assertions and rollback behavior on the isolated hosted development schema. It does not prove browser or Android clients, separately issued real Auth sessions, report PDF/CSV worker delivery, staging, private-object backup/restore, official payment reconciliation or public real-money readiness. Those gates remain in `tasks.md`.
