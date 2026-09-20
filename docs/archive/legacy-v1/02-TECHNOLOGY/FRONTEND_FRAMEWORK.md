# Masjid-e-Mamoor 2 — Frontend Framework

**Document Status:** Recommended / V1 Baseline  
**Version:** 1.0  
**Product:** Masjid-e-Mamoor 2 Internal Management Application  
**Scope:** V1  
**Last Updated:** 2026-09-17

---

## 1. Purpose

This document records the frontend framework decisions for the Masjid-e-Mamoor 2 application.

The product has three client targets:

- Web
- Android
- iOS

The frontend strategy must provide:

- A strong administrative Web experience.
- One maintainable mobile codebase for Android and iOS.
- Shared TypeScript contracts where useful.
- Clear separation between platform-specific UI and shared business concepts.
- Reliable integration with the Supabase/backend architecture.
- Support for notifications, GPS attendance, secure local storage, offline attendance synchronization, multilingual UI, and RTL for Urdu.

---

# 2. Frontend Framework Decisions

## 2.1 Web

**Selected framework: Next.js 16.x + TypeScript + App Router**

## 2.2 Mobile

**Selected framework: Expo SDK 57 + React Native 0.86 + TypeScript**

## 2.3 Shared Language

**TypeScript**

## 2.4 Web Styling

**Tailwind CSS**

## 2.5 Web Component Strategy

**shadcn/ui-style composable components**

## 2.6 Server Data

**TanStack Query**

## 2.7 Forms

**React Hook Form**

## 2.8 Validation

**Zod**

## 2.9 Testing

- Web end-to-end: Playwright
- TypeScript unit/component testing: framework selected during setup based on package compatibility
- Mobile testing: Expo/React Native-compatible testing plus physical-device validation

---

# 3. Why Next.js for Web

The Masjid application has a significant administrative Web workload:

- Finance
- Financial audit
- Expense management
- Committee dashboards
- Member management
- Reports
- User/role administration
- Audit logs

The Web client therefore needs more than a simple mobile-first website.

Next.js provides the React application framework required for:

- Route structure
- Layouts
- Server/client rendering options
- TypeScript integration
- Production builds
- Navigation
- Middleware/proxy patterns where appropriate
- Web deployment

---

# 4. Why Expo + React Native for Mobile

The Android and iOS applications contain a large amount of shared functionality:

- Authentication
- Member data
- Donations
- Tasks
- Meetings
- Attendance
- Notifications
- Profile

Expo allows the project to maintain one React Native application while accessing mobile capabilities such as:

- Location
- Notifications
- Secure storage
- Device APIs
- Build/distribution tooling

This reduces the need to maintain separate native Android and iOS application code for every feature.

---

# 5. Mobile Version Baseline

At the current documentation baseline:

```text
Expo SDK 57
React Native 0.86
TypeScript
```

The project must use the stable framework release selected at implementation start.

Do not use a beta/canary release in production unless an explicit architecture decision justifies it.

If a newer stable Expo SDK is selected at implementation start, the repository documentation must be updated before development begins.

---

# 6. Shared TypeScript Strategy

The project will use TypeScript across:

```text
Web
Mobile
Backend Edge Functions
Shared Packages
Validation
API Contracts
```

This allows common types to be shared where useful.

Conceptually:

```text
                packages/
                    │
          ┌─────────┼─────────┐
          ▼         ▼         ▼
        types    validation  api-client
          │         │         │
          └─────────┼─────────┘
                    │
          ┌─────────┴─────────┐
          ▼                   ▼
        Web                  Mobile
```

---

# 7. What Should Be Shared

Share code that is genuinely platform-neutral.

Good candidates:

- API types
- Domain types
- Zod schemas
- Enums/status definitions
- Currency/date formatting utilities where platform-neutral
- Validation rules
- API client models
- Permission/capability models
- Design tokens
- Constants

---

# 8. What Should Not Be Forced to Share

Do not force Web and mobile to use identical implementations for:

- Navigation
- Tables
- Desktop dashboards
- Native dialogs
- File pickers
- Notification UI
- Platform-specific settings
- Mobile gesture interactions
- Browser-specific behavior

