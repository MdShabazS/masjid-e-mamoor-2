# Masjid-e-Mamoor --- UI/UX Specification

**Document Status:** Draft --- Architecture Review Required\
**Version:** 1.0\
**Phase:** Documentation-First / Pre-Development\
**Repository:** `MdShabazS/masjid-e-mamoor-2`

------------------------------------------------------------------------

# 1. Purpose

This document defines the product UI/UX specification for
Masjid-e-Mamoor.

It covers:

-   information architecture
-   role-based navigation
-   dashboard structure
-   responsive web behavior
-   mobile behavior
-   forms
-   tables
-   financial workflows
-   member workflows
-   committee workflows
-   attendance workflows
-   notifications
-   loading/error/empty/offline states
-   accessibility
-   localization
-   Urdu RTL
-   confirmation patterns
-   destructive actions
-   realtime behavior
-   privacy-aware presentation
-   consistent interaction patterns

This document defines the intended user experience. It does not replace
the authorization, business-rule, database, or API specifications.

------------------------------------------------------------------------

# 2. UX Principles

## UX-001 --- Clarity Before Density

The interface should make important information understandable without
requiring users to decode database concepts.

------------------------------------------------------------------------

## UX-002 --- Role-Relevant Information

Each role sees navigation and information relevant to its
responsibilities.

Hiding a feature in the UI is not an authorization mechanism.

------------------------------------------------------------------------

## UX-003 --- Progressive Disclosure

Complex financial and administrative details should be revealed when
needed rather than overwhelming ordinary users.

------------------------------------------------------------------------

## UX-004 --- Safe Financial UX

Financial actions must clearly communicate:

-   amount
-   target
-   current state
-   resulting effect
-   confirmation

------------------------------------------------------------------------

## UX-005 --- No False Success

The UI must not show an operation as successful until authoritative
confirmation is received.

------------------------------------------------------------------------

## UX-006 --- Explainable States

Users should understand:

``` text
loading
processing
success
failed
offline
pending review
verified
rejected
```

------------------------------------------------------------------------

## UX-007 --- Consistency

Equivalent actions should look and behave consistently across web and
mobile.

------------------------------------------------------------------------

## UX-008 --- Accessibility

Accessibility is a baseline requirement, not a post-development
enhancement.

------------------------------------------------------------------------

## UX-009 --- Localization First

Layouts must accommodate longer translated text and RTL languages from
the beginning.

------------------------------------------------------------------------

# 3. Product Navigation Model

The application should use a role-aware navigation model.

Conceptual common areas:

``` text
Home / Dashboard
Members
Donations
Finance
Committee
Attendance
Notifications
Reports
Profile
Settings
```

Not every role sees every area.

------------------------------------------------------------------------

# 4. Role Navigation

## President / Super Admin

Potential navigation:

``` text
Dashboard
Members
Donations
Finance
Committee
Attendance
Reports
Notifications
Settings
Profile
```

Exact permissions remain governed by the role matrix.

------------------------------------------------------------------------

# 5. Vice President Navigation

Potential:

``` text
Dashboard
Members
Committee
Attendance
Donations
Reports
Notifications
Profile
```

Only authorized financial areas should appear.

------------------------------------------------------------------------

# 6. Secretary Navigation

Potential:

``` text
Dashboard
Members
Committee
Meetings
Attendance
Notifications
Reports
Profile
```

------------------------------------------------------------------------

# 7. Finance Navigation

Potential:

``` text
Dashboard
Payments
Donations
Accounts
Transactions
Expenses
Transfers
Reports
Notifications
Profile
```

------------------------------------------------------------------------

# 8. Auditor Navigation

Potential:

``` text
Dashboard
Financial Oversight
Transactions
Reports
Audit
Notifications
Profile
```

Auditor is primarily oversight-oriented.

------------------------------------------------------------------------

# 9. Committee Member Navigation

Potential:

``` text
Dashboard
Tasks
Meetings
Attendance
Notifications
Profile
```

------------------------------------------------------------------------

# 10. Member Navigation

Potential:

``` text
Home
My Donations
Payments
Notifications
Profile
```

Members should not see administrative navigation merely because the
application uses one deployment.

------------------------------------------------------------------------

# 11. Global Header

Web header may contain:

-   application identity
-   current page title
-   notification entry
-   profile/account menu
-   language selector
-   online/offline indicator where useful

Avoid excessive header controls.

------------------------------------------------------------------------

# 12. Mobile Header

Mobile should prioritize:

-   page title
-   back navigation where needed
-   notifications
-   profile/menu

