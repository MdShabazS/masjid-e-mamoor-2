# Masjid-e-Mamoor 2 — User Roles & Permissions

**Document Status:** Baseline  
**Version:** 1.0  
**Product:** Masjid-e-Mamoor 2 Internal Management Application  
**Scope:** V1  
**Last Updated:** 2026-09-17

---

## 1. Purpose

This document defines the V1 roles and permission model for the Masjid-e-Mamoor 2 application.

The purpose is to ensure that:

- Users only access functions appropriate to their role.
- Financial controls are separated appropriately.
- Committee accountability information is protected.
- Administrative authority is clear.
- Sensitive records are not exposed unnecessarily.
- Backend authorization is enforced independently of the frontend.

---

# 2. V1 Roles

The application contains the following roles:

1. President
2. Vice President
3. Secretary
4. Finance / Financer
5. Auditor
6. Committee Member
7. Member

There is no separate:

- Staff role
- Volunteer role
- Read-Only role
- Custom permission-profile role

---

# 3. Core Authorization Principles

## 3.1 Backend Enforcement

Permissions must be enforced on the backend/server side.

Frontend visibility alone must never be treated as authorization.

For every protected operation:

```text
User Request
    ↓
Authentication Check
    ↓
Role/Permission Check
    ↓
Resource/Record Check
    ↓
Business Rule Check
    ↓
Allow or Reject
```

---

## 3.2 Least Privilege

Users should receive only the access needed for their responsibilities.

A role should not automatically receive financial or administrative control merely because it has broad visibility.

---

## 3.3 President as Super Admin

The President is the primary Super Admin for V1.

The President has overall control of:

- Users
- Roles
- Members
- Attendance
- Committee work
- Meetings
- Finance
- Accounts
- Expenses
- Reports
- Settings
- Audit/review
- Administrative corrections

Specific destructive actions remain subject to audit controls.

---

# 4. Permission Categories

Permissions are grouped into the following functional areas.

| Category | Description |
|---|---|
| Authentication | Login/session/security operations |
| Users | User and role administration |
| Members | Member records |
| Referrals | Committee referral attribution |
| Donations | Monthly and additional donations |
| Payments | Payment-link and payment-verification workflow |
| Finance | Accounts and financial transactions |
| Expenses | Expense and payment management |
| Committee Work | Tasks and work records |
| Meetings | Meetings, decisions and follow-ups |
| Attendance | Jummah and meeting attendance |
| Reports | Reports and PDF outputs |
| Audit | Activity/audit-log access |
| Settings | Important Masjid/application configuration |
| Notifications | Operational notifications |

---

# 5. Permission Matrix — High Level

The following is the current V1 baseline.

Legend:

- **FULL** = create/read/update/delete or full operational control within the role's area
- **MANAGE** = operational create/update and relevant management access
- **CREATE** = may create records
- **READ** = read/view only
- **OWN** = access to own records
- **LIMITED** = access only to specifically authorized functions
- **NONE** = no access

| Area | President | Vice President | Secretary | Finance | Auditor | Committee Member | Member |
|---|---|---|---|---|---|---|---|
| Authentication | FULL | OWN | OWN | OWN | OWN | OWN | OWN |
| User/Role Administration | FULL | TBD | TBD | TBD | NONE | NONE | NONE |
| Member Management | FULL | TBD | LIMITED/TBD | LIMITED/TBD | READ/TBD | CREATE via referral | OWN/LIMITED |
| Referral Management | FULL | TBD | TBD | READ/TBD | READ/TBD | CREATE/OWN | NONE |
| Monthly Donation Amount | FULL | TBD | MANAGE | MANAGE | READ | CREATE/UPDATE referral records | READ OWN |
| Donation Records | FULL | TBD | LIMITED/TBD | MANAGE | READ | READ relevant contribution | READ OWN |
| UPI Configuration | FULL | TBD | NONE/TBD | MANAGE | READ | NONE | NONE |
| Payment Verification | FULL | TBD | NONE/TBD | FULL | READ | NONE | NONE |
| Finance Accounts | FULL | TBD | LIMITED/TBD | MANAGE | READ | NONE | NONE |
| Expenses | FULL | TBD | NONE/TBD | MANAGE | READ | NONE | NONE |
| Financial Deletion | FULL | NONE/TBD | NONE | NONE | NONE | NONE | NONE |
| Committee Tasks | FULL | TBD | MANAGE | LIMITED/TBD | READ/TBD | OWN/MANAGE assigned work | NONE |
| Committee Work History | FULL | TBD | READ/MANAGE | READ/TBD | READ/TBD | OWN | NONE |
| Meetings | FULL | TBD | MANAGE | READ/TBD | READ/TBD | READ/ATTEND | LIMITED |
| Meeting Decisions | FULL | TBD | MANAGE | READ/TBD | READ/TBD | READ | NONE |
| Jummah Attendance | FULL | TBD | MANAGE | READ/TBD | READ/TBD | OWN | OWN |
| Meeting Attendance | FULL | TBD | MANAGE | READ/TBD | READ/TBD | OWN | NONE |
| Financial Reports | FULL | TBD | READ/TBD | FULL | FULL | LIMITED/TBD | NONE |
| Committee Reports | FULL | TBD | FULL | READ/TBD | READ/TBD | OWN | NONE |
| Audit Log | FULL | TBD | READ/TBD | READ financial events | FULL audit review | LIMITED/TBD | NONE |
| Important Settings | FULL | TBD | MANAGE specified | MANAGE finance-specific | READ | NONE | NONE |
| Notifications | FULL | TBD | MANAGE relevant | MANAGE relevant | READ/relevant | OWN | OWN |

