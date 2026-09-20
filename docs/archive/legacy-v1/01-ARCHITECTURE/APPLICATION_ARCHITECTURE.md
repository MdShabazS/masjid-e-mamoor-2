# Masjid-e-Mamoor 2 — Application Architecture

**Document Status:** Baseline  
**Version:** 1.0  
**Product:** Masjid-e-Mamoor 2 Internal Management Application  
**Scope:** V1  
**Last Updated:** 2026-09-17

---

## 1. Purpose

This document defines the internal application architecture for the Masjid-e-Mamoor 2 V1 application.

It goes deeper than `SYSTEM_ARCHITECTURE.md` by defining:

- Application modules
- Domain boundaries
- Service responsibilities
- Client responsibilities
- Backend responsibilities
- Cross-module interactions
- Shared infrastructure
- Data ownership
- Business-rule placement
- Background processing
- Error-handling boundaries
- Testing boundaries

This document remains technology-neutral.

Specific frameworks and providers are defined separately after technical research.

---

# 2. Architectural Objective

The application should be built as a set of clearly separated functional domains that share common infrastructure.

The design should allow:

- Financial logic to remain isolated and reliable.
- Committee accountability logic to remain traceable.
- Member/donation workflows to connect with finance without duplicating financial truth.
- Authentication and authorization to apply consistently across all modules.
- Reports to read authoritative data rather than maintain separate business records.
- Future feature changes without unnecessary rewrites.

---

# 3. Application Architecture Model

The conceptual structure is:

```text
┌──────────────────────────────────────────────────────────────┐
│                     PRESENTATION LAYER                       │
│                                                              │
│   Web UI                 Android UI                 iOS UI    │
└──────────────────────────────┬───────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────┐
│                    APPLICATION/API LAYER                     │
│                                                              │
│ Authentication • Authorization • Validation • Routing        │
└──────────────────────────────┬───────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────┐
│                       DOMAIN MODULES                         │
│                                                              │
│ Members │ Referrals │ Donations │ Finance │ Expenses         │
│ Tasks   │ Meetings  │ Attendance│ Reports │ Notifications    │
│ Audit   │ Settings  │ Users     │ Payments│ Storage          │
└──────────────────────────────┬───────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────┐
│                     SHARED SERVICES                          │
│                                                              │
│ Database Access • File Access • Event/Job Processing         │
│ Logging • Security • Configuration • External Integrations  │
└──────────────────────────────┬───────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────┐
│                    PERSISTENCE / SERVICES                     │
│                                                              │
│ Database • Object Storage • Auth Provider • Notifications    │
│ Payment/UPI Integration • Monitoring • Other Providers       │
└──────────────────────────────────────────────────────────────┘
```

---

# 4. Application Modules

The V1 application is divided into the following logical modules.

```text
01. Authentication
02. Users & Roles
03. Members
04. Referrals
05. Donations
06. Payments / UPI
07. Finance / Accounts
08. Expenses
09. Committee Tasks / Work
10. Meetings
11. Attendance
12. Notifications
13. Reports
14. Audit
15. Storage
16. Settings
```

Each module should have a defined responsibility and should not become a catch-all area for unrelated business logic.

---

# 5. Authentication Module

## Responsibility

Establish the identity of the user.

## Responsibilities

- Mobile-number authentication
- OTP request
- OTP verification
- Session/token establishment
- Logout
- Authentication-state handling
- Authentication security controls

## Does Not Own

- Role assignment
- Financial permissions
- Member referral relationships
- Donation verification

Authentication answers:

> Who is this user?

Authorization answers:

> What is this user allowed to do?

---

# 6. Users & Roles Module

## Responsibility

Manage application users and their roles.

## Responsibilities

- User profile
- Role assignment
- Role changes
- User activation/deactivation
- Application access state
- User-to-member relationship where applicable

## Authority

President is the expected authority for user and role management.

## Does Not Own

- OTP authentication
- Financial transaction logic
- Committee work logic

---

# 7. Members Module

## Responsibility

Manage registered Masjid members.

## Responsibilities

- Member creation
- Member profile
- Mobile-number uniqueness
- Member status
- Member data updates
- Member lookup
- Member-related dashboard information

## Core Rule

Mobile number must be unique.

