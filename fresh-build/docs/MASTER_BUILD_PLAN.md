# Masjid E Mamoor 2 — master build and release plan

**Baseline:** 15 October 2026. **Execution home:** `fresh-build/` in this worktree. **Platforms:** Android APK and responsive public/management web. **Backend:** new development and production environments, not the legacy migration chain. **Business clock:** Asia/Kolkata; money stored in integer paise.

This is the execution tracker from fresh source to usable product. `../tasks.md` is the short checkpoint; the repository's older `tasks.md` and legacy source are research/reference, not proof of fresh-build completion. Follow the later explicit user decisions recorded in `../../docs/TASK_5_DECISION_REGISTER_2026-10-15.md` when older documents conflict. Map each release scenario to `../../docs/PRODUCT_ACCEPTANCE_CRITERIA_2026-10-15.md`.

## Status vocabulary and working rules

- **Done:** source and the stated local check are complete. This never implies live integration or release acceptance.
- **Draft:** source exists but the required runtime/database check has not run.
- **Pending:** no complete fresh implementation or evidence yet.
- **Blocked input:** cannot perform the specified real-world verification until an account, asset, credential, coordinate, device, or approval is available. Continue independent work.
- For every phase: research current primary documentation, record decisions and source links, implement one reviewable slice, add tests for its failure modes, run the appropriate integration/device check, update this plan and acceptance trace, then make and checksum a project-source backup. Record commands, environment, date, and observed result. Keep secrets out of source archives.
- A screen cannot authorize a transaction. Trusted server/database commands enforce active role, state transition, actor separation, idempotency, and audit. Financial posting is atomic and amounts remain integer paise.
- Preserve separate development, staging/preview, and production data and credentials. Production writes, messaging, and deployment require their own reviewed gates.

## Snapshot of completed work

| Area | Status and evidence | Still missing |
|---|---|---|
| Workspace and reference | **Done:** new `fresh-build/`; earlier requirements/source retained in same worktree; source backup with SHA-256 verification. | Restore drill and ongoing automated backup checks. |
| Shared domain | **Done locally:** contribution, expense, access, reporting, task, meeting, offline and WhatsApp modules; latest Node suite has 75 tests passing. Exact INR-to-paise API helper. | Full cross-module contract, database integration and concurrency tests. |
| Monthly contribution database | **Development DB proof:** all 17 fresh migrations, nine workflow SQL scenarios, a security-catalog fixture and an eight-role read fixture passed on the isolated project. One issued Auth token passed 48 direct API checks as its database role changed through all eight roles. | Hosted distinct role sessions, broader REST/RPC/Storage tests, reconciliation, correction, messaging and approved real account data. |
| Web | **Done as build:** initial public posts, username/password-change, contributor, claim, finance submission, task, meeting and inbox routes; Next production build passes. | Real Auth/DB proof, consent approval, complete finance/work/content workflows and responsive accessibility/device QA. |
| Android | **Development APK proof:** Gradle debug and bundled release variants built with JDK 21; the latter installed and rendered on Pixel 8 emulator without Metro. It uses the debug key and `.fresh` package. | Production-signed APK, physical device tests, live Auth/backend integration, notification/release flows. |
| Dependency/install | **Clean local proof (16 October):** `npm ci`, 75 tests, lint, format, typecheck, Next production build and Android export passed. Legacy dependency symlinks removed and replaced with a fresh locked install. CI workflow has the same source quality gates. | Run hosted CI and signed APK/device verification. |

**Current verified backup:** use the latest `../../backups/masjid-project-working-source-*.tar.gz` and its adjacent `.sha256`; record its exact filename in each checkpoint. Refresh after each subsequent source change. Backup script covers nonignored source, not a live database or private object bytes.

**Latest Phase 4 evidence:** [`PHASE_4_EXECUTION_2026-10-17.md`](PHASE_4_EXECUTION_2026-10-17.md). The broader Phase 4–12 source snapshot remains [`PHASE_4_TO_12_RECHECK_2026-10-15.md`](PHASE_4_TO_12_RECHECK_2026-10-15.md). All nine phase exits remain open.

**Phase 0–4 audit:** [`PHASE_0_4_AUDIT_2026-10-17.md`](PHASE_0_4_AUDIT_2026-10-17.md) separates local checks from remaining exit criteria.

