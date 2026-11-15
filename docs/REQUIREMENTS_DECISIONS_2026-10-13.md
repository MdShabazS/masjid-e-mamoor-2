# Masjid E Mamoor 2 — Requirements Decision Record

**Date:** 2026-10-13  
**Status:** Requirements gathered; implementation baseline for the next development phase  
**Scope:** Android APK and web app for Masjid E Mamoor 2

This record captures the user's answers to the 100-question requirements session. It is the current product brief for the next development phase. Older architecture and policy documents remain useful technical references, but any conflicting product decision must be reconciled with this record before implementation.

## Product and release scope

- Build for one masjid only: **Masjid E Mamoor 2**.
- First release includes finance, tasks, meetings, meeting attendance, performance, and announcements on both Android and web.
- Development workflow: research, implement, test, fix, and finalize in documented checkpoints. Resume work when the user says **“continue.”**
- English only at launch. Internet access is required.
- Android installation uses a direct APK link shared by the System Admin. The web app uses the hosting provider's free address; no custom domain is currently available.
- No historical finance import. Begin with opening balances per account and new transactions.

## Accounts, roles, and access

Launch roles are exactly:

1. System Admin
2. President
3. Vice President
4. Secretary
5. Treasurer
6. Committee Member

- Multiple people may hold a role, but each account has one role.
- The System Admin creates accounts using full name, username, and role; contact details are not required for account creation.
- The System Admin directly gives the member a temporary password. The member must set a new password at first sign-in.
- Password reset is handled by the System Admin, who issues a temporary password.
- Members can update contact details; the System Admin controls names and roles.
- Deactivated accounts retain their activity history.
- The System Admin can configure selected role permissions. Core finance approval rules remain fixed.
- All registered users can access Android and web according to their role permissions. Detailed finance reports are downloadable by all registered users.
- Authentication uses username and password. No second sign-in factor is required in v1.

## Donations and receipts

- Record donations after funds are received; do not track unpaid pledges in v1.
- Accepted methods: cash, UPI, and bank transfer. The app records payments and does not process them.
- Donor name is required; phone number is optional. Record amount, date, method, purpose, and an automatically generated receipt number.
- Donation purpose uses suggested categories and allows free-text purposes. Purpose categories do not restrict spending.
- UPI/bank donations record a transaction reference; supporting proof is optional. Cash must be physically handed to the Treasurer for verification.
- Any registered user can enter a donation. The Treasurer verifies it. An unverifiable entry is returned/rejected with a reason and can be corrected and resubmitted with history retained.
- A downloadable receipt becomes available only after Treasurer verification. A member downloads the PDF and sends it to the donor.
- The public receipt lookup page accepts the exact receipt number alone, without a second secret or donor phone. It displays the verified donor name, amount, date, method, and purpose; the optional donor phone and internal member identifiers stay private. Receipt numbers are sequential (for example `MEM2-2026-00000001`). The user explicitly chose number-only lookup after the enumeration risk was explained.
- An incorrect verified receipt is voided with a reason and replaced by a corrected receipt; both records remain in the history.
- Donation performance credit goes to the member who referred the donor, separately from the member who entered the donation.
- For a cash collection task, one assigned member enters the total; the Treasurer verifies the physical handover.

## Finance and controls

- Currency: INR. Reporting year: calendar year (1 January–31 December).
- The Treasurer or System Admin can add, rename, and deactivate financial accounts. Categories may be free text with suggested values.
- The Treasurer can reconcile app balances to physical cash and bank records, record discrepancies and explanations, and preserve reconciliation history.
- All registered users can submit expense requests. Each request requires a bill/receipt/invoice; if none exists, the requester must explain why.
- Every expense, regardless of amount, requires President or Vice President approval before payment. Either may approve their own request.
- The Treasurer records payment. Partial payments are allowed, but a single expense is paid from one financial account. If the final bill exceeds the approved amount, approval for the excess is required before payment. If paid below the approved amount, record the actual payment and close the expense with the unused amount shown.
- Rejected requests can be edited and resubmitted; preserve decision history.
- The President or Vice President can correct an approved or paid expense; the change must be recorded. Do not erase audit history.
- Transfers between masjid accounts are separate from income and expense. A transfer between two accounts is supported; one expense cannot be split across accounts.
- No budgets in v1.
- Finance report PDF and spreadsheet exports support monthly and custom date ranges. Include summary totals and a transaction list with date, category, amount, payment method, and status. Reports/receipts show the masjid name, logo, address, and contact details.
- No separate downloadable audit report is required. The application must still retain internal history of who created, verified, approved, paid, or corrected a financial record, with dates and reasons.
- Start with per-account opening balances and new records only.

