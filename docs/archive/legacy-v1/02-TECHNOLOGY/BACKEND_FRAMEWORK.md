# Masjid-e-Mamoor 2 — Backend Framework

**Document Status:** Recommended / V1 Baseline  
**Version:** 1.0  
**Product:** Masjid-e-Mamoor 2 Internal Management Application  
**Scope:** V1  
**Last Updated:** 2026-09-17

---

## 1. Purpose

This document defines the backend framework and implementation direction for the Masjid-e-Mamoor 2 application.

The backend must support:

- Web clients
- Android clients
- iOS clients
- Strong relational data
- Financial integrity
- Role-based authorization
- File access control
- Notifications
- UPI/payment-link workflows
- Scheduled processing
- Reporting
- Audit logging
- Low infrastructure overhead

The backend framework baseline is:

**Supabase + PostgreSQL + Supabase Edge Functions + TypeScript**

---

# 2. Backend Framework Decisions

| Area | Decision |
|---|---|
| Backend Platform | Supabase |
| Database | PostgreSQL |
| Server Functions | Supabase Edge Functions |
| Backend Language | TypeScript |
| API Style | Domain-oriented HTTP APIs / function endpoints |
| Database Authorization | PostgreSQL RLS + application authorization |
| Authentication | Supabase Auth |
| File Storage | Supabase Storage |
| Scheduled Processing | Supabase/platform scheduler capability where suitable |
| External Integrations | Server-side adapters |
| Source Control | GitHub |
| Package Manager | pnpm |

---

# 3. Why Supabase

The application is data-heavy and relational.

Important relationships include:

```text
User
  ↓
Role
  ↓
Member
  ↓
Referral
  ↓
Donation
  ↓
Payment
  ↓
Financial Transaction
```

and:

```text
Meeting
  ↓
Decision
  ↓
Task
  ↓
Work History
```

and:

```text
Expense
  ↓
Payment
  ↓
Financial Transaction
```

PostgreSQL is well suited to these relationships and transactional requirements.

Supabase provides the surrounding managed backend services without requiring the project to maintain a separate database/auth/storage infrastructure from scratch.

---

# 4. Why PostgreSQL

PostgreSQL is selected as the authoritative database because V1 requires:

- Relational integrity
- Foreign keys
- Unique constraints
- Transactions
- Aggregation
- Indexes
- Strong consistency
- Structured reporting
- Row Level Security
- Atomic concurrency controls

Financial operations particularly benefit from transactional database behavior.

---

# 5. Why Edge Functions

Supabase Edge Functions provide a server-side execution layer for operations that should not run directly in the client.

Use them for:

- Payment-link generation
- Payment verification orchestration
- Secure external API calls
- Notification delivery
- Protected business operations
- Report/PDF generation where suitable
- Provider adapters
- Scheduled/background workflows

Do not use Edge Functions for every trivial database read.

---

# 6. Runtime Principles

Edge Functions should remain:

- Small
- Focused
- Idempotent where applicable
- Secure
- Observable
- Explicitly authorized

Avoid building one giant backend function containing all business logic.

Prefer domain-oriented functions/services.

---

# 7. Logical Backend Structure

Conceptually:

```text
apps/
└── backend/
    └── functions/
        ├── auth/
        ├── members/
        ├── referrals/
        ├── donations/
        ├── payments/
        ├── finance/
        ├── expenses/
        ├── committee/
        ├── meetings/
        ├── attendance/
        ├── notifications/
        ├── reports/
        ├── audit/
        └── settings/

packages/
├── types/
├── validation/
├── api-client/
└── shared/
```

The exact repository structure may be adjusted during setup.

---

# 8. Function Boundary Principle

Functions should represent meaningful application operations.

Preferred:

```text
register-member
verify-donation
create-expense
record-expense-payment
claim-task
complete-task
mark-jummah-attendance
generate-financial-report
```

Avoid a backend API consisting only of unrestricted generic CRUD operations for sensitive domains.

---

# 9. Authentication

Use **Supabase Auth** for identity.

Conceptual flow:

```text
Client
  ↓
Mobile Number
  ↓
OTP
  ↓
Supabase Auth
  ↓
Authenticated Identity
  ↓
Application User
```

