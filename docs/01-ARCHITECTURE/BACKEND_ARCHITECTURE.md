# Masjid-e-Mamoor 2 — Backend Architecture

**Document Status:** Baseline  
**Version:** 1.0  
**Product:** Masjid-e-Mamoor 2 Internal Management Application  
**Scope:** V1  
**Last Updated:** 2026-09-17

---

## 1. Purpose

This document defines the backend architecture for the Masjid-e-Mamoor 2 application.

The backend is the authoritative application layer responsible for:

- Authentication integration
- Authorization
- Business rules
- Validation
- Database operations
- Financial integrity
- Donation workflows
- Committee workflows
- Attendance validation
- File access control
- Notifications
- Reporting
- Audit logging
- Background jobs
- External service integration

This document is technology-neutral. Specific runtime/framework/provider choices belong in:

- `BACKEND_FRAMEWORK.md`
- `TECHNOLOGY_STACK.md`
- `DATABASE_ARCHITECTURE.md`
- `HOSTING_CLOUD_INFRASTRUCTURE.md`

---

# 2. Backend Architecture Goals

The backend must prioritize:

1. Financial correctness
2. Authorization enforcement
3. Data integrity
4. Auditability
5. Reliable cross-module transactions
6. Idempotent operations
7. Secure external integrations
8. Maintainability
9. Cost efficiency
10. Clear separation of responsibilities

---

# 3. Backend Architecture Model

Conceptually:

```text
                 ┌──────────────────────────────┐
                 │       WEB / MOBILE CLIENTS   │
                 └──────────────┬───────────────┘
                                │
                                ▼
                 ┌──────────────────────────────┐
                 │       API / ENTRY LAYER      │
                 │ Routing / Request Handling   │
                 └──────────────┬───────────────┘
                                │
                                ▼
                 ┌──────────────────────────────┐
                 │     AUTH + AUTHORIZATION     │
                 └──────────────┬───────────────┘
                                │
                                ▼
                 ┌──────────────────────────────┐
                 │     APPLICATION SERVICES     │
                 └──────────────┬───────────────┘
                                │
              ┌─────────────────┼────────────────────┐
              │                 │                    │
              ▼                 ▼                    ▼
       ┌────────────┐   ┌──────────────┐    ┌──────────────┐
       │ Domain     │   │ Transaction  │    │ Integration  │
       │ Modules    │   │ / Unit of    │    │ Services     │
       │            │   │ Work         │    │              │
       └──────┬─────┘   └──────┬───────┘    └──────┬───────┘
              │                │                   │
              └────────────────┼───────────────────┘
                               │
                               ▼
                 ┌──────────────────────────────┐
                 │       DATA ACCESS LAYER      │
                 └──────────────┬───────────────┘
                                │
                                ▼
                 ┌──────────────────────────────┐
                 │ DATABASE / FILE STORAGE      │
                 └──────────────────────────────┘
```

---

# 4. Backend Layers

The backend should logically contain the following layers.

## 4.1 Entry / Transport Layer

Responsible for:

- HTTP/API routing
- Request parsing
- Authentication context extraction
- Input handling
- Response formatting
- Rate limiting integration

It should not contain complex business rules.

---

## 4.2 Application Service Layer

Responsible for orchestrating business operations.

Examples:

- Register member
- Verify donation
- Add expense
- Record payment
- Claim task
- Schedule meeting
- Mark Jummah attendance
- Generate report

This layer coordinates relevant domain modules and shared services.

---

## 4.3 Domain Layer

Contains business rules and domain behavior.

Domains include:

- Users
- Members
- Referrals
- Donations
- Payments
- Finance
- Expenses
- Committee
- Meetings
- Attendance
- Reports
- Audit
- Notifications
- Settings

---

## 4.4 Data Access Layer

Responsible for:

- Database queries
- Transactions
- Persistence
- Query composition
- Mapping persistence data to domain/application models

Business logic should not be scattered across raw database queries.

---

## 4.5 Infrastructure / Integration Layer

Responsible for external systems:

- OTP provider
- Push notification provider
- SMS/WhatsApp provider
- UPI/payment integration
- Object storage
- PDF/rendering services
- Monitoring

External providers should be isolated behind application interfaces where practical.

---

# 5. Logical Backend Modules

```text
backend/
│
├── auth
├── users
├── members
├── referrals
├── donations
├── payments
├── finance
├── expenses
├── committee
├── meetings
├── attendance
├── notifications
├── reports
├── audit
├── storage
├── settings
└── shared
```

