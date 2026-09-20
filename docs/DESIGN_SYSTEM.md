# DESIGN SYSTEM

**Project:** Masjid-e-Mamoor  
**Document:** Design System  
**Version:** 1.0  
**Status:** Draft — Architecture/Product Review Required  
**Audience:** Product owner, UX/UI designers, web/mobile engineers, QA, accessibility reviewers, and AI development agents.

---

## 1. Purpose

This document defines the shared visual and interaction system for Masjid-e-Mamoor.

It establishes reusable design rules for:

- visual language
- design tokens
- semantic colors
- typography
- spacing
- layout
- responsive behavior
- components
- financial interfaces
- dashboards
- forms
- navigation
- notifications
- file and proof interfaces
- committee workflows
- attendance workflows
- accessibility
- localization
- Urdu RTL
- web/mobile consistency
- visual testing
- implementation governance

The design system is intended to prevent every feature from inventing its own visual language.

---

## 2. Design-System Objectives

The system MUST:

1. Make the application understandable to first-time users.
2. Keep financial actions visually distinct from ordinary informational actions.
3. Make role boundaries visible without relying on color alone.
4. Provide consistent behavior across all seven roles.
5. Work on desktop, tablet, and mobile layouts.
6. Support English, Hindi, Kannada, and Urdu.
7. Support Urdu right-to-left layouts.
8. Preserve accessibility as a product requirement rather than a finishing step.
9. Provide reusable primitives before domain-specific components.
10. Keep web and mobile interaction patterns conceptually consistent while respecting platform conventions.
11. Avoid unnecessary visual complexity.
12. Make destructive and financially consequential actions deliberate.
13. Provide clear loading, success, error, empty, offline, and permission-denied states.
14. Support realtime updates without making the interface feel unstable.
15. Allow the visual system to evolve through controlled tokens rather than scattered hard-coded values.

---

## 3. Design Principles

### 3.1 Clarity First

Users should understand:

- where they are
- what data they are viewing
- what they can do
- what requires approval
- what has already happened
- what requires attention

### 3.2 Progressive Disclosure

Do not show every implementation detail at once.

Primary information should be visible immediately.

Secondary information may be placed in:

- expandable sections
- drawers
- dialogs
- detail pages
- contextual menus
- secondary tabs

### 3.3 Financial Caution

Financial actions require stronger confirmation and clearer state communication than ordinary actions.

Examples:

- submitting a payment
- verifying a payment
- rejecting a payment
- recording an expense
- transferring funds
- correcting a transaction
- cancelling a financial record

### 3.4 Consistency

The same concept should look and behave the same throughout the product.

For example:

- payment status should use one status vocabulary
- member identity should use one identity pattern
- dates should follow one formatting strategy
- amounts should follow one monetary display strategy
- destructive actions should follow one interaction pattern

### 3.5 Accessibility by Default

Components MUST be designed for:

- keyboard access
- screen readers
- sufficient contrast
- visible focus
- touch interaction
- text scaling
- reduced motion
- localization expansion

### 3.6 Localization-Ready

Text must not be designed around English sentence length.

Layouts must tolerate:

- longer translated labels
- shorter labels
- different word wrapping
- Urdu RTL
- translated validation messages
- localized dates and numbers

---

# 4. Product Visual Direction

The final visual identity should communicate:

- trust
- clarity
- community
- responsibility
- transparency
- calmness
- modern administration

The product should avoid looking like:

- a generic banking clone
- a government portal
- a flashy social-media application
- an overly decorative religious website
- a spreadsheet replacement with no hierarchy

The system should remain professional and operational.

### 4.1 Brand Decisions

The following items remain configurable/open until the product owner approves them:

- final logo
- primary brand color
- secondary brand color
- exact typography family
- decorative Islamic visual motifs
- light/dark theme policy
- final illustration style

No implementation should assume that an unapproved brand asset is final.

---

# 5. Design Token Architecture

All visual values SHOULD originate from tokens.

Tokens should be divided into:

1. global tokens
2. semantic tokens
3. component tokens
4. platform-specific mappings

Example hierarchy:

```text
Global
  ↓
Semantic
  ↓
Component
  ↓
Web / Mobile implementation
```

Do not scatter arbitrary values throughout components.

---

# 6. Color System

## 6.1 Color Layers

The color system should contain:

- brand colors
- neutral colors
- semantic status colors
- financial-state colors
- interaction colors
- surface colors
- border colors
- text colors
- focus colors

## 6.2 Semantic Color Requirement

Components should consume semantic names rather than raw color names.

Preferred:

```text
--color-background
--color-surface
--color-foreground
--color-muted
--color-border
--color-primary
--color-primary-foreground
--color-success
--color-warning
--color-danger
--color-info
```

Avoid:

```text
--green-500
--blue-600
--red-500
```

inside business components.

This allows the palette to evolve without rewriting components.

---

# 7. Neutral Palette

A neutral scale should support:

- application background
- cards
- elevated surfaces
- borders
- disabled elements
- secondary text
- primary text
- inverse surfaces

The palette must be tested for contrast.

Do not choose neutral colors solely by appearance.

---

# 8. Semantic Status Colors

