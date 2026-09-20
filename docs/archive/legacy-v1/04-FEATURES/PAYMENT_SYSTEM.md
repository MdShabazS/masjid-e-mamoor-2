# Masjid-e-Mamoor 2 — Payment System

**Document Status:** V1 Implementation Baseline  
**Version:** 1.0  
**Product:** Masjid-e-Mamoor 2 Internal Management Application  
**Scope:** V1  
**Primary Payment Method:** UPI  
**Verification Authority:** Finance  
**Last Updated:** 2026-09-17

---

# 1. Purpose

This document defines the V1 payment system for Masjid-e-Mamoor 2.

The payment system manages the technical and business flow between:

```text
Donation Request
      ↓
Payment Link
      ↓
UPI Payment
      ↓
Actual Payment Evidence
      ↓
Finance Verification
      ↓
Donation Allocation
      ↓
Financial Posting
```

The payment system must maintain a strict distinction between:

- Payment request
- Payment link
- Payment attempt
- Actual payment
- Payment verification
- Donation allocation
- Financial transaction

---

# 2. Payment Design Principles

1. Payment-link generation is not payment.
2. Opening a payment link is not payment.
3. Entering a UPI app is not payment.
4. Client-reported success is not the authoritative financial state.
5. Finance verifies actual payment.
6. Verified payment is posted only through controlled backend logic.
7. One actual payment must not create duplicate financial postings.
8. External references should be used to detect duplicate processing where available.
9. Historical payment requests retain their original payment context.
10. Payment expiry does not delete the underlying donation obligation.
11. Payment processing must be idempotent.
12. Payment processing must be concurrency-safe.
13. Payment records must remain linked to the resulting financial and donation records.
14. Sensitive payment credentials must never be stored in application logs or client-visible data.

---

# 3. V1 Payment Scope

V1 supports:

```text
UPI payment requests
UPI deep-link / intent style payment initiation
Finance manual verification
Payment reference capture
Monthly donation settlement
Additional General Donation
Combined outstanding settlement
Overpayment handling
Payment status tracking
Payment-link expiry
Payment retry
Payment audit trail
```

V1 does not require:

- Credit/debit card gateway as a primary flow
- Net banking gateway
- Automated financial verification without an approved provider flow
- Automatic bank reconciliation
- Stored payment cards
- Wallet balances
- In-app card data collection

---

# 4. Payment Domain Overview

```text
                PAYMENT SYSTEM
                      │
          ┌───────────┴───────────┐
          │                       │
          ▼                       ▼
    PAYMENT REQUEST           CASH/DIRECT
          │                   FINANCE ENTRY
          ▼
      PAYMENT LINK
          │
          ▼
        UPI APP
          │
          ▼
    ACTUAL PAYMENT
          │
          ▼
   FINANCE VERIFICATION
          │
          ├──────────────┐
          ▼              ▼
      DONATION       FINANCIAL
     ALLOCATION       POSTING
          │              │
          └──────┬───────┘
                 ▼
                AUDIT
```

---

# 5. Payment Request

A payment request represents an intended payment.

Example:

```text
Member A
September Monthly Donation
Amount = ₹500
```

It is not yet a financial receipt.

---

# 6. Payment Request Identity

Every payment request should have a stable system-generated ID.

Example:

```text
PAYREQ-2026-000001
```

The exact display format may change.

Database identity should remain stable.

---

# 7. Payment Record

A payment record represents the actual payment being processed/verified.

Conceptual fields may include:

```text
id
payment_reference
payment_request_id
payer/member context
amount
payment_method
payment_date
external_reference
status
verified_by
verified_at
created_at
updated_at
```

Exact physical schema is defined in `DATABASE_SCHEMA.md`.

---

# 8. Payment Request vs Payment

These are not the same record.

```text
Payment Request
=
What the system asked the member to pay

Payment
=
What was actually paid/reported and then verified
```

