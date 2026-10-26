# Role and Trusted Command Authorization v2

**Task 6 target contract, 15 October 2026.** This table is a specification for future migrations, not a claim about live RLS. Resolve actor from `auth.uid()` plus active application account/role in trusted DB state; client-supplied role, approval actor, owner or posting status is ignored. Every RPC must explicitly check role, resource relationship and current state; revoke direct DML and obsolete RPC execute grants before enabling new UI.

## Permissions

Abbreviations: SA System Admin, P President, VP Vice President, S Secretary, T Treasurer, C Committee, M Member, L masjid laptop. `Own` means own profile or participation only. Administrative control does not silently grant financial self approval. Unsettled grants stay denied until a user decision.

| Command or data scope | SA | P | VP | S | T | C | M | L |
|---|---|---|---|---|---|---|---|---|
| Provision/deactivate/reset accounts, assign roles, release gate | Yes | — | — | — | — | — | — | — |
| Own WhatsApp contact and profile | Own | Own | Own | Own | Own | Own | Own | Own operator identity |
| Submit donation/expense; refer monthly donor with consent | — | Yes | Yes | Yes | Yes | Yes | Yes | Expense and donor enrollment with consent |
| Verify donor payment or cash count | — | — | — | — | Yes | — | — | — |
| Approve ordinary or VP expense | — | Yes | — | — | — | — | — | — |
| Approve President expense | — | — | — | — | Yes | — | — | — |
| Approve Treasurer expense | — | Yes | — | — | — | — | — | — |
| Pay expense, transfer, reconcile, correct posted finance | — | — | — | — | Yes | — | — | — |
| Detailed finance records and month/year/range report | Read | Yes | Yes | Yes | Yes | — | — | — |
| Salary public member projection | Read | Yes | Yes | Yes | Yes | Yes | Yes | Open |
| Create/manage task | Open | Yes | Yes | Yes | — | — | — | — |
| Join/submit own task; RSVP/check-in meeting | Open | Own | Own | Own | Own | Own | Own | Own if invited |
| Create/manage meeting | Open | Yes | Yes | Yes | — | — | — | Yes |
| Hafiz prayer mark/correct | Open | Yes | Yes | Yes | Yes | — | — | — |
| Public announcement/media publication | Open | Yes | Yes | Yes | — | — | — | Yes |
| Activate masjid payment QR | Open | Yes | — | — | — | — | — | Yes |
| Request restore from approved archive | — | — | — | — | — | — | — | Yes, server preflight |

Public anonymous: approved masjid content/gallery, active APK link, and exact random-code receipt lookup only. All other read/write defaults deny. All logged-in roles may see their permitted task/meeting and member-performance projections; a member must not gain donor phone, full ledger, private payroll bank detail or report through a joined view.

## Command registry and server rules

| Command | Actor and row guard | Transaction and observable result |
|---|---|---|
| `provision_user`, `reset_credential`, `change_role`, `set_release_policy` | SA only, active session; role changes locked; reset token one-use and expires | Auth and app identity reconcile; revoke old sessions or reject them via fresh account state. Record admin audit. No password/token in logs. |
| `submit_expense`, `review_laptop_expense`, `decide_expense`, `pay_expense` | Submission allowed per matrix, evidence ownership and file scan; laptop stage T; approval P normally/T for P; approver differs from requester; payment T only | Lock expense/version, decision references immutable submitted version; approved amount cap and account availability checked. Payment effect + payment row + audit + notification outbox commit together. Failed transaction creates none. |
| `submit_donation`, `verify_donation`, `submit_cash_count`, `verify_cash_count` | Submission allowed per matrix; verification T; task count submitter must hold confirmed task slot | Match actual funds/account and duplicate bank reference before posting; one ledger effect, receipt and audit under stable operation ID. Rejected claims remain pending/rejected history without money. |
| `create_monthly_donor`, `record_consent`, `record_payment_claim`, `verify_monthly_payment`, `opt_out_donor` | Authorized referrer or named laptop data entry employee records affirmative consent evidence; webhook authenticated server creates claims/STOP; T verifies claims | Track who entered data separately from who actually referred the donor. STOP transaction changes suppression before a send claim; verified actual amount reconciles to bank, posts once and queues receipt code URL. Any positive verified monthly contribution suppresses five-day and balance reminders. A changed suggested amount applies to this month's profile without changing a sent request or issued receipt. |
| `create_transfer`, `approve_advance`, `settle_advance`, `record_salary_payment`, `correct_posting` | T disburses/posts/corrects; advance approval P or VP per latest task architecture; separate approver; privacy projection limits | Paired transfers/settlements balance exactly in one transaction; correction linked to original and report/receipt revision path. Audited visible Remove means void, never SQL DELETE. |
| `create_task`, `claim_task_slot`, `submit_task_completion`, `verify_task_completion` | P/VP/S creator; participant self; creator verifies | Lock parent task before checking cap and FIFO; audit transitions; verified performance event once. Creator cannot simply award points without submission. |
| `create_meeting`, `respond_meeting`, `upload_memo`, `mark_attendance`, `finalize_roster` | P/VP/S/L meeting creator; invitee self; organizer manual presence requires own current onsite proof; finalizer organizer or named laptop data entry employee as fallback | Finalization after the full India-local scheduled-day check-in window; it only snapshots status, never grants presence. Location center and accuracy checks remain mandatory for attendance. Once finalized, absence outbox deduped. Decline reason nullable. |
| `mark_prayer`, `revise_prayer`, `publish_content`, `activate_qr` | P/VP/S/T prayer; P/VP/S/L publication; P/L QR | Record before/after versions. P/L may select a different active masjid beneficiary account with the replacement QR; store selected account, digest and actor atomically. Never let client replace live asset merely by changing a public URL. |
| `run_report`, `lookup_receipt`, `request_restore` | P/VP/S/T finance report; public exact code with server rate limit; L restore request | Report snapshot cutoff/private file check; receipt projected sanitized PDF streamed from protected handler; restore only via server-side staging/preflight and audited cutover. |

