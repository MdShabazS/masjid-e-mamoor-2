# Masjid-e-Mamoor 2 — Acceptance Criteria

**Document Status:** V1 Product Acceptance Baseline  
**Version:** 1.0  
**Product:** Masjid-e-Mamoor 2 Internal Management Application  
**Scope:** V1  
**Platforms:** Web, Android, iOS  
**Related Documents:** PRODUCT_REQUIREMENTS.md, FEATURE_SCOPE.md, TESTING_STRATEGY.md, TEST_PLAN.md, USER_ROLES_PERMISSIONS.md, AUTHORIZATION_MODEL.md, SCREEN_SPECIFICATIONS.md  
**Last Updated:** 2026-09-17

---

# 1. Purpose

This document defines the acceptance criteria for Masjid-e-Mamoor 2 V1.

A feature is accepted only when:

```text
Required behavior works
+
Security boundaries work
+
Business rules are respected
+
Relevant tests pass
+
The user experience is usable
```

A screen being visually complete is not sufficient for acceptance.

---

# 2. Acceptance Status

Use:

```text
NOT STARTED
IN DEVELOPMENT
READY FOR TEST
PASS
FAIL
BLOCKED
N/A
```

For release-critical requirements, record evidence.

---

# 3. Product-Level Acceptance Rules

V1 is accepted only when all of the following are true:

- [ ] Authentication works.
- [ ] Role-based access is enforced.
- [ ] Core member workflows work.
- [ ] Donation/payment workflows preserve financial truth.
- [ ] Finance workflows produce correct balances.
- [ ] Expense workflows work.
- [ ] Committee task accountability works.
- [ ] Meeting accountability works.
- [ ] Jummah attendance works with server-side validation.
- [ ] Meeting attendance works.
- [ ] Reports are accurate.
- [ ] Audit records are available to authorized users.
- [ ] Private files are protected.
- [ ] Notifications work without becoming business truth.
- [ ] English, Hindi, Kannada, and Urdu are supported according to V1 requirements.
- [ ] Urdu RTL works.
- [ ] Critical security tests pass.
- [ ] Critical regression tests pass.
- [ ] Production release checks pass.

---

# 4. Authentication Acceptance Criteria

## AC-AUTH-01 — Phone Login

**Given**

A valid registered mobile number.

**When**

The user requests an OTP and submits the valid OTP.

**Then**

The user is authenticated and sent to the correct role-aware application experience.

**Acceptance:**

- [ ] Valid login succeeds.
- [ ] Invalid OTP fails.
- [ ] Expired OTP fails.
- [ ] OTP reuse fails.
- [ ] Rate limiting works.
- [ ] Session is created securely.

---

## AC-AUTH-02 — Logout

**Given**

An authenticated user.

**When**

The user logs out.

**Then**

Protected application access ends appropriately.

**Acceptance:**

- [ ] Logout works.
- [ ] Protected navigation cannot be reused without authentication.
- [ ] Protected client state is cleared appropriately.
- [ ] Re-authentication is required when necessary.

---

## AC-AUTH-03 — Disabled User

**Given**

A user has been disabled.

**When**

The user attempts to access protected application data.

**Then**

Access is denied.

**Acceptance:**

- [ ] Protected access is blocked.
- [ ] Historical records remain intact.
- [ ] User receives a clear message.

---

# 5. Authorization Acceptance Criteria

## AC-AUTHZ-01 — Server-Side Role Enforcement

**Acceptance:**

- [ ] Backend checks role/permission.
- [ ] Database policies enforce protected access where applicable.
- [ ] Client role manipulation cannot elevate access.

---

## AC-AUTHZ-02 — President-Only Financial Deletion

**Acceptance:**

- [ ] President can delete a financial transaction.
- [ ] Finance cannot.
- [ ] Auditor cannot.
- [ ] Secretary cannot.
- [ ] Committee Member cannot.
- [ ] Member cannot.
- [ ] Action is audited.
- [ ] Balance recalculates correctly.

---

## AC-AUTHZ-03 — Finance Payment Verification

