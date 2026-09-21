# Masjid-e-Mamoor — V1 Permission Catalogue

**Document Status:** Implemented seed vocabulary; remaining trusted-operation/RLS details under review
**Version:** 1.0
**Phase:** Authorization Design
**Repository:** `MdShabazS/masjid-e-mamoor-2`

---

## 1. Purpose

This document defines the canonical V1 permission vocabulary for Masjid-e-Mamoor. It translates the approved role capability model into stable permission identifiers seeded by `supabase/migrations/20260920185000_authorization_permission_catalogue.sql`. Exact RLS predicates, trusted-operation boundaries, and future renames remain controlled implementation work.

---

## 2. Authorization Principles

- Authentication establishes identity.
- Authorization establishes permitted capabilities.
- Permissions are assigned at role level.
- V1 does not support arbitrary per-user permission overrides.
- Resource ownership, assignment, and organizational scope are separate from the permission itself.
- UI visibility is never a security boundary.
- Sensitive operations require trusted backend/database enforcement.
- RLS remains a database security boundary.
- Permission checks must use backend-controlled authorization state.
- Permission identifiers must remain stable and understandable.

---

## 3. Canonical Naming Convention

V1 uses:

`domain.resource.action`

Examples:

```text
membership.members.read
donations.payments.verify
finance.expenses.approve
committee.tasks.manage
attendance.records.create
reports.finance.read
audit.records.read
```

---

## 4. Permission Catalogue

### 4.1 Identity

| Permission | Description |
|---|---|
| `identity.profile.read` | Read the caller's authorized application profile |
| `identity.profile.update` | Update the caller's permitted profile fields |

### 4.2 Administration

| Permission | Description |
|---|---|
| `administration.users.manage` | Manage application-user administration through authorized workflows |
| `administration.roles.assign` | Assign an approved application role through an authorized workflow |
| `administration.permissions.manage` | Manage role-permission administration through an authorized workflow |

### 4.3 Membership

| Permission | Description |
|---|---|
| `membership.members.read` | Read member information within authorized scope |
| `membership.members.create` | Create member records through an authorized workflow |
| `membership.members.update` | Update member records within authorized scope |
| `membership.referrals.create` | Create authorized referral registrations |
| `membership.lifecycle.read` | Read membership lifecycle/history within authorized scope |

### 4.4 Donations

| Permission | Description |
|---|---|
| `donations.obligations.read` | Read donation obligations within authorized scope |
| `donations.payments.create` | Submit/create payment records within authorized scope |
| `donations.payments.proof_upload` | Upload payment proof within authorized scope |
| `donations.payments.verify` | Verify payment through the trusted financial workflow |
| `donations.payments.allocate` | Allocate a verified payment through the trusted allocation workflow |
| `donations.obligations.manage` | Manage donation obligations through authorized workflows |
| `donations.additional.create` | Record an additional donation within authorized scope |
| `donations.anonymous.create` | Record an anonymous donation through an authorized workflow |
| `donations.jummah.create` | Record Jummah cash donation through an authorized workflow |
| `donations.reports.read` | Read donation reports within authorized scope |

### 4.5 Finance

| Permission | Description |
|---|---|
| `finance.accounts.read` | Read authorized financial accounts |
| `finance.accounts.manage` | Manage financial accounts through authorized workflows |
| `finance.transactions.read` | Read authorized financial transactions |
| `finance.transfers.create` | Create financial transfers |
| `finance.transfers.approve` | Approve/verify transfers subject to maker/checker rules |
| `finance.expenses.create` | Create/submit expenses |
| `finance.expenses.approve` | Approve expenses subject to maker/checker rules |
| `finance.corrections.create` | Initiate authorized financial corrections |
| `finance.cancellations.create` | Existing seeded key for initiating authorized financial reversals; retained for migration compatibility until a future approved rename/migration occurs |
| `finance.reconciliation.manage` | Perform authorized financial reconciliation |
| `finance.reports.read` | Read authorized financial reports |
| `finance.proofs.read` | Read authorized financial proofs and bills |

### 4.6 Committee

