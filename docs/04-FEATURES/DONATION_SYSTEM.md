# Masjid-e-Mamoor 2 — Donation System

**Document Status:** V1 Implementation Baseline  
**Version:** 1.0  
**Product:** Masjid-e-Mamoor 2 Internal Management Application  
**Scope:** V1  
**Primary Areas:** Monthly Donations, Additional Donations, Anonymous Donations, Jummah Collections  
**Last Updated:** 2026-09-17

---

# 1. Purpose

This document defines the V1 donation-management system for Masjid-e-Mamoor 2.

The donation system is responsible for:

- Monthly member contribution obligations
- Agreed monthly contribution amounts
- Monthly donation records
- Pending/missed donations
- Payment-link generation
- Payment-link expiry
- Combined settlement of outstanding months
- FIFO payment allocation
- Partial-payment handling
- Overpayment handling
- Additional General Donations
- Anonymous donations
- Jummah cash collections
- Finance verification
- Contribution attribution
- Donation history
- Donation reminders
- Donation-related audit events
- Donation reporting

The core principle is:

> A donation becomes financially authoritative only after the actual payment is verified by Finance.

---

# 2. V1 Donation Scope

V1 supports:

```text
1. Monthly member donations
2. Additional General Donations
3. Anonymous donations
4. Jummah cash collections
```

V1 does not include:

- Donation targets
- Donation quotas
- Donor rankings
- Donation leaderboards
- Purpose/category selection for additional donations
- Multiple referral credits
- Partial completion of a monthly obligation
- Automatic payment verification based only on client success
- Public donor profiles

---

# 3. Donation Design Principles

The donation system follows these principles:

1. Expected donation and received money are separate concepts.
2. Payment-link generation is not payment verification.
3. Payment-link opening is not payment verification.
4. Client-side payment success is not the authoritative financial state.
5. Finance verifies actual payment.
6. Every monthly obligation remains historically visible.
7. Missed months are not deleted or silently rolled forward.
8. Combined outstanding payments use FIFO.
9. Partial monthly payments do not complete a month.
10. Overpayment beyond outstanding monthly dues becomes an Additional General Donation.
11. Extra payment does not prepay future monthly dues.
12. Historical monthly amounts remain unchanged after future contribution-term changes.
13. One member has at most one monthly donation record per month.
14. Donation records link into the authoritative financial model.
15. Important donation actions are audited.
16. Notifications do not determine financial state.

---

# 4. Donation Domain Overview

```text
                         DONATION SYSTEM
                                │
          ┌─────────────────────┼─────────────────────┐
          │                     │                     │
          ▼                     ▼                     ▼
      MONTHLY                ADDITIONAL          ANONYMOUS
      DONATION                DONATION            DONATION
          │                     │                     │
          └──────────────┬──────┴──────────────┐      │
                         ▼                     ▼      ▼
                    PAYMENT REQUEST        CASH / UPI
                         │
                         ▼
                 ACTUAL PAYMENT
                         │
                         ▼
                  FINANCE VERIFICATION
                         │
                         ▼
                  FINANCIAL POSTING
                         │
                         ▼
                       AUDIT
```

---

# 5. Expected vs Actual Donation

The system must distinguish:

```text
Expected Donation
```

from:

```text
Verified Donation
```

Example:

```text
August expected = ₹500
August verified = ₹0
```

Result:

```text
August = Pending
```

---

# 6. Monthly Contribution Agreement

A member may have an agreed monthly contribution amount.

Example:

```text
Member A
Monthly amount = ₹500
```

This is a voluntary/agreed contribution arrangement.

It is not:

```text
Target
Quota
Penalty
Mandatory performance metric
```

---

# 7. Contribution Term

Monthly contribution amounts are represented through effective terms.

Conceptually:

```text
Member
  ↓
Contribution Term
  ├── Amount
  ├── Effective Month
  └── Changed By
```

This allows historical amounts to remain correct.

---

# 8. Contribution Term Example

```text
July 2026      ₹500
September 2026 ₹700
```

Then:

```text
July      → ₹500
August    → ₹500
September → ₹700
```

---

# 9. Who Can Change Monthly Amount

