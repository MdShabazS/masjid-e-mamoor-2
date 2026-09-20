# Masjid-e-Mamoor 2 — Audit Log Model

**Document Status:** V1 Implementation Baseline  
**Version:** 1.0  
**Product:** Masjid-e-Mamoor 2 Internal Management Application  
**Scope:** V1  
**Database:** PostgreSQL via Supabase  
**Last Updated:** 2026-09-17

---

# 1. Purpose

This document defines the audit-log model for Masjid-e-Mamoor 2.

The audit system exists to answer:

```text
Who did what?
When did they do it?
To which record?
What changed?
Why was it changed?
```

The audit trail is especially important for:

- Financial transparency
- Role/permission changes
- Referral attribution
- Donation configuration
- Expense/payment changes
- Account configuration
- Committee accountability
- Meeting/decision changes
- Sensitive administrative actions

The audit system is an evidence trail.

It is not a general application event log and it is not a replacement for the authoritative business records.

---

# 2. Audit Design Principles

The audit model follows these principles:

1. Audit records are append-oriented and should not normally be edited.
2. The actor is identified by stable User ID.
3. Audit timestamps are server-controlled.
4. Sensitive business actions must generate audit events.
5. Financial actions receive stronger audit coverage than ordinary reads.
6. Audit records must identify the affected entity.
7. Important before/after information should be retained where needed.
8. Audit records must not store passwords, OTPs, secrets, or access tokens.
9. Failed sensitive actions may be audited where security value justifies it.
10. Audit history must survive ordinary business-record changes.
11. Audit data must be protected with strict read/write permissions.
12. Audit records are not used to create employee-style performance scores or rankings.

---

# 3. Audit Log vs Application Log

These are separate systems.

## Audit Log

Answers:

```text
Who changed a business record?
```

Examples:

```text
Finance verified donation
President changed referral attribution
Finance changed UPI ID
President deleted financial transaction
Committee Member completed task
```

## Application Log

Answers:

```text
Did the software/service encounter an operational event or error?
```

Examples:

```text
API error
Database connection failure
Push notification provider timeout
Background job failure
```

Application logs may be retained differently.

Audit logs are business-control records.

---

# 4. Audit Scope

V1 audit coverage includes:

```text
A. Authentication/security-sensitive events
B. Role and permission changes
C. Member/referral changes
D. Donation/payment changes
E. Financial account changes
F. Expense/payment changes
G. Transfer/adjustment changes
H. Committee task changes
I. Meeting/decision changes
J. Important configuration changes
```

---

# 5. Audit Event Structure

Conceptually:

```text
audit_log
│
├── actor
├── action
├── entity
├── entity_id
├── timestamp
├── result
├── before
├── after
├── reason
├── request context
└── metadata
```

The final physical schema is defined in:

```text
DATABASE_SCHEMA.md
```

---

# 6. Core Audit Fields

Recommended conceptual fields:

```text
id
event_id
occurred_at
actor_user_id
actor_role
action
entity_type
entity_id
result
reason
before_data
after_data
metadata
request_id
created_at
```

Not every field must contain a value for every event.

---

# 7. Audit Event Identity

Every audit event receives a stable system-generated ID.

Example:

```text
AUD-2026-000001
```

Database identity should use a UUID or equivalent stable key.

The display reference may use a human-readable sequence.

---

# 8. Actor Identity

The primary actor field is:

```text
actor_user_id
```

Do not use the user's name as the authoritative actor identifier.

Names can change.

---

# 9. Actor Role Snapshot

Where useful, record the actor's role at event time.

Example:

```text
actor_role = FINANCE
```

This provides historical context if the user's role changes later.

The User ID remains the authoritative identity.

---

# 10. System Actor

Some actions may be performed by the application itself.

Example:

```text
Monthly donation record generation
```

For automated events:

```text
actor_type = SYSTEM
```

or an equivalent dedicated system actor representation may be used.

The event should still identify that the action was automated.

---

# 11. Action

An action describes what happened.

Examples:

```text
CREATE
UPDATE
DELETE
VERIFY
REJECT
ASSIGN
CLAIM
COMPLETE
CANCEL
DEACTIVATE
ACTIVATE
CONFIGURE
LOGIN
LOGOUT
```

The final action vocabulary should remain controlled rather than allowing arbitrary client strings.

---

# 12. Entity Type

The event identifies the affected business entity.

Examples:

```text
USER
MEMBER
REFERRAL
DONATION_TERM
MONTHLY_DONATION
PAYMENT
FINANCIAL_TRANSACTION
FINANCIAL_ACCOUNT
EXPENSE
EXPENSE_PAYMENT
TRANSFER
TASK
TASK_ASSIGNMENT
TASK_PROGRESS
MEETING
DECISION
ATTENDANCE
UPI_CONFIGURATION
```

Only supported entity types should be accepted.

---

# 13. Entity ID

Where an event affects one business entity, store:

```text
entity_id
```

using the stable internal record ID.

Examples:

```text
task UUID
expense UUID
member UUID
financial transaction UUID
```

Do not depend only on human-readable display references.

---

# 14. Event Result

An event can indicate whether an action succeeded.

Conceptually:

```text
SUCCESS
FAILURE
DENIED
```

Successful state changes are mandatory audit candidates.

Security-sensitive denied actions may also be recorded.

---

# 15. Event Timestamp

Use:

```text
occurred_at
```

generated by the server/database.

The authoritative audit clock must not depend on the user's device time.

---

# 16. Created At

The audit row may also have a database-managed:

```text
created_at
```

For most purposes this will be equivalent to the event timestamp.

Keep the semantics explicit rather than relying on client-provided timestamps.

---

# 17. Before and After State

For important update events, the audit record may capture:

```text
before_data
after_data
```

Example:

```text
Before:
monthly_amount = 500

After:
monthly_amount = 700
```

This makes important corrections understandable.

---

# 18. Do Not Store Full Row Blindly

Before/after data should be deliberate.

Do not automatically serialize every database column into the audit record.

This prevents:

- Secret leakage
- Unnecessary storage growth
- Sensitive data duplication
- Excessive audit size

Store the minimum useful change context.

---

# 19. Changed Fields

For updates, it may be useful to store:

```text
changed_fields
```

Example:

```json
["monthly_amount", "effective_month"]
```

This helps identify exactly what changed without requiring a full row snapshot.

---

# 20. Reason

Some high-risk actions require a reason.

Examples:

```text
Financial transaction correction
Financial transaction deletion
Expense cancellation
Expense amount correction
Referral attribution correction
```

Reason is mandatory where the business rule requires it.

---

# 21. Request ID

A request/correlation ID is recommended.

Example:

```text
request_id
```

This helps connect:

```text
API request
→ database change
→ audit event
→ notification
```

It is especially useful when debugging or investigating a sensitive event.

---

# 22. Client Context

Where useful, metadata may capture:

```text
platform = web / android / ios
app_version
```

This is operational context only.

It must not become the source of truth for time or authorization.

---

# 23. IP Address

IP address may be recorded for selected security-sensitive events if the deployment/privacy requirements justify it.

V1 should avoid collecting unnecessary network metadata.

If stored, access must be restricted.

---

# 24. Device Information

Exact device identifiers are not required for the general V1 audit model.

Do not collect persistent device identifiers merely because they are technically available.

---

# 25. Authentication Audit Events

Security-sensitive authentication events may be audited.

Examples:

```text
LOGIN_SUCCESS
LOGIN_FAILURE
LOGOUT
OTP_REQUEST
OTP_VERIFICATION_FAILURE
```

The exact frequency/retention of authentication events may differ from business audit events.

OTP values themselves must never be stored.

---

# 26. Authorization Audit Events

Record significant permission-related events such as:

```text
ROLE_ASSIGNED
ROLE_CHANGED
ROLE_REMOVED
USER_DEACTIVATED
USER_REACTIVATED
```

These are high-value administrative actions.

---

# 27. Role Change Audit

When a user role changes:

```text
Before Role
New Role
Changed By
Changed At
```

must be traceable.

Example:

```text
Committee Member
→ Secretary
```

---

# 28. Member Audit Events

Important member changes may include:

```text
MEMBER_CREATED
MEMBER_UPDATED
MEMBER_DEACTIVATED
MEMBER_REACTIVATED
```

Do not log every ordinary read.

---

# 29. Referral Audit Events

At minimum:

```text
REFERRAL_CREATED
REFERRER_CHANGED
```

Referral attribution changes are especially important because they affect committee contribution reporting.

---

# 30. Referral Change Example

```text
Member: X

Previous Referrer: A
New Referrer: B

Changed By: President
Reason: correction
Timestamp: server time
```

The audit trail preserves this correction.

