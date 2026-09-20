# Masjid-e-Mamoor 2 — Navigation Flow

**Document Status:** V1 Implementation Baseline  
**Version:** 1.0  
**Product:** Masjid-e-Mamoor 2 Internal Management Application  
**Scope:** V1  
**Platforms:** Web, Android, iOS  
**Primary Principle:** Role-aware, permission-safe, finance-first navigation  
**Last Updated:** 2026-09-17

---

# 1. Purpose

This document defines the V1 navigation architecture for Masjid-e-Mamoor 2.

The navigation must make it easy for users to move between the parts of the application they are actually authorized to use.

It covers:

- Application entry
- Authentication
- Role resolution
- Dashboard
- Members
- Donations
- Finance
- Committee Work
- Meetings
- Attendance
- Reports
- Audit
- Settings
- Detail pages
- Create/edit flows
- Deep links from notifications
- Unauthorized/invalid routes

The core principle is:

> Users should see the areas relevant to their role, and every navigation destination must still enforce server-side authorization.

---

# 2. Navigation Principles

1. Navigation is role-aware.
2. Navigation never replaces backend authorization.
3. Sensitive finance/audit areas are visible only to authorized users.
4. Common actions should be reachable in few steps.
5. Navigation labels should use consistent product terminology.
6. Mobile and web may use different layout patterns while preserving the same information architecture.
7. Deep links must enforce authentication and authorization.
8. Invalid routes must not expose restricted information.
9. Logout must clear protected application state.
10. V1 does not include public Masjid discovery or multi-Masjid selection.

---

# 3. V1 Top-Level Areas

Conceptual application areas:

```text
Dashboard
Members
Donations
Finance
Committee Work
Meetings
Attendance
Reports
Audit
Settings
Profile
```

Not every role sees every area.

---

# 4. Global Application Flow

```text
Launch
  ↓
Resolve Session
  ↓
Authenticated?
  ├── No → Login
  └── Yes
        ↓
Resolve Application User
        ↓
Active?
  ├── No → Account Inactive
  └── Yes
        ↓
Resolve Role
        ↓
Load Authorized Navigation
        ↓
Dashboard
```

---

# 5. Authentication Entry Flow

```text
Login
  ↓
Enter Mobile Number
  ↓
Request OTP
  ↓
Enter OTP
  ↓
Verify
  ↓
Session Established
  ↓
Application User Resolved
  ↓
Role Resolved
  ↓
Dashboard
```

Authentication details are defined in:

```text
AUTHENTICATION.md
```

---

# 6. First-Time User Flow

Conceptually:

```text
OTP Verified
      ↓
Application User Exists?
   ┌──┴──┐
  Yes    No
   │      │
Continue  Onboarding
           ↓
       Profile setup
           ↓
       Role/status resolved
           ↓
         Dashboard
```

The exact onboarding steps follow the authentication/member model.

---

# 7. Single-Masjid Navigation

V1 is dedicated to:

```text
Masjid-e-Mamoor 2
```

There is no navigation for:

```text
Select Masjid
Join another Masjid
Search Masjids
Switch Masjid
Create new Masjid
```

---

# 8. President Navigation

Recommended full navigation:

```text
Dashboard
Members
Donations
Finance
Committee Work
Meetings
Attendance
Reports
Audit
Settings
Profile
```

President is the broadest V1 administrative role.

---

# 9. Finance Navigation

Recommended:

```text
Dashboard
Members / Donation Context
Donations
Finance
Reports
Relevant Audit
Profile
Settings where applicable
```

Finance should have direct access to operational financial workflows.

---

# 10. Auditor Navigation

Recommended:

```text
Dashboard
Finance / Financial Reports
Audit
Reports
Profile
```

Auditor is primarily read/review oriented.

---

# 11. Secretary Navigation

Recommended:

```text
Dashboard
Members
Donations
Committee Work
Meetings
Attendance
Relevant Finance/Reports
Profile
```

Secretary access follows the role-permission model.

---

# 12. Committee Member Navigation

Recommended:

```text
Dashboard
Members / Referrals
My Work
Open Tasks
Meetings / Participation
Attendance
Donation-related member workflow where permitted
Profile
```

---

# 13. Member Navigation

Recommended:

```text
Dashboard
My Donations
My Attendance
Profile
Settings
```

