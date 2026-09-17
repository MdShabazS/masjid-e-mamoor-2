# Masjid-e-Mamoor 2 — Database Schema

**Document Status:** V1 Implementation Baseline  
**Version:** 1.0  
**Database:** PostgreSQL via Supabase  
**Product:** Masjid-e-Mamoor 2 Internal Management Application  
**Scope:** V1  
**Last Updated:** 2026-09-17

---

# 1. Purpose

This document defines the detailed PostgreSQL schema baseline for Masjid-e-Mamoor 2.

It translates the approved product requirements into:

- Tables
- Columns
- Primary keys
- Foreign keys
- Unique constraints
- Check constraints
- Status/enumeration models
- Indexes
- Relationships
- Financial integrity rules
- Audit relationships
- File metadata
- Scheduled-job support
- Row Level Security boundaries

This document is intended to be the direct database-design reference for implementation.

---

# 2. Database Principles

The schema must follow these rules:

1. PostgreSQL is authoritative for structured application data.
2. Financial amounts use exact numeric representation.
3. Core relationships use foreign keys.
4. Important uniqueness rules are database-enforced.
5. Core financial writes use transactions.
6. Financial history is never automatically deleted for storage optimization.
7. Committee work history is never automatically deleted for storage optimization.
8. Historical records must remain understandable even when current settings change.
9. Client applications never control authoritative financial state.
10. Service-role access remains server-side.
11. RLS is an additional security layer.
12. Business authorization is also enforced by the backend.
13. Large files are stored in Supabase Storage; PostgreSQL stores metadata/references.
14. Broad cascading deletion is prohibited for financial/audit/history tables.
15. Schema changes are version-controlled through migrations.

---

# 3. V1 Database Scope

The V1 database contains these logical domains:

```text
Identity
Users / Roles

Members
Referrals
Donation Terms
Monthly Donations
Additional Donations

Payment Requests
Payments
Payment Allocations

Financial Accounts
Financial Transactions
Transfers
Jummah Collections

Expenses
Expense Payments

Committee Tasks
Task Progress / Comments
Work History

Meetings
Meeting Participants
Meeting Decisions

Jummah Attendance
Meeting Attendance

Push Tokens
Notification Jobs

Audit Events
Masjid Settings

File Metadata
```

No V1 `masjids`/tenant table is required because the application is dedicated to Masjid-e-Mamoor 2.

---

# 4. Naming Convention

Use:

- Lowercase table names
- `snake_case`
- Plural table names
- Singular column names
- UUID primary keys for core entities
- `created_at` / `updated_at` timestamps
- `*_id` for foreign keys

Example:

```text
members
monthly_donations
financial_accounts
financial_transactions
```

---

# 5. Common Timestamp Convention

Core tables should normally include:

```text
created_at TIMESTAMPTZ NOT NULL DEFAULT now()
updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
```

The database/server controls these values.

Audit/security timestamps must not depend on a client-provided clock.

---

# 6. ID Strategy

Use UUIDs for internal primary keys.

Examples:

```text
users.id
members.id
monthly_donations.id
payments.id
financial_transactions.id
tasks.id
meetings.id
audit_events.id
```

Human-readable references may exist in addition to UUIDs.

A financial transaction receives a stable, unique transaction reference.

---

# 7. Database Extensions

The final migration may enable only extensions actually required.

Potentially useful extensions include:

- `pgcrypto` / `gen_random_uuid()`
- `citext` if case-insensitive identifiers are required

Do not enable unnecessary extensions.

---

# 8. Enum / Status Strategy

Use database enums only for values that are stable and controlled.

Where status values may evolve frequently, a lookup/check-constraint strategy may be preferable.

Recommended controlled enums for V1 are described below.

---

# 9. User Roles

Recommended enum:

```sql
user_role =
    PRESIDENT
    VICE_PRESIDENT
    SECRETARY
    FINANCE
    AUDITOR
    COMMITTEE_MEMBER
    MEMBER
```

Display names may differ from internal enum values.

---

# 10. Table: users

## Purpose

Application-level user identity linked to the authentication provider.

## Columns

| Column | Type | Required | Description |
|---|---|---:|---|
| id | UUID | Yes | Primary key; linked to auth identity |
| full_name | TEXT | Yes | User's name |
| mobile_number | TEXT | Yes | Canonical/normalized application mobile |
| email | TEXT | No | Optional email |
| photo_file_id | UUID | No | Optional profile photo metadata |
| role | user_role | Yes | Current primary role |
| is_active | BOOLEAN | Yes | Whether application access is active |
| created_at | TIMESTAMPTZ | Yes | Creation timestamp |
| updated_at | TIMESTAMPTZ | Yes | Update timestamp |
| deactivated_at | TIMESTAMPTZ | No | Deactivation timestamp |

## Constraints

```text
users.mobile_number UNIQUE
users.id ↔ authentication identity
```

Role changes must be controlled by backend authorization.

Historical actions must retain the stable user ID.

---

# 11. Table: members

## Purpose

Registered Masjid members.

## Columns

| Column | Type | Required | Description |
|---|---|---:|---|
| id | UUID | Yes | Primary key |
| user_id | UUID | No | Linked application user |
| full_name | TEXT | Yes | Member name |
| mobile_number | TEXT | Yes | Canonical/normalized mobile |
| email | TEXT | No | Optional email |
| photo_file_id | UUID | No | Optional photo |
| status | member_status | Yes | Active/inactive |
| created_by | UUID | Yes | User who created member |
| created_at | TIMESTAMPTZ | Yes | Creation |
| updated_at | TIMESTAMPTZ | Yes | Last update |
| deactivated_at | TIMESTAMPTZ | No | Deactivation |

## Status

```text
ACTIVE
INACTIVE
```

## Constraints

```text
UNIQUE(normalized mobile number)
```

A member can exist without an application login if operationally required, but a member who uses the application must have a linked user identity.

---

# 12. Member/User Relationship

A user may have one member profile where the user is a registered Masjid member.

Recommended constraint:

```text
UNIQUE(members.user_id)
```

when non-null.

This prevents one authenticated identity from being attached to multiple member profiles.

---

# 13. Member Mobile Number Strategy

Store mobile numbers in a canonical normalized representation.

Do not use the raw user-entered formatting as the uniqueness value.

Example concept:

```text
Input variants
   ↓
Normalize
   ↓
Canonical mobile
   ↓
Unique constraint
```

The exact India/International normalization logic will be implemented in application validation.

---

# 14. Table: donation_terms

## Purpose

Store the agreed monthly donation amount and effective month history.

## Columns

| Column | Type | Required | Description |
|---|---|---:|---|
| id | UUID | Yes | Primary key |
| member_id | UUID | Yes | Member |
| monthly_amount | NUMERIC(12,2) | Yes | Agreed monthly amount |
| effective_from_month | DATE | Yes | First month for which amount applies |
| created_by | UUID | Yes | Actor |
| created_at | TIMESTAMPTZ | Yes | Creation |
| updated_at | TIMESTAMPTZ | Yes | Update |

## Constraints

```text
monthly_amount > 0
effective_from_month represents the first day of the applicable month
```

Overlapping effective periods for the same member must be prevented.

The application/database function must ensure one applicable term exists for any month.

---

# 15. Table: referrals

## Purpose

Store primary referral attribution.

## Columns

