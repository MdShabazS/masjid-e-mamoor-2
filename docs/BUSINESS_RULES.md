# Masjid-e-Mamoor --- Business Rules Specification

**Document Status:** Draft --- Business Rules Review Required\
**Version:** 1.0\
**Phase:** Documentation-First / Pre-Development\
**Repository:** `MdShabazS/masjid-e-mamoor-2`

------------------------------------------------------------------------

## 1. Purpose

This document defines the business rules that determine how
Masjid-e-Mamoor must behave.

These rules are more specific than the product overview and must be
enforced consistently across web, mobile, APIs, trusted operations, and
database transactions.

A UI must never be the final authority for a business rule.

This document must be read with:

-   `PROJECT_MASTER_SPEC.md`
-   `PRODUCT_REQUIREMENTS.md`
-   `SYSTEM_ARCHITECTURE.md`
-   `ROLE_PERMISSION_MATRIX.md`

------------------------------------------------------------------------

## 2. Rule Classification

Business rules fall into four categories:

### 2.1 Validation Rules

Rules that determine whether an input is structurally acceptable.

### 2.2 Authorization Rules

Rules that determine whether the current user may perform an operation.

### 2.3 State-Transition Rules

Rules that determine how an accepted operation changes authoritative
state.

### 2.4 Financial Integrity Rules

Rules that must be enforced atomically and must preserve financial
correctness.

Implementation may use client validation for usability, but
authoritative enforcement belongs in trusted backend/database
boundaries.

------------------------------------------------------------------------

# 3. Identity and Role Rules

## BR-IDENTITY-001 --- Authentication

Every protected operation requires an authenticated identity.

## BR-IDENTITY-002 --- Role Assignment

A user's application role is backend-controlled.

A user cannot assign or escalate their own role through client input.

## BR-IDENTITY-003 --- Seven Roles

Only these application roles exist unless an approved architecture
change adds another:

-   President / Super Admin
-   Vice President
-   Secretary
-   Finance
-   Auditor
-   Committee Member
-   Member

## BR-IDENTITY-004 --- Deny by Default

If an operation does not have an explicit permission grant, it is
denied.

## BR-IDENTITY-005 --- Current Authorization

Sensitive operations must evaluate current backend-controlled
authorization rather than trusting stale client role/permission state.

## BR-IDENTITY-006 --- Role Changes Are Auditable

Changes to roles or permission assignments must be auditable.

------------------------------------------------------------------------

# 4. Membership Rules

## BR-MEMBER-001 --- Member Identity

A member record must be associated with the appropriate application
identity where the member has a platform account.

## BR-MEMBER-002 --- Unique Membership Identity

The final database model must define the fields required to prevent
accidental duplicate member identities.

## BR-MEMBER-003 --- Own Profile

A member may view and update only the profile fields explicitly allowed
for self-service.

## BR-MEMBER-004 --- Administrative Member Access

Administrative/member-management roles may access member information
only within their authorized scope.

## BR-MEMBER-005 --- Member Privacy

A normal member cannot browse another member's private or financial
information.

## BR-MEMBER-006 --- Membership History

Important membership lifecycle changes must preserve history where
required for reporting and auditability.

## BR-MEMBER-007 --- Referral Attribution

A referral registration must preserve the referring party and the
resulting registration/member relationship where applicable.

------------------------------------------------------------------------

# 5. Donation Obligation Rules

## BR-DONATION-001 --- Effective Month

A recurring donation obligation is associated with an effective month.

## BR-DONATION-002 --- Historical Changes

Changes to an obligation must not silently rewrite historical financial
truth.

Historical obligations and their applicable values must remain
reconstructable.

## BR-DONATION-003 --- Outstanding Amount

Outstanding amount is derived from authoritative obligation state and
authoritative allocations/payments.

It is not a client-maintained balance.

## BR-DONATION-004 --- No Client Authority

The client cannot mark an obligation as paid, settled, verified, or
allocated without the appropriate trusted operation.

## BR-DONATION-005 --- Partial Settlement

A valid payment may partially settle an eligible obligation.

The remaining outstanding amount must remain accurate.

------------------------------------------------------------------------

# 6. Payment Submission Rules

## BR-PAYMENT-001 --- Payment Submission

A member may submit a payment through an authorized payment workflow.

The submission is initially non-final.

## BR-PAYMENT-002 --- Client Submission Is Not Verification

Creating a payment submission does not mean that the payment is
verified.