The exact implementation directory may differ after framework selection.

---

# 6. Shared Backend Infrastructure

The `shared`/common layer may contain:

- Error handling
- Validation
- Authorization helpers
- Transaction helpers
- Date/time utilities
- Currency/amount handling
- Pagination
- Logging
- Event handling
- Configuration
- Idempotency helpers
- Security utilities

Shared code must remain generic and must not become a hidden place for unrelated business rules.

---

# 7. Authentication Module

## Responsibility

Establish and maintain user identity.

### Operations

- Request OTP
- Verify OTP
- Establish session/token
- Refresh/revalidate session where applicable
- Logout/revoke session where supported

### Backend responsibilities

- Normalize/validate mobile number
- Enforce rate limits
- Validate authentication response
- Associate authenticated identity with application user
- Establish trusted user context

---

# 8. Authorization Module

## Responsibility

Enforce access control.

Authorization should operate at two levels:

### Role-level authorization

Example:

```text
President → financial deletion permitted
Auditor   → financial deletion denied
```

### Record-level authorization

Example:

```text
Member
→ Own donation records

Committee Member
→ Own work history

President
→ Authorized broad access
```

The backend must enforce both when required.

---

# 9. Authorization Pipeline

Every protected request should follow:

```text
Request
  ↓
Authenticate
  ↓
Identify User
  ↓
Identify Role
  ↓
Load Target Resource
  ↓
Check Record Access
  ↓
Check Action Permission
  ↓
Validate Business Rules
  ↓
Execute Operation
```

The order may be optimized internally, but the same security guarantees must remain.

---

# 10. Member Module

## Responsibility

Manage registered Masjid members.

### Operations

- Create member
- Get member
- Update member
- Search members
- Check mobile uniqueness
- Manage member status
- Retrieve member-related records

### Core rule

Mobile number uniqueness must be enforced by the authoritative persistence layer.

Do not rely only on:

```text
SELECT → check → INSERT
```

because concurrent requests can still create duplicates.

Use a database uniqueness constraint or equivalent atomic mechanism.

---

# 11. Referral Module

## Responsibility

Track which Committee Member referred a member.

### Operations

- Create referral attribution
- Retrieve referral
- Correct referral
- View referral counts
- Calculate referral contribution

### Core rule

One member has one primary referrer in V1.

### Attribution correction

When corrected:

```text
Old Referrer
     ↓
New Referrer
     ↓
Audit Event
```

Historical financial transactions remain unchanged.

Referral attribution is an application relationship, not a replacement of historical financial ownership.

---

# 12. Donation Module

## Responsibility

Manage donation obligations and donation-specific states.

### Responsibilities

- Monthly amount
- Effective month
- Monthly records
- Due/pending/paid states
- Outstanding calculations
- Additional donations
- Overpayment allocation
- Anonymous donations
- Donation history

---

# 13. Monthly Donation Rules

The backend must enforce:

### Rule 1

One applicable monthly record per member/month.

### Rule 2

The month's agreed amount is determined from the effective amount for that month.

### Rule 3

Historical month records are not retroactively changed simply because the member's future amount changes.

### Rule 4

A partial amount does not complete the monthly obligation.

### Rule 5

Additional donation does not reduce future monthly obligations automatically.

---

# 14. Monthly Donation Generation

A scheduled backend process may create next-month records.

Conceptually:

```text
Scheduled Job
     ↓
Find Eligible Members
     ↓
Determine Applicable Amount
     ↓
Check Existing Month Record
     ↓
Create Missing Record
     ↓
Do Not Duplicate Existing Record
```

The job must be idempotent.

If it runs multiple times, it must not create duplicate member/month records.

---

# 15. Payment Module

## Responsibility

Manage payment-related workflow separate from the authoritative ledger.

### Responsibilities

- Payment-link creation
- Amount selection
- UPI destination
- Payment-link expiration
- Payment reference
- Payment verification workflow
- Duplicate payment-event protection

---

# 16. Payment-Link Generation

The backend receives a request after:

```text
Member
+
Applicable Donation Amount
+
Confirmed Details
```

It produces a payment-link representation.

For monthly donations:

```text
Amount = Complete Applicable Monthly Amount
```

For combined outstanding payments:

```text
Amount = Sum of Complete Outstanding Months
```

---

# 17. Payment-Link Expiration

A monthly payment link expires at the end of the applicable donation month.

Expiration should be determined server-side.

The expired link must not delete the underlying monthly donation record.

---

# 18. Payment Verification Boundary

