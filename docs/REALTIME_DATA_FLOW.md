# Masjid-e-Mamoor --- Realtime Data Flow

**Document Status:** Draft --- Architecture Review Required\
**Version:** 1.0\
**Phase:** Documentation-First / Pre-Development\
**Repository:** `MdShabazS/masjid-e-mamoor-2`

------------------------------------------------------------------------

## 1. Purpose

This document defines how authoritative application changes propagate to
authorized web and mobile clients in Masjid-e-Mamoor.

The realtime architecture must support the single-deployment
requirement:

> All roles use the same authoritative backend and database, while each
> role sees only the data permitted to it.

Examples:

-   Finance verifies a payment.
-   The member's payment/outstanding view reflects the new authoritative
    state.
-   Authorized finance dashboards update.
-   Authorized administrative views update.
-   Unauthorized users receive no protected information.

Realtime is a propagation mechanism. PostgreSQL remains the source of
truth.

------------------------------------------------------------------------

# 2. Core Realtime Principles

## RT-001 --- PostgreSQL Is the Source of Truth

Realtime events never become the authoritative record.

## RT-002 --- Eventual UI Consistency

Clients may temporarily display stale state while an event is in
transit, but must reconcile with authoritative backend state.

## RT-003 --- Authorization Applies to Realtime

A user who cannot read a row through the approved data-access path must
not receive it through realtime.

## RT-004 --- No Security Through Channels

A client cannot gain access merely by subscribing to a channel or
guessing a topic.

## RT-005 --- Realtime Is Selective

Only domains that benefit from realtime should subscribe.

## RT-006 --- Missed Events Are Safe

A missed event must not permanently corrupt client state.

## RT-007 --- Duplicate Events Are Safe

Clients must tolerate duplicate or repeated events.

## RT-008 --- Reconnect Is Normal

Network interruption, browser sleep, mobile suspension, and server
reconnects are expected states.

------------------------------------------------------------------------

# 3. Realtime Architecture

Conceptually:

``` text
                  PostgreSQL
                      |
                      v
              Authoritative change
                      |
                      v
             Supabase Realtime
                      |
          +-----------+-----------+
          |                       |
          v                       v
       Web client             Mobile client
          |                       |
          +-----------+-----------+
                      |
                      v
              Query/cache layer
                      |
                      v
                UI state
```

The application should not build a second event-sourced database on the
client.

------------------------------------------------------------------------

# 4. Data Flow Categories

Realtime changes can be divided into:

### 4.1 Financial Changes

Examples:

-   payment status
-   allocation
-   outstanding state
-   account/transaction changes
-   expense state

### 4.2 Committee Changes

Examples:

-   task assignment
-   task status
-   meeting updates
-   attendance updates

### 4.3 Notification Changes

Examples:

-   new notification
-   read/unread state

### 4.4 Administrative Changes

Examples:

-   member status
-   role-related application state
-   authorized dashboard changes

### 4.5 Operational Changes

Examples:

-   synchronization result
-   processing state where useful

Not every database change requires a realtime subscription.

------------------------------------------------------------------------

# 5. Realtime Data Authority

The client follows this pattern:

``` text
event received
     |
     v
identify affected query/data
     |
     v
invalidate or reconcile cache
     |
     v
refetch authoritative state if required
     |
     v
render updated UI
```

A client should not blindly construct complex financial state solely
from event payloads when the authoritative query can be refetched.

------------------------------------------------------------------------

# 6. Initial Data Load

Realtime should normally not replace the initial query.

Recommended flow:

1.  Authenticate.
2.  Resolve application authorization.
3.  Fetch initial authoritative data.
4.  Establish appropriate realtime subscription.
5.  Reconcile any changes that occurred around subscription setup.

This reduces race conditions between initial fetch and subscription
establishment.

------------------------------------------------------------------------

# 7. Subscription Establishment Race

Potential race:

``` text
T1: client fetches data
T2: database changes
T3: realtime subscription starts
```

The client could miss the T2 event.

Therefore, the architecture must support reconciliation after
subscription establishment or use an ordering strategy that makes the
race safe.

The exact implementation should follow current Supabase Realtime
guidance.

------------------------------------------------------------------------

# 8. Subscription Scope

Subscriptions must be as narrow as practical.

Examples:

-   member subscribes to their own permitted payment-related changes
-   Finance subscribes to authorized finance workflows
-   committee member subscribes to assigned task changes
-   user subscribes to their own notifications

Avoid broad organization-wide subscriptions when narrower scopes are
possible.

------------------------------------------------------------------------

# 9. Member Realtime Scope

A Member may receive realtime updates relevant to their own authorized
data.

Potential domains:

-   own payment status
-   own donation allocation/outstanding changes
-   own notifications
-   own attendance status
-   assigned committee information where applicable

A Member must not receive another member's private changes.

------------------------------------------------------------------------

# 10. Finance Realtime Scope

Finance users may receive authorized changes for financial workflows
such as:

-   pending payment submissions
-   verification state changes
-   allocation results
-   authorized account/transaction changes
-   expenses
-   transfers
-   reconciliation-related state

Exact subscriptions must follow the permission matrix.

------------------------------------------------------------------------

# 11. Auditor Realtime Scope

Auditor realtime access should remain limited to approved oversight
information.

Realtime access must not imply mutation permission.

If audit information does not need realtime delivery, ordinary
authorized queries may be preferable.

------------------------------------------------------------------------

# 12. Committee Member Realtime Scope

Committee members may receive updates relevant to:

-   assigned tasks
-   task status
-   relevant meetings
-   relevant attendance

A committee member must not receive unrelated administrative or
financial realtime data.

------------------------------------------------------------------------

# 13. President / Super Admin Scope

The highest administrative role may have broader realtime visibility
according to the role matrix.

Even this role must follow:

-   authorization
-   data minimization
-   financial integrity
-   audit requirements

Super Admin does not mean unrestricted event-stream access.

------------------------------------------------------------------------

# 14. Vice President Scope

Realtime access follows the approved role/permission matrix.

No realtime subscription should be granted merely because the user holds
an elevated title.

------------------------------------------------------------------------

# 15. Secretary Scope

Realtime access follows the approved role/permission matrix and should
focus on authorized administrative/committee workflows.

------------------------------------------------------------------------

# 16. Payment Realtime Flow

Example:

``` text
Member submits payment
        |
        v
Payment record created
        |
        v
Finance sees pending item
        |
        v
Finance verifies
        |
        v
Trusted financial operation
        |
        +--> payment state
        +--> allocation
        +--> audit
        |
        v
Realtime propagation
        |
        +--> Member UI
        +--> Finance UI
        +--> authorized administrative UI
```

The exact database transaction is defined in the financial-integrity
specification.

------------------------------------------------------------------------

# 17. Outstanding Amount Realtime Flow

The authoritative outstanding amount is derived from financial state.

When a verified allocation changes outstanding state:

1.  Financial transaction commits.
2.  Relevant database state changes.
3.  Realtime event becomes available.
4.  Authorized client invalidates relevant outstanding query.
5.  Client refetches authoritative outstanding state.
6.  UI displays updated result.

Do not let the client permanently derive the new balance from an event
payload alone if authoritative refetch is required.

------------------------------------------------------------------------

# 18. Combined Payment Realtime Flow

For a combined payment:

``` text
payment verification
       |
       v
FIFO allocation
       |
       v
transaction commit
       |
       v
realtime events
       |
       v
authorized clients
       |
       v
query reconciliation
```

Clients must not render intermediate financial states as if the combined
operation were already complete unless the authoritative transaction has
committed.

------------------------------------------------------------------------

# 19. Finance Dashboard Realtime Flow

A Finance dashboard may contain:

-   pending payment count
-   recent verified payments
-   expense states
-   account/transaction summaries
-   transfer states

Realtime updates should invalidate or reconcile affected queries rather
than maintain an independent financial ledger in React state.

------------------------------------------------------------------------

# 20. Member Dashboard Realtime Flow

Member dashboard may update:

-   outstanding amount
-   payment state
-   recent donation status
-   notifications
-   attendance state

The member dashboard must remain within own-data authorization scope.

------------------------------------------------------------------------

# 21. Committee Dashboard Realtime Flow

Committee dashboard may update:

-   assigned task status
-   meeting updates
-   attendance updates
-   notifications

Only authorized records should enter the client's cache.

------------------------------------------------------------------------

# 22. Notification Realtime Flow

Conceptually:

``` text
business transaction
       |
       v
outbox event
       |
       v
notification record
       |
       v
realtime notification event
       |
       v
recipient client
```