The product should support at least:

| Semantic | Meaning |
|---|---|
| Success | completed or accepted |
| Warning | requires attention or has a caution |
| Danger | destructive, rejected, failed, or risky |
| Info | informational |
| Neutral | inactive, unknown, or not applicable |

Color must never be the only indication.

Each status should also have:

- text
- icon where appropriate
- accessible label
- state wording

Example:

```text
✓ Verified
! Pending verification
× Rejected
```

---

# 9. Financial State Colors

Financial states should be distinguishable without relying solely on color.

Examples:

- outstanding
- submitted
- under review
- verified
- rejected
- partially allocated
- fully allocated
- overpayment
- reversed
- reconciled

Financial state presentation should prioritize explicit labels.

---

# 10. Contrast

All text and interactive controls MUST meet the project's approved accessibility contrast requirements.

Testing must include:

- normal text
- large text
- icons conveying meaning
- borders where required for control identification
- disabled states where applicable
- focus indicators
- status badges

Do not reduce contrast merely to create a lighter visual aesthetic.

---

# 11. Typography

Typography should establish a clear hierarchy.

Recommended semantic roles:

```text
Display
Heading 1
Heading 2
Heading 3
Heading 4
Body
Body Small
Caption
Label
Button
Numeric / Financial
Code / Technical
```

Exact font family remains a configurable product decision.

---

# 12. Typography Rules

## 12.1 Headings

Headings should communicate page hierarchy.

Do not use heading size only as decoration.

## 12.2 Body

Body text must remain readable at common desktop and mobile sizes.

## 12.3 Labels

Form labels must remain visible.

Placeholder text MUST NOT be the only label.

## 12.4 Financial Numbers

Large financial values may use stronger weight and tabular-number presentation where supported.

Example:

```text
₹12,500.00
```

The visual treatment must remain readable when values become large.

---

# 13. Numeric Presentation

Amounts should be displayed consistently.

The product should define:

- currency symbol
- decimal precision
- thousands grouping
- negative amount presentation
- zero presentation
- pending amount presentation
- localized number rules

The canonical monetary value remains server-authoritative.

UI formatting must never alter the underlying value.

---

# 14. Spacing System

Use a consistent spacing scale.

Example conceptual scale:

```text
xs
sm
md
lg
xl
2xl
3xl
4xl
```

Components should use spacing tokens rather than arbitrary pixel values.

Spacing should establish:

- grouping
- hierarchy
- density
- touch safety
- readability

---

# 15. Layout Grid

The web application should use a responsive layout system supporting:

- navigation region
- main content
- optional secondary panel

Typical structure:

```text
┌───────────────┬──────────────────────────────┐
│ Navigation    │ Header                       │
│               ├──────────────────────────────┤
│               │ Main Content                  │
│               │                              │
└───────────────┴──────────────────────────────┘
```

Mobile should collapse navigation into a platform-appropriate pattern.

---

# 16. Responsive Breakpoints

Breakpoints must be treated as layout transitions, not device names.

The exact breakpoint values should be centralized.

The design must support:

- small mobile
- large mobile
- tablet
- laptop
- desktop
- wide desktop

Do not assume a specific physical device.

---

# 17. Containers

Pages should use a consistent content container strategy.

A page should not arbitrarily change its maximum width between similar screens.

Wide data-heavy pages may use larger containers than focused forms.

---

# 18. Cards

Cards are appropriate for:

- dashboard summaries
- member summaries
- financial summaries
- tasks
- meetings
- notifications
- compact records

Cards should not be used merely because they look attractive.

Avoid excessive nested cards.

---

# 19. Buttons

Button hierarchy:

1. primary
2. secondary
3. outline
4. ghost
5. destructive
6. link-style

Buttons must communicate action importance.

Examples:

```text
Primary:
Verify Payment

Secondary:
View Details

Destructive:
Reject Payment
```

---

# 20. Button States

Every interactive button should define:

- default
- hover
- focus
- pressed
- disabled
- loading
- success where useful

Loading buttons should prevent accidental duplicate submissions.

Example:

```text
Verify Payment
      ↓
Verifying…
```

---

# 21. Iconography

Icons should be:

- consistent
- recognizable
- accessible
- used with text when meaning is ambiguous

Do not use icons as unexplained decoration for critical actions.

Icon-only buttons MUST provide accessible names.

---

# 22. Form Controls

Shared controls include:

- text input
- phone input
- OTP input
- textarea
- select
- combobox
- checkbox
- radio group
- switch
- date picker
- time picker
- amount input
- file upload
- search
- filter
- pagination

All controls require consistent:

- label
- helper text
- validation
- error
- disabled
- loading behavior

---

# 23. Form Layout

Forms should:

1. group related fields
2. use visible labels
3. show validation near the relevant field
4. preserve entered values when possible
5. identify required fields
6. provide meaningful submit labels
7. prevent accidental duplicate submission

Long forms should use logical sections.

---

# 24. Amount Input

Financial amount inputs require special handling.

Requirements:

- numeric keyboard on mobile
- currency context
- validation
- decimal rules
- no silent rounding
- clear invalid-value messages
- formatted display after submission
- server-side validation