The goal is consistency of **product behavior**, not identical source code.

---

# 9. Monorepo Frontend Structure

Recommended conceptual structure:

```text
apps/
├── web/
│   └── src/
└── mobile/
    └── src/

packages/
├── types/
├── validation/
├── api-client/
├── shared/
└── design-tokens/
```

The exact final workspace structure may be adjusted during repository setup.

---

# 10. Web Application Structure

Recommended conceptual Next.js structure:

```text
apps/web/
└── src/
    ├── app/
    │   ├── (auth)/
    │   ├── (dashboard)/
    │   ├── members/
    │   ├── donations/
    │   ├── finance/
    │   ├── expenses/
    │   ├── committee/
    │   ├── meetings/
    │   ├── attendance/
    │   ├── reports/
    │   ├── audit/
    │   ├── users/
    │   └── settings/
    │
    ├── features/
    ├── components/
    ├── services/
    ├── hooks/
    ├── validation/
    ├── types/
    └── utilities/
```

The actual Next.js route layout may evolve during screen design.

---

# 11. Mobile Application Structure

Recommended conceptual structure:

```text
apps/mobile/
└── src/
    ├── navigation/
    ├── screens/
    ├── features/
    │   ├── auth/
    │   ├── members/
    │   ├── donations/
    │   ├── payments/
    │   ├── committee/
    │   ├── meetings/
    │   ├── attendance/
    │   ├── notifications/
    │   └── profile/
    │
    ├── components/
    ├── services/
    ├── storage/
    ├── sync/
    ├── localization/
    └── utilities/
```

---

# 12. Web Navigation

The Web application is primarily administrative.

The navigation should adapt to role.

Example President navigation:

```text
Dashboard
Members
Referrals
Donations
Finance
Expenses
Committee
Meetings
Attendance
Reports
Audit
Users
Settings
```

A user must not be able to bypass authorization through direct URLs.

---

# 13. Mobile Navigation

Mobile navigation should prioritize the most common workflows.

Potential structure:

```text
Home
Work
Donations
Meetings
Attendance
Profile
```

Role-specific screens may be nested behind a role-appropriate menu.

The exact final mobile navigation must come from `NAVIGATION_FLOW.md`.

---

# 14. Dashboard Strategy

## Web

Use information-dense dashboard layouts for:

- Financial summaries
- Committee progress
- Referral contribution
- Reports
- Audit information

## Mobile

Use focused cards and drill-down views.

Avoid attempting to reproduce a desktop financial dashboard directly on a phone.

---

# 15. Financial UI Architecture

Financial screens must be clear and conservative.

Important UI principles:

- Show account scope.
- Show reporting period.
- Distinguish verified/unverified state.
- Distinguish due/pending/paid.
- Display exact currency values.
- Show transaction/reference information where authorized.
- Make destructive actions explicit.
- Avoid ambiguous charts that hide underlying data.

---

# 16. Member Donation UI

Core member flow:

```text
My Donations
     ↓
Monthly Donation
     ↓
Status
     ↓
Pay
```

For outstanding months:

```text
Outstanding
   ↓
View Months
   ↓
Combined Payment
```

Additional donation:

```text
Additional Donation
   ↓
Enter Amount
   ↓
General Donation
   ↓
UPI
```

---

# 17. Committee Work UI

The mobile application should make committee activity easy to update.

Example:

```text
My Work
 ├── Assigned
 ├── In Progress
 ├── Overdue
 └── Completed
```

Open tasks:

```text
Open Tasks
   ↓
Task Details
   ↓
Claim
```

The server determines whether the claim succeeds.

---

# 18. Meeting UI

Meeting screen:

```text
Meeting Details
Agenda
Attendance
Decisions
Follow-up Tasks
```

Members should not need to navigate through multiple unrelated screens to see the next action from a meeting decision.

---

# 19. Attendance UI

V1 has only two attendance contexts:

1. Jummah
2. Scheduled committee meetings

## Jummah

Mobile is the primary interface for GPS-based attendance.

Flow:

```text
Jummah
   ↓
Mark Present
   ↓
Location Permission
   ↓
GPS Validation
   ↓
Success
```

## Meeting

