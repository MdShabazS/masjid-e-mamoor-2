# Phase 2 — threat, verification and migration plan

**Prepared:** 15 October 2026. **Status:** design draft. The fresh backend has no development project and has not passed SQL tests. This plan is the order in which we can turn `PHASE_2_DATA_API_CONTRACT.md` into migrations without importing the legacy schema or accidentally exposing incomplete policies.

## Threat-led verification matrix

| Asset / attacker path | Required design control | Evidence required before release |
|---|---|---|
| Stolen/deactivated member JWT | Server reads current active actor/role for every command; sensitive session freshness; first-login password gate | Old token after deactivation/reset, alternate actor ID and `user_metadata` role forgery denied |
| Username enumeration and password guessing | Private username alias, uniform login failure, per-account/IP rate limits, no direct email lookup, safe reset | Same outward failure for unknown/known username; throttle and log redaction |
| Direct table/RPC/view access | Private schema by default, explicit Data API exposure/grants and RLS; narrow definer function only when reviewed; default-deny grants | `anon`, each eight roles, inactive and service route direct table/function/view probes; advisors and grants snapshot |
| IDOR on donor, expense, meeting or object path | Object-specific relationship in server and DB; fixed field projection; no trust in route UUID | Caller substitutes another UUID/Storage path and receives no record bytes |
| Same person requests/approves/pays | Requester role/ID snapshotted; approver different; T only pays approved version; lock for concurrent payment | P/T/L exception scenarios and two concurrent payments cannot exceed cap |
| Duplicate posting/webhook/offline replay | Unique operation payload hash, external reference key, source posting, provider event, outbox purpose; transaction lock | Identical retry returns original; changed payload conflicts; concurrent duplicates yield one effect |
| QR substitution or wrong beneficiary | P/L audited activation binds digest to active account; send snapshot; T evidence checks actual account | Altered QR bytes/old request/queued send/wrong bank account blocked or investigated |
| Receipt enumeration and donor disclosure | 128-bit or stronger random code, rate limit, minimal response, generic unknown/void, private bytes | Brute-force/rate-limit test, no phone/internal ID in PDF/response, void state clear |
| Forged Meta webhook or STOP race | Verify ingress signature using server secret; inbox dedupe; opt-out transaction, recheck at dispatch | Bad signature, duplicate event, STOP during retry, provider outage and old event replay |
| Bad file upload or permanent private URL | Byte/MIME/size checks, opaque staging and per-object access; no permanent public proof links | HTML/polyglot/oversize/orphan/private URL probes |
| GPS spoof/low accuracy, remote organizer | Fresh foreground fix with timestamp/accuracy/within 100 m and scheduled local day; onsite organizer proof; audit | Emulator spoof tests plus real-site boundary/denial trial; no stale offline mark |
| Compromised laptop restore | Named L session; server-only credentials, staging, manifest/hashes, operational alert and recovery path | Wrong role, stolen/stale session, corrupt/missing object and failed preflight do not cut over |
| Old APK bypass | Server-protected minimum client version on commands, public download remains accessible | Signed old→new upgrade with local draft retention; old direct RPC denied |

**Test levels:** Node domain tests are fast rule checks; real Postgres tests prove constraints/grants/RLS/concurrency; API integration tests prove server actor and error contract; browser/Android end-to-end proves workflow; physical location, real Meta account, receipt PDF, signed upgrade and clean DB+object restore are separate release evidence. Do not count a lower level as passing a higher one.

## Fresh migration and deployment sequence

