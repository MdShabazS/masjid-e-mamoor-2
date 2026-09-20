# Masjid-e-Mamoor 2 — Design System

**Document Status:** V1 Implementation Baseline  
**Version:** 1.0  
**Product:** Masjid-e-Mamoor 2 Internal Management Application  
**Scope:** V1  
**Platforms:** Web, Android, iOS  
**Design Direction:** Professional, Calm, Clear, Operational  
**Last Updated:** 2026-09-17

---

# 1. Purpose

This document defines the reusable visual design system for Masjid-e-Mamoor 2.

The design system provides a consistent foundation for:

- Typography
- Colors
- Spacing
- Layout
- Buttons
- Forms
- Cards
- Tables
- Status indicators
- Dialogs
- Navigation
- Notifications
- Data presentation
- Financial interfaces
- Committee work interfaces
- Attendance interfaces
- Reports
- RTL/localization

The central principle is:

> Visual consistency should reduce cognitive load and improve trust without making the application decorative or complicated.

---

# 2. Design Goals

The V1 visual system should feel:

```text
Professional
Trustworthy
Calm
Modern
Readable
Efficient
Respectful
```

It should avoid:

```text
Visual noise
Over-decoration
Excessive gradients
Gamification
Unnecessary animation
Crowded dashboards
Inconsistent component styles
```

---

# 3. Product Priority in Visual Hierarchy

The visual hierarchy should reflect product priorities:

```text
1. Financial transparency
2. Committee accountability
3. Attendance
4. Supporting administration
```

Important information should have stronger hierarchy than secondary information.

---

# 4. Design Principles

1. Clarity over decoration.
2. Consistency over novelty.
3. Data over ornament.
4. Financial amounts must be easy to scan.
5. Status must be visible without relying only on color.
6. High-risk actions must be visually distinct.
7. Dense information should remain readable.
8. Mobile controls must remain touch-friendly.
9. RTL must be treated as a first-class layout direction.
10. Accessibility is part of the design system.
11. Components should be reusable across web and mobile where practical.
12. No visual pattern should introduce ranking/gamification.

---

# 5. Design Tokens

The implementation should use centralized design tokens.

Conceptual token groups:

```text
color.*
type.*
space.*
radius.*
shadow.*
border.*
motion.*
layout.*
```

Do not scatter arbitrary values throughout components.

---

# 6. Color System

The exact production palette should be selected and validated during implementation, but the system should contain semantic color roles.

Recommended semantic groups:

```text
Primary
Secondary
Success
Warning
Danger
Info
Neutral
Background
Surface
Border
Text
Muted Text
```

---

# 7. Semantic Color Principle

Components should consume semantic tokens such as:

```text
color.success
color.warning
color.danger
color.info
```

rather than hard-coding component-specific colors.

---

# 8. Primary Color

The primary color is used for:

```text
Primary actions
Active navigation
Links
Selected states
Key controls
```

It should remain visually distinctive but not overpower financial information.

---

# 9. Secondary Color

Secondary colors may support:

```text
Secondary actions
Supporting highlights
Less-important interactive elements
```

Avoid using too many visual accent colors.

---

# 10. Success Color

Use for:

```text
Success
Verified
Paid
Completed
Attendance recorded
Saved
```

Do not rely on green alone.

Always include text/icon/state semantics.

---

# 11. Warning Color

Use for:

```text
Pending
Approaching deadline
Missing documentation
Negative balance warning
```

---

# 12. Danger Color

Use for:

```text
Delete
Deactivate
Cancel
Rejected
Critical error
```

Danger styling should be restrained and purposeful.

---

# 13. Info Color

Use for:

```text
Informational messages
System guidance
Neutral notifications
```

---

# 14. Neutral Colors

Neutral tokens provide:

```text
Background
Surface
Borders
Muted text
Disabled state
Secondary surfaces
```

The UI should remain readable in both light/dark-compatible implementations if dark mode is later enabled.

---

# 15. Contrast

Text and controls must maintain sufficient contrast for accessibility.

Do not choose colors solely for appearance.

Validate critical combinations using accessibility tooling before production.

---

# 16. Color Independence

Critical information must not be communicated through color alone.

Example:

Bad:

```text
Red = overdue
```

Better:

```text
OVERDUE !
```

plus appropriate visual color.

---

# 17. Typography

Use a clear sans-serif typography system suitable for:

```text
Latin
Devanagari
Kannada
Arabic/Urdu
```

The exact production font stack must be validated for web, Android, iOS, and PDF generation.

---

# 18. Typography Hierarchy

Recommended conceptual levels:

```text
Display
Page Heading
Section Heading
Card Heading
Body
Body Small
Caption
Label
Numeric/Financial
```

---

# 19. Page Heading

Page titles should be visually prominent.

Example:

```text
Finance
```

not:

```text
FINANCE MANAGEMENT SYSTEM DASHBOARD
```

Use concise titles.

---

# 20. Section Heading

Section headings divide content into meaningful groups.

Examples:

```text
Recent Transactions
Pending Payments
Open Tasks
Meeting Follow-ups
```

---

# 21. Body Text

Body text should prioritize readability.

Avoid overly small text for:

```text
Financial explanations
Warnings
Terms
Audit context
```

---

# 22. Caption Text

Caption styles are appropriate for:

```text
Timestamps
Secondary metadata
Reference labels
Helper text
```

Do not use caption text for critical financial amounts.

---

# 23. Financial Number Typography

Financial amounts should have strong visual alignment and readability.

Example:

```text
₹2,50,000
```

Use a consistent numeric presentation.

---

# 24. Monetary Alignment

In dense financial tables, amounts should use consistent alignment.

Recommended:

```text
Right-aligned numeric columns
```

This makes comparisons easier.

---

# 25. Reference IDs

System references such as:

```text
TX-2026-000123
EXP-2026-000044
TASK-2026-000041
```

may use a compact monospace or clearly distinguishable numeric style where appropriate.

Do not make IDs visually dominant over the human-readable record title.

---

# 26. Spacing System

Use a standardized spacing scale.

Conceptually:

```text
XS
SM
MD
LG
XL
2XL
3XL
```

A base unit approach is recommended so spacing remains predictable.

---

# 27. Component Spacing

Components should use consistent:

```text
Internal padding
Gap between fields
Gap between sections
Page margins
Table row spacing
```

Avoid one-off spacing values.

---

# 28. Page Layout

Desktop pages should use:

```text
Page header
Main content
Optional contextual side content
```

Avoid excessive full-width empty space.

---

# 29. Content Width

Long-form content should use a readable maximum width.

Financial tables may intentionally use wider layouts.

---

# 30. Grid System

Use a responsive grid for dashboards.

Example conceptual structure:

```text
1 column → mobile
2 columns → tablet
3–4 columns → desktop where appropriate
```

Do not force every dashboard into four equal cards.

---

# 31. Responsive Principle

The design should adapt rather than simply shrink.

Responsive behavior may use:

```text
Stack
Collapse
Scroll
Reflow
Hide secondary metadata
```

depending on content importance.

---

# 32. Mobile Layout

Mobile should prioritize:

```text
Primary action
Important status
Important amount/date
Essential context
```

Secondary information may move into expandable/detail areas.

---

# 33. Desktop Layout

Desktop can present:

```text
More columns
More simultaneous context
Large tables
Side filters
Report controls
```

---

# 34. Tablet Layout

Tablet should use a hybrid layout.

Avoid assuming:

```text
mobile only
```

or:

```text
desktop only
```

for intermediate widths.

---

# 35. Border Radius

Use a restrained radius system.

Conceptual tokens:

```text
Small
Medium
Large
Pill
```

Pills should mainly be used for status tags, not every container.

---

# 36. Shadows

Use subtle shadows only where useful for hierarchy.

Examples:

```text
Dialog
Floating menu
Popover
Elevated card
```

Avoid heavy shadows around every card.

---

# 37. Borders

Borders should provide structure without making the UI visually noisy.

Use borders for:

```text
Input fields
Table separation
Card boundaries
Section boundaries
```

---

# 38. Surface Hierarchy

Recommended conceptual layers:

```text
Application background
Surface
Raised surface
Overlay
```

The hierarchy should remain subtle.

---

# 39. Buttons

Core button variants:

```text
Primary
Secondary
Outline
Ghost
Danger
```

The final component set should remain small.

---

