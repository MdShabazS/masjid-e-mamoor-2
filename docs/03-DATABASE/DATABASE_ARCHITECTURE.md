# Masjid-e-Mamoor 2 — Database Architecture

**Document Status:** Baseline  
**Version:** 1.0  
**Product:** Masjid-e-Mamoor 2 Internal Management Application  
**Scope:** V1  
**Last Updated:** 2026-09-17

---

## 1. Purpose

This document defines the database architecture for the Masjid-e-Mamoor 2 application.

The database is one of the most critical components of the product because it stores the authoritative records for:

- Members
- Referrals
- Monthly donations
- Additional donations
- Payment verification
- Financial accounts
- Financial transactions
- Expenses
- Expense payments
- Transfers
- Committee tasks
- Work history
- Meetings
- Meeting decisions
- Meeting attendance
- Jummah attendance
- Users and roles
- Notifications
- Audit events
- Application/Masjid settings
- File metadata

The final implementation is based on **PostgreSQL through Supabase**.

This document defines the architectural model. The exact table-by-table schema is maintained separately in:

- `DATABASE_SCHEMA.md`
- `DATA_RELATIONSHIPS.md`
- `FINANCIAL_DATA_MODEL.md`
- `COMMITTEE_DATA_MODEL.md`
- `AUDIT_LOG_MODEL.md`

---

# 2. Database Goals

The database must prioritize:

1. Financial integrity
2. Referential integrity
3. Strong transactional consistency
4. Auditability
5. Permanent financial history
6. Permanent committee work history
7. Secure record-level access
8. Efficient search/reporting
9. Minimal duplication
10. Low storage overhead
11. Safe concurrency
12. Maintainability

---

# 3. Database Technology

## Selected

**PostgreSQL via Supabase**

PostgreSQL is selected because V1 contains strongly relational domains and financial workflows that benefit from:

- Foreign keys
- Unique constraints
- Transactions
- Exact numeric values
- Aggregation
- Indexes
- Check constraints
- Database functions
- Row Level Security
- Atomic concurrency control

---

# 4. Database Architecture Model

Conceptually:

```text
┌────────────────────────────────────────────────────────┐
│                    APPLICATION DATA                    │
├────────────────────────────────────────────────────────┤
│ Users / Roles                                          │
│ Members / Referrals                                    │
│ Donations / Payments                                   │
│ Finance / Expenses / Transfers                        │
│ Committee / Tasks / Work History                      │
│ Meetings / Decisions / Attendance                     │
│ Notifications / Settings                             │
│ Audit Events                                           │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│                 POSTGRESQL DATABASE                    │
│                                                        │
│ Constraints • Transactions • Indexes • RLS • Views     │
│ Functions / RPC where appropriate                      │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
                  ┌────────────────────┐
                  │ Supabase Services  │
                  │ Auth / Storage     │
                  └────────────────────┘
```

---

# 5. Domain Areas

The database is logically divided into the following domains.

```text
1. Identity & Access
2. Members
3. Referrals
4. Donations
5. Payments
6. Finance
7. Expenses
8. Committee Work
9. Meetings
10. Attendance
11. Notifications
12. Reports / Derived Data
13. Audit
14. Settings
15. File Metadata
```

---

# 6. Identity & Access Domain

Core entities:

```text
users
roles
user_roles or role assignment
```

The final representation will depend on whether the application uses one role per user or a controlled role-assignment model.

V1 product requirements define a primary operational role for each user.

The President is the Super Admin.

---

# 7. User Identity

The authentication provider owns the authentication identity.

The application database should maintain an application-level user record linked to the authenticated identity.

Conceptually:

```text
Auth Identity
     │
     └──► Application User
                │
                └──► Role
```

Do not duplicate authentication secrets in application tables.

---

# 8. Role Data

Roles are controlled application data.

V1 roles:

- President
- Vice President
- Secretary
- Finance / Financer
- Auditor
- Committee Member
- Member

Role names should be stored using stable identifiers rather than UI display strings.

---

# 9. Member Domain

Core entity:

```text
members
```

A member record should reference the application user when the person has an authenticated application account.

Conceptually:

```text
Member
 ├── User identity
 ├── Profile
 ├── Primary Referrer
 ├── Donation schedule
 ├── Donation history
 └── Attendance
```

---

# 10. Mobile Number Uniqueness

Mobile number is the primary uniqueness check for members.

The database must enforce uniqueness.

Conceptually:

```text
UNIQUE(normalized_mobile_number)
```

Do not rely only on application-level duplicate checks.

This protects against concurrent registration requests.

---

# 11. Member vs User

