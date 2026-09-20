# Masjid-e-Mamoor 2 — Financial Data Model

**Document Status:** V1 Implementation Baseline  
**Version:** 1.0  
**Product:** Masjid-e-Mamoor 2 Internal Management Application  
**Scope:** V1  
**Database:** PostgreSQL via Supabase  
**Last Updated:** 2026-09-17

---

# 1. Purpose

This document defines the authoritative financial data model for Masjid-e-Mamoor 2.

The financial system is one of the two primary pillars of the application.

It must provide a reliable, traceable record of:

- Monthly member donations
- Additional voluntary donations
- Anonymous donations
- Jummah cash collections
- Other legitimate receipts
- Financial accounts
- Expenses
- Expense payments
- Internal transfers
- Payment references
- Financial corrections
- Account balances
- Financial reports
- Audit information

The central objective is:

> Every rupee recorded in the system should have a clear financial meaning, account impact, and audit trail.

---

# 2. Financial Design Principles

The financial system follows these principles:

1. PostgreSQL is the authoritative financial data store.
2. Exact monetary representation is mandatory.
3. Financial writes are server-authoritative.
4. Financial operations that affect multiple records are transactional.
5. Every financial transaction has a unique system-generated reference.
6. Financial history is permanent.
7. Account balances are server-maintained.
8. Internal transfers do not change total Masjid funds.
9. Payment verification is separate from payment-link generation.
10. Only verified payments become verified financial receipts.
11. Financial deletion is President-only.
12. Important financial changes are audited.
13. Supporting documents remain linked to the related records.
14. Dashboard/report totals are derived from authoritative records.
15. Storage optimization must not remove required financial history.

---

# 3. Financial Architecture Overview

```text
                    MONEY IN
                       │
       ┌───────────────┼─────────────────┐
       │               │                 │
       ▼               ▼                 ▼
 Monthly Donation  Additional       Jummah Cash
                  Donation           Collection
       │               │                 │
       └───────────────┼─────────────────┘
                       ▼
                 Payment / Receipt
                       │
                       ▼
                Finance Verification
                       │
                       ▼
              Financial Transaction
                       │
                       ▼
                 Account Balance


                    MONEY OUT
                       │
                       ▼
                    EXPENSE
                       │
                       ▼
               Expense Payment(s)
                       │
                       ▼
              Financial Transaction
                       │
                       ▼
                 Account Balance


                 MONEY MOVEMENT
                       │
                       ▼
                Internal Transfer
                 │            │
                 ▼            ▼
              Source       Destination
               Debit         Credit
```

---

# 4. Financial Domains

The model is divided into:

```text
A. Donation Obligations
B. Payment Processing
C. Financial Accounts
D. Financial Ledger
E. Expenses
F. Internal Transfers
G. Collections
H. Corrections
I. Reporting
J. Audit
```

---

# 5. Donation vs Financial Transaction

These concepts must not be confused.

## Donation record

Answers:

> What donation was due/received from this donor/member?

## Financial transaction

Answers:

> What accounting effect did this money have on a Masjid financial account?

Therefore:

```text
Donation
   ↓
Verified Payment
   ↓
Financial Transaction
```

A donation-specific record should not replace the authoritative ledger.

---

# 6. Payment Link vs Payment vs Financial Receipt

These are separate concepts.

```text
Payment Request
      ↓
Payment Attempt
      ↓
Actual Payment
      ↓
Finance Verification
      ↓
Financial Receipt
```

The following must never be treated as equivalent:

```text
Link Generated
Link Opened
UPI App Opened
Payment Initiated
Payment Reported by Client
Payment Received
Payment Verified
Financially Posted
```

Only the approved verification workflow can create an authoritative verified receipt.

---

# 7. Monetary Representation

Use exact monetary values.

Recommended PostgreSQL representation:

```sql
NUMERIC(14,2)
```

or another exact representation explicitly approved during implementation.

Do not use floating-point types such as:

```text
REAL
DOUBLE PRECISION
JavaScript floating-point number
```

as the authoritative accounting representation.

---

# 8. Currency

V1 uses:

```text
INR / Indian Rupee / ₹
```

The currency should be treated consistently throughout:

- Database
- Backend
- Web
- Android
- iOS
- Reports
- PDF

