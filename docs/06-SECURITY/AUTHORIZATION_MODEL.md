# Masjid-e-Mamoor 2 — Authorization Model

**Document Status:** V1 Authorization Baseline  
**Version:** 1.0  
**Product:** Masjid-e-Mamoor 2 Internal Management Application  
**Scope:** V1  
**Platforms:** Web, Android, iOS  
**Related Documents:** USER_ROLES_PERMISSIONS.md, SECURITY_REQUIREMENTS.md, SECURITY_ARCHITECTURE.md, AUTHENTICATION.md, DATABASE_SCHEMA.md, AUDIT_LOG_MODEL.md  
**Last Updated:** 2026-09-17

---

# 1. Purpose

This document defines the V1 authorization model for Masjid-e-Mamoor 2.

Authorization determines:

- Which authenticated users can access a resource.
- Which roles can perform an action.
- Which records a user may see.
- Which fields may be changed.
- Which actions require additional validation.
- Which operations must be performed only by trusted backend code.

Authentication answers:

```text
Who is the user?
```

Authorization answers:

```text
What is this user allowed to do?
```

The application must enforce both.

---

# 2. Authorization Principles

1. Deny by default.
2. Authorization is server-side.
3. Database protection and backend authorization work together.
4. The client cannot grant itself permissions.
5. Role labels shown in the UI are not security controls.
6. Access must be checked at the record/action level where necessary.
7. Financial mutations require stricter controls.
8. Sensitive data should follow least privilege.
9. Historical records must remain protected.
10. Every permission must map to a clear business need.

---

# 3. V1 Roles

The application has exactly these V1 roles:

```text
President
Vice President
Secretary
Finance
Auditor
Committee Member
Member
```

No additional generic roles are part of V1.

Not included in V1:

```text
Staff
Volunteer
Read-Only
Custom Role
Custom Permission Profile
```

---

# 4. Role Definitions

## 4.1 President

Overall administrative authority.

Can manage:

```text
Users
Roles
Members
Attendance
Tasks
Meetings
Finance
Accounts
Reports
Audit
System settings
```

President also has the V1 authority to permanently delete financial transactions.

---

## 4.2 Vice President

Senior office-bearer.

V1 access must be limited to explicitly defined operational capabilities and must not automatically inherit President-only powers.

Unless a specific capability is explicitly granted in this document or later approved, it is not assumed.

---

## 4.3 Secretary

Broad operational/admin role.

Primary areas:

```text
Members
Meetings
Tasks
Attendance
Prayer/Jummah operational records where applicable
Agreed monthly contribution entry/change
Jummah cash collections
Relevant reports
```

Secretary does not receive unrestricted Finance-level financial control.

---

## 4.4 Finance

Operational financial controller.

Primary areas:

```text
Donation verification
UPI configuration
Accounts
Transactions
Expenses
Payments
Transfers
Financial reports
Financial documentation
```

Finance is the final operational controller for expense/payment workflow in V1.

Finance does not require President approval for an individual expense before paying it.

---

## 4.5 Auditor

Read/review role for financial accountability.

Primary areas:

```text
Financial records
Reports
Audit trail
Supporting records
```

Auditor cannot create, edit, or delete financial transactions.

---

## 4.6 Committee Member

Operational committee role.

Primary areas:

```text
Member referral
Contribution agreement entry/change
Tasks
Open task claiming
Task completion
Own completed work edits
Meetings/attendance according to assignment
Relevant referral/contribution information
```

Committee Member cannot:

```text
Delete completed work
Delete financial transactions
Manage roles
Perform Finance-only verification
```

---

## 4.7 Member

Normal Masjid member.

Primary areas:

```text
Own profile
Own monthly contribution/payment information
Own donation history
Monthly donation payments
Additional donations
Own attendance where applicable
```

Member cannot change the fixed monthly contribution amount directly.

---

# 5. Permission Model

The system should use explicit permission identifiers instead of relying only on role names.

Recommended permission keys:

```text
dashboard.view

users.view
users.create
users.edit
users.disable
users.change_role

members.view
members.create
members.edit
members.correct_referrer

contributions.view
contributions.create
contributions.edit

donations.view_own
donations.view_internal
donations.create_additional
donations.record_anonymous
donations.record_jummah
donations.verify

payments.create_request
payments.verify
payments.reject

finance.accounts.view
finance.accounts.create
finance.accounts.edit
finance.accounts.deactivate

finance.transactions.view
finance.transactions.create
finance.transactions.correct
finance.transactions.delete

finance.transfers.view
finance.transfers.create

finance.categories.view
finance.categories.create
finance.categories.deactivate

expenses.view
expenses.create
expenses.edit
expenses.add_payment
expenses.correct_amount
expenses.cancel

committee.tasks.view
committee.tasks.create
committee.tasks.assign
committee.tasks.claim
committee.tasks.update
committee.tasks.complete
committee.tasks.edit_completed

meetings.view
meetings.create
meetings.edit
meetings.cancel
meetings.mark_attendance
meetings.add_decision
meetings.create_followup

attendance.jummah.mark
attendance.meeting.mark
attendance.view_own
attendance.view_internal
attendance.correct

reports.view_financial
reports.view_donations
reports.view_expenses
reports.view_committee
reports.view_meetings
reports.view_attendance
reports.view_audit
reports.generate_pdf

audit.view

settings.view
settings.edit
settings.attendance.edit
settings.categories.edit
settings.upi.view
settings.upi.edit
```

Permission names are implementation references and may be represented differently in code, but the business capabilities must remain equivalent.

---

# 6. High-Level Role Matrix

Legend:

```text
✓ = allowed
R = restricted/conditional
— = not allowed
```

| Capability | President | Vice President | Secretary | Finance | Auditor | Committee Member | Member |
|---|---:|---:|---:|---:|---:|---:|---:|
| View own profile | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| View internal member records | ✓ | R | ✓ | R | R | R | — |
| Add/refer member | ✓ | R | ✓ | R | — | ✓ | — |
| Correct referrer | ✓ | — | — | — | — | — | — |
| Change agreed contribution | ✓ | R | ✓ | ✓ | — | ✓ | — |
| Make own donation/payment | ✓* | ✓* | ✓* | ✓* | ✓* | ✓* | ✓ |
| Verify member payment | ✓ | R | — | ✓ | — | — | — |
| Record anonymous donation | ✓ | R | ✓ | ✓ | — | — | — |
| Record Jummah cash collection | ✓ | R | ✓ | ✓ | — | — | — |
| Manage accounts | ✓ | R | — | ✓ | — | — | — |
| Create financial transaction | ✓ | R | R | ✓ | — | — | — |
| Correct financial transaction | ✓ | — | — | ✓ where business rule permits | — | — | — |
| Delete financial transaction | ✓ | — | — | — | — | — | — |
| Create transfer | ✓ | — | — | ✓ | — | — | — |
| View financial records | ✓ | R | R | ✓ | ✓ | R | own only |
| Create expense | ✓ | R | R | ✓ | — | — | — |
| Add expense payment | ✓ | R | — | ✓ | — | — | — |
| Correct expense amount | ✓ | — | — | ✓ | — | — | — |
| Cancel expense | ✓ | — | R | ✓ | — | — | — |
| View audit log | ✓ | R | R | R | ✓ | — | — |
| Create task | ✓ | R | ✓ | R | — | — | — |
| Claim open task | ✓ | R | ✓ | R | — | ✓ | — |
| Complete own task | ✓ | R | ✓ | R | — | ✓ | — |
| Edit own completed task | ✓ | R | ✓ | R | — | ✓ | — |
| Delete completed task | —* | — | — | — | — | — | — |
| Create meeting | ✓ | R | ✓ | R | — | — | — |
| Manage meeting attendance | ✓ | R | ✓ | R | — | — | — |
| Add decision | ✓ | R | ✓ | R | — | — | — |
| View reports | ✓ | R | ✓ | ✓ | ✓ | R | limited own |
| Generate PDF reports | ✓ | R | ✓ | ✓ | ✓ | R | own/permitted |
| Edit attendance settings | ✓ | — | — | — | — | — | — |
| Manage roles | ✓ | — | — | — | — | — | — |
| Edit system settings | ✓ | — | — | — | — | — | — |

`*` Subject to the specific record/workflow and the user’s assigned role; payment/financial permissions remain server-authoritative.

