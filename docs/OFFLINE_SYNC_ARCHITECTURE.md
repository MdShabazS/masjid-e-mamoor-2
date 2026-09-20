# Masjid-e-Mamoor --- Offline Sync Architecture

**Document Status:** Draft --- Architecture Review Required\
**Version:** 1.0\
**Phase:** Documentation-First / Pre-Development\
**Repository:** `MdShabazS/masjid-e-mamoor-2`

------------------------------------------------------------------------

## 1. Purpose

This document defines the offline-first architecture for workflows that
are explicitly approved to operate without a continuous network
connection.

The primary objective is safe operation during intermittent connectivity
while preserving:

-   authorization
-   data integrity
-   idempotency
-   auditability
-   financial safety
-   privacy
-   deterministic synchronization
-   recovery from retries and failures

Offline capability is not equivalent to allowing unrestricted local
modification.

------------------------------------------------------------------------

# 2. Offline Principles

## OFF-001 --- Offline Is a Controlled Capability

Only explicitly approved workflows may create offline mutations.

## OFF-002 --- Server Is Authoritative

Local device state is provisional until accepted by the authoritative
backend.

## OFF-003 --- No Offline Financial Authority

The client must not independently finalize authoritative financial state
while offline.

## OFF-004 --- Stable Operation Identity

Every offline mutation requires a stable operation identifier.

## OFF-005 --- Safe Retry

Retrying an offline operation must not create duplicate authoritative
effects.

## OFF-006 --- Revalidation

Every offline mutation must be revalidated when synchronized.

## OFF-007 --- Conflict Is Expected

The system must assume that server state may have changed while the
device was offline.

## OFF-008 --- Explicit Failure

A synchronization failure must be visible and recoverable rather than
silently discarded.

------------------------------------------------------------------------

# 3. Offline Capability Classification

Workflows are divided into three categories.

## Category A --- Fully Offline-Safe

These workflows can operate locally and synchronize later with
relatively low risk.

Examples may include:

-   viewing previously cached authorized information
-   drafting non-sensitive committee notes
-   approved attendance capture

## Category B --- Offline Capture, Server Finalization

The device can capture the request offline, but the server decides the
final result.

Primary example:

-   attendance submission

## Category C --- Online-Only

These operations require authoritative backend state at the time of
action.

Examples:

-   payment verification
-   FIFO financial allocation
-   account transfer
-   financial correction
-   role changes
-   permission changes
-   authoritative expense posting where current financial state is
    required

------------------------------------------------------------------------

# 4. Approved Offline Workflows

The initial architecture should prioritize offline support for:

1.  Attendance capture
2.  Approved committee/task notes where explicitly enabled
3.  Reading previously synchronized authorized data

The exact offline feature catalogue must be finalized before
implementation.

------------------------------------------------------------------------

# 5. Offline Attendance

Attendance is the primary planned offline mutation.

Conceptually:

``` text
User
 |
 v
Attendance UI
 |
 v
Local operation
 |
 v
Pending queue
 |
 | network unavailable
 |
 v
Device storage
 |
 | network restored
 v
Sync engine
 |
 v
Backend validation
 |
 v
Authoritative attendance
```

------------------------------------------------------------------------

# 6. Offline Attendance Preconditions

Before allowing offline attendance capture, the application should have
enough previously synchronized information to establish:

-   authenticated application context
-   eligible event information
-   participant context
-   required business configuration

The application must not fabricate an event merely because the device is
offline.

------------------------------------------------------------------------

# 7. Offline Operation Record

Each pending mutation should have a stable local record containing
conceptually:

  Field                       Purpose
  --------------------------- -------------------------------------------
  `operation_id`              Stable unique operation identity
  `operation_type`            Controlled operation
  `created_at`                Local creation time
  `payload`                   Validated operation data
  `status`                    Pending/syncing/succeeded/failed/rejected
  `attempt_count`             Retry count
  `last_attempt_at`           Last synchronization attempt
  `error_code`                Safe failure classification
  `server_result_reference`   Authoritative result reference

The exact storage format must be finalized during implementation.

------------------------------------------------------------------------

