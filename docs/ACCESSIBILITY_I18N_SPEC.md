# ACCESSIBILITY AND INTERNATIONALIZATION SPECIFICATION

**Project:** Masjid-e-Mamoor  
**Document:** Accessibility & Internationalization Specification  
**Version:** 1.0  
**Status:** Draft — Review Required  
**Audience:** Product owner, UX/UI, web engineers, mobile engineers, QA, accessibility reviewers, localization reviewers, and AI development agents.

---

# 1. Purpose

This document defines the accessibility, internationalization, localization, bidirectional-language, and inclusive interaction requirements for Masjid-e-Mamoor.

It establishes requirements for:

- accessibility
- keyboard interaction
- screen readers
- focus management
- color and contrast
- text scaling
- reduced motion
- localization
- translation architecture
- English
- Hindi
- Kannada
- Urdu
- right-to-left behavior
- mixed-direction content
- dates and times
- numbers and currency
- forms
- errors
- notifications
- financial interfaces
- web
- mobile
- testing
- governance

Accessibility and internationalization are product requirements, not post-development polish.

---

# 2. Scope

This specification applies to:

- public registration
- authentication
- referral registration
- member management
- donation workflows
- payment submission
- UPI payment flow
- payment proof upload
- finance verification
- finance administration
- committee tasks
- meetings
- attendance
- notifications
- reports
- dashboards
- audit views
- settings
- profile
- offline workflows
- realtime interfaces
- web application
- mobile application

It applies to every supported role:

1. President / Super Admin
2. Vice President
3. Secretary
4. Finance
5. Auditor
6. Committee Member
7. Member

---

# 3. Core Principles

## 3.1 Accessibility Is a Requirement

A feature is incomplete if an otherwise functional workflow cannot reasonably be used because of:

- inaccessible controls
- missing labels
- poor focus handling
- insufficient contrast
- unusable keyboard navigation
- unreadable text
- inaccessible error messages
- inaccessible status communication

---

## 3.2 Localization Is an Architectural Concern

Localization must be designed before large-scale UI implementation.

The application must not depend on:

- English-only text lengths
- English word order
- left-to-right-only assumptions
- fixed-width labels
- hard-coded date formats
- hard-coded number formatting
- hard-coded plural wording

---

## 3.3 Accessibility and Localization Interact

A layout that works in English may fail in Urdu or Kannada.

A visually compact component may become inaccessible after translation.

Therefore accessibility testing must include localized interfaces.

---

# 4. Supported Languages

The product is designed for:

| Language | Direction |
|---|---|
| English | LTR |
| Hindi | LTR |
| Kannada | LTR |
| Urdu | RTL |

These language identifiers should have stable internal codes.

Recommended conceptual identifiers:

```text
en
hi
kn
ur
```

The final implementation may use a framework-specific locale naming convention if documented.

---

# 5. Default Language

The default language remains a product decision.

The application should support:

1. device/browser preference detection where appropriate
2. explicit user selection
3. persisted user preference
4. safe fallback when a translation is unavailable

The fallback behavior must never produce a broken interface.

---

# 6. Translation Architecture

All user-facing text should come from localization resources.

Examples:

```text
common
auth
members
referrals
donations
payments
finance
committee
attendance
notifications
reports
errors
validation
settings
```

Do not place business-critical UI text directly inside components.

---

# 7. Translation Keys

Translation keys should describe semantic meaning rather than visual position.

Prefer:

```text
payment.verify.success
```

instead of:

```text
button3.text
```

Keys should remain stable when wording changes.

---

# 8. Translation Resource Structure

A conceptual structure:

```text
locales/
  en/
  hi/
  kn/
  ur/
```

Within each language:

```text
common
auth
members
donations
finance
committee
attendance
notifications
reports
errors
validation
```

The exact repository location is an implementation decision.

---

# 9. Translation Ownership

Translations should have clear ownership.

AI-generated translations must be reviewed before becoming authoritative product copy.

For religious, financial, administrative, and legal terminology, translation review should be performed by an appropriate human reviewer.

---

# 10. Translation Completeness

The build/review process should detect missing translations.

A missing translation must not silently become:

- a blank label
- an internal key
- `undefined`
- broken markup

Fallback behavior should be explicit.

---

# 11. Translation Fallback

Recommended conceptual fallback:

```text
Requested locale
    ↓
requested translation
    ↓
fallback locale
    ↓
safe visible fallback
```

The exact fallback locale is an open product decision.

---

# 12. Translation Interpolation

Dynamic values should use structured interpolation.

Example:

```text
Payment of {amount} was verified.
```

Do not construct localized sentences by concatenating translated fragments.

Bad:

```text
"Payment " + status + " for " + member
```

This assumes English grammar.

---

# 13. Pluralization

Pluralization must use locale-aware rules.

Do not assume English pluralization applies to every language.

Examples requiring localization-aware handling:

- number of payments
- number of tasks
- number of members
- number of notifications
- number of months

---

# 14. Gender and Grammatical Variation

Where a language requires grammatical information that English does not, translation resources should support appropriate variants.

Do not force English sentence structure onto Hindi, Kannada, or Urdu.

---

# 15. Text Expansion

Components must tolerate longer translations.

Potential expansion areas:

- buttons
- tabs
- table columns
- badges
- navigation
- validation messages
- dialogs
- notification titles
- dashboard cards

Text must wrap or adapt rather than being clipped without a recovery mechanism.

---

# 16. No Hard-Coded Width for Text

Avoid fixed widths for:

- buttons containing text
- labels
- navigation items
- status badges
- dialogs
- translated headings

If a width constraint is necessary, the component must define responsive behavior.

---

# 17. Text Truncation

Truncation must not hide essential information.

If truncation is used:

- provide accessible full text
- provide tooltip/details where appropriate
- avoid truncating financial values
- avoid truncating status meaning

---

# 18. User Language Preference

If language preference is persisted:

- it should be associated with the correct user/profile settings
- changing language should not require reauthentication
- language changes should not lose form state unnecessarily
- direction should update correctly for Urdu
- cached UI data should remain semantically correct

---

# 19. Language Switching

Language switching should be accessible.

The language selector must:

- have a visible label
- expose language names clearly
- support keyboard access
- support screen readers
- show current selection
- not rely only on flags

Flags should not be used as the sole representation of language.

---

# 20. Language Names

Language selectors should preferably show native or recognizable names.

Example:

```text
English
हिन्दी
ಕನ್ನಡ
اردو
```

The exact localized display is subject to translation review.

---

# 21. Right-to-Left Support

Urdu requires RTL support.

RTL is not simply:

```text
text-align: right;
```