```text
Meeting
   ↓
Attendance
   ↓
Present / Absent
```

No daily prayer-by-prayer attendance screens should be implemented.

---

# 20. GPS Location Integration

Expo/React Native will provide the mobile location capability.

The frontend should:

- Request location permission when needed.
- Explain why location is required.
- Read current location.
- Display validation progress.
- Handle denial.
- Handle unavailable location.
- Submit location data to the backend.

The frontend must not decide that a user is valid merely because coordinates were captured.

---

# 21. GPS Permission States

Handle at least:

```text
Permission Unknown
      ↓
Request Permission
      ├── Granted
      └── Denied
```

If denied:

```text
Attendance
   ↓
Cannot Validate Location
   ↓
Clear User Message
```

The exact fallback behavior must follow the final attendance/security requirements.

---

# 22. Offline Attendance

V1 offline operation is intentionally limited to attendance.

Conceptually:

```text
Offline
  ↓
Capture Attendance
  ↓
Protected Local Queue
  ↓
Pending Sync
  ↓
Connection Restored
  ↓
Send to Backend
  ↓
Server Validation
  ↓
Synced / Rejected
```

The local record must not be presented as permanently verified until synchronization is accepted by the backend.

---

# 23. No Offline Financial Authority

The frontend must not allow offline client calculations to become authoritative financial state.

The following remain online/server-authoritative:

- Payment verification
- Financial balances
- Expense payment state
- Transaction posting
- Donation verification

---

# 24. Authentication UI

Primary flow:

```text
Mobile Number
   ↓
Request OTP
   ↓
OTP Input
   ↓
Verify
   ↓
Authenticated
```

The frontend should handle:

- OTP retry timer
- Error
- Rate-limit response
- Session expiry
- Logout
- Re-authentication

Do not expose provider secrets.

---

# 25. Permission-Aware UI

The frontend should derive UI capabilities from trusted backend/auth state.

Example:

```text
Capabilities:
- view_finance
- verify_donation
- delete_transaction
- manage_users
```

Buttons/routes should be shown or hidden based on capabilities.

However, backend authorization remains mandatory.

---

# 26. Route Protection

For every protected page/screen:

```text
Authenticated?
   ↓
Authorized?
   ↓
Load Data
```

If unauthorized:

```text
Access Denied
```

Do not rely on client-side route hiding as a security boundary.

---

# 27. Data Fetching

Use TanStack Query for server state where appropriate.

Responsibilities include:

- Fetch
- Cache
- Refetch
- Mutation state
- Query invalidation
- Loading/error handling

Critical financial data should use short/stale-aware caching policies.

---

# 28. Query Keys

Use stable query keys.

Conceptually:

```text
["members", filters]
["member", memberId]
["donations", memberId, month]
["transactions", filters]
["expenses", filters]
["tasks", filters]
["meeting", meetingId]
["attendance", date]
```

Query-key design must prevent accidental cross-user data leakage through local caches.

---

# 29. Mutation Strategy

Mutations must be explicit.

Examples:

```text
registerMember()
updateMonthlyDonation()
verifyDonation()
createExpense()
recordExpensePayment()
claimTask()
completeTask()
markJummahPresent()
recordMeetingAttendance()
```

Avoid generic mutation functions such as:

```text
updateAnything()
```

Domain-specific mutations make security and testing clearer.

---

# 30. Form Strategy

Use React Hook Form for complex forms.

Potential forms:

- Member registration
- Monthly amount
- Expense
- Expense payment
- Task
- Meeting
- Attendance correction
- Settings
- UPI configuration

---

# 31. Validation Strategy

Use Zod for shared schema validation where appropriate.

Example:

```text
User Input
    ↓
Client Zod Validation
    ↓
API Request
    ↓
Server Validation
    ↓
Business Rules
```

The server remains authoritative.

---

# 32. Currency Handling

Financial amounts must use a consistent representation.

The frontend should:

- Display currency consistently.
- Avoid binary floating-point calculations for authoritative financial math.
- Use backend-provided authoritative totals.
- Use centralized currency formatting.

---

# 33. Date Handling

Use centralized date/time formatting.

Special care is required for:

- Donation month
- Friday/Jummah date
- Meeting date/time
- Expense date
- Task deadline
- Audit timestamp

Avoid converting date-only values into another date because of local timezone handling.

---

# 34. Search

Search should be server-backed for large datasets.

Web users may search:

- Members
- Transactions
- Expenses
- Tasks
- Meetings
- Audit records

Mobile users should have simplified search experiences.

---

# 35. Pagination

Paginate large datasets:

- Members
- Donations
- Transactions
- Expenses
- Work history
- Audit logs
- Attendance

Do not load complete financial histories into a phone just to display the first screen.

---

# 36. File Upload

Frontend flow:

```text
Select File
   ↓
Client Check
   ↓
Upload
   ↓
Progress
   ↓
Server/storage response
   ↓
Record association
```

The backend/storage layer decides final authorization and validity.

---

# 37. File Size UX

The frontend should communicate:

- Maximum accepted size
- Allowed format
- Upload progress
- Failure
- Retry

The actual limit remains server-enforced.

---

# 38. Notification Integration

Mobile uses Expo notification capabilities.

Notification flow:

```text
Backend Event
      ↓
Push Service
      ↓
Mobile Device
      ↓
Tap Notification
      ↓
Open Relevant Screen
      ↓
Backend Authorization
      ↓
Show Current Data
```

Do not encode authoritative sensitive financial state solely into the notification payload.

---

# 39. Deep Links

Deep links may navigate to:

- Donation
- Task
- Meeting
- Expense
- Report

But the application must re-check authorization before displaying protected content.

---

# 40. Localization

V1 languages:

- English
- Hindi
- Kannada
- Urdu

Localization should use keys rather than hard-coded translated strings.

Example:

```text
donation.monthlyAmount
donation.pending
task.overdue
attendance.jummah
```

---

# 41. Urdu RTL

When Urdu is selected:

```text
LTR
 ↓
RTL
```

The UI must correctly handle:

- Navigation direction
- Text alignment
- Forms
- Tables
- Cards
- Icons
- Dialogs
- Mixed numerical content

---

# 42. Shared Translation Resources

Where practical, translation resources should be shared by Web and mobile.

Conceptually:

```text
packages/localization/
├── en
├── hi
├── kn
└── ur
```

Platform-specific text can remain platform-specific where necessary.

---

# 43. Design Tokens

Use shared design tokens for:

- Typography
- Spacing
- Border radius
- Elevation/shadows
- Semantic colors
- Status meanings

The visual implementation can differ between Web and mobile while retaining the same design language.

---

# 44. Status Colors

Status presentation must not rely on color alone.

Examples:

```text
Paid
Pending
Due
Overdue
Cancelled
Completed
In Progress
```

Use:

- Text
- Icon where useful
- Visual styling

---

# 45. Loading UX

Every remote operation should communicate state.

Examples:

```text
Loading
Submitting
Verifying
Uploading
Syncing
Generating
```

Prevent accidental duplicate submissions through appropriate UI state.

---

# 46. Empty State UX

Examples:

```text
No Pending Donations
No Open Tasks
No Upcoming Meetings
No Transactions
No Attendance Records
```

Empty data must be visually distinguishable from failed data retrieval.

---

# 47. Error UX

Show understandable messages for:

- Invalid input
- Unauthorized
- Duplicate/conflict
- Network unavailable
- Provider failure
- Server error
- Sync failure

Do not expose stack traces or internal server details.

---

# 48. Destructive Action UX

For high-risk operations such as financial deletion:

```text
Action
 ↓
Warning
 ↓
Explicit Confirmation
 ↓
Backend Authorization
 ↓
Execution
 ↓
Result
```

The frontend should make irreversible operations visually distinct.

---

# 49. Financial Audit UX

Reports should allow the user to:

```text
Select Period
      ↓
Select Filters
      ↓
Generate
      ↓
Review
      ↓
Download PDF
      ↓
Print
```

The Web interface is the preferred place for detailed financial report preparation and printing.

---

# 50. Mobile Finance UX

Mobile finance functionality should focus on operational tasks rather than reproducing every desktop report function.

Suitable mobile workflows:

- Review donations
- Verify payment where authorized
- Record expense/payment where authorized
- Review balances
- Capture supporting data