| Column | Type | Required | Description |
|---|---|---:|---|
| id | UUID | Yes | Primary key |
| member_id | UUID | Yes | Referred member |
| referrer_user_id | UUID | Yes | Committee Member who referred |
| created_by | UUID | Yes | Actor creating attribution |
| created_at | TIMESTAMPTZ | Yes | Creation |
| updated_at | TIMESTAMPTZ | Yes | Last update |
| is_current | BOOLEAN | Yes | Current attribution |

## V1 Rule

One member has one primary current referrer.

Recommended constraint:

```text
UNIQUE(member_id) WHERE is_current = true
```

The referrer must be a user currently authorized as a Committee Member or other approved referral role.

That role relationship is enforced by backend/service logic.

---

# 16. Referral Attribution Changes

When President changes the referrer:

```text
Current Referrer
      ↓
New Referrer
```

The system must:

- Update current attribution.
- Create an audit event.
- Retain the member identity.
- Not rewrite unrelated historical financial transactions.

Whether historical contribution dashboards use the current referrer or a historical attribution snapshot must be implemented consistently. Recommended implementation is to snapshot the responsible referrer on verified donation attribution so historical reports remain stable.

---

# 17. Table: monthly_donations

## Purpose

One month-specific donation record for each member.

## Columns

| Column | Type | Required | Description |
|---|---|---:|---|
| id | UUID | Yes | Primary key |
| member_id | UUID | Yes | Member |
| donation_month | DATE | Yes | Month represented; use first day of month |
| expected_amount | NUMERIC(12,2) | Yes | Amount applicable for month |
| status | monthly_donation_status | Yes | DUE/PENDING/PAID |
| payment_link_id | UUID | No | Current/related payment request |
| paid_at | TIMESTAMPTZ | No | When verified as paid |
| created_at | TIMESTAMPTZ | Yes | Creation |
| updated_at | TIMESTAMPTZ | Yes | Update |

## Status

Recommended:

```text
DUE
PENDING
PAID
```

An expired payment link does not require deletion or termination of the donation record.

The underlying unpaid donation remains pending/outstanding.

## Constraint

```text
UNIQUE(member_id, donation_month)
expected_amount > 0
```

---

# 18. Monthly Donation History Rule

When `donation_terms.monthly_amount` changes:

```text
Future months → new amount
Historical months → unchanged
```

Do not update old `monthly_donations.expected_amount` rows automatically.

---

# 19. Monthly Donation Generation

A scheduled job should:

1. Identify active members.
2. Determine applicable donation term.
3. Check whether the member/month already exists.
4. Create missing record.
5. Never duplicate an existing record.

Database uniqueness provides final protection.

---

# 20. Table: additional_donations

## Purpose

Additional voluntary General Donations.

## Columns

| Column | Type | Required | Description |
|---|---|---:|---|
| id | UUID | Yes | Primary key |
| member_id | UUID | Yes | Registered member |
| amount | NUMERIC(12,2) | Yes | Donation amount |
| source | additional_donation_source | Yes | MEMBER or OVERPAYMENT |
| payment_id | UUID | No | Related verified payment |
| verified_by | UUID | No | Finance verifier |
| verified_at | TIMESTAMPTZ | No | Verification |
| created_at | TIMESTAMPTZ | Yes | Creation |

## Rule

All additional donations use:

```text
GENERAL_DONATION
```

No purpose category is required in V1.

## Constraint

```text
amount > 0
```

Additional donations do not modify future monthly dues.

---

# 21. Table: payment_requests

## Purpose

Represent a generated donation payment request/link.

## Columns

| Column | Type | Required | Description |
|---|---|---:|---|
| id | UUID | Yes | Primary key |
| member_id | UUID | Yes | Payer/member |
| request_type | payment_request_type | Yes | MONTHLY or COMBINED |
| amount | NUMERIC(12,2) | Yes | Requested amount |
| upi_id_snapshot | TEXT | Yes | UPI ID used for this request |
| generated_at | TIMESTAMPTZ | Yes | Server timestamp |
| expires_at | TIMESTAMPTZ | Yes | Expiry |
| status | payment_request_status | Yes | ACTIVE/EXPIRED/USED/CANCELLED |
| created_at | TIMESTAMPTZ | Yes | Creation |

## Important

The `upi_id_snapshot` stores the UPI ID actually used to create the request.

Changing the current Masjid UPI ID later must not rewrite old payment requests.

---

# 22. Payment Request Expiry

For normal monthly donation requests:

```text
expires_at = end of applicable donation month
```

For combined outstanding payment requests:

The payment request must have an explicit expiry governed by the selected generation rules and displayed to the user.

The payment request's expiry does not delete or settle donation records.

---

# 23. Table: payments

## Purpose

Record payment attempts/results and Finance verification.

## Columns

| Column | Type | Required | Description |
|---|---|---:|---|
| id | UUID | Yes | Primary key |
| member_id | UUID | No | Registered member if applicable |
| payment_request_id | UUID | No | Generated request |
| amount_received | NUMERIC(12,2) | Yes | Actual verified payment amount |
| payment_method | payment_method | Yes | UPI/CASH/BANK/etc. |
| provider_name | TEXT | No | Provider if applicable |
| external_reference | TEXT | No | UPI/reference ID |
| payment_date | TIMESTAMPTZ | Yes | Actual payment date/time where known |
| verification_status | payment_verification_status | Yes | UNVERIFIED/VERIFIED/REJECTED |
| verified_by | UUID | No | Finance verifier |
| verified_at | TIMESTAMPTZ | No | Verification timestamp |
| notes | TEXT | No | Optional note |
| created_at | TIMESTAMPTZ | Yes | Creation |
| updated_at | TIMESTAMPTZ | Yes | Update |

## Constraints

```text
amount_received > 0
```

If `external_reference` exists, provider/reference uniqueness must prevent duplicate verification where provider semantics permit.

---

# 24. Payment Verification

Only verified payments may produce authoritative donation contribution and financial posting.

Conceptually:

```text
Payment
   ↓
Finance Verification
   ↓
Payment VERIFIED
   ↓
Financial Transaction
```

---

# 25. Table: payment_allocations

## Purpose

Connect one verified payment to one or more monthly donation records.

## Columns

| Column | Type | Required | Description |
|---|---|---:|---|
| id | UUID | Yes | Primary key |
| payment_id | UUID | Yes | Payment |
| monthly_donation_id | UUID | Yes | Monthly donation |
| allocated_amount | NUMERIC(12,2) | Yes | Amount allocated |
| allocation_sequence | INTEGER | Yes | FIFO sequence |
| created_at | TIMESTAMPTZ | Yes | Creation |

## Constraints

```text
UNIQUE(payment_id, monthly_donation_id)
allocated_amount > 0
```

For monthly donation allocation:

```text
allocated_amount = monthly_donations.expected_amount
```

unless a documented future requirement changes the partial-payment rule.

---

# 26. FIFO Allocation

For a combined payment:

```text
Oldest Pending Month
        ↓
Next Pending Month
        ↓
Next Pending Month
```

The allocation operation must be performed in one transaction.

---

# 27. Overpayment

After all complete outstanding monthly records are settled:

```text
remaining payment amount
        ↓
additional_donations
```

The excess must not become future-month credit.

---

# 28. Table: financial_accounts

## Purpose

Masjid financial accounts.

## Columns