---

# 31. Monthly Donation Configuration Audit

Changes to the agreed monthly contribution must be auditable.

Example:

```text
500
→
700
```

Record:

```text
member
previous amount
new amount
effective month
actor
timestamp
```

---

# 32. Historical Donation Integrity

A later monthly amount change must not rewrite previous monthly records.

The audit system should show configuration changes without replacing historical donation amounts.

---

# 33. Payment Audit Events

Important payment events include:

```text
PAYMENT_CREATED
PAYMENT_VERIFIED
PAYMENT_REJECTED
PAYMENT_ALLOCATED
PAYMENT_CORRECTED
```

The exact event set may be consolidated during implementation.

---

# 34. Payment Verification Audit

Finance verification should record:

```text
Payment
Amount
Reference
Verified By
Verified At
Result
```

The audit event must correspond to the actual verified payment state.

---

# 35. Duplicate Verification

An attempt to verify an already verified payment should not create a second financial posting.

A duplicate attempt may produce a security/business audit event where useful.

---

# 36. Financial Transaction Audit Events

The minimum high-risk events include:

```text
FINANCIAL_TRANSACTION_CREATED
FINANCIAL_TRANSACTION_CORRECTED
FINANCIAL_TRANSACTION_DELETED
```

Internal transfers and adjustments should also generate appropriate audit events.

---

# 37. Financial Deletion Audit

Because only President may permanently delete a financial transaction, deletion must be strongly audited.

Record:

```text
Transaction ID
Transaction reference
Amount
Account
Actor
Actor role
Reason/context where applicable
Timestamp
```

Do not rely on the deleted row itself to preserve evidence.

---

# 38. Financial Correction Audit

For a correction:

```text
Previous Value
New Value
Reason
Actor
Timestamp
Transaction ID
```

must remain available in the audit record.

---

# 39. Account Audit Events

Important account events:

```text
ACCOUNT_CREATED
ACCOUNT_UPDATED
ACCOUNT_DEACTIVATED
ACCOUNT_REACTIVATED
OPENING_BALANCE_SET
```

Any event affecting account configuration or financial baseline should be traceable.

---

# 40. UPI Configuration Audit

UPI configuration changes must be audited.

Example:

```text
Old UPI ID
New UPI ID
Changed By
Changed At
```

Do not rewrite historical payment requests.

---

# 41. Expense Audit Events

Important expense events include:

```text
EXPENSE_CREATED
EXPENSE_UPDATED
EXPENSE_CANCELLED
EXPENSE_AMOUNT_CORRECTED
```

---

# 42. Expense Payment Audit Events

Important payment events include:

```text
EXPENSE_PAYMENT_CREATED
EXPENSE_PAYMENT_UPDATED
EXPENSE_PAYMENT_CANCELLED
PAYMENT_PROOF_ADDED
PAYMENT_PROOF_REPLACED
PAYMENT_PROOF_DELETED
```

Only applicable events should be generated.

---

# 43. Expense Amount Correction

A correction should record:

```text
Original Amount
New Amount
Reason
Actor
Timestamp
Expense ID
```

The same expense identity remains intact.

---

# 44. Expense Cancellation

Cancellation requires the cancellation reason.

Audit should preserve:

```text
Expense
Previous Status
New Status = CANCELLED
Reason
Actor
Timestamp
```

---

# 45. Transfer Audit

Internal transfers should record:

```text
Transfer ID
Source Account
Destination Account
Amount
Actor
Timestamp
```

The audit trail must make the two account movements traceable to one transfer.

---

# 46. Adjustment Audit

Adjustments are high-risk operations.

Audit should include:

```text
Amount
Direction
Account
Reason
Actor
Timestamp
```

---

# 47. Committee Task Audit Events

Important task events include:

```text
TASK_CREATED
TASK_ASSIGNED
TASK_CLAIMED
TASK_REASSIGNED
TASK_STARTED
TASK_COMPLETED
TASK_EDITED
```

The final event vocabulary should remain controlled.

---

# 48. Task Claim Audit

When an open task is claimed:

```text
Task
Claimed By
Claimed At
```

must be traceable.

Atomic task claiming remains a database rule; the audit event records the successful result.

---

# 49. Completed Task Edit Audit

When a Committee Member edits their own completed work record:

```text
Task ID
Edited By
Changed Fields
Previous Values where needed
New Values where needed
Timestamp
```