This distinction is required for auditability.

---

# 9. Payment Request Types

V1 request purposes may include:

```text
MONTHLY_DONATION
ADDITIONAL_DONATION
```

A request created from an overpayment allocation is handled as part of the additional-donation logic.

---

# 10. Payment Link

A payment link is a user-facing mechanism for initiating the intended UPI payment.

Conceptually:

```text
Payment Request
      ↓
UPI Link/Intent
      ↓
Member UPI App
```

The exact UPI URI/deep-link format must be validated during implementation and device testing.

---

# 11. Payment Link Data

A payment request/link may contain:

```text
Request ID
Amount
UPI destination
Purpose
Member context where necessary
Creation timestamp
Expiry timestamp
Reference/transaction note
```

Only required payment information should be exposed.

---

# 12. UPI Destination

The payment link uses the current active Masjid UPI ID.

V1 permits:

```text
One active UPI ID
```

Finance controls this configuration.

---

# 13. UPI Snapshot

When a payment link is generated, the UPI destination used should be snapshotted with the payment request.

Example:

```text
Payment Request #101
UPI = oldupi@bank
```

Later:

```text
Active UPI = newupi@bank
```

Historical request #101 must still show the original UPI destination.

---

# 14. UPI Change

When Finance changes the active UPI ID:

```text
Future payment requests
→ use new UPI ID

Historical requests
→ retain old UPI ID
```

The UPI change is audited.

---

# 15. Payment Amount

The payment request has an expected amount.

Example:

```text
Monthly donation
₹500
```

The amount should be server-controlled.

The client must not arbitrarily modify a generated monthly payment amount.

---

# 16. Payment Amount and Combined Dues

For combined outstanding monthly dues, the payment request amount may represent:

```text
Total outstanding eligible dues
```

Example:

```text
July ₹500
August ₹500
September ₹500

Payment Request = ₹1,500
```

The backend later allocates the verified payment FIFO.

---

# 17. Additional Donation Amount

For an Additional General Donation, the member can enter the desired amount.

The server validates:

```text
Positive amount
Allowed limits if any
Authenticated/authorized context
```

The category remains:

```text
GENERAL_DONATION
```

---

# 18. Payment Link Expiry

Monthly payment links expire at the end of the relevant donation month.

Conceptually:

```text
creation_time
+
month-end expiry
```

The precise timestamp/time-zone handling must be implemented consistently.

---

# 19. Expired Payment Link

When expired:

```text
Payment link = no longer usable
```

But:

```text
Donation record = remains
Outstanding amount = remains
Payment history = remains
```

No historical payment data is deleted.

---

# 20. Reissuing Payment Link

If a monthly payment is still pending after an earlier link expires:

```text
Existing monthly record
        ↓
New payment request/link
```

The new request must not overwrite the old request's historical context.

---

# 21. Payment Attempt

A payment attempt may be initiated from the payment link.

An attempt means:

```text
User attempted to make payment
```

It does not automatically mean:

```text
Money received
```

---

# 22. Payment Attempt State

The implementation may track states such as:

```text
INITIATED
ABANDONED
REPORTED_SUCCESS
FAILED
```

These are technical/payment-flow states.

They are not equivalent to Finance verification.

---

# 23. Payment Verification State

The authoritative verification states are conceptually:

```text
UNVERIFIED
VERIFIED
REJECTED
```

The exact database enum may differ.

---

# 24. Client-Reported Payment Success

A client may report that a payment succeeded.

The backend must treat this as:

```text
Unverified payment evidence
```

until Finance confirms the actual transaction.

---

# 25. Finance Verification

Finance checks actual financial evidence.

Relevant evidence may include:

- Bank statement
- UPI transaction/reference ID
- Amount
- Payment date
- Payment request context
- Bank/UPI account where applicable

---

# 26. Finance Verification Fields

At verification time, store:

```text
verified_by
verified_at
verified_amount
external_reference where available
verification result
```