Detailed audit analysis and printing can primarily use Web.

---

# 51. Component Architecture

Shared Web components:

```text
components/
├── form/
├── table/
├── card/
├── dialog/
├── feedback/
├── navigation/
└── finance/
```

Mobile components:

```text
components/
├── form/
├── cards/
├── lists/
├── feedback/
├── navigation/
└── finance/
```

Do not force Web and mobile to use the same physical component implementation.

---

# 52. Shared Finance Components

Where platform appropriate, maintain shared concepts for:

- Currency formatting
- Transaction status
- Donation status
- Expense status
- Account summary
- Payment state

The visual components themselves can differ.

---

# 53. Accessibility

The Web and mobile interfaces should provide:

- Accessible labels
- Keyboard support on Web
- Screen-reader support where practical
- Adequate contrast
- Focus states
- Touch-friendly controls
- Error association with fields
- Text alternatives where appropriate

---

# 54. Responsive Web

The Web app should support:

- Desktop
- Laptop
- Tablet
- Mobile browser

The dedicated Masjid laptop should be a first-class supported usage environment.

---

# 55. Browser Compatibility

The supported Web browser matrix should be defined during deployment/testing based on the target devices.

The project should prioritize modern evergreen browsers.

---

# 56. Mobile Device Testing

Physical-device testing is required for:

- GPS
- Notifications
- UPI handoff
- Secure local storage
- Offline sync
- Permission behavior
- Background/resume behavior

Simulator-only testing is insufficient for these capabilities.

---

# 57. App Lifecycle

Mobile screens should handle:

```text
Foreground
Background
Resume
Offline
Reconnect
Session Expired
```

Important pending operations should not be lost silently.

---

# 58. Network Layer

The API client should support:

- Secure transport
- Authentication
- Request timeout
- Safe retry where applicable
- Error normalization
- Request cancellation where useful

Do not automatically retry non-idempotent financial writes without protection.

---

# 59. Retry Policy

Safe retry candidates:

- Read queries
- Idempotent background synchronization
- Notification retrieval

Sensitive writes require explicit idempotency.

Examples:

- Donation verification
- Financial transaction
- Expense payment
- Attendance sync

---

# 60. Cache Invalidation

After a successful mutation, invalidate/refetch affected queries.

Example:

```text
Verify Donation
   ↓
Invalidate:
- member donations
- outstanding donations
- contribution summary
- finance summary
```

The exact set should be controlled by feature services.

---

# 61. Financial Cache Rule

Financial caches must not become the source of truth.

When a screen requires authoritative financial state, it must obtain current server-backed data according to the chosen cache policy.

---

# 62. Security-Sensitive Local State

Avoid persistent local storage of:

- Financial transaction history
- Payment proofs
- Bills
- Complete member database
- Audit history

Store only what is operationally necessary.

---

# 63. Offline Queue Design

The offline queue should include only:

- Operation identifier
- Relevant minimal payload
- Timestamp
- Retry/sync state
- Unique client operation ID

Do not store unnecessary personal or financial data in the queue.

---

# 64. Offline Queue Idempotency

Every queued attendance operation should have a stable client operation ID.

Example:

```text
offline-operation-id
        ↓
Sync
        ↓
Server checks duplicate
        ↓
Process once
```

---

# 65. Session Expiry Handling

If the backend returns an authentication failure:

```text
API 401
 ↓
Clear invalid session state
 ↓
Prompt re-authentication
```

Do not repeatedly retry expired authentication.

---

# 66. Authorization Failure Handling

If API returns authorization failure:

```text
403
 ↓
Do not retry
 ↓
Show Access Denied
```

If the permission changed during a session, the UI should reconcile with current server permissions.

---

# 67. Duplicate/Conflict Handling

For `409 Conflict`-type conditions:

Examples:

- Duplicate member
- Task already claimed
- Duplicate attendance
- Duplicate payment event

The UI should explain the conflict rather than displaying a generic server error.

---

# 68. Mobile Notification Permissions

The mobile app should request notification permission at an appropriate point rather than immediately on first launch without context.

The user should understand the operational reason for notifications.

---

