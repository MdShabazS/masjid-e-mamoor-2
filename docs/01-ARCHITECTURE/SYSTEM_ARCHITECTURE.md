# Masjid-e-Mamoor 2 — System Architecture

**Document Status:** Baseline  
**Version:** 1.0  
**Product:** Masjid-e-Mamoor 2 Internal Management Application  
**Scope:** V1  
**Last Updated:** 2026-09-17

---

## 1. Purpose

This document defines the high-level system architecture for the Masjid-e-Mamoor 2 application.

It describes:

- Major system components
- Responsibilities of each component
- Communication boundaries
- Core data flows
- Security boundaries
- Financial-control boundaries
- External service integration points
- Web/mobile/backend relationships
- Storage principles
- Deployment concepts

This document intentionally does **not** finalize specific frameworks, cloud vendors, database engines, or external providers.

Those decisions belong in the technology and infrastructure documents after technical research.

---

# 2. Architecture Goals

The V1 architecture must support the following goals.

## 2.1 Financial Integrity

Financial transactions must remain consistent, traceable, and auditable.

## 2.2 Committee Accountability

Committee referrals, verified contributions, tasks, meetings, and work history must remain traceable.

## 2.3 Secure Role-Based Access

Users must access only the records and operations authorized for their role.

## 2.4 Permanent Core History

Financial and committee accountability records must not be removed merely to reduce storage costs.

## 2.5 Cost Efficiency

The architecture should support free/low-cost infrastructure where technically appropriate.

## 2.6 Cross-Platform Delivery

The same core backend and data services should support:

- Web
- Android
- iOS

## 2.7 Maintainability

The system should separate concerns so individual modules can evolve without destabilizing unrelated modules.

## 2.8 Controlled Scope

The architecture must serve the approved V1 product rather than introducing unnecessary platform complexity.

---

# 3. Architecture Style

The V1 application should follow a modular client-server architecture.

At the highest level:

```text
                         ┌──────────────────────┐
                         │     WEB CLIENT       │
                         └──────────┬───────────┘
                                    │
                         ┌──────────▼───────────┐
                         │   APPLICATION API    │
                         │     / BACKEND        │
                         └──────────┬───────────┘
                                    │
          ┌─────────────────────────┼─────────────────────────┐
          │                         │                         │
          ▼                         ▼                         ▼
   ┌───────────────┐        ┌───────────────┐        ┌───────────────┐
   │   DATABASE    │        │ FILE STORAGE  │        │ AUTH / OTP    │
   └───────────────┘        └───────────────┘        └───────────────┘
          │                         │                         │
          └─────────────────────────┼─────────────────────────┘
                                    │
                    ┌───────────────┼────────────────┐
                    │               │                │
                    ▼               ▼                ▼
             ┌───────────┐   ┌──────────────┐  ┌─────────────┐
             │NOTIFICATION│   │ PAYMENT / UPI│  │ REPORT / PDF│
             │ SERVICES  │   │ INTEGRATION  │  │ GENERATION  │
             └───────────┘   └──────────────┘  └─────────────┘
                                    ▲
                                    │
                         ┌──────────┴───────────┐
                         │ ANDROID / iOS CLIENT │
                         └──────────────────────┘
```

The actual technology used for each component will be selected later through the technology research phase.

---

# 4. Logical Architecture Layers

The system is separated into logical layers.

```text
┌──────────────────────────────────────────┐
│           PRESENTATION LAYER             │
│ Web / Android / iOS                       │
└────────────────────┬─────────────────────┘
                     │
┌────────────────────▼─────────────────────┐
│          APPLICATION/API LAYER            │
│ Requests, validation, business operations │
└────────────────────┬─────────────────────┘
                     │
┌────────────────────▼─────────────────────┐
│           DOMAIN / SERVICE LAYER          │
│ Members / Donations / Finance / Tasks     │
│ Meetings / Attendance / Reports / Audit   │
└────────────────────┬─────────────────────┘
                     │
┌────────────────────▼─────────────────────┐
│             DATA ACCESS LAYER             │
│ Repository/query/data-access operations   │
└────────────────────┬─────────────────────┘
                     │
┌────────────────────▼─────────────────────┐
│             DATA / STORAGE LAYER          │
│ Database + Object/File Storage            │
└──────────────────────────────────────────┘
```

