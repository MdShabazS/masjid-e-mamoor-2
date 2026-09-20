# Masjid-e-Mamoor 2 — Data Relationships

**Document Status:** V1 Implementation Baseline  
**Version:** 1.0  
**Database:** PostgreSQL via Supabase  
**Product:** Masjid-e-Mamoor 2 Internal Management Application  
**Scope:** V1  
**Last Updated:** 2026-09-17

---

# 1. Purpose

This document defines the relationships between the major data entities in the Masjid-e-Mamoor 2 application.

The goal is to make the data model understandable before implementation by showing:

- Parent-child relationships
- One-to-one relationships
- One-to-many relationships
- Optional relationships
- Financial relationships
- Committee-accountability relationships
- Historical relationships
- Audit relationships
- File relationships

The exact columns and SQL definitions are maintained in:

- `DATABASE_SCHEMA.md`
- `FINANCIAL_DATA_MODEL.md`
- `COMMITTEE_DATA_MODEL.md`
- `AUDIT_LOG_MODEL.md`

---

# 2. Relationship Principles

The database relationship model must preserve:

1. One authenticated identity per application user.
2. One application member identity per registered member profile.
3. One mobile number per member.
4. One primary referrer per member in V1.
5. One monthly donation record per member per donation month.
6. One or more payment allocations may belong to one payment.
7. One payment may settle multiple monthly donation records.
8. One additional donation is separate from monthly donation obligations.
9. One financial account has many financial transactions.
10. One expense can have multiple payments.
11. One transfer connects source and destination financial effects.
12. One task may originate from one meeting decision.
13. One meeting has many participants/attendance records.
14. One member can have many Jummah attendance records.
15. One member can have many meeting-attendance records.
16. Core historical records must not depend on destructive parent deletion.
17. Files are referenced from business records rather than duplicated into each record.
18. Audit events can reference the actor and affected resource.

---

# 3. High-Level Relationship Map

```text
AUTH IDENTITY
      │
      ▼
    USER
      │
      ├──────────────► ROLE
      │
      ▼
   MEMBER
      │
      ├──────────────► REFERRAL / PRIMARY REFERRER
      │
      ├──────────────► DONATION TERMS
      │
      ├──────────────► MONTHLY DONATIONS
      │                       │
      │                       ▼
      │                   PAYMENTS
      │                       │
      │                       ▼
      │               PAYMENT ALLOCATIONS
      │
      ├──────────────► ADDITIONAL DONATIONS
      │
      ├──────────────► JUMMAH ATTENDANCE
      │
      └──────────────► MEETING ATTENDANCE

USER
 │
 ├──────────────► COMMITTEE TASKS
 │                       │
 │                       ▼
 │                 TASK UPDATES
 │
 └──────────────► MEETINGS
                         │
                         ├──► PARTICIPANTS
                         ├──► ATTENDANCE
                         └──► DECISIONS
                                  │
                                  ▼
                                TASKS

PAYMENTS / DONATIONS
        │
        ▼
FINANCIAL TRANSACTIONS
        │
        ▼
FINANCIAL ACCOUNTS

EXPENSES
   │
   └──► EXPENSE PAYMENTS
             │
             ▼
     FINANCIAL TRANSACTIONS

ALL IMPORTANT ACTIONS
        │
        ▼
   AUDIT EVENTS

FILES
  │
  └──► EXPENSES / PAYMENTS / TASKS / OTHER APPROVED RECORDS
```

---

# 4. Identity Relationships

## 4.1 Auth Identity → User

Relationship:

```text
Authentication Identity
        │
        │ 1 : 1
        ▼
Application User
```

The authentication provider owns the authentication identity.

The application database owns the application-level user record.

---

# 5. User → Role

V1 uses one current primary application role per user.

```text
User
  │
  └── current role
```

Supported roles:

- President
- Vice President
- Secretary
- Finance
- Auditor
- Committee Member
- Member

Historical role changes are captured through audit events.

---

# 6. User → Member

A user may optionally have one Member profile.

```text
User 1 ───── 0..1 Member
```

Reasons for optional relationship:

- Administrative users may not need a member profile.
- A registered Masjid member using the app can be linked to their authenticated user.

Recommended uniqueness:

```text
members.user_id UNIQUE
```

when present.

---

