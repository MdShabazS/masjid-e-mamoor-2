# Masjid-e-Mamoor --- Financial Integrity Specification

**Document Status:** Draft --- Architecture Review Required\
**Version:** 1.0\
**Phase:** Documentation-First / Pre-Development\
**Repository:** `MdShabazS/masjid-e-mamoor-2`

------------------------------------------------------------------------

# 1. Purpose

This document defines the integrity, correctness, consistency,
concurrency, auditability, and recovery requirements for the
Masjid-e-Mamoor financial subsystem.

It complements:

-   `DONATION_FINANCE_SPEC.md`
-   `BUSINESS_RULES.md`
-   `DATABASE_ARCHITECTURE.md`
-   `RLS_SECURITY_MODEL.md`
-   `API_DOMAIN_ARCHITECTURE.md`

The objective is to make financial state resistant to:

-   duplicate operations
-   concurrent operations
-   partial commits
-   unauthorized mutations
-   stale client state
-   replayed requests
-   incorrect allocation
-   accidental deletion
-   silent corrections
-   notification failures
-   storage failures
-   offline replay
-   reporting inconsistencies

------------------------------------------------------------------------

# 2. Integrity Principles

## FI-001 --- Single Authoritative Financial State

Financial truth must have a clearly defined authoritative
representation.

------------------------------------------------------------------------

## FI-002 --- No Client-Authoritative Financial State

A browser/mobile cache, displayed balance, submitted form, or
client-side calculation cannot establish financial truth.

------------------------------------------------------------------------

## FI-003 --- Atomic Financial Commands

A command that requires multiple financial effects must commit them
together.

------------------------------------------------------------------------

## FI-004 --- Immutable Financial History

Historical financial events must not be silently overwritten or deleted.

------------------------------------------------------------------------

## FI-005 --- Controlled Corrections

Errors are corrected through explicit compensating/correction
operations.

------------------------------------------------------------------------

## FI-006 --- Idempotent Retry

The same logical command must not create duplicate effects when retried.

------------------------------------------------------------------------

## FI-007 --- Concurrency Safety

Simultaneous financial operations must preserve all invariants.

------------------------------------------------------------------------

## FI-008 --- Authorization Before Mutation

A valid authenticated session alone is insufficient for sensitive
financial mutation.

------------------------------------------------------------------------

## FI-009 --- Database Enforcement

Critical invariants must be enforced at the database/trusted-operation
boundary wherever practical.

------------------------------------------------------------------------

## FI-010 --- Reconciliation

Financial reports and balances must be reproducible and reconcilable.

------------------------------------------------------------------------

# 3. Financial Integrity Model

Conceptually:

``` text
Client Request
      |
      v
Authentication
      |
      v
Authorization
      |
      v
Validation
      |
      v
Idempotency Check
      |
      v
Load Current State
      |
      v
Concurrency Control
      |
      v
Domain Rules
      |
      v
Atomic Transaction
      |
      +--> financial state
      +--> allocation
      +--> audit
      +--> outbox
      |
      v
Committed Result
```

------------------------------------------------------------------------

# 4. Integrity Boundaries

The system has four important integrity boundaries:

``` text
UI boundary
API/domain boundary
database transaction boundary
storage/audit boundary
```

Each boundary has different responsibilities.

------------------------------------------------------------------------

# 5. UI Boundary

The UI should prevent obvious invalid actions.

Examples:

-   negative amount
-   missing required field
-   invalid date
-   unsupported payment method

But UI validation is not a security or integrity control.

------------------------------------------------------------------------

# 6. API Boundary

The API must:

-   authenticate
-   authorize
-   validate
-   apply domain rules
-   enforce operation identity
-   return deterministic results

------------------------------------------------------------------------

# 7. Database Boundary

The database/trusted function layer must protect:

-   uniqueness
-   referential integrity
-   amount constraints
-   transaction atomicity
-   allocation consistency
-   state transitions
-   concurrency-sensitive operations

------------------------------------------------------------------------

# 8. Storage Boundary

Financial evidence files require:

-   authorized access
-   controlled lifecycle
-   metadata linkage
-   audit where required