The database/backend must enforce uniqueness.

## Relationships

Members may have:

- One primary referrer
- Monthly donation records
- Additional donations
- Payment records
- Attendance records

---

# 8. Referrals Module

## Responsibility

Manage committee-member referral relationships.

## Responsibilities

- Create referral
- Associate member with primary referrer
- Referral count
- Referral history
- Referral attribution correction
- Referral contribution aggregation

## Core Rule

One member has one primary referrer in V1.

## Important Boundary

The Referrals module records attribution.

The Finance/Donation modules determine whether money has actually been received and verified.

Therefore:

```text
Referral
≠
Donation
```

and:

```text
Referral
+
Verified Donation
→
Referral Contribution
```

---

# 9. Donations Module

## Responsibility

Manage member donation obligations and donation records.

## Responsibilities

- Monthly donation amount
- Effective monthly amount changes
- Monthly donation records
- Due/pending/paid states
- Outstanding calculations
- Additional General Donation
- Anonymous donation records
- Donation history
- Overpayment classification
- Combined outstanding donation calculation
- FIFO allocation preparation

## Core Rule

Monthly donation is a complete-month obligation.

A partial amount does not complete the month's donation.

---

# 10. Monthly Donation Lifecycle

The Donations module manages:

```text
Monthly Amount
      ↓
Monthly Record Created
      ↓
Due
      ↓
Payment Requested
      ↓
Payment Received
      ↓
Finance Verification
      ↓
Verified / Paid
```

An unpaid record remains in history.

The system must not delete unpaid historical months.

---

# 11. Combined Outstanding Donations

The Donations module determines:

- Which months are outstanding
- Total amount of complete outstanding months
- Allocation order

Allocation order:

```text
Oldest outstanding month
        ↓
Next outstanding month
        ↓
Next outstanding month
```

Actual financial posting remains coordinated with the Finance/Payments subsystem.

---

# 12. Overpayment Handling

When a verified payment exceeds the amount required to settle complete outstanding monthly donations:

```text
Verified Payment
      ↓
Settle complete monthly donations
      ↓
Remaining amount
      ↓
Additional General Donation
```

The remaining amount must not automatically reduce future monthly dues.

---

# 13. Payments / UPI Module

## Responsibility

Handle payment-link creation and payment-related workflow state.

## Responsibilities

- Payment-link creation
- Applicable payment amount
- Payment-link expiry
- UPI destination configuration
- Payment attempt metadata where required
- Payment reference data
- Payment verification handoff
- Duplicate payment-event protection where applicable

## Important Boundary

This module does not independently declare a payment financially verified without the approved verification mechanism.

---

# 14. UPI Configuration

V1 supports:

- One active Masjid UPI ID
- Finance-managed configuration

Flow:

```text
Finance
  ↓
Set Active UPI ID
  ↓
Configuration Stored
  ↓
Payment Link Generator Uses Active UPI ID
```

Historical transactions must remain unchanged when the active UPI ID changes.

---

# 15. Finance / Accounts Module

## Responsibility

Maintain the authoritative financial ledger and account balances.

## Responsibilities

- Financial accounts
- Opening balances
- Financial transactions
- Income
- Donation financial postings
- Collections
- Account balances
- Internal transfers
- Financial corrections
- Financial transaction IDs
- Account lifecycle

## Core Principle

The Finance module owns authoritative financial state.

Other modules can request financial operations, but they should not maintain a second independent ledger.

---

# 16. Finance Account Model

Conceptually:

```text
Masjid Finance
   │
   ├── Cash
   ├── Bank
   ├── UPI
   └── Other legitimate account
```

Each account maintains:

- Opening balance
- Transactions
- Current/running balance
- Active/deactivated state

---

# 17. Internal Transfer Module Behavior

Transfer flow:

```text
Source Account
      ↓
Transfer Request
      ↓
Validation
      ↓
Linked Source + Destination Entries
      ↓
Balances Updated
      ↓
Audit Event
```

Total Masjid funds remain unchanged.

---

# 18. Expense Module

## Responsibility

Manage expenses and their payment lifecycle.

## Responsibilities

- Expense creation
- Expense amount
- Expense category
- Description
- Bill
- Payment records
- Payment proof
- Expense statuses
- Multiple payments
- Cancellation
- Amount correction
- Supporting-file relationships

