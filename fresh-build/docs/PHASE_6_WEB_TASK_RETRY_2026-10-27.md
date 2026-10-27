# Web task action and refresh handling — 27 October 2026

The work-task page previously placed the task mutation and the subsequent list refresh in one `try` block. If the RPC saved a cash count or task action and the refresh failed, the page returned `false` and displayed the refresh error as an action failure. A user could submit the stale form again with a new operation ID.

The page now keeps the operation ID across an uncertain mutation response, deletes it only after a successful RPC, and reports a subsequent refresh failure as a saved action with a stale list. It blocks further mutations until the user reloads the task list. A failed initial list load shows a recoverable error state rather than indefinite “Checking your account.” System Admin is shown an unavailable message instead of calling task RPCs whose database role guard excludes that role.

## Verification

- Two new command tests passed: saved mutation with failed refresh, and uncertain mutation followed by an exact same-ID retry.
- Full Node suite: 168 passed, zero failed.
- ESLint, JavaScript typecheck, Prettier check, production web build and unconfigured HTTP smoke passed.
- Existing SQL role guards and cash-count idempotency remain unchanged.

## Still required

Exercise the web page with issued President/Member/Treasurer sessions on a hosted or staging candidate, including an interrupted refresh after a saved cash count, then reconcile the resulting count, ledger effect and receipt. This local source/build test does not prove that signed-in browser journey.