No unrestricted internal committee/finance navigation is shown.

---

# 14. Navigation Visibility Rule

A navigation item is shown only when:

```text
User is authenticated
+
User is active
+
User has appropriate role/permission
```

Even then:

```text
Backend authorization remains authoritative.
```

---

# 15. Global Header

Recommended web header areas:

```text
Masjid-e-Mamoor 2
Current section/page title
Language selector
Profile/avatar
Logout
```

Additional contextual actions may appear depending on the page.

---

# 16. Global Mobile Header

Mobile may use:

```text
Menu / navigation control
Page title
Context action where required
Profile or more menu
```

Keep the header compact.

---

# 17. Desktop Navigation Pattern

Recommended:

```text
Left sidebar
+
Top header
```

Sidebar contains role-appropriate top-level areas.

---

# 18. Mobile Navigation Pattern

Recommended:

```text
Compact bottom navigation for highest-frequency areas
+
More/menu sheet for secondary areas
```

The exact component pattern can be refined during implementation.

---

# 19. Dashboard Entry

After successful authentication:

```text
User
  ↓
Dashboard
```

Dashboard content is role-specific.

---

# 20. President Dashboard Flow

```text
Dashboard
├── Financial Overview
├── Committee Overview
├── Attendance Overview
├── Recent Activity
└── Alerts/Attention Needed
```

---

# 21. Finance Dashboard Flow

```text
Dashboard
├── Overall Funds
├── Account Balances
├── Unverified Payments
├── Recent Expenses
├── Pending Documentation
└── Recent Transactions
```

---

# 22. Secretary Dashboard Flow

```text
Dashboard
├── Committee Work
├── Meetings
├── Attendance
├── Members
└── Relevant Donation/Finance Information
```

---

# 23. Auditor Dashboard Flow

```text
Dashboard
├── Financial Summary
├── Recent Financial Activity
├── Reports
└── Audit Activity
```

---

# 24. Committee Member Dashboard Flow

```text
Dashboard
├── My Work
├── Open Tasks
├── Upcoming Deadlines
├── Meeting Participation
├── Referral Activity
└── Attendance
```

---

# 25. Member Dashboard Flow

```text
Dashboard
├── Monthly Contribution
├── Pending/Outstanding
├── Additional Donation
├── Donation History
└── Attendance
```

---

# 26. Members Section

Navigation:

```text
Members
   ↓
Member List
   ├── Search
   ├── Filters
   └── Member Detail
```

Authorized roles see appropriate fields.

---

# 27. Member Registration Flow

Primary Committee Member workflow:

```text
Members
  ↓
Add/Refer Member
  ↓
Enter Name
  ↓
Enter Mobile
  ↓
Check Existing Member
  ├── Exists → Open existing record
  └── New
        ↓
     Create member
        ↓
     Set primary referrer
        ↓
     Confirm profile
        ↓
     Configure agreed monthly amount
        ↓
     Payment request/link
```

---

# 28. Existing Member Flow

If mobile already exists:

```text
Enter Mobile
  ↓
Existing Member Found
  ↓
Do Not Create Duplicate
  ↓
Open existing record / follow authorized workflow
```

Do not automatically replace the original referrer.

---

# 29. Member Detail Navigation

```text
Member List
   ↓
Member Detail
   ├── Profile
   ├── Referral
   ├── Contribution
   ├── Donation History
   ├── Attendance
   └── Related Work
```

Only permitted sections are displayed.

---

# 30. Member Profile Edit

```text
Member Detail
   ↓
Edit
   ↓
Update allowed fields
   ↓
Save
   ↓
Server validation
   ↓
Updated Profile
```

Sensitive identity changes have stronger controls.

---

# 31. Donation Section

Navigation:

```text
Donations
   ↓
Donation Overview
   ├── Monthly
   ├── Additional
   ├── Anonymous
   ├── Jummah Collections
   └── Outstanding
```

Actual visibility follows role.

---

# 32. Member Monthly Donation Flow

```text
My Donations
   ↓
Current Month
   ↓
View Due
   ↓
Pay
   ↓
Payment Request
   ↓
UPI
   ↓
Finance Verification
   ↓
Paid
```

---

# 33. Combined Outstanding Donation Flow

