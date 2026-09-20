# Masjid-e-Mamoor 2 — Technology Stack

**Document Status:** Recommended / Research Baseline  
**Version:** 1.0  
**Product:** Masjid-e-Mamoor 2 Internal Management Application  
**Scope:** V1  
**Research Date:** 2026-09-17  
**Last Updated:** 2026-09-17

---

## 1. Purpose

This document records the recommended V1 technology stack for Masjid-e-Mamoor 2 after reviewing current framework capabilities, free-tier limits, mobile build tooling, authentication options, hosting constraints, storage limits, notification infrastructure, and the application's zero/low-cost requirement.

The stack is designed to:

- Support Web + Android + iOS.
- Keep the architecture simple.
- Minimize infrastructure cost.
- Keep financial logic authoritative and secure.
- Support permanent financial and committee history.
- Avoid unnecessary microservices.
- Allow provider replacement later.
- Keep the development workflow suitable for a small team.

---

# 2. Recommended Stack — Summary

| Layer | Selected Technology | Decision |
|---|---|---|
| Web | **Next.js 16.x, App Router** | Selected |
| Web Language | **TypeScript** | Selected |
| Mobile | **Expo SDK 57 + React Native 0.86 stable pairing** | Selected for V1 |
| Mobile Language | **TypeScript** | Selected |
| Backend Platform | **Supabase** | Selected |
| Backend Runtime | **Supabase Edge Functions / TypeScript** | Selected |
| Database | **PostgreSQL via Supabase** | Selected |
| Database Authorization | **Postgres RLS + backend authorization** | Selected |
| Authentication | **Supabase Auth + phone OTP** | Selected architecture; SMS provider required |
| File Storage | **Supabase Storage** | Selected |
| Push Notifications | **Expo Push Service**, with native FCM/APNs underneath | Selected |
| SMS/WhatsApp | **External provider adapter** | Provider not yet selected |
| UPI | **UPI deep-link/intent payment flow** | Selected architecture; exact implementation to be validated |
| Payment Verification | **Finance manual verification in V1** | Selected |
| Web Hosting | **Vercel Hobby, subject to non-commercial eligibility** | Selected for initial V1 |
| Mobile Build/Distribution Tooling | **Expo EAS** | Selected |
| Source Control | **GitHub** | Selected |
| Package Manager | **pnpm** | Selected |
| Repository Structure | **pnpm workspace monorepo** | Selected |
| Web UI | **Tailwind CSS + shadcn/ui-style components** | Selected |
| Mobile UI | **React Native components + shared design tokens** | Selected |
| Forms | **React Hook Form** | Selected |
| Validation | **Zod** | Selected |
| Server Data / Cache | **TanStack Query** | Selected |
| Local Secure Storage | **Platform-secure storage through Expo/OS facilities** | Selected |
| PDF | **TypeScript/PDF renderer selected during implementation** | Pending detailed evaluation |
| Monitoring | **Platform logs first; dedicated monitoring provider later if required** | Initial decision |
| CI/CD | **GitHub + provider-integrated CI/CD** | Selected |
| Testing | **Vitest/Jest-equivalent + Playwright + Expo/React Native testing as appropriate** | Detailed setup pending |

---

# 3. Core Technology Decision

The V1 architecture will use:

```text
                MASJID-E-MAMOOR 2
                        │
        ┌───────────────┼────────────────┐
        │               │                │
        ▼               ▼                ▼
      WEB            ANDROID            iOS
   Next.js          Expo/RN           Expo/RN
        │               │                │
        └───────────────┼────────────────┘
                        ▼
                 Supabase Backend
                        │
        ┌───────────────┼────────────────┐
        │               │                │
        ▼               ▼                ▼
   PostgreSQL       Storage         Edge Functions
        │                                │
        └───────────────┬────────────────┘
                        ▼
                External Integrations
             OTP / SMS / WhatsApp / UPI
```

---

# 4. Why This Stack

The application has a relatively focused user population but several business-critical domains.

The stack therefore prioritizes:

- One authoritative database.
- Managed authentication.
- Managed storage.
- Server-side authorization.
- Server-side financial logic.
- Shared TypeScript across the project.
- One mobile codebase for Android and iOS.
- Minimal infrastructure administration.
- Low initial operating cost.

The application does not need a large distributed-services architecture for V1.

---

# 5. Web Framework — Next.js

## Selected

**Next.js 16.x with App Router and TypeScript**

The current Next.js documentation supports the App Router and TypeScript workflow, and the 2026 documentation identifies the 16.x line as the current major line.

Next.js provides:

- React-based application development
- App Router
- Server and Client Components
- Route/layout structure
- Server-side rendering capabilities
- Client-side navigation
- TypeScript support
- Production deployment options