The entire layout system must account for direction.

---

# 22. RTL Direction

The application should set direction at an appropriate root/layout level.

Conceptually:

```text
English / Hindi / Kannada
direction = ltr

Urdu
direction = rtl
```

Direction should be derived from locale rather than hard-coded per page.

---

# 23. CSS Logical Properties

Web UI should prefer logical properties.

Examples:

```css
margin-inline-start
margin-inline-end
padding-inline-start
padding-inline-end
inset-inline-start
inset-inline-end
border-start-start-radius
```

Avoid unnecessary:

```css
margin-left
margin-right
padding-left
padding-right
left
right
```

for directional layout.

---

# 24. RTL Icons

Not every icon should be mirrored.

Icons representing direction may need mirroring.

Examples that may require contextual mirroring:

- back
- forward
- directional arrows

Icons representing universal concepts generally should not be mirrored.

---

# 25. RTL Navigation

Navigation should be reviewed for:

- sidebar position
- breadcrumbs
- arrows
- dropdown alignment
- pagination
- step indicators
- drawers
- action placement

Do not automatically mirror every element.

---

# 26. RTL Forms

Form layouts should preserve logical field relationships.

Labels, help text, errors, and controls must align correctly.

Phone numbers and other LTR data may require explicit direction handling.

---

# 27. Mixed Direction Content

The application may combine:

- Urdu
- English
- phone numbers
- payment references
- URLs
- email addresses
- account identifiers
- numeric amounts

Mixed-direction content requires explicit testing.

---

# 28. Bidirectional Isolation

Identifiers such as transaction references should not unexpectedly reorder when surrounded by RTL text.

Use appropriate bidirectional isolation mechanisms where supported.

---

# 29. Phone Numbers

Phone numbers should remain understandable in all supported languages.

They should not be visually reordered by surrounding RTL content.

---

# 30. UPI References

UPI IDs and transaction references should be presented as data identifiers.

They should not be translated.

They should remain copyable.

---

# 31. URLs and Email Addresses

URLs and email addresses should remain LTR-readable even inside RTL interfaces.

Copy actions should copy the exact underlying value.

---

# 32. Monetary Values

Money formatting must use locale-aware formatting where appropriate.

The application must preserve the authoritative monetary value independently of display formatting.

---

# 33. Currency

The project currently targets Indian financial workflows.

The exact currency configuration remains centralized and should not be duplicated throughout components.

---

# 34. Currency Display

Financial displays should consistently communicate:

- currency
- amount
- sign
- decimal precision
- context

Example:

```text
₹1,500.00
```

The exact formatting can vary by locale if the approved product specification allows it.

---

# 35. Negative Amounts

Negative values must remain understandable in every language and direction.

Do not communicate negative values only through red color.

---

# 36. Zero Values

Zero should have a consistent representation.

Do not use a mixture of:

```text
₹0
—
None
N/A
```

without semantic distinction.

---

# 37. Dates

Dates must use locale-aware formatting.

Do not hard-code one display format such as:

```text
DD/MM/YYYY
```

throughout the product.

The authoritative stored date remains unambiguous.

---

# 38. Date Inputs

Date pickers should:

- expose accessible labels
- support keyboard interaction on web
- support appropriate native behavior on mobile
- show localized formatting
- preserve underlying date value
- prevent impossible dates

---

# 39. Month-Based Donation Obligations

Donation obligations are month-sensitive.

The UI must clearly distinguish:

- obligation month
- payment date
- submission date
- verification date

A translated interface must not collapse these into one ambiguous "date" label.

---

# 40. Time

Times should follow the approved application timezone strategy.

Users should not have to infer timezone for important administrative events.

---

# 41. Timezone Display

For important records, display sufficient context where needed.

Examples:

- meeting time
- payment verification time
- audit event time
- attendance capture time

---

# 42. Relative Time

Relative labels such as:

```text
2 minutes ago
Yesterday
```

may be used for convenience.

Critical records should also provide an exact timestamp through accessible details.

---

# 43. Calendar Localization

Calendar controls must be tested for:

- locale
- first day of week
- month names
- weekday names
- keyboard navigation
- RTL behavior

The business calendar model must remain independent from display localization.

---

# 44. Number Formatting

Numbers should use locale-aware formatting where appropriate.

Examples:

- member counts
- transaction counts
- attendance counts
- financial values

Do not store localized display strings as authoritative numeric values.

---

# 45. Decimal Precision

Financial decimal rules must come from the financial specification.

UI formatting must not silently alter precision.

---

# 46. Input Parsing

Localized number input must be normalized safely before validation.

For example, users may enter different decimal separators depending on locale or keyboard.

The application must define accepted input rules rather than guessing.

---

# 47. Accessibility Baseline

The project should target a recognized modern accessibility baseline appropriate for web and mobile.

The implementation team should verify the exact conformance target and test scope before release.

The baseline must cover:

- perceivable
- operable
- understandable
- robust

---

# 48. Semantic HTML

Web interfaces should use semantic elements.

Examples:

```html
button
nav
main
header
footer
form
label
table
thead
tbody
th
```

Do not recreate native semantics unnecessarily with generic containers.

---

# 49. Buttons vs Links

Use:

- button for actions
- link for navigation

Do not use clickable `div` elements for ordinary actions.

---

# 50. Accessible Names

Every interactive control must have an accessible name.

Examples:

- visible text
- associated label
- accessible label
- semantic naming

Icon-only buttons require explicit accessible names.

---

# 51. Form Labels

Every input must have an associated label.

Placeholder text must never be the only label.

---

# 52. Required Fields

Required fields must be communicated accessibly.

Do not rely solely on an asterisk.

The semantic required state should also be available to assistive technology.

---

# 53. Validation Errors

Errors must:

- identify the field
- explain the problem
- provide correction guidance where possible
- be available to assistive technology
- remain visible long enough to act

---

# 54. Form Submission Errors

When a form submission fails:

1. explain the failure
2. preserve valid entered data where possible
3. identify fields requiring correction
4. move focus appropriately
5. avoid losing user work

---

# 55. Financial Validation

Financial validation should explicitly identify:

- invalid amount
- insufficient information
- invalid reference
- duplicate submission
- unsupported future month
- invalid allocation
- permission restriction

---

# 56. Focus Management

Focus must be managed for:

- dialogs
- drawers
- sheets
- menus
- route changes where needed
- validation errors
- asynchronous critical updates

---

# 57. Dialog Focus

When a dialog opens:

- focus should enter the dialog
- background interaction should be blocked
- Escape behavior should be defined
- focus should return appropriately after closing

---

# 58. Drawer Focus

Drawers and sheets require the same attention as dialogs.