## Phase 0 — source control and reproducible foundation

**Status:** partial. **Goal:** one coherent, reproducible fresh project.

- [x] Establish `fresh-build/` and preserve legacy source as reference.
- [x] Keep requirements, decision register, risk/acceptance documents and a verified source archive in the worktree.
- [x] Inventory fresh dependencies and generated artifacts; ignore `node_modules`, build output and `.env`; exclude common credential/signing filenames from source archives. Continue reviewing any newly added credential names.
- [x] Choose npm workspaces; generate lockfile from an isolated clean copy, complete `npm ci` and app builds there, remove legacy dependency symlinks and install dependencies locally from the lockfile.
- [x] Configure pinned formatting, lint and JavaScript type checks for fresh production source and wire them into local scripts and CI. CI execution from a committed checkout remains pending.
- [x] Execute all 17 fresh migrations on isolated hosted development and local PostgreSQL; run the 11 rollback-only fixtures. Live integration type coverage remains open.
- [x] Document local setup, fixtures, environment classes and the staging/production rollback boundary in `PHASE_0_LOCAL_OPERATIONS_2026-10-17.md`.
- [ ] Assign named environment/secret owners, provision staging/production and rehearse real database/object restore before any release migration.
- [x] Add source archive manifest/checksum/clean-restore check to CI; private credential filenames are excluded and archive is local to the CI runner.

**Exit still open:** a clean isolated checkout installed and built without legacy dependencies, and source restore works locally. Lint, formatting and production JavaScript type gates pass locally. Hosted CI, environment ownership and rollback remain incomplete.

## Phase 1 — product rules and research closure

**Status:** **five product rules accepted 17 October 2026; privacy/publication approval pending.** Engineering draft, recommendations and source research exist, but masjid policy/privacy approval has not been recorded. Phase 2 can proceed on independent contracts; do not publish real donor/payroll data or freeze dependent policy. See [`PHASE_1_PRODUCT_RULES.md`](PHASE_1_PRODUCT_RULES.md), [`PHASE_1_OWNER_DECISION_PACKET.md`](PHASE_1_OWNER_DECISION_PACKET.md), [`PHASE_1_ACCEPTANCE_TRACE.md`](PHASE_1_ACCEPTANCE_TRACE.md), [`PHASE_1_RESEARCH_LOG.md`](PHASE_1_RESEARCH_LOG.md), and [`PHASE_1_AUDIT.md`](PHASE_1_AUDIT.md).

- [x] Consolidate the 100-question baseline, later choices and acceptance scenarios as reference.
- [x] Settle positive partial monthly contribution, immediate suggested amount change, QR beneficiary selection, System Admin finance read access and named data-entry employee.
- [x] Build a single role/action/resource matrix for all eight roles, including public, inactive and unprovisioned actors. Specify System Admin support reads versus financial writes; laptop restore authority; salary visibility; member self-edit.
- [x] Specify transaction states and immutable history behind Treasurer's requested Edit/Remove UI: correction, supersession, reversal, receipt validity and report revisions.
- [x] Draft deterministic defaults for multiple payments in one donor month, excess amount, duplicate reference, rejected claim, cross-month allocation and late verification. Keep any positive verified contribution from producing a balance reminder.
- [x] Draft task FIFO waitlist/caps, attendance finalization window, prayer recording time, combined score formula, offline command list, release minimum-version policy and operational financial audit preservation.
- [x] Research primary Supabase, Expo, Meta, hosting, India privacy and backup documentation; record links, facts and engineering inferences in a research log.
- [x] Map all 25 acceptance IDs individually to actor, conceptual transition and observable scenario.
- [x] Prepare a concrete donor consent/privacy/public receipt disclosure and salary visibility review packet.
- [x] Prepare specific conservative recommendations for referral cap, “Activity points”, laptop expense sequence and narrower existing-donor edits in the owner decision packet.
- [x] Owner accepted all five rules on 17 October 2026; Phase 1 role matrix and acceptance trace reconciled. Implementation grants remain to verify.
- [ ] Obtain masjid owner/privacy review of donor consent/notice, salary display, public receipt projection, privacy contact and personal-data/proof/message/audit retention schedule before exposing real data.
- [ ] At integration/release, verify exact Meta template classifications and India rates in the masjid Business account, and selected hosting plan quotas/costs. Current research establishes pricing/limits models, not these account-specific values; the masjid number can be supplied later.

