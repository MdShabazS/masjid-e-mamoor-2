# Masjid-e-Mamoor 2 — Notification System

**Document Status:** V1 Implementation Baseline  
**Version:** 1.0  
**Product:** Masjid-e-Mamoor 2 Internal Management Application  
**Scope:** V1  
**Primary Channels:** In-App + Push + SMS/WhatsApp Where Available  
**Last Updated:** 2026-09-17

---

# 1. Purpose

This document defines the V1 notification system for Masjid-e-Mamoor 2.

The notification system is responsible for informing users about important application events.

It supports:

- In-app notifications
- Push notifications
- SMS/WhatsApp delivery where available
- Task notifications
- Meeting notifications
- Attendance reminders
- Donation reminders
- Payment-related notifications
- Expense oversight notifications
- Finance alerts
- Security/administrative notifications

The core principle is:

> Notifications communicate business events; they never define or replace the authoritative business state.

---

# 2. V1 Notification Scope

V1 supports notifications for:

```text
Authentication/security events where appropriate
Task assignment
Task claim
Task completion
Task deadline/overdue
Meeting scheduling
Meeting reminders
Meeting rescheduling/cancellation
Attendance reminders
Pending/missed monthly donations
Payment status
Expense added
Finance-related operational events
Administrative/security events
```

V1 does not require:

```text
Notification inbox/history
Public announcements system
Marketing notifications
Complex campaign messaging
User-to-user private chat
Notification ranking
```

---

# 3. Notification Design Principles

1. Notifications are event-driven.
2. Business records remain the source of truth.
3. Push delivery failure must not break business logic.
4. Notifications should be safe for lock screens.
5. Sensitive information should not be placed in push payloads.
6. Notification permissions are role/business controlled.
7. Delivery attempts should be retry-safe.
8. Duplicate events should not produce uncontrolled duplicate notifications.
9. SMS/WhatsApp availability is provider-dependent.
10. Free SMS/WhatsApp delivery must not be assumed.
11. Critical actions should create the business record before notification delivery.
12. Notifications should deep-link users to the relevant authorized screen where practical.
13. Users must not be given information they are not authorized to view.
14. Notification delivery should support web/mobile differences.
15. V1 does not require a permanent user-facing notification history.

---

# 4. Notification Architecture

```text
                 BUSINESS EVENT
                       │
                       ▼
                Notification Event
                       │
              ┌────────┼────────┐
              │        │        │
              ▼        ▼        ▼
           In-App     Push    SMS/WhatsApp
              │        │        │
              └────────┼────────┘
                       ▼
                 Delivery Result
```

The business event remains authoritative.

---

# 5. Notification Event vs Business Record

Example:

```text
Task assigned
    ├── Task record = source of truth
    └── Notification = communication
```

If the push fails:

```text
Task remains assigned.
```

---

# 6. Notification Event

A notification event represents an event that may produce one or more delivery attempts.

Conceptually:

```text
notification_event
├── id
├── event_type
├── entity_type
├── entity_id
├── recipient_user_id
├── created_at
└── metadata
```

The physical schema may differ.

---

# 7. Delivery Record

A channel-specific delivery record may track:

```text
notification_event_id
channel
provider
status
attempt_count
sent_at
delivered_at
failure_reason
```

V1 does not require exposing this history to end users.

---

# 8. Notification Channels

V1 channels:

```text
IN_APP
PUSH
SMS
WHATSAPP
```

SMS and WhatsApp are optional based on configured provider availability.

---

# 9. In-App Notification

An in-app notification is shown while the user is using the application.

Example:

```text
New task assigned to you.
```

V1 does not require a dedicated permanent notification inbox/history.

---

# 10. Push Notification

Push notifications are delivered through:

```text
Expo Push Service
+
native FCM/APNs infrastructure
```

The application should keep provider implementation abstracted.

---

# 11. SMS

SMS may be used for specific events such as pending/missed monthly donation reminders.

V1 does not assume free SMS.

Provider selection and cost are operational/deployment concerns.

---

# 12. WhatsApp

WhatsApp may be supported where a compliant/provider-integrated route is available.

Do not assume unrestricted free WhatsApp messaging.

The application should use an adapter so provider implementation can change.

---

# 13. Notification Provider Adapter

Conceptually:

```text
Notification Service
       │
       ├── Push Adapter
       ├── SMS Adapter
       └── WhatsApp Adapter
```

This avoids coupling business events to one provider.

---

# 14. Notification Recipient

Every notification event resolves one or more authorized recipients.

The notification service must validate:

```text
Recipient exists
+
Recipient is active
+
Recipient is allowed to receive this event
```

---

# 15. Recipient Authorization

The server determines recipients.

The client must not submit:

```text
send notification to User X
```

without server-side authorization/business validation.

---

# 16. User Notification Preferences

V1 should keep notification preferences simple.

Where preferences are needed, they may support:

```text
Channel enabled/disabled
```

subject to mandatory security/transactional notifications.

Do not build a complex rules engine unnecessarily.

---

# 17. Mandatory vs Optional Notifications

Some notifications may be mandatory business notifications.

Examples:

```text
Security alert
Role change
Important account change
```

Others may be optional where the product allows.

The final preference policy should distinguish the two.

---

# 18. Notification Event Categories

Recommended categories:

```text
AUTH
TASK
MEETING
ATTENDANCE
DONATION
PAYMENT
FINANCE
EXPENSE
SECURITY
ADMINISTRATION
```

---

# 19. Task Notifications

Task-related notifications include:

```text
Task assigned
Task claimed
Task deadline approaching
Task overdue
Task completed
```

Only events relevant to the recipient are sent.

---

# 20. Task Assignment Notification

When a task is directly assigned:

```text
Task assigned
      ↓
Responsible member
      ↓
In-app + push
```

---

# 21. Task Claim Notification

When an open task is claimed, relevant users may be notified.

The exact recipients follow the product/role model.

---

# 22. Task Completion Notification

When a task is completed:

```text
Task completed
      ↓
Relevant users notified
```

The task record remains authoritative.

---

# 23. Task Overdue Notification

When a responsible task becomes overdue:

```text
Responsible Member
      ↓
Overdue notification
```

V1 does not require automatic overdue notifications to President/Secretary.

They see overdue work through the dashboard.

---

# 24. Deadline Reminder

The system may provide a reminder before an approaching deadline.

Example:

```text
Task due tomorrow.
```

The exact reminder timing should be defined during implementation.

---

# 25. Meeting Notifications

Meeting-related events include:

```text
Meeting scheduled
Meeting reminder
Meeting rescheduled
Meeting cancelled
Follow-up assigned
```

---

# 26. Meeting Scheduled Notification

When a meeting is scheduled and invitations are established:

```text
Meeting scheduled
      ↓
Invited member
      ↓
Notification
```

---

# 27. Meeting Reminder

A meeting reminder can be sent before the scheduled time.

Example:

```text
Committee meeting tomorrow at 6:00 PM.
```

Exact reminder timing is a product configuration.

---

# 28. Meeting Rescheduled Notification

If a meeting time changes:

```text
Meeting updated
      ↓
Affected invitees
      ↓
Notification
```

---

# 29. Meeting Cancellation Notification

If a meeting is cancelled:

```text
Meeting cancelled
      ↓
Affected invitees
      ↓
Notification
```

---

# 30. Donation Notifications

Donation-related events include:

```text
Monthly donation due/pending
Monthly donation reminder
Payment verified
Payment rejected
Donation settled
```

---

# 31. Pending Monthly Donation Reminder

This is a required V1 notification use case.

When a monthly donation is pending/missed:

```text
Member
   ↓
Reminder
```

Preferred channels:

```text
Push
+
SMS/WhatsApp where available
```

---

# 32. Missed Donation Reminder

A missed month remains outstanding.

The notification communicates the outstanding state.

It does not change:

```text
donation status
financial state
```

---

# 33. Donation Reminder Frequency

The final reminder cadence should be configurable during implementation.

The system must avoid sending excessive duplicate reminders.

---

# 34. Donation Reminder Idempotency

The same reminder event should not create uncontrolled duplicates because a worker retried.

Use an event/request identity or equivalent deduplication mechanism.

---

# 35. Payment Verified Notification

When Finance verifies a member payment:

```text
Payment verified
      ↓
Member notification
```

The notification can say:

```text
Your payment has been verified.
Open the app for details.
```

---

# 36. Payment Rejected Notification

If a payment is rejected:

```text
Member notification
```

where appropriate.

The notification should give a safe, useful message without exposing internal finance details.

---

# 37. Donation Completion Notification

When a monthly donation is fully settled:

```text
Member
   ↓
Monthly contribution settled
```

The exact notification wording is implementation/UI work.

---

# 38. Payment Request Notification

When a payment link is generated:

```text
Payment request created
      ↓
Member
      ↓
Push/SMS/WhatsApp where configured
```

---

# 39. Payment Link Expiry Notification

The system may inform a member that an old payment link has expired if this is useful.

It must not imply:

```text
Donation cancelled
```

unless the donation state actually changed.

---

# 40. Expense Notifications

Expense events may include:

```text
Expense added
Expense payment recorded
Expense paid
Expense cancelled
```

---

# 41. President Expense Oversight Notification

When Finance adds an expense:

```text
Finance
   ↓
Expense created
   ↓
President notification
```

This is an oversight notification, not an approval request.

---

# 42. No Expense Approval Notification

V1 does not use:

```text
Expense added
→ President approval required
```

The workflow remains:

```text
Finance operational control
+
President oversight
```

---

# 43. Finance Notifications

Finance may receive notifications for operational events such as:

```text
Payment awaiting verification
Financial issue requiring attention
Relevant expense/payment events
```

The final exact set depends on the finance workflow.

---

# 44. Auditor Notifications

Auditor does not require routine notifications for every financial change.

Where configured, important audit/security events may be surfaced.

The Auditor primarily uses the audit/reporting interface.

---

# 45. Administrative Notifications

Administrative/security events may include:

```text
Role changed
Account deactivated
Important security event
UPI configuration changed
Attendance radius changed
```

Recipients depend on role and event sensitivity.

---

# 46. Authentication/Security Notifications

Security notifications may include:

```text
New security-sensitive login activity
Role changed
User deactivated
Critical administrative change
```

The exact V1 security-event list should be kept focused.

---

# 47. Notification Payload Privacy

Push payloads must not contain unnecessary sensitive information.

Avoid sending:

```text
Full donation history
Bank account details
Payment proof data
Raw GPS coordinates
Audit records
Authentication tokens
```

---

# 48. Safe Push Example

Prefer:

```text
Your monthly contribution is pending.
Open the app to view details.
```

instead of:

```text
September due ₹700, UPI ref ..., bank details ...
```

---

# 49. Deep Links

Notifications may link to relevant screens.

Example:

```text
Notification
   ↓
Task detail
```

or:

```text
Notification
   ↓
Donation/payment detail
```

The destination must still enforce authorization.

---

# 50. Deep-Link Security

A notification deep link must not bypass:

```text
Authentication
Authorization
RLS
```

Opening a link for another user's record must not grant access.

---

# 51. Notification Click Handling

When a user taps a notification:

```text
Check session
      ↓
Check permission
      ↓
Open allowed resource
```

If the user is logged out:

```text
Login
      ↓
Return to authorized target where safe
```

---

# 52. Notification Delivery State

Conceptual channel states:

```text
PENDING
SENT
DELIVERED
FAILED
```

Provider support may differ.

Do not treat provider "sent" as guaranteed user receipt.

---

# 53. Delivery Retry

Retry transient failures where appropriate.

Retries must be:

```text
Bounded
Idempotent
Provider-aware
```

---

# 54. Permanent Failure

If a delivery provider permanently rejects a message:

```text
Do not retry indefinitely.
```

The business event remains unchanged.

---

# 55. Provider Rate Limits

The notification service must respect:

```text
Provider rate limits
Message limits
API quotas
Cost controls
```

Provider-specific limits belong in deployment documentation.

---

# 56. Push Token Management

Mobile/web push may require a device/browser token.

The application should maintain a controlled association:

```text
User
   ↓
Push Token(s)
```

Multiple active devices may exist.

---

# 57. Push Token Rotation

Push tokens may change.

The application should update token records when the provider/device supplies a new token.

Invalid tokens should be marked inactive rather than retried forever.

---

# 58. Multiple Devices

One user may use:

```text
Android
iPhone
Web browser
```

Notification delivery can target active registered endpoints according to policy.

---

# 59. Device Logout

On logout, the application should remove/disable notification associations according to the final token/session design.