# 40. Primary Button

Use for the primary action:

```text
Save Expense
Verify Payment
Create Meeting
Claim Task
Mark Present
Generate Report
```

---

# 41. Secondary Button

Use for supporting actions:

```text
Cancel
Back
View Details
```

---

# 42. Danger Button

Use for destructive actions:

```text
Delete
Deactivate
Cancel Expense
```

Danger actions require confirmation when they have material consequences.

---

# 43. Disabled Button

Disabled state should clearly indicate:

```text
Action currently unavailable
```

Do not use disabled styling to conceal an authorization problem where an explanatory message is more appropriate.

---

# 44. Loading Button

During server submission:

```text
Loading indicator
Button disabled against duplicate submission
```

Example:

```text
Verifying...
```

---

# 45. Iconography

Icons should be:

```text
Simple
Consistent
Recognizable
Accessible
```

Do not use decorative icon collections inconsistently.

---

# 46. Icon Meaning

Icons must support, not replace, labels for important actions.

Example:

```text
✓ Verify Payment
```

is clearer than:

```text
✓
```

alone.

---

# 47. Navigation

Use a consistent navigation model throughout the product.

Potential patterns:

```text
Desktop sidebar
Mobile navigation
Top bar
Contextual tabs
```

Detailed navigation is defined in `NAVIGATION_FLOW.md`.

---

# 48. Active Navigation State

The current section should be clearly identifiable through:

```text
Label
Icon
Background/border treatment
```

Do not rely on color alone.

---

# 49. Breadcrumbs

Breadcrumbs may be used in complex desktop areas.

Example:

```text
Finance / Expenses / EXP-2026-000041
```

Not every screen needs breadcrumbs.

---

# 50. Cards

Cards are useful for:

```text
Summary metrics
Compact records
Dashboard sections
```

Cards should not replace tables when many rows must be compared.

---

# 51. Financial Summary Card

A finance card may contain:

```text
Label
Large amount
Secondary context
Optional trend/status
```

Example:

```text
Cash Balance
₹35,000
Current
```

---

# 52. Committee Metric Card

A committee card may show:

```text
Open Tasks
12
```

or:

```text
Overdue
3
```

Do not attach ranking language.

---

# 53. Status Badges

Status badges provide compact state visibility.

V1 conceptual statuses include:

```text
Pending
Verified
Added
Partially Paid
Paid
Cancelled
In Progress
Completed
Overdue
Scheduled
```

---

# 54. Status Badge Structure

A status badge should use:

```text
Icon/semantic cue
+
Text
+
Subtle color
```

---

# 55. Status Badge Accessibility

A screen reader/user should be able to understand:

```text
Overdue
```

even if color is unavailable.

---

# 56. Pending Status

Pending should use a neutral/warning treatment.

Example:

```text
● Pending
```

---

# 57. Paid Status

Paid should communicate completion clearly.

Example:

```text
✓ Paid
```

---

# 58. Verified Status

Verified should be clearly distinguishable from merely:

```text
Payment initiated
```

Use precise labels.

---

# 59. Expense Status

Expense status should be:

```text
Added
Partially Paid
Paid
Cancelled
```

Do not use ambiguous status text.

---

# 60. Task Status

Task UI should distinguish:

```text
Created/Assigned
In Progress
Completed
Overdue
```

Overdue may be an additional visual condition.

---

# 61. Form Fields

All fields should have:

```text
Label
Input
Optional helper/error text
```

---

# 62. Input States

Inputs should support:

```text
Default
Focus
Filled
Error
Disabled
Read-only
Success where appropriate
```

---

# 63. Input Labels

Labels remain visible.

Do not rely exclusively on placeholders as labels.

---

# 64. Placeholder Text

Placeholders are examples, not labels.

Example:

```text
Mobile number
[Enter 10-digit number]
```

---

# 65. Required Fields

Required state should be consistently indicated.

---

# 66. Error Text

Error messages should:

- Be short.
- Explain the problem.
- Tell the user what to do next.
- Use localized language.

---

# 67. Success Text

Success feedback should be clear without becoming intrusive.

Examples:

```text
Expense saved.
Payment verified.
Attendance recorded.
Task completed.
```

---

# 68. Tables

Tables should be visually clean and dense enough for real operational use.

