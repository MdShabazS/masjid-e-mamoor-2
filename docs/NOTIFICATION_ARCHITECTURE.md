# Masjid-e-Mamoor --- Notification Architecture

**Document Status:** Draft --- Architecture Review Required\
**Version:** 1.0\
**Phase:** Documentation-First / Pre-Development\
**Repository:** `MdShabazS/masjid-e-mamoor-2`

------------------------------------------------------------------------

## 1. Purpose

This document defines the notification architecture for Masjid-e-Mamoor.

The notification system covers:

-   in-app notifications
-   notification preferences
-   transactional notifications
-   financial notifications
-   committee notifications
-   attendance-related notifications
-   administrative notifications
-   realtime notification delivery
-   push notification integration
-   email/SMS as future channels where approved
-   notification outbox
-   retries
-   deduplication
-   idempotency
-   localization
-   privacy
-   auditability
-   offline behavior
-   failure handling

The notification system must communicate authoritative business events.
It must never become the source of truth for business state.

------------------------------------------------------------------------

# 2. Notification Principles

## NOTIF-001 --- Business State Is Authoritative

Notifications describe business state.

A notification does not create or approve the underlying state.

------------------------------------------------------------------------

## NOTIF-002 --- Trusted Generation

Important notifications must originate from trusted server-side/domain
workflows.

Clients must not be able to impersonate system notifications.

------------------------------------------------------------------------

## NOTIF-003 --- Outbox Pattern

Business transactions that require reliable notification delivery should
create outbox records atomically with the underlying business
transaction.

------------------------------------------------------------------------

## NOTIF-004 --- At-Least-Once Processing

Notification processing should assume retries can occur.

Handlers must be idempotent.

------------------------------------------------------------------------

## NOTIF-005 --- No Sensitive Leakage

Notifications should contain the minimum information necessary.

Sensitive financial/member details should not appear in notification
previews unless explicitly approved.

------------------------------------------------------------------------

## NOTIF-006 --- User Preference Respect

Optional notifications should respect user preferences.

Mandatory transactional/security notifications may be non-disableable
where required.

------------------------------------------------------------------------

## NOTIF-007 --- Multi-Channel Consistency

In-app, push, and future channels should describe the same authoritative
event.

------------------------------------------------------------------------

## NOTIF-008 --- Localization

Notification text must support:

-   English
-   Hindi
-   Kannada
-   Urdu

Urdu notifications must support RTL presentation.

------------------------------------------------------------------------

# 3. Notification Architecture

Conceptually:

``` text
Domain transaction
       |
       v
Database transaction
       |
       +---- business state
       |
       +---- outbox event
                    |
                    v
              notification worker
                    |
          +---------+----------+
          |         |          |
          v         v          v
       In-app     Push      Future channels
          |
          v
     Realtime update
```

------------------------------------------------------------------------

# 4. Notification Components

## 4.1 Event Producer

The domain operation that creates the business event.

Examples:

-   payment verified
-   payment rejected
-   task assigned
-   meeting scheduled

------------------------------------------------------------------------

## 4.2 Outbox

Durable pending notification/event record.

------------------------------------------------------------------------

## 4.3 Dispatcher

Processes pending outbox entries.

------------------------------------------------------------------------

## 4.4 Channel Adapter

Sends through:

-   in-app
-   push
-   future email
-   future SMS

------------------------------------------------------------------------

## 4.5 Delivery Record

Tracks channel-specific delivery state where required.

------------------------------------------------------------------------

# 5. In-App Notification Model

The application should maintain a notification record representing what
the user needs to know.

Conceptual fields:

``` text
id
recipient_user_id
type
title_key
body_key
payload
read_at
created_at
expires_at
source_event_id
```

The exact schema belongs to the database implementation.

------------------------------------------------------------------------

# 6. Notification Event Model

A domain event may produce one or more notifications.

Example:

``` text
payment_verified
    |
    +--> member notification
    +--> finance notification if required
    +--> audit/system event
```

Recipients must be determined by authorization and business rules.

------------------------------------------------------------------------

# 7. Notification Types

Initial categories:

``` text
authentication
membership
referral
donation
payment
finance
committee
meeting
attendance
system
security
```

------------------------------------------------------------------------

# 8. Authentication Notifications

Potential notifications:

-   OTP-related system messaging
-   account activation
-   account status change
-   suspicious/recovery event where supported

OTP delivery itself is primarily part of the authentication provider
rather than the application notification system.

------------------------------------------------------------------------

# 9. Membership Notifications

Examples:

``` text
membership created
membership activated
membership deactivated
membership information request
```

The exact notification set depends on final product requirements.

------------------------------------------------------------------------

# 10. Referral Notifications

Potential events:

``` text
referral created
referral registration completed
referral requires action
```

Do not expose unnecessary personal information about the referred
person.

------------------------------------------------------------------------

# 11. Donation Notifications

Potential events:

``` text
donation obligation created
monthly obligation updated
payment submitted
payment verified
payment rejected
additional donation recorded
payment allocation completed
```

Notification content must distinguish between:

``` text
payment submitted
```

and:

``` text
payment verified
```

------------------------------------------------------------------------

# 12. Payment Submission Notification

After successful submission:

``` text
payment_submitted
```

The notification should communicate that the payment has been submitted
for review.

It must not imply verification.

------------------------------------------------------------------------

# 13. Payment Verification Notification

After authoritative Finance verification:

``` text
payment_verified
```

The notification may summarize:

-   verified amount
-   relevant donation/payment reference
-   resulting status

Only information appropriate to the recipient should be included.

------------------------------------------------------------------------

# 14. Payment Rejection Notification

After rejection:

``` text
payment_rejected
```

Where appropriate, include a safe explanation/reason.

Do not expose internal Finance notes unless the business rules permit
them.

------------------------------------------------------------------------

# 15. Allocation Notification

If product UX requires it, a verified payment may produce an allocation
notification.

Example:

``` text
payment_allocated
```

The notification should not become the sole source for the user's
outstanding balance.

The client should refresh/query authoritative balances.

------------------------------------------------------------------------

# 16. Finance Notifications

Potential events:

``` text
payment awaiting verification
expense awaiting approval
transfer completed
financial correction recorded
reversal recorded
```

Finance notifications should be role-scoped.

------------------------------------------------------------------------

# 17. Finance Notification Privacy

Finance notifications must not leak sensitive financial details to:

-   Committee Members
-   ordinary Members
-   unauthorized administrative roles

unless explicitly permitted.

------------------------------------------------------------------------

# 18. Committee Task Notifications

Potential events:

``` text
task_assigned
task_updated
task_due
task_completed
task_reopened
```

A task notification should identify enough context for action without
unnecessarily exposing private information.

------------------------------------------------------------------------

# 19. Meeting Notifications

Potential events:

``` text
meeting_created
meeting_updated
meeting_cancelled
meeting_reminder
```

Recipients depend on meeting scope.

------------------------------------------------------------------------

# 20. Attendance Notifications

Potential events:

``` text
attendance_recorded
attendance_issue
attendance_sync_failed
```

These should be used carefully to avoid excessive notification volume.

------------------------------------------------------------------------

# 21. Security Notifications

Potential events:

``` text
role_changed
account_deactivated
account_reactivated
security_action_required
```

Security notifications may be mandatory.

------------------------------------------------------------------------

# 22. System Notifications

Examples:

``` text
maintenance
service disruption
important system announcement
```

System notifications require administrative/trusted creation.

------------------------------------------------------------------------

# 23. Notification Severity

A conceptual severity model:

``` text
info
success
action_required
warning
critical
```

Severity should drive presentation, not authorization.

------------------------------------------------------------------------

# 24. Notification Priority

Priority may be used for delivery scheduling:

``` text
low
normal
high
urgent
```

Do not allow ordinary clients to arbitrarily mark notifications urgent.

------------------------------------------------------------------------

# 25. Notification Preferences

Users may have preferences for optional categories.

Conceptual:

``` text
notification_preferences
    user_id
    category
    in_app_enabled
    push_enabled
```

Exact preference schema remains an implementation decision.

------------------------------------------------------------------------

# 26. Mandatory Notifications

Some notifications may not be suppressible.

Potential categories:

-   security
-   critical account status
-   legally/operationally required notices where applicable

The final mandatory list must be explicitly documented.

------------------------------------------------------------------------

# 27. Notification Delivery Channels

Initial channel:

``` text
in-app
```

Potential channel:

``` text
push
```

Future channels:

``` text
email
SMS
```