## Tasks

- President, Vice President, and Secretary can create tasks. Other registered users may volunteer or receive assignments.
- A task is either open for volunteers or assigned to selected users; it cannot combine both modes.
- Volunteers are confirmed automatically until the creator's participant limit is reached. A full task closes to new volunteers; no waitlist.
- Only the creator marks a task complete. Equal completion credit goes to confirmed participants. Participants may optionally attach a photo or note.
- The creator may remove an assigned member; a member cannot withdraw themselves after accepting.
- If a task passes its due date incomplete, mark it overdue automatically and notify the creator and participants.
- The creator can edit a published task. Notify affected participants and retain change history.
- Performance records assigned and completed task counts; no task effort ratings or on-time rate in v1.

## Meetings and attendance

- President, Vice President, and Secretary can create meetings. Invite all registered users by default, with an option to exclude members.
- Invited users may accept or decline. A decline requires a reason; acceptance does not.
- Notify all invitees when meeting details change or a meeting is cancelled. Recurring meetings are deferred.
- Only invited members can mark their own attendance. Invitees who do not check in are recorded absent.
- The 100 m check is centered on Masjid E Mamoor 2, even if the meeting is held elsewhere. Attendance is available any time on the scheduled date.
- If GPS cannot verify attendance, the meeting creator may record it manually with a required reason and an audit record.
- The provided location reference is Google Maps share URL `https://maps.app.goo.gl/25eCSYcDBWRi4o5F7` and Plus Code `3JWM+23 Bellahalli, Karnataka`. Resolve this into coordinates before configuring the geofence.

## Member performance

- All registered users can view performance details for all members.
- Do not publish a leaderboard or single ranking score. Show activity details and trends.
- Include verified referred donations with both count and total amount; do not attribute the donation to the person who merely entered it.
- Show meeting attended, declined, and absent counts separately. Attendance rate uses all meetings the member was invited to.
- Show task assigned and completed counts only.
- Provide month, calendar year, and custom date range filters.
- Do not track committee term or role history in v1; retain past activity with the account.

## Announcements and notifications

- President, Vice President, and Secretary can publish read-only announcements. Members cannot comment.
- Announcements allow image and PDF attachments and are automatically archived after 30 days.
- Send push notifications on Android and web, plus in-app notifications. Members cannot disable notifications in the app; OS notification permission remains under the user's device controls.

## Releases and operations

- Required Android updates block access and show the new APK link and contact information.
- Update-screen contacts: `md.shabaz.2005@gmail.com`, `7975512403`.
- The developer publishes the release; the System Admin enters the new version, APK link, and message in the admin panel.
- Use hosting-provider backup capabilities. The chosen plan must be checked before production: if its standard backup does not cover the database and uploaded files at an acceptable retention level, do not claim backups are in place. Keep a documented restore test before production release.

## Explicit implementation risks to address

1. **Public receipt lookup:** A sequential receipt number alone exposes a donor's name and payment details to anyone who guesses it. The chosen number-only lookup cannot completely prevent enumeration. The worktree has a distributed lookup cap and hashed attempt audit; before production, run its SQL test and validate host proxy headers and limits, provide a recovery path for lost numbers, and confirm the public response contains only the approved fields. This is a material privacy risk accepted in the requested workflow and requires review against applicable Indian privacy obligations before launch.
2. **Self-approval:** Allowing a President or Vice President to approve their own expense removes separation of duties. Keep immutable audit records, expose self-approval clearly in reports, and require a reason. This is a material financial-control risk accepted in the requested workflow.
3. **Backups on free tiers:** Provider backup features vary by plan and may exclude object-storage files. Verify exact plan coverage and restore capability before production.
4. **Location accuracy:** A Maps URL and Plus Code are recorded, but server-side attendance coordinates and radius must be resolved and tested before enabling geofenced attendance.