Authentication verifies who the user is.

Authorization determines what the user can do.

---

# 10. Authentication Adapter Boundary

If an external OTP/SMS service is required:

```text
Application Auth
      ↓
Auth/OTP Adapter
      ↓
SMS Provider
```

Provider-specific code should not be spread across the domain modules.

---

# 11. Authorization

Authorization is implemented through:

1. Backend application authorization.
2. PostgreSQL Row Level Security where applicable.
3. Record-level access checks.
4. Business-rule checks.

Example:

```text
Request
  ↓
Authenticated User
  ↓
Role
  ↓
Resource
  ↓
Permission
  ↓
Business Rule
```

---

# 12. Service-Role Key

Supabase service-role credentials bypass RLS.

Therefore:

**Service-role credentials must remain server-side.**

Never expose a service-role key in:

- Next.js client bundles
- Android
- iOS
- Browser JavaScript
- Public GitHub files

---

# 13. RLS Strategy

RLS should provide an additional database-level boundary.

Examples:

```text
Member
→ Own permitted records
```

```text
Committee Member
→ Own/authorized work/referral records
```

```text
Auditor
→ Financial read access
```

The exact RLS policies will be documented in the database/security documents.

RLS does not replace application-level business authorization.

---

# 14. Database Access

The backend may use:

- Supabase client/server SDKs
- SQL migrations
- Database functions/RPC where appropriate

The choice between query logic and database functions should depend on transaction and maintainability requirements.

---

# 15. Database Function / RPC Usage

Database functions are appropriate when an operation benefits from database-side atomicity.

Examples:

- Internal transfer
- FIFO donation allocation
- Atomic task claim
- Duplicate attendance prevention
- Financial transaction operations

Do not put the entire application domain into SQL functions.

---

# 16. Financial Logic Boundary

Financial logic is server-side.

Examples:

- Account balance effects
- Donation verification
- FIFO allocation
- Overpayment classification
- Expense payment limits
- Internal transfers
- Transaction deletion
- Financial corrections

Client-side calculations are presentation aids only.

---

# 17. Financial Transaction Model

All authoritative financial effects should be represented by database-backed transactions.

Conceptually:

```text
Financial Operation
      ↓
Validate
      ↓
Database Transaction
      ↓
Ledger Effect
      ↓
Balance
      ↓
Audit
```

---

# 18. Monetary Data Type

Do not use floating-point numbers for authoritative financial arithmetic.

Use a fixed-precision monetary representation.

An implementation may use:

- Integer minor units, or
- Exact PostgreSQL numeric/decimal values

The exact database representation must be documented in `FINANCIAL_DATA_MODEL.md`.

---

# 19. Transaction Atomicity

Operations affecting multiple financial records should be atomic.

Example:

```text
Donation Verification
    +
Financial Posting
    +
Referral Contribution Effect
    +
Audit Event
```

The system must avoid a state where only some of these changes succeed.

---

# 20. Internal Transfers

Use transactional processing for:

```text
Source Account
      ↓
Transfer
      ↓
Destination Account
```

Example:

```text
Cash -₹20,000
Bank +₹20,000
```

Overall Masjid funds remain unchanged.

---

# 21. Donation Workflow

The backend manages:

```text
Monthly Donation Record
        ↓
Payment Link
        ↓
Actual Payment
        ↓
Finance Verification
        ↓
Financial Transaction
```

A payment-link click is not sufficient for verification.

---

# 22. Payment Verification

Finance verification is the V1 authoritative control.

The backend must distinguish:

```text
Created
Delivered
Opened
Attempted
Received
Verified
```

Only the approved financial verification process may produce a verified payment.

---

# 23. Payment Idempotency

Payment processing must protect against:

- Duplicate submissions
- Replayed callbacks
- Provider retries
- Network retries
- Double verification

Potential mechanisms:

- Unique payment reference
- Idempotency key
- State-transition constraint
- Provider event ID
- Database uniqueness

---

# 24. Combined Payment Processing

For multiple outstanding months:

```text
Combined Amount
      ↓
Load Outstanding Months
      ↓
Order by Oldest First
      ↓
Allocate Complete Months
      ↓
Excess?
      ↓
Additional General Donation
```

The operation must be transactional.

---

# 25. Overpayment

Example:

```text
Outstanding = ₹1,000
Received    = ₹1,200
```

Backend behavior:

```text
₹1,000 → Settle outstanding month(s)
₹200   → Additional General Donation
```

No future-month credit is created automatically.

---

# 26. Member Registration

Member creation flow:

```text
Committee Member
      ↓
Name + Mobile
      ↓
Duplicate Check
      ↓
Create Member
      ↓
Create Referral
      ↓
Store Monthly Amount
```

The duplicate check must be enforced with an authoritative database uniqueness mechanism.

---

# 27. Referral Attribution

The backend stores one primary referrer in V1.

A correction:

```text
Old Referrer
      ↓
New Referrer
      ↓
Audit Event
```

Historical financial transactions are not rewritten merely because referral attribution changes.

---

# 28. Monthly Donation Generation

A scheduled operation may create monthly records:

```text
Eligible Members
      ↓
Determine Applicable Amount
      ↓
Check Existing Month
      ↓
Create Missing Record
```

Use a unique constraint such as:

```text
Member + Donation Month
```

to prevent duplicates.

---

# 29. Expense Backend

Expense workflow:

```text
Create Expense
      ↓
Bill
      ↓
Payments
      ↓
Payment Proof
      ↓
Expense Status
      ↓
Financial Ledger
      ↓
Audit
```

Finance is the operational controller.

---

# 30. Expense State Validation

Allowed state transitions should be controlled by the backend.

Conceptual:

```text
Added
  ↓
Partially Paid
  ↓
Paid

Added
  ↓
Cancelled
```

Do not accept arbitrary status strings from clients.

---

# 31. Expense Payment Validation

Before recording a payment:

```text
Load Expense
     ↓
Authorize
     ↓
Validate Payment Amount
     ↓
Check Remaining Amount
     ↓
Create Payment
     ↓
Create Financial Effect
```

The backend must prevent:

```text
Total Payments > Expense Amount
```

under normal rules.

---

# 32. Expense Amount Correction

A correction must:

- Require authorization.
- Require a reason.
- Preserve the same transaction identity as specified by product rules.
- Reconcile existing payments.
- Update financial effects.
- Produce an audit event.

---

# 33. Committee Task Backend

Task service manages:

- Creation
- Assignment
- Open tasks
- Claiming
- Progress
- Deadlines
- Overdue state
- Completion
- Work history

---

# 34. Atomic Task Claim

An open task can have only one claimant.

Implementation requirement:

```text
Claim Request
     ↓
Atomic Conditional Update
     ↓
Only if task still open
     ↓
Assign Member
```

If the task is already claimed:

```text
Conflict
```

The client cannot be trusted to enforce this.

---

# 35. Task Overdue Processing

A scheduled job may perform:

```text
Find Incomplete Tasks
       ↓
Deadline Passed?
       ↓
Mark Overdue
       ↓
Create Notification Event
```

The job must be idempotent.

---

# 36. Work History

Completed work records are permanent.

The backend prevents normal Committee Members from deleting completed work.

Editing own completed work is allowed according to role rules and should create appropriate audit metadata.

---

# 37. Meeting Backend

Meeting service manages:

- Meeting
- Invitees
- Agenda
- Attendance
- Decisions
- Follow-up tasks
- Historical records

---

# 38. Decision-to-Task Relationship

The backend stores the relationship explicitly:

```text
Meeting
  ↓
Decision
  ↓
Optional Task
```

A decision may exist without any task.

---

# 39. Attendance Backend

V1 supports:

- Jummah attendance
- Scheduled meeting attendance

No daily attendance for Fajr, Zohr, Asr, Maghrib, or Isha.

---

# 40. Jummah Attendance Validation

The backend must validate:

- Authenticated member
- Friday/date eligibility
- Location data
- Attendance radius
- Accuracy
- Duplicate record

Conceptually:

```text
Attendance Request
      ↓
Auth
      ↓
Permission
      ↓
Location Validation
      ↓
Duplicate Check
      ↓
Persist
      ↓
Audit if applicable
```

---

# 41. Meeting Attendance Validation

Validate:

- Meeting exists
- User is authorized/invited according to final rules
- Attendance not already recorded

Duplicate:

```text
Member + Meeting
```

must be rejected.

---

# 42. Offline Attendance

Offline attendance is a client capability but backend validation remains authoritative.

Flow:

```text
Local Event
    ↓
Sync
    ↓
Authentication
    ↓
Authorization
    ↓
Duplicate Check
    ↓
Validation
    ↓
Persist
```

---

# 43. Notification Backend

Notification processing should be separated from core business operations.

Example:

```text
Payment Verified
      ↓
Commit Business State
      ↓
Create Notification Event
      ↓
Send Push/SMS/WhatsApp
```

Notification failure must not corrupt the payment state.

---

# 44. Notification Provider Adapter

Conceptually:

```text
Notification Service
        ↓
Provider Interface
        ├── Push Adapter
        ├── SMS Adapter
        └── WhatsApp Adapter
```

Provider-specific credentials stay server-side.

---

# 45. Retryable Notifications

Notification jobs may retry failed sends.

The job must be idempotent enough to avoid uncontrolled duplicate messages.

The final retry policy depends on provider behavior.

---

# 46. Report Backend

Reports are generated from authoritative data.

The report service should:

- Validate authorization
- Validate filters
- Query source data
- Aggregate
- Validate totals
- Render
- Return PDF/data

---

# 47. Financial Report Security

Financial reports must enforce authorization before data generation.

A user must not gain access to a financial report by modifying report parameters.

---

# 48. Audit Backend

The audit service records important state changes.

Examples:

- Role changes
- Referral correction
- Monthly amount changes
- UPI changes
- Financial transaction actions
- Expense/payment actions
- Attendance corrections
- Important settings

Audit records should be generated server-side.

---

# 49. Audit Event Structure

Conceptually:

```text
Audit Event
├── ID
├── Timestamp
├── Actor
├── Action
├── Resource Type
├── Resource ID
├── Result
└── Metadata
```

The exact schema is defined in `AUDIT_LOG_MODEL.md`.

---

# 50. Storage Backend

The backend manages secure file storage for:

- Bills
- Payment proofs
- Task attachments where applicable

The application stores:

- File reference
- Associated record
- Ownership/access information
- Metadata

The actual file resides in object storage.

---

# 51. File Authorization

Before returning a file:

```text
Authenticate
   ↓
Authorize Related Record
   ↓
Allow Secure File Access
```

Do not expose sensitive files solely through predictable public URLs.

---

# 52. File Validation

Backend validates:

- File type
- File size
- Authorization
- Record association
- Storage result

The server must not trust a client-provided filename extension alone.

---

# 53. API Architecture

Use domain-oriented API/function boundaries.

Conceptual:

```text
/auth
/users
/members
/referrals
/donations
/payments
/finance
/expenses
/tasks
/meetings
/attendance
/notifications
/reports
/audit
/settings
```

---

# 54. API Request Validation

Every input must be validated server-side.

Use shared Zod schemas where practical.

Examples:

- Member
- Donation
- Expense
- Payment
- Task
- Meeting
- Attendance
- Settings

---

# 55. API Error Model

Use consistent safe errors:

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

Do not expose:

- Stack traces
- SQL
- Secrets
- Provider credentials
- Internal file paths

---

# 56. Idempotency Architecture

Idempotency should be applied to retry-sensitive operations.

Required candidates:

- Member creation
- Monthly record generation
- Payment verification
- Attendance synchronization
- Task claiming
- Financial transaction creation
- Notification jobs

---

# 57. Concurrency Architecture

Important race-condition areas:

- Member creation
- Task claiming
- Attendance
- Payment verification
- Expense payments
- Financial transfers
- Monthly generation

Use database constraints and transactions as the primary enforcement layer.

---

# 58. Data Access Pattern

Preferred:

```text
API
 ↓
Application Service
 ↓
Domain Logic
 ↓
Data Access
 ↓
Database
```