**Acceptance:**

- [ ] Finance can verify eligible payments.
- [ ] Unauthorized roles cannot verify.
- [ ] Duplicate verification cannot create duplicate financial posting.

---

## AC-AUTHZ-04 — Auditor Read-Only Boundary

**Acceptance:**

- [ ] Auditor can review permitted financial records.
- [ ] Auditor can generate permitted reports.
- [ ] Auditor cannot mutate financial records.

---

## AC-AUTHZ-05 — Member Privacy Boundary

**Acceptance:**

- [ ] Member can access own permitted records.
- [ ] Member cannot access another member's private donation history.
- [ ] Member cannot access internal audit data.
- [ ] Member cannot alter agreed contribution.

---

# 6. Membership Acceptance Criteria

## AC-MEM-01 — New Member Registration

**Given**

An authorized internal user meets a new person.

**When**

Name/mobile and required member information are entered.

**Then**

A member record is created.

**Acceptance:**

- [ ] Required identity data is validated.
- [ ] Primary referrer is captured.
- [ ] Agreed contribution can be captured when applicable.
- [ ] Duplicate mobile is prevented.

---

## AC-MEM-02 — Duplicate Member Prevention

**Given**

A mobile number already exists.

**When**

A user attempts to register another member with the same mobile.

**Then**

A duplicate record is not created.

---

## AC-MEM-03 — Referral Attribution

**Acceptance:**

- [ ] One primary referrer exists in V1.
- [ ] Referrer is stored correctly.
- [ ] Referral attribution can be corrected only by authorized President workflow.
- [ ] Required correction reason is captured.
- [ ] Correction is auditable.

---

# 7. Monthly Contribution Acceptance Criteria

## AC-CON-01 — Agreed Amount

**Acceptance:**

- [ ] Authorized roles can enter/change agreed monthly amount.
- [ ] Member cannot self-change it.
- [ ] Effective month is recorded.
- [ ] Historical records remain unchanged.

---

## AC-CON-02 — Effective-Month Change

**Given**

July = ₹500  
August = ₹500  
September onward = ₹700.

**Acceptance:**

```text
July expected = ₹500
August expected = ₹500
September expected = ₹700
```

No historical month is silently rewritten.

---

# 8. Monthly Donation Acceptance Criteria

## AC-DON-01 — Monthly Record Generation

**Acceptance:**

- [ ] Next month's expected contribution record is created automatically.
- [ ] Amount follows the active effective contribution.
- [ ] Previous months remain in history.

---

## AC-DON-02 — Pending/Missed Donation

**Acceptance:**

- [ ] Unpaid month remains pending/outstanding.
- [ ] Outstanding can be calculated.
- [ ] Member can see their own outstanding amount.
- [ ] Reminder workflow can be triggered.

---

## AC-DON-03 — Payment-Link Generation

**Acceptance:**

- [ ] Link is generated after member/contribution details are confirmed.
- [ ] Link carries correct amount.
- [ ] Link uses current active Masjid UPI ID.
- [ ] Link expires at the end of the donation month.
- [ ] Expiration does not delete the donation record.
- [ ] Opening link does not mark payment as verified.

---

# 9. Outstanding Payment Acceptance Criteria

## AC-DON-04 — Combined Outstanding Payment

**Given**

```text
July ₹500
August ₹500
September ₹500
```

**When**

Member pays ₹1500.

**Then**

```text
July = settled
August = settled
September = settled
```

---

## AC-DON-05 — FIFO Allocation

**Acceptance:**

- [ ] Oldest eligible outstanding month is allocated first.
- [ ] Allocation is server-authoritative.
- [ ] Historical monthly records remain distinct.

---

## AC-DON-06 — Partial Monthly Payment

**Given**

Due = ₹500  
Payment = ₹300.

**Acceptance:**

- [ ] Month is not marked complete.
- [ ] Outstanding status remains correct.
- [ ] Payment data remains traceable.

---

## AC-DON-07 — Overpayment

**Given**

Outstanding = ₹1000  
Payment = ₹1200.