**Exit (not yet met in full):** all 25 acceptance IDs are individually traced; the remaining owner policy/sign-off items must be recorded as decisions before affected real-data features are enabled. Real QR, coordinate, Business/Drive accounts and hosting URL remain later phase inputs. Phase 2 may freeze independent wire contracts and database shape.

## Phase 2 — architecture, contracts and threat model

**Status:** started 15 October 2026; architecture, conceptual API, threat/migration and 25-ID implementation mapping drafted. First donor/claim OpenAPI slice is in `../backend/api/openapi.v1.json`; full typed contracts, live API validation, physical schema and review remain. See `PHASE_2_4_COMPLETION_AUDIT.md`. See `PHASE_2_SYSTEM_ARCHITECTURE.md`, `PHASE_2_DATA_API_CONTRACT.md`, `PHASE_2_THREAT_MIGRATION_PLAN.md` and `PHASE_2_ACCEPTANCE_IMPLEMENTATION_MAP.md`.

- [x] Draw module boundaries: Auth, member directory, finance ledger, donors, expenses, work, meetings, attendance, content, messaging, reports, backup, release.
- [x] Draft aggregate ownership, relational constraints, event/audit schema, revision rules, file visibility, request/response/error codes, idempotency keys and server business-date conventions.
- [x] Design privileged operation boundaries and migration strategy on a **new** Supabase project; legacy migration SQL is not auto-applied.
- [x] Model threats: role spoofing, IDOR, direct RPC/table access, stale session, concurrent payment/approval, QR substitution, webhook forgery/replay, receipt enumeration, unsafe upload, GPS spoofing, compromised laptop restore.
- [x] Set source-of-truth reconciliation equations and report inclusion/cutoff policy. Every posted effect must have exactly one linked ledger event and auditable actor.
- [x] Draft public/private Storage classes, upload validation, scoped access, retention gate and orphan cleanup.
- [x] Map each acceptance scenario to conceptual endpoint/data owner, negative test and UI journey in a maintained trace.
- [x] Draft machine-readable first donor/claim request/response slice; JSON parses and all local `$ref` pointers resolve.
- [ ] Create machine-readable typed schemas for requests/responses/events and validate first vertical slice against real Supabase Auth/Data API behavior.
- [ ] Freeze physical relational schema, exact indices/constraints and error mapping after Phase 1 owner grants; review design and sign off unresolved risks.

**Exit (pending):** reviewed physical schema/API and permission contract; risky changes have executable tests and rollback behavior. Current artifacts are design drafts, not implementation or database evidence.

## Phase 3 — backend platform, identity and permissions

**Status:** partial implementation; the 17 fresh migrations, 11 rollback-only fixtures, hosted single-token role changes, and 48 direct API checks with eight distinct issued local Auth sessions pass. An expired local token is denied and current database role/deactivation is enforced on an existing token. The local server identity lifecycle passes first password, reset, revoked session, deactivation, audit and rate limit checks. Hosted distinct sessions, client journeys and broader direct API checks remain. See `PHASE_3_DATABASE_EXECUTION_2026-10-16.md`. **Goal:** secure executable foundation.

- [x] Provision isolated free-plan development Supabase project in Mumbai; apply all 17 fresh migrations in order. No secrets were written to source.
- [ ] Establish staging before production; repeat a clean reset and psql fixture run with `ON_ERROR_STOP=1`.
- [ ] Run current draft SQL and repair defects; test `anon`, authenticated roles, inactive user and service calls as actual database roles, not only UI visibility.
- [ ] Build System Admin user provisioning, temporary password/forced change, password reset, role change, deactivation, separate actor IDs and audit. Provision the named data-entry employee without shared credentials.
- [ ] Enforce RLS and narrow RPC grants for every table/function/view/Storage object; protect privileged server routes and admin secrets.
- [ ] Create typed shared client contracts, validation, predictable errors, cursor/pagination, authorization tests and migrations/seed fixtures.
- [ ] Test races, retries and stale clients with independent sessions; verify direct REST/RPC denial and no cross-user data leak.

**Exit:** clean database setup and rollback rehearsal pass; role matrix and direct-access tests pass against real Postgres; first-login and deactivation journeys pass on both clients.

## Phase 4 — accounts and financial ledger