Use:

```text
Header
Rows
Hover/focus state
Pagination
Optional sorting
```

---

# 69. Financial Table Design

Recommended columns:

```text
Date
Reference
Description
Account
Type
Amount
Status
```

Avoid squeezing too many columns into one default view.

---

# 70. Financial Amount Styling

Use a consistent amount column treatment.

Credit/debit may use:

```text
+₹10,000
-₹4,000
```

where appropriate.

The sign must be supplemented by clear semantics.

---

# 71. Transfer Styling

Internal transfers should be visually distinguishable from income/expense.

Example:

```text
Transfer
Cash → Bank
₹20,000
```

---

# 72. Expense Table Styling

Expense table should emphasize:

```text
Expense
Amount
Paid
Remaining
Status
```

---

# 73. Task Table Styling

Task table should emphasize:

```text
Task
Responsible
Priority
Deadline
Status
```

---

# 74. Audit Table Styling

Audit table should emphasize:

```text
Timestamp
Actor
Action
Entity
Result
```

Detailed before/after information belongs in a detail view.

---

# 75. Table Row Actions

Use a consistent row-action pattern:

```text
View
Edit where permitted
More actions
```

Destructive actions should not be the most visually prominent row action.

---

# 76. Sorting Indicators

Sortable columns should clearly indicate:

```text
Ascending
Descending
Not sorted
```

Avoid tiny inaccessible indicators.

---

# 77. Pagination

Pagination controls should show:

```text
Current page
Total/relative position where practical
Previous
Next
```

Large datasets must not load all rows into the UI.

---

# 78. Filters

Filter controls should be easy to understand and reset.

Recommended:

```text
Date range
Status
Account
Category
Method
```

---

# 79. Filter Chips

Applied filters may be shown as removable chips.

Avoid excessively long chips for complex filters.

---

# 80. Search

Search field should be prominent on large lists.

Use appropriate search icon and placeholder.

---

# 81. Dialogs

Dialogs are appropriate for:

```text
Confirmation
Short focused action
Critical warning
```

---

# 82. Destructive Dialog

A destructive dialog should show:

```text
What will happen
Affected record
Important amount/reference
Cancel action
Confirm action
```

---

# 83. Financial Deletion Dialog

Example conceptual layout:

```text
Delete Financial Transaction?

TX-2026-000123
Cash
₹4,000

This removes the transaction from the active ledger.
The deletion remains recorded in audit history.

[Cancel] [Delete]
```

---

# 84. Reason Dialog

Actions requiring reasons should have:

```text
Reason label
Multiline input
Character guidance if needed
Cancel
Confirm
```

---

# 85. Toasts/Snackbars

Use transient messages for:

```text
Saved
Copied
Updated
Non-blocking information
```

Do not rely on toasts for important financial explanation.

---

# 86. Alerts

Use persistent alerts for:

```text
Negative balance
Missing required documentation
Critical failure
Security issue
```

---

# 87. Empty States

Empty-state design:

```text
Icon/illustration where appropriate
Heading
One sentence
Action if available
```

Avoid decorative illustrations that imply a feature does not exist when data is simply empty.

---

# 88. Loading States

Use skeletons for data-heavy pages.

Use spinners for:

```text
Single action
Short blocking operation
```

---

# 89. Skeleton Design

Skeletons should match the shape of the eventual content.

Do not show a blank screen during normal loading.

---

# 90. Error States

Page-level errors should provide:

```text
What failed
Retry action
Support/contact guidance where appropriate
```

---

# 91. Network Error

Example:

```text
Unable to load finance data.
Check your connection and try again.

[Retry]
```

---

# 92. Offline State

When offline, show a clear network indication where relevant.

For offline-supported attendance:

```text
Attendance will sync when connection returns.
```

---

# 93. Optimistic Updates

Do not visually commit critical financial state before server confirmation.

Examples:

```text
Payment verified
Transfer completed
Financial transaction posted
Attendance finally accepted
```

---

# 94. Financial Confirmation Pattern

For high-risk actions:

```text
Review
   ↓
Confirm
   ↓
Processing
   ↓
Server result
   ↓
Success/Error
```

---

# 95. Transfer Confirmation

Before submitting:

```text
From: Cash
To: Bank
Amount: ₹20,000
```

Clearly show the source and destination.

---

# 96. Payment Verification Confirmation

Finance should see enough evidence before verification:

```text
Member
Amount
Reference
Payment date
Purpose
Evidence
```

---

# 97. Expense Payment Confirmation

Show:

```text
Expense amount
Already paid
Remaining
New payment
Account
Method
Proof
```

---

# 98. Task Claim Confirmation

Open task claim generally does not need a heavy confirmation if the action is reversible only through controlled workflow.

The UI should clearly show:

```text
Claim this task
```

and the resulting responsible user.

---

# 99. Attendance Confirmation

Successful Jummah attendance should show immediate, clear confirmation:

```text
Attendance recorded.
```

---

# 100. Mobile Touch Targets

Interactive mobile controls should use sufficiently large touch targets.

Do not place critical actions too close together.

---

# 101. Mobile Bottom Actions

Where helpful, primary actions may remain accessible near the bottom of the screen.

Avoid covering important content.

---

# 102. Mobile Forms

Forms should:

- Use appropriate keyboard types.
- Avoid unnecessary scrolling.
- Group related fields.
- Preserve entered values after recoverable errors.

---

# 103. Desktop Forms

Desktop forms may use two-column layouts where fields are logically related.

Do not make forms overly wide.

---

# 104. Responsive Table Strategy

For complex tables:

```text
Desktop → full table
Tablet → selective columns
Mobile → horizontal scroll or card/detail view
```

Never hide critical amounts silently.

---

# 105. Finance Mobile Design

Mobile finance screen should prioritize:

```text
Balance
Pending verification
Expenses
Quick operational actions
```

---

# 106. Finance Desktop Design

Desktop finance should optimize for:

```text
Detailed review
Filtering
Large transaction tables
Report generation
Printing
Audit context
```

---

# 107. Committee Mobile Design

Prioritize:

```text
My tasks
Open tasks
Upcoming deadlines
Completion
Meetings
```

---

# 108. Committee Desktop Design

Desktop can show:

```text
Work overview
Filters
Member drilldowns
Meeting follow-ups
Work history
```

---

# 109. Attendance Mobile Design

Primary view:

```text
Jummah session
Attendance status
MARK PRESENT
```

Avoid exposing unnecessary GPS technical details.

---

# 110. Attendance Desktop Design

Desktop can show:

```text
Jummah counts
History
Meeting attendance
Reports
```

---

# 111. Member Mobile Design

Prioritize:

```text
Current contribution
Pending dues
Payment action
Donation history
Attendance
```

---

# 112. RTL Design

When Urdu is active:

```text
Direction = RTL
```

The design system must support RTL at token/component/layout level.

---

# 113. RTL Spacing

Do not hard-code physical `left`/`right` assumptions where logical properties are possible.

Prefer conceptual properties such as:

```text
start
end
inline-start
inline-end
```

---

# 114. RTL Alignment

Text and layout should follow the selected direction.

Do not force Latin left alignment throughout Urdu UI.

---

# 115. RTL Tables

Financial numeric columns may remain logically aligned for readability while labels follow RTL conventions.

Test actual output rather than assuming mirroring is always correct.

---

# 116. RTL Icons

Directional icons may mirror.

Non-directional icons generally stay unchanged.

---

# 117. RTL Dialogs

Dialog title, body, controls, and icon placement must remain coherent in RTL.

---

# 118. Localization-Safe Components

Components should tolerate:

```text
Longer translated labels
Multiple lines
Different word lengths
Different script widths
```

Do not hard-code fixed widths around English.

---

# 119. Accessibility Focus

Focus states must be visible.

Do not remove browser/platform focus outlines without providing an equivalent accessible treatment.

---

# 120. Keyboard Navigation

All interactive web components should be reachable through keyboard navigation.

---

# 121. Screen Reader Semantics

Use semantic HTML/accessibility roles where appropriate.

Examples:

```text
Button
Heading
Table
Form
Dialog
Alert
Navigation
```

---

# 122. Form Accessibility

Each field must have an accessible label.

Errors should be associated with their inputs.

---

# 123. Status Accessibility

Status should be conveyed through:

```text
Text
Icon/semantic marker
```

