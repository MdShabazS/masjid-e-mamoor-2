# Masjid-e-Mamoor 2 — Product Requirements Specification

**Document Status:** Baseline  
**Version:** 1.0  
**Product:** Masjid-e-Mamoor 2 Internal Management Application  
**Scope:** V1  
**Last Updated:** 2026-09-17

---

## 1. Purpose

This document defines the functional requirements for the Masjid-e-Mamoor 2 application.

It describes what the application must do, the expected workflows, business rules, data requirements, and acceptance criteria.

This document does not prescribe the final technology stack. Technology choices must be documented separately after technical research.

---

# 2. Product Scope

The application is a private internal management system for Masjid-e-Mamoor 2.

The V1 product focuses on:

1. Member management
2. Committee referrals
3. Monthly donation management
4. UPI payment workflow
5. Finance and accounting
6. Expense management
7. Financial audit and reporting
8. Committee work/task management
9. Meeting management
10. Jummah attendance
11. Scheduled meeting attendance
12. Notifications
13. Role-based access
14. Audit logging
15. Multilingual support

The V1 application is not a generic multi-Masjid SaaS product.

---

# 3. User Types

The application supports the following roles:

- President
- Vice President
- Secretary
- Finance / Financer
- Auditor
- Committee Member
- Member

Detailed permissions are defined in `USER_ROLES_PERMISSIONS.md`.

---

# 4. Authentication Requirements

## 4.1 Login

Users authenticate using:

```text
Mobile Number
      ↓
OTP
      ↓
Authenticated Session
      ↓
Role-based Application Access
```

## 4.2 Requirements

The system must:

- Accept a registered mobile number.
- Send/validate an OTP through the selected authentication provider.
- Create a secure authenticated session.
- Identify the user's role.
- Prevent unauthorized access to role-specific functions.
- Support secure logout.

## 4.3 Member Registration

A new member can be created through the committee referral workflow.

The referred person becomes a registered Masjid member without requiring President approval.

---

# 5. Member Management

## 5.1 Member Registration

A Committee Member can register a new member using:

- Full name
- Mobile number
- Agreed monthly donation amount
- Referring Committee Member

Additional profile information may be added where required by the final UI/data design.

## 5.2 Duplicate Prevention

Mobile number is the primary uniqueness check.

If the mobile number already exists:

```text
New Registration
      ↓
Mobile Number Check
      ↓
Existing Member Found
      ↓
Do NOT create duplicate
```

The system must not create duplicate member records for the same mobile number.

## 5.3 Referral Attribution

Each member has one primary referring Committee Member.

The referral relationship must be retained.

President can correct referral attribution.

A correction must record:

- Previous referrer
- New referrer
- Changed by
- Timestamp
- Reason where required by audit policy

## 5.4 Member Access

A registered member can use the application according to the permissions defined for the Member role.

The initial member-facing focus is donation-related functionality.

---

# 6. Monthly Donation Management

## 6.1 Agreed Monthly Amount

The monthly donation amount is an amount mutually agreed between the Committee Member and the member.

It is not a target or quota.

Authorized users who can enter/change the amount:

- Committee Member
- President
- Secretary
- Finance

The member cannot directly change their fixed monthly amount.

## 6.2 Effective Date

A change to the monthly amount must specify the effective month.

Example:

```text
July: ₹500
August: ₹500
September: ₹700  ← new amount becomes effective
```

Previous records remain unchanged.

## 6.3 Monthly Records

The system maintains a separate record for each applicable month.

Example:

```text
July      ₹500  Paid
August    ₹500  Pending
September ₹500  Due
```

The next monthly record is generated automatically according to the configured monthly cycle.

## 6.4 Missed Payments

If a member does not pay a monthly donation:

- The month's record remains in the system.
- Status remains pending/outstanding as appropriate.
- The next month is created independently.
- Outstanding amount can be calculated.
- Historical unpaid records are never deleted.

## 6.5 Payment Reminder

The system should send a reminder for a pending/missed monthly payment.

Intended delivery channels:

- App push
- SMS/WhatsApp where the required service is available

Notification delivery does not determine financial status.

---

# 7. Monthly Payment Link

## 7.1 Automatic Generation

After:

1. Member is registered.
2. Details are confirmed.
3. Monthly donation amount is confirmed.

The system automatically generates the applicable payment link.

## 7.2 Payment Link Delivery

The system is intended to deliver the link through:

- App push
- SMS/WhatsApp where available

## 7.3 UPI Destination

The payment link uses the Masjid's configured active UPI ID.

V1 supports:

- One active UPI ID
- Finance can configure/change the active UPI ID
- New payment links use the current active UPI ID

UPI-ID changes must not alter historical transactions.

## 7.4 Payment Link Amount

For a normal monthly donation, the payment link carries the agreed monthly amount.

For combined outstanding payments, it carries the total of complete outstanding monthly amounts.

## 7.5 Expiry

A monthly payment link expires at the end of the applicable donation month.

An expired link does not delete or close the donation record.

The unpaid donation remains outstanding.

---

# 8. Payment Verification

Payment verification is a critical financial control.

The following are NOT equivalent:

```text
Payment link generated
Payment link delivered
Payment link opened
Payment initiated
Payment received
Payment verified
```

The financial source of truth is the actual transaction verified by Finance.

## 8.1 Verification

Finance checks the Masjid's actual bank/UPI transaction information and verifies the payment.

The system should retain:

- Member
- Applicable donation record(s)
- Amount received
- Payment date
- Payment method
- UPI transaction/reference ID where applicable
- Verified by
- Verification timestamp

Only verified payments contribute to verified donation totals.

---

# 9. Multiple Outstanding Months

Members can pay multiple outstanding complete monthly donations together.

Example:

```text
July       ₹500
August     ₹500
September  ₹500
----------------
Outstanding ₹1,500
```

The system can generate one combined payment link for ₹1,500.

## 9.1 Allocation Rule

Payments are allocated using FIFO:

```text
Oldest unpaid month
        ↓
Next unpaid month
        ↓
Next unpaid month
```

This preserves a clear month-by-month history.

---

# 10. Partial Monthly Payments

A monthly donation must be paid in full.

Example:

```text
Monthly amount = ₹500
Payment        = ₹300
```

The ₹300 does not complete the ₹500 monthly donation.

V1 does not treat a partially paid monthly donation as a completed monthly contribution.

---

# 11. Overpayment

If the member pays more than the applicable outstanding amount, the full payment is accepted.

Example:

```text
Outstanding = ₹1,000
Received    = ₹1,200

₹1,000 → settles outstanding dues
₹200    → Additional General Donation
```

The additional amount:

- Is recorded separately as additional voluntary contribution.
- Does not reduce future monthly dues.
- Is included in the member's verified donation history.
- Is included in the referring Committee Member's verified contribution where referral attribution applies.

---

# 12. Additional Voluntary Donations

A registered member can initiate an additional donation.

Flow:

```text
Member
  ↓
Enter Amount
  ↓
General Donation
  ↓
UPI Payment
  ↓
Finance Verification
  ↓
Verified Donation
```

## 12.1 Category

V1 uses one category:

**General Donation**

The member does not select a purpose/category.

## 12.2 Monthly Amount Independence

Additional donations do not:

- Change the agreed monthly amount.
- Reduce future monthly dues.
- Advance future monthly dues.

---

# 13. Anonymous Donations

Finance can record donations where the donor does not want their identity stored.

Example:

```text
Donor: Anonymous
Amount: ₹2,000
Method: Cash
Verified by: Finance
```

Anonymous donations:

- Are included in financial records.
- Are included in audit/report totals.
- Do not require a member account.
- Are not automatically attributed to a Committee Member.

---

# 14. Jummah Cash Collection

Jummah cash collection is recorded as a collection total rather than individual donor records.

Example:

```text
Friday
Jummah Cash Collection
Amount: ₹18,500
Account: Cash
```

Authorized users:

- Finance
- President
- Secretary

The record must be included in financial accounting and audit reporting.

Individual donor details are not required for the Jummah collection record.

---

# 15. Referral Contribution Tracking

The application must distinguish between:

### Referral count

How many members a Committee Member referred.

### Verified contribution

How much money has actually been verified through those referred members.

Example:

```text
Committee Member A

Members Referred: 20
Verified Donations: ₹75,000
```