## Statuses

```text
Added
Partially Paid
Paid
Cancelled
```

---

# 19. Expense Payment Model

One expense may have multiple payments.

Example:

```text
Expense = ₹10,000

Payment 1 = UPI  ₹4,000
Payment 2 = Cash ₹3,000
Payment 3 = Bank ₹3,000
```

The application must ensure:

```text
Total Payments ≤ Expense Amount
```

unless a documented expense-amount correction changes the authoritative expense amount.

---

# 20. Expense Document Model

An expense may have:

### Bill

Required before the expense can become Paid.

Supported formats:

- PDF
- JPG
- PNG

### Payment Proof

Required before the expense can become Paid.

Supported formats:

- PDF
- JPG
- PNG

The application should store metadata and secure references rather than duplicating the same file unnecessarily.

---

# 21. Committee Work Module

## Responsibility

Manage committee tasks and work history.

## Responsibilities

- Task creation
- Direct assignment
- Open task
- Task claiming
- Progress
- Deadline
- Priority
- Overdue state
- Completion
- Completion note
- Attachments where enabled
- Work history

## Core Goal

The module must answer:

> What work was assigned, who was responsible, what was done, and when was it completed?

---

# 22. Task Lifecycle

```text
Created
   ↓
Assigned / Open
   ↓
Claimed (if open)
   ↓
In Progress
   ↓
Completed
```

Possible alternate state:

```text
Incomplete
   +
Deadline Passed
   ↓
Overdue
```

---

# 23. Open Task Claiming

An open task can be claimed by an eligible Committee Member.

The system must enforce:

```text
One Open Task
      ↓
Only One Successful Claim
```

This must be enforced through a server-side atomic operation or database-level equivalent.

The frontend must not be responsible for preventing race conditions.

---

# 24. Committee Work History

Completed work records are retained permanently.

The system should store:

- Task
- Responsible member
- Status
- Created date
- Assignment/claim information
- Completion date
- Completion note
- Relevant edit metadata

Committee Members can edit their own completed records according to permissions.

They cannot delete completed work records.

---

# 25. Committee Contribution Aggregation

The application should derive committee contribution information using authoritative records.

Conceptually:

```text
Committee Member
     │
     ├── Referred Members
     │
     └── Verified Donations Through Those Members
                  │
                  ▼
        Verified Referral Contribution
```

The aggregation should not be maintained as a manually edited number.

It should be derived from authoritative records.

---

# 26. Meeting Module

## Responsibility

Manage scheduled committee meetings and decisions.

## Responsibilities

- Meeting creation
- Scheduling
- Location
- Agenda
- Invited members
- Attendance
- Minutes/decisions
- Follow-up requirements
- Decision-to-task relationships
- Meeting history

---

# 27. Meeting Decision Architecture

A meeting decision does not necessarily create work.

```text
Meeting
   ↓
Decision
   ├── No Task Required
   │
   └── Task Required
          ↓
        Task
          ↓
      Responsible Member
          ↓
       Completion
```

This relationship creates traceability without forcing every decision into a task.

---

# 28. Attendance Module

## Responsibility

Manage approved V1 attendance records.

V1 supports only:

1. Jummah attendance
2. Scheduled committee meeting attendance

---

# 29. Jummah Attendance

Flow:

```text
Member
   ↓
Mark Present
   ↓
Capture Current Location
   ↓
Validate:
   - Member identity
   - Radius
   - Accuracy
   - Duplicate
   ↓
Create Attendance Record
```

The server is authoritative.

One member can have only one Jummah attendance record for a given Friday/date.

---

# 30. Meeting Attendance

Flow:

```text
Scheduled Meeting
      ↓
Invited Members
      ↓
Attendance Record
      ↓
Meeting Participation History
```

Duplicate attendance for the same member and meeting must be rejected.

---

# 31. Offline Attendance

Where supported:

```text
Device
  ↓
Local Attendance Event
  ↓
Temporary Protected Storage
  ↓
Connectivity Restored
  ↓
Sync Queue
  ↓
Server Validation
  ↓
Persist
```

The server remains authoritative.