```text
My Donations
   ↓
Outstanding
   ↓
View Months
   ↓
Select/Use Combined Due
   ↓
Pay
   ↓
Finance Verification
   ↓
FIFO Allocation
   ↓
Monthly Records Updated
```

The backend determines FIFO allocation.

---

# 34. Additional Donation Flow

```text
My Donations
   ↓
Additional Donation
   ↓
Enter Amount
   ↓
General Donation
   ↓
Pay
   ↓
Finance Verification
   ↓
Verified Donation
```

No purpose/category selection is required in V1.

---

# 35. Payment Link Flow

```text
Payment Request
   ↓
Payment Link
   ↓
UPI App / Supported Flow
   ↓
Payment Attempt
   ↓
Finance Verification
```

Link generation/opening does not mean payment.

---

# 36. Finance Navigation

```text
Finance
├── Overview
├── Accounts
├── Transactions
├── Payments
├── Expenses
├── Transfers
├── Adjustments
└── Categories
```

Exact sub-navigation may be adapted to final UI.

---

# 37. Finance Overview Flow

```text
Finance
   ↓
Overview
   ├── Overall Funds
   ├── Cash
   ├── Bank
   ├── UPI
   ├── Other
   ├── Unverified Payments
   └── Recent Activity
```

---

# 38. Accounts Flow

```text
Finance
   ↓
Accounts
   ↓
Account List
   ↓
Account Detail
   ├── Balance
   ├── Transactions
   ├── Opening Balance
   └── Configuration
```

---

# 39. Create Account Flow

```text
Accounts
   ↓
Add Account
   ↓
Select Type
   ↓
Enter Name
   ↓
Opening Balance
   ↓
Optional Bank/UPI details
   ↓
Save
```

Only authorized financial users can create accounts.

---

# 40. Account Deactivation Flow

```text
Account Detail
   ↓
Deactivate
   ↓
Confirmation
   ↓
Confirm
   ↓
Account Inactive
```

Historical transactions remain available.

---

# 41. Transaction List Flow

```text
Finance
   ↓
Transactions
   ↓
Search/Filters
   ↓
Transaction Row
   ↓
Transaction Detail
```

---

# 42. Transaction Detail Flow

```text
Transaction Detail
├── Summary
├── Account
├── Amount
├── Category
├── Reference
├── Source
└── Audit Context where permitted
```

---

# 43. Donation Verification Flow

```text
Finance
   ↓
Payments
   ↓
Unverified
   ↓
Payment Detail
   ↓
Review Evidence
   ↓
Verify / Reject
   ↓
Financial Posting
   ↓
Audit
```

---

# 44. Expense Flow

```text
Finance
   ↓
Expenses
   ↓
Expense List
   ↓
Expense Detail
   ├── Bill
   ├── Payments
   ├── Payment Proofs
   └── Financial Transactions
```

---

# 45. Create Expense Flow

```text
Expenses
   ↓
Add Expense
   ↓
Title
   ↓
Description
   ↓
Date
   ↓
Category
   ↓
Amount
   ↓
Bill
   ↓
Save
```

---

# 46. Add Expense Payment Flow

```text
Expense Detail
   ↓
Add Payment
   ↓
Account
   ↓
Method
   ↓
Amount
   ↓
Payment Date
   ↓
Reference
   ↓
Payment Proof
   ↓
Confirm
   ↓
Financial Debit
   ↓
Expense Status Update
```

---

# 47. Expense Correction Flow

```text
Expense Detail
   ↓
Correct Amount
   ↓
Previous Amount
   ↓
New Amount
   ↓
Reason
   ↓
Confirm
   ↓
Audit
```

The new amount cannot be lower than valid payments already recorded.

---

# 48. Expense Cancellation Flow

```text
Expense Detail
   ↓
Cancel Expense
   ↓
Enter Reason
   ↓
Confirm
   ↓
CANCELLED
   ↓
Audit
```

This is available only when allowed by the expense state/role rules.

---

# 49. Transfer Flow

```text
Finance
   ↓
Transfers
   ↓
Create Transfer
   ↓
Source Account
   ↓
Destination Account
   ↓
Amount
   ↓
Confirm
   ↓
Atomic Source Debit + Destination Credit
   ↓
Audit
```

---

# 50. Committee Work Navigation

Recommended:

```text
Committee Work
├── My Work
├── Open Tasks
├── All Tasks where permitted
├── Overdue
└── Work History
```