| Column | Type | Required | Description |
|---|---|---:|---|
| id | UUID | Yes | Primary key |
| account_name | TEXT | Yes | Display name |
| account_type | financial_account_type | Yes | CASH/BANK/UPI/OTHER |
| opening_balance | NUMERIC(14,2) | Yes | Opening balance |
| current_balance | NUMERIC(14,2) | Yes | Current balance |
| bank_name | TEXT | No | Bank name |
| account_name_on_bank | TEXT | No | Bank account name |
| bank_last4 | CHAR(4) | No | Last four digits only |
| upi_id | TEXT | No | UPI ID for UPI account |
| is_active | BOOLEAN | Yes | Account availability |
| opened_at | DATE | No | Operational start date |
| closed_at | DATE | No | Deactivation/closure |
| created_by | UUID | Yes | Creator |
| created_at | TIMESTAMPTZ | Yes | Creation |
| updated_at | TIMESTAMPTZ | Yes | Update |

## Constraint

```text
current_balance is server-maintained
```

Clients must not directly set it.

---

# 29. One Active UPI Rule

V1 requires one active Masjid UPI ID for payment links.

The database/service layer should enforce:

```text
At most one active financial account with account_type = UPI
and active UPI destination
```

Finance can change the active UPI configuration.

Historical payment requests store their UPI snapshot.

---

# 30. Account Deactivation

An account can be deactivated.

Deactivation does not delete historical transactions.

Do not cascade-delete financial transactions when an account is deactivated.

---

# 31. Table: financial_transactions

## Purpose

Authoritative accounting ledger.

## Columns

| Column | Type | Required | Description |
|---|---|---:|---|
| id | UUID | Yes | Internal primary key |
| transaction_id | TEXT | Yes | Unique human/system transaction reference |
| account_id | UUID | Yes | Account affected |
| transaction_date | DATE | Yes | Business transaction date |
| transaction_type | financial_transaction_type | Yes | Income/Expense/etc. |
| direction | financial_direction | Yes | CREDIT or DEBIT |
| amount | NUMERIC(14,2) | Yes | Exact amount |
| category_id | UUID | No | Expense/income category |
| payment_method | payment_method | No | Method where applicable |
| reference_id | TEXT | No | UPI/bank/reference ID |
| source_type | financial_source_type | Yes | Originating module |
| source_id | UUID | No | Related record |
| description | TEXT | No | Description |
| created_by | UUID | Yes | Actor |
| created_at | TIMESTAMPTZ | Yes | Entry timestamp |
| updated_at | TIMESTAMPTZ | Yes | Last update |

## Constraints

```text
UNIQUE(transaction_id)
amount > 0
```

---

# 32. Financial Transaction Types

Recommended controlled values:

```text
DONATION
JUMMAH_COLLECTION
OTHER_INCOME
EXPENSE_PAYMENT
TRANSFER
ADJUSTMENT
```

The exact final enum may be refined during `FINANCIAL_DATA_MODEL.md`.

---

# 33. Financial Direction

```text
CREDIT → money into account
DEBIT  → money out of account
```

A transfer uses one debit and one credit across accounts.

---

# 34. Transaction Date vs Entry Timestamp

The database stores both:

```text
transaction_date
created_at
```

These are intentionally different.

`transaction_date` represents the business date.

`created_at` represents when the record was actually entered.

This allows authorized users to enter past/future-dated transactions while preserving entry timing.

---

# 35. Current Balance Rule

The product requirement allows the account balance to change immediately when a transaction is entered, regardless of the transaction's business date.

Therefore:

```text
financial_transactions
        ↓
account current_balance
```

must be updated at transaction posting time.

Historical reporting by business date remains a separate report/query concern.

---

# 36. Negative Balance

The database should permit negative account balances when allowed by the application rules.

The application should warn users rather than silently rejecting a legitimate financial entry solely because it creates a negative balance.

---

# 37. Table: transfers

## Purpose

Represent internal transfer relationships.

## Columns

| Column | Type | Required | Description |
|---|---|---:|---|
| id | UUID | Yes | Primary key |
| transfer_id | TEXT | Yes | Unique transfer reference |
| source_account_id | UUID | Yes | Sending account |
| destination_account_id | UUID | Yes | Receiving account |
| amount | NUMERIC(14,2) | Yes | Transfer amount |
| transaction_date | DATE | Yes | Business date |
| created_by | UUID | Yes | Actor |
| created_at | TIMESTAMPTZ | Yes | Creation |

## Constraints

```text
UNIQUE(transfer_id)
amount > 0
source_account_id <> destination_account_id
```

A transfer links two financial transaction rows.

---

# 38. Transfer Integrity

For each transfer:

```text
Source: DEBIT
Destination: CREDIT
Same amount
Same Transfer ID
```

Overall Masjid funds remain unchanged.

The operation must be atomic.

---

# 39. Table: financial_categories

## Purpose

Expense/income category management.

## Columns

| Column | Type | Required | Description |
|---|---|---:|---|
| id | UUID | Yes | Primary key |
| name | TEXT | Yes | Category name |
| category_type | financial_category_type | Yes | Expense/Income |
| is_system | BOOLEAN | Yes | Fixed system category or custom |
| is_active | BOOLEAN | Yes | Active for new records |
| created_by | UUID | Yes | Creator |
| created_at | TIMESTAMPTZ | Yes | Creation |
| updated_at | TIMESTAMPTZ | Yes | Update |

Historical transactions retain their category reference.

Categories should be deactivated rather than deleted when historical records depend on them.

---

# 40. Table: expenses

## Purpose

Operational expense record.

## Columns

| Column | Type | Required | Description |
|---|---|---:|---|
| id | UUID | Yes | Primary key |
| expense_reference | TEXT | Yes | Stable expense reference |
| amount | NUMERIC(14,2) | Yes | Current approved expense amount |
| expense_date | DATE | Yes | Business date |
| category_id | UUID | Yes | Category |
| description | TEXT | Yes | Expense description |
| status | expense_status | Yes | ADDED/PARTIALLY_PAID/PAID/CANCELLED |
| bill_file_id | UUID | Yes | Bill metadata/file |
| cancellation_reason | TEXT | No | Required when cancelled |
| created_by | UUID | Yes | Finance creator |
| created_at | TIMESTAMPTZ | Yes | Creation |
| updated_at | TIMESTAMPTZ | Yes | Update |
| completed_at | TIMESTAMPTZ | No | Paid completion timestamp |

## Constraints

```text
UNIQUE(expense_reference)
amount > 0
```

The stable `expense_reference` remains unchanged during amount correction.

---

# 41. Expense Status

V1:

```text
ADDED
PARTIALLY_PAID
PAID
CANCELLED
```

No Draft status is required.

---

# 42. Expense Bill

Bill is mandatory before expense can transition to `PAID`.

The bill file reference must be associated with the expense.

Supported file formats:

```text
PDF
JPG
PNG
```

File authorization remains server-side.

---

# 43. Table: expense_payments

## Purpose

Record one payment made against an expense.

## Columns

| Column | Type | Required | Description |
|---|---|---:|---|
| id | UUID | Yes | Primary key |
| expense_id | UUID | Yes | Expense |
| financial_transaction_id | UUID | Yes | Actual ledger transaction |
| amount | NUMERIC(14,2) | Yes | Payment amount |
| payment_method | payment_method | Yes | UPI/CASH/BANK/CHEQUE/etc. |
| payment_date | TIMESTAMPTZ | Yes | Payment time/date |
| reference_id | TEXT | No | External reference |
| payment_proof_file_id | UUID | Yes | Proof metadata/file |
| created_by | UUID | Yes | Finance |
| created_at | TIMESTAMPTZ | Yes | Creation |
| updated_at | TIMESTAMPTZ | Yes | Update |