## Reconciliation work required before feature changes

The current repository contains a different seven-role model (President/Super Admin, Vice President, Secretary, Finance, Auditor, Committee Member, Member) and established finance controls, including maker/checker approval. Before implementing this six-role brief, update the role catalogue, role matrix, onboarding, RLS/trusted-operation tests, report authorization, and expense approval rules together. Do not silently retain the old role list or claim the new requirements are implemented until the server-side authorization and tests match.

The current product branch has extensive uncommitted work. Preserve it during implementation and do not deploy, push, or alter remote Supabase production data as part of local development.

## Development checkpoint — 2026-10-13

- The working copy is `masjid-e-mamoor-2-worktree/`; the original repository and its uncommitted files remain untouched.
- Initial reconciliation confirmed the current database role catalogue has seven roles and the expense decision RPC enforces maker/checker separation. Both conflict with the approved six-role requirements and the selected self-approval rule; a labels-only change would not satisfy the requirement.
- Next implementation slice: design and test the role and finance authorization migration together, including the President/Vice President approval grants, self-approval audit evidence, and role/report/RLS coverage. Then align app role handling and run the relevant mobile/web test suites.
- The Supabase CLI currently fails before running because it cannot write its telemetry file under `/Users/shabaz/.supabase/`. No migration was created or applied. Resume with a project-local or otherwise writable CLI configuration, without changing remote database state.
- The existing root `vitest` command completed but discovered no tests under its configured `packages/**/*.test.ts` / `packages/**/*.spec.ts` patterns. Do not treat that as a passing feature test; use the package-specific scripts or correct workspace test invocation once the dependency runner is available.

### First implementation slice

- A new local migration `20261013154536_system_admin_account_authority.sql` restricts the three trusted account provisioning/role/status RPCs to active System Admins, revokes callable legacy entry points, removes President account permissions, and changes the internal `finance` role display name to Treasurer. Existing accounts and audit records remain intact. The five roles the Admin can provision plus the protected System Admin role form the desired six-role account picker; legacy Auditor/Member records still need a separate migration plan before declaring the database itself six-role-only.
- Web and Android account screens and request validation now offer the five creatable roles. The web flow generates a temporary password and does not request one from the Admin. The internal database key `finance` remains stable while the human-facing name is Treasurer.
- Web: 17 suites / 126 tests passed, TypeScript passed. Android: 50 suites / 294 tests passed, TypeScript passed. Targeted lint passed with one unused variable corrected afterward. These tests cover application behavior but do not prove the SQL migration executes.
- Docker daemon and local `psql` are unavailable in this execution environment. The SQL migration and SQL tests have **not** run, and nothing was deployed. Next: run migrations against an isolated local PostgreSQL/Supabase instance, execute the updated SQL tests, then work on the finance approval/payment state machine and remaining product modules.

### Current official platform research

- Supabase Auth is used with an internal email mapped to the Admin-assigned username; the client receives only the username and password. Server-side roles/RLS remain the authority. See https://supabase.com/docs/guides/database/postgres/row-level-security.
- Expo EAS internal distribution can produce a directly installable Android APK: https://docs.expo.dev/build/introduction/.
- Supabase automatic daily database backup is available on Pro/Team/Enterprise rather than Free; even those database backups exclude Storage objects. A free tier release needs a separate database export and file backup and a restore test: https://supabase.com/docs/guides/platform/backups.

### Finance expense implementation checkpoint (2026-10-13)