must be recorded.

---

# 50. Completed Work Deletion

Committee Members cannot delete completed work.

A denied deletion attempt may be recorded as a security event where useful.

No successful deletion event should exist for an unauthorized user.

---

# 51. Meeting Audit Events

Important meeting events include:

```text
MEETING_CREATED
MEETING_UPDATED
MEETING_CANCELLED
```

---

# 52. Meeting Attendance Audit

Important attendance changes may include:

```text
MEETING_ATTENDANCE_MARKED
MEETING_ATTENDANCE_CORRECTED
```

Attendance is operationally important but should not generate excessive redundant logs.

---

# 53. Decision Audit Events

Important events:

```text
DECISION_CREATED
DECISION_UPDATED
```

If a decision creates a follow-up task, the task itself receives its own audit record.

---

# 54. Configuration Audit Events

Important system configuration changes may include:

```text
ATTENDANCE_RADIUS_CHANGED
LANGUAGE_CONFIGURATION_CHANGED
NOTIFICATION_CONFIGURATION_CHANGED
UPI_CONFIGURATION_CHANGED
EXPENSE_CATEGORY_CHANGED
```

Only approved configurable settings should be logged.

---

# 55. What Should Not Be Audited as Full Events

Do not generate full audit rows for every:

```text
Dashboard view
Normal page open
Search query
List pagination
Routine read
```

unless a specific security/privacy requirement later justifies it.

---

# 56. Financial Reads

Certain financial reports or record views may later require access logging.

V1 business audit should primarily focus on:

```text
financial state changes
```

rather than every financial read.

---

# 57. Audit Categories

A category field can simplify filtering:

```text
AUTH
AUTHORIZATION
MEMBER
REFERRAL
DONATION
PAYMENT
FINANCE
EXPENSE
TRANSFER
COMMITTEE
MEETING
ATTENDANCE
CONFIGURATION
SECURITY
```

The final list should remain controlled.

---

# 58. Audit Severity

Optional severity classification:

```text
INFO
IMPORTANT
CRITICAL
```

Suggested use:

```text
Routine business change → INFO
Referral/role/config change → IMPORTANT
Financial deletion/critical security action → CRITICAL
```

Severity must not be treated as a ranking of people.

---

# 59. Audit Storage

Audit records should remain in PostgreSQL.

Avoid storing the primary audit trail only in external logging infrastructure.

External logs may supplement the database but must not replace business audit history.

---

# 60. Audit Immutability

Normal application users must not have an edit API for audit records.

Conceptually:

```text
CREATE audit event
        ↓
READ audit event
        ↓
No ordinary UPDATE
No ordinary DELETE
```

---

# 61. Audit Write Authority

Audit creation should be server-controlled.

Clients must not be able to submit arbitrary:

```text
actor_user_id
action
before_data
after_data
```

and have the system trust them.

The server derives audit context from the authenticated action.

---

# 62. Database-Level Protection

Where practical:

- Restrict direct audit table writes.
- Restrict direct audit updates.
- Restrict direct audit deletes.
- Use server-side functions/triggers/services as appropriate.
- Protect with PostgreSQL RLS where supported.

---

# 63. RLS Requirements

Recommended direction:

```text
Ordinary Member
→ no audit access

Committee Member
→ no unrestricted audit access

Auditor
→ financial/audit review according to role permissions

President
→ broad audit access

Finance
→ relevant finance audit access

Server-side audit writer
→ append capability
```

The final permission matrix is defined in the security/authorization documents.

---

# 64. Audit Visibility

The UI should expose audit data only to roles that need it.

Examples:

```text
President → broad administrative audit
Auditor   → financial audit review
Finance   → relevant financial history
```

The exact scope follows the role-permission model.

---

# 65. Financial Audit vs Security Audit

The application should distinguish:

## Financial audit

Focuses on money:

```text
Transactions
Payments
Expenses
Transfers
Corrections
Accounts
```

## Security/administrative audit

Focuses on control:

```text
Role changes
User deactivation
Sensitive configuration
Authorization failures
```

Both may use the same underlying audit framework with different categories.

---

# 66. Audit Trail Relationships

Example financial chain:

```text
Expense
   ↓
Expense Payment
   ↓
Financial Transaction
   ↓
Audit Event
```

Example committee chain:

```text
Meeting
   ↓
Decision
   ↓
Task
   ↓
Completion
   ↓
Audit Event
```