Not every historical/financial donor record needs to be a user login.

The distinction is:

```text
User
→ Can authenticate into application

Member
→ Registered Masjid member

Donor
→ Financial source/person associated with donation
```

An anonymous donation does not require a Member or User record.

---

# 12. Referral Domain

Core relationship:

```text
members
   ↓
primary_referrer_id
   ↓
committee member
```

V1 allows one primary referrer per member.

The relationship should be represented using a foreign key to the Committee Member's application user/member identity as appropriate.

---

# 13. Referral Attribution History

Current referral attribution belongs to the member relationship.

When President changes the referrer:

```text
Old Referrer
     ↓
New Referrer
```

The change should generate an audit event.

A separate historical referral-version table is not mandatory in V1 unless later required.

---

# 14. Donation Domain

Donation data is separated from the financial ledger.

Main conceptual entities:

```text
monthly_donation_records
additional_donations
payment_records
```

This separation allows the system to distinguish:

- What was due
- What payment occurred
- What Finance verified
- What was financially posted

---

# 15. Monthly Donation Record

A monthly donation record represents the agreed monthly contribution for one member and one donation month.

Conceptually:

```text
Member
 +
Donation Month
 =
One Monthly Donation Record
```

Database uniqueness should enforce:

```text
UNIQUE(member_id, donation_month)
```

---

# 16. Monthly Amount History

Monthly amount changes must preserve historical records.

Recommended model:

```text
member_donation_terms
---------------------
member_id
amount
effective_from_month
```

The exact table name may differ.

A change in future terms must not rewrite completed historical months.

---

# 17. Donation Amount Effective Month

For a member:

```text
July  → ₹500
August → ₹500
September → ₹700
```

The database should identify the applicable amount for each month.

Do not update historical monthly records merely because the member's current agreed amount changed.

---

# 18. Donation Status Model

The final status vocabulary should be centralized.

Conceptually:

```text
DUE
PENDING
PAID / VERIFIED
EXPIRED
```

Exact status transitions are governed by the product requirements.

An expired payment link must not delete the underlying pending donation record.

---

# 19. Additional Donation

Additional voluntary donations are separate from monthly commitments.

They use:

```text
General Donation
```

No purpose category is required in V1.

Additional donation:

- Has its own financial identity.
- Does not change monthly amount.
- Does not advance future monthly dues.

---

# 20. Anonymous Donation

Anonymous donations do not require:

- Member record
- User record
- Referrer record

They require enough financial data for audit:

- Amount
- Date
- Method/account
- Verification
- Actor
- Transaction information where applicable

---

# 21. Payment Domain

Payment records represent the payment process and verification state.

Conceptually:

```text
Donation
   ↓
Payment Request
   ↓
Payment Attempt
   ↓
Payment Evidence
   ↓
Finance Verification
```

Payment is not automatically equivalent to financial verification.

---

# 22. Payment Reference Uniqueness

If a provider supplies an external transaction/reference ID, the system should enforce uniqueness where applicable.

This protects against:

- Duplicate verification
- Provider retries
- Replayed events

Example conceptual constraint:

```text
UNIQUE(provider_name, external_transaction_id)
```

when both values are present.

---

# 23. Combined Payment

A single verified payment may settle multiple complete monthly records.

The database should support a relationship such as:

```text
payment
   │
   ├── allocation → July
   ├── allocation → August
   └── allocation → September
```

This can be represented through a payment-allocation table.

The exact structure is defined in `FINANCIAL_DATA_MODEL.md`.

---

# 24. Payment Allocation

Each allocation should include:

- Payment ID
- Monthly donation ID
- Allocated amount
- Allocation order/sequence

For monthly commitments, allocations must represent complete-month settlement.

---

# 25. Overpayment Allocation

Example:

```text
Outstanding = ₹1,000
Payment     = ₹1,200
```

Database result:

```text
Payment
 ├── ₹1,000 allocated to monthly dues
 └── ₹200 additional General Donation
```

The extra amount must not become a future-month credit.

---

# 26. Financial Domain

Core entities:

```text
financial_accounts
financial_transactions
transfers
```

Finance is the authoritative accounting domain.

---

# 27. Financial Account

Each account represents a Masjid financial bucket.

Examples:

- Cash
- Bank
- UPI
- Other legitimate account

Each account should contain:

- Stable ID
- Name
- Type
- Status
- Opening balance
- Metadata
- Creation/update timestamps

---

# 28. Account Status

An account can be active or deactivated.

Deactivation must not remove historical transactions.

Conceptually:

```text
Active
  ↓
Deactivated
```