- Added `20261013220000_finance_expense_approval_payment_separation.sql`. Existing posted expenses retain their ledger entries. New approval records an unpaid `approved` expense and an audit event; it never posts an outflow. A Treasurer (or System Admin) may record one or more payments up to the approved total; each payment creates one immutable `EXPENSE` ledger entry on its actual payment date, and expenses move through `partially_paid` to `posted`. The operation ID makes payment retries idempotent, and the row lock prevents concurrent overpayment.
- All six active roles can submit an expense; President and Vice President may approve, including their own request; Treasurer holds the payment permission. Rejections and decisions stay in the audit trail. Approval notification now reflects the unpaid state.
- The Android expense screen shows paid and remaining amounts, permits Treasurer payments and presents approval without claiming that money has left the account. Monthly actual outflow is already calculated from ledger entries, so unpaid approvals do not inflate expenditure.
- Mobile verification: 50 test suites, 295 tests pass; TypeScript and targeted lint pass. SQL regression assertions updated for the new state machine, but not executed because local Postgres/Docker is unavailable. This migration has not been applied to a hosted database.
- Still to build before a production launch: bill attachments or documented missing-bill reasons, revision and resubmission of rejected requests, closing below-approved balances, extra approval for increased bills, a full web expense workflow, and live database integration tests. Do not treat the current finance slice as production complete.

### Expense evidence checkpoint (2026-10-13)

- Added `20261013221000_finance_expense_bill_evidence.sql`: a private 5 MiB JPEG/PNG/PDF bucket, immutable expense bill metadata, authenticated owner-only upload/registration, restricted bill viewing, and audit events. Approval requires at least one registered bill or a written missing-bill reason (10–1000 characters). Rejection remains possible without evidence. Old expense submission calls cannot bypass the approval gate.
- Android submitters may include a missing-bill explanation, attach a bill after submission, or add the explanation later while submitted. Authorized reviewers can open a short-lived private bill link. The client checks file signatures and size before upload. A failed registration may leave an orphaned private object for later administrator cleanup; Storage and SQL integration still need live verification.
- Mobile verification: 50 suites, 298 tests pass after new evidence and account-selection tests; typecheck and targeted lint pass. Local Postgres/Docker is unavailable, so the SQL assertions and private Storage policies have not been executed end to end. This remains unreleased.
- Account selector privacy fix: a dedicated trusted RPC returns active account names and types to expense submitters. Committee members do not receive `finance.accounts.read` or balance access through the expense form.

### Partial expense closure checkpoint (2026-10-13)

- Added `20261013222000_finance_expense_close_unused_balance.sql`. The Treasurer can close only a partially paid expense with a 10–1000 character explanation. A closed request preserves its approved total, paid total, computed unused approval, actor, date, and immutable audit event. Closure writes no ledger transaction and blocks later payments. Repeated closure operation IDs are safe; a changed replay fails.
- Android shows the unused amount and closure reason and offers a confirmation flow for the Treasurer. The existing monthly outflow remains based on actual payments, while the closure details remain in the expense and finance audit history. A fuller report section for unused approvals remains a later report improvement.
- Verification: Android 50 suites / 299 tests pass; TypeScript, targeted lint, and diff checks pass. The SQL migration and SQL regression assertions remain unexecuted because no local Postgres service is running.

### Rejected expense revision checkpoint (2026-10-13)

- Added `20261013223000_finance_expense_rejected_revision.sql`. Only the original requester may revise a rejected expense. The old amount, account, description, dates, explanation, rejecting officer, and rejection reason are archived in immutable revision history. Resubmission resets the live request to `submitted` with a higher revision number and requires a fresh President/Vice President decision; the operation ID prevents duplicate revisions.
- Bills stay linked to their original revision for audit. Approval accepts only a bill registered for the current revision or a current missing-bill explanation. Each resubmission creates an approver notification using the archived revision as the event identity and the current expense ID in metadata.
- Android shows prior rejection reasons, lets the original requester edit and resubmit, and labels bills by revision. Verification: 50 mobile suites / 301 tests pass; TypeScript, targeted lint, and diff checks pass. SQL assertions are written but cannot be executed here because local Postgres/Docker is unavailable. No hosted migration or APK release was performed.