A locally stored record does not bypass server-side duplicate or authorization checks.

---

# 32. Notification Module

## Responsibility

Deliver operational notifications.

Potential event sources:

- Donation/payment events
- Pending donation reminders
- Task assignment
- Task deadline
- Task overdue
- Task completion
- Meetings
- Expense events
- Important administrative/security events

Conceptually:

```text
Domain Event
      ↓
Notification Event
      ↓
Delivery Service
      ↓
Push / SMS / WhatsApp
```

The notification system should be asynchronous where appropriate.

---

# 33. Notification Reliability Principle

Business logic must not depend on notification delivery.

Example:

```text
Donation Verified
      ↓
Database State Updated
      ↓
Notification Attempt
```

not:

```text
Notification Sent
      ↓
Donation Becomes Verified
```

---

# 34. Reports Module

## Responsibility

Generate operational and financial reports from authoritative records.

## Responsibilities

- Financial reports
- Donation reports
- Expense reports
- Account reports
- Committee work reports
- Referral/contribution reports
- Attendance reports
- Custom date-range reporting
- PDF rendering
- Print-ready output

Reports must not become a second source of financial truth.

---

# 35. Report Generation Architecture

```text
Report Request
      ↓
Authorization
      ↓
Validated Filters
      ↓
Read Authoritative Data
      ↓
Calculate/Assemble Report
      ↓
Validate Totals
      ↓
Render
      ↓
Display / Download / Print
```

Generated reports should preferably be temporary unless there is an explicit reason to retain them.

---

# 36. Audit Module

## Responsibility

Record important state-changing actions.

Potential events:

- User/role changes
- Referral corrections
- Monthly donation amount changes
- UPI-ID changes
- Financial transaction creation/edit/delete
- Expense/payment events
- Attendance corrections
- Important settings changes
- Security/authentication events

Audit records should be server-generated.

---

# 37. Audit Event Model

Conceptually:

```text
Audit Event
├── Event ID
├── Timestamp
├── Actor User ID
├── Action
├── Resource Type
├── Resource ID
├── Result
└── Relevant Metadata
```

The exact schema is defined separately in `AUDIT_LOG_MODEL.md`.

---

# 38. Storage Module

## Responsibility

Provide controlled access to documents and other application files.

Potential files:

- Expense bills
- Payment proofs
- Approved task attachments
- Other approved documentation

## Responsibilities

- Secure upload
- File validation
- Metadata
- Ownership/association
- Access control
- Replacement
- Deletion according to permissions
- Storage references

---

# 39. Settings Module

## Responsibility

Store controlled application/Masjid configuration.

Potential configuration includes:

- Active Masjid UPI ID
- Attendance radius
- Supported language configuration
- Other approved operational settings

Settings that affect important behavior must be auditable.

Settings should not be spread across arbitrary tables or client-side constants.

---

# 40. Shared Services

All modules may use shared services.

Examples:

```text
Validation Service
Authorization Service
Audit Service
File Service
Notification Service
Configuration Service
Logging Service
Report Service
Transaction Service
Error Service
```

Shared services should remain generic enough to avoid embedding one module's business rules into another module.

---

# 41. Business Rule Placement

Business rules should live on the server/domain side.

Examples:

### Member uniqueness

```text
Mobile Number Unique
```

### Referral

```text
One Primary Referrer
```

### Monthly donation

```text
Complete Month Required
```

### Combined payment

```text
Oldest Month First
```

### Overpayment

```text
Excess → Additional General Donation
```

### Task claim

```text
One Successful Claim
```

### Attendance

```text
One Member + One Friday = One Jummah Record
```

### Financial transfer

```text
Internal Transfer → Total Masjid Funds Unchanged
```

The frontend should display rules, but must not be the authoritative enforcement layer.

---

# 42. Cross-Module Dependency Principles

The modules should interact through defined services/interfaces rather than uncontrolled direct access.

Example:

```text
Donation Module
      ↓
Requests Verified Financial Posting
      ↓
Finance Module
      ↓
Financial Transaction
```

The Donation module should not directly manipulate ledger tables.

---

# 43. Member → Donation Dependency

```text
Member Module
      ↓
Member Identity
      ↓
Donation Module
      ↓
Monthly Donation Records
```