A storage object cannot establish financial truth by itself.

------------------------------------------------------------------------

# 9. Financial Invariants

The following invariants must always hold.

------------------------------------------------------------------------

## INV-001 --- No Negative Valid Outstanding

A finalized obligation should not have a negative outstanding balance
unless the system explicitly represents an approved credit/overpayment
state.

------------------------------------------------------------------------

## INV-002 --- Allocation Cannot Exceed Eligible Amount

For ordinary obligation settlement:

``` text
sum(valid allocations)
<= eligible obligation amount
```

unless an explicitly approved financial classification applies.

------------------------------------------------------------------------

## INV-003 --- Payment Allocation Cannot Exceed Payment

For ordinary allocation:

``` text
sum(payment allocations)
<= payment amount
```

Any excess must be represented explicitly.

------------------------------------------------------------------------

## INV-004 --- No Duplicate Financial Operation

One logical operation ID must not create two financial effects.

------------------------------------------------------------------------

## INV-005 --- Verified Payment Cannot Be Verified Twice

Repeated verification must not duplicate allocations or financial
entries.

------------------------------------------------------------------------

## INV-006 --- Reversal Does Not Erase History

A reversal creates a compensating effect rather than deleting the
original event.

------------------------------------------------------------------------

## INV-007 --- Transfer Is Balanced

A transfer must produce balanced source/destination effects.

------------------------------------------------------------------------

## INV-008 --- Unauthorized Actor Cannot Mutate Finance

Authorization must be enforced independent of UI visibility.

------------------------------------------------------------------------

## INV-009 --- Historical Obligation Amount Is Stable

Changing a current recurring amount must not rewrite historical
finalized obligations.

------------------------------------------------------------------------

## INV-010 --- Audit Events Are Append-Oriented

Ordinary application users cannot edit historical audit records.

------------------------------------------------------------------------

# 10. Obligation Integrity

An obligation identifies:

``` text
member
effective month
authoritative amount
status
```

Historical obligations must remain identifiable.

------------------------------------------------------------------------

# 11. Obligation Uniqueness

The system should prevent duplicate obligation rows for the same unique
business scope.

A likely business uniqueness boundary is:

``` text
member + obligation month
```

unless the finalized product supports multiple obligation types per
month.

------------------------------------------------------------------------

# 12. Obligation Creation

Obligation creation must be deterministic.

A retry should not create a duplicate obligation.

------------------------------------------------------------------------

# 13. Obligation Amount Changes

Changing a current configuration must not mutate finalized historical
obligations.

If an adjustment is required:

``` text
original obligation
+
authorized adjustment/history
```

should preserve traceability.

------------------------------------------------------------------------

# 14. Effective Month Integrity

The system must distinguish:

``` text
effective month
```

from:

``` text
created_at
updated_at
paid_at
verified_at
```

A record created later may still belong to an earlier business month.

------------------------------------------------------------------------

# 15. Obligation State Integrity

Only valid transitions may occur.

Example:

``` text
open -> partially_paid -> paid
```

Invalid transitions must be rejected.

------------------------------------------------------------------------

# 16. Waiver Integrity

If waivers are supported:

-   original amount remains historically visible
-   waiver is authorized
-   waiver reason is retained
-   outstanding calculation includes waiver correctly
-   payment allocation cannot accidentally create a negative balance

------------------------------------------------------------------------

# 17. Payment Integrity

A payment represents a submitted/verified financial event according to
its lifecycle.

It must have:

-   stable identity
-   actor/context
-   amount
-   method
-   status
-   timestamps
-   operation identity where required

------------------------------------------------------------------------

# 18. Payment Amount Immutability

After a payment reaches a finalized financial state, changing the amount
should not be performed through ordinary edit CRUD.

Use correction/reversal workflows.

------------------------------------------------------------------------

# 19. Payment Method Integrity

Changing payment method after verification must require an explicit
correction process.

------------------------------------------------------------------------

# 20. Payment Status Integrity

Only approved transitions are permitted.

Example:

``` text
submitted -> under_review
under_review -> verified
under_review -> rejected
verified -> reversed
```

The final state machine must be explicit.