# 7. Member → Referral

A member has one current primary referral attribution in V1.

```text
Member 1 ───── 0..1 Current Referral
                    │
                    ▼
              Referrer User
```

The referrer must be an eligible Committee Member under the final authorization rules.

---

# 8. Member → Donation Terms

A member can have multiple donation terms over time.

```text
Member 1 ───── N Donation Terms
```

Example:

```text
Member A
  │
  ├── ₹500 effective July
  └── ₹700 effective September
```

The terms define which monthly amount applies to a particular month.

Historical monthly records are not rewritten when future terms change.

---

# 9. Donation Terms → Monthly Donation

One applicable donation term determines the expected amount for a monthly donation record.

Conceptually:

```text
Donation Term
      │
      ▼
Monthly Donation
```

The database should store the month-specific `expected_amount` on the monthly record.

This preserves historical financial meaning.

---

# 10. Member → Monthly Donations

One member can have many monthly donation records.

```text
Member 1 ───── N Monthly Donations
```

Uniqueness:

```text
(member_id, donation_month)
```

Therefore:

```text
One member
+
One month
=
One monthly donation record
```

---

# 11. Monthly Donation → Payment

A monthly donation may have:

- No payment yet
- One verified payment allocation
- A payment request before payment

The relationship should distinguish between:

```text
Payment Request
```

and:

```text
Actual Payment
```

A payment request is not proof of payment.

---

# 12. Payment Request → Member

A payment request belongs to a member when the payment is member-driven.

```text
Member 1 ───── N Payment Requests
```

A payment request stores:

- Requested amount
- UPI ID snapshot
- Request type
- Generation timestamp
- Expiry

---

# 13. Payment Request Types

V1 supports:

```text
MONTHLY
COMBINED
```

### Monthly

A request corresponds to one monthly donation.

### Combined

A request represents the total of complete outstanding monthly donations.

---

# 14. Payment → Payment Allocations

One verified payment can settle multiple monthly donations.

```text
Payment 1 ───── N Payment Allocations
```

Example:

```text
Payment ₹1,500
   │
   ├── ₹500 → July
   ├── ₹500 → August
   └── ₹500 → September
```

---

# 15. Payment Allocation → Monthly Donation

Each payment allocation points to one monthly donation.

```text
Payment Allocation N ───── 1 Monthly Donation
```

A monthly donation should not be allocated multiple times beyond its complete expected amount.

The backend must enforce allocation integrity transactionally.

---

# 16. FIFO Relationship

When a combined payment is received:

```text
Payment
  ↓
Outstanding Monthly Donations
  ↓
Sort by donation month ascending
  ↓
Allocate oldest first
```

The relationship between:

```text
Payment
+
Payment Allocations
+
Monthly Donations
```

preserves this order.

---

# 17. Payment → Financial Transaction

A verified payment can create an authoritative financial transaction.

```text
Verified Payment 1 ───── 1 Financial Transaction
```

The exact implementation may allow exceptional payment patterns, but V1 should avoid duplicate financial postings.

---

# 18. Additional Donation → Payment

Additional voluntary donations can use the payment workflow.

```text
Member
  ↓
Additional Donation
  ↓
Payment
  ↓
Verification
```

The additional donation is separate from the monthly donation obligation.

---

# 19. Overpayment → Additional Donation

For an overpayment:

```text
Payment
  │
  ├── Monthly Donation Allocation(s)
  │
  └── Additional General Donation
```

Example:

```text
Outstanding = ₹1,000
Received    = ₹1,200

₹1,000 → monthly allocation
₹200   → additional donation
```

---

# 20. Anonymous Donation Relationships

Anonymous donation:

```text
Anonymous Donor
      │
      ▼
Donation / Payment / Financial Transaction
```

There is no required relationship to:

```text
User
Member
Referrer
```

unless a future requirement explicitly adds one.

---

# 21. Member → Additional Donations

A registered member can make many additional donations.

```text
Member 1 ───── N Additional Donations
```

Each additional donation has:

- Amount
- General Donation classification
- Source
- Payment relationship
- Verification information

---

# 22. Donation → Referral Contribution

Referral contribution is a derived relationship:

```text
Referrer
   ↓
Referred Member
   ↓
Verified Donation
```

The system must distinguish:

```text
Referral count
```

from:

```text
Verified financial contribution
```

A member being referred does not imply any donation has been made.

---

# 23. Historical Referral Contribution

If referral attribution changes later, the application should preserve the meaning of historical contribution reports.

Recommended approach:

```text
Verified Donation Attribution
        ↓
Referrer snapshot / stable attribution
```

This prevents changing a member's current referrer from silently rewriting historical contribution totals.

The exact implementation belongs in `FINANCIAL_DATA_MODEL.md`.

---

# 24. Financial Account → Financial Transactions

One financial account has many financial transactions.

```text
Financial Account 1 ───── N Financial Transactions
```

Examples:

```text
Cash Account
  ├── Jummah collection
  ├── Donation
  ├── Expense
  └── Transfer

Bank Account
  ├── Donation
  ├── Expense
  └── Transfer
```

---

# 25. Financial Account → Current Balance

Each account maintains a server-controlled current balance.

```text
Financial Account
      │
      ├── Opening Balance
      ├── Transactions
      └── Current Balance
```

The balance is not manually set by clients.

---

# 26. Internal Transfer Relationships

One transfer has:

```text
Source Account
Destination Account
Source Financial Effect
Destination Financial Effect
```

Conceptually:

```text
Transfer
 ├── Source Account
 ├── Destination Account
 ├── Source Transaction
 └── Destination Transaction
```

---

# 27. Transfer Integrity

For a normal internal transfer:

```text
Source Debit = Destination Credit
```

Example:

```text
Cash
 -₹20,000

Bank
 +₹20,000
```

Overall Masjid funds remain unchanged.

---

# 28. Expense → Expense Payments

One expense can have multiple payments.

```text
Expense 1 ───── N Expense Payments
```

Example:

```text
Expense ₹10,000
  ├── UPI ₹4,000
  ├── Cash ₹3,000
  └── Bank ₹3,000
```

The sum must not exceed the expense amount under normal rules.

---

# 29. Expense Payment → Financial Transaction

Each expense payment produces an accounting effect.

```text
Expense Payment 1 ───── 1 Financial Transaction
```

The transaction reduces the selected financial account.

---

# 30. Expense → Bill File

Each expense requires a bill before the expense can reach Paid status.

```text
Expense 1 ───── 1 Bill File Reference
```

The file itself is stored in object storage.

The database stores file metadata.

---

# 31. Expense Payment → Payment Proof

Each expense payment requires payment proof before the expense can be fully marked Paid.

```text
Expense Payment 1 ───── 1 Payment Proof File Reference
```

The file is stored in object storage.

---

# 32. Expense → Category

Many expenses can use one category.

```text
Financial Category 1 ───── N Expenses
```

Categories may be:

- System-defined
- President-created custom

A category can be deactivated while historical references remain valid.

---

# 33. Member → Jummah Attendance

One member can have many Jummah attendance records.

```text
Member 1 ───── N Jummah Attendance
```

Uniqueness:

```text
(member_id, jummah_date)
```

Therefore:

```text
One member
+
One Friday
=
One Jummah attendance record
```

---

# 34. Member → Meeting Attendance

One member can attend many meetings.

```text
Member 1 ───── N Meeting Attendance
```

A meeting can have many members.

Therefore the relationship is:

```text
Member N ───── M Meetings
```

implemented through:

```text
meeting_attendance
```

---

# 35. Meeting → Participants

A meeting has many invited/eligible participants.

```text
Meeting 1 ───── N Meeting Participants
```

A participant can be invited to many meetings.

The linking table uses:

```text
(meeting_id, member_id)
```

as the logical unique relationship.

---

# 36. Meeting → Attendance

One meeting has many attendance records.

```text
Meeting 1 ───── N Meeting Attendance
```

A meeting-attendance record connects:

```text
Meeting
+
Member
```

---

# 37. Meeting → Decisions

One meeting can have multiple decisions.

```text
Meeting 1 ───── N Decisions
```

Every decision belongs to exactly one meeting.

---

# 38. Decision → Task

A decision may have:

- No task
- One follow-up task
- Potentially more than one task if the approved workflow later requires it

V1 primarily models:

```text
Decision 1 ───── 0..N Tasks
```

The common use case is one decision creating one task.

The task stores the originating decision reference where applicable.

---

# 39. Task → Responsible User