| Permission | Description |
|---|---|
| `committee.tasks.read` | Read assigned/authorized committee tasks |
| `committee.tasks.manage` | Manage authorized committee tasks |
| `committee.tasks.assign` | Assign committee tasks |
| `committee.meetings.read` | Read authorized meeting information |
| `committee.meetings.manage` | Manage authorized meetings |
| `committee.attendance.record` | Record authorized committee/meeting attendance |

### 4.7 Attendance

| Permission | Description |
|---|---|
| `attendance.records.read` | Read attendance records within authorized scope |
| `attendance.records.create` | Create attendance records within authorized scope |
| `attendance.records.manage` | Manage/correct attendance through authorized workflows |
| `attendance.offline_sync` | Submit authorized offline attendance operations for server validation |

### 4.8 Notifications

| Permission | Description |
|---|---|
| `notifications.own.read` | Read the caller's notifications |
| `notifications.preferences.manage` | Manage the caller's notification preferences |
| `notifications.admin.manage` | Perform authorized administrative notification management |

### 4.9 Reports

| Permission | Description |
|---|---|
| `reports.operational.read` | Read authorized operational reports |
| `reports.membership.read` | Read authorized membership reports |
| `reports.donations.read` | Read authorized donation reports |
| `reports.finance.read` | Read authorized financial reports |
| `reports.audit.read` | Read authorized audit reports |

### 4.10 Audit

| Permission | Description |
|---|---|
| `audit.records.read` | Read audit records within authorized oversight scope |

---

## 5. Scope Is Separate From Permission

The following scopes are not encoded into the permission key:

- Own
- Assigned
- Authorized organizational scope
- Administrative scope
- Financial oversight scope

Example:

```text
Permission:
donations.payments.create

Possible scope:
Own payment submission

Possible scope:
Authorized Finance workflow
```

The final scope is determined by role, ownership/assignment rules, backend authorization, and RLS/trusted-operation enforcement.

---

## 6. Sensitive Operations

The following permissions must never be treated as ordinary client-side CRUD authorization:

- `administration.roles.assign`
- `administration.permissions.manage`
- `donations.payments.verify`
- `donations.payments.allocate`
- `finance.transfers.create`
- `finance.transfers.approve`
- `finance.expenses.create`
- `finance.expenses.approve`
- `finance.corrections.create`
- `finance.cancellations.create`
- `finance.reconciliation.manage`

Sensitive operations require current authorization, business-rule validation, transaction boundaries, idempotency/duplicate prevention where applicable, and auditability.

---

## 7. Role Mapping

The initial role-to-permission mapping is seeded by `supabase/migrations/20260920185000_authorization_permission_catalogue.sql`. This mapping grants role-level capabilities only; it does not bypass RLS, scope checks, maker/checker controls, trusted-operation validation, idempotency, audit, or current-state validation.

The authoritative V1 roles are:

1. President / Super Admin
2. Vice President
3. Secretary
4. Finance
5. Auditor
6. Committee Member
7. Member

No additional role is introduced by this catalogue.

---

## 8. Legacy Permission Vocabulary

Permission identifiers found under `docs/archive/legacy-v1/` are historical and are not authoritative for the V1 implementation.

Current permission identifiers are seeded in the V1 database foundation and must not be expanded without explicit approval.

---

## 9. Relationship to RLS

This catalogue does not define exact RLS predicates.

RLS implementation must separately establish:

- authenticated identity resolution
- application-user resolution
- current role resolution
- permission resolution
- ownership checks
- assignment checks
- administrative scope
- financial scope
- trusted-operation boundaries

RLS remains deny-by-default.

---

## 10. Open Review Items

The following remain explicit implementation/review items:

1. Exact domain RLS predicates beyond the authorization foundation.
2. Exact trusted-operation boundaries for each sensitive domain workflow.
3. Exact SQL/resource predicates implementing the approved Own, Assigned, Organizational, and Full access rules without widening scope.
4. Whether the seeded key `finance.cancellations.create` should be renamed in a future migration to match the approved reversal terminology. No migration is changed by this documentation note.
5. Exact treatment of President/VP/Secretary permissions marked as "Explicit grant" in the role matrix.

---

## 11. Approval Gate

This document must be reviewed before:

- changing seeded V1 permission records;
- changing role-permission mappings;
- implementing new permission-based RLS helpers;
- adding any future permission migration.