The backend must distinguish:

```text
Link Created
Link Delivered
Link Opened
Payment Attempted
Payment Received
Payment Verified
```

Only the approved verification mechanism can transition a donation to verified financial state.

A simple redirect/open result is not sufficient.

---

# 19. Duplicate Payment Protection

The payment subsystem must protect against:

- Replayed callbacks/events
- Duplicate verification
- User double submissions
- Network retries
- Provider retries

Potential controls:

- External transaction/reference uniqueness
- Idempotency keys
- State-transition guards
- Database constraints
- Transaction locks where required

---

# 20. Combined Payment Processing

For a combined outstanding payment:

```text
Payment Amount
      ↓
Load Outstanding Monthly Records
      ↓
Order Oldest First
      ↓
Allocate Complete Months
      ↓
Remaining Amount?
      ↓
Create Additional General Donation
```

The entire allocation should be performed atomically.

---

# 21. Overpayment Processing

Example:

```text
Outstanding = ₹1,000
Verified = ₹1,200
```

Backend:

```text
₹1,000 → Outstanding monthly records
₹200   → Additional General Donation
```

The extra amount must not become a future-month credit.

---

# 22. Finance Module

## Responsibility

Maintain authoritative accounting data.

This module is the central source of financial truth.

### Responsibilities

- Accounts
- Financial transactions
- Balances
- Income
- Donations
- Collections
- Transfers
- Financial corrections
- Transaction IDs

---

# 23. Financial Transaction Model

Financial entries should carry a system-generated unique transaction ID.

A transaction should retain sufficient metadata such as:

- Transaction ID
- Date
- Account
- Type
- Amount
- Reference
- Source
- Description
- Actor
- Timestamp
- Related record
- Audit information

Exact fields will be finalized in `FINANCIAL_DATA_MODEL.md`.

---

# 24. Financial Write Pipeline

Financial writes should follow:

```text
Request
  ↓
Authentication
  ↓
Authorization
  ↓
Business Validation
  ↓
Database Transaction
  ↓
Financial Record
  ↓
Balance Impact
  ↓
Audit Event
  ↓
Commit
```

The system should avoid partial financial updates.

---

# 25. Account Balances

Balance should be based on authoritative financial transactions.

Where a materialized/current balance is stored for performance, it must remain consistent with the authoritative ledger.

The system must not rely on a frontend-computed balance.

---

# 26. Internal Transfer Processing

Example:

```text
Cash → Bank
₹20,000
```

The backend should create linked financial effects:

```text
Cash  -₹20,000
Bank  +₹20,000
```

Overall Masjid funds remain unchanged.

The operation must be atomic.

---

# 27. Financial Corrections

A correction should preserve the same transaction identity where the product rule requires it.

Example:

```text
Transaction ID: TX-001

Old Amount: ₹10,000
New Amount: ₹4,000
Reason: ...
Changed By: ...
Timestamp: ...
```

The financial operation must recalculate affected balances correctly.

---

# 28. Financial Deletion

Financial transaction deletion is restricted to the President.

The backend must enforce this even if a different client manually calls the endpoint.

Deletion should:

1. Authenticate user.
2. Verify President permission.
3. Confirm target transaction.
4. Apply deletion.
5. Recalculate/adjust affected balances.
6. Create audit event.
7. Return the authoritative result.

---

# 29. Expense Module

## Responsibility

Manage expenses and their lifecycle.

### Responsibilities

- Create expense
- Category
- Amount
- Description
- Bill
- Payments
- Payment proof
- Status
- Cancellation
- Amount correction
- Supporting documents

---

# 30. Expense State Machine

```text
       ┌─────────────┐
       │    Added    │
       └──────┬──────┘
              │
              ▼
      ┌───────────────┐
      │ Partially Paid│
      └──────┬────────┘
             │
             ▼
        ┌──────────┐
        │   Paid   │
        └──────────┘

Added
  │
  └──────────────► Cancelled
```

The backend must validate every state transition.

---

# 31. Expense Payment Rules

For an expense:

```text
Sum(Payments) ≤ Expense Amount
```

before correction.

A payment cannot be recorded if it would exceed the current authoritative expense amount.

Multiple payments are supported.

---

# 32. Bill and Payment Proof

Bill:

- Required before Paid
- PDF/JPG/PNG

Payment proof:

- Required before Paid
- PDF/JPG/PNG

The backend must validate:

- File type
- File size
- Authorization
- Ownership/association
- Storage result

---

# 33. Expense Cancellation

