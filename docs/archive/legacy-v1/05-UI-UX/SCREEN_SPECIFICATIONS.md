# Masjid-e-Mamoor 2 — Screen Specifications

**Document Status:** V1 Implementation Baseline  
**Version:** 1.0  
**Product:** Masjid-e-Mamoor 2 Internal Management Application  
**Scope:** V1  
**Platforms:** Web, Android, iOS  
**Related Documents:** UI_UX_REQUIREMENTS.md, DESIGN_SYSTEM.md, NAVIGATION_FLOW.md  
**Last Updated:** 2026-09-17

---

# 1. Purpose

This document defines the screen-level requirements for Masjid-e-Mamoor 2.

It describes:

- Screen purpose
- Primary information
- Primary actions
- Secondary actions
- Role visibility
- Data requirements
- Loading/empty/error states
- Navigation
- Responsive behavior
- Security/privacy expectations

This document is an implementation contract for the frontend.

---

# 2. Screen Specification Principles

1. Each screen has one clear purpose.
2. Primary actions are obvious.
3. Financial actions show sufficient context before execution.
4. Sensitive data is role-restricted.
5. UI state reflects server-authoritative data.
6. Loading must not appear as zero/empty financial data.
7. Error states must be actionable.
8. Destructive actions require confirmation.
9. Mobile and web may use different layouts but retain the same information architecture.
10. Urdu must support RTL.
11. V1 scope must not expand through screen design.
12. No ranking/gamification screens are permitted.

---

# 3. Screen Naming Convention

Recommended internal naming:

```text
AUTH-01
DASH-01
MEM-01
MEM-02
DON-01
FIN-01
EXP-01
TASK-01
MTG-01
ATT-01
RPT-01
AUD-01
SET-01
```

The IDs are design references, not database IDs.

---

# 4. Authentication Screens

---

# 4.1 AUTH-01 — Login

**Purpose:** Start authentication with mobile number.

### Content

```text
Masjid-e-Mamoor 2
Welcome
Mobile Number
Send OTP
Language selector
```

### Primary Action

```text
Send OTP
```

### Secondary

```text
Change language
```

### States

```text
Initial
Submitting
OTP Sent
Error
```

### Validation

```text
Valid mobile format
```

### Navigation

```text
Login
→ OTP Verification
```

---

# 4.2 AUTH-02 — OTP Verification

**Purpose:** Verify mobile number ownership.

### Content

```text
Mobile number
OTP input
Verify OTP
Resend OTP
Change number
```

### Primary Action

```text
Verify OTP
```

### Secondary

```text
Resend
Change Number
```

### States

```text
Waiting
Verifying
Invalid OTP
Expired OTP
Success
Rate limited
Network error
```

### Security

Never display/store OTP outside the controlled auth flow.

---

# 4.3 AUTH-03 — Application Onboarding

**Purpose:** Complete application profile for a first-time authenticated user where applicable.

### Content

```text
Full Name
Email (optional)
Photo (optional)
```

### Primary Action

```text
Continue
```

### Navigation

```text
OTP
→ Onboarding
→ Role-aware Dashboard
```

---

# 4.4 AUTH-04 — Account Inactive

**Purpose:** Inform an authenticated but deactivated application user.

### Content

```text
Account inactive
Contact authorized Masjid administrator
Logout
```

No restricted application data should be shown.

---

# 5. Dashboard Screens

---

# 5.1 DASH-01 — President Dashboard

**Visible:** President

### Primary Sections

```text
Overall Masjid Funds
Account Balances
Unverified Payments
Finance Activity
Committee Work
Overdue Tasks
Meetings
Attendance
Alerts
```

### Key Actions

```text
View Finance
View Committee Work
View Reports
View Audit
```

### Primary Goal

Give President a factual operational overview.

### Must Not Include

```text
Member rankings
Donation leaderboard
Performance score
```

---

# 5.2 DASH-02 — Finance Dashboard

