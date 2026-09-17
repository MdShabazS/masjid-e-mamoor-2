# Masjid-e-Mamoor 2 — Frontend Architecture

**Document Status:** Baseline  
**Version:** 1.0  
**Product:** Masjid-e-Mamoor 2 Internal Management Application  
**Scope:** V1  
**Last Updated:** 2026-09-17

---

## 1. Purpose

This document defines the frontend architecture for the Masjid-e-Mamoor 2 application.

It describes the frontend structure for:

- Web
- Android
- iOS

The objective is to maintain:

- Consistent product behavior
- Shared business concepts
- Strong role-based navigation
- Secure interaction with the backend
- Maintainable UI code
- Reusable components
- Reliable client state handling
- Clear separation between UI and business logic

This document does not finalize the frontend framework. That decision belongs in `FRONTEND_FRAMEWORK.md` and `TECHNOLOGY_STACK.md`.

---

# 2. Frontend Architecture Goals

The frontend must:

1. Provide role-appropriate interfaces.
2. Support Web, Android, and iOS.
3. Communicate only through approved backend/application interfaces.
4. Never act as the authoritative financial source of truth.
5. Never rely on UI hiding as a security mechanism.
6. Support clear loading, error, empty, success, and offline states.
7. Support English, Hindi, Kannada, and Urdu.
8. Support Urdu RTL layouts.
9. Minimize unnecessary network calls and local storage.
10. Preserve a consistent experience across supported platforms.

---

# 3. Frontend Architecture Model

Conceptually:

```text
┌──────────────────────────────────────────────┐
│               UI / PRESENTATION              │
│                                              │
│ Screens • Pages • Components • Forms         │
└──────────────────────┬───────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────┐
│              VIEW / FEATURE LAYER            │
│                                              │
│ Feature State • User Actions • UI Logic      │
└──────────────────────┬───────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────┐
│             APPLICATION CLIENT               │
│                                              │
│ API Client • Auth Client • File Client       │
│ Notification Client • Sync Client            │
└──────────────────────┬───────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────┐
│                BACKEND / API                 │
└──────────────────────────────────────────────┘
```

Cross-cutting concerns:

```text
Authentication
Authorization
Localization
Navigation
Error Handling
Analytics/Operational Telemetry
Secure Storage
Offline Sync
Accessibility
```

---

# 4. Frontend Platform Strategy

The application has three delivery targets.

## 4.1 Web

The web interface should support:

- Administrative dashboards
- Finance operations
- Reports
- Committee work
- Member management
- Meeting management
- Attendance
- Member donation access

The Masjid's dedicated laptop can use the web application with a printer.

## 4.2 Android

The Android application should support:

- Member donation workflows
- Committee referrals
- Committee work
- Attendance
- Meetings
- Finance workflows according to permissions
- Notifications
- Offline attendance where supported

## 4.3 iOS

The iOS application should support the same approved product workflows, subject to platform-specific capabilities and constraints.

---

# 5. Shared Product Model

Web, Android, and iOS should use the same conceptual domain model.

Shared concepts include:

```text
User
Role
Member
Referral
Monthly Donation
Additional Donation
Payment
Financial Account
Financial Transaction
Expense
Expense Payment
Task
Work Record
Meeting
Decision
Meeting Attendance
Jummah Attendance
Notification
Audit Event
Settings
```

The clients should not invent different interpretations of these concepts.

---

# 6. Frontend Directory Structure

The exact source tree may change with the selected framework, but the logical organization should resemble:

```text
src/
│
├── app/
│   ├── routing/
│   ├── providers/
│   ├── configuration/
│   └── initialization/
│
├── features/
│   ├── auth/
│   ├── users/
│   ├── members/
│   ├── referrals/
│   ├── donations/
│   ├── payments/
│   ├── finance/
│   ├── expenses/
│   ├── committee/
│   ├── meetings/
│   ├── attendance/
│   ├── notifications/
│   ├── reports/
│   ├── audit/
│   └── settings/
│
├── components/
│   ├── common/
│   ├── forms/
│   ├── tables/
│   ├── cards/
│   ├── dialogs/
│   └── feedback/
│
├── services/
│   ├── api/
│   ├── auth/
│   ├── storage/
│   ├── notifications/
│   ├── sync/
│   └── files/
│
├── state/
├── localization/
├── validation/
├── types/
└── utilities/
```