A task can be:

```text
Unassigned
```

or:

```text
Assigned to one responsible Committee Member/user
```

Conceptually:

```text
User 1 ───── N Tasks
```

where `assigned_to` is optional.

---

# 40. Task Claiming Relationship

An open task starts without a claimant.

After successful claim:

```text
Task
  ↓
assigned_to = claiming member
```

Only one claimant can win.

This is enforced atomically by the backend/database.

---

# 41. Task → Updates

A task can have many progress updates.

```text
Task 1 ───── N Task Updates
```

Each update is authored by a user.

---

# 42. Task → Work History

Completed tasks are the core work-history records.

```text
Task
  ↓
Completed
  ↓
Permanent Work History
```

V1 does not require a duplicate work-history table unless later testing proves it necessary.

---

# 43. Meeting → Task → Work Chain

Core accountability relationship:

```text
Meeting
   ↓
Decision
   ↓
Task
   ↓
Responsible Member
   ↓
Task Updates
   ↓
Completed Work
```

This allows the application to answer:

> What was decided, who was responsible, what progress happened, and what was completed?

---

# 44. Committee Member → Referral Chain

Core contribution relationship:

```text
Committee Member
      ↓
Referred Member
      ↓
Donation Records
      ↓
Verified Payments
      ↓
Verified Contribution
```

This is separate from the task/work chain.

---

# 45. User → Audit Events

A user can generate many audit events.

```text
User 1 ───── N Audit Events
```

Examples:

- Financial change
- Role change
- Referral correction
- Monthly amount change
- Expense action
- Attendance correction

The actor is stored using the stable user ID.

---

# 46. Resource → Audit Events

One business record can be referenced by many audit events.

Examples:

```text
Expense → create/edit/payment events
Task → important state events
Donation → amount/status changes
User → role changes
```

Conceptually:

```text
Resource 1 ───── N Audit Events
```

The exact relationship is polymorphic through:

```text
resource_type
resource_id
```

---

# 47. User → File Metadata

One user can upload many files.

```text
User 1 ───── N Files
```

The file record stores uploader identity.

---

# 48. File → Business Record

A file belongs to a business resource.

Examples:

```text
File → Expense
File → Expense Payment
File → Task
File → Member Profile
```

The relationship is represented using:

```text
related_type
related_id
```

with backend authorization.

---

# 49. User → Notification Tokens

One user may have multiple device push tokens.

```text
User 1 ───── N Notification Tokens
```

Examples:

```text
Android phone
iPhone
New device
```

Old tokens should be deactivated when invalid.

---

# 50. User → Notification Jobs

One user can receive multiple notification jobs.

```text
User 1 ───── N Notification Jobs
```

Notification jobs are delivery records, not business truth.

---

# 51. Donation → Financial Transaction

A verified donation can create a financial transaction.

```text
Donation / Verified Payment
          ↓
Financial Transaction
```

The transaction should reference the originating source.

---

# 52. Expense → Financial Transaction

An expense itself represents an obligation/workflow.

The actual accounting effect occurs through its payment(s):

```text
Expense
   ↓
Expense Payment
   ↓
Financial Transaction
```

This keeps expense workflow separate from accounting posting.

---

# 53. Jummah Collection → Financial Transaction

A Jummah cash collection creates:

```text
Jummah Collection
      ↓
Cash Account
      ↓
Financial Transaction
```

One collection is one total amount for the Friday.

No individual donor relationship is required.

---

# 54. Additional Donation → Financial Transaction

After verification:

```text
Additional Donation
      ↓
Financial Transaction CREDIT
```

The donation is included in financial reporting.

---

# 55. Anonymous Donation → Financial Transaction

Anonymous donation:

```text
Anonymous Donation
      ↓
Financial Transaction CREDIT
```

The record does not require Member/User identity.

---

# 56. Payment Request → UPI Configuration

A payment request uses the active UPI configuration at generation time.

```text
Current UPI Configuration
        ↓
Payment Request
        ↓
upi_id_snapshot
```

This prevents later UPI configuration changes from altering historical payment-request context.

---

# 57. Settings → Attendance

Attendance configuration such as:

```text
attendance_radius_m
```

belongs to Masjid settings.

The attendance record uses the configuration during validation.

---

# 58. Settings → Language