Finance can cancel an unpaid expense.

Cancellation requires:

- Authorized user
- Cancellation reason
- Status transition
- Audit event

A cancelled expense remains in historical records unless a separately authorized deletion workflow applies.

---

# 34. Expense Amount Correction

When an expense amount is corrected:

```text
Current Amount
      ↓
Validated New Amount
      ↓
Mandatory Reason
      ↓
Update Same Transaction Identity
      ↓
Reconcile Related Payments
      ↓
Audit Event
```

The backend must ensure the new amount is compatible with payments already recorded.

---

# 35. Committee Module

## Responsibility

Manage tasks and work accountability.

### Responsibilities

- Task creation
- Assignment
- Open tasks
- Task claiming
- Progress
- Deadlines
- Overdue processing
- Completion
- Completion notes
- Work history
- Work edit metadata

---

# 36. Task State Model

Conceptually:

```text
Created
  ↓
Assigned / Open
  ↓
Claimed (open task)
  ↓
In Progress
  ↓
Completed
```

Deadline-derived state:

```text
Incomplete + Deadline Passed
             ↓
          Overdue
```

Exact state-transition rules should be centralized.

---

# 37. Open Task Claiming

This is a concurrency-sensitive operation.

Backend behavior:

```text
Claim Request
     ↓
Begin Atomic Operation
     ↓
Verify Task Is Still Claimable
     ↓
Assign Claiming Member
     ↓
Commit
```

If another member has already claimed it:

```text
Conflict
   ↓
Reject Second Claim
```

The frontend must not be trusted to prevent this race.

---

# 38. Work History

Completed work records are permanent.

The backend must prevent Committee Members from deleting completed work records.

A Committee Member may edit their own completed record according to permissions.

Edits should capture:

- Actor
- Timestamp
- Record
- Action/result

---

# 39. Meeting Module

## Responsibility

Manage meetings and decision records.

### Responsibilities

- Meeting creation
- Scheduling
- Agenda
- Location
- Invited members
- Attendance
- Decisions
- Follow-up requirements
- Linked tasks
- Historical records

---

# 40. Decision-to-Task Relationship

A meeting decision may exist without a task.

When work is required:

```text
Meeting
  ↓
Decision
  ↓
Task
  ↓
Responsible Member
  ↓
Completion
```

The backend should store the relationship explicitly rather than relying only on text.

---

# 41. Attendance Module

## Approved V1 attendance

Only:

- Jummah
- Scheduled committee meetings

No daily attendance for:

- Fajr
- Zohr
- Asr
- Maghrib
- Isha

---

# 42. Jummah Attendance Validation

The backend validates:

- Authenticated member
- Attendance date
- Current/approved location information
- Masjid attendance radius
- Location accuracy
- Duplicate attendance

Conceptually:

```text
Mark Present
    ↓
Location Data
    ↓
Radius Check
    ↓
Accuracy Check
    ↓
Duplicate Check
    ↓
Create Record
```

The exact GPS validation implementation will be defined in the detailed attendance/security design.

---

# 43. Meeting Attendance Validation

The backend verifies:

- Meeting exists
- Meeting is scheduled/eligible
- User is authorized/invited as required
- Attendance is not already recorded

Duplicate:

```text
Same Member + Same Meeting
```

must be rejected.

---

# 44. Offline Attendance Synchronization

When a client stores attendance offline:

```text
Local Event
    ↓
Sync Request
    ↓
Authentication
    ↓
Authorization
    ↓
Duplicate Check
    ↓
Location/data validation
    ↓
Persist
```

The backend remains authoritative.

---

# 45. Notification Module

## Responsibility

Process notification events without becoming the source of truth for business records.

### Potential sources

- Donation created/due/pending/verified
- Payment events
- Task assignment
- Task deadline
- Task overdue
- Task completion
- Meeting reminder
- Expense events
- Important security/admin events

---

# 46. Notification Processing

Conceptually:

```text
Domain Event
     ↓
Notification Event
     ↓
Select Recipients
     ↓
Build Safe Payload
     ↓
Provider
     ↓
Delivery Result
```

The notification operation should be retryable.

---

# 47. Notification Failure Rule

If notification delivery fails:

```text
Business Record
→ Remains Correct
```

Example:

```text
Donation Verified
      ↓
SMS Failed
      ↓
Donation remains Verified
```

Notification delivery should not roll back the valid underlying business operation.

---

# 48. Reports Module

## Responsibility

Generate reports from authoritative data.

### Sources