The actual folder names may change with the chosen framework.

---

# 7. Feature-Based Organization

Frontend code should be organized primarily around product features rather than one giant shared folder.

Example:

```text
features/
└── donations/
    ├── screens/
    ├── components/
    ├── hooks/state/
    ├── services/
    ├── validation/
    └── types/
```

This keeps feature-specific behavior together and reduces accidental coupling.

Shared UI primitives should remain in common component areas.

---

# 8. Application Shell

The frontend should have a common application shell.

Conceptually:

```text
┌──────────────────────────────────────────────┐
│ Header / App Bar                             │
├───────────────┬──────────────────────────────┤
│ Navigation     │                              │
│               │       Main Content            │
│ Dashboard     │                              │
│ Members       │                              │
│ Donations     │                              │
│ Finance       │                              │
│ Committee     │                              │
│ Meetings      │                              │
│ Attendance    │                              │
│ Reports       │                              │
│ Settings      │                              │
└───────────────┴──────────────────────────────┘
```

Mobile platforms may use:

- Bottom navigation
- Drawer
- Tab navigation
- Stack navigation

depending on role and screen density.

---

# 9. Role-Based Navigation

The frontend should generate navigation according to the user's authorized capabilities.

Example conceptual areas:

### President

- Dashboard
- Members
- Referrals
- Donations
- Finance
- Expenses
- Committee
- Meetings
- Attendance
- Reports
- Audit
- Users/Roles
- Settings

### Finance

- Dashboard
- Donations
- Payments
- Finance
- Expenses
- Reports
- Relevant member/referral information

### Committee Member

- Dashboard
- Referrals
- My Work
- Open Tasks
- Meetings
- Attendance
- Relevant contribution information

### Member

- Dashboard
- My Donations
- Payment
- Additional Donation
- My Attendance where applicable
- Profile

Actual permissions must come from the authorization model.

---

# 10. Navigation Security Rule

Hiding a menu item is a user-experience feature, not an authorization mechanism.

A user may attempt to access a route manually.

Therefore:

```text
Frontend Route Check
        +
Backend Authorization
```

must both be used.

The backend remains authoritative.

---

# 11. Authentication State

The application should maintain a centralized authentication state.

Conceptually:

```text
Unauthenticated
      ↓
OTP Request
      ↓
OTP Verification
      ↓
Authenticated
      ↓
Load User + Role
      ↓
Application Shell
```

The frontend should handle:

- Loading
- Authentication success
- Authentication failure
- Session expiration
- Logout
- Re-authentication when required

---

# 12. User Session State

The frontend should maintain only the session information required for operation.

Potential client-side information:

- Authenticated user ID
- Role/capabilities
- Session status
- Minimal profile information

The client should not store unnecessary sensitive financial information permanently.

---

# 13. State Management Model

Frontend state should be separated conceptually into:

## Server State

Data received from backend:

- Members
- Donations
- Financial data
- Tasks
- Meetings
- Attendance
- Reports
- Notifications

## UI State

Temporary interface state:

- Dialog open/closed
- Selected tab
- Filters
- Search input
- Form visibility
- Loading indicators

## Local/Offline State

Temporary locally stored information required for supported offline workflows.

Example:

- Offline attendance queue

This separation prevents UI state from being treated as authoritative business state.

---

# 14. Server State Principle

The backend is the source of truth for:

- Financial balances
- Payment verification
- Donation status
- Roles
- Member uniqueness
- Task ownership
- Attendance validity
- Audit information

Frontend state may temporarily be stale and must be synchronized appropriately.

---

# 15. API Client Layer

The frontend should use a centralized API client.

Conceptually:

```text
Feature
  ↓
Feature Service / Data Hook
  ↓
Shared API Client
  ↓
Backend
```

The API client should handle:

- Base URL
- Authentication headers/session
- Request serialization
- Response parsing
- Common errors
- Retry behavior where safe
- Timeout handling
- Request correlation where appropriate

---

# 16. API Error Handling

The frontend should map backend errors into understandable states.

Examples:

```text
401 → Session expired / authentication required
403 → Not authorized
404 → Record not found
409 → Duplicate/conflict
422 → Validation error
429 → Too many requests
5xx → Temporary server/provider issue
```

The frontend should not expose raw internal server errors to users.

---

# 17. Form Architecture

Forms should have:

- Client-side validation for fast feedback
- Server-side validation as the authority
- Clear labels
- Required-field indicators
- Meaningful error messages
- Disabled/loading submit states
- Confirmation for destructive actions where appropriate

Examples:

- Member registration
- Monthly donation amount
- Expense
- Payment
- Task
- Meeting
- Attendance
- UPI configuration

---

# 18. Financial Form Requirements

Financial forms require additional care.

Examples:

### Amount inputs

- Currency-aware
- Numeric validation
- No ambiguous formatting
- Clear decimal/rounding policy

### Transaction references

- Correct character handling
- Appropriate length validation

### Dates

- Explicit date selection
- Clear timezone/date interpretation

### File uploads

- File type validation
- File size validation
- Upload progress
- Upload failure handling

---

# 19. Financial UI Principle

The frontend must not calculate or permanently store financial truth independently.

For example:

```text
Frontend displays balance
        ↓
Backend authoritative balance
```

not:

```text
Frontend adds/subtracts transactions
        ↓
Frontend declares new balance
```

Client-side calculations may be used for previews, but the final financial state comes from the backend.

---

# 20. Donation UI Architecture

The monthly donation interface should clearly distinguish:

- Monthly amount
- Due
- Pending
- Paid/verified
- Outstanding
- Additional donation

Example conceptual screen:

```text
My Monthly Donation
-------------------
Monthly Amount: ₹500

September
Status: Pending
Amount: ₹500

Outstanding: ₹500

[ Pay Monthly Donation ]

[ Make Additional Donation ]
```

For multiple outstanding months:

```text
Outstanding Donations

July       ₹500
August     ₹500
September  ₹500
----------------
Total      ₹1,500

[ Pay Outstanding ]
```

---

# 21. Payment-Link UI Principle

The frontend should communicate clearly:

```text
Payment Link
      ↓
UPI Payment
      ↓
Finance Verification
```

A successful return from a UPI application must not automatically be interpreted by the frontend as final financial verification unless the approved payment architecture explicitly provides authoritative confirmation.

---

# 22. Finance Dashboard UI

The finance interface should prioritize:

- Account balances
- Recent transactions
- Pending verification
- Expenses
- Payments
- Transfers
- Donations
- Collections
- Reports

Financial totals should have clear periods and account scopes.

---

# 23. Expense UI

Expense screens should show:

```text
Expense
 ├── Amount
 ├── Category
 ├── Date
 ├── Details
 ├── Bill
 ├── Payments
 ├── Payment Proof
 └── Status
```

Status should be visually clear:

- Added
- Partially Paid
- Paid
- Cancelled

The frontend should prevent obvious invalid actions, but the backend remains authoritative.

---

# 24. Committee Dashboard UI

The committee dashboard should focus on factual progress:

```text
Current Work
─────────────
Total
Completed
In Progress
Pending
Overdue

My Work
────────
Assigned
Claimed
Completed
Overdue

Referrals
─────────
Members Referred
Verified Contributions
```

No ranking or competitive scoring should be shown.

---

# 25. Task UI

A task should clearly display:

- Title
- Description
- Priority
- Deadline
- Assigned/responsible person
- Current status
- Progress
- Completion note
- Related meeting/decision where applicable

Open tasks should clearly show:

```text
Open for Claim
```

The claim operation must be confirmed by the backend.

---

# 26. Task Claiming UI

Conceptually:

```text
Open Task
    ↓
[ Claim Task ]
    ↓
Submitting
    ↓
Backend Result
 ┌───────────────┬───────────────┐
 │ Success       │ Already Taken │
 │               │ / Conflict    │
 ▼               ▼
Assigned         Inform User
```