---

# 51. My Work Flow

```text
My Work
   ├── Assigned
   ├── In Progress
   ├── Completed
   └── Overdue
```

---

# 52. Open Tasks Flow

```text
Open Tasks
   ↓
Task Detail
   ↓
Claim
   ↓
Atomic Backend Claim
   ↓
My Work
```

If another user already claimed the task:

```text
Conflict
→ Refresh
```

---

# 53. Task Detail Navigation

```text
Task Detail
├── Overview
├── Responsible Member
├── Priority
├── Deadline
├── Progress
├── Related Member/Referral
├── Meeting/Decision
├── Attachments where applicable
└── Completion
```

---

# 54. Create Task Flow

President/Secretary:

```text
Committee Work
   ↓
Create Task
   ↓
Title
   ↓
Description
   ↓
Priority
   ↓
Optional Deadline
   ↓
Direct Assignment OR Open Task
   ↓
Optional Member/Referral/Meeting/Decision link
   ↓
Create
```

---

# 55. Direct Assignment Flow

```text
Create Task
   ↓
Assign to member
   ↓
Create
   ↓
Assigned
   ↓
Notification
```

---

# 56. Open Task Flow

```text
Create Task
   ↓
Open for volunteers
   ↓
Create
   ↓
Open
   ↓
Eligible members can claim
```

---

# 57. Task Progress Flow

```text
My Work
   ↓
Task
   ↓
Add Progress Update
   ↓
Save
   ↓
Progress History
```

---

# 58. Task Completion Flow

```text
Task
   ↓
Complete
   ↓
Optional completion note
   ↓
Confirm
   ↓
Completed
   ↓
Audit/notification where configured
```

---

# 59. Completed Task Edit Flow

```text
Completed Task
   ↓
Edit
   ↓
Allowed fields
   ↓
Save
   ↓
Audit
```

Committee Member cannot delete completed work.

---

# 60. Meeting Navigation

Recommended:

```text
Meetings
├── Upcoming
├── Past
├── Cancelled
└── Meeting History
```

---

# 61. Create Meeting Flow

```text
Meetings
   ↓
Create Meeting
   ↓
Title
   ↓
Date
   ↓
Time
   ↓
Location
   ↓
Agenda
   ↓
Invite Members
   ↓
Save
   ↓
Scheduled
```

---

# 62. Meeting Detail Navigation

```text
Meeting Detail
├── Overview
├── Agenda
├── Attendance
├── Decisions
└── Follow-up Tasks
```

---

# 63. Meeting Attendance Flow

```text
Meeting Detail
   ↓
Attendance
   ↓
Member Status
   ↓
Present/Absent
   ↓
Save
```

Meeting attendance does not require Jummah GPS validation.

---

# 64. Decision Flow

```text
Meeting Detail
   ↓
Decisions
   ↓
Add Decision
   ↓
Decision Text
   ↓
Save
```

---

# 65. Decision → Follow-Up Task Flow

```text
Decision
   ↓
Create Follow-Up Task
   ↓
Task Form
   ↓
Assignment/Open
   ↓
Create
   ↓
Follow-Up appears in Meeting
```

---

# 66. Follow-Up Completion Flow

```text
Meeting
   ↓
Follow-Up Task
   ↓
Task Detail
   ↓
Completion
   ↓
Meeting follow-up status updated
```

---

# 67. Attendance Navigation

Recommended:

```text
Attendance
├── Jummah
├── Meetings
└── My History / Reports where permitted
```

---

# 68. Jummah Attendance Flow

```text
Attendance
   ↓
Jummah
   ↓
Current Friday Session
   ↓
MARK PRESENT
   ↓
Location Capture
   ↓
Server Validation
   ↓
Recorded / Rejected
```

---

# 69. Offline Jummah Flow

```text
Jummah
   ↓
MARK PRESENT
   ↓
No Network
   ↓
Save Pending Locally
   ↓
Sync Later
   ↓
Server Validation
   ↓
Final Result
```

The UI must show that offline attendance is pending until server synchronization.

---

# 70. Meeting Attendance Flow

```text
Attendance
   ↓
Meetings
   ↓
Select Meeting
   ↓
Attendance
   ↓
Present/Absent
```

Actual attendance-edit permissions follow the role model.