V1 allows the following roles to enter/change the agreed amount:

```text
Committee Member
President
Secretary
Finance
```

The Member themselves cannot change the fixed monthly amount.

---

# 10. Contribution Change Audit

Every monthly-amount change should record:

```text
Previous amount
New amount
Effective month
Changed by
Changed at
Reason where required
```

---

# 11. Historical Monthly Protection

Once a monthly donation record exists, future configuration changes must not rewrite its historical expected amount.

Example:

```text
July = ₹500
August = ₹500
September = ₹700
```

If October becomes ₹900:

```text
July/August/September remain unchanged.
```

---

# 12. Monthly Donation Record

Each member/month has one monthly donation record.

Conceptual fields:

```text
id
member_id
donation_month
expected_amount
status
payment state
created_at
updated_at
```

The exact database structure is defined in `DATABASE_SCHEMA.md`.

---

# 13. Monthly Uniqueness

V1 requires:

```text
One Member + One Donation Month = One Monthly Donation Record
```

Recommended constraint:

```text
UNIQUE(member_id, donation_month)
```

---

# 14. Monthly Donation Lifecycle

Conceptually:

```text
MONTH GENERATED
      ↓
PENDING
      ↓
PAYMENT RECEIVED
      ↓
FINANCE VERIFIED
      ↓
FIFO ALLOCATED
      ↓
PAID
```

---

# 15. Monthly Record Generation

The system automatically creates the next month's expected donation record.

The applicable contribution term determines the expected amount.

Example:

```text
Current term = ₹700
Next month record
Expected = ₹700
```

---

# 16. Missed Donation

If a member does not pay:

```text
Monthly record remains Pending/Outstanding
```

The system must not:

- Delete the month
- Skip the month
- Merge it invisibly into another month
- Reset the amount

---

# 17. Outstanding Donations

Outstanding amount can be derived from monthly records that are not fully settled.

Example:

```text
July      ₹500 pending
August    ₹500 paid
September ₹700 pending
```

Outstanding:

```text
₹1,200
```

---

# 18. Monthly Payment Link

After member registration and confirmation of the agreed amount, the system may generate a payment link.

The link should contain the required payment context.

Conceptually:

```text
Member
Donation Month
Amount
UPI Destination
Purpose/Reference
Expiry
```

---

# 19. Payment Link Delivery

V1 delivery channels:

```text
App Push
+
SMS/WhatsApp where available
```

Actual SMS/WhatsApp availability depends on the selected provider.

The system must not assume free SMS/WhatsApp delivery.

---

# 20. Payment Link UPI Destination

New payment links use the current active Masjid UPI ID.

Historical links must retain the UPI destination snapshot used when they were generated.

A later UPI change must not rewrite old links.

---

# 21. Payment Link Expiry

A monthly payment link expires at the end of its donation month.

Example:

```text
September link
→ expires at end of September
```

Expiry does not delete the monthly donation record.

---

# 22. Expired Link

An expired link must not be treated as:

```text
Paid
Cancelled
Deleted
```

It simply means:

```text
The previous payment link is no longer valid.
```

The outstanding monthly record remains.

---

# 23. New Month Payment Link

A new monthly cycle receives a new payment request/link.

Historical payment-link records remain associated with their original month.

---

# 24. Payment Link Security

Payment links must not expose unnecessary private information.

They should contain only the information required to create the intended UPI payment request and identify the request safely.

Do not place:

```text
Access tokens
Authentication credentials
Private member information
Service keys
```

inside the link.

---

# 25. Link Open vs Payment

Opening the payment link does not mean payment was made.

The following are not authoritative financial states:

```text
Link generated
Link delivered
Link opened
UPI app opened
Payment screen displayed
Payment initiated
```

---

# 26. Actual Payment

An actual payment exists when money has been transferred through the payment channel.

However, the application still requires Finance verification before treating it as authoritative.

---

# 27. Finance Verification

Finance verifies actual payment using available bank/UPI evidence.

Verification may use:

- Bank/UPI statement
- UPI transaction/reference ID
- Payment amount
- Payment date
- Relevant member/request information

---

# 28. Verification Authority