Default language configuration belongs to Masjid/application settings.

User-specific language preference may be stored at user/profile level if required by the final UX design.

---

# 59. Role → Permission

The relationship is logical rather than necessarily a separate many-to-many table in V1.

```text
User
 ↓
Current Role
 ↓
Permission Policy
```

The detailed enforcement is defined in:

`USER_ROLES_PERMISSIONS.md`

---

# 60. President Relationships

The President can access many domains:

```text
President
 ├── Users
 ├── Members
 ├── Referrals
 ├── Donations
 ├── Finance
 ├── Expenses
 ├── Tasks
 ├── Meetings
 ├── Attendance
 ├── Reports
 ├── Audit
 └── Settings
```

The database does not need a special President table.

The role determines authority.

---

# 61. Finance Relationships

Finance operates primarily on:

```text
Finance User
 ├── Donations / Verification
 ├── Payment Records
 ├── UPI Configuration
 ├── Financial Accounts
 ├── Financial Transactions
 ├── Expenses
 ├── Expense Payments
 └── Financial Reports
```

---

# 62. Auditor Relationships

Auditor is primarily read/review oriented:

```text
Auditor
   ↓
Financial Records
   ↓
Reports
   ↓
Audit Events
```

No database relationship should grant modification authority merely because the user can read the record.

---

# 63. Secretary Relationships

Secretary is primarily operational:

```text
Secretary
 ├── Meetings
 ├── Decisions
 ├── Tasks
 ├── Attendance
 ├── Authorized member/donation operations
 └── Jummah cash collection
```

Financial control remains governed by explicit permissions.

---

# 64. Committee Member Relationships

Committee Member may be connected to:

```text
Committee Member
 ├── Referrals
 ├── Assigned Tasks
 ├── Claimed Tasks
 ├── Task Updates
 ├── Work History
 ├── Meetings
 └── Attendance
```

The exact privacy boundaries remain governed by the permission model.

---

# 65. Member Relationships

A member can have:

```text
Member
 ├── User
 ├── Referrer
 ├── Donation Terms
 ├── Monthly Donations
 ├── Additional Donations
 ├── Payment Requests
 ├── Payments
 ├── Jummah Attendance
 └── Meeting Attendance
```

---

# 66. Financial Relationship Map

```text
                    MEMBER
                      │
          ┌───────────┴────────────┐
          ▼                        ▼
 Monthly Donation          Additional Donation
          │                        │
          └────────────┬───────────┘
                       ▼
                    PAYMENT
                       │
                       ▼
              PAYMENT ALLOCATION
                       │
                       ▼
              FINANCIAL TRANSACTION
                       │
                       ▼
               FINANCIAL ACCOUNT
                       │
                       ▼
                    BALANCE
```

Other income:

```text
Jummah Cash Collection
          ↓
Financial Transaction
          ↓
Cash Account
```

Expenses:

```text
Expense
   ↓
Expense Payment
   ↓
Financial Transaction
   ↓
Financial Account
```

Transfers:

```text
Source Account
      ↓
Transfer
      ↓
Destination Account
```

---

# 67. Committee Relationship Map

```text
Committee Member
      │
      ├──► Referral
      │       ↓
      │     Member
      │       ↓
      │     Verified Donation
      │
      └──► Task
              ↓
          Task Updates
              ↓
          Completion
```

---

# 68. Meeting Accountability Map

```text
Meeting
  │
  ├── Participants
  │
  ├── Attendance
  │
  └── Decisions
        │
        ▼
      Task
        │
        ▼
  Responsible Member
        │
        ▼
    Work Updates
        │
        ▼
    Completion
```

---

# 69. Attendance Relationship Map

```text
Member
  │
  ├── Jummah Attendance
  │       └── One per Friday
  │
  └── Meeting Attendance
          └── One per meeting
```

---

# 70. Audit Relationship Map

```text
User
 │
 ▼
Action
 │
 ▼
Business Record
 │
 ▼
Audit Event
```

Examples:

```text
Finance
  ↓
Verify Donation
  ↓
Payment
  ↓
Audit Event
```

```text
President
  ↓
Delete Transaction
  ↓
Financial Transaction
  ↓
Audit Event
```

---

# 71. Storage Relationship Map

```text
Business Record
      │
      ▼
File Metadata
      │
      ▼
Object Storage
```