------------------------------------------------------------------------

# 21. Proof Integrity

A payment proof is evidence associated with a payment.

It must not automatically change:

``` text
payment status
allocation
financial balance
```

------------------------------------------------------------------------

# 22. Proof Replacement

Replacing proof after verification should require an auditable process
if the proof is part of the financial evidence.

------------------------------------------------------------------------

# 23. FIFO Integrity

FIFO allocation must be deterministic.

Given the same authoritative state and same eligible payment, the
allocation result must be predictable.

------------------------------------------------------------------------

# 24. FIFO Ordering

Primary ordering:

``` text
oldest eligible obligation month
```

Secondary deterministic ordering may be used where necessary.

------------------------------------------------------------------------

# 25. FIFO Atomicity

Allocation must occur inside the same authoritative transaction as
payment verification where business rules require verification and
allocation to be inseparable.

------------------------------------------------------------------------

# 26. FIFO Concurrency

Consider:

``` text
Obligation A outstanding = 500

Payment 1 = 400
Payment 2 = 300
```

Concurrent processing must not result in:

``` text
A allocated = 700
```

unless explicit overpayment handling is intended.

------------------------------------------------------------------------

# 27. Allocation Uniqueness

An allocation record should have a stable identity.

The same logical allocation must not be created twice.

------------------------------------------------------------------------

# 28. Allocation Reversal

If a payment is reversed:

1.  identify affected allocations
2.  create compensating effects
3.  restore outstanding state
4.  preserve original allocations
5.  audit the reversal

------------------------------------------------------------------------

# 29. Partial Payment Integrity

For:

``` text
obligation = 1000
payment = 400
```

the authoritative result must be:

``` text
allocated = 400
outstanding = 600
```

subject to approved exceptions.

------------------------------------------------------------------------

# 30. Multi-Month Allocation Integrity

For:

``` text
Jan = 500
Feb = 500
Mar = 500
Payment = 800
```

expected FIFO:

``` text
Jan = 500
Feb = 300
Mar = 0
```

The operation must commit atomically.

------------------------------------------------------------------------

# 31. Overpayment Integrity

Overpayment must never disappear.

It must be represented as one of the explicitly approved categories:

``` text
additional donation
unallocated amount
refund/exception
```

------------------------------------------------------------------------

# 32. Future-Month Integrity

A current payment must not silently create future-month allocations.

Future allocation requires explicit product policy.

------------------------------------------------------------------------

# 33. Combined Payment Integrity

A combined payment must:

-   validate selected obligations
-   re-read current state
-   calculate current eligible balances
-   prevent duplicate application
-   commit atomically

------------------------------------------------------------------------

# 34. Combined Payment Stale State

If the UI shows:

``` text
Jan outstanding = 500
```

but another payment changes it before submission, the server must not
blindly apply the stale amount.

------------------------------------------------------------------------

# 35. Combined Payment Failure

If one required component cannot be applied under an atomic workflow:

``` text
no partial financial result
```

unless the approved business process explicitly permits partial
execution.

------------------------------------------------------------------------

# 36. Additional Donation Integrity

Additional donations must be distinguishable from recurring obligation
settlement.

This prevents reporting ambiguity.

------------------------------------------------------------------------

# 37. Anonymous Donation Integrity

Anonymous classification must not cause the system to lose required
internal audit information.

The visibility layer and internal record can differ.

------------------------------------------------------------------------

# 38. Jummah Cash Integrity

Jummah cash should be recorded as a controlled financial event.

It must not be accidentally duplicated by repeated form submission.

------------------------------------------------------------------------

# 39. Account Integrity

Each finance account must have:

-   stable identity
-   defined status
-   controlled transactions
-   controlled access

------------------------------------------------------------------------

# 40. Account Balance Integrity

If balance is derived:

``` text
balance = opening state + authoritative transaction effects
```

If balance is materialized:

-   every mutation must update it atomically
-   reconciliation must be possible

The implementation must choose one authoritative strategy.

------------------------------------------------------------------------

# 41. Transfer Integrity

For:

``` text
source = A
destination = B
amount = X
```

the transaction must produce:

``` text
A - X
B + X
```

as one atomic operation.

------------------------------------------------------------------------

# 42. Transfer Failure

If the transaction fails:

``` text
A unchanged
B unchanged
```

No partial transfer is acceptable.

------------------------------------------------------------------------

# 43. Transfer Idempotency

Retrying the same transfer operation ID must not move funds twice.

------------------------------------------------------------------------

# 44. Self-Transfer Integrity

A source/destination identity collision should normally be rejected.

------------------------------------------------------------------------

# 45. Expense Integrity

Expenses should have a controlled lifecycle.

Only the appropriate state should affect final financial posting.

------------------------------------------------------------------------

# 46. Expense Posting Integrity

Posting an expense should produce:

-   authorized financial effect
-   expense state transition
-   audit
-   notification/outbox where required

atomically.

------------------------------------------------------------------------

# 47. Duplicate Expense Posting

A second attempt to post an already posted expense must not create
another transaction.

------------------------------------------------------------------------

# 48. Expense Reversal

A posted expense should be reversed through an explicit compensating
operation.

------------------------------------------------------------------------

# 49. Correction Integrity

Corrections must preserve:

``` text
what happened originally
```

and:

``` text
what was corrected
```

------------------------------------------------------------------------

# 50. Correction Reason

Material corrections require a reason.

The reason should be validated and retained.

------------------------------------------------------------------------

# 51. Correction Authorization

Correction permission should be stricter than ordinary data editing.

------------------------------------------------------------------------

# 52. Audit Integrity

Audit records should capture enough information to reconstruct the
administrative action.

Potential:

``` text
actor
action
entity
entity_id
operation_id
timestamp
reason
result
```

------------------------------------------------------------------------

# 53. Before/After Audit

Where sensitive correction requires it, capture a safe before/after
representation.

Do not store secrets or unnecessary personal data.

------------------------------------------------------------------------

# 54. Audit Immutability

Application clients should not:

``` text
UPDATE audit
DELETE audit
```

------------------------------------------------------------------------

# 55. Idempotency Model

Each sensitive command should have:

``` text
operation_id
actor_id
command_type
target/context
request hash where useful
status
result reference
created_at
completed_at
```

Exact schema is implementation-specific.

------------------------------------------------------------------------

# 56. Idempotency Key Reuse

The same operation ID should not be reused for a materially different
request.

If request contents conflict:

``` text
IDEMPOTENCY_KEY_REUSED
```

or equivalent safe conflict should be returned.

------------------------------------------------------------------------

# 57. Idempotency Retention

Successful financial idempotency records must be retained for a minimum of one year.

This retention period covers realistic financial retry/replay windows and supports reconciliation of delayed or repeated operations.

Financial history and audit references remain independently traceable and are not dependent solely on the operational idempotency record.


# 58. Idempotency and Offline Sync

Offline operations require stable operation IDs generated before retry.

A queued operation must preserve the same ID across:

-   app restarts
-   reconnects
-   retries

------------------------------------------------------------------------

# 59. Concurrency Model

The database must be treated as the concurrency authority.

Client locks are not sufficient.

------------------------------------------------------------------------

# 60. Race Condition Example

Two Finance users see:

``` text
Payment P = pending
```

Both click Verify.

Only one should perform the state transition.

The second should receive a deterministic
already-processed/current-state response.

------------------------------------------------------------------------

# 61. Race Condition Example --- Allocation

Two payments target the same outstanding obligation.

The transaction must serialize or otherwise safely coordinate
allocation.

------------------------------------------------------------------------

# 62. Race Condition Example --- Transfer

Two transfers attempt to use the same source account.

The final implementation must define whether negative balances are
possible and enforce the approved account policy atomically.

------------------------------------------------------------------------

# 63. Transaction Isolation

The selected PostgreSQL transaction isolation/locking strategy must be
based on actual contention patterns.

Do not choose the strongest isolation blindly if it creates unacceptable
operational behavior.

------------------------------------------------------------------------

# 64. Row Locking

Row-level locking may be appropriate for:

-   payment verification
-   obligation allocation
-   account transfers
-   expense posting