The UI must handle race conditions gracefully.

---

# 27. Work History UI

A Committee Member should have a dedicated work-history view.

Example:

```text
My Work History

Task A     Completed
Task B     Completed
Task C     In Progress
Task D     Overdue
```

Completed work records should not have a normal delete action for Committee Members.

---

# 28. Meeting UI

Meeting screen sections:

```text
Meeting Details
Agenda
Invited Members
Attendance
Decisions
Follow-up Tasks
History
```

Decision records should display whether they have:

- No task
- Linked task
- Completed linked task
- Pending linked task

---

# 29. Attendance UI

## Jummah

Conceptual flow:

```text
Jummah Attendance
       ↓
[ Mark Present ]
       ↓
Location Permission
       ↓
GPS Validation
       ↓
Success / Failure
```

The UI should clearly explain location permission when required.

## Meeting

```text
Meeting
  ↓
Attendee List
  ↓
Present / Absent
```

Only approved V1 attendance types should be presented.

---

# 30. Offline Attendance UI

When offline:

```text
No Connection
      ↓
Attendance captured locally
      ↓
"Pending Sync"
      ↓
Connection restored
      ↓
Sync
      ↓
Server validation
      ↓
Synced / Rejected with reason
```

The UI should not show offline attendance as permanently verified until synchronization succeeds.

---

# 31. Notifications UI

V1 does not require a complex notification inbox/history.

Instead, notifications should appear through appropriate platform channels and contextual UI.

Examples:

- Payment reminder
- Task assignment
- Task overdue
- Meeting reminder
- Donation verification

Notification content should not expose unnecessary sensitive information.

---

# 32. Reports UI

Report screens should allow authorized users to select:

- Date range
- Report type
- Account
- Relevant filters

Then:

```text
Generate
   ↓
Preview
   ↓
Download / Print
```

Expensive report generation may be handled asynchronously.

---

# 33. PDF/Print UX

Reports intended for the dedicated Masjid laptop/printer should be optimized for:

- A4 printing where appropriate
- Clear table layouts
- Page breaks
- Page numbers
- Reporting period
- Generation timestamp
- Appropriate signature/approval areas
- Readable typography

The web client should provide a straightforward print/download workflow.

---

# 34. File Upload UX

For bills/payment proofs/task attachments where supported:

```text
Select File
    ↓
Validate Type/Size
    ↓
Upload
    ↓
Progress
    ↓
Uploaded
    ↓
Associate with Record
```

Failed uploads should not silently create incomplete financial records.

---

# 35. File Preview

The frontend may provide preview for supported file types.

Examples:

- Image preview
- PDF preview

Preview availability should not change authorization.

A file must still be protected by backend/file-storage permissions.

---

# 36. Localization Architecture

All user-facing strings should come from a localization system rather than hard-coded language-specific UI text.

Conceptually:

```text
UI Key
  ↓
Translation Resource
  ├── English
  ├── Hindi
  ├── Kannada
  └── Urdu
```

The application should support runtime or appropriately persisted language selection.

---

# 37. Urdu RTL Architecture

When Urdu is selected:

```text
LTR Layout
   ↓
RTL Layout
```

The interface should correctly handle:

- Alignment
- Navigation
- Icons
- Forms
- Tables
- Dialogs
- Numbers
- Mixed-language content

The system must not rely on simple text translation alone.

---

# 38. Date and Number Formatting

The frontend should use centralized formatting functions for:

- Dates
- Times
- Currency
- Numbers
- Percentages

Avoid formatting financial values independently in every screen.

---

# 39. Accessibility

The UI should provide:

- Readable text
- Adequate contrast
- Keyboard support on Web
- Screen-reader-friendly labels where practical
- Clear focus states
- Large enough touch targets
- Error messages associated with fields
- Non-color-only status indicators

Accessibility should be treated as a product requirement, not only a visual enhancement.

---

# 40. Responsive Design

The web application should work across:

- Dedicated laptop
- Desktop
- Tablet
- Mobile browser

Mobile applications should use platform-appropriate interaction patterns while retaining the same product rules.

---

# 41. Loading States

Every asynchronous operation should have an explicit state.

Examples:

```text
Loading
Refreshing
Submitting
Uploading
Syncing
Generating
```

Avoid leaving users uncertain whether an operation is still running.

---

# 42. Empty States

Screens with no records should provide useful context.

Examples:

```text
No Pending Donations
No Open Tasks
No Meetings Scheduled
No Transactions in Selected Period
```

Empty states should not be confused with failed data loading.

---

# 43. Error States

The UI should distinguish:

- No data
- Loading failure
- Validation failure
- Unauthorized access
- Conflict
- Network unavailable
- External-service failure

Users should be given an actionable explanation where possible.

---

# 44. Destructive Actions

Destructive operations such as financial transaction deletion should have:

- Strong role checks from backend
- Clear warning
- Confirmation
- Explicit record identification
- Appropriate audit event

The UI should avoid accidental destructive clicks.

---

# 45. Unsaved Changes

For forms involving financial or administrative information, the frontend should warn users before leaving a form with unsaved changes where practical.

---

# 46. Search and Filtering

The frontend should provide search/filter interfaces for large record sets.

Potential areas:

- Members
- Donations
- Transactions
- Expenses
- Tasks
- Meetings
- Attendance
- Audit records

Filters should be passed to backend queries rather than downloading entire datasets unnecessarily.

---

# 47. Pagination

Large lists should use pagination or incremental loading.

Potential lists:

- Members
- Financial transactions
- Donations
- Expenses
- Work history
- Audit logs
- Attendance history

The frontend must not assume that a single API response contains the complete dataset.

---

# 48. Dashboard Performance

Dashboards should avoid loading every underlying record just to display summary numbers.

Prefer:

```text
Dashboard Request
      ↓
Purpose-built Backend Aggregates
      ↓
Summary Metrics
```

Detailed records load only when the user opens a relevant drill-down.

---

# 49. Offline Architecture Boundary

Offline operation is intentionally limited.

V1's primary approved offline workflow is:

**Attendance capture/synchronization**

The frontend should not assume full offline financial functionality.

In particular, the application must not allow stale offline financial calculations to become authoritative financial records without a documented server-side process.

---

# 50. Local Storage

Local storage should contain only what is required.

Potential examples:

- Session information where secure platform storage is appropriate
- Non-sensitive UI preferences
- Language preference
- Temporary offline attendance queue

Avoid storing unnecessary:

- Financial history
- Bills
- Payment proofs
- Sensitive member datasets
- Audit data

Permanent local storage must not become a second database.

---

# 51. Secure Local Storage

Secrets/tokens that require local persistence should use appropriate secure platform mechanisms.

Do not store sensitive authentication credentials in ordinary unprotected key/value storage when the platform provides secure alternatives.

Exact implementation depends on the selected framework/platform.

---

# 52. Notification Routing

The frontend should map notification events to appropriate application destinations.

Example:

```text
Task Assigned
     ↓
Open Notification
     ↓
Task Details
```

```text
Donation Verified
     ↓
Open Donation Record
```

The destination must still re-check current authorization and data state.

---

# 53. Deep-Link Security

Deep links or notification links should not bypass authentication or authorization.

A link may identify a record, but the application must verify:

```text
Authenticated User
+
Authorized Record Access
```

before displaying sensitive information.

---

# 54. Client Validation vs Server Validation

Both are required for different reasons.

### Client validation

Purpose:

- Fast feedback
- Better UX
- Prevent obvious mistakes

### Server validation

Purpose:

- Security
- Data integrity
- Business-rule enforcement
- Concurrency control

The server is authoritative.

---

# 55. Business Rules That Must Not Live Only in Frontend

The following must be enforced server-side:

- Mobile-number uniqueness
- One primary referrer
- Monthly donation rules
- FIFO allocation
- Overpayment handling
- Payment verification
- Financial balance calculations
- Financial deletion authorization
- Expense payment limits
- Expense state transitions
- Task single-claim rule
- Attendance duplicate prevention
- GPS/radius validation
- Role permissions
- Audit event creation

