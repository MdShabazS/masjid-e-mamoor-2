# Masjid-e-Mamoor --- Donation & Finance Specification

**Document Status:** Draft --- Architecture Review Required\
**Version:** 1.0\
**Phase:** Documentation-First / Pre-Development\
**Repository:** `MdShabazS/masjid-e-mamoor-2`

------------------------------------------------------------------------

# 1. Purpose

This document defines the product and domain specification for donations
and finance.

It establishes:

-   monthly donation obligations
-   obligation history
-   payment submission
-   UPI intent flow
-   payment proof
-   Finance verification
-   FIFO allocation
-   partial payment
-   outstanding balance
-   overpayment
-   additional donations
-   anonymous donations
-   Jummah cash
-   combined payments
-   finance accounts
-   transfers
-   expenses
-   corrections
-   reversals/cancellations
-   financial reporting
-   auditability
-   concurrency
-   idempotency
-   financial privacy
-   separation of duties

This document is intended to be read together with:

-   `BUSINESS_RULES.md`
-   `DATABASE_ARCHITECTURE.md`
-   `RLS_SECURITY_MODEL.md`
-   `API_DOMAIN_ARCHITECTURE.md`
-   `STORAGE_ARCHITECTURE.md`
-   `NOTIFICATION_ARCHITECTURE.md`

------------------------------------------------------------------------

# 2. Financial Principles

## FIN-001 --- Financial State Is Authoritative

The database's approved financial state is authoritative.

UI calculations are informational.

------------------------------------------------------------------------

## FIN-002 --- Finance Operations Are Controlled

Financial mutations require explicit authorization.

------------------------------------------------------------------------

## FIN-003 --- No Silent Financial Mutation

The client must not silently modify:

-   obligation amount
-   payment status
-   allocation
-   account balance
-   expense status
-   transfer state
-   correction state

------------------------------------------------------------------------

## FIN-004 --- Every Financial Mutation Is Auditable

Material financial changes must have an audit trail.

------------------------------------------------------------------------

## FIN-005 --- Financial History Is Preserved

Corrections and reversals must preserve historical evidence.

------------------------------------------------------------------------

## FIN-006 --- Atomicity

Operations that must succeed or fail together must execute atomically.

------------------------------------------------------------------------

## FIN-007 --- Idempotency

Retrying a financial command must not create duplicate financial
effects.

------------------------------------------------------------------------

## FIN-008 --- Separation of Duties

Payment submission, verification, financial oversight, and
administrative functions must follow the approved role matrix.

------------------------------------------------------------------------

## FIN-009 --- FIFO Allocation

Recurring donation payments are allocated against eligible outstanding
obligations in deterministic FIFO order unless an approved business rule
explicitly changes that behavior.

------------------------------------------------------------------------

## FIN-010 --- No Client Authority

The client can request a financial action but cannot declare that the
action succeeded.

------------------------------------------------------------------------

# 3. Financial Domains

The finance domain contains:

``` text
member obligations
payment submissions
payment proofs
payment verification
allocation
additional donations
anonymous donations
Jummah cash
finance accounts
transactions
transfers
expenses
corrections
reversals
audit
reports
```

------------------------------------------------------------------------

# 4. Financial Actors

Primary roles:

1.  President / Super Admin
2.  Vice President
3.  Secretary
4.  Finance
5.  Auditor
6.  Committee Member
7.  Member

The exact permissions are defined in `ROLE_PERMISSION_MATRIX.md`.

------------------------------------------------------------------------

# 5. Member Financial View

A Member should be able to see authorized information such as:

-   current obligation
-   historical obligations
-   paid amounts
-   outstanding amounts
-   payment history
-   payment status
-   additional donations made by the member
-   applicable receipts/proofs

The Member must not see another member's private financial data.

------------------------------------------------------------------------

# 6. Monthly Donation Obligation

A recurring monthly obligation represents the amount applicable to a
member for a particular effective month.

Conceptual:

``` text
member
   |
   +--> obligation for month
   |
   +--> payment allocations
```

------------------------------------------------------------------------

# 7. Obligation Effective Month

An obligation is associated with a business month.

The system must distinguish:

``` text
obligation month
```

from:

``` text
payment submission date
```

and:

``` text
verification timestamp
```

These values may differ.

------------------------------------------------------------------------

# 8. Obligation History

When a member's recurring obligation changes, historical months must
remain reconstructable.

Example:

``` text
Jan -> 500
Feb -> 500
Mar -> 700
```

The March change must not rewrite January/February historical amounts.

------------------------------------------------------------------------

# 9. Effective-Date Rule

The final effective-month policy must be explicitly applied.

A future change should not silently alter already finalized historical
obligations.

------------------------------------------------------------------------

# 10. Obligation Status

Possible conceptual states:

``` text
open
partially_paid
paid
waived
cancelled
closed
```

Only states required by the final implementation should be retained.

------------------------------------------------------------------------

# 11. Obligation Amount

The authoritative obligation amount must be stored/derived in a
deterministic manner.