## Constraints

```text
amount > 0
UNIQUE(financial_transaction_id)
```

Before insertion:

```text
SUM(expense_payments.amount) + new_payment
≤ expense.amount
```

This must be enforced server-side/transactionally.

---

# 44. Expense Payment Proof

Payment proof is mandatory before the expense can be marked `PAID`.

Supported:

```text
PDF
JPG
PNG
```

Finance can replace/delete payment proof according to permissions.

Proof replacement/deletion must be auditable.

---

# 45. Expense Amount Correction

When the expense amount changes:

```text
Same expense_reference
+
new amount
+
reason
+
actor
+
timestamp
```

The amount correction must remain compatible with already recorded payments.

Example:

```text
Original amount = ₹10,000
Paid = ₹4,000
Remaining will not be incurred
New amount = ₹4,000
```

The expense reference remains unchanged.

---

# 46. Table: jummah_collections

## Purpose

Record one total cash collection for each Friday/Jummah.

## Columns

| Column | Type | Required | Description |
|---|---|---:|---|
| id | UUID | Yes | Primary key |
| collection_date | DATE | Yes | Friday/Jummah date |
| amount | NUMERIC(14,2) | Yes | Total cash collection |
| account_id | UUID | Yes | Normally Cash account |
| financial_transaction_id | UUID | Yes | Ledger entry |
| note | TEXT | No | Optional note |
| entered_by | UUID | Yes | Finance/President/Secretary |
| created_at | TIMESTAMPTZ | Yes | Entry timestamp |

## Constraint

```text
UNIQUE(collection_date)
amount > 0
```

No individual donor records are required for the Jummah cash collection.

---

# 47. Jummah Collection Financial Effect

A Jummah cash collection creates:

```text
CASH ACCOUNT
+
JUMMAH_COLLECTION CREDIT
```

It is included in financial reports.

It is not attributed to individual committee referrals.

---

# 48. Table: committee_tasks

## Purpose

Core committee task/work management.

## Columns

| Column | Type | Required | Description |
|---|---|---:|---|
| id | UUID | Yes | Primary key |
| title | TEXT | Yes | Task title |
| description | TEXT | No | Task details |
| priority | task_priority | Yes | LOW/MEDIUM/HIGH/URGENT |
| status | task_status | Yes | Current state |
| created_by | UUID | Yes | Creator |
| assigned_to | UUID | No | Responsible member |
| claimed_at | TIMESTAMPTZ | No | Claim time |
| deadline | TIMESTAMPTZ | No | Optional deadline |
| completed_at | TIMESTAMPTZ | No | Completion time |
| completion_note | TEXT | No | Optional note |
| meeting_decision_id | UUID | No | Originating decision |
| related_member_id | UUID | No | Related member/referral |
| created_at | TIMESTAMPTZ | Yes | Creation |
| updated_at | TIMESTAMPTZ | Yes | Update |

---

# 49. Task Status

Recommended:

```text
CREATED
ASSIGNED
IN_PROGRESS
COMPLETED
```

`OVERDUE` may be calculated from:

```text
deadline < current time
AND status <> COMPLETED
```

rather than permanently duplicating a status where practical.

If implementation needs a stored status for dashboard performance, the derived semantics must remain consistent.

---

# 50. Task Priority

```text
LOW
MEDIUM
HIGH
URGENT
```

---

# 51. Open Task Claiming

An open task has:

```text
assigned_to IS NULL
```

An authorized Committee Member can claim it.

The claim must be atomic.

Recommended database operation:

```text
UPDATE committee_tasks
SET assigned_to = :member,
    claimed_at = now(),
    status = 'ASSIGNED'
WHERE id = :task_id
  AND assigned_to IS NULL
  AND status = 'CREATED';
```

Exactly one successful claimant is allowed.

---

# 52. Task Progress / Comments

## Table: task_updates

| Column | Type | Required | Description |
|---|---|---:|---|
| id | UUID | Yes | Primary key |
| task_id | UUID | Yes | Task |
| author_user_id | UUID | Yes | User |
| update_text | TEXT | Yes | Progress/comment |
| created_at | TIMESTAMPTZ | Yes | Timestamp |

This supports progress updates without overwriting the main task description.

---

# 53. Work History

The completed task itself forms the core permanent work record.

No separate duplicate history table is required in V1 unless later testing shows a real need.

Permanent work information remains available through:

```text
committee_tasks
+
task_updates
+
audit_events
```

Completed tasks cannot be deleted by Committee Members.

---

# 54. Task Attachments

Attachments use the common file metadata model.

The task record does not store binary files directly.

---

# 55. Table: meetings

## Purpose

Scheduled committee meetings.

## Columns

| Column | Type | Required | Description |
|---|---|---:|---|
| id | UUID | Yes | Primary key |
| title | TEXT | Yes | Meeting title |
| scheduled_at | TIMESTAMPTZ | Yes | Date/time |
| location | TEXT | No | Meeting location |
| agenda | TEXT | No | Agenda |
| status | meeting_status | Yes | SCHEDULED/COMPLETED/CANCELLED |
| created_by | UUID | Yes | Creator |
| created_at | TIMESTAMPTZ | Yes | Creation |
| updated_at | TIMESTAMPTZ | Yes | Update |

---

# 56. Meeting Status

```text
SCHEDULED
COMPLETED
CANCELLED
```

Only scheduled/eligible meetings should be used for V1 meeting attendance.

---

# 57. Table: meeting_participants

## Purpose

Members invited to a meeting.

## Columns

| Column | Type | Required | Description |
|---|---|---:|---|
| meeting_id | UUID | Yes | Meeting |
| member_id | UUID | Yes | Member |
| invited_by | UUID | Yes | Actor |
| created_at | TIMESTAMPTZ | Yes | Creation |

## Primary Key

```text
(meeting_id, member_id)
```

This prevents duplicate participation invitations.

---

# 58. Table: meeting_decisions

## Purpose

Record decisions/minutes and optional follow-up requirements.

## Columns

| Column | Type | Required | Description |
|---|---|---:|---|
| id | UUID | Yes | Primary key |
| meeting_id | UUID | Yes | Meeting |
| decision_text | TEXT | Yes | Decision |
| requires_task | BOOLEAN | Yes | Whether follow-up work is required |
| created_by | UUID | Yes | Actor |
| created_at | TIMESTAMPTZ | Yes | Creation |
| updated_at | TIMESTAMPTZ | Yes | Update |

A decision can exist without a task.

---

# 59. Meeting → Task Relationship

If a decision creates a task:

```text
meeting_decisions.id
      ↓
committee_tasks.meeting_decision_id
```

This provides:

```text
Meeting
→ Decision
→ Task
→ Responsible Member
→ Completion
```

---

# 60. Table: jummah_attendance

## Purpose

Jummah prayer attendance only.

## Columns

| Column | Type | Required | Description |
|---|---|---:|---|
| id | UUID | Yes | Primary key |
| member_id | UUID | Yes | Member |
| jummah_date | DATE | Yes | Friday date |
| latitude | NUMERIC(9,6) | No | Validation location |
| longitude | NUMERIC(9,6) | No | Validation location |
| accuracy_m | NUMERIC(8,2) | No | Reported accuracy |
| validation_status | attendance_validation_status | Yes | VALID/INVALID/PENDING |
| captured_at | TIMESTAMPTZ | Yes | Device/server event time |
| synced_at | TIMESTAMPTZ | No | Server sync |
| created_at | TIMESTAMPTZ | Yes | Creation |