Finance is the operational authority for payment verification.

The Member cannot self-mark a payment as verified.

A Committee Member cannot independently convert an unverified payment into a verified financial receipt.

---

# 29. Verification Result

Conceptual payment verification states:

```text
UNVERIFIED
VERIFIED
REJECTED
```

The exact database status names may vary.

---

# 30. Verified Payment

A payment becomes a valid financial receipt only after successful verification.

The workflow then proceeds to:

```text
Allocation
+
Financial Posting
+
Account Balance
+
Audit
```

where applicable.

---

# 31. Payment Reference

Where available, Finance records the external UPI/bank transaction reference.

The reference must be retained as part of the payment record.

---

# 32. Duplicate Reference Protection

The system should prevent the same external transaction/reference from being posted multiple times.

The implementation should use:

- Uniqueness constraints where valid
- Idempotency keys
- State checks
- Transactional database logic

---

# 33. Combined Outstanding Payment

A member may settle multiple complete outstanding monthly dues in one payment.

Example:

```text
July      ₹500
August    ₹500
September ₹500
```

Combined payment:

```text
₹1,500
```

---

# 34. FIFO Allocation Rule

Combined monthly payment allocation is:

```text
Oldest outstanding month first
```

Example:

```text
₹1,500 received

July      ₹500
August    ₹500
September ₹500
```

---

# 35. FIFO Allocation Process

Conceptually:

```text
Payment ₹1,500
      ↓
Find oldest outstanding month
      ↓
Allocate required full amount
      ↓
Move to next month
      ↓
Continue until payment exhausted
```

Allocation is a backend-controlled process.

---

# 36. Monthly Completion Rule

A monthly donation becomes Paid only when:

```text
Full expected monthly amount
```

has been verified and allocated.

---

# 37. Partial Monthly Payment

V1 does not support completing a month with a partial payment.

Example:

```text
Expected = ₹500
Payment = ₹300
```

Result:

```text
Month remains incomplete
```

It must not become Paid.

---

# 38. Partial Payment Handling

The exact treatment of the ₹300 in an incomplete-month case must remain consistent with the final payment allocation/database design.

It must not be falsely recorded as a completed monthly obligation.

Where received funds are verified, they must remain traceable in the financial system without inventing a false Paid state.

---

# 39. Overpayment

Overpayment is accepted.

Example:

```text
Outstanding monthly dues = ₹1,000
Payment received          = ₹1,200
```

Allocation:

```text
₹1,000 → outstanding monthly dues
₹200   → Additional General Donation
```

---

# 40. Overpayment Is Not Future Credit

The extra amount must not:

- Mark next month Paid
- Reduce next month's expected amount
- Change the contribution term
- Create an advance balance against future months

It is a separate General Donation.

---

# 41. Additional General Donation

Members can make additional donations at any amount.

V1 category:

```text
GENERAL_DONATION
```

No donation-purpose selection is required.

---

# 42. Additional Donation Flow

```text
Member
   ↓
Enter Amount
   ↓
Payment Request
   ↓
UPI
   ↓
Actual Payment
   ↓
Finance Verification
   ↓
Additional Donation
   ↓
Financial CREDIT
   ↓
Audit
```

---

# 43. Additional Donation and Monthly Amount

An additional donation does not change:

```text
Monthly agreed amount
Monthly contribution term
Future monthly dues
```

---

# 44. Additional Donation Attribution

Where the donation is made by an authenticated member, it belongs to that member's verified donation history after Finance verification.

Where applicable, verified contribution reporting may also attribute it through the member's primary referral.

---

# 45. Anonymous Donation

V1 supports anonymous donations.

An anonymous donation does not require a member account.

Finance may create the record.

---

# 46. Anonymous Donation Fields

Conceptually:

```text
Amount
Date
Method/account
Reference where available
Verification state
Recorded by
Created at
```

Do not require donor identity.

---

# 47. Anonymous Donation Referral

Anonymous donations are not automatically attributed to a Committee Member.

Do not assign referral contribution without an explicit basis.

---

# 48. Jummah Cash Collection

Jummah collection represents the total cash physically collected during Jummah at the Masjid.