---

# 71. Reports Navigation

Recommended:

```text
Reports
├── Financial
├── Donations
├── Expenses
├── Transfers
├── Committee Work
├── Meetings
├── Attendance
└── Audit
```

Only reports permitted to the current role are shown.

---

# 72. Financial Reports Flow

```text
Reports
   ↓
Financial
   ↓
Select Report
   ↓
Date Range
   ↓
Filters
   ↓
Preview
   ↓
Generate PDF
   ↓
Open / Download / Print
```

---

# 73. Audit Reports Flow

```text
Reports
   ↓
Audit
   ↓
Filters
   ↓
Audit Results
   ↓
Audit Detail
```

---

# 74. Committee Report Flow

```text
Reports
   ↓
Committee Work
   ↓
Date/filters
   ↓
Task/meeting summary
   ↓
Member drilldown where permitted
```

No ranking output.

---

# 75. Attendance Report Flow

```text
Reports
   ↓
Attendance
   ├── Jummah
   └── Meetings
```

Raw GPS coordinates are not included in normal reports.

---

# 76. Audit Navigation

Recommended:

```text
Audit
├── Recent
├── Financial
├── Administrative
└── Security
```

Exact sections depend on role.

---

# 77. Audit Detail Flow

```text
Audit
   ↓
Event List
   ↓
Event Detail
   ├── Actor
   ├── Action
   ├── Entity
   ├── Timestamp
   ├── Before/After
   └── Reason
```

---

# 78. Settings Navigation

Recommended:

```text
Settings
├── Profile
├── Language
├── Notifications
└── Administrative Settings where permitted
```

---

# 79. Administrative Settings

Authorized users may see relevant settings such as:

```text
Attendance radius
Masjid location
Expense categories
User/role controls
```

Finance may manage UPI configuration according to the finance workflow.

---

# 80. Profile Navigation

```text
Profile
├── Name
├── Mobile
├── Email
├── Photo
├── Role
└── Logout
```

Role display is read-only to ordinary users.

---

# 81. Language Navigation

```text
Settings
   ↓
Language
   ↓
English / Hindi / Kannada / Urdu
   ↓
Apply
```

No logout required under normal behavior.

---

# 82. Notification Navigation

V1 does not require a permanent notification inbox.

Notification taps should deep-link directly to the relevant authorized record where appropriate.

---

# 83. Notification Deep-Link Flow

```text
Push Notification
   ↓
User taps
   ↓
Session valid?
   ├── No → Login
   └── Yes
        ↓
Authorization check
        ↓
Open target
```

---

# 84. Deep-Link Security

A deep link must never bypass:

```text
Authentication
Authorization
RLS
```

---

# 85. Example Deep Links

Conceptually:

```text
/finance/expenses/{id}
/finance/payments/{id}
/tasks/{id}
/meetings/{id}
/members/{id}
/reports/financial
```

Actual route names are implementation details.

---

# 86. Unauthorized Deep Link

If the user is authenticated but not authorized:

```text
Access denied
```

or a safe neutral route.

Do not reveal restricted record details.

---

# 87. Missing Record

If a record no longer exists or is unavailable:

```text
Record not found
```

Do not expose database errors.

---

# 88. Session Expired During Navigation

If a session expires:

```text
Protected route
   ↓
Authentication failure
   ↓
Login
```

After re-authentication, the app may safely return to the intended destination.

---

# 89. Role Change During Session

If a user's role changes:

```text
Current session
   ↓
Next protected request
   ↓
Current server-side role
```

Navigation should refresh accordingly.

---

# 90. User Deactivation During Session

If a user is deactivated:

```text
Protected request
   ↓
Account inactive
   ↓
Access blocked
   ↓
Account inactive screen
```

---

# 91. Logout Flow

```text
Profile/Menu
   ↓
Logout
   ↓
Session cleared
   ↓
Protected caches cleared
   ↓
Login
```

---

# 92. Browser Back Button

The application should avoid allowing browser navigation to reveal protected cached screens after logout.

Protected pages should revalidate session when necessary.

---

# 93. Mobile Back Navigation

Back behavior should follow platform conventions without bypassing:

```text
Authentication
Authorization
```

---

# 94. Navigation State Preservation

Where safe, the application may preserve:

```text
Filters
Search
Scroll position
Selected tab
```

