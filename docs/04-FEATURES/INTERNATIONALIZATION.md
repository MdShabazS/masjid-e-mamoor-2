# Masjid-e-Mamoor 2 — Internationalization

**Document Status:** V1 Implementation Baseline  
**Version:** 1.0  
**Product:** Masjid-e-Mamoor 2 Internal Management Application  
**Scope:** V1  
**Supported Languages:** English, Hindi, Kannada, Urdu  
**Primary Special Requirement:** Urdu RTL  
**Last Updated:** 2026-09-17

---

# 1. Purpose

This document defines the internationalization (i18n) and localization (l10n) requirements for Masjid-e-Mamoor 2.

The application must support four V1 languages:

```text
English
Hindi
Kannada
Urdu
```

The system must provide a consistent multilingual experience across:

- Web
- Android
- iOS
- Notifications
- Reports
- PDFs where technically practical
- Validation/error messages
- Date/time formatting
- Number formatting
- User-facing labels

The core principle is:

> Changing language changes presentation, not the underlying business data or financial meaning.

---

# 2. V1 Language Scope

Supported locale set:

```text
en
hi
kn
ur
```

The exact locale tags may be:

```text
en-IN
hi-IN
kn-IN
ur-IN
```

or another consistent implementation.

Use one canonical locale strategy across the application.

---

# 3. Language Selection

Users should be able to change the application language through settings.

Conceptually:

```text
Settings
   ↓
Language
   ├── English
   ├── Hindi
   ├── Kannada
   └── Urdu
```

The selected language should persist for future sessions on the device where practical.

---

# 4. Language Selection Scope

Language preference should normally be user-specific.

The same user may use:

```text
Web → English
Mobile → Kannada
```

depending on the final preference model.

Do not change stored business records when a user changes language.

---

# 5. Default Language

The default language may be:

```text
English
```

unless a product/bootstrap configuration specifies otherwise.

A first-time user should be able to switch language without requiring account re-registration.

---

# 6. Authentication Screen Localization

The following should be localized:

```text
Mobile Number
Send OTP
Verify OTP
Resend OTP
Invalid OTP
OTP expired
Try again
Login
Logout
```

The OTP itself remains numeric/provider-controlled.

---

# 7. Application UI Localization

All user-facing text should be translatable.

Do not hard-code text separately in:

```text
React components
React Native components
API error handlers
```

Use centralized translation resources.

---

# 8. Translation Resource Structure

Conceptually:

```text
i18n/
├── en/
├── hi/
├── kn/
└── ur/
```

Translation keys should be stable and semantic.

Example:

```text
common.save
common.cancel
finance.total_funds
task.mark_complete
meeting.create
```

---

# 9. Translation Key Principles

Translation keys should:

- Represent meaning, not exact wording.
- Remain stable across UI changes where possible.
- Avoid embedding user data.
- Avoid language-specific naming.
- Be shared across web/mobile where practical.

---

# 10. No Hard-Coded User-Facing Text

Do not write:

```text
<button>Save</button>
```

as the final localized implementation.

Prefer:

```text
<button>{t("common.save")}</button>
```

or the equivalent i18n mechanism.

---

# 11. Dynamic Values

Translations must support dynamic variables.

Example:

```text
Your monthly contribution of ₹500 is pending.
```

The translation system should provide a placeholder such as:

```text
Your monthly contribution of {{amount}} is pending.
```

Do not construct localized sentences through fragile string concatenation.

---

# 12. Pluralization

The i18n system must support plural-aware messages.

Examples:

```text
1 task
2 tasks

1 member
5 members
```

Do not assume English pluralization rules apply to Hindi, Kannada, or Urdu.

---

# 13. Gender/Grammatical Variations

Where translation requires grammatical agreement, the localization framework should support the necessary message variants.

Do not force English grammar patterns onto Hindi/Kannada/Urdu translations.

---

# 14. Urdu RTL

Urdu must render right-to-left.

The application should support:

```text
RTL layout
RTL text alignment
RTL navigation where appropriate
Correct punctuation behavior
Correct text shaping
```