**Acceptance:**

```text
₹1000 → outstanding settlement
₹200 → General Donation
```

Also:

- [ ] Future monthly dues are unchanged.
- [ ] Full verified payment remains in member donation history.
- [ ] Verified contribution attribution remains correct.

---

# 10. Additional Donation Acceptance Criteria

## AC-DON-08 — General Donation

**Acceptance:**

- [ ] Member can enter any valid amount.
- [ ] Category is General Donation.
- [ ] It does not modify monthly agreed contribution.
- [ ] It does not reduce future monthly dues.
- [ ] Finance verification is required for authoritative receipt.

---

# 11. Anonymous Donation Acceptance Criteria

## AC-DON-09 — Anonymous Donation

**Acceptance:**

- [ ] Finance/authorized role can record anonymous donation.
- [ ] No member profile is required.
- [ ] Amount/date/method/account are recorded as applicable.
- [ ] Donation is included in financial totals.
- [ ] Donation remains anonymous in normal application records.

---

# 12. Jummah Cash Collection Acceptance Criteria

## AC-DON-10 — Friday/Jummah Cash Collection

**Acceptance:**

- [ ] Authorized role can record one total physical cash collection.
- [ ] Collection is posted to Cash.
- [ ] Collection appears in financial reports.
- [ ] No individual donor records are required.
- [ ] Historical collection records remain available.

---

# 13. Payment Verification Acceptance Criteria

## AC-PAY-01 — Finance Verification

**Acceptance:**

- [ ] Payment appears in Finance verification queue.
- [ ] Finance can review amount/reference/context.
- [ ] Finance can verify.
- [ ] Verification creates/updates authoritative financial record.
- [ ] Verification is audited.

---

## AC-PAY-02 — Payment Rejection

**Acceptance:**

- [ ] Finance can reject an invalid/unconfirmed payment.
- [ ] Rejected payment does not become verified income.
- [ ] Member/payment state remains traceable.

---

## AC-PAY-03 — No False Verification

The following must never equal verified payment:

```text
Link created
Link opened
Payment attempted
App returned from UPI
Client says paid
```

Only the approved Finance verification workflow can establish authoritative verified payment.

---

# 14. UPI Acceptance Criteria

## AC-UPI-01 — One Active UPI

**Acceptance:**

- [ ] Only one active UPI ID is used in V1.
- [ ] Authorized Finance user can change it.
- [ ] Historical records remain unchanged.
- [ ] UPI change is audited.

---

## AC-UPI-02 — UPI Handoff

**Acceptance:**

- [ ] Payment amount is correct.
- [ ] Masjid destination is correct.
- [ ] UPI handoff works on supported device flow.
- [ ] UPI handoff does not itself verify payment.

---

# 15. Finance Account Acceptance Criteria

## AC-FIN-01 — Account Creation

**Acceptance:**

- [ ] Authorized user can create permitted account.
- [ ] Opening balance is stored.
- [ ] Required bank/UPI metadata is stored.
- [ ] Only necessary sensitive account details are displayed.

---

## AC-FIN-02 — Balance Calculation

**Acceptance:**

For each account:

```text
Opening balance
+
credits
-
debits
=
calculated balance
```

The value must match authoritative database state.

---

## AC-FIN-03 — Immediate Balance Update

**Acceptance:**

- [ ] Transaction entered on a past date updates balance immediately according to V1 rule.
- [ ] Transaction entered on a future date updates balance immediately according to V1 rule.
- [ ] UI reflects authoritative result.

---

## AC-FIN-04 — Negative Balance

**Acceptance:**

- [ ] Negative balance is permitted according to product rules.
- [ ] Warning is visible.
- [ ] System does not silently alter transaction amount.

---

# 16. Financial Transaction Acceptance Criteria

## AC-FTX-01 — Unique Transaction

**Acceptance:**

- [ ] Every transaction has unique system-generated ID.
- [ ] Transaction cannot be duplicated by repeated request.
- [ ] Reference information is preserved.

---

## AC-FTX-02 — Financial Correction

**Acceptance:**

