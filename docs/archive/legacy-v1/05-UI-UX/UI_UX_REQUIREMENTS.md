# Masjid-e-Mamoor 2 — UI/UX Requirements

**Document Status:** V1 Implementation Baseline  
**Version:** 1.0  
**Product:** Masjid-e-Mamoor 2 Internal Management Application  
**Scope:** V1  
**Platforms:** Web, Android, iOS  
**Primary UX Priorities:** Financial Transparency, Committee Accountability, Attendance, Administration  
**Last Updated:** 2026-09-17

---

# 1. Purpose

This document defines the product-wide UI and UX requirements for Masjid-e-Mamoor 2.

The interface must make the application:

- Easy to understand
- Fast to operate
- Role-aware
- Finance-focused
- Safe for sensitive information
- Suitable for desktop/laptop use
- Suitable for mobile use
- Accessible
- Multilingual
- Consistent across platforms

The central principle is:

> The interface should make important Masjid information easy to find without making the product visually complicated.

---

# 2. UX Priorities

The UI should prioritize:

```text
1. Financial transparency
2. Committee work/accountability
3. Attendance
4. Supporting administration
```

The most important information should be visible with minimal navigation.

---

# 3. V1 UX Philosophy

The product should feel:

```text
Professional
Simple
Calm
Trustworthy
Operational
Clear
Responsive
```

Avoid:

```text
Visual clutter
Unnecessary animations
Gamification
Excessive cards
Overloaded dashboards
Decorative features without operational value
```

---

# 4. Audience

Primary users:

```text
President
Vice President
Secretary
Finance / Financer
Auditor
Committee Member
Member
```

Each role sees only the navigation and information required by its permissions.

---

# 5. Role-Aware UI

The application must be role-aware.

Conceptually:

```text
Authenticated User
      ↓
Role resolved server-side
      ↓
Allowed navigation
      ↓
Allowed actions
      ↓
Allowed data
```

The UI must not merely hide buttons and assume that is sufficient security.

Backend authorization remains authoritative.

---

# 6. Navigation Principle

The navigation should be organized around actual work areas.

Recommended high-level structure:

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
```

Not every role sees every section.

---

# 7. Navigation by Role

Conceptually:

### President

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
```

### Finance

```text
Dashboard
Members / donation context
Donations
Finance
Reports
Relevant Audit
```

### Auditor

```text
Dashboard
Finance / reports
Audit
```

### Secretary

```text
Dashboard
Members
Committee Work
Meetings
Attendance
Donations
Relevant Reports
```

### Committee Member

```text
Dashboard
Members / referrals
My Work
Open Tasks
Meetings / relevant participation
Attendance
Relevant Donation workflow
```

### Member

```text
Dashboard
My Donations
My Attendance
Profile
```

The final navigation matrix follows `USER_ROLES_PERMISSIONS.md`.

---

# 8. Dashboard Principle

Dashboard content must answer:

```text
What needs attention?
What happened recently?
What is pending?
What work is due?
What is the current financial position?
```

Do not fill dashboards with metrics that have no operational purpose.

---

# 9. Finance-First Dashboard

For President/Finance, the dashboard should prominently surface:

```text
Overall Masjid Funds
Cash
Bank
UPI
Other accounts
Unverified payments
Recent expenses
Pending expense documentation
Recent financial activity
```

---

# 10. Committee Dashboard

For President/Secretary, committee dashboard sections should include:

```text
Tasks
Completed
In Progress
Pending
Overdue
Open tasks
Upcoming deadlines
Meetings
Follow-ups
Referral/contribution facts
```

---

# 11. Member Dashboard

A Member dashboard should focus on:

```text
Current monthly contribution status
Outstanding months/amount
Additional donations
Donation history
Jummah attendance
Meeting attendance where applicable
```

The member must not see other members' private data.

---

# 12. Finance Dashboard Cards

Financial summary cards should clearly distinguish:

```text
Overall Funds
Cash Balance
Bank Balance
UPI Balance
Other
```

The visual hierarchy should make the overall total easy to identify.

---

# 13. Financial Transparency UX

Money-related information should use clear labels.

Do not use ambiguous labels such as:

```text
Value
Amount
Status
```

when the context is unclear.

Prefer:

```text
Current Balance
Expected Donation
Verified Donation
Expense Amount
Paid Amount
Remaining
```

---

# 14. Dashboard Data Truth

Dashboard metrics must come from authoritative backend data.

Do not maintain client-side counters as independent truth.

---

# 15. Loading State

Every data-heavy screen must have a clear loading state.

Use:

```text
Skeletons
Progress indicators
Loading rows
```

rather than showing misleading zero values while data is loading.

---

# 16. Empty State

Empty states should explain:

```text
What is empty
Why it may be empty
What action can be taken
```

