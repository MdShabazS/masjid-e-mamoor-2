# Masjid-e-Mamoor --- Project Master Specification

**Document Status:** Draft --- Master Product & Engineering
Specification\
**Version:** 1.0\
**Phase:** Documentation-First / Pre-Development\
**Repository:** `MdShabazS/masjid-e-mamoor-2`\
**Purpose:** Single cross-tool source of truth for the complete
Masjid-e-Mamoor platform.

------------------------------------------------------------------------

## 1. Document Purpose

This document is the top-level specification for the Masjid-e-Mamoor
management platform.

It exists so that any human developer or AI development tool can
understand the project before modifying the repository.

Every implementation tool must treat the repository documentation as the
primary project context and must not invent conflicting architecture,
business rules, roles, permissions, financial rules, or security
behavior.

This document is the master index and product-level contract. Detailed
rules belong in the specialized documents listed later.

------------------------------------------------------------------------

## 2. Product Overview

Masjid-e-Mamoor is a shared web and mobile management platform for
operating a mosque/community organization.

The platform provides a single authoritative system for:

-   user identity and role-based access
-   member registration and management
-   referrals
-   donation obligations and donation history
-   payment submission and verification
-   donation allocation
-   finance and accounting operations
-   expenses and transfers
-   committee operations
-   tasks and meetings
-   attendance workflows
-   notifications
-   reporting
-   auditability
-   protected document/proof storage
-   offline-capable operational workflows

The system is designed as **one application platform with role-aware
experiences**, not separate applications for each role.

------------------------------------------------------------------------

## 3. Core Product Principles

The following principles are mandatory:

1.  **Single source of truth** --- Supabase/PostgreSQL is the
    authoritative backend.
2.  **One shared platform** --- Web and mobile clients use the same
    backend and domain contracts.
3.  **Authentication is not authorization** --- Authentication
    identifies a user; backend-controlled authorization determines what
    the user may do.
4.  **Client UI is never a security boundary** --- Hidden buttons,
    routes, local state, or role selectors cannot grant permissions.
5.  **Database-enforced security** --- PostgreSQL RLS, database
    constraints, trusted operations, and transaction boundaries protect
    sensitive state.
6.  **Financial integrity is server-side** --- Clients cannot determine
    authoritative payment status, allocation, balances, or financial
    results.
7.  **Auditability** --- Sensitive state changes must be attributable
    and auditable.
8.  **Least privilege** --- Every role receives only the permissions
    required for its responsibilities.
9.  **Idempotency** --- Retried operations must not duplicate financial
    or attendance records.
10. **Offline-first where justified** --- Offline behavior is allowed
    for approved operational workflows, especially attendance. Offline
    financial editing is not unrestricted.
11. **Realtime is selective** --- Realtime is used where operationally
    useful and always reconciled with authoritative server state.
12. **Documentation before implementation** --- Major architecture and
    business rules are decided before feature implementation.

------------------------------------------------------------------------

## 4. Approved Technology Direction

### Web

-   Next.js App Router
-   TypeScript
-   Tailwind CSS
-   shadcn/ui-style component system
-   React Hook Form
-   Zod
-   TanStack Query
-   Supabase integration

### Mobile

-   Expo
-   React Native
-   TypeScript
-   TanStack Query
-   React Hook Form
-   Zod
-   Expo Secure Store
-   Expo/EAS distribution

### Backend

-   Supabase
-   PostgreSQL
-   Supabase Auth
-   PostgreSQL RLS
-   Supabase Storage
-   Supabase Realtime
-   trusted server/database operations

### Repository

-   pnpm monorepo
-   Git/GitHub
-   shared TypeScript contracts and validation packages

------------------------------------------------------------------------

## 5. Supported Roles

The platform has exactly seven application roles:

1.  President / Super Admin
2.  Vice President
3.  Secretary
4.  Finance
5.  Auditor
6.  Committee Member
7.  Member

Detailed permissions are defined in
`docs/architecture/ROLE_PERMISSION_MATRIX.md`.

The role list must not be silently expanded by an implementation tool.

------------------------------------------------------------------------

## 6. Major Product Domains

### Identity

-   authenticated users
-   profiles
-   roles
-   permissions
-   authorization context

### Membership

-   member records
-   member lifecycle
-   household/member relationships where approved
-   referrals
-   membership history

### Donations

-   donation obligations
-   effective month
-   obligation history
-   payment submissions
-   payment verification
-   allocation
-   partial payment
-   outstanding balances
-   overpayment
-   additional donations
-   anonymous donations
-   Jummah cash donations
-   future-month rules

### Finance