The user must not continue receiving protected notifications indefinitely on a device that no longer represents their active session.

---

# 60. Shared Masjid Laptop

The dedicated Masjid laptop requires special attention.

Notifications shown there must not expose another user's private information after logout.

Protected in-app notification state should be cleared when the session ends.

---

# 61. In-App Notification Caching

Protected notification state should be scoped to the authenticated user.

On logout:

```text
Clear protected notification state
```

---

# 62. No Notification Inbox V1

V1 does not require a user-facing permanent notification inbox/history.

Business history remains in:

```text
Tasks
Meetings
Donations
Payments
Finance
Audit
```

---

# 63. Notification Deduplication

The notification system should avoid duplicate notifications caused by:

```text
Worker retry
Webhook retry
API retry
Repeated event processing
```

Use:

```text
event_id
+
recipient
+
channel
```

or equivalent idempotency strategy.

---

# 64. Notification Event Identity

Every business notification event should have a stable identifier.

Example:

```text
NTEVT-2026-000001
```

The exact display format may change.

---

# 65. Event-to-Notification Relationship

Example:

```text
TASK_ASSIGNED
      ↓
Notification Event
      ├── In-App
      └── Push
```

Another:

```text
MONTHLY_DONATION_PENDING
      ↓
Notification Event
      ├── Push
      └── SMS/WhatsApp where available
```

---

# 66. Notification and Transaction Atomicity

The business transaction should not depend on successful external notification delivery.

Recommended pattern:

```text
BEGIN
  update business record
  create notification event/outbox record
COMMIT
      ↓
Delivery worker
      ↓
Push/SMS/WhatsApp
```

This prevents external provider failure from rolling back business state.

---

# 67. Notification Outbox Pattern

A server-side outbox/event approach is recommended for reliable delivery.

Conceptually:

```text
Business Change
      ↓
Notification Outbox
      ↓
Worker
      ↓
Provider
```

---

# 68. Outbox Failure

If the provider is unavailable:

```text
Outbox event remains pending/retryable
```

The underlying business change remains valid.

---

# 69. Business Failure vs Delivery Failure

These must remain separate.

Example:

```text
Expense created successfully
Push failed
```

Result:

```text
Expense = created
Notification = failed/retryable
```

---

# 70. Notification Security

Server-side notification generation must verify:

```text
Recipient
Permission
Entity access
Event sensitivity
```

Do not create notification recipients directly from client input.

---

# 71. Notification and Roles

Role changes may affect future notifications.

Example:

```text
User becomes Finance
→ begins receiving Finance notifications
```

The role is resolved from current authoritative application data.

---

# 72. Deactivated User

A deactivated user should not receive new protected application notifications.

Existing queued notifications should be cancelled/invalidated where appropriate.

---

# 73. Notification Templates

Use controlled templates rather than arbitrary client-generated messages for sensitive events.

Conceptually:

```text
Event Type
   ↓
Template
   ↓
Recipient-specific rendering
```

---

# 74. Localization

V1 notification languages:

```text
English
Hindi
Kannada
Urdu
```

Notifications should follow the user's selected language where supported.

---

# 75. Urdu RTL

Urdu notification rendering must support RTL correctly where the channel allows it.

---

# 76. Localized Dates and Numbers

Notifications should format:

```text
Dates
Times
Amounts
```

according to the user's selected language/locale where practical.

---

# 77. Amount Formatting

Example:

```text
₹500
```

or an appropriately localized monetary representation.

The financial amount itself remains exact in the database.

---

# 78. SMS/WhatsApp Localization

Templates for SMS/WhatsApp should respect the user's language where supported by the provider and message length constraints.

Do not send unnecessarily long financial details.

---

# 79. Notification Translation Source

Notification templates should be stored centrally through the i18n system.

Do not hard-code translated strings independently across every client.

---

# 80. Notification Event Types — V1

Recommended controlled event types:

```text
TASK_ASSIGNED
TASK_CLAIMED
TASK_DEADLINE_SOON
TASK_OVERDUE
TASK_COMPLETED

MEETING_SCHEDULED
MEETING_REMINDER
MEETING_RESCHEDULED
MEETING_CANCELLED

JUMMAH_ATTENDANCE_REMINDER

MONTHLY_DONATION_PENDING
PAYMENT_REQUEST_CREATED
PAYMENT_VERIFIED
PAYMENT_REJECTED
DONATION_SETTLED

EXPENSE_ADDED
EXPENSE_PAID
EXPENSE_CANCELLED

ROLE_CHANGED
ACCOUNT_DEACTIVATED
SECURITY_EVENT
```