- Finance
- Donations
- Expenses
- Accounts
- Committee tasks
- Referrals
- Attendance
- Meetings
- Audit records

The report service should read the correct source domain rather than maintaining parallel business records.

---

# 49. Financial Report Processing

```text
Report Request
      ↓
Authorization
      ↓
Validate Filters
      ↓
Query Financial Source
      ↓
Aggregate
      ↓
Validate Totals
      ↓
Render
      ↓
Return Screen/PDF
```

The report service must not independently maintain balances.

---

# 50. Audit Module

## Responsibility

Capture important state changes and security-sensitive actions.

Audit events may include:

- User changes
- Role changes
- Referral corrections
- Monthly donation amount changes
- UPI-ID changes
- Financial transaction changes
- Financial deletion
- Expense/payment events
- Attendance corrections
- Important configuration changes
- Relevant authentication/security events

---

# 51. Audit Event Creation

For an audited action:

```text
Business Operation
      ↓
Successful/Defined Outcome
      ↓
Audit Event
```

The event should be created server-side.

The client must not be trusted to submit its own authoritative audit record.

---

# 52. Storage Module

## Responsibility

Provide secure document storage.

Potential document classes:

- Expense bills
- Payment proofs
- Task attachments
- Other approved operational documents

The backend should store file metadata and a secure storage reference.

---

# 53. File Access Control

Access flow:

```text
User
  ↓
Authenticated
  ↓
Authorized for Related Record
  ↓
Generate/Return Controlled File Access
  ↓
Retrieve File
```

Sensitive documents should not be made publicly accessible simply because the client needs to display them.

---

# 54. Settings Module

Potential Masjid operational settings:

- Active UPI ID
- Attendance radius
- Language configuration
- Other approved settings

Settings affecting important application behavior must be validated and audited.

---

# 55. Domain Events

The backend may publish internal domain events such as:

```text
MemberCreated
ReferralCreated
ReferralChanged
DonationCreated
PaymentVerified
ExpenseCreated
ExpensePaid
TaskAssigned
TaskClaimed
TaskCompleted
TaskOverdue
MeetingCreated
DecisionRecorded
AttendanceRecorded
RoleChanged
UPIConfigured
```

These events can trigger secondary operations.

---

# 56. Event Design Principle

Domain events are secondary integration mechanisms.

They must not replace authoritative transactional writes.

Example:

```text
Payment Verified
      ↓
Commit authoritative financial state
      ↓
Publish Event
      ↓
Notification / Aggregation / Audit processing
```

Where audit logging is part of an atomic control requirement, it must be committed reliably with the primary state change.

---

# 57. Background Jobs

Potential jobs:

### Monthly donations

Create next month's records.

### Task overdue processing

Mark eligible incomplete tasks as overdue.

### Notifications

Retry failed notifications.

### Report/PDF processing

Generate large reports asynchronously where required.

### Temporary file cleanup

Remove expired temporary processing artifacts.

### Technical maintenance

Perform provider-specific housekeeping.

---

# 58. Background Job Requirements

Jobs should be:

- Idempotent
- Retry-safe
- Observable
- Authenticated as system operations
- Protected from concurrent duplicate execution where required

A job failure must not silently corrupt business data.

---

# 59. Financial Transactions and Database Transactions

The backend must use a transactional persistence mechanism for operations that modify related financial records.

Example:

```text
Verify Donation
    ↓
Donation Status
+
Financial Transaction
+
Referral Contribution Impact
+
Audit Event
```

These changes should remain consistent.

---

# 60. Transaction Boundary Example — Internal Transfer

```text
BEGIN
  ↓
Create Source Account Effect
  ↓
Create Destination Account Effect
  ↓
Create Transfer Link
  ↓
Create Audit Event
  ↓
COMMIT
```

If any critical step fails:

```text
ROLLBACK
```

This prevents half-completed transfers.

---

# 61. Transaction Boundary Example — Expense Payment

```text
BEGIN
  ↓
Validate Expense
  ↓
Validate Payment Amount
  ↓
Create Payment Record
  ↓
Create Financial Effect
  ↓
Update Expense State
  ↓
Audit
  ↓
COMMIT
```

---

# 62. Idempotency Architecture

Operations vulnerable to retries should accept or derive a stable idempotency mechanism.

Critical candidates:

- Payment verification
- Payment callbacks/events
- Attendance synchronization
- Member registration
- Monthly record generation
- Task claiming
- Financial writes
- Notification jobs

Repeated requests must not create duplicate financial/business records.