No multi-currency accounting is required for V1.

---

# 9. Financial Accounts

A financial account is a Masjid-owned financial bucket.

Examples:

```text
Cash
Bank Account
UPI
Other legitimate account
```

Each account has:

- Stable ID
- Name
- Type
- Opening balance
- Current balance
- Active/deactivated state

---

# 10. Account Ownership

The accounts represented by the financial system are Masjid accounts.

The model must not be used to track unrelated personal accounts.

---

# 11. Account Types

V1 account types:

```text
CASH
BANK
UPI
OTHER
```

The exact enum name can differ, but the conceptual categories should remain.

---

# 12. Account Identity

Each account has a stable internal UUID.

A human-readable account name is separate.

Example:

```text
id: UUID
name: Main Bank Account
type: BANK
```

Do not use the display name as the primary key.

---

# 13. Bank Account Information

Where a Bank account is configured, the application may store:

- Bank name
- Account name
- Last 4 digits

Do not store full bank account numbers in ordinary application data unless a later requirement explicitly requires it.

---

# 14. UPI Account Information

V1 allows one active Masjid UPI destination.

The financial model may associate a UPI ID with an active UPI account.

The payment-link generator uses the active UPI ID.

---

# 15. One Active UPI Destination

V1 rule:

```text
At most one active UPI destination
```

Finance can change it.

Historical payment requests retain a snapshot of the UPI ID used.

---

# 16. UPI Configuration History

A UPI change must not rewrite historical transactions.

Conceptually:

```text
Old UPI ID
     ↓
Historical payment request
     ↓
Historical financial record

New UPI ID
     ↓
Future payment requests
```

The change is audited.

---

# 17. Account Opening Balance

Every financial account may have an opening balance.

Example:

```text
Cash
Opening Balance = ₹35,000
```

The opening balance is the baseline from which subsequent account effects are calculated.

---

# 18. Opening Balance Evidence

V1 does not require separate evidence/document storage specifically for opening balances.

However, the opening balance entry remains part of the account's financial baseline.

---

# 19. Current Account Balance

The account's current balance is server-controlled.

Conceptually:

```text
Current Balance
=
Opening Balance
+
Credits
-
Debits
```

The client must not directly set the current balance.

---

# 20. Balance Update Rule

When a financial transaction posts:

### Credit

```text
Current Balance += Amount
```

### Debit

```text
Current Balance -= Amount
```

The update must occur transactionally with the financial transaction.

---

# 21. Negative Balance

Negative balances are permitted where required by the V1 business rules.

The application should warn users about a negative balance rather than silently rejecting the financial transaction solely because the result is negative.

---

# 22. Ledger as Source of Truth

The authoritative financial activity is the ledger:

```text
financial_transactions
```

The account balance is an operational representation of that ledger.

A balance must never be manually adjusted without a corresponding controlled financial operation.

---

# 23. Financial Transaction Identity

Every financial transaction receives a unique system-generated transaction reference.

Example:

```text
TX-2026-000001
TX-2026-000002
```

The exact format may change.

The identity must be:

- Unique
- Stable
- Server-generated
- Non-client-controlled

---

# 24. Financial Transaction Fields

Conceptually:

```text
id
transaction_id
account_id
transaction_date
transaction_type
direction
amount
category_id
payment_method
reference_id
source_type
source_id
description
created_by
created_at
updated_at
```

The exact SQL schema is defined in `DATABASE_SCHEMA.md`.

---

# 25. Transaction Date vs Entry Time

The model stores both:

```text
transaction_date
created_at
```

These have different meanings.

### Transaction date

When the financial activity is considered to have occurred.

### Created at

When the record was entered into the application.

This allows authorized past/future-dated entries while preserving actual entry timing.

---

# 26. Financial Direction

Financial transactions use:

```text
CREDIT
DEBIT
```

### CREDIT

Money enters the account.

### DEBIT

Money leaves the account.

---

# 27. Financial Transaction Types

Recommended V1 types:

```text
DONATION
JUMMAH_COLLECTION
OTHER_INCOME
EXPENSE_PAYMENT
TRANSFER
ADJUSTMENT
```

The exact final enum may be refined during implementation without changing the conceptual model.

---

# 28. Source Attribution