The donation record references the member rather than copying their entire profile.

If a member's profile changes, the historical donation record should remain associated with the same member identity.

---

# 44. Donation → Finance Dependency

```text
Donation
      ↓
Actual Payment
      ↓
Finance Verification
      ↓
Financial Transaction
```

The financial transaction is authoritative for accounting.

The donation module maintains donation-specific state and relationships.

---

# 45. Referral → Donation Dependency

```text
Referral
      ↓
Member
      ↓
Verified Donation
      ↓
Referral Contribution Aggregate
```

This prevents the system from treating a referred member as automatically equivalent to a donation.

---

# 46. Expense → Finance Dependency

```text
Expense
      ↓
Payment
      ↓
Financial Transaction
      ↓
Account Balance
```

The Expense module owns expense workflow.

The Finance module owns the accounting effect.

---

# 47. Committee → Meeting Dependency

```text
Meeting
      ↓
Decision
      ↓
Optional Task
      ↓
Committee Work
```

The Meeting module owns the meeting/decision.

The Committee module owns the resulting task/work.

---

# 48. Attendance → Meeting Dependency

Meeting attendance should reference the scheduled meeting rather than creating an unrelated attendance event.

```text
Meeting
   ↓
Meeting Attendance
   ↓
Member Participation History
```

---

# 49. Event-Driven Operations

Certain actions may generate domain events.

Examples:

```text
MemberCreated
DonationVerified
PaymentVerified
ExpenseCreated
ExpensePaid
TaskAssigned
TaskOverdue
TaskCompleted
MeetingScheduled
AttendanceRecorded
UPIConfigured
RoleChanged
```

Events can trigger secondary operations such as:

- Notifications
- Audit logs
- Aggregation refresh
- Report-cache invalidation

The primary database state must remain authoritative.

---

# 50. Background Job Candidates

Background processing may be used for tasks that do not need to block the user's request.

Potential examples:

- Notification delivery
- SMS/WhatsApp sending
- Push delivery
- Monthly donation record generation
- Overdue-state processing
- Report/PDF generation
- Cleanup of temporary files
- Retry processing for external-service failures

Core financial writes should not be moved to asynchronous processing when doing so could create an incorrect financial state.

---

# 51. Monthly Record Generation

The monthly donation scheduler should conceptually perform:

```text
Current Month
      ↓
Determine Eligible Members
      ↓
Create Next Monthly Record
      ↓
Prevent Duplicate Record
      ↓
Set Amount Applicable for Effective Month
```

The process must be idempotent.

Running it twice must not create two records for the same member/month.

---

# 52. Overdue Task Processing

A scheduled/background process may evaluate deadlines:

```text
Task
 ↓
Deadline Passed?
 ↓
Incomplete?
 ↓
Mark Overdue
 ↓
Create Notification Event
```

Repeated execution must not create duplicate state transitions or duplicate notifications unnecessarily.

---

# 53. API Architecture

The backend should expose domain-oriented APIs rather than arbitrary database CRUD endpoints.

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

Exact endpoint naming conventions will be defined during backend design.

---

# 54. API Design Principles

APIs should provide:

- Authentication
- Authorization
- Validation
- Consistent errors
- Pagination
- Filtering
- Sorting where necessary
- Idempotency for retry-sensitive operations
- Audit integration for important state changes

Sensitive endpoints should not expose unnecessary fields.

---

# 55. Read vs Write Separation

The application should conceptually distinguish:

### Read operations

```text
View
Search
Filter
Aggregate
Report
```

### Write operations

```text
Create
Update
Verify
Cancel
Delete
Correct
Claim
Complete
```

Write operations receive stronger validation and authorization.

Financial writes receive the strongest control.

---

# 56. Pagination and Query Control

Large datasets should not be loaded in one request.

Potential candidates:

- Members
- Donations
- Financial transactions
- Expenses
- Work history
- Audit logs
- Attendance history

Use:

- Pagination
- Date filters
- Search
- Indexed fields
- Limited result sets

Reports may use separate optimized queries rather than normal screen queries.

---

# 57. Caching Boundary

Caching can be used for:

- Static configuration
- Low-risk reference data
- Non-sensitive dashboard summaries where appropriate

Avoid using stale cache as the source of truth for:

- Financial balances
- Payment verification
- Role permissions
- Audit records
- Task claim state

---

# 58. Error Architecture

Application errors should use consistent categories:

```text
Authentication Error
Authorization Error
Validation Error
Duplicate / Conflict
Not Found
Business Rule Violation
External Provider Failure
Rate Limit
Server Error
```

The backend should return safe, structured error information.

The frontend should translate these into understandable user messages.

---

# 59. Security Architecture Boundary

Security concerns should cut across the entire application.

Every protected request should pass through:

```text
Authentication
      ↓
Authorization
      ↓
Validation
      ↓
Business Rules
      ↓
Operation
      ↓
Audit (where required)
```

This sequence applies especially to financial and administrative operations.

---

# 60. Financial Transaction Boundary

A financial operation that modifies multiple related records should be atomic where required.

Example:

```text
Verify Donation
      ↓
Donation State
      +
Payment Verification
      +
Financial Transaction
      +
Referral Contribution Impact
      +
Audit Event
```

The implementation must prevent a state where only some of these changes succeed while others fail.

---

# 61. Idempotency Requirements

The application must prevent duplicate processing when a request is retried.

Critical operations include:

- Member creation
- Monthly record generation
- Payment verification
- Payment event processing
- Attendance synchronization
- Task claiming
- Financial transaction creation
- Notification jobs

---

# 62. Data Consistency Rules

The system must preserve:

### Member consistency

One mobile number → one member.

### Referral consistency

One member → one primary referrer.

### Donation consistency

One member → appropriate monthly record per month.

### Attendance consistency

One member + one Friday → one Jummah record.

One member + one scheduled meeting → one meeting-attendance record.

### Task consistency

One open task → one successful claimant.

### Financial consistency

Account balances correspond to authoritative transactions.

---

# 63. Client Responsibilities

The Web/Android/iOS clients are responsible for:

- Rendering UI
- Collecting input
- Local validation for usability
- Authentication UX
- Displaying server responses
- Offline queueing where supported
- Local state management
- User-friendly error presentation
- Notification handling
- Navigation

The client is **not** authoritative for:

- Permissions
- Financial balances
- Payment verification
- Task-claim ownership
- Duplicate prevention
- Audit records

---

# 64. Offline Responsibilities

Only explicitly supported features should operate offline.

For V1, attendance is the key offline candidate.

Other financial operations should generally require server connectivity unless a later documented architecture decision explicitly supports secure offline financial transactions.

Financial state must never be silently assumed while offline.

---

# 65. File Access Architecture

File access should follow:

```text
User
  ↓
Authenticated Request
  ↓
Authorization Check
  ↓
Record-Level Authorization
  ↓
Secure File Reference
  ↓
File Retrieval
```

Direct publicly guessable file URLs should be avoided for sensitive documents.

---

# 66. Report Security

Reports may contain sensitive information.

Therefore:

- Report generation requires authorization.
- Generated files must use controlled access.
- Temporary files should expire/clean up where appropriate.
- Sensitive reports must not be publicly accessible.
- Permanent report storage should only occur when required.

---

# 67. Application State vs Server State

The clients may cache application state for user experience.

However:

```text
Server
  ↓
Authoritative Business State
```

Client caches are temporary representations.

When the server state changes, relevant clients must reconcile their local state.

---

# 68. Dashboard Architecture

Dashboards should be generated from authoritative domain data.

Example President dashboard:

```text
Members
   +
Referrals
   +
Verified Donations
   +
Financial Summary
   +
Committee Work
   +
Meetings
   +
Attendance
   +
Audit Indicators
```

Dashboard numbers should be derived from the same data used by detailed screens and reports.

---

# 69. Dashboard Aggregation

Avoid storing manually editable dashboard totals where possible.

Instead:

```text
Authoritative Records
      ↓
Aggregation Query / Service
      ↓
Dashboard Metric
```

This reduces the risk of totals becoming inconsistent.

For performance, safe cached/derived summaries may be introduced later, but the underlying source of truth remains authoritative records.

---

# 70. Search Architecture

Search should respect authorization.

Examples:

```text
President
→ Broad authorized search
```

```text
Committee Member
→ Relevant authorized members/referrals
```