Unverified payments must not be counted as verified contribution.

There are no:

- Donation targets
- Leaderboards
- Rankings
- Performance scores

The system presents factual contribution history.

---

# 16. Committee Work Management

Committee work is a core product module.

## 16.1 Task Creation

President and Secretary can create tasks.

A task may contain:

- Title
- Description
- Responsible member
- Priority
- Deadline
- Related member/referral where applicable
- Progress updates
- Attachments where applicable
- Completion date
- Completion note

## 16.2 Assignment

A task can be:

### Directly assigned

A specific eligible Committee Member is responsible.

### Open/Volunteer Task

The task is available for eligible Committee Members to claim.

Only one member can successfully claim an open task.

The backend must enforce this atomically.

## 16.3 Task Lifecycle

```text
Created
   ↓
Assigned / Claimed
   ↓
In Progress
   ↓
Completed
```

A task may also become:

```text
Overdue
```

when its deadline passes while it remains incomplete.

## 16.4 Overdue Notification

The responsible member receives an overdue notification.

President/Secretary do not require automatic overdue notifications; overdue work remains visible on their dashboards.

## 16.5 Completion

Committee Members can mark their assigned/claimed work as completed.

President approval is not required for normal task completion.

## 16.6 Completed Work History

Completed work records are permanent.

Committee Members cannot delete completed work records.

Committee Members can edit their own completed work records.

Edits must record:

- Who edited
- When edited

---

# 17. Committee Progress Dashboard

President and Secretary can view committee-level progress.

The dashboard should include factual operational information such as:

## Current Work

- Total tasks
- Completed
- In progress
- Pending
- Overdue

## Accountability

- Work by responsible member
- Open/unassigned tasks
- Overdue work
- Upcoming deadlines

## Progress

- Tasks created
- Tasks completed
- Monthly completion trend
- Average completion time

## Member Drill-down

Authorized users can view:

- Assigned work
- Completed work
- Pending work
- Overdue work
- Historical work records
- Relevant meeting participation

No artificial performance score is required.

---

# 18. Meeting Management

## 18.1 Meeting Creation

A scheduled meeting can contain:

- Title
- Date/time
- Location
- Agenda
- Invited members

## 18.2 Meeting Attendance

Attendance is recorded specifically for scheduled committee meetings.

## 18.3 Decisions

Meeting records can contain:

- Decisions
- Minutes
- Follow-up requirements

A decision may exist without creating a task.

## 18.4 Decision-to-Task Workflow

When a decision requires work:

```text
Meeting
   ↓
Decision
   ↓
Task
   ↓
Responsible Member
   ↓
Completion
```

This provides a traceable accountability chain.

## 18.5 Meeting History

Meeting records are retained as historical records.

---

# 19. Attendance Requirements

V1 attendance is intentionally limited to:

1. Jummah prayer attendance
2. Scheduled committee meeting attendance

## 19.1 Jummah Attendance

The system should support:

- Member marks present
- GPS validation
- Configurable Masjid attendance radius
- One record per member per Friday
- Attendance history
- Aggregate attendance information

No checkout is required.

## 19.2 Meeting Attendance

For a scheduled meeting:

- Invited members are recorded.
- Attendance is recorded for that meeting.
- Individual attendance history is retained.
- Aggregate attendance information is available to authorized users.

## 19.3 Duplicate Prevention

Backend must prevent duplicate attendance for:

```text
Same member + same Jummah date
```

and:

```text
Same member + same meeting
```

## 19.4 Offline Attendance

V1 supports offline attendance capture.

Attendance can be stored locally and synchronized when connectivity returns.

Server-side validation remains authoritative.

---

# 20. Finance and Account Management

The financial system must support multiple Masjid accounts.

Examples:

- Cash
- Bank account
- UPI/payment account
- Other legitimate account

Each account has its own balance.

## 20.1 Opening Balance

Each account can have an opening balance.

## 20.2 Transactions

The system should support:

- Income
- Donations
- Collections
- Expenses
- Payments
- Internal transfers
- Legitimate adjustments

## 20.3 Historical Dates

The system can support valid past or future transaction dates where operationally required.

Balances must remain consistent with recorded transactions.