- [ ] Authorized correction works.
- [ ] Same transaction identity is retained where specified.
- [ ] Reason is captured where required.
- [ ] Balance recalculates correctly.
- [ ] Audit context is recorded.

---

## AC-FTX-03 — Financial Deletion

**Acceptance:**

- [ ] President-only authorization works.
- [ ] Deletion requires confirmation.
- [ ] Related financial state remains consistent.
- [ ] Balance recalculates.
- [ ] Audit event is created.

---

# 17. Transfer Acceptance Criteria

## AC-TRF-01 — Internal Transfer

**Acceptance:**

For Cash → Bank:

```text
Source decreases
Destination increases
Overall Masjid funds unchanged
```

- [ ] Transfer ID links both sides.
- [ ] Transfer posts atomically.
- [ ] Duplicate transfer does not occur.

---

# 18. Expense Acceptance Criteria

## AC-EXP-01 — Expense Creation

**Acceptance:**

- [ ] Finance can add expense.
- [ ] Required fields are validated.
- [ ] Bill can be uploaded as supported format.
- [ ] Bill is private.

---

## AC-EXP-02 — Multiple Payments

**Given**

```text
Expense ₹10,000
UPI ₹4,000
Cash ₹3,000
Bank ₹3,000
```

**Acceptance:**

```text
Paid = ₹10,000
Remaining = ₹0
Status = Paid
```

---

## AC-EXP-03 — Partial Payment

**Acceptance:**

If:

```text
Expense = ₹10,000
Payment = ₹4,000
```

Then:

```text
Paid = ₹4,000
Remaining = ₹6,000
Status = Partially Paid
```

---

## AC-EXP-04 — Payment Cannot Exceed Expense

**Acceptance:**

```text
Payment total > expense amount
→ rejected
```

---

## AC-EXP-05 — Payment Proof

**Acceptance:**

- [ ] Payment proof is attached before payment reaches Paid state.
- [ ] Payment proof is private.
- [ ] Unauthorized users cannot access it.

---

## AC-EXP-06 — Expense Cancellation

**Acceptance:**

- [ ] Only permitted states can be cancelled.
- [ ] Required cancellation reason is captured.
- [ ] Financial state remains consistent.

---

## AC-EXP-07 — Expense Amount Correction

**Acceptance:**

- [ ] Authorized correction works.
- [ ] New amount cannot be less than valid payments.
- [ ] Reason is mandatory.
- [ ] Audit context is preserved.

---

# 19. Committee Work Acceptance Criteria

## AC-TASK-01 — Direct Task

**Acceptance:**

- [ ] Authorized President/Secretary can create a task.
- [ ] Responsible member is stored.
- [ ] Priority is stored.
- [ ] Optional deadline works.
- [ ] Related member/meeting/decision can be linked where applicable.

---

## AC-TASK-02 — Open Task

**Acceptance:**

- [ ] Task can be created open for volunteers.
- [ ] Eligible members can see it.
- [ ] Only one member can claim it.
- [ ] Backend enforces atomic claim.

---

## AC-TASK-03 — Task Completion

**Acceptance:**

- [ ] Responsible member can complete the task.
- [ ] Completion timestamp is recorded.
- [ ] Completion note may be added.
- [ ] Completed work remains in history.

---

## AC-TASK-04 — Completed Work Edit

**Acceptance:**

- [ ] Committee Member can edit own completed work where permitted.
- [ ] Unauthorized users cannot edit it.
- [ ] Material edit metadata is recorded where required.

---

## AC-TASK-05 — Completed Work Deletion

**Acceptance:**

```text
Committee Member → Delete completed work
= denied
```

The record remains historical.

---

## AC-TASK-06 — Overdue Task

**Acceptance:**

- [ ] Incomplete task past deadline is shown as overdue.
- [ ] Responsible member receives configured notification.
- [ ] Dashboard/report reflects overdue state.

---

# 20. Meeting Acceptance Criteria

## AC-MTG-01 — Schedule Meeting

**Acceptance:**