**Important:** `TBD` means the permission is intentionally not finalized in this document and must be confirmed before implementation of that area.

---

# 6. President / Super Admin

## 6.1 General Authority

The President has overall administrative control over the application.

### User and Role Administration

President can:

- Add users where supported by the final onboarding flow.
- Remove/deactivate users.
- Assign roles.
- Change roles.
- Review users.
- Manage administrative access.

The President is the expected authority for role management.

---

## 6.2 Member Management

President can:

- View members.
- Add/register members where required.
- Edit member information.
- View referral relationships.
- Correct referral attribution.
- Manage authorized member information.
- View member donation history.

---

## 6.3 Referral Management

President can:

- View all referrals.
- View referral counts.
- View contribution attributed through referrals.
- Correct incorrect referrer attribution.
- Review attribution changes.

---

## 6.4 Donations

President can:

- View donation records.
- View monthly donation schedules.
- View outstanding donations.
- View verified donation history.
- Enter/change authorized monthly donation amounts.
- Review donation information.

---

## 6.5 Finance

President has overall financial administration access.

President can:

- View accounts.
- View balances.
- View transactions.
- Review expenses.
- Review payments.
- Review transfers.
- Access financial reports.
- Delete financial transactions subject to audit controls.
- Perform authorized financial corrections.

Finance remains the normal operational controller for day-to-day finance actions.

---

## 6.6 Committee Work

President can:

- Create tasks.
- Assign tasks.
- Open tasks for volunteers.
- View all tasks.
- View all work history.
- View member-specific work records.
- Monitor pending/in-progress/completed/overdue work.
- Review committee progress.
- View contribution and referral information.

---

## 6.7 Meetings

President can:

- Create meetings.
- Schedule meetings.
- Record agenda.
- View attendance.
- Record/review decisions.
- Create follow-up tasks.
- View meeting history.

---

## 6.8 Attendance

President can:

- View Jummah attendance.
- View meeting attendance.
- Correct attendance where authorized.
- Review attendance history.

---

## 6.9 Settings

President can manage important Masjid/application settings subject to the final settings design.

---

# 7. Vice President

## 7.1 Status

The exact V1 permission set for the Vice President has not yet been finalized.

This is intentional.

The role exists in the V1 role model, but its exact operational authority must be defined before implementation of role-specific functions.

## 7.2 Current Constraint

Until finalized, the system must not silently assume that Vice President has:

- Full financial control
- User/role administration
- Financial deletion
- UPI configuration
- Expense control
- Audit administration

These permissions must be explicitly approved.

## 7.3 Implementation Rule

Any permission marked `TBD` for Vice President must remain configuration-driven and documented before production use.

---

# 8. Secretary

The Secretary is a senior administrative/operations role.

## 8.1 Current Confirmed Responsibilities

Secretary has broad operational access for:

- Committee operations
- Meetings
- Decisions/minutes
- Tasks
- Attendance
- Prayer/Jummah operational records where applicable
- Authorized member/donation administration
- Jummah cash collection entry

## 8.2 Financial Limitation

Secretary does not have general financial control equivalent to Finance.