### V1 usage

The Web application will provide the primary desktop/laptop administrative experience.

Major web areas:

- President dashboard
- Finance dashboard
- Auditor dashboard
- Secretary/committee operations
- Member management
- Donations
- Finance
- Expenses
- Committee work
- Meetings
- Attendance
- Reports
- Audit
- Settings

### Decision

**Next.js 16.x App Router**

Do not build the project against a Next.js canary release.

At project initialization, install the current stable compatible patch release.

---

# 6. Mobile Framework — Expo + React Native

## Selected

**Expo SDK 57 with its stable React Native 0.86 pairing**

As of the research date, Expo SDK 57 is stable and includes React Native 0.86. Expo SDK 58 was in beta in September 2026, so V1 should not depend on the beta release.

Expo provides:

- Android and iOS development from one codebase
- Native device APIs
- Notifications
- Location access
- Secure storage capabilities
- Build tooling
- App-store submission tooling
- OTA update capabilities where applicable

### Decision

Use the latest stable Expo SDK supported at implementation start.

At the research baseline date:

```text
Expo SDK 57
React Native 0.86
TypeScript
```

Upgrade to a newer stable Expo SDK only after compatibility testing.

Do not adopt an Expo beta release solely for access to a newer React Native version.

---

# 7. Backend Platform — Supabase

## Selected

**Supabase**

Supabase provides the core backend platform:

- PostgreSQL
- Authentication
- Storage
- Realtime capabilities
- Edge Functions
- Database APIs
- Row Level Security integration

This significantly reduces infrastructure management for V1.

---

# 8. Backend Runtime — Supabase Edge Functions

## Selected

**Supabase Edge Functions using TypeScript**

Edge Functions will handle server-side operations such as:

- Protected business operations
- Payment-link generation
- Payment verification orchestration
- Donation processing
- Financial operations that require server logic
- Notifications
- External provider calls
- Scheduled/background-triggered operations
- Report generation where appropriate

The exact function boundaries will be finalized in `BACKEND_ARCHITECTURE.md`.

### Important limitation

Supabase Edge Functions have platform runtime limits. The current free-plan documentation specifies limits including:

- 256 MB maximum memory
- 150 seconds maximum wall-clock duration on Free
- 2 seconds CPU time
- 100 functions per Free project

Therefore, CPU-heavy or unusually large processing must not automatically be placed into Edge Functions.

Lightweight report/PDF generation can be evaluated for Edge Functions; heavy document generation must use another appropriate execution path if required.

---

# 9. Database — PostgreSQL

## Selected

**PostgreSQL via Supabase**

PostgreSQL is appropriate because the application contains strongly relational data:

```text
Users
Roles
Members
Referrals
Donations
Payments
Accounts
Transactions
Expenses
Expense Payments
Transfers
Tasks
Work History
Meetings
Decisions
Attendance
Audit Logs
```

It also supports:

- Constraints
- Transactions
- Unique indexes
- Foreign keys
- Aggregation
- Strong data integrity
- Row-level security
- Relational reporting

---

# 10. Database Authorization — RLS

## Selected

**PostgreSQL Row Level Security + Backend Authorization**

Supabase's current documentation recommends combining database grants/policies with Row Level Security for exposed tables.

RLS will be used as an additional data-access boundary.

However:

**RLS does not replace application-level authorization.**

The application must still enforce:

- Role rules
- Business permissions
- Record ownership
- Workflow transitions
- Financial controls

---

# 11. Supabase Free-Tier Baseline

Current Supabase Free plan information includes:

- $0/month
- 2 free projects
- 500 MB database per project
- 1 GB file storage
- 5 GB egress
- 5 GB cached egress
- 50,000 monthly active users
- Free projects can pause after 1 week of inactivity

The Free plan does not include automatic database backups.

### V1 decision

The Free plan is acceptable for development and early V1 operation **only while actual usage remains within limits and a separate backup/recovery process is implemented**.

The project must not respond to storage limits by deleting financial or committee history.

If production requirements exceed the safe free-tier capacity:

**Upgrade infrastructure rather than compromise data retention.**

---

# 12. Authentication — Supabase Auth

## Selected Architecture

**Supabase Auth**

Authentication flow:

```text
Mobile Number
      ↓
OTP Request
      ↓
SMS/approved messaging provider
      ↓
OTP Verification
      ↓
Supabase Auth Identity
      ↓
Application User
      ↓
Role Authorization
```

Supabase Auth supports OTP-based authentication.

### Critical limitation

Phone authentication requires an actual messaging delivery provider.