---

# 63. Concurrency Control

Concurrency-sensitive areas include:

- Member creation
- Task claiming
- Attendance insertion
- Payment verification
- Financial posting
- Expense payment
- Monthly record generation

Controls may include:

- Unique constraints
- Database transactions
- Conditional updates
- Row locking where necessary
- Idempotency keys
- State-transition validation

The selected database technology must support the required guarantees.

---

# 64. Financial Amount Handling

The backend must define one consistent monetary representation.

Avoid floating-point arithmetic for authoritative financial values.

The selected implementation should use a safe fixed-precision or integer-minor-unit approach.

Example conceptual representation:

```text
₹500.00
→ exact monetary representation
```

The exact implementation must be defined in the technology/database design.

---

# 65. Date and Time Handling

The backend must define a consistent date/time strategy.

Important domains:

- Donation month
- Payment timestamp
- Expense date
- Task deadline
- Meeting time
- Attendance date
- Audit timestamp
- Notification scheduling

Server-generated timestamps should be used for audit/security events.

Date-only business concepts should not be accidentally shifted by timezone conversion.

---

# 66. Input Validation

The backend must validate all client-provided input.

Examples:

- Mobile numbers
- Names
- Amounts
- Dates
- Transaction IDs
- File metadata
- Role changes
- Task states
- Attendance coordinates
- UPI ID configuration

Client-side validation is supplementary only.

---

# 67. API Design

The backend should expose domain-oriented APIs.

Conceptually:

```text
/auth/*
/users/*
/members/*
/referrals/*
/donations/*
/payments/*
/finance/*
/expenses/*
/tasks/*
/meetings/*
/attendance/*
/notifications/*
/reports/*
/audit/*
/settings/*
```

Exact routing conventions will be finalized after framework selection.

---

# 68. API Response Design

Responses should be consistent.

Typical result structure should communicate:

- Success/failure
- Data
- Error category
- Safe message
- Pagination metadata where relevant
- Request/correlation identifier where appropriate

Do not expose internal stack traces or sensitive infrastructure details.

---

# 69. Error Categories

Use predictable error classes:

```text
AUTHENTICATION_ERROR
AUTHORIZATION_ERROR
VALIDATION_ERROR
DUPLICATE_CONFLICT
NOT_FOUND
BUSINESS_RULE_VIOLATION
RATE_LIMIT
EXTERNAL_SERVICE_ERROR
INTERNAL_ERROR
```

The frontend can translate these into user-friendly messages.

---

# 70. Rate Limiting

Rate limiting should protect:

- OTP requests
- OTP verification
- Authentication endpoints
- Publicly reachable API surfaces
- File upload attempts
- Expensive report operations
- Provider-triggering endpoints

Limits should be designed around actual provider/security requirements.

---

# 71. Secret Management

The backend must not hard-code:

- OTP provider secrets
- SMS/WhatsApp credentials
- Database credentials
- Storage credentials
- Payment secrets
- Monitoring secrets
- Signing secrets

Secrets must use secure environment/secret-management facilities.

---

# 72. External Provider Abstraction

External providers should be accessed through adapters/interfaces.

Example:

```text
Notification Service
       ↓
Notification Provider Interface
       ↓
SMS Adapter / WhatsApp Adapter / Push Adapter
```

Likewise:

```text
Payment Service
       ↓
Payment Provider Interface
       ↓
Selected UPI/Payment Integration
```

This allows provider changes with limited domain-code impact.

---

# 73. Provider Failure Handling

When an external service fails:

```text
Core Business Operation
      ↓
Should remain correct
      ↓
Integration event marked failed/retryable
```

The application should not repeatedly retry dangerous financial mutations without idempotency protection.

---

# 74. Caching

Caching may be used for non-authoritative read-heavy data.

Potential candidates:

- Configuration
- Static reference information
- Safe dashboard aggregates

Do not use stale cache as authoritative state for:

- Financial balances
- Payment verification
- Role permissions
- Audit logs
- Task claim state

---

# 75. Query and Pagination Strategy

The backend should support:

- Pagination
- Search
- Date filters
- Account filters
- Status filters
- Sorting where required

Do not return unbounded datasets for normal screens.

---

# 76. Financial Query Strategy

Financial queries should use indexed fields appropriate to actual reporting patterns.

Likely query dimensions include:

- Date
- Account
- Transaction type
- Payment method
- Category
- Transaction/reference ID

Exact indexes belong in `DATABASE_ARCHITECTURE.md`.

---

