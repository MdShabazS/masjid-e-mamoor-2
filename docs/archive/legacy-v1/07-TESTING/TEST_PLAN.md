# Masjid-e-Mamoor 2 — Test Plan

**Document Status:** V1 Executable Test Plan  
**Version:** 1.0  
**Product:** Masjid-e-Mamoor 2 Internal Management Application  
**Scope:** V1  
**Platforms:** Web, Android, iOS  
**Related Documents:** TESTING_STRATEGY.md, ACCEPTANCE_CRITERIA.md, SECURITY_CHECKLIST.md, AUTHORIZATION_MODEL.md, SCREEN_SPECIFICATIONS.md  
**Last Updated:** 2026-09-17

---

# 1. Purpose

This document defines the executable V1 test plan for Masjid-e-Mamoor 2.

It converts the broader testing strategy into identifiable test suites and test cases.

The plan covers:

```text
Authentication
Authorization
Members
Contributions
Donations
Payments
Finance
Expenses
Transfers
Committee work
Meetings
Attendance
Notifications
Files
Reports
Audit
Localization
Accessibility
Offline behavior
Security
Regression
Release
```

---

# 2. Test Case Status

Use:

```text
NOT STARTED
IN PROGRESS
PASS
FAIL
BLOCKED
N/A
```

Each executed test should have:

```text
Test Case ID
Tester
Environment
Date
Result
Evidence
Defect ID where applicable
```

---

# 3. Test Priority

### P0 — Release Blocker

Critical business/security/integrity tests.

Examples:

```text
Financial integrity
Authorization
Payment verification
RLS
Privilege escalation
Private financial files
Critical concurrency
```

### P1 — High Priority

Core user workflows.

Examples:

```text
Member referral
Contribution
Tasks
Meetings
Attendance
Reports
```

### P2 — Standard

Secondary behavior and broader usability coverage.

---

# 4. Test Environments

## ENV-DEV

Local development.

Use:

```text
Synthetic data
Development credentials
Local/test services
```

## ENV-CI

Automated CI environment.

Use:

```text
Automated test database
Synthetic fixtures
Mocked external services where appropriate
```

## ENV-STAGING

Production-like integrated environment.

Use:

```text
Non-production data
Configured integrations
Device testing
E2E
```

## ENV-PROD

Production.

Run only:

```text
Safe smoke tests
Health checks
Read-only verification
```

Do not create fake financial records in production.

---

# 5. Test Data Set

Prepare synthetic data for:

```text
President
Vice President
Secretary
Finance
Auditor
Committee Member
Member
Disabled user
```

Synthetic members:

```text
Member A — ₹500/month
Member B — ₹500/month
Member C — ₹700/month
Member D — no monthly contribution
Member E — multiple outstanding months
Member F — overpayment scenario
```

Synthetic finance data:

```text
Cash
Bank
UPI
Other account where required
```

Synthetic work data:

```text
Open task
Assigned task
Claimed task
Completed task
Overdue task
```

Synthetic meeting data:

```text
Upcoming meeting
Past meeting
Cancelled meeting
Meeting with decision
Meeting with follow-up task
```

Synthetic attendance:

```text
Valid Jummah
Duplicate Jummah
Outside radius
Offline pending attendance
Meeting attendance
```

---

# 6. Authentication Test Suite — AUTH

## AUTH-001 — Valid OTP

**Priority:** P0

**Steps:**

```text
Enter valid mobile
Request OTP
Enter valid OTP
```

**Expected:**

```text
Authentication succeeds.
Correct application account loads.
```

---

## AUTH-002 — Invalid OTP

**Priority:** P0

**Expected:**

```text
Authentication denied.
No protected application access.
```

---

## AUTH-003 — Expired OTP

**Priority:** P0

**Expected:**

```text
Authentication denied.
User can request a new OTP.
```

---

## AUTH-004 — OTP Reuse

**Priority:** P0

Use an OTP after successful verification.

**Expected:**

```text
OTP reuse rejected.
```

---

## AUTH-005 — OTP Rate Limit

**Priority:** P0

Perform repeated OTP requests/attempts.

**Expected:**

```text
Rate limit activates.
No uncontrolled OTP requests.
```

---

## AUTH-006 — Logout

**Priority:** P0

**Expected:**

```text
Protected pages no longer accessible.
Session is ended appropriately.
```

---

## AUTH-007 — Session Expiry

**Priority:** P0

Expire/invalidate session.

**Expected:**

```text
Protected request is rejected.
User is redirected/requires authentication.
```

---

## AUTH-008 — Disabled Account

Disable a user.

**Expected:**

```text
Protected access denied.
Historical records remain intact.
```

---

# 7. Authorization Test Suite — AUTHZ