No channel should be added merely because the provider supports it.

------------------------------------------------------------------------

# 28. In-App Delivery

In-app notifications are persisted in PostgreSQL.

The client:

1.  loads initial notifications
2.  subscribes to authorized realtime updates
3.  displays new notifications
4.  marks read state
5.  reconciles after reconnect

------------------------------------------------------------------------

# 29. Realtime Notification Flow

Conceptual:

``` text
domain event
    |
    v
outbox
    |
    v
notification record
    |
    v
database change
    |
    v
Supabase Realtime
    |
    v
web/mobile
```

The realtime event is a delivery optimization.

The database notification row remains authoritative.

------------------------------------------------------------------------

# 30. Initial Fetch + Subscription Race

Clients should avoid missing events between:

``` text
initial notification fetch
```

and:

``` text
realtime subscription
```

Recommended pattern:

1.  establish/reconcile subscription state
2.  fetch current notification state
3.  reconcile by notification ID/timestamp
4.  deduplicate
5.  continue realtime listening

The exact implementation must be tested.

------------------------------------------------------------------------

# 31. Read State

A notification can have:

``` text
unread
read
```

Potential future states may include:

``` text
dismissed
archived
```

Do not create states unless product behavior requires them.

------------------------------------------------------------------------

# 32. Mark Read Command

Conceptual:

``` text
markNotificationRead(notificationId)
```

Authorization:

-   authenticated user
-   notification recipient

The user cannot mark another user's notification as read.

------------------------------------------------------------------------

# 33. Mark All Read

Conceptual:

``` text
markAllNotificationsRead()
```

This operation is scoped to the current user.

It should be idempotent.

------------------------------------------------------------------------

# 34. Notification Count

The application may display:

``` text
unread notification count
```

The count must be calculated from authoritative notification state.

Realtime updates may invalidate/recalculate it.

------------------------------------------------------------------------

# 35. Notification Payload

Payload should contain stable identifiers rather than large copies of
business records.

Example:

``` text
{
  entityType: "payment",
  entityId: "...",
  action: "review"
}
```

The client can fetch current authoritative data when the notification is
opened.

------------------------------------------------------------------------

# 36. Deep Linking

Notifications may navigate to relevant application screens.

Example:

``` text
payment_verified
    -> payment details
```

The destination must still perform authorization.

A deep link does not grant access.

------------------------------------------------------------------------

# 37. Stale Notifications

A notification may outlive the underlying record state.

For example:

``` text
expense approved
```

followed later by:

``` text
expense reversed
```

Opening the notification should show current authorized state.

------------------------------------------------------------------------

# 38. Notification Deduplication

A domain event should have a stable event identifier.

Channel delivery should use:

``` text
event_id + recipient + channel
```

or an equivalent stable key to prevent duplicate sends.

------------------------------------------------------------------------

# 39. Outbox Record

Conceptual:

``` text
id
event_type
aggregate_type
aggregate_id
recipient_scope
payload
created_at
processed_at
attempt_count
next_attempt_at
status
last_error
```

Exact schema belongs to the database architecture implementation.

------------------------------------------------------------------------

# 40. Outbox Status

Potential states:

``` text
pending
processing
delivered
failed
dead_letter
cancelled
```

Use only states needed by the final implementation.

------------------------------------------------------------------------

# 41. Outbox Transaction

When a notification must reliably correspond to a business mutation:

``` text
BEGIN
  update business state
  create outbox event
COMMIT
```

The outbox must not be created after the business transaction in a
separate unreliable step.

------------------------------------------------------------------------

# 42. Dispatcher

A worker/process should:

1.  claim eligible outbox entries
2.  prevent conflicting processing
3.  send through channel adapter
4.  record result
5.  schedule retry if needed
6.  move permanently failing events to controlled failure state

------------------------------------------------------------------------

# 43. At-Least-Once Delivery

The system should assume a message may be processed more than once.

Therefore:

``` text
sendNotification()
```

must be designed for duplicate-safe behavior.

------------------------------------------------------------------------

# 44. Retry Strategy

Transient failures may use exponential backoff.

Example conceptual progression:

``` text
attempt 1
attempt 2
attempt 3
...
```

Exact retry count/delays are operational decisions.

------------------------------------------------------------------------

# 45. Permanent Failure

After retry exhaustion:

``` text
failed
```

or:

``` text
dead_letter
```

The event should remain diagnosable.

Do not silently discard important notifications.

------------------------------------------------------------------------

# 46. Push Notification Architecture

If push notifications are enabled:

``` text
application
   |
   v
push token registry
   |
   v
trusted notification service
   |
   v
FCM/APNs/Expo-supported delivery
```

The exact provider path depends on the final Expo/EAS implementation and
current platform guidance.

------------------------------------------------------------------------

# 47. Push Token Model

Conceptual:

``` text
id
user_id
device_id
platform
push_token
status
last_seen_at
created_at
updated_at
```

A user may have multiple devices.

------------------------------------------------------------------------

# 48. Device Registration

A mobile client may register a push token after authentication.

The server must associate the token with the authenticated user.

A client must not register a push token for another user.

------------------------------------------------------------------------

# 49. Token Rotation

Push tokens can change.

The client should update the server when:

-   token changes
-   app reinstall occurs
-   permissions change
-   device state changes

------------------------------------------------------------------------

# 50. Invalid Tokens

Delivery failures indicating an invalid token should mark the token
inactive rather than retry indefinitely.

------------------------------------------------------------------------

# 51. Push Permission Denial

A user who denies push permissions should still receive supported in-app
notifications.

Push availability is a delivery preference/capability, not
business-state authority.

------------------------------------------------------------------------

# 52. Push Payload Minimization

Do not put sensitive information directly in push payloads.

Prefer:

``` text
title
generic message
entity ID
action
```

The app fetches authorized details after opening.

------------------------------------------------------------------------

# 53. Notification Localization

Notification records should store stable translation keys where
practical.

Example:

``` text
payment.verified.title
payment.verified.body
```

Do not persist only rendered English text when multilingual support is
required.

------------------------------------------------------------------------

# 54. Dynamic Notification Variables

Use controlled variables:

``` text
amount
month
task title
meeting date
```

Variables must be sanitized and localized correctly.

------------------------------------------------------------------------

# 55. Urdu RTL

Urdu notification presentation must support RTL.

The notification system should not assume left-to-right rendering.

Test:

-   title
-   body
-   numbers
-   dates
-   mixed Urdu/English
-   currency
-   identifiers

------------------------------------------------------------------------

# 56. Hindi and Kannada

Verify:

-   font rendering
-   line wrapping
-   notification preview
-   mobile push presentation
-   in-app presentation

------------------------------------------------------------------------

# 57. Translation Fallback

If a translation is unavailable:

``` text
requested language
      |
      v
fallback language
```

The fallback policy should be consistent.

English may be the technical fallback unless product requirements
specify otherwise.

------------------------------------------------------------------------

# 58. Notification Timing

Notifications should generally be triggered after the authoritative
business transaction succeeds.

Do not notify:

``` text
before transaction commit
```

for events that could roll back.

------------------------------------------------------------------------

# 59. Financial Notification Timing

Example:

``` text
payment verification transaction commits
       |
       v
outbox event exists
       |
       v
notification delivered
```

If notification delivery fails, the financial transaction remains
successful.

------------------------------------------------------------------------

# 60. Notification Failure Must Not Roll Back Business State

A push failure should not cause:

``` text
payment verification rollback
```

The outbox isolates delivery reliability from business transaction
reliability.

------------------------------------------------------------------------

# 61. Finance Notification Example

``` text
payment verified
      |
      +--> payment state updated
      +--> allocations created
      +--> financial records updated
      +--> audit event created
      +--> notification outbox created
```

All authoritative business effects commit together where required.

Notification delivery happens afterward.

------------------------------------------------------------------------

# 62. Committee Notification Example

``` text
task assigned
      |
      +--> task assignment committed
      +--> audit event
      +--> notification outbox
```

Recipient sees:

``` text
New task assigned
```

Opening the notification loads the current task.

------------------------------------------------------------------------

# 63. Notification Preferences and Mandatory Events

Preference evaluation should occur when the notification is dispatched.

However, the underlying event remains recorded.

If a user disables optional push:

``` text
in-app notification remains
push delivery skipped
```

where product policy permits.

------------------------------------------------------------------------

# 64. Notification Expiry

Some notifications may become irrelevant.

Examples:

``` text
meeting reminder
temporary action request
system maintenance notice
```