The database/authentication platform does not make production SMS delivery free simply because the authentication service is free.

Therefore:

**OTP provider cost/availability remains a real external dependency.**

The provider must be selected separately with Indian SMS/DLT and regulatory requirements in mind.

---

# 13. OTP Provider Decision Boundary

The core application architecture will use a provider adapter:

```text
Application Auth
      ↓
OTP Provider Interface
      ↓
Selected SMS/WhatsApp Provider
```

Do not hard-code the application around one provider.

Provider selection must evaluate:

- India delivery
- DLT requirements
- OTP support
- Cost
- Reliability
- API quality
- Security
- Rate limits
- Sender/template requirements

---

# 14. Member Authentication

Registered members use:

```text
Mobile Number + OTP
```

The backend links authenticated identity to the application Member/User record.

A member cannot create a new account that bypasses the application member model.

---

# 15. Role Authorization

Roles remain application data, not client-controlled data.

The trusted identity is:

```text
Authenticated User
      ↓
Application User Record
      ↓
Role
      ↓
Authorization Policy
```

A mobile/web client must never be trusted to submit:

```text
role = "President"
```

as proof of authority.

---

# 16. File Storage — Supabase Storage

## Selected

**Supabase Storage**

Use Storage for:

- Expense bills
- Payment proofs
- Approved task attachments
- Other approved documents

The database stores:

- File metadata
- Related record
- Ownership
- Storage reference

The actual binary file remains in object storage.

---

# 17. File Storage Limit

The current Supabase Free plan includes **1 GB of file storage**.

Because the Masjid requires long-term financial documents, storage must be managed carefully.

### Storage rules

- Do not duplicate files.
- Validate file type and size.
- Prefer one canonical uploaded document.
- Store references rather than copies.
- Avoid permanently storing generated copies of the same report.
- Compress appropriate image documents where safe.
- Do not delete historical financial evidence merely to stay within a quota.

When storage capacity becomes insufficient:

**Upgrade storage/infrastructure rather than deleting required financial evidence.**

---

# 18. Push Notifications

## Selected

**Expo Push Service for the mobile application**

Expo documents its push notification service as free to use and supports notification delivery through Expo's service, while native device push tokens can also be used with FCM/APNs.

Use push for:

- Donation reminders
- Payment-link notifications
- Payment verification
- Task assignment
- Task deadlines
- Task overdue
- Task completion
- Meeting reminders
- Important administrative/security events

### Rule

Push delivery is not business-state authority.

---

# 19. FCM / APNs

Native push infrastructure ultimately relies on platform services such as:

- Firebase Cloud Messaging (Android)
- Apple Push Notification service (iOS)

Firebase currently lists Cloud Messaging as no-cost.

These services are notification infrastructure, not replacements for SMS/WhatsApp.

---

# 20. SMS and WhatsApp

## Architecture

SMS/WhatsApp are optional delivery channels behind a provider adapter.

```text
Notification Service
      │
      ├── Push
      ├── SMS
      └── WhatsApp
```

### V1 business requirement

Donation reminders/payment links should support SMS/WhatsApp where available.

### Cost principle

Do not assume SMS or WhatsApp automation is free.

The exact provider must be researched and selected according to:

- Indian delivery requirements
- DLT/template requirements
- WhatsApp Business requirements
- Pricing
- Reliability
- API support

The core application must continue functioning if these external messaging channels fail.

---

# 21. UPI Payment Architecture

## Selected V1 Approach

Use a **UPI deep-link/intent-style payment flow** rather than introducing a full payment gateway for the initial internal system.

The goal is:

```text
Application
   ↓
Generate UPI Payment Request
   ↓
Member Opens UPI App
   ↓
Member Pays Masjid UPI ID
   ↓
Finance Checks Actual Transaction
   ↓
Finance Verifies
```

### Important

The exact UPI URI/deep-link construction and app behavior must be validated against current UPI ecosystem requirements and tested with the actual UPI applications used by Masjid members.

Do not treat a redirect, deep-link return, or successful intent launch as authoritative proof of payment.

---

# 22. UPI Configuration

V1 supports:

- One active Masjid UPI ID.
- Finance can change it.
- New payment links use the current active UPI ID.
- Historical transactions remain unchanged.

UPI configuration changes must be audited.

---

# 23. Payment Gateway Decision

A full payment gateway is **not required for the V1 manual-verification model** unless research shows that it is necessary for reliable payment confirmation.

V1 intentionally uses:

```text
UPI Payment
+
Finance Verification
```

rather than introducing gateway fees and unnecessary complexity.

If automated payment verification becomes a future requirement, a gateway/provider can be added behind the payment integration boundary.

---

# 24. Web Hosting — Vercel