Examples:

```text
Expense
  ↓
Bill

Expense Payment
  ↓
Payment Proof

Task
  ↓
Attachment
```

---

# 72. Delete Dependency Strategy

Historical relationships must survive operational deactivation.

Example:

```text
User deactivated
      ↓
Past audit events remain

Member deactivated
      ↓
Past donations remain

Account deactivated
      ↓
Past financial transactions remain

Task completed
      ↓
Work history remains
```

---

# 73. No Destructive Cascade

Do not use broad cascading deletes across historical domains.

Avoid:

```text
Delete Member
   ↓
Delete Donations
   ↓
Delete Payments
   ↓
Delete Financial Transactions
```

This would compromise auditability.

---

# 74. Deactivation Relationship

For major parent records:

```text
Active
  ↓
Inactive/Deactivated
```

Historical children remain.

Examples:

- Member
- User
- Financial Account
- Financial Category

---

# 75. Historical Stability

Current configuration changes should not rewrite historical meaning.

Examples:

### UPI change

```text
Old Payment Request
→ retains old UPI snapshot
```

### Donation amount change

```text
Old monthly record
→ retains old expected amount
```

### Role change

```text
Old audit event
→ retains original actor ID/action
```

### Referral change

```text
Historical contribution
→ remains attributable according to the approved historical attribution model
```

---

# 76. Cross-Domain Source References

Financial transactions should reference source records where possible.

Examples:

```text
source_type = DONATION
source_id   = payment/donation record

source_type = EXPENSE_PAYMENT
source_id   = expense_payment

source_type = JUMMAH_COLLECTION
source_id   = jummah_collection

source_type = TRANSFER
source_id   = transfer
```

This enables traceability.

---

# 77. Referential Integrity Rules

Core relationships should use foreign keys wherever the data is structurally required.

Foreign keys should protect against:

- Orphan records
- Invalid references
- Accidental parent deletion

---

# 78. Optional Relationships

Some relationships are intentionally optional.

Examples:

```text
User → Member
Payment → Payment Request
Task → Meeting Decision
Task → Related Member
Financial Transaction → Source Record
File → Business Record where generic storage metadata is used
```

Optional relationships must not be converted into mandatory fields without a product reason.

---

# 79. One-to-Many Summary

Key one-to-many relationships:

```text
User → Audit Events
User → Tasks
User → Meetings
User → Notification Tokens
User → Notification Jobs

Member → Donation Terms
Member → Monthly Donations
Member → Additional Donations
Member → Payments
Member → Jummah Attendance
Member → Meeting Attendance

Payment → Payment Allocations

Financial Account → Financial Transactions

Expense → Expense Payments

Task → Task Updates

Meeting → Participants
Meeting → Decisions
Meeting → Attendance

Category → Expenses

Financial Record → Audit Events
```

---

# 80. Many-to-Many Relationships

The main many-to-many relationship is:

```text
Members ↔ Meetings
```

implemented with:

```text
meeting_participants
meeting_attendance
```

A member can attend many meetings, and a meeting can have many members.

---

# 81. Polymorphic Relationships

Two areas may use polymorphic references.

## Audit

```text
resource_type
resource_id
```

## Files

```text
related_type
related_id
```

Polymorphic relationships require careful backend authorization because foreign-key enforcement alone cannot validate the target table.

---

# 82. Referential Integrity vs Authorization

A valid foreign key does not mean a user is authorized to access the referenced record.

Example:

```text
Payment.member_id = valid member ID
```

does not mean every user can read that member/payment.

Authorization remains a separate layer.

---

# 83. Derived Relationships

Some displayed relationships should be computed rather than stored as duplicate data.

Examples:

```text
Committee Member
→ Total Referred Members

Committee Member
→ Total Verified Referral Contribution

Account
→ Current Balance

Committee
→ Completed Task Count
```

These should derive from authoritative records.

---

# 84. No Manual Contribution Totals

Avoid:

```text
committee_member.total_contribution
```

as the only source.

Instead:

```text
Referrals
+
Verified Donations
→
Contribution Aggregate
```

---

# 85. No Manual Dashboard Totals

Avoid permanently editable:

```text
total_members
total_donations
total_expenses
completed_tasks
```

as authoritative data.