Where possible, every financial transaction should identify its source.

Conceptually:

```text
source_type
source_id
```

Examples:

```text
DONATION
EXPENSE_PAYMENT
JUMMAH_COLLECTION
TRANSFER
ADJUSTMENT
```

This enables financial traceability.

---

# 29. Source Record Principle

A financial transaction should be traceable back to the originating business event.

Example:

```text
Financial Transaction
      ↓
Expense Payment
      ↓
Expense
```

This is important for audit and reporting.

---

# 30. Monthly Donation Model

A monthly donation is an agreed monthly obligation for a member.

Example:

```text
September
Member A
Expected = ₹500
```

The monthly record is separate from the actual payment.

---

# 31. Donation Term Model

Donation terms represent the agreed monthly amount over time.

Example:

```text
Effective July → ₹500
Effective September → ₹700
```

The applicable term determines the amount for future monthly records.

---

# 32. Historical Monthly Amounts

When a member's agreed amount changes:

```text
Past months → unchanged
Future months → new amount
```

The system must not rewrite historical monthly donation amounts.

---

# 33. Monthly Donation Record

Each member/month has one monthly record.

```text
Member + Month → One Monthly Donation
```

Constraint:

```text
UNIQUE(member_id, donation_month)
```

---

# 34. Monthly Donation Status

Recommended conceptual statuses:

```text
DUE
PENDING
PAID
```

The exact stored status model can evolve during implementation.

The key business meanings remain:

- DUE = current expected payment
- PENDING = unpaid/outstanding
- PAID = fully settled and verified

---

# 35. Monthly Donation Completion

A monthly donation is complete only when the full applicable monthly amount has been received/verified.

Example:

```text
Expected = ₹500
Received = ₹300
```

This does not complete the monthly obligation.

---

# 36. Combined Outstanding Payment

Multiple outstanding months can be paid together.

Example:

```text
July ₹500
August ₹500
September ₹500

Combined = ₹1,500
```

One payment can be associated with multiple monthly records.

---

# 37. FIFO Allocation

Combined payment allocation uses:

```text
Oldest outstanding month first
```

Example:

```text
July → August → September
```

The backend/database performs this allocation.

The client does not control allocation.

---

# 38. Payment Allocation Model

A many-to-many-like relation exists between:

```text
Payment
Monthly Donation
```

through:

```text
payment_allocations
```

One payment:

```text
→ many monthly donations
```

One monthly donation:

```text
→ one complete settlement allocation
```

under V1 full-month rules.

---

# 39. Payment Allocation Integrity

For a monthly donation:

```text
Allocated Amount = Expected Amount
```

Partial month completion is not supported.

The backend must validate this before changing the monthly record to Paid.

---

# 40. Overpayment

If a payment exceeds all applicable outstanding complete monthly donations:

```text
Payment
  ├── Outstanding allocation(s)
  └── Additional General Donation
```

Example:

```text
Outstanding = ₹1,000
Payment     = ₹1,200

₹1,000 → monthly dues
₹200   → additional General Donation
```

---

# 41. No Future-Month Credit

The extra ₹200 must not:

- Pay next month in advance.
- Reduce next month's agreed amount.
- Modify future monthly records.

It is an additional voluntary donation.

---

# 42. Additional General Donation

Additional donations use:

```text
General Donation
```

There is no V1 purpose-selection system.

A member may enter any positive amount.

---

# 43. Additional Donation Financial Flow

```text
Member
   ↓
Enter Additional Amount
   ↓
Payment Request
   ↓
UPI Payment
   ↓
Finance Verification
   ↓
Additional Donation
   ↓
Financial Transaction CREDIT
```

---

# 44. Anonymous Donation Model

Anonymous donations are not tied to a Member unless explicitly required.

Conceptually:

```text
Anonymous Donation
      ↓
Payment / Financial Record
```

Required financial information still includes:

- Amount
- Date
- Method/account
- Verification
- Recording actor
- Reference where available

---

# 45. Referral Contribution and Finance

Committee contribution is derived from:

```text
Primary Referrer
+
Finance-Verified Donations
```

A mere referral does not create a financial contribution.

Only verified financial receipts count.

---

# 46. Historical Referrer Attribution