not only color.

---

# 124. Motion

Motion should be minimal and purposeful.

Use animation for:

```text
State transition
Loading feedback
Dialog transition
Navigation
```

Avoid decorative motion.

---

# 125. Reduced Motion

Where the platform supports reduced-motion preferences, avoid unnecessary animations for users who request reduced motion.

---

# 126. No Gamification

The design system must not introduce:

```text
Points
Badges
Streaks
Leaderboards
Confetti
Performance meters
```

as committee/donation mechanics.

---

# 127. No Ranking Visuals

Do not use:

```text
Top 3 committee members
Best donor
Highest performer
Attendance ranking
```

---

# 128. Financial Trust Pattern

Finance screens should use:

```text
Clear numbers
Stable labels
Visible references
Consistent status
Minimal decorative noise
```

This helps users understand the data rather than distract from it.

---

# 129. Audit Trust Pattern

Audit screens should emphasize:

```text
Actor
Timestamp
Action
Entity
Change
Reason
```

without excessive visual decoration.

---

# 130. Committee Trust Pattern

Committee work screens should emphasize:

```text
Responsibility
Deadline
Status
Completion
History
```

---

# 131. Meeting Trust Pattern

Meeting screens should emphasize:

```text
Date/time
Agenda
Attendance
Decision
Follow-up
```

---

# 132. Attendance Trust Pattern

Attendance screens should emphasize:

```text
Session
Present/Not Present
Validation result
```

not raw technical GPS data.

---

# 133. Sensitive Data Presentation

Sensitive information should be displayed only when required.

Examples:

```text
Bank details
Payment references
Member mobile numbers
Raw GPS evidence
Financial documents
```

---

# 134. Data Masking

Where only partial data is intended:

```text
Bank •••• 1234
```

Do not render full sensitive identifiers unnecessarily.

---

# 135. Copyable Identifiers

References such as:

```text
TX-2026-000123
UPI reference
Transfer ID
```

should be easy to copy.

---

# 136. Copy Feedback

Use a simple:

```text
Copied
```

feedback pattern.

---

# 137. File Upload Components

A reusable file-upload component should support:

```text
Accepted types
Upload progress
Success
Failure
Replace
Remove where permitted
Preview/open
```

---

# 138. File Upload Visual States

States:

```text
Idle
Selected
Uploading
Uploaded
Error
```

---

# 139. File Preview

Where practical, provide:

```text
Open
Preview
Download
```

according to permissions.

---

# 140. Protected File Links

Protected files should not be represented as permanently public links.

---

# 141. PDF UX

Generated reports should have:

```text
Clear title
Date/range
Generated timestamp
Print/download action
```

---

# 142. Print-Friendly Design

Financial audit PDFs should use:

```text
Readable fonts
Consistent margins
Clear tables
Page numbers
Signature areas where appropriate
```

---

# 143. Long Text Handling

Long text in:

```text
Task description
Meeting agenda
Decision
Expense description
```

should wrap rather than overflow.

---

# 144. Truncation

Use truncation only when safe.

Never truncate critical:

```text
Financial amount
Status
Reference
Deadline
```

---

# 145. Tooltips

Tooltips are appropriate for:

```text
Unfamiliar icons
Secondary technical information
Compact desktop tables
```

Do not hide essential information only in tooltips.

---

# 146. Notifications UI

In-app notifications should be concise:

```text
Title
Short message
Timestamp
Optional action
```

No V1 notification-inbox requirement.

---

# 147. Error Copy

Avoid technical wording such as:

```text
500 Internal Server Error
JWT invalid
RLS policy violation
```

for ordinary users.

Use user-facing descriptions.

---

# 148. Security Copy

When access is denied:

```text
You do not have permission to perform this action.
```

Do not expose database/security implementation details.

---

# 149. Financial Error Copy

Example:

```text
Payment could not be verified.
Please check the transaction reference and try again.
```

---

# 150. Attendance Error Copy

Example:

```text
You appear to be outside the attendance area.
Please move closer to the Masjid and try again.
```

---

# 151. Task Error Copy

Example:

```text
This task has already been claimed.
Refresh the task and review the current status.
```

---

# 152. Design System Component Inventory

Core shared components should include:

```text
App Shell
Navigation
Page Header
Section Header
Button
Icon Button
Input
Textarea
Select
Date Picker
Time Picker
Search
Filter
Card
Table
Status Badge
Alert
Toast/Snackbar
Dialog
Drawer
Tabs
Pagination
Empty State
Loading Skeleton
Spinner
File Upload
File Preview
Avatar
Confirmation Dialog
```

The implementation should avoid unnecessary component proliferation.

---

# 153. Finance-Specific Shared Components

Useful reusable finance components:

```text
Balance Card
Financial Amount
Transaction Row
Account Selector
Payment Status
Expense Status
Financial Summary
Audit Detail
```

---

# 154. Committee-Specific Shared Components

Useful reusable components:

```text
Task Status
Priority Badge
Deadline Display
Responsible Member
Claim Action
Completion Summary
Meeting Follow-up
```

---

# 155. Attendance-Specific Components

Useful reusable components:

```text
Attendance Status
Mark Present Action
Location Permission State
Offline Sync State
Attendance Summary
```

---

# 156. Member Components

Useful reusable components:

```text
Member Identity
Referral Summary
Contribution Summary
Donation Status
Member History
```

---

# 157. Component Naming

Components should use clear domain-neutral names where reusable.

Example:

```text
StatusBadge
DataTable
ConfirmDialog
FileUpload
```

Domain-specific components should remain explicit:

```text
FinancialSummaryCard
TaskStatusBadge
JummahAttendanceCard
```

---

# 158. Component Variants

Use variants instead of one-off components.

Example:

```text
Button
  ├── primary
  ├── secondary
  ├── outline
  └── danger
```

---

# 159. Component Behavior Consistency

A component must behave consistently across the application.

Example:

```text
All dangerous actions
→ same confirmation interaction
```

---

# 160. Design Tokens and Dark Mode

Dark mode is not a V1 product requirement.

However, tokenized colors should make future appearance changes possible without rewriting every component.

---

# 161. Theme Independence

Components should use semantic tokens rather than raw hex values.

This keeps the design system maintainable.

---

# 162. Web/Mobile Consistency

Web and mobile do not need identical layouts.

They must share:

```text
Terminology
Visual meaning
Status semantics
Interaction principles
```

---

# 163. Platform-Appropriate Controls

Use platform-appropriate native controls where they improve usability.

Examples:

```text
Date picker
Time picker
Keyboard
Permission prompt
File selection
```

---

# 164. Design QA

Before release, review:

```text
Spacing
Typography
Color
Alignment
Status
Responsiveness
RTL
Accessibility
Financial readability
```

---

# 165. Visual Regression Targets

Priority screens:

```text
Login
Dashboard
Finance
Expense Detail
Payment Verification
Task List
Task Detail
Meeting Detail
Jummah Attendance
Member Profile
Reports
Audit
Settings
```

---

# 166. Cross-Language Visual QA

Test every major screen in:

```text
English
Hindi
Kannada
Urdu
```

For Urdu, explicitly verify:

```text
RTL
Long labels
Tables
Dialogs
Navigation
```

---

# 167. Financial Visual QA

Verify:

```text
₹ formatting
Debit/credit distinction
Large amounts
Negative balances
Long transaction references
Multi-payment expenses
Audit details
```

---

# 168. Mobile Visual QA

Verify on representative Android/iOS devices:

```text
Small screen
Normal screen
Large screen
Different text sizes
Keyboard open
Offline state
```

---

# 169. Accessibility QA

Verify:

```text
Keyboard navigation
Focus
Screen-reader labels
Contrast
Touch target size
Error associations
Reduced motion where supported
```

---

# 170. Design System Invariants

The following rules are mandatory:

### Invariant 1

The visual language is consistent across the product.

### Invariant 2

Financial information has strong visual clarity.

### Invariant 3

Critical states are not communicated by color alone.

### Invariant 4

Destructive actions use distinct visual treatment.

### Invariant 5

High-risk financial actions provide enough context before confirmation.

### Invariant 6

Buttons and controls use reusable variants.

### Invariant 7

Typography supports all V1 languages.

### Invariant 8

Urdu supports RTL layout.

### Invariant 9

Logical start/end properties are preferred over fixed left/right assumptions.

### Invariant 10