Mobile implementation should use platform-appropriate accessible semantics.

---

# 59. Focus Visibility

Focus indicators must remain clearly visible.

Do not rely on subtle color differences.

---

# 60. Keyboard Navigation

Web workflows must be operable without a mouse.

Required coverage includes:

- login
- registration
- member search
- payment submission
- finance review
- task management
- meeting workflows
- notifications
- settings

---

# 61. Keyboard Order

Tab order must follow logical reading and task order.

Do not manipulate tab order unnecessarily.

---

# 62. Keyboard Shortcuts

Keyboard shortcuts may be added for high-frequency desktop workflows only when:

- discoverable
- non-conflicting
- optional
- accessible

Shortcuts must never be required for basic operation.

---

# 63. Escape Behavior

Escape should close appropriate transient UI:

- dialogs
- menus
- popovers
- drawers

It should not accidentally cancel an important financial operation without appropriate safeguards.

---

# 64. Screen Reader Semantics

Screen-reader users must be able to understand:

- page title
- current navigation context
- form labels
- field errors
- status
- loading
- successful actions
- permission restrictions
- offline state

---

# 65. Live Regions

Live regions should be used carefully.

Appropriate examples:

- payment submission result
- sync completion
- notification arrival
- critical error

Avoid announcing every minor realtime update.

---

# 66. Loading Announcements

Long-running operations should expose an accessible busy/loading state.

Example:

```text
Verifying payment…
```

When complete:

```text
Payment verified.
```

---

# 67. Status Announcements

Status changes that materially affect the user's task should be accessible.

Examples:

- payment rejected
- payment verified
- offline sync failed
- task assignment changed

---

# 68. Tables and Screen Readers

Financial tables must expose:

- column headers
- row context
- status
- amount
- actions

Interactive table rows must not hide critical information from assistive technology.

---

# 69. Responsive Accessibility

Accessibility must survive responsive transformations.

For example, when a desktop table becomes a mobile card:

- labels remain available
- relationships remain understandable
- action order remains logical
- status remains explicit

---

# 70. Text Scaling

Interfaces must tolerate increased text size.

Do not:

- clip text
- overlap controls
- hide critical information
- force horizontal scrolling unnecessarily

---

# 71. Browser Zoom

Web layouts should remain usable under significant browser zoom.

Critical financial workflows must be tested at increased zoom levels.

---

# 72. Mobile Font Scaling

Mobile screens must tolerate user font-size preferences where the platform supports them.

Fixed-height containers should be avoided for text-heavy content.

---

# 73. Color Independence

Color must never be the only way to convey:

- payment status
- attendance status
- task status
- error
- success
- financial difference

Use:

- text
- icons
- patterns where necessary
- accessible labels

---

# 74. Contrast

Contrast must be tested for:

- body text
- headings
- labels
- buttons
- status text
- icons
- focus indicators
- borders that communicate control boundaries

---

# 75. Disabled Controls

Disabled controls must remain understandable.

If disabled because of permission, the interface should not reveal sensitive authorization details.

Where helpful, provide explanatory text outside the disabled control.

---

# 76. Error Color

Errors should not be communicated only through red.

Use:

```text
Error icon + text + appropriate visual styling
```

---

# 77. Success Color

Success should not be communicated only through green.

Use explicit wording such as:

```text
Payment verified
```

---

# 78. Warning Color

Warnings should contain meaningful text.

Example:

```text
You are offline. Financial verification is unavailable.
```

---

# 79. Reduced Motion

The application must respect reduced-motion preferences.

Animations should be reduced or removed when appropriate.

Critical state changes must remain understandable without animation.

---

# 80. Auto-Refreshing Content

Automatically changing content can create accessibility problems.

Realtime updates should:

- avoid unexpectedly moving focus
- avoid disrupting typing
- avoid replacing the user's current context
- announce only important changes

---

# 81. Realtime Financial Updates

If a financial record changes while being reviewed:

- preserve the user's current view
- indicate that the record changed
- refresh authoritative data
- prevent accidental actions against stale state

---

# 82. Offline Accessibility

Offline indicators must be accessible.

Example:

```text
Offline — changes will sync when connection returns.
```

Do not rely only on a cloud/offline icon.

---

# 83. Sync Accessibility

Sync state should expose:

- queued
- syncing
- synced
- failed
- retrying

The status must be understandable without color.

---

# 84. Mobile Screen Readers

Mobile interfaces should use native accessible semantics where possible.

Interactive controls must expose:

- role
- label
- state
- value
- action

---

# 85. Touch Accessibility

Touch targets should be sufficiently large and separated.

Avoid:

- tiny icon buttons
- adjacent destructive controls
- densely packed toggles

---

# 86. Gesture Alternatives

If a workflow uses gestures, provide an alternative.

Do not make a critical workflow dependent on:

- swipe
- drag
- long press
- multi-touch

---

# 87. File Upload Accessibility

File upload must support:

- keyboard activation on web
- screen-reader label
- selected-file announcement
- upload status
- failure explanation
- retry

---

# 88. Payment Proof Accessibility

Proof preview must provide:

- file type
- filename
- accessible description
- secure download action where authorized

Images should have meaningful alternative text when the content conveys information.

---

# 89. Decorative Images

Decorative images should not create unnecessary screen-reader noise.

Use appropriate decorative semantics.

---

# 90. Meaningful Images

Meaningful images require alternative text or equivalent accessible description.

For payment proof, the actual document content may be sensitive; access and description must follow privacy rules.

---

# 91. Charts Accessibility

Every chart must have an accessible alternative.

Possible alternatives:

- data table
- textual summary
- accessible data list

Do not require users to interpret a visual chart to obtain critical information.

---

# 92. Map Accessibility

Attendance/GPS features must not depend solely on maps.

Provide:

- location text
- coordinates where appropriate
- status
- accessible controls
- textual alternatives

---

# 93. Authentication Accessibility

OTP authentication must support:

- screen readers
- keyboard navigation
- paste
- resend
- error handling
- countdown announcements where appropriate

---

# 94. Referral Registration Accessibility

Referral registration must provide:

- clear field labels
- referral context
- validation
- error recovery
- language selection
- mobile-friendly input

---

# 95. Member Profile Accessibility

Member profiles should maintain a logical reading order.

Sensitive information must be visible only when authorized.

---

# 96. Donation Accessibility

Donation workflows must make clear:

- obligation
- month
- amount
- payment method
- status
- proof
- next step

---

# 97. Payment Submission Accessibility

Payment submission must expose:

- amount
- reference
- payment date
- proof
- status
- submit action
- errors

---

# 98. UPI Accessibility