The frontend may mirror these rules for usability but must not own them.

---

# 56. Frontend Security Rules

The frontend must:

- Avoid exposing secrets.
- Avoid hard-coded privileged credentials.
- Avoid trusting client-controlled roles.
- Avoid exposing protected files through public URLs.
- Avoid logging sensitive financial information unnecessarily.
- Avoid storing unnecessary sensitive data locally.
- Handle session expiry safely.
- Clear sensitive transient state on logout.

---

# 57. Client Logging

Frontend logs should avoid sensitive content.

Do not log unnecessarily:

- Full mobile numbers
- Financial details
- Payment references
- Private member data
- Authentication secrets

Development diagnostics should not accidentally become permanent production logs.

---

# 58. Form Submission Idempotency

Retryable submissions should be designed so accidental double taps or network retries do not create duplicate business records.

Examples:

- Donation actions
- Attendance sync
- Member creation
- Task claim
- Expense payment
- Financial operations

The backend remains responsible for the final protection.

---

# 59. Navigation Guarding

The frontend should guard routes based on authentication and available capabilities.

Conceptually:

```text
Route Request
      ↓
Authenticated?
      ├── No → Login
      └── Yes
            ↓
      Authorized?
            ├── No → Access Denied
            └── Yes → Load Screen
```

Server-side authorization remains mandatory.

---

# 60. Shared Component Strategy

Common UI primitives should be reused.

Examples:

- Buttons
- Inputs
- Selects
- Date pickers
- Currency fields
- Cards
- Tables
- Dialogs
- Status badges
- Alerts
- Empty states
- Loading states
- File upload controls

Feature-specific UI should remain in its feature module.

---

# 61. Financial Component Strategy

Create reusable finance-specific components where appropriate.

Examples:

- Currency display
- Account balance card
- Transaction row
- Payment status
- Expense status
- Financial summary
- Report filter

This reduces inconsistent financial presentation across screens.

---

# 62. Status Representation

Statuses should use both:

- Text
- Visual distinction

Do not rely on color alone.

Examples:

```text
Paid
Pending
Due
Overdue
Cancelled
Partially Paid
```

Status labels must come from centralized definitions.

---

# 63. Global Application State

Only truly global state should be stored globally.

Examples:

- Authentication state
- Current user
- Role/capabilities
- Theme/settings if applicable
- Language
- Global connectivity state

Feature-specific data should remain within feature/server-state mechanisms.

---

# 64. Connectivity State

The frontend should expose connection state where useful:

```text
Online
Offline
Reconnecting
Syncing
```

This is especially important for attendance synchronization.

---

# 65. Sync Architecture

For offline-supported operations:

```text
User Action
   ↓
Local Queue
   ↓
Connectivity Available
   ↓
Sync Request
   ↓
Backend Validation
   ↓
Success / Conflict / Rejection
   ↓
Update Local State
```

Each queued operation should have enough metadata to avoid unintended duplicate processing.

---

# 66. Offline Conflict Handling

The application must not silently overwrite server records.

Examples:

```text
Offline Attendance
      ↓
Server already has same attendance
      ↓
Treat as duplicate/successful reconciliation
```

For a real conflict:

```text
Server Rejects
      ↓
Show Clear Reason
      ↓
Mark Queue Item Resolved/Failed
```

---

# 67. File Upload Retry

File uploads may fail because of:

- Network interruption
- File-size limits
- Provider failure
- Authorization failure

The UI should show a clear state.

A failed upload must not be interpreted as a successful attachment.

---

# 68. External Provider States

The frontend should represent external-service states separately from core business states.

Example:

```text
Donation
Financial State: Verified

Notification
Delivery State: Failed / Pending Retry
```

A notification failure must not change the donation's financial state.

---

# 69. Testing Strategy for Frontend

Frontend testing should include:

### Unit

- Formatting
- Validation
- UI logic
- State transformations

### Component

- Forms
- Tables
- Dialogs
- Status displays

