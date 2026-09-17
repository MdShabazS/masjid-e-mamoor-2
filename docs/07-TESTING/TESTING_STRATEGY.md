# Masjid-e-Mamoor 2 — Testing Strategy

**Document Status:** V1 Testing Baseline  
**Version:** 1.0  
**Product:** Masjid-e-Mamoor 2 Internal Management Application  
**Scope:** V1  
**Platforms:** Web, Android, iOS  
**Related Documents:** TEST_PLAN.md, ACCEPTANCE_CRITERIA.md, SECURITY_REQUIREMENTS.md, AUTHORIZATION_MODEL.md, SCREEN_SPECIFICATIONS.md, DATABASE_SCHEMA.md  
**Last Updated:** 2026-09-17

---

# 1. Purpose

This document defines the overall testing strategy for Masjid-e-Mamoor 2.

The application handles:

```text
Member records
Attendance
Tasks
Meetings
Donations
Payments
Accounts
Expenses
Transfers
Reports
Audit records
Private documents
Notifications
```

Testing therefore focuses on both:

```text
Functional correctness
+
Data/security/integrity correctness
```

---

# 2. Testing Principles

1. Test business rules, not only UI behavior.
2. Test both successful and rejected operations.
3. Test frontend and backend independently.
4. Test authorization at the server/database boundary.
5. Test financial calculations with exact expected values.
6. Test concurrency and duplicate requests.
7. Test real mobile/device behavior for GPS, push, offline, and UPI.
8. Test multilingual and RTL behavior.
9. Never consider UI success proof of backend correctness.
10. Production readiness requires critical tests to pass.

---

# 3. Testing Pyramid

Recommended test layers:

```text
                    E2E / Device
                 -------------------
                 Integration Tests
              -------------------------
              API / RLS / Data Tests
          -------------------------------
             Unit / Component Tests
        ------------------------------------
```

Most tests should be lower-level and fast.

Critical workflows additionally require end-to-end validation.

---

# 4. Test Levels

V1 testing includes:

```text
Unit
Component
Integration
API
Database/RLS
End-to-End
Mobile Device
Manual Exploratory
Security
Performance
Localization
Accessibility
Regression
Release/Smoke
```

---

# 5. Unit Testing

Unit tests verify isolated business logic.

Priority areas:

```text
Donation allocation
FIFO outstanding allocation
Overpayment calculation
Expense balance calculation
Account balance calculation
Transfer calculations
Task status logic
Overdue detection
Attendance duplicate rules
Date/effective-month logic
Currency formatting
Localization helpers
Permission helpers
```

---

# 6. Component Testing

Frontend components should be tested for:

```text
Rendering
Validation
User interaction
Loading states
Empty states
Error states
Permission visibility
Responsive variants
Accessibility labels
```

Reusable components should receive focused coverage.

Examples:

```text
AmountDisplay
StatusBadge
DataTable
FileUpload
ConfirmDialog
TaskCard
AccountBalanceCard
```

---

# 7. Integration Testing

Integration tests verify multiple layers together.

Examples:

```text
UI → API → Database
API → RLS
Payment verification → Donation → Financial transaction
Expense payment → Account balance → Expense status
Task claim → Assignment → Completion
Meeting → Decision → Follow-up task
Jummah attendance → server validation → attendance record
```

---

# 8. API Testing

Every sensitive API should have positive and negative tests.

Test:

```text
Valid request
Invalid input
Unauthorized role
Unauthorized record
Invalid state
Duplicate request
Concurrent request
Network retry
Missing required data
Malformed payload
```

---

# 9. Database Testing

Database tests should validate:

```text
Constraints
Foreign keys
Unique constraints
Check constraints
Triggers/functions where used
Transactions
RLS policies
Indexes
Data relationships
```

---

# 10. RLS Testing

RLS tests are mandatory for protected tables.

For every important resource, test:

```text
President
Vice President
Secretary
Finance
Auditor
Committee Member
Member
Unauthenticated
Disabled user
```

Test both:

```text
SELECT
INSERT
UPDATE
DELETE
```

where relevant.

---

# 11. Authorization Test Matrix

Every sensitive action must be tested against:

```text
Allowed role → succeeds
Disallowed role → denied
Unauthenticated → denied
Disabled user → denied
Modified client request → denied
Wrong record → denied
Invalid record state → denied
```

---

# 12. Financial Testing Priority

Financial workflows are highest priority.