It is not an individual donor-by-donor record.

---

# 49. Jummah Collection Record

V1 records one aggregate collection per Friday/Jummah session.

Example:

```text
Date: Friday
Jummah Cash Collection: ₹18,500
```

---

# 50. Jummah Collection Entry Roles

Authorized users:

```text
President
Secretary
Finance
```

---

# 51. Jummah Collection Financial Flow

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

# 52. No Individual Jummah Donor Requirement

V1 does not require:

```text
Donor 1
Donor 2
Donor 3
...
```

for the Jummah cash collection.

Only the aggregate cash total is recorded.

---

# 53. Donation Methods

Depending on the donation type, payment methods may include:

```text
UPI
Cash
Bank
Other approved method
```

The exact available values should align with the Financial Data Model.

---

# 54. Donation Account

Every verified financial donation must ultimately affect an appropriate Masjid account.

Examples:

```text
UPI donation → UPI/Bank account according to actual accounting flow
Cash collection → Cash account
Bank receipt → Bank account
```

The authoritative posting rules belong to `FINANCIAL_DATA_MODEL.md`.

---

# 55. Donation Financial Posting

A verified donation follows:

```text
Verified Donation
      ↓
Financial Transaction CREDIT
      ↓
Account Balance
```

The donation record and financial transaction remain linked.

---

# 56. Donation Transaction Reference

Each financially posted donation receives/links to the system-generated financial transaction reference.

Example:

```text
Donation
  ↓
TX-2026-000321
```

This allows audit/report traceability.

---

# 57. Donation-to-Payment Relationship

Conceptually:

```text
Donation
   ↓
Payment
   ↓
Payment Allocation
   ↓
Financial Transaction
```

One payment may settle multiple monthly donation records.

---

# 58. Payment Allocation Relationship

A payment allocation stores the amount assigned from one payment to one monthly donation or additional donation context.

Conceptually:

```text
payment_id
monthly_donation_id
allocated_amount
```

The exact physical model is defined in `DATABASE_SCHEMA.md`.

---

# 59. Combined Payment Example

```text
Payment = ₹1,500

Allocation 1:
July monthly donation = ₹500

Allocation 2:
August monthly donation = ₹500

Allocation 3:
September monthly donation = ₹500
```

One payment can therefore create multiple monthly settlement links.

---

# 60. Overpayment Example

```text
Payment = ₹1,200

Allocation 1:
July = ₹500

Allocation 2:
August = ₹500

Remaining:
₹200

New Additional General Donation:
₹200
```

The complete verified payment remains one actual payment while its financial meaning is allocated correctly.

---

# 61. One-Time Additional Donation

An additional donation is independent of the monthly contribution schedule.

Example:

```text
Monthly = ₹500
Additional donation = ₹1,000
```

The next monthly amount remains:

```text
₹500
```

---

# 62. Donation Payment Status and Financial Status

These must not be conflated.

Example:

```text
Payment status = VERIFIED
Donation allocation = complete
Financial posting = completed
```

All required transitions should be consistent before the UI represents the donation as completed.

---

# 63. Payment Rejection

A payment may be rejected when Finance determines that the expected payment cannot be verified or should not be accepted.

The rejection must not falsely mark the associated monthly record Paid.

---

# 64. Rejected Payment Audit

Where a payment is rejected, record:

```text
Payment
Result
Reason where required
Actor
Timestamp
```

The exact audit behavior follows `AUDIT_LOG_MODEL.md`.

---

# 65. Correction of Donation Records

Authorized corrections should preserve:

```text
Donation identity
Payment relationship
Financial transaction relationship
Audit history
```

Do not silently replace financial history.

---

# 66. Donation Date

Donation records should distinguish:

```text
Donation month
Transaction/payment date
Record creation timestamp
```

These have different meanings.

---

# 67. Monthly Donation Month

The monthly donation month identifies the obligation:

```text
September 2026
```

This does not necessarily mean the payment was made on September 1 or even during September.

---

# 68. Payment Date

Payment date records when the actual payment is considered to have occurred.

This may differ from the data-entry time.

---

# 69. Late Payment

A member may settle an older outstanding month later.

