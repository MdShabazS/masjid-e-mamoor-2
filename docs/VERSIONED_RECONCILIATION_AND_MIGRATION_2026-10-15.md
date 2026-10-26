# Versioned Reconciliation and Migration Hand-off

**Date:** 15 October 2026  
**Task:** 4 — repository and legacy-spec reconciliation  
**Status:** Mapping and safe sequencing complete. Explicit product decisions remain Task 5. No application code, applied migration, hosted database, or original user repository was changed in this pass.

## 1. Authority and document versions

| Layer | Status from this point | How to use it |
|---|---|---|
| User's latest answers through 15 October; `docs/REQUIREMENTS_BASELINE_2026-10-15.md` | Latest captured product direction | Higher priority than conflicting 13 October answers; its §10 is explicitly undecided. A later user decision supersedes it. |
| `docs/REQUIREMENTS_DECISIONS_2026-10-13.md` | Historical decision record for prior scope | Reuse non-conflicting details only. Its six-role, sequential receipt, broad report, online-only, no-waitlist and self-approval choices are superseded by later answers where they conflict. |
| `docs/DECISION_BASELINE_V1.md`, `docs/FINANCIAL_INTEGRITY_SPEC.md`, permission/architecture/operational docs | Existing engineering and safety constraints; some product assumptions obsolete | Keep useful invariants (idempotency, audit, transfer balance, reconciliation) while explicitly resolving direct edit/delete and role conflicts. Do not represent old permissions as new policy. |
| `supabase/migrations/`, `apps/web/`, `apps/mobile/`, `packages/` in dirty worktree | Actual local implementation candidates | Source controls current behavior if applied; cannot be overridden by writing a newer `.md`. Avoid editing old migrations; new additive migrations and simultaneous client changes must carry the approved policy. |
| This reconciliation, trace matrix and Task 3 architecture | Versioned design hand-off | Identifies changes and their order. Neither is an approved production schema or a substitute for Task 5 acceptance decisions and live tests. |

The 13 October record **already** names System Admin/Treasurer in a six-role policy. The older seeded database started with President, VP, Secretary, Finance, Auditor, Committee Member and Member; a later migration added System Admin. Do not call the 13 October policy the old seven-role database model.

## 2. Target access matrix for known decisions

`Yes` means the latest captured user direction grants the capability; `Limited` means the specific restricted action shown; `Open` must be decided in Task 5. All grants require server-side enforcement and audit where appropriate. This is not a database grant script.

| Capability | Sys Admin | President | VP | Secretary | Treasurer | Committee | Member | Laptop |
|---|---|---|---|---|---|---|---|---|
| Provision roles, reset credentials, release policy | Yes | No | No | No | No | No | No | No |
| Submit donations/expenses; refer monthly donor | Open* | Yes | Yes | Yes | Yes | Yes | Yes | Limited: expense, donor permission Open |
| View monthly donor roster/referrer and member performance | Open* | Yes | Yes | Yes | Yes | Yes | Yes | Yes for profiles; roster Open |
| Verify donations and task cash count | Open* | No | No | No | Yes | No | No | No |
| Approve ordinary expense | Open* | Yes | No | No | No | No | No | No |
| Approve President-submitted expense | Open* | No | No | No | Yes | No | No | No |
| Approve Treasurer-submitted expense | Open* | Yes | No | No | No | No | No | No |
| Pay approved expense / reconcile accounts | Open* | No | No | No | Yes | No | No | No |
| Download detailed monthly/annual/date-range finance | Open* | Yes | Yes | Yes | Yes | No | No | No |
| View salary detail | Open* | Yes | Yes | Yes | Yes | Yes | Yes | Open |
| Create/manage task | Open* | Yes | Yes | Yes | No | No | No | No (unconfirmed) |
| Participate in task/meeting; view member performance | Open* | Yes | Yes | Yes | Yes | Yes | Yes | Yes for profiles |
| Create/manage meeting | Open* | Yes | Yes | Yes | No | No | No | Yes |
| Mark/correct Hafiz prayer attendance | Open* | Yes | Yes | Yes | Yes | No | No | No |
| Publish/edit public announcement/media | Open* | Yes | Yes | Yes | No | No | No | Yes |
| Change active payment QR | Open* | Yes | No | No | No | No | No | Yes |
| Enter weekly expenses/edit member profile/restore | Open* | Open for profile; restore No | No | No | Limited: expense payment and finance | No | Own profile only | Yes; restore only laptop |