```text
Member
→ Own records
```

Search indexes must not bypass record-level permissions.

---

# 71. Settings and Configuration Boundary

Configuration has two categories.

## Application configuration

Examples:

- Service URLs
- Environment settings
- API credentials
- Technical configuration

## Masjid operational configuration

Examples:

- Active UPI ID
- Attendance radius
- Supported language behavior
- Approved operational settings

These must not be mixed together.

---

# 72. External Integration Architecture

External systems should be accessed through internal adapters/services.

Conceptually:

```text
Application
   ↓
Internal Integration Interface
   ↓
External Provider
```

Potential integrations:

- OTP provider
- Push notification provider
- SMS provider
- WhatsApp provider
- UPI/payment mechanism
- Storage provider
- PDF generation service/provider
- Monitoring service

This structure allows providers to be replaced without rewriting core business logic.

---

# 73. Provider Failure Handling

External provider failures should be isolated.

Example:

```text
Donation Verified
      ↓
Notification Provider Fails
      ↓
Donation remains Verified
      ↓
Notification marked for retry/failure handling
```

The provider outage must not roll back a valid financial state merely because a notification failed.

---

# 74. Module Coupling Rules

Modules should avoid circular dependencies.

Prefer:

```text
Domain A
   ↓
Shared Service / Domain Interface
   ↓
Domain B
```

Avoid:

```text
Domain A ↔ Domain B ↔ Domain C ↔ Domain A
```

The architecture should keep core domains independently understandable.

---

# 75. Financial Module Isolation

The financial subsystem should be treated as a high-control domain.

Other modules may request:

- Financial posting
- Verification-related accounting
- Collection posting
- Expense payment posting

But they should not directly rewrite the financial ledger.

---

# 76. Audit Module Isolation

The Audit module should receive events from important state-changing operations.

Normal user operations should not be able to arbitrarily write audit records as if they were trusted system actions.

Audit records should be created through trusted server-side mechanisms.

---

# 77. Testing Boundaries

Each module should have:

### Unit tests

Business rules and pure logic.

### Integration tests

Database/service interactions.

### API tests

Authorization and request/response behavior.

### End-to-end tests

Critical workflows across modules.

Examples:

```text
Referral → Member → Donation → Payment → Finance
```

```text
Meeting → Decision → Task → Completion
```

```text
Expense → Payment → Ledger → Report
```

---

# 78. Critical End-to-End Application Flows

## Flow A — New Member

```text
Committee Member
      ↓
Enter Name + Mobile
      ↓
Duplicate Check
      ↓
Member Created
      ↓
Primary Referrer Recorded
      ↓
Monthly Amount Confirmed
      ↓
Payment Link Generated
```

---

## Flow B — Monthly Donation

```text
Member
      ↓
Payment Link
      ↓
UPI Payment
      ↓
Actual Transaction
      ↓
Finance Verification
      ↓
Donation Verified
      ↓
Financial Transaction
      ↓
Referral Contribution
```

---

## Flow C — Additional Donation

```text
Member
      ↓
Enter Amount
      ↓
General Donation
      ↓
UPI
      ↓
Finance Verification
      ↓
Financial Transaction
```

---

## Flow D — Committee Work

```text
President / Secretary
      ↓
Create Task
      ↓
Assigned / Open
      ↓
Claim / Assignment
      ↓
Work
      ↓
Complete
      ↓
Permanent Work History
```

---

## Flow E — Meeting Accountability

```text
Meeting
      ↓
Attendance
      ↓
Decision
      ↓
Optional Task
      ↓
Responsible Member
      ↓
Completion
      ↓
Historical Record
```

---

## Flow F — Financial Expense

```text
Finance
      ↓
Expense
      ↓
Bill
      ↓
Payment(s)
      ↓
Payment Proof
      ↓
Financial Ledger
      ↓
Account Balance
      ↓
Audit
```

---

# 79. Application Deployment Shape

The logical production shape is:

```text
                    Internet
                       │
              ┌────────▼────────┐
              │ Client Platforms│
              │ Web / Android   │
              │ / iOS           │
              └────────┬────────┘
                       │
                ┌──────▼───────┐
                │ Application  │
                │ Backend/API  │
                └──────┬───────┘
                       │
        ┌──────────────┼────────────────┐
        │              │                │
        ▼              ▼                ▼
    Database      File Storage     External Services
                                     │
                      ┌──────────────┼──────────────┐
                      ▼              ▼              ▼
                    OTP         Notifications     UPI/Payment
```

