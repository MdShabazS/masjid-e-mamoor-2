# Phase 6 cash count rejection and replacement — 23 October 2026

## Implemented

Migration `20261023103413_cash_collection_count_rejection.sql` lets only the Treasurer reject a pending collection count with a 3–240 character reason. A rejection records the Treasurer, operation ID and time, creates no finance effect or receipt, and cannot be edited or reversed. Exact retries return the same rejected count; changed retries fail. Verification and rejection lock the same count row, so competing decisions cannot both succeed.

An assigned participant may submit a corrected count after rejection. Each replacement links to the immediately preceding rejected count. The task can have only one pending or verified count at a time; a verified count cannot be replaced. A correction requires a **new numbered slip**. Rejected slips remain claimed and cannot later be posted through a task, direct Treasurer cash, or ordinary one-time cash path. The complete chain remains in private `cash_task_counts`; the visible workflow shows its current count and rejection reason to an assigned participant or the Treasurer.

The web finance screen lets the Treasurer enter a rejection reason alongside the verify controls. The task screen shows the reason and permits a corrected submission with a new slip. Both screens keep a successful action visibly successful if a subsequent refresh fails.

## Local proof

- A fresh disposable local database applied all 27 migrations; migration history was consistent. Supabase security and performance advisors found no issues.
- All 13 rollback-only SQL fixtures passed. `phase6_cash_tasks.sql` exercised two rejections followed by a verified third count, exact and changed rejection retries, delayed replay of the original submission, rejected-slip reuse denial, predecessor links and one final receipt/effect. The final fixture account total was 12,750 paise, including its 10,000-paise opening and only the valid posted cash.
- `phase6_cash_task_api.py` used separately issued President, Treasurer and Member sessions. It denied the President's rejection, showed the reason to the counter, blocked verification of a rejected count and reuse of its slip, then verified a corrected count. In a simultaneous reject/verify race on another count, exactly one decision succeeded and the account total matched that winner. The script reset its synthetic users and rows.
- 131 Node tests, lint, typecheck, formatting, environment checks, fixture preflight, Python compilation and production web build passed. The disposable database was confirmed empty after the issued-session run.

## Remaining gates

The new controls have build coverage and issued Data API proof, but no signed-in browser acceptance or Android parity. Hosted/staging migration and role tests, physical slip reconciliation for different references representing the same cash, operator acceptance and real account/opening approval remain open. This slice does not make Phase 6 or the release ready for live cash.