## AUTHZ-001 — Member Cannot Verify Payment

**Priority:** P0

**Expected:** Denied.

---

## AUTHZ-002 — Auditor Cannot Edit Financial Transaction

**Priority:** P0

**Expected:** Denied.

---

## AUTHZ-003 — Finance Cannot Delete Financial Transaction

**Priority:** P0

**Expected:** Denied.

---

## AUTHZ-004 — Committee Member Cannot Delete Completed Work

**Priority:** P0

**Expected:** Denied.

---

## AUTHZ-005 — Member Cannot Change Contribution

**Priority:** P0

**Expected:** Denied.

---

## AUTHZ-006 — Member Cannot View Other Member Donation History

**Priority:** P0

**Expected:** Denied/filtered.

---

## AUTHZ-007 — User Cannot Self-Elevate Role

**Priority:** P0

Attempt to submit a client payload changing own role.

**Expected:**

```text
Request denied.
Role remains unchanged.
Audit event generated where applicable.
```

---

## AUTHZ-008 — Private File Authorization

**Priority:** P0

Attempt to open private bill with unauthorized account.

**Expected:**

```text
Access denied.
```

---

## AUTHZ-009 — Notification Deep-Link Authorization

**Priority:** P0

Open finance deep link with unauthorized user.

**Expected:**

```text
Record access denied.
```

---

## AUTHZ-010 — Search Authorization

**Priority:** P0

Search for another member's private information from a restricted account.

**Expected:**

```text
Unauthorized records not returned.
```

---

# 8. Membership Test Suite — MEM

## MEM-001 — Register New Member

**Priority:** P1

**Expected:**

```text
Member created once.
Primary referrer stored.
```

---

## MEM-002 — Duplicate Mobile

**Priority:** P0

Register another member using an existing mobile.

**Expected:**

```text
No duplicate member created.
Existing record identified according to role.
```

---

## MEM-003 — Set Monthly Contribution

**Priority:** P1

Create member with agreed monthly amount.

**Expected:**

```text
Amount saved.
Effective month saved.
```

---

## MEM-004 — Change Contribution Effective Month

Scenario:

```text
July ₹500
August ₹500
September onward ₹700
```

**Expected:**

```text
July remains ₹500
August remains ₹500
September uses ₹700
```

---

## MEM-005 — Unauthorized Contribution Change

Member attempts change.

**Expected:** Denied.

---

## MEM-006 — Referral Correction

President changes primary referrer.

**Expected:**

```text
Change succeeds.
Reason captured.
Audit record exists.
```

---

## MEM-007 — Unauthorized Referral Correction

Non-authorized user attempts correction.

**Expected:** Denied.

---

# 9. Donation Test Suite — DON

## DON-001 — Monthly Record Generation

**Expected:**

```text
Next month's expected contribution record is generated.
```

---

## DON-002 — Pending Monthly Donation

Expected:

```text
Month remains Pending/Outstanding when unpaid.
```

---

## DON-003 — Monthly Payment Link

Verify:

```text
Correct amount
Correct month
Current UPI destination
Expiry
```

---

## DON-004 — Open Payment Link Does Not Verify

Open payment link without verified payment.

**Expected:**

```text
Donation remains unverified/pending.
```

---

## DON-005 — Combined Outstanding Payment

Scenario:

```text
July ₹500
August ₹500
September ₹500
Payment ₹1500
```

**Expected:**

```text
July settled
August settled
September settled
```

---

## DON-006 — FIFO Allocation

Create multiple outstanding months and verify allocation order.

**Expected:**

```text
Oldest eligible month allocated first.
```

---

## DON-007 — Partial Monthly Payment

Scenario:

```text
Due ₹500
Payment ₹300
```

**Expected:**

```text
Monthly record not marked complete.
```

---

## DON-008 — Overpayment

Scenario:

```text
Outstanding ₹1000
Payment ₹1200
```

**Expected:**

```text
₹1000 settles outstanding
₹200 becomes General Donation
Future monthly dues unchanged
```

---

## DON-009 — Additional Donation

**Expected:**

```text
General Donation
No monthly amount change
```

---

## DON-010 — Anonymous Donation

**Expected:**

```text
Anonymous record created.
No member attribution unless intentionally provided.
```

---

## DON-011 — Jummah Cash Collection

Enter one Friday total.

**Expected:**

```text
Single cash collection record
Included in Cash account
Included in financial reports
```

---

# 10. Payment Verification Suite — PAY

## PAY-001 — Finance Verifies Payment

**Expected:**

```text
Payment becomes verified.
Authoritative financial record updates.
Audit event recorded.
```

---

## PAY-002 — Unauthorized Verification

Non-Finance user attempts verification.

**Expected:** Denied.