- [ ] Authorized user can create meeting.
- [ ] Date/time/location are stored.
- [ ] Agenda can be entered.
- [ ] Invitees can be specified.

---

## AC-MTG-02 — Meeting Attendance

**Acceptance:**

- [ ] Attendance is linked to scheduled meeting.
- [ ] One member/meeting record is enforced.
- [ ] Duplicate attendance is prevented.

---

## AC-MTG-03 — Decision

**Acceptance:**

- [ ] Decision can be recorded.
- [ ] Decision can exist without a task.
- [ ] Decision remains linked to meeting.

---

## AC-MTG-04 — Decision to Follow-Up Task

**Acceptance:**

```text
Meeting
→ Decision
→ Follow-up Task
→ Responsible Member
→ Completion
```

All links remain correct.

---

# 21. Jummah Attendance Acceptance Criteria

## AC-ATT-J-01 — Valid Location

**Given**

An eligible authenticated user is within the configured Masjid attendance radius with acceptable accuracy.

**When**

The user taps Mark Present.

**Then**

Attendance is recorded.

---

## AC-ATT-J-02 — Outside Radius

**Acceptance:**

- [ ] Outside-radius attendance is rejected.
- [ ] User receives clear feedback.
- [ ] No invalid attendance record is created.

---

## AC-ATT-J-03 — Duplicate Friday

**Acceptance:**

- [ ] First valid record succeeds.
- [ ] Second attempt for same member/Friday is rejected/already-recorded.
- [ ] Only one accepted record exists.

---

## AC-ATT-J-04 — Poor GPS Accuracy

**Acceptance:**

- [ ] Poor accuracy is handled according to configured threshold.
- [ ] Attendance is not falsely accepted.

---

## AC-ATT-J-05 — Location Permission Denied

**Acceptance:**

- [ ] Attendance is not falsely recorded.
- [ ] User receives permission guidance.

---

## AC-ATT-J-06 — Offline Attendance

**Acceptance:**

- [ ] Pending attendance can be captured where supported.
- [ ] Pending status is clear.
- [ ] Server remains authoritative.
- [ ] Synchronization validates the record.
- [ ] Duplicate synchronization does not create duplicates.

---

# 22. Meeting Attendance Acceptance Criteria

## AC-ATT-M-01

**Acceptance:**

- [ ] Attendance can be recorded for scheduled meeting.
- [ ] One member/meeting record exists.
- [ ] Unauthorized corrections are denied.
- [ ] Meeting attendance does not use Jummah GPS logic.

---

# 23. Notification Acceptance Criteria

## AC-NOTIF-01 — Correct Recipient

**Acceptance:**

- [ ] Notification goes only to intended recipient(s).
- [ ] Deep link targets correct resource.

---

## AC-NOTIF-02 — Minimal Sensitive Data

**Acceptance:**

Notifications do not expose unnecessary:

```text
Full financial details
Raw GPS coordinates
Private document data
Authentication secrets
```

---

## AC-NOTIF-03 — Delivery Failure

**Acceptance:**

If notification delivery fails:

```text
Business record remains correct.
```

---

# 24. File Acceptance Criteria

## AC-FILE-01 — Supported Files

**Acceptance:**

```text
PDF
JPG
PNG
```

are accepted where the feature permits them.

---

## AC-FILE-02 — Invalid Files

**Acceptance:**

- [ ] Unsupported type rejected.
- [ ] Oversized file rejected.
- [ ] Malformed file safely handled.
- [ ] Filename/path manipulation cannot bypass storage controls.

---

## AC-FILE-03 — Private Access

**Acceptance:**

- [ ] Authorized user can access permitted file.
- [ ] Unauthorized user cannot access it.
- [ ] Raw storage path alone does not grant access.

---

# 25. Reporting Acceptance Criteria

## AC-RPT-01 — Financial Report Accuracy

**Acceptance:**

Report contains, where applicable:

```text
Opening balance
Income/receipts
Donations
Expenses
Payments
Transfers
Adjustments
Closing balance
```

Totals must match authoritative financial data.

---

## AC-RPT-02 — Reporting Periods