An expiry timestamp can be used.

Historical business events should not disappear merely because a
notification expires.

------------------------------------------------------------------------

# 65. Notification Retention

Notification retention should be shorter than financial/audit record
retention unless there is a product reason otherwise.

Exact retention period is an open operational decision.

------------------------------------------------------------------------

# 66. Notification Cleanup

Cleanup should:

-   remove expired notifications
-   preserve required audit events
-   avoid deleting unread critical notifications prematurely
-   handle large notification volumes

------------------------------------------------------------------------

# 67. Notification Pagination

Notification lists must be paginated.

The client should not load an unbounded notification history.

------------------------------------------------------------------------

# 68. Notification Ordering

Default ordering should be stable and predictable.

Potential:

``` text
created_at DESC
id DESC
```

A unique secondary ordering key should prevent ambiguous pagination.

------------------------------------------------------------------------

# 69. Notification Read Race

If a notification arrives while the user marks all notifications read:

-   use server-authoritative timestamps/state
-   reconcile unread count
-   avoid assuming local success is final

------------------------------------------------------------------------

# 70. Offline Notification Behavior

When offline:

-   cached notifications remain viewable if safely stored
-   read actions may be queued if supported
-   new server notifications cannot be assumed to exist locally
-   reconnect triggers reconciliation

------------------------------------------------------------------------

# 71. Offline Mark-Read

If offline mark-read is supported:

``` text
operationId
notificationId
client timestamp
```

must be queued.

The server should validate the notification still belongs to the user.

------------------------------------------------------------------------

# 72. Notification Security

Protect against:

-   cross-user notification access
-   forged notification creation
-   forged recipient IDs
-   unauthorized push token registration
-   sensitive payload leakage
-   deep-link authorization bypass
-   notification enumeration

------------------------------------------------------------------------

# 73. Notification Enumeration

IDs should not be sufficient to retrieve another user's notification.

Database/API authorization must always validate recipient ownership.

------------------------------------------------------------------------

# 74. Administrative Broadcasts

If administrative announcements are supported, use an explicit trusted
operation.

Conceptual:

``` text
createAnnouncement(...)
publishAnnouncement(...)
```

Recipient scope must be explicit.

------------------------------------------------------------------------

# 75. Broadcast Safety

A broadcast operation should require:

-   authorization
-   content validation
-   recipient scope
-   audit
-   confirmation where appropriate

Do not let ordinary users generate organization-wide messages.

------------------------------------------------------------------------

# 76. Notification Audit

Audit important notification administration events:

-   broadcast created
-   broadcast published
-   preference changes where sensitive
-   notification delivery failures where operationally important
-   token registration/removal

Do not audit every harmless UI interaction unless required.

------------------------------------------------------------------------

# 77. Notification Observability

Measure:

``` text
outbox backlog
processing latency
delivery success
delivery failure
retry count
invalid push token count
notification creation rate
```

------------------------------------------------------------------------

# 78. Rate Limiting

Prevent notification abuse.

Examples:

-   broadcast frequency
-   repeated task notifications
-   repeated payment rejection notifications
-   push token registration

Business-critical notifications should not be silently dropped because
of generic throttling.

------------------------------------------------------------------------

# 79. Notification Storm Prevention

A single business action should not accidentally produce hundreds of
duplicate notifications.

Use:

-   stable event IDs
-   recipient deduplication
-   batching where appropriate
-   aggregation for repetitive events

------------------------------------------------------------------------

# 80. Aggregated Notifications

Future enhancement:

``` text
5 tasks updated
```

instead of five separate notifications where UX benefits.

Aggregation must not hide critical actions.

------------------------------------------------------------------------

# 81. Notification Templates

Templates should be version-controlled.

A template should define:

-   event type
-   title key
-   body key
-   variables
-   severity
-   default channels
-   preference category

------------------------------------------------------------------------

# 82. Template Validation

Every template should be tested for:

-   missing variables
-   incorrect translation keys
-   malformed links
-   RTL rendering
-   excessive length
-   unsupported characters

------------------------------------------------------------------------

# 83. Notification API

Conceptual queries:

``` text
listMyNotifications()
getNotification(id)
getUnreadCount()
```

Conceptual commands:

``` text
markNotificationRead(id)
markAllNotificationsRead()
updateNotificationPreferences(input)
registerPushToken(input)
unregisterPushToken(input)
```

