# Masjid-e-Mamoor 2 — Finance System

**Document Status:** V1 Implementation Baseline  
**Version:** 1.0  
**Product:** Masjid-e-Mamoor 2 Internal Management Application  
**Scope:** V1  
**Primary Roles:** President, Finance, Auditor  
**Primary Areas:** Accounts, Receipts, Expenses, Payments, Transfers, Balances, Corrections, Audit  
**Last Updated:** 2026-09-17

---

# 1. Purpose

This document defines the operational finance system for Masjid-e-Mamoor 2.

The finance system is the application's authoritative operational layer for Masjid money.

It provides a controlled workflow for:

- Managing Masjid financial accounts
- Recording opening balances
- Recording receipts/income
- Recording donations
- Recording Jummah cash collections
- Recording other legitimate receipts
- Recording expenses
- Recording expense payments
- Uploading bills and payment proofs
- Supporting multiple payments for one expense
- Moving money between Masjid accounts
- Calculating balances
- Handling corrections
- Producing finance views and reports
- Preserving financial history
- Maintaining auditability

The core principle is:

> Finance operations must represent actual Masjid money movement without allowing client-side manipulation of balances or financial state.

---

# 2. Finance System Scope

V1 supports:

```text
Cash
Bank
UPI
Other legitimate financial accounts
Donations
Jummah cash collections
Other receipts
Expenses
Multiple expense payments
Bills
Payment proofs
Internal transfers
Financial adjustments
Corrections
Daily/monthly/yearly/custom reporting
Financial audit
```

V1 does not include:

```text
Asset management
Advance management
Formal bank reconciliation
Formal month closing/locking
Public financial dashboard
Financial rankings
Complex investment accounting
```

---

# 3. Finance Design Principles

1. PostgreSQL financial records are authoritative.
2. Current balances are server-controlled.
3. Exact monetary values are mandatory.
4. Every financial transaction has a stable system-generated identity.
5. Every financial movement must identify the affected account.
6. Income/receipts increase an account balance.
7. Expenses/payments decrease an account balance.
8. Internal transfers move money without changing overall Masjid funds.
9. Multiple expense payments are supported.
10. Expense payment totals cannot exceed expense amount under normal rules.
11. Bill and payment proof are required before an expense becomes Paid.
12. Finance controls routine financial operations.
13. President has broader financial administration and permanent financial deletion authority.
14. Auditor reviews but does not operate the financial ledger.
15. Corrections are controlled and audited.
16. Historical financial records are preserved.
17. Financial operations must be idempotent and concurrency-safe.
18. Notifications do not determine financial state.

---

# 4. Financial Roles

High-level V1 responsibility:

```text
President
    ↓
Overall financial administration
+
role/access management
+
financial deletion authority
+
oversight

Finance
    ↓
Operational financial controller
+
payment verification
+
expenses
+
accounts
+
transfers
+
routine finance operations

Auditor
    ↓
Financial review
+
reports
+
audit history
```

Exact permissions are defined in:

```text
USER_ROLES_PERMISSIONS.md
```

---

# 5. Finance Dashboard

The Finance dashboard should prioritize:

```text
Total Masjid Funds
Cash Balance
Bank Balance
UPI Balance
Other Account Balances
Pending Payments
Pending Expense Payments
Recent Transactions
Unverified Donations
Recent Expenses
Transfers
```

The exact UI is defined in:

```text
SCREEN_SPECIFICATIONS.md
```

---

# 6. Overall Masjid Funds

Overall Masjid funds represent the combined financial position across the configured Masjid accounts.

Conceptually:

```text
Overall Funds
=
Cash
+
Bank
+
UPI
+
Other legitimate accounts
```

Internal transfers do not change this total.

---

# 7. Financial Account Model

Each account represents one Masjid financial bucket.

V1 conceptual types:

```text
CASH
BANK
UPI
OTHER
```

---

# 8. Account Identity

Every account has:

```text
Stable ID
Name
Type
Opening Balance
Current Balance
Active/Inactive State
```

Database identity should use a UUID or equivalent stable identifier.

---

# 9. Cash Account

Cash represents physical Masjid cash held for legitimate operations.

A cash balance should change through:

```text
Cash receipt
Cash donation/collection
Cash expense/payment
Cash transfer
Adjustment
```

---

# 10. Bank Account

Bank accounts represent Masjid-owned bank balances tracked by the application.

V1 may store:

```text
Bank Name
Account Name
Last 4 Digits
```

Do not require full account-number storage in ordinary application data.

---

# 11. UPI Account

UPI represents the Masjid's configured digital payment destination/account context.

V1 supports:

```text
One active UPI destination
```

Historical payment requests retain the UPI destination snapshot used when generated.

---

# 12. Other Account

`OTHER` may be used for legitimate Masjid financial accounts not represented by:

```text
Cash
Bank
UPI
```

The account must still have clear identity and financial purpose.

Do not create arbitrary "other" accounts without a legitimate accounting reason.

---

# 13. Opening Balance

An account may have an opening balance.

Example:

```text
Cash
Opening Balance = ₹35,000
```

This provides the baseline for subsequent balance calculation.

---

# 14. Current Balance

Current balance is server-controlled.

Conceptually:

```text
Opening Balance
+
Credits
-
Debits
=
Current Balance
```

The client must never directly write:

```text
current_balance = user_input
```

---

# 15. Immediate Balance Update

V1 rule:

> Balance changes immediately when a financial transaction is entered/posted, regardless of the transaction date.

Example:

```text
Today = September 17
Transaction date = September 10
Transaction entered today
```

Once posted, the account's operational balance changes immediately.

---

# 16. Past-Dated Transactions

Authorized finance users may record past-dated transactions.

The system stores:

```text
transaction_date
+
created_at
```

separately.

---

# 17. Future-Dated Transactions

V1 permits future-dated financial entries where operationally required.

The effect still follows the V1 balance rule:

```text
Entry posted
→ balance changes immediately
```

The UI should clearly display the transaction date to avoid confusion.

---

# 18. Negative Balance

Negative account balances are permitted.

The application should warn the user when an operation produces a negative balance.

Do not silently block a legitimate transaction solely because it causes a negative balance.

---

# 19. Account Deactivation

An account can be deactivated.

Deactivation means:

```text
No new normal transactions
```

according to the implementation policy.

Historical transactions remain.

---

# 20. Closed Account History

Deactivated accounts remain available for:

- Historical reports
- Transaction inspection
- Audit review
- Financial analysis

Never hard-delete an account with financial history.

---

# 21. Financial Transaction

A financial transaction represents an accounting effect on a specific account.

Conceptual fields:

```text
Transaction ID
Account ID
Transaction Date
Type
Direction
Amount
Category
Payment Method
Reference
Source
Description
Created By
Created At
Updated At
```

Exact database fields are defined in `DATABASE_SCHEMA.md`.

---

# 22. Transaction Direction

Financial entries use:

```text
CREDIT
DEBIT
```

### Credit

Money enters the account.

### Debit

Money leaves the account.

---

# 23. Receipt / Income

A receipt increases an account.

Examples:

```text
Member donation
Additional donation
Anonymous donation
Jummah cash collection
Other receipt
```

---

# 24. Expense / Payment

An expense payment decreases an account.

Examples:

```text
Cash payment
Bank payment
UPI payment
Cheque payment
```

---

# 25. Donation Integration

Donation-specific records are maintained in the donation system.

The finance system receives the verified financial effect:

```text
Verified Donation
      ↓
Financial CREDIT
      ↓
Account Balance
```

Finance should not create a second independent donation ledger.

---

# 26. Jummah Collection Integration

Jummah cash collection is represented as:

```text
Cash Receipt
+
Financial CREDIT
```

No individual donor record is required for the aggregate Jummah collection.

---

# 27. Other Receipts