The VP column intentionally contains conditional access rather than automatic broad access. Exact VP permissions must be explicitly approved before implementation and must not be inferred from the title.

---

# 7. Permission Precedence

Where permissions conflict:

1. Explicit deny wins over inherited/general access.
2. President-only restrictions remain President-only.
3. Resource-specific restrictions override broad role access.
4. Server-side policy is authoritative.
5. UI visibility never overrides backend authorization.

---

# 8. Record-Level Access

Role permission alone may be insufficient.

Examples:

### Member

May access:

```text
Own profile
Own donation records
Own payment status
Own attendance
```

Cannot access another member's donation history.

### Committee Member

May see:

```text
Members they are permitted to work with
Their own referral/contribution activity
Assigned/open work
```

Access to unrelated private member data must remain limited.

### Finance

May access broader financial records but does not automatically gain every administrative role-management capability.

### Auditor

May access broad financial/audit information but remains read-only for financial mutations.

---

# 9. Field-Level Authorization

Authorization may apply to fields, not just whole screens.

Examples:

### Member record

A normal member may see:

```text
Own name
Own mobile
Own email
Own donation information
```

but not internal administrative metadata belonging to another member.

### Financial record

An Auditor may view:

```text
Amount
Date
Account
Transaction ID
Category
Reference
```

but cannot modify them.

### Contribution amount

Member:

```text
View
```

Committee Member/Secretary/Finance/President:

```text
Create/change
```

---

# 10. President-Only Actions

V1 President-only actions include:

```text
Permanent financial transaction deletion
Role management
User administrative control
Attendance radius configuration
Core system administration
```

Where another document explicitly defines a stricter President-only action, that restriction takes precedence.

---

# 11. Finance-Only Actions

The following are Finance-focused operational permissions:

```text
Payment verification
UPI ID management
Expense payment posting
Financial account operations
Routine financial transaction processing
Financial payment/document handling
```

President retains oversight and broader authority.

---

# 12. Auditor Restrictions

Auditor must be treated as read-only for financial records.

Auditor cannot:

```text
Create donation verification
Create expense payment
Create transfer
Correct transaction
Delete transaction
Change UPI
Change account balance
Change contribution
```

Auditor can review:

```text
Financial records
Supporting documents
Audit trail
Reports
```

---

# 13. Member Restrictions

Member cannot:

```text
Change own agreed monthly contribution
Verify own payment
Verify another member's payment
Create financial transactions manually
Delete financial transactions
Edit referral attribution
Access other members' confidential data
Change roles
Access audit logs
```

---

# 14. Committee Member Restrictions

Committee Member cannot:

```text
Delete completed work
Delete financial transaction
Verify payments
Manage roles
Change UPI configuration
Create internal transfers
Perform Finance-only financial operations
```

Committee Member can:

```text
Refer/register member
Set/change agreed contribution where permitted
Claim open task
Complete task
Edit own completed task
```

---

# 15. Secretary Restrictions

Secretary has broad operational access but does not automatically receive Finance authority.

Secretary may:

```text
Manage meetings
Manage operational tasks
Manage permitted attendance
Register/refer members
Enter/change agreed contribution
Record Jummah cash collections
```

Secretary does not automatically receive:

```text
Payment verification
UPI management
Routine financial account administration
Financial deletion
```

---

# 16. Vice President Authorization

The Vice President role is intentionally not a copy of President.

Before implementation, every VP capability must be explicitly assigned.

Until assigned:

```text
VP permission = deny
```

for any capability not explicitly granted.

This prevents accidental privilege escalation caused by assuming that a senior title means unrestricted access.

---

# 17. User Lifecycle Authorization

Recommended states:

```text
Authenticated
Active
Disabled
```

Only an authorized administrator can move a user into/out of restricted administrative states.

A disabled user:

```text
Cannot access protected application data
Cannot perform new actions
```

Historical records created by that user remain intact.

---

# 18. Role Change Authorization

Only authorized role administrators may change roles.

Requirements:

- Current actor must be authorized.
- Target user must exist.
- New role must be valid.
- Change must be server-side.
- Change must be auditable.
- User cannot assign themselves elevated privileges.
- Session/authorization must reflect the new role after refresh/re-authentication as appropriate.

---

# 19. Senior Office-Bearer Constraint