---

## PAY-003 — Duplicate Verification

Submit verification twice.

**Expected:**

```text
One authoritative verification.
No duplicate financial posting.
```

---

## PAY-004 — Reject Payment

Finance rejects invalid/unconfirmed payment.

**Expected:**

```text
Payment remains unverified/rejected.
No verified income posting.
```

---

## PAY-005 — Verification After Payment-Link Open

**Expected:**

```text
Opening link alone does not verify payment.
```

---

## PAY-006 — Payment Reference Recording

**Expected:**

```text
Reference ID stored correctly.
Associated with correct payment/financial record.
```

---

# 11. UPI Test Suite — UPI

## UPI-001 — Active UPI

**Expected:**

```text
Current payment request uses active UPI ID.
```

---

## UPI-002 — Finance Changes UPI

**Expected:**

```text
New payment links use new UPI.
Historical records remain unchanged.
Change is audited.
```

---

## UPI-003 — Unauthorized UPI Change

**Expected:** Denied.

---

## UPI-004 — Payment Handoff

Physical Android device:

```text
Open UPI payment
→ Select available UPI app
→ Verify displayed payee/amount
```

**Expected:**

```text
Correct destination and amount.
No false verification.
```

---

# 12. Finance Account Suite — FIN

## FIN-001 — Create Cash Account

**Expected:**

```text
Account created.
Opening balance correct.
```

---

## FIN-002 — Create Bank Account

Verify:

```text
Bank name
Account name
Last four digits
```

No unnecessary full account number display.

---

## FIN-003 — Account Balance

Create known transactions.

**Expected:**

```text
Calculated balance matches expected result.
```

---

## FIN-004 — Negative Balance

Create debits exceeding available balance where allowed.

**Expected:**

```text
Transaction follows product rule.
Negative balance shown with warning.
```

---

## FIN-005 — Past-Dated Transaction

**Expected:**

```text
Transaction date stored correctly.
Balance updates immediately according to V1 rule.
```

---

## FIN-006 — Future-Dated Transaction

**Expected:**

```text
Transaction accepted if permitted.
Balance changes immediately according to V1 rule.
```

---

## FIN-007 — Account Deactivation

**Expected:**

```text
Account becomes inactive.
Historical transactions remain.
```

---

# 13. Financial Transaction Suite — FTX

## FTX-001 — Create Credit

**Expected:** Correct balance increase.

---

## FTX-002 — Create Debit

**Expected:** Correct balance decrease.

---

## FTX-003 — Unique Transaction ID

Create multiple transactions.

**Expected:**

```text
No duplicate system transaction IDs.
```

---

## FTX-004 — Transaction Filters

Verify:

```text
Date
Account
Credit/debit
Amount
Method
Category
Reference
```

**Expected:**

```text
Results match filters.
```

---

## FTX-005 — Financial Correction

**Expected:**

```text
Correct value saved.
Reason stored where required.
Balance recalculated.
Audit event exists.
```

---

## FTX-006 — Unauthorized Correction

**Expected:** Denied.

---

## FTX-007 — Financial Deletion by President

**Expected:**

```text
Deletion succeeds.
Balance recalculates.
Audit event recorded.
```

---

## FTX-008 — Financial Deletion by Finance

**Expected:** Denied.

---

## FTX-009 — Repeated Deletion Request

**Expected:**

```text
No inconsistent state.
```

---

# 14. Transfer Suite — TRF

## TRF-001 — Cash to Bank

Example:

```text
Cash ₹10,000
Bank ₹20,000
Transfer ₹5,000
```

Expected:

```text
Cash ₹5,000
Bank ₹25,000
Overall funds ₹30,000
```

---

## TRF-002 — Bank to Cash

Expected balances update correctly.

---

## TRF-003 — Bank to Bank

Expected:

```text
Source decreases
Destination increases
Overall funds unchanged
```

---

## TRF-004 — Transfer ID

**Expected:**

```text
Both sides share linked Transfer ID.
```

---

## TRF-005 — Duplicate Transfer

**Expected:**

```text
Only one transfer posts.
```

---

# 15. Expense Suite — EXP

## EXP-001 — Create Expense

**Expected:**

```text
Expense created.
Correct amount/category/date.
```

---

## EXP-002 — Bill Upload

Upload:

```text
PDF
JPG
PNG
```

**Expected:** Accepted and privately stored.

---

## EXP-003 — Invalid Bill Type

**Expected:** Rejected.

---

## EXP-004 — Add Partial Payment

Example:

```text
Expense ₹10,000
Payment ₹4,000
```

Expected:

```text
Paid ₹4,000
Remaining ₹6,000
Status Partially Paid
```

---

## EXP-005 — Multiple Payments

Example:

```text
UPI ₹4,000
Cash ₹3,000
Bank ₹3,000
```

Expected:

```text
Paid ₹10,000
Remaining ₹0
Status Paid
```

---

## EXP-006 — Payment Exceeds Expense

Example:

```text
Expense ₹10,000
Payment ₹10,001
```

Expected:

```text
Rejected.
```

---

## EXP-007 — Payment Proof Required

Attempt Paid state without payment proof.

**Expected:**

```text
Paid state rejected.
```

---

## EXP-008 — Expense Cancellation

**Expected:**

```text
Allowed only in permitted state.
Required reason captured.
```

---

## EXP-009 — Amount Correction

Example:

```text
Original ₹10,000
Paid ₹4,000
New amount ₹4,000
```

Expected:

```text
Reason required.
Payment remains valid.
Remaining becomes ₹0.
Audit context preserved.
```

---

## EXP-010 — Invalid Amount Correction

Set new amount below already-paid total.

**Expected:** Rejected.

---

## EXP-011 — Unauthorized Expense Mutation

**Expected:** Denied.

---

# 16. Committee Work Suite — TASK

## TASK-001 — Create Direct Task

**Expected:** Task created and assigned.

---

## TASK-002 — Create Open Task

**Expected:**

```text
Task visible in Open Tasks.
No responsible member until claim.
```

---

## TASK-003 — Claim Open Task

**Expected:**

```text
Claim succeeds.
Responsible member assigned.
```

---

## TASK-004 — Concurrent Claim

Two eligible users claim simultaneously.

**Expected:**

```text
Exactly one succeeds.
```

---

## TASK-005 — Progress Update

**Expected:** Progress record saved.

---

## TASK-006 — Complete Task

**Expected:**

```text
Status Completed
Completion timestamp stored
Actor recorded
```

---

## TASK-007 — Overdue Task

Set deadline in past while incomplete.

**Expected:**

```text
Task status/indicator shows Overdue.
Responsible member receives configured notification.
```

---

## TASK-008 — Edit Own Completed Work

**Expected:**

```text
Permitted edit succeeds.
Actor/time captured where required.
```

---

## TASK-009 — Delete Completed Work

Committee Member attempts deletion.

**Expected:** Denied.

---

## TASK-010 — Unauthorized Task Edit

**Expected:** Denied.

---

# 17. Meeting Suite — MTG

## MTG-001 — Create Meeting

**Expected:**

```text
Meeting scheduled.
```

---

## MTG-002 — Meeting Attendance

**Expected:**

```text
One attendance record per member/meeting.
```

---

## MTG-003 — Duplicate Meeting Attendance

**Expected:** Rejected.

---

## MTG-004 — Add Decision

**Expected:** Decision stored.

---

## MTG-005 — Decision Without Task

**Expected:** Valid.

---

## MTG-006 — Decision With Follow-up Task

**Expected:**

```text
Decision linked to task.
Responsible member stored.
```

---

## MTG-007 — Accountability Chain

Verify:

```text
Meeting
→ Decision
→ Task
→ Responsible Member
→ Completion
```

**Expected:** Full linkage preserved.

---

## MTG-008 — Cancelled Meeting

**Expected:**

```text
Status Cancelled.
No incorrect active attendance behavior.
```

---

# 18. Jummah Attendance Suite — ATT-J

## ATT-J-001 — Valid Location

Use physical device within configured radius.

**Expected:**

```text
Attendance accepted.
```

---

## ATT-J-002 — Outside Radius

**Expected:**

```text
Attendance rejected.
Clear user feedback.
```

---

## ATT-J-003 — Poor Accuracy

**Expected:**

```text
Attendance not accepted when accuracy fails required validation.
```

---

## ATT-J-004 — Location Permission Denied

**Expected:**

```text
Attendance not marked.
Permission guidance shown.
```

---

## ATT-J-005 — Duplicate Friday

Mark same Friday twice.

**Expected:**

```text
One accepted attendance.
Second attempt rejected/already recorded.
```

---

## ATT-J-006 — Offline Attendance

**Expected:**

```text
Local Pending state.
No false final acceptance.
```

---

## ATT-J-007 — Offline Sync

Restore network.

**Expected:**

```text
Server validates.
Attendance becomes accepted or rejected.
No duplicate.
```

---

## ATT-J-008 — App Restart Before Sync

**Expected:**

```text
Pending record remains safely available for synchronization where supported.
```

---

## ATT-J-009 — No Continuous Tracking

Verify device/network behavior during normal use.

**Expected:**

```text
No continuous attendance-location tracking implementation.
```

---

# 19. Meeting Attendance Suite — ATT-M

## ATT-M-001 — Scheduled Meeting

**Expected:** Eligible attendance can be recorded.