**Status:** backend ledger, reconciliation and correction SQL passed its rollback-only fixtures on isolated development PostgreSQL. A clean local reset, independent-session transfer, correction and expense-payment races, independent account and mixed-source month sums, a revised report-source snapshot and a two-user issued Auth API journey passed on 17 October. Beneficiary versioning and pre-use correction passed a hosted rollback-only fixture on 18 October; web/Android source exports, but signed-in client/device journeys, advances/salary sources and restore remain. See `PHASE_4_EXECUTION_2026-10-17.md` and `PHASE_4_BENEFICIARY_2026-10-18.md`. **Goal:** trustworthy balances.

- [ ] Create Cash/UPI/Bank account administration, active state, beneficiary validation and account-scoped history.
- [ ] Treasurer enters opening balances; President verifies. Record immutable evidence and correction path.
- [ ] Implement canonical ledger effects, same-transaction posting, source IDs, operation IDs, unique constraints, account locks, balance query and independent reconciliation.
- [ ] Add cash-to-bank transfer with equal/opposite effects and proof; never count it as income/expense.
- [ ] Build variance explanation and Treasurer correction/void workflow with before/after audit, receipt/report revision rules and no physical erasure of financial history.
- [ ] Test zero/negative/overflow amount, concurrent commands, retries, reversals, wrong account, totals by period and accounting equation in paise.

**Exit:** each financial fixture reconciles; pending items do not change balances; audit reconstructs every posted and corrected effect.

## Phase 5 — monthly donors, QR and contributions

**Status:** expanded source slices, still unexecuted; see `PHASE_5_CHECKPOINT.md`. **Goal:** complete verified contribution lifecycle.

- [x] Pure domain rules and API helper; consent enrollment, roster, claim and Treasurer verification UI on web/Android.
- [x] Draft atomic claim→ledger→opaque receipt command; suggested/request snapshot; scoped pending-claim/account reads.
- [ ] Add donor profile, referrer, consent text/version/evidence, opt-out, dedupe, suggestion version/change history and authorized contact views.
- [ ] Add President/data-entry QR replacement with image digest and selected active beneficiary account; retain send-time digest/account snapshot without exposing old QR gallery.
- [ ] Build first-Friday 10:00 India-time request queue and five-day reminder eligibility; verify opted-out, already-contributed, retry and QR-change races.
- [ ] Accept transaction IDs from authorized UI and later authenticated Meta webhook; prevent duplicate reference and claims for nonexistent requests. Treasurer checks actual bank/UPI/cash amount and account, can reject with reason, and posts exactly once.
- [ ] Add receipt code issuance, referral point at most once per donor/month with valid verified contribution, three-consecutive-unpaid-period referrer notice and correction recomputation.
- [ ] Run actual database role, concurrency and replay tests; both clients against provisioned development users. Test smaller actual amount, repeat payments, late verification and duplicate webhook.

**Exit:** the donor's real verified amount, account, receipt, referral and reminder state agree under normal, failed and replayed operations.

## Phase 6 — other donations, cash collections and expenses

**Status:** core one-time donation and expense SQL source added 15 October 2026; database execution, clients and remaining workflows pending. See `PHASE_6_CHECKPOINT.md`.

- [ ] One-time donation form and trusted posting: required name, date, method, actual amount, member/referrer distinction and receipt.
- [ ] Collection-task counters submit total cash pending; Treasurer verifies/rejects; direct Treasurer cash entry posts once. Link task and ledger without double count.
- [ ] Expense submission with title, description, category, amount, bill or explicit explanation, requester and proof metadata.
- [ ] Route ordinary/VP/Treasurer/President requests to the correct different approver; data-entry expense verification and President approval follow reviewed contract; reject with reason; amount revision returns for reapproval.
- [ ] Treasurer records partial/full payments, destination account, method/date/proof; block overpayment, preapproval payment and self approval with locks/idempotency.
- [ ] Advance approval, disbursement, bills, unused return and outstanding balance; Hafiz/Muezzin salary records, payment and intentionally scoped member display.
- [ ] Test missing/unsafe bills, private-file access, races, requester changes, partial payment, rejection, corrections and notification outbox.

**Exit:** posting only on verified money movement; approver separation and ledger totals pass all role and concurrent-flow tests.

## Phase 7 — receipts, reporting and finance experience