The final list may be adjusted during implementation.

---

# 81. Attendance Notifications

V1 may notify eligible users about:

```text
Jummah attendance reminder
Meeting reminder
```

Attendance itself remains authoritative in the attendance record.

---

# 82. No Attendance Success Notification Requirement

A successful attendance record does not require a user-facing notification.

The user can see attendance confirmation directly in the app.

---

# 83. Notification Timing

Time-sensitive notifications should use server/system scheduling.

Examples:

```text
Meeting reminder
Donation reminder
Deadline reminder
```

The implementation must account for timezone.

---

# 84. Time Zone

The application operates for Masjid-e-Mamoor 2 in India.

Server timestamps should remain consistent, while displayed notification times should use the application/user timezone configuration.

---

# 85. Quiet Hours

V1 does not require a complex user-defined quiet-hours system.

Critical notifications should not be delayed solely because of an optional quiet-hours setting unless that setting is explicitly designed and approved.

---

# 86. Notification Cost Control

Because SMS/WhatsApp may incur provider costs:

- Use push as the default where practical.
- Use SMS/WhatsApp for approved high-value use cases.
- Deduplicate reminders.
- Avoid notification loops.
- Avoid repeatedly notifying the same event.

---

# 87. Free-Tier Constraint

The application must not assume that external SMS/WhatsApp delivery has a free production quota.

Provider selection must be made separately.

---

# 88. Notification Provider Failure

If the external provider fails:

```text
Log safe failure information
Retry if transient
Do not alter business state
```

---

# 89. Notification Observability

Operational monitoring should be able to identify:

```text
Event created
Delivery attempted
Delivery succeeded
Delivery failed
Retry count
```

without storing message secrets.

---

# 90. Notification Logging

Logs should not contain:

```text
OTP
Access tokens
Private payment credentials
Service keys
Sensitive raw financial records
Raw GPS coordinates
```

---

# 91. Delivery Metadata

Operational metadata may include:

```text
Provider
Channel
Status
Attempt count
Timestamp
Safe provider response code
```

---

# 92. Notification Audit

Not every notification delivery needs a business audit event.

The business action itself should be audited where required.

Examples:

```text
Payment verified
→ financial audit event

Task completed
→ committee audit event
```

The push delivery itself is normally an operational event.

---

# 93. Notification and Audit Distinction

```text
Audit
=
What happened to the business record?

Notification
=
Who was informed?
```

These are different concerns.

---

# 94. Notification Testing

At minimum test:

1. Task assignment notification.
2. Task completion notification.
3. Overdue task notification.
4. Meeting scheduled notification.
5. Meeting reminder.
6. Meeting reschedule/cancel notification.
7. Donation pending reminder.
8. Payment request notification.
9. Payment verified notification.
10. Payment rejected notification.
11. Expense-added President oversight notification.
12. Role-change notification where enabled.
13. Push token registration.
14. Push token rotation.
15. Invalid token handling.
16. Duplicate event handling.
17. Notification retry.
18. Provider failure.
19. Notification outbox reliability.
20. Logout removes protected notification state.
21. Deactivated user does not receive new protected notifications.
22. Role-based recipient validation.
23. Sensitive data is absent from push payload.
24. i18n English.
25. i18n Hindi.
26. i18n Kannada.
27. i18n Urdu/RTL.
28. Notification deep link authorization.
29. Business operation succeeds despite delivery failure.
30. Shared-laptop user switching does not expose prior user's notification state.

---

# 95. Notification Invariants

The following rules are mandatory:

### Invariant 1

Notifications are communication events, not business truth.

### Invariant 2

Business records remain authoritative.

### Invariant 3

Notification delivery failure does not roll back valid business state.

### Invariant 4

Recipients are determined server-side.

### Invariant 5

Users cannot send arbitrary protected notifications by client manipulation.

### Invariant 6

Sensitive data is minimized in push payloads.

### Invariant 7

OTP, authentication tokens, secrets, and service credentials never appear in notifications.