Finance may record legitimate receipts that do not originate from the donation system.

Example conceptual entry:

```text
Receipt
Amount = ₹5,000
Account = Bank
Category = Other Receipt
Description = ...
```

The category should be controlled.

---

# 28. Financial Categories

V1 supports:

```text
System-defined categories
+
President-created custom categories
```

Categories may be deactivated.

Historical transactions continue referencing the category.

---

# 29. Category Deactivation

Deactivation should prevent inappropriate new use while preserving historical records.

Do not hard-delete categories referenced by historical financial transactions.

---

# 30. Financial Reference

Transactions may have a reference such as:

```text
UPI reference
Bank reference
Cheque number
External receipt number
```

References improve traceability.

---

# 31. System Transaction ID

Every transaction gets a unique system-generated ID.

Example:

```text
TX-2026-000001
```

The exact display format may change.

The identity remains stable.

---

# 32. Transfer ID

Internal transfers receive a separate Transfer ID.

Example:

```text
TR-2026-000001
```

The same Transfer ID links both sides.

---

# 33. Expense Identity

Every expense has a stable system-generated identity.

Example:

```text
EXP-2026-000001
```

An expense can have multiple payment records.

---

# 34. Expense Lifecycle

V1:

```text
ADDED
   ↓
PARTIALLY_PAID
   ↓
PAID
```

or:

```text
ADDED
   ↓
CANCELLED
```

An expense can be paid through multiple payment events.

---

# 35. Finance Expense Workflow

Authoritative V1 workflow:

```text
Finance creates expense
        ↓
Bill uploaded
        ↓
Expense exists as Added
        ↓
Finance makes payment(s)
        ↓
Payment proof uploaded
        ↓
Payment totals checked
        ↓
Expense becomes Paid when fully paid
```

No President approval step is required for each expense.

---

# 36. President Oversight

When Finance adds an expense:

```text
Finance creates expense
        ↓
President receives notification/review visibility
```

The President may review the expense.

This is oversight, not a mandatory approval gate.

---

# 37. Bill Requirement

The expense must have a bill before it can become Paid.

Accepted formats:

```text
PDF
JPG
PNG
```

---

# 38. Payment Proof Requirement

The expense must have payment proof before it can become Paid.

Accepted formats:

```text
PDF
JPG
PNG
```

---

# 39. Payment Proof

Payment proof represents evidence that the payment was actually made.

The proof should be linked to the expense payment record.

It must not be treated as the financial transaction itself.

---

# 40. Multiple Expense Payments

One expense may be settled through multiple payments.

Example:

```text
Expense = ₹10,000

Payment 1 → UPI  → ₹4,000
Payment 2 → Cash → ₹3,000
Payment 3 → Bank → ₹3,000
```

---

# 41. Expense Payment Total

Normal business rule:

```text
Total Payments ≤ Expense Amount
```

The database/service layer must enforce this transactionally.

---

# 42. Partial Expense Payment

Partial expense payments are allowed.

Example:

```text
Expense = ₹10,000
Paid = ₹4,000
Remaining = ₹6,000
```

Status:

```text
PARTIALLY_PAID
```

---

# 43. Fully Paid Expense

When:

```text
Total valid payments = Expense Amount
```

and required documentation exists:

```text
Status = PAID
```

---

# 44. Payment Method

Expense payments may use legitimate methods such as:

```text
UPI
Bank
Cash
Cheque
Other approved method
```

The final controlled method list should be defined during implementation.

---

# 45. Payment Date

Each expense payment records its financial date.

This can differ from:

```text
Expense creation date
Application entry date
Proof upload date
```

---

# 46. Expense Payment Identity

Each expense payment needs a stable ID.

Example:

```text
EXPPAY-2026-000001
```

It links:

```text
Expense
+
Account
+
Financial Transaction
```

---

# 47. Expense Cancellation

Finance can cancel an unpaid expense.

Cancellation requires:

```text
Cancellation Reason
```

