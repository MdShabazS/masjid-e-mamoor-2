# Phase 13 execution — 16 October 2026 (India time)

**Scope:** fresh-build source, web production compilation, Android Metro export, Node unit checks and backup preflight. This begins the integration/security/performance/field phase. It is **not** a release acceptance certificate. No fresh Supabase project, real QR, approved site coordinate, Meta sender, signed APK/device session or complete DB/Storage backup is available in this workspace. Phase 4–12 exits remain open.

## Executed evidence

| Check | Observed result | Limit |
|---|---|---|
| `npm test` at `fresh-build/` | **66/66 pass**: identity, roles, paise, corrections, tasks, meeting location rules, offline drafts, webhook/STOP and queue tick. | Pure/service mocks; no Postgres or provider. |
| `npm run build` at `fresh-build/apps/web/` | **Pass**, including `/finance/accounts`, `/finance/review`, `/tasks`, `/content` and protected API routes. | No live Auth, database, browser or accessibility automation. |
| `npm run export:android` at `fresh-build/apps/android/` | **Pass**, 667 Metro modules and ~2.2 MB Hermes bundle. | Bundle is not a signed/installable APK; no emulator/physical-device check. |
| `python3 -m unittest discover -s backend/backup -v` | **1/1 pass** for encrypted preflight roundtrip, missing bytes and corruption. | No real capture, retention, `pg_restore`, private Storage replay or cutover. |
| Source archive clean restore | **Pass:** archive SHA-256 and all 787 manifest file hashes verified after extracting each file into an empty temporary directory. | Source recovery only; contains no actual Postgres rows or private Storage bytes. |
| Source security review | Server-only keys appear only under server routes/adapter paths. The webhook verifies exact raw HMAC and filters sender ID; login limiter is DB-backed and hashed; unauthenticated/public RPC exposure is separately asserted in unexecuted SQL scenarios. | No running threat-led DAST, RLS/Storage proof, provider callback or formal repository-wide security scan. |
| Correction-chain review | Found the web UI previously offered only original history rows, while SQL allowed replacement correction. Added a Treasurer-only eligible-effect projection and selection including terminal replacements; expanded its SQL scenario. | SQL fixture has not run against Postgres; PDF/receipt publication remains absent. |

## Release-wide acceptance matrix

`LOCAL` means source-level checks exist and pass; `PENDING` means the full acceptance scenario has **not** passed. Every row still needs a dated executable artifact. Evidence paths are relative to `fresh-build/`, unless prefixed `../`.

