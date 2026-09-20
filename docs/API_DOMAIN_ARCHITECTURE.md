# Masjid-e-Mamoor --- API Domain Architecture

**Document Status:** Draft --- Architecture Review Required\
**Version:** 1.0\
**Phase:** Documentation-First / Pre-Development\
**Repository:** `MdShabazS/masjid-e-mamoor-2`

------------------------------------------------------------------------

## 1. Purpose

This document defines the application API and domain-operation
architecture for Masjid-e-Mamoor.

The API layer provides a stable contract between:

-   web application
-   mobile application
-   trusted server operations
-   PostgreSQL/Supabase
-   notification/outbox processing
-   offline synchronization

The API architecture must ensure that business rules, authorization,
validation, financial integrity, and idempotency are applied
consistently regardless of which client initiates the workflow.

------------------------------------------------------------------------

# 2. API Principles

## API-001 --- One Domain Contract

Web and mobile clients use the same domain concepts and business rules.

## API-002 --- Server Authority

The API validates and authorizes requests; the client cannot define
authoritative state.

## API-003 --- Authentication Context

Actor identity is derived from the authenticated session.

## API-004 --- Explicit Commands

Sensitive mutations should use explicit domain commands rather than
generic unrestricted CRUD.

## API-005 --- Queries Are Scoped

Read operations return only data within the caller's authorization
scope.

## API-006 --- Validation at Boundaries

Inputs are validated at the API boundary and again at trusted
persistence boundaries where required.

## API-007 --- Idempotent Mutations

Retryable mutations use stable operation/idempotency identifiers.

## API-008 --- Financial Atomicity

Financial commands execute through atomic trusted operations.

## API-009 --- Stable Errors

Clients receive structured, safe error categories rather than raw
database exceptions.

## API-010 --- No Client-to-Client Data Flow

Web and mobile clients do not directly synchronize with one another. The
backend is the shared authority.

------------------------------------------------------------------------

# 3. API Architecture

Conceptually:

``` text
Web
 |
 +------------------+
                    |
Mobile               |
 |                  |
 +---------> Domain/API Layer
                    |
          +---------+----------+
          |                    |
          v                    v
     Query services       Trusted commands
          |                    |
          +---------+----------+
                    |
                    v
              PostgreSQL
                    |
        +-----------+-----------+
        |                       |
        v                       v
   Realtime                 Outbox
```

------------------------------------------------------------------------

# 4. API Layers

The application should separate:

### 4.1 Transport Layer

Responsible for:

-   HTTP/request handling
-   authentication context
-   serialization
-   status mapping
-   request IDs

### 4.2 Validation Layer

Responsible for:

-   schema validation
-   input normalization
-   basic domain constraints

### 4.3 Authorization Layer

Responsible for:

-   permission evaluation
-   ownership checks
-   role/scope checks

### 4.4 Domain Layer

Responsible for:

-   business rules
-   workflow transitions
-   financial commands
-   domain invariants

### 4.5 Persistence Layer

Responsible for:

-   queries
-   transactions
-   database functions
-   constraints

The exact physical implementation may vary while preserving these
responsibilities.

------------------------------------------------------------------------

# 5. Query vs Command

The API should distinguish:

## Query

Reads authoritative state.

Examples:

``` text
getMember
getMyProfile
listMyDonations
getPayment
listPendingPayments
getFinanceAccounts
listTasks
getMeeting
listNotifications
```

## Command

Requests a state transition.

Examples:

``` text
submitPayment
verifyPayment
rejectPayment
allocatePayment
recordJummahCash
createExpense
approveExpense
transferFunds
correctFinancialRecord
recordAttendance
syncOfflineOperation
assignTask
markTaskComplete
```

Commands must be explicitly authorized and validated.

------------------------------------------------------------------------

# 6. Domain Modules

Recommended API/domain modules:

``` text
auth
users
members
referrals
donations
payments
finance
expenses
transfers
committee
meetings
attendance
notifications
reports
storage
audit
sync
configuration
```

Modules should reflect business boundaries rather than UI page names.

------------------------------------------------------------------------

# 7. Authentication API Boundary

Authentication is primarily handled by Supabase Auth.