# 69. Location Permission UX

Similarly, location permission should be requested in context:

```text
User selects Mark Jummah Present
      ↓
Explain location requirement
      ↓
Request system permission
```

Avoid requesting location continuously.

---

# 70. No Continuous Location Tracking

The application does not implement continuous member location tracking.

GPS is used only for approved attendance validation.

---

# 71. UPI UX

Donation flow:

```text
Donation Details
      ↓
Pay
      ↓
Open UPI App
      ↓
Complete Payment
      ↓
Return to Application
      ↓
Show:
"Payment submitted / awaiting verification"
```

Do not display:

"Payment verified"

unless the authoritative backend state confirms verification.

---

# 72. Additional Donation UX

```text
Additional Donation
      ↓
Enter Amount
      ↓
Review General Donation
      ↓
UPI
      ↓
Await Verification
```

No purpose-selection UI exists in V1.

---

# 73. Combined Payment UX

```text
Outstanding Months
        ↓
Review Total
        ↓
Pay Combined Amount
        ↓
UPI
        ↓
Finance Verification
        ↓
FIFO Allocation
```

The UI should show which months are outstanding before generating the payment request.

---

# 74. Committee Contribution UX

The system should clearly distinguish:

```text
Members Referred
```

from:

```text
Verified Donations
```

Example:

```text
Referrals: 20
Verified Contribution: ₹75,000
```

No leaderboard or score is displayed.

---

# 75. Committee Work UX

Member drill-down may show:

```text
Assigned
Completed
Pending
Overdue
History
```

President/Secretary views may show broader committee summaries.

The frontend must respect the role/record-level access model.

---

# 76. Meeting Accountability UX

The meeting page should connect:

```text
Meeting
   ↓
Decision
   ↓
Follow-up Task
   ↓
Responsible Person
   ↓
Completion
```

A decision without a task must remain valid.

---

# 77. Report UX

Reports should be optimized for:

- Clarity
- Correct totals
- Professional presentation
- Printing
- PDF generation

The UI should make it obvious which reporting period and filters produced the report.

---

# 78. Frontend Performance

Priorities:

- Fast first render
- Efficient navigation
- Lazy loading for large areas
- Pagination
- Controlled network requests
- Optimized assets
- Minimal unnecessary re-renders

Do not sacrifice financial correctness for aggressive caching.

---

# 79. Bundle/Build Strategy

Web:

- Code-split large administrative areas where useful.
- Avoid shipping unused finance/reporting logic to every public route.

Mobile:

- Avoid unnecessary native dependencies.
- Keep application bundle reasonable.
- Evaluate large libraries before adoption.

---

# 80. Dependency Policy

Add a frontend dependency only when it provides meaningful value.

Evaluate:

- Maintenance
- Bundle size
- Security
- License
- TypeScript support
- React/Expo compatibility
- Free/open-source status
- Long-term suitability

Avoid package sprawl.

---

# 81. Web Hosting Compatibility

The Web architecture should remain compatible with the selected deployment baseline.

The frontend must not require an always-on custom server unless a documented requirement introduces one.

---

# 82. Mobile Distribution

Use Expo/EAS-compatible builds.

Development channels should remain separate from production releases.

Production configuration must not be embedded with development secrets.

---

# 83. Release Channels

Conceptually:

```text
Development
      ↓
Internal Testing
      ↓
Staging / Candidate
      ↓
Production
```

The exact release strategy will be finalized in deployment documentation.

---

# 84. Frontend Testing Matrix

### Web

- Unit
- Component
- Integration
- End-to-end
- Responsive
- Accessibility
- Localization

### Mobile

- Unit/component
- Integration
- Physical-device validation
- GPS
- Notifications
- UPI
- Offline sync
- Localization

---

# 85. Critical End-to-End Frontend Tests

At minimum:

1. Login with OTP.
2. Role-based navigation.
3. Register referred member.
4. Duplicate member flow.
5. Confirm monthly donation.
6. Generate payment request.
7. Handle UPI handoff.
8. Show pending verification state.
9. Additional donation.
10. Combined outstanding payment.
11. Committee task claim.
12. Task completion.
13. Meeting attendance.
14. Jummah attendance.
15. Offline attendance sync.
16. Financial report generation.
17. Unauthorized route attempt.
18. Session expiry.
19. Localization switch.
20. Urdu RTL layout.