**Visible:** Finance

### Primary Sections

```text
Overall Funds
Cash
Bank
UPI
Other
Unverified Payments
Recent Expenses
Pending Documentation
Recent Transactions
```

### Primary Actions

```text
Review Payments
Add Expense
View Accounts
View Transactions
```

---

# 5.3 DASH-03 — Secretary Dashboard

**Visible:** Secretary

### Primary Sections

```text
Committee Work
Meetings
Attendance
Members
Donation/collection context
Relevant reports
```

### Primary Actions

```text
Create Task
Create Meeting
Manage Attendance
Manage Members
```

---

# 5.4 DASH-04 — Auditor Dashboard

**Visible:** Auditor

### Primary Sections

```text
Financial Summary
Recent Financial Activity
Reports
Audit
```

### Primary Actions

```text
Open Financial Report
Open Audit
```

No write controls for financial records.

---

# 5.5 DASH-05 — Committee Member Dashboard

**Visible:** Committee Member

### Primary Sections

```text
My Work
Open Tasks
Upcoming Deadlines
Referral Activity
Meetings
Attendance
```

### Primary Actions

```text
Open My Work
View Open Tasks
Add/Refer Member
Mark Attendance
```

---

# 5.6 DASH-06 — Member Dashboard

**Visible:** Member

### Primary Sections

```text
Current Monthly Contribution
Outstanding
Additional Donation
Donation History
Jummah Attendance
Meeting Attendance where applicable
```

### Primary Actions

```text
Pay Monthly
Pay Outstanding
Additional Donation
View History
```

---

# 6. Member Screens

---

# 6.1 MEM-01 — Member List

**Visible:** Authorized internal roles.

### Content

```text
Search
Filters
Member ID
Name
Mobile
Status
Referrer
Contribution summary where permitted
```

### Actions

```text
Add/Refer Member
Open Member
Filter
Search
```

### States

```text
Loading
Empty
Results
Error
```

---

# 6.2 MEM-02 — Refer/Add Member

**Visible:** Committee Member and roles with permission.

### Content

```text
Full Name
Mobile
Email optional
Photo optional
Primary Referrer
Agreed Monthly Contribution
Effective Month
```

### Flow

```text
Enter mobile
→ Check duplicate
→ Create/use member
→ Set primary referrer
→ Confirm contribution
→ Payment request/link
```

### Duplicate State

```text
Existing member found
```

Must not create duplicate.

---

# 6.3 MEM-03 — Member Detail

### Sections

```text
Profile
Referral
Contribution
Donation History
Attendance
Related Work
```

### Actions

```text
Edit Profile
Change Contribution where permitted
View Donations
View Attendance
View Related Work
```

### Privacy

Field visibility depends on role.

---

# 6.4 MEM-04 — Edit Member

### Editable Examples

```text
Name
Email
Photo
Other approved profile fields
```

### Sensitive

Mobile number changes require stronger verification and are not a normal free-form profile edit.

---

# 7. Donation Screens

---

# 7.1 DON-01 — Donation Overview

### Sections

```text
Monthly
Additional
Anonymous where permitted
Jummah Collections where permitted
Outstanding
```

---

# 7.2 DON-02 — Member Monthly Donations

**Visible:** Member for self; authorized internal users for permitted records.

### Content

```text
Month
Expected Amount
Status
Verified Amount
Payment Action
```

### Actions

```text
Pay
View
```

---

# 7.3 DON-03 — Outstanding Donations

### Content

```text
Outstanding Months
Expected Amount
Outstanding Amount
Total Due
```

### Primary Action

```text
Pay Outstanding
```

### Important

Combined payment uses FIFO server-side.

---

# 7.4 DON-04 — Additional Donation

### Content

```text
Amount
General Donation
```

### Primary Action

```text
Continue to Payment
```

No purpose selection in V1.

---

# 7.5 DON-05 — Payment Request

### Content