Cross-cutting infrastructure operates across these layers:

- Authentication
- Authorization
- Audit logging
- Logging/monitoring
- Notifications
- Configuration
- Error handling
- Rate limiting
- Security controls

---

# 5. Client Applications

The system has three user-facing targets.

## 5.1 Web Application

The web client is intended for:

- President
- Vice President
- Secretary
- Finance
- Auditor
- Committee Members
- Members

The dedicated Masjid laptop can use the web application for administrative work, reporting, and printing.

## 5.2 Android Application

The Android client provides mobile access to approved workflows.

## 5.3 iOS Application

The iOS client provides mobile access to the same backend services.

## 5.4 Shared Backend

Web, Android, and iOS must use the same authoritative backend.

The clients must not maintain independent copies of financial truth.

---

# 6. Backend Responsibilities

The backend is the authoritative application layer.

It is responsible for:

- Authentication integration
- Authorization
- Business rules
- Data validation
- Member management
- Referral management
- Donation lifecycle
- Payment verification
- Finance/accounting
- Expense management
- Committee work
- Meetings
- Attendance
- Notifications
- Report generation
- Audit logging
- File authorization
- Transaction integrity

Business-critical rules must be enforced on the backend.

---

# 7. Domain Modules

The backend should be organized into logical modules.

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
└── settings
```

The exact source-tree implementation may differ, but the logical separation should remain.

---

# 8. Authentication Architecture

Authentication follows this conceptual flow:

```text
Client
  ↓
Enter Mobile Number
  ↓
OTP Request
  ↓
Authentication Provider
  ↓
OTP Verification
  ↓
Authenticated Identity
  ↓
Backend Session / Token
  ↓
Authorized Application Access
```

Authentication establishes **who the user is**.

Authorization determines **what the user can do**.

These must remain separate concepts.

---

# 9. Authorization Architecture

For every protected operation:

```text
Incoming Request
      ↓
Authenticate User
      ↓
Identify Role
      ↓
Check Resource Access
      ↓
Check Business Rule
      ↓
Allow / Reject
```

Examples:

```text
Committee Member
→ Can edit own completed work record
→ Cannot delete completed work
```

```text
Member
→ Can view own donation records
→ Cannot view another member's records
```

```text
Auditor
→ Can read financial records
→ Cannot modify financial records
```

```text
President
→ Can perform authorized financial deletion
```

Frontend hiding is not a security boundary.

---

# 10. Database Architecture Boundary

The database is the authoritative structured-data store.

Core structured information includes:

```text
Users
Roles
Members
Referrals
Donation Schedules
Donation Records
Payment Records
Financial Accounts
Financial Transactions
Expenses
Expense Payments
Transfers
Tasks
Work History
Meetings
Meeting Decisions
Meeting Attendance
Jummah Attendance
Notifications
Audit Logs
Settings
```

The selected database engine and exact schema will be defined in:

- `DATABASE_ARCHITECTURE.md`
- `DATABASE_SCHEMA.md`
- `DATA_RELATIONSHIPS.md`

---

# 11. File Storage Architecture

Documents and media should not be stored as large binary values in ordinary transactional records unless the selected storage design explicitly justifies it.

Files may include:

- Expense bills
- Payment proofs
- Task attachments where enabled
- Other approved documentation

Conceptually:

```text
Database
  │
  ├── File metadata
  ├── File ownership
  ├── Record association
  └── Storage reference
          │
          ▼
    Object/File Storage
```

The database stores the relationship and metadata; the file storage layer stores the actual document.

---

# 12. Financial Architecture Boundary

Financial operations require stronger consistency and authorization than normal application data.

The financial subsystem should enforce:

```text
Financial Input
      ↓
Authorization
      ↓
Validation
      ↓
Transaction Processing
      ↓
Ledger Update
      ↓