**Acceptance:**

- [ ] Daily
- [ ] Monthly
- [ ] Yearly
- [ ] Custom date range

produce correct periods.

---

## AC-RPT-03 — Account-wise Reporting

**Acceptance:**

Account-filtered reports contain only the selected account scope and correct totals.

---

## AC-RPT-04 — Committee Work Report

**Acceptance:**

Report provides factual:

```text
Created
Completed
In Progress
Pending
Overdue
```

No ranking/score is introduced.

---

## AC-RPT-05 — Attendance Report

**Acceptance:**

Report contains:

```text
Jummah attendance
Meeting attendance
```

No removed daily-prayer attendance categories appear.

---

# 26. PDF Acceptance Criteria

## AC-PDF-01

**Acceptance:**

- [ ] PDF generation works.
- [ ] Report title appears.
- [ ] Reporting period appears.
- [ ] Amounts match source data.
- [ ] Page numbers work.
- [ ] Generated timestamp appears.
- [ ] Long reports paginate correctly.
- [ ] Print layout is readable.

---

## AC-PDF-02 — Multilingual PDF

**Acceptance:**

- [ ] English renders correctly.
- [ ] Hindi renders correctly.
- [ ] Kannada renders correctly.
- [ ] Urdu renders correctly with RTL.
- [ ] Required fonts/glyphs display correctly.

---

# 27. Audit Acceptance Criteria

## AC-AUD-01

Material actions are traceable where required:

```text
Payment verification
Contribution change
Referral correction
UPI change
Financial correction
Financial deletion
Role change
Administrative changes
```

---

## AC-AUD-02

**Acceptance:**

Audit information includes, where applicable:

```text
Actor
Role
Action
Entity
Entity ID
Timestamp
Result
Reason
Before/after context
```

---

# 28. Search and Filter Acceptance Criteria

## AC-SEARCH-01

**Acceptance:**

- [ ] Search returns only authorized records.
- [ ] Filters work correctly.
- [ ] Unauthorized records do not leak through search.

---

# 29. Export Acceptance Criteria

## AC-EXPORT-01

**Acceptance:**

- [ ] Export respects authorization.
- [ ] Export contains only permitted fields/records.
- [ ] Export does not become a security bypass.
- [ ] Sensitive exports are treated as private.

---

# 30. Localization Acceptance Criteria

## AC-I18N-01

V1 language options:

```text
English
Hindi
Kannada
Urdu
```

**Acceptance:**

- [ ] Language can be switched.
- [ ] No logout is required for normal language change.
- [ ] Business data does not change.
- [ ] Core screens are translated.
- [ ] Validation text is translated.
- [ ] Notifications are translated where supported.
- [ ] Reports/PDFs are localized where practical.

---

# 31. RTL Acceptance Criteria

## AC-I18N-02

For Urdu:

- [ ] Application direction changes to RTL.
- [ ] Navigation is usable.
- [ ] Forms are usable.
- [ ] Dialogs are usable.
- [ ] Tables remain readable.
- [ ] Mixed numbers/references remain readable.
- [ ] PDF output is correct.

---

# 32. Accessibility Acceptance Criteria

## AC-A11Y-01

**Acceptance:**

- [ ] Core web flows work by keyboard.
- [ ] Focus is visible.
- [ ] Controls have accessible names.
- [ ] Form errors are understandable.
- [ ] Core mobile controls are touch-friendly.
- [ ] Screen-reader semantics are present where applicable.

---

# 33. Responsive Acceptance Criteria

## AC-UI-01

Core screens must work on:

```text
Mobile
Tablet
Desktop
Large desktop
```

No critical workflow should depend on a single screen size.

---

# 34. Performance Acceptance Criteria

## AC-PERF-01

Test representative synthetic data.

**Acceptance:**

- [ ] Dashboard loads within agreed practical threshold.
- [ ] Lists paginate correctly.
- [ ] Search/filter remains usable.
- [ ] Large reports complete without timeout under normal expected use.
- [ ] UI does not freeze during ordinary operations.