The actual infrastructure provider selection is separate.

---

# 80. Production vs Development Data

The architecture must separate:

```text
Development Data
Staging/Test Data
Production Data
```

Production financial/member records must not be casually copied into development environments.

Synthetic/test data should be used for development and automated testing.

---

# 81. Architecture Decision Records

Important technical decisions should be documented separately as they are made.

Examples:

- Database selection
- Authentication provider
- Mobile framework
- Backend framework
- Hosting
- Storage
- Notification provider
- UPI strategy

The final architecture should link to those decision documents where appropriate.

---

# 82. V1 Architectural Exclusions

The application architecture does not include:

- Multi-Masjid tenancy implementation
- Public Masjid discovery
- Public community platform
- Daily prayer attendance beyond Jummah
- Asset/property module
- Donation ranking engine
- Committee performance scoring engine
- Bank reconciliation engine
- Advances module
- Custom permission-profile engine
- Unnecessary feature-specific microservices

---

# 83. Why V1 Should Not Start as a Large Microservices System

The application has a finite operational scope centered on one Masjid.

V1 should prioritize:

- Simplicity
- Reliability
- Maintainability
- Low infrastructure cost
- Strong transaction consistency
- Easier debugging
- Lower operational burden

A modular application/backend architecture is preferred over unnecessary distributed-service complexity.

The final technology selection may refine this approach, but unnecessary service fragmentation should be avoided.

---

# 84. Architectural Invariants

These rules are mandatory regardless of implementation technology.

1. Mobile number uniqueness must be enforced.
2. One member has one primary referrer in V1.
3. Payment-link interaction is not payment verification.
4. Only verified payments affect verified donation contribution.
5. Monthly donations are complete-month obligations.
6. Combined outstanding payments use oldest-month-first allocation.
7. Overpayment beyond outstanding complete months becomes additional General Donation.
8. Additional donations do not automatically reduce future monthly dues.
9. Financial records are permanent.
10. Committee work history is permanent.
11. Only one person can successfully claim an open task.
12. Jummah and scheduled meeting attendance are the only V1 attendance types.
13. Financial balances derive from authoritative transactions.
14. Internal transfers do not change total Masjid funds.
15. Important state-changing actions are auditable.
16. Backend authorization is mandatory.
17. Client-side checks are not security boundaries.
18. External-provider failures must not corrupt authoritative business state.
19. Retried operations must not create unintended duplicates.
20. Reports derive from authoritative records.

---

# 85. Definition of Done

Application architecture is ready for implementation when:

- Every V1 feature has a logical module.
- Module responsibilities are defined.
- Major dependencies are understood.
- Business rules have an identified enforcement layer.
- Financial boundaries are clear.
- Authentication/authorization boundaries are clear.
- Cross-module workflows are defined.
- External integrations are isolated.
- Storage responsibility is defined.
- Reporting responsibility is defined.
- Audit responsibility is defined.
- Concurrency-sensitive operations are identified.
- Idempotency-sensitive operations are identified.
- V1 exclusions are protected against scope creep.

---

# 86. Related Documents

This document should be used with:

- `PROJECT_OVERVIEW.md`
- `PRODUCT_REQUIREMENTS.md`
- `FEATURE_SCOPE.md`
- `USER_ROLES_PERMISSIONS.md`
- `SYSTEM_ARCHITECTURE.md`
- `FRONTEND_ARCHITECTURE.md`
- `BACKEND_ARCHITECTURE.md`
- `TECHNOLOGY_STACK.md`
- `DATABASE_ARCHITECTURE.md`
- `SECURITY_ARCHITECTURE.md`
- Feature-specific documents
- `TESTING_STRATEGY.md`
- `DEVELOPMENT_TASKS.md`

---

## Document Status

**Application Architecture — V1 Baseline**

This document defines the internal logical architecture of the Masjid-e-Mamoor 2 application.

Specific technologies and infrastructure must be selected and documented separately without violating the architectural invariants defined here.