But protected data must be cleared when the session/user changes.

---

# 95. Breadcrumb Navigation

Desktop detail flows may use:

```text
Finance / Expenses / Expense Detail
Committee Work / My Work / Task Detail
Meetings / Meeting Detail
Members / Member Detail
```

---

# 96. Tab Navigation

Detail pages may use local tabs:

```text
Member
├── Overview
├── Donations
├── Attendance
└── Work
```

or:

```text
Meeting
├── Overview
├── Attendance
├── Decisions
└── Follow-ups
```

---

# 97. Navigation Consistency

The same record type should use consistent navigation patterns throughout the application.

Example:

```text
Expense → always uses the same detail structure
Task → always uses the same detail structure
Meeting → always uses the same detail structure
```

---

# 98. Primary Actions by Area

Recommended primary actions:

```text
Members → Add/Refer Member
Donations → Pay / Additional Donation
Finance → Add Expense / Record Financial Action
Committee Work → Create Task / Claim Task
Meetings → Create Meeting
Attendance → Mark Present
Reports → Generate Report
```

Visibility follows role permissions.

---

# 99. Destructive Navigation Actions

Destructive actions should not be placed in primary navigation.

Examples:

```text
Delete transaction
Deactivate account
Cancel expense
```

These belong in contextual actions with confirmation.

---

# 100. Navigation and Notifications

A notification may open:

```text
Task
Meeting
Payment
Donation
Expense
```

but the destination remains subject to authorization.

---

# 101. Search Navigation

Global search is not required as a full V1 feature.

Domain-specific search is sufficient:

```text
Members
Finance
Tasks
Reports
Audit
```

---

# 102. Mobile Navigation Depth

Avoid deeply nested navigation.

The target for common operations should generally be:

```text
2–4 meaningful steps
```

depending on the workflow.

---

# 103. Finance Workflow Depth

Example:

```text
Finance
  ↓
Unverified Payments
  ↓
Payment Detail
  ↓
Verify
```

---

# 104. Expense Workflow Depth

Example:

```text
Finance
  ↓
Expenses
  ↓
Expense Detail
  ↓
Add Payment
  ↓
Confirm
```

---

# 105. Task Workflow Depth

Example:

```text
Open Tasks
  ↓
Task Detail
  ↓
Claim
```

---

# 106. Meeting Workflow Depth

Example:

```text
Meetings
  ↓
Meeting Detail
  ↓
Decision
  ↓
Follow-Up Task
```

---

# 107. Attendance Workflow Depth

Example:

```text
Attendance
  ↓
Jummah
  ↓
MARK PRESENT
```

This should be one of the fastest operations in the app.

---

# 108. Member Referral Workflow Depth

Example:

```text
Members
  ↓
Add/Refer
  ↓
Name + Mobile
  ↓
Contribution
  ↓
Confirm
```

The exact onboarding may require additional steps for secure identity handling.

---

# 109. Financial Audit Navigation

Example:

```text
Reports
  ↓
Financial Audit
  ↓
Date Range
  ↓
Generate PDF
```

---

# 110. Navigation Errors

Common navigation errors:

```text
Unauthorized
Session expired
Record not found
Network unavailable
```

Each should have a consistent recovery path.

---

# 111. Offline Navigation

When offline:

```text
Supported offline attendance → available
Authoritative financial writes → not treated as completed offline
```

The UI should make network requirements clear.

---

# 112. Navigation During Sync

For offline attendance:

```text
Pending sync
```

should be visible until the server accepts/rejects the record.

---

# 113. Navigation and Role Visibility

Do not show inaccessible sections just to produce a uniform sidebar.

Users should see a focused navigation set.

---

# 114. Navigation and Permission Changes

After a role change:

```text
Invalidate navigation cache
Resolve new permissions
Update visible sections
```

---

# 115. Navigation Data Security

Navigation configuration must not be the sole source of security.

A hidden route remains protected.

---

# 116. Navigation Localization

Top-level navigation labels must support:

```text
English
Hindi
Kannada
Urdu
```

Urdu uses RTL.

---

# 117. Navigation Label Consistency

Use the same term everywhere.

Example:

```text
Finance
```

should not become:

```text
Accounts
Money
Financials
```

randomly across different screens.

---

# 118. Navigation Accessibility