```text
Purpose
Month where applicable
Amount
Payment reference/request ID
UPI destination
Expiry
```

### Primary Action

```text
Pay via UPI
```

### Important

Page must not imply that opening the link means payment is verified.

---

# 7.6 DON-06 — Donation Detail

### Content

```text
Donation type
Month
Expected amount
Verified amount
Status
Payment reference
Financial transaction
Relevant dates
```

### Actions

Role dependent.

---

# 7.7 DON-07 — Anonymous Donation Entry

**Visible:** Finance/authorized roles.

### Fields

```text
Amount
Date
Method
Account
Reference where available
```

### Primary Action

```text
Record Donation
```

---

# 7.8 DON-08 — Jummah Cash Collection

**Visible:** President, Secretary, Finance.

### Fields

```text
Friday/session
Cash amount
Account
Collection date
Description/notes where required
```

### Primary Action

```text
Record Collection
```

No individual donor list.

---

# 8. Finance Screens

---

# 8.1 FIN-01 — Finance Overview

### Sections

```text
Overall Funds
Account Balances
Recent Transactions
Unverified Payments
Recent Expenses
```

### Actions

```text
Add Expense
Review Payments
View Transactions
Create Transfer
```

---

# 8.2 FIN-02 — Accounts

### Content

```text
Account Name
Type
Current Balance
Status
```

### Actions

```text
Add Account
Open Account
Deactivate Account
```

---

# 8.3 FIN-03 — Account Detail

### Content

```text
Account Name
Type
Opening Balance
Current Balance
Bank details where applicable
UPI detail where applicable
Transactions
```

### Actions

Role-dependent.

---

# 8.4 FIN-04 — Add Account

### Fields

```text
Account Type
Name
Opening Balance
Bank Name where applicable
Account Name where applicable
Last 4 digits where applicable
UPI ID where applicable
```

### Validation

Exact monetary amount.

---

# 8.5 FIN-05 — Transactions

### Content

```text
Date
Transaction ID
Description
Account
Type
Credit/Debit
Amount
Reference
```

### Filters

```text
Date
Account
Type
Amount
Method
Category
Reference
```

---

# 8.6 FIN-06 — Transaction Detail

### Content

```text
Transaction ID
Date
Account
Direction
Amount
Category
Method
Reference
Source
Description
Created By
Created At
```

### Actions

```text
Correct
Delete
```

only where permitted.

---

# 8.7 FIN-07 — Payment Verification Queue

**Visible:** Finance and authorized roles.

### Content

```text
Member
Purpose
Amount
Date
Reference
Payment evidence
Status
```

### Actions

```text
Verify
Reject
Open Detail
```

---

# 8.8 FIN-08 — Payment Verification Detail

### Content

```text
Payment request
Member
Requested amount
Actual/verified amount
Payment date
External reference
Evidence
Donation context
```

### Actions

```text
Verify
Reject
```

### Safety

Verification triggers authoritative financial processing.

---

# 8.9 FIN-09 — Transfers

### Content

```text
Transfer ID
Date
Source
Destination
Amount
Status
```

### Actions

```text
Create Transfer
Open Transfer
```

---

# 8.10 FIN-10 — Create Transfer

### Fields

```text
Source Account
Destination Account
Amount
Date
Reference/Description
```

### Confirmation

Clearly show:

```text
From
To
Amount
```

---

# 8.11 FIN-11 — Categories

### Content

```text
Category
Status
System/Custom
```

### Actions

```text
Create
Deactivate
```

Historical category references must remain intact.

---

# 9. Expense Screens

---

# 9.1 EXP-01 — Expense List

### Content

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

### Filters

```text
Date
Status
Category
Amount
```

---

# 9.2 EXP-02 — Create Expense

### Fields

```text
Title
Description
Date
Category
Amount
Bill
```

### Primary Action

```text
Save Expense
```

---

# 9.3 EXP-03 — Expense Detail

### Sections