Secretary can enter **Jummah cash collection** records.

Other financial permissions must follow the explicit matrix and final financial authorization design.

## 8.3 Monthly Donation Amount

Secretary can enter/change an authorized member's agreed monthly donation amount.

The new amount must have an effective month.

Historical records remain unchanged.

---

# 9. Finance / Financer

Finance is the primary operational financial role.

## 9.1 Donations

Finance can:

- Verify actual payments.
- Record transaction/reference IDs.
- Confirm verified donation status.
- Maintain donation verification information.
- Review outstanding donation records.

## 9.2 UPI

Finance can:

- Enter the Masjid's active UPI ID.
- Change the active UPI ID.
- Maintain one active UPI ID at a time.

UPI-ID changes must be logged.

---

## 9.3 Accounts

Finance can manage financial accounts operationally, including:

- Create account where authorized
- Set opening balance where authorized
- Record transactions
- View balances
- Record transfers
- Deactivate accounts where authorized
- Review account history

Exact destructive permissions remain subject to the final detailed finance authorization design.

---

## 9.4 Expenses

Finance can:

- Add expenses.
- Upload bills.
- Record payments.
- Upload payment proofs.
- Manage multiple payments.
- Mark appropriate expense states.
- Cancel unpaid expenses.
- Correct expense amounts with a mandatory reason.
- Replace/delete payment proof where allowed.
- Review financial impact.

Finance is the **operational controller/final operational authority for expenses**.

There is no separate President approval step for every expense.

---

## 9.5 Jummah Cash Collection

Finance can record Jummah cash collection totals.

---

# 10. Auditor

The Auditor is a review-focused role.

## 10.1 Access

Auditor can review:

- Financial transactions
- Account balances
- Donations
- Expenses
- Payments
- Transfers
- Financial reports
- Audit information
- Historical records

## 10.2 Restrictions

Auditor does not have authority to:

- Create financial transactions
- Edit financial transactions
- Delete financial transactions
- Approve operational financial actions
- Change UPI configuration
- Modify user roles

## 10.3 Purpose

The Auditor's access exists to provide independent review/inspection of financial and audit records without operational financial control.

---

# 11. Committee Member

The Committee Member is an operational contributor.

## 11.1 Referral

A Committee Member can:

- Add a referred person.
- Enter name and mobile number.
- Trigger duplicate-number validation.
- Record the agreed monthly donation amount.
- Associate the new member with themselves as primary referrer.
- View their referral records.

The member is created immediately when the person is new.

---

## 11.2 Monthly Donation Amount

Committee Member can enter/change an authorized member's agreed monthly donation amount according to the product rules.

The final effective month must be stored.

---

## 11.3 Contribution Visibility

Committee Member can see their relevant contribution information, including:

- Members referred
- Verified donations through referrals
- Applicable donation history
- Relevant pending contribution information

The exact extent of member-level financial visibility must follow the final privacy rules.

---

## 11.4 Committee Work

Committee Member can:

- View assigned work.
- View eligible open tasks.
- Claim an open task.
- Work on assigned/claimed tasks.
- Add progress updates.
- Mark work completed.
- Add completion notes.
- Edit their own completed work records according to the audit rules.
- View their own work history.

They cannot delete completed work records.

---

## 11.5 Meeting Participation

Committee Member can:

- View meetings for which they are invited/authorized.
- View relevant meeting details.
- Attend scheduled meetings.
- Have attendance recorded.

---

## 11.6 Restrictions

Committee Member cannot:

- Manage other users' roles.
- Delete financial records.
- Control financial accounts.
- Configure Masjid UPI settings.
- Modify another committee member's complete work history.
- View other members' complete private work records unless explicitly authorized.

---

# 12. Member

The Member is the normal registered Masjid member.

## 12.1 Profile

Member can view/manage their permitted profile information.

## 12.2 Donations

Member can:

- View their monthly donation amount.
- View due/pending/paid donation records.
- Receive payment links.
- Make monthly payments through the payment flow.
- Make additional General Donations.
- View their own donation history.
- View outstanding amounts.

## 12.3 Additional Donations

Member can enter any additional donation amount.

It is categorized as:

**General Donation**

The donation does not modify the agreed monthly amount.

## 12.4 Restrictions

Member cannot:

- Change their fixed monthly donation amount directly.
- Change referral attribution.
- Modify financial verification.
- Modify financial records.
- Manage other members.
- Manage committee tasks.
- Manage roles.

