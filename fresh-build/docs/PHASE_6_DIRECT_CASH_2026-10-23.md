# Phase 6 direct Treasurer cash — 23 October 2026

## Built slice

`20261023042818_direct_treasurer_cash_posting.sql` adds an atomic command for a **named cash donation already physically counted by the Treasurer**. It calls the existing one-time submission and verification rules in one database transaction. The operation ID is shared by both steps, so an exact retry returns the same donation ID; an altered retry fails. A private immutable `direct_cash_posts` link records which Treasurer used the direct path. The existing one-time donation source generates one positive ledger effect and an opaque receipt only after successful posting. An existing ordinary pending donation with the same operation ID cannot be silently converted into a direct post.

The web finance screen shows a separate Treasurer-only form with donor, India date, exact INR amount, numbered evidence reference, active Cash account and a counted-cash acknowledgement. The database enforces the role and account rules. The ordinary submission form continues to create a pending review. Its successful submission now remains visibly successful if a later balance refresh fails, avoiding an accidental new-operation retry.

This path is for a named donation, not an aggregate collection-task count. Direct posts reserve the normalized numbered evidence reference, so the same slip cannot be posted again under a different operation ID. A different slip can still be issued for the same physical cash; independent cash reconciliation and collection-task double-count prevention remain required before live use.

## Evidence

- Current Supabase function and RLS guidance was checked on 23 October. The migration pins the definer search path, revokes default function/table privileges, enables RLS and checks the actor at execution. The local Supabase security advisor reported no issues.
- The Phase 6 rollback-only SQL fixture passed Member denial, invalid account atomicity, exact replay, changed replay denial, ordinary-pending collision denial, one effect, one receipt and a 66,234-paise final balance after the earlier expense fixture.
- Three separately issued local Auth sessions passed President/Member denial and Treasurer direct posting over the Data API. A 1,234-paise named cash donation had one income effect, a verified receipt and an 11,234-paise account balance after a 10,000-paise opening. Exact replay reused the ID; changed replay and a new operation using the same normalized slip returned SQLSTATE 23505. Two simultaneous requests for one operation returned the same donation ID; two simultaneous distinct operations for one slip produced one success and one 23505, with a final 11,634-paise balance across three legitimate direct posts. The script reset the disposable database in `finally`.
- All 25 local migrations applied. All 12 rollback-only SQL fixtures, 131 Node tests, lint, typecheck, formatting, environment checks and the web production build passed. Final Auth users, app users, direct posts, finance effects, one-time donations and Storage object counts were zero.

## Remaining gate

This is not a completed Phase 6 or a release approval. The new web form has build coverage but no signed-in browser acceptance. Android parity, hosted/staging migration and role tests, collection-task counts, cross-path duplicate prevention, independent cash reconciliation, private proof handling, and operator acceptance remain open. Do not use this path for real cash until those gates and the masjid's finance approvals are complete.

Subsequent work on 23 October added collection-task counts and shared slip claims for all three cash routes; see `PHASE_6_CASH_TASK_COUNTS_2026-10-23.md` for the current local proof and remaining gates.