## Selected for Initial Web Deployment

**Vercel Hobby**

Vercel currently provides a $0 Hobby plan with automatic CI/CD and other web deployment capabilities.

### Important terms constraint

Vercel's current terms state that the Hobby plan is for **personal or non-commercial use**.

Therefore:

**Vercel Hobby may be used for this internal Masjid application only while its actual use remains consistent with Vercel's current Hobby-plan terms.**

If the project's usage no longer fits those terms, move the Web deployment to an appropriate plan/provider.

Do not base the architecture on a plan whose terms do not apply.

---

# 25. Web Deployment

Conceptually:

```text
GitHub
   ↓
Vercel
   ↓
Next.js Build
   ↓
Production Web Application
```

The frontend communicates with the backend/database through the approved secure application interfaces.

---

# 26. Mobile Build and Release — Expo EAS

## Selected

**Expo Application Services (EAS)**

Current EAS pricing lists a free tier including:

- 15 Android builds
- 15 iOS builds
- Low-priority queue
- CI/CD time allocation
- App-store submission support

This is useful for V1 development and controlled release.

Build quotas must be monitored to avoid unnecessary rebuilds.

---

# 27. App Store Fees

Infrastructure/tooling being free does not mean app-store publication is free.

Current platform requirements include:

### Google Play

A Google developer account requires a one-time registration fee.

### Apple App Store

Apple Developer Program membership is currently $99/year, with possible fee-waiver eligibility for qualifying organizations such as certain nonprofits, educational institutions, or government entities.

These are external platform costs and are not backend infrastructure costs.

---

# 28. Zero-Cost Strategy

The project should distinguish:

### Infrastructure that can be free

- GitHub
- Supabase Free
- Vercel Hobby where permitted
- Expo/EAS Free within quota
- Expo push
- FCM
- Open-source libraries

### Services likely to create cost

- SMS/OTP
- WhatsApp Business messaging
- App-store developer accounts
- Domains
- Paid storage beyond free quotas
- Paid database/compute when free capacity is exceeded

The application must be designed so that paid external services are replaceable.

---

# 29. Source Control — GitHub

## Selected

**GitHub private repository**

GitHub is the source-control system.

Repository responsibilities:

- Application source
- Database migrations
- Configuration templates
- Documentation
- Tests
- CI configuration
- Architecture records

Never commit:

- Secrets
- Production credentials
- OTP provider credentials
- Database passwords
- Private certificates
- Production data exports

---

# 30. Monorepo Strategy

## Selected

Use a TypeScript monorepo.

Conceptual structure:

```text
apps/
├── web/
└── mobile/

packages/
├── shared/
├── types/
├── validation/
├── api-client/
└── config/
```

The exact implementation may combine some packages to avoid unnecessary complexity.

---

# 31. What Should Be Shared

Share where it provides real value:

- Type definitions
- Validation schemas
- API contracts
- Business-facing DTO shapes
- Constants
- Formatting rules where platform-neutral
- Design tokens
- Utility functions that are genuinely cross-platform

---

# 32. What Should Not Be Forced to Share

Do not force Web and mobile to share:

- Identical UI components
- Platform-specific navigation
- Platform-specific interaction patterns
- Browser-only code
- Native-only code

The goal is shared logic where useful, not artificial code sharing.

---

# 33. Web UI Stack

## Selected

- Tailwind CSS
- shadcn/ui-style component architecture
- TypeScript

Use reusable components for:

- Tables
- Forms
- Cards
- Dialogs
- Status badges
- Financial summaries
- Date filters
- File uploads

Financial UI must remain clear and audit-oriented rather than visually overloaded.

---

# 34. Mobile UI Stack

## Selected

Use React Native components with a shared design-token approach.

Prioritize:

- Native platform behavior
- Accessibility
- Touch targets
- Simple navigation
- Performance
- Clear forms
- Reliable offline attendance UX

Avoid forcing desktop-style tables onto mobile.

---

# 35. Forms

## Selected

**React Hook Form**

Use for:

- Member registration
- Donation amount changes
- Expenses
- Payments
- Tasks
- Meetings
- Settings

Forms should combine local usability validation with authoritative server validation.

---

# 36. Validation

## Selected

**Zod**

Use shared validation schemas where practical.

Examples:

- Member registration
- Monetary amounts
- Dates
- Transaction IDs
- Task data
- Meeting data
- Settings

Client-side Zod validation is not a security boundary.

The server must validate independently.

---

# 37. Server Data Management

## Selected

**TanStack Query**

Use it for server-state management in clients where appropriate.

It can handle:

- Fetching
- Caching
- Refetching
- Loading states
- Mutation states
- Query invalidation