The application domain API consumes authenticated context rather than
implementing a second password/session system.

Application-level endpoints/commands may include:

``` text
getCurrentApplicationUser
initializeApplicationUser
getCurrentAuthorization
```

Exact implementation depends on current Supabase/Next.js/Expo
integration.

------------------------------------------------------------------------

# 8. Current User Query

Conceptual operation:

``` text
getCurrentUser()
```

Returns only the current user's authorized application context.

Possible response:

``` text
{
  user,
  member,
  role,
  permissions,
  accountStatus
}
```

The exact response must not expose unnecessary internal authorization
data.

------------------------------------------------------------------------

# 9. Member Queries

Examples:

``` text
getMyProfile()
getMember(memberId)
listMembers(filters)
searchMembers(query)
```

Authorization is applied before returning data.

A Member may use only own-profile operations unless the role matrix
grants broader access.

------------------------------------------------------------------------

# 10. Member Commands

Examples:

``` text
updateMyProfile(input)
adminUpdateMember(memberId, input)
activateMember(memberId)
deactivateMember(memberId)
```

Administrative commands require explicit permission.

Member self-service must reject protected field changes.

------------------------------------------------------------------------

# 11. Referral Queries and Commands

Queries:

``` text
getReferral(referralId)
listAuthorizedReferrals(filters)
```

Commands:

``` text
createReferral(input)
registerViaReferral(input)
```

The authenticated actor/referrer identity must be derived from the
session where applicable.

------------------------------------------------------------------------

# 12. Donation Queries

Examples:

``` text
getMyDonationSummary()
listMyObligations(filters)
getDonationObligation(id)
getMyPaymentHistory(filters)
getPayment(id)
```

Financial data must be scoped to authorized ownership/role.

------------------------------------------------------------------------

# 13. Donation Obligation Commands

Ordinary clients should not directly mutate authoritative obligation
amounts.

Potential administrative commands:

``` text
createObligation(...)
adjustObligation(...)
closeObligation(...)
```

Exact commands depend on the finalized obligation lifecycle.

Historical values must remain reconstructable.

------------------------------------------------------------------------

# 14. Payment Submission Command

Conceptual contract:

``` text
submitPayment({
  amount,
  paymentMethod,
  targetContext,
  proofReference?,
  operationId
})
```

Server responsibilities:

1.  authenticate actor
2.  validate input
3.  authorize payment submission
4.  validate eligible target
5.  validate amount/business rules
6.  enforce idempotency
7.  create payment submission
8.  return authoritative result

The client does not set verification state.

------------------------------------------------------------------------

# 15. UPI Payment Flow API

UPI initiation may be client-facing, but authoritative payment
verification remains server/Finance controlled.

Conceptual flow:

``` text
client requests payment context
        |
        v
backend returns approved payment details
        |
        v
client launches UPI intent
        |
        v
user completes external payment
        |
        v
payment submission/proof
        |
        v
Finance verification
```

A UPI return/callback must not itself create verified financial state.

------------------------------------------------------------------------

# 16. Payment Proof API

Potential operations:

``` text
createPaymentProofUpload(...)
attachPaymentProof(...)
getPaymentProof(...)
```

Storage authorization must be enforced separately.

The API should return controlled references rather than unrestricted
private object URLs.

------------------------------------------------------------------------

# 17. Finance Payment Query

Examples:

``` text
listPendingPayments(filters)
getPaymentForVerification(paymentId)
getPaymentAllocations(paymentId)
```

These operations are restricted by financial authorization.

------------------------------------------------------------------------

# 18. Verify Payment Command

Conceptual contract:

``` text
verifyPayment({
  paymentId,
  operationId,
  decisionContext
})
```

Server workflow:

``` text
authenticate
   |
authorize
   |
lock/re-read payment
   |
validate current state
   |
verify
   |
FIFO allocation
   |
financial records
   |
audit
   |
commit
```

All required financial effects must be atomic.

------------------------------------------------------------------------

# 19. Reject Payment Command

Conceptual contract:

``` text
rejectPayment({
  paymentId,
  reason,
  operationId
})
```

Server validates:

-   actor permission
-   current payment state
-   required reason
-   idempotency