Critical finance tests include:

```text
Account balance
Income
Expense
Payment
Transfer
Donation verification
Combined outstanding payment
Overpayment
Correction
Deletion
Cancellation
Concurrent operations
```

---

# 13. Financial Numeric Testing

Use exact expected values.

Examples:

```text
₹35,000 + ₹1,80,000 + ₹35,000 = ₹2,50,000
```

Test:

```text
Whole amounts
Large amounts
Zero where allowed
Decimal values if supported
Rounding behavior
Negative balances
```

Do not use floating-point assumptions in expected financial results when exact decimal behavior is required.

---

# 14. Account Balance Tests

For each account:

```text
Opening balance
+
Credits
-
Debits
+
/-
Transfers as applicable
=
Calculated balance
```

Test both:

```text
Normal balance
Negative balance
Past-dated transaction
Future-dated transaction
Deletion
Correction
Concurrent transaction
```

Verify the V1 rule that balance changes immediately when a transaction is entered, regardless of transaction date.

---

# 15. Internal Transfer Tests

Example:

```text
Cash → Bank
```

Verify:

```text
Cash decreases
Bank increases
Overall Masjid funds unchanged
Same Transfer ID links both sides
```

Also test:

```text
Bank → Cash
Bank → Bank
```

and repeated/concurrent attempts.

---

# 16. Donation Test Suite

### Monthly donation

Test:

```text
Expected created
Paid
Pending
Missed
Outstanding
New month generated
Contribution amount changed from effective month
Historical months preserved
```

### Combined outstanding

Example:

```text
July ₹500
August ₹500
September ₹500

Payment ₹1500
```

Expected:

```text
July settled
August settled
September settled
```

### Partial payment

Example:

```text
Due ₹500
Paid ₹300
```

Expected:

```text
Month not marked complete
```

### Overpayment

Example:

```text
Outstanding ₹1000
Payment ₹1200
```

Expected:

```text
₹1000 settles outstanding
₹200 General Donation
Future monthly dues unchanged
```

---

# 17. Payment Verification Test Suite

Test lifecycle:

```text
Payment request created
→ payment initiated
→ payment link opened
→ reference/evidence available
→ Finance verifies
→ authoritative financial posting
```

Verify:

```text
Opening payment link does not verify.
Unauthorized role cannot verify.
Duplicate verification does not duplicate money.
Rejected payment does not post as verified income.
```

---

# 18. UPI Test Suite

Test:

```text
Active UPI configured
UPI changed by Finance
New payment request uses new UPI
Historical records unchanged
Unauthorized UPI change denied
UPI configuration change audited
```

---

# 19. Expense Test Suite

Test:

```text
Expense created
Bill uploaded
Partial payment
Multiple payments
Payment proof
Fully paid
Cancellation
Amount correction
Payment proof replacement
Payment proof deletion where permitted
```

Critical example:

```text
Expense ₹10,000
UPI ₹4,000
Cash ₹3,000
Bank ₹3,000
```

Expected:

```text
Paid = ₹10,000
Remaining = ₹0
Status = Paid
```

Also test:

```text
Payments > expense amount
```

Expected:

```text
Rejected
```

---

# 20. Expense Correction Tests

Example:

```text
Expense originally ₹10,000
Payment made ₹4,000
Remaining ₹6,000 will not happen
```

Test correction:

```text
New expense amount = ₹4,000
```

Verify:

```text
Correction allowed only to authorized role
Reason required
Same transaction/expense identity retained where specified
Audit context recorded
Remaining = ₹0
```

---

# 21. Financial Deletion Tests

President only:

```text
Delete valid transaction
```

Verify:

```text
Authorization
Confirmation
Record deletion
Related data consistency
Balance recalculation
Audit event
```

Test unauthorized attempts by:

```text
Finance
Auditor
Secretary
Committee Member
Member
```

All must fail.

---

# 22. Financial Correction Tests

Test:

```text
Correct amount
Correct date where permitted
Correct category where permitted
Correct reference where permitted
Invalid correction
Missing reason
Unauthorized correction
Concurrent correction
```

Verify audit behavior.

---

# 23. Membership Test Suite

Test:

```text
New referral
Duplicate mobile
Existing member
Primary referrer
Contribution amount
Effective month
Member profile update
Referral correction
```

Critical invariant:

```text
Existing mobile → no duplicate member
```

---

# 24. Referral Attribution Tests

Test:

