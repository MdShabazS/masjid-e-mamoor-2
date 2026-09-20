# Masjid-e-Mamoor — Role & Permission Matrix

**Document Status:** Draft — Architecture Review Required

**Version:** 1.0

**Phase:** Phase 7 — Application Architecture

**Repository:** `MdShabazS/masjid-e-mamoor-2`

---

## 1. Purpose and Scope

This document defines the authoritative role boundaries and permission model for the Masjid-e-Mamoor management platform. It is the source document for the later database, RLS/security, authentication, realtime, and offline architecture decisions.

The system is one shared application serving all approved roles through a single authoritative Supabase/PostgreSQL backend. Role-aware UI supports usability, but UI visibility must never be treated as security. Client-controlled role state, route state, local storage, hidden buttons, and submitted role values cannot grant permission.

---

## 2. Authorization Model

**Authentication** establishes identity. Supabase Auth authenticates the user.

**Authorization** determines permissions. Backend-controlled profile, role, and permission state determines what the authenticated user may do.

```text
Supabase Auth identity
        ↓
Application profile
        ↓
Backend-controlled role
        ↓
Permission evaluation
        ↓
Trusted operation and/or RLS
        ↓
Database
```

The following are never authoritative:

- `localStorage` role state
- Client route state
- Hidden or disabled buttons
- Client-submitted role values
- Cached role or permission state

Sensitive operations must execute through trusted backend/database boundaries. Authorization is deny-by-default, least-privilege, and enforced consistently for web and mobile clients through backend authorization, trusted operations, PostgreSQL constraints, and RLS.

---

## 3. Role Definitions

### 3.1 President / Super Admin

Highest administrative authority with organization-wide administration and oversight of financial, membership, committee, attendance, and system operations. This role does not bypass database security controls merely because the UI presents an administrative role.

### 3.2 Vice President

Senior operational oversight with permitted operational, member, committee, and approval/management workflows. No unrestricted financial authority exists unless an explicit documented permission grants it.

### 3.3 Secretary

Membership, committee, and administrative operations, including meetings, tasks, referrals, and related records. No unrestricted financial verification or posting authority.

### 3.4 Finance

Financial operations including donation/payment verification, allocation, accounts, transfers, expenses, authorized corrections/cancellations, financial reports, and payment-proof handling. This role cannot arbitrarily change roles or authorization.

### 3.5 Auditor

Read-oriented oversight of required financial and audit information, including reports, transactions, proofs, and audit records. No financial mutation unless a separate explicit permission is introduced.

### 3.6 Committee Member

Assigned committee workflows, tasks, meetings, authorized attendance workflows, and limited member information required for assigned duties. No unrestricted finance administration.

### 3.7 Member

Own profile and member information, own donation obligations/history/payment submissions, own receipts/statuses, and approved member-facing attendance features. Cannot access other members' private or financial information or perform administrative mutations.

---

## 4. Permission Naming Convention

Permissions use stable lowercase identifiers in the form `domain.resource.action`, for example:

```text
membership.members.read
membership.members.create
membership.members.update
donations.obligations.read
donations.payments.create
donations.payments.verify
finance.accounts.read
finance.accounts.manage
finance.expenses.create
finance.expenses.approve
committee.tasks.manage
attendance.records.create
reports.finance.read
audit.records.read
roles.assign
```

Permissions remain granular for security-sensitive operations but are kept understandable and maintainable. This document defines capability groups; the final normalized permission records and database representation are deferred.

---

## 5. Permission Domains

- `identity`
- `membership`
- `donations`
- `finance`
- `committee`
- `attendance`
- `notifications`
- `reports`
- `audit`
- `administration`

---

## 6. Role Permission Matrix

Legend:

- **Full:** permitted for the role within assigned authorization scope; never bypasses RLS or database security.
- **Read:** read-only access within authorized scope.
- **Own:** only the user's own records.
- **Assigned:** only records or workflows assigned to the user or committee.
- **None:** no permission.

### 6.1 Identity and Profile

| Permission group | President / Super Admin | Vice President | Secretary | Finance | Auditor | Committee Member | Member |
|---|---|---|---|---|---|---|---|
| Own profile read/update | Own | Own | Own | Own | Own | Own | Own |
| Member profile read | Full | Read | Full | Read | Read | Assigned | Own |
| Member profile create/update | Full | Read | Full | None | None | None | None |
| Role assignment | Full* | None | None | None | None | None | None |
| User administration | Full* | None | None | None | None | None | None |

*\*Subject to explicit backend permission, RLS, audit, and any future approval requirements.*

### 6.2 Membership

| Permission group | President / Super Admin | Vice President | Secretary | Finance | Auditor | Committee Member | Member |
|---|---|---|---|---|---|---|---|
| View members | Full | Read | Full | Read | Read | Assigned | Own |
| Create members | Full | None | Full | None | None | None | None |
| Update members | Full | Read | Full | None | None | None | None |
| Referral registration | Full | Full | Full | None | None | Assigned | None |
| Membership lifecycle/history | Full | Read | Full | Read | Read | Assigned | Own |