\*The user described System Admin as controlling the whole platform, but the precise finance exception and emergency/break-glass authority are not settled. Preserve account/release powers now; do not grant unrestricted direct finance mutation via this table. Ordinary member profile self-edit and laptop donor-add are likewise scoped for Task 5. A masjid laptop login must have an attributable account/session; multiple people using one password would obscure the actor even if each operation is logged.

## 3. Decision register

| ID | Conflict and latest captured direction | Task 4 disposition | Task 5 question / implementation guard |
|---|---|---|---|
| D-01 | 13 Oct six roles; older DB eight keys after System Admin; latest adds Member and masjid laptop | Target public roles are System Admin, President, VP, Secretary, Treasurer, Committee, Member plus restricted laptop identity. Keep old UUIDs/ledger actor links while migrating `finance` display/key to Treasurer; legacy Auditor holders need individual reassignment. | Choose exact role-key alias/laptop credential/operator attribution and any Admin financial emergency powers; migrate without losing historical reports. |
| D-02 | Current P/VP self-approval conflicts with latest President usual approval, Treasurer for President, President for Treasurer | No self approval in target rule; approval and payment separate. | For Vice President's own expense, who approves? For laptop submission, does Treasurer verification replace or precede President approval? Decide before grant changes. |
| D-03 | Latest Treasurer direct edit/delete verified entries conflicts with immutable ledger | Preserve visible edit/delete intent; proposed audited supersession/void + balancing entry retains every original posting and reason. Never physically delete posted ledger/audit. | Confirm exact user-facing edit/delete semantics, who sees corrections and independent review thresholds. |
| D-04 | New every-rupee annual/monthly report versus current monthly/date-range implementation | One canonical ledger inclusion model; annual 1 Jan–31 Dec, transfers separate, revisions/cutoff and itemization. | How are unpublished corrections and old receipt identifiers displayed in reissued prior reports? |
| D-05 | Latest detailed report access P/VP/Sec/Treasurer versus grant to all active roles | Revoke non-leadership `finance.monthly_reports.read` across SQL/RPC, Storage, PDF and CSV; do not take away unrelated salary view by accident. | Confirm whether System Admin has read-only emergency access; settle exact salary fields every member may see. |
| D-06 | Salary/advances/opening balance/new deposit proof absent or incomplete | New posting categories with transfer no-net-income, advance balance and payroll history. | Salary privacy/attachment visibility, payroll approval path, advance settlement and opening-balance corrections. |
| D-07 | One-time referral exists; monthly donor separate | Preserve one-time flow and attribution; no automated monthly booking from unpaid pledges. | One-time donor phone and referral visibility policy beyond already captured fields. |
| D-08 | Sequential public receipt IDs still generated despite later unguessable-number requirement | New public code needs entropy and non-enumerating lookup; rate limit remains. User confirmed this is the first app version and no old app receipts were issued to donors. | Inventory any development/test receipts before launch; keep sequential test codes private. No public legacy-code lookup is required. |
| D-09 | Monthly contributor system and WhatsApp absent | New subsystem, consent ledger, approved template, verified bank/cash settlement and webhook outbox/inbox. | Partial payment (Question 101) and immediate same-month amount-change allocation remain unanswered; Meta category/pricing approved in Task 10. |
| D-10 | Current open task single claimant/direct-or-open and due-date/overdue policy versus multi-person mixed/waitlist with optional date/no deadline | Expand mode, per-mode/overall caps, creator verification and FIFO queue; current records retain assignment history. | Exact cancellation/withdrawal/waitlist expiry behavior if a user does not accept an offered slot; overdue behavior when no deadline is set; latest choice sends no outbound cancellation notification. |
| D-11 | Required decline reason vs latest optional; authenticated announcements/meeting alerts lack new memo/one-hour WhatsApp | Make decline reason nullable in RPC and table checks, preserve old reasons; add private memo and scheduled notification cases. | Who may finalize attendance when organizer unavailable? |
| D-12 | Manual attendance RPC does not locate organizer; map center unset | Require organizer onsite check at manual mark; audit source and outcome. | Confirm exact coordinates and fallback when organizer location unavailable; never claim 100 m GPS as tamper-proof. |
| D-13 | Jummah member GPS and Hafiz five-prayer attendance are distinct | Add separate domain with five slots per India-local date; mark/edit by P/VP/Sec/Treasurer with automatic history. | Prayer schedule/source for determining “after the prayer” if server enforcement is desired. |
| D-14 | Existing activity counts versus referral/task/meeting/combined scores | Derived transparent counts/period/denominators; verified referrals only. | Combined score formula/weights and whether salary/financial donation value appears publicly in performance. |
| D-15 | Authenticated immutable announcement text versus public website/gallery/schedule/edit | New public content publication and versioning, member-only audience only if later selected. | Public image approval, expiry versus old fixed 30-day archive and memo/public media retention. |
| D-16 | Existing release policy and UI but no verified signed update lifecycle | Keep server minimum-version control and public APK; test old-to-new signed install and working fallback link. | Current contact details/site URL/hosting and keystore custody before launch. |
| D-17 | Earlier internet-required policy versus latest offline entry | Keep server authoritative, queue selected offline drafts/entries with idempotency and conflict UI. | Which exact finance/task/meeting operations are allowed to queue; location check cannot be retroactively trusted. |
| D-18 | Requested daily DB+files backup/Drive and laptop restore not implemented | Provider backup plus separately encrypted DB/object export, manifest, staging restore and monitoring; credentials server-side. | Drive account/folder, operator security, recovery authority and whether no extra confirmation remains acceptable for a destructive restore. |