Historical references remain valid.

---

# 29. Financial Transaction

A financial transaction represents an accounting effect.

It should contain a unique system-generated transaction ID.

Conceptual fields:

```text
transaction_id
account_id
transaction_date
direction
amount
category
reference
description
source_type
source_id
created_by
created_at
```

Exact schema belongs in `FINANCIAL_DATA_MODEL.md`.

---

# 30. Monetary Representation

Financial amounts must use exact numeric representation.

Avoid floating-point values such as JavaScript `number` for authoritative financial arithmetic.

Recommended PostgreSQL approach:

```text
NUMERIC / DECIMAL
```

or a carefully designed integer minor-unit model.

The exact representation will be locked in the financial schema document.

---

# 31. Financial Direction

The ledger must clearly distinguish:

```text
CREDIT / INCOME
DEBIT / EXPENSE
```

The exact naming convention should remain consistent across the database.

---

# 32. Internal Transfers

Transfers move money between two accounts without changing overall Masjid funds.

Conceptually:

```text
Transfer
 ├── source account effect
 └── destination account effect
```

Both sides must share a:

```text
transfer_id
```

The operation must be atomic.

---

# 33. Transfer Integrity

For a transfer:

```text
Source Amount = Destination Amount
```

and:

```text
Overall Masjid Funds = Unchanged
```

unless a separately documented fee/adjustment model applies.

V1 does not automatically introduce transfer fees.

---

# 34. Financial Balances

An account balance is conceptually:

```text
Opening Balance
+
Credits
-
Debits
=
Current Balance
```

If a materialized balance is stored for performance, it must remain consistent with the authoritative transaction ledger.

---

# 35. Negative Balance

The database should not blindly prevent negative balances if the approved product requirements permit them.

A negative result may be stored with appropriate application warning/visibility.

The business system should not hide inconsistent financial activity simply because the result is negative.

---

# 36. Financial Transaction Deletion

Financial transaction deletion is President-only.

When deleted:

- Authorization must be enforced.
- Related balances/reporting must update correctly.
- The action must be audited.
- Dependent records must be handled deliberately.

Foreign-key behavior must not silently cascade into destructive deletion of unrelated financial history.

---

# 37. Financial Corrections

When the product requires an amount correction:

```text
Same Transaction Identity
+
New Amount
+
Reason
+
Actor
+
Timestamp
```

The database should preserve the required correction information.

A full immutable-version history is not required unless separately approved, but important changes must be auditable.

---

# 38. Expense Domain

Core entities:

```text
expenses
expense_payments
```

Files are stored separately in object storage with database metadata.

---

# 39. Expense Record

An expense should include:

- Expense/transaction ID
- Amount
- Date
- Category
- Description
- Status
- Created by
- Created timestamp
- Supporting bill reference

---

# 40. Expense Payment

One expense may have multiple payments.

Relationship:

```text
Expense
   │
   ├── Payment 1
   ├── Payment 2
   └── Payment 3
```

Each payment should record:

- Amount
- Account
- Payment method
- Date
- Reference
- Proof reference
- Created by
- Timestamp

---

# 41. Expense Payment Constraint

Normal operation must enforce:

```text
SUM(expense payments) ≤ expense amount
```

The final expense status is derived from payment state according to business rules.

---

# 42. Expense Status

V1:

```text
ADDED
PARTIALLY_PAID
PAID
CANCELLED
```

State changes must be validated server-side.

---

# 43. Expense Cancellation

Cancellation requires:

- Authorized Finance user
- Reason
- Status transition
- Audit event

Historical record remains in the database.

---

# 44. Expense Amount Correction

Amount correction requires:

- Authorization
- Previous amount
- New amount
- Mandatory reason
- Actor
- Timestamp

The new amount must remain consistent with payments already recorded.

---

# 45. Bill and Payment Proof Metadata

The database should store file metadata instead of binary document content in normal financial tables.

Example:

```text
file_id
storage_path/reference
file_name
mime_type
size
uploaded_by
uploaded_at
related_record_id
```

Exact implementation belongs in file/storage schema.

---

# 46. Committee Work Domain

Core entities:

```text
tasks
task_assignments / ownership
task_comments or progress_updates
work_history
```

The exact normalization will be finalized during schema design.

---

# 47. Task

A task contains:

- Task ID
- Title
- Description
- Priority
- Deadline
- Status
- Responsible member where assigned
- Related meeting/decision where applicable
- Created by
- Created timestamp
- Completion information

---

# 48. Task Assignment

Directly assigned tasks should identify the responsible member.

Open tasks begin without a claimant.