Primary navigation may use a bottom navigation bar or drawer depending
on final information architecture.

------------------------------------------------------------------------

# 13. Breadcrumbs

Breadcrumbs may be used on complex administrative pages.

Example:

``` text
Finance
  > Payments
  > Payment #123
```

Avoid breadcrumbs on simple mobile flows.

------------------------------------------------------------------------

# 14. Dashboard Principle

A dashboard should answer:

1.  What needs my attention?
2.  What changed?
3.  What can I do next?
4.  What important information should I know?

------------------------------------------------------------------------

# 15. Member Dashboard

Potential cards:

``` text
Current outstanding
Current month
Recent payment
Payment status
Quick payment
Notifications
```

The dashboard should not expose other members' data.

------------------------------------------------------------------------

# 16. Finance Dashboard

Potential cards:

``` text
Pending verification
Today's collection
Outstanding
Recent expenses
Account summary
Recent transactions
```

Numbers should be authoritative or clearly marked as derived.

------------------------------------------------------------------------

# 17. Committee Dashboard

Potential:

``` text
My tasks
Upcoming meetings
Pending attendance
Recent announcements
```

------------------------------------------------------------------------

# 18. Auditor Dashboard

Potential:

``` text
Recent financial activity
Pending review items
Reports
Audit activity
Reconciliation indicators
```

------------------------------------------------------------------------

# 19. Administrative Dashboard

President/administrative dashboard may include:

``` text
membership overview
donation overview
committee activity
attendance
finance summary
system notifications
```

Only authorized information should be shown.

------------------------------------------------------------------------

# 20. Dashboard Cards

Cards should:

-   have clear labels
-   show relevant time period
-   show units/currency
-   provide contextual links
-   avoid excessive decoration

------------------------------------------------------------------------

# 21. Financial Metric Formatting

Amounts should show:

-   currency
-   consistent decimal policy
-   localized number formatting where appropriate

Do not rely only on color to distinguish positive/negative values.

------------------------------------------------------------------------

# 22. Status Badges

Use consistent statuses:

``` text
Pending
Verified
Rejected
Paid
Partially Paid
Open
Completed
Cancelled
Reversed
```

Status color is supplementary to text.

------------------------------------------------------------------------

# 23. Tables

Administrative web pages may use tables for:

-   members
-   payments
-   transactions
-   expenses
-   tasks
-   reports

Tables should support:

-   sorting
-   filtering
-   pagination
-   row actions

where required.

------------------------------------------------------------------------

# 24. Mobile Tables

Avoid forcing wide desktop tables onto mobile.

Use:

-   cards
-   stacked rows
-   horizontal scrolling where appropriate
-   detail screens

------------------------------------------------------------------------

# 25. Member List

Member list may display:

-   name
-   membership status
-   relevant contact identifier
-   role
-   referral status

Only authorized fields should be displayed.

------------------------------------------------------------------------

# 26. Member Detail

Potential sections:

``` text
Profile
Membership
Referral
Donation summary
Payment history
Committee involvement
Attendance
```

The exact sections depend on role.

------------------------------------------------------------------------

# 27. Member Privacy

Member detail must avoid exposing sensitive information unnecessarily.

Field-level privacy is required where the role matrix demands it.

------------------------------------------------------------------------

# 28. Profile

Members should be able to view/edit approved profile fields.

Protected administrative fields must not appear as ordinary editable
inputs.

------------------------------------------------------------------------

# 29. Referral Registration UX

Conceptual flow:

``` text
Referral link/code
      |
      v
Verify/continue
      |
      v
Phone OTP
      |
      v
Profile details
      |
      v
Review
      |
      v
Registration complete
```

------------------------------------------------------------------------

# 30. Referral Error States

Show clear states for:

-   invalid referral
-   expired referral
-   already used referral
-   registration conflict
-   OTP failure
-   network failure

Do not expose internal referral security details unnecessarily.

------------------------------------------------------------------------

# 31. Donation Overview

Member donation page should clearly separate:

``` text
Current outstanding
Payment history
Additional donations
```

If future obligations exist, label them separately.

------------------------------------------------------------------------

# 32. Obligation Display

For each obligation:

``` text
Month
Original amount
Paid
Outstanding
Status
```

Avoid overwhelming ordinary users with internal allocation identifiers.

------------------------------------------------------------------------

# 33. Payment Initiation

A payment flow should clearly show:

``` text
What you owe
What you are paying
How it will be applied
Payment method
Proof requirement
```

------------------------------------------------------------------------

# 34. Payment Amount UX

When paying a single obligation:

``` text
Outstanding: ₹X
Amount to pay: [input]
```

When partial payments are allowed, clearly explain the remaining amount
after submission.

------------------------------------------------------------------------

# 35. Combined Payment UX

Combined payment may show:

``` text
Select outstanding months
Total selected outstanding
Payment amount
Allocation preview
```

The server remains authoritative.

------------------------------------------------------------------------

# 36. Combined Payment Confirmation

Before final submission show:

``` text
Payment amount
Selected obligations
Expected allocation
Payment method
```

The UI should indicate that final allocation is confirmed by the system.

------------------------------------------------------------------------

# 37. UPI Payment UX

Recommended sequence:

``` text
Review payment
     |
     v
Pay with UPI
     |
     v
Open UPI app
     |
     v
Return to Masjid-e-Mamoor
     |
     v
Submit/confirm evidence if required
     |
     v
Payment submitted for verification
```

------------------------------------------------------------------------

# 38. UPI Return State

Returning from a UPI app must not display:

``` text
Payment verified
```

unless authoritative server verification has actually occurred.

------------------------------------------------------------------------

# 39. Payment Proof Upload

UI should show:

-   accepted file types
-   size limit
-   upload progress
-   preview where safe
-   retry
-   remove/replace before final submission

------------------------------------------------------------------------

# 40. Payment Submission Result

After successful submission:

``` text
Payment submitted
Reference: XXXXX
Status: Pending verification
```

The UI should provide a route to payment details.

------------------------------------------------------------------------

# 41. Payment Verification UX

Finance page should show:

``` text
Payment amount
Member
Payment method
Reference
Proof
Submitted date
Current status
```

------------------------------------------------------------------------

# 42. Verification Action

Before verification:

``` text
Confirm verification
Amount: ₹X
Member: ...
Payment reference: ...
```

The action should require explicit confirmation.

------------------------------------------------------------------------

# 43. Rejection UX

Finance should provide a structured rejection reason.

Avoid relying only on an uncontrolled free-text field.

------------------------------------------------------------------------

# 44. Rejection Result

Member sees:

``` text
Payment rejected
Reason: ...
Action: Resubmit / Contact Finance
```

depending on final workflow.

------------------------------------------------------------------------

# 45. Payment Detail Timeline

Useful timeline:

``` text
Submitted
Under Review
Verified / Rejected
Allocated
Reversed (if applicable)
```

This helps users understand financial state.

------------------------------------------------------------------------

# 46. Outstanding Balance Presentation

Use:

``` text
Outstanding: ₹X
```

with clear period context.

Do not present future obligations as current debt without labeling.

------------------------------------------------------------------------

# 47. FIFO Allocation Presentation

For detailed views, authorized users may see:

``` text
Payment ₹800

January   ₹500
February  ₹300
March     ₹0
```

The UI should explain that allocation follows the approved allocation
rule.

------------------------------------------------------------------------

# 48. Overpayment UX

If overpayment occurs, the UI must clearly state what happened.

Example:

``` text
Amount received: ₹700
Eligible outstanding: ₹500
Excess: ₹200
Treatment: [approved policy]
```

Never silently discard the excess.

------------------------------------------------------------------------

# 49. Additional Donation UX

Additional donation should be clearly separate from monthly obligation
payment.

Example:

``` text
Monthly contribution
Additional donation
```

------------------------------------------------------------------------

# 50. Anonymous Donation UX

If anonymity is supported, clearly explain the privacy scope.

Do not imply that the organization cannot identify a donor internally
unless that is actually true.

------------------------------------------------------------------------

# 51. Jummah Cash UX

Finance entry should show:

``` text
Date
Amount
Account
Reference/notes
```

and a clear confirmation before recording.

------------------------------------------------------------------------

# 52. Finance Accounts

Account page may show:

``` text
Account name
Type
Current balance
Recent transactions
```

Only authorized users can access.

------------------------------------------------------------------------

# 53. Transaction List

Finance transaction table may include:

``` text
Date
Type
Category
Account
Amount
Reference
Status
```

------------------------------------------------------------------------

# 54. Transaction Detail

Show:

-   source
-   category
-   amount
-   account
-   business reference
-   timestamps
-   audit context where authorized

------------------------------------------------------------------------

# 55. Transfer UX

Transfer form:

``` text
From account
To account
Amount
Reason
Reference
```

Before submission:

``` text
You are moving ₹X from A to B.
```

------------------------------------------------------------------------

# 56. Transfer Confirmation

Require explicit confirmation.

Do not use vague button labels such as:

``` text
Submit
```

Prefer:

``` text
Confirm transfer
```

------------------------------------------------------------------------

# 57. Expense UX

Expense form may include:

``` text
Category
Vendor
Amount
Date
Account
Description
Proof
```

The exact fields depend on final finance rules.

------------------------------------------------------------------------

# 58. Expense Status

Display clearly:

``` text
Draft
Submitted
Approved
Rejected
Posted
Reversed
```

------------------------------------------------------------------------

# 59. Expense Approval

Approval screen should show all information required for a decision.

Do not hide supporting evidence behind unnecessary navigation.

------------------------------------------------------------------------

# 60. Correction UX

Correction should be explicit:

``` text
What is wrong?
Why is correction needed?
What will change?
```

Show original record before confirmation.

------------------------------------------------------------------------

# 61. Reversal UX

Show:

``` text
Original financial effect
Reason
Expected resulting effect
```

Require explicit confirmation.

------------------------------------------------------------------------

# 62. Destructive Actions

Destructive/high-impact actions include:

-   deactivation
-   financial reversal
-   financial correction
-   deleting permitted files

Use confirmation dialogs with meaningful descriptions.

------------------------------------------------------------------------

# 63. Confirmation Dialogs

A good confirmation explains:

``` text
Action
Target
Amount/effect
Irreversibility
```

Avoid generic:

``` text
Are you sure?
```

------------------------------------------------------------------------

# 64. Forms

All important forms should provide:

-   labels
-   required indicators
-   validation messages
-   input constraints
-   submit state
-   server error state
-   success state

------------------------------------------------------------------------

# 65. Form Validation

Client validation should provide immediate feedback.

Server validation remains authoritative.

------------------------------------------------------------------------

# 66. Form Submission

After submission:

``` text
button disabled
processing indicator
duplicate submission prevented
```

For retryable operations, use the same operation identity.

------------------------------------------------------------------------

# 67. Unknown Result

If a financial command times out:

``` text
We are checking the status of your request.
```

Do not immediately encourage a new payment.

------------------------------------------------------------------------

# 68. Error Messages

Messages should tell the user:

1.  what happened
2.  what they can do next

Avoid raw technical errors.

------------------------------------------------------------------------

# 69. Authorization Error

Use:

``` text
You do not have permission to perform this action.
```

Do not expose internal permission names.

------------------------------------------------------------------------

# 70. Session Expiry

When a session expires:

``` text
Your session has expired. Please sign in again.
```

Preserve safe draft data where possible.

------------------------------------------------------------------------

# 71. Loading States

Every async screen needs a loading strategy.

Use:

-   skeletons for page data
-   progress indicators for uploads
-   button processing state for commands

Avoid indefinite spinners without explanation.

------------------------------------------------------------------------

# 72. Empty States

Examples:

``` text
No payments yet.
No pending payments.
No tasks assigned.
No notifications.
No transactions found.
```

Empty is not the same as error.

------------------------------------------------------------------------

# 73. Offline State

The app should visibly communicate:

``` text
Offline
```

when connectivity is unavailable.

Do not imply server state is current while offline.

------------------------------------------------------------------------

# 74. Offline Action State

If an approved offline action is queued:

``` text
Saved offline
Waiting to sync
```

After synchronization:

``` text
Synced
```

If rejected:

``` text
Sync failed
Action required
```

------------------------------------------------------------------------

# 75. Realtime Updates

When another authorized actor changes data:

-   update relevant UI
-   avoid disruptive full-page refreshes
-   reconcile cached state
-   preserve user input where possible

------------------------------------------------------------------------

# 76. Realtime Financial Updates

Finance dashboards should update pending/transaction information when
authoritative changes arrive.

Members should receive only their own relevant updates.

------------------------------------------------------------------------

# 77. Notification Center

Notification center should support:

-   unread indicator
-   pagination
-   read state
-   navigation to relevant record
-   realtime updates

------------------------------------------------------------------------

# 78. Search UX

Search should provide:

-   clear search field
-   filters
-   loading state
-   no-result state
-   pagination/infinite scroll where appropriate

------------------------------------------------------------------------

# 79. Search Privacy

Search results must never reveal unauthorized records merely because a
search term matches.

------------------------------------------------------------------------

# 80. Filters

Filters should be:

-   understandable
-   resettable
-   persistent only where useful
-   reflected in URL on web where appropriate

------------------------------------------------------------------------

# 81. Sorting

Sort labels should be human-readable.

Avoid exposing database column names.

------------------------------------------------------------------------

# 82. Pagination UX

Show:

-   current result context
-   next/previous controls or infinite loading
-   loading state
-   end-of-results state