Navigation must support:

```text
Keyboard
Screen readers
Focus
Touch
```

---

# 119. Focus Navigation

Desktop keyboard focus should move logically:

```text
Navigation
→ Page Header
→ Content
→ Actions
```

---

# 120. Mobile Navigation Accessibility

Ensure:

```text
Menu button
Navigation items
Back actions
```

have accessible labels.

---

# 121. Navigation Analytics

V1 does not require invasive user-behavior analytics.

Basic application monitoring is sufficient initially.

---

# 122. Navigation Performance

Navigation should avoid unnecessary data fetching.

Load:

```text
Page shell
→ required data
```

incrementally where practical.

---

# 123. Prefetching

Safe prefetching may be used for likely next screens.

Do not prefetch highly sensitive financial data to unauthorized/shared contexts unnecessarily.

---

# 124. Navigation Cache

Role/navigation state should refresh when:

```text
Logout
Login as different user
Role changes
Account deactivation
```

---

# 125. Shared Laptop Navigation

The dedicated Masjid laptop should make these easy to access:

```text
Finance
Reports
Audit
Print
Logout
```

for authorized roles.

---

# 126. Printing Navigation

Recommended:

```text
Reports
  ↓
Select Report
  ↓
Generate PDF
  ↓
Open/Print
```

Do not require users to manually find generated files through the operating system.

---

# 127. Navigation Acceptance — President

President should be able to reach:

```text
Members
Donations
Finance
Committee Work
Meetings
Attendance
Reports
Audit
Settings
```

with minimal navigation.

---

# 128. Navigation Acceptance — Finance

Finance should be able to reach:

```text
Payments
Expenses
Accounts
Transactions
Transfers
Reports
```

directly.

---

# 129. Navigation Acceptance — Auditor

Auditor should be able to reach:

```text
Financial reports
Audit
Relevant financial detail
```

without edit controls.

---

# 130. Navigation Acceptance — Secretary

Secretary should be able to reach:

```text
Members
Committee Work
Meetings
Attendance
Relevant donations/reports
```

according to permissions.

---

# 131. Navigation Acceptance — Committee Member

Committee Member should be able to reach:

```text
Members/referrals
My Work
Open Tasks
Meetings/participation
Attendance
```

according to permissions.

---

# 132. Navigation Acceptance — Member

Member should be able to reach:

```text
My Donations
My Attendance
Profile
```

without unrestricted internal administration.

---

# 133. Navigation Test Scenarios

At minimum test:

1. Unauthenticated user sees Login.
2. Valid OTP reaches appropriate Dashboard.
3. Inactive user reaches Account Inactive.
4. President sees authorized navigation.
5. Finance sees authorized navigation.
6. Auditor sees authorized navigation.
7. Secretary sees authorized navigation.
8. Committee Member sees authorized navigation.
9. Member sees authorized navigation.
10. Unauthorized route is blocked.
11. Hidden route cannot be accessed manually.
12. Deep link requires authorization.
13. Session expiry redirects safely.
14. Logout clears protected state.
15. Role change updates navigation.
16. User deactivation blocks protected routes.
17. Notification deep link opens correct authorized record.
18. Missing record produces safe Not Found.
19. Offline attendance remains pending until sync.
20. Language switching updates navigation labels.
21. Urdu navigation uses RTL.
22. Mobile navigation remains usable.
23. Desktop navigation remains usable.
24. Shared laptop user switching does not expose previous data.

---

# 134. Navigation Invariants

The following rules are mandatory:

### Invariant 1

Navigation is role-aware.

### Invariant 2

Navigation visibility is not a substitute for authorization.

### Invariant 3

Every protected route validates authentication/authorization.

### Invariant 4

V1 is single-Masjid navigation for Masjid-e-Mamoor 2.

### Invariant 5

There is no public Masjid-selection/discovery navigation.

### Invariant 6

Finance and Audit sections are role-protected.

### Invariant 7

Member navigation exposes only authorized member information.

### Invariant 8

Committee work navigation exposes only authorized internal work.

### Invariant 9

Attendance navigation includes only Jummah and scheduled meetings.

### Invariant 10

Reports are role-filtered.

### Invariant 11

Deep links cannot bypass authentication or authorization.

### Invariant 12

Logout clears protected application state.

### Invariant 13