UPI deep-link or intent flows must have an accessible fallback.

If the app cannot open the UPI application:

- explain what happened
- provide alternative instructions
- allow safe retry
- avoid claiming payment success without authoritative confirmation

---

# 99. Finance Verification Accessibility

Finance verification screens must make critical evidence accessible.

Reviewers should be able to navigate:

- member
- amount
- reference
- proof
- allocation
- action

without relying on mouse-only interaction.

---

# 100. Financial Confirmation Accessibility

Confirmation dialogs must state:

- action
- record
- amount
- consequence
- final action

Focus must land on the dialog appropriately.

---

# 101. Auditor Accessibility

Audit screens may contain dense data.

Provide:

- headings
- filters
- table semantics
- accessible status
- clear date/time labels
- pagination

---

# 102. Committee Accessibility

Task and meeting screens must clearly expose:

- task state
- assignment
- date
- action
- attendance state

---

# 103. Notification Accessibility

Notifications should expose:

- title
- body
- timestamp
- unread state
- destination/action

Unread state must not depend only on background color.

---

# 104. Accessibility of Permissions

Permission-denied messages should be concise and non-revealing.

Do not expose hidden resource names merely to explain authorization failure.

---

# 105. Privacy and Accessibility

Accessibility must not become a reason to expose more sensitive data.

For example:

- screen-reader labels should not reveal unrelated private data
- hidden financial records must remain hidden
- notification previews should follow privacy rules

---

# 106. Localization of Accessibility Labels

Accessible names and descriptions must also be localized.

Do not leave:

```text
aria-label="Close"
```

hard-coded in English.

---

# 107. Localization of Errors

Validation and system errors must be translated.

Technical error identifiers may remain available for support logs but should not be the primary user-facing message.

---

# 108. Localization of Notifications

Notifications must use the recipient's approved language preference where supported.

Template variables must remain semantically safe.

---

# 109. Localization of Emails and Push

If external notification channels are implemented, their localization must use the same approved terminology as the application.

---

# 110. Translation Context

Translation resources should provide context where words are ambiguous.

Example:

```text
account
account balance
account number
```

should not necessarily reuse one ambiguous translation key.

---

# 111. Financial Terminology

Financial translations require particular review.

Terms such as:

- obligation
- allocation
- outstanding
- verification
- reversal
- correction
- overpayment

must have consistent translations throughout the product.

---

# 112. Religious Terminology

Terms such as:

- Masjid
- Jummah
- donation
- committee

should use approved community terminology.

AI translation should not automatically replace approved terminology.

---

# 113. Names

Member names should not be translated.

User-entered names should be displayed according to stored data and approved formatting rules.

---

# 114. Search and Localization

Search behavior must define whether it supports:

- exact match
- partial match
- transliteration
- localized text
- phone number
- identifiers

The product must not promise transliteration support unless implemented and tested.

---

# 115. Sorting

Sorting localized text requires locale-aware rules.

Do not assume Unicode code-point order is acceptable for all languages.

---

# 116. Case Conversion

Do not use generic English-only case conversion for localized content.

Locale-sensitive behavior should be used where required.

---

# 117. Date Sorting

Sort by authoritative date values rather than formatted strings.

---

# 118. Number Sorting

Sort by numeric values rather than localized display strings.

---

# 119. Financial Amount Sorting

Sort by authoritative numeric amounts.

Never sort formatted strings such as:

```text
₹1,000
₹900
₹10,000
```

lexicographically.

---

# 120. Accessibility of Sorting

Sortable columns should communicate:

- sortable
- current sort
- ascending/descending

through accessible semantics.

---

# 121. Pagination Accessibility

Pagination controls should have:

- clear labels
- current-page state
- disabled state
- keyboard support

---

# 122. Filter Accessibility

Filter controls require:

- accessible labels
- selected state
- clear action
- keyboard operation

---

# 123. Search Result Accessibility

Search results should expose:

- result context
- number of results where available
- selected item
- keyboard navigation

---

# 124. Combobox Accessibility

Comboboxes must correctly expose:

- expanded state
- selected value
- available options
- keyboard navigation
- loading state
- no-results state

---

# 125. Dropdown Accessibility

Dropdown menus must:

- have an accessible trigger
- manage focus correctly
- support keyboard navigation
- close appropriately
- preserve selection

---

# 126. Tabs Accessibility

Tabs should expose:

- tab role
- selected state
- associated panel
- keyboard navigation

---

# 127. Accordion Accessibility

Expandable sections should communicate:

- expanded/collapsed state
- section name
- keyboard behavior

---

# 128. Tooltip Accessibility

Tooltips must not contain essential information that cannot otherwise be accessed.

They should not be the only way to understand an icon-only control.

---

# 129. Toast Accessibility

Toasts should not be the only place where a critical result is presented.

For example, payment verification should update the page state as well as potentially show a toast.

---

# 130. Focus After Navigation

After navigation, focus should land at an appropriate meaningful location when needed.

The user should not lose track of the page context.

---

# 131. Focus After Form Submission

After successful submission, focus should move appropriately.

For errors, focus should help the user reach the problem efficiently.

---

# 132. Focus After Modal Close

Return focus to the control that opened the modal unless the workflow requires a different logical target.

---

# 133. Accessible Loading

Loading states must communicate that work is occurring.

Do not rely only on animated spinners.

---

# 134. Accessible Progress

Upload and sync progress should expose meaningful progress semantics where available.

---

# 135. Long Operations

Long operations should:

- communicate that they are running
- prevent duplicate action
- expose completion/failure
- allow cancellation only if technically safe

---

# 136. Accessibility of Financial Tables

Financial tables should prioritize:

- amount
- date
- status
- transaction/reference
- account
- action

The visual layout may change across breakpoints, but semantics must remain.

---

# 137. Mobile Financial Accessibility

On mobile, financial information should not be compressed until unreadable.

Use:

- stacked rows
- expandable details
- full-width actions

where necessary.

---

# 138. Accessibility of Combined Payments

Combined payment details should remain understandable when collapsed and expanded.

The user should be able to identify:

- total
- components
- allocation
- resulting state

---

# 139. Accessibility of FIFO Allocation

Allocation details should be presented in a logical sequence.

Example:

```text
January — ₹1,000 allocated
February — ₹1,000 allocated
March — ₹500 allocated
March outstanding — ₹500
```

---

# 140. Accessibility of Overpayment

Overpayment should be expressed textually.

Example:

```text
₹200 remains after the approved allocation.
```

---

# 141. Accessibility of Offline Financial Restrictions

If financial finalization is unavailable offline, communicate:

```text
You are offline. Final financial verification is unavailable until a server connection is restored.
```