Example referral chain:

```text
Referral
   ↓
Referrer Change
   ↓
Audit Event
```

---

# 67. Audit and Notifications

Audit is not notification history.

For example:

```text
Expense created
   ├── Audit record
   └── President notification
```

If notification delivery fails, the audit event still exists.

---

# 68. Audit and Business Records

Audit records do not replace business data.

Example:

```text
Task table
→ current task state

Audit table
→ task state changes and important actions
```

Both may be required.

---

# 69. Audit and Deletion

Business record deletion does not imply audit deletion.

Example:

```text
Financial transaction deleted
        ↓
Audit event remains
```

This is critical for financial transparency.

---

# 70. Deletion Evidence

When a deleted record can no longer be queried, the audit event must retain enough safe identifying information to understand what happened.

For financial records, that may include:

```text
transaction reference
amount
account reference
action
actor
timestamp
```

Do not store secrets.

---

# 71. Sensitive Data Restrictions

Never store in audit logs:

```text
Passwords
OTP codes
Access tokens
Refresh tokens
Private keys
Service-role keys
Payment secrets
Full authentication credentials
```

Sensitive personal data should be duplicated only when necessary for legitimate audit interpretation.

---

# 72. Personal Data Minimization

Prefer references:

```text
user_id
member_id
account_id
```

over repeatedly copying entire personal profiles into every audit event.

---

# 73. Before/After Data Redaction

Before and after snapshots must be sanitized.

For example, if a user profile contains an authentication secret:

```text
Do not copy it into before_data or after_data.
```

---

# 74. Audit Event Example — Referral Correction

```text
Event:
REFERRER_CHANGED

Entity:
MEMBER / REFERRAL

Before:
referrer = User A

After:
referrer = User B

Reason:
Incorrect attribution

Actor:
President

Timestamp:
Server time
```

---

# 75. Audit Event Example — Monthly Amount Change

```text
Event:
DONATION_TERM_UPDATED

Entity:
MEMBER

Before:
₹500 effective July

After:
₹700 effective September

Actor:
Secretary

Timestamp:
Server time
```

Past monthly records remain unchanged.

---

# 76. Audit Event Example — Financial Deletion

```text
Event:
FINANCIAL_TRANSACTION_DELETED

Transaction:
TX-2026-000123

Amount:
₹4,000

Account:
Cash

Actor:
President

Timestamp:
Server time
```

The deleted transaction's audit evidence remains.

---

# 77. Audit Event Example — Task Completion

```text
Event:
TASK_COMPLETED

Task:
TASK-2026-000041

Responsible:
Committee Member A

Completed At:
Server time

Actor:
Committee Member A
```

---

# 78. Audit Event Example — Role Change

```text
Event:
ROLE_CHANGED

User:
User X

Before:
Committee Member

After:
Secretary

Actor:
President

Timestamp:
Server time
```

---

# 79. Audit Query Requirements

Authorized audit views should support filtering by:

```text
Date/range
Actor
Action
Entity type
Entity ID
Category
Result
Severity
```

Financial audit views may additionally filter by:

```text
Account
Transaction reference
Expense reference
Payment reference
```

---

# 80. Audit Search

Search should be based on indexed identifiers and controlled fields.

Common searches:

```text
TX-2026-000123
TASK-2026-000041
Member UUID
User ID
Transfer ID
```

---

# 81. Audit Indexing

Recommended indexes include:

```text
audit_log(occurred_at)
audit_log(actor_user_id)
audit_log(action)
audit_log(entity_type, entity_id)
audit_log(category)
audit_log(result)
```

Additional indexes should be based on real query patterns.

---

# 82. Audit Pagination

Audit data should be paginated.

Do not attempt to load the entire audit history into a browser/mobile screen.

---

# 83. Audit Export

Authorized users may export audit/financial audit reports where required.

Exports should themselves be generated from current authorized data.

Generated export files should normally be temporary unless retention is explicitly required.

---

# 84. Audit PDF

A financial audit PDF may contain:

- Reporting period
- Financial summary
- Transaction references
- Relevant audit details
- Generation timestamp
- Page numbers

The PDF is a report artifact, not the primary audit database.

---

# 85. Audit Retention

Audit records for financial and critical administrative actions should be retained for the life of the relevant business history unless a future formal retention policy requires otherwise.

Do not purge audit records merely to save storage.

---

# 86. Audit Storage Optimization

