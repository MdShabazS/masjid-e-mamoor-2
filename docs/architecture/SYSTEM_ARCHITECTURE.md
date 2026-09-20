# Masjid-e-Mamoor — System Architecture

**Document Status:** Draft — Architecture Review Required

**Version:** 1.1

**Phase:** Phase 7 — Application Architecture

**Repository:** `MdShabazS/masjid-e-mamoor-2`

---

## 1. Purpose and Scope

This document defines the technical architecture for the Masjid-e-Mamoor management platform.

The system is designed as one shared application platform serving web and mobile users, administrative roles, finance users, committee users, and regular members. It provides a single source of truth for organizational, membership, financial, attendance, task, notification, and reporting data.

The architecture must support real-time updates where appropriate while maintaining strict authorization, data integrity, auditability, offline operational reliability, and clear boundaries between client presentation and trusted business operations.

This document is the foundation for the detailed architecture documents listed in [Section 14](#14-documentation-sequence).

---

## 2. Technology Stack

The technology stack is fixed for this architecture:

- Next.js App Router
- Expo / React Native
- TypeScript
- Supabase
- PostgreSQL
- PostgreSQL Row Level Security (RLS)
- Supabase Auth
- Supabase Storage
- TanStack Query
- React Hook Form
- Zod
- pnpm monorepo

No separate application, database, or replacement technology is introduced by this document.

---

## 3. Architectural Principles

The following principles are mandatory unless explicitly changed through an approved architecture decision.

### 3.1 Single Authoritative Backend

All authoritative application data resides in the central Supabase/PostgreSQL backend. Web and mobile applications must not maintain independent authoritative datasets.

### 3.2 One Application, Role-Aware Presentation

One application serves:

- President / Super Admin
- Vice President
- Secretary
- Finance
- Auditor
- Committee Member
- Member

Role-specific UI is presentation only. All authorized role views operate against the same authoritative backend, shared domain contracts, authorization rules, and data model. Roles are not implemented as separate applications or separate databases.

### 3.3 Authentication Versus Authorization

Authentication establishes identity: it answers, “Who is this user?” Supabase Auth provides the authenticated identity.

Authorization determines permissions: it answers, “What is this user allowed to do?” Authorization is evaluated from trusted backend-controlled identity, profile, role, and permission data.

Client-controlled role state, route state, hidden controls, or local claims must never be the authoritative authorization mechanism. The client may render an appropriate experience, but every protected read and mutation must be checked at trusted backend and database boundaries.

Conceptually:

```text
Supabase Auth identity
        |
        v
Application profile and backend-controlled role assignment
        |
        v
Authorization evaluation
        |
        v
Trusted operation and/or RLS
```

### 3.4 Client Data Access Versus Trusted Operations

Ordinary data access remains subject to authentication, authorization, and RLS. Client data-access code may query and mutate data only within those enforced policies.

Sensitive business operations execute through trusted server/database boundaries. The client requests an operation and supplies the permitted input, but it does not determine authoritative business state, final status, calculated amounts, allocation results, or audit records.

### 3.5 Defense in Depth for Invariants

Business-critical invariants must not depend solely on UI validation. Appropriate combinations of client validation, trusted server logic, database constraints, RLS, and atomic database operations must enforce each invariant.

Client validation improves usability and catches malformed input early. It does not replace trusted validation, authorization, constraints, or transaction handling.

---

## 4. Architectural Boundaries

The principal boundary for all protected business behavior is:

```text
UI
  ↓
Client Data Access
  ↓
Trusted Operation
  ↓
Authorization / RLS
  ↓
Database Constraints
  ↓
Authoritative PostgreSQL State
```

The trusted-operation stage is required for sensitive business operations. Direct ordinary data access may use authorized Supabase/PostgreSQL access subject to RLS; it must not bypass authorization or constraints.

---

## 5. Data Authority Model

The architecture explicitly distinguishes data authority:

### 5.1 Authoritative Data

PostgreSQL is the source of truth for persisted business state, including identity-linked records, permissions, financial records, attendance records, and audit records.

### 5.2 Derived Data

Balances, dashboard totals, reports, calculated summaries, and similar views are derived from authoritative PostgreSQL state. They must be reproducible or reconcilable from that state and must not become a conflicting source of truth.

### 5.3 Cached and Offline Data

TanStack Query caches, local application state, and offline persistence are representations of server state or synchronization queues. They improve responsiveness and availability but never become authoritative business records. A stale cache or derived value must be reconciled with the authoritative backend.

---

## 6. Financial Integrity and Atomic Operations

The client must never be the authority for final financial state. The following are sensitive trusted and atomic operations:

- Payment verification
- Donation allocation
- Combined outstanding payment
- Financial transfers
- Expense posting
- Corrections
- Cancellations

Each operation must execute through an authorized trusted boundary, validate its inputs and current state, enforce relevant database constraints, and produce an auditable result. Sensitive financial operations must be protected against duplicate processing through stable operation/idempotency references and appropriate uniqueness or transactional checks.

### 6.1 Transaction Boundaries

Multi-record changes must use an explicit database transaction or trusted atomic operation. At minimum, the following boundaries are atomic:

- Payment verification and its allocation records
- Financial transfers and all affected account/ledger records
- Expense posting and related financial records
- Corrections or cancellations and their resulting state changes
- Audit-related state transitions where the audit record is required for a valid mutation

Partial completion must not leave authoritative records in a state that contradicts the operation result. Failure must be explicit and must not be represented as a successful mutation.

---

## 7. Database Integrity, RLS, and Storage Authorization

PostgreSQL constraints enforce structural and business-critical invariants that can be expressed at the database layer. Trusted operations enforce rules requiring calculation, sequencing, or multi-record coordination. RLS limits ordinary data access according to the authenticated user and backend-controlled authorization context.

RLS is not a substitute for transaction boundaries, and UI validation is not a substitute for RLS or database constraints. These controls are complementary.

Supabase Storage objects, including payment proofs, bills, and receipts, must not be assumed public. Object access must follow appropriate authorization and storage policies, with authenticated and role-appropriate access enforced independently of UI visibility.

---

## 8. Audit Architecture

Sensitive mutations should capture, where applicable:

- Actor
- Action
- Entity type
- Entity ID
- Timestamp
- Relevant previous state
- Resulting state
- Reason or context
- Operation or idempotency reference

Audit records must be written within the relevant trusted transaction boundary when the audit entry is part of the valid state transition. They must be protected from ordinary modification by application users and ordinary client access. Administrative access to audit data must itself be authorized and auditable.

---

## 9. Offline Architecture

Mobile operational workflows may support offline persistence and queued synchronization. Attendance should be designed as an offline-capable workflow.

Offline mutations require stable operation IDs, retry handling, explicit synchronization status, and duplicate prevention. Synchronization must revalidate authorization and applicable invariants against the authoritative backend; retries must be safe and idempotent.

Financial state must not be freely edited offline and later merged. An offline financial workflow may be introduced only through a separately reviewed architecture decision that defines its trust model, conflict handling, authorization, atomicity, and audit behavior.

---

## 10. Realtime and Cache Reconciliation

Realtime is selective rather than indiscriminate. It should be used where immediate operational updates provide clear value, such as relevant attendance or workflow status changes, and only where the subscribing user is authorized to receive the data.

Realtime events are notifications of authoritative backend changes, not an alternate source of truth. TanStack Query remains responsible for client cache lifecycle and reconciliation: authorized events should invalidate, refetch, or update the relevant query data according to the resource's consistency needs. Mutations must reconcile their optimistic or pending client state with the committed PostgreSQL result, including errors, retries, and rejected authorization.

---

## 11. Environment Separation

The system has separate environments:

- **Development:** local or developer-integrated work using isolated test configuration and non-production data.
- **Staging/validation:** an integration and acceptance environment for validating migrations, authorization, storage policies, realtime behavior, synchronization, and release candidates.
- **Production:** the live environment containing real organizational and financial data.

Backend configuration, credentials, storage buckets and policies, database access, Supabase Auth configuration, redirect URLs, and environment secrets must be appropriately isolated between environments. Production credentials and data must not be reused in development or staging.

---

## 12. Operational and Security Expectations

All protected reads and writes must carry authenticated identity through the trusted access path. Authorization decisions must be made from backend-controlled state. Database constraints, RLS, trusted operations, transaction boundaries, idempotency controls, and audit records must be designed together for sensitive workflows.

Errors from authorization, validation, constraint, transaction, or synchronization failures must remain explicit to the caller and must not be converted into success-shaped client state.

---

## 13. Web Application Architecture

The web application uses Next.js App Router and TypeScript. Tailwind CSS provides styling, and shadcn/ui-style components provide accessible, composable interface primitives. React Hook Form and Zod support form state and client-side schema validation. TanStack Query manages server-state fetching, caching, mutation state, and reconciliation. Supabase web integration provides the client connection to Supabase Auth, authorized data access, Storage, and selectively enabled Realtime channels.

These web technologies are presentation and client-access tools. They do not replace backend authorization, RLS, database constraints, or trusted operations.

## 14. Mobile Application Architecture

The mobile applications use Expo, React Native, and TypeScript. TanStack Query manages server state and synchronization; React Hook Form and Zod support forms and input validation; Secure Store protects appropriate device-held session and credential material.

Mobile-specific operational workflows include attendance and other approved field workflows that may need offline persistence and queued synchronization. Mobile clients use the same authoritative backend and must follow the offline restrictions and stable operation/idempotency requirements in [Section 9](#9-offline-architecture).

## 15. Domain Architecture

The backend and shared contracts are organized around these domains:

- **Identity:** authenticated identities, profiles, and backend-controlled role assignments.
- **Membership:** member records, household or membership relationships, and member lifecycle data.
- **Donations:** donation obligations, donation history, payment records, allocations, and donation intake.
- **Finance:** accounts, transfers, expenses, corrections, cancellations, reconciliation, and financial reporting.
- **Committee Operations:** committee work, tasks, meetings, referrals, and accountability records.
- **Attendance:** attendance events and attendance workflows, including approved offline capture.
- **Notifications:** notification records, preferences, delivery, and delivery status.
- **Audit:** protected records of sensitive mutations and state transitions.

These domains share the authoritative PostgreSQL database but retain explicit responsibilities and contracts. Cross-domain mutations use trusted operations and explicit transaction boundaries where required.

## 16. Donation and Payment Architecture

The donation domain supports the established project requirements:

- Donation obligations, including effective month and history
- Payments and partial payments
- FIFO allocation where applicable
- Outstanding amounts and overpayment handling
- Additional donations
- Anonymous donations
- Jummah cash donations
- UPI intent/deep-link flow
- Finance/manual verification
- Future-month donation rules

Payment intake may begin in the web or mobile client, including a UPI intent/deep-link flow or an uploaded proof. The client submits the request and supporting information; it does not mark a payment as final, decide authoritative allocation, or determine outstanding balances.

Finance/manual verification is an authorized trusted workflow. Payment verification and allocation execute as one trusted atomic operation, with duplicate processing prevented by operation/idempotency references and relevant database constraints. Existing donation obligation history, effective month, partial-payment, FIFO, overpayment, additional-donation, anonymous-donation, Jummah-cash, and future-month rules remain governed by the approved project requirements; this document does not introduce alternate financial rules.

## 17. Notification Architecture

Notifications consist of notification records, user notification preferences, an outbox/delivery architecture, and a push service. A committed business event may enqueue a notification through the outbox, after which delivery workers or the push service process the message and record delivery status and failures.

Delivery failure must not corrupt the underlying business transaction. Notification delivery is therefore decoupled from the transaction that creates the authoritative business state, while the outbox entry is created reliably with the relevant trusted operation where required. Retries and duplicate delivery handling must use stable references and must not duplicate or reverse the underlying business mutation.

## 18. Shared Package Architecture

The pnpm monorepo shares contracts and utilities through:

- `packages/types`: shared TypeScript domain entities, API shapes, identifiers, and result types.
- `packages/validation`: shared Zod schemas and input-validation helpers for consistent client and trusted-operation inputs.
- `packages/api-client`: typed client access, query keys, request helpers, and mutation interfaces for web and mobile.
- `packages/shared`: framework-neutral domain constants, formatting helpers, and reusable utilities.
- `packages/config`: shared TypeScript, lint, formatting, build, and environment-configuration conventions.

These packages reduce duplication and keep web and mobile contracts aligned. They are not security boundaries and cannot enforce authorization, RLS, database constraints, trusted execution, or authoritative financial state by themselves.

## 19. Deployment Architecture

The web application is intended for Vercel deployment, subject to deployment and account eligibility. Mobile applications are built and distributed through Expo/EAS.

Each deployment target connects to the corresponding Supabase environment: development, staging/validation, or production. Appropriate environment configuration must isolate project URLs, publishable client configuration, redirect settings, storage policies, authentication configuration, and server-only credentials. Production secrets and data must not be reused in development or staging.

## 20. Testing Architecture

Testing must cover the architecture at multiple levels:

- **Unit tests:** domain calculations, validation, allocation helpers, formatting, and shared utilities.
- **Integration/database/RLS tests:** trusted operations, PostgreSQL constraints, transaction boundaries, authorization policies, Storage policies, and audit behavior.
- **End-to-end tests:** critical web workflows across authentication, role-aware views, payments, verification, reporting, and notifications.
- **Mobile tests:** React Native/Expo screens, mobile workflows, Secure Store integration boundaries, and platform-specific behavior.
- **Offline/synchronization tests where applicable:** queued attendance mutations, stable operation IDs, retries, duplicate prevention, conflict/error handling, and reconciliation with authoritative server state.

Financial integrity, authorization, and RLS tests must not be replaced by UI-only tests.

## 21. Repository Architecture

The planned pnpm monorepo separates applications, shared packages, and architecture documentation:

```text
apps/
  web/                 # Next.js App Router web application
  mobile/              # Expo / React Native application
packages/
  types/
  validation/
  api-client/
  shared/
  config/
docs/
  architecture/
    SYSTEM_ARCHITECTURE.md
    ROLE_PERMISSION_MATRIX.md
    DATABASE_ARCHITECTURE.md
    RLS_SECURITY_MODEL.md
    REALTIME_DATA_FLOW.md
    AUTHENTICATION_ARCHITECTURE.md
    OFFLINE_SYNC_ARCHITECTURE.md
```

The repository structure supports shared contracts and consistent tooling; it does not create separate sources of truth or bypass the architectural boundaries above.

## 22. Architectural Decision Summary

| Area | Current decision |
|---|---|
| Web | Next.js App Router, TypeScript, Tailwind CSS, shadcn/ui-style components, React Hook Form, Zod, TanStack Query, Supabase web integration |
| Mobile | Expo / React Native, TypeScript, TanStack Query, React Hook Form, Zod, Secure Store, mobile-specific operational workflows |
| Backend | Supabase trusted server/database boundaries and shared domain operations |
| Database | PostgreSQL as the authoritative source of truth |
| Authorization | Backend-controlled authorization enforced with RLS and trusted operations; client role state is not authoritative |
| Authentication | Supabase Auth establishes identity |
| Storage | Supabase Storage with authorization and storage policies; sensitive objects are not assumed public |
| Server state | TanStack Query caches and reconciles server state; caches are not authoritative |
| Forms | React Hook Form |
| Validation | Zod plus trusted server logic and database constraints |
| Realtime | Selective authorized Realtime, reconciled through TanStack Query |
| Offline | Offline-capable operational workflows, especially attendance; no unrestricted offline financial editing |
| Notifications | Records, preferences, outbox/delivery architecture, push service, and failure isolation from business transactions |
| Payments | Trusted atomic verification/allocation with idempotency and auditability; established donation/payment rules retained |
| Deployment | Vercel for web subject to deployment/account eligibility; Expo/EAS for mobile; isolated Supabase environments |
| Package manager | pnpm monorepo |
| Repository/source control | Shared monorepo with `apps/`, `packages/`, and `docs/architecture/` structure |

---

## 23. Open Architecture Decisions

The following decisions are intentionally deferred to the later architecture documents. The current constraints in this document remain binding until those documents resolve the details.

| Decision area | Current architectural constraint | Follow-up document |
|---|---|---|
| Exact role-to-permission mapping | Authorization must be backend-controlled, enforced through trusted operations and RLS; client role state is not authoritative. | `ROLE_PERMISSION_MATRIX.md` |
| Final PostgreSQL schema, table design, and relationships | PostgreSQL remains the authoritative source of truth, with database constraints and atomic boundaries protecting business integrity. | `DATABASE_ARCHITECTURE.md` |
| Exact RLS policies and authorization predicates | Ordinary data access must require authentication, authorization, and RLS; sensitive operations must use trusted boundaries. | `RLS_SECURITY_MODEL.md` |
| Exact authentication and session flow | Supabase Auth establishes identity, while authorization is evaluated from backend-controlled identity and role data. | `AUTHENTICATION_ARCHITECTURE.md` |
| Exact realtime subscriptions, events, invalidation, and reconciliation rules | Realtime must be selective and authorized; TanStack Query must reconcile events with authoritative PostgreSQL state. | `REALTIME_DATA_FLOW.md` |
| Exact offline queue, synchronization, and conflict-resolution behavior | Offline support is for approved operational workflows such as attendance; mutations require stable operation IDs, retries, duplicate prevention, and no unrestricted offline financial editing. | `OFFLINE_SYNC_ARCHITECTURE.md` |

---

## 24. Documentation Sequence

The architecture documentation must be completed and reviewed in this sequence:

1. `SYSTEM_ARCHITECTURE.md`
2. `ROLE_PERMISSION_MATRIX.md`
3. `DATABASE_ARCHITECTURE.md`
4. `RLS_SECURITY_MODEL.md`
5. `REALTIME_DATA_FLOW.md`
6. `AUTHENTICATION_ARCHITECTURE.md`
7. `OFFLINE_SYNC_ARCHITECTURE.md`

This document is the foundation for the later documents. Those documents must refine these boundaries and decisions rather than introduce conflicting sources of truth or authorization models.

---

## 25. Architecture Exit Criteria

The architecture phase is complete only when:

- System boundaries are documented.
- Role boundaries are documented.
- Authorization boundaries are documented.
- Database architecture is documented.
- The RLS/security model is documented.
- The realtime strategy is documented.
- Authentication architecture is documented.
- Offline synchronization architecture is documented.
- Financial transaction boundaries are defined.
- Audit requirements are defined.
- Open decisions are resolved or explicitly deferred with an owner and follow-up decision point.

Until these criteria are met, the architecture remains a draft and implementation decisions must not silently override the boundaries in this document.
