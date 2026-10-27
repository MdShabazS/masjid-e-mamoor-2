# Android collection task and cash count slice — 27 October 2026

## Implemented

- President, Vice President and Secretary can choose a cash collection task when creating a work task. The existing `create_cash_collection_task` RPC records the task type.
- Eligible participants can submit a dated, numbered cash slip and exact positive rupee amount through `submit_cash_task_count`. A rejected count requires a new numbered slip; the previous count remains in the database audit trail.
- The Treasurer sees pending counts even when not a task participant, can record the physically received amount, choose an active Cash account, acknowledge the physical count and slip check, then confirm `verify_cash_task_count`. The Treasurer can instead give a bounded reason through `reject_cash_task_count`.
- The Android client uses the existing role-guarded RPCs and stable operation IDs. A successful mutation is not retried as a new operation if the subsequent list refresh fails. Input builders use integer paise and reject malformed dates, amounts, account choices and reasons.

## Verification

- The seven focused work-task input tests passed, including four new cash input/review cases.
- Full Node suite: 166 passed, zero failed.
- ESLint, JavaScript typecheck, Prettier check, environment-template check and Android bundle export passed.
- The public bundle check scanned 49 existing web and newly exported Android assets with a synthetic server-secret canary; none contained it.
- Existing local SQL and issued-session tests covered the underlying cash task RPCs, rejection/replacement and single-post ledger behavior before this client change. No database schema or grant changed in this slice.

## Still required

Run the full collection-to-Treasurer-review journey in signed-in Android sessions on a real device and in staging. Reconcile the numbered paper slip against physical cash and the account statement independently. A local bundle export does not prove touch behavior, persistence, or real-money readiness.