------------------------------------------------------------------------

# 83. Reports UX

Reports should allow:

-   date range
-   relevant category
-   filters
-   view
-   export where authorized

------------------------------------------------------------------------

# 84. Report Summary

Show important totals at the top.

Clearly identify the report period.

------------------------------------------------------------------------

# 85. Report Export

Before export:

``` text
Report type
Date range
Filters
File format
```

Export access must follow report authorization.

------------------------------------------------------------------------

# 86. Audit UX

Authorized audit users may see:

``` text
Time
Actor
Action
Record
Result
```

Sensitive details should be expandable rather than always visible.

------------------------------------------------------------------------

# 87. Committee Tasks

Task list should show:

``` text
Task
Assignee
Priority
Due date
Status
```

------------------------------------------------------------------------

# 88. Task Detail

Show:

``` text
Description
Assignee
Due date
Status
Attachments
Activity
```

------------------------------------------------------------------------

# 89. Task Assignment

Assignment UI should make the target member clear.

Do not allow arbitrary unauthorized users to become assignees.

------------------------------------------------------------------------

# 90. Task Completion

Completion should be simple but auditable.

If completion requires evidence, show it clearly.

------------------------------------------------------------------------

# 91. Meetings

Meeting list:

``` text
Upcoming
Past
Cancelled
```

Meeting detail:

``` text
date
time
location
agenda
attendance
attachments
```

------------------------------------------------------------------------

# 92. Attendance UX

Attendance capture should prioritize speed.

For supported workflows:

``` text
event
member
status
location evidence
sync state
```

------------------------------------------------------------------------

# 93. GPS Attendance

If GPS is required, show:

-   permission state
-   capture status
-   accuracy where useful
-   rejection reason if outside approved area

Do not expose precise location to unauthorized users.

------------------------------------------------------------------------

# 94. Attendance Offline UX

A captured offline attendance event should show a local state such as:

``` text
Pending sync
```

The user should not confuse this with server confirmation.

------------------------------------------------------------------------

# 95. Role Switching

If the same deployment supports role-aware navigation, role switching
must not be implemented as client-side privilege escalation.

If an authorized user has multiple application contexts, the server
determines available roles/permissions.

------------------------------------------------------------------------

# 96. Multi-Role Presentation

The product should support one deployment with all roles.

The current authenticated user should see the appropriate role
experience.

For demos/testing, a controlled role-selection mechanism may exist only
in non-production environments or through authorized test accounts.

------------------------------------------------------------------------

# 97. Profile Menu

Potential:

``` text
Profile
Language
Notifications
Security
Sign out
```

Administrative settings appear only when authorized.

------------------------------------------------------------------------

# 98. Language Selector

Support:

``` text
English
हिन्दी
ಕನ್ನಡ
اردو
```

The selector should persist user preference.

------------------------------------------------------------------------

# 99. RTL Mode

When Urdu is active:

``` text
dir="rtl"
```

must be applied appropriately.

Icons, navigation, spacing, and directional controls must be tested.

------------------------------------------------------------------------

# 100. Mixed-Language Content

Names and identifiers may remain in their original form.

Do not automatically transliterate user-entered names unless the product
explicitly supports it.

------------------------------------------------------------------------

# 101. Accessibility

The UI should target strong practical accessibility.

Requirements include:

-   semantic HTML
-   keyboard access
-   visible focus
-   labels
-   accessible errors
-   screen-reader support
-   touch target sizing
-   contrast
-   reduced motion consideration

------------------------------------------------------------------------

# 102. Keyboard Navigation

Web users should be able to:

-   navigate controls
-   open menus
-   submit forms
-   close dialogs
-   use tables
-   access notifications

without requiring a mouse.

------------------------------------------------------------------------

# 103. Focus Management

Dialogs and route changes should manage focus appropriately.

After closing a modal, focus should return to a logical trigger.

------------------------------------------------------------------------

# 104. Accessible Forms

Inputs need:

-   associated labels
-   error descriptions
-   required state
-   appropriate input types

------------------------------------------------------------------------

# 105. Accessible Status

Dynamic states such as:

``` text
Payment submitted
Sync complete
New notification
```

should be exposed accessibly.

------------------------------------------------------------------------

# 106. Color Independence

Do not communicate status through color alone.

Example:

``` text
✓ Verified
! Pending
× Rejected
```

may accompany color.

------------------------------------------------------------------------

# 107. Responsive Web

The web app should support:

-   desktop
-   laptop
-   tablet
-   mobile browser

without sacrificing critical workflows.