```text
Correct attribution
President correction
Unauthorized correction
Missing reason
Historical attribution
Contribution reporting after correction
```

Verify actor/time audit information where required.

---

# 25. Contribution Change Tests

Test:

```text
Committee Member changes amount
Secretary changes amount
Finance changes amount
President changes amount
Member attempts change
Effective month selected
Historical record preservation
```

Example:

```text
July ₹500
August ₹500
Change to ₹700 effective September
```

Expected:

```text
July = ₹500
August = ₹500
September onward = ₹700
```

---

# 26. Committee Task Test Suite

Test:

```text
Direct assignment
Open task
Claim
Start
Progress update
Complete
Edit completed work
Overdue state
```

---

# 27. Task Concurrency Tests

Two users attempt to claim one open task simultaneously.

Expected:

```text
Exactly one successful claimant.
```

Test repeated requests from the same user as well.

---

# 28. Completed Work Tests

Verify:

```text
Completed record remains visible in history
Committee Member can edit own completed work where allowed
Committee Member cannot delete completed work
Unauthorized users cannot modify it
Material changes are auditable
```

---

# 29. Meeting Test Suite

Test:

```text
Create
Edit
Schedule
Reschedule
Cancel
Attendance
Decision
Follow-up task
Completion status
Historical access
```

---

# 30. Meeting Accountability Chain Tests

Verify:

```text
Meeting
→ Decision
→ Follow-up Task
→ Responsible Member
→ Status
→ Completion
```

Also test:

```text
Decision with no task
```

Expected:

```text
Valid
```

---

# 31. Attendance Test Suite

## Jummah

Test:

```text
Valid location
Outside radius
Poor accuracy
Location permission denied
Duplicate attendance
Offline attendance
Sync success
Sync failure
Retry
Already recorded
```

## Meeting

Test:

```text
Scheduled meeting
Eligible member
Duplicate attendance
Unauthorized correction
```

---

# 32. GPS Attendance Testing

Physical-device testing is mandatory.

Test:

```text
Inside Masjid radius
Near boundary
Outside radius
Low GPS accuracy
Location disabled
Permission denied
Temporary GPS unavailable
Network unavailable
Network returns
```

Do not rely only on emulator/simulator GPS.

---

# 33. GPS Boundary Testing

Test at:

```text
Inside radius
Exactly/near radius boundary
Just outside radius
```

Verify backend authority.

Do not perform acceptance solely from client-side distance calculations.

---

# 34. Offline Attendance Testing

Scenario:

```text
No network
→ Mark attendance
→ Local pending state
→ Network returns
→ Sync
→ Server validation
→ Accepted/rejected result
```

Test:

```text
Repeated sync
App restart before sync
Device restart before sync
Invalid/expired pending record
Server duplicate
```

---

# 35. Authentication Testing

Test:

```text
Valid OTP
Invalid OTP
Expired OTP
Repeated OTP
Resend
Rate limit
Logout
Session expiry
Disabled account
```

---

# 36. Notification Testing

Test:

```text
Task assignment
Task deadline
Task completion
Meeting reminder
Attendance reminder
Donation/payment status
Expense notification
Security/admin notification
```

Verify:

```text
Correct recipient
Correct deep link
Minimal sensitive content
No duplicate business action
```

---

# 37. SMS/WhatsApp Testing

Where enabled:

```text
Pending monthly reminder
Missed contribution reminder
Payment-link delivery
```

Verify:

```text
Correct recipient
Correct message
Provider failure
Retry behavior
No financial state corruption
```

Provider sandbox/test mode should be used where available.

---

# 38. File Upload Testing

Test:

```text
PDF
JPG
PNG
Unsupported format
Incorrect MIME
Oversized file
Corrupt file
Duplicate file
Slow upload
Interrupted upload
Replacement
Deletion
Unauthorized access
```

---

# 39. File Privacy Testing

Attempt:

```text
Open private file while authorized
Open private file while unauthorized
Use guessed/raw storage path
Reuse expired/private access URL where applicable
```

Expected:

```text
Unauthorized access denied
```

---

# 40. Reporting Testing

Test:

```text
Daily report
Monthly report
Yearly report
Custom date range
Account-wise report
Income report
Expense report
Transfer report
Donation report
Committee work report
Meeting report
Attendance report
Audit report
```

---

# 41. PDF Testing

Test:

```text
Generate
Preview
Download
Print
Page numbers
Report period
Amounts
Tables
Long datasets
```

