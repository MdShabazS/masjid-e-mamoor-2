# Web task action and refresh handling — 27 October 2026

The work-task page previously placed the task mutation and the subsequent list refresh in one `try` block. If the RPC saved a cash count or task action and the refresh failed, the page returned `false` and displayed the refresh error as an action failure. A user could submit the stale form again with a new operation ID.

The page now keeps the operation ID across an uncertain mutation response, deletes it only after a successful RPC, and reports a subsequent refresh failure as a saved action with a stale list. It blocks further mutations until the user reloads the task list. A failed initial list load shows a recoverable error state rather than indefinite “Checking your account.” System Admin is shown an unavailable message instead of calling task RPCs whose database role guard excludes that role.

## Verification

- Two new command tests passed: saved mutation with failed refresh, and uncertain mutation followed by an exact same-ID retry.
- Full Node suite: 168 passed, zero failed.
- ESLint, JavaScript typecheck, Prettier check, production web build and unconfigured HTTP smoke passed.
- Existing SQL role guards and cash-count idempotency remain unchanged.

## Still required

An interrupted refresh immediately after a successful browser mutation remains to be exercised through the full UI. The pure command tests cover that timing locally. Repeat the signed-in browser journey on hosted development and staging, then reconcile a paper slip against physical cash and the account statement before real-money use.

## Signed-in local browser follow-up

On 27 October, the separate disposable `masjid-e-mamoor-2-fresh` stack ran the current web source with synthetic President, Member, Treasurer and System Admin sessions. The President created an open collection task, and the Member joined and submitted numbered slip `RETRY-BROWSER-001` for ₹23.50. Before verification, the database showed one pending count, one 10,000-paise opening effect and no donation effect. The Treasurer's web review showed the pending count and ₹100.00 balance. After physical-count acknowledgment and verification, the page showed ₹123.50 and no pending count. Database reconciliation showed one verified 2,350-paise count, one `one_time_donation` effect, a non-null receipt identity, a 12,350-paise account total and one reserved slip key. The System Admin task page displayed its unavailable-role message instead of hanging or exposing task controls.

The fixture's local reset then reported zero Auth users, sessions, app users, finance effects, cash counts, slip claims and Storage objects (`0|0|0|0|0|0|0`). Only this fresh local stack and its Colima runtime were stopped. The test did not use real people, cash, bank details or hosted services.