Avoid recomputing historical obligations from today's membership
configuration.

------------------------------------------------------------------------

# 12. Outstanding Amount

Conceptually:

``` text
outstanding
=
eligible obligation amount
-
authoritative allocations
```

The exact implementation may use a stored balance, computed value, or
hybrid approach.

The architecture must ensure one authoritative result.

------------------------------------------------------------------------

# 13. Payment Submission

A Member can submit a payment through an approved payment flow.

A payment submission is not automatically verified.

Conceptual lifecycle:

``` text
submitted
   |
   +--> under_review
   |
   +--> verified
   |
   +--> rejected
```

Additional states may be required for reversal/cancellation.

------------------------------------------------------------------------

# 14. Payment Methods

Initial conceptual categories:

``` text
UPI
bank transfer
cash
other approved method
```

The final supported set must be explicitly configured.

------------------------------------------------------------------------

# 15. UPI Intent

The application may generate an approved UPI intent/deep link.

The server must provide authoritative payment destination information.

The client launches the UPI flow.

------------------------------------------------------------------------

# 16. UPI Is Not Verification

Successful return from a UPI application must not automatically mark a
payment verified.

Verification requires the approved Finance process.

------------------------------------------------------------------------

# 17. UPI Reference

Where available, the user may provide a transaction/reference
identifier.

The reference must be validated as an input, not treated as independent
proof of settlement.

------------------------------------------------------------------------

# 18. Payment Proof

Payment proof may include:

-   screenshot
-   receipt
-   transaction evidence

Proof is supporting evidence.

It does not itself establish final financial state.

------------------------------------------------------------------------

# 19. Proof Storage

Payment proofs use the protected storage architecture defined in
`STORAGE_ARCHITECTURE.md`.

The payment record references proof metadata.

------------------------------------------------------------------------

# 20. Proof Privacy

Payment proof access must follow financial authorization.

The proof must not become publicly accessible merely because a payment
exists.

------------------------------------------------------------------------

# 21. Payment Submission Validation

Validate:

-   authenticated user
-   active account
-   amount
-   method
-   target context
-   proof policy
-   operation ID
-   business-month eligibility

------------------------------------------------------------------------

# 22. Payment Amount

Amounts must use exact monetary representation.

Do not use floating-point arithmetic for authoritative financial
calculations.

------------------------------------------------------------------------

# 23. Minimum Payment

If partial payment is permitted, the amount may be below the full
obligation.

The exact minimum amount policy must be documented.

------------------------------------------------------------------------

# 24. Zero Payment

A payment command should normally reject zero or negative amounts.

Any exception must be an explicitly defined administrative operation.

------------------------------------------------------------------------

# 25. Payment Status

The payment record should clearly distinguish:

``` text
submitted
under_review
verified
rejected
reversed
cancelled
```

Exact final state model must be reconciled with the database
architecture.

------------------------------------------------------------------------

# 26. Verification

Finance verification confirms that submitted payment evidence is
accepted according to the organization's process.

Verification is a trusted financial command.

------------------------------------------------------------------------

# 27. Verification Workflow

Conceptually:

``` text
Finance opens pending payment
        |
        v
reviews payment information/proof
        |
        +---- reject
        |
        +---- verify
                 |
                 v
          calculate allocation
                 |
                 v
          update financial state
                 |
                 v
              audit
                 |
                 v
             outbox
```

------------------------------------------------------------------------

# 28. Verification Preconditions

Before verification:

-   payment exists
-   payment belongs to valid context
-   payment is in verifiable state
-   actor has permission
-   amount is valid
-   required evidence is present
-   operation is not already applied

------------------------------------------------------------------------

# 29. Verification Atomicity

The following must be atomic where applicable:

``` text
payment verification
allocation
financial transaction posting
audit event
notification outbox creation
```

A partial financial update is not acceptable.

------------------------------------------------------------------------

# 30. Rejection

Finance may reject a payment where the verification criteria are not
satisfied.

A rejection should capture a reason where required.

------------------------------------------------------------------------

# 31. Rejection Does Not Delete Evidence

Rejected payment submissions remain historically visible according to
authorized access.

The proof should not be silently deleted.

------------------------------------------------------------------------

# 32. Resubmission After Rejection

A rejected payment remains historically recorded as rejected.

A resubmission creates a new payment submission with:

- a new payment identity;
- a new operation identity;
- its own proof and verification lifecycle where applicable.

A rejected payment is never silently converted into verified and its
historical record is not rewritten.

------------------------------------------------------------------------

# 33. FIFO Allocation

FIFO means allocating an approved recurring payment against the earliest
eligible outstanding obligations first.

Example:

``` text
January outstanding = 500
February outstanding = 500
March outstanding = 500

payment = 800
```

Allocation:

``` text
January = 500
February = 300
March = 0
```

------------------------------------------------------------------------

# 34. FIFO Determinism

The allocation ordering must be deterministic.

Primary ordering should be the obligation effective month.

A stable unique identifier can provide secondary ordering where needed.

------------------------------------------------------------------------

# 35. FIFO Eligibility