------------------------------------------------------------------------

# 108. Mobile-First Considerations

For narrow screens:

-   prioritize essential actions
-   collapse secondary information
-   use bottom sheets/drawers where useful
-   avoid tiny controls
-   keep forms manageable

------------------------------------------------------------------------

# 109. Desktop Considerations

Desktop may provide:

-   side navigation
-   wider tables
-   multi-column dashboards
-   split detail panels

------------------------------------------------------------------------

# 110. Tablet

Tablet layouts should adapt between mobile and desktop structures.

------------------------------------------------------------------------

# 111. Design Tokens

UI should use centralized tokens for:

-   spacing
-   typography
-   radius
-   elevation
-   borders
-   status styles

Exact values belong in `DESIGN_SYSTEM.md`.

------------------------------------------------------------------------

# 112. Component Consistency

Reusable components should include:

``` text
Button
Input
Select
Dialog
Sheet
Card
Badge
Table
Tabs
Toast
Alert
Skeleton
EmptyState
```

------------------------------------------------------------------------

# 113. Button Hierarchy

Use consistent hierarchy:

``` text
Primary
Secondary
Tertiary
Destructive
```

Do not make every button visually primary.

------------------------------------------------------------------------

# 114. Destructive Button

Destructive financial actions should use a distinct treatment and
explicit confirmation.

------------------------------------------------------------------------

# 115. Toasts

Use toasts for:

-   lightweight success
-   non-blocking information

Do not rely on toasts for critical financial confirmation alone.

------------------------------------------------------------------------

# 116. Alerts

Use persistent alerts for:

-   authorization problems
-   important offline state
-   critical service status
-   high-impact warnings

------------------------------------------------------------------------

# 117. Modals

Use modals for focused decisions.

Do not put entire complex workflows inside giant modal dialogs.

------------------------------------------------------------------------

# 118. Drawers/Sheets

Useful for:

-   filters
-   quick details
-   mobile actions

They must remain accessible.

------------------------------------------------------------------------

# 119. Navigation After Mutation

After successful commands, navigate to a useful authoritative state.

Example:

``` text
submit payment
 -> payment details
```

not simply:

``` text
blank dashboard
```

------------------------------------------------------------------------

# 120. Optimistic UI

Optimistic updates may be used for low-risk UI state.

Avoid optimistic final financial balances unless carefully reconciled.

------------------------------------------------------------------------

# 121. Financial Mutations

For financial commands, prefer:

``` text
processing
 -> server result
 -> authoritative refresh
```

over pretending the result happened immediately.

------------------------------------------------------------------------

# 122. Form Draft Persistence

Safe drafts may be preserved locally.

Sensitive information should be handled cautiously.

------------------------------------------------------------------------

# 123. Logout and Drafts

On logout, user-specific sensitive drafts should not become available to
another account.

------------------------------------------------------------------------

# 124. File Upload UX

Show:

``` text
Selected
Uploading
Uploaded
Failed
Retry
```

For multiple files, show per-file state.

------------------------------------------------------------------------

# 125. File Preview UX

Preview should:

-   respect authorization
-   work on supported formats
-   provide fallback download/open
-   show loading state

------------------------------------------------------------------------

# 126. Error Recovery

Every recoverable error should provide an action where practical:

``` text
Retry
Refresh
Go back
Contact Finance
Sign in again
```

------------------------------------------------------------------------

# 127. Validation Message Style

Messages should be specific.

Prefer:

``` text
Enter an amount greater than ₹0.
```

over:

``` text
Invalid input.
```

------------------------------------------------------------------------

# 128. Financial Confirmation Language

Prefer:

``` text
Confirm payment submission
```

over:

``` text
Confirm
```

------------------------------------------------------------------------

# 129. Member-Friendly Language

Avoid internal terminology such as:

``` text
RPC
RLS
ledger row
operation ID
```

in ordinary member UI.

------------------------------------------------------------------------

# 130. Finance-Friendly Detail

Finance users may receive more detailed operational information, but it
should remain understandable.

------------------------------------------------------------------------

# 131. Auditor-Friendly Detail

Auditor views should emphasize:

-   history
-   traceability
-   filters
-   evidence
-   reconciliation

rather than mutation controls.

------------------------------------------------------------------------

# 132. President-Friendly Detail

Administrative dashboards should emphasize organization-wide operational
visibility without exposing unnecessary internal technical details.

------------------------------------------------------------------------

# 133. Secretary-Friendly Detail

Secretary workflows should prioritize:

-   membership administration
-   meetings
-   committee activity
-   attendance