## 20.4 Negative Balance

Negative balances may be allowed with an appropriate warning rather than silently preventing legitimate record entry.

## 20.5 Closed Accounts

Accounts can be deactivated/closed.

Historical transactions remain available.

Accounts are not hard-deleted when historical records depend on them.

---

# 21. Internal Transfers

Transfers between Masjid accounts must be represented as linked transfer records.

Example:

```text
Cash → Bank

Cash: -₹20,000
Bank: +₹20,000

Overall Masjid Funds: unchanged
```

Supported directions include:

- Cash → Bank
- Bank → Cash
- Bank → Bank
- Other legitimate account transfers

A shared Transfer ID links the two sides.

---

# 22. Expense Management

Finance is the operational controller for expenses.

## 22.1 Expense Creation

Finance adds:

- Expense amount
- Category
- Date
- Description/details
- Account/payment information
- Supporting bill

## 22.2 Bill Requirement

A bill is mandatory before an expense can be marked Paid.

Supported bill formats:

- PDF
- JPG
- PNG

## 22.3 Payments

One expense can have multiple payments.

Example:

```text
Expense: ₹10,000

UPI:   ₹4,000
Cash:  ₹3,000
Bank:  ₹3,000
```

The system must prevent recorded payments from exceeding the expense amount.

## 22.4 Payment Proof

Payment proof is mandatory before an expense can be marked Paid.

Supported formats:

- PDF
- JPG
- PNG

Finance can replace/delete payment proof.

When payment proof is deleted, the system records who performed the action and when. A reason may be recorded where applicable.

## 22.5 Expense Status

V1 statuses:

- Added
- Partially Paid
- Paid
- Cancelled

## 22.6 Cancellation

An unpaid expense can be cancelled by Finance.

Cancellation requires a reason.

## 22.7 Expense Amount Correction

If an expense amount needs correction, the same transaction ID is retained.

A correction records:

- Previous amount
- New amount
- Reason
- Changed by
- Timestamp

Example:

```text
Original Expense: ₹10,000
Paid: ₹4,000
Remaining ₹6,000 will not be incurred

Expense amount can be corrected to ₹4,000
with a mandatory reason.
```

---

# 23. Financial Transaction IDs

Every financial transaction receives a unique system-generated transaction ID.

The ID remains associated with the transaction throughout its lifecycle.

Internal transfers use a Transfer ID to link both sides.

Transaction IDs must not be unnecessarily regenerated during normal corrections.

---

# 24. Expense Categories

V1 uses a hybrid category model:

- Small fixed set of system categories
- President can create custom categories

Categories can be deactivated.

Historical transactions retain their original category.

Historical categories are not deleted if doing so would compromise historical records.

---

# 25. Financial Permissions

Detailed role permissions are defined separately.

At minimum:

- Finance manages operational finance.
- President has overall financial administration and deletion authority.
- Auditor can review financial records and audit information.
- Secretary can enter authorized collection records such as Jummah cash collection.
- Unauthorized roles cannot modify financial records.

---

# 26. Financial Deletion

Financial transaction deletion is restricted to the President.

Deletion is permanent from the operational ledger.

Deleting a transaction must trigger correct recalculation of affected balances and dependent reporting.

The system must protect against accidental deletion through appropriate confirmation controls.

---

# 27. Financial Audit and Reporting

The application must generate financial reports for:

- Daily periods
- Monthly periods
- Yearly periods
- Custom date ranges

Reports should support relevant filters such as:

- Account
- Date
- Income/credit
- Expense/debit
- Amount
- Payment method
- Category
- Transaction/reference ID

## 27.1 Audit Structure

The financial reporting model should expose:

```text
Opening Balance
+
Income / Receipts
+
Donations / Collections
-
Expenses / Payments
+
/- Legitimate Adjustments
=
Closing / Current Balance
```

Internal transfers should not artificially increase or decrease total Masjid funds.

## 27.2 PDF Reports

The application should provide professional downloadable/printable financial reports.

Reports should support, where appropriate:

- Reporting period
- Account information
- Income
- Expenses
- Transactions
- Balances
- Supporting references
- Generation timestamp
- Page numbers
- Signature/approval areas where appropriate

