# Requirements / Repository Reconciliation — 15 October 2026

**Purpose:** Identify conflicts between the latest user requirements, the prior 13 October baseline, current specifications, and the working tree before further implementation.  
**Method:** Initial matrix from read-only inspection of relevant specs and working-tree source. The completed source trace and versioned decision register are `REQUIREMENT_TO_CODE_TRACE_2026-10-15.md` and `VERSIONED_RECONCILIATION_AND_MIGRATION_2026-10-15.md`. This is not a complete code review or security audit.

## 1. Baselines and working-tree facts

- Current branch: `feat/mobile-dashboard-visual-rebuild`; last commit shown locally: `516bdd1 feat(mobile): ship Selected UI V2 (#1)`.
- The working tree already contains many modified and untracked files across mobile, web, Supabase migrations/tests, and docs. Do not reset, clean, or overwrite them. No repository changes were made by this read-only reconciliation.
- Existing `docs/REQUIREMENTS_DECISIONS_2026-10-13.md` describes an earlier user-approved six-role release (System Admin, President, Vice President, Secretary, Treasurer, Committee Member), internet-required operation, and task no-waitlist/single-mode. The still older database and architecture specifications retain a seven-role catalogue with internal Finance/Auditor/Member roles and maker/checker controls.
- Existing `docs/DECISION_BASELINE_V1.md`, `docs/FINANCIAL_INTEGRITY_SPEC.md`, and related docs define immutable/append-oriented finance history and maker/checker safety.
- Current modified/untracked paths indicate active implementation work for member activity, referred donations, meeting/geofence attendance, date-range finance reports, public receipt lookup, push delivery, and mobile release control. File presence is evidence of work, not proof of end-to-end production readiness.

## 2. Conflict matrix

| Area | Earlier baseline / existing spec | Latest 15 Oct user decision | Reconciliation required |
|---|---|---|---|
| Roles | 13 Oct six-role decision already includes System Admin and Treasurer; older DB still has President/Super Admin, VP, Secretary, Finance, Auditor, Committee Member, Member | System Admin, President, VP, Secretary, Treasurer, Committee Member, Member, plus laptop account | Preserve newer 13 Oct changes, reconcile internal role keys and older Auditor/Member state with latest Member/laptop scope across DB, RLS, web, APK, tests, onboarding and reports. |
| Finance access | 13 Oct detailed report access all registered users; old DB still uses Finance/Auditor keys; `20261014031000_all_active_roles_monthly_finance_reports.sql` grants all roles | Only P/VP/Secretary/Treasurer download detailed finance reports; all members see salary details | Rebuild server/RLS/Storage capability matrix; don't infer report access from salary display access. Salary fields need explicit privacy review. |
| Monthly donations | Prior brief says no unpaid pledges/obligations, donations after received | Monthly donor roster, expected amount, scheduled asks/reminders, referrer, unpaid state, WhatsApp, points | New recurring-contributor subsystem changes financial model and must be added without booking unpaid pledges as cash. Clarify partial payments and monthly balance rules. |
| WhatsApp | No official WhatsApp automation baseline | Official platform, opt-in confirmation, approved templates, STOP, inbound transaction ID, retries, donor/referrer reminders | Add consent records, message outbox/inbox, delivery logs, template approval/configuration, current pricing and opt-out tests. |
| Receipt lookup | Older requirement accepts sequential receipt ID alone; current `referred_donation_receipt_number_seq` and `MEM2-YYYY-digits` lookup pattern remain in source | Public receipt-number lookup, no OTP; latest receipt PDF downloaded via masjid site, WhatsApp sends number + site link | Existing rate limit helps but does not make sequence-derived numbers unguessable. Migrate to opaque high-entropy numbers and test old receipt compatibility; review privacy before public launch. |
| Finance history | Append-oriented ledger; posted records not edited/deleted; corrections/reversals preserve originals | Treasurer may directly edit/delete verified transaction | Direct conflict. Treat latest user choice as product request but block silent deletion; define audit snapshot/retention and a safe correction UX before migration. |
| Approval controls | Maker/checker; prior requirements allow President/VP self-approval in some paths | President usually approves; Treasurer approves President-submitted expense; President approves Treasurer-submitted expense; Treasurer pays | Preserve actor/approver/payer separately and test conflicts. Reconcile with current expense approval and payment-separation migrations before changing RPCs. |
| Laptop account | Not a standard prior role | Can create expense, manage meetings, edit member profiles, view performance, restore, publish content and update QR; may log in anywhere | Define least-privilege operation catalogue. Shared login and unrestricted device access conflict with attribution and security; log each action and consider per-operator attribution. |
| Offline | Prior brief says internet required | Offline data entry and later sync; finance entries remain pending until online | Update architecture and test stale writes/idempotency. Do not queue approvals as approved offline. |
| Tasks | Open OR assigned; no waitlist; cancellations/details notify participants | Open, assigned, mixed, waitlist; auto FIFO; creator cancellation sends no notification; date/location change retains confirmation | Update domain model and UI. Preserve the user's no-cancellation-notification choice; display cancelled status in-app and request reconsideration before changing outbound behavior. |
| Meetings | Decline RPC requires reason; manual attendance RPC checks creator/day but does not accept organizer location; center unset; memo/reminder absent | Decline reason optional; one-hour WhatsApp + in-app reminder; organizer may mark only while at masjid; memo image after creation; absent message after attendance finalization | Update RPC, UI, location proof, private memo, templates and tests. Resolve exact coordinate and whether organizer corrections need a reason/audit detail. |
| Hafiz attendance | Earlier specs mention Jummah member self-attendance; current tree has Jummah GPS attendance work | Separate five daily prayer attendance, Present/Absent, leadership roles may correct after prayer without reason | New distinct attendance domain; do not merge Hafiz presence with Jummah attendance. Audit corrections even if no user reason is required. |
| Performance | Prior baseline rejects a single leaderboard/ranking; shows counts/trends | Three sub-scores and combined score; all members see everybody | Implement transparent metric breakdown and guard against unfair ranking. Define formula/period/denominator before presenting a score. |
| Announcements | Earlier static read-only posts, attachments, 30-day archive | Public site content, event images, schedule/expiry, editor change notification | Add public/private content classification and publishing permissions. Existing 30-day auto-archive needs an explicit decision against expiry-date behavior. |
| APK update delivery | Earlier direct sharing by Admin | Public website APK download, in-app update link/contact, block old versions | Update release config and website delivery. Preserve signed APK provenance and rollback path; version gate must not break web users. |
| Backups | Provider-plan-dependent backups; restore testing required | Daily, 30-day retention, monthly 1-year snapshots, laptop-only restore without confirmation; now 4 TB Google Drive allocation | Supabase free tier does not meet user’s backup expectation alone. Design encrypted Drive secondary archive plus independent backup and restore drill. Confirm Drive folder/account/OAuth ownership. |
| Payment gateway | Existing scope says app records payments, does not process them | QR + Treasurer verification now; gateway deferred | Keep gateway out of current release; retain integration seam only. |