Do not cache authoritative financial state indefinitely.

---

# 38. Global UI State

Use a minimal global state approach.

Global state may include:

- Authenticated user/session representation
- Language
- Connectivity status
- Limited UI preferences

Feature data should generally remain in server-state mechanisms.

Do not introduce a large global state architecture until required.

---

# 39. Offline Storage

V1 offline behavior is limited primarily to attendance.

Potential local data:

- Pending Jummah attendance
- Pending meeting attendance
- Sync metadata
- Minimal required session/application state

Do not build offline financial accounting in V1.

---

# 40. Mobile Secure Storage

Authentication/session material requiring local persistence should use platform-secure mechanisms exposed through the selected mobile framework.

Do not store sensitive tokens or financial data in ordinary unprotected storage.

---

# 41. Database Migrations

Database changes must be versioned and committed to Git.

Conceptually:

```text
migration_001
migration_002
migration_003
...
```

Every production schema change must have a reproducible migration.

---

# 42. Database Functions / RPC

Database-level functions may be used when they improve:

- Atomic financial operations
- Aggregations
- Constraints
- Complex transactional operations

Examples:

- Financial transfer
- Payment allocation
- FIFO allocation
- Atomic attendance insertion
- Atomic task claim

Use database functions for clear transactional needs, not for arbitrary application logic.

---

# 43. Backend Business Logic

Use Edge Functions for operations that require:

- External APIs
- Secure server-side logic
- Provider credentials
- Complex orchestration
- Server-only authorization logic
- Notifications
- Payment-link generation

Use PostgreSQL transactions/functions for tightly coupled database operations.

---

# 44. Financial Logic Placement

Financial logic must not live only in:

- Web JavaScript
- Mobile JavaScript
- Client calculations

Authoritative financial calculations belong to the server/database layer.

---

# 45. PDF / Audit Report Technology

The V1 requirement is:

- Professional financial report
- Print-ready
- Downloadable
- A4-friendly
- Page numbered
- Reporting period
- Timestamp
- Financial tables
- Signature/approval area where required

The exact PDF renderer should be selected after testing candidate TypeScript-compatible libraries against:

- Tables
- Indian currency formatting
- Multi-page reports
- Hindi
- Kannada
- Urdu/RTL
- Unicode fonts
- Large-but-reasonable reports

Do not choose a renderer only because it is popular; validate multilingual output.

---

# 46. Monitoring

Initial monitoring should use:

- Hosting logs
- Supabase logs
- Application error logs
- Background job status
- Provider failure records

A dedicated monitoring platform may be introduced once production usage demonstrates a need.

Monitoring must not leak sensitive member or financial information.

---

# 47. CI/CD

The repository should use automated checks before merge/deployment.

Minimum checks:

```text
Install
  ↓
Type Check
  ↓
Lint
  ↓
Unit Tests
  ↓
Build
```

Additional integration/e2e checks should be added as the project matures.

Production deployment should occur only after the required checks pass.

---

# 48. Environment Model

Use:

```text
Development
    ↓
Staging/Test
    ↓
Production
```

Each environment requires separate configuration.

Production secrets must never be committed to Git.

---

# 49. Environment Variables

Sensitive configuration belongs in environment/secret storage.

Examples:

```text
DATABASE / SUPABASE credentials
AUTH configuration
SMS provider credentials
WHATSAPP credentials
UPI/payment integration secrets
Storage configuration
Notification provider credentials
Monitoring credentials
```

Public client configuration should contain only values intentionally safe for exposure.

---

# 50. Dependency Management

Use:

**pnpm**

Rules:

- Lock dependency versions through the lockfile.
- Review major upgrades.
- Avoid unnecessary packages.
- Remove unused dependencies.
- Run vulnerability/security checks where practical.

---

# 51. TypeScript Strategy

Use TypeScript across:

- Web
- Mobile
- Edge Functions
- Shared packages
- Validation schemas
- API contracts

The goal is to reduce mismatches between client and server data structures.

---

# 52. API Contract Strategy

The application should define typed API contracts for important backend operations.

Examples:

- Member registration
- Donation creation
- Payment verification
- Expense creation
- Task claim
- Attendance
- Reports

Shared types can be used between clients and backend where appropriate.

---

# 53. Financial API Strategy

Financial write APIs should be command-oriented rather than exposing unrestricted CRUD.

Prefer:

```text
verifyDonation()
recordExpensePayment()
createTransfer()
correctExpenseAmount()
deleteFinancialTransaction()
```

over:

```text
updateAnyFinancialRow()
```

This provides clearer business controls.

---

# 54. Authentication/API Boundary

Clients should not have direct unrestricted database access.