---

# 15. RTL Scope

When Urdu is active, RTL behavior should apply consistently across:

```text
Web UI
Mobile UI
Forms
Tables where practical
Dialogs
Notifications where supported
PDFs where supported
```

---

# 16. RTL Icons

Directional icons may need mirroring in RTL.

Examples:

```text
Back
Forward
Arrow
Chevron
Step indicators
```

Non-directional icons should not be mirrored unnecessarily.

---

# 17. RTL Numbers and Currency

Numbers and currency may retain appropriate localized presentation.

The underlying monetary value remains identical.

Example:

```text
₹500
```

must continue to represent:

```text
five hundred Indian rupees
```

regardless of language.

---

# 18. Mixed RTL/LTR Content

The UI may contain mixed content such as:

```text
Urdu text
+
₹500
+
TX-2026-000123
```

The implementation must handle bidirectional text safely.

Reference IDs and system IDs should remain readable and stable.

---

# 19. Financial Amount Localization

Financial values are not translated.

The system localizes presentation only.

Example:

```text
₹1,80,000
```

may be formatted according to locale while the stored database value remains exact numeric data.

---

# 20. Currency

V1 currency:

```text
INR
Indian Rupee
₹
```

There is no multi-currency UI in V1.

---

# 21. Date Localization

Dates should be rendered according to the selected locale where appropriate.

Example:

```text
17 Sep 2026
```

may have different localized formatting.

The underlying date remains the same.

---

# 22. Time Localization

Time should be rendered in the application's configured local timezone.

Locale may affect:

```text
12-hour vs 24-hour presentation
```

where the formatter supports it.

---

# 23. Server Time vs Display Time

Server timestamps remain authoritative.

The UI translates them into the user's/local application's display timezone.

Do not modify stored timestamps because the user changes language.

---

# 24. Relative Time

Where used:

```text
Today
Yesterday
Tomorrow
2 days ago
```

must be localized.

Do not implement relative-time strings separately for every screen.

---

# 25. Reporting Period Labels

Report labels must be localized.

Examples:

```text
January 2026
September 2026
1 Jan 2026 – 31 Jan 2026
```

The date range itself remains identical.

---

# 26. Financial Report Localization

Financial reports should localize:

```text
Report title
Account labels
Income/receipt labels
Expense labels
Donation labels
Transfer labels
Summary labels
Footer text
Signature labels
```

Amounts and transaction IDs retain exact underlying values.

---

# 27. PDF Language

V1 PDFs should support multilingual output where the chosen PDF renderer can reliably render:

```text
English
Hindi
Kannada
Urdu
```

This must be validated before production.

---

# 28. PDF Font Requirements

PDF generation must use fonts with complete glyph support for:

```text
Devanagari
Kannada
Arabic/Urdu
Latin
```

Do not assume the browser/device font is available to the server-side PDF renderer.

---

# 29. PDF Font Embedding

Where required by the PDF renderer:

```text
Use embedded fonts
```

to ensure the report renders correctly on the dedicated Masjid laptop, printer, and other devices.

Font licensing must be respected.

---

# 30. Urdu PDF RTL

Urdu PDF generation must preserve:

```text
RTL flow
Arabic-script shaping
Correct joining behavior
Correct punctuation/order
```

A PDF renderer that produces broken Urdu text is not acceptable for production.

---

# 31. PDF Testing Requirement

Before production, generate representative PDFs containing:

```text
English
Hindi
Kannada
Urdu
₹ amounts
Dates
Member names
Transaction IDs
Long text
Tables
```

and verify:

```text
Print output
PDF viewer output
No clipping
No character substitution
No broken Urdu shaping
```

---

# 32. Notification Localization

Notifications should support:

```text
English
Hindi
Kannada
Urdu
```

where the delivery channel supports the required characters.

---

# 33. Notification Language Preference

Use the user's selected language for their notification where practical.

Example:

```text
User language = Kannada
→ notification in Kannada
```

---

# 34. SMS Localization

SMS messages may have provider/length constraints.

Use concise localized templates.

Avoid unnecessary details in SMS.