### 6.3 Donations

| Permission group | President / Super Admin | Vice President | Secretary | Finance | Auditor | Committee Member | Member |
|---|---|---|---|---|---|---|---|
| View own obligations/history | Own | Own | Own | Own | Own | Own | Own |
| View member donation history | Full | Read | Read | Full | Read | Assigned | None |
| Create payment submission | Full | Own | Own | Full | None | Own | Own |
| Upload payment proof | Full | Own | Own | Full | None | Own | Own |
| Verify payment | Explicit grant | Explicit grant | None | Full | None | None | None |
| Allocate payment | Explicit grant | Explicit grant | None | Full | None | None | None |
| Manage donation obligations | Full | Read | Full | Explicit grant | Read | None | None |
| Additional donation | Full | Own | Own | Full | None | Own | Own |
| Anonymous donation | Full | None | None | Full | None | None | None |
| Jummah cash donation | Full | Full | Full | Full | None | Assigned | None |
| View donation reports | Full | Read | Read | Full | Read | None | Own |
| Future-month donation workflow | Explicit grant | Read | Read | Full | Read | None | Own |

Donation verification and allocation are trusted atomic operations. The matrix does not authorize client-side final financial state.

### 6.4 Finance

| Permission group | President / Super Admin | Vice President | Secretary | Finance | Auditor | Committee Member | Member |
|---|---|---|---|---|---|---|---|
| View accounts | Read | Read | None | Full | Read | None | None |
| Manage accounts | Explicit grant | None | None | Full | None | None | None |
| Create transfer | Explicit grant | Explicit grant | None | Full | None | None | None |
| Approve/verify transfer | Explicit grant | Explicit grant | None | Explicit grant | None | None | None |
| Create expense | Explicit grant | Explicit grant | None | Full | None | None | None |
| Approve expense | Explicit grant | Explicit grant | None | Explicit grant | None | None | None |
| Corrections | Explicit grant | Explicit grant | None | Explicit grant | None | None | None |
| Cancellations | Explicit grant | Explicit grant | None | Explicit grant | None | None | None |
| Reconciliation | Full | Read | None | Full | Read | None | None |
| Financial reports | Full | Read | None | Full | Read | None | None |
| Financial proofs/bills | Full | Read | None | Full | Read | None | None |

### 6.5 Committee

| Permission group | President / Super Admin | Vice President | Secretary | Finance | Auditor | Committee Member | Member |
|---|---|---|---|---|---|---|---|
| Manage tasks | Full | Full | Full | None | Read | Assigned | None |
| Assign tasks | Full | Full | Full | None | None | None | None |
| Manage meetings | Full | Full | Full | None | Read | Assigned | None |
| Meeting attendance | Full | Full | Full | None | Read | Assigned | None |
| Committee/member operational information | Full | Read | Full | None | Read | Assigned | None |

### 6.6 Attendance

| Permission group | President / Super Admin | Vice President | Secretary | Finance | Auditor | Committee Member | Member |
|---|---|---|---|---|---|---|---|
| Record attendance | Full | Full | Full | None | None | Assigned | Own |
| View attendance | Full | Read | Read | None | Read | Assigned | Own |
| Manage attendance | Full | Explicit grant | Explicit grant | None | None | Explicit grant | None |
| Offline attendance synchronization | Full | Full | Full | None | None | Assigned | Own submission |

Offline mutations require stable operation IDs, retries, duplicate prevention, and server revalidation.

### 6.7 Notifications

| Permission group | President / Super Admin | Vice President | Secretary | Finance | Auditor | Committee Member | Member |
|---|---|---|---|---|---|---|---|
| View own notifications | Own | Own | Own | Own | Own | Own | Own |
| Manage notification preferences | Own | Own | Own | Own | Own | Own | Own |
| Administrative notification management | Full | Explicit grant | Explicit grant | Explicit grant | None | None | None |

Notification delivery and failures must not corrupt the underlying business transaction.

### 6.8 Reports

| Permission group | President / Super Admin | Vice President | Secretary | Finance | Auditor | Committee Member | Member |
|---|---|---|---|---|---|---|---|
| Operational reports | Full | Read | Read | Read | Read | Assigned | Own |
| Membership reports | Full | Read | Full | Read | Read | Assigned | Own |
| Donation reports | Full | Read | Read | Full | Read | None | Own |
| Financial reports | Full | Read | None | Full | Read | None | None |
| Audit reports | Full | None | None | None | Full | None | None |

### 6.9 Audit and Administration