System event creation should not be exposed as ordinary user CRUD.

------------------------------------------------------------------------

# 84. Notification API Authorization

### Member

Own notifications/preferences/device tokens.

### Committee Member

Own notifications/preferences/device tokens.

### Finance

Own notifications/preferences/device tokens plus authorized finance
notification scopes.

### Auditor

Own notifications/preferences/device tokens plus authorized oversight
notifications.

### Secretary/Vice President

Own notifications/preferences/device tokens plus authorized
administrative scopes.

### President / Super Admin

Own notifications/preferences/device tokens plus authorized system
administration.

The final permission matrix remains authoritative.

------------------------------------------------------------------------

# 85. Notification and Role Changes

If a user's role changes:

-   future notifications use the new authorization
-   existing notification history remains subject to its privacy rules
-   stale deep links must still reauthorize
-   push delivery follows current device ownership

------------------------------------------------------------------------

# 86. Deactivated User

When a user is deactivated:

-   new ordinary notifications should stop
-   pending notifications should follow defined account policy
-   push tokens may be disabled
-   security/account-status notifications may remain available where
    required

Exact lifecycle requires product approval.

------------------------------------------------------------------------

# 87. Notification and Account Reactivation

After reactivation:

-   notification delivery may resume
-   stale notifications should be reconciled
-   push token may need re-registration

------------------------------------------------------------------------

# 88. Notification Data Model Relationship

Conceptually:

``` text
domain event
   |
   v
outbox event
   |
   +--> notification
   |       |
   |       +--> recipient
   |       +--> read state
   |
   +--> push delivery
   |
   +--> future email/SMS
```

------------------------------------------------------------------------

# 89. Event Naming

Event names should be:

-   domain-oriented
-   stable
-   past-tense for completed events

Examples:

``` text
payment_verified
payment_rejected
task_assigned
meeting_created
expense_approved
```

Avoid UI-oriented names such as:

``` text
show_payment_green
```

------------------------------------------------------------------------

# 90. Event Payload Design

Payloads should include stable identifiers and minimal required
information.

Avoid copying entire database rows into events.

This reduces:

-   privacy risk
-   payload size
-   stale data
-   coupling

------------------------------------------------------------------------

# 91. Event Versioning

If event payload contracts evolve, versioning may be required.

Example:

``` text
payment_verified.v1
```

Only introduce explicit versions when compatibility requires them.

------------------------------------------------------------------------

# 92. Outbox Concurrency

Multiple workers may attempt to process the same event.

The dispatcher must use a safe claiming/locking strategy.

A worker must not assume that reading a pending row gives exclusive
ownership.

------------------------------------------------------------------------

# 93. Delivery Exactly-Once vs At-Least-Once

The architecture should target reliable at-least-once processing with
idempotent effects.

Exactly-once external delivery cannot be assumed for every provider.

------------------------------------------------------------------------

# 94. Provider Failure

If an external push provider is unavailable:

``` text
business transaction succeeds
outbox remains/retries
notification remains visible in-app
```

------------------------------------------------------------------------

# 95. In-App Notification Reliability

Because in-app notifications are database-backed, they should remain
available even if push delivery fails.

------------------------------------------------------------------------

# 96. Push vs In-App State

A push notification is a transport event.

An in-app notification is a persisted user-facing record.

Do not treat push delivery receipt as proof that the user has read the
notification.

------------------------------------------------------------------------

# 97. Read Receipt

`read_at` means the application recorded the read action.

It does not prove:

-   the user understood the message
-   the user completed the linked action

------------------------------------------------------------------------

# 98. Action Completion

For action-required notifications:

``` text
notification
    |
    v
linked business record
    |
    v
user action
    |
    v
authoritative business state
```

The notification should not itself store action completion unless
required.

------------------------------------------------------------------------

# 99. Notification Testing Matrix

Test:

  Area                     Required
  ------------------------ ----------
  Authorization            Yes
  Recipient isolation      Yes
  Realtime delivery        Yes
  Duplicate events         Yes
  Retry                    Yes
  Push token rotation      Yes
  Invalid token            Yes
  Localization             Yes
  Urdu RTL                 Yes
  Offline reconciliation   Yes
  Read state               Yes
  Deep-link security       Yes
  Financial event timing   Yes
  Role change              Yes
  Deactivation             Yes
  Cleanup                  Yes