# 77. Report Query Strategy

Report queries may use specialized aggregate queries.

Do not load millions of raw rows into application memory merely to calculate a summary if the selected database can calculate the aggregation safely.

For financial reports, validate aggregate results against defined ledger rules.

---

# 78. Security Logging vs Business Audit

The backend should maintain two conceptual types of logs.

### Technical logs

Used for:

- Errors
- Debugging
- Performance
- Infrastructure issues

### Business audit logs

Used for:

- Financial changes
- Permission changes
- Important record changes
- Accountability actions

They should not be treated as interchangeable.

---

# 79. API Security

APIs should implement:

- Authentication
- Authorization
- Validation
- Rate limiting
- Secure error handling
- Secure transport
- Controlled response fields
- Input/output size limits
- Appropriate CORS/origin policy for Web
- File access controls

Exact controls belong in `SECURITY_ARCHITECTURE.md`.

---

# 80. Data Access Security

The backend must prevent:

- Unauthorized member access
- Unauthorized financial access
- Unauthorized audit access
- Cross-role privilege escalation
- Insecure direct object access
- Unauthorized file retrieval

Every resource access must respect the user's current authorization.

---

# 81. Financial Security Rules

At minimum:

```text
Only authorized users may create financial records.
Only authorized users may verify payments.
Only authorized users may modify finance configuration.
Only President may delete financial transactions.
Auditor is read/review focused.
```

Exact role matrix is defined in `USER_ROLES_PERMISSIONS.md`.

---

# 82. Committee Privacy Rules

The backend must enforce:

```text
Committee Member
→ Own work history / authorized referrals

Member
→ Own donation information

President / authorized administrators
→ Appropriate broad visibility
```

No user should gain access to another person's records solely by guessing a record identifier.

---

# 83. Database Access Principle

Application code should avoid direct uncontrolled database access from multiple unrelated modules.

Prefer:

```text
Domain/Application Service
       ↓
Authorized Data Access
       ↓
Database
```

This makes business rules easier to audit and test.

---

# 84. Repository/Data Access Abstraction

Where useful, data access should be abstracted through repositories or equivalent services.

Example:

```text
MemberService
    ↓
MemberRepository
    ↓
Database
```

The exact pattern depends on the selected framework and database.

The goal is separation, not abstraction for its own sake.

---

# 85. Backend Testing Architecture

Testing should exist at multiple levels.

## Unit

- Business rules
- Calculations
- State transitions
- Validation

## Integration

- Database
- Transactions
- External adapters

## API

- Authorization
- Validation
- Request/response behavior

## End-to-End

Critical user workflows across the system.

---

# 86. Critical Backend Test Cases

The backend must test:

1. Duplicate member prevention.
2. Referral attribution.
3. Monthly donation generation.
4. Historical amount preservation.
5. Partial monthly payment rejection.
6. Combined-payment FIFO allocation.
7. Overpayment to General Donation.
8. Payment verification.
9. Duplicate payment protection.
10. Financial balance updates.
11. Internal transfers.
12. Expense payment limits.
13. Expense cancellation.
14. Expense amount correction.
15. Financial deletion authorization.
16. Open-task single claim.
17. Task overdue processing.
18. Duplicate Jummah attendance.
19. Duplicate meeting attendance.
20. Offline attendance synchronization.
21. Role restrictions.
22. Audit-event generation.

---

# 87. Test Data Safety

Production financial/member data must not be casually copied into development/test environments.

Use:

- Synthetic data
- Controlled fixtures
- Isolated test environments

Sensitive production information should be protected.

---

# 88. Monitoring Requirements

Backend monitoring should cover:

- API errors
- Response times
- Database errors
- Job failures
- Storage failures
- External provider failures
- Authentication failures
- Notification failures
- Payment integration failures

Monitoring must avoid leaking sensitive application data.

---

# 89. Health Checks

The production backend should expose appropriate health/readiness checks.

Conceptually:

```text
Application Health
Database Connectivity
Required Service Availability
Background Job Health
```

Health endpoints should not expose secrets or detailed infrastructure information.

---

# 90. Background Job Observability

Each important job should provide operational visibility:

```text
Job Name
Run ID
Start Time
End Time
Status
Processed Count
Failure Count
Last Error / Safe Error Summary
```

Avoid storing sensitive business data in technical job logs.

---

# 91. Data Migration Strategy

Database structure changes should use a controlled migration process.

Every schema change should have:

- Migration
- Roll-forward strategy
- Rollback/recovery consideration
- Data compatibility review
- Test validation