Example:

```text
No open tasks
There are currently no unassigned tasks.
```

Avoid meaningless:

```text
No data.
```

---

# 17. Error State

Errors must be:

```text
Clear
Actionable
Localized
Non-technical
```

Example:

```text
Something went wrong while saving the expense.
Please try again.
```

Do not expose raw stack traces.

---

# 18. Success Feedback

Successful actions should receive visible confirmation.

Examples:

```text
Payment verified
Task completed
Meeting scheduled
Expense saved
Attendance recorded
```

Use a consistent feedback pattern.

---

# 19. Destructive Action Confirmation

High-risk actions require confirmation.

Examples:

```text
Delete financial transaction
Cancel expense
Deactivate user/account
Change critical configuration
```

The confirmation should explain the consequence.

---

# 20. Financial Deletion Confirmation

President-only financial deletion should use a strong confirmation dialog.

Example:

```text
Delete Financial Transaction?

Transaction: TX-2026-000123
Amount: ₹4,000
Account: Cash

This will remove the transaction from the active financial ledger.
The deletion will remain in the audit history.

[Cancel] [Delete]
```

Exact wording is finalized in UI implementation.

---

# 21. Reason Input

Actions requiring reasons must request the reason before completion.

Examples:

```text
Expense cancellation
Expense amount correction
Financial correction
Referral attribution correction
```

---

# 22. Form Design

Forms should:

- Use clear labels.
- Group related fields.
- Show required/optional state.
- Validate close to the field.
- Preserve user input after recoverable errors.
- Avoid unnecessary fields.
- Use appropriate input types.

---

# 23. Required Field Indicator

Required fields must have a consistent visual indicator.

Optional fields should be explicitly identified when ambiguity is possible.

---

# 24. Inline Validation

Validation errors should appear near the relevant field.

Example:

```text
Amount
[ -100 ]
Amount must be greater than zero.
```

---

# 25. Server Validation Errors

The UI must handle server validation errors even if client validation passed.

Client validation improves UX.

Server validation provides authority.

---

# 26. Numeric Inputs

Financial amount fields should:

- Use numeric keyboard on mobile.
- Prevent invalid characters where practical.
- Support decimals where required.
- Preserve exact entered value until submission.
- Display currency context.

---

# 27. Mobile Number Input

Mobile number input should:

- Use a numeric keyboard.
- Normalize formatting.
- Make country context clear where applicable.
- Avoid allowing visually different formats to create duplicate identities.

---

# 28. Date Inputs

Date selection should use platform-appropriate date pickers.

Users should not need to manually type dates unless useful.

---

# 29. Time Inputs

Meeting time should use a native/appropriate time selection control.

Display format should follow localization settings.

---

# 30. Search UX

Search fields should:

- Be easy to discover.
- Support name/mobile/member ID where applicable.
- Debounce remote search appropriately.
- Preserve filters.
- Show clear no-result states.

---

# 31. Search Privacy

Search must not become a way to bypass authorization.

A Member searching for another member's mobile number must not receive restricted profile data.

---

# 32. Tables

Tables are important for Finance, Audit, Members, Tasks, and Reports.

Tables should provide:

```text
Clear headers
Readable columns
Sorting where useful
Filtering
Pagination
Responsive behavior
```

---

# 33. Financial Tables

Financial tables should make these distinctions clear:

```text
Date
Transaction ID
Account
Type
Credit/Debit
Amount
Category
Reference
```

Do not compress critical financial information into unreadable columns.

---

# 34. Expense Tables

Expense tables should show:

```text
Expense ID
Date
Title
Category
Amount
Paid
Remaining
Status
```

---

# 35. Task Tables

Task lists may show:

```text
Task
Responsible
Priority
Deadline
Status
Related activity
```

---

# 36. Meeting Tables

Meeting lists may show:

```text
Meeting
Date/Time
Location
Status
Attendance
Follow-up count
```

---

# 37. Audit Tables

Audit views may show:

```text
Timestamp
Actor
Action
Entity
Result
Reason
```

Additional fields appear in detail view rather than overcrowding the table.

---

# 38. Responsive Tables

On small screens, tables should not simply shrink until unreadable.

Use appropriate patterns such as:

```text
Horizontal scrolling
Priority columns
Stacked cards
Detail drawers
```

---

# 39. Mobile Finance UX

Mobile Finance screens should prioritize:

```text
Balance
Unverified payments
Expenses
Payment actions
Transaction details
```

Full audit/report tables may use compact mobile layouts.

---

# 40. Desktop Finance UX

Desktop/web is the preferred environment for:

```text
Detailed finance review
Large reports
Audit review
Financial PDF generation
Printing
```

The mobile experience remains fully functional for core operations.

---

# 41. Shared Masjid Laptop