Exact rejected-payment resubmission semantics remain an open decision.

------------------------------------------------------------------------

# 20. FIFO Allocation Command

Allocation should normally be internal to the authoritative financial
operation rather than a freely callable client command.

Conceptually:

``` text
allocateVerifiedPayment(paymentId)
```

If exposed internally, it must:

-   authenticate trusted context
-   authorize operation
-   calculate eligible outstanding
-   order deterministically
-   allocate FIFO
-   enforce amount constraints
-   commit atomically
-   audit

------------------------------------------------------------------------

# 21. Combined Payment Command

Conceptual contract:

``` text
createCombinedPayment({
  selectedOutstandingContext,
  amount,
  paymentMethod,
  operationId
})
```

The server must calculate authoritative eligible outstanding values.

The client-selected list is a request, not final allocation authority.

------------------------------------------------------------------------

# 22. Overpayment API Behavior

When submitted amount exceeds eligible outstanding:

1.  server calculates eligible amount
2.  excess is identified
3.  approved overpayment policy is applied
4.  response clearly identifies the result

No future-month allocation should be silently inferred.

------------------------------------------------------------------------

# 23. Additional Donation API

Potential command:

``` text
submitAdditionalDonation({
  amount,
  paymentMethod,
  anonymity,
  operationId
})
```

The resulting financial classification must remain distinguishable from
recurring obligation settlement.

------------------------------------------------------------------------

# 24. Anonymous Donation API

Anonymous state must be a controlled business field.

The API must prevent unauthorized callers from using another donor's
identity or exposing anonymous donor identity.

Reports and responses must apply the appropriate privacy scope.

------------------------------------------------------------------------

# 25. Jummah Cash Command

Conceptual contract:

``` text
recordJummahCash({
  eventDate,
  amount,
  accountId,
  reference,
  operationId
})
```

The server validates:

-   permission
-   amount
-   account
-   date/business rules
-   idempotency
-   financial transaction boundary

------------------------------------------------------------------------

# 26. Finance Account Queries

Examples:

``` text
listFinanceAccounts()
getFinanceAccount(id)
getAccountSummary(id, filters)
```

Balances should come from authoritative financial state.

------------------------------------------------------------------------

# 27. Transfer Command

Conceptual contract:

``` text
transferFunds({
  sourceAccountId,
  destinationAccountId,
  amount,
  reason,
  operationId
})
```

Server:

1.  authorize
2.  validate accounts
3.  validate amount
4.  validate current financial state
5.  create transfer
6.  create financial effects
7.  audit
8.  commit atomically

------------------------------------------------------------------------

# 28. Expense Commands

Potential commands:

``` text
createExpense(input)
submitExpenseForApproval(expenseId)
approveExpense(expenseId)
rejectExpense(expenseId)
cancelExpense(expenseId)
```

Exact workflow depends on final finance approval rules.

------------------------------------------------------------------------

# 29. Financial Correction Command

Conceptual:

``` text
createFinancialCorrection({
  targetId,
  reason,
  correctionData,
  operationId
})
```

The server must preserve the original history and create an auditable
corrective operation.

------------------------------------------------------------------------

# 30. Cancellation/Reversal Command

Conceptual:

``` text
reverseFinancialOperation({
  targetId,
  reason,
  operationId
})
```

The command must verify that the target is eligible for reversal.

It must not delete the historical original.

------------------------------------------------------------------------

# 31. Committee Task Queries

Examples:

``` text
listMyTasks(filters)
getTask(id)
listCommitteeTasks(filters)
```

Results are scoped to assignment/permission.

------------------------------------------------------------------------

# 32. Committee Task Commands

Examples:

``` text
createTask(input)
assignTask(taskId, assigneeId)
updateTask(taskId, input)
completeTask(taskId)
reopenTask(taskId)
```

Assignment must be authorized.

------------------------------------------------------------------------

# 33. Meeting Queries

Examples:

``` text
listMeetings(filters)
getMeeting(id)
getMeetingAttendance(meetingId)
```

------------------------------------------------------------------------

# 34. Meeting Commands

Examples:

``` text
createMeeting(input)
updateMeeting(id, input)
cancelMeeting(id)
recordMeetingAttendance(input)
```