To prevent current referral changes from silently rewriting history, the financial attribution should preserve the referrer context applicable when the contribution is recognized.

Implementation may use a historical snapshot/reference.

The exact implementation must be documented before production.

---

# 47. Payment Verification

Finance is the operational authority for payment verification.

The verification operation should record:

- Amount
- Payment date
- Payment method
- External reference
- Verified by
- Verified timestamp

---

# 48. Payment Reference

For UPI/digital payments, record an external transaction/reference ID where available.

The reference should be protected against duplicate processing.

---

# 49. Duplicate Payment Protection

A payment must not be posted twice because of:

- Double click
- Provider retry
- Webhook retry
- Manual duplicate verification
- Network retry

Use:

- Reference uniqueness
- Idempotency
- State-transition protection
- Database constraints

---

# 50. Payment Verification State

Conceptually:

```text
UNVERIFIED
VERIFIED
REJECTED
```

A verified payment should not be verified again into a second financial transaction.

---

# 51. Payment vs Donation Status

Payment verification and monthly donation status are related but distinct.

Example:

```text
Payment = VERIFIED
      ↓
Apply Allocation
      ↓
Monthly Donation = PAID
```

A payment cannot be considered financially complete merely because a client reports success.

---

# 52. Financial Posting

After payment verification:

```text
Verified Payment
      ↓
Financial Posting
      ↓
Account Balance Update
      ↓
Audit
```

The posting should occur atomically where related records must remain consistent.

---

# 53. Financial Transaction Atomicity

For donation verification, the critical transaction may include:

```text
Payment verification
+
Payment allocation
+
Monthly status update
+
Additional donation for excess
+
Financial transaction
+
Account balance
+
Referral attribution impact
+
Audit event
```

All required changes should remain consistent.

---

# 54. Expense Model

Expenses represent Masjid spending.

An expense has:

- Stable expense reference
- Amount
- Date
- Category
- Description
- Status
- Bill
- Creator
- Payments

---

# 55. Expense vs Payment

The expense is the obligation/work record.

The payment is the actual money leaving an account.

Therefore:

```text
Expense
   ↓
Expense Payment
   ↓
Financial Transaction
```

---

# 56. Multiple Expense Payments

One expense can have multiple payments.

Example:

```text
Expense ₹10,000

UPI   ₹4,000
Cash  ₹3,000
Bank  ₹3,000
```

The expense remains one business record.

Each payment has its own financial effect.

---

# 57. Expense Payment Integrity

The normal rule is:

```text
SUM(all expense payments) ≤ Expense Amount
```

The backend must enforce this transactionally.

---

# 58. Expense Status

V1:

```text
ADDED
PARTIALLY_PAID
PAID
CANCELLED
```

The status should be derived/transitioned from actual payment state under backend rules.

---

# 59. Bill Requirement

Before an expense can become Paid:

```text
Bill must exist
```

Accepted formats:

```text
PDF
JPG
PNG
```

---

# 60. Payment Proof Requirement

Before an expense can become Paid:

```text
Payment proof must exist
```

Accepted formats:

```text
PDF
JPG
PNG
```

---

# 61. Expense Cancellation

Finance can cancel an unpaid expense.

Cancellation requires:

```text
Reason
```

The cancelled record remains in historical data.

---

# 62. Expense Amount Correction

If an expense amount changes:

```text
Original Amount
New Amount
Reason
Actor
Timestamp
```

The expense reference remains the same.

---

# 63. Expense Correction Example

```text
Original expense = ₹10,000
Paid            = ₹4,000
Remaining       = will not be incurred

Corrected expense amount = ₹4,000
```

The database must ensure the corrected amount remains compatible with payments already recorded.

---

# 64. Payment Proof Replacement

Finance may replace/delete payment proof according to the approved permission model.

The action should record:

- Who
- When
- Related payment
- Result

A reason may be recorded where applicable.

---

# 65. Jummah Cash Collection

Jummah collection is a single total cash record per Friday.

Example:

```text
Friday
Jummah Cash Collection
₹18,500
```

No individual donor records are required for this collection.

---

# 66. Jummah Collection Financial Flow

```text
Jummah Cash Collection
       ↓
Cash Account
       ↓
Financial Transaction CREDIT
       ↓
Audit / Reports
```