---

# 35. WhatsApp Localization

Where WhatsApp is supported through a provider, templates should follow provider rules for localized messages.

The application must not assume all languages/templates are automatically approved.

---

# 36. Push Notification Localization

Push payloads may use localized text.

However, sensitive information should remain out of payloads.

Example:

```text
Your monthly contribution is pending.
Open the app to view details.
```

---

# 37. Error Message Localization

Validation and business errors must be localized.

Examples:

```text
Invalid OTP
Payment already verified
Task already claimed
Outside attendance radius
You do not have permission
```

---

# 38. API Error Strategy

Backend APIs should return stable machine-readable error codes.

Example:

```text
TASK_ALREADY_CLAIMED
PAYMENT_ALREADY_VERIFIED
UNAUTHORIZED
ATTENDANCE_OUTSIDE_RADIUS
```

The frontend maps these codes to localized messages.

Do not make the client parse English error strings.

---

# 39. Validation Message Localization

Form validation should use translation keys.

Examples:

```text
Required field
Invalid mobile number
Amount must be greater than zero
```

---

# 40. Financial Terminology

Financial words must be translated consistently.

Examples:

```text
Donation
Contribution
Pending
Verified
Expense
Payment
Transfer
Balance
Cash
Bank
UPI
```

Create a controlled glossary across all four languages.

---

# 41. Committee Terminology

Committee terminology should also be consistent.

Examples:

```text
Task
Assigned
Claim
Completed
Overdue
Meeting
Decision
Follow-up
Attendance
Referral
```

---

# 42. Role Names

V1 role names must have controlled translations:

```text
President
Vice President
Secretary
Finance / Financer
Auditor
Committee Member
Member
```

The underlying role code remains language-independent.

---

# 43. Role Code vs Display Label

Database value:

```text
PRESIDENT
```

Display:

```text
President
```

or its localized equivalent.

Never store the translated display label as the authoritative role.

---

# 44. Status Code vs Display Label

Example:

```text
PAID
```

may display as the localized equivalent of:

```text
Paid
```

The underlying status code remains language-independent.

---

# 45. Category Names

System expense categories may require localized display labels.

Custom President-created categories require a policy for multilingual naming.

V1 may use the category text entered by the authorized creator unless a multilingual category model is explicitly introduced.

Do not silently invent translated custom-category values.

---

# 46. User-Entered Names

Member names are user-entered data and should generally be displayed as entered.

Do not automatically translate or transliterate a person's name.

---

# 47. User-Entered Descriptions

Free-text fields such as:

```text
Task description
Meeting agenda
Decision text
Expense description
Completion note
```

are not automatically translated in V1.

The application changes the surrounding UI language, not the user's original business content.

---

# 48. Search and Language

Search should support the stored content without corrupting user-entered language/script.

Examples:

```text
English member name
Kannada name
Urdu name
```

Database collation/search strategy must be validated for multilingual search.

---

# 49. Case Handling

Latin-script case folding is not sufficient for every supported script.

Search implementation should use database/locale-aware text operations where appropriate.

Do not apply destructive lowercase transformations to arbitrary multilingual names.

---

# 50. Mobile Input

Forms should support appropriate keyboards/input methods.

Examples:

```text
Urdu keyboard
Kannada keyboard
Hindi keyboard
English keyboard
```

The app should not restrict normal Unicode text unnecessarily.

---

# 51. Character Encoding

The entire stack must use Unicode/UTF-8.

This includes:

```text
Database
API
Web
React Native
Storage metadata
PDF generation
Notifications
Exports
```

---

# 52. Database Encoding

PostgreSQL should operate with Unicode-compatible database encoding.

Application strings must not be reduced to ASCII.

---

# 53. API Encoding

JSON APIs should use UTF-8-compatible encoding.

Do not strip:

```text
Hindi
Kannada
Urdu
```

characters from requests or responses.

---

# 54. Sorting

Multilingual sorting may differ from simple Unicode code-point ordering.

Where user-facing alphabetical sorting is required, use appropriate locale-aware sorting where practical.