Multilingual test:

```text
English
Hindi
Kannada
Urdu
```

Particularly verify Urdu RTL rendering and font support.

---

# 42. Localization Testing

Every V1 language:

```text
English
Hindi
Kannada
Urdu
```

Test:

```text
Navigation
Forms
Validation
Notifications
Statuses
Dates
Numbers
Currency
Reports
PDF
RTL layout
Long translated strings
```

---

# 43. RTL Testing

Urdu must be tested for:

```text
Layout direction
Navigation
Dialogs
Tables
Forms
Icons
Alignment
Text wrapping
Mixed numeric/reference values
PDF output
```

---

# 44. Responsive Testing

Test core screens at:

```text
Mobile
Tablet
Desktop
Large desktop
```

Important workflows:

```text
Login
Dashboard
Members
Donation
Finance
Expense
Tasks
Meetings
Attendance
Reports
```

---

# 45. Accessibility Testing

Test:

```text
Keyboard navigation
Focus order
Visible focus
Labels
Error announcements
Button names
Form instructions
Contrast
Touch targets
Screen reader semantics
```

Web accessibility should be part of CI where practical.

---

# 46. E2E Testing

Web E2E should cover critical business journeys.

Recommended scenarios:

### Journey 1 — Login

```text
Mobile → OTP → Dashboard
```

### Journey 2 — Member Referral

```text
Committee Member → Register Member → Set Contribution → Payment Request
```

### Journey 3 — Donation Verification

```text
Payment → Finance Queue → Verify → Financial Record
```

### Journey 4 — Expense

```text
Finance → Expense → Bill → Payment → Proof → Paid
```

### Journey 5 — Task

```text
President/Secretary → Task → Claim/Assignment → Completion
```

### Journey 6 — Meeting

```text
Meeting → Attendance → Decision → Follow-up → Completion
```

### Journey 7 — Jummah

```text
Member → Location → Mark Present → Server Result
```

### Journey 8 — Financial Report

```text
Finance/President/Auditor → Report → Preview → PDF
```

---

# 47. Mobile Device Testing

At minimum test supported representative devices/OS versions.

Test physical devices for:

```text
OTP
GPS
Push
UPI intent/deep link
Offline storage
Camera/file upload where used
Background/foreground transitions
Poor network
```

Do not treat simulator success as production evidence for GPS/UPI behavior.

---

# 48. UPI Device Testing

Test on real Android devices where possible.

Verify:

```text
UPI app handoff
Amount
Payee
Reference/context
Return path
Payment not falsely marked verified
```

iOS behavior should be evaluated separately because app-to-app payment behavior can differ.

---

# 49. Performance Testing

Focus performance testing on:

```text
Dashboard
Member list
Transaction list
Expense list
Task list
Meeting list
Reports
PDF generation
```

Measure:

```text
Initial load
API response
Large table rendering
Filter/search
Report generation
```

Do not optimize prematurely; protect correctness first.

---

# 50. Large Dataset Testing

Use synthetic data to test scale.

Examples:

```text
Hundreds/thousands of members
Thousands of donations
Thousands of transactions
Large task history
Long audit history
Large report date range
```

Verify:

```text
Correct pagination
Correct totals
No duplicate records
Acceptable response time
```

---

# 51. Security Testing

Security testing must cover:

```text
Authentication
Authorization
RLS
Privilege escalation
IDOR/object access
Input validation
XSS
Injection
File access
Secrets exposure
Session security
Rate limiting
```

---

# 52. Negative Testing

Every important workflow must include invalid cases.

Examples:

```text
Invalid amount
Unauthorized role
Missing file
Wrong state
Duplicate request
Expired session
Out-of-radius location
Already completed task
Already verified payment
```

Expected behavior must be explicitly asserted.

---

# 53. Concurrency Testing

Critical concurrent operations:

```text
Payment verification
Financial transaction creation
Expense payment
Transfers
Task claim
Attendance synchronization
Contribution updates
```

Tests must assert consistent final state.

---

# 54. Idempotency Testing

Repeat the same request:

```text
Immediately
After timeout
After UI retry
After app restart
After network retry
```

Expected:

```text
No duplicate authoritative operation.
```

---

# 55. Regression Testing

Every feature change must run relevant regression tests.

High-risk changes should trigger:

```text
Full finance regression
Authorization regression
Database/RLS regression
Critical E2E regression
```

---