**Status:** private report-source SQL passed a mixed-source month, later correction/revision and opening carry-forward fixture on local PostgreSQL; the independent paise reconciliation module remains in source. Rendering, published revisions and public receipt flow remain pending. See `PHASE_7_CHECKPOINT.md`.

- [ ] Formal shared PDF template for monthly/one-time donations, with exact verified INR, donor, period/date, method, code and verification context.
- [ ] Public exact-code lookup with rate limits, generic unknown response, minimal data projection, private PDF generation/download and void/superseded status.
- [ ] Monthly, Jan–Dec annual and custom-range itemized PDF reports from one canonical ledger query; separate transfers, advances, salaries, corrections, opening/closing by account and cutoff/revision.
- [ ] Treasurer chooses optional proof references; leadership downloads only, System Admin scoped support view but no report generation action per final role rule.
- [ ] Build web/mobile finance hub, account histories, expense queues, report status (queued/ready/failed), download and accessible empty/error states.
- [ ] Golden fixture and independent sum tests; compare PDF/CSV if any to database totals; deny committee/member/anon direct URLs; test revised report after correction.

**Exit:** every published rupee traces to a posted source; a public visitor can retrieve only the intended valid receipt.

## Phase 8 — tasks and member performance

**Status:** task backend source and a first web task screen added; full clients, notifications, integration and database execution pending. See `PHASE_8_CHECKPOINT.md` and the remediation checkpoint.

- [ ] P/VP/Secretary create tasks with optional date, location, direct/open/mixed mode, overall and per-source caps.
- [ ] Invitations, accept/decline, open volunteering, atomic capacity, FIFO waitlist and automatic promotion after vacancy.
- [ ] Participation, cancellation/status visibility, assignee completion with optional note, creator accept/return reason and verified points only.
- [ ] Profile/task dashboards show history, period filters, assigned/accepted/completed/verified counts and explainable combined measure.
- [ ] Concurrency tests for last slot, duplicate join/promotion, creator unavailable, cancelled task, returned completion and score reversal.

**Exit:** no overfill or self-awarded score; Android and web show the same authoritative status.

## Phase 9 — meetings, location and attendance

**Status:** meeting invitations/reminder queue, prayer history, a first web meeting screen and local location rules drafted; physical attendance remains disabled until a confirmed site and field trial. See `PHASE_9_CHECKPOINT.md` and the remediation checkpoint.

- [ ] P/VP/Secretary/data-entry create meetings, invite, RSVP/optional decline reason, private memo image, edit/cancel with audit.
- [ ] One-hour reminder excludes declined/cancelled invitees; in-app notification and authorized WhatsApp delivery are deduped.
- [ ] Configure confirmed masjid center and 100 m rule; scheduled India-local day check-in, fresh foreground location, accuracy/time constraints and documented fallback.
- [ ] Onsite organizer manual mark captures organizer location proof. Finalize full-day roster; data-entry fallback only after window closes and never creates presence.
- [ ] Record absence once and distinguish attended/declined/absent in profiles. Hafiz five prayer slots have Present/Absent, permitted actors, after-prayer attestation and correction history.
- [ ] Test at physical site, boundary/low accuracy/mock location, wrong day, denied permission, offline/stale location, duplicate finalization and absence message.

**Exit:** physical attendance trial passes with confirmed coordinates, audit and fallback; no remote marking or premature absence.

## Phase 10 — public site, member UI and notifications

**Status:** public announcement projection, web listing and private member inbox source added 15 October 2026; owner-approved site details, client coverage and live database testing pending. See `PHASE_10_CHECKPOINT.md`.

- [ ] Approve masjid name/address/logo/photos/contact copy; build responsive public pages, announcements/events, privacy/technical support, receipt lookup and APK download.
- [ ] Authorized publishers create/edit/schedule/expire public and optional member-only content, images and edit notifications; enforce publication time in query.
- [ ] Member profile/self-contact edit, directory and permitted performance; role-aware Android/web navigation and accessibility labels/keyboard/focus/contrast.
- [ ] In-app notification center, push registration and durable delivery status; resilient refetch after reconnect. Avoid treating push as source of truth.
- [ ] Test anonymous/private boundaries, unsafe media, future/expired content, deep links, mobile widths, screen readers and notification permission denial.