The exact lock set must be designed and tested.

------------------------------------------------------------------------

# 65. Deadlock Prevention

If multiple rows are locked:

-   lock in deterministic order
-   keep transactions short
-   avoid unnecessary external calls inside transactions

------------------------------------------------------------------------

# 66. External Calls

Do not perform slow external network calls inside critical financial
database transactions where avoidable.

Examples:

-   push provider
-   file processing
-   external API

Use outbox/asynchronous processing.

------------------------------------------------------------------------

# 67. Notification Failure Isolation

If push delivery fails:

``` text
financial transaction remains committed
```

Notification retry occurs separately.

------------------------------------------------------------------------

# 68. Storage Failure Isolation

If a proof upload fails:

``` text
payment proof attachment fails
```

but the system must not incorrectly mark the payment as verified.

------------------------------------------------------------------------

# 69. Payment + Proof Ordering

The product must define whether:

``` text
proof required before submission
```

or:

``` text
proof can be attached later
```

The chosen policy must be enforced consistently.

------------------------------------------------------------------------

# 70. Database Constraints

Critical invariants should use database constraints where feasible.

Potential constraints:

-   positive amounts
-   valid statuses
-   unique obligation scope
-   unique operation ID
-   foreign keys
-   non-null required relationships

------------------------------------------------------------------------

# 71. Check Constraints

Use database checks for simple invariants.

Example conceptual:

``` text
amount > 0
```

Complex cross-row rules belong in trusted transactions/functions.

------------------------------------------------------------------------

# 72. Foreign Keys

Financial relationships should use foreign keys wherever appropriate.

Examples:

``` text
payment -> member
allocation -> payment
allocation -> obligation
expense -> account
transaction -> account
```

------------------------------------------------------------------------

# 73. Delete Restrictions

Financial records should generally not cascade-delete in a way that
destroys historical evidence.

Use explicit lifecycle states.

------------------------------------------------------------------------

# 74. Soft Delete vs Immutable History

Use lifecycle/status fields where historical preservation is required.

Do not rely on generic soft-delete alone for financial integrity.

------------------------------------------------------------------------

# 75. Financial Ledger Philosophy

The implementation should behave like a controlled ledger:

``` text
events/effects
    |
    v
authoritative history
    |
    v
derived balances
```

The exact accounting model must be finalized before coding.

------------------------------------------------------------------------

# 76. Derived Values

Potential derived values:

``` text
outstanding
account balance
monthly totals
dashboard totals
```

Derived values must be reproducible from authoritative records.

------------------------------------------------------------------------

# 77. Materialized Aggregates

If performance requires stored aggregates:

-   define refresh/update rules
-   update atomically where required
-   provide reconciliation queries
-   never let aggregates become unverified financial truth

------------------------------------------------------------------------

# 78. Reconciliation Query

The system should provide internal checks such as:

``` text
sum allocations by payment
sum allocations by obligation
account transaction totals
```

These should identify inconsistencies.

------------------------------------------------------------------------

# 79. Integrity Monitoring

Potential scheduled checks:

``` text
negative outstanding
allocation exceeds payment
allocation exceeds obligation
orphan allocations
duplicate operation IDs
unbalanced transfers
posted expense without transaction
transaction without source context
```

------------------------------------------------------------------------

# 80. Integrity Incident

If an integrity check detects a violation:

1.  preserve evidence
2.  prevent further corruption if possible
3.  alert authorized operators
4.  record incident
5.  investigate
6.  correct through controlled process

Do not silently rewrite records.

------------------------------------------------------------------------

# 81. Reconciliation Frequency

The frequency of automated reconciliation is an operational decision.

High-risk financial invariants should be checked regularly enough to
detect problems early.

------------------------------------------------------------------------

# 82. Financial Backup

Database backups must preserve:

-   obligations
-   payments
-   allocations
-   accounts
-   transactions
-   expenses
-   corrections
-   audit

Storage backups must separately preserve financial evidence files where
required.

------------------------------------------------------------------------

# 83. Recovery Testing

A backup is not considered sufficient until restoration is tested.

Recovery should verify:

-   balances
-   allocations
-   payment state
-   account state
-   audit links
-   storage references