Because audit records are text-heavy but normally lightweight:

- Use compact structured JSON where appropriate.
- Avoid duplicating large files.
- Store references instead of binary documents.
- Store only necessary before/after fields.
- Do not generate permanent PDF copies of every event.

Storage savings must not compromise critical financial audit history.

---

# 87. Audit Integrity

The application should be able to demonstrate:

```text
Business action
      ↓
Authoritative record
      ↓
Audit event
```

For critical financial actions, missing audit evidence should be treated as an implementation defect.

---

# 88. Atomic Business Change + Audit

For critical actions, the ideal transaction pattern is:

```text
BEGIN
  change business data
  create audit record
COMMIT
```

If either the business change or required audit event fails, the transaction should fail together.

This prevents:

```text
Money changed
but no audit record
```

---

# 89. Financial Transaction Example

A donation verification may perform:

```text
1. Verify payment
2. Allocate payment
3. Update donation status
4. Create financial transaction
5. Update account balance
6. Create audit event
```

These required state changes should be handled transactionally where possible.

---

# 90. Task Claim Example

Open task claim:

```text
1. Check task still open
2. Atomically assign claimant
3. Record claim
4. Create audit event
5. Commit
```

If another user already claimed it:

```text
No duplicate claimant
No false success audit event
```

---

# 91. Referral Correction Example

Referral correction:

```text
1. Check President authorization
2. Read current referrer
3. Change referrer
4. Create audit event with before/after
5. Commit
```

---

# 92. Audit Failure Handling

Critical business actions should not silently succeed when required audit writing fails.

The exact implementation may choose:

```text
Transaction rollback
```

or another controlled fail-safe.

But the system must never falsely indicate a fully audited financial change when the required audit event was not recorded.

---

# 93. Failed Action Auditing

Not every failed request needs a permanent audit row.

However, security-sensitive failures may be worth recording:

```text
Unauthorized financial deletion attempt
Unauthorized role change attempt
Repeated authentication failure
```

This should be controlled to avoid audit noise.

---

# 94. Audit Event Naming

Use predictable machine-readable event names.

Recommended pattern:

```text
<ENTITY>_<ACTION>
```

Examples:

```text
EXPENSE_CREATED
PAYMENT_VERIFIED
TASK_COMPLETED
ROLE_CHANGED
REFERRER_CHANGED
```

Avoid free-form user-entered event names.

---

# 95. Audit Versioning

The audit event schema may include:

```text
schema_version
```

This allows future evolution without making historical records ambiguous.

---

# 96. Time Zone

The system should store timestamps in a consistent server representation such as UTC.

The UI may render local time for users.

For reports, the relevant reporting period should be interpreted consistently.

---

# 97. Date vs Timestamp

Use the appropriate type for the meaning:

```text
transaction_date → financial business date
occurred_at       → exact audit timestamp
```

Do not replace exact event timestamps with only calendar dates.

---

# 98. Audit Data Model Relationship

Conceptually:

```text
User
 └── audit events

Business Entity
 └── audit events

Audit Event
 ├── actor
 ├── action
 ├── entity
 ├── result
 ├── before
 ├── after
 └── metadata
```

This gives one consistent audit framework across the application.

---

# 99. Minimum V1 Audit Event Matrix

| Area | Event examples | Audit priority |
|---|---|---|
| Role management | Role changed, user deactivated | Critical |
| Referral | Created, referrer changed | Important |
| Donation configuration | Monthly amount changed | Important |
| Payment | Verified, rejected | Critical |
| Financial transaction | Created, corrected, deleted | Critical |
| Account | Created, changed, deactivated | Critical |
| UPI | UPI ID changed | Critical |
| Expense | Created, cancelled, amount corrected | Critical |
| Expense payment | Added, changed, proof changed | Critical |
| Transfer | Created | Critical |
| Adjustment | Created/corrected | Critical |
| Task | Assigned, claimed, completed, edited | Important |
| Meeting | Created/updated | Important |
| Decision | Created/updated | Important |
| Attendance | Important corrections | Important |
| Authentication | Security-sensitive events | Important |

---

# 100. Audit Invariants

The following rules are mandatory:

### Invariant 1

Audit events use stable system-generated IDs.

### Invariant 2

Actor identity is server-derived from the authenticated action.

### Invariant 3

Audit timestamps are server-controlled.

### Invariant 4

Clients cannot arbitrarily create audit data by submitting fake actor/action information.