Balance Update
      ↓
Audit Event
```

Financial records should not be modified through uncontrolled client-side calculations.

---

# 13. Donation Architecture

The monthly donation model separates:

1. Monthly obligation/record
2. Payment attempt/link
3. Actual payment information
4. Finance verification
5. Financial transaction
6. Referral contribution attribution

Conceptually:

```text
Member
  │
  ▼
Monthly Donation Record
  │
  ▼
Payment Link
  │
  ▼
UPI Payment
  │
  ▼
Actual Transaction
  │
  ▼
Finance Verification
  │
  ▼
Financial Record
  │
  └──────────────► Referral Contribution
```

A payment-link event must not directly create a verified financial receipt.

---

# 14. Combined Donation Payment Architecture

For multiple complete outstanding monthly records:

```text
Outstanding Months
      ↓
Calculate Complete Outstanding Amount
      ↓
Create Combined Payment Link
      ↓
Payment
      ↓
Finance Verification
      ↓
FIFO Allocation
      ↓
Oldest Month
      ↓
Next Month
      ↓
Next Month
      ↓
Any Excess
      ↓
Additional General Donation
```

The allocation must preserve month-level history.

---

# 15. UPI Architecture

V1 uses one active Masjid UPI ID.

Conceptually:

```text
Finance
  ↓
Configure Active UPI ID
  ↓
Stored in Application Configuration
  ↓
Payment Link Generator
  ↓
Member Payment
```

Changing the UPI ID affects future payment links.

Historical financial transactions do not change because the UPI ID was later modified.

UPI configuration changes must generate an audit event.

---

# 16. Payment Verification Boundary

Payment verification must not rely on the frontend's assumption of success.

The system treats these as distinct states:

```text
Link Created
      ↓
Link Delivered
      ↓
Link Opened
      ↓
Payment Attempted
      ↓
Payment Received
      ↓
Finance Verified
```

Only the verified state should update the verified donation/financial records.

The final external payment verification mechanism will be selected during technology/provider research.

---

# 17. Finance and Ledger Architecture

Financial accounts are independent logical buckets.

Example:

```text
Masjid Financial System
       │
       ├── Cash Account
       ├── Bank Account
       ├── UPI Account
       └── Other Account
```

Each account has:

- Opening balance
- Transaction history
- Current/running balance
- Active/deactivated state

Overall Masjid funds are calculated from the appropriate account balances.

---

# 18. Internal Transfer Architecture

Internal transfers use linked records.

Example:

```text
Transfer ID: T-001

Cash Account
  -₹20,000

Bank Account
  +₹20,000
```

Total Masjid funds do not change.

The system must prevent a normal transfer operation from being represented as external income or expense.

---

# 19. Expense Architecture

Expense flow:

```text
Finance
  ↓
Create Expense
  ↓
Bill Attached
  ↓
Payment(s)
  ↓
Payment Proof
  ↓
Expense State
  ↓
Financial Ledger
  ↓
Audit Log
```

One expense may contain multiple payments.

The backend must enforce that:

```text
Total Recorded Payments ≤ Expense Amount
```

unless a documented correction workflow changes the expense amount.

---

# 20. Committee Architecture

The committee subsystem covers:

- Referrals
- Contribution attribution
- Tasks
- Work records
- Meetings
- Decisions
- Follow-up tasks
- Attendance
- Progress dashboards

Conceptually:

```text
Committee Member
      │
      ├── Referrals
      │      ↓
      │   Members
      │      ↓
      │   Verified Donations
      │
      ├── Tasks
      │      ↓
      │   Work History
      │
      └── Meetings
             ↓
          Decisions
             ↓
        Optional Tasks
             ↓
          Completion
```

---

# 21. Task Claiming Architecture

Open tasks have a concurrency-sensitive rule:

> Only one eligible Committee Member may successfully claim an open task.

The architecture must enforce this on the backend/database transaction boundary.

Conceptually:

```text
Member A ──┐
           ├── Claim Request