Exact thresholds may be finalized during implementation based on realistic device/network targets.

---

# 35. Security Acceptance Criteria

## AC-SEC-01

**Acceptance:**

- [ ] Unauthorized actions are denied.
- [ ] RLS/policies are enabled and tested.
- [ ] Service-role secrets are never exposed to clients.
- [ ] Production uses HTTPS.
- [ ] Sensitive logs do not expose OTPs/tokens/secrets.
- [ ] Private files are protected.
- [ ] Security-sensitive endpoints validate input and authorization.
- [ ] Rate limits exist where required.

---

# 36. Privacy Acceptance Criteria

## AC-PRIV-01

**Acceptance:**

- [ ] Data collection is purpose-limited.
- [ ] Member data is private.
- [ ] Donation data is private.
- [ ] Attendance data is private.
- [ ] GPS is not continuously tracked.
- [ ] Raw GPS is not exposed to normal members.
- [ ] Reports/exports respect privacy boundaries.
- [ ] Real production data is not used casually in development.
- [ ] Historical records are retained where required.

---

# 37. Offline Acceptance Criteria

## AC-OFF-01

V1 offline support is limited.

**Acceptance:**

- [ ] Jummah attendance can support approved offline capture.
- [ ] Pending state is visible.
- [ ] Synchronization is secure.
- [ ] Server remains authoritative.
- [ ] Restricted financial/admin operations do not become unrestricted offline operations.

---

# 38. Data Integrity Acceptance Criteria

## AC-DATA-01

**Acceptance:**

- [ ] Foreign keys maintain valid relationships.
- [ ] Unique constraints prevent defined duplicates.
- [ ] Check constraints reject invalid states.
- [ ] Historical records remain linked correctly.
- [ ] Financial transaction relationships remain consistent.
- [ ] Meeting/decision/task relationships remain consistent.

---

# 39. Concurrency Acceptance Criteria

## AC-CON-01 — Payment

Two concurrent verification attempts result in:

```text
One authoritative verification
```

---

## AC-CON-02 — Task Claim

Two concurrent claims result in:

```text
Exactly one successful claimant
```

---

## AC-CON-03 — Financial Posting

Concurrent financial operations leave:

```text
No duplicate posting
No lost update
No incorrect balance
```

---

# 40. Idempotency Acceptance Criteria

## AC-IDEM-01

Repeat a critical request because of:

```text
double tap
timeout
network retry
app retry
browser retry
```

**Acceptance:**

```text
No duplicate authoritative operation.
```

---

# 41. Shared Laptop Acceptance Criteria

On the dedicated Masjid laptop:

- [ ] Login is straightforward.
- [ ] Logout is obvious.
- [ ] Protected data is not available after logout.
- [ ] Finance tables are usable with mouse/keyboard.
- [ ] Reports are easy to print.
- [ ] Printed reports are readable.

---

# 42. Storage Acceptance Criteria

**Acceptance:**

- [ ] Required financial history is preserved.
- [ ] Required committee work history is preserved.
- [ ] Duplicate files are avoided where practical.
- [ ] Temporary generated reports are not retained unnecessarily.
- [ ] Images/files are optimized where practical.
- [ ] Storage optimization never deletes required business history.

---

# 43. Release Acceptance Criteria

Production release requires:

```text
Authentication = PASS
Authorization = PASS
Database/RLS = PASS
Finance = PASS
Payments = PASS
Expenses = PASS
Tasks = PASS
Meetings = PASS
Attendance = PASS
Reports = PASS
Audit = PASS
Files = PASS
Localization = PASS
Security = PASS
Privacy = PASS
Critical Regression = PASS
Release Smoke = PASS
```

No critical release-blocking defect may remain.

---

# 44. Critical Release Blockers

Release is blocked by any unresolved issue causing:

```text
Unauthorized financial modification
Incorrect account balance
Payment verification bypass
Duplicate verified payment
Privilege escalation
Broken RLS
Unauthorized private-file access
Critical audit failure
Critical attendance integrity failure
Secret exposure
Data-loss risk for required historical records
```