# 56. Smoke Testing

After every deploy, run a small smoke suite:

```text
Login
Dashboard load
Member lookup
Donation/payment flow
Finance page
Task page
Meeting page
Attendance page
Report generation
```

Production smoke tests must be safe and use non-destructive/read-only operations unless a controlled test environment is used.

---

# 57. Test Data Strategy

Use:

```text
Synthetic test users
Synthetic members
Synthetic donations
Synthetic transactions
Synthetic documents
Synthetic attendance
```

Create dedicated test roles:

```text
test-president
test-vp
test-secretary
test-finance
test-auditor
test-committee
test-member
```

Never require real member data to execute normal automated tests.

---

# 58. Test Database Strategy

Prefer isolated test environments/databases.

Do not run destructive automated tests against production.

Database-reset/migration tests should use disposable environments.

---

# 59. Test Fixtures

Fixtures should represent:

```text
Active member
Disabled member
Member with no donations
Member with pending donation
Member with multiple outstanding months
Member with overpayment
Anonymous donation
Expense partially paid
Expense fully paid
Negative account balance
Open task
Claimed task
Completed task
Scheduled meeting
Historical meeting
Jummah attendance
Offline pending attendance
```

---

# 60. Test Naming

Recommended structure:

```text
feature_condition_expectedResult
```

Example:

```text
paymentVerification_duplicateRequest_createsSingleFinancialPosting
taskClaim_twoConcurrentUsers_allowsOneClaim
memberRegistration_existingMobile_doesNotCreateDuplicate
```

---

# 61. Test Traceability

Map important requirements to tests.

Recommended fields:

```text
Requirement ID
Feature
Test Case ID
Test Type
Expected Result
Status
Evidence
```

This can be implemented in `TEST_PLAN.md`.

---

# 62. Defect Severity

### Critical

Examples:

```text
Unauthorized financial modification
Incorrect financial balance
Privilege escalation
Duplicate financial posting
Private-data mass exposure
```

Release blocker.

### High

Examples:

```text
Important business workflow failure
Unauthorized record access
Payment verification inconsistency
Major report discrepancy
```

Must normally be fixed before release.

### Medium

Limited functional/security impact.

### Low

Minor UI/edge-case issue with limited operational effect.

---

# 63. Defect Requirements

Each defect should record:

```text
Summary
Environment
Steps to reproduce
Expected result
Actual result
Severity
Evidence
Related requirement/test
```

---

# 64. CI Testing

CI should run automatically on relevant pull requests.

Recommended sequence:

```text
Install dependencies
→ lint
→ type check
→ unit tests
→ component tests
→ API/integration tests
→ database/RLS tests where configured
→ build
```

Full device/E2E suites may run in dedicated environments where required.

---

# 65. Pre-Merge Requirements

A security-sensitive change should not merge when:

```text
Type check fails
Critical tests fail
Authorization tests fail
RLS tests fail
Financial tests fail
Build fails
```

---

# 66. Staging Testing

Before production:

```text
Run migrations
Run smoke tests
Run authorization matrix
Run critical finance workflows
Run file access tests
Run notification tests
Run E2E
Run localization checks
Run mobile critical-path tests
```

---

# 67. Production Release Testing

Production release should use:

```text
Read-only smoke checks
Safe authentication check
Health checks
Critical configuration verification
```

Do not create real financial/test records in production merely to prove that write workflows work.

---

# 68. Backup and Recovery Testing

Test that:

```text
Backups exist as configured
Recovery procedure is documented
Recovery can restore database consistency
Required files/data relationships remain usable
```

Recovery testing should not use production destructively.

---

# 69. Disaster/Failure Testing

Simulate where practical:

```text
Database unavailable
API unavailable
Storage unavailable
Notification provider unavailable
SMS provider unavailable
Network interruption
Partial upload failure
App crash during offline attendance
```

Expected behavior must preserve business integrity.

---

# 70. Observability During Testing

Use:

```text
Application logs
Server logs
Database logs
Request IDs
Test reports
Screenshots/video where useful
```

Do not log:

```text
OTP
Service secrets
Auth tokens
Unnecessary private financial information
Unnecessary raw GPS data
```

---

# 71. Manual Exploratory Testing

Exploratory testing should be used after automated coverage to discover:

```text
Unexpected navigation
Confusing state transitions
Visual overflow
Localization defects
Unusual user sequences
Poor error handling
Device-specific issues
```