Claiming changes the authoritative task ownership.

---

# 49. Task Claim Concurrency

The database must prevent two members from claiming one open task.

Use a conditional/atomic database operation.

Conceptually:

```text
UPDATE task
SET responsible_member_id = X
WHERE task_id = Y
  AND responsible_member_id IS NULL
  AND task_is_claimable = TRUE
```

The operation succeeds for only one requester.

---

# 50. Task Status

Conceptually:

```text
CREATED
ASSIGNED / CLAIMED
IN_PROGRESS
COMPLETED
OVERDUE
```

The exact stored status model should avoid redundant/conflicting states.

For example, overdue may be derived from:

```text
deadline < current time
AND incomplete
```

rather than requiring permanent duplication of state.

The final implementation decision belongs in the schema/service design.

---

# 51. Work History

Completed committee work is a core historical record.

The database must preserve:

- Task
- Responsible member
- Completion date
- Completion note
- Relevant relationship
- Creation and update metadata

Work history must not be removed for storage optimization.

---

# 52. Work Edit Metadata

Committee Members may edit their own completed work records.

At minimum, retain:

- Last edited by
- Last edited timestamp

The system does not require a full multi-version history in V1 unless later approved.

---

# 53. Meeting Domain

Core entities:

```text
meetings
meeting_participants
meeting_decisions
```

Follow-up tasks reference the relevant meeting/decision.

---

# 54. Meeting Record

Meeting fields may include:

- Meeting ID
- Title
- Date/time
- Location
- Agenda
- Status
- Created by
- Created timestamp
- Minutes/decision information as applicable

---

# 55. Meeting Participants

A meeting should identify invited/eligible members.

Attendance status is stored separately or as an appropriate meeting-participation attribute.

The exact schema should avoid duplicated attendance information.

---

# 56. Meeting Decisions

A decision belongs to a meeting.

Conceptually:

```text
Meeting
   ↓
Decision
```

A decision may have:

```text
No task
```

or:

```text
Decision
   ↓
Task
```

---

# 57. Decision-to-Task Relationship

Tasks generated from decisions should reference the originating meeting/decision.

This allows:

```text
Meeting
→ Decision
→ Task
→ Responsible Member
→ Completion
```

to be queried directly.

---

# 58. Attendance Domain

V1 contains only:

- Jummah attendance
- Scheduled committee meeting attendance

No daily prayer attendance tables are required.

---

# 59. Jummah Attendance

Conceptual entity:

```text
jummah_attendance
```

Required relationship:

```text
member + Friday/date
```

Database uniqueness should enforce:

```text
UNIQUE(member_id, jummah_date)
```

---

# 60. Meeting Attendance

Conceptual entity:

```text
meeting_attendance
```

Database uniqueness:

```text
UNIQUE(meeting_id, member_id)
```

This prevents duplicate attendance for the same member and meeting.

---

# 61. GPS Data

Jummah attendance may store the minimum location data required for validation.

Potential fields:

- Latitude
- Longitude
- Accuracy
- Validation result
- Captured timestamp

The final retention policy should avoid storing unnecessary continuous location data.

No continuous tracking table is required.

---

# 62. Offline Attendance

Offline client events should synchronize into the authoritative attendance table.

A client-generated operation ID can be stored to protect against duplicate synchronization.

Example:

```text
client_operation_id
```

with a uniqueness rule where appropriate.

---

# 63. Notification Domain

Potential entities:

```text
notification_tokens
notification_events
notification_delivery_attempts
```

The exact schema should avoid creating a large notification history system because notification inbox/history is outside V1.

Token records may still be required for push delivery.

---

# 64. Notification Token

A mobile installation may have:

- User ID
- Platform
- Push token
- Active/inactive state
- Last-seen timestamp

Invalid tokens should be deactivated rather than retained indefinitely.

---

# 65. Audit Domain

Core entity:

```text
audit_events
```

Audit events are business/security records.

They are different from technical application logs.

---

# 66. Audit Event

Minimum useful fields:

```text
event_id
timestamp
actor_user_id
action
resource_type
resource_id
result
metadata
```

The exact schema belongs in `AUDIT_LOG_MODEL.md`.

---

# 67. Audit Event Immutability

Normal application users must not modify historical audit events.

The application should treat audit records as append-oriented.

---

# 68. Settings Domain

Potential entities:

```text
masjid_settings
configuration_history
```

Settings include approved operational configuration such as:

- Active UPI ID
- Attendance radius
- Language configuration

Important settings changes must be auditable.

---

# 69. File Metadata Domain

Files are stored in object storage.

Database records reference those files.

Conceptually:

```text
Database File Metadata
       ↓
Storage Object
```

A file record should identify:

- File ID
- Storage location/reference
- MIME type
- Size
- Original filename
- Related resource
- Uploaded by
- Timestamp
- Active/deleted state where appropriate

---

# 70. Referential Integrity

Use foreign keys for meaningful relationships.

Examples:

```text
donation.member_id → members.id
payment.donation_id → donation.id
expense_payment.expense_id → expenses.id
task.meeting_decision_id → meeting_decisions.id
meeting_attendance.meeting_id → meetings.id
meeting_attendance.member_id → members.id
```

Avoid nullable foreign keys where a relationship is logically mandatory.

---

# 71. Deletion Strategy

Do not use broad cascading deletes for core historical domains.

Especially protect:

- Financial transactions
- Donations
- Expenses
- Payments
- Transfers
- Committee work history
- Meetings
- Audit records

When an entity needs to be retired, prefer:

```text
Deactivate
```

rather than deleting historical records.

---

# 72. Soft Delete Policy

Soft delete may be used selectively for records that need reversible operational removal.

However, do not automatically add `deleted_at` to every table.

For financial records:

- Deletion must follow the explicit President-only workflow.
- Historical/audit behavior must remain intact.

For core committee work history:

- Completed work is not deleted by Committee Members.

---

# 73. Unique Constraints

Important uniqueness constraints include:

```text
members.normalized_mobile
members + donation_month
members + jummah_date
meetings + member
external payment reference
one primary referrer per member
```

The exact SQL constraints are documented in `DATABASE_SCHEMA.md`.

---

# 74. Check Constraints

Use database check constraints where practical.

Examples:

```text
amount > 0
```

for positive financial amounts where negative values are not semantically valid.

Other examples:

- Valid status values
- Valid percentage ranges
- Valid relationships

Do not use check constraints that prevent legitimate approved business cases.

---

# 75. Indexing Strategy

Indexes should support actual query patterns.

Likely indexed fields:

### Members

- normalized mobile
- name/search field where needed
- status
- referrer

### Donations

- member
- donation month
- status
- payment reference where applicable

### Finance

- account
- transaction date
- transaction ID
- type
- category
- reference

### Expenses

- date
- status
- category

### Tasks

- responsible member
- status
- deadline
- meeting/decision relationship

### Attendance

- member
- date
- meeting

### Audit

- timestamp
- actor
- resource type
- resource ID

---

# 76. Index Discipline

Do not create indexes for every column.

Each index adds:

- Storage
- Write overhead
- Maintenance cost

Indexes should be justified by:

- Search
- Filtering
- Joining
- Sorting
- Uniqueness

Measure real production query behavior before adding excessive indexes.

---

# 77. Composite Indexes

Use composite indexes for common multi-column filters.

Examples:

```text
(member_id, donation_month)
(member_id, status)
(account_id, transaction_date)
(meeting_id, member_id)
(member_id, jummah_date)
(resource_type, resource_id, timestamp)
```

The final list should be based on query plans after schema implementation.

---

# 78. Reporting Data

Avoid creating a second full financial database only for reports.

Prefer:

```text
Authoritative Tables
      ↓
Queries / Views / Aggregations
      ↓
Report
```

Derived summary tables may be introduced later only when real performance needs justify them.

---

# 79. Materialized/Dervied Summaries

If dashboards become expensive:

```text
Authoritative Data
      ↓
Derived Aggregate
```

may be used for performance.

However:

- The underlying ledger remains authoritative.
- Summary data must be refreshable/rebuildable.
- Financial truth must not depend solely on a manually maintained summary.

---

# 80. Views

Database views may be useful for:

- Account balances
- Donation status summaries
- Committee progress
- Referral contributions
- Audit reporting

Views should remain derived representations.

They must not become a hidden second source of truth.

---

# 81. Financial Aggregation

For a report:

```text
Opening Balance
+
Credits
-
Debits
=
Closing Balance
```

The query logic must be deterministic.

The application should use the same financial definitions across dashboards and PDF reports.

---

# 82. Referral Contribution Aggregation

Committee contribution should be derived from:

```text
Primary Referrer
      +
Finance-Verified Donation
```

Do not store manually editable totals such as:

```text
committee_member.total_donation = ₹75,000
```

as the only source.

Instead derive from authoritative member/referral/donation/financial data.

---

# 83. Committee Work Aggregation

Committee progress may be derived from tasks/work records:

```text
Total Tasks
Completed
In Progress
Pending
Overdue
```

The aggregation must not require a manually maintained "performance score."

---