Avoid:

```text
API
 ↓
Arbitrary SQL everywhere
```

---

# 59. Background Job Strategy

Background jobs may be used for:

- Monthly donation generation
- Donation reminders
- Task overdue processing
- Notification retries
- Report generation
- Temporary file cleanup

Jobs must be observable and retry-safe.

---

# 60. Scheduling

Use the selected Supabase/platform scheduling facility where it satisfies the requirement.

Avoid adding another always-running server only for simple daily/monthly jobs.

If the platform scheduler cannot satisfy a specific requirement, document the alternative before implementation.

---

# 61. Edge Function Runtime Constraints

Current Supabase Edge Function limits include constraints on:

- Memory
- CPU time
- Wall-clock execution
- Number of functions

Therefore:

- Keep functions focused.
- Avoid very heavy computation.
- Avoid loading huge datasets into memory.
- Prefer database aggregation.
- Use streaming/efficient processing where possible.
- Move genuinely heavy workloads to an appropriate service only when justified.

---

# 62. Database-First Aggregation

For dashboard/report totals, prefer database-side aggregation when practical.

Example:

```text
Financial Transactions
      ↓
Database SUM / GROUP / FILTER
      ↓
Summary
```

rather than:

```text
Load every transaction
      ↓
JavaScript loop
      ↓
Calculate total
```

This improves performance and reduces backend memory use.

---

# 63. Pagination

Backend list APIs should support pagination.

Important endpoints:

- Members
- Donations
- Transactions
- Expenses
- Tasks
- Work history
- Attendance
- Audit logs

Do not return unbounded datasets.

---

# 64. Filtering

Relevant filters include:

### Finance

- Date
- Account
- Credit/debit
- Amount
- Category
- Payment method
- Reference ID

### Tasks

- Status
- Member
- Priority
- Deadline

### Attendance

- Date
- Member
- Meeting

### Members

- Name
- Mobile
- Referrer
- Status

---

# 65. Search Authorization

Search queries must apply the same record-level authorization as normal resource retrieval.

A user must not search for data that they cannot otherwise access.

---

# 66. Backend Configuration

Separate:

### Application secrets

- API credentials
- Database secrets
- Provider keys
- Signing keys

### Masjid settings

- Active UPI ID
- Attendance radius
- Supported language configuration
- Other approved operational configuration

Do not mix secret configuration and user-editable settings.

---

# 67. Environment Model

Backend deployments should use:

```text
Development
Staging/Test
Production
```

Each environment must use appropriate credentials and data.

---

# 68. Production Data Protection

Production financial/member data must not be casually imported into development.

Use:

- Synthetic data
- Fixtures
- Isolated databases/projects

for development and testing.

---

# 69. Backend Logging

Log:

- Errors
- Performance problems
- Provider failures
- Job failures
- Important operational events

Avoid logging:

- OTP values
- Access tokens
- Secrets
- Full sensitive financial data
- Private document contents

---

# 70. Technical Logs vs Audit Logs

### Technical logs

Purpose:

```text
Diagnose the software
```

### Business audit logs

Purpose:

```text
Record important user/system changes
```

Keep the purposes and retention models separate.

---

# 71. Monitoring

Initial monitoring should use the capabilities of:

- Supabase
- Vercel
- GitHub/CI
- Application logs

Additional monitoring can be added later if justified.

Monitor:

- Errors
- Database size
- Storage size
- Edge function failures
- Authentication failures
- Notification failures
- Payment integration failures
- Job failures

---

# 72. Backup Requirement

The Supabase Free plan does not provide the full automated backup capability expected from a paid production setup.

Therefore, a separate backup/recovery process is required before production go-live.

The architecture must protect:

- Database
- Required financial evidence
- Committee history
- Critical configuration

Detailed implementation belongs in `BACKUP_AND_RECOVERY.md`.

---

# 73. Cost-Efficiency Rules

Avoid:

- Unnecessary servers
- Unnecessary databases
- Duplicate file storage
- Always-on services for infrequent workloads
- Excessive background processing
- Unnecessary API calls

But never save infrastructure cost by deleting:

- Financial history
- Donation history
- Committee work history
- Required audit information