---

# 45. V1 Scope Acceptance

The following must NOT appear as accidental V1 additions:

```text
Multi-Masjid registration/discovery
Public member directory
Public financial dashboard
Donation leaderboard
Committee leaderboard
Performance score
Daily prayer attendance
Continuous GPS tracking
Unrequested asset management
Complex loan/advance workflow
Unrequested public-facing features
```

---

# 46. Product Acceptance Review

Before final approval, stakeholders should verify:

### President

```text
Administrative control
Finance overview
Committee accountability
Reports
Audit
```

### Finance

```text
Payments
Donations
Accounts
Expenses
Transfers
Reports
```

### Secretary

```text
Members
Meetings
Tasks
Attendance
Operational records
```

### Auditor

```text
Financial review
Audit
Reports
Supporting records
```

### Committee Member

```text
Referral
Contribution
Open/assigned work
Completion history
Attendance
```

### Member

```text
Own profile
Monthly payment
Outstanding
Additional donation
Own history
Attendance
```

---

# 47. Final Acceptance Procedure

Recommended sequence:

```text
Requirements Review
        ↓
Feature Demonstration
        ↓
Functional Test
        ↓
Security/Authorization Test
        ↓
Financial Validation
        ↓
Device Testing
        ↓
Localization/RTL Review
        ↓
UAT
        ↓
Regression
        ↓
Release Smoke
        ↓
Final Sign-Off
```

---

# 48. Acceptance Sign-Off

Recommended:

```text
Product Owner: ______________________

President/Administrator: _____________

Finance Validation: _________________

Secretary/Operations: _______________

Auditor Validation: _________________

Technical Validation: _______________

Security Validation: ________________

Mobile Validation: __________________

Date: ______________________________
```

---

# 49. Final Acceptance Invariants

### Invariant 1

A feature is not accepted because the UI appears complete.

### Invariant 2

Backend authorization is mandatory.

### Invariant 3

Financial values must match authoritative records.

### Invariant 4

Expected donation is not verified money.

### Invariant 5

Payment-link opening is not payment verification.

### Invariant 6

Partial monthly payment does not complete a month.

### Invariant 7

Overpayment does not reduce future monthly dues.

### Invariant 8

Internal transfer does not increase overall Masjid funds.

### Invariant 9

Only one open-task claimant can succeed.

### Invariant 10

Jummah attendance is one member per Friday.

### Invariant 11

Meeting attendance is one member per meeting.

### Invariant 12

Committee Members cannot delete completed work.

### Invariant 13

Only President can permanently delete financial transactions.

### Invariant 14

Historical financial and committee-work records remain available according to authorization.

### Invariant 15

Private files require authorized access.

### Invariant 16

Reports and exports cannot bypass authorization.

### Invariant 17

Offline attendance remains server-authoritative.

### Invariant 18

Urdu must operate as RTL.

### Invariant 19

Notifications never become the source of business truth.

### Invariant 20

V1 does not introduce rankings or leaderboards.

---

# 50. Acceptance Criteria Completion Rule

Masjid-e-Mamoor 2 V1 is considered accepted only when:

```text
All critical acceptance criteria
+
Critical security tests
+
Financial validation
+
Required UAT
+
Release checks
```

have passed and the responsible stakeholders have completed sign-off.

---

# 51. Related Documents

- `PRODUCT_REQUIREMENTS.md`
- `FEATURE_SCOPE.md`
- `USER_ROLES_PERMISSIONS.md`
- `DEVELOPMENT_ROADMAP.md`
- `SCREEN_SPECIFICATIONS.md`
- `AUTHORIZATION_MODEL.md`
- `SECURITY_REQUIREMENTS.md`
- `SECURITY_CHECKLIST.md`
- `DATA_PRIVACY.md`
- `TESTING_STRATEGY.md`
- `TEST_PLAN.md`
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

**Acceptance Criteria — V1 Product Acceptance Baseline**

This document defines the conditions under which Masjid-e-Mamoor 2 V1 can be considered functionally, operationally, financially, and technically accepted.