The dedicated Masjid laptop is a shared operational device.

UX requirements:

- Clear user identity.
- Obvious logout.
- Protected navigation.
- No private-data leakage between sessions.
- Print/download actions visible where appropriate.
- Finance/report interfaces optimized for keyboard and mouse.

---

# 42. Shared Device Logout

When a user logs out:

```text
Protected UI state cleared
Protected cached data invalidated
Notifications cleared/scoped
Session removed
```

The next user must not see the previous user's private information.

---

# 43. Keyboard Support

Web screens should support standard keyboard interaction:

```text
Tab
Shift+Tab
Enter
Escape
Arrow keys where appropriate
```

Do not create mouse-only controls.

---

# 44. Focus Management

Dialogs and forms must manage keyboard focus correctly.

When a modal opens:

```text
Focus → modal
```

When it closes:

```text
Focus → triggering control
```

where practical.

---

# 45. Accessibility

The application should meet practical accessibility requirements including:

- Clear labels
- Keyboard accessibility
- Screen-reader semantics
- Focus visibility
- Sufficient contrast
- Large enough touch targets
- Meaningful error messages

---

# 46. Touch Targets

Mobile controls should have appropriately sized touch targets.

Avoid tiny icon-only buttons for critical operations.

---

# 47. Icon-Only Buttons

Critical actions should not rely solely on an icon.

Use:

```text
Icon + tooltip
```

or:

```text
Icon + visible label
```

where meaning is not universally obvious.

---

# 48. Color Semantics

Color may help communicate:

```text
Success
Warning
Error
Information
```

but color must not be the only indicator.

Example:

```text
Paid ✓
Pending ●
Overdue !
```

plus appropriate color.

---

# 49. Financial Status Visuals

Use clear, consistent labels for:

```text
Verified
Pending
Partially Paid
Paid
Cancelled
```

Avoid decorative status pills that hide important wording.

---

# 50. Overdue Visuals

Overdue tasks should be visibly distinct.

Show:

```text
OVERDUE
```

with supporting visual emphasis.

Do not rely only on red color.

---

# 51. Priority Visuals

Task priority should be visible:

```text
Low
Medium
High
Urgent
```

Use both text and visual hierarchy.

---

# 52. Confirmation vs Notification

A confirmation dialog is used before high-risk actions.

A toast/snackbar is used after successful or low-risk actions.

Do not use a toast to confirm a destructive operation before execution.

---

# 53. Financial Action Safety

Financial actions should display enough context before submission.

Example:

```text
Transfer
From: Cash
To: Bank
Amount: ₹20,000
```

The user should verify the details before confirming.

---

# 54. Transfer UX

Transfer form should require:

```text
Source account
Destination account
Amount
Transfer date
Reference/description where appropriate
```

The UI should make it obvious that:

```text
This is an internal transfer.
```

---

# 55. Expense Payment UX

Adding an expense payment should display:

```text
Expense amount
Already paid
Remaining
New payment
Payment method
Account
Payment date
Reference
Payment proof
```

The UI should prevent accidental overpayment before submission and still rely on backend validation.

---

# 56. Donation Payment UX

Monthly payment screen should show:

```text
Month
Expected amount
Outstanding amount
Payment request/link
Payment status
```

The user should not have to understand the underlying ledger to make a payment.

---

# 57. Combined Donation Payment UX

When multiple months are outstanding:

```text
July ₹500
August ₹500
September ₹500

Total due ₹1,500
```

The interface should make the combined amount obvious.

---

# 58. Overpayment UX

Where a member pays more than outstanding monthly dues, the application should explain:

```text
Outstanding monthly dues: ₹1,000
Additional General Donation: ₹200
Total payment: ₹1,200
```

This prevents confusion about future monthly dues.

---

# 59. Partial Monthly Payment UX

If partial monthly settlement is not considered complete:

```text
Due: ₹500
Received: ₹300
Remaining/incomplete: ₹200
```

The UI must not show:

```text
PAID
```

---

# 60. Finance Verification UX

The Finance verification screen should make it easy to compare:

```text
Requested amount
Reported/actual amount
External reference
Payment date
Member
Payment purpose
Evidence
```

Then:

```text
Verify
Reject
```

---

# 61. Payment Verification Safety

The verify action should make clear that:

```text
Verification posts financial state.
```

A simple confirmation may be required for high-risk cases.

---

# 62. Expense Bill UX

Bill upload should show:

```text
Required before Paid
Allowed formats
Upload state
Preview/open action
Replace action where permitted
```

---

# 63. Payment Proof UX

Payment proof should be attached to the relevant payment.

The UI should distinguish:

```text
Bill
```

from:

```text
Payment Proof
```

---

# 64. File Upload UX

File upload should provide:

```text
Accepted file types
Size limit
Upload progress
Success/failure
Preview where supported
Remove/replace action where permitted
```

---

# 65. File Failure Handling

If upload fails:

```text
Do not silently mark documentation complete.
```

The user should see a clear retry option.

---

# 66. Task Claim UX

Open tasks should display:

```text
Title
Description
Priority
Deadline
Related context
Claim button
```

After claiming:

```text
Responsible: current user
```

---

# 67. Task Claim Conflict UX

If another member claims the task first:

```text
This task has already been claimed.
```

Refresh the authoritative state.

Do not show a temporary local "claimed" state that overrides the server.

---

# 68. Task Completion UX

Completion action should allow:

```text
Completion note (optional)
```

and clearly confirm the result.

---

# 69. Completed Task Editing UX

For a Committee Member editing their own completed work:

```text
Show completed status
Show editable fields
Show save action
```

The UI should not offer delete.

---

# 70. Overdue Task UX

Overdue task detail should show:

```text
Deadline
Current status
Days overdue where useful
Responsible member
```

---

# 71. Meeting Creation UX

Meeting form:

```text
Title
Date
Time
Location
Agenda
Invitees
```

Keep the initial form focused.

---

# 72. Meeting Detail UX

Meeting detail should organize information into:

```text
Overview
Agenda
Attendance
Decisions
Follow-ups
```

This should allow a user to understand the meeting without navigating many unrelated screens.

---

# 73. Decision UX

Decision entry should be simple:

```text
Decision text
```

Optional link:

```text
Create follow-up task
```

Do not force task creation when no work is required.

---

# 74. Follow-Up UX

Follow-up tasks should display:

```text
Decision
Responsible member
Deadline
Status
Completion
```

This makes accountability visible.

---

# 75. Meeting Accountability UX

The UI should be able to show:

```text
Meeting
   ↓
Decision
   ↓
Task
   ↓
Responsible
   ↓
Completion
```

This chain should be available from the meeting detail view.

---

# 76. Attendance UX — Jummah

Primary Jummah attendance screen:

```text
Today's/Current Friday session
          ↓
MARK PRESENT
```

The screen should also show:

```text
Attendance status
Location/permission state
```

without exposing technical GPS details unnecessarily.

---

# 77. Attendance Success UX

After successful attendance:

```text
Attendance recorded
```

Optionally show:

```text
Recorded time
Session
```

---

# 78. Attendance Failure UX

Examples:

```text
Location permission is required.
You appear to be outside the attendance area.
Your GPS accuracy is too low. Please try again.
Attendance is already recorded.
```

Messages must be localized.

---

# 79. Offline Attendance UX

When network is unavailable:

```text
Attendance saved locally.
It will be submitted when connection is restored.
```

The UI must make clear that final server validation is pending.

---

# 80. Offline Conflict UX

If sync discovers that attendance already exists:

```text
Attendance was already recorded.
```

Local pending state should reconcile to the server.

---

# 81. Meeting Attendance UX

Meeting attendance should clearly identify:

```text
Meeting
Date/time
Member
Attendance status
```

Do not reuse Jummah GPS controls for meeting attendance unless explicitly needed.

---

# 82. Language Switching UX

Language selector should be easy to find.

Recommended location:

```text
Profile / Settings
```

The language change should apply without requiring logout.

---

# 83. Urdu RTL UX

When Urdu is selected:

```text
Overall layout direction → RTL
```

Test:

```text
Navigation
Forms
Dialogs
Tables
Buttons
Status labels
Reports
```

---

# 84. Responsive Breakpoints

The UI should support at least:

```text
Mobile
Tablet
Desktop
Large desktop
```

Avoid designing exclusively around one fixed width.

---

# 85. Mobile Navigation

Mobile should use a compact navigation pattern appropriate to the framework.

Primary actions should remain easy to reach.

Avoid forcing users to open multiple nested menus for common actions.

---

# 86. Desktop Navigation

Desktop can use:

```text
Sidebar
Top bar
Contextual tabs
```

The chosen pattern should remain consistent throughout the product.

---

# 87. Breadcrumbs

Breadcrumbs may be used in complex desktop areas such as:

```text
Reports
Finance
Audit
```

They are not required on every screen.

---

# 88. Detail Pages

Important detail pages should provide:

```text
Header
Status
Key facts
Primary actions
Related records
History/audit where permitted
```

---

# 89. Primary Action Principle

Each screen should have one visually clear primary action where applicable.

Examples:

```text
Create Expense
Mark Present
Claim Task
Verify Payment
Create Meeting
Generate Report
```

---

# 90. Secondary Actions

Secondary actions should not compete visually with the primary action.

Use consistent hierarchy.

---

# 91. Dangerous Actions

Dangerous actions should be visually distinct and require confirmation.

Examples:

```text
Delete financial transaction
Deactivate account
Cancel expense
```

---

# 92. Read-Only Views

Read-only/audit views should clearly communicate:

```text
View only
```

where a user could otherwise expect edit controls.

---

# 93. Authorization UX

Do not merely hide every unauthorized action.

Where useful, the UI may show that an action requires another role.

Example:

```text
Only Finance can verify payments.
```

Do not expose implementation/security details.

---

# 94. Session Expiry UX

When session expires:

```text
Session expired.
Please sign in again.
```

The application should preserve safe navigation context where possible.

---

# 95. Account Deactivation UX

A deactivated user should see:

```text
Your account is inactive.
Please contact the authorized Masjid administrator.
```

Do not expose internal authorization details.

---

# 96. Shared-Session Safety

The UI must never display previous-user protected information while the authentication state is initializing.

Use:

```text
Loading / neutral shell
```

until the current session is known.

---

# 97. Caching UX

Cached data may improve performance, but stale protected financial/member data must not appear after:

```text
Logout
User switch
Role change
Account deactivation
```

---

# 98. Performance

The UI should prioritize:

```text
Fast initial shell
Fast dashboard
Incremental loading
Paginated large datasets
Optimized images/files
```

---

# 99. Network Resilience

The application should handle intermittent connectivity gracefully.

Actions should show:

```text
Saving...
Retry
Saved
Failed
```

rather than silently failing.

---

# 100. Offline Scope

Only explicitly supported offline workflows should operate without live connectivity.

For V1:

```text
Jummah attendance
```

supports offline capture/sync.

Other financial operations must not silently behave as offline-authoritative transactions.

---

# 101. Optimistic UI

Optimistic updates should be used carefully.

Do not present the following as final before server confirmation:

```text
Payment verified
Financial transaction posted
Attendance finally accepted
Transfer completed
```

---

# 102. Form Submission State

After submission:

```text
Disable duplicate submit
Show progress
Preserve context
Handle server result
```

This reduces accidental duplicates.

---

# 103. Toast/Alert Consistency

Use a consistent system for:

```text
Success
Warning
Error
Info
```

Avoid multiple competing notification styles.

---

# 104. Modal Usage

Use modals for:

```text
Confirmation
Short focused forms
Important warnings
```

Do not place long complex workflows into deeply nested modals.

---

# 105. Drawer Usage

Side drawers can be used for:

```text
Quick detail
Filters
Audit preview
Task/member quick view
```

Full workflows should use dedicated pages where complexity is high.

---

# 106. Filter UX

Financial/report screens should offer filters such as:

```text
Date range
Account
Status
Category
Method
Reference
```

Filters should be easy to clear/reset.

---

# 107. Saved Filters

V1 does not require saved-filter profiles.

Keep filtering simple unless operational use proves a need.

---

# 108. Sorting

Tables should support useful sorting.

Examples:

```text
Newest
Oldest
Amount
Deadline
Status
```

---

# 109. Pagination

Large datasets should be paginated.

Do not load full historical:

```text
Audit logs
Financial transactions
Tasks
Members
```

into the client at once.

---

# 110. Report Generation UX

Report flow:

```text
Select report
      ↓
Select date/range
      ↓
Select filters
      ↓
Preview/summary
      ↓
Generate PDF
```

The user should see the selected reporting period before generation.

---

# 111. PDF Download UX

After generation:

```text
PDF ready
[Open] [Download]
```

where platform permits.

---

# 112. Printing UX

On desktop:

```text
Generate/preview PDF
      ↓
Print
```

The web interface should not depend on browser page print for complex financial reports if PDF output is the authoritative printable format.

---

# 113. Audit View UX

Audit details should be easy to inspect without requiring the user to understand database concepts.

Example:

```text
Expense amount changed
₹10,000 → ₹4,000
Reason: Remaining work cancelled
Changed by: Finance
Date: ...
```

---

# 114. Technical IDs

System IDs such as:

```text
TX-2026-000123
EXP-2026-000045
TASK-2026-000041
```

should be copyable.

They should not dominate the visual hierarchy over human-readable names.

---

# 115. Copy Actions

For references such as:

```text
UPI reference
Transaction ID
Transfer ID
```

provide an easy copy action where useful.

---

# 116. Confirmation on Copy

Copy feedback should be lightweight:

```text
Copied
```

No blocking modal required.

---

# 117. No Unnecessary Animations

Animations should be subtle and functional.

Avoid:

```text
Animated dashboards
Auto-scrolling finance tables
Decorative confetti
Gamified completion effects
```

---

# 118. No Gamification

The UI must not introduce:

```text
Points
Badges
Leaderboards
Streaks
Performance levels
```

for committee members or donors.

---

# 119. No Ranking Widgets

Do not add dashboard components that rank:

```text
Committee Members
Donors
Attendees
```

---

# 120. Visual Hierarchy

A typical detail screen should prioritize:

```text
1. Entity title
2. Current status
3. Important amount/date/owner
4. Primary action
5. Supporting information
6. History/audit
```

---

# 121. Financial Hierarchy

Financial screens should prioritize:

```text
Current balance
Transaction status
Amount
Account
Date
Reference
Supporting evidence
```

---

# 122. Committee Hierarchy

Task screens should prioritize:

```text
Task
Responsible member
Deadline
Priority
Status
Description
Completion
```

---

# 123. Meeting Hierarchy

Meeting screens should prioritize:

```text
Meeting
Date/time/location
Agenda
Attendance
Decisions
Follow-ups
```

---

# 124. Attendance Hierarchy

Jummah attendance should prioritize:

```text
Session
Current attendance status
Mark Present
Location permission/state
```

Do not overwhelm the user with GPS technical details.

---

# 125. Member Profile Hierarchy

Member profile should prioritize:

```text
Name
Mobile
Status
Referrer
Monthly contribution
Current donation state
Relevant history
```

Financial details remain permission-controlled.

---

# 126. Profile Edit UX

Profile edits should be simple and explicit.

Sensitive identity changes, especially mobile-number changes, should use stronger verification.

---

# 127. Settings UX

Settings should group:

```text
Profile
Language
Notifications
Application settings available to role
```

Administrative settings should be role-protected.

---

# 128. Admin Settings

President-level settings may include:

```text
Attendance radius
Masjid location
Expense categories
Role/user controls
UPI configuration through Finance workflow
```

Only authorized settings should be visible.

---

# 129. Finance Settings

Finance-specific settings may include:

```text
UPI configuration
Financial accounts
Categories within permission scope
```

---

# 130. Language in Settings

Language selector must be accessible without navigating through unrelated administrative screens.

---

# 131. Accessibility and Localization

Language switching must not break:

```text
Keyboard order
Screen-reader labels
Focus
Touch targets
```

---

# 132. Error Recovery

Every recoverable error should provide an obvious next action.

Examples:

```text
Upload failed → Retry
Network failed → Retry
OTP failed → Resend
Attendance location failed → Try again
Payment request failed → Generate again
```

---

# 133. Preventing Duplicate Actions

For operations that create money/work records:

```text
Disable submit while request is processing
Use idempotency backend
Display authoritative result
```

Examples:

```text
Create payment
Record expense payment
Create transfer
Claim task
Mark attendance
```

---

# 134. Business-State Messaging

UX messages must reflect actual backend state.

Do not say:

```text
Payment successful
```

when the system only knows:

```text
Payment request created
```

Use precise language.

---

# 135. Financial Terminology UX

Use controlled terms:

```text
Expected
Pending
Verified
Paid
Outstanding
Additional General Donation
Expense
Transfer
Balance
```

Avoid ambiguous wording.

---

# 136. Committee Terminology UX

Use:

```text
Assigned
Claimed
In Progress
Completed
Overdue
Decision
Follow-up
```

rather than vague alternatives such as:

```text
Done
Working
Thing to do
```

in formal screens.

---

# 137. Attendance Terminology UX

Use:

```text
Mark Present
Present
Attendance recorded
Already recorded
Outside attendance area
```

---

# 138. Report Terminology UX

Reports should show:

```text
Reporting Period
Generated At
Opening Balance
Closing Balance
Verified
Pending
```

---

# 139. Mobile Deep Links

Notification deep links must:

- Open the correct screen.
- Require a valid session.
- Respect authorization.
- Handle deleted/deactivated records safely.

---

# 140. Web Deep Links

Web routes must similarly enforce:

```text
Authentication
Authorization
RLS/backend checks
```

---

# 141. Browser Refresh

Refreshing an authenticated page should restore the session safely without exposing another user's cached data.

---

# 142. Application Startup

Startup flow:

```text
Load app shell
      ↓
Resolve session
      ↓
Resolve application user
      ↓
Resolve role
      ↓
Load authorized navigation
      ↓
Load dashboard
```

---

# 143. Unauthorized Route

If a user manually opens an unauthorized route:

```text
Access denied
```

or:

```text
Redirect to an authorized area
```

without exposing restricted content.

---

# 144. Not Found vs Unauthorized

Do not reveal restricted record existence unnecessarily.

The backend may return a neutral result where appropriate.

---

# 145. Data Refresh

Important screens should provide a way to refresh data.

Automatic refresh may be used where useful for:

```text
Unverified payments
Task state
Meeting changes
```

but should not create excessive network usage.

---

# 146. Real-Time Updates

V1 may use real-time/subscription updates where beneficial.

Examples:

```text
Open task claim
Finance queue
Task completion
Meeting changes
```