These can be derived or safely materialized for performance.

---

# 86. Financial Reporting Relationship

```text
Financial Accounts
      ↓
Financial Transactions
      ↓
Reports
```

Donations/expenses feed the ledger through controlled financial operations.

Reports do not create financial records.

---

# 87. Committee Reporting Relationship

```text
Members
 +
Referrals
 +
Verified Donations
 +
Tasks
 +
Meetings
 +
Attendance
       ↓
Committee Dashboard
```

---

# 88. Audit Reporting Relationship

```text
Audit Events
    +
Financial Records
    +
Relevant Users
    ↓
Audit Review
```

Audit views are read-oriented and controlled.

---

# 89. Notification Relationship

Notifications are downstream of business events.

```text
Business Record
      ↓
Domain Event
      ↓
Notification Job
      ↓
Provider
```

Notification delivery status does not modify the source business record.

---

# 90. Background Job Relationships

Scheduled jobs may interact with:

```text
Monthly Donation Records
Tasks
Notification Jobs
Reports/Temporary Files
```

They should not bypass normal data integrity rules.

---

# 91. Database-Level Integrity Summary

The following relationships must be enforced at the database level where appropriate:

```text
Unique member mobile
Unique user mobile
Unique member/month donation
Unique member/Jummah date
Unique meeting/member attendance
Unique meeting/member participant
Unique financial transaction ID
Unique transfer ID
Unique expense reference
Unique relevant payment reference
Unique storage path
```

---

# 92. Relationship-Level Security Summary

Sensitive relationships must be authorization-checked.

Examples:

```text
Member → Donation
Member → Payment
Expense → Bill
Expense Payment → Payment Proof
Committee Member → Work History
User → Audit Events
```

A valid relationship alone does not grant the current user access.

---

# 93. Relationship-Level Historical Rules

The following must remain stable:

```text
Monthly donation amount on past months
Historical financial transaction source
Past actor identity
Past audit event
Completed work record
Historical meeting record
Past attendance
```

Current profile/settings changes should not destroy these relationships.

---

# 94. Relationship-Level Storage Rules

Do not duplicate:

- Member profile into each donation.
- Financial account information into every transaction unnecessarily.
- Same bill file multiple times.
- Same payment proof multiple times.

Store references.

Store historical snapshots only where required for audit meaning.

---

# 95. Relationship Testing

Database tests must verify:

### Member

```text
One mobile → one member
```

### Donation

```text
One member + month → one monthly record
```

### Referral

```text
One member → one primary referrer
```

### Payment

```text
One verified provider transaction → one financial posting
```

### Attendance

```text
Member + Friday → one record
Member + Meeting → one record
```

### Task

```text
One open task → one successful claimant
```

### Finance

```text
Transfer → two linked effects
```

---

# 96. Relationship Diagram — Complete V1

```text
                     ┌──────────────┐
                     │     USER     │
                     └──────┬───────┘
                            │
                 ┌──────────┼──────────┐
                 │          │          │
                 ▼          ▼          ▼
               ROLE      MEMBER     AUDIT EVENTS
                            │
           ┌────────────────┼──────────────────┐
           │                │                  │
           ▼                ▼                  ▼
       REFERRAL       DONATION TERMS       ATTENDANCE
           │                │             ┌─────┴─────┐
           ▼                ▼             ▼           ▼
        REFERRER     MONTHLY DONATION   JUMMAH     MEETING
                            │           ATTEND.    ATTEND.
                            ▼
                      PAYMENT REQUEST
                            │
                            ▼
                         PAYMENT
                            │
                     ┌──────┴──────┐
                     ▼             ▼
             PAYMENT ALLOC.   ADDITIONAL DONATION
                     │             │
                     └──────┬──────┘
                            ▼
                    FINANCIAL TRANSACTION
                            │
                            ▼
                    FINANCIAL ACCOUNT
                            │
                            ▼
                         BALANCE

FINANCIAL ACCOUNT
       │
       ├──────────► TRANSFER ◄──────────► FINANCIAL ACCOUNT
       │
       └──────────► EXPENSE
                       │
                       ▼
                EXPENSE PAYMENT
                       │
                       ▼
                FINANCIAL TRANSACTION

USER
 │
 ├────────────► TASK
 │                │
 │                ▼
 │           TASK UPDATES
 │
 └────────────► MEETING
                  │
          ┌───────┼───────────┐
          ▼       ▼           ▼
      PARTICIPANTS ATTEND.  DECISIONS
                              │
                              ▼
                            TASK

ALL BUSINESS RECORDS
          │
          ▼
        FILES
          │
          ▼
    OBJECT STORAGE
```