------------------------------------------------------------------------

# 100. Security Test Cases

Minimum tests:

``` text
user A cannot read user B notification
user A cannot mark user B notification read
member cannot create system notification
member cannot register token for another user
unauthorized role cannot receive finance notification
deep link cannot bypass authorization
forged recipient ID is rejected
duplicate event does not duplicate notification
duplicate push delivery is controlled
expired access is rejected
```

------------------------------------------------------------------------

# 101. Financial Notification Tests

Test:

1.  payment submitted
2.  payment verified
3.  payment rejected
4.  payment reversed
5.  notification failure
6.  retry
7.  duplicate processing
8.  concurrent verification

Business state must remain correct regardless of notification delivery
outcome.

------------------------------------------------------------------------

# 102. Committee Notification Tests

Test:

-   task assignment
-   reassignment
-   task completion
-   meeting creation
-   meeting update
-   meeting cancellation
-   duplicate event
-   unauthorized recipient

------------------------------------------------------------------------

# 103. Notification UX

Each notification should clearly communicate:

-   what happened
-   when it happened
-   whether action is required
-   where to go next

Avoid ambiguous messages.

------------------------------------------------------------------------

# 104. Loading State

Notification UI should support:

-   initial loading
-   pagination loading
-   realtime insertion
-   refresh
-   offline state

------------------------------------------------------------------------

# 105. Empty State

Example:

``` text
No notifications yet.
```

The empty state should not be confused with a failed notification
service.

------------------------------------------------------------------------

# 106. Error State

Differentiate:

``` text
Unable to load notifications
```

from:

``` text
No notifications
```

------------------------------------------------------------------------

# 107. Accessibility

Notification UI must support:

-   keyboard navigation on web
-   screen readers
-   accessible labels
-   sufficient text clarity
-   RTL
-   reduced motion where applicable

------------------------------------------------------------------------

# 108. Notification Badge

Unread badges should:

-   be accessible
-   update from authoritative state
-   avoid excessive animation
-   remain understandable with large counts

Potential display:

``` text
99+
```

------------------------------------------------------------------------

# 109. Mobile Notification Navigation

Opening a push notification should:

1.  restore/authenticate session
2.  validate current authorization
3.  navigate
4.  fetch current data
5.  show current state

If authorization fails, show an appropriate safe message.

------------------------------------------------------------------------

# 110. Web Notification Navigation

Web notification links must not depend solely on client-side route
guards.

Server/database authorization remains authoritative.

------------------------------------------------------------------------

# 111. Notification Preferences UX

Preferences should clearly distinguish:

``` text
Required
Optional
```

and:

``` text
In-app
Push
```

if those channels are supported.

------------------------------------------------------------------------

# 112. Preference Defaults

Default preferences should be explicitly documented.

Do not assume every user wants every optional notification.

------------------------------------------------------------------------

# 113. Preference Storage Security

Users can modify only their own preferences.

Administrative defaults, if any, require trusted configuration.

------------------------------------------------------------------------

# 114. Notification Delivery Window

Non-urgent notifications may eventually support quiet hours.

This is an optional future capability.

Security/critical notifications may bypass quiet hours according to
approved policy.

------------------------------------------------------------------------

# 115. Notification Timezone

Display timestamps using the user's configured/local timezone where
appropriate.

Authoritative timestamps remain server-based.

------------------------------------------------------------------------

# 116. Date Formatting

Localized notification dates must respect:

-   locale
-   timezone
-   calendar conventions where required
-   RTL presentation

------------------------------------------------------------------------

# 117. Notification Privacy in Shared Devices

The application should avoid putting unnecessary sensitive information
into lock-screen push previews.

Users may also control device-level notification privacy.

------------------------------------------------------------------------

# 118. Notification Content Security

Never include:

-   passwords
-   OTPs
-   session tokens
-   service keys
-   signed URLs
-   sensitive secrets

in notification payloads.

------------------------------------------------------------------------

# 119. Notification and Audit Separation

Notification history is not an audit log.

A notification may be deleted/expired while the underlying audit event
remains retained.

------------------------------------------------------------------------

# 120. Notification and Reports

Reports should derive from authoritative business tables, not
notification history.

------------------------------------------------------------------------