# 84. Attendance Aggregation

Attendance summaries should derive from:

- Jummah attendance
- Meeting attendance

No separate manually editable attendance total should be the sole source of truth.

---

# 85. Row Level Security

Supabase/PostgreSQL RLS is part of the security boundary.

RLS policies should protect rows according to:

- Authenticated identity
- Role
- Ownership
- Record relationships

However:

**Application-level authorization remains mandatory.**

---

# 86. RLS Policy Principles

Examples:

### Member

Can access permitted own records.

### Committee Member

Can access permitted own work/referral information.

### Auditor

Can read authorized financial information.

### Finance

Can perform permitted financial operations.

### President

Has broad authorized access.

Exact policies belong in security/schema implementation documentation.

---

# 87. RLS and Service Role

Service-role backend operations bypass RLS.

Therefore:

- Service-role credentials remain server-side.
- They must be used only in trusted backend functions.
- Business authorization must still be evaluated intentionally.

Do not use the service role as an excuse to bypass all application permission logic.

---

# 88. Database Functions

Database functions/RPCs may be used where atomicity is important.

Good candidates:

- Atomic task claim
- FIFO payment allocation
- Internal transfer
- Financial posting
- Duplicate-safe attendance insertion

Avoid moving the entire application domain into database functions.

---

# 89. Transaction Boundaries

The database must support atomic operations.

### Verify Donation

Potentially updates:

- Payment
- Donation status
- Financial transaction
- Referral contribution effect
- Audit

### Expense Payment

Potentially updates:

- Expense payment
- Financial transaction
- Expense status
- Audit

### Transfer

Potentially updates:

- Source effect
- Destination effect
- Transfer link
- Audit

---

# 90. Concurrency

Use database-level controls for race-sensitive operations.

Examples:

```text
Duplicate member registration
Double task claim
Duplicate attendance
Duplicate payment verification
Duplicate monthly record creation
Simultaneous financial writes
```

---

# 91. Idempotency Storage

Where required, store a stable operation identifier.

Potential examples:

```text
client_operation_id
provider_event_id
idempotency_key
```

The exact identifiers depend on integration requirements.

---

# 92. Date and Time

Use a consistent database time strategy.

Recommended:

- Timestamp with time zone for event timestamps.
- Date for date-only business concepts.
- Separate donation month representation where useful.

Examples of timestamps:

- Created at
- Verified at
- Completed at
- Audit timestamp

Examples of date-only values:

- Donation month
- Jummah date
- Expense date where time is not operationally relevant

---

# 93. Application Timezone

The application serves one Masjid in India.

The final deployment configuration should use a fixed authoritative timezone for system operations.

Do not let every device define the business date independently.

---

# 94. Data Normalization

Normalize core relational data to avoid unnecessary duplication.

Example:

Do not copy the entire member profile into every donation row.

Store:

```text
donation.member_id
```

and reference the member record.

Historical financial data should still retain the information that must be immutable for audit purposes.

---

# 95. Historical Snapshot Principle

Some historical values may need to be stored on transaction records even when they are derived from current entities.

Example:

A financial transaction may retain:

- Description
- External reference
- Account at time of transaction
- Relevant amount/context

This prevents later configuration changes from destroying historical meaning.

The exact snapshot fields are defined in the financial model.

---

# 96. Data Duplication Rule

Avoid unnecessary duplication.

Good duplication:

- Historical snapshot required for audit.
- Denormalized aggregate required for measured performance.
- Immutable transaction metadata.

Bad duplication:

- Copying full member profile into every donation.
- Copying the same file multiple times.
- Maintaining manually editable totals that can be derived.

---

# 97. Storage Efficiency

Database storage should be optimized by:

- Appropriate data types
- Normalization
- Index discipline
- Avoiding unnecessary large text
- File storage outside the database
- Deleting only temporary technical artifacts where approved

Do not remove financial or committee history for storage savings.

---

# 98. Financial Data Retention

Financial records must remain permanently available according to V1 requirements.

This includes:

- Donations
- Expenses
- Payments
- Transfers
- Financial transactions
- Supporting references
- Required correction information

---

# 99. Committee Data Retention

Committee accountability records must remain permanently available.

This includes:

- Completed tasks
- Work history
- Meeting history
- Decisions
- Follow-up relationships
- Relevant contribution history

---

# 100. Audit Data Retention

Important audit records should remain available for the required application history.

Technical logs may use separate retention policies.

---

# 101. Database Backup Requirement

Because the application relies on financial records, database backup is mandatory before production.

The backup strategy must cover:

- PostgreSQL database
- Required file metadata
- Required stored documents
- Configuration necessary for recovery