The cancelled expense remains in history.

---

# 48. Partial Payment and Cancellation

If part of the expense has already been paid, normal cancellation behavior must not delete the paid financial history.

Where the remaining amount will not be incurred, the preferred V1 correction is:

```text
Correct Expense Amount
```

rather than pretending the already-recorded payment never happened.

---

# 49. Expense Amount Correction

Example:

```text
Original expense = ₹10,000
Paid            = ₹4,000
Remaining       = not required
```

Corrected expense:

```text
₹4,000
```

The same Expense ID remains.

---

# 50. Correction Requirements

Expense amount correction records:

```text
Previous Amount
New Amount
Reason
Changed By
Changed At
```

---

# 51. Payment Proof Replacement

Finance may replace a payment proof.

The system records:

```text
Affected payment
Changed by
Changed at
```

The old file may be removed only according to storage/audit policy.

---

# 52. Payment Proof Deletion

Finance may delete payment proof where permitted.

The payment and financial transaction remain.

Who/when should be recorded.

A reason may be recorded where appropriate.

---

# 53. No Refund/Reversal Feature V1

V1 does not require a dedicated refund/reversal feature.

If an exceptional correction is required, it must use the approved correction/adjustment process rather than inventing an undocumented refund model.

---

# 54. Internal Transfers

Internal transfers move Masjid funds between accounts.

Example:

```text
Cash → Bank
₹20,000
```

---

# 55. Transfer Financial Effect

Source account:

```text
DEBIT ₹20,000
```

Destination account:

```text
CREDIT ₹20,000
```

Overall funds:

```text
No change
```

---

# 56. Transfer Atomicity

A transfer is one logical operation:

```text
Source Debit
+
Destination Credit
+
Transfer Record
+
Audit
```

All required parts must commit together.

---

# 57. Transfer Examples

Supported:

```text
Cash → Bank
Bank → Cash
Bank → Bank
Other → Bank
Bank → Other
```

where legitimate.

---

# 58. Transfer and Reports

Transfers may appear in account-level reports.

They must not be counted as:

```text
Income
```

or:

```text
Expense
```

for overall Masjid fund calculations.

---

# 59. Financial Adjustment

An adjustment corrects or records a legitimate financial difference.

It requires:

```text
Account
Amount
Direction
Reason
Actor
Timestamp
```

An adjustment must not be used as an unrestricted "set balance" button.

---

# 60. Balance Adjustment Principle

Never implement:

```text
Set Cash Balance = ₹50,000
```

as a direct financial operation.

Instead use:

```text
Controlled financial transaction/adjustment
```

with proper audit.

---

# 61. Financial Correction

A correction changes an existing financial record according to the V1 business rules.

Where required, retain:

```text
Same Transaction ID
Previous Value
New Value
Reason
Actor
Timestamp
```

---

# 62. Correction Ownership

President is responsible for the V1 permanent financial deletion authority.

Routine finance corrections follow the role-permission model.

All high-risk changes are audited.

---

# 63. Financial Deletion

Only President may permanently delete a financial transaction.

Deletion must:

- Check authorization.
- Validate dependencies.
- Remove/correct the financial effect.
- Recalculate affected balance.
- Preserve audit evidence.

---

# 64. Deletion and Audit

A deleted financial transaction should leave a corresponding audit record.

The audit should preserve enough safe context to identify:

```text
What was deleted
Amount
Account
Actor
Timestamp
Reference
```

---

# 65. Dependency Protection

Deleting one transaction must not cascade into unrelated history.

Examples:

```text
Financial transaction deletion
≠ delete member
≠ delete donation history
≠ delete audit history
```

---

# 66. Account Balance Recalculation

If a transaction is corrected/deleted according to authorized rules:

```text
Affected Account
      ↓
Recalculate/adjust balance
      ↓
Validate against ledger
```

The balance must remain consistent.

---

# 67. Running Cash Balance

Cash balance is calculated from:

```text
Opening Cash
+
Cash Credits
-
Cash Debits
```

The current balance is server-maintained.

---

# 68. Account-Wise Balance

Each account has an operational balance:

```text
Cash
Bank
UPI
Other
```

The Finance dashboard should show each separately.

---

# 69. Overall Balance

Overall Masjid funds are:

```text
Sum of relevant account balances
```

Internal transfers cancel across accounts.

---

# 70. Financial Search

Finance should be able to filter/search by:

```text
Date/range
Account
Credit/Debit
Amount
Method
Category
Reference
Transaction ID
Transfer ID
Expense ID
```

---

# 71. Financial Transaction Detail

A transaction detail screen should show enough context to understand:

```text
Transaction ID
Date
Account
Credit/Debit
Amount
Type
Category
Method
Reference
Description
Source
Created By
Created At
Audit context where permitted
```

---

# 72. Finance Recent Activity

Finance dashboard may show recent:

```text
Receipts
Donations
Expenses
Payments
Transfers
Corrections
```

Newest activity should be easy to identify.

---

# 73. Financial Alerts

The finance workspace may show operational alerts such as:

```text
Unverified payments
Overdue/unresolved financial records
Negative account balance
Expense awaiting required documentation
```

Notifications do not replace these dashboard states.

---

# 74. Unverified Payment Queue

Finance should have a clear queue of:

```text
Payments awaiting verification
```

Each item can show:

```text
Member
Amount
Payment purpose
Date
Reference
Request
Available evidence
```

---

# 75. Expense Queue

Finance should have a clear view of:

```text
Added expenses
Partially paid expenses
Paid expenses
Cancelled expenses
```

Filters may include:

```text
Status
Date
Category
Account/payment method
```

---

# 76. Financial Workflow — Donation

```text
Donation Request
      ↓
Actual Payment
      ↓
Finance Verification
      ↓
Payment Allocation
      ↓
Financial CREDIT
      ↓
Account Balance
      ↓
Audit
```

---

# 77. Financial Workflow — Expense

```text
Expense Created
      ↓
Bill
      ↓
Payment
      ↓
Payment Proof
      ↓
Financial DEBIT
      ↓
Account Balance
      ↓
Audit
```

---

# 78. Financial Workflow — Transfer

```text
Transfer Created
      ↓
Source Debit
      +
Destination Credit
      ↓
Account Balances
      ↓
Audit
```

---

# 79. Financial Workflow — Adjustment

```text
Identify discrepancy/legitimate correction
      ↓
Controlled adjustment
      ↓
Reason
      ↓
Financial posting
      ↓
Balance
      ↓
Audit
```

---

# 80. Financial Transaction Atomicity

Critical financial operations should use database transactions so related writes succeed/fail together.

Examples:

```text
Donation verification + posting
Expense payment + posting
Transfer
Financial correction
Financial deletion
```

---

# 81. Concurrency Protection

The system must protect against simultaneous operations.

Examples:

```text
Two Finance users verify same payment
Two expense payments added simultaneously
Two transfers affect same account
Two corrections affect same transaction
```

Database transactions and appropriate locking/constraints are required.

---

# 82. Idempotency

Financial commands must be retry-safe.

Example:

```text
Create transfer request
Network timeout
Client retries
```

Result:

```text
One transfer
```

not two.

---

# 83. No Client Balance Writes

The client must never directly perform:

```text
UPDATE accounts SET balance = ...
```

The balance is changed only through authorized server-side financial operations.

---

# 84. No Client Verification Flags

The client must not set:

```text
verified = true
```

or any equivalent financial-authority flag.

Verification is server-side and role-controlled.

---

# 85. Financial API Commands

Prefer explicit operations:

```text
createAccount()
recordReceipt()
verifyPayment()
createExpense()
recordExpensePayment()
cancelExpense()
correctExpenseAmount()
createTransfer()
createAdjustment()
correctTransaction()
deleteFinancialTransaction()
```