---

# 28. Activity Audit Log

The system must maintain an audit log for important state-changing events.

Examples:

- User/role changes
- Financial transaction creation
- Financial transaction edits
- Financial transaction deletion
- Expense/payment actions
- Attendance corrections
- Important Masjid setting changes
- Important authentication/security events

Minimum useful information:

```text
Timestamp
User ID
Action
Affected Record ID
Result
```

The system should not log every page view, dashboard opening, click, or notification view.

Technical logs may use separate retention policies.

---

# 29. Notifications

Notifications are event-based.

Potential V1 events include:

- Payment link generated
- Donation verification
- Pending donation reminder
- Task assignment
- Task deadline
- Task overdue
- Task completion
- Meeting reminder
- Expense added
- Important financial event
- Important administrative/security event

The system should not depend on notification delivery for core business state.

---

# 30. Data Privacy and Security Requirements

The system must protect:

- Member personal information
- Mobile numbers
- Financial information
- Transaction references
- Bills and payment proofs
- Committee work records
- Attendance records
- Audit information

Access must be role-based.

Sensitive information should not be unnecessarily exposed through notifications.

Detailed security architecture will be defined separately.

---

# 31. Internationalization

V1 target languages:

- English
- Hindi
- Kannada
- Urdu

Requirements include:

- Language switching
- Proper translation structure
- Urdu RTL support
- Localized dates/numbers where appropriate
- Notification localization where supported
- Report/PDF localization where practical
- Correct text rendering and fonts

---

# 32. Storage Requirements

The application should minimize infrastructure/storage cost where possible.

However, the following must not be sacrificed for storage optimization:

- Financial history
- Donation history
- Committee work history
- Required audit records

Storage optimization should focus on:

- No duplicate file storage
- Efficient references
- Necessary metadata only
- Appropriate document compression
- Avoiding unnecessary generated-file retention
- Separate retention policy for technical logs

---

# 33. Dashboard Requirements

The application should provide role-appropriate dashboards.

## President

High-level visibility across:

- Members
- Referrals
- Verified donations
- Finance
- Expenses
- Accounts
- Committee work
- Meetings
- Attendance
- Audit information
- Administrative actions

## Secretary

Visibility across:

- Committee work
- Meetings
- Attendance
- Referrals where authorized
- Operational progress
- Relevant member information

No financial control beyond explicitly authorized operations.

## Finance

Focus on:

- Donations
- Payment verification
- UPI configuration
- Accounts
- Expenses
- Payments
- Financial reports
- Supporting documents

## Auditor

Focus on:

- Financial records
- Reports
- Audit trail
- Historical financial information

No transaction creation/editing/deletion authority.

## Committee Member

Focus on:

- Referred members
- Donation contribution through referrals
- Assigned/claimed work
- Work history
- Meetings
- Attendance

## Member

Focus initially on:

- Personal profile
- Monthly donation status
- Payment links
- Outstanding donations
- Additional donations
- Donation history
- Personal attendance where applicable

---

# 34. Core Data Relationships

At a conceptual level:

```text
User
 │
 ├── Role
 │
 └── Member Profile
        │
        ├── Referred By → Committee Member
        │
        └── Donation Records
                  │
                  └── Financial Transaction
```

Committee:

```text
Committee Member
      │
      ├── Referrals
      │
      ├── Tasks
      │
      ├── Work History
      │
      └── Meeting Attendance
```

Finance:

```text
Account
  │
  ├── Income
  ├── Donations
  ├── Collections
  ├── Expenses
  ├── Payments
  └── Transfers
```

Meetings:

```text
Meeting
  │
  ├── Attendance
  │
  └── Decisions
          │
          └── Optional Tasks
```

---

# 35. Non-Functional Requirements

The application should be designed for:

## Reliability

Financial and accountability records must remain consistent.

## Security

Unauthorized users must not access restricted functions or records.

## Auditability

Important state-changing operations must be traceable.

## Performance

Common dashboard and record operations should remain responsive under the expected Masjid user load.

## Scalability

The architecture should allow future growth without requiring a complete rewrite.

## Cost Efficiency

V1 should prioritize free/low-cost infrastructure where technically and operationally appropriate.