V1 allows a maximum of three people across senior office-bearer positions as defined by product requirements.

The database/backend must enforce the approved business rule when senior-role assignment is implemented.

Do not enforce a different count based on assumptions.

---

# 20. Financial Authorization Workflow

For a financial mutation:

```text
Authenticate
→ Check role
→ Check resource access
→ Validate input
→ Validate business rule
→ Execute database transaction
→ Record audit event
→ Return result
```

---

# 21. Payment Verification Workflow

Only authorized Finance workflow may complete verification.

```text
Payment Request
→ Payment Attempt
→ External Evidence/Reference
→ Finance Review
→ Verify/Reject
→ Authoritative Financial Posting if verified
```

Opening a UPI link does not grant permission or prove payment.

---

# 22. Expense Authorization Workflow

V1 expense flow:

```text
Finance adds expense
→ bill attached
→ President receives oversight notification
→ Finance controls payment
→ payment proof attached
→ payment posted
→ expense reaches Paid when fully settled
```

President notification is an oversight mechanism, not a per-expense approval gate.

---

# 23. Financial Deletion Workflow

President-only:

```text
Open transaction
→ Confirm destructive action
→ Confirm authorization
→ Delete transaction
→ Recalculate affected balances
→ Write audit event
```

Client-side removal must never be treated as successful deletion.

---

# 24. Contribution Change Workflow

Authorized roles:

```text
President
Secretary
Finance
Committee Member
```

Flow:

```text
Open member
→ Set new agreed amount
→ Select effective month
→ Validate
→ Save
→ Preserve historical monthly records
→ Audit change
```

Member cannot perform this action.

---

# 25. Referral Correction Workflow

President-only V1 correction:

```text
Open member
→ Correct primary referrer
→ Provide reason
→ Save
→ Record actor/time
→ Audit change
```

Historical financial contribution attribution must remain consistent with the corrected model according to business rules.

---

# 26. Task Authorization

### Task creation

Allowed primarily to:

```text
President
Secretary
```

Conditional operational delegation may be granted to VP/others only if explicitly specified.

### Task assignment

Must verify:

```text
Eligible responsible user
Role eligibility
Task state
```

### Open task claim

Backend must atomically enforce:

```text
first valid claim succeeds
subsequent competing claim fails
```

### Completion

Responsible member may complete their task.

### Completed work edit

Committee Member may edit their own completed work where permitted.

### Delete

Committee Member cannot delete completed work.

---

# 27. Meeting Authorization

### Create/edit

Primary:

```text
President
Secretary
```

### Attendance

Authorized meeting managers may record/correct attendance.

### Decisions

Primary:

```text
President
Secretary
```

### Follow-up tasks

May be created from decisions by authorized users.

---

# 28. Attendance Authorization

## Jummah

A logged-in eligible member may mark their own presence.

Backend verifies:

```text
Authenticated user
Current Friday/session
Location validity
Radius
Accuracy
Duplicate status
Eligibility
```

No client-only acceptance.

## Meeting

Attendance is associated with a scheduled meeting.

Backend verifies:

```text
Meeting
User
Eligibility
Duplicate status
```

---

# 29. Report Authorization

Reports must respect underlying record permissions.

Generating a report does not grant broader access.

Example:

```text
Auditor can generate authorized financial reports.
Member can view only permitted own records.
Committee Member cannot generate unrestricted private financial reports.
```

---

# 30. Audit Authorization

Audit data is sensitive.

Recommended access:

```text
President = broad
Auditor = broad review
Finance = finance-relevant audit access
Secretary = operational-relevant access
Vice President = explicitly granted
Committee Member = limited/no audit access
Member = no audit access
```

Exact scope should follow the approved role matrix and data sensitivity.

---

# 31. File Authorization

A file inherits the authorization boundary of the business record it belongs to.

Example:

```text
Expense bill
→ expense access controls

Payment proof
→ payment/expense access controls

Task attachment
→ task access controls
```

A raw storage object path must not provide access by itself.

---

# 32. API Authorization

Every sensitive endpoint should enforce:

```text
Authenticated session
+
Role permission
+
Record scope
+
Business-state validation
```

Examples:

```text
DELETE /transactions/:id
PATCH /expenses/:id
POST /payments/:id/verify
PATCH /members/:id/contribution
POST /tasks/:id/claim
POST /attendance/jummah
```

The exact route style may differ, but the authorization requirement remains.

---

# 33. Database RLS Authorization

RLS policies must reflect the intended authorization model.

Do not rely only on:

```text
frontend checks
server route checks
```

for direct database-accessible resources.

Where service-role operations are required, they must run only from trusted backend environments.

---

# 34. Service-Role Boundary

A privileged database/service-role credential must never be exposed to:

```text
Browser
Mobile app
Public API response
Client bundle
Push notification
Git repository
```

Privileged actions using service-role access must be narrow and auditable.

---

# 35. Authorization for Offline Operations

Offline operation must remain deliberately limited.

Allowed V1 offline capability:

```text
Jummah attendance capture pending synchronization
```

Not allowed as unrestricted offline actions:

```text
Financial verification
Financial deletion
Transfers
Role changes
UPI changes
Expense payment posting
```

---

# 36. Authorization Failure Behavior

When access is denied:

```text
Do not perform the action.
Do not partially mutate the record.
Do not expose unnecessary sensitive information.
Return a safe authorization error.
```

The UI should show:

```text
You do not have permission to perform this action.
```

where appropriate.

---

# 37. Object-Level Authorization

Do not stop at route-level authorization.

A user may have permission to:

```text
view tasks
```

but not necessarily every task record.

Therefore check:

```text
role
+
resource
+
relationship/scope
```

for sensitive resources.

---

# 38. State-Based Authorization

Permission may depend on record state.

Examples:

### Expense

Payment can be added only when expense is in an allowed state.

### Task

Claim is allowed only when task is open and claimable.

### Meeting

Attendance is allowed only for an appropriate scheduled meeting.

### Donation

Verification is allowed only for an eligible unverified payment.

---

# 39. Authorization and Notifications

Notifications do not grant access.

If a user receives:

```text
Task notification
Expense notification
Meeting notification
Payment notification
```

the destination record must still be authorization-checked.

---

# 40. Authorization and Search

Search results must be authorization-filtered server-side.

Do not:

```text
fetch all members
fetch all transactions
fetch all tasks
```

and rely on frontend filtering to hide unauthorized records.

---

# 41. Authorization and Reports

Report queries must apply the same authorization boundaries as normal record queries.

A user must not bypass data restrictions by requesting a report instead of a list/detail screen.

---

# 42. Authorization and Exports

PDF/CSV/print/export actions must use the same authorization rules as the underlying data.

Export must not become a permission bypass.

---

# 43. Authorization and File URLs

Private file URLs or signed URLs must be generated only after access validation.

URLs must have controlled lifetime where appropriate.

---

# 44. Authorization Testing Matrix

Each permission must be tested against:

```text
Allowed role
Unauthorized role
Unauthenticated request
Disabled user
Modified client request
Direct API request
Direct database attempt where applicable
Expired/invalid session
Record outside permitted scope
Invalid resource state
Concurrent request
```

---

# 45. Critical Authorization Tests

## Test A — Member Role Escalation

Attempt to change own role to Finance.

Expected:

```text
Denied
```

## Test B — Finance Deletion

Finance attempts to permanently delete a financial transaction.

Expected:

```text
Denied
```

## Test C — Auditor Mutation

Auditor attempts to edit financial transaction.

Expected:

```text
Denied
```

## Test D — Committee Member Verification

Committee Member attempts to verify a payment.

Expected:

```text
Denied
```

## Test E — Member Privacy

Member requests another member's donation history.

Expected:

```text
Denied / filtered
```

## Test F — Open Task Race

Two eligible users claim same task concurrently.

Expected:

```text
Exactly one succeeds.
```

## Test G — Notification Deep Link

User without permission opens a protected finance record from a notification.

Expected:

```text
Access denied.
```

---

# 46. Audit Requirements for Authorization Changes

At minimum, audit:

```text
Role created/changed
User enabled/disabled
Permission-sensitive setting changed
UPI changed
Financial authorization action
Referral correction
Contribution change
Financial correction/deletion
```

---

# 47. Permission Changes

V1 should avoid arbitrary runtime custom permission editing.

Permission definitions are application-controlled.