Role changes refresh effective navigation/permissions.

### Invariant 14

Deactivated users cannot continue using protected routes.

### Invariant 15

Offline attendance is visibly pending until server synchronization.

### Invariant 16

Navigation terminology is localized consistently.

### Invariant 17

Urdu navigation uses RTL.

### Invariant 18

Notification delivery does not create independent navigation truth.

### Invariant 19

Shared-device navigation must not expose previous-user protected data.

### Invariant 20

Navigation does not include ranking/gamification features.

---

# 135. Acceptance Criteria

The Navigation system is implementation-ready when:

- Authentication enters the correct role-aware application shell.
- Each V1 role sees an appropriate navigation set.
- Unauthorized routes are blocked server-side.
- Dashboard is the default authenticated entry point.
- Members, donations, finance, committee work, meetings, attendance, reports, audit, and settings are navigable according to permissions.
- Finance workflows are reachable efficiently.
- Committee work workflows are reachable efficiently.
- Jummah attendance is one of the shortest operational flows.
- Meeting accountability can be navigated from meeting → decision → task → completion.
- Notification deep links are authorization-safe.
- Logout safely removes protected state.
- Shared-laptop user switching is safe.
- Offline attendance state is represented clearly.
- English/Hindi/Kannada/Urdu labels work.
- Urdu navigation is RTL.
- Navigation remains usable on web, Android, and iOS.

---

# 136. Implementation Boundary

This document defines navigation architecture.

The following belong elsewhere:

```text
Visual design                  → DESIGN_SYSTEM.md
Cross-product UX              → UI_UX_REQUIREMENTS.md
Per-screen specifications     → SCREEN_SPECIFICATIONS.md
Authentication                → AUTHENTICATION.md
Authorization                 → AUTHORIZATION_MODEL.md
Member behavior                → MEMBER_MANAGEMENT.md
Donation behavior              → DONATION_SYSTEM.md
Payment behavior               → PAYMENT_SYSTEM.md
Finance behavior               → FINANCE_SYSTEM.md
Expense behavior               → EXPENSE_SYSTEM.md
Committee work                 → COMMITTEE_WORK_MANAGEMENT.md
Meetings                       → MEETING_MANAGEMENT.md
Attendance                     → ATTENDANCE_SYSTEM.md
Notifications                  → NOTIFICATION_SYSTEM.md
Reporting                      → REPORTING_AND_AUDIT.md
Internationalization           → INTERNATIONALIZATION.md
Security                       → SECURITY_ARCHITECTURE.md
Database                       → DATABASE_SCHEMA.md
Testing                        → TESTING_STRATEGY.md
```

---

# 137. Related Documents

- `PROJECT_OVERVIEW.md`
- `PRODUCT_REQUIREMENTS.md`
- `FEATURE_SCOPE.md`
- `USER_ROLES_PERMISSIONS.md`
- `AUTHENTICATION.md`
- `AUTHORIZATION_MODEL.md`
- `UI_UX_REQUIREMENTS.md`
- `DESIGN_SYSTEM.md`
- `SCREEN_SPECIFICATIONS.md`
- `INTERNATIONALIZATION.md`
- `MEMBER_MANAGEMENT.md`
- `DONATION_SYSTEM.md`
- `PAYMENT_SYSTEM.md`
- `FINANCE_SYSTEM.md`
- `EXPENSE_SYSTEM.md`
- `COMMITTEE_DATA_MODEL.md`
- `COMMITTEE_WORK_MANAGEMENT.md`
- `MEETING_MANAGEMENT.md`
- `ATTENDANCE_SYSTEM.md`
- `NOTIFICATION_SYSTEM.md`
- `REPORTING_AND_AUDIT.md`
- `AUDIT_LOG_MODEL.md`
- `DATABASE_SCHEMA.md`
- `DATA_RELATIONSHIPS.md`
- `SECURITY_ARCHITECTURE.md`
- `DATA_PRIVACY.md`
- `TESTING_STRATEGY.md`

---

## Document Status

**Navigation Flow — V1 Implementation Baseline**

This document defines the authoritative role-aware navigation architecture for Masjid-e-Mamoor 2.

All navigation implementation must preserve permission boundaries, secure deep links, efficient core workflows, shared-device safety, multilingual presentation, and the product's no-feature-bloat direction.