Only eligible outstanding obligations may receive allocation.

Eligibility must account for:

-   member
-   obligation status
-   effective month
-   existing allocations
-   approved exceptions

------------------------------------------------------------------------

# 36. Partial Allocation

A payment may partially satisfy an obligation.

Example:

``` text
obligation = 500
payment = 300

allocated = 300
outstanding = 200
```

------------------------------------------------------------------------

# 37. Full Allocation

When:

``` text
allocated = outstanding
```

the obligation becomes fully paid according to the authoritative state
model.

------------------------------------------------------------------------

# 38. Multi-Month Allocation

One payment may satisfy multiple outstanding obligations.

Example:

``` text
Jan = 200
Feb = 300
Mar = 400

payment = 700
```

Result:

``` text
Jan = 200
Feb = 300
Mar = 200
```

------------------------------------------------------------------------

# 39. Allocation Record

Each allocation should be independently identifiable.

Conceptual:

``` text
payment_id
obligation_id
allocated_amount
created_at
```

Additional fields may support reversal/history.

------------------------------------------------------------------------

# 40. Allocation Immutability

A verified allocation should not simply be overwritten.

Corrections should use controlled reversal/correction mechanisms.

------------------------------------------------------------------------

# 41. Overpayment

If:

``` text
payment amount > eligible outstanding
```

the excess must follow an explicitly approved policy.

Possible classifications include:

``` text
additional donation
unallocated balance
refund/exception workflow
```

The final product must select and document the permitted behavior.

------------------------------------------------------------------------

# 42. No Silent Future Prepayment

A payment should not automatically be interpreted as prepayment for
future months unless the business rules explicitly permit it.

------------------------------------------------------------------------

# 43. Additional Donation

An additional donation is distinct from settlement of recurring
obligations.

Conceptually:

``` text
recurring obligation settlement
        !=
additional donation
```

Reports should preserve this distinction.

------------------------------------------------------------------------

# 44. Additional Donation Allocation

Additional donations should not silently reduce recurring outstanding
obligations unless the business rule explicitly defines that behavior.

------------------------------------------------------------------------

# 45. Anonymous Donation

Anonymous donations must not expose donor identity to users who are not
authorized to access it.

The system may retain internal information needed for finance/audit if
permitted by policy.

------------------------------------------------------------------------

# 46. Anonymous Donation Privacy

The UI should distinguish:

``` text
anonymous to members
```

from:

``` text
unknown to Finance
```

These are not necessarily the same.

------------------------------------------------------------------------

# 47. Jummah Cash

Jummah cash represents a cash collection associated with a Jummah
event/date.

It is a distinct financial entry category.

------------------------------------------------------------------------

# 48. Jummah Cash Recording

Finance-authorized users may record:

``` text
date
amount
account
reference/notes
```

subject to final business rules.

------------------------------------------------------------------------

# 49. Jummah Cash and Member Obligations

Jummah cash must not automatically be allocated against a member's
recurring obligation.

It is a separate financial category unless an explicit workflow says
otherwise.

------------------------------------------------------------------------

# 50. Combined Payment

Combined payment allows one payment operation to cover multiple eligible
outstanding items.

The system must calculate authoritative allocation.

------------------------------------------------------------------------

# 51. Combined Payment Atomicity

If combined payment is submitted as one financial operation:

``` text
all intended valid effects
```

must either:

``` text
commit
```

or:

``` text
fail safely
```

according to the approved workflow.

------------------------------------------------------------------------

# 52. Combined Payment UI

The UI may display selectable outstanding items.

The server must re-check all selections and amounts.

Client selections are requests, not final authority.

------------------------------------------------------------------------

# 53. Combined Payment Concurrency

If another payment changes an outstanding item between display and
submission:

-   server revalidates
-   stale selections are rejected or recalculated according to approved
    policy
-   no negative outstanding balance may result

------------------------------------------------------------------------

# 54. Idempotent Payments

Every retryable payment mutation must have a stable operation
identifier.

If the client retries after timeout, the server must detect whether the
original operation already committed.

------------------------------------------------------------------------

# 55. Duplicate Payment Protection

Do not rely only on UI prevention.

Enforce server/database uniqueness or idempotency safeguards.

------------------------------------------------------------------------

# 56. Payment Reference Duplication

If transaction/reference IDs are expected to be unique, the final policy
must define:

-   uniqueness scope
-   handling missing references
-   handling legitimate repeated references

------------------------------------------------------------------------

# 57. Payment Reversal

A verified payment may require reversal under an approved process.

Reversal must:

-   preserve original payment
-   create a reversal/correction record
-   reverse allocations where applicable
-   restore authoritative outstanding values correctly
-   create audit evidence

------------------------------------------------------------------------

# 58. Reversal Atomicity

Payment reversal and associated allocation/financial effects must be
handled atomically.

------------------------------------------------------------------------

# 59. Cancellation

Cancellation applies only where the business state permits it.

A cancelled record must remain historically traceable.

------------------------------------------------------------------------

# 60. Financial Account Model