The preferred architecture is:

```text
Client
  ↓
Authenticated Backend/API
  ↓
Authorization
  ↓
Business Logic
  ↓
Database
```

Where direct Supabase client access is used for safe read operations, RLS must enforce the required restrictions.

Privileged service-role credentials must remain server-side.

---

# 55. Service-Role Key Security

A Supabase service-role key bypasses Row Level Security.

Therefore:

**Never place the service-role key in Web or mobile client code.**

Use it only in trusted server-side environments.

---

# 56. Storage Security

Use storage policies/RLS-compatible authorization so that:

- Members see permitted documents only.
- Committee Members see permitted work attachments only.
- Finance sees financial supporting documents.
- Auditors see permitted financial evidence.
- Unauthorized users cannot fetch files by guessing storage paths.

---

# 57. Notification Architecture

The backend emits a business event:

```text
Business Event
      ↓
Notification Service
      ↓
Push / SMS / WhatsApp
```

The business event and financial state are stored independently from delivery status.

---

# 58. Background Processing

Background processing candidates:

- Monthly donation record generation
- Pending donation reminders
- Task overdue processing
- Notification retries
- Report generation
- Temporary-file cleanup

Background jobs must be idempotent.

---

# 59. Scheduler Decision

The final scheduling mechanism should use the selected backend/platform capability rather than introducing a separate scheduler service unless required.

The project should prefer one scheduler mechanism capable of:

- Daily/monthly jobs
- Retries
- Idempotency
- Observability

---

# 60. Mobile Push Token Model

Each mobile installation may have a push token.

The backend should associate tokens with:

- User
- Platform
- App installation/device context
- Token state

Old/invalid tokens should be disabled rather than retained indefinitely.

---

# 61. Web Notifications

The V1 primary notification channels are mobile push plus SMS/WhatsApp where available.

Browser/web push should not be added unless a concrete operational need justifies it.

---

# 62. Search

Search should remain backend-driven for large datasets.

Use indexed fields for:

- Member name
- Mobile number
- Transaction ID/reference
- Expense information
- Task information

Do not download the complete financial/member database to clients for local searching.

---

# 63. Reporting

Reports use authoritative database queries.

```text
Authorized User
      ↓
Report Request
      ↓
Backend
      ↓
Database Query
      ↓
Validated Dataset
      ↓
Renderer
      ↓
PDF / Screen / Print
```

Report data should not be maintained as a separate source of truth.

---

# 64. Caching

Use caching only where safe.

Safe candidates:

- Static configuration
- Non-sensitive reference values
- Low-risk dashboard summaries

Do not treat cached data as authoritative for:

- Financial balances
- Payment verification
- Roles
- Audit logs
- Task claims

---

# 65. Realtime

Realtime synchronization may be used for useful operational screens such as:

- Task changes
- Notification-like updates
- Operational dashboards where required

It should not be required for basic financial correctness.

Financial records remain authoritative in PostgreSQL.

---

# 66. Audit Logging

Audit events should be generated by trusted backend operations.

Important operations include:

- Role changes
- Referral changes
- Monthly donation amount changes
- UPI configuration
- Financial transaction changes
- Financial deletion
- Expense/payment actions
- Attendance corrections
- Important settings

---

# 67. Technology for Audit Logs

Use the same PostgreSQL database initially for business audit records, with controlled table policies.

Technical/application logs may remain in platform logging systems.

Do not put all technical logs into the business audit table.

---

# 68. Testing Stack Direction

The project should include:

### Web unit/component testing

A TypeScript-compatible test runner such as Vitest plus appropriate React testing tools.

### Web end-to-end

Playwright.

### Backend

Unit + integration tests against isolated test database/environment.

### Database

SQL/RLS policy tests.

### Mobile

React Native/Expo-compatible unit/component testing plus physical-device testing for:

- GPS
- UPI handoff
- Notifications
- Offline sync
- Secure storage

---

# 69. Security Testing

At minimum:

- Authentication tests
- RBAC tests
- Record-level authorization tests
- IDOR tests
- RLS tests
- Financial mutation tests
- File access tests
- OTP rate-limit tests
- Duplicate payment tests
- Task-claim race tests
- Attendance duplicate tests

---

# 70. Free-Tier Monitoring Requirements

Because V1 targets free/low-cost infrastructure, monitor:

- Database size
- File storage size
- Egress
- Function invocations
- Function errors
- Function duration
- Authentication usage
- Notification usage
- Build quotas
- Deployment storage
- Provider message usage

The project should detect approaching limits before they become production failures.

---

# 71. Free-Tier Failure Rule

If a free-tier quota is reached:

```text
Detect
 ↓
Alert
 ↓
Assess
 ↓
Upgrade / optimize safely
```

Never:

```text
Quota reached
 ↓
Delete financial history
```

or:

```text
Quota reached
 ↓
Delete committee work history
```

---

# 72. Backup Strategy Requirement

Supabase Free does not include automatic database backups.

Therefore, **backup and recovery must be designed before production go-live**.

The backup strategy must protect:

- Database
- Financial records
- Member data
- Committee history
- Required files
- Important configuration

The actual implementation belongs in:

`BACKUP_AND_RECOVERY.md`

---

# 73. Production Readiness Gate

The stack should not be considered production-ready merely because the app runs locally.

Before production:

- Backup works.
- Restore process is tested.
- Free-tier limits are understood.
- Secrets are secured.
- Authentication works.
- Payment verification works.
- Financial transaction integrity is tested.
- Audit logging works.
- File authorization works.
- Mobile push works.
- Critical external-provider failures are handled.

---

# 74. Technology Alternatives Considered

The goal is not to claim that the selected technologies are universally best.

They are selected because they fit the current product constraints.

## Alternative: Firebase-only backend

Firebase provides strong mobile tooling and Firebase Cloud Messaging is no-cost, but the financial application is heavily relational and audit-oriented.

PostgreSQL provides a more natural relational/transactional model for:

- Accounts
- Transactions
- Expenses
- Payments
- Referrals
- Monthly records
- Work history

Therefore PostgreSQL/Supabase is preferred for the core data platform.

---

## Alternative: Flutter

Flutter can provide Android/iOS/web from one ecosystem.

However, the project has a strong need for a complex administrative Web application, and the selected team architecture benefits from TypeScript across Web, mobile, backend functions, and shared types.

Therefore React/Next.js + Expo/React Native is selected.

---

## Alternative: Fully custom backend server

A traditional standalone Node.js backend could provide more runtime control.

However, it would add infrastructure operations for:

- Server hosting
- Database
- Authentication
- Storage
- Scaling
- Monitoring

Supabase provides these managed capabilities with a lower V1 operational burden.

---

## Alternative: Large microservices architecture

Not selected for V1.

It would increase:

- Cost
- Deployment complexity
- Monitoring requirements
- Failure modes
- Debugging burden

A modular backend is sufficient for one Masjid's V1 workload.

---

# 75. Technology Lock Rules

Once the project implementation begins, the following should be treated as the V1 baseline:

```text
Web       → Next.js + TypeScript
Mobile    → Expo + React Native + TypeScript
Backend   → Supabase + Edge Functions
Database  → PostgreSQL
Storage   → Supabase Storage
Auth      → Supabase Auth
Push      → Expo Push
Source    → GitHub
Package   → pnpm
```

Changes require documentation.

---

# 76. Provider Abstraction Rules

External providers must be replaceable where practical.

Use adapters/interfaces for:

- OTP
- SMS
- WhatsApp
- Notifications
- Payment/UPI
- PDF rendering
- Monitoring

Core product code should not become tightly coupled to one provider's API format.

---

# 77. No Secret in Client Rule

Never place in Web/Android/iOS builds:

- Database service-role credentials
- SMS secrets
- WhatsApp credentials
- Payment provider secret keys
- Storage administration credentials
- Server signing secrets

Only intentionally public client configuration may be bundled.

---

# 78. Production Architecture Summary

```text
                         USERS
                           │
          ┌────────────────┼─────────────────┐
          │                │                 │
          ▼                ▼                 ▼
       WEB APP          ANDROID             iOS
      Next.js            Expo              Expo
          │                │                 │
          └────────────────┼─────────────────┘
                           ▼
                     APPLICATION API
                           │
          ┌────────────────┼──────────────────┐
          │                │                  │
          ▼                ▼                  ▼
       Supabase          Edge             Storage
       Auth              Functions
          │                │
          └────────────────┼──────────────────┐
                           ▼                  │
                     PostgreSQL              │
                           │                  │
        ┌──────────────────┼──────────────────┤
        │                  │                  │
        ▼                  ▼                  ▼
    Finance            Committee          Members
    Donations          Tasks              Referrals
    Expenses           Meetings           Attendance
    Payments           Work History
        │
        └──────────────────────┐
                               ▼
                            Reports
                               │
                               ▼
                              PDF

External integrations:
OTP / SMS / WhatsApp / UPI / Push
```

---

# 79. Technology Decision Checklist

Before implementation begins, verify:

- [x] Web framework selected.
- [x] Mobile framework selected.
- [x] Backend platform selected.
- [x] Database selected.
- [x] Storage selected.
- [x] Authentication architecture selected.
- [x] Push architecture selected.
- [x] UPI architecture selected.
- [x] Source control selected.
- [x] Package manager selected.
- [x] Monorepo strategy selected.
- [x] Web hosting baseline selected.
- [x] Mobile build tooling selected.
- [x] Financial business logic remains server-side.
- [x] RLS is part of the data-security model.
- [ ] OTP/SMS provider selected.
- [ ] WhatsApp provider selected.
- [ ] Exact UPI implementation validated with real UPI apps.
- [ ] PDF renderer validated for multilingual reports.
- [ ] Backup/recovery implemented and tested.
- [ ] Production free-tier capacity validated.

The unchecked items are implementation/provider validation tasks, not reasons to invent a technology choice now.

---

# 80. Important Cost Reality

The goal is **zero or minimal infrastructure investment**, not an assumption that every production service is permanently free.

Potential unavoidable costs include:

- OTP/SMS delivery
- WhatsApp Business messaging
- App-store developer accounts
- Domain
- Storage/compute after free quotas
- Any provider required for reliable payment automation

The application architecture must remain operationally useful even when optional messaging providers are unavailable.

---

# 81. Technology Stack Invariants

Regardless of future provider changes:

1. PostgreSQL/relational integrity or an equivalent strong transactional model remains required for financial data.
2. Backend authorization remains mandatory.
3. Financial logic remains server-side.
4. Payment verification remains authoritative.
5. Financial history is permanent.
6. Committee work history is permanent.
7. Sensitive files remain access-controlled.
8. Authentication secrets remain server-side.
9. External providers remain replaceable where practical.
10. Free-tier limitations must never be solved by deleting core historical records.

---

# 82. Versioning Policy

Do not pin the application to a beta framework release for production without an explicit reason.

At implementation start:

1. Check current stable versions.
2. Select compatible versions.
3. Lock them through package manifests/lockfiles.
4. Record major versions in the repository.
5. Upgrade deliberately.
6. Run regression tests before upgrades.

---

# 83. Review Policy

This document should be reviewed before:

- Production launch
- Major dependency upgrades
- Cloud/provider changes
- Authentication-provider changes
- Payment integration changes
- Database architecture changes

---

# 84. Related Documents

- `PROJECT_OVERVIEW.md`
- `PRODUCT_REQUIREMENTS.md`
- `FEATURE_SCOPE.md`
- `USER_ROLES_PERMISSIONS.md`
- `SYSTEM_ARCHITECTURE.md`
- `APPLICATION_ARCHITECTURE.md`
- `FRONTEND_ARCHITECTURE.md`
- `BACKEND_ARCHITECTURE.md`
- `FRONTEND_FRAMEWORK.md`
- `BACKEND_FRAMEWORK.md`
- `DATABASE_ARCHITECTURE.md`
- `HOSTING_CLOUD_INFRASTRUCTURE.md`
- `SECURITY_ARCHITECTURE.md`
- `BACKUP_AND_RECOVERY.md`
- `DEVELOPMENT_TASKS.md`

---

# 85. Official Research References

The following sources were consulted for current technology/provider constraints:

- Next.js documentation: https://nextjs.org/docs/app
- Next.js installation/system requirements: https://nextjs.org/docs/app/getting-started/installation
- Next.js deployment: https://nextjs.org/docs/app/getting-started/deploying
- React Native release information: https://reactnative.dev/blog
- React Native 0.87 release: https://reactnative.dev/blog/2026/08/11/react-native-0.87
- Expo SDK 57: https://expo.dev/changelog/sdk-57
- Expo EAS pricing: https://expo.dev/pricing
- Expo push notification FAQ: https://docs.expo.dev/push-notifications/faq/
- Supabase pricing: https://supabase.com/pricing
- Supabase Auth: https://supabase.com/docs/guides/auth
- Supabase RLS: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase Edge Functions: https://supabase.com/docs/guides/functions
- Supabase Edge Function limits: https://supabase.com/docs/guides/functions/limits
- Firebase Cloud Messaging/pricing: https://firebase.google.com/products/cloud-messaging
- Vercel pricing: https://vercel.com/pricing
- Vercel terms: https://vercel.com/legal/terms
- Google Android Developer Console registration: https://support.google.com/android-developer-console/answer/16604405
- Apple Developer Program: https://developer.apple.com/programs/

---

## Document Status

**Technology Stack — V1 Research Baseline**

This document records the recommended technical baseline for implementation.

The selected architecture prioritizes a strong relational backend, server-side financial controls, one shared mobile codebase, a capable Web application, and minimal infrastructure administration.

Provider-specific decisions that depend on Indian messaging/payment requirements must be completed and validated before production launch.
