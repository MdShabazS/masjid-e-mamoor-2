# Masjid-e-Mamoor 2 — Project Overview

**Document Status:** Draft for Development Baseline  
**Version:** 1.0  
**Product:** Masjid-e-Mamoor 2 Internal Management Application  
**Scope:** V1  
**Last Updated:** 2026-09-17

---

## 1. Purpose

Masjid-e-Mamoor 2 is an internal digital management application designed specifically for the Masjid committee and registered members.

The primary purpose of the application is to provide a reliable, transparent, and auditable system for:

1. Managing Masjid members and monthly donation commitments.
2. Tracking committee-member referrals and verified donation contributions.
3. Recording and monitoring committee work and progress.
4. Maintaining complete financial records and audit information.
5. Recording Jummah attendance and scheduled meeting attendance.
6. Maintaining permanent historical records for financial and committee accountability.
7. Producing clear reports and printable/downloadable audit documentation.

The application is intended for internal Masjid operations and is not a public Masjid-discovery or multi-Masjid platform in V1.

---

## 2. Product Identity

### Masjid

**Masjid-e-Mamoor 2**

The V1 application is dedicated to this Masjid.

### Product Type

Internal Masjid management and accountability application.

### Target Platforms

- Web application
- Android application
- iOS application

### Primary Users

- President
- Vice President
- Secretary
- Finance / Financer
- Auditor
- Committee Member
- Registered Member

---

## 3. Core Product Objectives

### 3.1 Financial Transparency

The application must provide a trustworthy record of Masjid finances.

It should answer:

> Where did the Masjid's money come from, where did it go, what is the current financial position, and who recorded or verified each important transaction?

Financial records must be retained permanently.

Storage optimization must never compromise financial history.

---

### 3.2 Committee Accountability

The application must maintain a factual record of committee activity.

It should answer:

> Who referred members, what verified donations came through those referrals, what work was assigned or completed, and what has each committee member contributed over time?

Committee performance history must be retained permanently.

The application will not use artificial performance scores, rankings, leaderboards, or donation targets.

---

### 3.3 Member Donation Management

The application must provide a structured monthly donation workflow.

The system should support:

- Member registration
- Referral attribution
- Agreed monthly donation amount
- Monthly donation records
- Payment links
- UPI payments
- Finance verification
- Outstanding monthly donations
- Combined payment for multiple complete outstanding months
- Additional voluntary donations
- Anonymous donations
- Donation history

---

### 3.4 Committee Work Management

The application must provide a permanent record of committee work.

The system should support:

- Task creation
- Task assignment
- Open/volunteer tasks
- Single-member task claiming
- Task progress
- Deadlines
- Overdue status
- Completion records
- Work history
- Meeting decisions and follow-up tasks

---

### 3.5 Attendance and Participation

V1 attendance is intentionally limited to:

- Jummah prayer attendance
- Scheduled committee meeting attendance

Attendance for individual daily prayers such as Fajr, Zohr, Asr, Maghrib, and Isha is outside V1 scope.

---

## 4. Core Principles

### 4.1 Auditability

Important financial, administrative, and accountability actions must be traceable.

The system should preserve:

- Who performed an action
- What record was affected
- What action occurred
- When it occurred

---

### 4.2 Permanent Historical Records

The following must not be automatically deleted for storage optimization:

- Financial records
- Donation history
- Expense records
- Payment records
- Transfer records
- Committee work history
- Meeting history
- Relevant audit records

Storage optimization should instead focus on avoiding unnecessary duplication and retaining only information that provides operational or audit value.

---

### 4.3 Financial Source of Truth

A payment link being generated or opened does not mean that money was received.

A donation becomes financially recognized only after the actual payment is verified by Finance.

For digital payments, the transaction/reference ID should be recorded where available.

---

### 4.4 No Donation Targets

The monthly donation amount is an amount agreed between the committee member and the member.

It is not:

- A target
- A quota
- A performance requirement

The system should display actual contributions and historical records without creating competitive donation rankings.

---

### 4.5 Minimal but Complete Product

V1 should contain the functionality required for the Masjid's core operations and accountability.

Features should not be added merely because they are technically possible.

Every feature should have a clear operational, financial, security, or accountability purpose.

---

## 5. High-Level Product Modules

The application is organized around the following modules.

### 5.1 Authentication and User Access