---

## ATT-M-002 — Invalid Meeting

Attempt attendance for non-existent/invalid meeting.

**Expected:** Rejected.

---

## ATT-M-003 — Duplicate Attendance

**Expected:** Rejected.

---

## ATT-M-004 — Unauthorized Correction

**Expected:** Denied.

---

# 20. Notification Suite — NOTIF

## NOTIF-001 — Task Assignment

**Expected:** Correct responsible member receives notification.

---

## NOTIF-002 — Deadline Notification

**Expected:** Correct recipient receives configured notification.

---

## NOTIF-003 — Task Completion

**Expected:** Appropriate internal recipient receives notification where configured.

---

## NOTIF-004 — Meeting Reminder

**Expected:** Appropriate invitees/participants receive reminder.

---

## NOTIF-005 — Pending Donation Reminder

**Expected:**

```text
Correct member receives reminder.
Message contains minimum necessary information.
```

---

## NOTIF-006 — Notification Deep Link

**Expected:**

```text
Authorized user opens correct screen.
Unauthorized user is blocked.
```

---

## NOTIF-007 — Provider Failure

Simulate push/SMS provider failure.

**Expected:**

```text
Business record remains correct.
No financial mutation caused by notification failure.
```

---

# 21. File Security Suite — FILE

## FILE-001 — PDF Upload

**Expected:** Accepted when authorized.

---

## FILE-002 — JPG Upload

**Expected:** Accepted when authorized.

---

## FILE-003 — PNG Upload

**Expected:** Accepted when authorized.

---

## FILE-004 — Unsupported File

**Expected:** Rejected.

---

## FILE-005 — Oversized File

**Expected:** Rejected.

---

## FILE-006 — Unauthorized File Download

**Expected:** Denied.

---

## FILE-007 — Unauthorized Replacement

**Expected:** Denied.

---

## FILE-008 — Authorized Replacement

**Expected:** Allowed where workflow permits.

---

## FILE-009 — Private Storage

Attempt to use raw/guessed storage path.

**Expected:**

```text
Unauthorized access denied.
```

---

# 22. Reporting Suite — RPT

## RPT-001 — Daily Financial Report

**Expected:** Correct period/totals.

---

## RPT-002 — Monthly Financial Report

**Expected:** Correct opening/income/expense/closing information.

---

## RPT-003 — Yearly Financial Report

**Expected:** Correct annual period and totals.

---

## RPT-004 — Custom Date Range

**Expected:** Only selected period included.

---

## RPT-005 — Account-wise Report

**Expected:** Correct account-specific values.

---

## RPT-006 — Donation Report

Verify:

```text
Monthly
Additional
Anonymous
Jummah
Outstanding
```

---

## RPT-007 — Expense Report

**Expected:** Correct expense/payment totals.

---

## RPT-008 — Transfer Report

**Expected:** Internal transfers correctly represented without double-counting overall funds.

---

## RPT-009 — Committee Work Report

Expected fields:

```text
Created
Completed
In Progress
Pending
Overdue
```

No ranking.

---

## RPT-010 — Meeting Report

**Expected:** Meetings, attendance, decisions, follow-ups, completion status.

---

## RPT-011 — Attendance Report

**Expected:** Jummah and meeting data only.

---

## RPT-012 — Audit Report

**Expected:** Authorized users can generate relevant audit report.

---

# 23. PDF Suite — PDF

## PDF-001 — Generate Financial PDF

**Expected:**

```text
Professional layout
Correct totals
Page numbers
Reporting period
Generated timestamp
```

---

## PDF-002 — Print Layout

**Expected:** Readable on dedicated printer.

---

## PDF-003 — Long Report

Use large synthetic dataset.

**Expected:**

```text
Multiple pages
No clipped rows
Correct page numbering
```

---

## PDF-004 — Hindi PDF

**Expected:** Correct rendering.

---

## PDF-005 — Kannada PDF

**Expected:** Correct rendering.

---

## PDF-006 — Urdu PDF

**Expected:**

```text
RTL rendering correct.
Fonts/glyphs correct.
```

---

# 24. Audit Suite — AUD

## AUD-001 — Payment Verification Audit

**Expected:** Actor/time/action recorded.

---

## AUD-002 — Contribution Change Audit

**Expected:** Change is traceable.

---

## AUD-003 — Referral Correction Audit

**Expected:** Change is traceable.

---

## AUD-004 — UPI Change Audit

**Expected:** Actor/time/change recorded.

---

## AUD-005 — Financial Correction Audit

**Expected:** Required correction context recorded.

---

## AUD-006 — Financial Deletion Audit

**Expected:** President action recorded.

---

## AUD-007 — Unauthorized Action

**Expected:**