The detailed backup design belongs in:

`BACKUP_AND_RECOVERY.md`

---

# 102. Restore Validation

A backup is not considered valid merely because a file exists.

The project should periodically verify that:

```text
Backup
  ↓
Restore
  ↓
Application Connectivity
  ↓
Data Integrity
```

works correctly.

---

# 103. Production Database Access

Production database access must be restricted.

Developers should not use unrestricted production credentials for normal development.

Use:

- Controlled migrations
- Separate environments
- Restricted service accounts
- Auditable administrative access

---

# 104. Development/Test Database

Development and test environments should use separate data.

Do not routinely copy production financial/member data into local environments.

Use synthetic test data.

---

# 105. Migration Strategy

Schema changes must be delivered through versioned migrations.

Conceptually:

```text
001_initial_schema
002_roles
003_members
004_donations
...
```

Every migration must be committed to Git.

---

# 106. Migration Safety

Before a production migration:

- Run tests.
- Review affected tables.
- Check financial impact.
- Check constraints.
- Test rollback/recovery strategy where possible.
- Validate important reports after migration.

---

# 107. Production Schema Protection

Do not permit arbitrary client-generated schema changes.

Schema changes happen through controlled development/deployment processes.

---

# 108. Database Monitoring

Monitor:

- Database size
- Query performance
- Slow queries
- Connection health
- Error rates
- Storage growth
- Backup state
- Constraint failures

---

# 109. Query Performance

Use:

- Proper indexes
- Pagination
- Aggregate queries
- Query-plan analysis
- Avoidance of N+1 query patterns
- Appropriate joins

Do not optimize blindly.

---

# 110. N+1 Query Avoidance

Example bad pattern:

```text
Load 100 members
      ↓
Query donations for each member
      ↓
100+ queries
```

Prefer appropriate joins/aggregations.

---

# 111. Financial Query Performance

Finance/report queries may involve large historical datasets.

Prefer:

- Date filtering
- Account filtering
- Indexed transaction dates
- Database aggregation
- Pagination for transaction lists

Do not fetch the full financial ledger into the client for ordinary views.

---

# 112. Audit Query Performance

Audit logs may become large.

Use:

- Timestamp indexes
- Actor indexes
- Resource indexes
- Pagination
- Date filters

Do not treat audit logs as an unrestricted infinite query.

---

# 113. Data Access Layer

Application code should use a controlled data-access layer.

Conceptually:

```text
Application Service
      ↓
Repository / Query Service
      ↓
PostgreSQL
```

This keeps database-specific logic organized.

---

# 114. Database Naming Convention

Use a consistent naming style.

Recommended:

- lowercase
- snake_case
- singular/plural convention selected once
- stable IDs
- explicit foreign-key names

Example:

```text
financial_transactions
member_id
created_at
updated_at
```

The repository must use one convention consistently.

---

# 115. Primary Key Strategy

Use stable non-semantic IDs for core records.

Do not encode business meaning directly into database primary keys.

Example:

```text
UUID / equivalent generated ID
```

A separate human-readable transaction number may exist for financial records.

---

# 116. Public vs Internal Identifiers

Where useful, distinguish:

```text
Internal record ID
```

from:

```text
Human-readable Transaction ID
```

Do not expose unnecessary internal database identifiers if a safer public/reference identifier is appropriate.

---

# 117. UUID Strategy

UUIDs are suitable for:

- Users
- Members
- Donations
- Payments
- Accounts
- Tasks
- Meetings
- Audit events
- Files

Human-readable numbers can be added for operational records where useful.

---

# 118. Transaction ID Strategy

Every financial transaction receives a unique system-generated transaction ID.

The same transaction identity should remain through normal corrections.

---

# 119. File Reference Strategy

Files should reference the associated domain record:

```text
Expense → Bill
Expense Payment → Payment Proof
Task → Task Attachment
```

This relationship must be authorized.

---

# 120. Cascade Rules

Use restrictive or carefully controlled foreign-key behavior for historical domains.

Avoid:

```text
DELETE Member
→ CASCADE
→ Delete all donations
→ Delete all finance history
```

This is unacceptable for core historical data.

Prefer preventing deletion or deactivating the parent.

---

# 121. Member Deactivation

If a member should no longer be active:

```text
Member
   ↓
Inactive
```

Historical donation/referral/attendance records remain.

Do not delete a member solely because the person is inactive.

---

# 122. User Deactivation

If an application user leaves committee/service:

```text
User
   ↓
Inactive
```

Historical actions remain attributed to the original user.

Do not erase historical actor identity.