The system may contain multiple finance accounts.

Examples:

``` text
bank account
cash account
UPI account
other approved account
```

The exact account list is organizational configuration.

------------------------------------------------------------------------

# 61. Account Authority

Finance accounts represent controlled organizational funds.

Members must not be able to modify balances directly.

------------------------------------------------------------------------

# 62. Transactions

Financial transactions record movements or recognized financial effects.

Conceptual fields:

``` text
account
amount
direction/type
category
reference
source record
created_at
```

Exact schema is defined in the database architecture.

------------------------------------------------------------------------

# 63. Transaction Categories

Potential categories:

``` text
monthly donation
additional donation
anonymous donation
Jummah cash
expense
transfer
correction
reversal
```

The final category taxonomy should remain consistent across reports.

------------------------------------------------------------------------

# 64. Account Balance

A balance should be derived from authoritative transaction state or
maintained through a carefully controlled ledger strategy.

The implementation must avoid conflicting sources of truth.

------------------------------------------------------------------------

# 65. Transfer

A transfer moves value between organization-controlled accounts.

Example:

``` text
Cash -> Bank
UPI -> Bank
```

A transfer must produce balanced financial effects.

------------------------------------------------------------------------

# 66. Transfer Atomicity

A transfer should not create a state where:

``` text
source reduced
destination not increased
```

or vice versa.

------------------------------------------------------------------------

# 67. Transfer Validation

Validate:

-   source account
-   destination account
-   amount
-   permissions
-   account status
-   operation ID
-   current state

------------------------------------------------------------------------

# 68. Self-Transfer

Transfers where:

``` text
source_account == destination_account
```

should normally be rejected unless an explicit business reason exists.

------------------------------------------------------------------------

# 69. Expenses

An expense represents organizational spending.

Potential workflow:

``` text
draft
submitted
approved
rejected
posted
cancelled/reversed
```

Exact state model remains subject to final finance approval.

------------------------------------------------------------------------

# 70. Expense Evidence

Expenses may require:

-   bill
-   invoice
-   receipt
-   supporting document

Storage authorization follows `STORAGE_ARCHITECTURE.md`.

------------------------------------------------------------------------

# 71. Expense Creation

Creating a draft expense should not necessarily affect final account
balance.

The final posting point must be explicit.

------------------------------------------------------------------------

# 72. Expense Approval

Approval should be a controlled action.

Separation-of-duties requirements must be applied where defined.

------------------------------------------------------------------------

# 73. Expense Posting

Once posted, the authoritative financial effect must be recorded
atomically with required audit/outbox effects.

------------------------------------------------------------------------

# 74. Expense Rejection

Rejected expenses should preserve the submission history.

They should not be silently deleted.

------------------------------------------------------------------------

# 75. Expense Cancellation

Cancellation must preserve history.

If the expense has already posted financially, a reversal/correction may
be required instead of simple deletion.

------------------------------------------------------------------------

# 76. Financial Corrections

Corrections address legitimate errors without destroying history.

Example:

``` text
incorrect category
incorrect amount
incorrect account
incorrect allocation
```

------------------------------------------------------------------------

# 77. Correction Principle

Prefer:

``` text
original record
+
correction/reversal record
```

over:

``` text
overwrite original record
```

------------------------------------------------------------------------

# 78. Correction Authorization

Corrections require explicit permission and reason.

Sensitive corrections may require elevated approval.

------------------------------------------------------------------------

# 79. Audit Record

Every material financial correction should record:

-   actor
-   target
-   reason
-   before/after context where appropriate
-   timestamp
-   operation ID

------------------------------------------------------------------------

# 80. Separation of Duties

The implementation must preserve approved separation between:

``` text
submission
verification
oversight
correction
administration
```

The exact combinations are defined by the role-permission matrix.

------------------------------------------------------------------------

# 81. Auditor Role

Auditor access is primarily oversight-oriented.

Auditor permissions should not automatically imply the ability to mutate
financial state.

------------------------------------------------------------------------

# 82. President / Super Admin

President is the highest administrative role but should still operate
through controlled permissions and auditable workflows.

"Super Admin" does not mean bypassing every financial control.

------------------------------------------------------------------------

# 83. Finance Role

Finance handles authorized financial operations.

Finance access must not expose unrelated personal information beyond
what is required for finance work.

------------------------------------------------------------------------

# 84. Member Privacy

A Member must not see:

-   another member's outstanding amount
-   another member's payment history
-   private payment proof
-   internal finance notes

unless explicitly authorized.

------------------------------------------------------------------------

# 85. Financial Search

Finance search may support:

``` text
member
payment reference
date
amount
status
account
```

Search results remain permission-scoped.

------------------------------------------------------------------------

# 86. Financial Reports

Potential reports:

``` text
monthly donation collection
outstanding obligations
payment verification
additional donations
anonymous donations
Jummah collections
account balances
income/expense
transfers
corrections/reversals
```

------------------------------------------------------------------------

# 87. Report Authority

Reports must derive from authoritative financial records.

They must not calculate financial truth from UI caches or notification
history.