```text
Action denied.
Appropriate security event/log behavior where configured.
```

---

# 25. Localization Suite — I18N

## I18N-001 — English

Check all V1 core screens.

---

## I18N-002 — Hindi

Check:

```text
Navigation
Forms
Errors
Notifications
Reports
```

---

## I18N-003 — Kannada

Same coverage.

---

## I18N-004 — Urdu

Check:

```text
RTL
Navigation
Forms
Dialogs
Tables
Reports
PDF
```

---

## I18N-005 — Language Switch

Switch languages during active use.

**Expected:**

```text
No logout required.
No business data changes.
```

---

# 26. Accessibility Suite — A11Y

## A11Y-001 — Keyboard Navigation

**Expected:** Core web workflows accessible by keyboard.

---

## A11Y-002 — Focus

**Expected:** Visible and logical focus.

---

## A11Y-003 — Labels

**Expected:** Form fields/buttons have accessible names.

---

## A11Y-004 — Error Messages

**Expected:** Validation errors are understandable and accessible.

---

## A11Y-005 — Touch Targets

**Expected:** Core mobile controls are practically usable.

---

# 27. Security Suite — SEC

## SEC-001 — SQL Injection Attempt

**Expected:** Request rejected/safely handled.

---

## SEC-002 — XSS Input

Enter script-like content in:

```text
Task
Meeting
Notes
Descriptions
```

**Expected:** Safely rendered.

---

## SEC-003 — Privileged API Call

Use unauthorized role against privileged endpoint.

**Expected:** Denied.

---

## SEC-004 — Service Role Exposure

Inspect web/mobile bundle/config.

**Expected:**

```text
No service-role secret.
```

---

## SEC-005 — Secrets Scan

Scan repository.

**Expected:**

```text
No production secrets.
```

---

## SEC-006 — Error Leakage

Trigger controlled server error.

**Expected:**

```text
No stack trace/secrets/database internals exposed to user.
```

---

## SEC-007 — CORS

Test request from unauthorized origin.

**Expected:** Blocked according to production policy.

---

# 28. Privacy Suite — PRIV

## PRIV-001 — Member Privacy

Member attempts to view another member's donation history.

**Expected:** Denied.

---

## PRIV-002 — Contribution Privacy

Member attempts to view another member's agreed amount.

**Expected:** Denied.

---

## PRIV-003 — GPS Privacy

Member views attendance history.

**Expected:**

```text
No raw GPS coordinates shown.
```

---

## PRIV-004 — Audit Privacy

Member attempts to access audit log.

**Expected:** Denied.

---

## PRIV-005 — Report Privacy

Unauthorized user requests financial report.

**Expected:** Denied.

---

# 29. Responsive Suite — UI

## UI-001 — Mobile Layout

Test core screens on mobile.

**Expected:** Usable without horizontal clipping.

---

## UI-002 — Tablet Layout

**Expected:** Layout adapts correctly.

---

## UI-003 — Desktop Layout

**Expected:** Full information architecture works.

---

## UI-004 — Long Text

Use long task/member/meeting text.

**Expected:** No destructive overflow.

---

# 30. Offline and Failure Suite — OFF

## OFF-001 — Network Loss During Attendance

**Expected:** Pending state, no false final acceptance.

---

## OFF-002 — Network Loss During File Upload

**Expected:** Safe failure/retry behavior.

---

## OFF-003 — Network Loss During Financial Mutation

**Expected:**

```text
No ambiguous duplicate posting.
Final state is authoritative.
```

---

## OFF-004 — Application Restart

Restart during pending attendance sync.

**Expected:** Safe recovery.

---

# 31. Concurrency Suite — CON

## CON-001 — Two Payment Verifications

**Expected:** One authoritative verification.

---

## CON-002 — Two Task Claims

**Expected:** One successful claim.

---

## CON-003 — Two Account Transactions

**Expected:** Final balance consistent.

---

## CON-004 — Two Expense Payments

**Expected:** No overpayment/inconsistent state.

---

## CON-005 — Duplicate API Retry

**Expected:** Idempotent result where required.

---

# 32. Performance Suite — PERF

## PERF-001 — Dashboard Load

Measure representative synthetic dataset.

---

## PERF-002 — Member List

Test large member count.

---

## PERF-003 — Transaction List

Test large transaction count.

---

## PERF-004 — Report Generation

Test large date range.

---

## PERF-005 — Search/Filter

Test large datasets.

---

# 33. Database Migration Suite — DBM

## DBM-001 — Fresh Install

Apply all migrations to empty test database.

**Expected:** Success.

---

## DBM-002 — Existing Database Upgrade

Apply migrations to populated test database.

**Expected:**

```text
Existing records remain valid.
```

---