1. **Inventory and freeze prototype:** The unexecuted `backend/001_monthly_contributions.sql` prototype is retained in Git history. Inventory its public tables/RPCs and gaps against the new contract. Do not apply the legacy root migrations to the fresh project.
2. **Create isolated development project:** Record CLI/server/Postgres versions and actual Data API exposure mode. Current Supabase changelog says new `public` tables are not automatically exposed by default on new projects; do not assume table/REST availability. Explicitly test intended routes and grants. See [breaking-change notice](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically).
   The [October 2026 breaking-change feed](https://supabase.com/changelog?types=breaking-change) also announces upcoming removal of older TLS ciphers and a Postgres minor release affecting some extension indexes/legacy pgcrypto data. This fresh project should use current supported clients, inventory extensions and record versions; it has no legacy ciphertext to migrate by assumption.
3. **Foundation migrations:** private schemas, extension placement, roles/actor/profile/credential gate, schema version, operation/audit tables. Revoke default function execution and direct DML before adding functions; explicit API exposure only for named surfaces. Keep identity provisioning bootstrap server-only.
4. **Ledger migrations:** accounts, opening approvals, balanced effects, correction links and transactional operation handling. Seed test accounts in development only. Independent reconciliation and concurrency tests must pass before contribution/expense writes use ledger.
5. **Vertical contribution migrations:** donor consent/suggestion/QR/request snapshots, claims, normalized reference and rejection revisions, verified posting, receipts/referral and narrow read projections. Gate M edit scope and publication until owner decision. Migrate prototype UI clients to versioned API and decimal-string wire amounts.
6. **Remaining modules:** expense/advance/salary, tasks, meetings/attendance/prayers, content/release, reports, outbox/inbox, backup metadata. Each migration adds constraints and role tests with one deployable vertical slice. Private Storage policies/bytes are versioned with metadata migrations.
7. **Safe cutover:** on an empty fresh production project, apply reviewed migrations in staging first, run advisors and negative role tests, deploy compatible API, then client builds. Avoid overwriting historical migrations. For later versions, expand schema, backfill/dual-read where needed, deploy compatible clients, verify, then remove obsolete grants/columns in a later migration.
8. **Rollback and failure:** record migration version, database/object backup manifest, feature flags and previous APK/site URL. Roll back application to last compatible version where schema allows; for an irreversible data migration, restore only from a validated staging rehearsal/production backup with an incident decision. Never silently reverse a posted transaction by reverting code.

## SQL and API review gates

- Use the installed CLI's `--help` and current docs for actual migration/test/advisor commands. Generate migrations under the chosen fresh backend directory and commit them in order. SQL change review includes `search_path`, owner, function `EXECUTE`, grants, RLS, schema exposure, row relationship and service-role route checks.
- New `SECURITY DEFINER` code is exceptional: put privileged routines in an unexposed schema, pin path, schema-qualify objects, resolve current actor/row inside, avoid dynamic SQL unless reviewed, revoke default call privileges. API facade invokes narrowly scoped server routes. If any public wrapper persists during transition, its caller grants/body are independently threat tested.
- Every migration has a clean-schema install test, previous-schema upgrade test where applicable, rollback/compatibility note, role/negative tests and concurrent mutation scenario. A SQL file alone is not deployed evidence. Run database advisors and inspect severe findings before staging promotion.
- Service role bypasses RLS; the API facade must first authenticate the client and authorize command/object, then pass a server-verifiable actor to DB logic. Privileged worker calls use distinct job credentials or named operations. No service key in Android/web bundles or response headers.
- No production messaging, receipt public lookup, payroll display, QR request, location attendance or restore until the specific Phase 1 owner/setup gate is recorded. A staging test with synthetic data does not imply that gate is met.

## Phase 2 exit evidence checklist

- [x] Component boundaries and trust flow: `PHASE_2_SYSTEM_ARCHITECTURE.md`.
- [x] Aggregate ownership, invariants, wire conventions, command/error/event contract: `PHASE_2_DATA_API_CONTRACT.md`.
- [x] Threat/abuse scenarios, verification levels, fresh migration/cutover and rollback: this document.
- [ ] Review with Phase 1 owner decisions; freeze affected actor grants, referral score, L expense sequence, public/payroll/consent/retention behavior.
- [x] Draft the first donor/claim typed OpenAPI slice at `../backend/api/openapi.v1.json`; JSON syntax and all local references checked.
- [ ] Extend typed contracts to every endpoint/event and exact DB physical model; validate API design against real Supabase dev environment.
- [ ] Map each of 25 acceptance IDs to specific endpoint, table/constraint, negative test file and Android/web journey with named evidence owner.
- [ ] Run design review and record unresolved risks/approved changes. No database execution yet.

These remaining items mean **Phase 2 has started but is not complete**. The next independent slice is typed request/response schemas and endpoint-specific acceptance mapping; owner-gated commands remain disabled.