## BR-PAYMENT-003 --- Payment Proof

Where proof is required, it must be stored through protected storage and
associated with the payment submission.

## BR-PAYMENT-004 --- UPI Return Is Not Proof of Settlement

Launching or returning from a UPI intent/deep-link flow must not
automatically mark the payment as verified.

## BR-PAYMENT-005 --- Duplicate Payment Protection

Repeated requests caused by retries, double taps, network retries, or
client restarts must not create duplicate authoritative payment
processing.

A stable operation/idempotency reference must be used where applicable.

## BR-PAYMENT-006 --- Verification Authority

Finance or another explicitly authorized permission holder performs
authoritative payment verification.

## BR-PAYMENT-007 --- Verification State

A payment must have a clear state that distinguishes at least the
relevant lifecycle stages such as pending, verified, rejected, or
cancelled/reversed where those states are approved.

Exact status names are finalized in the database/API architecture.

------------------------------------------------------------------------

# 7. Payment Allocation Rules

## BR-ALLOC-001 --- Allocation Requires Verification

Authoritative allocation must occur only through an authorized trusted
operation.

## BR-ALLOC-002 --- Atomic Verification and Allocation

When verification and allocation are part of one financial workflow, the
authoritative state change must be atomic.

The system must not report successful verification while leaving
allocation partially completed.

## BR-ALLOC-003 --- FIFO

When multiple eligible outstanding obligations exist, allocation follows
FIFO according to the approved obligation ordering.

## BR-ALLOC-004 --- Partial FIFO Allocation

If a payment does not fully cover the oldest eligible obligation, the
applicable amount is allocated to that obligation and the remainder
stays outstanding.

## BR-ALLOC-005 --- Multiple Obligation Allocation

If a payment exceeds one eligible obligation, the remainder may continue
to the next eligible obligation according to FIFO.

## BR-ALLOC-006 --- Allocation Cannot Exceed Payment

Total allocation from a payment cannot exceed the authoritative payment
amount.

## BR-ALLOC-007 --- Allocation Cannot Exceed Eligible Outstanding

An allocation cannot exceed the remaining eligible outstanding amount of
the target obligation.

## BR-ALLOC-008 --- No Arbitrary Client Allocation

The client may request a workflow but cannot dictate an authoritative
allocation that conflicts with server-side rules.

------------------------------------------------------------------------

# 8. Overpayment Rules

## BR-OVERPAY-001 --- Detect Excess

If payment amount exceeds the eligible outstanding amount, the system
must explicitly identify the excess.

## BR-OVERPAY-002 --- No Silent Future Prepayment

Excess amount must not silently become future-month prepayment.
In v1, no automatic future-month prepayment is permitted unless a future
version explicitly introduces and approves such a workflow.

## BR-OVERPAY-003 --- Additional Donation Classification

Where business rules classify excess as an additional donation, the
resulting record must be represented distinctly enough for reporting and
audit.

## BR-OVERPAY-004 --- Finance Review

Any ambiguous overpayment case must be resolved through the authorized
financial workflow rather than guessed by the client.

------------------------------------------------------------------------

# 9. Future-Month Rules

## BR-FUTURE-001 --- Explicit Policy

Future-month donation behavior must follow the approved organization
policy.

## BR-FUTURE-002 --- No Client Bypass

A client cannot bypass future-month restrictions by changing month
identifiers, dates, request payloads, or UI state.

## BR-FUTURE-003 --- Historical Consistency

Future-month transactions, if permitted, must remain distinguishable
from current-month obligation settlement.

## BR-FUTURE-004 --- V1 Policy

V1 does not permit automatic future-month prepayment. Eligible recurring obligations are settled by FIFO and any remaining excess follows the approved overpayment/additional-donation rules.

------------------------------------------------------------------------

# 10. Additional Donations

## BR-ADDITIONAL-001 --- Separate Classification

An additional donation must be distinguishable from ordinary recurring
obligation settlement.

## BR-ADDITIONAL-002 --- Reporting

Additional donations must appear correctly in authorized donation and
financial reports.

## BR-ADDITIONAL-003 --- Authorization

Creating or recording an additional donation follows the role/permission
matrix.

------------------------------------------------------------------------

# 11. Anonymous Donations

## BR-ANON-001 --- Supported

The system supports anonymous donation intake.

## BR-ANON-002 --- Privacy

Anonymous status must prevent unauthorized users from discovering donor
identity.