```text
Summary
Bill
Payments
Payment Proofs
Financial Transactions
Audit context
```

### Content

```text
Expense amount
Paid
Remaining
Status
```

### Actions

```text
Add Payment
Correct Amount
Cancel
Replace Bill
```

according to permission/state.

---

# 9.4 EXP-04 — Add Expense Payment

### Fields

```text
Amount
Account
Payment Method
Payment Date
External Reference
Payment Proof
```

### Pre-submit Summary

```text
Expense Amount
Already Paid
Remaining
New Payment
```

---

# 9.5 EXP-05 — Correct Expense Amount

### Content

```text
Current Amount
New Amount
Reason
```

### Validation

```text
New Amount >= valid payments
```

### Audit

Required.

---

# 9.6 EXP-06 — Cancel Expense

### Content

```text
Expense
Current Status
Cancellation Reason
```

### Primary Action

```text
Confirm Cancellation
```

Only when allowed by expense state/role.

---

# 10. Committee Work Screens

---

# 10.1 TASK-01 — My Work

### Sections

```text
Assigned
In Progress
Completed
Overdue
```

### Content

```text
Task
Priority
Deadline
Status
Related context
```

---

# 10.2 TASK-02 — Open Tasks

### Content

```text
Task
Description
Priority
Deadline
Related context
Claim action
```

### Primary Action

```text
Claim
```

---

# 10.3 TASK-03 — All Tasks

**Visible:** President/Secretary/authorized users.

### Content

```text
All tasks
Responsible
Priority
Deadline
Status
Creator
```

### Filters

```text
Status
Responsible member
Priority
Date
Deadline
```

---

# 10.4 TASK-04 — Create Task

### Fields

```text
Title
Description
Priority
Deadline optional
Assignment mode
Responsible member if direct
Related member optional
Related referral optional
Meeting optional
Decision optional
```

### Assignment modes

```text
Direct
Open for Volunteers
```

---

# 10.5 TASK-05 — Task Detail

### Sections

```text
Overview
Responsibility
Progress
Comments
Attachments
Related Member/Referral
Meeting/Decision
Completion
History
```

### Actions

```text
Claim
Start
Add Progress
Complete
Edit
```

according to state/permission.

---

# 10.6 TASK-06 — Add Progress Update

### Fields

```text
Progress/comment
Attachment where applicable
```

### Primary Action

```text
Save Update
```

Progress history is preserved.

---

# 10.7 TASK-07 — Complete Task

### Content

```text
Completion note optional
```

### Primary Action

```text
Complete
```

Server records completion timestamp.

---

# 10.8 TASK-08 — Edit Completed Task

### Visible

Committee Member for own completed task and broader authorized roles where permitted.

### Behavior

Allow only approved fields.

No Delete action for Committee Member.

Audit important changes.

---

# 11. Meeting Screens

---

# 11.1 MTG-01 — Meeting List

### Sections

```text
Upcoming
Past
Cancelled
```

### Content

```text
Title
Date/time
Location
Status
Attendance
Follow-up count
```

---

# 11.2 MTG-02 — Create Meeting

### Fields

```text
Title
Date
Time
Location
Agenda
Invitees
```

### Primary Action

```text
Schedule Meeting
```

---

# 11.3 MTG-03 — Meeting Detail

### Sections

```text
Overview
Agenda
Attendance
Decisions
Follow-ups
```

### Actions

```text
Edit
Reschedule
Cancel
Add Decision
Create Follow-up
```

---

# 11.4 MTG-04 — Meeting Attendance

### Content

```text
Member
Attendance status
```

### Actions

```text
Mark Present
Correct
```

according to permissions.

No Jummah GPS workflow here.

---

# 11.5 MTG-05 — Add Decision

### Fields

```text
Decision text
```

### Optional Action

```text
Create Follow-up Task
```

Do not force task creation.

---

# 11.6 MTG-06 — Meeting Accountability

### Content

