# Masjid-e-Mamoor 2 — Feature Scope

**Document Status:** Baseline  
**Version:** 1.0  
**Product:** Masjid-e-Mamoor 2 Internal Management Application  
**Scope:** V1  
**Last Updated:** 2026-09-17

---

## 1. Purpose

This document defines the exact feature scope for V1 of the Masjid-e-Mamoor 2 application.

Its purpose is to prevent scope creep, unnecessary features, and accidental omission of core functionality.

The V1 product is designed around two primary objectives:

1. **Financial audit and transparency**
2. **Committee progress, accountability, and work history**

Other modules support these objectives.

---

# 2. Product Scope Principle

The application is dedicated specifically to:

**Masjid-e-Mamoor 2**

V1 is not a multi-Masjid platform.

The application should remain focused on the Masjid's actual operational requirements.

A feature must not be added merely because it is technically possible.

---

# 3. Feature Priority Model

Each feature is categorized as:

### P0 — Core / Must Have

Required for the primary purpose of the application.

### P1 — Important / V1 Required

Important to normal Masjid operations and accountability.

### P2 — Supporting

Useful supporting functionality that should be included where it does not compromise the core delivery.

### OUT — Out of Scope

Explicitly excluded from V1.

---

# 4. Feature Overview

| Module | Priority | V1 Status |
|---|---|---|
| Authentication | P0 | In Scope |
| Member Management | P0 | In Scope |
| Committee Referral Tracking | P0 | In Scope |
| Monthly Donations | P0 | In Scope |
| Payment/UPI Workflow | P0 | In Scope |
| Finance & Accounts | P0 | In Scope |
| Expense Management | P0 | In Scope |
| Financial Audit & Reporting | P0 | In Scope |
| Committee Work / Tasks | P0 | In Scope |
| Committee Contribution Tracking | P0 | In Scope |
| Meeting Management | P1 | In Scope |
| Jummah Attendance | P1 | In Scope |
| Meeting Attendance | P1 | In Scope |
| Notifications | P1 | In Scope |
| Role-Based Access | P0 | In Scope |
| Activity Audit Log | P0 | In Scope |
| Multilingual UI | P1 | In Scope |
| Prayer-by-Prayer Attendance | OUT | Excluded |
| Multi-Masjid Support | OUT | Excluded |
| Public Masjid Discovery | OUT | Excluded |
| Asset Management | OUT | Excluded |
| Donation Targets | OUT | Excluded |
| Leaderboards / Rankings | OUT | Excluded |
| Bank Reconciliation | OUT | Excluded |
| Advances | OUT | Excluded |
| Custom Permission Profiles | OUT | Excluded |

---

# 5. P0 — Core Features

## 5.1 Authentication

### Included

- Mobile number login
- OTP authentication
- Secure session
- Logout
- Role identification
- Role-based application access

### Excluded

- Username/password as a separate primary login mechanism
- Social login
- Public anonymous access

---

# 6. Member Management

**Priority:** P0

### Included

- Member registration
- Name
- Mobile number
- Member account
- Mobile-number duplicate prevention
- Primary referring Committee Member
- Monthly donation amount
- Member donation history
- Member status
- Authorized member information management

### Core rule

Mobile number must be unique for a member.

### Excluded

- Duplicate member records
- Public member directory
- Public member search

---

# 7. Committee Referral Tracking

**Priority:** P0

### Included

- Committee Member refers person
- Enter name and mobile number
- Duplicate check
- Create member immediately when new
- Record one primary referrer
- Referral count
- Referral history
- Verified donation contribution through referred members
- Authorized referral correction
- Audit of referral-attribution changes

### Important distinction

The system must separate:

```text
Members Referred
```

from:

```text
Verified Donations Attributed Through Referrals
```

A referral alone does not represent a financial contribution.

### Excluded

- Multi-person referral credit
- Referral ranking
- Referral leaderboard
- Referral target quotas

---

# 8. Monthly Donation System

**Priority:** P0

### Included

- Agreed monthly donation amount
- Monthly donation records
- Automatic next-month record generation
- Due/Pending/Paid/Expired-related states as applicable
- Outstanding amount calculation
- Month-wise history
- Missed-payment records retained permanently
- Monthly reminder workflow

### Amount authority

The agreed monthly amount can be entered/changed by:

- Committee Member
- President
- Secretary
- Finance

The member cannot directly modify the fixed monthly amount.

### Effective month

Amount changes apply from a selected effective month.

Historical monthly records remain unchanged.

### Excluded

- Donation targets
- Donation quotas
- Forced contribution levels
- Automatic future-due reduction from extra donations