Member B ──┘
             ↓
      Atomic Server Check
             ↓
       First Valid Claim
             ↓
        Task Assigned
             ↓
   Other Claim Request Rejected
```

The frontend must not be trusted to enforce this rule.

---

# 22. Meeting Architecture

Meeting records can connect operational decisions to committee work.

```text
Meeting
  │
  ├── Invited Members
  ├── Attendance
  └── Decisions
        │
        ├── Decision only
        │
        └── Decision requiring work
                  ↓
                Task
                  ↓
             Responsible Member
                  ↓
               Completion
```

This creates traceability from decisions to actual work.

---

# 23. Attendance Architecture

V1 supports only:

- Jummah attendance
- Scheduled meeting attendance

## 23.1 Jummah

```text
Member
  ↓
Mark Present
  ↓
Current Location
  ↓
Server Validation
  ├── Radius
  ├── Accuracy
  └── Duplicate Check
  ↓
Attendance Record
```

## 23.2 Meeting

```text
Scheduled Meeting
      ↓
Invited Members
      ↓
Attendance
      ↓
Meeting Attendance Record
```

The system does not implement daily attendance for Fajr, Zohr, Asr, Maghrib, or Isha.

---

# 24. Offline Attendance Architecture

Where offline attendance is supported:

```text
Device
  ↓
Create Local Attendance Event
  ↓
Local Validation
  ↓
Encrypted/Protected Local Queue
  ↓
Connectivity Returns
  ↓
Server Synchronization
  ↓
Server Validation
  ↓
Persist
```

The server remains authoritative.

Duplicate and authorization checks must still be enforced during synchronization.

---

# 25. Notification Architecture

Notifications are a separate delivery mechanism from core business logic.

Conceptually:

```text
Business Event
      ↓
Notification Service
      ↓
Delivery Provider
      ├── Push
      ├── SMS
      └── WhatsApp
```

The database/business state is changed independently of whether a notification is delivered.

For example:

```text
Donation Verified
      ↓
Donation State = Verified
      ↓
Notification Attempt
```

not:

```text
Notification Delivered
      ↓
Donation State = Verified
```

---

# 26. Notification Payload Security

Notification payloads must avoid unnecessary sensitive information.

A push notification should generally direct the user to the relevant application screen rather than exposing:

- Full financial details
- Sensitive member information
- Complete transaction references
- Private audit information

The client fetches authorized details after authentication.

---

# 27. Audit Architecture

The audit system records important state-changing events.

Conceptually:

```text
Protected Operation
      ↓
Business Transaction
      ↓
Audit Event
      ↓
Audit Storage
```

Useful audit fields include:

- Event ID
- Timestamp
- User ID
- Action
- Record type
- Record ID
- Result
- Relevant metadata

The audit system should avoid logging every read/click.

---

# 28. Audit Integrity

Audit records should be protected from unauthorized modification.

The operational application should not expose arbitrary audit editing to normal users.

At minimum:

- Users cannot rewrite audit history.
- Unauthorized users cannot delete audit records.
- Financial and permission-sensitive actions generate audit records.
- Audit timestamps are server-controlled.

The exact tamper-resistance mechanism will be finalized during security architecture.

---

# 29. Reporting Architecture

Reports are generated from authoritative stored records.

Conceptually:

```text
Database
   ↓
Validated Query / Report Service
   ↓
Report Dataset
   ↓
Report Renderer
   ↓
Screen / Print / PDF
```

Generated PDFs should preferably be created on demand rather than permanently storing every generated copy.

---

# 30. Financial Report Flow

```text
Select Reporting Period
        ↓
Apply Filters
        ↓
Read Financial Records
        ↓
Calculate Report
        ↓
Validate Totals
        ↓
Render Report
        ↓