------------------------------------------------------------------------

# 35. Attendance Query API

Examples:

``` text
getAttendanceEvent(eventId)
getMyAttendance(eventId)
listAttendance(eventId, filters)
```

Sensitive location information must not be returned unless explicitly
authorized.

------------------------------------------------------------------------

# 36. Attendance Command

Conceptual:

``` text
recordAttendance({
  eventId,
  memberId?,
  locationEvidence?,
  source,
  operationId
})
```

For self-attendance, the member identity should be derived from the
authenticated context.

------------------------------------------------------------------------

# 37. Offline Sync Command

Conceptual:

``` text
syncOfflineOperation({
  operationId,
  operationType,
  payload,
  clientCreatedAt
})
```

Server:

1.  authenticate
2.  identify actor
3.  check existing operation
4.  validate payload
5.  reauthorize
6.  revalidate current business state
7.  execute
8.  persist result
9.  return deterministic outcome

------------------------------------------------------------------------

# 38. Sync Response Contract

Conceptual response:

``` text
{
  operationId,
  status,
  result,
  serverProcessedAt,
  errorCode?,
  retryable?
}
```

The client must not infer authoritative success from a network-level 200
alone.

------------------------------------------------------------------------

# 39. Notification Queries

Examples:

``` text
listMyNotifications(filters)
getNotification(id)
getUnreadNotificationCount()
```

Users can only query notifications within their authorization scope.

------------------------------------------------------------------------

# 40. Notification Commands

Examples:

``` text
markNotificationRead(id)
markAllNotificationsRead()
```

System-generated notifications should use trusted outbox processing.

------------------------------------------------------------------------

# 41. Report API

Reports are query-oriented.

Examples:

``` text
getDonationReport(filters)
getFinancialReport(filters)
getAttendanceReport(filters)
getCommitteeReport(filters)
```

The API must apply authorization before report generation.

------------------------------------------------------------------------

# 42. Report Export

Conceptual:

``` text
exportReport({
  reportType,
  filters,
  format
})
```

Export permissions must match report permissions.

A user must not gain additional fields merely by selecting CSV/PDF.

------------------------------------------------------------------------

# 43. Storage API

Potential operations:

``` text
requestUpload(...)
completeUpload(...)
getProtectedFile(...)
deletePermittedFile(...)
```

File authorization must be tied to the owning business record.

------------------------------------------------------------------------

# 44. Audit Query API

Potential:

``` text
listAuditEvents(filters)
getAuditEvent(id)
```

Access is restricted to authorized oversight/admin roles.

Audit records are not client-writable.

------------------------------------------------------------------------

# 45. Authorization Evaluation

Each protected command follows:

``` text
authenticated?
     |
     v
application user?
     |
     v
account active?
     |
     v
permission?
     |
     v
resource scope?
     |
     v
business rule?
     |
     v
execute
```

Failure at any required step prevents mutation.

------------------------------------------------------------------------

# 46. Validation Architecture

Use shared schemas where practical.

Approved direction includes:

-   Zod
-   shared validation package
-   domain-specific validators

Validation should be reused across web/mobile for user experience, but
the server remains authoritative.

------------------------------------------------------------------------

# 47. Request Validation

Validate:

-   required fields
-   types
-   formats
-   ranges
-   enum values
-   string lengths
-   identifiers
-   nested structures
-   operation IDs

Do not accept arbitrary objects and pass them directly to database
operations.

------------------------------------------------------------------------

# 48. Financial Amount Validation

Financial APIs must validate exact monetary representation.

Avoid floating-point parsing for authoritative monetary calculations.

Validate:

-   positive/non-negative constraints
-   supported precision
-   business limits
-   account constraints
-   applicable obligation state

------------------------------------------------------------------------

# 49. Date Validation

Date fields must distinguish:

-   date-only business dates
-   month periods
-   timestamps
-   client event timestamps
-   server processing timestamps

Financial/monthly business logic must not rely on ambiguous
browser-local date strings.

------------------------------------------------------------------------

# 50. Pagination

List APIs should support controlled pagination.

Potential patterns:

``` text
cursor
limit
filters
sort
```

Pagination must:

-   remain authorization-scoped
-   have bounded page size
-   use stable ordering
-   avoid exposing arbitrary database internals

------------------------------------------------------------------------

# 51. Filtering

Filters should be explicitly supported.

Example:

``` text
status
date range
member
category
assigned user
```

The API must not convert arbitrary client query strings into
unrestricted SQL.

------------------------------------------------------------------------

# 52. Sorting

Only approved sortable fields should be accepted.

Example:

``` text
sort=created_at
sort=effective_month
```

Do not allow arbitrary column-name injection.

------------------------------------------------------------------------

# 53. Search

Search APIs should define:

-   searchable fields
-   normalization
-   minimum query length where appropriate
-   authorization scope
-   pagination
-   rate limits if needed

Search must not bypass RLS.

------------------------------------------------------------------------

# 54. Error Contract

The API should return structured errors.

Conceptual:

``` text
{
  code,
  message,
  requestId,
  details?
}
```

`details` must not expose secrets or raw database internals.

------------------------------------------------------------------------

# 55. Error Categories

Recommended categories:

``` text
AUTHENTICATION_REQUIRED
AUTHORIZATION_DENIED
VALIDATION_ERROR
NOT_FOUND
CONFLICT
INVALID_STATE
IDEMPOTENCY_REPLAY
RATE_LIMITED
TEMPORARY_UNAVAILABLE
STORAGE_ERROR
INTERNAL_ERROR
```

Domain-specific codes may be added.

------------------------------------------------------------------------

# 56. HTTP Status Mapping

The final transport layer may map errors approximately as:

  Category                    Typical HTTP status
  ------------------------- ---------------------
  Authentication required                     401
  Authorization denied                        403
  Not found                                   404
  Validation                              400/422
  Conflict                                    409
  Rate limited                                429
  Temporary unavailable                       503
  Internal error                              500

The exact framework implementation is not prescribed here.

------------------------------------------------------------------------

# 57. No Raw Database Errors

The API must not expose:

-   SQL statements
-   database credentials
-   internal schema details
-   stack traces
-   service-role information
-   sensitive policy logic

Operational logs may retain diagnostic information under controlled
access.

------------------------------------------------------------------------

# 58. Request Correlation

Each API request should have a request/correlation identifier where
practical.

This supports:

-   debugging
-   audit linkage
-   support
-   observability
-   tracing

For mutations, operation ID and request ID may both exist.

------------------------------------------------------------------------

# 59. Idempotency Contract

Retryable mutation APIs should accept a stable operation identifier.

Example:

``` text
Idempotency-Key: <stable-operation-id>
```

or an equivalent request field.

The exact transport mechanism must be standardized.

------------------------------------------------------------------------

# 60. Idempotency Response

A repeated request with the same valid operation identity should return
the existing authoritative result where appropriate.

The response should distinguish:

-   newly processed
-   already processed
-   rejected

without executing the business operation twice.

------------------------------------------------------------------------

# 61. Concurrency Control

Sensitive commands must re-read authoritative state before commit.

Examples:

-   payment verification
-   allocation
-   transfers
-   expense posting
-   attendance uniqueness

Optimistic or database-locking strategies may be used depending on the
operation.

------------------------------------------------------------------------

# 62. Transaction Boundaries

API commands must map clearly to transaction boundaries.

Example:

``` text
verifyPayment()
    |
    +-- payment state
    +-- allocations
    +-- financial transaction(s)
    +-- audit
    +-- outbox if required
```

All required atomic effects belong in one authoritative transaction
where the business rule requires atomicity.

------------------------------------------------------------------------

# 63. Trusted Command Pattern

Recommended conceptual pattern:

``` text
command(input)
   |
   v
authenticate
   |
   v
authorize
   |
   v
validate
   |
   v
load current state
   |
   v
apply business rules
   |
   v
transaction
   |
   v
audit/outbox
   |
   v
response
```

------------------------------------------------------------------------

# 64. Query Pattern

Recommended:

``` text
query(input)
   |
   v
authenticate
   |
   v
authorize
   |
   v
apply scoped filters
   |
   v
database query
   |
   v
safe response
```