Do not promise culturally perfect collation unless the chosen library/database behavior supports it.

---

# 55. Mobile Layout

Changing language may change text length significantly.

The UI must be resilient to:

```text
Long labels
Long translated buttons
Multi-line text
RTL
```

Do not design controls around English-only width assumptions.

---

# 56. Web Layout

Responsive layouts must tolerate translated labels.

Avoid fixed-width buttons that assume short English text.

---

# 57. Tables

Financial/committee tables may contain longer translated labels.

Use:

```text
Responsive columns
Wrapping
Ellipsis where safe
Detail views
```

Do not clip critical financial values.

---

# 58. Form Layout

Forms should support longer localized labels without causing:

```text
Overlapping controls
Hidden labels
Unreadable validation
```

---

# 59. Accessibility and i18n

Language changes must preserve:

```text
Readable contrast
Keyboard navigation
Screen-reader labels
Focus order
Form semantics
```

RTL must not break accessibility structure.

---

# 60. Screen Reader Language

The application should expose the active language appropriately to supported accessibility technologies where the platform permits.

This is especially important for:

```text
Urdu
Hindi
Kannada
```

---

# 61. Right-to-Left Navigation

When Urdu is selected:

```text
Navigation order
Back/forward presentation
Text alignment
```

should follow RTL conventions.

Logical information order must remain correct.

---

# 62. Direction Detection

Do not infer application-wide RTL merely because one text field contains Urdu.

The global interface direction follows the selected application language.

---

# 63. Mixed-Language Content

If a user enters English text while the UI is Urdu:

```text
Business content remains as entered.
```

The UI may remain RTL.

The renderer must handle mixed-direction content safely.

---

# 64. Language Persistence

Preferred language should persist across app restarts.

Where user-specific preferences are stored server-side, the value remains linked to the user.

Where local-only preference is used, it should be secure and consistent.

---

# 65. Language Change Without Logout

Changing language should normally not require logout.

The active session remains unchanged.

---

# 66. Language Change and Cached Data

Changing language should not modify cached business records.

Only presentation labels/templates should refresh.

---

# 67. Language Change and Financial Data

Changing language must not modify:

```text
Amount
Transaction ID
Donation amount
Expense amount
Account balance
Payment reference
```

Only presentation changes.

---

# 68. Language Change and Dates

Changing language may change date formatting but must not change:

```text
Stored date
Transaction date
Attendance date
Meeting date
```

---

# 69. Language Change and Roles

Role codes remain language-independent.

Example:

```text
PRESIDENT
```

displays in the selected language.

---

# 70. Translation Completeness

Before releasing a language, every V1 user-facing translation key should be checked for:

```text
Exists
Correct language
Correct terminology
No fallback English where avoidable
Correct RTL behavior for Urdu
```

---

# 71. Fallback Language

Recommended fallback:

```text
English
```

If a translation key is missing, the system may temporarily fall back to English.

Missing translations should be detectable in development/testing.

---

# 72. Translation Key Validation

CI/build validation should detect:

```text
Missing keys
Unused keys where useful
Malformed placeholders
Duplicate keys
```

The exact tooling can be chosen during implementation.

---

# 73. Placeholder Integrity

A translation must preserve all required placeholders.

Example source:

```text
{{amount}}
```

A translation must not accidentally remove or rename it unless the translation system explicitly supports the change.

---

# 74. Number Formatting

Use locale-aware formatting.

Examples may vary between locales, but:

```text
Amount value remains exact.
```

Use an established internationalization formatter rather than manual comma insertion.

---

# 75. Indian Numbering

Because the product operates in India, financial display should remain appropriate for Indian numbering where the chosen formatter supports it.

Example:

```text
₹2,50,000
```

---

# 76. Financial Precision

Localization must not introduce rounding that changes the underlying amount.

Example:

```text
₹1,250.50
```

must remain:

```text
1250.50
```

in the authoritative financial data.

---

# 77. Percentage Formatting

Percentages such as meeting attendance may be localized in presentation.

The mathematical value remains unchanged.

---

# 78. Duration Formatting