Display / Download / Print
```

The report generator must not independently invent financial totals.

Totals must derive from the authoritative ledger/data model.

---

# 31. Storage Architecture

The architecture should minimize storage through:

- Normalized database records
- References instead of duplicate data
- Object storage for files
- Metadata rather than repeated content
- Temporary report generation
- File-size validation
- Reasonable compression where safe
- Controlled technical-log retention

The following must not be deleted for storage optimization:

- Financial history
- Donation history
- Expense/payment records
- Transfer history
- Committee work history
- Required audit history

---

# 32. Data Ownership Model

Each major domain has an authoritative subsystem.

| Data | Authoritative Component |
|---|---|
| User identity | Authentication/User system |
| Role | Authorization/User system |
| Member | Member module |
| Referral | Referral module |
| Monthly donation | Donation module |
| Verified payment | Payment/Finance module |
| Financial transaction | Finance/Ledger |
| Expense | Expense module |
| Work record | Committee module |
| Meeting | Meeting module |
| Attendance | Attendance module |
| Audit event | Audit module |
| File object | Storage system |

Other modules should reference authoritative records rather than duplicating them unnecessarily.

---

# 33. Cross-Module Data Flow

## 33.1 Referral to Donation

```text
Committee Member
      ↓
Referral
      ↓
Member
      ↓
Monthly Donation
      ↓
Payment
      ↓
Finance Verification
      ↓
Financial Transaction
      ↓
Committee Contribution
```

## 33.2 Meeting to Work

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
      ↓
Permanent Work History
```

## 33.3 Expense to Audit

```text
Expense
      ↓
Payment
      ↓
Financial Ledger
      ↓
Balance
      ↓
Audit Event
      ↓
Financial Report
```

---

# 34. Transaction Boundaries

Operations that change multiple related records should use an appropriate transactional mechanism.

Examples:

### Donation verification

May affect:

- Donation record
- Payment record
- Financial transaction
- Member contribution totals
- Referral contribution totals
- Audit event

These changes should be treated as one logically consistent operation.

### Expense payment

May affect:

- Expense payment record
- Expense status
- Financial transaction
- Account balance
- Audit event

These should remain consistent.

### Internal transfer

May affect:

- Source account transaction
- Destination account transaction
- Transfer record
- Account balances
- Audit event

These should be committed consistently.

---

# 35. Concurrency Requirements

The backend must account for simultaneous actions.

Important examples:

- Two Committee Members attempting to claim one task.
- Two users attempting to modify the same financial record.
- Duplicate attendance requests.
- Duplicate payment verification.
- Duplicate member creation requests.
- Simultaneous account operations.

Where necessary, use database constraints, atomic operations, transactions, idempotency controls, or equivalent mechanisms.

---

# 36. Idempotency

Operations that may be retried should be designed to avoid creating duplicate records.

Examples:

- Payment verification
- Payment webhook/event processing if supported
- Attendance synchronization
- Notification-triggered background jobs
- Member creation
- Financial transaction creation

A repeated request should not silently create a second financial transaction.

---

# 37. Error Handling Architecture

Errors should be categorized into:

```text
Validation Error
Authorization Error
Authentication Error
Not Found
Conflict / Duplicate
Business Rule Violation
External Service Error
Server Error
```

The backend should return controlled error responses.

The frontend should present user-friendly messages without exposing internal implementation details.

---

# 38. External Service Boundary

External services may be used for:

- OTP
- Push notifications
- SMS
- WhatsApp
- UPI/payment flow
- File storage
- PDF rendering
- Monitoring

Each external dependency must be isolated behind an internal integration/service boundary where practical.

This reduces vendor lock-in and allows providers to be changed later.

---

# 39. Configuration Architecture

Environment-specific configuration should not be hard-coded into source code.

Examples:

- Database connection
- Authentication provider configuration
- Storage configuration
- Notification provider credentials
- Payment-related configuration
- Application URLs
- Environment flags
- Monitoring configuration

Sensitive secrets must be stored using secure environment/secret-management facilities.

---

# 40. Environment Separation

The project should support separate environments conceptually:

```text
Development
     ↓
Staging / Testing
     ↓
Production
```

Production financial data must not be casually used in development/testing.

Test environments should use controlled or synthetic data.

---

# 41. Web/Mobile Synchronization

All clients should communicate with the same authoritative backend.

```text
Web ────────┐
            │
Android ────┼──► Backend ─► Database / Services
            │
iOS ────────┘
```