## 4. Safe migration and rollout order

1. **Inventory first:** preserve the dirty worktree; copy a reviewed backup of schema and Storage objects in a staging environment. Query actual role holders, role grants, historical receipt IDs, posted expense/ledger rows, report objects, task modes, and active sessions. Do not assume local migrations were applied remotely.
2. **Decide policy:** close D-01/02/03/05/08/09/18 and other blocking questions in Task 5; write versioned permissions and acceptance tests. Without these, avoid authorizing new finance/laptop routes.
3. **Additive DB layer:** new columns/tables for laptop/operator, donor periods/consent, new receipt codes, task participation/waitlist, meeting memo/finalization, Hafiz marks, salaries/advances, outbox/inbox, backup manifest. Preserve old IDs and receipt records; backfill in small checked transactions. Do not rewrite previously applied migration files.
4. **Authorization cutover:** centralize Treasurer alias/key, provision Member/laptop deliberately, audit old Auditor holders, revoke stale monthly-report read/VP self-approval where new rules demand. Check function EXECUTE, RLS, Storage SELECT, protected Next routes and Edge Functions together; keep System Admin recovery possible.
5. **Finance/receipt cutover:** reconcile before/after ledger totals; add new nonsequential public receipt code without invalidating old internal IDs, implement audited correction UX, derive annual/monthly totals from the same ledger, test income versus transfer and advance settlement.
6. **Work/content/automation cutover:** implement server cap/waitlist transactions and task verification; update RSVP/memo/geofence; deploy announcements; then WhatsApp templates/inbox/outbox with opt-in/STOP and paid-message budget. Recompute performance only from verified source events.
7. **Client rollout:** coordinate web and APK compatibility across old/new RPCs; publish signed APK with increased versionCode, test old app with compatibility window, then raise minimum-supported version. Do not strand offline drafts; preserve a recovery download path.
8. **Verification and operations:** run fresh-database migrations and SQL permission/concurrency tests, web/mobile checks, seeded exact-rupee PDF audit, physical geofence/Android upgrade, WhatsApp sandbox, and full DB+file restore before production. Only then remove deprecated grants/functions after observability shows no clients use them.

## 5. Explicit exclusions from Task 4

This phase did not make policy choices for the user, alter an existing financial row, execute a migration, deploy anything, obtain provider credentials or declare production readiness. The trace in `REQUIREMENT_TO_CODE_TRACE_2026-10-15.md` enumerates source evidence. Task 5 owns unresolved answers and acceptance criteria; Tasks 6–10 own implementation and proof.
