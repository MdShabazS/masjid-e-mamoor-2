# Phase 3 checkpoint — 15 October 2026

**Status: incomplete.** Backend source is more concrete; no development DB,
staging DB, running Auth broker or device session has been verified.

| Work | Evidence | State |
|---|---|---|
| Fresh project separation | `backend/supabase/config.toml`, ordered migrations, no legacy import | Source ready; project not provisioned |
| Identity and permission gate | Private username/credential tables, current-state actor guard, SA provision/reset/role/deactivation RPCs and immutable audit | Source ready; SQL unexecuted |
| Server Auth bridge | `backend/identity/service.js`, adapter, five Node tests | Unit tested; HTTP/TLS/rate limiting and both clients not wired |
| Donor management policy | Final migration revokes enrollment from `authenticated` | Source gated; owner consent/grant decision outstanding |
| Real role and lifecycle tests | `backend/tests/identity_roles.sql` and contribution transaction suite | Written; no actual Postgres run |
| Typed contracts, pagination, Storage and full API | Phase 2 draft only | Pending |
| Concurrent requests, stale client, rollback | No independent live sessions or clean reset | Pending |

## Remaining sequence

1. Provision a **new isolated development** Supabase project after selecting the
   organization, region and cost. Keep its secrets private. Validate project
   Auth signup and Data API exposure settings against the local config.
2. Apply all fresh migrations to a disposable local or development DB and
   run `identity_roles.sql`, `monthly_contributions.sql` and `finance_foundation.sql` under real roles.
   Fix every migration, grant, Auth fixture or RPC behavior found. Check security
   and performance advisors. Test a clean reset and an isolated rollback.
3. Bootstrap one named SA, then provision named users and the data-entry
   employee. Expose a protected, throttled HTTP identity facade, safe session
   cookie/mobile token handling and recovery process. Remove direct email
   sign-in from the two prototype clients. Verify forced change, reset,
   deactivation and stale JWT behavior on both clients.
4. Finish typed request/response validation, cursor pagination, Storage
   policies, service-only routes, role/object matrix and independent-session
   race/retry tests. Resolve owner-dependent grants before enabling them.

**Exit remains unmet:** no claim of a production-ready backend or a completed
Phase 3 until database and client journeys pass.