according to permissions.

------------------------------------------------------------------------

# 134. Vice President-Friendly Detail

The Vice President interface should expose only approved
administrative/operational oversight functions.

------------------------------------------------------------------------

# 135. Committee Member UX

Keep committee workflows focused:

``` text
My tasks
Meetings
Attendance
Notifications
```

------------------------------------------------------------------------

# 136. Member UX

Keep ordinary member experience focused on:

``` text
profile
monthly contribution
payment
history
notifications
```

------------------------------------------------------------------------

# 137. Role-Specific Dashboard Widgets

Widgets should be selected based on role and permissions.

A hidden widget is not a security boundary.

------------------------------------------------------------------------

# 138. Permission-Aware UI

Before rendering sensitive controls:

``` text
permission available?
```

But the server must still enforce the permission.

------------------------------------------------------------------------

# 139. Permission Denied UX

If the user reaches a forbidden route:

``` text
Access not available
```

Avoid exposing whether a protected record exists where that itself is
sensitive.

------------------------------------------------------------------------

# 140. Not Found vs Forbidden

Use a privacy-aware strategy.

For highly sensitive resources, unauthorized users may receive a generic
not-found style response rather than confirming resource existence.

------------------------------------------------------------------------

# 141. Session Loading

During initial session resolution, avoid flashing privileged UI.

------------------------------------------------------------------------

# 142. Role Loading

During role resolution:

``` text
Loading your access...
```

or an appropriate skeleton can prevent incorrect UI flashes.

------------------------------------------------------------------------

# 143. Realtime Conflict UX

If the record changed while the user was editing:

``` text
This information changed. Review the latest version before saving.
```

The exact conflict strategy depends on the domain.

------------------------------------------------------------------------

# 144. Financial Conflict UX

For stale financial data:

``` text
The outstanding amount changed. Please review the updated amount.
```

Never silently submit stale financial intent.

------------------------------------------------------------------------

# 145. Offline Conflict UX

Show:

``` text
Saved locally
```

followed later by:

``` text
Synced
```

or:

``` text
Could not sync — review required
```

------------------------------------------------------------------------

# 146. Notification UX

Notifications should distinguish:

``` text
informational
action required
warning
critical
```

------------------------------------------------------------------------

# 147. Notification Read Interaction

Clicking/opening a notification may mark it read.

For accessibility, provide an explicit mark-read action where useful.

------------------------------------------------------------------------

# 148. Notification Deep Link

Opening a notification should re-check authorization before displaying
its target.

------------------------------------------------------------------------

# 149. Mobile Gestures

Do not make critical actions depend only on swipe gestures.

Critical financial actions need explicit controls.

------------------------------------------------------------------------

# 150. Confirmation for Irreversible Actions

If an action cannot easily be undone:

``` text
Require confirmation
Explain consequence
Use explicit action label
```

------------------------------------------------------------------------

# 151. Navigation Preservation

When a user returns from a detail page, preserve useful:

-   filters
-   sort
-   pagination
-   search

where practical.

------------------------------------------------------------------------

# 152. URL State

Web filters/search may be reflected in URL query parameters when useful
for sharing/navigation.

Never put sensitive financial data into URLs unnecessarily.

------------------------------------------------------------------------

# 153. Deep Link Security

A URL such as:

``` text
/payments/123
```

does not imply authorization.

The destination must query authorized data.

------------------------------------------------------------------------

# 154. Accessibility of Tables

Tables need:

-   headers
-   row/column relationships
-   accessible actions
-   responsive fallback

------------------------------------------------------------------------

# 155. Accessibility of Charts

Reports/charts must provide textual summaries or accessible data views.

A chart alone must not be the only representation of financial
information.

------------------------------------------------------------------------

# 156. Accessibility of Maps/GPS

If maps are used:

-   provide textual location context
-   avoid requiring visual interpretation alone
-   protect precise location data

------------------------------------------------------------------------

# 157. GPS Privacy UX

If attendance uses GPS, tell the user why location is needed.

Do not collect more precise location than required by the business rule.

------------------------------------------------------------------------

# 158. Permission Prompts

Explain platform permissions before triggering them when possible.

Example:

``` text
Location is required to verify attendance within the approved Jummah area.
```

------------------------------------------------------------------------

# 159. Mobile Background Behavior

Do not promise that background sync always succeeds.

Show accurate synchronization state.

------------------------------------------------------------------------

# 160. Network Status

Network state may be:

``` text
online
offline
unstable
syncing
```

The UX should avoid excessive flickering between states.

------------------------------------------------------------------------

# 161. Loading Performance