```text
Meeting
  ↓
Decision
  ↓
Follow-up Task
  ↓
Responsible Member
  ↓
Status
  ↓
Completion
```

This is a key internal accountability view.

---

# 12. Attendance Screens

---

# 12.1 ATT-01 — Attendance Home

### Sections

```text
Jummah
Meetings
My History
```

Role visibility applies.

---

# 12.2 ATT-02 — Jummah Attendance

### Primary Content

```text
Current Friday Session
Attendance status
MARK PRESENT
```

### Location States

```text
Location permission required
Getting location
Validating
Outside radius
Poor accuracy
Recorded
Network unavailable
```

---

# 12.3 ATT-03 — Jummah Attendance Result

### Success

```text
Attendance recorded
Session
Recorded time
```

### Pending Offline

```text
Attendance saved locally.
Waiting for server synchronization.
```

### Rejection

Explain the problem and provide retry guidance.

---

# 12.4 ATT-04 — Meeting Attendance

### Content

```text
Meeting
Date/time
Attendance state
```

### Actions

Role-dependent.

---

# 12.5 ATT-05 — My Attendance History

### Sections

```text
Jummah
Meetings
```

### Content

```text
Date
Session/Meeting
Status
```

No raw GPS coordinates for normal member views.

---

# 12.6 ATT-06 — Attendance Report View

### Content

```text
Session
Present count
Attendance trend
Authorized member list where permitted
```

---

# 13. Reports Screens

---

# 13.1 RPT-01 — Reports Home

### Sections

```text
Financial
Donations
Expenses
Transfers
Committee Work
Meetings
Attendance
Audit
```

Only authorized reports appear.

---

# 13.2 RPT-02 — Financial Report Builder

### Controls

```text
Report type
Date range
Account
Category
Method
Status
```

### Actions

```text
Preview
Generate PDF
```

---

# 13.3 RPT-03 — Financial Report Preview

### Content

```text
Report title
Reporting period
Opening balance
Income/receipts
Expenses
Transfers
Adjustments
Closing balance
```

### Actions

```text
Generate PDF
Open PDF
Print
```

---

# 13.4 RPT-04 — Donation Report Builder

### Controls

```text
Monthly
Additional
Anonymous
Jummah
Outstanding
Date range
```

---

# 13.5 RPT-05 — Expense Report Builder

### Controls

```text
Date range
Status
Category
Account/method
```

---

# 13.6 RPT-06 — Committee Work Report

### Controls

```text
Date range
Status
Responsible member
Priority
Meeting
```

### Output

```text
Created
Completed
In Progress
Pending
Overdue
```

No ranking/score.

---

# 13.7 RPT-07 — Meeting Report

### Output

```text
Meetings
Attendance
Decisions
Follow-ups
Completion status
```

---

# 13.8 RPT-08 — Attendance Report

### Sections

```text
Jummah
Meeting attendance
```

No raw location trail.

---

# 13.9 RPT-09 — Audit Report

### Controls

```text
Date range
Actor
Action
Entity
Category
Result
```

### Output

```text
Timestamp
Actor
Action
Entity
Result
Reason
Before/after context where applicable
```

---

# 14. Audit Screens

---

# 14.1 AUD-01 — Audit Home

### Sections

```text
Recent
Financial
Administrative
Security
```

---

# 14.2 AUD-02 — Audit Detail

### Content

```text
Event ID
Actor
Role
Action
Entity
Entity ID
Timestamp
Result
Reason
Before
After
Metadata
```

Only authorized roles can access this screen.

---

# 15. Settings Screens

---

# 15.1 SET-01 — Settings Home

### Sections

```text
Profile
Language
Notifications
Administrative Settings where permitted
```

---

# 15.2 SET-02 — Profile

### Content

```text
Name
Mobile
Email
Photo
Role
```

Role is read-only for normal users.

---

# 15.3 SET-03 — Language

### Options

```text
English
Hindi
Kannada
Urdu
```

### Behavior