---

# 74. External Service Adapters

All third-party integrations should use an adapter layer.

Potential integrations:

```text
OTP
SMS
WhatsApp
Push
UPI
PDF
Monitoring
```

Domain logic should depend on internal interfaces rather than vendor-specific implementation details.

---

# 75. Provider Failure Rules

If an external provider fails:

```text
Core Business State
      ↓
Remains correct
```

Example:

```text
Donation verified
      ↓
WhatsApp failed
      ↓
Donation remains verified
```

The notification failure should be retried separately.

---

# 76. API Rate Limiting

Protect:

- OTP
- Login
- Payment verification
- File uploads
- Report generation
- Notification-triggering endpoints
- Publicly reachable endpoints

The exact limits depend on the selected provider and threat model.

---

# 77. Webhook Security

Where providers send webhooks:

```text
Webhook
   ↓
Verify Signature
   ↓
Validate Event
   ↓
Check Event ID
   ↓
Check Expected State
   ↓
Process Idempotently
```

Never trust a webhook merely because it reaches the endpoint.

---

# 78. UPI Backend Boundary

UPI workflow is:

```text
Generate Payment Request
      ↓
Member Payment
      ↓
Actual Payment Evidence
      ↓
Finance Verification
```

The exact automation level can evolve later.

V1 does not assume a full automatic bank-reconciliation system.

---

# 79. Notification Backend Boundary

The notification subsystem should not control authorization.

It only delivers events to already-authorized users.

Sensitive information should be minimized in payloads.

---

# 80. Report Backend Boundary

A report request must:

```text
Authenticate
      ↓
Authorize
      ↓
Validate Filters
      ↓
Query Authorized Data
      ↓
Render
```

No report endpoint should bypass normal record-level access rules.

---

# 81. Database Migration Framework

Schema changes must be version-controlled.

Use:

```text
Migration 001
Migration 002
Migration 003
...
```

Every migration must be committed to Git.

Production migration execution must be controlled and tested.

---

# 82. Migration Safety

For financial schema changes:

- Review impact.
- Test against realistic synthetic data.
- Avoid destructive migrations unless necessary.
- Plan data transformation.
- Validate balances after migration.

---

# 83. API Evolution

Backend API changes must account for Web/Android/iOS version differences.

Avoid breaking active clients without a controlled migration.

Potential strategies:

- Backward-compatible response changes
- Versioning where required
- Deprecation windows
- Coordinated client release

---

# 84. Domain Event Strategy