Real-time is an optimization, not the source of truth.

---

# 147. Real-Time Failure

If a real-time connection fails:

```text
Manual refresh still works.
```

The interface must remain usable.

---

# 148. UI Auditability

Important user actions should visibly show when they are complete.

Example:

```text
Payment verified by Finance
```

where role permits.

---

# 149. Privacy by Design

The UI should follow data minimization.

Only display what the current user needs.

Examples:

```text
Member → own donations
Auditor → financial review
Committee Member → relevant work/member data
```

---

# 150. Sensitive Data Masking

Sensitive identifiers such as bank details should be minimized/masked.

Where V1 stores only last 4 bank digits, show only those.

---

# 151. GPS Privacy UX

Do not show raw:

```text
Latitude
Longitude
```

to ordinary users.

If validation needs to be shown, use a human-readable result:

```text
Attendance location validated
```

---

# 152. No Continuous Location Indicator

Because V1 does not use continuous tracking, do not create UI implying ongoing location monitoring.

---

# 153. Shared Laptop Privacy

Finance/audit screens on the dedicated laptop should be treated as sensitive.

The application should make logout easy to find.

---

# 154. Browser Security UX

Protected files should be opened/downloaded only after authorization.

Avoid exposing permanent public URLs to users.

---

# 155. Print Safety

Before printing financial reports:

```text
Show report title
Reporting period
```

so printed documents can be identified easily.

---

# 156. Report Signature UX

Financial audit PDFs may include:

```text
Prepared By
Reviewed By
Approved By
Date
Signature
```

where configured.

---

# 157. UI Performance on Older Devices

Mobile screens should avoid unnecessary heavy animations and oversized assets.

Core operations should remain usable on modest devices.

---

# 158. Network Performance

Use:

```text
Pagination
Caching where safe
Compressed images
Incremental loading
```

Do not sacrifice financial correctness for performance.

---

# 159. Storage UX

Users should understand file upload limits before selecting files.

The application should not silently resize or delete evidence without clear behavior.

---

# 160. Design System Consistency

The visual system should standardize:

```text
Typography
Spacing
Buttons
Inputs
Cards
Tables
Dialogs
Toasts
Status badges
Navigation
```

Detailed values belong in `DESIGN_SYSTEM.md`.

---

# 161. Screen Specification Relationship

This document defines cross-product UX requirements.

Individual screen behavior belongs in:

```text
SCREEN_SPECIFICATIONS.md
```

Navigation details belong in:

```text
NAVIGATION_FLOW.md
```

---

# 162. UI Testing

All major screens should be tested for:

```text
Desktop
Tablet where applicable
Mobile
English
Hindi
Kannada
Urdu
RTL
Keyboard
Touch
Error states
Loading states
Empty states
```

---

# 163. Visual Regression

Critical screens should have visual regression/gut-check coverage where practical.

Priority:

```text
Login
Dashboard
Finance
Expense
Task
Meeting
Attendance
Reports
Audit
```

---

# 164. UX Acceptance — Finance

Finance UX is acceptable when:

- Balances are immediately understandable.
- Account types are distinct.
- Payment verification is clear.
- Expense payment state is clear.
- Bills/proofs are easy to inspect.
- Multiple payments are understandable.
- Transfers are clearly internal.
- Destructive financial actions require clear confirmation.
- Audit context is accessible.

---

# 165. UX Acceptance — Committee

Committee UX is acceptable when:

- Open tasks are easy to find.
- Claiming is obvious.
- Claimed status is obvious.
- Overdue work is visible.
- Completion is simple.
- Work history is understandable.
- Meeting follow-ups are traceable.
- No ranking/score UI exists.

---

# 166. UX Acceptance — Attendance

Attendance UX is acceptable when:

- Mark Present is obvious.
- GPS requirement is understandable.
- Errors are actionable.
- Offline pending state is clear.
- Duplicate attendance is handled gracefully.
- No continuous-tracking impression exists.

---

# 167. UX Acceptance — Members

Member UX is acceptable when:

- Registration is simple.
- Duplicate detection is understandable.
- Monthly contribution amount is clear.
- Pending months are easy to understand.
- Additional donation is distinct.
- Member sees only permitted information.

---

# 168. UX Acceptance — Reports

Report UX is acceptable when:

- Reporting period is obvious.
- Filters are clear.
- Totals are understandable.
- Internal transfers are not confused with income/expense.
- PDFs are easy to generate.
- Sensitive reports are access-controlled.

---

# 169. UX Acceptance — Localization

Localization UX is acceptable when:

- English works.
- Hindi works.
- Kannada works.
- Urdu works.
- Urdu RTL works.
- Long translations do not break controls.
- Dates/amounts remain correct.
- PDF text renders correctly where supported.