Example:

```text
Amount
₹ [ 1,500.00 ]
```

---

# 25. OTP Input

OTP UI must:

- expose the purpose
- support paste where appropriate
- handle resend cooldown
- show verification state
- avoid revealing sensitive information
- provide accessible labels
- handle expired OTPs clearly

---

# 26. Search

Search controls should provide:

- clear label
- search icon where useful
- loading state
- no-results state
- clear action
- keyboard support
- debouncing where appropriate

Search results must respect authorization.

---

# 27. Tables

Tables are appropriate for:

- financial transactions
- member administration
- payment review
- audit records
- reports

Tables must support:

- responsive behavior
- sorting where approved
- filtering
- pagination
- loading
- empty state
- error state
- accessible headers

Mobile may use cards or horizontally scrollable tables depending on information density.

---

# 28. Status Badges

Status badges should be:

- concise
- explicit
- consistently styled
- accessible

Examples:

```text
Pending
Verified
Rejected
Cancelled
Offline
Synced
```

Never rely only on badge color.

---

# 29. Alerts

Alerts communicate important information.

Types:

- informational
- success
- warning
- error

Alerts should explain:

1. what happened
2. what it means
3. what the user can do next, when applicable

---

# 30. Toasts

Toasts are appropriate for short-lived confirmations.

Use for:

- saved
- copied
- submitted
- synced

Do not use to communicate critical information that disappears before the user can understand it.

Critical errors should remain visible.

---

# 31. Dialogs

Dialogs are appropriate for:

- confirmation
- focused forms
- short decisions
- destructive actions

Dialogs should not contain an entire complex workflow unless necessary.

Destructive dialogs must explain consequences.

---

# 32. Drawers and Sheets

Drawers/sheets are useful for:

- secondary details
- filters
- quick review
- mobile-friendly actions

They must preserve keyboard and screen-reader behavior.

---

# 33. Tabs

Tabs should represent related views within one conceptual context.

Do not use tabs as a replacement for navigation.

Tabs should preserve state appropriately.

---

# 34. Navigation

Navigation must reflect the user's authorized capabilities.

The seven roles do not require seven separate applications.

Instead:

```text
One deployment
    ↓
Authenticated user
    ↓
Resolved role/permissions
    ↓
Role-aware navigation
    ↓
Authorized domain screens
```

---

# 35. President / Super Admin Navigation

Possible areas:

- Dashboard
- Members
- Referrals
- Donations
- Finance
- Committee
- Attendance
- Notifications
- Reports
- Audit
- Administration

Exact menu availability remains governed by the permission matrix.

---

# 36. Vice President Navigation

Navigation should expose only authorized operational areas.

It should not imply unrestricted administrative access.

---

# 37. Secretary Navigation

Primary focus:

- members
- referrals
- committee operations
- meetings
- tasks
- attendance where authorized
- notifications
- relevant reports

---

# 38. Finance Navigation

Primary focus:

- finance dashboard
- payment review
- donations
- accounts
- transactions
- transfers
- expenses
- corrections
- reconciliation
- reports

---

# 39. Auditor Navigation

Primary focus:

- financial review
- audit records
- reports
- transaction history
- verification evidence

Write operations should remain permission-controlled.

---

# 40. Committee Member Navigation

Primary focus:

- tasks
- meetings
- attendance
- assigned operational information

---

# 41. Member Navigation

Primary focus:

- profile
- donation status
- payments
- payment history
- notifications
- referral information where authorized

Members must not see other members' private financial information.

---

# 42. Dashboard Design

Dashboards should answer:

- What needs attention?
- What changed?
- What is pending?
- What is completed?
- What requires action?

Avoid dashboard decoration without operational value.

---

# 43. Dashboard Cards

Examples:

- outstanding obligations
- pending payment verification
- pending tasks
- upcoming meeting
- recent transactions
- notification count
- attendance summary

Every metric should have a clear source and meaning.

---

# 44. Financial Dashboard

Financial dashboard components should include:

- account balances
- pending verification
- verified payments
- outstanding obligations
- recent expenses
- transfers
- reconciliation indicators

Financial metrics must clearly distinguish:

- submitted
- verified
- allocated
- outstanding
- reversed

---

# 45. Member Dashboard

A member should be able to understand:

- current obligation
- outstanding amount
- recent payments
- allocation history
- payment status
- notifications

The interface should not expose internal finance-only terminology unless needed.

---

# 46. Payment Review Component

Payment review should show:

```text
Member
Payment amount
Submission date
Payment method
Reference
Proof
Allocation preview
Current status
Reviewer action
```

Actions should be explicit.

---

# 47. FIFO Allocation Presentation

When a payment is allocated across obligations, show a breakdown.

Example:

```text
Payment
₹3,000

Allocation
January   ₹1,000
February  ₹1,000
March     ₹1,000
```

If partial allocation occurs:

```text
March obligation
₹1,000 required
₹500 allocated
₹500 outstanding
```

---

# 48. Combined Payment Presentation

Combined payments must clearly distinguish:

- submitted total
- individual payment components
- allocation
- remaining amount
- resulting status

The UI should not imply success until the authoritative operation succeeds.