------------------------------------------------------------------------

# 88. Historical Reports

Historical reports must use historical obligation values.

A later change in monthly contribution must not rewrite prior-month
reports.

------------------------------------------------------------------------

# 89. Outstanding Report

Outstanding report should clearly distinguish:

``` text
current outstanding
historical outstanding
future obligation
```

Do not mix future obligations into current due amounts without explicit
labeling.

------------------------------------------------------------------------

# 90. Collection Report

Collection reports should distinguish:

``` text
recurring obligation settlement
additional donation
anonymous donation
Jummah cash
other income
```

------------------------------------------------------------------------

# 91. Expense Report

Expense reports should distinguish:

``` text
draft
approved
posted
reversed
cancelled
```

according to final state definitions.

------------------------------------------------------------------------

# 92. Account Report

Account reports should support reconciliation of:

``` text
opening balance
inflows
outflows
transfers
corrections
closing balance
```

Exact accounting presentation requires final organizational approval.

------------------------------------------------------------------------

# 93. Reconciliation

Finance should be able to compare system records against external
evidence.

Potential evidence:

-   bank statement
-   UPI statement
-   cash count
-   receipts

The system should preserve reconciliation notes where required.

------------------------------------------------------------------------

# 94. Cash Handling

Cash workflows require explicit recording of:

-   collection
-   deposit
-   transfer
-   expense
-   reconciliation

Cash is not equivalent to a bank balance.

------------------------------------------------------------------------

# 95. UPI Account Handling

UPI collections should be associated with an approved organizational
financial account/category.

Do not assume the UPI intent destination alone proves receipt.

------------------------------------------------------------------------

# 96. Bank Transfer Handling

Bank-transfer submissions may require:

-   transaction/reference ID
-   proof
-   Finance verification

The exact evidence requirement depends on the payment method
configuration.

------------------------------------------------------------------------

# 97. Payment Proof and Financial Posting

A proof upload may create:

``` text
payment submitted
```

but only verification creates:

``` text
verified financial effect
```

unless an approved alternative workflow exists.

------------------------------------------------------------------------

# 98. Financial State Machine

Conceptual:

``` text
Payment
submitted
   |
   v
under_review
   |
   +----> rejected
   |
   v
verified
   |
   +----> reversed
```

Obligation:

``` text
open
  |
  v
partially_paid
  |
  v
paid
```

Expense:

``` text
draft
  |
  v
submitted
  |
  +--> rejected
  |
  v
approved
  |
  v
posted
  |
  v
reversed/cancelled
```

These are conceptual state machines and must be reconciled with the
final database state model.

------------------------------------------------------------------------

# 99. Invalid State Transitions

The server must reject transitions such as:

``` text
rejected -> verified
```

unless a documented resubmission/review process exists.

Similarly:

``` text
paid -> partially_paid
```

must only occur through an authorized reversal/correction workflow.

------------------------------------------------------------------------

# 100. Concurrency

Financial commands must assume concurrent actions.

Example:

``` text
Finance verifies payment A
Finance verifies payment B
```

Both may target the same outstanding obligation.

The database transaction must prevent over-allocation.

------------------------------------------------------------------------

# 101. Allocation Locking

The final implementation may use:

-   row locks
-   serializable transactions
-   advisory mechanisms
-   another database-safe concurrency strategy

The selected approach must be tested under concurrent load.

------------------------------------------------------------------------

# 102. Negative Balance Prevention

The system must prevent:

``` text
allocated > eligible outstanding
```

unless the overpayment policy explicitly allows an
additional/unallocated category.

------------------------------------------------------------------------

# 103. Double Verification Prevention

Two Finance users verifying the same payment must not produce duplicate
allocations.

The second operation must observe the changed state and return a
deterministic result.

------------------------------------------------------------------------

# 104. Double Transfer Prevention

Repeated transfer requests with the same operation ID must not create
duplicate movements.

------------------------------------------------------------------------

# 105. Double Expense Posting Prevention

Posting the same expense twice must be prevented.

------------------------------------------------------------------------

# 106. Financial Idempotency

Each financial command should define:

``` text
operation ID
command type
actor
target/context
result
```

The idempotency record must survive long enough to protect against
realistic client retries.

------------------------------------------------------------------------

# 107. Client Timeout Scenario

If:

``` text
client -> command
```

times out after the server commits:

The client retries with the same operation ID.

The server returns the previous result instead of executing the
financial command again.

------------------------------------------------------------------------

# 108. Financial Error Handling

Errors should distinguish:

``` text
not authorized
invalid amount
invalid state
already processed
stale state
insufficient account condition
validation failure
temporary failure
```

Raw SQL/database errors must not reach the client.

------------------------------------------------------------------------

# 109. Audit Requirements

Audit at minimum:

-   payment submission
-   payment verification
-   payment rejection
-   payment reversal
-   allocation changes
-   account transaction creation
-   transfer
-   expense approval/posting
-   financial correction
-   role/permission changes affecting finance

------------------------------------------------------------------------

# 110. Financial Audit Integrity