Example:

```text
July due
Paid in September
```

The July monthly record remains:

```text
July donation
```

while payment date may be in September.

---

# 70. Late Payment Allocation

FIFO still uses the oldest outstanding month first.

Late payment does not rename or rewrite the original monthly obligation.

---

# 71. Donation History

Member donation history should show, where permitted:

```text
Month
Expected amount
Payment status
Verified amount
Payment/reference information
Additional donations
```

Financially sensitive details must remain role-controlled.

---

# 72. Outstanding Calculation

Outstanding monthly amount can be derived from:

```text
SUM(expected amount of unpaid monthly records)
```

with the exact treatment of verified-but-unallocated/partial payments governed by the final payment allocation design.

The system must not double-count a payment.

---

# 73. Member Donation Summary

A member's dashboard may show:

```text
Current monthly amount
Current month status
Outstanding months
Outstanding amount
Additional donations
Donation history
```

Only the member's permitted information should be visible to the member.

---

# 74. Committee Contribution Summary

Committee-level reporting can show:

```text
Members referred
Verified donor count
Verified contribution amount
```

This must distinguish:

```text
Referred
vs
Verified donor
```

---

# 75. Contribution Attribution Rule

For referral-based committee contribution reporting:

```text
Primary Referrer
      ↓
Referred Member
      ↓
Verified Donation
      ↓
Committee Contribution
```

Only verified donations count.

---

# 76. Referral Attribution Change

If the President corrects a member's primary referrer:

- The correction must be authorized.
- The correction must be audited.
- Historical attribution behavior must follow the financial/referral model.
- Reports must not silently become inconsistent.

The exact historical attribution treatment is defined jointly by `COMMITTEE_DATA_MODEL.md` and `FINANCIAL_DATA_MODEL.md`.

---

# 77. Donation Reminder

The system should remind members when a monthly donation is pending or missed.

V1 channels:

```text
In-App
Push
SMS/WhatsApp where available
```

---

# 78. Reminder Timing

The final reminder schedule should be configurable/implemented without changing donation state.

A reminder is a notification event.

It is not a financial transaction.

---

# 79. Reminder Independence

If delivery fails:

```text
Donation remains Pending
```

The financial record is not changed.

---

# 80. Notification Content

Notifications should avoid exposing unnecessary financial details in lock-screen/push payloads.

Prefer:

```text
Your monthly contribution is pending.
Open the app to view details.
```

rather than sending sensitive account information in the notification payload.

---

# 81. Donation Reports

Donation reporting should support:

```text
Daily
Monthly
Yearly
Custom
```

where relevant.

---

# 82. Donation Report Types

Possible reports:

```text
Monthly contribution report
Additional donation report
Anonymous donation report
Jummah collection report
Verified donation report
Outstanding contribution report
Committee contribution report
```

---

# 83. Expected vs Verified Reports

Reports must clearly distinguish:

```text
Expected
Pending
Verified
Outstanding
```

Do not present expected contribution as money received.

---

# 84. Monthly Donation Report Example

```text
September 2026

Expected monthly donations: ₹50,000
Verified monthly donations: ₹43,000
Outstanding: ₹7,000
```

Numbers are illustrative.

---

# 85. Additional Donation Report

Example fields:

```text
Date
Member/Anonymous
Amount
Method
Reference
Verified By
Financial Transaction ID
```

Role-based visibility applies.

---

# 86. Jummah Report

Example:

```text
Friday
Collection date
Cash amount
Recorded by
Financial transaction reference
```

---

# 87. Donation Audit Events

Important donation events include:

```text
DONATION_TERM_CREATED
DONATION_TERM_CHANGED
MONTHLY_DONATION_CREATED
PAYMENT_REQUEST_CREATED
PAYMENT_VERIFIED
PAYMENT_REJECTED
PAYMENT_ALLOCATED
ADDITIONAL_DONATION_CREATED
ANONYMOUS_DONATION_CREATED
JUMMAH_COLLECTION_CREATED
```

The final event names are controlled by `AUDIT_LOG_MODEL.md`.

---

# 88. Donation Security

Donation operations must be protected by:

```text
Authentication
+
Role authorization
+
RLS
+
Server-side validation
```

The client cannot directly change:

```text
Financial status
Verified amount
Account balance
Finance verification
```

---

# 89. Donation API Principles

Prefer explicit commands such as:

```text
createMonthlyDonation()
generatePaymentRequest()
verifyPayment()
allocatePayment()
createAdditionalDonation()
recordAnonymousDonation()
recordJummahCollection()
```

Avoid unrestricted generic donation row updates.

---

# 90. Donation Concurrency

Concurrency protection is required for:

- Payment verification
- FIFO allocation
- Overpayment handling
- Monthly record generation
- Duplicate payment processing
- Concurrent contribution-term changes

The database must prevent contradictory final states.

---

# 91. Duplicate Monthly Generation

If an automated monthly job is retried:

```text
Do not create duplicate monthly donation records.
```

Use:

```text
UNIQUE(member_id, donation_month)
```

plus idempotent generation logic.

---

# 92. Duplicate Payment Processing

If Finance verifies the same payment twice:

```text
Only one authoritative financial posting
```

must result.

A second attempt should safely return an already-processed/conflict result.

---

# 93. Concurrent FIFO Allocation

If two verification workers or administrators attempt to allocate the same payment simultaneously:

```text
One authoritative allocation result
```

must be committed.

Database transactions/locking should protect the allocation process.

---

# 94. Payment Overpayment Atomicity

The following should remain consistent:

```text
Payment verified
+
Monthly allocations
+
Additional donation
+
Financial posting
+
Account balance
+
Audit
```

They should be committed as one logical operation where practical.

---

# 95. Donation Storage

Donation records are lightweight relational data.

Use PostgreSQL for:

- Monthly records
- Payment records
- Allocation records
- Donation metadata
- Verification state

Use Supabase Storage only for supporting documents where applicable.

---

# 96. Donation File Storage

Do not store payment proofs or other large files directly inside PostgreSQL rows.

Store:

```text
File object
+
Metadata/reference
```

according to the storage architecture.

---

# 97. No Duplicate Financial Records

The donation system must not independently create a second ledger.

There is one authoritative financial model.

Donation records point into:

```text
FINANCIAL_DATA_MODEL.md
```

for monetary posting.

---

# 98. Donation History Retention

Do not automatically delete:

- Monthly donation records
- Verified payments
- Additional donations
- Anonymous donations
- Jummah collection records
- Allocation records
- Required audit events

to save storage.

---

# 99. Donation Backup

Backup must preserve:

```text
Contribution terms
Monthly donation records
Payment records
Payment allocations
Verification state
Anonymous donations
Jummah collections
Financial references
Audit references
```

---

# 100. Donation Testing Requirements

At minimum test:

1. Create monthly contribution term.
2. Create monthly donation record.
3. Generate payment link.
4. Payment link expires correctly.
5. Expired link leaves monthly record intact.
6. Successful payment verification.
7. Rejected payment.
8. Duplicate payment reference.
9. Duplicate payment verification.
10. Combined outstanding payment.
11. FIFO allocation.
12. Partial monthly payment remains incomplete.
13. Overpayment becomes General Donation.
14. Overpayment does not advance future month.
15. Additional donation.
16. Anonymous donation.
17. Jummah cash collection.
18. Late payment against an old month.
19. Monthly amount change with effective month.
20. Historical monthly amount remains unchanged.
21. Monthly auto-generation retry does not duplicate records.
22. Concurrent allocation remains consistent.
23. Referral contribution uses verified donations only.
24. Notification failure does not alter donation status.
25. Unauthorized user cannot verify a payment.
26. Member cannot change own fixed monthly amount.
27. Financial posting and donation state remain consistent.
28. Audit event is generated for critical donation changes.

---

# 101. Donation Invariants

The following rules are mandatory:

### Invariant 1

One member/month has at most one monthly donation record.

### Invariant 2

A monthly donation has a defined expected amount.

### Invariant 3

Historical monthly expected amounts are not rewritten by future contribution-term changes.

### Invariant 4

Payment-link generation does not equal payment.

### Invariant 5

Payment-link opening does not equal payment.