Avoid a generic endpoint capable of arbitrary ledger mutation.

---

# 86. Finance Authorization

Each financial command must validate:

```text
Authenticated user
+
Active user
+
Role
+
Permission
+
Record state
+
Business constraints
```

---

# 87. President Financial Authority

President can perform broad financial administration and has V1 authority to permanently delete financial transactions.

This does not require bypassing ordinary audit controls.

---

# 88. Finance Operational Authority

Finance controls the routine operational workflow:

```text
Payment verification
Account maintenance
Expense processing
Expense payments
Transfers
Financial entry
```

subject to role permissions.

---

# 89. Auditor Authority

Auditor can:

```text
View financial history
View reports
Review audit records
Inspect supporting evidence
```

Auditor cannot:

```text
Create transactions
Verify payments
Delete transactions
Modify balances
```

---

# 90. Secretary Financial Operations

Secretary may perform the V1 financial actions explicitly granted by the role model, including:

```text
Record Jummah cash collection
Enter/change agreed monthly contribution amount
```

Secretary does not become the general Finance controller solely by holding the Secretary role.

---

# 91. Committee Member Financial Boundary

Committee Members may participate in:

```text
Member registration
Agreed contribution amount workflow
```

as explicitly allowed.

They do not have general financial ledger control.

---

# 92. Member Financial Boundary

Members can:

```text
View own donation information
Make monthly donations
Make additional donations
View own donation history
```

They cannot:

```text
Verify payment
Edit ledger
Change account balances
Change fixed monthly contribution
View other members' finances
```

---

# 93. Financial Privacy

Financial information is private internal Masjid information.

Protect:

```text
Donation history
Expense records
Payment proof
Account balances
Audit history
Bank details
UPI transaction references
```

according to role.

---

# 94. Financial File Access

Bills/payment proofs must use protected object storage.

Do not expose permanent public URLs for sensitive financial documents.

Access should require authorized authentication.

---

# 95. Financial Reporting

V1 supports:

```text
Daily
Monthly
Yearly
Custom date range
```

reports.

---

# 96. Calendar Reporting

The annual reporting concept is:

```text
January 1 → December 31
```

The system must also support custom ranges.

---

# 97. Account Report

Account report can show:

```text
Opening Balance
Credits
Debits
Transfers
Adjustments
Closing/Current Balance
```

The report must clearly distinguish internal transfers from external income/expense.

---

# 98. Income Report

Income/receipt reporting can include:

```text
Monthly donations
Additional donations
Anonymous donations
Jummah collections
Other receipts
```

Only verified financial receipts should be counted as received money.

---

# 99. Expense Report

Expense reporting can include:

```text
Expense ID
Date
Category
Amount
Paid amount
Remaining amount
Status
Payment methods
```

---

# 100. Transfer Report

Transfer reporting can show:

```text
Transfer ID
Date
Source account
Destination account
Amount
Created by
```

Transfers should not inflate total Masjid funds.

---

# 101. Audit Report

Audit/reporting should allow authorized users to trace:

```text
Transaction
Payment
Expense
Account
Correction
Deletion
Actor
Timestamp
```

---

# 102. Financial PDF

The application should support a professional printable/downloadable financial audit PDF.

At minimum:

```text
Masjid-e-Mamoor 2
Reporting period
Opening balance
Income/receipts
Donations
Expenses
Payments
Transfers
Adjustments
Closing balance
Transaction references
Generated timestamp
Page numbers
Signature/approval areas where appropriate
```

---

# 103. PDF as Report Artifact

Generated PDFs are reports, not the source of truth.

The database remains authoritative.

Do not permanently save every generated report unless a specific retention requirement exists.

---

# 104. Financial Audit Trail

Important financial actions must create audit events.

Examples:

```text
Account created/changed
Donation verified
Expense created
Expense cancelled
Expense amount corrected
Expense payment created
Transfer created
Adjustment created
Financial transaction corrected
Financial transaction deleted
UPI changed
```

---