---

# 9. Payment Link System

**Priority:** P0

### Included

- Automatic payment-link generation after details and amount confirmation
- Monthly amount pre-filled
- Combined outstanding payment link
- Payment-link expiry at the end of the applicable donation month
- App push delivery
- SMS/WhatsApp delivery where an appropriate service is available

### Payment principle

```text
Link Generated
≠
Payment Received
≠
Payment Verified
```

The financial state changes only after actual payment verification.

### Excluded

- Treating link clicks as payment confirmation
- Treating delivery status as payment confirmation

---

# 10. UPI Configuration

**Priority:** P0

### Included

- One active Masjid UPI ID
- Finance can enter/change UPI ID
- New links use current active UPI ID
- Historical records unaffected by UPI-ID changes
- UPI-ID changes logged

### Excluded

- Multiple active UPI IDs in V1
- Automatic bank-statement ingestion unless separately approved later
- Treating UPI intent/opening as proof of payment

---

# 11. Payment Verification

**Priority:** P0

### Included

Finance verifies actual payments using available transaction information.

The record should retain:

- Member/donor
- Amount
- Date
- Payment method
- Transaction/reference ID where applicable
- Verifier
- Verification timestamp

Only verified payments count toward verified contribution totals.

---

# 12. Outstanding Donations

**Priority:** P0

### Included

- Multiple outstanding monthly records
- Combined payment
- Oldest-month-first (FIFO) allocation
- Month-wise settlement
- Outstanding balance visibility

### Example

```text
July      ₹500 Pending
August    ₹500 Pending
September ₹500 Due

Combined Payment = ₹1,500

Allocation:
July → August → September
```

---

# 13. Partial Monthly Payment Rule

**Priority:** P0

A monthly donation must be paid in full.

The system must not mark a ₹500 monthly contribution as completed from a ₹300 payment.

V1 does not implement partial-month completion.

---

# 14. Overpayment

**Priority:** P0

### Included

If payment exceeds applicable outstanding monthly donations:

- Full payment is accepted.
- Required amount settles applicable dues.
- Excess becomes an Additional General Donation.
- Excess does not reduce future monthly dues.
- Excess contributes to verified donation history.

---

# 15. Additional Voluntary Donation

**Priority:** P0

### Included

- Member enters amount
- General Donation category
- UPI payment
- Finance verification
- Donation history

### Excluded

- Purpose selection
- Multiple V1-purpose categories
- Automatic future-month credit

---

# 16. Anonymous Donation

**Priority:** P1

### Included

Finance can record a donation as:

**Anonymous**

The financial record retains the required accounting information while the donor identity remains unspecified.

### Included fields

- Amount
- Date
- Payment method
- Verification information
- Recording user

### Excluded

- Automatic referral attribution for anonymous donations
- Public anonymous-donor profiles

---

# 17. Jummah Cash Collection

**Priority:** P0

### Included

- One collection total per Friday/Jummah
- Cash collection record
- Date
- Amount
- Account
- Entered by
- Timestamp
- Optional note

Authorized entry users:

- Finance
- President
- Secretary

### Excluded

- Recording every individual Jummah cash donor
- Donor-by-donor Jummah cash collection workflow

---

# 18. Finance & Accounts

**Priority:** P0

### Included

Account types may include:

- Cash
- Bank
- UPI/payment account
- Other legitimate Masjid accounts

### Account functionality

- Opening balance
- Current balance
- Transaction history
- Active/deactivated status
- Income
- Donations
- Collections
- Expenses
- Payments
- Internal transfers
- Reporting

### Excluded

- Asset/property accounting
- Personal finance
- Unapproved loan-management system
- Unnecessary accounting modules

---

# 19. Internal Transfers

**Priority:** P0

### Included

- Cash → Bank
- Bank → Cash
- Bank → Bank
- Other legitimate account transfers
- Transfer ID
- Linked transaction records

### Rule

Internal transfers must not change total Masjid funds.

They only move money between accounts.

---

# 20. Expense Management

**Priority:** P0

### Included

Finance can:

- Add expense
- Record amount
- Select category
- Add details
- Upload bill
- Record payment
- Upload payment proof
- Record multiple payments
- Track expense status
- Cancel unpaid expense
- Correct expense amount with reason

### Supporting files

Bill:

- PDF
- JPG
- PNG

Payment proof:

- PDF
- JPG
- PNG

### Statuses

- Added
- Partially Paid
- Paid
- Cancelled

### Rules