-   accounts
-   financial transactions
-   transfers
-   expenses
-   corrections
-   reversals
-   reconciliation
-   bills/proofs
-   financial reports

### Committee Operations

-   committee tasks
-   task assignments
-   meetings
-   meeting attendance
-   referrals
-   operational accountability

### Attendance

-   attendance records
-   approved offline attendance capture
-   GPS-related attendance requirements where applicable
-   synchronization and duplicate prevention

### Notifications

-   notification records
-   notification preferences
-   delivery/outbox
-   push notifications
-   delivery status and failure handling

### Reports

-   operational reports
-   membership reports
-   donation reports
-   financial reports
-   audit reports

### Audit

-   sensitive mutations
-   actor
-   action
-   entity
-   previous/resulting state where required
-   timestamp
-   reason/context
-   operation/idempotency reference

------------------------------------------------------------------------

## 7. Donation and Financial Business Rules

These rules are product requirements and must not be reinterpreted by
implementation tools.

### Donation obligations

The system must support donation obligations associated with an
effective month and historical changes.

### Payments

Payments may be submitted through supported client workflows, including
the planned UPI intent/deep-link flow and proof submission where
applicable.

The client submits information; it does not finalize payment
verification.

### Verification

Finance performs authorized manual verification.

Verification and authoritative allocation must be handled as a trusted
atomic operation.

### Partial payments

A payment may partially satisfy an outstanding obligation where
permitted.

### FIFO allocation

Where multiple eligible outstanding obligations exist, the approved
allocation model uses FIFO allocation.

### Outstanding amount

Outstanding amounts are derived from authoritative obligation and
payment/allocation state.

### Overpayment

Overpayment handling must follow the approved financial rules and must
not be silently treated as arbitrary future-month prepayment.

### Additional donation

Additional donations are represented separately from ordinary obligation
settlement where required.

### Anonymous donation

Anonymous donations must be supported without exposing donor identity to
unauthorized users.

### Jummah cash

Jummah cash donations are a supported donation intake workflow with
appropriate Finance recording and auditability.

### Future months

The system must enforce the approved future-month rules. A client must
not bypass them by manipulating request data.

### Combined outstanding payment

A combined outstanding payment is a trusted atomic operation.

### Financial corrections and reversals

Corrections and reversals are controlled operations, not ordinary
unrestricted edits.

------------------------------------------------------------------------

## 8. Financial Security Model

Financial state is authoritative only after trusted backend/database
processing.

Sensitive operations include:

-   payment verification
-   payment allocation
-   combined outstanding payment
-   account transfers
-   expense posting
-   corrections
-   reversals
-   reconciliation
-   role/permission changes affecting financial access

These operations require authenticated identity, current authorization,
validation, database constraints, appropriate transaction boundaries,
duplicate/idempotency protection, and auditability.

UI validation alone is never sufficient.

------------------------------------------------------------------------

## 9. Payment Proof and Storage

Payment proofs, bills, receipts, and other sensitive documents must use
authorized storage policies.

Sensitive storage objects must not be assumed public.

Access must be evaluated independently from UI visibility.

------------------------------------------------------------------------

## 10. Offline Requirements

Offline functionality is intentionally limited.

Operational workflows may queue mutations locally and synchronize later.
Attendance is a primary offline-capable workflow.

Offline mutations require:

-   stable operation ID
-   local pending state
-   retry handling
-   duplicate prevention
-   server revalidation
-   explicit synchronization status
-   conflict/error handling

The client must not freely edit authoritative financial state offline
and merge arbitrary changes later. Any future offline financial workflow
requires a separate architecture decision.

------------------------------------------------------------------------

## 11. Realtime Requirements

Realtime updates are selective.

Appropriate examples include operational workflow status,
attendance-related updates, relevant task state, notification state, and
other approved live operational information.

Realtime events are not a second database.

PostgreSQL remains authoritative.

TanStack Query must reconcile cache state with committed backend state.

------------------------------------------------------------------------

## 12. Notification Requirements

Notifications use a decoupled delivery architecture:

``` text
Authoritative business transaction
        ↓
Reliable outbox/event record
        ↓
Notification processing
        ↓
Push/delivery service
        ↓
Delivery status
```

Notification failure must not corrupt the underlying business
transaction.

Duplicate notification delivery must not duplicate the business
mutation.

------------------------------------------------------------------------

## 13. Reporting

Reports are derived views of authoritative backend state.

Reports must not become independent sources of truth.

Financial reports must reconcile to authoritative financial records.

Role-based access applies to reports.

------------------------------------------------------------------------

## 14. Security Requirements