# 105. Financial Audit Actor

Audit events identify the authenticated actor by stable User ID.

Names are display information.

---

# 106. Financial Audit Timestamp

Audit timestamps are server-controlled.

Client-provided time is not authoritative.

---

# 107. Financial Data Retention

Do not automatically purge:

```text
Transactions
Donations
Payments
Expenses
Transfers
Corrections
Required financial evidence
Audit records
```

for storage savings.

---

# 108. Storage Strategy

Financial data should use:

```text
PostgreSQL
+
Supabase Storage for files
```

Avoid duplicating the same document in multiple locations.

---

# 109. File Naming/References

Financial file objects should have deterministic, non-sensitive storage paths.

Do not expose raw personal information in public storage object names where avoidable.

---

# 110. Financial Backup

Backup must include:

```text
Accounts
Transactions
Donations/payment references
Expenses
Expense payments
Transfers
Adjustments
Categories
Audit references
File metadata
```

Supporting file backup follows the storage/recovery strategy.

---

# 111. Financial Restore Validation

After a restore, verify:

```text
Account balances
Transaction counts
Donation totals
Expense totals
Transfer links
Audit references
Supporting file metadata
```

The restored system must produce the expected financial reports.

---

# 112. Financial Migration Safety

Schema migrations affecting finance require:

```text
Backup
Test migration
Balance validation
Transaction-count validation
Report validation
Recovery plan
```

---

# 113. Financial Test Data

Development environments should use synthetic financial data.

Do not casually populate development with real Masjid transaction data.

---

# 114. Finance Test Scenarios

At minimum test:

1. Create cash account.
2. Create bank account.
3. Create UPI account.
4. Set opening balance.
5. Record receipt.
6. Verify donation and post funds.
7. Record Jummah cash collection.
8. Record other receipt.
9. Create expense.
10. Add expense bill.
11. Add one payment.
12. Add multiple payments.
13. Add payment proof.
14. Expense becomes Partially Paid.
15. Expense becomes Paid.
16. Cancel unpaid expense.
17. Correct expense amount.
18. Create Cash→Bank transfer.
19. Create Bank→Cash transfer.
20. Create Bank→Bank transfer.
21. Create adjustment.
22. Produce negative balance warning.
23. Correct transaction.
24. President deletes financial transaction.
25. Non-President deletion rejected.
26. Auditor modification rejected.
27. Duplicate payment prevented.
28. Duplicate transfer prevented.
29. Concurrent operations remain consistent.
30. Historical account data remains after deactivation.
31. Historical transaction remains after correction.
32. Audit records are preserved.
33. Protected financial file access works.
34. Financial report excludes transfer double counting.
35. Financial report matches account balance.

---

# 115. Finance Invariants

The following rules are mandatory:

### Invariant 1

All authoritative financial amounts use exact monetary representation.

### Invariant 2

Every financial transaction has a unique system-generated identity.

### Invariant 3

Every financial transaction affects a defined Masjid account.

### Invariant 4

Balances are server-controlled.

### Invariant 5

Clients cannot directly set account balances.

### Invariant 6

Credits increase account balances.

### Invariant 7

Debits decrease account balances.

### Invariant 8

Balance changes occur immediately when the transaction is posted, regardless of transaction date.

### Invariant 9

Negative balances are permitted with warning.

### Invariant 10

Internal transfers do not change overall Masjid funds.

### Invariant 11

Transfers link source and destination movements through one Transfer ID.

### Invariant 12

Expense payment totals cannot exceed expense amount under normal rules.

### Invariant 13

Partial expense payments are supported.

### Invariant 14

Bill is required before an expense becomes Paid.

### Invariant 15

Payment proof is required before an expense becomes Paid.

### Invariant 16

Finance controls routine financial operations.

### Invariant 17

Auditor cannot modify financial records.

### Invariant 18

Only President has V1 permanent financial transaction deletion authority.

### Invariant 19

Financial deletion leaves audit evidence.