The server/database provides authoritative timestamps.

---

# 27. Payment Date

The payment record should store the actual payment date when known.

This may differ from:

```text
payment request created_at
payment link opened_at
record entered_at
verification timestamp
```

---

# 28. Entry Timestamp

Store the application entry time independently.

Conceptually:

```text
payment_date
created_at
verified_at
```

Each serves a different purpose.

---

# 29. External Transaction Reference

For UPI/bank payments, Finance should enter the external transaction/reference ID when available.

Example:

```text
UPI reference = 123456789012
```

The actual provider-specific format may differ.

---

# 30. External Reference Uniqueness

Where a payment provider guarantees a stable unique reference, the system should protect against:

```text
same provider reference
→ multiple financial postings
```

A suitable uniqueness strategy may use:

```text
provider
+
external_reference
```

The final constraint must account for provider behavior.

---

# 31. Idempotency

Payment verification and posting must be idempotent.

Example:

```text
Verify payment P
→ success

Retry Verify payment P
→ no duplicate financial transaction
```

The second request should return a safe already-processed/conflict result rather than post again.

---

# 32. Idempotency Key

Critical payment commands should support an idempotency key where appropriate.

Example:

```text
idempotency_key
```

This protects against:

- Double taps
- Network retry
- HTTP retry
- Mobile reconnect
- Worker retry

---

# 33. Payment Concurrency

The backend must protect against concurrent verification.

Example:

```text
Finance user A verifies
Finance user B verifies
```

Result:

```text
Exactly one authoritative verification/posting
```

---

# 34. Payment Processing Atomicity

Where a verified payment affects multiple business records, the operation should be atomic.

For example:

```text
1. Verify payment
2. Allocate payment
3. Update monthly donation(s)
4. Create additional donation for excess
5. Create financial transaction
6. Update account balance
7. Write audit event
```

These related operations should commit consistently.

---

# 35. Payment Allocation

Payment allocation determines what the verified money means.

Examples:

```text
Payment ₹1,500
→ July ₹500
→ August ₹500
→ September ₹500
```

Allocation is not controlled by the client.

---

# 36. FIFO Allocation

Combined outstanding monthly dues use:

```text
Oldest month first
```

Example:

```text
July
August
September
```

The backend selects the oldest eligible outstanding month first.

---

# 37. Full-Month Completion

A monthly record becomes Paid only when the required full monthly amount has been allocated.

Partial amount:

```text
Due ₹500
Received ₹300
```

does not produce:

```text
Paid
```

---

# 38. Overpayment

If verified payment exceeds all outstanding monthly dues:

```text
Outstanding monthly allocations
        +
Additional General Donation
```

Example:

```text
Outstanding = ₹1,000
Payment = ₹1,200

₹1,000 → monthly dues
₹200 → General Donation
```

---

# 39. No Future Prepayment

The excess amount must not:

- Mark a future month paid
- Reduce future monthly amount
- Change the agreed contribution
- Create a future-month credit

It remains an Additional General Donation.

---

# 40. Payment Cancellation / Rejection

A payment that cannot be verified may be rejected.

Rejection must not:

```text
Mark monthly donation Paid
```

and must not create an unverified financial receipt as if money were confirmed.

---

# 41. Payment Correction

Corrections to payment data must be controlled and audited.

Potential corrected fields may include:

```text
External reference
Payment date
Verified amount
Verification context
```

The exact correction policy must avoid changing the meaning of historical money without proper financial controls.

---

# 42. Payment Proof

Payment proof may be used when the payment context requires supporting evidence.

Where used, payment proof should be stored through Supabase Storage with protected access.

The database stores file metadata/reference.

---

# 43. Payment Proof Formats

Where payment proof is required, accepted formats are:

```text
PDF
JPG
PNG
```

The final upload size limits are defined in storage requirements.

---

# 44. Payment Proof Privacy