Financial schema migrations require additional care.

---

# 92. Backward Compatibility

API/data changes should avoid breaking active clients unexpectedly.

If a breaking change is required:

- Document it.
- Version/deprecate appropriately.
- Coordinate client rollout.

---

# 93. API Versioning

The exact versioning strategy will be selected later.

The architecture should support controlled evolution without silently breaking Web, Android, or iOS clients.

---

# 94. Deployment Environment Model

Conceptually:

```text
Development
     ↓
Staging / Testing
     ↓
Production
```

Each environment should have separate configuration and data where practical.

---

# 95. Production Configuration

Production configuration should include:

- Database connection
- Authentication provider
- File storage
- Notification providers
- Payment integration
- Allowed application origins
- Monitoring
- Environment flags

Sensitive values must be stored securely.

---

# 96. Backup Boundary

The backend architecture must support recovery of:

- Database
- File storage
- Critical configuration
- Relevant application state

Backup design is documented separately in `BACKUP_AND_RECOVERY.md`.

---

# 97. Cost-Efficiency Principle

Backend architecture should minimize unnecessary infrastructure.

Avoid introducing:

- Multiple servers when one is sufficient
- Multiple databases without a clear reason
- Multiple queues without need
- Large always-on services for tiny workloads
- Duplicate storage
- Permanent generated-report storage without purpose

Cost optimization must never compromise financial or committee history.

---

# 98. Avoiding Unnecessary Microservices

V1 should not be split into many independently deployed services without a demonstrated need.

Prefer a modular backend where:

- Domains are separated in code
- Responsibilities are clear
- Financial operations have strong transaction boundaries
- Integrations are isolated
- Deployment remains simple

Distributed services may be introduced later only when a real requirement justifies them.

---

# 99. Core Backend Invariants

The backend must preserve these invariants:

1. Mobile number uniqueness.
2. One primary referrer per member.
3. Monthly donation completeness.
4. FIFO allocation for combined outstanding payments.
5. Overpayment becomes additional General Donation.
6. Additional donations do not reduce future monthly dues.
7. Payment-link interaction does not equal payment verification.
8. Only verified payments become verified contributions.
9. Financial state is server authoritative.
10. Financial history is permanent.
11. Committee work history is permanent.
12. One successful claimant per open task.
13. One Jummah attendance record per member/date.
14. One meeting-attendance record per member/meeting.
15. Internal transfers do not change overall Masjid funds.
16. Financial deletion is President-only.
17. Important state changes produce audit events.
18. External provider failures must not corrupt core business state.
19. Retryable operations must be idempotent.
20. Backend authorization cannot be bypassed through client manipulation.

---

# 100. Backend Architecture Completion Criteria

The backend architecture is ready for implementation when:

- Layer responsibilities are defined.
- Domain modules are defined.
- API boundary is defined.
- Authorization pipeline is defined.
- Financial transaction boundaries are defined.
- Concurrency-sensitive operations are identified.
- Idempotency requirements are identified.
- Background jobs are identified.
- External integrations are isolated.
- Storage/file access boundaries are defined.
- Audit boundaries are defined.
- Testing layers are defined.
- Technology decisions are documented separately.
- All V1 workflows can be mapped to backend operations without inventing undocumented behavior.

---

# 101. Related Documents

This document should be used with:

- `PROJECT_OVERVIEW.md`
- `PRODUCT_REQUIREMENTS.md`
- `FEATURE_SCOPE.md`
- `USER_ROLES_PERMISSIONS.md`
- `SYSTEM_ARCHITECTURE.md`
- `APPLICATION_ARCHITECTURE.md`
- `FRONTEND_ARCHITECTURE.md`
- `BACKEND_FRAMEWORK.md`
- `TECHNOLOGY_STACK.md`
- `DATABASE_ARCHITECTURE.md`
- `DATABASE_SCHEMA.md`
- `FINANCIAL_DATA_MODEL.md`
- `COMMITTEE_DATA_MODEL.md`
- `SECURITY_ARCHITECTURE.md`
- `AUDIT_LOG_MODEL.md`
- `DEPLOYMENT.md`
- `BACKUP_AND_RECOVERY.md`
- `DEVELOPMENT_TASKS.md`

---

## Document Status

**Backend Architecture — V1 Baseline**

This document defines the logical backend structure and authoritative business-operation boundaries for Masjid-e-Mamoor 2.

Specific backend technologies, libraries, infrastructure, and external providers must be selected through technical research and documented separately.