---

# 86. Frontend Security Testing

Test that the client:

- Does not expose service-role credentials.
- Does not trust client-modified roles.
- Does not display unauthorized records.
- Handles 403/401 correctly.
- Does not expose sensitive notifications.
- Does not expose public file links unnecessarily.
- Does not store unnecessary financial data locally.

---

# 87. Web Security Considerations

The final Web implementation should include the security controls appropriate to the selected authentication architecture, including where applicable:

- Secure session handling
- CSRF protection
- Content Security Policy
- Secure cookies
- HSTS
- Safe rendering
- Origin controls

Exact values belong in `SECURITY_ARCHITECTURE.md`.

---

# 88. Mobile Security Considerations

The mobile application should use:

- Secure storage
- Minimal local data
- Secure network connections
- No embedded privileged backend keys
- Safe notification handling
- Controlled deep links
- Revalidation after resume where needed

---

# 89. Framework Upgrade Policy

The project should not upgrade Next.js, React Native, or Expo automatically without validation.

For each major upgrade:

```text
Review Release
   ↓
Check Dependency Compatibility
   ↓
Update
   ↓
Run Tests
   ↓
Run Web Build
   ↓
Run Android/iOS Validation
   ↓
Document Upgrade
```

---

# 90. Framework Lock Policy

The package lockfile must be committed.

Production builds should use reproducible dependency versions.

---

# 91. Frontend Technology Invariants

The following are fixed principles:

1. Web uses Next.js + TypeScript.
2. Mobile uses Expo + React Native + TypeScript.
3. Web and mobile share types/validation where useful.
4. Backend remains authoritative.
5. Client-side authorization is supplemental only.
6. Financial state is never client-authoritative.
7. Offline support is limited to approved workflows.
8. Mobile GPS is event-based, not continuous tracking.
9. Urdu requires RTL support.
10. Sensitive local storage is minimized.
11. External provider secrets never ship in clients.
12. Major framework upgrades require validation.

---

# 92. Open Frontend Decisions

The following are implementation-level decisions still to be finalized:

- Exact current stable Next.js patch version at project initialization
- Exact current stable Expo patch version at project initialization
- Final Web component library configuration
- Final mobile component library
- Exact localization package
- Exact icon package
- Exact testing libraries
- Exact offline queue implementation
- Exact PDF viewer/print strategy
- Browser support matrix

These should be recorded before implementation of the affected areas.

---

# 93. Definition of Done

Frontend framework setup is complete when:

- Web framework is initialized.
- Mobile framework is initialized.
- TypeScript is configured.
- Shared packages are configured.
- Linting/formatting are configured.
- Core UI system is configured.
- API client is configured.
- TanStack Query is configured where required.
- Forms/validation are configured.
- Localization architecture is configured.
- Authentication integration is connected.
- Role-aware routing/navigation is working.
- Web and mobile builds succeed.
- Basic tests pass.
- No secrets are embedded in clients.

---

# 94. Related Documents

- `PROJECT_OVERVIEW.md`
- `PRODUCT_REQUIREMENTS.md`
- `FEATURE_SCOPE.md`
- `SYSTEM_ARCHITECTURE.md`
- `APPLICATION_ARCHITECTURE.md`
- `FRONTEND_ARCHITECTURE.md`
- `TECHNOLOGY_STACK.md`
- `BACKEND_ARCHITECTURE.md`
- `SECURITY_ARCHITECTURE.md`
- `DATABASE_ARCHITECTURE.md`
- `NAVIGATION_FLOW.md`
- `SCREEN_SPECIFICATIONS.md`
- `INTERNATIONALIZATION.md`
- `TESTING_STRATEGY.md`
- `DEVELOPMENT_TASKS.md`

---

## Document Status

**Frontend Framework — V1 Baseline**

This document defines the frontend framework and implementation direction for the Masjid-e-Mamoor 2 application.

The selected stack is intentionally centered on a strong Web administrative application and a shared Expo/React Native mobile application for Android and iOS.