Components tolerate longer localized text.

### Invariant 11

Financial numbers use consistent formatting/alignment.

### Invariant 12

Sensitive data is visually minimized and role-protected.

### Invariant 13

Raw GPS evidence is not shown by default.

### Invariant 14

Mobile controls remain touch-friendly.

### Invariant 15

Tables remain usable on desktop and mobile.

### Invariant 16

Critical actions are not hidden solely in tooltips.

### Invariant 17

Loading states do not masquerade as actual values.

### Invariant 18

Error states are actionable.

### Invariant 19

Offline attendance state is visibly distinct from final server acceptance.

### Invariant 20

The design system does not introduce gamification or rankings.

### Invariant 21

Web and mobile share common terminology and semantic meaning.

### Invariant 22

Business data does not change when the visual theme/language changes.

### Invariant 23

Generated reports prioritize print readability.

### Invariant 24

Protected files are not presented as permanent public URLs.

### Invariant 25

The component system remains intentionally small and reusable.

---

# 171. Acceptance Criteria

The Design System is implementation-ready when:

- Core components have reusable variants.
- Typography hierarchy is defined.
- Spacing is tokenized.
- Semantic colors are defined.
- Status styling is consistent.
- Financial amounts are readable.
- Destructive actions are visually distinct.
- Forms are accessible.
- Tables work on desktop/mobile.
- Shared components support localization.
- Urdu RTL works.
- Long translated labels do not break layouts.
- Mobile touch targets are appropriate.
- Loading/empty/error states are consistent.
- Protected/sensitive information has appropriate presentation.
- PDF/report presentation follows the defined hierarchy.
- No gamification/ranking visuals exist.
- Visual regression targets are defined.

---

# 172. Implementation Boundary

This document defines the reusable visual system.

The following belong elsewhere:

```text
Cross-product UX rules       → UI_UX_REQUIREMENTS.md
Navigation                   → NAVIGATION_FLOW.md
Screen behavior              → SCREEN_SPECIFICATIONS.md
Authentication               → AUTHENTICATION.md
Member management             → MEMBER_MANAGEMENT.md
Donation system               → DONATION_SYSTEM.md
Payment system                → PAYMENT_SYSTEM.md
Finance system                → FINANCE_SYSTEM.md
Expense system                → EXPENSE_SYSTEM.md
Committee work                → COMMITTEE_WORK_MANAGEMENT.md
Meetings                      → MEETING_MANAGEMENT.md
Attendance                    → ATTENDANCE_SYSTEM.md
Notifications                 → NOTIFICATION_SYSTEM.md
Reporting                     → REPORTING_AND_AUDIT.md
Internationalization          → INTERNATIONALIZATION.md
Security                      → SECURITY_ARCHITECTURE.md
Database                      → DATABASE_SCHEMA.md
Testing                       → TESTING_STRATEGY.md
```

---

# 173. Related Documents

- `PROJECT_OVERVIEW.md`
- `PRODUCT_REQUIREMENTS.md`
- `FEATURE_SCOPE.md`
- `UI_UX_REQUIREMENTS.md`
- `NAVIGATION_FLOW.md`
- `SCREEN_SPECIFICATIONS.md`
- `INTERNATIONALIZATION.md`
- `AUTHENTICATION.md`
- `MEMBER_MANAGEMENT.md`
- `DONATION_SYSTEM.md`
- `PAYMENT_SYSTEM.md`
- `FINANCE_SYSTEM.md`
- `EXPENSE_SYSTEM.md`
- `COMMITTEE_WORK_MANAGEMENT.md`
- `MEETING_MANAGEMENT.md`
- `ATTENDANCE_SYSTEM.md`
- `NOTIFICATION_SYSTEM.md`
- `REPORTING_AND_AUDIT.md`
- `AUDIT_LOG_MODEL.md`
- `SECURITY_ARCHITECTURE.md`
- `DATA_PRIVACY.md`
- `TESTING_STRATEGY.md`

---

## Document Status

**Design System — V1 Implementation Baseline**

This document defines the authoritative reusable visual language for Masjid-e-Mamoor 2.

All UI implementation should use these design-system principles and preserve clarity, accessibility, localization, financial readability, and the product's no-feature-bloat direction.