Authorized entry users:

- President
- Secretary
- Finance

---

# 67. Jummah Collection and Referral

Jummah cash collection is not attributed to committee referrals.

It is a general Masjid collection.

---

# 68. Other Income

The financial system may support other legitimate receipts.

Such entries should include:

- Amount
- Date
- Account
- Category/type
- Description
- Reference where applicable
- Created by

---

# 69. Internal Transfers

Internal transfers move funds between Masjid accounts.

Example:

```text
Cash → Bank
₹20,000
```

Financial effects:

```text
Cash  -₹20,000
Bank  +₹20,000
```

Overall Masjid funds:

```text
No change
```

---

# 70. Transfer Identity

Every transfer receives a unique Transfer ID.

Example:

```text
TR-2026-000001
```

The same Transfer ID links both sides.

---

# 71. Transfer Atomicity

A transfer should commit:

```text
Source debit
+
Destination credit
+
Transfer record
+
Audit event
```

as one logical transaction.

A half-completed transfer is not acceptable.

---

# 72. Transfer Direction

V1 supports:

- Cash → Bank
- Bank → Cash
- Bank → Bank
- Other legitimate account → another account where applicable

---

# 73. Transfer vs Income/Expense

An internal transfer is not:

```text
New income
```

and not:

```text
New expense
```

It is a movement between the Masjid's own accounts.

Reports must avoid double counting it as external money.

---

# 74. Financial Adjustments

An adjustment is used only for a legitimate documented financial correction.

It must not become a shortcut for arbitrary balance editing.

Adjustments require:

- Authorization
- Amount
- Direction
- Reason
- Actor
- Timestamp
- Audit

---

# 75. Current Balance Calculation

Conceptually:

```text
Opening Balance
      +
All Account Credits
      -
All Account Debits
      =
Expected Balance
```

The operational `current_balance` should match the authoritative ledger.

---

# 76. Balance Reconciliation

A controlled backend operation should be able to calculate:

```text
Expected Balance
vs
Stored Current Balance
```

Any discrepancy should be investigated and corrected through an approved process.

The system must not hide discrepancies by rewriting transaction history.

---

# 77. Historical Financial Stability

Current configuration changes must not rewrite historical meaning.

Examples:

```text
UPI ID changed
→ old payment request retains old UPI ID snapshot

Monthly amount changed
→ old monthly donation retains old expected amount

Category renamed/deactivated
→ historical transaction retains category reference

Account deactivated
→ old transactions remain
```

---

# 78. Account Deactivation

When an account is closed/deactivated:

- New transactions should be blocked according to policy.
- Historical transactions remain.
- Historical reports remain readable.
- Account data is not hard-deleted.

---

# 79. Financial Deletion

Only President may delete a financial transaction.

Deletion is a high-risk action.

Backend flow:

```text
Authenticate
     ↓
President authorization
     ↓
Identify transaction
     ↓
Validate dependencies
     ↓
Delete/retire according to policy
     ↓
Correct account balance
     ↓
Audit
```

---

# 80. Dependency Protection During Deletion

Do not cascade-delete unrelated financial history.

Examples:

```text
Deleting one payment
≠
Deleting the member
≠
Deleting all donations
```

Foreign-key behavior must protect historical data.

---

# 81. Financial Corrections vs New Transactions

V1 does not require every correction to create a separate correction transaction.

Where the product rule says the same transaction ID is retained, update the transaction through an authorized correction workflow and preserve correction metadata.

---

# 82. Correction Metadata

At minimum where applicable:

```text
Previous Value
New Value
Reason
Changed By
Changed At
```

This metadata should be auditable.

---

# 83. Financial Categories

Categories classify financial activity.

Examples:

- System categories
- President-created custom categories

A category can be deactivated.

Historical transactions continue referencing it.

---

# 84. Category Stability

Renaming or deactivating a category must not change the historical amount or transaction meaning.

Avoid deleting categories referenced by historical transactions.

---

# 85. Supporting Documents

Financial records may have supporting documents.

Examples:

```text
Expense
→ Bill

Expense Payment
→ Payment Proof
```

The document metadata references the record.

---

# 86. File Storage

The binary file should be stored in Supabase Storage.

The database stores metadata/reference.

Conceptually:

```text
Financial Record
     ↓
File Metadata
     ↓
Supabase Storage Object
```

---

# 87. Financial File Retention

Required financial evidence must not be deleted merely to save storage.

Storage optimization should instead use:

- Compression where safe
- Deduplication/reference reuse
- Appropriate file limits
- Temporary report generation
- Efficient object paths

---

# 88. Financial Reports

Reports derive from authoritative financial data.

Supported reporting periods:

- Daily
- Monthly
- Yearly
- Custom date range

---

# 89. Financial Report Inputs

Reports may filter by:

- Date/range
- Account
- Credit/debit
- Amount
- Payment method
- Category
- Reference ID

---

# 90. Financial Report Calculation

A report should follow:

```text
Opening Balance
+
Income / Receipts
-
Expenses / Payments
± Adjustments
=
Closing / Current Balance
```

Internal transfers are represented as account movements but should not inflate total Masjid funds.

---

# 91. Account-Wise Reports

The system should allow users with appropriate permissions to view:

```text
Cash
Bank
UPI
Other
```

separately.

---

# 92. Overall Masjid Funds

Overall funds represent the combined financial position of the active/historical Masjid accounts as defined by the accounting model.

Internal transfers must not alter the total.

---

# 93. Donation Reports

Donation reports may include:

- Monthly donations
- Additional donations
- Anonymous donations
- Jummah collections
- Verified donations
- Outstanding amounts

Donation reports should distinguish expected vs verified money.

---

# 94. Committee Contribution Reports

Committee contribution should be derived from:

```text
Verified Donations
+
Historical/Current Referral Attribution
```

The report should clearly label the metric.

Example:

```text
Members Referred: 20
Verified Contribution Through Referrals: ₹75,000
```

---

# 95. Financial Audit Report

The financial audit report should be professionally structured.

At minimum, it should support:

- Masjid name
- Reporting period
- Opening balance
- Income/receipts
- Donations
- Collections
- Expenses
- Transfers where relevant
- Closing balance
- Transaction details
- References
- Generated timestamp
- Page numbers
- Signature/approval areas where appropriate

---

# 96. PDF Generation

Reports should be generated from current authorized data.

Generated PDFs should normally be temporary unless an explicit retention requirement exists.

This reduces duplicate storage.

---

# 97. Audit Trail

Important financial actions must produce audit records.

Examples:

```text
Donation verification
UPI change
Financial transaction creation
Financial transaction correction
Financial transaction deletion
Expense creation
Expense payment
Payment-proof change
Account change
Transfer
```

---

# 98. Audit Actor

Financial actions should identify:

```text
Who
```

using the stable application User ID.

Do not rely only on names because names can change.

---

# 99. Audit Timestamp

Audit timestamps are server-controlled.

Do not trust the device's local clock as the authoritative audit time.

---

# 100. Audit Metadata

Useful financial audit metadata can include:

```text
Previous amount
New amount
Reason
Reference
Account
Status change
```

Avoid storing unnecessary secrets or sensitive authentication material.

---

# 101. Financial Privacy

Financial information is sensitive.

Access must be role-controlled.

Members should not receive unrestricted access to:

- Other members' donation records
- Financial account balances
- Expenses
- Bills/payment proofs
- Audit information

---

# 102. Financial Role Boundaries

Current high-level model:

```text
President
→ Overall financial administration + deletion authority

Finance
→ Operational financial control + verification + expenses

Auditor
→ Financial review/read access

Secretary
→ Authorized operational records such as Jummah cash collection
```

Exact permissions are defined in `USER_ROLES_PERMISSIONS.md`.

---

# 103. Transaction Concurrency

Financial operations must be safe under simultaneous requests.

Examples:

```text
Two verification attempts
Two expense payments
Two transfers
Two account updates
```

Use database transactions and appropriate locking/constraints.

---

# 104. Transaction Idempotency

Retrying a request must not create duplicate financial records.

Examples:

```text
Same payment verification
→ one financial posting

Same transfer request
→ one transfer

Same expense payment request
→ one payment
```

---

# 105. Payment Reference Protection

When an external reference is available:

```text
(provider, external_reference)
```

should be treated as a uniqueness candidate.

The exact constraint depends on provider behavior.

---