### Invariant 6

Client-reported payment success does not equal Finance verification.

### Invariant 7

Only Finance verification creates verified payment state.

### Invariant 8

A monthly donation is Paid only after complete settlement under V1 rules.

### Invariant 9

Partial monthly payment does not make the month Paid.

### Invariant 10

Combined outstanding payments use FIFO.

### Invariant 11

Overpayment beyond outstanding monthly dues becomes Additional General Donation.

### Invariant 12

Additional donations do not prepay future monthly dues.

### Invariant 13

Anonymous donations do not require a member account.

### Invariant 14

Jummah cash collection is recorded as an aggregate Friday collection, not individual donor records.

### Invariant 15

Verified donation records link to the authoritative financial system.

### Invariant 16

Duplicate external payment references cannot create duplicate financial postings where the provider guarantees reference uniqueness.

### Invariant 17

Retried payment verification cannot produce duplicate financial receipts.

### Invariant 18

Expired payment links do not delete donation history.

### Invariant 19

Notification delivery does not determine donation state.

### Invariant 20

Donation history is not purged for storage optimization.

### Invariant 21

Only authorized roles can change agreed monthly contribution amounts.

### Invariant 22

Members cannot change their own fixed monthly contribution amount.

### Invariant 23

Referral contribution is based on verified donations, not referral count alone.

### Invariant 24

Donation processing must not modify the financial ledger outside the authoritative financial model.

---

# 102. Acceptance Criteria

The donation system is implementation-ready when it can:

- Maintain monthly contribution terms.
- Apply an effective month to amount changes.
- Preserve historical amounts.
- Automatically generate monthly records.
- Prevent duplicate monthly records.
- Track pending/missed months.
- Generate payment links.
- Expire links at month end.
- Preserve historical payment-link context.
- Accept combined outstanding payments.
- Allocate combined payments FIFO.
- Reject false monthly completion from partial payments.
- Handle overpayment as General Donation.
- Support additional donations.
- Support anonymous donations.
- Support aggregate Jummah cash collections.
- Allow Finance verification.
- Prevent duplicate verification/posting.
- Link donations to the financial ledger.
- Provide member donation history.
- Provide appropriate committee contribution reporting.
- Send pending reminders without altering financial state.
- Produce audit records for critical donation actions.

---

# 103. Implementation Boundary

This document defines donation-specific business behavior.

The following belong elsewhere:

```text
Member identity             → MEMBER_MANAGEMENT.md
Authentication              → AUTHENTICATION.md
Financial ledger            → FINANCIAL_DATA_MODEL.md
Payment technical flow     → PAYMENT_SYSTEM.md
Committee referral model   → COMMITTEE_DATA_MODEL.md
Audit trail                → AUDIT_LOG_MODEL.md
Notification delivery      → NOTIFICATION_SYSTEM.md
Database tables            → DATABASE_SCHEMA.md
Security/RLS               → SECURITY_ARCHITECTURE.md
Reports/PDF                → REPORTING_AND_AUDIT.md
UI                         → SCREEN_SPECIFICATIONS.md
```

---

# 104. Related Documents

- `PROJECT_OVERVIEW.md`
- `PRODUCT_REQUIREMENTS.md`
- `FEATURE_SCOPE.md`
- `USER_ROLES_PERMISSIONS.md`
- `AUTHENTICATION.md`
- `MEMBER_MANAGEMENT.md`
- `FINANCIAL_DATA_MODEL.md`
- `COMMITTEE_DATA_MODEL.md`
- `AUDIT_LOG_MODEL.md`
- `DATABASE_SCHEMA.md`
- `DATA_RELATIONSHIPS.md`
- `PAYMENT_SYSTEM.md`
- `FINANCE_SYSTEM.md`
- `NOTIFICATION_SYSTEM.md`
- `REPORTING_AND_AUDIT.md`
- `SECURITY_ARCHITECTURE.md`

---

## Document Status

**Donation System — V1 Implementation Baseline**

This document defines the authoritative donation lifecycle for Masjid-e-Mamoor 2.

All donation implementation must preserve the allocation, verification, history, and financial-integrity invariants defined here.