## Constraint

```text
UNIQUE(member_id, jummah_date)
```

---

# 61. Meeting Attendance Table

## Table: meeting_attendance

| Column | Type | Required | Description |
|---|---|---:|---|
| meeting_id | UUID | Yes | Meeting |
| member_id | UUID | Yes | Member |
| attendance_status | meeting_attendance_status | Yes | PRESENT/ABSENT |
| marked_by | UUID | Yes | Actor |
| marked_at | TIMESTAMPTZ | Yes | Timestamp |
| created_at | TIMESTAMPTZ | Yes | Creation |

## Primary Key

```text
(meeting_id, member_id)
```

---

# 62. Attendance Scope

No tables are required for:

- Fajr attendance
- Zohr attendance
- Asr attendance
- Maghrib attendance
- Isha attendance
- Azaan attendance
- Jamaat attendance for each prayer

V1 attendance consists only of:

```text
Jummah
+
Scheduled Meetings
```

---

# 63. Attendance Radius Configuration

The Masjid attendance radius belongs in application settings.

It is not duplicated into every attendance record as a configurable setting.

However, the server may store the validation result and relevant location metadata.

---

# 64. Offline Attendance Support

For device-side synchronization, use a client operation identifier.

Recommended field on attendance table or sync ledger:

```text
client_operation_id TEXT UNIQUE
```

This prevents duplicate synchronization.

The final client sync implementation may use a separate lightweight sync table if required.

---

# 65. Table: notification_tokens

## Purpose

Store active mobile push tokens.

## Columns

| Column | Type | Required | Description |
|---|---|---:|---|
| id | UUID | Yes | Primary key |
| user_id | UUID | Yes | User |
| platform | notification_platform | Yes | ANDROID/IOS |
| push_token | TEXT | Yes | Provider token |
| is_active | BOOLEAN | Yes | Active/inactive |
| last_seen_at | TIMESTAMPTZ | No | Last observed |
| created_at | TIMESTAMPTZ | Yes | Creation |
| updated_at | TIMESTAMPTZ | Yes | Update |

A token should not be retained indefinitely after known invalidation.

---

# 66. Notification Delivery Jobs

V1 does not require a user-facing notification inbox.

A lightweight server-side delivery table may be used.

## Table: notification_jobs

| Column | Type | Required | Description |
|---|---|---:|---|
| id | UUID | Yes | Primary key |
| user_id | UUID | Yes | Recipient |
| event_type | TEXT | Yes | Event |
| payload_reference | TEXT | No | Safe application reference |
| channel | notification_channel | Yes | PUSH/SMS/WHATSAPP |
| status | notification_job_status | Yes | PENDING/SENT/FAILED |
| attempts | INTEGER | Yes | Retry count |
| last_error | TEXT | No | Safe error description |
| scheduled_at | TIMESTAMPTZ | No | Scheduled delivery |
| sent_at | TIMESTAMPTZ | No | Delivery time |
| created_at | TIMESTAMPTZ | Yes | Creation |
| updated_at | TIMESTAMPTZ | Yes | Update |

Do not store unnecessary sensitive financial details in payloads.

---

# 67. Table: audit_events

## Purpose

Important business/security activity log.

## Columns

| Column | Type | Required | Description |
|---|---|---:|---|
| id | UUID | Yes | Primary key |
| occurred_at | TIMESTAMPTZ | Yes | Server timestamp |
| actor_user_id | UUID | No | Human actor; null for controlled system event |
| action | TEXT | Yes | Action name |
| resource_type | TEXT | Yes | Record type |
| resource_id | UUID | No | Affected record |
| result | TEXT | Yes | SUCCESS/FAILURE/etc. |
| metadata | JSONB | No | Relevant structured context |
| request_id | TEXT | No | Correlation identifier |

Audit events are append-oriented.

---

# 68. Required Audit Event Coverage

At minimum:

```text
User creation/deactivation
Role changes
Referral attribution changes
Monthly donation amount changes
UPI changes
Financial transaction creation
Financial transaction edit
Financial transaction deletion
Expense creation/change
Expense payment actions
Payment verification
Payment-proof replacement/deletion
Attendance corrections
Important settings changes
Security/authentication events where required
```

---

# 69. Table: masjid_settings

## Purpose

Store V1 operational settings for the fixed Masjid.

## Model

A single-row configuration record.

## Columns

| Column | Type | Required | Description |
|---|---|---:|---|
| id | UUID | Yes | Fixed primary record |
| masjid_name | TEXT | Yes | `Masjid-e-Mamoor 2` |
| timezone | TEXT | Yes | Authoritative application timezone |
| attendance_radius_m | NUMERIC(8,2) | Yes | Allowed Jummah GPS radius |
| default_language | TEXT | Yes | Default interface language |
| updated_by | UUID | Yes | Actor |
| created_at | TIMESTAMPTZ | Yes | Creation |
| updated_at | TIMESTAMPTZ | Yes | Update |

V1 does not provide Masjid registration or multi-Masjid selection.

The row is configuration for the one fixed Masjid.

---

# 70. Active UPI Configuration

The active UPI destination should live in the financial-account/configuration model.

Recommended implementation:

```text
financial_accounts.account_type = UPI
financial_accounts.upi_id
financial_accounts.is_active = true
```

Only one active UPI destination may exist.

A UPI change creates an audit event.

Payment requests store their UPI snapshot.

---

# 71. Table: files

## Purpose

Store metadata for Supabase Storage objects.

## Columns

| Column | Type | Required | Description |
|---|---|---:|---|
| id | UUID | Yes | Primary key |
| storage_bucket | TEXT | Yes | Storage bucket |
| storage_path | TEXT | Yes | Object path |
| original_name | TEXT | Yes | Original filename |
| mime_type | TEXT | Yes | MIME type |
| size_bytes | BIGINT | Yes | File size |
| owner_user_id | UUID | Yes | Uploader |
| related_type | TEXT | Yes | Domain resource |
| related_id | UUID | Yes | Related record |
| is_active | BOOLEAN | Yes | Current file state |
| created_at | TIMESTAMPTZ | Yes | Upload time |
| updated_at | TIMESTAMPTZ | Yes | Update |

## Constraint

```text
UNIQUE(storage_bucket, storage_path)
```

---

# 72. File Association Rules

Examples:

```text
Expense
→ Bill file

Expense Payment
→ Payment proof

Task
→ Approved attachment
```

Files must not be accessible merely because a user guesses a path.

---

# 73. File Deletion Policy

Deleting a file must not automatically delete its financial/business record.

For financial evidence:

```text
File action
+
Actor
+
Timestamp
```

must remain auditable.

The storage layer should use controlled deletion rather than broad database cascades.

---

# 74. Foreign Key Relationships

Core relationships:

```text
users
 ├── members.user_id
 ├── referrals.referrer_user_id
 ├── financial_transactions.created_by
 ├── expenses.created_by
 ├── committee_tasks.created_by
 ├── meetings.created_by
 └── audit_events.actor_user_id
```

Members:

```text
members
 ├── referrals.member_id
 ├── donation_terms.member_id
 ├── monthly_donations.member_id
 ├── additional_donations.member_id
 ├── payment_requests.member_id
 ├── payments.member_id
 ├── jummah_attendance.member_id
 └── meeting_attendance.member_id
```