Do not imply that an offline draft is authoritative.

---

# 142. Accessibility of Sync Conflicts

Sync conflicts should identify:

- what happened
- whether the server already accepted the operation
- what action is available

Avoid technical terminology unless necessary.

---

# 143. Translation of Sync Errors

Sync errors should be localized like ordinary errors.

Technical identifiers may be available to support logs.

---

# 144. Accessibility Testing Strategy

Testing should operate at multiple levels:

1. automated
2. component
3. workflow
4. keyboard
5. screen reader
6. mobile accessibility
7. localization
8. RTL
9. visual
10. manual human review

---

# 145. Automated Accessibility Testing

Automated checks should identify common issues such as:

- missing labels
- invalid roles
- contrast problems where detectable
- invalid ARIA
- missing accessible names
- structural issues

Automated testing is not sufficient by itself.

---

# 146. Keyboard Test Matrix

At minimum test:

| Workflow | Keyboard |
|---|---|
| Login | Required |
| Registration | Required |
| Member search | Required |
| Payment submission | Required |
| Finance review | Required |
| Expense entry | Required |
| Task management | Required |
| Meetings | Required |
| Notifications | Required |
| Settings | Required |

---

# 147. Screen Reader Test Matrix

Representative workflows:

- login
- member registration
- donation submission
- payment review
- finance transaction review
- task completion
- attendance
- notification navigation

---

# 148. RTL Test Matrix

At minimum test:

- authentication
- dashboard
- forms
- tables
- dialogs
- navigation
- payment flow
- finance flow
- notifications
- attendance
- reports

---

# 149. Language Test Matrix

Each supported language should be checked for:

- navigation
- forms
- validation
- notifications
- dashboards
- financial labels
- empty states
- errors
- dialogs

---

# 150. Translation Overflow Testing

Test long strings in:

- buttons
- navigation
- cards
- tables
- badges
- dialogs
- notifications

The UI must not clip or overlap.

---

# 151. Dynamic Text Testing

Test:

- long member names
- long task titles
- long descriptions
- long transaction references
- large financial amounts
- translated messages

---

# 152. Accessibility with Large Amounts

Financial displays must remain readable for values with many digits.

Example:

```text
₹1,23,45,678.90
```

or another approved locale representation.

---

# 153. Accessibility with Long Names

Member names must not break:

- tables
- avatars
- navigation
- notification lists
- payment review cards

---

# 154. Accessibility of Proof Files

Test:

- image
- PDF
- invalid file
- oversized file
- failed upload
- slow upload
- offline upload attempt

---

# 155. Mobile Accessibility Testing

Test with:

- platform screen reader
- increased text size
- portrait orientation
- landscape where supported
- keyboard where available
- touch interaction

---

# 156. Web Accessibility Testing

Test:

- keyboard-only
- browser zoom
- screen reader
- high contrast scenarios
- multiple viewport sizes
- RTL
- localized text

---

# 157. Accessibility Regression

Accessibility tests should run as part of the normal development lifecycle.

A previously fixed accessibility defect must not silently return.

---

# 158. Localization Regression

Translation changes should not introduce:

- missing keys
- English fallback unexpectedly
- broken interpolation
- layout overflow
- RTL regressions

---

# 159. Translation Versioning

Translation resources should be version-controlled with the application.

Changes should be reviewable.

---

# 160. Translation Review

Critical translation changes should be reviewed by a human fluent in the relevant language.

Priority areas:

- financial terminology
- permissions
- security
- errors
- legal/compliance wording
- religious/community terminology

---

# 161. AI Translation Policy

AI tools may generate translation drafts.

They must not be treated as authoritative automatically.

AI translation output requires:

- terminology check
- contextual check
- language review
- RTL review for Urdu
- accessibility review

---

# 162. Multi-AI Workflow

Different AI tools may be used for:

- translation draft
- terminology review
- accessibility audit
- RTL review
- copy review

No AI tool owns the localization system.

The repository remains the source of truth.

---

# 163. Translation Glossary

The project should maintain a glossary containing approved translations for important domain terms.

Suggested categories:

```text
roles
finance
donations
payments
committee
attendance
security
notifications
system
```

---

# 164. Terminology Consistency

If a term is approved for "payment verification", it should not appear elsewhere under an unrelated translation unless the context genuinely differs.

---

# 165. User-Generated Content

User-entered content generally should not be machine-translated automatically unless explicitly implemented.

Examples:

- member names
- task descriptions
- notes
- remarks
- payment references

---

# 166. User Language and Generated Content

System-generated messages should follow the user's language preference where supported.

User-generated content should remain faithful to its original content.

---

# 167. Notifications and Language Changes

If a user changes language, future system-generated notifications should use the current approved preference.

Historical notifications may preserve the language in which they were originally generated if that behavior is approved.

---

# 168. Accessibility of Notification Preferences

Notification settings should have:

- clear labels
- current state
- keyboard support
- accessible descriptions
- explanation of mandatory notifications

---

# 169. Mandatory Notifications

Mandatory security or operational notifications should not be disabled merely because optional notification preferences are disabled.

The UI should distinguish mandatory from optional categories.

---

# 170. Accessibility of Permission Changes

If a user's role or permissions change, the UI should communicate the change appropriately without exposing internal authorization details.

Cached restricted data must be removed according to security rules.

---

# 171. Session Expiration

Session expiration should provide an accessible message.

Avoid losing unsaved form data where technically possible.

---

# 172. Authentication Error Language

Authentication errors should be:

- understandable
- localized
- security-conscious
- actionable

Do not reveal sensitive account-existence information unnecessarily.

---

# 173. OTP Error Language

Examples:

```text
The verification code has expired.
Request a new code.
```

rather than technical codes alone.

---

# 174. Network Error Language

Network errors should explain:

```text
Connection unavailable.
Check your internet connection and try again.
```

where appropriate.

---

# 175. Server Error Language

Server errors should avoid exposing implementation details.

Provide a safe message and retry path where possible.

---

# 176. Accessibility of Error Recovery

Recovery actions must themselves be accessible.

A retry button is not useful if it cannot be reached by keyboard or screen reader.

---

# 177. Accessibility of Search Empty States

Search with no results should be clearly announced.

Example:

```text
No members found for this search.
```

---

# 178. Filtered Empty State

Distinguish:

```text
No records match the selected filters.
```

from:

```text
No records exist.
```

---

# 179. Loading and Language Switching

Changing language while data is loading must not create confusing intermediate states.

Avoid rendering mixed-language UI during transitions.

---

# 180. Direction Switching

Switching between LTR and RTL should update:

- layout direction
- alignment
- navigation
- icons where appropriate
- form layout
- drawers
- tables

---

# 181. Persistent Language State

Language preference should persist according to the approved account/device strategy.

It must not cause unauthorized cross-account preference leakage on shared devices.

---

# 182. Shared Device Considerations

On shared devices:

- logout must clear protected data
- language preference must not expose account identity
- cached sensitive records must be cleared appropriately
- local offline queues must remain account-bound

---

# 183. Offline Localization

Core localization resources needed for offline-supported workflows should be available locally.

The application should not require a network request merely to display an offline error.

---

# 184. Offline Attendance

Offline attendance UI must support the approved language and accessible sync states.

---

# 185. Offline Drafts

If drafts are supported offline, labels and validation must remain localized.

---

# 186. Localized Storage Keys

Internal storage keys should not be translated.

User-facing text should be translated.

---

# 187. Database Language Separation

The database should store canonical domain values rather than localized display strings.

Localization belongs at the presentation layer unless a domain field explicitly stores user-provided localized content.

---

# 188. API Language Handling

APIs should return stable domain identifiers.

The client should map identifiers to localized display strings where appropriate.

---

# 189. Status Identifier Example

Preferred:

```json
{
  "status": "verified"
}
```

Client:

```text
verified → localized label
```

Avoid returning English UI text as the only status contract.

---

# 190. Error Contract

API errors should expose stable error codes and safe contextual information.

Client localization maps the code to user-facing text.

---

# 191. Accessibility of API Errors

The UI must transform API errors into understandable accessible messages.

Raw JSON must not be shown to ordinary users.

---

# 192. Locale-Aware Sorting and Filtering

If filtering uses text values, the implementation must distinguish:

- canonical stored value
- localized display value
- search input

Do not mutate canonical values to support display localization.

---

# 193. Locale-Aware Export

Exports should define whether they contain:

- canonical identifiers
- localized labels
- localized dates
- localized numbers

This is an explicit product decision.

---

# 194. Reports

Reports should remain understandable across languages.

Critical reports should identify:

- report title
- period
- generated time
- timezone where required
- filters
- data scope

---

# 195. Financial Reports

Financial reports should not depend solely on color or chart interpretation.

Provide textual/tabular values.

---

# 196. Audit Reports

Audit reports should preserve authoritative timestamps and identifiers.

Localization should affect presentation, not underlying audit meaning.

---

# 197. Accessibility of Export Actions

Export buttons should communicate:

- format
- scope
- loading state
- completion/failure

---

# 198. Accessibility of Print

Printed reports should remain readable without relying on color.

---

# 199. Language in Printed Reports

Printed reports should use the selected report language if supported.

The language should be explicit in report metadata where useful.

---

# 200. Internationalization Architecture Boundary

The system should separate:

```text
Domain data
    ↓
API contracts
    ↓
Localized presentation
```

Domain logic should not depend on translated labels.

---

# 201. Localization of Business Rules

Business rules must use canonical identifiers.

Example:

```text
payment_status = "verified"
```

not:

```text
payment_status = "Verified"
```

This prevents translation from changing business logic.

---

# 202. Localization and Authorization

Permissions must use stable internal identifiers.

Example:

```text
finance.payment.verify
```

The displayed permission name may be localized.

---

# 203. Localization and Audit

Audit records should store stable action identifiers.

Display labels can be localized later.

---

# 204. Localization and Notifications

Notification event types should remain canonical.

Templates should translate the event into user-facing language.

---

# 205. Localization and Realtime

Realtime payloads should use stable domain values.

Clients render localized labels.

---

# 206. Localization and Offline Queue

Offline operation records should contain canonical operation data.

They should not depend on localized labels for replay.

---

# 207. Locale Changes During Offline State

Changing locale offline should still update local presentation if required resources are available.

Queued operations must remain unaffected.

---

# 208. Accessibility of Localized Navigation

Navigation labels must remain readable and navigable when translated.

Do not force one-line navigation if it causes clipping.

---

# 209. Mobile Navigation in Urdu

RTL mobile navigation must be tested independently.

Do not assume web RTL behavior automatically works in React Native.

---

# 210. Web and Mobile Translation Consistency

Web and mobile should use the same terminology glossary.

Implementation resources may differ, but semantic keys and translations should remain synchronized where practical.

---

# 211. Shared Translation Packages

A shared translation package may be used if it does not create unacceptable coupling.

The final structure is an implementation decision.

---

# 212. Translation Build Checks

CI should eventually check:

- missing keys
- extra keys
- malformed resources
- invalid interpolation
- duplicate keys
- unsupported locale references

---

# 213. RTL Build Checks

Automated checks should detect obvious RTL-specific CSS issues where practical.

Manual RTL review remains mandatory.

---

# 214. Accessibility Build Checks

CI should eventually include appropriate automated accessibility checks for supported web workflows.

Automated checks must not be treated as complete accessibility certification.

---

# 215. Human Accessibility Review

Human review remains required for:

- screen-reader comprehension
- logical reading order
- financial workflows
- complex tables
- realtime updates
- RTL
- translated content

---

# 216. Human Localization Review

Human language review remains required for critical translations.

AI tools may assist but should not replace qualified review.

---

# 217. Release Gate — Accessibility

A release should not be considered complete if critical accessibility defects remain unresolved.

Severity definitions should be maintained by QA/security governance.

---

# 218. Release Gate — Localization

A release should not be considered complete if:

- a supported locale crashes
- critical text is missing
- RTL layout is unusable
- financial terminology is inconsistent
- translated validation is broken

---

# 219. Release Gate — Urdu RTL

Urdu release readiness requires testing:

- authentication
- dashboard
- donation
- payment
- finance
- committee
- notifications
- settings

---

# 220. Accessibility Documentation

Each major component should document accessibility expectations.

Example:

```text
Component: PaymentReview

Keyboard:
- Tab through evidence and actions
- Enter/Space activate buttons

Screen reader:
- payment status announced
- amount announced with currency

Focus:
- dialog receives focus
- focus returns after close
```

---

# 221. Component Accessibility Checklist

Before component completion:

- [ ] semantic structure
- [ ] accessible name
- [ ] keyboard support
- [ ] focus state
- [ ] focus management
- [ ] screen-reader state
- [ ] error handling
- [ ] loading state
- [ ] contrast
- [ ] text scaling
- [ ] localization
- [ ] RTL if relevant

---

# 222. Localization Checklist

Before feature completion:

- [ ] English
- [ ] Hindi
- [ ] Kannada
- [ ] Urdu
- [ ] translation keys
- [ ] interpolation
- [ ] pluralization
- [ ] overflow
- [ ] RTL
- [date formatting]
- [number formatting]
- [error messages]
- [notifications]