# 8. Operation ID

An operation ID must be generated once when the offline mutation is
created.

It must not change between retries.

Example:

``` text
offline attendance created
        |
        v
operation_id = OP-123
        |
        +--> retry 1: OP-123
        +--> retry 2: OP-123
        +--> retry 3: OP-123
```

The backend can therefore recognize repeated submissions of the same
logical operation.

------------------------------------------------------------------------

# 9. Operation Ownership

The synchronized operation must be associated with the authenticated
actor.

The client must not be able to claim another user's operation merely by
changing a user/member identifier.

Where appropriate, actor identity should be derived from the
authenticated session.

------------------------------------------------------------------------

# 10. Offline Local Storage

Offline data must use a deliberate persistence mechanism.

The final mobile implementation must select storage appropriate to:

-   Expo SDK 57 / React Native 0.86
-   offline data size
-   encryption/security needs
-   transaction behavior
-   query requirements
-   synchronization requirements

The project must not automatically place sensitive offline data in
unprotected plain key-value storage.

------------------------------------------------------------------------

# 11. Cached Read Data

Previously synchronized data may be cached for offline viewing where
approved.

Cached data must:

-   have an authorization scope
-   have a freshness/reconciliation strategy
-   not be treated as current authoritative state
-   be cleared/partitioned correctly on account changes

------------------------------------------------------------------------

# 12. Offline Authentication

Offline operation does not mean authentication can be bypassed.

The application must have an explicit policy for:

-   an existing valid session
-   expired session
-   device restart
-   long offline period
-   revoked account
-   account status changes while offline

Exact behavior depends on the final authentication/session
configuration.

------------------------------------------------------------------------

# 13. Offline Authorization

Authorization must be considered in two phases.

### Phase 1 --- Local UX

The device may use previously resolved permissions to determine whether
an offline feature should be available.

### Phase 2 --- Server Revalidation

When synchronized, the backend must determine whether the operation is
currently authorized.

The second phase is authoritative.

------------------------------------------------------------------------

# 14. Offline Queue

Conceptual queue:

``` text
pending operations
       |
       v
ordered sync queue
       |
       v
send operation
       |
       +--> success
       |
       +--> retryable failure
       |
       +--> permanent rejection
       |
       +--> conflict/reconciliation
```

The queue must persist across application restarts.

------------------------------------------------------------------------

# 15. Queue Ordering

Operations may require ordering.

Default strategy:

1.  Preserve creation order for operations within the same logical
    workflow.
2.  Respect explicit dependencies.
3.  Do not assume unrelated domains must execute sequentially.

Example:

``` text
create attendance
   |
   v
update attendance
```

The second operation cannot be processed successfully if the first
required record does not exist.

------------------------------------------------------------------------

# 16. Retry Strategy

Retryable failures may include:

-   temporary network failure
-   timeout
-   temporary backend unavailability
-   transient connection interruption

Retries should use controlled backoff.

Do not retry permanently rejected operations indefinitely.

------------------------------------------------------------------------

# 17. Retry Idempotency

A retry must reuse the original operation ID.

Correct:

``` text
OP-123
retry -> OP-123
retry -> OP-123
```

Incorrect:

``` text
OP-123
retry -> OP-124
retry -> OP-125
```

The second pattern can create duplicate authoritative effects.

------------------------------------------------------------------------

# 18. Server Processing Flow

When the backend receives an offline operation:

1.  Authenticate request.
2.  Identify actor.
3.  Validate operation ID.
4.  Check whether operation was already processed.
5.  Validate payload.
6.  Re-check current authorization.
7.  Re-check current business state.
8.  Execute approved transaction.
9.  Record result.
10. Return deterministic response.

------------------------------------------------------------------------

# 19. Already-Processed Operation

If the backend receives an operation ID that has already succeeded:

``` text
same operation ID
       |
       v
existing result
       |
       v
return previous authoritative result
```

Do not execute the business mutation a second time.

------------------------------------------------------------------------

# 20. Already-Rejected Operation

If an operation has already been permanently rejected, a retry should
return the existing rejection state rather than repeatedly creating new
failures.