## Database and Storage implementation policy

1. Revoke table INSERT/UPDATE/DELETE to `anon` and `authenticated` for ledger, reviews, claims, allocations, attendance evidence, audit, outbox, restore and report rows. Server-only mutations use narrowly granted `SECURITY DEFINER` routines with `SET search_path = pg_catalog` (schema-qualify every object; include trusted extensions only when necessary), explicit authenticated actor resolution and no caller-controlled trusted IDs. Revoke `PUBLIC` execute on every function and grant only intended role. A service-role route must perform its own authorization; service role bypasses RLS.
2. Enable RLS on every exposed table. SELECT policies call trusted permission predicates and use owner/invitee/referrer/leadership constraints. Since a broad policy ORs with narrower policies, remove old all-role report policies/grants instead of adding a restrictive policy beside them. Prefer dedicated security-invoker views or controlled RPC projections for salary, performance, reports and donor roster. Private audit/webhook/backup tables live outside exposed API schema or have no client grants.
3. Donor and member telephone fields never appear in public receipt/report links; avoid `SELECT *` projections. Leadership report download checks actor and run ownership/permission on every request, not merely signed URL creation. RLS and Storage policy both check object metadata ownership. Use private buckets for bills, memos, receipts, reports, payroll and backup artifacts; public gallery/QR are purpose-specific separately governed assets. Validate file bytes, MIME, size and extension before promotion; generate opaque paths and short-lived private URLs.
4. `realtime` can only publish SELECT-authorized projections; a client reconnect triggers authoritative refetch. A role change or deactivation takes effect on the next protected command even with an old JWT. The dedicated laptop login is assigned to one named data entry employee; do not share it. A replacement operator receives a new account after the old account is deactivated, preserving actor history. The laptop account has no financial approval/payment powers.
5. Permission testing must call SQL RPCs and direct table/Storage APIs as each role, not merely inspect UI. Include anonymous, stale/deactivated, forged role/user IDs, alternate UUIDs, old grants and `finance`/`auditor` legacy holders. Test both service server routes and direct authenticated PostgREST. Maintain an exact grant/policy snapshot after additive migration.

## Known source conflicts to replace in Task 7

- `20261014031000_all_active_roles_monthly_finance_reports.sql` grants detailed reports to all active roles; target is P/VP/S/T plus System Admin read-only. Check date-range permission and report Storage policy too.
- `20261013220000_finance_expense_approval_payment_separation.sql` permits P/VP self-approval; target uses requester-specific P/T split.
- `20261014034000_referred_donor_contributions.sql` derives sequence receipt codes, which fail public unguessability. Keep historical references but issue opaque random codes for new public lookups.
- `20261013224600_fix_meeting_response_state_check.sql` requires decline reason; target nullable. `20261014032000_meeting_geofence_attendance.sql` manual mark has no organizer location input; block that route until location-aware replacement.
- Existing `finance`/`auditor` role keys, single claimant task, unrestricted admin assumptions and existing old API grants require a data inventory before migration. Source code is not proof of deployed policy.

System Admin finance support read is approved; financial mutation is denied. Laptop identity is assigned to the data entry employee, who may enroll monthly donors with consent but may not verify their payments; that employee may finalize a meeting roster if the organizer has not. Laptop profile permission and VP expense approval remain named decisions. See `THREAT_MODEL_AND_TRANSACTION_RULES_2026-10-15.md` for state and attack controls.