## BR-ANON-003 --- Authorized Finance Access

Authorized financial/oversight workflows may access information required
for reconciliation where permitted.

## BR-ANON-004 --- Reporting

Reports must respect the anonymity requirement while still representing
the financial transaction accurately.

------------------------------------------------------------------------

# 12. Jummah Cash Rules

## BR-JUMMAH-001 --- Supported Intake

Jummah cash is a supported donation intake type.

## BR-JUMMAH-002 --- Authorized Recording

Cash entries must be recorded by an authorized workflow.

## BR-JUMMAH-003 --- Auditability

Cash records must remain traceable and auditable.

## BR-JUMMAH-004 --- Financial Reporting

Jummah cash must be represented correctly in applicable financial
reports.

------------------------------------------------------------------------

# 13. Combined Outstanding Payment

## BR-COMBINE-001 --- Eligible Outstanding Items

A combined payment may cover multiple eligible outstanding obligations.

## BR-COMBINE-002 --- Server Calculation

The server/trusted operation calculates the authoritative outstanding
amount.

## BR-COMBINE-003 --- Atomicity

Combined outstanding payment processing must be atomic.

## BR-COMBINE-004 --- Idempotency

Retrying the same combined-payment operation must not create duplicate
financial effects.

## BR-COMBINE-005 --- FIFO

Where applicable, allocation within the combined payment follows the
approved FIFO rules.

------------------------------------------------------------------------

# 14. Finance Account Rules

## BR-FINANCE-001 --- Account Ownership

Each financial account must have an authoritative identity and defined
operational purpose.

## BR-FINANCE-002 --- Account Balance

Account balances must derive from authoritative transactions rather than
client-maintained totals.

## BR-FINANCE-003 --- Transfer Balance

A transfer must preserve source/destination financial consistency.

## BR-FINANCE-004 --- Atomic Transfer

A transfer affecting multiple records must be atomic.

## BR-FINANCE-005 --- No Partial Transfer

The system must not leave only one side of a transfer committed as
successful.

------------------------------------------------------------------------

# 15. Expense Rules

## BR-EXPENSE-001 --- Authorized Creation

Only authorized users may create expenses.

## BR-EXPENSE-002 --- Required Context

An expense must contain the minimum required business information
defined by the final schema.

## BR-EXPENSE-003 --- Proof

Where proof is required, it must use protected storage.

## BR-EXPENSE-004 --- Approval

If an expense requires approval, approval is an explicit
permission/workflow and cannot be inferred from UI state.

## BR-EXPENSE-005 --- Atomic Posting

Final financial posting must be atomic with all required financial
records.

------------------------------------------------------------------------

# 16. Correction Rules

## BR-CORRECTION-001 --- Controlled Correction

Financial corrections are controlled operations, not ordinary record
edits.

## BR-CORRECTION-002 --- Preserve History

A correction must preserve sufficient history to reconstruct what
changed.

## BR-CORRECTION-003 --- Authorization

Only explicitly authorized roles may perform corrections.

## BR-CORRECTION-004 --- Audit

Corrections must be auditable.

------------------------------------------------------------------------

# 17. Cancellation Rules

## BR-CANCEL-001 --- Explicit Cancellation

Cancellation is an explicit state transition.

## BR-CANCEL-002 --- No Silent Deletion

A financial record must not be silently deleted when cancellation is the
correct business action.

## BR-CANCEL-003 --- Authorization

Cancellation requires explicit permission.

## BR-CANCEL-004 --- Audit

Cancellation must be auditable with appropriate actor, timestamp,
reason, and operation reference.

------------------------------------------------------------------------

# 18. Committee Rules

## BR-COMMITTEE-001 --- Task Ownership

Tasks may be assigned to authorized committee users.

## BR-COMMITTEE-002 --- Assignment Scope

Committee members may access assigned workflows according to their
permissions.

## BR-COMMITTEE-003 --- Task History

Important task status changes should preserve relevant history.

## BR-COMMITTEE-004 --- Meetings

Meeting creation, modification, and attendance management require
appropriate permissions.

------------------------------------------------------------------------

# 19. Attendance Rules

## BR-ATTEND-001 --- Authorized Recording

Attendance can be recorded only by an authorized workflow.

## BR-ATTEND-002 --- Own Attendance

Where member self-attendance is supported, a member may submit only
their own attendance.

## BR-ATTEND-003 --- Duplicate Prevention