Exploratory testing complements, not replaces, automated tests.

---

# 72. User Acceptance Testing

Internal Masjid stakeholders should validate:

```text
Member referral
Contribution handling
Donation payment flow
Finance verification
Expense workflow
Committee task tracking
Meeting accountability
Jummah attendance
Reports
Audit output
Language options
```

Acceptance must compare behavior against documented requirements.

---

# 73. Financial UAT

Finance workflow must be tested with realistic scenarios such as:

```text
Opening balance
Monthly donations
Additional donation
Anonymous donation
Jummah cash collection
Expense
Partial payment
Multiple payment methods
Transfer
Correction
Report generation
```

All totals should reconcile to expected synthetic values.

---

# 74. Committee UAT

Test:

```text
Referral
Contribution agreement
Open task
Claim
Completion
Completed-work edit
Meeting attendance
Decision
Follow-up
History
```

---

# 75. Member UAT

Test:

```text
Login
Profile
Monthly donation
Outstanding payment
Additional donation
Payment history
Jummah attendance
Own attendance history
```

---

# 76. Localization UAT

Native/qualified reviewers should inspect:

```text
Hindi
Kannada
Urdu
```

especially:

```text
Financial labels
Dates
Validation text
Notifications
PDF reports
RTL layout
```

---

# 77. Test Exit Criteria

V1 feature/release testing may be considered complete when:

- [ ] Critical tests pass.
- [ ] High-priority acceptance tests pass.
- [ ] No unresolved critical defect remains.
- [ ] Authorization tests pass.
- [ ] Financial integrity tests pass.
- [ ] RLS tests pass.
- [ ] File privacy tests pass.
- [ ] Critical E2E flows pass.
- [ ] Mobile critical flows pass.
- [ ] Localization checks pass.
- [ ] Release smoke tests pass.

---

# 78. V1 Critical Test Set

The following should always be included in the release suite:

```text
Authentication
Role authorization
Member duplicate prevention
Contribution effective-month logic
Monthly donation state
Combined outstanding FIFO
Overpayment handling
Payment verification
Financial transaction integrity
Transfer integrity
Expense multi-payment
Expense amount correction
President-only financial deletion
Task claim race
Completed-work protection
Meeting decision → task chain
Jummah GPS validation
Offline attendance sync
Private-file access
Financial report generation
Urdu RTL
Audit logging
```

---

# 79. Security Regression Set

Run after security-sensitive changes:

```text
Role matrix
RLS
Object-level authorization
Private file access
Financial mutation authorization
Service-role boundary
Session expiry
Deep-link authorization
Secrets scan
```

---

# 80. Finance Regression Set

Run after database/finance changes:

```text
Donation
Payment verification
Account balance
Expense
Transfers
Corrections
Deletion
Reports
Audit
```

---

# 81. Database Migration Testing

For every migration:

```text
Apply clean database
Apply migration to existing test database
Verify constraints
Verify RLS
Verify indexes
Verify existing records
Verify rollback/recovery approach where applicable
```

Do not test migrations only against an empty database.

---

# 82. Test Automation Priority

Automate first:

```text
Financial calculations
Authorization
RLS
Donation allocation
Payment verification state
Expense rules
Task claiming
Attendance duplicate rules
Critical APIs
Critical web journeys
```

Manual/device tests remain required for:

```text
GPS behavior
UPI handoff
Push notification behavior
Physical device conditions
Printer/PDF visual validation
```

---

# 83. Quality Gates by Development Phase

### Feature development

```text
Unit + component tests
```

### Integration complete

```text
API + DB/RLS + integration tests
```

### UI complete

```text
E2E + responsive + accessibility
```

### Device-ready

```text
Physical mobile + GPS + UPI + push + offline
```

### Release-ready

```text
Full critical suite + security + regression + smoke
```

---

# 84. Testing Non-Goals for V1

Do not require:

```text
Massive load testing at internet-scale
Advanced chaos engineering platform
Formal external penetration certification
Full automated testing of every visual pixel
100% code coverage
```

Coverage should be risk-based.

---

# 85. Code Coverage Guidance

Coverage is a signal, not the definition of correctness.

Highest coverage expectations should apply to:

```text
Financial calculations
Authorization
Permission logic
State transitions
Data validation
Allocation algorithms
```

A high line-coverage number does not compensate for missing business-rule tests.

---

# 86. Test Environment Matrix