### Invariant 20

Financial corrections preserve transaction identity where V1 requires the same ID.

### Invariant 21

Important financial actions are audited.

### Invariant 22

Retried financial commands cannot silently create duplicate financial postings.

### Invariant 23

Concurrent financial operations cannot produce contradictory final state.

### Invariant 24

Historical financial records are not deleted for storage optimization.

### Invariant 25

Deactivated accounts retain historical transactions.

### Invariant 26

Donation records and the financial ledger remain linked but are not duplicated.

### Invariant 27

Payment verification is separate from payment-link generation.

### Invariant 28

Notifications do not determine financial state.

### Invariant 29

Sensitive financial documents use protected storage access.

### Invariant 30

Reports derive from authoritative financial records.

---

# 116. Acceptance Criteria

The Finance system is implementation-ready when it can:

- Manage Cash, Bank, UPI, and Other accounts.
- Set opening balances.
- Maintain server-controlled current balances.
- Record credits and debits.
- Permit past/future-dated entries under V1 rules.
- Show negative-balance warnings.
- Deactivate accounts without losing history.
- Record verified donation receipts.
- Record Jummah cash collections.
- Record other receipts.
- Create expenses.
- Require bills before Paid.
- Record multiple expense payments.
- Require payment proof before Paid.
- Support partial expense payment.
- Cancel unpaid expenses with a reason.
- Correct expense amounts with the same expense identity.
- Create internal transfers atomically.
- Preserve one Transfer ID across both sides.
- Create controlled adjustments.
- Correct financial records with audit.
- Restrict permanent transaction deletion to President.
- Provide Finance operational views.
- Provide Auditor read/review views.
- Generate financial reports.
- Generate printable/downloadable audit PDFs.
- Protect financial documents.
- Preserve financial history.
- Maintain complete traceability into the audit system.

---

# 117. Implementation Boundary

This document defines operational finance behavior.

The following belong elsewhere:

```text
Donation lifecycle        → DONATION_SYSTEM.md
Payment technical flow   → PAYMENT_SYSTEM.md
Member records            → MEMBER_MANAGEMENT.md
Financial data model      → FINANCIAL_DATA_MODEL.md
Expense-specific rules    → EXPENSE_SYSTEM.md
Committee contribution    → COMMITTEE_DATA_MODEL.md
Roles/permissions         → USER_ROLES_PERMISSIONS.md
Audit trail               → AUDIT_LOG_MODEL.md
Reporting/PDF             → REPORTING_AND_AUDIT.md
Database                  → DATABASE_SCHEMA.md
Security/RLS              → SECURITY_ARCHITECTURE.md
Storage                   → STORAGE_STRATEGY.md
Backup                    → BACKUP_AND_RECOVERY.md
```

---

# 118. Related Documents

- `PROJECT_OVERVIEW.md`
- `PRODUCT_REQUIREMENTS.md`
- `FEATURE_SCOPE.md`
- `USER_ROLES_PERMISSIONS.md`
- `AUTHENTICATION.md`
- `MEMBER_MANAGEMENT.md`
- `DONATION_SYSTEM.md`
- `PAYMENT_SYSTEM.md`
- `FINANCIAL_DATA_MODEL.md`
- `COMMITTEE_DATA_MODEL.md`
- `AUDIT_LOG_MODEL.md`
- `DATABASE_SCHEMA.md`
- `DATA_RELATIONSHIPS.md`
- `EXPENSE_SYSTEM.md`
- `REPORTING_AND_AUDIT.md`
- `SECURITY_ARCHITECTURE.md`
- `DATA_PRIVACY.md`
- `STORAGE_STRATEGY.md`
- `BACKUP_AND_RECOVERY.md`

---

## Document Status

**Finance System — V1 Implementation Baseline**

This document defines the authoritative operational finance workflow for Masjid-e-Mamoor 2.

All finance implementation must preserve the account, balance, transaction, expense, transfer, correction, security, and audit invariants defined here.