This reduces configuration mistakes and prevents accidental privilege expansion.

---

# 48. Role Matrix Maintenance

Any future role/permission change must update:

```text
USER_ROLES_PERMISSIONS.md
AUTHORIZATION_MODEL.md
DATABASE RLS policies
Backend authorization
Frontend navigation visibility
Screen specifications
Security tests
Acceptance criteria
```

A role change is not complete until all related layers are synchronized.

---

# 49. Implementation Rules

Frontend:

```text
Use permissions to control navigation and visibility.
```

Backend:

```text
Enforce permissions independently.
```

Database:

```text
Use RLS/policies where applicable.
```

Audit:

```text
Record material authorization/admin changes.
```

Testing:

```text
Test both allowed and denied cases.
```

---

# 50. Authorization Invariants

### Invariant 1

No user can elevate their own role.

### Invariant 2

President-only actions cannot be performed by UI manipulation.

### Invariant 3

Finance-only payment verification cannot be performed by client role spoofing.

### Invariant 4

Auditor access is read-only for financial data.

### Invariant 5

Member access is limited to permitted own records.

### Invariant 6

Committee Members cannot delete completed work.

### Invariant 7

Private files inherit record access controls.

### Invariant 8

Search/export/reporting cannot bypass authorization.

### Invariant 9

Notification links cannot bypass authorization.

### Invariant 10

Offline mode cannot bypass financial authorization.

### Invariant 11

Database authorization is not replaced by frontend visibility checks.

### Invariant 12

Open task claiming is atomic.

### Invariant 13

State-dependent actions require current server-side state validation.

### Invariant 14

Role changes are auditable.

### Invariant 15

Financial deletion is President-only.

### Invariant 16

Financial corrections follow defined authorization and reason requirements.

### Invariant 17

The Vice President receives only explicitly approved permissions.

### Invariant 18

No custom permission profile exists in V1.

---

# 51. Acceptance Criteria

Authorization is implementation-ready when:

- All seven V1 roles are represented.
- Permission identifiers are defined.
- High-level role matrix is approved.
- President-only actions are explicit.
- Finance-only actions are explicit.
- Auditor read-only boundary is explicit.
- Member own-record boundary is explicit.
- Committee Member task/referral boundary is explicit.
- Secretary operational boundary is explicit.
- VP permissions are explicitly assigned before production implementation.
- Backend authorization is required for every sensitive action.
- Database RLS/policies match the model.
- Object-level checks are defined where needed.
- State-based authorization is defined.
- File access inherits business-record permissions.
- Report/export permissions cannot bypass record permissions.
- Notification deep links are protected.
- Offline boundaries are defined.
- Authorization failures are safe.
- Critical denial tests are included.
- Authorization changes are auditable.

---

# 52. Final Authorization Rule

For every protected operation:

```text
Identity
→ Role
→ Permission
→ Record Scope
→ Record State
→ Business Validation
→ Authorized Execution
```

The absence of any required authorization condition means the operation must not proceed.

---

# 53. Related Documents

- `USER_ROLES_PERMISSIONS.md`
- `SECURITY_REQUIREMENTS.md`
- `SECURITY_ARCHITECTURE.md`
- `AUTHENTICATION.md`
- `DATABASE_SCHEMA.md`
- `DATA_RELATIONSHIPS.md`
- `AUDIT_LOG_MODEL.md`
- `MEMBER_MANAGEMENT.md`
- `DONATION_SYSTEM.md`
- `PAYMENT_SYSTEM.md`
- `FINANCE_SYSTEM.md`
- `EXPENSE_SYSTEM.md`
- `COMMITTEE_WORK_MANAGEMENT.md`
- `MEETING_MANAGEMENT.md`
- `ATTENDANCE_SYSTEM.md`
- `REPORTING_AND_AUDIT.md`
- `SCREEN_SPECIFICATIONS.md`
- `TESTING_STRATEGY.md`
- `TEST_PLAN.md`
- `ACCEPTANCE_CRITERIA.md`

---

## Document Status

**Authorization Model — V1 Authorization Baseline**

This document defines the authoritative V1 authorization model for Masjid-e-Mamoor 2. Any implementation that grants access beyond these rules requires an explicit product decision and corresponding documentation update.
