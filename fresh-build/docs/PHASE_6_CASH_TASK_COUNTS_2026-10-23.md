# Phase 6 collection-task cash count — 23 October 2026

## Implemented

Migration `20261023101443_cash_collection_task_counts.sql` adds a cash-collection marker to an ordinary work task. A President, Vice President or Secretary creates the marked task. A confirmed participant other than the Treasurer can submit one pending count with an India date, claimed amount and numbered slip. Submitting changes no account balance and creates no receipt. A Treasurer sees pending counts, enters the amount physically received and an active Cash account, and verifies. The existing one-time donation posting function then creates one finance effect and one receipt in the same transaction. The count records both claimed and actual amounts.

`cash_slip_claims` reserves normalized slip references. Existing verified cash donations are backfilled; new ordinary one-time cash donations claim their slip at verification, direct posts claim it atomically, and pending task counts claim theirs immediately. A private verification link proves when a task-owned slip belongs to its resulting one-time donation. The unique key rejects reuse across all three cash routes, including concurrent direct-to-task competition. Exact operation retries return the prior count or donation; changed retries fail. Private tables have RLS and no direct authenticated grants. The read RPC exposes another participant's count status without disclosing its amount or slip; the submitter and Treasurer see those details.

The web task page can create a cash collection task and lets an assigned participant submit its count. The web finance page shows pending counts to the Treasurer and requires a physical-count acknowledgement before posting the actual amount. A successful post remains marked successful even if the subsequent list refresh fails.

## Local evidence

- Fresh disposable local Supabase reset applied all 26 migrations. `supabase migration list --local` showed all 26 applied; the local security advisor reported no issues.
- All 13 rollback-only SQL fixtures passed, including `phase6_cash_tasks.sql`. The cash fixture checked private grants, ordinary-task rejection, assigned counter scope, pending-no-money, Treasurer-only verification, actual versus claimed amount, one effect/receipt, exact and changed replay, and slip collisions involving direct, task and ordinary cash.
- `phase6_cash_task_api.py` used separately issued President, Treasurer and Member Auth sessions over the Data API. It passed pending/verified projections, role denial, exact replay, all three cash-route collisions and a simultaneous direct-post versus task-count race. Exactly one race path succeeded. After completing the winning count if needed, the synthetic cash account held 12,300 paise: 10,000 opening + 1,400 task + 200 direct + 300 race + 400 ordinary cash. The script reset the database; final Auth users/sessions, app users, finance effects, task counts, slip claims and Storage objects were `0|0|0|0|0|0|0`.
- 131 Node tests, lint, typecheck, format check, fixture preflight and production web build passed.

## Remaining before live cash use

Different references for the same physical cash still need independent reconciliation. The subsequent rejection and replacement work is recorded in `PHASE_6_CASH_COUNT_REJECTION_2026-10-23.md`. The web controls need a signed-in browser journey, Android parity, hosted and staging tests, and operator acceptance. Named finance operators must reconcile physical slips and account openings before real money is entered. These limits keep Phase 6 and release acceptance open.