## DBM-003 — RLS After Migration

**Expected:** Required policies remain enabled.

---

## DBM-004 — Constraints After Migration

**Expected:** Unique/FK/check constraints remain correct.

---

# 34. Regression Suite — REG

Run after substantial changes.

Minimum:

```text
AUTH
AUTHZ
DON
PAY
FIN
FTX
EXP
TASK
MTG
ATT-J
ATT-M
RPT
AUD
SEC
PRIV
```

---

# 35. Release Smoke Suite — SMOKE

Run after deployment.

## SMOKE-001

Login works.

## SMOKE-002

Dashboard loads.

## SMOKE-003

Member search works.

## SMOKE-004

Finance dashboard loads.

## SMOKE-005

Task list loads.

## SMOKE-006

Meeting list loads.

## SMOKE-007

Attendance page loads.

## SMOKE-008

Report page loads.

## SMOKE-009

Private file access control is intact.

## SMOKE-010

No critical server errors.

Production smoke tests should avoid destructive operations.

---

# 36. User Acceptance Test Suite — UAT

## UAT-001 — Committee Referral

Stakeholder validates:

```text
Register member
Set contribution
Create payment request
```

---

## UAT-002 — Donation

Stakeholder validates:

```text
Monthly payment
Outstanding payment
Additional donation
```

---

## UAT-003 — Finance

Stakeholder validates:

```text
Verify payment
Record expense
Add payment
View balances
Generate report
```

---

## UAT-004 — Committee Work

Stakeholder validates:

```text
Create task
Claim
Complete
Review history
```

---

## UAT-005 — Meetings

Stakeholder validates:

```text
Schedule
Attendance
Decision
Follow-up
Completion
```

---

## UAT-006 — Attendance

Stakeholder validates:

```text
Jummah GPS
Meeting attendance
Offline pending/sync
```

---

# 37. Financial Reconciliation Test

Create a fully synthetic accounting scenario.

Example:

```text
Opening Cash       ₹35,000
Opening Bank      ₹1,80,000
Opening UPI        ₹35,000

Total Opening     ₹2,50,000
```

Then add controlled synthetic records.

Verify independently:

```text
Income
Expenses
Transfers
Closing balance
Account balances
Report totals
```

The UI, database and generated report must agree.

---

# 38. Critical Business Rule Tests

The following must always pass:

```text
Expected contribution ≠ verified donation
Payment link opened ≠ payment verified
Partial monthly payment ≠ paid month
Overpayment ≠ future monthly discount
Internal transfer ≠ new Masjid income
Open task claim = single winner
Jummah attendance = one member/Friday
Meeting attendance = one member/meeting
Completed work ≠ deletable by Committee Member
Financial deletion = President-only
```

---

# 39. Test Execution Order

Recommended order:

```text
1. Database/migrations
2. Unit/business logic
3. RLS/authorization
4. API/integration
5. Feature workflows
6. Web E2E
7. Mobile/device
8. Security/privacy
9. Localization/accessibility
10. Performance
11. Regression
12. Release smoke
```

---

# 40. Blocking Defects

Release is blocked by:

```text
Incorrect financial balance
Unauthorized financial mutation
Privilege escalation
Duplicate verified payment
Duplicate transfer posting
Unauthorized private-file access
Broken RLS
Payment verification bypass
Critical task-claim race
Critical attendance integrity issue
Critical secret exposure
Critical production configuration error
```

---

# 41. Test Result Reporting

At the end of a test cycle record:

```text
Total tests
Passed
Failed
Blocked
N/A
P0 failures
P1 failures
Open critical defects
Open high defects
Environment
Build/version
```

---

# 42. Traceability Matrix Structure

Maintain a requirement-to-test mapping:

| Requirement Area | Test IDs | Priority |
|---|---|---|
| Authentication | AUTH-001 to AUTH-008 | P0 |
| Authorization | AUTHZ-001 to AUTHZ-010 | P0 |
| Membership | MEM-001 to MEM-007 | P1/P0 |
| Donations | DON-001 to DON-011 | P0/P1 |
| Payments | PAY-001 to PAY-006 | P0 |
| UPI | UPI-001 to UPI-004 | P0/P1 |
| Finance | FIN-001 to FIN-007 | P0 |
| Transactions | FTX-001 to FTX-009 | P0 |
| Transfers | TRF-001 to TRF-005 | P0 |
| Expenses | EXP-001 to EXP-011 | P0/P1 |
| Committee Work | TASK-001 to TASK-010 | P0/P1 |
| Meetings | MTG-001 to MTG-008 | P1 |
| Jummah Attendance | ATT-J-001 to ATT-J-009 | P0 |
| Meeting Attendance | ATT-M-001 to ATT-M-004 | P1 |
| Notifications | NOTIF-001 to NOTIF-007 | P1 |
| Files | FILE-001 to FILE-009 | P0 |
| Reports | RPT-001 to RPT-012 | P1 |
| PDF | PDF-001 to PDF-006 | P1 |
| Audit | AUD-001 to AUD-007 | P0 |
| Localization | I18N-001 to I18N-005 | P1 |
| Accessibility | A11Y-001 to A11Y-005 | P1 |
| Security | SEC-001 to SEC-007 | P0 |
| Privacy | PRIV-001 to PRIV-005 | P0 |
| Responsive UI | UI-001 to UI-004 | P1 |
| Offline | OFF-001 to OFF-004 | P0 |
| Concurrency | CON-001 to CON-005 | P0 |
| Performance | PERF-001 to PERF-005 | P2 |
| Migrations | DBM-001 to DBM-004 | P0 |
| Regression | REG | P0 |
| Smoke | SMOKE-001 to SMOKE-010 | P0 |
| UAT | UAT-001 to UAT-006 | P1 |

---

# 43. Test Evidence Rules

For P0 failures/passes where practical, retain:

```text
CI report
Screenshot/video
Database query/result
API response
Device result
Log/request ID
```

Do not store real sensitive production data as evidence.

---

# 44. Test Exit Criteria

The V1 test cycle may exit when:

- [ ] All P0 tests pass.
- [ ] Required P1 tests pass.
- [ ] No open critical defect exists.
- [ ] No release-blocking high defect remains without explicit acceptance.
- [ ] Financial reconciliation passes.
- [ ] Authorization matrix passes.
- [ ] RLS tests pass.
- [ ] Private-file tests pass.
- [ ] Critical mobile/device tests pass.
- [ ] Localization/RTL checks pass.
- [ ] Release smoke passes.

---

# 45. Test Sign-Off

Recommended sign-off:

```text
QA / Tester: ______________________

Finance Validation: _______________

Security Validation: ______________

Product Validation: _______________

Mobile Validation: _________________

Date: _____________________________

Build Version: ____________________
```

---

# 46. Final Release Decision Data

Record:

```text
Release candidate:
Build:
Environment:
Test window:
P0:
P1:
Passed:
Failed:
Blocked:
Critical defects:
High defects:
Security status:
Finance status:
UAT status:
Final sign-off:
```

---

# 47. Testing Invariants

### Invariant 1

No P0 security or financial test may be knowingly skipped for a production release.

### Invariant 2

A frontend pass cannot override a backend/RLS failure.

### Invariant 3

A payment link does not prove payment.

### Invariant 4

A partial monthly payment does not complete a monthly record.

### Invariant 5

Overpayment does not advance future monthly dues.

### Invariant 6

Internal transfers do not increase overall Masjid funds.

### Invariant 7

Open-task claiming has one winner.

### Invariant 8

Jummah attendance is one member per Friday.

### Invariant 9

Meeting attendance is one member per meeting.

### Invariant 10

Private files require authorization.

### Invariant 11

Financial deletion is President-only.

### Invariant 12

Historical financial/work records remain intact.

### Invariant 13

Notifications do not modify business truth.

### Invariant 14

Offline attendance is server-authoritative after synchronization.

### Invariant 15

Reports and PDFs must match authoritative data.

### Invariant 16

Urdu must render as RTL.

### Invariant 17

Unauthorized roles must fail securely.

---

# 48. Related Documents

- `TESTING_STRATEGY.md`
- `ACCEPTANCE_CRITERIA.md`
- `SECURITY_CHECKLIST.md`
- `SECURITY_REQUIREMENTS.md`
- `AUTHORIZATION_MODEL.md`
- `DATA_PRIVACY.md`
- `SCREEN_SPECIFICATIONS.md`
- `DATABASE_SCHEMA.md`
- `DATA_RELATIONSHIPS.md`
- `FINANCIAL_DATA_MODEL.md`
- `DONATION_SYSTEM.md`
- `PAYMENT_SYSTEM.md`
- `FINANCE_SYSTEM.md`
- `EXPENSE_SYSTEM.md`
- `COMMITTEE_WORK_MANAGEMENT.md`
- `MEETING_MANAGEMENT.md`
- `ATTENDANCE_SYSTEM.md`
- `NOTIFICATION_SYSTEM.md`
- `REPORTING_AND_AUDIT.md`
- `INTERNATIONALIZATION.md`
- `STORAGE_STRATEGY.md`
- `BACKUP_AND_RECOVERY.md`
- `MONITORING.md`

---

## Document Status

**Test Plan — V1 Executable Test Plan**

This document defines the executable test suites and release validation requirements for Masjid-e-Mamoor 2 V1.