Finance:

```text
financial_accounts
      ↓
financial_transactions
      ↓
expense_payments
      ↓
expenses
```

Payments:

```text
payment_requests
      ↓
payments
      ↓
payment_allocations
      ↓
monthly_donations
```

Meetings:

```text
meetings
 ├── meeting_participants
 ├── meeting_attendance
 └── meeting_decisions
        ↓
     committee_tasks
```

---

# 75. Delete Rules for Historical Data

Recommended foreign-key strategy:

```text
Financial transactions → RESTRICT
Audit events → RESTRICT
Monthly donations → RESTRICT
Payments → RESTRICT
Payment allocations → RESTRICT
Expenses → RESTRICT
Expense payments → RESTRICT
Transfers → RESTRICT
Completed tasks → RESTRICT
Meetings with history → RESTRICT
Attendance → RESTRICT
```

Do not use broad:

```text
ON DELETE CASCADE
```

for core historical data.

---

# 76. Member Deactivation

Members should be deactivated rather than deleted when historical records exist.

This preserves:

- Donation history
- Referral history
- Attendance
- Committee relationships where applicable

---

# 77. User Deactivation

Users should be deactivated rather than deleted when they are historical actors.

Past audit/financial records must retain the stable actor identity.

---

# 78. Role History

Current role belongs to `users.role`.

Historical role changes are captured through:

```text
audit_events
```

Past records should not be rewritten to make the user's current role appear historical.

---

# 79. Financial Categories

System categories may be inserted by migration.

President may create custom categories.

Historical transactions keep their category reference.

Deactivation is preferred to deleting a category referenced by historical transactions.

---

# 80. Unique Constraints Summary

Mandatory/strongly recommended:

```text
users.mobile_number
members.mobile_number
members.user_id
member + donation_month
referrer attribution per member
financial_accounts active UPI uniqueness
financial_transactions.transaction_id
transfers.transfer_id
expenses.expense_reference
meeting + participant
meeting + attendance member
member + Jummah date
meeting + member attendance
payment provider/reference where applicable
payment + monthly donation allocation
notification token uniqueness where applicable
storage bucket + path
```

---

# 81. Index Strategy

## Users

```text
users.mobile_number
users.role
users.is_active
```

## Members

```text
members.mobile_number
members.full_name
members.status
members.user_id
```

## Referrals

```text
referrals.member_id
referrals.referrer_user_id
```

## Donations

```text
monthly_donations.member_id
monthly_donations.donation_month
monthly_donations.status
(monthly_donations.member_id, donation_month)
```

## Payments

```text
payments.member_id
payments.verification_status
payments.external_reference
payment_allocations.payment_id
payment_allocations.monthly_donation_id
```

## Finance

```text
financial_transactions.transaction_id
financial_transactions.account_id
financial_transactions.transaction_date
financial_transactions.transaction_type
financial_transactions.reference_id
financial_transactions.source_type
financial_transactions.source_id
```

## Expenses

```text
expenses.expense_reference
expenses.expense_date
expenses.status
expenses.category_id
expense_payments.expense_id
expense_payments.payment_date
```

## Tasks

```text
committee_tasks.assigned_to
committee_tasks.status
committee_tasks.deadline
committee_tasks.meeting_decision_id
task_updates.task_id
```

## Meetings

```text
meetings.scheduled_at
meeting_participants.member_id
meeting_decisions.meeting_id
```

## Attendance

```text
jummah_attendance.member_id
jummah_attendance.jummah_date
meeting_attendance.meeting_id
meeting_attendance.member_id
```

## Audit

```text
audit_events.occurred_at
audit_events.actor_user_id
audit_events.resource_type
audit_events.resource_id
```

---

# 82. Financial Transaction Index Consideration

For large financial history:

```text
(account_id, transaction_date)
(transaction_date, transaction_type)
```

should be evaluated through actual query plans.

Do not add every possible index blindly.

---

# 83. Dashboard Aggregates

Dashboard totals should be derived from authoritative records.

Examples:

```text
Committee referred members
→ referrals

Verified donation contribution
→ verified donations + referral attribution

Account balance
→ financial account + authoritative ledger

Task progress
→ committee_tasks

Meeting attendance
→ meeting_attendance
```

Avoid maintaining manually editable totals.

---

# 84. Financial Balance Architecture

Two levels exist:

### Authoritative ledger

`financial_transactions`

### Operational current balance

`financial_accounts.current_balance`

The current balance is a server-maintained value.

Every financial mutation that changes an account must update:

```text
financial_accounts.current_balance
```

within the same database transaction.

---

# 85. Balance Recalculation

The system should also provide a controlled server-side reconciliation/rebuild operation:

```text
Opening Balance
+
Credits
-
Debits
=
Expected Current Balance
```

This operation is useful for administrative validation.

It must not silently rewrite history.

---

# 86. Financial Deletion

Only the President can delete a financial transaction.

Deletion must:

1. Verify authorization.
2. Identify exact transaction.
3. Apply deletion safely.
4. Correct affected account balance.
5. Preserve required audit event.
6. Ensure dependent records are handled according to foreign-key policy.

---

# 87. Financial Correction

Normal correction should update the existing transaction identity where required.

The record should capture:

```text
previous_amount
new_amount
correction_reason
corrected_by
corrected_at
```

These can live in the financial transaction record or an associated correction table depending on the final implementation.

A separate new "correction transaction" is not required by V1.

---

# 88. Payment and Financial Transaction Relationship

A verified payment can create one authoritative financial transaction.

Conceptually:

```text
Payment
  ↓
Verification
  ↓
Financial Transaction
```

Payment-specific state remains in `payments`.

Accounting state remains in `financial_transactions`.

---

# 89. Additional Donation and Finance

An additional donation creates a financial credit when verified.

Conceptually:

```text
Additional Donation
      ↓
Payment
      ↓
Finance Verification
      ↓
Financial Transaction CREDIT
```

---

# 90. Monthly Donation and Finance

A verified monthly payment creates:

```text
Payment
      ↓
Payment Allocation
      ↓
Monthly Donation PAID
      ↓
Financial Transaction CREDIT
```

The same verified payment may settle several months.

---

# 91. Anonymous Donation and Finance

Anonymous donations can be recorded without member identity.

Recommended approach:

```text
additional/anonymous donation record
       ↓
payment/financial entry
```

At minimum, retain:

- Amount
- Date
- Method
- Account
- Actor
- Verification
- Transaction reference where applicable

---

# 92. Anonymous Donor Identity

Do not create a fake Member record simply to represent anonymous donations.

Use explicit anonymous classification.

---

# 93. Referral Contribution Calculation

Recommended query path:

```text
Referrer
   ↓
Members attributed to referrer
   ↓
Verified donation records
   ↓
Verified contribution total
```

Do not store an editable `total_donation` on the Committee Member record as the sole source.

A historical referrer snapshot on verified donation attribution may be used to preserve contribution history if attribution later changes.

---

# 94. Committee Work Calculation

Task progress should derive from:

```text
committee_tasks.status
committee_tasks.assigned_to
committee_tasks.deadline
```

Work history should not require a manually maintained score.

---

# 95. Meeting Participation Calculation

Meeting participation derives from:

```text
meeting_attendance
+
meetings
```

No separate manually maintained participation score is required.

---

# 96. Attendance Duplicate Prevention

Database constraints:

```text
UNIQUE(member_id, jummah_date)
```

and:

```text
PRIMARY KEY(meeting_id, member_id)
```

These provide final duplicate protection.

---

# 97. Offline Attendance Duplicate Prevention

Where a client sync identifier is used:

```text
client_operation_id UNIQUE
```

Server synchronization must be idempotent.

---

# 98. Task Claim Concurrency

The database must support an atomic claim operation.

Do not implement:

```text
SELECT task
IF unassigned
UPDATE task
```

as separate unprotected operations.

Prefer a conditional atomic update or equivalent transaction.

---

# 99. Payment Verification Concurrency

Two Finance actions verifying the same payment must not create two financial transactions.

Use:

- Unique external reference
- Verification state guard
- Transaction
- Idempotency

---

# 100. Monthly Record Concurrency

Two scheduler/job runs must not create two records for the same member/month.

Use:

```text
UNIQUE(member_id, donation_month)
```

as the final protection.

---

# 101. Expense Payment Concurrency

Two simultaneous payment entries must not cause:

```text
SUM(payments) > expense.amount
```

The check and insert must occur transactionally.

---

# 102. Transfer Concurrency

A transfer must update:

- Source
- Destination
- Transfer record
- Financial transactions
- Audit

atomically.

---

# 103. Currency Precision

Recommended PostgreSQL representation:

```text
NUMERIC(14,2)
```

for ordinary financial amounts.

Larger precision may be selected if reporting requirements justify it.

Do not use floating-point database types for authoritative financial values.

---

# 104. Date-Only vs Timestamp

Use:

### DATE

For:

- Donation month
- Jummah date
- Business expense date
- Financial transaction date

### TIMESTAMPTZ

For:

- Created at
- Updated at
- Payment verification
- Attendance capture
- Task completion
- Meeting timestamp
- Audit event
- Notification delivery

---

# 105. Timezone

The application should have one authoritative timezone configuration for Masjid-e-Mamoor 2.

Do not derive business dates independently from each device timezone.

---

# 106. RLS Architecture

Supabase PostgreSQL Row Level Security should protect exposed tables.

The final RLS implementation should cover at least:

```text
members
monthly_donations
additional_donations
payments
financial_accounts
financial_transactions
expenses
expense_payments
tasks
meetings
attendance
files
audit_events
```

---

# 107. RLS Principle

RLS should be restrictive by default.

Conceptually:

```text
No policy
   ↓
No access
```

Then explicitly grant allowed access.

---

# 108. Application Authorization + RLS

Use both:

```text
Backend authorization
+
RLS
```

RLS must not be treated as the only business-rule implementation.

---

# 109. Service-Role Operations

Server-side service-role access may bypass RLS.

Therefore:

- Never expose service-role key to clients.
- Validate business authorization before sensitive operations.
- Use service role only in trusted server-side code.

---

# 110. Audit Event Creation

Audit events should be generated server-side.

Do not allow normal users to submit:

```text
"I changed transaction X"
```

as if it were a trusted audit event.

---

# 111. Audit Metadata

The `metadata` JSONB field should contain only useful context.

Good:

```json
{
  "previous_amount": "10000.00",
  "new_amount": "4000.00",
  "reason": "Remaining work cancelled"
}
```

Avoid storing:

- Passwords
- OTPs
- Access tokens
- Full document contents
- Unnecessary personal information

---

# 112. Audit Event Retention

Business audit events for financial/security/accountability actions should be retained.

Technical logs use a separate retention strategy.

---

# 113. File Storage Relationship

The database stores:

```text
File metadata
+
Related business record
+
Storage location
```

Supabase Storage stores the actual bytes.

---

# 114. File Storage Categories

Recommended storage namespaces:

```text
expenses/bills/
expenses/payment-proofs/
tasks/attachments/
members/photos/
```

Exact bucket layout can be adjusted while keeping secure isolation.

---

# 115. Storage Optimization

To minimize storage:

- Store one canonical upload.
- Avoid duplicate files.
- Do not permanently store every generated PDF.
- Compress images where safe.
- Validate file sizes.
- Keep only required metadata.
- Avoid storing files in database blobs.

Never use storage cleanup to delete required historical financial evidence.

---

# 116. Database Storage Optimization

Use:

- Correct data types
- Normalization
- Necessary indexes only
- Derived aggregates only where justified
- No duplicated profiles in every transaction
- No duplicated notification payloads

---

# 117. No Multi-Masjid Database in V1

Do not add:

```text
masjid_id
```

to every table merely to simulate a multi-tenant product that does not exist in V1.

The architecture can be extended later, but V1 remains a dedicated Masjid-e-Mamoor 2 deployment.

---

# 118. Future Multi-Masjid Expansion

If a later product decision introduces multiple Masjids, the schema should be migrated deliberately.

Do not pretend V1 is multi-tenant.

---

# 119. Migration Order

Recommended initial migration order:

```text
001_extensions_and_types
002_users
003_members
004_referrals
005_donation_terms
006_monthly_donations
007_financial_accounts
008_financial_categories
009_payment_requests
010_payments
011_payment_allocations
012_financial_transactions
013_transfers
014_additional_donations
015_expenses
016_expense_payments
017_jummah_collections
018_committee_tasks
019_task_updates
020_meetings
021_meeting_participants
022_meeting_decisions
023_meeting_attendance
024_jummah_attendance
025_notification_tokens
026_notification_jobs
027_files
028_masjid_settings
029_audit_events
030_indexes_and_rls
```

The final migration order may be adjusted when actual foreign-key dependencies are implemented.

---

# 120. Schema Migration Rules

Every database change must:

- Have a versioned migration.
- Be committed to Git.
- Be tested against a non-production database.
- Include necessary data migration.
- Be reviewed before production.

---

# 121. Seed Data

Initial migrations may seed:

### Roles

```text
President
Vice President
Secretary
Finance
Auditor
Committee Member
Member
```

### System categories

Only approved fixed categories should be seeded.

### Settings

```text
Masjid-e-Mamoor 2
```

Other live settings should be configured securely by authorized users.

---

# 122. No Production Data in Development

Development/test environments should use synthetic data.

Do not routinely copy:

- Real member phone numbers
- Real donation history
- Real bills
- Real payment references
- Real audit logs

into local development.

---

# 123. Backup Implication

The database contains permanent financial and committee records.

Production backup/recovery must therefore cover all core tables.

Detailed backup configuration belongs in:

`BACKUP_AND_RECOVERY.md`

---

# 124. Database Testing Requirements

Before feature release, test:

- Constraints
- Foreign keys
- Unique indexes
- RLS
- Financial transactions
- Balance calculations
- Payment allocation
- Task claiming
- Attendance duplication
- Migration correctness

---

# 125. Financial Database Test Cases

Minimum tests:

```text
Create income
Create donation
Verify payment
Create financial credit
Create expense payment
Create transfer
Correct transaction
Delete authorized transaction
Reject unauthorized deletion
Prevent over-payment
Prevent duplicate payment verification
```

---

# 126. Donation Database Test Cases

Test:

```text
One member + one month
→ exactly one monthly record

Payment for full amount
→ Paid

Payment below amount
→ does not complete month

Combined payment
→ FIFO

Payment above outstanding
→ excess General Donation

Additional donation
→ separate record
```

---

# 127. Member Database Test Cases

Test:

```text
New mobile
→ member created

Existing mobile
→ duplicate prevented

Same authenticated user linked twice
→ rejected
```