**Exit:** anonymous site exposes only approved content; each role sees and can invoke only its granted actions.

## Phase 11 — official WhatsApp integration

**Status:** local delivery and webhook foundation built; the owner deferred live automation to a future release on 24 October 2026. It is not a first-release gate while outbound remains disabled. Future activation needs the masjid Business number, approved templates and staging/provider acceptance. See [Phase 11 checkpoint](PHASE_11_CHECKPOINT.md).

- [ ] Research and record current Meta policy, opt-in and template category/rates for the exact donation message before submitting templates; estimate cost and budget.
- [ ] Configure masjid-owned Business account, number, server-only credentials, approved request/reminder/receipt/meeting templates and current site URL.
- [ ] Verify webhook subscription/signature, persist unique inbound event/message IDs, normalize transaction references, process `STOP` before retry sends and track delivery status.
- [ ] Implement transactional outbox, bounded retry/backoff, failure queue, monitoring and operator resend; check consent/opt-out/payment again immediately before sending.
- [ ] Send receipt number/link only after Treasurer verification; route payment questions to the masjid Business number, technical issues to technical support; bot cannot assert bank settlement from `PAID` or reference text.
- [ ] Test provider sandbox/real opted-in numbers, wrong number, duplicate/forged webhook, outage, STOP race, old QR request snapshot and cost visibility.

**Exit:** approved messages send from the correct number, opt-out suppresses future sends, retries never duplicate posting, operator sees failures.

## Phase 12 — offline support and operational backup/restore

**Status:** Android secure draft submission foundation implemented locally; source archive verified; live database/object backup and restore pending. See [Phase 12 checkpoint](PHASE_12_CHECKPOINT.md).

- [ ] Android stores only reviewed draft commands (initially donation, expense and task entry) with local operation IDs, encryption/scoping and pending/conflict/rejected indicators.
- [ ] Sync idempotently after reconnect; preserve drafts on app kill/update; no offline approval, verification, receipt issuance, restore or stale GPS check-in.
- [ ] Back up actual Postgres data **and** object bytes daily with encrypted manifest/hash; retain 30 daily and 12 monthly snapshots, alert on failure and upload secondary archive to approved Drive folder when configured.
- [ ] Implement named laptop operator restore request with current authorization, server-only credentials, preflight, staging, integrity check, audited cutover and emergency recovery path; no second UI confirmation per chosen workflow.
- [ ] Drill corrupt/missing file, wrong Drive account, database/object mismatch, full clean restore and source-worktree restore; measure recovery time and data loss.

**Exit:** disconnected drafts reconcile once; independent clean restore recreates private files and authorized database state, not merely archive metadata.

## Phase 13 — integration, security, performance and field QA

**Status:** source-level Phase 13 execution started 16 October 2026: 66 Node checks, web production build, Android Metro export, backup preflight and scoped threat review pass. Real DB, device, provider, performance and field acceptance are pending. See [`PHASE_13_EXECUTION_2026-10-16.md`](PHASE_13_EXECUTION_2026-10-16.md).

- [ ] Maintain acceptance matrix from `A-ID1` through `A-REL1` for web, Android, database and actual provider; each scenario has a pass/fail artifact and fix owner.
- [ ] Test all roles, inactive sessions, direct URLs/RPCs/Storage, real financial concurrency and backup/restore, plus cross-module reporting and score corrections.
- [ ] Instrument errors, job failures and audit events without logging donor phone, password, token, payment proof or receipt secret unnecessarily.
- [ ] Device matrix: clean install, upgrade from previous signed build, Android permission denial, poor network/offline, app kill, small/large screens, keyboard and accessibility.
- [ ] Field pilot with named masjid operators using test records; compare Treasurer bank/cash records and generated report; fix usability and reconciliation findings.
- [ ] Threat-led review of public receipt enumeration, object URL access, Meta webhook, laptop restore, QR swapping and minimum-version bypass. Test rate limits and retention/deletion operations.

**Exit:** all release-wide acceptance gates pass with dated evidence; unresolved findings are explicitly risk-accepted by the accountable owner or fixed.

## Phase 14 — signed APK, website deployment and launch