- Mobile number login
- OTP authentication
- Role-based access
- Secure session management

---

### 5.2 Member Management

- Member registration
- Mobile-number duplicate prevention
- Member profile
- Referring committee member
- Monthly donation amount
- Donation history
- Member status

---

### 5.3 Referral and Contribution Tracking

- Committee member referral
- One primary referrer per member
- Referral count
- Verified donation contribution through referred members
- Referral attribution correction by authorized administration
- Historical attribution record

---

### 5.4 Donation Management

Supports:

- Monthly donations
- Outstanding donations
- Combined outstanding payments
- Additional voluntary donations
- Anonymous donations
- Donation verification
- Donation history

---

### 5.5 UPI Payment System

- One active Masjid UPI ID
- Finance manages the UPI ID
- Automatic payment-link generation after member details and amount are confirmed
- Payment link carries the applicable amount
- Payment link expires at the end of the applicable donation month
- Combined outstanding payment links are supported

Payment-link delivery is intended to support:

- App push
- SMS/WhatsApp where an appropriate service is available

---

### 5.6 Finance and Accounts

Supports:

- Cash account
- Bank account(s)
- UPI/payment account
- Other legitimate Masjid accounts
- Account balances
- Opening balances
- Income
- Donations
- Jummah cash collections
- Expenses
- Payments
- Internal transfers
- Financial reports
- Audit records

---

### 5.7 Expense Management

Finance is the operational controller for expenses.

The workflow includes:

1. Finance adds expense.
2. Bill is uploaded.
3. Payment is recorded.
4. Payment proof is uploaded.
5. Expense becomes Paid when applicable requirements are satisfied.
6. President has supervisory visibility.

Multiple payments for one expense are supported.

---

### 5.8 Committee Work Management

Supports:

- Tasks
- Assignment
- Volunteer/claim workflow
- Progress
- Deadlines
- Overdue status
- Completion
- Completion notes
- Work history
- Attachments where applicable

Completed work records are retained permanently.

---

### 5.9 Meeting Management

Supports:

- Scheduled meetings
- Meeting details
- Agenda
- Invited members
- Attendance
- Decisions/minutes
- Follow-up tasks
- Historical meeting records

The relationship is:

**Meeting → Decision → Optional Task → Completion**

---

### 5.10 Attendance

V1 supports:

#### Jummah Attendance

- GPS-based attendance
- One attendance record per member per Friday
- Individual history
- Aggregate attendance information

#### Meeting Attendance

- Attendance for scheduled committee meetings
- Individual meeting attendance history
- Aggregate participation information

No checkout is required.

---

### 5.11 Financial Audit and Reporting

The system should support:

- Daily reports
- Monthly reports
- Yearly reports
- Custom date-range reports
- Account-wise reports
- Income reports
- Expense reports
- Donation reports
- Transaction history
- Audit information
- Printable/downloadable PDF reports

---

### 5.12 Notifications

Event-based notifications may cover:

- Payment links
- Payment verification
- Task assignment
- Task deadlines
- Task overdue status
- Task completion
- Meeting reminders
- Important financial events
- Important administrative/security events

Critical business logic must not depend solely on notification delivery.

---

### 5.13 Internationalization

V1 target languages:

- English
- Hindi
- Kannada
- Urdu

Urdu requires right-to-left interface support.

---

## 6. Core Financial Flow

The high-level financial flow is:

```text
Member / Donor
      |
      v
Donation / Collection
      |
      v
Payment or Cash Entry
      |
      v
Finance Verification
      |
      v
Financial Ledger
      |
      v
Account Balance
      |
      v
Reports / Audit
```

For monthly digital donations:

```text
Member Registration
      |
      v
Agreed Monthly Amount
      |
      v
Payment Link Generated
      |
      v
UPI Payment
      |
      v
Finance Checks Actual Transaction
      |
      v
Transaction Reference Recorded
      |
      v
Donation Verified
      |
      v
Member Donation History
      |
      v
Financial Audit
```

---

## 7. Core Committee Accountability Flow

```text
Committee Member
      |
      +--> Refer Member
      |       |
      |       v
      |   Member Registered
      |
      +--> Committee Work
              |
              v
          Task Created
              |
       +------+------+
       |             |
   Assigned       Open Task
       |             |
       |          Member Claims
       +------+------+
              |
              v
           Working
              |
              v
          Completed
              |
              v
       Permanent Work History
              |
              v
       Committee Progress
```