Task completion durations may be rendered according to locale.

Example:

```text
2 days
```

is a presentation value, not stored text.

---

# 79. Relative Date Semantics

Words such as:

```text
Today
Tomorrow
Yesterday
```

must be calculated from the relevant timezone and localized language.

---

# 80. Month Generation

Automated monthly donation generation must not depend on the selected UI language.

The scheduling logic is language-independent.

---

# 81. Notification Scheduling

Notification schedules must not depend on translated text.

The event remains:

```text
MONTHLY_DONATION_PENDING
```

regardless of language.

---

# 82. PDF Filename Localization

Generated PDF filenames may remain language-neutral or use safe localized titles.

Do not use arbitrary Unicode filenames unless the download/storage path is tested across all target platforms.

---

# 83. CSV/Export Localization

If CSV exports are supported later, the data encoding must remain UTF-8.

Column headers may be localized according to the selected report language.

---

# 84. Searchable PDF Requirement

Where practical, PDFs should keep text searchable rather than rendering all text as images.

This is especially important for:

```text
Hindi
Kannada
Urdu
```

---

# 85. Print Requirements

Printed output from the dedicated Masjid laptop/printer should remain readable for all supported languages.

Validate:

```text
Font size
Margins
RTL
Table width
Page breaks
Character shaping
```

---

# 86. Translation Governance

A central translation glossary should define consistent terms for:

```text
Finance
Donation
Attendance
Committee
Meeting
Task
Role
Status
```

Avoid different translations for the same product concept across screens.

---

# 87. Translation Review

Before a language is marked production-ready:

```text
Native/qualified language review
+
UI context review
+
PDF review where applicable
```

Literal machine translation alone should not be treated as final quality assurance.

---

# 88. Missing Translation Behavior

If a translation is unavailable:

```text
Use fallback
+
Record missing-key warning in development/monitoring
```

Do not crash the application.

---

# 89. User-Entered Unicode Validation

Do not reject valid names/text merely because they contain:

```text
Devanagari
Kannada
Arabic/Urdu
Accented Latin
```

Validation should focus on actual business constraints.

---

# 90. Emoji

V1 does not require special emoji support.

Where users enter free text, normal Unicode handling should avoid corrupting emoji.

---

# 91. Language Testing Matrix

Every major screen should be tested in:

```text
English
Hindi
Kannada
Urdu
```

For Urdu:

```text
LTR/RTL interactions
Tables
Forms
Dialogs
Navigation
Notifications
```

must be explicitly tested.

---

# 92. i18n Test Data

Create test data containing:

```text
English names
Hindi names
Kannada names
Urdu names
Mixed-script descriptions
₹ amounts
Long sentences
Long names
Reference IDs
```

---

# 93. Translation Testing — Authentication

Test:

```text
Login
OTP
Error messages
Logout
```

in all four languages.

---

# 94. Translation Testing — Members

Test:

```text
Member list
Member profile
Referral
Contribution amount
Donation status
```

in all four languages.

---

# 95. Translation Testing — Finance

Test:

```text
Dashboard
Account names
Transactions
Expenses
Payments
Reports
Audit
```

in all four languages.

---

# 96. Translation Testing — Committee

Test:

```text
Tasks
Assignment
Claim
Completion
Meetings
Decisions
Attendance
```

in all four languages.

---

# 97. Translation Testing — Attendance

Test:

```text
Mark Present
Location error
Outside radius
Already marked
Meeting attendance
```

in all four languages.

---

# 98. Translation Testing — Notifications

Test representative events:

```text
Task assigned
Task overdue
Meeting reminder
Donation pending
Payment verified
Expense added
```

in all four languages where channel support permits.

---

# 99. Translation Testing — PDF

For each language:

```text
Generate PDF
Open PDF
Search text
Print
Inspect page breaks
Inspect tables
Inspect amounts
```

For Urdu additionally verify:

```text
RTL
Shaping
Punctuation
```

---

# 100. Internationalization Invariants

The following rules are mandatory:

### Invariant 1

V1 supports English, Hindi, Kannada, and Urdu.

