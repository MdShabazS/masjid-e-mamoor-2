# Phases 2–4 completion audit — 15 October 2026

Historical audit. See `PHASE_3_DATABASE_EXECUTION_2026-10-16.md` and
`PHASE_4_EXECUTION_2026-10-17.md` for later database and race-test evidence.
The phase exits remain open.

This audit distinguishes source drafts and unit tests from operational proof.
**None of Phases 2, 3, or 4 meets its exit criteria.** The source work remains
inside this fresh-build worktree. No new development or staging Supabase
project is connected; Docker Desktop cannot launch in this environment and
there is no `psql` executable.

| Phase | What exists and has been checked locally | Completion blockers |
|---|---|---|
| 2 — architecture | Boundaries, risk/migration model, 25 acceptance mappings, shared wire validators/types, signed cursor helper, 16-operation OpenAPI draft with local refs resolving. | Real Auth/Data API validation; full domain/event machine schemas; owner decision and design review; frozen physical schema/permissions and rollback proof. |
| 3 — identity/backend | Four fresh migrations (including finance slices), private identity gate, SA command functions, server Auth service and request handler with injected shared rate limiter/trusted proxy IP. Unit tests cover error mapping and Auth ordering. | Provision new isolated DB; run/repair migrations and real-role tests; actual HTTP deployment, durable limiter and secure browser cookie; username/first-login/reset/deactivation integration on web and Android; storage grants and independent-session concurrency/rollback. |
| 4 — finance | Account/beneficiary/opening/transfer effects, exact paise unit model, signed balance queries, append-only reconciliation observations, paged account history, SQL role fixture. | Execute SQL on real Postgres; correction/void and receipt/report supersession; full source ledger coverage, period totals and accounting-equation fixtures; independent concurrent transfer tests; account/finance client flows and restore rehearsal. |

## Verification from this audit

- `npm test` runs pure module and handler tests. It cannot execute SQL, Supabase
  Auth, Storage, database roles or either client against a provisioned account.
- OpenAPI JSON parsing and all local `$ref` resolution were checked.
- `git diff --check` and source archive checksum are mechanical checks only.
- The SQL test scripts are **prepared, not passing evidence**. A clean migration
  reset is the first required gate once a disposable development DB is available.

## Critical path for completion

1. Select the Supabase organization and confirm the exact project cost/region.
   Provision an isolated development project; staging later. A remote project
   must be new so the historical migrations are never mixed with this source.
2. Apply all fresh migrations in order, run all three SQL scripts under actual
   roles, inspect advisors, fix failures and run separate-session race tests.
3. Close owner-dependent grant and privacy decisions. Freeze the physical
   schema and API behavior against live Auth/Data API responses.
4. Deploy a throttled server identity facade; replace email sign-in on both
   clients and test first login, reset, deactivation and stale JWT.
5. Finish finance correction/reversal and reporting links, then verify full
   account equation, histories, role denial and restore before closing Phase 4.

No owner decision is inferred from silence. Donor management, salary/public
receipt exposure and other owner-gated flows remain disabled.