**Status:** release preparation started 16 October 2026; APK build profiles, versionCode, signer/upgrade manifest guard and runbook are drafted and locally checked. A debug-key APK installed and rendered on the Pixel 8 emulator; no production-signed APK or deployment. See [`PHASE_14_CHECKPOINT.md`](PHASE_14_CHECKPOINT.md) and [`PHASE_14_NATIVE_BUILD_2026-10-16.md`](PHASE_14_NATIVE_BUILD_2026-10-16.md). **Goal:** a usable, recoverable release without Metro.

- [ ] Establish stable Android package ID/versionCode/signing ownership and securely back up keystore; create release APK, install on emulator and real device, then test upgrade over prior signed version without data loss.
- [ ] Stage web and backend with release candidate data; verify HTTPS URL, production environment variables, private credentials, contact labels, receipt URLs, current APK link and old link continuity.
- [ ] Confirm first-release external inputs: real QR and beneficiary, masjid location, roster and initial accounts, approved public assets, Drive folder/admin access, privacy notice and production budget. WhatsApp account/templates are deferred while automated outbound is disabled.
- [ ] Exercise server minimum-version gate only after working APK is uploaded; old APK must reach public download/support path, while protected commands are rejected.
- [ ] Prepare deployment order, migration and rollback playbook, smoke checks, finance opening balance sign-off, restore checkpoint, monitoring/alert ownership and initial operator training.
- [ ] Launch public website and distribute signed APK from it; verify download/install/login/role routes, live receipt lookup, scheduled jobs and backup alert. Record release manifest and hashes in worktree.

**Exit:** operators can use the system without a development server; signed upgrade, verified payments/reports, messaging, private access and recovery pass production smoke tests.

## Phase 15 — operation and subsequent releases

**Status:** operator runbook and redacted health evaluator prepared 16 October 2026; live operations remain pending after launch. See [`PHASE_15_CHECKPOINT.md`](PHASE_15_CHECKPOINT.md).

- [ ] Daily review failed jobs, backups, delivery queue, security alerts and reconciliation variance; weekly verify spending, provider usage and restore health.
- [ ] Maintain change log, schema migrations, backward-compatible client/API window, signed APK release cadence and incident response contacts.
- [ ] Handle corrections/privacy requests through audited procedures; periodically review roles, dormant users, receipt lookup attempts and Drive access.
- [ ] Track user feedback and enhancement backlog. Payment gateway, custom domain and expanded offline actions are later features unless separately accepted into launch scope.

## External inputs and dependencies

| Input | Needed for | Current state |
|---|---|---|
| Fresh development Supabase project and provisioned test accounts | Phase 3 real DB tests, both-client integration | Isolated Mumbai free-plan development project created; no issued test Auth accounts yet. |
| Actual QR image and matching bank/UPI account | Phase 5 production requests, finance reconciliation | User will supply later. |
| Precise approved masjid coordinate | Phase 9 100 m field trial | User will supply later. |
| Masjid Business number/account, approved templates and billing | Phase 11 live messaging | Not configured. |
| Masjid public copy/logo/photos, roster and privacy notice | Phases 3, 10 and launch | To collect/approve. |
| Google Drive account/folder/scoped access | Phase 12 secondary backup | 4 TB allocated; connection not configured. |
| Hosting-provided HTTPS address and signing key custody | Phase 14 release | To establish; custom domain later. |

## Research anchors checked for this plan

Current primary documentation to recheck during each implementation slice:

- Supabase database function privileges and security-definer behavior: https://supabase.com/docs/guides/database/functions
- Supabase database/RLS test approaches: https://supabase.com/docs/guides/local-development/testing/overview
- Supabase backup scope and storage-object restore: https://supabase.com/docs/guides/platform/backups and https://supabase.com/docs/guides/platform/migrating-within-supabase/dashboard-restore
- Expo installable APK and signing/release build: https://docs.expo.dev/build-reference/apk/ and https://docs.expo.dev/build-reference/android-builds/
- Meta opt-in, templates, webhooks, policy and pricing: https://developers.facebook.com/documentation/business-messaging/whatsapp/getting-opt-in ; https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/overview ; https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/overview ; https://whatsappbusiness.com/policy/ ; https://whatsappbusiness.com/products/platform-pricing/
- Hosting environment isolation if Vercel is selected: https://vercel.com/docs/deployments/environments

Research anchors inform the engineering plan, not a claim of account setup, provider approval, legal approval or tested deployment. Reverify pricing, policy, platform limits and documentation near the actual integration and launch dates.