------------------------------------------------------------------------

# 84. Recovery and Idempotency

After restoration, replayed requests must not accidentally create
duplicate effects.

The recovery plan must account for:

-   restored idempotency records
-   outbox records
-   external delivery state

------------------------------------------------------------------------

# 85. Reconciliation After Restore

Run integrity checks after restoration before declaring the system
operational.

------------------------------------------------------------------------

# 86. Financial Security Boundary

Service-role credentials must never reach:

-   browser
-   mobile bundle
-   public source code
-   client logs

------------------------------------------------------------------------

# 87. RLS as Defense in Depth

RLS must protect database access even if an application query is
accidentally too broad.

------------------------------------------------------------------------

# 88. Trusted Functions

High-risk operations may use trusted database functions/RPC or a
server-side transaction boundary.

They must:

-   validate input
-   authorize trusted context
-   enforce invariants
-   execute atomically

------------------------------------------------------------------------

# 89. Service Role

The service role should be used only in controlled server environments.

It must never be used as a shortcut to avoid designing authorization.

------------------------------------------------------------------------

# 90. Role Escalation

A user must not be able to change:

``` text
role
permission
financial authority
```

through ordinary profile updates.

------------------------------------------------------------------------

# 91. Authorization Revocation

When Finance access is removed:

-   future financial commands must fail
-   existing sessions must re-evaluate authorization
-   storage/realtime/report access must follow the new permissions

------------------------------------------------------------------------

# 92. Financial Data Exposure

Do not expose financial information through:

-   unrestricted search
-   public URLs
-   browser logs
-   push payloads
-   analytics events
-   debug output

------------------------------------------------------------------------

# 93. Logging

Never log:

-   OTPs
-   access tokens
-   service keys
-   signed URLs
-   complete payment proofs

Financial diagnostic logging must be minimal and controlled.

------------------------------------------------------------------------

# 94. Request Logging

Safe request metadata may include:

``` text
request_id
operation_id
command_type
actor category
result category
latency
```

------------------------------------------------------------------------

# 95. API Retry Policy

Clients may retry only operations known to be safe or idempotent.

A timeout does not imply failure.

The client should query operation status or retry with the same
operation ID.

------------------------------------------------------------------------

# 96. Client Operation State

The UI may display:

``` text
processing
success
failed
unknown — checking
```

An `unknown` result should trigger reconciliation rather than immediate
duplicate submission.

------------------------------------------------------------------------

# 97. Financial UI Guardrails

The UI should require confirmation for high-impact operations such as:

-   verification
-   transfer
-   correction
-   reversal
-   expense posting

Confirmation is a UX safeguard, not an authorization control.

------------------------------------------------------------------------

# 98. Amount Confirmation

High-impact financial actions should clearly display:

-   amount
-   account
-   target
-   effect
-   reason where applicable

before final submission.

------------------------------------------------------------------------

# 99. Financial Audit Trail in UI

Authorized Finance/Auditor views may show:

``` text
created
verified
allocated
corrected
reversed
```

with timestamps and actor information appropriate to their permissions.

------------------------------------------------------------------------

# 100. No Destructive Edit UI

Avoid generic edit screens for finalized financial records.

Use explicit actions:

``` text
Correct
Reverse
Cancel
```

according to state.

------------------------------------------------------------------------

# 101. Financial Search Integrity

Search/filter results must be generated from current authoritative data.

Cached search results must be invalidated/reconciled after mutations.

------------------------------------------------------------------------

# 102. Realtime Integrity

When a financial event arrives via realtime:

1.  identify affected query
2.  invalidate/re-fetch authoritative data
3.  update UI
4.  preserve local mutation state until confirmed

------------------------------------------------------------------------

# 103. Offline Integrity

Offline clients may queue only approved operations.

Financial verification and posting should remain online/trusted unless a
formally designed offline financial process exists.

------------------------------------------------------------------------

# 104. Offline Replay

Every queued operation must be:

``` text
authenticated again
authorized again
validated against current state
```

before execution.

------------------------------------------------------------------------

# 105. Offline Stale State