Audit records should be append-oriented.

Ordinary clients must not edit or delete audit events.

------------------------------------------------------------------------

# 111. Audit and Privacy

Audit logs may contain sensitive financial information.

Access must be restricted.

------------------------------------------------------------------------

# 112. Financial Notifications

Important events may create notifications:

``` text
payment verified
payment rejected
expense approved
expense rejected
transfer completed
correction recorded
```

Notification delivery failure must not roll back financial state.

------------------------------------------------------------------------

# 113. Financial Storage

Proofs and supporting documents use private storage.

Storage access must follow financial permissions.

------------------------------------------------------------------------

# 114. Financial Realtime

Authorized Finance dashboards may receive realtime updates for:

-   pending payments
-   verification state
-   expenses
-   transfers
-   account changes

Members receive only their own relevant financial changes.

------------------------------------------------------------------------

# 115. Realtime Is Not Authority

A realtime event is an update signal.

The client should re-read authoritative state after critical financial
mutations.

------------------------------------------------------------------------

# 116. Offline Financial Restrictions

Final financial verification, posting, transfer, correction, and
reversal should require online trusted execution unless an explicit
offline-safe process is designed and approved.

------------------------------------------------------------------------

# 117. Offline Payment Capture

If supported:

``` text
payment intent/proof captured locally
```

may be queued.

It must not be treated as verified financial state until server
processing succeeds.

------------------------------------------------------------------------

# 118. Financial Cache

Client caches may contain financial data.

Caches must be:

-   scoped
-   protected
-   invalidated after account/role changes
-   cleared appropriately on logout

------------------------------------------------------------------------

# 119. Logout

Sensitive financial cached data should not remain accessible to a
different authenticated user on the same device.

------------------------------------------------------------------------

# 120. Financial Search and Enumeration

A member ID/payment ID must not allow a user to enumerate financial
records outside their authorization scope.

------------------------------------------------------------------------

# 121. Pagination

Financial lists must use bounded pagination.

Examples:

``` text
pending payments
transactions
expenses
audit events
```

------------------------------------------------------------------------

# 122. Export Security

Financial exports are sensitive.

Exports must:

-   require permission
-   apply server-side filters
-   avoid unauthorized fields
-   be private
-   be auditable where required
-   have controlled retention

------------------------------------------------------------------------

# 123. CSV/PDF Exports

Exports should use authoritative query results.

The export generator must not trust client-provided financial totals.

------------------------------------------------------------------------

# 124. Financial Dashboard

A dashboard may display:

``` text
total collected
outstanding
pending verification
expenses
account balances
recent activity
```

These are derived views.

They must not become separate sources of truth.

------------------------------------------------------------------------

# 125. Dashboard Reconciliation

Dashboard totals should be reproducible from authoritative financial
data.

Where cached aggregates are used, reconciliation mechanisms must exist.

------------------------------------------------------------------------

# 126. Monthly Closing

Formal hard monthly closing is **not enabled in v1**.

Late entries remain possible.

Business date and server timestamps remain distinct.

Corrections and reversals remain available through their authorized workflows.

If a formal monthly closing capability is introduced in a future version, its close date, authorization, late-entry treatment, post-close correction rules and reopening process must be explicitly designed before implementation.


# 127. Future-Month Obligations

The system may contain future obligations, but reports/UI must
distinguish them from currently due outstanding amounts.

------------------------------------------------------------------------

# 128. Future-Month Payment

The default rule is:

``` text
do not silently allocate current payment to future obligations
```

unless explicitly permitted.

------------------------------------------------------------------------

# 129. Waiver

If obligation waivers are supported, they must:

-   be authorized
-   record reason
-   preserve original obligation
-   affect outstanding calculation explicitly
-   be auditable

------------------------------------------------------------------------

# 130. Waiver and Payment

A waived obligation should not accidentally create a refundable or
negative balance when previously paid amounts exist.

The exact policy must be documented before implementation.

------------------------------------------------------------------------

# 131. Membership Change

When membership changes:

-   historical obligations remain
-   existing allocations remain
-   future obligation behavior follows effective-date rules

Membership status must not rewrite financial history.

------------------------------------------------------------------------

# 132. Deactivated Member

A deactivated member may retain historical financial records.

Future obligations must follow the approved membership-status rules.

------------------------------------------------------------------------

# 133. Reactivated Member

Reactivation must not automatically rewrite historical financial
records.

New obligations begin according to the effective-date policy.

------------------------------------------------------------------------

# 134. Referral and Finance

Referral registration may create a member identity.

It does not itself create financial payment authority beyond the
approved membership process.

------------------------------------------------------------------------

# 135. Anonymous Payment Submission

If anonymous donations are accepted through a member-facing workflow,
the exact identity handling must be explicit.

Do not infer anonymity from a missing profile.

------------------------------------------------------------------------

# 136. Cash Donation Recording

Cash donations require a controlled Finance entry.

The system should distinguish:

``` text
cash received
```

from:

``` text
cash deposited
```

where organizational reconciliation requires both.