---

# 223. Financial Accessibility Checklist

Before financial feature completion:

- [ ] amount readable
- [ ] currency explicit
- [ ] status textual
- [ ] action consequence clear
- [ ] proof accessible
- [ ] confirmation accessible
- [ ] error accessible
- [ ] offline restriction clear
- [ ] realtime changes handled
- [ ] keyboard tested
- [ ] screen reader tested
- [ ] all supported languages checked

---

# 224. Attendance Accessibility Checklist

Before attendance feature completion:

- [ ] status explicit
- [ ] GPS state explicit
- [ ] offline state explicit
- [ ] sync state explicit
- [ ] error state explicit
- [ ] map has textual alternative
- [ ] mobile touch targets verified
- [ ] screen reader tested

---

# 225. Notification Accessibility Checklist

Before notification feature completion:

- [ ] title accessible
- [ ] body accessible
- [ ] unread state accessible
- [ ] timestamp understandable
- [ ] action accessible
- [ ] localization supported
- [ ] privacy respected

---

# 226. Authentication Accessibility Checklist

Before authentication completion:

- [ ] labels
- [ ] OTP paste
- [ ] resend
- [ ] expiry
- [ ] errors
- [ ] focus
- [ ] screen reader
- [ ] localization
- [ ] mobile keyboard behavior

---

# 227. Accessibility Defect Priority

Defects should be prioritized by user impact.

Examples of high-impact defects:

- cannot complete payment
- cannot submit registration
- cannot access a critical action
- screen reader cannot identify a financial amount
- keyboard user cannot reach an action
- Urdu layout overlaps critical information

Exact severity policy should be maintained by QA governance.

---

# 228. Localization Defect Priority

High-impact defects include:

- incorrect financial translation
- missing critical translation
- broken RTL
- incorrect amount/date interpretation
- untranslated security warnings
- incorrect role labels

---

# 229. Accessibility and Security

Accessibility implementation must not weaken security.

For example:

- an accessible label must not expose hidden records
- screen-reader content must follow authorization
- cached accessible content must follow logout rules

---

# 230. Accessibility and Privacy

Privacy-sensitive data should be minimized in accessible descriptions.

For example, an icon label should not reveal unrelated payment information.

---

# 231. Accessible Audit Trail

Audit entries should provide a logical reading sequence:

```text
Actor
Action
Record
Timestamp
Result
```

---

# 232. Accessible Financial Review

A finance reviewer should be able to complete payment review using keyboard and assistive technology without relying on visual-only evidence.

---

# 233. Accessible Member Experience

Members should be able to:

- log in
- view obligations
- submit payments
- view status
- receive notifications
- update permitted profile fields

using supported accessibility mechanisms.

---

# 234. Accessible Administration

Administrative users should be able to:

- search
- filter
- review
- approve/reject where authorized
- inspect evidence
- navigate reports

without mouse-only dependence.

---

# 235. Accessibility of Role-Based Navigation

Navigation must expose only authorized areas while remaining understandable to assistive technology.

---

# 236. Accessibility of Hidden Content

Content hidden from ordinary users for authorization reasons must not accidentally remain accessible to assistive technologies.

---

# 237. Accessibility of Conditional Rendering

Permission-aware components should avoid rendering unauthorized sensitive content into the DOM merely to hide it visually.

---

# 238. Accessibility and Reauthentication

If sensitive operations require reauthentication, the UI must explain the reason and provide an accessible path to complete it.

---

# 239. Accessibility of Security Alerts

Security-related alerts must be:

- prominent enough
- localized
- accessible
- understandable
- actionable

---

# 240. Accessibility of Session Expiry

Session expiry should not silently discard work.

Where possible:

- warn before expiry
- preserve safe draft state
- allow reauthentication
- explain outcome

---

# 241. Accessibility of Offline Queue

Users must be able to inspect sync status without needing to interpret an icon alone.

---

# 242. Accessibility of Retry

Retry controls must:

- have accessible names
- indicate the relevant failed operation
- prevent accidental duplicate actions

---

# 243. Accessibility of Idempotent Operations

If an operation was already applied, the UI should communicate the authoritative result rather than treating it as a generic failure.

---

# 244. Accessibility of Conflict Resolution

Conflict screens should use plain language.

Example:

```text
This attendance record was already accepted by the server.
No additional action is required.
```

---

# 245. Accessibility of Realtime Reconciliation

When stale data is replaced by server-authoritative data, the UI should not unexpectedly move focus.

Important changes may be announced.

---

# 246. Accessibility of Long Lists

Long lists should provide:

- pagination or virtualization where appropriate
- logical headings
- search/filter
- accessible row identity

---

# 247. Virtualization

If virtualization is used, ensure assistive technologies can still understand list semantics.

---

# 248. Accessible Infinite Scroll

Infinite scrolling should have an accessible alternative or carefully managed semantics.

Pagination is often preferable for administrative data.

---

# 249. Accessibility of Modals with Forms

Forms inside dialogs require:

- labels
- validation
- focus
- submit state
- cancellation
- error recovery

---

# 250. Accessibility of Destructive Dialogs

Destructive dialogs must clearly state:

- object
- action
- consequence
- cancel
- confirm

---

# 251. Accessibility of Confirmation Amounts

Financial confirmation should expose the amount in accessible text.

Do not rely on visual emphasis alone.

---

# 252. Accessibility of Proof Documents

Proof documents should remain access-controlled even when screen-reader or download support is enabled.

---

# 253. Accessibility of Reports

Reports should support:

- headings
- readable tables
- meaningful summaries
- accessible filters
- accessible exports

---

# 254. Accessibility of Charts and Graphs

Charts should provide a data alternative.

Color legends should have textual labels.

---

# 255. Accessibility of Dashboard Cards

Cards should have meaningful headings and avoid exposing inaccessible decorative content as primary information.

---

# 256. Accessibility of KPI Values

A KPI should communicate:

```text
Outstanding amount: ₹5,000
```

rather than relying on color or visual positioning.

---

# 257. Accessibility of Status Icons

Status icons should have accessible meaning when they convey information.

Purely decorative icons should be hidden from assistive technology where appropriate.

---

# 258. Accessibility of Avatars

User avatars should not be the only identity mechanism.

Name and role should remain available where needed.

---

# 259. Accessibility of Member Search

Search result selection should expose:

- member name
- relevant identifying context
- authorized information

---

# 260. Accessibility of Referral Selection

Referral information should be understandable without relying on color or visual grouping.

---

# 261. Accessibility of Member Status

Statuses such as active, pending, inactive, or suspended must be represented textually.