The client should present an actionable result.

------------------------------------------------------------------------

# 21. Conflict Handling

A conflict occurs when local assumptions differ from current server
state.

Examples:

-   attendance event closed
-   user no longer authorized
-   member status changed
-   attendance already recorded
-   task was reassigned
-   referenced record was cancelled

The server must make the authoritative decision.

------------------------------------------------------------------------

# 22. Conflict Outcomes

Possible outcomes:

### Accepted

The operation is valid and committed.

### Already Applied

The logical operation already succeeded.

### Rejected

The operation is no longer valid.

### Requires Reconciliation

The operation cannot be safely resolved automatically.

The exact outcome model will be finalized during API design.

------------------------------------------------------------------------

# 23. Attendance Conflict Example

Offline device records:

``` text
Event: Jummah-2026-09-20
Member: M123
Operation: OP-123
```

While offline, the event becomes closed.

On synchronization:

``` text
OP-123
   |
   v
server checks event state
   |
   v
event closed
   |
   v
operation rejected
```

The local UI must show that the server rejected the operation.

It must not continue displaying the record as authoritative attendance.

------------------------------------------------------------------------

# 24. Duplicate Attendance Example

Offline device submits attendance.

The same logical attendance was already recorded by another authorized
workflow.

The backend must enforce the final uniqueness/business rule.

The result may be:

-   already recorded
-   accepted as same logical operation
-   rejected as duplicate

The client must reconcile accordingly.

------------------------------------------------------------------------

# 25. Offline GPS

GPS-based attendance requires special treatment.

If GPS is required:

1.  Location is collected according to the approved policy.
2.  Relevant location evidence is stored locally only as necessary.
3.  Operation is assigned an ID.
4.  Server revalidates event/user/location rules when synchronized.
5.  Location data follows privacy and retention policies.

A local GPS check must not be treated as final authority.

------------------------------------------------------------------------

# 26. Offline Financial Restrictions

The following must not be finalized offline:

-   payment verification
-   payment rejection affecting financial state
-   FIFO allocation
-   account transfer
-   expense posting requiring current balance
-   financial correction
-   financial reversal
-   role-based financial approval

A device may store a draft/payment-intent request where explicitly
supported, but final financial truth requires authoritative processing.

------------------------------------------------------------------------

# 27. Offline Donation Viewing

A member may be able to view previously synchronized donation
information.

The UI must indicate that:

-   data may be stale
-   the device is offline
-   current payment/outstanding status requires synchronization

The application must not present stale data as guaranteed current
financial truth.

------------------------------------------------------------------------

# 28. Offline Drafts

Where drafts are supported:

-   drafts are not authoritative records
-   drafts must be associated with the current local user context
-   drafts must not be exposed to another user on the same device
-   drafts should have clear expiration/cleanup behavior
-   submitting a draft online must use normal server validation

------------------------------------------------------------------------

# 29. Local Data Partitioning

Local data must be scoped by authenticated application identity.

Conceptually:

``` text
device
 |
 +--> User A local data
 |
 +--> User B local data
```

The implementation must prevent accidental cross-user cache/data
leakage.

Logout/account switch must clear or securely partition protected local
data.

------------------------------------------------------------------------

# 30. Multi-Account Device

If multiple accounts can use the same device:

-   each account's protected local state must be isolated
-   pending operations must retain their correct actor context
-   logout must not cause another user to inherit prior user data
-   synchronization must not submit one user's operation under another
    user's session

------------------------------------------------------------------------

# 31. Offline Notifications

Push/realtime notifications are not guaranteed while offline.

The application may show previously cached notifications.

When online:

-   notification state reconciles
-   new notifications become available
-   read state synchronizes
-   missed realtime events are recovered through query reconciliation

------------------------------------------------------------------------

# 32. Offline Realtime Relationship

Offline mode and realtime are complementary:

``` text
ONLINE
PostgreSQL <-> Realtime <-> Client

OFFLINE
PostgreSQL   X   Realtime
                |
                v
          Local cache/queue

ONLINE AGAIN
Local queue -> Backend
Backend -> PostgreSQL
PostgreSQL -> Realtime/query reconciliation
```