Payment proof may contain sensitive information.

It must not be publicly accessible through a permanent public URL.

Use authenticated/protected access.

---

# 45. Payment Proof Replacement

Authorized Finance users may replace payment proof where permitted.

The system should preserve:

```text
Who changed it
When
What record was affected
```

---

# 46. Payment Proof Deletion

Finance may delete payment proof where permitted.

A deletion action should record:

```text
Who
When
Related payment
```

A deletion reason may be captured when appropriate.

The payment record itself must remain.

---

# 47. Payment Security

The payment system must prevent the client from setting:

```text
verified = true
financial transaction ID
account balance
verified amount
verification actor
```

These values are server-controlled.

---

# 48. UPI Deep Link Security

UPI link generation must:

- Use the active Masjid UPI ID.
- Validate amount.
- Use a server-generated/reference-safe transaction note.
- Avoid embedding authentication tokens.
- Avoid exposing unnecessary member data.

The exact UPI fields must be validated on real Android devices and the final supported UPI apps.

---

# 49. UPI App Compatibility

UPI behavior can vary between Android devices and UPI applications.

The implementation must test:

```text
At least major supported UPI apps
```

and handle:

```text
No compatible UPI app
```

without marking payment as successful.

---

# 50. Web UPI Flow

On web, the system may provide an appropriate UPI intent/deep-link or QR-compatible experience where technically supported.

The web client must not assume that opening the link confirms payment.

---

# 51. QR Alternative

A QR representation may be used as a supporting payment-entry method if needed.

If a QR is generated:

```text
QR shown
≠
payment verified
```

The underlying payment verification rules remain unchanged.

---

# 52. Android Flow

Conceptually:

```text
Member opens payment request
       ↓
UPI deep link / intent
       ↓
Supported UPI app
       ↓
Payment
       ↓
Return to application where supported
       ↓
Payment remains unverified
       ↓
Finance verifies
```

---

# 53. iOS Flow

UPI support/intent behavior must be tested on iOS.

Where direct deep-link behavior is limited by platform/app support, the UI should provide a clear alternate path without claiming automatic payment confirmation.

Finance verification remains authoritative.

---

# 54. Failed UPI Launch

If no UPI application opens:

```text
Payment not confirmed
```

The user should receive a helpful retry/manual option.

---

# 55. Payment Timeout

A payment request may remain in an unverified state while Finance waits for actual transaction evidence.

A technical timeout must not incorrectly mark a donation as failed or unpaid if a real payment may still exist.

---

# 56. Late Verification

Finance may verify a payment after the original monthly link has expired.

Example:

```text
September link expired
Payment actually received later
Finance verifies
```

The payment can still be allocated to the appropriate outstanding month according to financial rules.

Link expiry does not invalidate actual received money.

---

# 57. Wrong Amount Paid

If the actual verified amount differs from the requested amount:

The system must not automatically assume the requested amount was paid.

Finance records/validates the actual amount.

Examples:

```text
Requested ₹500
Actual verified ₹300
```

or:

```text
Requested ₹500
Actual verified ₹700
```

The allocation behavior must follow the donation/financial model.

---

# 58. Underpayment

Underpayment does not complete the monthly obligation.

Example:

```text
Due = ₹500
Verified = ₹300
```

Result:

```text
Monthly obligation remains incomplete
```

The ₹300 remains financially traceable according to the final payment-allocation design.

---

# 59. Overpayment

Overpayment beyond outstanding dues is accepted.

The additional amount is handled as:

```text
General Donation
```

not future monthly credit.

---

# 60. Combined Payment With Extra Amount

Example:

```text
July ₹500
August ₹500
September ₹500

Payment = ₹1,700
```

Allocation:

```text
July      ₹500
August    ₹500
September ₹500
General Donation ₹200
```

---

# 61. Payment Request History

Payment requests remain historical records.

Each should retain enough information to establish:

```text
What amount was requested?
For what purpose/month?
Using which UPI ID?
When was it created?
When did it expire?
```

---

# 62. Payment Link Reuse

An expired monthly link must not be silently reused after month-end.

A new request should be generated for the relevant new payment cycle.

---

# 63. Multiple Payment Requests

A single monthly donation may have multiple payment requests over time due to:

```text
Link expiry
Retry
Reissue
```

Only verified actual payments affect the financial result.

---

# 64. Payment Request Cancellation

A payment request may become obsolete without affecting the underlying donation obligation.

Example:

```text
Old link expired
New link generated
```

The old request remains historical.

---

# 65. Payment Status Model

Conceptual payment states:

```text
CREATED
INITIATED
UNVERIFIED
VERIFIED
REJECTED
EXPIRED
```

Not every request must use every state.

The implementation must keep technical state separate from financial settlement state.

---

# 66. Payment Request Status vs Donation Status

Example:

```text
Payment Request = EXPIRED
Monthly Donation = PENDING
```

This is valid.

Another example:

```text
Payment = VERIFIED
Monthly Donation = PAID
```

after successful complete allocation.

---

# 67. Payment Request Status vs Financial Transaction

A request can be:

```text
EXPIRED
```

while the member later pays through another payment request.

The expired request does not represent a financial loss or financial deletion.

---

# 68. Finance Verification UI

Finance should be able to view:

```text
Unverified payments
Member
Amount
Payment purpose
Date
External reference
Supporting evidence
```

and then:

```text
Verify
Reject
```

subject to role permissions.

---

# 69. Finance Verification Requirements

Before verification, Finance should confirm the available evidence for:

- Amount
- Destination
- Date
- Reference
- Correct payment context

The exact operational checklist belongs in the Finance feature documentation.

---

# 70. Manual Verification Source of Truth

V1 financial verification is manual/controlled.

The system does not depend on a payment provider webhook to determine the final financial truth.

Provider automation may be added later if validated.

---

# 71. Provider Adapter

The architecture should allow payment-provider integration behind an adapter.

Conceptually:

```text
Payment Service
      ↓
Provider Adapter
      ↓
UPI/Provider
```

This avoids coupling the core donation model to one provider.

---

# 72. No Provider Lock-In

Provider-specific identifiers should remain separate from internal:

```text
payment_id
donation_id
financial_transaction_id
```

Internal IDs remain authoritative.

---

# 73. Provider Errors

Provider failures should be translated into safe application-level states.

Do not expose:

```text
provider secrets
internal stack traces
raw authentication details
```

---

# 74. Payment Webhooks

V1 does not require automatic payment webhooks as the final verification authority.

If webhooks are added later:

```text
Webhook evidence
      ↓
Validation
      ↓
Idempotency
      ↓
Finance/financial rules
```

A raw webhook must not directly bypass financial authorization.

---

# 75. Webhook Security — Future

If provider webhooks are later introduced, implementation must include:

- Signature validation
- Replay protection
- Idempotency
- Provider event identity
- Server-side processing
- Auditability

---

# 76. Payment API Principles

Prefer explicit commands such as:

```text
createPaymentRequest()
generateUpiLink()
recordPaymentAttempt()
submitPaymentEvidence()
verifyPayment()
rejectPayment()
allocatePayment()
```

Avoid unrestricted generic payment updates.

---

# 77. Payment API Authorization

Each sensitive command must validate:

```text
Authenticated user
Active account
Role
Permission
Payment state
Business constraints
```

---

# 78. Member Payment Permissions

Members may:

- Create their own Additional General Donation request.
- Use their monthly payment request.
- View their own payment/donation state.
- Receive payment links.

Members may not:

- Verify payments.
- Change financial account balances.
- Alter financial verification.
- Change their own fixed monthly contribution amount.

---

# 79. Committee Member Payment Permissions

Committee Members may support the agreed member/donation workflow according to their role permissions.