The system must prevent duplicate authoritative attendance for the same
defined attendance event/person combination.

## BR-ATTEND-004 --- Offline Operation ID

Offline attendance mutations must carry stable operation identifiers.

## BR-ATTEND-005 --- Safe Retry

Retrying an offline attendance submission must not create duplicate
attendance.

## BR-ATTEND-006 --- Server Revalidation

Offline records must be revalidated against current authorization and
applicable event rules during synchronization.

## BR-ATTEND-007 --- GPS Minimization

If GPS is required, collect only the location information necessary for
the approved attendance rule.

## BR-ATTEND-008 --- Synchronization Status

The user must be able to distinguish pending, synchronized, rejected,
and failed attendance submissions where applicable.

------------------------------------------------------------------------

# 20. Notification Rules

## BR-NOTIFY-001 --- Business Event Source

Notifications should originate from authoritative business events.

## BR-NOTIFY-002 --- Outbox Reliability

Where reliable delivery is required, the notification/outbox record must
be created reliably with the relevant business transaction.

## BR-NOTIFY-003 --- Delivery Decoupling

Push delivery failure must not roll back the underlying business
transaction.

## BR-NOTIFY-004 --- Duplicate Delivery

Retries must not create unintended duplicate business effects.

## BR-NOTIFY-005 --- Authorization

Users can only receive notifications they are authorized to receive.

------------------------------------------------------------------------

# 21. Audit Rules

## BR-AUDIT-001 --- Sensitive Mutations

Sensitive mutations require audit records where defined by the
architecture.

## BR-AUDIT-002 --- Actor

Audit records identify the acting user/service context.

## BR-AUDIT-003 --- Entity

Audit records identify the affected entity/resource.

## BR-AUDIT-004 --- Timestamp

Audit records contain an authoritative timestamp.

## BR-AUDIT-005 --- Context

Where required, audit records contain reason/context and
operation/idempotency references.

## BR-AUDIT-006 --- Protection

Ordinary application users cannot modify or delete audit records.

------------------------------------------------------------------------

# 22. Data Privacy Rules

## BR-PRIVACY-001 --- Least Privilege

Users receive only the data required for their role and workflow.

## BR-PRIVACY-002 --- Own Data

Members can access their own permitted information.

## BR-PRIVACY-003 --- Other Members

Access to other members' information requires explicit authorization.

## BR-PRIVACY-004 --- Financial Privacy

Donation and financial information is restricted to authorized scopes.

## BR-PRIVACY-005 --- Storage Privacy

Sensitive files require authorized storage access.

------------------------------------------------------------------------

# 23. Authorization Rules

## BR-AUTHZ-001 --- Backend Authority

Backend-controlled authorization is authoritative.

## BR-AUTHZ-002 --- RLS

Exposed database resources require appropriate RLS.

## BR-AUTHZ-003 --- Trusted Operations

Sensitive multi-record or financial operations use trusted boundaries.

## BR-AUTHZ-004 --- UI Is Not Security

Hiding or disabling an action does not authorize or secure it.

## BR-AUTHZ-005 --- Stale State

Cached role/permission state cannot be treated as proof of current
authorization for sensitive operations.

------------------------------------------------------------------------

# 24. Idempotency Rules

## BR-IDEMP-001 --- Stable Operation Identity

Retryable mutations must have a stable operation/idempotency reference
where needed.

## BR-IDEMP-002 --- Duplicate Prevention

The same logical operation must not produce multiple authoritative
effects.

## BR-IDEMP-003 --- Safe Retry

A client may retry after timeout without causing duplicate financial or
attendance state.

## BR-IDEMP-004 --- Audit Reference

Where applicable, the operation reference should be recorded in the
audit trail.

------------------------------------------------------------------------

# 25. Realtime Rules

## BR-REALTIME-001 --- Selective Realtime

Only useful and authorized data should be delivered through realtime
subscriptions.

## BR-REALTIME-002 --- PostgreSQL Authority

Realtime events do not become a second source of truth.

## BR-REALTIME-003 --- Reconciliation

Client state must reconcile with authoritative backend state.

## BR-REALTIME-004 --- Missed Events

The system must remain correct if an event is delayed or missed;
refetch/reconciliation must restore correct state.

------------------------------------------------------------------------

# 26. Offline Rules

## BR-OFFLINE-001 --- Approved Workflows Only

Only workflows explicitly designed for offline use may create offline
mutations.