Changing language:

```text
No logout
No data changes
No financial changes
```

---

# 15.4 SET-04 — Notifications

### Content

Appropriate channel/preferences where V1 supports them.

Avoid a complex rules engine.

---

# 15.5 SET-05 — Administrative Settings

**President/authorized roles only.**

Possible settings:

```text
Attendance radius
Masjid location
Expense categories
```

UPI configuration is handled through Finance according to the finance workflow.

---

# 16. Shared Components Across Screens

The following components should be reusable:

```text
PageHeader
SearchBar
FilterBar
DataTable
StatusBadge
PriorityBadge
AmountDisplay
AccountBalanceCard
MemberCard
TaskCard
MeetingCard
FileUpload
FilePreview
ConfirmDialog
ReasonDialog
LoadingState
EmptyState
ErrorState
Pagination
```

---

# 17. Global Screen States

Every data-dependent screen should support:

```text
Loading
Loaded
Empty
Error
Unauthorized
Session Expired
Offline where applicable
```

---

# 18. Financial Screen States

Finance screens additionally support:

```text
Processing
Verification Required
Missing Bill
Missing Payment Proof
Negative Balance Warning
Duplicate/Conflict
```

---

# 19. Task Screen States

Task screens additionally support:

```text
Open
Assigned
In Progress
Completed
Overdue
Already Claimed
Conflict
```

---

# 20. Attendance Screen States

Jummah screens additionally support:

```text
Location Permission
Fetching Location
Validating
Outside Radius
Poor Accuracy
Offline Pending
Synced
Already Recorded
Rejected
```

---

# 21. Meeting Screen States

Meeting screens additionally support:

```text
Scheduled
Completed
Cancelled
Rescheduled
No Decisions
Pending Follow-Up
Completed Follow-Up
Overdue Follow-Up
```

---

# 22. File Upload States

Financial/task document upload states:

```text
Idle
Selected
Uploading
Uploaded
Failed
Replacing
Removed where permitted
```

---

# 23. Error State Requirements

Every error state should:

```text
Explain
+
Give next action
```

Examples:

```text
Retry
Go Back
Request Permission
Sign In Again
```

---

# 24. Loading State Requirements

Do not show:

```text
₹0
0 tasks
0 members
```

while the server request is still loading.

Use skeletons/loading indicators.

---

# 25. Empty State Requirements

Example:

```text
No unverified payments
All current payments have been reviewed.
```

Do not show a generic empty message where meaningful context can be provided.

---

# 26. Unauthorized State

Example:

```text
You do not have permission to view this section.
```

Do not expose sensitive record existence/details.

---

# 27. Session Expired State

Example:

```text
Your session has expired.
Please sign in again.
```

---

# 28. Responsive Requirements

Every screen must be designed for:

```text
Mobile
Tablet
Desktop
Large desktop
```

---

# 29. Mobile Screen Rules

Mobile screens should prioritize:

```text
Primary action
Key amount/date/status
Important context
```

Secondary information may move into details or expandable sections.

---

# 30. Desktop Screen Rules

Desktop may expose:

```text
More columns
Side filters
More simultaneous context
Large report tables
```

---

# 31. RTL Screen Rules

For Urdu:

```text
Global direction = RTL
Navigation = RTL
Forms = RTL
Dialogs = RTL
Text alignment = RTL where appropriate
```

Numeric/reference presentation should remain readable.

---

# 32. Accessibility Screen Rules

Every screen must support:

```text
Keyboard navigation on web
Accessible labels
Visible focus
Screen-reader semantics
Touch-friendly controls
```

---

# 33. Financial Safety Rules by Screen

The following screens require extra care:

```text
FIN-06 Transaction Detail
FIN-08 Payment Verification Detail
FIN-10 Create Transfer
EXP-03 Expense Detail
EXP-04 Add Expense Payment
EXP-05 Correct Expense Amount
DON-05 Payment Request
```

