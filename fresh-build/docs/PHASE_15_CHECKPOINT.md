# Phase 15 — operations and subsequent releases

**Prepared:** 16 October 2026 (India time). **Status:** source-level operator preparation only. The product has not launched, so no daily operations, alert delivery, provider spend review or real recovery evidence exists. Phase 14 and earlier exit criteria remain open.

## Daily operator routine (Asia/Kolkata)

| Check | Evidence to record | Failure action |
|---|---|---|
| Database and protected site | UTC check time, environment, reachable status, sanitized request ID | Stop risky financial commands if authority is uncertain; inspect hosting/DB logs, then test a protected role path. Never paste tokens or donor data into an incident note. |
| Database + private object backup | Latest completed UTC time, DB and object hash verification, offsite receipt, retention count | Page the recovery owner if older than 26 hours or either half is unverified; do not label a source `.tar.gz` as data recovery. Run a staged restore on a separate project before any cutover. |
| Finance | Treasurer bank/cash observations, account book totals, signed variance in paise and reconciliation reference | Investigate every nonzero variance with ledger source and immutable correction records. Do not physically delete or edit posted effects. |
| Jobs and reports | Failed/stale counts; first-Friday requests, five-day reminders, meeting/content queues, report run status | Pause retries where outcome is uncertain, inspect idempotency key and last attempt, fix cause, retry once with the same operation ID and record outcome. A queued report is not a ready PDF. |
| WhatsApp (only after activation) | Failed and expired sending lease counts, provider spend and STOP handling | Suspend send on consent/provider uncertainty; retain failure and provider IDs in restricted logs. Never infer a verified donation from a WhatsApp reference. Disabled messaging must not be reported as delivered. |
| Security | Rate-limited receipt/identity attempts, direct-access denials, role changes, restore requests | Investigate unusual patterns with request IDs and role audit. Rotate exposed credentials, invalidate sessions where possible and preserve evidence in a restricted incident record. |

`backend/ops/health.js` evaluates a minimal redacted snapshot and returns alert codes and owners. `node scripts/ops_health.js <redacted-snapshot.json>` exits 0 for healthy, 1 for attention and 2 for invalid/missing input; it never prints input fields. Its provisional limits are a 15-minute snapshot age and 26-hour backup age. **No collector, scheduler, alert destination, real DB/data backup, report renderer or finance variance adapter is connected.** A human-provided snapshot cannot establish production health by itself. The existing `monthly_whatsapp_delivery_health()` SQL is service-role only, but remains unexecuted; a future collector must be server-only and separately verified against actual grants/RLS.

## Weekly and monthly routine

- Weekly: compare provider billing to approved message categories and budget; verify backup destination access and a sample decrypt/hash; reconcile account activity and reports; review failed queues with named owners and time to resolution.
- Monthly: restore a database dump **and private object bytes** into an isolated staging project; test Auth, report, receipt and object referential integrity, record recovery time and data-loss window. Review dormant accounts, SA grants, consent/retention requests, receipt enumeration attempts, Drive access and actual retention deletion outcomes.
- Every release: preserve prior signed APK and manifest; document migration order, compatible old-client window, SDK/API changes, test evidence, rollout and rollback. Do not enable a minimum-version gate before the new APK download and support path works.

## Incident procedure

1. Record UTC/local incident time, environment, affected function, safe request IDs, first known bad version and assigned incident lead. Avoid donor phone, passwords, raw JWTs, bank proof and receipt code in general logs.
2. Contain the affected capability: disable outbound WhatsApp, stop the affected queue or hold financial verification/approval as appropriate. Preserve immutable source rows and delivery attempts; do not replay an ambiguous external send automatically.
3. Check the most recent **verified** DB/object backup and staging restore evidence. For money issues, independently reconcile opening plus posted effects to observed balances before applying an audited correction.
4. Fix forward or roll back the web/APK routing only after checking schema compatibility; a migration rollback that loses posted events is not acceptable. Verify one authorized and one denied role, queue/retry and report/receipt behavior after change.
5. Record impact, resolution, operator sign-off and follow-up regression scenario. Inform affected members through an approved channel if required by the signed privacy/incident policy.

## Release and request records

Maintain dated files under `docs/operations/` after launch: `YYYY-MM-DD-daily.md`, `YYYY-MM-DD-incident-<id>.md`, `YYYY-MM-DD-release-<version>.md`. Each record should contain environment, named owner, evidence references (not secrets), check result, action and closure time. Privacy/correction requests need a restricted case ID, actor authority, applicable retention rule, audit event and the actual response; do not store the member's sensitive request in the source repository. Owner names, contact routes, paging target, backup Drive and approved retention schedule still require a real operational handoff.

## Verification to date

`npm test` passed 71/71 including five health evaluator tests. A clean `npm ci` still succeeds from the pinned lockfile. The CLI correctly rejects a missing snapshot. No live snapshots, jobs, backup capture, pager, provider account, real finance reconciliation or field operator sign-off have been tested. Phase 15 cannot meet its operational exit before launch.

Supabase documentation checked for service-role and direct Data API boundaries: [Postgres roles](https://supabase.com/docs/guides/database/postgres/roles), [RLS and API exposure](https://supabase.com/docs/guides/database/postgres/row-level-security). Verify platform changelog and grants again before wiring a collector.