| Permission group | President / Super Admin | Vice President | Secretary | Finance | Auditor | Committee Member | Member |
|---|---|---|---|---|---|---|---|
| View audit records | Full | None | None | Read | Full | None | None |
| Administrative/audit oversight | Full | Explicit grant | None | None | Full | None | None |
| Modify/delete audit records | None through ordinary application access | None | None | None | None | None | None |
| Role assignment | Full* | None | None | None | None | None | None |
| Permission administration | Full* | None | None | None | None | None | None |
| System configuration where applicable | Full* | Explicit grant | Explicit grant | Explicit grant | None | None | None |

Audit records are protected from ordinary modification. All role and permission changes are auditable.

---

## 7. Separation of Duties

Finance handles operational financial processing. Auditor has oversight and read access rather than unrestricted mutation. President / Super Admin has administrative oversight but still operates through authorization controls.

A user does not automatically receive every financial permission merely because they are an administrator. Payment verification, financial posting, corrections, cancellations, and approval workflows require explicit permissions. Any future maker-checker or dual-approval workflow must be defined separately rather than assumed.

---

## 8. Member Data Privacy

- Users may access their own member data according to the `Own` scope.
- Other member data requires an explicit role and authorized operational scope.
- Financial and donation information is restricted to the member's own records or authorized finance, oversight, and reporting scopes.
- Payment proofs, bills, and receipts require authorization and protected Supabase Storage policies; they are not assumed public.
- Audit records are restricted to authorized oversight roles and are not ordinary member data.
- Committee operational information is limited to the information required for the assigned workflow.

Least privilege applies to every resource and operation.

---

## 9. Sensitive Operations

The following require trusted backend/database enforcement:

- Role assignment
- Payment verification
- Donation allocation
- Combined outstanding payment
- Financial transfers
- Expense posting
- Corrections
- Cancellations
- Audit-sensitive mutations

Client validation alone must never authorize these operations. They require current backend-controlled authorization, applicable RLS or trusted-operation checks, database constraints, atomic transaction boundaries, idempotency/duplicate prevention, and audit records where applicable.

---

## 10. RLS Mapping Principles

The future `RLS_SECURITY_MODEL.md` must define the exact policies. Its principles are:

- Every exposed table has appropriate RLS.
- Policies use authenticated identity and backend-controlled authorization context.
- Own-record access is explicit.
- Role-based access is explicit and scoped.
- Finance records are not broadly readable.
- Payment proofs and other Storage objects require authorization and storage policies.
- Audit records have restricted access and ordinary users cannot modify or delete them.
- RLS is not bypassed by client code.
- Service-role credentials are never exposed to web or mobile clients.

---

## 11. Permission Evaluation Rules

- Deny by default.
- Apply least privilege.
- Grant permissions explicitly.
- Do not allow implicit privilege escalation.
- Audit role changes and permission changes.
- Apply changes consistently across web and mobile.
- Refresh or reconcile cached role/permission state.
- Evaluate sensitive operations against current backend-controlled state.
- Do not treat stale client state as evidence of authorization.

---

## 12. Role-Aware UI Rules

The UI may hide unavailable actions, show role-specific dashboards, and disable unavailable workflows. These behaviors improve usability only. The UI must never be treated as the security boundary. Every protected read and mutation is independently enforced by trusted backend authorization and/or RLS.

---

## 13. Future Architecture Documents

This document feeds the following documents:

- `DATABASE_ARCHITECTURE.md`: role, permission, assignment, and relationship storage.
- `RLS_SECURITY_MODEL.md`: exact policies, predicates, helper functions, and Storage authorization.
- `AUTHENTICATION_ARCHITECTURE.md`: identity, session, and authorization-context flow.
- `REALTIME_DATA_FLOW.md`: authorized role/permission-sensitive subscriptions and cache reconciliation.
- `OFFLINE_SYNC_ARCHITECTURE.md`: role-aware queues, synchronization, retries, and conflict handling.

---

## 14. Open Decisions

Only the following decisions remain intentionally deferred:

| Decision area | Follow-up document |
|---|---|
| Roles only versus roles plus explicit permission overrides | `DATABASE_ARCHITECTURE.md` and `RLS_SECURITY_MODEL.md` |
| Exact database representation of role and permission assignments | `DATABASE_ARCHITECTURE.md` |
| Exact RLS helper functions and authorization predicates | `RLS_SECURITY_MODEL.md` |
| Exact maker-checker or dual-approval requirements for financial workflows | `DATABASE_ARCHITECTURE.md` and `RLS_SECURITY_MODEL.md` |

No deferred decision may weaken the backend-controlled authorization, RLS, trusted-operation, atomicity, idempotency, auditability, or least-privilege requirements in this document.

---

## 15. Exit Criteria

This document is complete when:

- All seven roles are defined.
- Permission domains are defined.
- Sensitive financial permissions are explicit.
- Member privacy boundaries are explicit.
- Separation of duties is documented.
- RLS mapping principles are documented.
- No client-side authorization is treated as authoritative.
- Later architecture dependencies are identified.

Until these criteria and the linked follow-up architecture decisions are satisfied, this document remains a draft.