### Invariant 5

Normal users cannot edit audit records.

### Invariant 6

Normal users cannot delete audit records.

### Invariant 7

Critical financial actions have corresponding audit events.

### Invariant 8

Financial deletion leaves audit evidence.

### Invariant 9

Referral attribution changes are auditable.

### Invariant 10

Role changes are auditable.

### Invariant 11

Financial corrections record the relevant before/after context and reason.

### Invariant 12

Required audit events are created transactionally with critical business changes where practical.

### Invariant 13

Audit logs do not contain passwords, OTPs, access tokens, refresh tokens, or service secrets.

### Invariant 14

Audit logs do not replace authoritative business records.

### Invariant 15

Notifications do not replace audit records.

### Invariant 16

Internal transfers remain traceable through one Transfer ID.

### Invariant 17

Completed committee work cannot be silently removed without the appropriate controlled action and audit trail.

### Invariant 18

Audit history is not purged solely for storage optimization.

---

# 101. Security Requirements

The audit subsystem must:

- Use server-side authorization.
- Apply PostgreSQL RLS where appropriate.
- Keep privileged service credentials server-side.
- Protect financial audit information.
- Restrict audit exports.
- Prevent arbitrary client-written audit fields.
- Protect audit files/exports from public access.

---

# 102. Testing Requirements

At minimum test:

1. Successful role change creates audit event.
2. Referral creation creates audit event.
3. Referral correction records before/after.
4. Monthly amount change is audited.
5. Payment verification creates audit event.
6. Financial transaction creation is audited.
7. Financial deletion is President-only and audited.
8. Financial correction records reason.
9. UPI change is audited.
10. Expense creation is audited.
11. Expense cancellation is audited.
12. Expense amount correction is audited.
13. Transfer creates a traceable audit event.
14. Task assignment is audited.
15. Task claim is audited.
16. Task completion is audited.
17. Completed task edit records actor/time.
18. Meeting/decision changes are audited.
19. Unauthorized audit modification is rejected.
20. Audit records do not contain authentication secrets.
21. Critical business change rolls back when required audit creation fails.
22. Audit history remains after relevant business-record deletion where required.

---

# 103. Implementation Boundary

This document defines the business-level audit model.

The following belong elsewhere:

```text
Physical SQL tables          → DATABASE_SCHEMA.md
Foreign-key relationships    → DATA_RELATIONSHIPS.md
Financial semantics          → FINANCIAL_DATA_MODEL.md
Role permissions             → USER_ROLES_PERMISSIONS.md
Authentication               → AUTHENTICATION.md
Security controls            → SECURITY_ARCHITECTURE.md
Privacy rules                → DATA_PRIVACY.md
UI screens                   → SCREEN_SPECIFICATIONS.md
Deployment/operations        → DEPLOYMENT.md
```

---

# 104. Completion Criteria

The audit system is implementation-ready when it can reliably:

- Identify the actor
- Identify the action
- Identify the affected entity
- Record server timestamp
- Record success/failure where applicable
- Record reason where required
- Record important before/after state
- Preserve critical financial events
- Preserve role/referral changes
- Preserve committee accountability events
- Prevent unauthorized audit modification
- Avoid storing secrets
- Support efficient audit search/filtering
- Survive ordinary business-record deletion/correction where required

---

# 105. Related Documents

- `PROJECT_OVERVIEW.md`
- `PRODUCT_REQUIREMENTS.md`
- `FEATURE_SCOPE.md`
- `USER_ROLES_PERMISSIONS.md`
- `SYSTEM_ARCHITECTURE.md`
- `APPLICATION_ARCHITECTURE.md`
- `BACKEND_ARCHITECTURE.md`
- `SECURITY_ARCHITECTURE.md`
- `DATABASE_ARCHITECTURE.md`
- `DATABASE_SCHEMA.md`
- `DATA_RELATIONSHIPS.md`
- `FINANCIAL_DATA_MODEL.md`
- `COMMITTEE_DATA_MODEL.md`
- `AUTHENTICATION.md`
- `REPORTING_AND_AUDIT.md`
- `DATA_PRIVACY.md`
- `SECURITY_CHECKLIST.md`

---

## Document Status

**Audit Log Model — V1 Implementation Baseline**

This document defines the authoritative audit model for Masjid-e-Mamoor 2.

Critical financial and administrative actions must remain traceable through this audit framework.