# 121. Notification and Backup

Notification records may be backed up with database data according to
the application's database backup policy.

Push tokens and external delivery state may require separate operational
recovery handling.

------------------------------------------------------------------------

# 122. Notification Disaster Recovery

After database restoration:

-   notification records may be restored
-   outbox processing state must be evaluated
-   duplicate external deliveries must be controlled
-   stale push tokens may require reconciliation

------------------------------------------------------------------------

# 123. Notification Monitoring Dashboard

Future operations dashboard may show:

``` text
pending outbox
failed events
delivery latency
push token health
notification volume
```

Access must be restricted.

------------------------------------------------------------------------

# 124. Notification Cost Control

Avoid unnecessary external pushes.

Prefer:

-   in-app for low-priority information
-   push for actionable events
-   batching where appropriate

The final channel policy is a product decision.

------------------------------------------------------------------------

# 125. Notification Implementation Boundary

The notification module should not directly modify unrelated domain
tables.

It consumes domain events/outbox records and writes
notification/delivery state.

------------------------------------------------------------------------

# 126. Domain Event Ownership

The domain that owns the business state creates the event.

Examples:

``` text
payments -> payment_verified
committee -> task_assigned
meetings -> meeting_created
finance -> expense_approved
```

Notification code should not independently decide that a payment is
verified.

------------------------------------------------------------------------

# 127. Notification Failure Isolation

A notification failure must not corrupt:

-   payment state
-   donation allocation
-   financial account state
-   task state
-   meeting state
-   attendance state

------------------------------------------------------------------------

# 128. Transactional Boundary Example

``` text
BEGIN
  verify payment
  allocate payment
  create audit record
  create notification outbox event
COMMIT

worker:
  create/send notification
```

This is the preferred conceptual model for reliable financial
notifications.

------------------------------------------------------------------------

# 129. Notification API Acceptance Criteria

The API is acceptable when:

-   user notifications are scoped
-   notification creation is trusted
-   read state is protected
-   preferences are user-scoped
-   push tokens are user-scoped
-   deep links reauthorize
-   event IDs support deduplication
-   outbox is durable
-   retries are safe
-   localization is supported
-   sensitive payloads are minimized

------------------------------------------------------------------------

# 130. Operational Acceptance Criteria

The system must support:

-   outbox backlog monitoring
-   failed notification diagnosis
-   token cleanup
-   retry handling
-   notification cleanup
-   localization verification
-   role/permission changes
-   disaster recovery testing

------------------------------------------------------------------------

# 131. Open Decisions

  -----------------------------------------------------------------------
  Decision                            Status
  ----------------------------------- -----------------------------------
  Exact notification table schema     Review

  Exact outbox schema                 Review

  Push provider implementation        Review

  Email/SMS support                   Future/Open

  Mandatory notification categories   Open

  Default preferences                 Open

  Push payload format                 Open

  Retry count/backoff                 Open

  Notification retention              Open

  Quiet hours                         Future/Open

  Broadcast feature                   Open

  Aggregation rules                   Future/Open

  Exact Supabase Realtime             Verify during implementation
  subscription strategy               
  -----------------------------------------------------------------------

------------------------------------------------------------------------

# 132. Implementation Order

1.  Finalize event catalogue
2.  Finalize notification categories
3.  Finalize notification schema
4.  Finalize outbox schema
5.  Implement in-app notification persistence
6.  Implement trusted event creation
7.  Implement realtime delivery
8.  Implement read state
9.  Implement preferences
10. Implement push token registration
11. Implement push delivery
12. Implement retries
13. Implement cleanup
14. Add localization
15. Add deep links
16. Add security tests
17. Add financial notification tests
18. Add operational monitoring

------------------------------------------------------------------------

# 133. Change Control

Changes to notification behavior must review:

-   business rules
-   user flows
-   API architecture
-   realtime architecture
-   offline architecture
-   localization
-   privacy/security
-   role permissions

A notification change must not alter authoritative business behavior
unless the business specification is explicitly changed.

------------------------------------------------------------------------

# 134. Status

**Current status: Notification architecture generated for review.**

This document defines the notification domain, reliability model,
privacy boundaries, and delivery architecture. Exact provider APIs,
Supabase Realtime implementation, push infrastructure, and final
timing/retention policies must be verified and finalized during
implementation.