------------------------------------------------------------------------

# 33. Connectivity Detection

Connectivity status is a UX signal, not proof of backend availability.

A device may report network connectivity while:

-   DNS fails
-   Supabase is unreachable
-   authentication fails
-   a request times out

Therefore, actual request results remain authoritative.

------------------------------------------------------------------------

# 34. Sync Trigger

Synchronization may start when:

-   network becomes available
-   application returns to foreground
-   user manually requests sync
-   background execution is available and approved
-   a pending operation requires retry

The implementation must respect mobile operating-system background
execution limits.

------------------------------------------------------------------------

# 35. Manual Sync

A manual "Sync now" action may be provided.

It should:

1.  show current pending count
2.  start synchronization
3.  process eligible operations
4.  report success/failure/rejection
5.  reconcile authoritative data

Repeated manual sync must remain safe.

------------------------------------------------------------------------

# 36. Sync State

Recommended high-level state:

``` text
idle
checking
syncing
partially_synced
synced
failed
requires_attention
```

The exact state machine belongs in the implementation/API specification.

------------------------------------------------------------------------

# 37. Per-Operation State

Each operation should be distinguishable as:

``` text
pending
processing
succeeded
already_applied
retryable_failure
rejected
conflict
```

The exact names may be normalized later.

------------------------------------------------------------------------

# 38. Partial Sync

A queue may contain multiple operations.

Example:

``` text
OP-1 -> success
OP-2 -> retryable failure
OP-3 -> rejected
OP-4 -> success
```

The client must preserve the outcome of each operation independently.

A failure of one unrelated operation must not erase successful results.

------------------------------------------------------------------------

# 39. Dependency Failure

If operation B depends on operation A:

``` text
A -> failed
B -> blocked
```

The queue must not blindly submit B if doing so would create an invalid
request.

The dependency model should be explicit for workflows that need it.

------------------------------------------------------------------------

# 40. Sync Crash Recovery

If the app crashes during synchronization:

1.  Pending operations remain persisted.
2.  Processing state is recoverable.
3.  On next launch, ambiguous operations are retried using the same
    operation ID.
4.  Backend idempotency determines whether the operation already
    committed.
5.  Client reconciles the authoritative result.

------------------------------------------------------------------------

# 41. Device Restart

After restart:

-   queue remains available
-   operation IDs remain unchanged
-   authentication state follows the authentication policy
-   local protected data remains correctly partitioned
-   sync resumes only when the operation can be safely
    authenticated/authorized

------------------------------------------------------------------------

# 42. Clock Differences

Client timestamps are not authoritative.

The system must distinguish:

-   device-created time
-   server-received time
-   server-processed time

Business decisions should use server-authoritative time where required.

------------------------------------------------------------------------

# 43. Offline Date/Month Risks

Offline devices may have incorrect clocks or timezone state.

The client must not use an arbitrary local clock to redefine financial
obligation periods or authoritative business dates.

Server-side business-date rules remain authoritative.

------------------------------------------------------------------------

# 44. Offline Data Expiration

Cached data may become stale.

The implementation should define freshness policies for important data.

Examples:

-   member profile
-   donation outstanding
-   attendance event
-   committee task
-   notifications

Financial information should have a particularly clear stale-data
indication.

------------------------------------------------------------------------

# 45. Security of Offline Data

Offline storage should minimize sensitive data.

Requirements:

-   store only necessary fields
-   encrypt/protect sensitive local storage where appropriate
-   avoid storing secrets unnecessarily
-   clear data on logout/account removal where required
-   prevent cross-user leakage
-   avoid unrestricted database dumps on device

------------------------------------------------------------------------

# 46. Offline Storage Size

The mobile app should avoid caching unlimited historical data.

Use:

-   bounded history
-   pagination
-   cleanup policies
-   domain-specific retention

Financial history that must be displayed offline should be explicitly
scoped.

------------------------------------------------------------------------

# 47. Offline Attachments

Large file uploads should generally not be treated as ordinary offline
JSON mutations.

If offline attachment capture is later supported:

-   file remains local until upload
-   operation references local file
-   upload is retried safely
-   server verifies ownership
-   final business record is created only after successful authoritative
    processing

This is a future capability unless explicitly approved.

------------------------------------------------------------------------

# 48. Offline Queue Security

The queue itself is sensitive.

Do not allow arbitrary application components to enqueue unrestricted
operations.

Each operation type must have:

-   schema
-   validator
-   authorization expectation
-   server handler
-   idempotency behavior
-   result model

------------------------------------------------------------------------

# 49. Operation Schema Validation

Before an operation enters the queue:

1.  Validate required fields.
2.  Validate field types.
3.  Validate basic business constraints.
4.  Associate authenticated local context.
5.  Generate operation ID.
6.  Persist atomically.

Client validation improves UX but does not replace server validation.

------------------------------------------------------------------------

# 50. Server Operation Validation

When synchronized:

1.  Validate schema again.
2.  Authenticate actor.
3.  Resolve current authorization.
4.  Validate resource ownership.
5.  Validate current business state.
6.  Execute trusted operation.
7.  Record outcome.

Never trust an operation merely because it passed local validation.

------------------------------------------------------------------------

# 51. Offline API Contract

Each offline-capable operation should have an explicit API contract:

``` text
operation_id
operation_type
actor context
payload
client_created_at
```

Response:

``` text
operation_id
status
server_result
server_processed_at
error/rejection code if applicable
```

The exact API envelope belongs in `API_DOMAIN_ARCHITECTURE.md`.

------------------------------------------------------------------------

# 52. Sync Conflict UX

Users should understand whether an operation:

-   succeeded
-   was already applied
-   failed temporarily
-   was rejected
-   needs attention

Do not display technical stack traces as the primary user message.

------------------------------------------------------------------------

# 53. Retry UX

For retryable failures:

-   user may retry manually
-   automatic retry may occur according to backoff
-   pending state remains visible
-   retry count may be shown only where useful
-   permanent rejection must stop automatic retries

------------------------------------------------------------------------

# 54. Rejected Operation UX

When permanently rejected:

1.  Mark local operation rejected.
2.  Preserve safe reason/code.
3.  Explain the result in user-friendly terms.
4.  Do not keep retrying.
5.  Provide a recovery action if one exists.

------------------------------------------------------------------------

# 55. Sync Auditability

Where offline operations affect auditable workflows:

-   operation ID should be retained
-   actor identity should be recorded
-   server processing timestamp should be recorded
-   final result should be traceable
-   rejection/conflict should be observable where required

------------------------------------------------------------------------

# 56. Financial Idempotency Example

Never:

``` text
offline payment verification
     |
     v
retry with new request ID
     |
     v
second financial posting
```

Correct:

``` text
operation ID OP-100
     |
     +--> first request
     |
     +--> retry
     |
     +--> retry
     |
     v
one authoritative result
```

------------------------------------------------------------------------

# 57. Offline and RLS

RLS still applies during synchronization.

The fact that an operation was created earlier does not bypass current
RLS/trusted authorization.

The backend must process the operation under the current security model.

------------------------------------------------------------------------

# 58. Offline and Realtime

After synchronization:

1.  authoritative transaction commits
2.  realtime may propagate the resulting change
3.  local operation state is updated
4.  affected queries are invalidated/refetched
5.  UI reconciles

The local queue must not manually invent the final server state.

------------------------------------------------------------------------

# 59. Offline Testing Matrix

Test:

-   offline attendance creation
-   app restart with pending operation
-   network returns during sync
-   timeout during sync
-   duplicate sync
-   duplicate operation ID
-   server already processed
-   operation rejection
-   authorization revoked while offline
-   event closed while offline
-   duplicate attendance
-   concurrent attendance
-   incorrect device clock
-   user logout with pending operations
-   account switch
-   device restart
-   partial queue success
-   dependency failure
-   crash during synchronization

------------------------------------------------------------------------

# 60. Security Testing

Explicitly test that offline mode cannot:

-   bypass role restrictions
-   forge another member
-   forge another actor
-   submit another user's operation
-   bypass deactivation
-   bypass RLS
-   create financial authority
-   modify payment verification offline
-   manipulate operation IDs to duplicate effects
-   access another user's local cache

------------------------------------------------------------------------

# 61. Performance Testing

Test:

-   large pending queue
-   slow network
-   repeated reconnect
-   battery-constrained conditions
-   large cached dataset
-   repeated foreground/background transitions
-   concurrent synchronization and realtime reconciliation

------------------------------------------------------------------------

# 62. Data Recovery

If local storage becomes corrupted:

-   authoritative server data remains the recovery source
-   pending unsynchronized data may be unrecoverable depending on local
    storage guarantees
-   the UI must not claim successful synchronization without server
    confirmation
-   operational diagnostics should identify failed local queue recovery
    where possible

------------------------------------------------------------------------

# 63. Offline Feature Expansion Rule

A new offline-capable workflow must not be added casually.

Before enabling offline support, document:

1.  business safety
2.  authorization model
3.  local storage model
4.  operation schema
5.  idempotency
6.  conflict model
7.  retry strategy
8.  privacy implications
9.  server validation
10. tests
11. recovery behavior

------------------------------------------------------------------------

# 64. Recommended Initial Scope

For the first implementation, keep offline scope deliberately small:

### Supported

-   authorized cached reads
-   attendance capture
-   attendance synchronization
-   notification/read-state reconciliation where practical

### Not finalized for offline mutation

-   financial verification
-   financial allocation
-   transfers
-   corrections
-   role changes
-   permission changes
-   other high-risk administrative operations

This keeps offline complexity bounded while preserving the required
field-use case.

------------------------------------------------------------------------

# 65. Offline Acceptance Criteria

Offline architecture is implementation-ready when:

-   supported offline workflows are explicitly listed
-   prohibited offline workflows are explicit
-   local storage is selected
-   operation IDs are defined
-   queue states are defined
-   retry strategy is defined
-   conflict handling is defined
-   server revalidation is defined
-   offline authentication behavior is defined
-   local data isolation is defined
-   account-switch behavior is defined
-   crash recovery is defined
-   realtime reconciliation is defined
-   financial restrictions are defined
-   security tests are defined
-   recovery behavior is defined

------------------------------------------------------------------------

# 66. Open Offline Decisions

  Decision                              Impact
  ------------------------------------- ---------------------
  Exact mobile persistence technology   Storage
  Encryption strategy                   Security
  Offline authentication lifetime       Authentication
  Exact attendance offline scope        Product
  GPS evidence retention                Privacy
  Sync queue implementation             Mobile architecture
  Retry backoff values                  Reliability
  Conflict response contract            API
  Offline cache freshness               UX/data
  Attachment offline support            Storage
  Background sync scope                 Expo/OS limits

These decisions must be finalized before implementing the corresponding
offline infrastructure.

------------------------------------------------------------------------

# 67. Implementation Order

1.  Finalize offline feature catalogue
2.  Verify current Expo/React Native storage capabilities
3.  Define local storage schema
4.  Define operation envelopes
5.  Define operation validators
6.  Define sync queue
7.  Define backend idempotency
8.  Implement attendance offline capture
9.  Implement synchronization
10. Implement conflict/rejection handling
11. Implement realtime reconciliation
12. Add security/reliability tests
13. Add crash/restart tests
14. Review before expanding offline scope

------------------------------------------------------------------------

# 68. Change Control

Any new offline capability must update:

-   `BUSINESS_RULES.md`
-   `USER_FLOWS.md`
-   `DATABASE_ARCHITECTURE.md`
-   `RLS_SECURITY_MODEL.md`
-   `API_DOMAIN_ARCHITECTURE.md`
-   `REALTIME_DATA_FLOW.md`
-   `TESTING_STRATEGY.md`

Offline support must never be added merely by persisting an API request
locally.

------------------------------------------------------------------------

# 69. Status

**Current status: Offline synchronization architecture generated for
review.**

The first implementation should keep offline mutation scope deliberately
narrow and expand only after synchronization, security, idempotency, and
recovery behavior have been verified.