---

# 97. Core Business Chains

## Chain A — Member to Finance

```text
Member
 ↓
Monthly Donation
 ↓
Payment Request
 ↓
Payment
 ↓
Finance Verification
 ↓
Payment Allocation
 ↓
Financial Transaction
 ↓
Financial Account
```

## Chain B — Referral to Contribution

```text
Committee Member
 ↓
Referral
 ↓
Member
 ↓
Verified Donation
 ↓
Contribution Aggregate
```

## Chain C — Meeting to Work

```text
Meeting
 ↓
Decision
 ↓
Task
 ↓
Responsible Member
 ↓
Task Updates
 ↓
Completion
 ↓
Permanent Work History
```

## Chain D — Expense to Audit

```text
Expense
 ↓
Expense Payment
 ↓
Financial Transaction
 ↓
Account Balance
 ↓
Audit Event
 ↓
Report
```

## Chain E — Attendance

```text
Member
 ↓
Jummah
 ↓
Location Validation
 ↓
Attendance Record
```

or:

```text
Meeting
 ↓
Member
 ↓
Meeting Attendance
```

---

# 98. Relationship Invariants

The following must remain true:

1. A member has one current primary referrer in V1.
2. A member has at most one monthly donation record for a given month.
3. A combined payment can allocate across several monthly donation records.
4. Monthly donation allocation follows oldest outstanding month first.
5. Overpayment becomes additional General Donation.
6. Additional donation does not modify future monthly obligations.
7. Verified payment creates the financial effect, not a payment-link click.
8. A financial account has many transactions.
9. Internal transfers move value between accounts without changing overall funds.
10. An expense can have multiple payments.
11. Total expense payments cannot exceed the authorized expense amount under normal rules.
12. One member can have many Jummah records, but only one per Friday.
13. One member can have many meeting attendance records, but only one per meeting.
14. One open task has only one successful claimant.
15. Meeting decisions can exist without tasks.
16. Tasks may reference meetings/decisions.
17. Files are referenced by business records and stored separately.
18. Important actions can generate audit events.
19. Historical records are not deleted merely to save storage.
20. Dashboard totals are derived from authoritative records.

---

# 99. Relationship Change Rule

If a product requirement changes a relationship:

```text
Requirement
 ↓
Data model impact review
 ↓
Schema/document update
 ↓
Migration plan
 ↓
Implementation
 ↓
Integrity testing
```

Do not silently change relationships in application code.

---

# 100. Definition of Done

The relationship model is ready for implementation when:

- All major entities have identified parents/children.
- One-to-one relationships are defined.
- One-to-many relationships are defined.
- Many-to-many relationships are defined.
- Optional relationships are defined.
- Financial chains are defined.
- Committee accountability chains are defined.
- File relationships are defined.
- Audit relationships are defined.
- Historical stability rules are defined.
- Foreign-key strategy is understood.
- Unique constraints are identified.
- Derived relationships are distinguished from authoritative data.
- No core workflow depends on an undocumented relationship.

---

# 101. Related Documents

- `PROJECT_OVERVIEW.md`
- `PRODUCT_REQUIREMENTS.md`
- `FEATURE_SCOPE.md`
- `USER_ROLES_PERMISSIONS.md`
- `SYSTEM_ARCHITECTURE.md`
- `APPLICATION_ARCHITECTURE.md`
- `DATABASE_ARCHITECTURE.md`
- `DATABASE_SCHEMA.md`
- `FINANCIAL_DATA_MODEL.md`
- `COMMITTEE_DATA_MODEL.md`
- `AUDIT_LOG_MODEL.md`
- `SECURITY_ARCHITECTURE.md`
- `STORAGE_STRATEGY.md`
- `DEVELOPMENT_TASKS.md`

---

## Document Status

**Data Relationships — V1 Implementation Baseline**

This document defines the relational structure connecting the major application domains.

The exact SQL implementation must remain consistent with this relationship model and the approved product requirements.