A client should not independently redefine financial business rules.

Examples:

- Monthly donation calculations come from the authoritative business logic.
- Permission checks are performed server-side.
- Financial balances are derived from authoritative records.
- Attendance duplicate prevention is server-enforced.

---

# 42. Caching Strategy

Caching may be used for read-heavy, low-risk data where appropriate.

Potential candidates:

- Non-sensitive configuration
- Static reference data
- UI metadata
- Frequently accessed aggregate dashboard data

Caching must not become the authoritative source for:

- Financial balances
- Payment verification status
- Role permissions
- Audit records
- Critical task-claim state

Financial and security-sensitive information should prioritize correctness over aggressive caching.

---

# 43. Observability Architecture

The system should provide operational visibility through:

- Application logs
- Error reporting
- Performance monitoring
- Database health information
- Storage usage monitoring
- Background-job monitoring
- External-service failure tracking

Technical logs are different from the business audit log.

```text
Technical Logs
→ Diagnose system behavior

Business Audit Logs
→ Prove important user/system actions
```

These should not be treated as the same dataset.

---

# 44. Backup and Recovery Boundary

Backup and recovery must protect the authoritative data.

At minimum, recovery planning should cover:

- Database
- File/object storage
- Configuration
- Critical application state

The exact backup schedule, retention, restoration testing, and provider capabilities will be defined in:

`BACKUP_AND_RECOVERY.md`

---

# 45. Security Boundaries

Major security boundaries are:

```text
Internet / Client
       │
       ▼
Authentication
       │
       ▼
Authorization
       │
       ▼
Application/API
       │
       ├── Database
       ├── File Storage
       └── External Services
```

No client should connect directly to unrestricted financial tables or privileged storage operations.

---

# 46. Financial Security Boundary

Financial operations require:

- Authenticated user
- Explicit authorization
- Server-side validation
- Transaction-safe updates
- Audit logging
- Controlled destructive actions

Example:

```text
Delete Financial Transaction
        ↓
Authenticate
        ↓
Check President Role
        ↓
Validate Transaction
        ↓
Confirm Deletion
        ↓
Update Ledger / Balances
        ↓
Write Audit Event
```

---

# 47. Privacy Boundary

Sensitive records should be visible only to authorized users.

Examples:

```text
Member
→ Own donation data
```

```text
Committee Member
→ Own work history
→ Relevant referral/contribution records
```

```text
President / Secretary
→ Appropriate committee-management visibility
```

```text
Auditor
→ Financial review records
```

Exact record-level visibility is governed by `USER_ROLES_PERMISSIONS.md` and `SECURITY_ARCHITECTURE.md`.

---

# 48. Performance Architecture Principles

The system should prioritize efficient handling of:

- Dashboard queries
- Member searches
- Donation history
- Financial reports
- Committee work history
- Attendance reports

Use appropriate:

- Database indexes
- Pagination
- Query limits
- Aggregation queries
- Caching where safe
- Background processing for expensive non-critical work

Large reports and document generation should not block normal user operations unnecessarily.

---

# 49. Scalability Direction

Although V1 is dedicated to one Masjid, the architecture should avoid decisions that make future technical expansion unnecessarily difficult.

However:

**Future scalability does not mean implementing multi-Masjid features in V1.**

The V1 architecture must remain focused on Masjid-e-Mamoor 2.

---

# 50. Modular Expansion

Future modules, if approved later, should be added as isolated domains where practical.

Possible future expansion must not require breaking:

- Financial transaction integrity
- Existing member records
- Committee work history
- Audit history
- Existing role controls

No future feature should be assumed to exist simply because the architecture can accommodate it.

---

# 51. Core System Flow

The complete logical flow is:

```text
                         USER
                          │
                          ▼
                 ┌─────────────────┐
                 │ AUTHENTICATION  │
                 └────────┬────────┘
                          │
                          ▼
                 ┌─────────────────┐
                 │ AUTHORIZATION   │
                 └────────┬────────┘
                          │
        ┌─────────────────┼─────────────────────┐
        │                 │                     │
        ▼                 ▼                     ▼
   MEMBERS          COMMITTEE               FINANCE
        │                 │                     │
        │                 │                     │
        ▼                 ▼                     ▼
   REFERRALS          TASKS / WORK          DONATIONS
        │                 │                     │
        ▼                 ▼                     ▼
   DONATIONS          MEETINGS              PAYMENTS
        │                 │                     │
        │                 ▼                     ▼
        │             DECISIONS             VERIFICATION
        │                 │                     │
        │                 ▼                     ▼
        │               TASKS                LEDGER
        │                 │                     │
        │                 ▼                     ▼
        │             COMPLETION             BALANCES
        │                 │                     │
        └───────────┬─────┴──────────────┬──────┘
                    │                    │
                    ▼                    ▼
              AUDIT / HISTORY       REPORTING / PDF
                    │                    │
                    └─────────┬──────────┘
                              ▼
                      DASHBOARDS / PRINT
```

---

# 52. Core Architectural Invariants

The following rules must remain true regardless of technology choice.

### Invariant 1

A payment link does not equal payment verification.

### Invariant 2

Only verified financial transactions contribute to verified donation totals.

### Invariant 3

Mobile number uniqueness prevents duplicate member creation.

### Invariant 4

One member has one primary referrer in V1.

### Invariant 5

The oldest unpaid monthly donation is settled first for combined payments.

### Invariant 6

An additional donation never changes future monthly dues automatically.

### Invariant 7

Overpayment beyond monthly outstanding is recorded as additional General Donation.

### Invariant 8

Financial records are not deleted for storage optimization.

### Invariant 9

Committee work history is not deleted for storage optimization.

### Invariant 10

Only one member can successfully claim an open task.

### Invariant 11

Only approved V1 attendance types exist:

- Jummah
- Scheduled meetings

### Invariant 12

Frontend UI restrictions are not sufficient for security.

### Invariant 13

Important state-changing operations must generate audit records.

### Invariant 14

Internal transfers do not change total Masjid funds.

### Invariant 15

Historical records remain consistent when current configuration changes.

---

# 53. Architecture Decision Boundaries

The following decisions are intentionally left to later research:

- Frontend framework
- Mobile framework
- Backend framework/runtime
- Database engine/provider
- Authentication/OTP provider
- Object storage provider
- Hosting provider
- Push provider
- SMS provider
- WhatsApp provider
- Payment/UPI implementation approach
- PDF generation technology
- Monitoring provider
- CI/CD platform

These must be evaluated for:

- Cost
- Free-tier limits
- Security
- Reliability
- Maintainability
- Mobile/web compatibility
- Operational simplicity
- Vendor lock-in
- Production suitability

---

# 54. Architecture Documentation Dependencies

This document should be finalized alongside:

- `APPLICATION_ARCHITECTURE.md`
- `FRONTEND_ARCHITECTURE.md`
- `BACKEND_ARCHITECTURE.md`
- `SECURITY_ARCHITECTURE.md`
- `TECHNOLOGY_STACK.md`
- `DATABASE_ARCHITECTURE.md`
- `HOSTING_CLOUD_INFRASTRUCTURE.md`

---

# 55. Implementation Rule

Implementation must follow the approved architecture.

If implementation requires a change to a core architectural boundary, the relevant documentation must be updated before or together with the implementation change.

Architecture should not silently drift through code.

---

# 56. Definition of Done

The system architecture phase is complete when:

- Major components are identified.
- Client/backend boundaries are defined.
- Financial boundaries are defined.
- Committee-accountability boundaries are defined.
- Authentication/authorization boundaries are defined.
- Data/storage boundaries are defined.
- External service boundaries are defined.
- Core invariants are documented.
- Technology decisions are either documented separately or explicitly pending research.
- The architecture can support all approved V1 workflows.

---

## Document Status

**System Architecture — V1 Baseline**

This document defines the technology-neutral architecture for Masjid-e-Mamoor 2.

Specific technology selections must be documented separately after research and must conform to the architectural invariants defined here.