Queries should not expose internal rows merely because a user can guess
an ID.

------------------------------------------------------------------------

# 65. API and RLS

The API layer and RLS are complementary.

API authorization handles domain intent.

RLS protects database access.

Neither should be treated as the sole security layer for sensitive
operations.

------------------------------------------------------------------------

# 66. Direct Supabase Client Reads

Direct Supabase client reads may be used where:

-   RLS is sufficient
-   query is simple
-   data exposure is well understood
-   no sensitive server-side aggregation is required

Domain APIs are preferable for complex business workflows.

------------------------------------------------------------------------

# 67. Direct Supabase Client Writes

Direct writes should be limited.

Do not expose direct client writes for:

-   payment verification
-   allocation
-   transfers
-   financial corrections
-   role changes
-   audit records
-   other high-risk operations

Use trusted operations.

------------------------------------------------------------------------

# 68. API and Realtime

Successful commands may trigger:

-   database changes
-   realtime propagation
-   notification outbox events

Clients should reconcile through authoritative queries after important
commands.

------------------------------------------------------------------------

# 69. API and Offline Sync

Offline-capable commands must be designed for:

-   stable operation ID
-   retries
-   duplicate detection
-   stale state
-   authorization changes
-   deterministic outcomes

Not every normal online API endpoint automatically becomes
offline-capable.

------------------------------------------------------------------------

# 70. API Versioning

The application should avoid unnecessary version proliferation during
early development.

If breaking contracts are introduced, they must be documented.

Shared packages should help keep web/mobile contracts aligned.

------------------------------------------------------------------------

# 71. Domain DTOs

Transport DTOs should be deliberately defined.

Do not expose raw database rows as the permanent public domain contract.

DTOs can:

-   hide internal fields
-   rename implementation details
-   combine authorized information
-   normalize dates
-   provide stable client contracts

------------------------------------------------------------------------

# 72. Shared Types

The repository should centralize reusable types in:

``` text
packages/types
packages/validation
packages/api-client
```

But shared types do not replace server-side validation.

------------------------------------------------------------------------

# 73. Web API Client

The web application should consume domain operations through a
consistent client abstraction.

Avoid scattering:

``` text
supabase.from(...)
```

through every UI component for complex workflows.

------------------------------------------------------------------------

# 74. Mobile API Client

Mobile should consume the same domain contracts.

The mobile client should not implement a separate version of financial
business logic.

------------------------------------------------------------------------

# 75. Domain Ownership

Each API/domain module should have clear ownership.

Example:

``` text
donations
    -> obligations
    -> payments
    -> allocations

finance
    -> accounts
    -> transactions
    -> transfers
    -> expenses

committee
    -> tasks
    -> meetings
    -> attendance
```

Cross-domain operations must have an explicit transaction owner.

------------------------------------------------------------------------

# 76. Cross-Domain Example

Payment verification may touch:

``` text
payments
allocations
donation obligations
finance transactions
audit
notifications/outbox
```

The command should have one authoritative orchestration boundary rather
than independent client mutations.

------------------------------------------------------------------------

# 77. Financial Command Catalogue

Initial catalogue:

``` text
submitPayment
verifyPayment
rejectPayment
recordJummahCash
submitAdditionalDonation
createCombinedPayment
transferFunds
createExpense
approveExpense
rejectExpense
createFinancialCorrection
reverseFinancialOperation
```

Exact names may be adjusted during implementation.

------------------------------------------------------------------------

# 78. Membership Command Catalogue

Initial catalogue:

``` text
registerMember
updateOwnProfile
adminUpdateMember
activateMember
deactivateMember
createReferral
```

Exact lifecycle commands depend on final membership rules.

------------------------------------------------------------------------

# 79. Committee Command Catalogue

Initial catalogue:

``` text
createTask
assignTask
updateTask
completeTask
reopenTask
createMeeting
updateMeeting
cancelMeeting
recordMeetingAttendance
```

------------------------------------------------------------------------

# 80. Attendance Command Catalogue

Initial catalogue:

``` text
recordAttendance
syncOfflineOperation
```

Additional commands may be introduced if the product requires them.

------------------------------------------------------------------------