| ID | Current evidence | Missing Phase 13 proof / fix owner | Result |
|---|---|---|---|
| A-ID1 | Identity handler, hashed limiter, web/Android username/gate; Node identity tests. | Admin, reset, stale/deactivated session and first login on fresh Auth with real users; backend/identity + clients. | PENDING |
| A-ID2 | `identity_roles.sql`, role checks in RPCs. | All eight roles, direct URL/RPC/Storage denial and inactive accounts on web/Android; backend + QA. | PENDING |
| A-ID3 | Role specification. | Member contact edit, authorized performance and IDOR; profile team. | PENDING |
| A-FIN0 | Read-only System Admin grants in finance RPCs. | Direct mutation denials and report/proof reads on real DB; backend + QA. | PENDING |
| A-FIN1 | Account/opening/observation web screen and `finance_foundation.sql`. | Run migration/fixture, concurrency, independent cash count and president verification; finance + operators. | PENDING |
| A-FIN2 | Expense review/payment web flow, SQL actor separation and `phase6_money.sql`. | Private proof, revisions and concurrent payments with independent sessions; finance + operators. | PENDING |
| A-FIN3 | Correction effects, eligible chain projection and `phase4_corrections.sql`. | Execute SQL, compare issued/revised receipt/report, audit and overdraw races; finance + reporting. | PENDING |
| A-FIN4 | Transfer effects and pure reconciliation tests. | Advance, unused return and scoped salary source and cross-account DB reconciliation; finance. | PENDING |
| A-DON1 | One-time pending/verify queue source and expense SQL scenario. | Collection-task cash flow, direct Treasurer entry, rejected revision and receipt; donations. | PENDING |
| A-DON2 | Server consent gate, QR/request/reminder SQL and local rules. | Owner-approved consent and real QR/beneficiary, byte digest, timed dispatch/race with DB; donors + owner. | PENDING |
| A-DON3 | Claim/verification/receipt SQL and webhook STOP foundation. | Duplicate/late transaction investigation, referral/correction, actual provider receipt link; donors + messaging. | PENDING |
| A-DON4 | Sending disabled without Business number. | Masjid number/contact labeling and approved reply templates; owner + messaging. | PENDING |
| A-REC1 | Internal receipt state draft. | Private PDF, exact-code public lookup, rate limits, active/superseded projection, domain continuity; reporting. | PENDING |
| A-REP1 | Immutable report source and local paise tests. | PDF/CSV worker, salary/advance/correction rows, role reads and independent totals; reporting. | PENDING |
| A-TASK1 | Capacity/FIFO SQL, expanded web controls, `phase8_tasks.sql`. | Concurrent last-slot tests, Android, timeout policy; work + QA. | PENDING |
| A-TASK2 | Web completion/review/return/cancel and pure score rule. | Actual DB role/replay, Android, notices and historical score; work + QA. | PENDING |
| A-MEET1 | Invite/RSVP/reminder SQL and basic web controls. | Private memo, edits, real worker/delivery and role/device checks; meetings. | PENDING |
| A-MEET2 | Pure India-date/location rule tests. | Confirmed center, server check-in/finalization, onsite boundary/mock GPS and fallback; attendance + operators. | PENDING |
| A-HAF1 | Prayer history SQL. | Actual-role date/slot/correction tests and client/field recording; attendance. | PENDING |
| A-PERF1 | Verified task count and referral provenance drafts. | Owner-approved combined formula, period profile, correction/absence consistency; performance + owner. | PENDING |
| A-SITE1 | Public text listing, editor revision/schedule source. | Approved assets/copy/privacy, private media and hostile upload, APK/receipt routes, browser accessibility; site + owner. | PENDING |
| A-MSG1 | Signed webhook/STOP/local worker and delivery tests. | Business account/number/templates, provider send/retry/STOP, operator failure queue/cost; messaging + owner. | PENDING |
| A-OFF1 | Encrypted actor-scoped draft queue, retry/conflict tests. | Signed-device kill/upgrade/offline duration/two-device replay; Android + QA. | PENDING |
| A-BAK1 | CMS archive preflight and source backup. | Daily DB+object capture, retention/Drive, authorized staged restore and measured drill; operations. | PENDING |
| A-REL1 | Android bundle only; no release gate accepted. | Signed upgrade, HTTPS APK URL, support labels, direct RPC bypass and minimum-version timing; release + owner. | PENDING |

## Security and performance follow-up

- **Public receipt enumeration:** endpoint is absent, so there is no valid public lookup to probe. Before enabling it, test generic misses, attempt limits, exact-code entropy, void status and no private URL leakage.
- **Storage/QR/restore boundaries:** metadata and archive preflight are not proof of private object authorization. Test direct object paths and signed URLs as anon/other roles, QR byte replacement races, operator restore authorization and corrupt/missing object rejection.
- **Meta:** unit tests cover forged HMAC and STOP before send; exercise real signed callbacks, duplicate statuses and ambiguous provider acceptance after credentials exist. Outbound sending stays disabled.
- **Performance:** Metro bundle size is only an artifact size. Collect real p50/p95 API latency, report generation time, last-slot and finance transaction contention, queue lag and backup/restore duration against staging. No performance target is claimed met.
- **Telemetry:** server routes return generic failures without logging secrets in inspected code, but durable job error/latency, provider failure and audit dashboards/alerts are missing. Add those with redaction before launch.

## Phase decision

**Started; exit not met.** There is no environment-backed acceptance evidence for any release-wide ID. Continue Phase 4–12 source closure and provision an isolated dev/staging database before rerunning this matrix. Do not advance to Phase 14 on these local checks.