---

# 128. Committee Database Test Cases

Test:

```text
Open task
→ one successful claimant

Second simultaneous claim
→ rejected

Completed task
→ retained

Committee member delete completed task
→ rejected
```

---

# 129. Attendance Database Test Cases

Test:

```text
Member + Friday
→ one Jummah record

Duplicate same Friday
→ rejected

Member + Meeting
→ one meeting attendance record

Duplicate same meeting
→ rejected
```

---

# 130. Expense Database Test Cases

Test:

```text
Bill missing
→ cannot transition to Paid

Payment proof missing
→ cannot transition to Paid

Payment total > expense
→ rejected

Cancellation without reason
→ rejected

Amount correction without reason
→ rejected
```

---

# 131. Audit Database Test Cases

Test that important actions generate audit events:

```text
Role change
Referral change
Donation amount change
UPI change
Financial edit
Financial delete
Expense payment
Attendance correction
```

---

# 132. Database Performance Targets

The schema should support responsive operation for the expected Masjid user population.

Priorities:

- Member search
- Donation status
- Finance transaction lists
- Expense lists
- Committee task lists
- Attendance
- Dashboard aggregates
- Audit search

Use actual database query plans to refine indexes.

---

# 133. Pagination Requirements

Never expose unbounded queries for:

- Members
- Donations
- Transactions
- Expenses
- Tasks
- Audit events
- Attendance history

---

# 134. Financial Reporting Data

Financial reports should be derived from:

```text
financial_transactions
+
financial_accounts
+
expenses
+
donation/payment relationships
```

Do not create a separate manually maintained financial history table.

---

# 135. Committee Reporting Data

Committee reports derive from:

```text
members
referrals
monthly_donations
payments
committee_tasks
meetings
meeting_attendance
```

---

# 136. Current Balance vs Historical Report

The schema intentionally separates:

```text
Account current balance
```

from:

```text
Transaction business date
```

This supports the approved requirement that entering a transaction changes operational balance immediately while reports can still use the business transaction date.

---

# 137. Financial Integrity Trigger/Function Candidates

Database functions/triggers should be considered for:

1. Updating `updated_at`.
2. Maintaining `financial_accounts.current_balance`.
3. Atomic transfer posting.
4. Duplicate-safe attendance insertion.
5. Atomic task claim.
6. Payment allocation.
7. Expense payment total validation.
8. One-active-UPI enforcement.
9. Audit event helper functions where appropriate.

Do not implement triggers for business logic that is better controlled in explicit server-side service operations.

---

# 138. Current Balance Update

When a new financial transaction posts:

```text
if CREDIT:
    account.current_balance += amount

if DEBIT:
    account.current_balance -= amount
```

All related updates must occur atomically.

Correction/deletion must reverse/reapply the appropriate effect.

---

# 139. Transfer Posting

A transfer should:

```text
Debit source
Credit destination
Create transfer record
Link transaction IDs
Update both balances
Create audit event
Commit atomically
```

---

# 140. Expense Payment Posting

An expense payment should:

```text
Validate expense
Validate payment amount
Create expense payment
Create financial transaction
Update account balance
Update expense status
Create audit event
Commit atomically
```

---

# 141. Donation Verification Posting

Donation verification should:

```text
Validate payment
Validate reference/idempotency
Allocate monthly donations
Create additional donation for excess if needed
Create financial transaction(s)
Update donation statuses
Create contribution attribution
Create audit event
Commit atomically
```

---

# 142. Payment Allocation Atomicity

A combined payment must not produce:

```text
Payment verified
but
only some monthly records updated
```

All allocation state changes must commit together.

---

# 143. Financial Source References

Financial transactions should identify their source where possible:

```text
source_type
source_id
```

Examples:

```text
DONATION + monthly_donation/payment source
EXPENSE_PAYMENT + expense_payment.id
JUMMAH_COLLECTION + jummah_collections.id
TRANSFER + transfer.id
```

This supports auditability and report tracing.

---

# 144. Source Record Protection

Do not delete a source record while its financial transaction still depends on it.

Prefer:

```text
Deactivate / correct
```

or apply a controlled deletion workflow.

---

# 145. Human-Readable Financial References

Financial records should have human-readable references such as:

```text
TX-2026-000001
TR-2026-000001
EXP-2026-000001
```

The exact format can be decided during implementation.

The database must still use UUID primary keys internally.

---

# 146. Reference Number Generation

Reference numbers must be:

- Unique
- Server-generated
- Non-client-controlled
- Collision-safe
- Stable after creation

---

# 147. Data Type for Transaction References

Use:

```text
TEXT
```

with a unique index.

Do not use numeric-only identifiers if prefixes and future expansion are expected.

---

# 148. Search Fields

Search should use:

- Mobile number
- Name
- Transaction reference
- Expense reference
- External payment reference

Use normalized search forms where necessary.

---

# 149. Full-Text Search

Do not introduce PostgreSQL full-text search until actual search requirements justify it.

Simple indexes are sufficient for initial member/name/reference search.

---

# 150. Audit and Privacy

Audit metadata should avoid unnecessary personal data.

Store the minimum information needed to understand an action.

---

# 151. Historical Financial Evidence

Bills/payment proofs are independent file objects linked to expenses/payments.

Financial history remains meaningful even if a file becomes unavailable due to a documented storage failure; however, production operations must prioritize retaining required supporting evidence.

---

# 152. File Metadata Retention

File metadata for historical financial evidence should remain associated with the financial record.

---

# 153. Schema-Level V1 Exclusions

Do not create tables for:

```text
Multiple Masjids
Public Masjid directory
Daily prayer attendance
Prayer-by-prayer attendance
Donation ranking
Committee leaderboard
Performance scores
Asset/property management
Bank reconciliation
Advances
Notification inbox/history
Custom permission profiles
Staff/Volunteer role
Read-only role
```

---

# 154. Security-Level Schema Exclusions

Do not store:

- Passwords
- OTP secrets
- Service-role credentials
- Payment provider secrets
- Notification provider secrets

in ordinary application tables.

Authentication secrets belong to the authentication provider/secure secret store.

---

# 155. Database Architecture Completion Checklist

Before implementation:

- [ ] Core tables reviewed
- [ ] Foreign keys reviewed
- [ ] Unique constraints reviewed
- [ ] Financial amount precision approved
- [ ] Status values approved
- [ ] Transaction ID strategy approved
- [ ] RLS policies designed
- [ ] Financial balance functions designed
- [ ] Task claim atomicity designed
- [ ] Payment allocation designed
- [ ] Attendance uniqueness designed
- [ ] File metadata design approved
- [ ] Audit-event coverage approved
- [ ] Migration sequence tested

---

# 156. Related Documents

- `PROJECT_OVERVIEW.md`
- `PRODUCT_REQUIREMENTS.md`
- `FEATURE_SCOPE.md`
- `USER_ROLES_PERMISSIONS.md`
- `SYSTEM_ARCHITECTURE.md`
- `APPLICATION_ARCHITECTURE.md`
- `BACKEND_ARCHITECTURE.md`
- `BACKEND_FRAMEWORK.md`
- `TECHNOLOGY_STACK.md`
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

**Database Schema — V1 Implementation Baseline**

This document defines the detailed PostgreSQL schema direction for Masjid-e-Mamoor 2.

Before production implementation, the schema must be converted into tested migration files and validated against the security, financial-integrity, and product requirements documents.