# 81. Notification Command Catalogue

Initial catalogue:

``` text
markNotificationRead
markAllNotificationsRead
```

System notification creation remains trusted/outbox controlled.

------------------------------------------------------------------------

# 82. Report Query Catalogue

Initial catalogue:

``` text
getDonationReport
getFinancialReport
getAttendanceReport
getCommitteeReport
```

Each report requires explicit authorization.

------------------------------------------------------------------------

# 83. API Security Tests

Test:

-   unauthenticated request
-   forged actor ID
-   forged member ID
-   forged role
-   forbidden command
-   unauthorized resource
-   invalid input
-   stale state
-   duplicate operation
-   concurrent operation
-   replayed operation
-   direct table mutation attempt
-   sensitive data leakage
-   report/export bypass
-   realtime/storage bypass

------------------------------------------------------------------------

# 84. API Contract Tests

Every important command should test:

1.  valid request
2.  invalid schema
3.  unauthorized actor
4.  invalid resource
5.  invalid current state
6.  duplicate operation
7.  concurrent request
8.  database failure
9.  safe error response
10. authoritative final state

------------------------------------------------------------------------

# 85. API Performance

The API should:

-   bound list queries
-   use indexes
-   avoid N+1 queries
-   paginate large datasets
-   avoid unnecessarily large payloads
-   avoid repeated authorization queries where safe
-   measure financial command latency
-   monitor error rates

Correctness takes precedence over premature optimization.

------------------------------------------------------------------------

# 86. API Observability

Track where useful:

-   request ID
-   operation ID
-   domain command
-   latency
-   result category
-   authorization denial category
-   retry/conflict rate
-   database failures

Do not log sensitive payloads indiscriminately.

------------------------------------------------------------------------

# 87. API Documentation

Each domain operation should document:

-   purpose
-   actor/permissions
-   input schema
-   output schema
-   validation
-   business rules
-   transaction boundary
-   idempotency
-   errors
-   audit effects
-   realtime effects
-   offline capability

------------------------------------------------------------------------

# 88. API Acceptance Criteria

The API architecture is implementation-ready when:

-   domain modules are defined
-   query/command distinction is defined
-   authentication context is defined
-   authorization boundary is defined
-   validation strategy is defined
-   error contract is defined
-   pagination/search are defined
-   idempotency is defined
-   concurrency is defined
-   financial transaction boundaries are defined
-   web/mobile shared contracts are defined
-   offline commands are defined
-   realtime relationship is defined
-   security tests are defined
-   observability requirements are defined

------------------------------------------------------------------------

# 89. Open API Decisions

  Decision                          Impact
  --------------------------------- ---------------------
  Exact transport architecture      Web/server/mobile
  Route vs RPC conventions          API implementation
  Exact DTO catalogue               Client contracts
  Error-code naming                 UX/testing
  Idempotency transport             Retry behavior
  Cursor/pagination standard        Queries
  Direct Supabase read boundaries   RLS/API
  Exact trusted function set        Security/finance
  Report export architecture        Reporting
  File upload flow                  Storage
  API rate limits                   Security/operations

------------------------------------------------------------------------

# 90. Implementation Order

1.  Finalize domain boundaries
2.  Finalize DTOs
3.  Finalize validation schemas
4.  Finalize error catalogue
5.  Implement query abstractions
6.  Implement trusted command boundaries
7.  Implement financial commands
8.  Implement membership commands
9.  Implement committee/attendance commands
10. Implement notification commands
11. Implement offline sync command
12. Implement report queries
13. Add contract tests
14. Add security tests
15. Add observability
16. Verify web/mobile interoperability

------------------------------------------------------------------------

# 91. Change Control

Any material API change must review:

-   product requirements
-   business rules
-   user flows
-   database architecture
-   RLS
-   authentication
-   realtime
-   offline sync
-   web/mobile clients
-   tests

API behavior must not diverge between web and mobile without an explicit
documented reason.

------------------------------------------------------------------------

# 92. Status

**Current status: API domain architecture generated for review.**

Exact transport, Supabase client usage, database functions, and SDK
implementation details must be finalized after verification against
current official platform documentation and the remaining architecture
specifications.