### Invariant 2

The selected language changes presentation, not business meaning.

### Invariant 3

Financial amounts remain mathematically identical across languages.

### Invariant 4

Transaction IDs remain language-independent.

### Invariant 5

Role codes remain language-independent.

### Invariant 6

Status codes remain language-independent.

### Invariant 7

Stored dates/timestamps are not modified by language changes.

### Invariant 8

Server time remains authoritative.

### Invariant 9

Urdu UI supports RTL.

### Invariant 10

Urdu text shaping must be correct in production PDFs.

### Invariant 11

The database and APIs support Unicode.

### Invariant 12

User-entered multilingual names/text are not automatically translated.

### Invariant 13

Translation keys are centralized.

### Invariant 14

Backend returns stable machine-readable error codes.

### Invariant 15

Missing translations do not crash the application.

### Invariant 16

Notifications use the user's selected language where supported.

### Invariant 17

PDFs use fonts with required script support where multilingual output is enabled.

### Invariant 18

Localization must not change financial calculations.

### Invariant 19

Localization must not alter attendance/session dates.

### Invariant 20

RTL must not break accessibility or logical information order.

### Invariant 21

Changing language should not require logout under normal V1 behavior.

### Invariant 22

Language preferences do not grant or remove authorization.

---

# 101. Acceptance Criteria

The Internationalization system is implementation-ready when it can:

- Switch between English, Hindi, Kannada, and Urdu.
- Persist language selection.
- Localize authentication screens.
- Localize all core user-facing labels.
- Localize validation/error messages.
- Support dynamic placeholders.
- Support pluralization.
- Format dates/times appropriately.
- Format Indian currency values correctly.
- Support Unicode throughout the stack.
- Render Urdu RTL correctly on web and mobile.
- Handle mixed RTL/LTR content.
- Localize notifications where supported.
- Localize financial/committee/attendance reports where practical.
- Generate readable multilingual PDFs.
- Render Hindi, Kannada, and Urdu correctly in PDFs.
- Keep financial values unchanged across languages.
- Keep IDs/role/status codes language-independent.
- Support localized API-error presentation.
- Avoid missing-translation crashes.
- Preserve accessibility during language switching.

---

# 102. Implementation Boundary

This document defines internationalization/localization behavior.

The following belong elsewhere:

```text
Technology implementation      → TECHNOLOGY_STACK.md
Frontend architecture         → FRONTEND_ARCHITECTURE.md
Mobile architecture           → APPLICATION_ARCHITECTURE.md
PDF renderer                  → TECHNOLOGY_STACK.md
Notifications                 → NOTIFICATION_SYSTEM.md
Reports                       → REPORTING_AND_AUDIT.md
Authentication               → AUTHENTICATION.md
Database                      → DATABASE_SCHEMA.md
Security                      → SECURITY_ARCHITECTURE.md
Privacy                       → DATA_PRIVACY.md
UI visual design              → DESIGN_SYSTEM.md
Screen behavior               → SCREEN_SPECIFICATIONS.md
Testing                       → TESTING_STRATEGY.md
```

---

# 103. Related Documents

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
- `COMMITTEE_WORK_MANAGEMENT.md`
- `MEETING_MANAGEMENT.md`
- `ATTENDANCE_SYSTEM.md`
- `NOTIFICATION_SYSTEM.md`
- `REPORTING_AND_AUDIT.md`
- `DATABASE_SCHEMA.md`
- `FRONTEND_ARCHITECTURE.md`
- `APPLICATION_ARCHITECTURE.md`
- `SECURITY_ARCHITECTURE.md`
- `DATA_PRIVACY.md`
- `DESIGN_SYSTEM.md`
- `SCREEN_SPECIFICATIONS.md`
- `TESTING_STRATEGY.md`

---

## Document Status

**Internationalization — V1 Implementation Baseline**

This document defines the authoritative multilingual and localization requirements for Masjid-e-Mamoor 2.

All i18n implementation must preserve language independence of business data, correct Unicode handling, Urdu RTL behavior, multilingual reporting, and financial-value integrity.