### Integration

- API interaction
- Authentication
- Role navigation
- Feature workflows

### End-to-End

Critical workflows:

- Member registration
- Referral
- Donation payment journey
- Finance verification
- Expense
- Task claiming
- Meeting
- Jummah attendance
- Meeting attendance
- Report generation

---

# 70. Role-Based UI Testing

Each role must be tested for:

- Visible navigation
- Allowed screens
- Allowed actions
- Hidden/disabled actions
- Unauthorized route access
- Unauthorized API response handling

Frontend tests complement backend authorization tests.

---

# 71. Responsive Testing

The frontend should be tested on:

- Laptop/desktop
- Tablet
- Mobile-sized viewport
- Android devices
- iOS devices

Important workflows should not depend on a desktop-only layout.

---

# 72. Localization Testing

Verify:

- English
- Hindi
- Kannada
- Urdu

For Urdu, test:

- RTL
- Tables
- Forms
- Navigation
- Dialogs
- Reports where supported

Long translated text must not break layouts.

---

# 73. Frontend Performance Requirements

Prioritize:

- Fast first screen rendering
- Minimal unnecessary API requests
- Lazy loading for large features where appropriate
- Pagination for large lists
- Efficient image/file handling
- Controlled re-rendering
- Appropriate caching of safe read-only data

Do not sacrifice financial correctness for performance optimization.

---

# 74. Frontend Architecture Invariants

The following must remain true:

1. Backend is authoritative.
2. UI visibility is not authorization.
3. Financial state is never client-authoritative.
4. Payment-link interaction is not payment verification.
5. Role information must be validated from trusted backend/authentication state.
6. Sensitive data is not unnecessarily persisted locally.
7. Offline support is limited to explicitly approved workflows.
8. Urdu RTL must be treated as a layout mode, not only a translation.
9. Core business rules are enforced server-side.
10. Retryable operations must not create duplicate records.
11. Financial and committee history must not depend on client-side storage.
12. Notification delivery must not determine business state.

---

# 75. Frontend Technology Decision Boundary

The following remain undecided until technical research:

- Web framework
- Mobile framework
- Shared-code strategy
- UI component library
- State-management library
- Form/validation library
- Networking library
- Localization library
- Secure local-storage mechanism
- Offline synchronization mechanism
- Testing framework
- PDF viewing/printing approach

These choices must be evaluated for:

- Long-term maintenance
- Web/Android/iOS coverage
- Performance
- Security
- Developer productivity
- Free-tier/tooling cost
- Community/support
- Accessibility
- Localization/RTL
- Offline capabilities

---

# 76. Definition of Done

Frontend architecture is ready for implementation when:

- Web/mobile platform strategy is defined.
- Feature boundaries are defined.
- Navigation principles are defined.
- Server/client state separation is defined.
- API-client boundary is defined.
- Offline boundary is defined.
- Localization/RTL requirements are defined.
- Security rules are defined.
- Financial UI constraints are defined.
- Testing layers are defined.
- Technology selection is documented separately.
- Major V1 screens can be designed without inventing missing product rules.

---

# 77. Related Documents

This document should be used with:

- `PROJECT_OVERVIEW.md`
- `PRODUCT_REQUIREMENTS.md`
- `FEATURE_SCOPE.md`
- `USER_ROLES_PERMISSIONS.md`
- `SYSTEM_ARCHITECTURE.md`
- `APPLICATION_ARCHITECTURE.md`
- `FRONTEND_FRAMEWORK.md`
- `BACKEND_ARCHITECTURE.md`
- `TECHNOLOGY_STACK.md`
- `DATABASE_ARCHITECTURE.md`
- `SECURITY_ARCHITECTURE.md`
- `NAVIGATION_FLOW.md`
- `SCREEN_SPECIFICATIONS.md`
- `DEVELOPMENT_TASKS.md`

---

## Document Status

**Frontend Architecture — V1 Baseline**

This document defines the logical frontend architecture for the Masjid-e-Mamoor 2 application.

Specific frontend frameworks and libraries must be selected through technical research and documented separately.