Realtime notification delivery is separate from push notification
delivery.

A notification must not be lost merely because a realtime client was
offline.

------------------------------------------------------------------------

# 23. Push + Realtime

Realtime and push serve different purposes.

### Realtime

Useful when the application is actively connected.

### Push

Useful when the application is backgrounded or closed and the user needs
an external notification.

The underlying notification event remains authoritative.

------------------------------------------------------------------------

# 24. Realtime and Offline Clients

An offline client cannot depend on realtime.

When offline:

-   realtime connection may be unavailable
-   approved local state may continue
-   pending offline operations are stored locally
-   synchronization occurs when connectivity returns
-   authoritative state is refetched/reconciled

------------------------------------------------------------------------

# 25. Reconnection Flow

## RT-FLOW-001

1.  Client loses network.
2.  Realtime connection drops.
3.  UI marks connection state appropriately if useful.
4.  Client continues approved offline behavior.
5.  Network returns.
6.  Realtime reconnects.
7.  Client does not assume it received every missed event.
8.  Client performs reconciliation/refetch for affected queries.
9.  Pending offline mutations synchronize separately.

------------------------------------------------------------------------

# 26. Browser Sleep / Tab Suspension

Web applications may be suspended.

On resume:

1.  Check session/auth state.
2.  Reconnect realtime if necessary.
3.  Reconcile stale queries.
4.  Resume approved subscriptions.
5.  Refresh critical data.

The application must not assume continuous event delivery.

------------------------------------------------------------------------

# 27. Mobile Background / Resume

Mobile operating systems may suspend network activity.

On app foreground:

1.  Revalidate authentication/session as appropriate.
2.  Reconnect realtime.
3.  Reconcile important cached queries.
4.  Process approved offline synchronization.
5.  Update UI from authoritative state.

------------------------------------------------------------------------

# 28. Missed Event Handling

A missed event is not a permanent error.

Example:

``` text
event missed
    |
    v
client reconnects
    |
    v
query invalidation/refetch
    |
    v
authoritative state restored
```

The exact set of queries to reconcile should be defined by domain.

------------------------------------------------------------------------

# 29. Duplicate Event Handling

The client must tolerate:

-   duplicate realtime notifications
-   repeated database events
-   reconnection-triggered refresh
-   query refetch after event processing

UI state must remain correct.

------------------------------------------------------------------------

# 30. Event Ordering

Realtime events may arrive in ways that do not map cleanly to user
expectations.

For critical workflows, clients should prefer authoritative
refetch/reconciliation rather than assuming local event ordering is
sufficient.

Financial state must not depend on UI event ordering.

------------------------------------------------------------------------

# 31. Stale Event Protection

A client should not blindly overwrite newer state with an older event.

Where event payloads are used directly, the implementation should
consider:

-   updated timestamps
-   version numbers
-   database sequence/change identifiers
-   query invalidation instead of direct replacement

The exact mechanism will be selected during implementation based on
current Supabase behavior.

------------------------------------------------------------------------

# 32. Realtime Cache Strategy

The approved application stack includes TanStack Query.

Recommended pattern:

``` text
Realtime event
      |
      v
identify query key
      |
      v
invalidate query
      |
      v
TanStack Query refetch
      |
      v
authoritative result
```

Direct cache mutation may be used for simple, well-understood
non-sensitive updates, but financial state should prefer authoritative
reconciliation.

------------------------------------------------------------------------

# 33. Query Key Design

Realtime architecture depends on stable query keys.

Examples conceptually:

``` text
["member", memberId]
["donations", memberId]
["payment", paymentId]
["finance", "pending-payments"]
["finance", "accounts"]
["tasks", "assigned", userId]
["notifications", userId]
["attendance", eventId]
```

Actual keys must be centralized in the shared/domain data-access layer.

------------------------------------------------------------------------

# 34. Cross-Role Shared Data

All roles connect to the same backend.

Example:

``` text
Finance client
      |
      v
verify payment
      |
      v
PostgreSQL
      |
      +-------------------+
      |                   |
      v                   v
Member client        Admin client
```

The clients do not communicate directly with one another.

The database/backend is the shared source of truth.

------------------------------------------------------------------------

# 35. Single Deployment Principle

A single web deployment may serve all roles.

Role-specific behavior is determined by:

``` text
authenticated identity
        +
current authorization
        +
application data
```

Not by deploying separate backend databases per role.

------------------------------------------------------------------------

# 36. Cross-Role Example --- Finance to Member

### Before

Member:

``` text
Outstanding: ₹X
Payment: Pending
```

Finance verifies payment.

### Backend

``` text
payment = verified
allocation = committed
outstanding = recalculated
audit = recorded
```

### After

Authorized Member client receives/reconciles the change:

``` text
Payment: Verified
Outstanding: updated
```

Finance sees the corresponding updated finance state.

------------------------------------------------------------------------

# 37. Cross-Role Example --- Expense

Finance records an expense.

Authorized administrative/oversight dashboards may see the new expense
according to permissions.

Member clients should not receive internal expense details merely
because a realtime event exists.

------------------------------------------------------------------------

# 38. Cross-Role Example --- Committee Task

Secretary assigns a task.

``` text
Secretary
    |
    v
task commit
    |
    v
realtime
    |
    v
assigned Committee Member
```

The assignee sees the update.

Unassigned members do not.

------------------------------------------------------------------------

# 39. Realtime Authorization Changes

If a user's role/permission changes:

1.  Current realtime subscriptions must be considered stale.
2.  Client authorization context must refresh.
3.  Subscriptions must be recreated/reconciled as required.
4.  Newly unauthorized data must not continue to be treated as
    accessible.
5.  Newly authorized data can become available after current
    authorization is established.

------------------------------------------------------------------------

# 40. Subscription Lifecycle

Each subscription should have a controlled lifecycle:

``` text
Not subscribed
      |
      v
Authorization resolved
      |
      v
Subscribe
      |
      v
Connected
      |
      +--> event
      |
      +--> reconnect
      |
      +--> authorization change
      |
      v
Unsubscribe
```

Subscriptions should not be created before required authorization
context is known.

------------------------------------------------------------------------

# 41. Subscription Cleanup

When a component/page/domain scope is no longer active:

-   unsubscribe
-   remove listeners
-   avoid duplicate subscriptions
-   avoid stale callbacks
-   avoid retaining protected data unnecessarily

A single user should not accidentally create dozens of duplicate
subscriptions through navigation.

------------------------------------------------------------------------

# 42. Server-Side Realtime Boundaries

Server-side privileged services may consume relevant events where
required for:

-   notification processing
-   reconciliation
-   operational workflows

They must not expose privileged event data directly to clients.

------------------------------------------------------------------------

# 43. Realtime and Audit

Audit records may be written as part of authoritative operations.

Audit data does not necessarily need realtime delivery.

If realtime audit delivery is introduced, it must be explicitly
authorized.

------------------------------------------------------------------------

# 44. Realtime and Reports

Reports should generally use authoritative queries.

Realtime can signal that a report's underlying data changed, but the
report itself should be regenerated/requeried rather than incrementally
trusted from event payloads.

------------------------------------------------------------------------

# 45. Realtime and Financial Integrity

Realtime must never be part of the financial transaction's correctness
requirement.

Correct:

``` text
financial transaction succeeds
       |
       v
realtime informs clients
```

Incorrect:

``` text
realtime event
       |
       v
financial state considered committed
```

------------------------------------------------------------------------

# 46. Realtime and Idempotency

Realtime propagation does not replace mutation idempotency.

A user retrying a financial operation must still produce at most one
authoritative financial effect.

Events may then be emitted based on the resulting authoritative state.

------------------------------------------------------------------------

# 47. Realtime Error Handling

Possible states:

-   connecting
-   connected
-   disconnected
-   reconnecting
-   authorization failure
-   subscription error

The UI may expose connection state where useful.

It must not imply that business data is lost merely because realtime is
temporarily disconnected.

------------------------------------------------------------------------

# 48. Realtime Security Tests

Test:

-   member sees own permitted update
-   member cannot receive another member's update
-   Finance sees authorized payment update
-   unauthorized role does not receive finance event
-   role change affects subscriptions
-   revoked user cannot continue receiving protected events
-   storage metadata is not leaked
-   audit events are restricted
-   guessed channels do not bypass access
-   broad subscriptions do not expose unauthorized rows

------------------------------------------------------------------------

# 49. Realtime Reliability Tests

Test:

-   initial fetch + subscription race
-   missed event
-   duplicate event
-   reconnect
-   browser sleep/resume
-   mobile background/resume
-   offline → online
-   concurrent mutations
-   stale event
-   rapid successive updates
-   repeated navigation/subscription creation

------------------------------------------------------------------------

# 50. Performance Principles

Realtime should not be used indiscriminately.

Avoid:

-   subscribing every client to every table
-   organization-wide streams for member-specific data
-   unnecessary high-frequency updates
-   duplicate subscriptions
-   large event payloads
-   rebuilding entire dashboards after every small event

Prefer targeted invalidation and refetch.

------------------------------------------------------------------------

# 51. Realtime Payload Minimization

Do not expose unnecessary fields in realtime payloads where the
architecture permits controlling payload scope.

Sensitive fields should not be sent simply because they exist in the
underlying row.

------------------------------------------------------------------------

# 52. Realtime and Data Privacy

Realtime must respect the same privacy boundaries as:

-   normal SELECT
-   API responses
-   reports
-   storage
-   exports

A privacy rule must be enforced consistently across all access paths.

------------------------------------------------------------------------

# 53. Realtime Monitoring

Operational monitoring should track relevant issues such as:

-   subscription failures
-   reconnect frequency
-   processing errors
-   notification outbox failures
-   unusual event volume
-   client synchronization failures

Detailed observability requirements are defined in
`OBSERVABILITY_SPEC.md`.

------------------------------------------------------------------------

# 54. Realtime Architecture by Domain

  Domain             Realtime Priority   Typical Scope
  ------------------ ------------------- --------------------------------
  Member profile     Low/Medium          Own/admin scope
  Donations          High                Member/finance scope
  Payments           High                Member/finance scope
  Allocation         High                Authorized financial scope
  Finance accounts   High                Finance/oversight scope
  Expenses           Medium/High         Authorized finance/admin scope
  Committee tasks    High                Assigned/admin scope
  Meetings           Medium              Relevant participants
  Attendance         Medium/High         Event/member scope
  Notifications      High                Own user
  Audit              Low by default      Authorized oversight
  Reports            Low                 Query/refetch

------------------------------------------------------------------------

# 55. Realtime Acceptance Criteria

The architecture is implementation-ready when:

-   PostgreSQL authority is explicit
-   initial fetch strategy is defined
-   subscription lifecycle is defined
-   role-specific scopes are defined
-   cross-role propagation is defined
-   missed events are handled
-   duplicate events are handled
-   reconnect is handled
-   web suspension is handled
-   mobile resume is handled
-   cache invalidation strategy is defined
-   authorization changes are handled
-   financial integrity does not depend on realtime
-   storage/privacy boundaries are addressed
-   security tests are defined
-   reliability tests are defined
-   performance principles are defined

------------------------------------------------------------------------

# 56. Open Realtime Decisions

  Decision                                     Impact
  -------------------------------------------- ------------------------
  Exact Supabase Realtime subscription model   Client implementation
  Exact RLS/realtime interaction               Security
  Tables enabled for realtime                  Performance/security
  Payload strategy                             Privacy/performance
  Query invalidation catalogue                 Web/mobile
  Offline reconciliation catalogue             Sync
  Version/sequence strategy                    Stale-event protection
  Exact push/realtime relationship             Notifications
  Operational event retention                  Observability

These must be validated against current official Supabase documentation
before implementation.

------------------------------------------------------------------------

# 57. Implementation Order

1.  Verify current Supabase Realtime documentation
2.  Define realtime-enabled tables/events
3.  Define role-specific subscription scopes
4.  Define shared query keys
5.  Implement initial authoritative queries
6.  Implement subscriptions
7.  Implement invalidation/reconciliation
8.  Implement reconnect handling
9.  Implement offline/online reconciliation
10. Add security tests
11. Add reliability tests
12. Add performance monitoring

------------------------------------------------------------------------

# 58. Change Control

Any realtime change must be reviewed for:

-   RLS impact
-   privacy impact
-   performance impact
-   cache behavior
-   offline behavior
-   web/mobile behavior
-   financial correctness
-   notification behavior

Realtime must never be introduced as a shortcut around proper data
access.

------------------------------------------------------------------------

# 59. Status

**Current status: Realtime data-flow specification generated for
review.**

Exact Supabase Realtime APIs and configuration must be verified against
the current official documentation during implementation.