---

# 49. Overpayment Presentation

Overpayment must be explicit.

Example:

```text
Required:      ₹1,000
Payment:       ₹1,200
Allocated:     ₹1,000
Remaining:       ₹200
```

The UI should clearly state how the remaining amount is treated according to approved business rules.

---

# 50. Expense Component

Expense entry should expose:

- amount
- account
- date
- category
- description
- proof/document
- status
- creator
- approval/review state where applicable

Financially consequential actions require confirmation.

---

# 51. Account Balance Component

Balances should include context.

Example:

```text
Masjid General Account

Available balance
₹125,000

Last updated
2 minutes ago
```

Where the value is derived or delayed, show appropriate freshness information.

---

# 52. Transaction Component

Transactions should distinguish:

- transaction type
- amount
- account
- date/time
- reference
- status
- source
- actor
- correction/reversal state

---

# 53. File Upload

File upload components should show:

- accepted formats
- size limit
- selected filename
- upload progress
- success
- failure
- retry
- remove/cancel where authorized

Sensitive financial documents must not be publicly exposed.

---

# 54. Payment Proof Viewer

Proof viewer should support:

- secure access
- image preview
- PDF viewing where supported
- download where authorized
- metadata
- review status

Avoid exposing private storage paths.

---

# 55. Notification Center

Notification center should provide:

- unread count
- notification list
- timestamp
- category
- read/unread state
- deep-link action where safe
- empty state

Notifications must respect role and privacy.

---

# 56. Committee Task UI

Task cards should expose:

- task title
- assignee
- status
- due date
- priority where approved
- comments/remarks
- last update

Do not overload task cards with unnecessary metadata.

---

# 57. Meeting UI

Meeting screens should expose:

- title
- date/time
- location
- agenda
- participants
- attendance
- notes
- status

---

# 58. Attendance UI

Attendance should clearly distinguish:

- present
- absent
- pending sync
- synced
- rejected
- duplicate/already applied

Offline attendance should visibly communicate local versus server state.

---

# 59. Offline Indicators

The application should provide a subtle but clear connectivity state.

Examples:

```text
Online
Offline — changes will sync when connected
Syncing…
Synced
Sync failed
```

Do not falsely indicate server persistence while offline.

---

# 60. Realtime Indicators

Realtime updates should not create visual noise.

Use subtle updates for:

- payment status
- dashboard metrics
- notifications
- task changes
- finance review queues

If a value changes while the user is viewing it, preserve user context.

---

# 61. Optimistic UI

Optimistic updates should be used only where rollback is safe and semantics are clear.

Do not optimistically claim final financial verification.

For financial commands:

```text
Submitting…
```

until the authoritative result is known.

---

# 62. Loading States

Use:

- skeletons for page/data regions
- spinners for focused actions
- progress indicators for uploads
- explicit synchronization states

Avoid blank screens during loading.

---

# 63. Empty States

An empty state should explain:

1. what is empty
2. why it may be empty
3. what action is available, if any

Example:

```text
No pending payment reviews

New payment submissions will appear here.
```

---

# 64. Error States

Errors should be actionable.

Prefer:

```text
Payment could not be submitted.
Check your connection and try again.
```

over:

```text
Error 500
```

Technical details may be available through support/debug channels.

---

# 65. Permission-Denied States

A permission-denied screen should not reveal sensitive data.

Example:

```text
You do not have permission to access this page.
```

Do not reveal which hidden records exist.

---

# 66. Destructive Actions

Destructive actions include:

- reject
- cancel
- reverse
- deactivate
- delete where allowed
- correct

Confirmation should communicate consequences.

For financial operations, confirmation should include relevant amount and record context.

---

# 67. Confirmation Pattern

A strong confirmation pattern:

```text
Confirm payment verification

Member: Example Member
Amount: ₹2,000
Reference: XXXX1234

This will mark the submitted payment as verified
and apply the approved allocation.

[Cancel] [Verify Payment]
```

The final action label should describe the action.

---

# 68. Data Density

Financial and administrative screens may require higher information density than member-facing screens.

Density must remain readable.

Provide:

- consistent row height
- clear columns
- whitespace grouping
- truncation with accessible full values
- responsive alternatives

---

# 69. Mobile Navigation

Mobile navigation should prioritize:

- dashboard/home
- primary workflow
- notifications
- profile
- role-specific high-frequency actions

Secondary features can be placed in a menu.

---

# 70. Mobile Touch Targets

Interactive targets should be large enough for comfortable touch interaction.

Avoid closely packed destructive and primary actions.

---

# 71. Mobile Forms

Mobile forms should:

- use appropriate keyboards
- minimize typing
- preserve drafts where appropriate
- use full-width controls
- avoid tiny dropdowns
- provide clear keyboard dismissal behavior

---

# 72. Web Navigation

Desktop navigation may use:

- persistent sidebar
- top header
- breadcrumbs
- contextual page actions

Navigation should remain stable between pages.

---

# 73. Breadcrumbs

Breadcrumbs help with deep administrative workflows.

Example:

```text
Finance
  / Payments
  / Payment Review
  / Payment #123
```

Do not use breadcrumbs on simple mobile screens when they create clutter.