## 3. Existing work areas to preserve and verify

Current file/status evidence points to work in these feature areas:

- Mobile/web release gate and System Admin release configuration.
- Finance monthly and custom date-range reports, PDF/CSV output.
- Referred-donor contributions, public receipt lookup, receipt void/reversal.
- Meeting responses, GPS attendance, Jummah attendance, and member activity summaries.
- Push notification delivery/retry and expense approval notifications.
- Expense bill evidence, approvals/payment separation, and account selector privacy.

Before extending these areas, inspect actual migrations/RPCs/tests and run the package-specific checks. Do not infer deployment status from a source file or passing UI test. The current worktree includes uncommitted changes and at least one local-only sync workflow; no merge, push, deployment, or hosted DB changes are authorized by this reconciliation task.

## 4. Completed Task 4 hand-off and remaining gates

The versioned precedence and D-01–D-18 decision register, access matrix, migration order, and source-level requirement mapping are in `VERSIONED_RECONCILIATION_AND_MIGRATION_2026-10-15.md` and `REQUIREMENT_TO_CODE_TRACE_2026-10-15.md`. Mapping is complete; user/product decisions explicitly marked Open remain Task 5. No application code or hosted data was changed by this reconciliation.

Required gates before implementation changes:

1. Review and resolve the high-risk rows: finance mutation/audit, account approval segregation, receipt access, laptop account security, cancellation messages, member salary visibility, and Drive recovery.
2. Specify monthly contributor due/payment allocation, partial payment, and effective-date behavior.
3. Confirm whether dated prior specs remain archival only or must be superseded with a formal versioned update.
4. Map each new requirement to database/API/web/mobile/test artifacts.
5. Run local tests only after identifying the current package scripts and affected paths; do not change or deploy production resources.