They must not independently mark money as Finance-verified unless the role model explicitly grants Finance authority, which V1 does not.

---

# 80. Finance Payment Permissions

Finance is responsible for:

- Reviewing payment evidence.
- Verifying payments.
- Recording external references.
- Correcting permitted payment details.
- Creating/maintaining financial posting through the approved workflow.

---

# 81. President Payment Permissions

President has broad financial administration authority, including the V1 financial deletion authority defined in the financial model.

President does not need to replace Finance as the routine payment-verification operator.

---

# 82. Auditor Payment Permissions

Auditor can review payment and financial history according to audit permissions.

Auditor cannot verify or alter payment state as an operational financial controller.

---

# 83. Payment Notifications

Payment-related events may produce:

```text
Payment request created
Payment verified
Payment rejected
Donation settled
Outstanding reminder
```

The notification system is separate.

---

# 84. Notification Independence

Notification delivery must never determine:

```text
payment status
verification
financial posting
donation completion
```

---

# 85. Sensitive Notification Content

Do not place unnecessary sensitive details in push payloads.

Prefer:

```text
Your payment was verified.
Open the app for details.
```

rather than sending full financial records.

---

# 86. Payment Audit Events

Important events should include:

```text
PAYMENT_REQUEST_CREATED
PAYMENT_ATTEMPT_RECORDED
PAYMENT_VERIFIED
PAYMENT_REJECTED
PAYMENT_CORRECTED
PAYMENT_PROOF_ADDED
PAYMENT_PROOF_REPLACED
PAYMENT_PROOF_DELETED
```

Final event vocabulary is controlled by `AUDIT_LOG_MODEL.md`.

---

# 87. Payment and Financial Audit

For a verified payment, the system should allow tracing:

```text
Payment Request
      ↓
Payment
      ↓
Verification
      ↓
Donation Allocation
      ↓
Financial Transaction
      ↓
Account
      ↓
Audit
```

---

# 88. Payment Storage

Use PostgreSQL for:

```text
Payment requests
Payment metadata
Payment status
Verification state
Allocations
External references
```

Use object storage for supporting payment documents where required.

---

# 89. Payment File Storage

Do not store large payment proofs directly in PostgreSQL.

Use:

```text
Supabase Storage
+
protected metadata/reference
```

---

# 90. Payment Data Retention

Do not automatically delete:

- Payment requests
- Verified payments
- Rejected payment records where required for audit
- Allocations
- External references
- Verification records

to save storage.

---

# 91. Payment Backup

Backups must preserve:

```text
Payment requests
Payments
Payment allocations
Verification data
References
Supporting file metadata
Audit relationships
```

---

# 92. Payment Testing Requirements

At minimum test:

1. Monthly payment request creation.
2. Correct amount in UPI link.
3. Correct active UPI ID.
4. UPI snapshot preservation.
5. Payment link expiry.
6. Reissued payment link.
7. UPI app launch where supported.
8. No-compatible-app handling.
9. Client-reported payment success not treated as verified.
10. Finance verification.
11. Payment rejection.
12. External reference capture.
13. Duplicate reference protection.
14. Duplicate verification.
15. Idempotent retry.
16. Concurrent verification.
17. Combined payment.
18. FIFO allocation.
19. Partial payment behavior.
20. Overpayment behavior.
21. Additional General Donation creation.
22. Link expiry does not delete donation.
23. Late payment verification.
24. Wrong amount handling.
25. Payment proof upload.
26. Payment proof replacement.
27. Unauthorized verification attempt.
28. Financial posting consistency.
29. Audit event generation.
30. No authentication secrets in payment records/logs.

---

# 93. Payment Invariants

The following rules are mandatory:

### Invariant 1

Payment request is not payment.

### Invariant 2

Payment link opening is not payment.

### Invariant 3

Client-reported success is not Finance verification.

### Invariant 4