------------------------------------------------------------------------

# 137. Cash Count

If cash-count workflows are implemented, they should support controlled
reconciliation.

Exact process is an open operational decision.

------------------------------------------------------------------------

# 138. Financial Reference Numbers

System-generated financial IDs should be unique.

Human-readable references may also be generated for support/reporting.

Do not expose internal database primary keys unnecessarily.

------------------------------------------------------------------------

# 139. Monetary Currency

The application must define its supported currency.

For this product, the expected operational currency is INR, but
implementation should make the currency explicit rather than infer it
from UI symbols.

------------------------------------------------------------------------

# 140. Monetary Precision

The system should define allowed precision for INR transactions.

Financial calculations must use exact decimal/integer-safe
representation.

------------------------------------------------------------------------

# 141. Timestamp Rules

Financial records should use server-authoritative timestamps.

Important dates include:

``` text
business date
submission timestamp
verification timestamp
posting timestamp
reversal timestamp
```

These must not be conflated.

------------------------------------------------------------------------

# 142. Timezone

The organization should define its business timezone.

The application should consistently use that timezone for:

-   monthly periods
-   financial dates
-   Jummah dates
-   reporting
-   daily cutoffs

------------------------------------------------------------------------

# 143. Month Boundaries

Monthly obligation calculations must not depend on device-local
timezone.

Server/business timezone controls month boundaries.

------------------------------------------------------------------------

# 144. Financial API Commands

Initial conceptual commands:

``` text
submitPayment
verifyPayment
rejectPayment
createCombinedPayment
submitAdditionalDonation
recordJummahCash
transferFunds
createExpense
submitExpenseForApproval
approveExpense
rejectExpense
cancelExpense
createFinancialCorrection
reverseFinancialOperation
```

Exact names may change during implementation.

------------------------------------------------------------------------

# 145. Financial Queries

Initial conceptual queries:

``` text
getMyDonationSummary
listMyObligations
listMyPayments
getPayment
listPendingPayments
getPaymentAllocations
listAccounts
getAccountSummary
listTransactions
listExpenses
getExpense
getFinancialReport
```

------------------------------------------------------------------------

# 146. Financial Validation

Shared validation should cover:

-   amounts
-   IDs
-   dates
-   payment method
-   account
-   reason
-   proof references
-   operation IDs

Business validation remains server-authoritative.

------------------------------------------------------------------------

# 147. Financial Error Codes

Potential categories:

``` text
PAYMENT_ALREADY_PROCESSED
PAYMENT_NOT_VERIFIABLE
INVALID_PAYMENT_AMOUNT
INVALID_ALLOCATION
OUTSTANDING_CHANGED
DUPLICATE_OPERATION
ACCOUNT_NOT_FOUND
ACCOUNT_NOT_ACTIVE
TRANSFER_INVALID
EXPENSE_INVALID_STATE
CORRECTION_NOT_ALLOWED
REVERSAL_NOT_ALLOWED
```

Final code catalogue remains an implementation decision.

------------------------------------------------------------------------

# 148. Financial Testing Strategy

Tests must include:

-   unit tests for allocation
-   integration tests for transactions
-   RLS tests
-   command authorization tests
-   idempotency tests
-   concurrency tests
-   reversal tests
-   report reconciliation
-   storage permission tests
-   notification isolation tests

------------------------------------------------------------------------

# 149. FIFO Unit Test Example

Given:

``` text
Jan outstanding = 500
Feb outstanding = 200
Mar outstanding = 400
Payment = 600
```

Expected:

``` text
Jan allocation = 500
Feb allocation = 100
Mar allocation = 0
```

The test should verify both allocations and remaining balances.

------------------------------------------------------------------------

# 150. Partial Payment Test

Given:

``` text
obligation = 1000
payment = 400
```

Expected:

``` text
allocated = 400
outstanding = 600
```

------------------------------------------------------------------------

# 151. Multi-Month Test

Given:

``` text
Jan = 300
Feb = 300
Mar = 300
payment = 750
```

Expected:

``` text
Jan = 300
Feb = 300
Mar = 150
```

------------------------------------------------------------------------

# 152. Overpayment Test

Given:

``` text
eligible outstanding = 500
payment = 700
```

The test must verify the explicitly selected overpayment policy.

No unapproved future allocation should occur.

------------------------------------------------------------------------

# 153. Duplicate Verification Test

Run the same verification operation twice.

Expected:

``` text
one financial effect
one allocation set
deterministic second response
```

------------------------------------------------------------------------

# 154. Concurrent Verification Test

Two Finance actors attempt to verify the same payment simultaneously.

Expected:

``` text
one authoritative verification
no duplicate allocation
no negative balance
```

------------------------------------------------------------------------

# 155. Concurrent Allocation Test

Two payments target the same obligation concurrently.

Expected:

``` text
total allocation <= eligible amount
```

unless approved overpayment handling applies.

------------------------------------------------------------------------

# 156. Transfer Test

Test:

``` text
source - amount
destination + amount
```

as one atomic financial operation.