---

## 8. Financial Audit Model

At a high level, the financial reporting model follows:

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
      +
/- Internal Transfer Effects by Account
      =
Closing / Current Balance
```

Internal transfers do not change the total Masjid funds.

For example:

```text
Cash -> Bank

Cash Account:  -₹20,000
Bank Account:  +₹20,000

Overall Masjid Funds: No Change
```

---

## 9. Storage Strategy Principle

The application is intended to operate using free or low-cost infrastructure where practical.

However, cost reduction must not compromise:

- Financial history
- Donation history
- Committee work history
- Required audit records

Storage efficiency should be achieved through:

- Avoiding duplicate files
- Referencing existing records instead of copying data
- Storing only necessary metadata
- Compressing appropriate documents where safe
- Avoiding unnecessary permanent generated files
- Applying retention policies only to non-essential technical logs
- Keeping critical financial and accountability records permanently

---

## 10. V1 Scope Boundaries

The following are intentionally outside V1 unless requirements change.

### Not included

- Multi-Masjid registration
- Public Masjid discovery
- Public-facing community platform
- Daily prayer attendance for all five prayers
- Prayer-by-prayer attendance analytics
- Donation targets
- Committee leaderboards
- Committee performance scores
- Asset/property management
- Separate Staff/Volunteer role
- Separate Read-Only role
- Custom permission profiles
- Bank reconciliation
- Formal financial month locking
- Advances
- Complex notification inbox/history
- Unnecessary feature expansion

The scope may be revised only through a documented product decision.

---

## 11. V1 Success Criteria

The application should be considered functionally successful when the Masjid can reliably:

### Members

- Register members through committee referrals.
- Prevent duplicate members using mobile number.
- Record agreed monthly donation amounts.
- Maintain month-wise donation history.

### Donations

- Generate payment links.
- Receive UPI payments directly to the configured Masjid UPI ID.
- Verify actual payments through Finance.
- Handle outstanding monthly donations.
- Handle combined complete-month payments.
- Record additional donations.
- Record anonymous donations.

### Committee

- Track referrals.
- Track verified contribution through referrals.
- Create and complete committee tasks.
- Maintain permanent work history.
- Record meetings, decisions, and follow-up tasks.

### Attendance

- Record Jummah attendance.
- Record scheduled meeting attendance.

### Finance

- Maintain account balances.
- Record income and expenses.
- Record Jummah cash collections.
- Record payments and transfers.
- Maintain supporting documents.
- Produce auditable reports.

### Audit

- Track important state-changing actions.
- Preserve financial and committee history.
- Produce professional printable/downloadable reports.

---

## 12. Development Philosophy

Development will follow a documentation-first process:

```text
Research
   ↓
Requirements
   ↓
Architecture
   ↓
Technology Decisions
   ↓
Database Design
   ↓
Security Design
   ↓
UI/UX Design
   ↓
Implementation
   ↓
Testing
   ↓
Validation
   ↓
Deployment
   ↓
Production Monitoring
```

Development should proceed through the master task list in:

`DEVELOPMENT_TASKS.md`

Tasks should be completed sequentially unless a documented dependency allows parallel work.

---

## 13. Source of Truth

The following documents should collectively form the project's documented source of truth:

- `PROJECT_OVERVIEW.md`
- `PRODUCT_REQUIREMENTS.md`
- `FEATURE_SCOPE.md`
- `USER_ROLES_PERMISSIONS.md`
- Architecture documents
- Technology stack documents
- Database schema documents
- Feature specifications
- Security requirements
- Testing and acceptance documents
- `DEVELOPMENT_TASKS.md`

If implementation conflicts with an approved requirement, the discrepancy must be identified and resolved rather than silently changing the behavior.

---

## 14. Change Management

Requirements may evolve during development.

A change that affects:

- Financial behavior
- Donation attribution
- Permissions
- Security
- Auditability
- Data retention
- Core workflow

must be documented before implementation.

The relevant `.md` document should be updated when a decision changes.

---

## 15. Document Status

This document establishes the high-level project direction.

Detailed implementation decisions belong in their respective architecture, technology, database, feature, security, testing, and operations documents.

**Next documentation step:** finalize the complete Product Requirements Specification before making technology and architecture decisions.