---

# 13. Financial Permission Separation

The V1 model intentionally separates financial responsibilities.

```text
President
   ↓
Overall Financial Administration
   ↓
Finance
   ↓
Operational Finance + Verification + Expenses
   ↓
Auditor
   ↓
Independent Review
```

Secretary may perform specifically authorized financial entry such as Jummah cash collection, but does not become the Finance role.

---

# 14. Deletion Permissions

## Financial Records

Financial transaction deletion is restricted to the President.

## Committee Work

Committee Members cannot delete completed work records.

## User/Role Data

President is the expected authority for adding/removing users and assigning/changing roles.

## Historical Data

Records required for financial, audit, or committee accountability must not be deleted merely to save storage.

---

# 15. Record-Level Authorization

Role-level permissions alone are not sufficient.

The backend should also evaluate whether the user is allowed to access the specific record.

Examples:

```text
Committee Member
→ Can view own work history
→ Cannot automatically view another member's complete work history
```

```text
Member
→ Can view own donation records
→ Cannot view another member's donation records
```

```text
Auditor
→ Can read financial records
→ Cannot modify those records
```

---

# 16. Sensitive Data Rules

The following should receive restricted access:

- Mobile numbers
- Financial transactions
- UPI references
- Bills
- Payment proofs
- Committee work records
- Attendance
- Audit information
- Role/user administration

Push notifications must not unnecessarily expose sensitive financial information.

---

# 17. Audit Requirements for Permission-Sensitive Actions

The following actions must be auditable where applicable:

- User creation/deactivation
- Role changes
- Referral attribution changes
- Monthly donation amount changes
- UPI-ID changes
- Financial transaction creation/edit/delete
- Expense/payment actions
- Attendance corrections
- Important settings changes

Audit records should include:

```text
Who
What
Record
When
Result
```

---

# 18. Permission Implementation Requirements

The application should implement authorization as explicit policies rather than relying only on UI conditions.

A protected operation should have a server-side rule such as:

```text
canPerform(user, action, resource)
```

The exact implementation technology will be defined in the architecture/security documents.

---

# 19. Permission Change Process

Permissions must not be changed casually in code.

A change affecting:

- Financial control
- User administration
- Privacy
- Committee work visibility
- Audit access
- Destructive actions

must first be reflected in this document and related security requirements.

---

# 20. Outstanding Role Decisions

The following items are intentionally unresolved and must be decided before the relevant implementation begins:

### Vice President

Exact V1 permissions.

### Committee Member

Exact visibility of financial/member information beyond their own referrals and contribution-related records.

### Secretary

Exact boundaries for member management, donation records, reporting, and other finance-adjacent operations.

### Finance

Any exceptional administrative permissions outside normal financial operations.

These are product decisions, not implementation details, and must not be silently inferred.

---

# 21. V1 Authorization Checklist

Before production release, verify:

- [ ] Every role exists.
- [ ] Every protected API endpoint has backend authorization.
- [ ] Every sensitive record has record-level access checks.
- [ ] President permissions are implemented.
- [ ] Finance permissions are implemented.
- [ ] Auditor read-only restrictions are enforced.
- [ ] Committee Member self/assigned-record boundaries are enforced.
- [ ] Member self-record boundaries are enforced.
- [ ] Financial deletion is President-only.
- [ ] Role management is President-controlled.
- [ ] Referral-attribution changes are audited.
- [ ] Monthly amount changes are audited.
- [ ] UPI-ID changes are audited.
- [ ] Financial changes are audited.
- [ ] Attendance corrections are audited.
- [ ] Unauthorized API calls are rejected even if a user bypasses the frontend.

---

# 22. Related Documents

This document should be used with:

- `PROJECT_OVERVIEW.md`
- `PRODUCT_REQUIREMENTS.md`
- `FEATURE_SCOPE.md`
- `SYSTEM_ARCHITECTURE.md`
- `SECURITY_ARCHITECTURE.md`
- `DATABASE_ARCHITECTURE.md`
- `AUDIT_LOG_MODEL.md`
- `DEVELOPMENT_TASKS.md`

---

## Document Status

**User Roles & Permissions — V1 Baseline**

This document contains the currently confirmed authorization model and explicitly identifies unresolved role boundaries.

No unresolved permission should be guessed during implementation.