Mandatory security requirements include:

-   Supabase Auth for identity
-   backend-controlled authorization
-   PostgreSQL RLS on exposed data
-   protected Storage policies
-   no service-role secret in web/mobile clients
-   least privilege
-   deny by default
-   explicit permissions
-   database constraints
-   trusted operations for sensitive workflows
-   transaction boundaries
-   idempotency
-   audit records
-   protected financial operations
-   secure session handling
-   environment separation
-   no secrets committed to Git

------------------------------------------------------------------------

## 15. Data Authority Model

### Authoritative

PostgreSQL authoritative state includes users/profile relationships,
role/permission assignments, membership records, donation obligations,
payments, allocations, finance records, attendance records, notification
records, and audit records.

### Derived

Examples include outstanding balances, dashboards, totals, reports, and
summaries.

### Cached/offline

Examples include TanStack Query cache, local UI state, and offline
queues.

Cached/offline state never overrides authoritative backend state.

------------------------------------------------------------------------

## 16. Application Architecture

The intended high-level flow is:

``` text
Web / Mobile UI
       ↓
Shared contracts and validation
       ↓
Authorized client data access
       ↓
Trusted operation where required
       ↓
Supabase / PostgreSQL / RLS
       ↓
Authoritative state
```

Sensitive operations use trusted server/database boundaries.

Ordinary authorized reads may use the normal Supabase client path
subject to RLS.

------------------------------------------------------------------------

## 17. Shared Monorepo Direction

``` text
apps/
├── web/
└── mobile/

packages/
├── shared/
├── types/
├── validation/
├── api-client/
└── config/

docs/
└── architecture/
```

Shared packages are intended for TypeScript types, DTOs/API contracts,
validation schemas, constants, formatting, framework-neutral utilities,
and design tokens where appropriate.

Platform-specific UI and navigation should remain platform-specific
unless there is a clear reason to share them.

------------------------------------------------------------------------

## 18. Development Method

Development follows:

``` text
Requirements
    ↓
Product specification
    ↓
Architecture
    ↓
Security model
    ↓
Database design
    ↓
Authentication design
    ↓
Realtime/offline design
    ↓
Implementation plan
    ↓
Development
    ↓
Unit testing
    ↓
Integration/RLS testing
    ↓
E2E testing
    ↓
Security review
    ↓
UI/integration verification
    ↓
Human acceptance
    ↓
Commit
    ↓
Deployment
```

A generated code change is not considered complete merely because it
compiles.

------------------------------------------------------------------------

## 19. Multi-AI Development Policy

Multiple AI tools may be used, including ChatGPT, Claude, Gemini,
Cursor, GitHub Copilot, Lovable, Bolt, Base44, v0, Replit, and other
suitable tools.

No tool is the permanent or exclusive development tool.

### Source of truth

The Git repository and approved documentation are the source of truth.

### AI rules

Every AI tool must:

1.  Read the relevant repository documentation before implementation.
2.  Follow the existing architecture.
3.  Avoid inventing conflicting business rules.
4.  Avoid modifying unrelated files.
5.  Explain significant architectural changes.
6.  Preserve security boundaries.
7.  Add tests for applicable behavior.
8.  Verify its work.
9.  Never assume generated code is correct without testing.
10. Avoid committing or pushing unless explicitly requested.

### Parallel AI development

Two AI tools must not simultaneously edit the same files or feature
area.

Use one implementation owner for a given change and other AI tools as
reviewers/researchers.

------------------------------------------------------------------------

## 20. Documentation-First Development

Before substantial implementation, the project documentation must
define:

-   product requirements
-   system architecture
-   role/permission model
-   database architecture
-   RLS/security model
-   authentication architecture
-   realtime architecture
-   offline synchronization
-   API/domain contracts
-   financial rules
-   notification architecture
-   testing strategy
-   deployment/operations
-   UI/UX requirements
-   development standards
-   acceptance criteria

The documents form the context package that can be supplied to any
development AI.

------------------------------------------------------------------------

## 21. Planned Documentation Set

### Product

-   `PROJECT_MASTER_SPEC.md`
-   `PRODUCT_REQUIREMENTS.md`
-   `BUSINESS_RULES.md`
-   `USER_FLOWS.md`

### Architecture

-   `SYSTEM_ARCHITECTURE.md`
-   `ROLE_PERMISSION_MATRIX.md`
-   `DATABASE_ARCHITECTURE.md`
-   `RLS_SECURITY_MODEL.md`
-   `AUTHENTICATION_ARCHITECTURE.md`
-   `REALTIME_DATA_FLOW.md`
-   `OFFLINE_SYNC_ARCHITECTURE.md`
-   `API_DOMAIN_ARCHITECTURE.md`
-   `STORAGE_ARCHITECTURE.md`
-   `NOTIFICATION_ARCHITECTURE.md`