---

# 262. Accessibility of Account Status

Account state should be explicit.

Do not show only a colored dot.

---

# 263. Accessibility of Permission State

Permission changes should not rely on hidden controls.

If a control is unavailable, explain the permitted alternative where appropriate.

---

# 264. Localization of Role Names

Role names must be translated consistently.

Internal role identifiers remain stable.

---

# 265. Localization of Permission Names

Permission identifiers remain stable internally.

Displayed permission descriptions are localized.

---

# 266. Localization of Audit Actions

Audit actions should map from stable action codes to translated labels.

---

# 267. Localization of Financial States

Financial state labels must map from canonical statuses.

Example:

```text
verified
```

may become the approved translated equivalent in each locale.

---

# 268. Localization of Attendance States

Attendance states should remain canonical internally:

```text
present
absent
pending_sync
synced
rejected
```

Display labels are localized.

---

# 269. Localization of Task States

Task states should remain canonical internally.

Display labels are localized.

---

# 270. Localization of Notification Categories

Notification event types remain canonical.

Category names are localized.

---

# 271. Accessibility of Notification Grouping

If notifications are grouped by date or category, group headings must be accessible.

---

# 272. Localization of Relative Dates

Relative-date wording should use locale-aware rules.

---

# 273. Localization of Pluralized Amounts

Where language requires pluralization around counts or months, use the localization framework rather than string concatenation.

---

# 274. Localization of Validation

Validation messages must preserve field context.

Example:

```text
Amount must be greater than zero.
```

should remain correctly associated with the amount field.

---

# 275. Localization of Help Text

Help text should be translated and accessible.

---

# 276. Localization of Tooltips

Tooltips should be translated.

Critical information must not depend solely on tooltips.

---

# 277. Localization of Dialogs

Dialog titles, descriptions, buttons, and errors must all use the same locale.

---

# 278. Localization of Navigation

Navigation labels should be translated as one coherent terminology set.

---

# 279. Localization of Empty States

Empty states should be translated and remain actionable.

---

# 280. Localization of Error States

Errors should be translated without losing technical support context.

---

# 281. Localization of Offline State

Offline state should be clearly communicated in every supported language.

---

# 282. Localization of Sync State

Sync labels should remain consistent across web and mobile.

---

# 283. Accessibility Acceptance Criteria

A feature is accessibility-complete only when:

1. keyboard operation is verified where applicable
2. accessible names exist
3. focus behavior is correct
4. errors are accessible
5. status is accessible
6. contrast is reviewed
7. text scaling is reviewed
8. screen-reader behavior is reviewed for critical flows
9. responsive behavior is reviewed
10. localized behavior is reviewed

---

# 284. Internationalization Acceptance Criteria

A feature is i18n-complete only when:

1. user-facing text is externalized
2. English is complete
3. Hindi is structurally supported
4. Kannada is structurally supported
5. Urdu is structurally supported
6. RTL behavior is handled
7. interpolation is correct
8. dates are locale-aware
9. numbers are locale-aware
10. critical terminology is consistent

---

# 285. Urdu Acceptance Criteria

Urdu is considered usable only when:

- page direction is correct
- navigation is usable
- forms are readable
- financial values remain understandable
- mixed LTR identifiers work
- dialogs work
- tables work
- notifications work
- errors work
- mobile screens work

---

# 286. Accessibility Release Checklist

Before release:

- [ ] automated accessibility checks pass
- [ ] keyboard critical flows pass
- [ ] screen-reader critical flows reviewed
- [ ] focus management reviewed
- [ ] contrast reviewed
- [ ] text scaling reviewed
- [ ] mobile accessibility reviewed
- [ ] offline accessibility reviewed
- [ ] realtime accessibility reviewed
- [ ] financial accessibility reviewed

---

# 287. Localization Release Checklist

Before release:

- [ ] English complete
- [ ] Hindi reviewed
- [ ] Kannada reviewed
- [ ] Urdu reviewed
- [ ] missing-key checks pass
- [ ] interpolation checks pass
- [ ] date/number formatting checked
- [ ] RTL reviewed
- [ ] long-string overflow checked
- [ ] notification translations checked
- [ ] financial terminology checked

---

# 288. Definition of Done

Accessibility and internationalization work is complete only when:

- implementation follows the approved design system
- supported locales render correctly
- RTL is tested
- critical workflows are accessible
- financial workflows are accessible
- errors are accessible
- offline/realtime states are accessible
- translation resources are complete
- automated checks pass
- human review is complete
- no known critical defect remains

---

# 289. Open Decisions

The following remain open until explicitly approved:

- final accessibility conformance target and release threshold
- final locale fallback
- translation ownership model
- professional translation review process
- final date/time display rules
- final currency formatting policy per locale
- transliteration search support
- export localization policy
- chart accessibility implementation
- exact screen-reader test matrix
- exact automated accessibility tooling
- dark mode accessibility requirements if dark mode is approved

These decisions must not be silently invented during implementation.

---

# 290. Implementation Order

Recommended order:

1. locale architecture
2. translation key structure
3. English baseline
4. semantic design tokens
5. accessible primitives
6. form accessibility
7. error/accessibility infrastructure
8. Hindi resources
9. Kannada resources
10. Urdu resources
11. RTL infrastructure
12. locale-aware date/number formatting
13. notification localization
14. financial terminology
15. mobile accessibility
16. automated accessibility checks
17. keyboard testing
18. screen-reader testing
19. localization QA
20. RTL QA
21. release gates

---

# 291. Final Principle

Accessibility and internationalization are part of the product's core architecture.

The system must allow a user to:

- understand information
- navigate safely
- complete authorized tasks
- interpret financial records
- recover from errors
- operate offline where supported
- receive realtime updates
- use the product in their supported language
- use Urdu in a true RTL interface
- use assistive technologies

without changing the underlying security, authorization, financial integrity, or business rules.

The canonical system remains:

```text
Authoritative domain model
        ↓
Stable API/data contracts
        ↓
Localized presentation
        ↓
Accessible interaction
```

Localization must never change business meaning.

Accessibility must never weaken authorization.

Visual translation must never become a substitute for semantic correctness.

---

# 292. Document Status

**Status:** Draft — Review Required

**Next actions:**

1. Review against `DESIGN_SYSTEM.md`.
2. Review against `UI_UX_SPEC.md`.
3. Review against `ROLE_PERMISSION_MATRIX.md`.
4. Review financial terminology against `DONATION_FINANCE_SPEC.md`.
5. Approve localization ownership and glossary process.
6. Approve accessibility release criteria.
7. Implement locale/token infrastructure before large-scale UI development.