---

# 74. Page Header

Every major page should have:

- title
- concise description where useful
- primary action where applicable
- secondary actions
- contextual status where appropriate

---

# 75. Data Filters

Filters should clearly indicate active state.

Example:

```text
Status: Pending
Month: March 2026
Account: General
```

Provide a clear-all mechanism.

---

# 76. Pagination

Pagination must be consistent.

Where appropriate, show:

- current range
- total or approximate total
- next/previous
- page size

Pagination must not bypass authorization.

---

# 77. Date and Time

The UI must establish a consistent timezone strategy.

Display should be understandable to users.

Financial records should distinguish:

- event time
- submission time
- verification time
- correction/reversal time

---

# 78. Localization

The design system supports:

- English
- Hindi
- Kannada
- Urdu

Text must come from translation resources.

No business-critical UI text should be hard-coded inside components.

---

# 79. Urdu RTL

Urdu must support:

- RTL page direction
- mirrored navigation where appropriate
- correct text alignment
- correct icon placement
- bidirectional numeric handling
- logical CSS properties
- localized forms

Do not simply reverse the entire interface without checking component semantics.

---

# 80. RTL Implementation Principles

Prefer logical properties such as:

```css
margin-inline-start
margin-inline-end
padding-inline
inset-inline-start
inset-inline-end
text-align: start
```

Avoid hard-coded left/right assumptions where possible.

---

# 81. Mixed-Direction Content

The application may contain:

- Urdu text
- English identifiers
- phone numbers
- transaction references
- URLs
- account numbers

These require controlled bidirectional rendering.

---

# 82. Language Switching

Language switching should:

- preserve user state
- preserve current route where possible
- not silently discard form data
- update layout direction for Urdu
- persist approved preference

---

# 83. Accessibility

Accessibility is part of the design system.

Every component must define:

- keyboard behavior
- focus behavior
- accessible name
- state announcement
- error handling
- contrast expectations
- reduced-motion behavior where applicable

---

# 84. Focus States

Focus must always be visible.

Do not remove browser focus indicators without providing an equally clear replacement.

---

# 85. Keyboard Navigation

Desktop workflows must support:

- Tab
- Shift+Tab
- Enter
- Space
- Escape
- arrow navigation where appropriate

Dialog focus must be trapped correctly.

---

# 86. Screen Readers

Use semantic HTML and accessible component primitives.

Important state changes should be announced where appropriate.

Do not depend on visual position alone to convey meaning.

---

# 87. Reduced Motion

Animations should respect reduced-motion preferences.

Motion should communicate:

- transition
- state change
- progress

It should not become decoration that interferes with operation.

---

# 88. Motion System

Motion should be:

- short
- predictable
- purposeful

Examples:

- drawer opening
- toast entering
- row update
- modal transition
- loading progress

Financial actions should not use playful animation.

---

# 89. Elevation

Elevation should be used to establish hierarchy.

Recommended conceptual levels:

```text
Level 0 — flat
Level 1 — card
Level 2 — dropdown
Level 3 — dialog
Level 4 — critical overlay
```

Do not stack excessive shadows.

---

# 90. Borders and Dividers

Borders should support grouping without creating visual noise.

Use semantic border tokens.

Tables and cards should share consistent divider rules.

---

# 91. Radius

Corner radius should be centralized.

Use a small set of radii rather than arbitrary values.

Example concepts:

```text
sm
md
lg
pill
```

---

# 92. Component Anatomy

Every reusable component should document:

- purpose
- props/API
- variants
- states
- accessibility
- responsive behavior
- localization considerations
- data requirements
- error behavior

---

# 93. Primitive Components

Recommended primitives:

- Button
- IconButton
- Input
- Label
- Textarea
- Select
- Combobox
- Checkbox
- Radio
- Switch
- Dialog
- Drawer
- Sheet
- Tabs
- Tooltip
- Popover
- Dropdown
- Alert
- Toast
- Badge
- Card
- Skeleton
- Spinner
- Progress
- Separator

---

# 94. Domain Components

Recommended domain components:

- MemberSummary
- MemberStatus
- ReferralSummary
- DonationObligation
- PaymentSummary
- PaymentReview
- PaymentProofViewer
- AllocationBreakdown
- OutstandingSummary
- CombinedPaymentSummary
- FinanceAccountCard
- TransactionRow
- ExpenseSummary
- TransferSummary
- AuditTimeline
- TaskCard
- MeetingCard
- AttendanceStatus
- SyncStatus
- NotificationItem

---

# 95. Financial Safety Components

Financial components should not be generic text blocks.

They should provide standardized:

- amount formatting
- status
- record identity
- actor
- timestamp
- proof
- confirmation
- error behavior

---

# 96. Audit Timeline

Audit history should visually distinguish:

- event
- actor
- timestamp
- action
- previous state where authorized
- new state where authorized

Do not make audit records editable through ordinary UI.

---

# 97. Role Context

The interface may display the user's current role.

Example:

```text
Finance
Mohammed Shabaz
```

However, role display is informational.

Actual authorization must come from backend-controlled permissions.

---

# 98. Role Switching

If the product later supports users with multiple roles, role switching must:

- re-resolve permissions
- update navigation
- invalidate role-sensitive queries
- prevent stale privileged UI
- preserve secure server authorization

If users are limited to one effective role, do not implement artificial role switching.

---

# 99. Security UX

The UI must never imply that hiding a button provides security.

Examples:

- hidden Finance action ≠ authorization
- hidden Admin page ≠ authorization
- disabled button ≠ authorization

Backend authorization remains authoritative.

---

# 100. Sensitive Data

Sensitive values should be displayed only when authorized.

Examples:

- payment proof
- member phone number
- financial records
- audit information
- internal notes

Avoid unnecessary duplication of sensitive data.

---

# 101. Copy and Microcopy

Microcopy should be:

- concise
- respectful
- neutral
- actionable
- understandable

Avoid blame.

Prefer:

```text
Payment verification failed.
Please review the reference and proof.
```

instead of:

```text
You entered incorrect information.
```

---

# 102. Confirmation Copy

Confirmation copy must describe consequences.

Avoid vague:

```text
Are you sure?
```

Prefer:

```text
Reject this payment submission?
The member will need to submit a new payment.
```

---

# 103. Error Copy

Errors should distinguish:

- user validation
- permission
- connectivity
- server failure
- conflict
- already processed
- synchronization failure

---

# 104. Realtime Update Copy

Avoid interrupting the user unnecessarily.

For important changes:

```text
Payment status updated.
Refresh details
```

or update the authorized view directly when safe.

---

# 105. Design Tokens in Code

Tokens should be represented centrally.

Conceptual structure:

```text
packages/
  config/
    design-tokens/
```

or an equivalent approved structure.

The exact location may change during implementation.

---

# 106. CSS Variable Strategy

Semantic CSS variables are preferred.

Example:

```css
:root {
  --background: ...;
  --foreground: ...;
  --surface: ...;
  --primary: ...;
  --success: ...;
  --warning: ...;
  --danger: ...;
  --border: ...;
  --focus: ...;
}
```

Component styles consume semantic variables.

---

# 107. Tailwind Integration

Tailwind utilities should map to the approved token system.

Avoid bypassing the design system with arbitrary values.

If an arbitrary value is genuinely required, document why.

---

# 108. shadcn/ui-Style Architecture

The web component system may follow a shadcn/ui-style approach:

- accessible primitives
- local component ownership
- composable components
- controlled styling
- token-based theming

The project must not blindly copy generated components without reviewing:

- accessibility
- dependencies
- styling
- API design
- project conventions

---

# 109. Mobile Design-System Mapping

Mobile components should implement the same semantic concepts while respecting React Native conventions.

For example:

```text
Web Button
    ↕
Mobile Pressable Action
```

The interaction should be equivalent even if the visual implementation differs.

---

# 110. Shared Design Language

Web and mobile should share:

- terminology
- status vocabulary
- color semantics
- spacing concepts
- component intent
- icon meanings
- financial presentation
- error language

---

# 111. Web-Specific Patterns

Web can support:

- dense tables
- persistent sidebar
- keyboard-heavy workflows
- hover states
- desktop shortcuts
- multi-column forms

---

# 112. Mobile-Specific Patterns

Mobile can support:

- bottom navigation
- sheets
- full-screen forms
- swipe where appropriate
- native keyboard behavior
- camera/file integrations

---

# 113. Dashboard Charts

Charts should be used only where they improve understanding.

Charts require:

- accessible alternative
- explicit labels
- clear units
- appropriate aggregation
- no misleading axes
- responsive behavior

Financial reports should provide tabular data where necessary.

---

# 114. Data Visualization

Avoid using multiple colors merely for decoration.

Use semantic colors consistently.

Charts must remain understandable for users with color-vision differences.

---

# 115. Financial Report Visualization

Possible visualizations:

- monthly collection
- outstanding trend
- expense distribution
- account movement

Every chart must have:

- period
- unit
- data source
- explanation where needed

---

# 116. Print and Export

Report pages may require print-friendly layouts.

Print styles should:

- hide navigation
- preserve essential data
- maintain readable typography
- include report metadata
- avoid inaccessible colors

---

# 117. Export UI

Export controls should explain:

- format
- scope
- filters
- authorization
- generated state

Large exports may become asynchronous jobs.

---

# 118. Component Testing

Every reusable component should have tests for:

- rendering
- variants
- interaction
- accessibility
- error state
- loading state
- localization where relevant

---

# 119. Visual Regression Testing

Visual regression should cover high-value screens:

- login
- dashboard
- payment review
- finance dashboard
- member profile
- donation flow
- committee task screen
- attendance
- notifications
- RTL screens

---

# 120. Accessibility Testing

Testing should include:

- keyboard-only navigation
- screen reader checks
- automated accessibility scans
- focus behavior
- contrast
- zoom/text scaling
- RTL
- localization

---

# 121. Responsive Testing

Test at representative viewport sizes rather than assuming a single device.

Required categories:

- small mobile
- large mobile
- tablet
- laptop
- desktop
- wide desktop

---

# 122. State Matrix

Every important screen should be reviewed in:

```text
Loading
Loaded
Empty
Error
Unauthorized
Offline
Syncing
Stale
Success
```

Domain-specific states should be added where needed.

---

# 123. Financial State Matrix

Payment-related screens should consider:

```text
Draft
Submitted
Pending
Verified
Rejected
Partially Allocated
Fully Allocated
Overpayment
Reversed
Cancelled
Already Processed
Conflict
Offline Restricted
```

---

# 124. Realtime State Matrix

Realtime-aware screens should consider:

```text
Connected
Connecting
Disconnected
Reconnected
Event Received
Duplicate Event
Stale Event
Missed Event
Query Refreshed
```

---

# 125. Offline State Matrix

Offline workflows should consider:

```text
Online
Offline
Queued
Syncing
Synced
Rejected
Conflict
Retrying
Failed
```

---

# 126. Form State Matrix

Forms should support:

```text
Initial
Dirty
Valid
Invalid
Submitting
Success
Server Error
Conflict
Offline
```

---

# 127. Empty-State Standards

Empty states should never look like application failures.

They should distinguish:

- genuinely empty
- filtered empty
- unauthorized
- failed-to-load

---

# 128. Skeleton Standards

Skeletons should resemble the eventual content structure.

Do not display a generic full-screen spinner when the page structure is already known.

---

# 129. Error Recovery

Where possible, provide:

- retry
- refresh
- return
- edit
- reconnect
- contact support/admin

Do not provide an action that the user is not authorized to perform.

---

# 130. Permission-Aware UI

UI permissions should be derived from the application's authorization model.

Example:

```text
can("finance.payment.verify")
```

should be conceptually preferable to:

```text
if role === "finance"
```

This allows permission changes without rewriting every component.

---

# 131. Role Labels

Role labels should use the approved vocabulary exactly:

- President / Super Admin
- Vice President
- Secretary
- Finance
- Auditor
- Committee Member
- Member

Translations should map from stable internal identifiers.

---

# 132. Terminology Governance

Domain terms must be documented centrally.

Examples:

- obligation
- payment submission
- verified payment
- allocation
- outstanding
- overpayment
- additional donation
- anonymous donation
- Jummah cash
- transfer
- correction
- reversal

Do not create competing synonyms casually.

---

# 133. Date Terminology

Use explicit terms:

- payment date
- submission date
- verification date
- allocation date
- transaction date

Avoid vague labels such as:

```text
Date
```

on complex financial screens.

---

# 134. Status Terminology

Status labels should map directly to domain states.

Do not create UI-only status names that cannot be mapped to authoritative backend states.

---

# 135. Notifications Terminology

Notifications should describe events, not internal database operations.

Prefer:

```text
Your payment was verified.
```

over:

```text
payment_submission.status changed.
```

---

# 136. Accessibility of Financial Numbers

Screen-reader output should communicate:

- currency
- amount
- sign
- status
- context

A visually formatted number must remain semantically understandable.

---

# 137. Accessibility of Tables

Tables require:

- proper header associations
- caption/context where useful
- keyboard access for interactive cells
- responsive alternative
- readable row actions

---

# 138. Accessibility of Dialogs

Dialogs require:

- accessible title
- description when needed
- focus management
- Escape behavior where appropriate
- focus return
- no background interaction

---

# 139. Accessibility of Toasts

Important state changes should have an accessible announcement strategy.

Critical errors must not disappear without a persistent alternative.

---

# 140. Accessibility of Status

Status badges should expose text.

Icons should supplement status rather than replace it.

---

# 141. Dark Mode

Dark mode remains an open product decision unless explicitly approved.

If implemented, it must use semantic tokens.

Do not create an independent palette disconnected from the light theme.

---

# 142. Theme Switching

If multiple themes are supported:

- persist preference
- avoid flash during load
- ensure contrast
- test all states
- support system preference if approved

---

# 143. Brand Assets

Brand assets should be centralized.

Examples:

```text
logo
favicon
app icon
illustrations
empty-state artwork
```

Do not duplicate assets across applications.

---

# 144. Icon Library

Use one approved icon library or a controlled internal set.

Do not mix unrelated icon styles.

---

# 145. Illustrations

Illustrations should be used sparingly.

Operational screens should prioritize information over decoration.

---

# 146. Islamic Visual Motifs

If decorative motifs are approved, they should remain subtle and not interfere with:

- readability
- accessibility
- financial clarity
- operational workflows

The exact motif language remains an open brand decision.

---

# 147. Privacy-Aware Visual Design

When showing sensitive information:

- avoid unnecessary full identifiers
- mask where appropriate
- minimize visible private information
- use secure access controls
- avoid screenshots/exports revealing unrelated records

---

# 148. Audit UI

Audit information should be visually separate from ordinary user activity.

Audit screens should communicate that records are historical and controlled.

---

# 149. Administrative UI

Administrative interfaces may be information-dense but should preserve:

- hierarchy
- search
- filtering
- clear actions
- safe destructive workflows

---

# 150. Member-Facing UI

Member-facing UI should prioritize:

- simple language
- current status
- actionable next step
- payment clarity
- privacy
- mobile usability

---

# 151. Finance-Facing UI

Finance-facing UI should prioritize:

- accuracy
- traceability
- reconciliation
- evidence
- transaction context
- safe actions

---

# 152. Auditor-Facing UI

Auditor UI should prioritize:

- historical context
- immutable audit evidence
- financial traceability
- filtering
- report/export controls where authorized

---

# 153. Secretary-Facing UI

Secretary UI should prioritize:

- member administration
- referrals
- meetings
- tasks
- attendance
- communication

---

# 154. Committee UI

Committee UI should prioritize:

- assignments
- meetings
- attendance
- operational updates

---

# 155. President UI

President UI should provide a high-level operational view without bypassing separation-of-duties rules.

The interface must not turn the President role into an automatic override of all financial controls.

---

# 156. Role-Based Dashboard Content

Dashboard content should be permission-aware.

Do not load sensitive datasets merely because the user cannot see them.

Authorization should be enforced at data access boundaries.

---

# 157. Navigation Loading

Navigation should not briefly expose unauthorized items while permissions resolve.

Use a secure loading state.

---

# 158. Route Loading

Protected routes should resolve authorization before sensitive content is rendered.

---

# 159. Cached Data

Cached data must not remain visible after:

- logout
- account deactivation
- role removal
- permission reduction

Sensitive query caches should be invalidated appropriately.

---

# 160. Design-System Governance

Changes to the design system should be reviewed before being used widely.

A token or primitive change can affect many screens.

---

# 161. Breaking Changes

Breaking design-system changes require:

- documented reason
- impacted components
- migration plan
- visual review
- accessibility review

---

# 162. Component Ownership

Each component should have one implementation owner at a time.

AI tools may review or propose alternatives, but the repository remains the source of truth.

---

# 163. Multi-AI Design Workflow

AI tools may be used for:

- visual exploration
- component suggestions
- accessibility review
- copy review
- responsive review
- implementation review

No AI-generated component is considered complete until:

1. requirements are checked
2. design tokens are checked
3. accessibility is checked
4. responsive behavior is checked
5. tests pass
6. human/project-owner review is complete

---

# 164. Design Review Checklist

Before accepting a screen:

- Is the hierarchy clear?
- Are primary actions obvious?
- Are destructive actions distinct?
- Are statuses explicit?
- Are loading/empty/error states defined?
- Is authorization respected?
- Is sensitive data minimized?
- Does mobile work?
- Does RTL work?
- Does localization fit?
- Is keyboard navigation supported?
- Are focus states visible?
- Are financial values unambiguous?

---

# 165. Implementation Order

Recommended design-system implementation order:

1. token foundation
2. typography
3. color semantics
4. spacing
5. buttons
6. inputs
7. forms
8. feedback components
9. navigation
10. cards and data display
11. tables
12. dialogs/sheets
13. financial primitives
14. domain components
15. dashboard components
16. notification components
17. offline/realtime indicators
18. accessibility hardening
19. localization
20. RTL
21. visual regression coverage

---

# 166. Definition of Done for Design-System Components

A component is not complete until:

- API is documented
- tokens are used
- states are implemented
- responsive behavior is verified
- keyboard behavior is verified
- accessibility is reviewed
- localization is considered
- RTL is considered where relevant
- tests exist at the appropriate level
- no unauthorized data is exposed
- visual consistency is verified

---

# 167. Design-System Acceptance Criteria

The design system is accepted when:

1. Core screens use shared primitives.
2. No uncontrolled color/spacing system exists.
3. Financial components share consistent semantics.
4. All seven roles have coherent navigation patterns.
5. Mobile and web share terminology and state semantics.
6. English/Hindi/Kannada/Urdu are supported architecturally.
7. Urdu RTL is explicitly tested.
8. Accessibility is included in component acceptance.
9. Loading/error/empty/offline states are standardized.
10. Visual regression coverage exists for critical workflows.
11. Design tokens can be changed centrally.
12. AI-generated UI cannot bypass the design system without documented review.

---

# 168. Open Design Decisions

The following remain explicitly open until approved:

- final brand palette
- final typography
- final logo
- dark mode
- illustration strategy
- Islamic motif usage
- exact responsive breakpoints
- exact token values
- chart library
- icon library
- final component package structure
- final mobile navigation arrangement
- print/export visual standards

Open decisions must not be silently converted into permanent implementation decisions.

---

# 169. Final Design-System Rule

The design system is not a visual decoration layer.

It is the shared interaction contract between:

- users
- business workflows
- web
- mobile
- authorization
- financial safety
- realtime updates
- offline behavior
- accessibility
- localization

A feature is visually complete only when its states, permissions, errors, financial consequences, responsive behavior, localization, and accessibility are also represented.

---

# 170. Document Status

**Status:** Draft — Review Required

**Next actions:**

1. Review against `UI_UX_SPEC.md`.
2. Review against `ROLE_PERMISSION_MATRIX.md`.
3. Review financial interaction requirements against `DONATION_FINANCE_SPEC.md`.
4. Review accessibility requirements against `RLS_SECURITY_MODEL.md` and product requirements.
5. Approve open design decisions.
6. Convert approved tokens into implementation configuration.
7. Build primitives before domain-specific screens.