Each must prevent ambiguous or unsafe actions.

---

# 34. Destructive Screen Rules

Destructive confirmation is required for:

```text
Financial transaction deletion
Account deactivation
Expense cancellation
Other material administrative actions
```

---

# 35. Reason-Required Screen Rules

Reason input required for:

```text
Financial correction
Expense cancellation
Expense amount correction
Referral attribution correction
```

where required by business rules.

---

# 36. Notification Deep-Link Screens

Notification deep links may open:

```text
TASK-05
MTG-03
DON-06
FIN-08
EXP-03
```

The destination must still validate:

```text
Authentication
Authorization
Record access
```

---

# 37. Shared Laptop Requirements

On the dedicated Masjid laptop:

```text
Logout must be obvious.
Protected data must clear on logout.
Reports should be easy to print.
Finance tables should support keyboard/mouse workflows.
```

---

# 38. Screen Security

No screen may depend on visual hiding for security.

A hidden action/route remains protected by:

```text
Backend authorization
RLS
```

---

# 39. Screen Data Boundaries

Do not duplicate authoritative business calculations in presentation components.

Examples:

```text
Account balance → backend
Donation status → backend
Task ownership → backend
Attendance validation → backend
```

---

# 40. Screen Audit Visibility

Where appropriate, screens may show:

```text
Created by
Created at
Updated by
Updated at
```

and authorized audit details.

Do not expose full audit data to ordinary users.

---

# 41. Screen Refresh

Important screens should support refresh:

```text
Finance
Payments
Tasks
Meetings
Attendance
Reports
```

Real-time updates are optional optimization.

---

# 42. Optimistic Update Restrictions

Do not optimistically display final state for:

```text
Payment verification
Financial posting
Transfer completion
Final attendance acceptance
```

---

# 43. Duplicate Submission Protection

Screens that create records should disable repeated submission while the request is processing.

Backend idempotency remains mandatory.

---

# 44. Navigation Return Behavior

After completing an action, return to the relevant authoritative screen.

Examples:

```text
Create expense → Expense Detail/List
Verify payment → Payment Queue
Complete task → My Work
Create meeting → Meeting Detail
Mark attendance → Attendance Result
```

---

# 45. Screen-Level Localization

All fixed text on every screen must use the central i18n system.

User-entered business text is not automatically translated.

---

# 46. Screen-Level Date Formatting

Date/time rendering follows locale and application timezone.

The underlying stored date/time does not change.

---

# 47. Screen-Level Currency Formatting

All monetary values use the same currency/number formatting component.

No screen-specific manual currency formatting.

---

# 48. Screen-Level Status Formatting

Status labels use shared status components.

Examples:

```text
Paid
Pending
Verified
Overdue
Completed
Cancelled
```

---

# 49. Screen-Level File Security

Financial and internal task documents use protected file access.

Do not expose permanent public storage links.

---

# 50. Screen Test Matrix

Each core screen should be tested for:

```text
Desktop
Mobile
Loading
Empty
Error
Unauthorized
Long text
Localization
Urdu RTL
Accessibility
Network interruption
```

Critical financial screens additionally require:

```text
Duplicate submission
Concurrency conflict
Permission boundary
Exact amount display
Audit visibility
```

---

# 51. Screen Invariants

The following rules are mandatory:

### Invariant 1

Every screen has a defined purpose.

### Invariant 2

Every protected screen requires authentication and authorization.

### Invariant 3

The UI does not replace backend security.

### Invariant 4

Financial screens show exact authoritative financial values.

### Invariant 5

Payment-request screens do not imply payment verification.

### Invariant 6

Expected donations are not presented as received money.

### Invariant 7

Destructive actions require confirmation.

### Invariant 8

Required correction/cancellation reasons must be collected before completion.

### Invariant 9

Loading states must not look like valid zero/empty financial data.

### Invariant 10

Critical operations cannot be duplicated through repeated clicks.

### Invariant 11

