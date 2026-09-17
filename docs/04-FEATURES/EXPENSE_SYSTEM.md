# Masjid-e-Mamoor 2 — Expense System

**Document Status:** V1 Expense System Baseline  
**Version:** 1.0  
**Product:** Masjid-e-Mamoor 2 Internal Management Application  
**Scope:** V1  
**Database:** PostgreSQL via Supabase  
**Related Documents:** FINANCE_SYSTEM.md, FINANCIAL_DATA_MODEL.md, PAYMENT_SYSTEM.md, DATABASE_SCHEMA.md, DATA_RELATIONSHIPS.md, AUDIT_LOG_MODEL.md, AUTHORIZATION_MODEL.md  
**Last Updated:** 2026-09-17

---

# 1. Purpose

The Expense System records Masjid expenses from entry through payment and final settlement.

V1 supports:

```text
Expense creation
Bill upload
Expense categories
Partial payments
Multiple payments
Payment proof
Cash payment
Bank payment
UPI payment
Cheque/other legitimate methods
Expense correction
Expense cancellation
Expense history
Financial posting
Audit trail
```

The system is designed so that:

```text
Expense
→ Payment
→ Financial Account Movement
→ Balance
→ Report
→ Audit
```

---

# 2. Core Principles

1. Finance is the operational financial controller.
2. President receives oversight notification when an expense is added.
3. President approval is not required for each expense.
4. Every expense has a clear financial amount.
5. Bills are required before an expense can reach the Paid state.
6. Multiple payments are supported.
7. Payment total cannot exceed expense amount.
8. Partial payments are supported.
9. Payment proof is required before an expense reaches Paid.
10. Corrections require authorization and reason.
11. Cancellation requires authorization and reason.
12. Historical expense records remain available.
13. Financial postings are server-authoritative.
14. Expense records and accounting transactions remain linked.
15. Duplicate payment posting must be prevented.

---

# 3. Roles

## President

Can:

```text
View expenses
Add/correct/cancel according to authorization
Review oversight information
Access reports
Perform broader financial administration
```

President does not need to approve each expense individually before Finance pays it.

---

## Finance

Primary expense controller.

Can:

```text
Create expense
Upload bill
Add payments
Upload payment proof
Correct expense amount where permitted
Cancel eligible unpaid expense
Replace/delete payment proof where permitted
View financial effect
```

Finance is the final operational controller for expense workflow in V1.

---

## Secretary

Only explicitly permitted operational/financial functions are available.

Secretary does not automatically receive Finance-level expense payment authority.

---

## Auditor

Can review:

```text
Expenses
Payments
Supporting records
Reports
Audit information
```

Auditor cannot mutate financial expense records.

---

## Committee Member

No unrestricted expense-management authority.

---

## Member

Cannot manage internal Masjid expenses.

---

# 4. Expense Lifecycle

V1 statuses:

```text
Added
Partially Paid
Paid
Cancelled
```

No Draft state exists.

Conceptual lifecycle:

```text
Create Expense
      ↓
Added
      ↓
Add Payment
      ↓
Partially Paid
      ↓
Add Remaining Payment
      ↓
Paid
```

Alternative:

```text
Added
  ↓
Cancelled
```

where cancellation is permitted.

---

# 5. Expense Record

Core fields:

```text
expense_id
title
description
expense_date
category_id
amount
paid_amount
status
bill_file_id
created_by
created_at
updated_by
updated_at
cancellation_reason
amount_correction_reason
```

---

# 6. Expense Amount

The expense amount represents the total amount actually intended to be incurred for the recorded expense.

Example:

```text
Expense amount = ₹10,000
```

This is not automatically equivalent to:

```text
Paid = ₹10,000
```

until payments are recorded and verified.

---

# 7. Bill Requirement

A bill is mandatory before the expense can reach:

```text
Paid
```

Supported V1 formats:

```text
PDF
JPG
PNG
```

The bill should be stored in protected private storage.

---

# 8. Expense Creation

Finance creates the expense directly.

Required workflow:

```text
Finance
→ Enter expense details
→ Select category
→ Enter amount/date
→ Upload bill
→ Save
```

After creation:

```text
President receives oversight notification
```

This notification is not an approval gate.

---

# 9. No President Approval Per Expense

V1 deliberately does not require:

```text
Finance creates expense
→ President approves
→ Finance pays
```

Instead:

```text
Finance creates expense
→ President notified for oversight
→ Finance controls payment
```

---

# 10. Expense Categories

V1 supports:

```text
System categories
President-created custom categories
```

Categories may be:

```text
Active
Inactive
```

A category must not be deleted if historical expenses reference it.

---

# 11. Expense Payment Model

One expense can have:

```text
Zero
One
Many
```

payments.

Example:

```text
Expense ₹10,000

UPI  ₹4,000
Cash ₹3,000
Bank ₹3,000
```

---

# 12. Partial Payments

Partial payment is allowed.

Example:

```text
Expense = ₹10,000
Payment = ₹4,000
```

Result:

```text
Paid = ₹4,000
Remaining = ₹6,000
Status = Partially Paid
```

---

# 13. Full Payment

When:

```text
Total verified payments = Expense amount
```

and required documentation rules are satisfied:

```text
Status = Paid
```

Example:

```text
Expense ₹10,000
UPI ₹4,000
Cash ₹3,000
Bank ₹3,000

Total paid = ₹10,000
Remaining = ₹0
Status = Paid
```

---

# 14. Payment Limit

The invariant is:

```text
Total payments <= expense amount
```

Therefore:

```text
Expense ₹10,000
Payment ₹10,001
```

must be rejected.

---

# 15. Payment Methods

V1 may support legitimate methods such as:

```text
UPI
Bank
Cheque
Cash
Other legitimate method
```

The exact method list can be implemented as a controlled enum/configuration.

---

# 16. Expense Payment Fields

Each payment should capture:

```text
expense_payment_id
expense_id
account_id
payment_method
amount
payment_date
external_reference
payment_proof_file_id
created_by
created_at
updated_by
updated_at
```

---

# 17. Financial Posting

An expense payment creates an accounting movement.

Conceptually:

```text
Expense Payment
      ↓
Financial Transaction
      ↓
Account Debit
      ↓
Account Balance
```

The database must prevent the operational record and accounting result from becoming inconsistent.

---

# 18. Multiple Payment Posting

For:

```text
Expense ₹10,000

UPI  ₹4,000
Cash ₹3,000
Bank ₹3,000
```

the system creates corresponding account movements:

```text
UPI account  -₹4,000
Cash account -₹3,000
Bank account -₹3,000
```

Total:

```text
-₹10,000
```

---

# 19. Payment Proof

Payment proof is mandatory before the expense reaches the fully Paid state.

Supported:

```text
PDF
JPG
PNG
```

Examples:

```text
UPI payment receipt
Bank proof
Cheque evidence
Other legitimate payment proof
```

Cash workflows follow the defined documentation requirement.

---

# 20. Payment Proof Storage

Payment proof must:

```text
Use private storage
Be linked to the payment/expense
Be authorization-controlled
Avoid public permanent links
```

---

# 21. Payment Proof Replacement

Finance may replace a payment proof where permitted.

Workflow:

```text
Open payment
→ Replace proof
→ Upload/validate new proof
→ Update reference
→ Clean old object safely
```

Actor/time should be recorded where required.

---

# 22. Payment Proof Deletion

Where permitted, Finance may delete a payment proof.

Requirements:

```text
Correct payment selected
Authorization verified
Storage reference updated
Object safely removed
Actor/time recorded where required
```

Deletion reason is optional unless another rule requires it.

---

# 23. Expense Cancellation

Finance can cancel an eligible unpaid expense.

Cancellation requires:

```text
Authorization
+
Cancellation reason
```

Cancelled expenses remain historical records.

---

# 24. Cancellation Rule for Partially Paid Expense

If an expense has already received a payment, cancellation must not silently erase that payment.

Example:

```text
Expense = ₹10,000
Paid = ₹4,000
Remaining ₹6,000 will not happen
```

Preferred V1 behavior:

```text
Correct expense amount to ₹4,000
```

rather than cancelling a partially paid expense without resolving the accounting meaning.

---

# 25. Expense Amount Correction

Finance/authorized role may correct an expense amount where permitted.

Correction requires:

```text
Current amount
New amount
Reason
Authorization
Audit
```

---

# 26. Correction Example

Original:

```text
Expense = ₹10,000
Paid = ₹4,000
```

New amount:

```text
₹4,000
```

Result:

```text
Paid = ₹4,000
Remaining = ₹0
Status = Paid
```

---

# 27. Correction Validation

New expense amount must satisfy:

```text
New amount >= total valid payments
```

The system must reject:

```text
New amount < already-paid amount
```

---

# 28. Correction Audit

Record:

```text
Old amount
New amount
Reason
Actor
Timestamp
```

The expense retains its identity.

---

# 29. Expense Payment Concurrency

Concurrent payment operations must be safe.

Example:

```text
Expense remaining = ₹6,000

User A attempts ₹4,000
User B attempts ₹4,000
```

The system must prevent:

```text
Total paid = ₹8,000
```

when only ₹6,000 remains.

---

# 30. Expense Payment Idempotency

Repeated payment submission caused by:

```text
Double click
Network retry
Request timeout
App retry
Browser retry
```

must not create unintended duplicate payment postings.

---

# 31. Expense Financial Integrity

The following must always hold:

```text
Paid amount = sum(valid expense payments)
Remaining = expense amount - paid amount
```

subject to the approved cancellation/correction state.

---

# 32. Expense Status Logic

Recommended:

```text
Added:
paid_amount = 0

Partially Paid:
0 < paid_amount < amount

Paid:
paid_amount = amount
+
required payment proof/documentation satisfied

Cancelled:
expense cancelled under authorized workflow
```

---

# 33. Expense Detail View

Display:

```text
Expense ID
Title
Category
Expense date
Amount
Paid
Remaining
Status
Bill
Payments
Payment proofs
Financial transactions
Audit context where authorized
```

---

# 34. Expense List View

Show:

```text
Expense ID
Date
Title
Category
Amount
Paid
Remaining
Status
```

Support filters:

```text
Date/range
Status
Category
Amount
```

---

# 35. Expense Search

Search/filter results must obey authorization.

Do not load every expense into the client and hide unauthorized records through frontend filtering.

---

# 36. Expense Reports

Reports may include:

```text
Date
Category
Expense amount
Paid amount
Remaining
Payment methods
Status
```

Reports must use authoritative database values.

---

# 37. Expense to Account Relationship

Each payment references the account from which money was paid.

Example:

```text
Expense
   ↓
Payment
   ↓
Cash Account
```

or:

```text
Expense
   ↓
Payment
   ↓
Bank Account
```

---

# 38. Expense to Financial Transaction

Each expense payment should produce the appropriate financial transaction.

The relationship must be traceable through:

```text
Expense Payment
→ Financial Transaction
```

---

# 39. Expense Transaction Identity

Each financial transaction retains its own unique system-generated transaction ID.

The expense payment references/links the relevant accounting record.

---

# 40. Financial Account Balance

When an expense payment is posted:

```text
Account balance decreases immediately
```

according to the V1 balance rule.

---

# 41. Past/Future Expense Dates

The application permits historical/future transaction dates according to V1 financial rules.

The date affects reporting.

The posting still affects the current account balance immediately when entered.

---

# 42. Expense Audit Events

Audit important events:

```text
EXPENSE_CREATED
EXPENSE_UPDATED
EXPENSE_PAYMENT_ADDED
EXPENSE_AMOUNT_CORRECTED
EXPENSE_CANCELLED
PAYMENT_PROOF_REPLACED
PAYMENT_PROOF_DELETED
```

Equivalent controlled event names are acceptable.

---

# 43. Expense Privacy

Expense records are internal Masjid financial data.

Do not expose:

```text
Bills
Payment proofs
Expense amounts
Internal financial context
```

to unauthorized users.

---

# 44. Expense Document Privacy

Private bills/payment proofs must be authorization-controlled.

A user knowing the storage path must not automatically gain access.

---

# 45. Error Handling

The system should clearly distinguish:

```text
Validation failure
Authorization failure
Storage failure
Financial posting failure
Concurrency conflict
Network retry
```

No failed payment should appear successful.

---

# 46. Failure During Payment Posting

If payment posting fails:

```text
Do not mark payment as successfully posted.
Do not leave inconsistent financial state.
Allow safe retry where appropriate.
```

Use transactional backend behavior.

---

# 47. Failure During Proof Upload

If proof upload fails:

```text
Do not claim proof exists.
Show failed/pending state.
Allow safe retry.
```

Do not silently mark the expense Paid.

---

# 48. President Oversight Notification

When Finance adds an expense:

```text
President receives notification.
```

Notification should contain minimal necessary information.

Notification failure must not block the Finance expense workflow unless a later business rule explicitly requires it.

---

# 49. No Approval Queue

V1 does not contain:

```text
Expense waiting for President approval
```

unless the product scope is explicitly changed later.

Finance remains the operational controller.

---

# 50. Expense History

Historical expense records should remain available.

Do not delete them merely because:

```text
Expense is old
Expense is cancelled
Account is deactivated
Storage is limited
```

---

# 51. Expense Categories History

Deactivated categories remain attached to historical expenses.

Do not rewrite historical expense categories merely because a category is no longer active.

---

# 52. Expense Storage Strategy

Store:

```text
Structured expense data → PostgreSQL
Bill/payment proofs → Private object storage
```

Avoid duplicate files.

---

# 53. Expense Backup

Backup/recovery must preserve:

```text
Expenses
Expense payments
Financial transactions
Bills
Payment proofs
Audit events
```

where required.

---

# 54. Expense Recovery Validation

After recovery verify:

```text
Expense amount
Paid amount
Remaining amount
Status
Payments
Financial transactions
File references
Audit records
```

---

# 55. Expense Security Rules

The backend must validate:

```text
Actor authorization
Expense existence
Expense state
Payment amount
Remaining amount
Account
Payment method
Proof requirement
Duplicate request
```

---

# 56. Expense Access Rules

High-level V1:

```text
President → broad access
Finance → full operational expense workflow
Auditor → read/review
Secretary → only explicitly permitted functions
Vice President → explicitly approved scope
Committee Member → no unrestricted expense mutation
Member → no internal expense access
```

---

# 57. Expense Testing

Required tests:

```text
Create
Bill
Partial payment
Multiple payments
Payment proof
Paid state
Overpayment attempt
Cancellation
Amount correction
Concurrency
Duplicate submission
Authorization
Private file access
Reports
Audit
Recovery
```

---

# 58. Example Test Matrix

| Scenario | Expected |
|---|---|
| ₹10,000 expense, no payment | Added |
| ₹10,000 expense, ₹4,000 paid | Partially Paid |
| ₹10,000 expense, ₹4,000 + ₹3,000 + ₹3,000 | Paid |
| ₹10,000 expense, ₹10,001 attempted | Rejected |
| ₹10,000 expense, ₹4,000 paid, remaining removed | Correct amount to ₹4,000 |
| Unauthorized user adds payment | Denied |
| Auditor edits expense | Denied |
| Finance adds payment with valid proof | Allowed |
| Duplicate payment request | No duplicate posting |

---

# 59. Expense Acceptance Criteria

The V1 Expense System is accepted when:

- [ ] Finance can create an expense.
- [ ] Bill can be attached.
- [ ] Supported bill formats are accepted.
- [ ] Private file access is enforced.
- [ ] Expense status follows V1 lifecycle.
- [ ] Multiple payments are supported.
- [ ] Partial payment is supported.
- [ ] Payment total cannot exceed expense amount.
- [ ] Payment proof is required before Paid state.
- [ ] Multiple accounts/payment methods are supported.
- [ ] Account balances update correctly.
- [ ] Finance does not require per-expense President approval.
- [ ] President receives oversight notification.
- [ ] Eligible unpaid expense can be cancelled.
- [ ] Cancellation reason is recorded.
- [ ] Expense amount correction is supported with required reason.
- [ ] Correction cannot reduce amount below valid payments.
- [ ] Payment proof replacement/deletion follows authorization.
- [ ] Historical expense records remain available.
- [ ] Financial posting is atomic.
- [ ] Duplicate payment requests do not double-post.
- [ ] Concurrent payment operations remain consistent.
- [ ] Audit events exist for material actions.
- [ ] Reports match authoritative financial data.

---

# 60. Expense Invariants

### Invariant 1

Finance is the operational controller for expenses.

### Invariant 2

President oversight notification is not a per-expense approval gate.

### Invariant 3

Every expense has a defined total amount.

### Invariant 4

Payment total cannot exceed expense amount.

### Invariant 5

Partial payments are allowed.

### Invariant 6

Paid state requires full settlement and required documentation.

### Invariant 7

A payment cannot be posted twice because of retry.

### Invariant 8

Concurrent payments cannot cause total payment to exceed the expense.

### Invariant 9

Expense amount correction requires authorization and reason.

### Invariant 10

Corrected amount cannot be lower than valid payments already recorded.

### Invariant 11

Eligible cancellation requires authorization and reason.

### Invariant 12

Partially paid expense should be corrected to the actual incurred amount when the remaining amount will not happen, rather than silently losing the payment.

### Invariant 13

Expense payments create corresponding financial movements.

### Invariant 14

Expense account movements update balances immediately according to V1 rules.

### Invariant 15

Bills and payment proofs are private.

### Invariant 16

Historical expenses remain available.

### Invariant 17

Historical category references remain valid after category deactivation.

### Invariant 18

Material expense/payment changes are auditable.

### Invariant 19

Notification failure does not alter financial truth.

### Invariant 20

Reports derive from authoritative data.

### Invariant 21

Finance-level permissions cannot be bypassed through frontend manipulation.

### Invariant 22

Auditor remains read-only for financial expense records.

### Invariant 23

V1 does not introduce an expense approval queue without an explicit product decision.

---

# 61. Final Expense Flow

```text
FINANCE
   ↓
Create Expense
   ↓
Attach Bill
   ↓
President Oversight Notification
   ↓
Expense Added
   ↓
One or More Payments
   ↓
Payment Proof
   ↓
Financial Transaction
   ↓
Account Balance
   ↓
Partially Paid / Paid
   ↓
Reports
   ↓
Audit
```

Correction:

```text
Expense
   ↓
Amount Correction
   ↓
Reason
   ↓
Audit
   ↓
Recalculate Remaining
```

Cancellation:

```text
Eligible Unpaid Expense
   ↓
Cancellation Reason
   ↓
Cancel
   ↓
Audit
```

---

# 62. Related Documents

- `FINANCE_SYSTEM.md`
- `FINANCIAL_DATA_MODEL.md`
- `PAYMENT_SYSTEM.md`
- `DATABASE_SCHEMA.md`
- `DATA_RELATIONSHIPS.md`
- `AUDIT_LOG_MODEL.md`
- `AUTHORIZATION_MODEL.md`
- `SECURITY_REQUIREMENTS.md`
- `DATA_PRIVACY.md`
- `DONATION_SYSTEM.md`
- `REPORTING_AND_AUDIT.md`
- `STORAGE_STRATEGY.md`
- `BACKUP_AND_RECOVERY.md`
- `MONITORING.md`
- `TESTING_STRATEGY.md`
- `TEST_PLAN.md`
- `ACCEPTANCE_CRITERIA.md`

---

## Document Status

**Expense System — V1 Expense System Baseline**

This document defines the authoritative V1 expense workflow for Masjid-e-Mamoor 2, including expense creation, documentation, multi-payment handling, financial posting, corrections, cancellation, auditability, privacy, and historical retention.