- Bill required before Paid.
- Payment proof required before Paid.
- Total payments cannot exceed expense amount.
- Cancellation reason required.
- Amount correction requires a reason.
- Same transaction ID retained during normal correction.

---

# 21. Expense Control

**Priority:** P0

Finance is the operational controller for expenses.

President has supervisory visibility and overall administrative authority including financial deletion authority where applicable.

There is no separate President-approval workflow for every expense.

---

# 22. Financial Audit

**Priority:** P0

This is a primary product pillar.

### Included

- Opening balance
- Income
- Donations
- Collections
- Expenses
- Payments
- Transfers
- Adjustments where legitimately required
- Closing/current balance
- Transaction references
- Supporting records
- Audit information

### Reports

- Daily
- Monthly
- Yearly
- Custom date range
- Account-wise
- Income
- Expense
- Donation
- Transaction history

### Output

- Downloadable report
- Printable report
- Professional PDF audit/report

### Excluded

- Formal accounting certification workflow
- External auditor portal
- Bank reconciliation in V1

---

# 23. Committee Work / Task Management

**Priority:** P0

This is the second major product pillar.

### Included

- Create task
- Assign task
- Open/volunteer task
- Single-member claim
- Progress updates
- Deadline
- Priority
- Overdue state
- Completion
- Completion note
- Attachments where applicable
- Permanent work history

### Task lifecycle

```text
Created
  ↓
Assigned / Claimed
  ↓
In Progress
  ↓
Completed
```

or:

```text
Incomplete + Deadline Passed
  ↓
Overdue
```

### Open-task rule

Only one eligible Committee Member can claim an open task.

The backend must enforce the rule atomically.

---

# 24. Committee Work History

**Priority:** P0

### Included

- Assigned work
- Claimed work
- Completed work
- Pending work
- Overdue work
- Completion dates
- Completion notes
- Work history
- Edit history metadata

### Retention

Committee performance/work history is permanent.

Storage optimization must not remove core work history.

### Excluded

- Performance scores
- Rankings
- Leaderboards
- "Best member" labels

---

# 25. Committee Contribution Dashboard

**Priority:** P0

The system should show factual contribution information such as:

- Members referred
- Active/registered members referred
- Verified donations through referrals
- Current-month verified contribution
- Pending contributions
- Work completed
- Historical work

No competitive ranking is required.

---

# 26. Meeting Management

**Priority:** P1

### Included

- Meeting creation
- Date/time
- Location
- Agenda
- Invited members
- Attendance
- Decisions/minutes
- Follow-up requirements
- Follow-up tasks
- Responsible members
- Completion tracking
- Historical meeting records

### Accountability chain

```text
Meeting
  ↓
Decision
  ↓
Optional Task
  ↓
Responsible Member
  ↓
Completion
```

### Excluded

- Meeting attachments in V1
- Public meeting publishing

---

# 27. Meeting Attendance

**Priority:** P1

### Included

Attendance for scheduled committee meetings.

The system should retain:

- Meeting
- Member
- Attendance state
- Date/time
- Relevant audit information

### Excluded

- Attendance for unscheduled events
- Daily prayer attendance other than Jummah

---

# 28. Jummah Attendance

**Priority:** P1

### Included

- Mark Present
- GPS validation
- Configurable Masjid radius
- One record per member per Friday
- Individual history
- Aggregate information
- Offline capture and later synchronization where supported

### Excluded

- Fajr attendance
- Zohr attendance
- Asr attendance
- Maghrib attendance
- Isha attendance
- Azaan attendance
- Jamaat attendance for each prayer
- Continuous location tracking
- GPS spoof detection in V1

---

# 29. Notifications

**Priority:** P1

### Included

Relevant event-based notifications such as:

- Payment link
- Payment verification
- Pending donation reminder
- Task assignment
- Task deadline
- Task overdue
- Task completion
- Meeting reminder
- Expense-added notification
- Important financial notifications
- Security/administrative notifications

### Delivery

- In-app/app push
- SMS/WhatsApp where supported by an appropriate service

### Rule

Notification delivery is not the source of truth for business state.

### Excluded

- Complex notification inbox/history in V1
- Notifications for every user interaction
- Sensitive financial details in push payloads

---

# 30. Role-Based Access Control

**Priority:** P0

The application must restrict features according to role.

Required roles:

- President
- Vice President
- Secretary
- Finance / Financer
- Auditor
- Committee Member
- Member

Detailed permissions belong in:

`USER_ROLES_PERMISSIONS.md`

### Excluded

- Custom permission profiles
- Separate Read-Only role
- Separate Staff/Volunteer role