## Maintainability

Code and architecture should be modular and documented.

## Availability

The application should remain usable under normal network interruptions where offline functionality is explicitly supported.

---

# 36. V1 Explicit Exclusions

The following are not part of V1:

- Multi-Masjid registration
- Public Masjid discovery
- Public community platform
- Daily attendance for Fajr, Zohr, Asr, Maghrib, Isha
- Prayer-by-prayer attendance
- Donation targets
- Donation leaderboards
- Committee ranking
- Committee performance scores
- Asset/property management
- Staff/Volunteer role
- Read-only role
- Custom permission profiles
- Bank reconciliation
- Formal financial month locking
- Advances
- Complex notification inbox/history
- Unnecessary feature expansion

---

# 37. Acceptance Criteria

The V1 system should satisfy the following end-to-end scenarios.

## Scenario 1 — New Member Referral

```text
Committee Member
→ Enter name/mobile
→ Duplicate check
→ New member created
→ Referrer recorded
→ Monthly amount confirmed
→ Payment link generated
```

Expected result:

A unique member record exists with correct referral attribution and monthly amount.

---

## Scenario 2 — Duplicate Referral

```text
Committee Member
→ Enter existing mobile number
```

Expected result:

No duplicate member is created.

---

## Scenario 3 — Monthly Donation

```text
Payment link
→ Member pays
→ Finance verifies actual transaction
→ Reference ID recorded
→ Donation marked verified
```

Expected result:

Donation appears in member history, financial records, and applicable referral contribution.

---

## Scenario 4 — Outstanding Donations

```text
Multiple unpaid months
→ Combined payment link
→ Member pays complete amount
→ Finance verifies
→ FIFO allocation
```

Expected result:

Oldest complete monthly records are settled first.

---

## Scenario 5 — Overpayment

```text
Outstanding = ₹1,000
Payment = ₹1,200
```

Expected result:

₹1,000 settles outstanding dues and ₹200 is recorded as additional General Donation.

---

## Scenario 6 — Committee Work

```text
Task created
→ Assigned/claimed
→ Work performed
→ Completed
→ Permanent history
```

Expected result:

The work remains available in the member's historical record.

---

## Scenario 7 — Meeting Accountability

```text
Meeting
→ Decision
→ Optional Task
→ Responsible Member
→ Completion
```

Expected result:

The system can trace the decision to the resulting work.

---

## Scenario 8 — Jummah Attendance

```text
Member
→ Mark Jummah Present
→ GPS validation
→ Attendance stored
```

Expected result:

One valid Jummah attendance record exists for that member/date.

---

## Scenario 9 — Expense

```text
Finance adds expense
→ Bill uploaded
→ Payment recorded
→ Payment proof uploaded
→ Paid
```

Expected result:

Expense and supporting records appear in the financial ledger and audit/reporting system.

---

## Scenario 10 — Financial Audit

```text
Transactions
→ Ledger
→ Account balances
→ Reporting period
→ Audit report
→ PDF
```

Expected result:

The report accurately represents recorded financial activity and balances.

---

# 38. Requirements Change Rule

Any change affecting:

- Financial behavior
- Donation attribution
- Permissions
- Security
- Auditability
- Permanent history
- Core workflows

must be documented before implementation.

This document must be updated when an approved product requirement changes.

---

# 39. Implementation Rule

No production feature should be implemented solely from informal conversation.

Before implementation, the relevant requirement must exist in the project documentation.

The implementation must then be validated against the documented acceptance criteria.

---

# 40. Related Documents

This document should be used together with:

- `PROJECT_OVERVIEW.md`
- `FEATURE_SCOPE.md`
- `USER_ROLES_PERMISSIONS.md`
- `SYSTEM_ARCHITECTURE.md`
- `DATABASE_ARCHITECTURE.md`
- `SECURITY_ARCHITECTURE.md`
- `TECHNOLOGY_STACK.md`
- Feature-specific specifications
- `TEST_PLAN.md`
- `ACCEPTANCE_CRITERIA.md`
- `DEVELOPMENT_TASKS.md`

---

## Document Status

**Product Requirements Specification — V1 Baseline**

This document defines the current functional requirements and should be treated as a controlled project document.