| Area | Local | CI | Staging | Physical Device | Production |
|---|---:|---:|---:|---:|---:|
| Unit | ✓ | ✓ | — | — | — |
| Component | ✓ | ✓ | — | — | — |
| API | ✓ | ✓ | ✓ | — | Safe smoke |
| DB/RLS | ✓ | ✓ | ✓ | — | Verified config |
| Web E2E | ✓ | ✓ | ✓ | — | Safe smoke |
| Mobile UI | Limited | Limited | ✓ | ✓ | Safe smoke |
| GPS | Emulator limited | — | — | ✓ | Safe manual check |
| UPI | Limited | — | ✓ | ✓ | Safe verification |
| Push | Limited | — | ✓ | ✓ | Safe verification |
| Offline | ✓ | ✓ | ✓ | ✓ | Safe smoke |
| Localization | ✓ | ✓ | ✓ | ✓ | Sample check |
| Security | ✓ | ✓ | ✓ | — | Review |
| PDF/Print | ✓ | Limited | ✓ | — | Sample check |

---

# 87. Test Evidence

For critical workflows retain:

```text
Automated test report
CI result
Relevant screenshots
Device test result
Migration result
Security test result
```

Avoid retaining unnecessary real member/financial data as evidence.

---

# 88. Final Testing Workflow

```text
Requirement
    ↓
Acceptance Criteria
    ↓
Test Case
    ↓
Implementation
    ↓
Unit/Component
    ↓
API/DB/RLS
    ↓
Integration
    ↓
E2E/Device
    ↓
Security/Privacy
    ↓
Regression
    ↓
Release Smoke
```

---

# 89. Testing Invariants

### Invariant 1

A passing UI test alone does not prove backend correctness.

### Invariant 2

A passing client permission check does not prove authorization.

### Invariant 3

Financial totals must be verified independently from UI calculations.

### Invariant 4

Payment-link opening must never make a payment verified.

### Invariant 5

Duplicate financial requests must not create duplicate postings.

### Invariant 6

Combined monthly dues must use FIFO allocation.

### Invariant 7

Partial monthly payment must not mark the month complete.

### Invariant 8

Overpayment must not reduce future monthly dues.

### Invariant 9

Internal transfers must leave overall Masjid funds unchanged.

### Invariant 10

Only one open-task claimant can succeed in a race.

### Invariant 11

Offline attendance must remain server-authoritative.

### Invariant 12

Jummah attendance must not become continuous tracking.

### Invariant 13

Private files must remain inaccessible to unauthorized users.

### Invariant 14

Reports and exports must respect authorization.

### Invariant 15

RLS behavior must be tested for every protected role/resource combination.

### Invariant 16

Historical financial and committee-work records must remain intact.

### Invariant 17

Security-sensitive changes require negative tests.

### Invariant 18

Critical production defects block release.

---

# 90. Acceptance Criteria for This Document

The testing strategy is complete when:

- Test levels are defined.
- Unit/component scope is defined.
- API/integration testing is defined.
- Database/RLS testing is defined.
- Authorization testing is defined.
- Financial testing is prioritized.
- Donation/payment testing is defined.
- Expense/transfer testing is defined.
- Committee work and meeting testing is defined.
- GPS/offline testing is defined.
- File/privacy testing is defined.
- Notification testing is defined.
- Localization/RTL testing is defined.
- Accessibility testing is defined.
- E2E journeys are defined.
- Physical-device requirements are defined.
- Security testing is defined.
- Concurrency/idempotency testing is defined.
- CI and release gates are defined.
- UAT is defined.
- Exit criteria are defined.
- Critical regression suites are defined.

---

# 91. Related Documents

- `TEST_PLAN.md`
- `ACCEPTANCE_CRITERIA.md`
- `SECURITY_REQUIREMENTS.md`
- `SECURITY_CHECKLIST.md`
- `AUTHORIZATION_MODEL.md`
- `SECURITY_ARCHITECTURE.md`
- `DATA_PRIVACY.md`
- `AUTHENTICATION.md`
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
- `SCREEN_SPECIFICATIONS.md`
- `STORAGE_STRATEGY.md`
- `BACKUP_AND_RECOVERY.md`
- `MONITORING.md`

---

## Document Status

**Testing Strategy — V1 Testing Baseline**

This document defines how Masjid-e-Mamoor 2 V1 will be validated across functional behavior, financial integrity, security, privacy, reliability, mobile/device behavior, multilingual support, and production readiness.