A queued operation may reference an obligation/payment that changed
while offline.

The server must reject or safely reconcile it.

------------------------------------------------------------------------

# 106. Offline Financial Proof

If proof is captured offline, the proof upload and payment submission
must be independently reconciled.

Do not treat local file presence as proof of server acceptance.

------------------------------------------------------------------------

# 107. Integrity and Notifications

Notification events should be generated from committed financial state.

A failed notification must not affect financial correctness.

------------------------------------------------------------------------

# 108. Integrity and Storage

Storage failures must not create phantom financial evidence.

Database metadata should represent actual object lifecycle.

------------------------------------------------------------------------

# 109. Integrity and Reports

Reports must be generated from authoritative state.

Report totals should be reproducible.

------------------------------------------------------------------------

# 110. Report Reconciliation

For a monthly report:

``` text
collection total
=
sum of eligible authoritative financial events
```

subject to defined exclusions/categories.

------------------------------------------------------------------------

# 111. Category Integrity

Every financial event must belong to an approved category.

Do not allow arbitrary free-text categories to define accounting totals.

------------------------------------------------------------------------

# 112. Account Integrity

Accounts should have controlled lifecycle states such as:

``` text
active
inactive
closed
```

A closed account should not accept new transactions unless an approved
reopening process exists.

------------------------------------------------------------------------

# 113. Transaction Date vs Created Date

A financial transaction may have:

``` text
business_date
created_at
```

These are different concepts.

Reports must use the correct one.

------------------------------------------------------------------------

# 114. Late Entry

If a transaction is entered later for an earlier business date, the
system should preserve both dates.

Monthly reporting policy must define how late entries affect closed
periods.

------------------------------------------------------------------------

# 115. Correction After Period Close

If monthly closing is introduced, corrections after close require an
explicit workflow.

Do not edit closed historical totals directly.

------------------------------------------------------------------------

# 116. Financial Integrity and Roles

Role access should follow:

``` text
Member
 -> own financial data

Finance
 -> authorized finance operations

Auditor
 -> authorized oversight

Admin roles
 -> authorized administration
```

Exact permissions remain defined in the role matrix.

------------------------------------------------------------------------

# 117. Finance-to-Auditor Separation

Auditor access should support verification and oversight without
automatically granting mutation authority.

------------------------------------------------------------------------

# 118. Admin-to-Finance Separation

Administrative authority does not automatically mean every finance
operation should be a direct unrestricted edit.

High-risk operations remain controlled and auditable.

------------------------------------------------------------------------

# 119. Integrity Test Catalogue

Minimum automated test groups:

``` text
obligation integrity
payment integrity
FIFO allocation
partial payment
combined payment
overpayment
idempotency
concurrency
transfer atomicity
expense lifecycle
correction/reversal
RLS
audit
storage
notification isolation
offline replay
reconciliation
```

------------------------------------------------------------------------

# 120. Property-Based Financial Tests

Where practical, test financial invariants across generated scenarios.

Examples:

``` text
allocation never exceeds eligible amount
duplicate operations never double-count
reversal returns expected net state
FIFO ordering remains deterministic
```

------------------------------------------------------------------------

# 121. Stress Testing

Stress scenarios should include:

-   many concurrent payment verifications
-   concurrent allocations
-   simultaneous transfers
-   repeated mobile retries
-   realtime bursts

Correctness must remain intact.

------------------------------------------------------------------------

# 122. Failure Injection

Test failures between critical steps:

``` text
before transaction
during transaction
after financial commit
before notification
after notification enqueue
during storage upload
```

The resulting state must remain explainable and recoverable.

------------------------------------------------------------------------

# 123. Partial Failure Principle

A system failure must result in one of:

``` text
clean rollback
```

or:

``` text
committed authoritative state with retryable secondary work
```

Avoid ambiguous partial financial states.

------------------------------------------------------------------------

# 124. Financial Integrity Definition of Done

A financial feature is not complete until:

-   business rules documented
-   schema implemented
-   RLS implemented
-   trusted transaction implemented
-   idempotency implemented
-   concurrency tested
-   audit implemented
-   notification behavior defined
-   storage behavior defined
-   reports reconciled
-   offline behavior defined
-   security tests passed
-   failure tests passed

