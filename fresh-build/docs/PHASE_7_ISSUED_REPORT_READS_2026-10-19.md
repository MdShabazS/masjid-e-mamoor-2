# Phase 7 issued-session report read check — 19 October 2026

**Environment:** disposable local `masjid-e-mamoor-2-fresh` Supabase stack, using all 20 fresh migrations. No masjid or production data was used.

The eight-role issued-session runner created one synthetic cash account. The Treasurer submitted a 12,345-paise opening, and the President verified it. President, Vice President, Secretary and Treasurer each requested a separate current-month report through the Data API with an issued Auth session. The report snapshots were then read through `list_finance_report_lines` and `list_finance_report_balances`.

| Check | Expected | Actual |
| --- | --- | --- |
| Report requests | Four authorized roles can create a current-month snapshot | Four HTTP 200 responses with report run IDs |
| Report read roles | System Admin, President, Vice President, Secretary and Treasurer can read the President's run under the current database guard | Ten HTTP 200 calls across two report RPCs |
| Opening line and balance | One `account_opening` line for `12345` paise; one account balance with period opening and closing of `12345` paise | Exact values passed for each permitted reader and each requester's own run |
| Existing permission matrix | All prior allowed and denied role checks remain valid | 103 permitted reads across 25 RPCs; three cross-creator task denials; 288 wrong-role calls across 65 guarded RPCs; expired JWT, live role change and deactivation checks passed |
| Phase 7 SQL fixture | Mixed-source report totals, revisions and denial rules remain valid | Rollback-only `tests/phase7_report.sql` passed |
| Cleanup | No synthetic application or private-object records remain | Auth users/sessions, profiles, accounts, effects, report runs, tasks and Storage objects: `0|0|0|0|0|0|0|0`; fresh stack stopped |

The local runner is `backend/scripts/phase3_issued_role_matrix.py`. It resets the disposable database in `finally`; the SQL fixture rolls back. The test strengthens the API contract for the two report readers that previously returned `report_not_found` without a valid run.

This is a local database and Data API check. It does not prove hosted issued-session report reads, PDF/CSV generation, worker status and retries, field-level privacy approval, revised-report links in either client, or staging behavior. The current guard allows System Admin to read an existing report but not request one; accepted-policy mapping of that distinction remains open.