# 106. Financial API Design

Financial APIs should be command-oriented.

Prefer:

```text
verifyDonation()
recordExpensePayment()
createTransfer()
correctTransaction()
deleteFinancialTransaction()
```

over unrestricted generic operations such as:

```text
updateFinancialRow()
```

---

# 107. Financial Database Operations

Database functions/RPC may be appropriate for:

- Atomic transfer
- FIFO allocation
- Financial posting
- Balance update
- Expense payment constraint
- Concurrency-sensitive operations

The goal is transactional integrity, not moving all business logic into SQL.

---

# 108. Financial Data Flow — Monthly Donation

```text
Member
  ↓
Monthly Donation Record
  ↓
Payment Request
  ↓
UPI
  ↓
Actual Payment
  ↓
Finance Verification
  ↓
Payment
  ↓
Allocation
  ↓
Monthly Donation PAID
  ↓
Financial Transaction CREDIT
  ↓
Account Balance
  ↓
Audit
```

---

# 109. Financial Data Flow — Additional Donation

```text
Member
  ↓
Additional General Donation
  ↓
Payment
  ↓
Finance Verification
  ↓
Financial Transaction CREDIT
  ↓
Account Balance
  ↓
Audit
```

---

# 110. Financial Data Flow — Anonymous Donation

```text
Anonymous Donor
  ↓
Donation Entry
  ↓
Finance Verification
  ↓
Financial Transaction CREDIT
  ↓
Account Balance
  ↓
Audit
```

---

# 111. Financial Data Flow — Jummah Cash

```text
Jummah Cash Collection
  ↓
Cash Account
  ↓
Financial Transaction CREDIT
  ↓
Cash Balance
  ↓
Audit
```

---

# 112. Financial Data Flow — Expense

```text
Expense
  ↓
Bill
  ↓
Payment
  ↓
Payment Proof
  ↓
Financial Transaction DEBIT
  ↓
Account Balance
  ↓
Audit
```

---

# 113. Financial Data Flow — Transfer

```text
Source Account
  ↓
Transfer
  ↓
DEBIT
  ↓
Destination Account
  ↓
CREDIT
  ↓
Balances
  ↓
Audit
```

---

# 114. Financial Data Flow — Correction

```text
Existing Transaction
      ↓
Authorized Correction
      ↓
Previous Value
      +
New Value
      +
Reason
      +
Actor
      ↓
Update Financial State
      ↓
Correct Balance
      ↓
Audit
```

---

# 115. Financial Storage Model

The financial database should prioritize relational records.

Use object storage for:

- Bills
- Payment proofs
- Other approved financial documents

Do not store large files directly inside financial transaction records.

---

# 116. Financial Storage Optimization

Use:

- Efficient data types
- Normalized records
- Proper indexes
- Object storage
- File compression
- No duplicate uploads
- Temporary PDF generation

Do not use:

```text
Delete old transactions
Delete old donation history
Delete committee financial history
```

as a storage optimization strategy.

---

# 117. No Financial History Purge

The system must not automatically purge:

- Donations
- Expenses
- Payments
- Transfers
- Financial transactions
- Required supporting records

unless a future legal/retention requirement explicitly defines a compliant process.

---

# 118. Financial Backup

The production financial database must be backed up.

Backup must include:

- Accounts
- Transactions
- Donations
- Payments
- Expenses
- Transfers
- Audit events where required
- File metadata
- Required financial documents

The exact backup mechanism is defined in `BACKUP_AND_RECOVERY.md`.

---

# 119. Restore Validation

A financial backup is considered usable only when a restoration test can successfully recover:

```text
Database
+
Relationships
+
Financial balances
+
Supporting metadata
```

and produce correct reports.

---

# 120. Financial Migration Safety

Schema migrations affecting financial data require:

- Pre-migration backup
- Test migration
- Financial total validation
- Constraint validation
- Report validation
- Recovery strategy

---

# 121. Financial Test Data

Development/test environments should use synthetic financial data.

Do not routinely use actual Masjid financial records for testing.

---

# 122. Financial Test Scenarios

At minimum test:

1. Monthly donation paid.
2. Monthly donation pending.
3. Monthly donation partial payment rejected.
4. Combined payment.
5. FIFO allocation.
6. Overpayment.
7. Additional General Donation.
8. Anonymous donation.
9. Jummah cash collection.
10. Expense with one payment.
11. Expense with multiple payments.
12. Expense cancellation.
13. Expense correction.
14. Internal transfer.
15. Negative balance.
16. Financial transaction correction.
17. Authorized deletion.
18. Unauthorized deletion.
19. Duplicate payment reference.
20. Duplicate verification.
21. Concurrent financial operations.
22. Financial report total.

---

# 123. Financial Invariants

The following rules are mandatory:

### Invariant 1

Every financial transaction has a unique system-generated identity.

### Invariant 2

Financial amounts use exact monetary representation.

### Invariant 3

Account balances are server-controlled.

### Invariant 4

A payment link is not proof of payment.

### Invariant 5

Only Finance verification makes the payment financially verified.

### Invariant 6

A monthly donation requires full payment to become Paid.

### Invariant 7

Combined payments use FIFO.

### Invariant 8

Overpayment becomes Additional General Donation.

### Invariant 9

Additional donations do not reduce future monthly dues.

### Invariant 10

Internal transfers do not change overall Masjid funds.

### Invariant 11

Expense payment totals cannot exceed the expense amount under normal rules.

### Invariant 12

Bill is required before Paid.

### Invariant 13

Payment proof is required before Paid.

### Invariant 14

Financial deletion is President-only.

### Invariant 15

Financial history is not deleted for storage savings.

### Invariant 16

Important financial actions are audited.

### Invariant 17

Retrying a financial operation cannot silently create a duplicate financial posting.

### Invariant 18

Historical monthly amounts remain unchanged after future amount changes.

### Invariant 19

Historical payment requests retain the UPI ID used at generation.

### Invariant 20

A deactivated account does not lose historical transactions.

---

# 124. Financial Reporting Invariants

Reports must:

1. Derive from authoritative records.
2. Apply the selected reporting period correctly.
3. Distinguish account movement from overall funds.
4. Avoid double-counting internal transfers.
5. Reflect verified payments only where verified contribution is required.
6. Preserve historical transaction meaning.
7. Show reporting period clearly.
8. Show generation time.
9. Use the same monetary precision as the database.

---

# 125. Financial Security Invariants

1. Client cannot set balances.
2. Client cannot self-verify payments.
3. Client cannot choose arbitrary ledger effects.
4. Client cannot delete financial records.
5. Auditor cannot modify financial records.
6. Committee Member cannot modify arbitrary financial records.
7. Member cannot change their own fixed monthly donation.
8. Service-role keys remain server-side.
9. Sensitive files remain protected.
10. Financial writes are audited.

---

# 126. Financial Data Model Completion Criteria

This document is ready for implementation when:

- Donation model is defined.
- Payment model is defined.
- Payment allocation is defined.
- Account model is defined.
- Ledger model is defined.
- Expense model is defined.
- Expense payment model is defined.
- Transfer model is defined.
- Correction model is defined.
- Referral contribution model is defined.
- Audit relationship is defined.
- File relationship is defined.
- Balance rules are defined.
- Concurrency rules are defined.
- Idempotency rules are defined.

---

# 127. Related Documents

- `PROJECT_OVERVIEW.md`
- `PRODUCT_REQUIREMENTS.md`
- `FEATURE_SCOPE.md`
- `USER_ROLES_PERMISSIONS.md`
- `SYSTEM_ARCHITECTURE.md`
- `APPLICATION_ARCHITECTURE.md`
- `BACKEND_ARCHITECTURE.md`
- `DATABASE_ARCHITECTURE.md`
- `DATABASE_SCHEMA.md`
- `DATA_RELATIONSHIPS.md`
- `COMMITTEE_DATA_MODEL.md`
- `AUDIT_LOG_MODEL.md`
- `SECURITY_ARCHITECTURE.md`
- `STORAGE_STRATEGY.md`
- `BACKUP_AND_RECOVERY.md`
- `REPORTING_AND_AUDIT.md`
- `DEVELOPMENT_TASKS.md`

---

## Document Status

**Financial Data Model — V1 Implementation Baseline**

This document defines the authoritative financial model for Masjid-e-Mamoor 2.

All financial implementation must preserve the financial invariants defined here.