------------------------------------------------------------------------

# 125. Pre-Production Integrity Checklist

Before financial production use:

-   [ ] No service-role credentials in clients
-   [ ] RLS enabled
-   [ ] Financial commands use trusted boundaries
-   [ ] Idempotency tested
-   [ ] Concurrency tested
-   [ ] FIFO tested
-   [ ] Reversal tested
-   [ ] Transfer atomicity tested
-   [ ] Expense lifecycle tested
-   [ ] Audit immutability tested
-   [ ] Storage permissions tested
-   [ ] Notification failure isolation tested
-   [ ] Backup restore tested
-   [ ] Reconciliation queries tested
-   [ ] Export security tested
-   [ ] Role revocation tested

------------------------------------------------------------------------

# 126. Operational Integrity Checklist

After deployment:

-   monitor financial errors
-   monitor integrity checks
-   monitor outbox failures
-   monitor storage failures
-   monitor unusual duplicate operations
-   monitor reconciliation results
-   periodically test restore
-   review privileged financial activity

------------------------------------------------------------------------

# 127. Incident Response

For suspected financial corruption:

1.  identify affected records
2.  preserve audit/log evidence
3.  restrict risky operations if necessary
4.  determine authoritative state
5.  reconcile
6.  apply controlled correction
7.  document incident
8.  verify downstream reports
9.  review prevention controls

------------------------------------------------------------------------

# 128. No Silent Repair

Do not directly edit financial database rows merely to make a dashboard
look correct.

Repairs must be traceable.

------------------------------------------------------------------------

# 129. Financial Integrity Documentation

Every high-risk financial command should have a dedicated implementation
note containing:

-   purpose
-   inputs
-   authorization
-   transaction boundary
-   locks/concurrency
-   invariants
-   idempotency
-   audit
-   notifications
-   failure handling
-   tests

------------------------------------------------------------------------

# 130. Implementation Order

1.  Finalize financial invariants
2.  Finalize state machines
3.  Finalize database constraints
4.  Finalize idempotency model
5.  Finalize concurrency strategy
6.  Implement obligation integrity
7.  Implement payment integrity
8.  Implement FIFO
9.  Implement combined payments
10. Implement accounts/transfers
11. Implement expenses
12. Implement corrections/reversals
13. Implement audit
14. Implement reconciliation
15. Add failure injection
16. Add concurrency tests
17. Add recovery tests
18. Perform full financial acceptance testing

------------------------------------------------------------------------

# 131. V1 Approved / Deferred Decisions

The following decisions are resolved for v1.

| Decision | V1 status / policy |
|---|---|
| Exact ledger model | Approved: append-oriented authoritative financial-effect model. |
| Materialized vs calculated balances | Approved: calculated authoritative balances; any materialized value is derived/cache data and must be reconcilable. |
| Exact PostgreSQL locking strategy | Implementation decision; must preserve financial invariants and concurrency safety. |
| Transaction isolation levels | Implementation decision; select according to operation contention and integrity requirements. |
| Idempotency retention | Approved: successful financial idempotency records retained for a minimum of one year. |
| Overpayment classification | Approved: remaining amount after eligible FIFO recurring allocation becomes an additional donation. |
| Future-month policy | Approved: no automatic future-month prepayment in v1. |
| Period/month closing | Approved: no formal hard monthly close in v1. |
| Correction approval levels | Approved: second-person authorization with explicit reason. |
| Reversal approval levels | Approved: controlled second-person authorization with explicit reason and compensating effect. |
| Reconciliation schedule | Approved: formal monthly reconciliation plus on-demand reconciliation. |
| Incident escalation process | Remains an operational/security process decision and is not silently invented by the financial implementation. |

The implementation decisions above must preserve the approved v1 financial integrity baseline.


# 132. Status

**Current status: Financial integrity specification generated for
review.**

This document defines the integrity controls required for financial
implementation. The exact SQL constraints, transaction functions,
locking strategy, and Supabase implementation must be finalized only
after the remaining architecture documents and current platform
documentation have been reviewed.