---

# 123. Role Change History

When a user changes roles:

- Current role changes.
- Historical audit identifies the change.
- Past records retain their original actor identity.

Do not rewrite history as though the user always had the new role.

---

# 124. Financial Actor Attribution

Financial records should retain:

- Who created
- Who verified
- Who corrected
- Who deleted where applicable

These should reference the application user.

---

# 125. Audit Actor Attribution

Audit records should reference the actor's stable application user identity.

If the user later becomes inactive, historical audit entries still identify the actor.

---

# 126. Database Security Invariants

1. Financial values use exact monetary representation.
2. Core relationships use foreign keys.
3. Member mobile uniqueness is database-enforced.
4. Member/month donation uniqueness is database-enforced.
5. Attendance uniqueness is database-enforced.
6. External payment references are protected from duplicate processing.
7. Open task claiming is atomic.
8. Financial operations use transactions where required.
9. Historical financial records are not automatically deleted.
10. Committee work history is not automatically deleted.
11. Sensitive rows are protected by RLS/application authorization.
12. Service-role credentials are never sent to clients.
13. Production data is separated from development data.
14. Schema changes are version-controlled.
15. Financial balances remain derived from authoritative financial records.
16. Dashboard totals are derived from authoritative records.
17. Audit events are generated by trusted server-side operations.
18. Broad cascading deletion is prohibited for core historical domains.

---

# 127. V1 Database Exclusions

The database does not include dedicated structures for:

- Multi-Masjid tenancy in V1
- Public Masjid directory
- Daily prayer attendance for Fajr/Zohr/Asr/Maghrib/Isha
- Donation ranking
- Committee scoring
- Asset/property management
- Bank reconciliation
- Advances
- Full notification inbox/history
- Custom permission profiles

---

# 128. Exact Schema Dependency

This architecture document must be followed by detailed schema documentation.

Required next database documents:

1. `DATABASE_SCHEMA.md`
2. `DATA_RELATIONSHIPS.md`
3. `FINANCIAL_DATA_MODEL.md`
4. `COMMITTEE_DATA_MODEL.md`
5. `AUDIT_LOG_MODEL.md`

These documents should contain the exact tables, columns, constraints, relationships, indexes, and database functions required for implementation.

---

# 129. Database Implementation Order

The database should be implemented approximately in this dependency order:

```text
1. Authentication/User linkage
2. Roles
3. Members
4. Referrals
5. Donation terms
6. Monthly donations
7. Payments
8. Financial accounts
9. Financial transactions
10. Expenses
11. Expense payments
12. Transfers
13. Tasks
14. Work history
15. Meetings
16. Decisions
17. Meeting attendance
18. Jummah attendance
19. Notification tokens/events
20. Audit events
21. Settings
22. File metadata
```

The exact migration sequence may differ where foreign-key dependencies require it.

---

# 130. Definition of Done

Database architecture is ready for implementation when:

- All V1 domains are identified.
- Data ownership is defined.
- Core relationships are defined.
- Financial integrity rules are defined.
- Uniqueness requirements are defined.
- Transaction boundaries are identified.
- Concurrency-sensitive operations are identified.
- RLS/security boundaries are identified.
- Retention rules are identified.
- Storage/file boundaries are identified.
- Indexing strategy is identified.
- Migration strategy is identified.
- Backup requirements are identified.
- The exact schema can be documented without inventing missing product behavior.

---

# 131. Related Documents

- `PROJECT_OVERVIEW.md`
- `PRODUCT_REQUIREMENTS.md`
- `FEATURE_SCOPE.md`
- `USER_ROLES_PERMISSIONS.md`
- `SYSTEM_ARCHITECTURE.md`
- `APPLICATION_ARCHITECTURE.md`
- `BACKEND_ARCHITECTURE.md`
- `BACKEND_FRAMEWORK.md`
- `TECHNOLOGY_STACK.md`
- `DATABASE_SCHEMA.md`
- `DATA_RELATIONSHIPS.md`
- `FINANCIAL_DATA_MODEL.md`
- `COMMITTEE_DATA_MODEL.md`
- `AUDIT_LOG_MODEL.md`
- `SECURITY_ARCHITECTURE.md`
- `STORAGE_STRATEGY.md`
- `BACKUP_AND_RECOVERY.md`
- `DEVELOPMENT_TASKS.md`

---

## Document Status

**Database Architecture — V1 Baseline**

This document defines the logical database architecture for Masjid-e-Mamoor 2.

The next database document should define the exact PostgreSQL schema, including tables, columns, constraints, indexes, foreign keys, and required database functions.