Backend idempotency remains required even when UI prevents duplicate clicks.

### Invariant 12

Open task claiming remains atomic.

### Invariant 13

Offline attendance is shown as pending until server synchronization.

### Invariant 14

Raw GPS coordinates are not shown in normal attendance screens.

### Invariant 15

Meeting attendance does not reuse the Jummah GPS flow.

### Invariant 16

V1 attendance screens contain only Jummah and scheduled meeting attendance.

### Invariant 17

Finance verification cannot be performed by unauthorized roles.

### Invariant 18

Committee Members cannot delete completed work.

### Invariant 19

Historical records remain accessible according to role.

### Invariant 20

Urdu screens use RTL.

### Invariant 21

Language changes do not alter business data.

### Invariant 22

Screen content respects role-based field visibility.

### Invariant 23

Notification deep links cannot bypass authorization.

### Invariant 24

Shared-device logout prevents prior-user protected data from remaining visible.

### Invariant 25

No screen introduces ranking, leaderboard, points, or performance scores.

---

# 52. Acceptance Criteria

The screen specification is implementation-ready when:

- Authentication screens are defined.
- Role-specific dashboards are defined.
- Member screens are defined.
- Donation/payment screens are defined.
- Finance screens are defined.
- Expense screens are defined.
- Committee work screens are defined.
- Meeting screens are defined.
- Attendance screens are defined.
- Report screens are defined.
- Audit screens are defined.
- Settings screens are defined.
- Core states are defined.
- Mobile/desktop behavior is defined.
- RTL requirements are defined.
- Accessibility requirements are defined.
- Sensitive screen boundaries are defined.
- Destructive-action patterns are defined.
- Critical financial screens have safety rules.
- Notification deep links are defined.
- Shared-laptop behavior is defined.

---

# 53. Implementation Boundary

This document defines screen-level frontend behavior.

The following belong elsewhere:

```text
Overall UX principles       → UI_UX_REQUIREMENTS.md
Visual tokens/components    → DESIGN_SYSTEM.md
Navigation structure        → NAVIGATION_FLOW.md
Authentication              → AUTHENTICATION.md
Member management            → MEMBER_MANAGEMENT.md
Donation behavior            → DONATION_SYSTEM.md
Payment behavior             → PAYMENT_SYSTEM.md
Finance behavior             → FINANCE_SYSTEM.md
Expense behavior             → EXPENSE_SYSTEM.md
Committee work               → COMMITTEE_WORK_MANAGEMENT.md
Meeting behavior             → MEETING_MANAGEMENT.md
Attendance                   → ATTENDANCE_SYSTEM.md
Notifications                → NOTIFICATION_SYSTEM.md
Reporting                    → REPORTING_AND_AUDIT.md
Internationalization         → INTERNATIONALIZATION.md
Authorization               → AUTHORIZATION_MODEL.md
Security                    → SECURITY_ARCHITECTURE.md
Database                    → DATABASE_SCHEMA.md
Storage                     → STORAGE_STRATEGY.md
Testing                     → TESTING_STRATEGY.md
```

---

# 54. Related Documents

- `PROJECT_OVERVIEW.md`
- `PRODUCT_REQUIREMENTS.md`
- `FEATURE_SCOPE.md`
- `UI_UX_REQUIREMENTS.md`
- `DESIGN_SYSTEM.md`
- `NAVIGATION_FLOW.md`
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
- `AUTHORIZATION_MODEL.md`
- `SECURITY_ARCHITECTURE.md`
- `DATA_PRIVACY.md`
- `STORAGE_STRATEGY.md`
- `TESTING_STRATEGY.md`

---

## Document Status

**Screen Specifications — V1 Implementation Baseline**

This document defines the authoritative screen-level frontend contract for Masjid-e-Mamoor 2.

All screen implementation must preserve role-based visibility, financial safety, secure navigation, responsive behavior, multilingual support, accessibility, and the product's no-feature-bloat direction.