Useful domain events may include:

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
AttendanceRecorded
UPIConfigured
RoleChanged
```

Events should be used for secondary processing such as notifications and aggregate refresh.

---

# 85. Event Reliability

For important events:

- Persist event state where needed.
- Make processing idempotent.
- Retry safely.
- Track failures.
- Avoid losing business events silently.

---

# 86. Backend Testing Strategy

### Unit tests

- Business rules
- Calculations
- State transitions
- Validation

### Integration tests

- Database
- RLS
- Transactions
- Storage
- Provider adapters

### API tests

- Authentication
- Authorization
- Validation
- Conflict behavior

### End-to-end tests

Full workflows.

---

# 87. Critical Backend Test Flows

```text
Register Member
→ Referral
→ Monthly Amount
→ Donation Record
```

```text
Donation
→ Payment
→ Finance Verification
→ Financial Transaction
→ Contribution
```

```text
Expense
→ Payment
→ Ledger
→ Balance
```

```text
Meeting
→ Decision
→ Task
→ Completion
```

```text
Jummah Attendance
→ GPS Validation
→ Persist
```

---

# 88. Backend Security Test Requirements

Test:

- Unauthorized API access
- Role escalation
- IDOR
- RLS bypass attempts
- Duplicate member creation
- Duplicate payment processing
- Double task claims
- Duplicate attendance
- Unauthorized financial deletion
- File authorization
- Webhook replay
- OTP abuse

---

# 89. Performance Strategy

Prefer:

- Indexed database queries
- Pagination
- Aggregation
- Efficient payloads
- Caching where safe
- Background work for expensive secondary operations

Avoid:

- Large unrestricted queries
- Loading entire financial history into memory
- Long-running synchronous requests
- Excessive provider calls

---

# 90. Server-Side Date/Time

Server-controlled timestamps should be used for:

- Audit events
- Verification times
- System operations
- Job execution

Business date-only values should be stored consistently with the product's timezone rules.

---

# 91. Business Timezone

V1 is intended for one Masjid in India.

The backend should use a clearly defined application timezone policy rather than relying on each client device's local timezone.

The exact timezone configuration should be recorded in application settings/deployment documentation.

---

# 92. Backend Data Ownership

Each domain owns its authoritative records.

```text
Members     → Member Module
Referrals   → Referral Module
Donations   → Donation Module
Finance     → Finance Module
Expenses    → Expense Module
Tasks       → Committee Module
Meetings    → Meeting Module
Attendance  → Attendance Module
Audit       → Audit Module
```

Other modules should reference these records rather than creating duplicate sources of truth.

---

# 93. Backend Invariants

The following rules are mandatory:

1. Mobile number is unique for members.
2. One member has one primary referrer in V1.
3. One member/month has one applicable monthly donation record.
4. Monthly donation completion requires the full applicable amount.
5. Combined payment uses oldest outstanding month first.
6. Overpayment becomes additional General Donation.
7. Additional donations do not reduce future monthly dues.
8. Payment-link interaction is not payment verification.
9. Verified payments are authoritative financial inputs.
10. One open task can have only one successful claimant.
11. One member/date has only one Jummah record.
12. One member/meeting has only one meeting attendance record.
13. Internal transfers do not change total Masjid funds.
14. Financial deletion is President-only.
15. Financial history is permanent.
16. Committee work history is permanent.
17. Important state changes are audited.
18. Client-provided roles are never trusted.
19. External provider failure cannot corrupt core business state.
20. Retryable operations are idempotent.

---

# 94. Framework Upgrade Policy

Do not automatically upgrade the backend runtime or Supabase-related dependencies.

For a major upgrade:

```text
Review release
   ↓
Check compatibility
   ↓
Update in development
   ↓
Run tests
   ↓
Validate database/API
   ↓
Run staging tests
   ↓
Document
   ↓
Production rollout
```

---

# 95. Backend Framework Completion Criteria

The backend framework setup is complete when:

- Supabase project/environment is configured.
- PostgreSQL is initialized.
- Authentication is integrated.
- Edge Functions are configured.
- Shared TypeScript packages are available.
- Environment variables are secure.
- Database migrations are working.
- RLS baseline exists.
- Authorization framework exists.
- API/function conventions are established.
- Error model is implemented.
- Logging is configured.
- Testing infrastructure is configured.
- CI can type-check, test, and build the backend.
- No privileged secrets are exposed to clients.

---

# 96. Related Documents

- `PROJECT_OVERVIEW.md`
- `PRODUCT_REQUIREMENTS.md`
- `FEATURE_SCOPE.md`
- `USER_ROLES_PERMISSIONS.md`
- `SYSTEM_ARCHITECTURE.md`
- `APPLICATION_ARCHITECTURE.md`
- `BACKEND_ARCHITECTURE.md`
- `FRONTEND_ARCHITECTURE.md`
- `TECHNOLOGY_STACK.md`
- `DATABASE_ARCHITECTURE.md`
- `DATABASE_SCHEMA.md`
- `FINANCIAL_DATA_MODEL.md`
- `COMMITTEE_DATA_MODEL.md`
- `SECURITY_ARCHITECTURE.md`
- `AUDIT_LOG_MODEL.md`
- `HOSTING_CLOUD_INFRASTRUCTURE.md`
- `BACKUP_AND_RECOVERY.md`
- `DEVELOPMENT_TASKS.md`

---

## Document Status

**Backend Framework — V1 Baseline**

This document defines the selected backend framework and implementation direction for Masjid-e-Mamoor 2.

The baseline is:

**Supabase + PostgreSQL + Supabase Edge Functions + TypeScript**

The architecture intentionally keeps the backend modular, transactional, secure, and low-overhead while protecting the application's financial and committee-accountability history.