### Financial

-   `DONATION_FINANCE_SPEC.md`
-   `FINANCIAL_INTEGRITY_SPEC.md`

### UI/UX

-   `UI_UX_SPEC.md`
-   `DESIGN_SYSTEM.md`
-   `ACCESSIBILITY_I18N_SPEC.md`

### Engineering

-   `DEVELOPMENT_STANDARDS.md`
-   `TESTING_STRATEGY.md`
-   `ERROR_HANDLING_SPEC.md`
-   `OBSERVABILITY_SPEC.md`

### Operations

-   `ENVIRONMENT_DEPLOYMENT_SPEC.md`
-   `BACKUP_RECOVERY_SPEC.md`
-   `SECURITY_OPERATIONS.md`

### AI collaboration

-   `AI_DEVELOPMENT_GUIDE.md`
-   `AI_CONTEXT_INDEX.md`

The exact file set may be refined as documentation is completed, but new
documents must not contradict approved architecture.

------------------------------------------------------------------------

## 22. Definition of Done

A feature is not complete until applicable requirements are satisfied
across:

### Product

-   intended user flow works
-   business rules are enforced
-   edge cases are handled

### Security

-   authorization is enforced
-   RLS is tested
-   sensitive data is protected
-   no client-side privilege escalation exists

### Data

-   database constraints are correct
-   transactions are atomic where required
-   duplicate operations are safe

### UX

-   loading states
-   empty states
-   validation errors
-   permission states
-   success/error feedback
-   responsive behavior

### Testing

-   unit tests
-   integration/database/RLS tests where applicable
-   E2E tests for critical flows
-   mobile tests where applicable

### Documentation

-   architecture impact documented
-   business rules documented
-   implementation notes updated where necessary

### Verification

-   lint passes
-   typecheck passes
-   tests pass
-   build passes
-   manual acceptance passes

------------------------------------------------------------------------

## 23. Current Project State

At the beginning of the documentation-first development phase:

-   repository foundation exists
-   web/mobile workspace exists
-   shared packages exist
-   development tooling is configured
-   system architecture is documented
-   role/permission architecture is documented
-   feature implementation has not yet begun as the final production
    system

The next objective is to complete the A-to-Z specification before
substantial feature development.

------------------------------------------------------------------------

## 24. Documentation Completion Rule

Before implementation begins, each critical document must have:

-   defined scope
-   explicit assumptions
-   documented business rules
-   security implications
-   dependencies on other documents
-   open decisions clearly identified
-   acceptance/exit criteria

No implementation tool should silently resolve an open architecture
decision.

------------------------------------------------------------------------

## 25. Change Control

When an implementation discovers a requirement that conflicts with this
specification:

1.  Stop the affected implementation.
2.  Identify the conflict.
3.  Document the proposed change.
4.  Review the architectural impact.
5.  Update the appropriate specification.
6.  Update dependent documents.
7.  Only then continue implementation.

The code must not become the accidental source of truth for an
undocumented architectural decision.

------------------------------------------------------------------------

## 26. Master Rule for External AI Tools

When using any external AI development tool, provide the tool with the
repository documentation first.

Recommended instruction:

> Before modifying this repository, read the project documentation under
> `docs/` and the relevant architecture documents. Treat them as the
> source of truth. Do not invent roles, permissions, financial rules,
> database behavior, authentication behavior, or security rules. If the
> requested implementation conflicts with documented architecture, stop
> and report the conflict instead of silently changing the architecture.

------------------------------------------------------------------------

## 27. Master Acceptance Criteria

The project documentation phase is complete when:

-   product scope is unambiguous
-   roles are defined
-   permissions are defined
-   business rules are documented
-   database architecture is documented
-   RLS/security model is documented
-   authentication is documented
-   realtime behavior is documented
-   offline behavior is documented
-   financial rules are documented
-   notification behavior is documented
-   UI/UX expectations are documented
-   testing strategy is documented
-   deployment/operations are documented
-   AI development workflow is documented
-   cross-document dependencies are resolved
-   remaining open decisions have explicit owners/follow-up documents

Only after this documentation baseline is accepted should broad feature
implementation begin.

------------------------------------------------------------------------

## 28. Status

**Current status: Documentation-first specification in progress.**

This master specification should evolve only through deliberate review.

It is the top-level context document for the project and should be
referenced by humans and AI development tools before substantial
implementation.