---

# 31. Audit Logging

**Priority:** P0

### Included

Important state-changing/security events:

- User changes
- Role changes
- Financial transaction changes
- Financial deletions
- Expense/payment actions
- Attendance corrections
- Important settings changes
- Security/authentication events where appropriate
- Referral attribution changes

### Excluded

- Every page view
- Every button click
- Every dashboard open
- Every notification view

---

# 32. Reporting

**Priority:** P1

Reports must provide operationally useful information without unnecessary complexity.

### Financial reports

- Daily
- Monthly
- Yearly
- Custom

### Committee reports

- Task status
- Completed work
- Pending work
- Overdue work
- Referral counts
- Verified contribution
- Meeting participation

### Attendance reports

- Jummah attendance
- Meeting attendance

---

# 33. PDF / Print

**Priority:** P1

The application should support printable/downloadable documentation.

Primary use:

- Financial audit
- Financial reports
- Committee records where useful
- Official documentation

PDF generation must be designed to avoid unnecessary permanent storage of duplicate generated files.

---

# 34. Internationalization

**Priority:** P1

### V1 languages

- English
- Hindi
- Kannada
- Urdu

### Requirements

- Language switch
- Translation-ready architecture
- Urdu RTL support
- Appropriate date/number formatting
- Localized notifications where supported
- Localized reports/PDFs where practical

---

# 35. Storage and Retention

**Priority:** P0

Storage must be minimized without compromising core records.

### Permanent

- Financial records
- Donation history
- Expense/payment history
- Transfer records
- Committee work history
- Required meeting history
- Important audit records

### Can use controlled retention

- Technical/debug logs
- Temporary processing files
- Other non-essential operational artifacts

### Storage strategy

Prefer:

- References over duplicate copies
- Necessary metadata only
- File compression where safe
- Temporary report generation
- Avoiding duplicate uploads

---

# 36. Security

**Priority:** P0

The application must protect:

- Personal information
- Mobile numbers
- Financial data
- Bills
- Payment proofs
- Attendance
- Committee work records
- Audit information

The detailed security baseline is maintained separately.

---

# 37. Explicitly Out of Scope for V1

The following features must not be implemented in V1 unless a documented scope change is approved.

## Multi-Masjid / Public

- Masjid registration
- Multiple-Masjid switching
- Public Masjid discovery
- Public Masjid directory
- Public community platform

## Attendance

- Fajr attendance
- Zohr attendance
- Asr attendance
- Maghrib attendance
- Isha attendance
- Azaan attendance
- Jamaat attendance for each prayer
- Continuous location tracking

## Donation / Contribution Competition

- Donation targets
- Donation quotas
- Donation leaderboard
- Committee leaderboard
- Referral ranking
- Performance score
- "Best Committee Member" ranking

## Finance

- Asset/property management
- Bank reconciliation
- Formal financial month locking
- Advances
- Complex loan-management system unless later required

## Roles

- Staff/Volunteer role
- Read-Only role
- Custom permission profiles

## Notifications

- Full notification inbox/history
- Excessive non-essential notifications

## Other

- Feature bloat without a documented operational requirement

---

# 38. Scope Change Control

A feature may be added to V1 only when:

1. The requirement is clearly defined.
2. Its operational purpose is documented.
3. Its security/financial impact is understood.
4. Its effect on architecture and database is understood.
5. The appropriate project documents are updated.
6. `DEVELOPMENT_TASKS.md` is updated before implementation.

---

# 39. V1 Core Success Definition

The V1 application succeeds when it can reliably provide:

```text
MEMBER MANAGEMENT
       +
REFERRAL TRACKING
       +
VERIFIED DONATIONS
       +
FINANCIAL ACCOUNTING
       +
AUDIT REPORTING
       +
COMMITTEE WORK HISTORY
       +
MEETING ACCOUNTABILITY
       +
JUMMAH / MEETING ATTENDANCE
       +
ROLE & SECURITY CONTROLS
       =
MASJID TRANSPARENCY & ACCOUNTABILITY
```

---

# 40. Related Documents

This scope document should be read together with:

- `PROJECT_OVERVIEW.md`
- `PRODUCT_REQUIREMENTS.md`
- `USER_ROLES_PERMISSIONS.md`
- `DEVELOPMENT_TASKS.md`
- Architecture documents
- Database documents
- Security documents
- Testing documents
- Operations/deployment documents

---

## Document Status

**Feature Scope — V1 Baseline**

This document is the scope-control document for implementation.

Development teams should use it to determine whether a requested feature belongs in V1 before implementation begins.