Prioritize:

1.  navigation shell
2.  authentication state
3.  critical page content
4.  secondary data
5.  nonessential widgets

------------------------------------------------------------------------

# 162. Error Boundaries

Unexpected UI errors should display a safe recovery screen.

Do not show stack traces to users.

------------------------------------------------------------------------

# 163. Crash Recovery

After an app/web crash:

-   restore safe navigation state
-   reconcile server state
-   restore only safe drafts

------------------------------------------------------------------------

# 164. Security UX

Do not ask users to paste:

-   OTP
-   service key
-   database password
-   signed URL

into ordinary application fields.

------------------------------------------------------------------------

# 165. Sensitive Data Masking

Where useful, partially mask:

-   phone numbers
-   transaction references
-   account identifiers

according to role and workflow.

------------------------------------------------------------------------

# 166. Copy Actions

Copying sensitive financial information should be explicit and should
not expose data unnecessarily.

------------------------------------------------------------------------

# 167. Session Security UX

Provide:

-   sign out
-   session expiry messaging
-   account status messaging

------------------------------------------------------------------------

# 168. Account Deactivation UX

A deactivated user should see a clear account-status message without
exposing internal administrative details.

------------------------------------------------------------------------

# 169. Role Change UX

If a role changes during a session:

-   refresh authorization
-   update navigation
-   invalidate sensitive cached data
-   prevent stale privileged actions

------------------------------------------------------------------------

# 170. Design Review Checklist

Before implementation:

-   [ ] Role navigation reviewed
-   [ ] Member flow reviewed
-   [ ] Donation flow reviewed
-   [ ] Finance flow reviewed
-   [ ] Committee flow reviewed
-   [ ] Attendance flow reviewed
-   [ ] Notification UX reviewed
-   [ ] Offline states reviewed
-   [ ] Realtime states reviewed
-   [ ] Accessibility reviewed
-   [ ] i18n reviewed
-   [ ] Urdu RTL reviewed
-   [ ] Error states reviewed
-   [ ] Loading states reviewed
-   [ ] Empty states reviewed
-   [ ] Financial confirmations reviewed

------------------------------------------------------------------------

# 171. UI Acceptance Criteria

The UI specification is implementation-ready when:

1.  All seven roles have defined navigation.
2.  Core member journeys are defined.
3.  Donation/payment journeys are defined.
4.  Finance workflows are defined.
5.  Committee workflows are defined.
6.  Attendance workflows are defined.
7.  Notification UX is defined.
8.  Realtime behavior is defined.
9.  Offline behavior is defined.
10. Error/loading/empty states are defined.
11. Accessibility requirements are defined.
12. Localization/RTL requirements are defined.
13. Responsive behavior is defined.
14. Sensitive data presentation is defined.
15. Financial confirmation patterns are defined.

------------------------------------------------------------------------

# 172. Open Decisions

  Decision                           Status
  ---------------------------------- ---------------------------
  Exact navigation layout            Review
  Mobile navigation pattern          Review
  Dashboard widget list              Review
  Final design token values          `DESIGN_SYSTEM.md`
  Exact table/card breakpoints       Design system
  Push notification UI               Notification architecture
  Offline conflict UI                Review
  Exact GPS attendance UX            Review
  Exact financial approval dialogs   Review
  Export UX                          Review
  Admin broadcast UI                 Open

------------------------------------------------------------------------

# 173. Implementation Order

1.  Finalize information architecture
2.  Finalize role navigation
3.  Finalize core user journeys
4.  Finalize responsive layout strategy
5.  Finalize design tokens
6.  Implement shared UI primitives
7.  Implement authentication screens
8.  Implement member/profile screens
9.  Implement donation/payment screens
10. Implement Finance screens
11. Implement committee screens
12. Implement attendance screens
13. Implement notifications
14. Implement reports
15. Implement accessibility
16. Implement localization/RTL
17. Implement offline/realtime states
18. Perform usability review
19. Perform accessibility testing
20. Perform role-by-role acceptance testing

------------------------------------------------------------------------

# 174. Change Control

Any UI change affecting a business workflow must review:

-   product requirements
-   user flows
-   business rules
-   API contracts
-   role permissions
-   financial integrity
-   storage/privacy
-   offline/realtime behavior

A UI change must not silently change business behavior.

------------------------------------------------------------------------

# 175. Status

**Current status: UI/UX specification generated for review.**

This document defines the intended interaction model. Exact visual
tokens, component styling, page-level wireframes, and implementation
details belong to `DESIGN_SYSTEM.md` and the later implementation phase.