### Invariant 8

Notification processing is idempotent.

### Invariant 9

Repeated worker/API retries do not create uncontrolled duplicate notifications.

### Invariant 10

Push tokens are managed as changeable endpoints.

### Invariant 11

Invalid push tokens are deactivated rather than retried indefinitely.

### Invariant 12

Deactivated users do not receive new protected application notifications.

### Invariant 13

Notification deep links still require authorization.

### Invariant 14

Notification channels may fail independently.

### Invariant 15

External SMS/WhatsApp delivery is not assumed to be free.

### Invariant 16

Notification events must not contain unnecessary raw GPS information.

### Invariant 17

Notification events do not replace audit events.

### Invariant 18

The application does not require a permanent notification inbox in V1.

### Invariant 19

Notification templates support V1 languages where the channel allows it.

### Invariant 20

Urdu notification rendering supports RTL where applicable.

### Invariant 21

Business transaction success does not depend on push/SMS/WhatsApp delivery.

### Invariant 22

Notification cost is controlled through deduplication and event-specific delivery.

---

# 96. Acceptance Criteria

The Notification System is implementation-ready when it can:

- Generate event-driven notifications.
- Deliver in-app notifications.
- Deliver push notifications.
- Support SMS/WhatsApp adapters where configured.
- Notify task assignees.
- Notify for task deadlines/overdue work.
- Notify meeting invitees/reminders.
- Notify members about pending/missed monthly donations.
- Notify members about payment verification results.
- Notify President of new expenses for oversight.
- Handle role/security notifications where required.
- Protect notification recipients by role.
- Avoid sensitive data in push payloads.
- Support deep links without bypassing authorization.
- Handle push-token lifecycle.
- Retry transient failures safely.
- Deduplicate repeated events.
- Use an outbox/reliable delivery pattern.
- Preserve business state when notification delivery fails.
- Support English, Hindi, Kannada, and Urdu where channel capabilities permit.
- Support Urdu RTL where applicable.
- Protect shared-device notification state.
- Avoid uncontrolled SMS/WhatsApp costs.

---

# 97. Implementation Boundary

This document defines notification behavior.

The following belong elsewhere:

```text
Business event source       → Relevant feature document
Task events                 → COMMITTEE_WORK_MANAGEMENT.md
Meeting events              → MEETING_MANAGEMENT.md
Donation events             → DONATION_SYSTEM.md
Payment events              → PAYMENT_SYSTEM.md
Expense events              → EXPENSE_SYSTEM.md
Attendance events           → ATTENDANCE_SYSTEM.md
Audit trail                 → AUDIT_LOG_MODEL.md
Authentication              → AUTHENTICATION.md
i18n                        → INTERNATIONALIZATION.md
Database                    → DATABASE_SCHEMA.md
Security/RLS                → SECURITY_ARCHITECTURE.md
Push/provider infrastructure → TECHNOLOGY_STACK.md / DEPLOYMENT.md
```

---

# 98. Related Documents

- `PROJECT_OVERVIEW.md`
- `PRODUCT_REQUIREMENTS.md`
- `FEATURE_SCOPE.md`
- `USER_ROLES_PERMISSIONS.md`
- `AUTHENTICATION.md`
- `MEMBER_MANAGEMENT.md`
- `DONATION_SYSTEM.md`
- `PAYMENT_SYSTEM.md`
- `FINANCE_SYSTEM.md`
- `EXPENSE_SYSTEM.md`
- `COMMITTEE_DATA_MODEL.md`
- `COMMITTEE_WORK_MANAGEMENT.md`
- `MEETING_MANAGEMENT.md`
- `ATTENDANCE_SYSTEM.md`
- `AUDIT_LOG_MODEL.md`
- `DATABASE_SCHEMA.md`
- `DATA_RELATIONSHIPS.md`
- `INTERNATIONALIZATION.md`
- `SECURITY_ARCHITECTURE.md`
- `DEPLOYMENT.md`
- `MONITORING.md`

---

## Document Status

**Notification System — V1 Implementation Baseline**

This document defines the authoritative notification architecture and event-delivery behavior for Masjid-e-Mamoor 2.

All notification implementation must preserve business-state independence, privacy, authorization, deduplication, localization, and delivery-reliability invariants.