---

# 170. UX Invariants

The following rules are mandatory:

### Invariant 1

The UI prioritizes financial transparency and committee accountability.

### Invariant 2

The UI is role-aware.

### Invariant 3

UI visibility is not a substitute for backend authorization.

### Invariant 4

Financial values shown in the UI come from authoritative server data.

### Invariant 5

The UI never represents a payment request as a verified payment.

### Invariant 6

The UI never represents expected donations as received funds.

### Invariant 7

Destructive financial actions require explicit confirmation.

### Invariant 8

Actions requiring reasons must collect them before completion.

### Invariant 9

Critical financial operations show enough context before submission.

### Invariant 10

Duplicate submissions are prevented at the UX level and backend level.

### Invariant 11

Loading states must not masquerade as zero/empty financial values.

### Invariant 12

Errors are actionable and non-technical.

### Invariant 13

Notifications do not replace business-state confirmation.

### Invariant 14

The shared Masjid laptop cannot retain another user's protected visible state after logout.

### Invariant 15

Sensitive member/financial information is role-restricted.

### Invariant 16

Raw GPS data is not shown to ordinary users.

### Invariant 17

V1 does not use gamification, ranking, or leaderboard UI.

### Invariant 18

V1 attendance UI covers only Jummah and scheduled committee meetings.

### Invariant 19

Offline attendance is visibly pending until server synchronization.

### Invariant 20

The application supports English, Hindi, Kannada, and Urdu.

### Invariant 21

Urdu uses RTL presentation.

### Invariant 22

Language changes do not alter business data.

### Invariant 23

Financial reports are clearly identified by reporting period.

### Invariant 24

Generated PDFs are report artifacts, not the source of truth.

### Invariant 25

The UI remains usable on web, Android, and iOS.

---

# 171. Final UX Acceptance Criteria

The V1 UI/UX is considered ready when:

- Core navigation is role-aware.
- Finance is highly visible to authorized users.
- Committee work is easy to track.
- Donation/payment states are unambiguous.
- Expense workflows are clear.
- Meeting accountability is traceable.
- Jummah attendance is simple and GPS-aware.
- Meeting attendance is straightforward.
- Shared-device behavior is safe.
- Loading/empty/error states are handled.
- Forms prevent common user mistakes.
- Tables remain usable on desktop and mobile.
- Reports are easy to filter and generate.
- PDF printing is practical.
- Sensitive data is appropriately restricted.
- Keyboard/touch accessibility is supported.
- English/Hindi/Kannada/Urdu work.
- Urdu RTL works.
- No ranking/gamification features appear.

---

# 172. Implementation Boundary

This document defines cross-product UI/UX requirements.

The following belong elsewhere:

```text
Visual design tokens         → DESIGN_SYSTEM.md
Navigation structure         → NAVIGATION_FLOW.md
Per-screen behavior          → SCREEN_SPECIFICATIONS.md
Authentication              → AUTHENTICATION.md
Member behavior              → MEMBER_MANAGEMENT.md
Donation behavior            → DONATION_SYSTEM.md
Payment behavior             → PAYMENT_SYSTEM.md
Finance behavior             → FINANCE_SYSTEM.md
Expense behavior             → EXPENSE_SYSTEM.md
Committee work               → COMMITTEE_WORK_MANAGEMENT.md
Meetings                     → MEETING_MANAGEMENT.md
Attendance                   → ATTENDANCE_SYSTEM.md
Notifications                → NOTIFICATION_SYSTEM.md
Reporting                    → REPORTING_AND_AUDIT.md
Localization                 → INTERNATIONALIZATION.md
Authorization               → AUTHORIZATION_MODEL.md
Security                    → SECURITY_ARCHITECTURE.md
Testing                      → TESTING_STRATEGY.md
```

---

# 173. Related Documents

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
- `NOTIFICATION_SYSTEM.md`
- `REPORTING_AND_AUDIT.md`
- `INTERNATIONALIZATION.md`
- `AUDIT_LOG_MODEL.md`
- `DATABASE_SCHEMA.md`
- `DATA_RELATIONSHIPS.md`
- `DESIGN_SYSTEM.md`
- `NAVIGATION_FLOW.md`
- `SCREEN_SPECIFICATIONS.md`
- `AUTHORIZATION_MODEL.md`
- `SECURITY_ARCHITECTURE.md`
- `DATA_PRIVACY.md`
- `TESTING_STRATEGY.md`

---

## Document Status

**UI/UX Requirements — V1 Implementation Baseline**

This document defines the authoritative cross-product UI/UX requirements for Masjid-e-Mamoor 2.

All interface implementation must preserve clarity, role-aware access, financial safety, shared-device privacy, responsive behavior, accessibility, localization, and the product's no-feature-bloat principle.