------------------------------------------------------------------------

# 157. Reversal Test

Verify:

``` text
original financial effect remains historical
reversal exists
net current state is correct
audit exists
```

------------------------------------------------------------------------

# 158. Correction Test

Verify:

``` text
original record preserved
correction authorized
new state correct
audit preserved
```

------------------------------------------------------------------------

# 159. Expense Test

Verify:

``` text
draft -> submitted -> approved -> posted
```

and invalid transitions.

------------------------------------------------------------------------

# 160. Financial RLS Tests

Test each role against:

-   own records
-   other-member records
-   finance records
-   audit records
-   account records
-   expenses
-   transfers
-   corrections

------------------------------------------------------------------------

# 161. Financial Security Tests

Test:

-   forged member ID
-   forged actor ID
-   forged role
-   direct table write
-   unauthorized RPC
-   service-role exposure
-   storage bypass
-   export bypass
-   realtime subscription bypass

------------------------------------------------------------------------

# 162. Financial Acceptance Criteria

The finance module is implementation-ready when:

1.  Obligation lifecycle is defined.
2.  Effective-month behavior is defined.
3.  Payment state machine is defined.
4.  UPI behavior is defined.
5.  Proof requirements are defined.
6.  FIFO allocation is defined.
7.  Partial payment is defined.
8.  Overpayment behavior is defined.
9.  Additional donation behavior is defined.
10. Anonymous donation behavior is defined.
11. Jummah cash is defined.
12. Combined payment behavior is defined.
13. Account model is defined.
14. Transfer behavior is defined.
15. Expense lifecycle is defined.
16. Correction/reversal is defined.
17. Concurrency is defined.
18. Idempotency is defined.
19. Audit is defined.
20. RLS/security boundaries are defined.
21. Reports are defined.
22. Tests are defined.

------------------------------------------------------------------------

# 163. V1 Approved Decisions

The following financial business decisions are approved for v1.

| Decision | Approved v1 policy |
|---|---|
| Exact monthly obligation change/effective-date rule | Monthly obligations use an explicit effective month; historical obligations are not rewritten. |
| Minimum partial-payment amount | ₹1 minimum positive payment. |
| Rejected-payment resubmission model | Rejected submissions remain historical; resubmission creates a new payment and operation ID. |
| Overpayment treatment | Remaining amount after eligible FIFO recurring allocation becomes an additional donation. |
| Future-month prepayment policy | No automatic future-month prepayment in v1. |
| Waiver workflow | Controlled authorized waiver preserving original obligation history, amount, reason, actor and operation identity. |
| Monthly closing | No formal hard monthly close in v1. |
| Cash reconciliation workflow | Cash received, held and deposited/transferred are distinguishable financial states/effects. |
| Expense approval thresholds | All posted expenses use maker/checker separation; creator cannot approve own expense. |
| Correction approval thresholds | Financial corrections require authorized second-person approval and explicit reason. |
| Reversal approval thresholds | Reversals require controlled second-person approval, explicit reason and compensating financial effect. |
| Account taxonomy | Bank, UPI, Cash, Other. |
| Exact transaction category taxonomy | Controlled categories: recurring donation, additional donation, anonymous donation, Jummah donation, expense, transfer in/out, correction and reversal. |
| Financial retention period | Category-specific governed retention; exact legal/organizational requirements must be verified before production settings. |
| Currency configuration | INR with exact numeric monetary representation and two decimal places. |
| Exact financial RPC/transaction design | Engineering implementation decision; must preserve the approved financial integrity baseline. |

These decisions supersede the corresponding unresolved organizational decisions for v1.


# 164. Implementation Order

1.  Finalize financial business decisions
2.  Finalize database financial tables
3.  Finalize RLS policies
4.  Finalize validation schemas
5.  Implement obligation queries
6.  Implement payment submission
7.  Implement proof attachment
8.  Implement Finance verification
9.  Implement FIFO allocation
10. Implement combined payment
11. Implement additional/anonymous/Jummah workflows
12. Implement accounts and transactions
13. Implement transfers
14. Implement expenses
15. Implement corrections/reversals
16. Implement financial reports
17. Implement notifications
18. Add concurrency/idempotency tests
19. Add RLS/security tests
20. Perform reconciliation tests

------------------------------------------------------------------------

# 165. Change Control

Any financial change must review:

-   `BUSINESS_RULES.md`
-   `DATABASE_ARCHITECTURE.md`
-   `RLS_SECURITY_MODEL.md`
-   `API_DOMAIN_ARCHITECTURE.md`
-   `STORAGE_ARCHITECTURE.md`
-   `NOTIFICATION_ARCHITECTURE.md`
-   role-permission matrix
-   reports
-   audit
-   tests

Financial behavior must never be changed only at the UI layer.

------------------------------------------------------------------------

# 166. Status

**Current status: Donation & Finance specification generated for
review.**

This document defines the financial domain and its required controls.
Final unresolved organizational rules must be explicitly decided before
implementation. Platform-specific database/RPC syntax must be verified
against the current Supabase documentation during implementation.