Only authorized Finance verification produces verified payment state.

### Invariant 5

Verified payment posting is server-controlled.

### Invariant 6

Payment processing is idempotent.

### Invariant 7

Duplicate payment references do not create duplicate financial postings where the reference is guaranteed unique.

### Invariant 8

Concurrent verification cannot create duplicate financial postings.

### Invariant 9

Historical payment requests retain their original UPI/payment context.

### Invariant 10

Expired payment links do not delete donation records.

### Invariant 11

Combined outstanding monthly payments use FIFO allocation.

### Invariant 12

Partial monthly payment does not mark the month Paid.

### Invariant 13

Overpayment beyond outstanding dues becomes Additional General Donation.

### Invariant 14

Extra payment does not prepay future monthly dues.

### Invariant 15

Payment records remain linked to the authoritative financial model.

### Invariant 16

Payment proof access is protected.

### Invariant 17

Payment status cannot be changed by arbitrary client-supplied flags.

### Invariant 18

Notifications do not determine payment or financial state.

### Invariant 19

Payment history is not purged for storage savings.

### Invariant 20

Payment processing cannot expose authentication secrets.

---

# 94. Acceptance Criteria

The payment system is implementation-ready when it can:

- Create payment requests.
- Generate valid UPI payment links.
- Use the active UPI destination.
- Preserve the UPI snapshot used by historical requests.
- Expire monthly links correctly.
- Reissue new links without deleting history.
- Distinguish payment attempt from verified payment.
- Let Finance verify actual payments.
- Store payment/reference information.
- Prevent duplicate verification.
- Handle concurrency safely.
- Handle combined outstanding monthly payment.
- Apply FIFO allocation.
- Preserve partial-payment integrity.
- Convert excess payment to General Donation.
- Prevent future-month prepayment.
- Link payment to donation and financial records.
- Store protected payment proof where needed.
- Produce required audit events.
- Work with web, Android, and iOS payment-entry flows to the extent supported by platform/UPI behavior.

---

# 95. Implementation Boundary

This document defines payment-specific behavior.

The following belong elsewhere:

```text
Donation rules            → DONATION_SYSTEM.md
Member lifecycle          → MEMBER_MANAGEMENT.md
Financial ledger          → FINANCIAL_DATA_MODEL.md
Finance operations        → FINANCE_SYSTEM.md
Expense payment proof     → EXPENSE_SYSTEM.md
Authentication            → AUTHENTICATION.md
Roles/permissions         → USER_ROLES_PERMISSIONS.md
Audit trail               → AUDIT_LOG_MODEL.md
Notifications             → NOTIFICATION_SYSTEM.md
Database                  → DATABASE_SCHEMA.md
Security/RLS              → SECURITY_ARCHITECTURE.md
UPI provider details      → Technology/deployment documentation
```

---

# 96. Related Documents

- `PROJECT_OVERVIEW.md`
- `PRODUCT_REQUIREMENTS.md`
- `FEATURE_SCOPE.md`
- `USER_ROLES_PERMISSIONS.md`
- `AUTHENTICATION.md`
- `MEMBER_MANAGEMENT.md`
- `DONATION_SYSTEM.md`
- `FINANCIAL_DATA_MODEL.md`
- `AUDIT_LOG_MODEL.md`
- `DATABASE_SCHEMA.md`
- `DATA_RELATIONSHIPS.md`
- `FINANCE_SYSTEM.md`
- `EXPENSE_SYSTEM.md`
- `NOTIFICATION_SYSTEM.md`
- `SECURITY_ARCHITECTURE.md`
- `DATA_PRIVACY.md`

---

## Document Status

**Payment System — V1 Implementation Baseline**

This document defines the authoritative payment-request, payment-verification, and payment-processing behavior for Masjid-e-Mamoor 2.

All payment implementation must preserve the verification, idempotency, allocation, historical, and financial-integrity invariants defined here.