## BR-OFFLINE-002 --- Local State Is Not Authority

Offline records remain pending until accepted by the authoritative
backend.

## BR-OFFLINE-003 --- Synchronization

Synchronization must revalidate authorization and business rules.

## BR-OFFLINE-004 --- Financial Restriction

Unrestricted offline financial editing is prohibited.

------------------------------------------------------------------------

# 27. Error Handling Rules

## BR-ERROR-001 --- No False Success

Failed operations must never be represented as successful authoritative
state.

## BR-ERROR-002 --- Authorization Failure

Unauthorized operations must return an authorization failure and must
not mutate protected state.

## BR-ERROR-003 --- Validation Failure

Invalid input must not create partial authoritative state.

## BR-ERROR-004 --- Transaction Failure

A failed atomic operation must not leave an inconsistent partial result.

------------------------------------------------------------------------

# 28. Localization Rules

## BR-I18N-001 --- Supported Languages

The planned supported languages are:

-   English
-   Hindi
-   Kannada
-   Urdu

## BR-I18N-002 --- Urdu RTL

Urdu interfaces must support RTL presentation.

## BR-I18N-003 --- Business Logic Independence

Localization must not change underlying business rules or financial
calculations.

------------------------------------------------------------------------

# 29. Business State Principles

For stateful entities:

1.  Every state must have an explicit meaning.
2.  Invalid state transitions must be rejected.
3.  Historical financial truth must be preserved.
4.  State changes that affect multiple records must be atomic where
    required.
5.  Repeated requests must be safe.
6.  Authorization must be checked at the time of mutation.

------------------------------------------------------------------------

# 30. Rule Precedence

When rules appear to conflict, use this precedence:

1.  Security and authorization
2.  Financial integrity
3.  Explicit approved business rule
4.  Data integrity constraints
5.  Product workflow behavior
6.  UI convenience

UI convenience must never override security, financial integrity, or
approved business rules.

------------------------------------------------------------------------

# 31. Remaining Business Decisions

The V1 business decisions required for implementation are closed by
`docs/V1_IMPLEMENTATION_DECISION_CLOSURE.md`.

Deferred non-blocking policy work:
- exact legal/organizational retention periods;
- formal external incident-notification obligations.

Attendance event identity, GPS policy, notification events, membership
lifecycle, and referral behavior are approved in the V1 implementation
baseline.

No developer may introduce different behavior without updating the
relevant specification first.

# 32. Business Rule Acceptance Criteria

This document is ready for implementation dependency when:

-   identity rules are defined
-   membership rules are defined
-   referral rules are defined
-   donation obligation rules are defined
-   payment rules are defined
-   allocation rules are defined
-   FIFO behavior is defined
-   partial payment behavior is defined
-   overpayment behavior is defined
-   future-month behavior is explicitly identified
-   additional/anonymous/Jummah donation rules are defined
-   finance rules are defined
-   correction/cancellation rules are defined
-   attendance rules are defined
-   offline rules are defined
-   notification rules are defined
-   audit rules are defined
-   privacy rules are defined
-   authorization/idempotency rules are defined
-   unresolved decisions are explicitly identified

------------------------------------------------------------------------

# 33. Dependencies

This document feeds:

-   `DATABASE_ARCHITECTURE.md`
-   `RLS_SECURITY_MODEL.md`
-   `AUTHENTICATION_ARCHITECTURE.md`
-   `API_DOMAIN_ARCHITECTURE.md`
-   `DONATION_FINANCE_SPEC.md`
-   `FINANCIAL_INTEGRITY_SPEC.md`
-   `USER_FLOWS.md`
-   `TESTING_STRATEGY.md`
-   `ERROR_HANDLING_SPEC.md`
-   `OFFLINE_SYNC_ARCHITECTURE.md`
-   `REALTIME_DATA_FLOW.md`

------------------------------------------------------------------------

# 34. Change Control

If implementation reveals a conflict with a business rule:

1.  Stop the affected workflow.
2.  Identify the rule conflict.
3.  Document the proposed change.
4.  Determine impact on finance, security, database, API, UI, and tests.
5.  Update the rule and dependent documents.
6.  Review and approve the change.
7.  Resume implementation.

Business behavior must not be changed silently through code.

------------------------------------------------------------------------

# 35. Status

**Current status: Business rules specification in progress.**

This document is the authoritative product-level reference for business
behavior until a later approved revision supersedes a specific rule.
