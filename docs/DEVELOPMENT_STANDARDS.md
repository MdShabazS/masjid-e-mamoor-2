# DEVELOPMENT STANDARDS

**Project:** Masjid-e-Mamoor  
**Document:** Development Standards  
**Version:** 1.0  
**Status:** Draft — Review Required  
**Audience:** Product owner, architects, developers, QA, DevOps, security reviewers, and AI development agents.

---

# 1. Purpose

This document defines the engineering standards for developing Masjid-e-Mamoor.

It establishes rules for:

- repository structure
- coding conventions
- TypeScript
- React
- Next.js
- Expo/React Native
- Supabase
- PostgreSQL
- API/domain boundaries
- validation
- error handling
- security
- testing
- Git
- documentation
- dependency management
- configuration
- migrations
- observability
- AI-assisted development
- code review
- release readiness

The objective is predictable, maintainable, secure development rather than merely producing code that compiles.

---

# 2. Source of Truth

The project source of truth is:

1. approved repository documentation
2. approved source code
3. database migrations
4. tests
5. Git history

External AI suggestions are not authoritative.

A generated answer, code snippet, or design proposal becomes authoritative only after it is reviewed and incorporated into the repository.

---

# 3. Documentation-First Rule

Substantial implementation MUST be preceded by the relevant documentation.

The expected sequence is:

```text
Research
  ↓
Requirement
  ↓
Business rule
  ↓
Architecture
  ↓
Data/API/security design
  ↓
Implementation
  ↓
Testing
  ↓
Verification
  ↓
Review
  ↓
Commit
```

Do not begin a major feature merely because an AI tool generated a plausible implementation.

---

# 4. Current Technology Baseline

The current approved foundation includes:

- pnpm workspace
- TypeScript
- Next.js App Router
- React
- Expo
- React Native
- Supabase
- PostgreSQL
- TanStack Query
- React Hook Form
- Zod
- Supabase SSR/client patterns
- Secure Store on mobile
- Tailwind CSS
- shadcn/ui-style component architecture

Exact package versions are governed by the repository lockfile and approved dependency policy.

---

# 5. Repository Structure

The planned monorepo:

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

Documentation remains under:

```text
docs/
```

Additional folders may be introduced only when they have a documented purpose.

---

# 6. Workspace Boundaries

Each package should have a clear responsibility.

Avoid placing arbitrary business logic in:

- shared
- config
- UI utilities
- global helper files

A package should not become a dumping ground.

---

# 7. Shared Package Rules

Shared packages may contain genuinely reusable code.

Examples:

- stable domain types
- validation schemas
- shared constants
- API contracts
- cross-platform utilities

Do not share code merely to avoid writing a few lines twice.

---

# 8. Platform-Specific Code

Web-specific code belongs in the web application.

Mobile-specific code belongs in the mobile application.

Do not force platform-specific behavior into shared packages.

---

# 9. Dependency Direction

Dependencies should generally flow from higher-level applications toward lower-level shared packages.

Avoid circular dependencies.

Conceptually:

```text
apps
 ↓
domain/shared packages
 ↓
configuration/primitives
```

A low-level package should not import from an application.

---

# 10. TypeScript Standard

TypeScript should be used consistently.

New production code should not introduce JavaScript files unless there is a documented reason.

---

# 11. Strict Typing

Strict TypeScript settings should remain enabled.

Avoid:

```ts
any
```

unless there is a documented boundary requiring it.

Prefer:

- explicit types
- generics
- discriminated unions
- type guards
- `unknown` for untrusted values

---

# 12. Unknown Over Any

External input should enter the system as `unknown` where practical and then be validated.

Example:

```ts
const value: unknown = externalData;
```

Validation should establish the expected shape.

---

# 13. Type Assertions

Avoid unnecessary assertions:

```ts
value as User
```

Assertions do not validate data.

Use schema validation when data crosses a trust boundary.

---

# 14. Nullability

Null and undefined should be handled intentionally.

Do not hide missing data through unsafe non-null assertions:

```ts
value!
```

Use explicit guards or validated data.

---

# 15. Naming

Names should communicate domain meaning.

Prefer:

```text
paymentSubmission
outstandingAmount
verifiedAt
```

over:

```text
data
item
obj
temp
```

---

# 16. Boolean Naming

Boolean variables should communicate state.

Examples:

```text
isActive
isLoading
hasPermission
canVerify
```

---

# 17. Function Naming

Functions should communicate actions.

Examples:

```text
submitPayment
verifyPayment
allocatePayment
createExpense
recordTransfer
```

Avoid vague:

```text
handleData
processThing
doAction
```

---

# 18. Component Naming

React components should use descriptive PascalCase names.

Examples:

```text
PaymentReview
DonationSummary
MemberProfile
FinanceAccountCard
```

---

# 19. File Naming

File naming should follow one project convention.

The convention must be consistent within:

- web
- mobile
- shared packages

Do not mix unrelated naming schemes without reason.

---

# 20. Component Size

Large components should be decomposed when they contain multiple independent responsibilities.

Do not split components merely to reduce line count.

Split based on:

- responsibility
- reuse
- testability
- state isolation
- readability

---

# 21. Business Logic in UI

Business rules should not be hidden inside presentational components.

For example:

```text
FIFO allocation
payment verification
financial correction
permission decisions
```

must have explicit domain/application boundaries.

---

# 22. UI Responsibility

UI components should primarily handle:

- presentation
- user interaction
- local UI state
- accessibility
- rendering

Domain operations should be delegated to appropriate application/domain layers.

---

# 23. Server Authority

The client is never the financial authority.

The server/database must determine:

- payment verification
- allocation
- account balance
- transfer validity
- expense state
- authorization
- final financial result

---

# 24. Client Validation

Client validation exists for usability.

It does not replace server validation.

Every important server-side invariant must be enforced independently of the client.

---

# 25. Validation Library

Zod is the approved validation direction for TypeScript input validation.

Schemas should be reused where appropriate.

Do not duplicate the same validation rules across multiple components unnecessarily.

---

# 26. Validation Boundaries

Validate at trust boundaries:

- form input
- API input
- external service response where necessary
- storage metadata
- configuration
- offline queue replay

---

# 27. Schema Ownership

Each schema should have one authoritative location.

Avoid maintaining:

```text
web schema
mobile schema
API schema
```

that silently diverge for the same contract.

---

# 28. API Contracts

API contracts should be explicit.

They should define:

- input
- output
- errors
- authorization expectations
- idempotency where applicable

---

# 29. API Contract Stability

Breaking API changes require:

- documentation update
- client impact review
- migration strategy
- tests
- versioning or coordinated deployment where needed

---

# 30. Query vs Command

Read operations and state-changing commands should remain conceptually distinct.

Queries:

```text
getMember
listPayments
getAccountBalance
```

Commands:

```text
submitPayment
verifyPayment
createExpense
recordTransfer
```

---

# 31. Command Safety

Commands that change state must be:

- authorized
- validated
- transactional where required
- observable
- idempotent where retries are possible

---

# 32. Financial Commands

Financial commands require especially strict handling.

Examples:

- verify payment
- reject payment
- allocate payment
- create expense
- transfer funds
- reverse transaction
- correct transaction

These must use authoritative server-side operations.

---

# 33. Idempotency

Retryable state-changing operations should have stable idempotency mechanisms.

Examples:

- offline attendance sync
- payment submission
- combined payment
- notification delivery
- financial commands where clients may retry

---

# 34. Idempotency Keys

Idempotency identifiers must be:

- unique for the intended operation
- stable across retries
- associated with the authenticated actor/context
- stored or otherwise checked server-side

Do not generate a new idempotency key for every retry.

---

# 35. Duplicate Prevention

Duplicate prevention must be enforced at the authoritative boundary.

Client-side duplicate checks are helpful but insufficient.

---

# 36. Concurrency

Concurrent financial operations must be considered explicitly.

Do not assume two users cannot act on the same record simultaneously.

---

# 37. Database Transactions

Operations requiring atomicity should execute within appropriate database transactions.

Examples:

```text
combined payment
payment allocation
account transfer
financial correction
reversal
```

---

# 38. Atomicity

If a command contains multiple required state changes, either:

```text
all required changes succeed
```

or:

```text
the operation fails without a partial authoritative state
```

unless the business rule explicitly defines partial completion.

---

# 39. Money Handling

Never use JavaScript floating-point arithmetic as the authoritative financial representation.

Use database-safe numeric/integer representations according to the financial architecture.

---

# 40. Money Formatting

Formatting is a presentation concern.

Do not pass formatted strings into financial calculations.

Bad:

```text
"₹1,500"
```

as a calculation value.

Prefer an authoritative numeric representation.

---

# 41. Dates

Store authoritative dates/timestamps using database-supported temporal types.

Do not store arbitrary localized date strings as canonical data.

---

# 42. Timezone

Timezone rules must follow the approved architecture.

Do not use the developer's local timezone accidentally for business decisions.

---

# 43. Month Calculations

Donation obligation month logic must use the approved business timezone/month rules.

Do not derive financial obligation months from client locale alone.

---

# 44. Authentication

Authentication is handled by the approved Supabase Auth architecture.

Developers must not implement a second independent authentication system.

---

# 45. Authorization

Authorization must be enforced server-side.

UI checks are only presentation controls.

---

# 46. Permission Model

Use stable permission identifiers.

Example:

```text
finance.payment.verify
finance.expense.create
committee.task.update
```

Do not scatter role-name checks throughout the code.

---

# 47. Role Checks

Prefer permission-based checks.

Avoid:

```ts
if (role === "finance") {
  ...
}
```

when the requirement is actually:

```text
can verify payment
```

Role checks may be appropriate for role-specific navigation where documented.

---

# 48. RLS

Exposed Supabase/PostgreSQL tables must use appropriate Row Level Security according to the security architecture.

Do not disable RLS merely to simplify development.

---

# 49. Trusted Operations

Privileged operations should use the approved trusted-operation boundary.

Examples:

- financial finalization
- sensitive authorization decisions
- atomic multi-table operations
- administrative mutations

---

# 50. Service Role

The Supabase service-role credential must never be exposed to:

- browser code
- mobile application
- client bundle
- public repository
- logs
- user-visible configuration

---

# 51. Environment Variables

Secrets must come from environment configuration.

Never hard-code:

- API secrets
- service-role keys
- database passwords
- signing secrets
- private credentials

---

# 52. Public Configuration

Only intentionally public configuration may be exposed to client applications.

Every environment variable should be classified as:

- public
- server-only
- secret

---

# 53. Secrets in Git

Secrets must never be committed.

Use:

```text
.env.example
```

for variable names and safe placeholders.

---

# 54. Logging Secrets

Logs must not contain:

- OTP codes
- auth tokens
- service keys
- passwords
- private proof URLs
- sensitive member data
- full payment secrets

---

# 55. Personal Data

Developers should minimize collection and exposure of personal information.

Do not fetch data merely because it is technically available.

---

# 56. Data Minimization

Queries should request only fields required for the current operation.

Avoid returning full member records to unrelated screens.

---

# 57. Authorization Before Sensitive Fetch

Sensitive data should be authorized before retrieval or exposure.

Do not rely on frontend filtering after fetching unauthorized records.

---

# 58. Storage

Files must use the approved private storage architecture.

Payment proofs and sensitive financial documents must not be publicly accessible by default.

---

# 59. Signed URLs

Time-limited access should be used where appropriate.

Do not expose permanent public file URLs for sensitive documents.

---

# 60. File Validation

Uploads must validate:

- file type
- size
- authorization
- expected workflow
- metadata
- storage destination

Client checks do not replace server checks.

---

# 61. React Standards

React components should be:

- predictable
- composable
- accessible
- testable

Avoid unnecessary global state.

---

# 62. State Management

Use the smallest appropriate state scope.

Categories:

```text
local UI state
server/cache state
form state
session state
offline state
```

Do not put everything into a global store.

---

# 63. TanStack Query

Server state should use the approved TanStack Query approach where applicable.

Responsibilities include:

- fetching
- caching
- invalidation
- stale state
- mutation state
- retries

---

# 64. Query Keys

Query keys must be stable and domain-oriented.

Example:

```text
["payments", paymentId]
["members", filters]
```

Avoid keys that depend on arbitrary object identity.

---

# 65. Query Invalidation

After mutations, invalidate or update only affected queries.

Do not blindly clear the entire cache after every mutation.

---

# 66. Realtime and Query Cache

Realtime events should reconcile with TanStack Query rather than creating an independent competing source of truth.

---

# 67. Stale Data

UI should recognize that cached data may become stale.

Critical financial actions must revalidate authoritative state before final mutation where required.

---

# 68. Optimistic Updates

Optimistic updates are allowed only when rollback semantics are safe.

Do not optimistically mark a payment as verified.

---

# 69. Forms

React Hook Form is the approved form-management direction.

Forms should use:

- schema validation
- controlled submission state
- accessible errors
- duplicate-submission prevention

---

# 70. Form Drafts

Draft persistence may be used where appropriate.

Sensitive data should not be persisted locally without explicit security consideration.

---

# 71. Error Boundaries

Major application regions should have appropriate error boundaries.

Errors should not unnecessarily crash the entire application.

---

# 72. Error Messages

User-facing errors must be localized and actionable.

Developer diagnostics belong in logs/observability, not ordinary UI.

---

# 73. Error Codes

Domain/API errors should use stable codes where appropriate.

Example:

```text
PAYMENT_ALREADY_PROCESSED
PAYMENT_NOT_AUTHORIZED
INVALID_ALLOCATION
IDEMPOTENCY_CONFLICT
```

The exact final code set should be centralized.

---

# 74. Error Handling

Do not use:

```ts
catch {
  // ignore
}
```

unless the error is intentionally and safely ignorable.

---

# 75. Error Logging

Errors should include enough context for diagnosis without exposing sensitive data.

---

# 76. Retry Policy

Retries should be used only for operations where retrying is safe.

Do not blindly retry financial commands.

---

# 77. Network Errors

Network failures should be distinguished from:

- validation errors
- authorization errors
- conflicts
- server errors
- already-applied operations

---

# 78. Offline Behavior

Only approved workflows may operate offline.

Financial finalization remains server-authoritative.

Offline operations must use stable operation identifiers.

---

# 79. Offline Queue

Offline queue records should contain enough information to:

- identify operation
- identify account/user context
- retry safely
- report status
- resolve duplicates/conflicts

---

# 80. Mobile Secure Storage

Sensitive session information should use the approved secure-storage mechanism.

Do not use ordinary unencrypted storage for secrets.

---

# 81. Web Session Handling

Web authentication/session handling must follow the approved Supabase SSR architecture.

Do not invent ad-hoc token storage patterns.

---

# 82. Mobile Session Handling

Mobile should handle:

- sign in
- token refresh
- secure persistence
- logout
- expiration
- account switching

without exposing credentials.

---

# 83. Route Protection

Protected routes should enforce authentication and authorization before sensitive data is exposed.

---

# 84. Server vs Client Components

In Next.js, choose server/client boundaries intentionally.

Use client components when interaction or browser APIs require them.

Do not mark entire page trees as client components without reason.

---

# 85. Data Fetching

Sensitive server-side data should not be fetched unnecessarily into the browser.

Prefer the approved server/data-access boundary.

---

# 86. Browser APIs

Browser-only APIs must remain inside appropriate client boundaries.

---

# 87. React Native Platform APIs

Platform-specific APIs should be isolated from shared domain logic.

---

# 88. Expo Standards

Use approved Expo APIs and project configuration.

Do not add native dependencies casually.

Any native dependency requires:

- compatibility check
- platform impact review
- build impact review
- security review where relevant

---

# 89. Dependency Policy

Dependencies should be added only when they provide meaningful value.

Before adding one:

1. check whether the platform already provides the capability
2. check existing dependencies
3. review maintenance
4. review compatibility
5. review bundle/build impact
6. review license where applicable
7. test integration

---

# 90. Dependency Versioning

Use the repository's package manager and lockfile.

Do not manually edit lockfiles.

---

# 91. Upgrade Policy

Do not upgrade major framework versions casually.

Framework upgrades require:

- compatibility review
- test run
- build verification
- migration review

---

# 92. Current Foundation Stability

The verified foundation should not be destabilized merely to remove harmless transitive warnings.

Do not upgrade Expo/React/React Native solely for cosmetic dependency warnings without a documented reason.

---

# 93. Formatting

Use the repository's configured formatter.

Formatting must be deterministic.

Do not manually fight formatter output.

---

# 94. Linting

Lint rules should enforce:

- unsafe patterns
- unused imports
- inconsistent code
- problematic React patterns
- security-sensitive mistakes where supported

Lint configuration changes require review.

---

# 95. Type Checking

Type checking is a mandatory development gate.

A feature is not complete while required type checks fail.

---

# 96. Build Verification

Production builds must be tested before declaring a release candidate.

---

# 97. Testing Philosophy

Tests should verify behavior, not implementation trivia.

Priority:

1. domain correctness
2. security
3. financial integrity
4. critical workflows
5. accessibility
6. UI behavior
7. implementation details

---

# 98. Unit Tests

Unit tests are appropriate for:

- pure business rules
- validators
- formatting helpers
- permission logic
- allocation calculations
- date/month rules

---

# 99. Integration Tests

Integration tests should cover:

- API/domain operations
- database behavior
- RLS
- transactions
- idempotency
- storage authorization

---

# 100. End-to-End Tests

E2E tests should cover critical user journeys:

- registration
- authentication
- donation
- payment
- finance verification
- committee workflow
- attendance
- notifications

---

# 101. Financial Tests

Financial workflows require strong automated coverage.

Test:

- FIFO
- partial payment
- multi-month allocation
- overpayment
- combined payment
- transfer
- expense
- correction
- reversal
- duplicate retry
- concurrency

---

# 102. Negative Tests

Tests must verify prohibited operations.

Examples:

- Member cannot verify payment
- Committee Member cannot access finance records
- unauthorized user cannot access another member's data
- duplicate financial operation cannot create duplicate records

---

# 103. RLS Tests

RLS behavior must be tested explicitly.

Do not assume policies are correct because the application UI hides records.

---

# 104. Authorization Tests

Test:

- each role
- each sensitive permission
- role changes
- deactivation
- session expiry
- unauthorized direct API attempts

---

# 105. Idempotency Tests

For retryable operations:

1. submit once
2. repeat same operation
3. verify no duplicate authoritative state
4. verify response semantics

---

# 106. Concurrency Tests

Simulate multiple users attempting conflicting operations.

Financial invariants must remain valid.

---

# 107. Offline Tests

Test:

- offline capture
- reconnect
- retry
- duplicate replay
- conflict
- already-applied operation
- local crash/restart

---

# 108. Realtime Tests

Test:

- initial fetch
- subscription
- update
- duplicate event
- missed event
- reconnect
- stale cache reconciliation

---

# 109. Accessibility Tests

Test:

- keyboard
- screen reader
- focus
- contrast
- localization
- RTL
- responsive layouts

---

# 110. Test Data

Test data should be deterministic where possible.

Avoid production data in local development.

---

# 111. Production Data

Production personal/financial data must not be copied into development environments without explicit approved safeguards.

---

# 112. Seed Data

Development seed data should represent:

- all roles
- typical members
- referrals
- obligations
- payments
- financial accounts
- transactions
- tasks
- meetings
- attendance
- notifications

Seed data must be obviously non-production.

---

# 113. Test Users

Test users should use controlled credentials/phone numbers appropriate for the environment.

Do not embed real user credentials.

---

# 114. Database Migrations

Schema changes must be migration-based.

Do not make undocumented manual production schema changes.

---

# 115. Migration Naming

Migration names should communicate purpose.

Example:

```text
create_member_profiles
add_payment_submission_status
create_finance_transfer_function
```

---

# 116. Migration Safety

Migrations should be reviewed for:

- data loss
- locking
- rollback strategy
- RLS effects
- index impact
- trigger behavior
- application compatibility

---

# 117. Destructive Migrations

Destructive changes require special review.

Do not casually drop:

- columns
- tables
- constraints
- policies

---

# 118. Backward Compatibility

For deployed applications, schema changes may require compatibility periods.

Example:

```text
old application
    ↓
new database schema
    ↓
new application
```

Avoid assuming web and mobile update simultaneously.

---

# 119. Mobile Version Compatibility

Mobile applications may remain installed for longer periods.

API changes must consider older supported clients.

---

# 120. API Evolution

Breaking API changes should be avoided where possible.

Use additive evolution when practical.

---

# 121. Database Constraints

Important invariants should be enforced in the database where appropriate.

Examples:

- uniqueness
- non-null
- valid references
- valid state combinations

---

# 122. Application vs Database Validation

Use both where appropriate.

Application validation improves UX.

Database constraints protect integrity.

Neither should be assumed to replace the other.

---

# 123. Financial Invariants

The following should remain protected:

- verified payments cannot silently disappear
- allocation cannot exceed payment
- allocation cannot exceed obligation where prohibited
- account transfers remain balanced
- corrections remain auditable
- reversal remains traceable
- duplicate commands do not duplicate money

---

# 124. Audit Records

Audit records should be append-oriented and protected from ordinary mutation.

Do not provide ordinary UI controls for editing audit history.

---

# 125. Audit Actor

Audit records should capture the authoritative actor/context required by the audit architecture.

---

# 126. Audit Time

Audit events should use authoritative server timestamps where appropriate.

---

# 127. Reversals

Do not rewrite historical financial records to hide mistakes.

Use the approved correction/reversal model.

---

# 128. Corrections

Corrections must preserve traceability.

A corrected value should not erase the fact that a previous state existed.

---

# 129. Comments and Notes

Notes should not be used as substitutes for structured financial state.

If a rule needs a structured field, add a structured field rather than relying on free text.

---

# 130. Code Comments

Comments should explain:

- why
- business constraints
- security rationale
- non-obvious decisions

Avoid comments that merely repeat code.

---

# 131. TODO Policy

TODO comments should be meaningful.

Example:

```text
TODO: replace temporary fallback after approved payment gateway integration.
```

Avoid:

```text
TODO: fix
```

---

# 132. Feature Flags

Feature flags may be used for controlled rollout.

They must not become permanent hidden architecture.

Each flag should have:

- owner
- purpose
- default
- rollout plan
- removal plan

---

# 133. Configuration

Configuration should be centralized.

Do not scatter environment-specific values throughout the code.

---

# 134. Environment Separation

At minimum:

```text
development
staging/test
production
```

should remain conceptually separate.

---

# 135. Environment Safety

Development tools must not accidentally target production.

Environment identifiers should be visible during development.

---

# 136. Supabase Project Separation

Environment strategy must ensure that local/testing credentials do not accidentally connect to production.

---

# 137. Logging

Logging should be structured where practical.

Include:

- event type
- timestamp
- safe correlation ID
- operation
- outcome
- non-sensitive context

---

# 138. Correlation IDs

Cross-service operations should use correlation identifiers where appropriate.

Do not expose sensitive internal identifiers to end users unless necessary.

---

# 139. Observability

Critical operations should be observable:

- payment verification
- financial transfer
- expense
- correction
- reversal
- offline sync
- notification delivery
- authentication failures

---

# 140. Performance

Performance should be considered during implementation.

Avoid:

- unnecessary network calls
- N+1 queries
- excessive client bundles
- huge unpaginated datasets
- unnecessary realtime subscriptions

---

# 141. Database Query Standards

Queries should:

- select required fields
- use appropriate indexes
- paginate large results
- respect authorization
- avoid unnecessary joins

---

# 142. N+1 Prevention

Do not fetch related records one at a time when a controlled query can safely fetch the required data.

---

# 143. Pagination

Large administrative datasets should use pagination or another approved bounded retrieval mechanism.

---

# 144. Search

Search must remain authorization-aware.

Never implement search by fetching all records and filtering on the client.

---

# 145. Realtime Subscription Scope

Subscriptions should be as narrow as practical.

Do not subscribe every user to all database changes.

---

# 146. Realtime Security

Realtime authorization must align with data-access policies.

---

# 147. Caching

Cache only data that the user is authorized to access.

Sensitive caches must be invalidated appropriately.

---

# 148. Cache Invalidation

Important events include:

- logout
- role change
- deactivation
- permission reduction
- financial state change

---

# 149. Security Review

Every feature should consider:

- authentication
- authorization
- RLS
- data exposure
- storage
- logs
- input validation
- file upload
- rate limiting
- replay
- idempotency

---

# 150. Threat Modeling

Security-sensitive features should have a lightweight threat model before implementation.

Examples:

- payment verification
- UPI flow
- finance transfers
- file proofs
- referral registration
- offline sync
- role administration

---

# 151. Input Sanitization

Treat external input as untrusted.

Validate and safely render user content.

---

# 152. Injection Prevention

Use parameterized database operations and framework-safe rendering.

Never construct SQL from raw user input.

---

# 153. XSS Prevention

Do not render untrusted HTML unless explicitly required and safely sanitized.

---

# 154. File Upload Security

File extensions alone are insufficient.

Validate actual file characteristics according to the approved storage security design.

---

# 155. Rate Limiting

Sensitive operations should have appropriate rate limiting or abuse protection.

Examples:

- OTP requests
- authentication attempts
- payment submission
- referral abuse
- notification triggering

---

# 156. Authorization Bypass Testing

Attempt direct access to:

- protected routes
- APIs
- storage objects
- RPC/trusted operations

as unauthorized users during security testing.

---

# 157. UI Security

Do not treat:

```text
hidden button
disabled button
hidden route
```

as authorization.

---

# 158. Mobile Security

Mobile clients must be treated as untrusted clients.

Do not embed privileged secrets.

---

# 159. Web Security

Browser code must be treated as public.

Never place privileged credentials in client bundles.

---

# 160. Dependency Security

Dependencies should be monitored for known vulnerabilities.

Do not ignore critical dependency security issues without documented assessment.

---

# 161. License Review

New dependencies should be checked for license compatibility where required by the project.

---

# 162. Git Standards

Git history should communicate meaningful project evolution.

Commits should be:

- focused
- descriptive
- reviewable
- logically scoped

---

# 163. Commit Timing

Do not commit broken intermediate work as if it were a completed feature.

During development, local checkpoints may exist, but the project history should remain understandable.

---

# 164. Commit Messages

Preferred format:

```text
<type>: <short description>
```

Examples:

```text
docs: define donation finance specification
feat: add member referral workflow
fix: prevent duplicate payment verification
test: add FIFO allocation coverage
```

---

# 165. Commit Scope

One commit should preferably represent one coherent change.

Avoid mixing:

- unrelated refactors
- documentation
- dependency upgrades
- feature implementation

unless the change is genuinely coupled.

---

# 166. Pull Requests

When collaboration is used, PRs should contain:

- summary
- motivation
- implementation
- tests
- migration impact
- security impact
- screenshots for UI changes
- unresolved issues

---

# 167. Review Requirements

Sensitive changes require appropriate review.

Examples:

- RLS
- auth
- finance
- migrations
- storage
- notification permissions
- role permissions

---

# 168. Branch Strategy

The final branch strategy should remain simple.

The project may use:

```text
main
feature/*
fix/*
```

or another documented convention.

Avoid complex branching without need.

---

# 169. Main Branch

`main` should represent a verified state.

Do not push known-broken production-intended code to main.

---

# 170. Local-First Development

The project owner's requested workflow is:

```text
Develop locally
    ↓
Test locally
    ↓
Review
    ↓
Verify
    ↓
Commit
    ↓
Push
```

Do not push unfinished experiments merely to obtain remote AI context.

---

# 171. AI Development Workflow

AI tools are interchangeable engineering assistants.

Possible tools may include:

- ChatGPT
- Cursor
- Claude
- Gemini
- Codex
- other suitable coding/review tools

No single AI tool is a permanent project owner.

---

# 172. AI Source of Truth

AI tools must read the repository documentation before implementing substantial features.

If documentation conflicts with an AI suggestion, the repository documentation must be reviewed before implementation.

---

# 173. AI Context

AI agents should be provided with:

- project master specification
- relevant domain specification
- architecture
- permissions
- business rules
- testing requirements

Do not ask an AI to implement a major feature using only a short prompt.

---

# 174. AI Implementation Ownership

One implementation owner should work on a feature/file area at a time.

Other AIs may:

- review
- test
- critique
- identify edge cases
- suggest alternatives

Avoid multiple AIs editing the same files simultaneously without coordination.

---

# 175. AI Review Workflow

Recommended:

```text
Planner
  ↓
Implementation agent
  ↓
Static verification
  ↓
Independent AI review
  ↓
Human review
  ↓
Tests
  ↓
Commit
```

---

# 176. AI Generated Code

Generated code must be reviewed for:

- architecture
- security
- correctness
- business rules
- performance
- accessibility
- localization
- tests

Compilation is not acceptance.

---

# 177. AI Prompt Standards

Feature prompts should include:

1. objective
2. relevant documents
3. files in scope
4. files out of scope
5. business rules
6. security constraints
7. testing requirements
8. acceptance criteria

---

# 178. AI Prohibited Assumptions

AI agents must not invent:

- financial rules
- permission grants
- database fields
- API contracts
- payment gateway behavior
- security exceptions
- translations
- unresolved product decisions

without marking them as assumptions/open decisions.

---

# 179. AI Tool Switching

If one AI tool reaches a limitation:

- preserve work in Git/local files
- document current state
- switch tools
- provide the new tool with repository context

The project must remain tool-independent.

---

# 180. AI Review Artifacts

When an AI review finds an issue, the issue should be recorded in:

- code review
- issue
- TODO
- documentation decision

as appropriate.

Do not rely on an AI conversation as the only record of an important decision.

---

# 181. Documentation Changes

When implementation changes architecture or business behavior, update the corresponding documentation.

Code and documentation must not silently diverge.

---

# 182. Business Rule Changes

Business-rule changes require:

1. documentation update
2. impact analysis
3. implementation update
4. tests
5. review
6. migration if required

---

# 183. Database Changes

Database changes require:

- migration
- RLS review
- API impact review
- test update
- documentation update

---

# 184. Permission Changes

Permission changes require:

- role matrix update
- RLS review
- API review
- UI review
- tests
- audit consideration

---

# 185. Financial Rule Changes

Financial rule changes require enhanced review.

At minimum:

- business-rule document
- financial spec
- integrity spec
- database/API impact
- positive tests
- negative tests
- concurrency/idempotency review

---

# 186. UI Changes

UI changes should update:

- design-system usage
- accessibility
- localization
- responsive behavior
- visual tests where applicable

---

# 187. API Changes

API changes require:

- contract update
- client impact review
- authorization review
- error contract review
- tests

---

# 188. Storage Changes

Storage changes require:

- bucket/path review
- authorization
- file validation
- retention
- signed URL behavior
- audit impact

---

# 189. Notification Changes

Notification changes require:

- event definition
- authorization
- preference handling
- localization
- idempotency
- delivery testing

---

# 190. Offline Changes

Offline changes require:

- operation ID strategy
- replay semantics
- conflict handling
- local security
- reconnect testing
- idempotency testing

---

# 191. Realtime Changes

Realtime changes require:

- subscription scope review
- authorization
- cache reconciliation
- duplicate/missed event handling
- reconnect testing

---

# 192. Feature Completion

A feature is not complete because:

- page renders
- API returns 200
- TypeScript compiles
- AI says done

Completion requires the approved definition of done.

---

# 193. Feature Definition of Done

A feature should be considered complete only when:

- requirements implemented
- business rules respected
- authorization enforced
- RLS reviewed
- validation implemented
- errors handled
- accessibility reviewed
- localization considered
- tests pass
- build passes
- documentation updated
- review complete

---

# 194. Financial Feature Definition of Done

Additionally:

- transaction atomicity verified
- idempotency verified
- concurrency considered
- audit trail verified
- reconciliation implications reviewed
- no duplicate money movement
- correction/reversal behavior verified

---

# 195. Mobile Feature Definition of Done

Additionally:

- Android behavior checked
- iOS behavior checked where applicable
- offline behavior checked
- secure storage checked
- native permissions checked
- EAS/build impact reviewed

---

# 196. Web Feature Definition of Done

Additionally:

- responsive layouts checked
- browser behavior checked
- SSR/client boundary checked
- accessibility checked
- production build checked

---

# 197. Code Review Checklist

Reviewers should ask:

- Is the requirement correct?
- Is the business rule correct?
- Is authorization enforced?
- Is RLS correct?
- Is data minimized?
- Is the code testable?
- Is error handling safe?
- Are financial operations atomic?
- Is idempotency needed?
- Is realtime behavior correct?
- Is offline behavior correct?
- Is accessibility considered?
- Is localization considered?

---

# 198. Refactoring Standards

Refactor when it improves:

- correctness
- maintainability
- security
- testability
- performance

Avoid unrelated refactoring during sensitive feature work.

---

# 199. Technical Debt

Technical debt should be recorded explicitly.

Each item should have:

- problem
- impact
- suggested direction
- priority
- owner if applicable

---

# 200. Temporary Implementations

Temporary implementations must be clearly marked.

Example:

```text
Temporary local-only payment adapter.
Replace before production payment integration.
```

Temporary code must not accidentally become production behavior.

---

# 201. Mock Data

Mocks should be clearly separated from production data paths.

Never allow fake financial data to appear as real production financial state.

---

# 202. Feature Prototypes

Prototype screens may exist separately from production workflows.

They must not be mistaken for authoritative implementation.

---

# 203. Demo Mode

If a demo mode is implemented, it must be explicitly isolated and clearly identified.

It must not bypass production authorization.

---

# 204. Test Mode

Test payment flows should use clearly isolated test environments.

Do not simulate production financial success by manually changing production records.

---

# 205. Database Seeds and Finance

Seed financial data must be synthetic and clearly identifiable as test data.

---

# 206. Production Access

Production administrative access should be limited and auditable.

---

# 207. Support Tools

Internal support/admin tools must follow the same authorization model.

Do not create hidden backdoors.

---

# 208. Backdoors

The project must not contain:

- hard-coded admin credentials
- hidden master passwords
- secret query parameters that bypass authorization
- debug endpoints exposing privileged data

---

# 209. Debug Tools

Debug tools must be disabled or secured appropriately in production.

---

# 210. Development Utilities

Local development utilities should be clearly separated from production execution paths.

---

# 211. Database Direct Access

Direct database access should be limited to authorized engineering/operations workflows.

Application users should interact through approved application boundaries.

---

# 212. SQL Standards

SQL should be:

- readable
- parameterized
- migration-managed
- reviewed for indexes
- reviewed for RLS
- tested

---

# 213. SQL Security

Never construct SQL from raw user input.

Use parameterization or trusted query mechanisms.

---

# 214. RPC Standards

Database functions/RPCs should have:

- clear name
- clear input
- clear output
- authorization assumptions
- transaction semantics
- error behavior
- tests

---

# 215. Security Definer Functions

Security-definer functions require special review.

They must:

- minimize privileges
- set safe search path as appropriate
- validate authorization
- avoid unintended privilege escalation

---

# 216. Trigger Standards

Triggers should be used only where they provide clear integrity or architectural value.

Avoid hidden business behavior that developers cannot easily trace.

---

# 217. Event/Outbox Standards

Outbox records should be:

- durable
- idempotent
- auditable
- retryable
- authorization-aware

---

# 218. Notification Workers

Workers should not duplicate notifications when retries occur.

---

# 219. Scheduled Jobs

Scheduled jobs should be:

- idempotent
- observable
- failure-aware
- scoped to the correct environment

---

# 220. Background Jobs

Background jobs should not assume immediate completion.

UI should reflect pending/processing states where necessary.

---

# 221. API Timeouts

External calls should have bounded timeouts.

---

# 222. External Integrations

External integrations require:

- timeout
- retry strategy
- error mapping
- security review
- observability
- fallback behavior where appropriate

---

# 223. UPI Integration

UPI behavior must follow the approved donation/payment specification.

The application must not claim successful payment based solely on launching a UPI intent.

---

# 224. Payment Proof

Proof uploads must remain separate from payment authority.

Uploading proof does not equal verification.

---

# 225. Finance Verification

Only authorized server-side operations may finalize payment verification.

---

# 226. Combined Payments

Combined payment processing must be atomic according to the financial integrity specification.

---

# 227. FIFO Allocation

FIFO allocation logic should exist in one authoritative domain boundary.

Do not implement separate FIFO algorithms in web and mobile.

---

# 228. Overpayment

Overpayment behavior must follow the approved financial rules.

Developers must not invent automatic future-month allocation.

---

# 229. Additional Donations

Additional donations must remain distinguishable from monthly obligations.

---

# 230. Anonymous Donations

Anonymous donation privacy must be preserved across:

- UI
- API
- reports
- notifications
- audit
- search

---

# 231. Jummah Cash

Jummah cash workflows must use the approved domain rules.

Do not reuse member-payment logic if the business semantics differ.

---

# 232. Finance Accounts

Account balances must come from authoritative financial state.

Do not calculate an independent balance in each UI.

---

# 233. Transfers

Transfers must preserve balanced source/destination accounting.

---

# 234. Expenses

Expenses must use the approved lifecycle.

Do not directly mutate final balances from UI code.

---

# 235. Corrections and Reversals

Corrections/reversals must use authoritative operations and preserve history.

---

# 236. Audit

Financial changes must remain traceable.

---

# 237. Member Privacy

Members should see only their authorized records.

---

# 238. Cross-Role Data

One deployment does not mean one unrestricted dataset.

Realtime and APIs must remain permission-scoped.

---

# 239. Realtime UI

Realtime events must be treated as hints/updates to authoritative state, not as a replacement for server validation.

---

# 240. Realtime Race Handling

If a realtime event arrives during a mutation:

- preserve mutation state
- reconcile authoritative result
- invalidate/refetch where required
- prevent stale overwrite

---

# 241. Offline Reconciliation

Offline operations must be reconciled against current server state.

Do not blindly replay stale financial assumptions.

---

# 242. Code Generation

Generated code must be reviewed before merging.

Generated files should follow project standards automatically where possible.

---

# 243. AI Generated SQL

AI-generated SQL requires manual review for:

- RLS
- constraints
- indexes
- transaction behavior
- security
- migration safety

---

# 244. AI Generated Auth

AI-generated auth code requires special review.

Never accept an implementation merely because login appears to work.

---

# 245. AI Generated Finance

AI-generated financial logic requires enhanced review.

At minimum:

- business rule verification
- integrity test
- idempotency test
- concurrency review
- audit review

---

# 246. AI Generated UI

AI-generated UI must be checked against:

- design system
- accessibility
- localization
- responsive behavior
- permissions

---

# 247. AI Generated Translations

AI translations are drafts until reviewed.

---

# 248. AI Review Prompt

A useful review request should ask the reviewer to inspect:

```text
requirements
business rules
authorization
security
data integrity
edge cases
tests
accessibility
localization
performance
```

---

# 249. Cross-AI Review

A second AI can be used as a reviewer without being given implementation ownership.

The second AI should review actual repository state rather than relying on another AI's summary.

---

# 250. Evidence-Based Completion

A feature should be declared complete based on evidence:

- tests
- build output
- database checks
- screenshots
- logs where appropriate
- review results

Not confidence statements.

---

# 251. Verification Record

Important work should record:

```text
What changed
What was tested
What passed
What failed
What remains open
```

---

# 252. Local Verification

Before commit, run the project's approved verification commands.

At minimum where applicable:

```text
typecheck
lint
format check
unit tests
integration tests
web build
mobile validation
```

---

# 253. Formatting Check

Formatting must pass before commit.

---

# 254. Typecheck Check

Typecheck must pass before commit.

---

# 255. Test Check

Required tests must pass before commit.

No knowingly failing critical test should be hidden.

---

# 256. Build Check

Production web build must pass before release.

Mobile build validation must pass at the appropriate release stage.

---

# 257. Migration Verification

Database migrations must be tested in a non-production environment before production application.

---

# 258. RLS Verification

RLS tests must verify both:

- allowed access
- denied access

---

# 259. Storage Verification

Storage tests must verify:

- authorized access
- unauthorized access
- signed URL behavior
- upload validation

---

# 260. Notification Verification

Notification tests must verify:

- event creation
- recipient scope
- localization
- idempotency
- delivery failure handling

---

# 261. Realtime Verification

Realtime tests must verify:

- authorization
- correct subscription
- update delivery
- reconnect
- stale reconciliation

---

# 262. Offline Verification

Offline tests must verify:

- queue creation
- persistence
- replay
- duplicate handling
- conflict
- failure recovery

---

# 263. Performance Verification

Performance checks should cover critical workflows.

Avoid optimizing prematurely, but do not ignore known bottlenecks.

---

# 264. Security Verification

Security checks should include:

- auth
- authz
- RLS
- storage
- secrets
- input validation
- injection
- rate limiting
- audit

---

# 265. Release Candidate

A release candidate should have:

- documentation aligned
- migrations verified
- tests passing
- security reviewed
- accessibility reviewed
- localization reviewed
- build verified
- rollback/recovery considered

---

# 266. Production Deployment

Production deployment should follow the approved deployment specification.

Do not manually bypass release gates for convenience.

---

# 267. Rollback

Every production deployment should have an understood rollback/recovery strategy.

Database migrations require particular caution because code rollback does not automatically reverse data migrations.

---

# 268. Incident Handling

Production incidents should record:

- time
- impact
- affected workflow
- symptoms
- mitigation
- root cause
- corrective action

---

# 269. Post-Incident Documentation

Significant incidents should update:

- operational docs
- tests
- monitoring
- runbooks
- architecture if necessary

---

# 270. Change Management

Changes should be traceable from:

```text
Requirement
  ↓
Documentation
  ↓
Implementation
  ↓
Test
  ↓
Commit
```

---

# 271. Documentation Review

Documentation should be reviewed whenever architecture changes.

Stale documentation is a defect.

---

# 272. Documentation Location

The repository documentation structure should remain organized by domain.

Avoid dozens of unrelated markdown files at repository root.

---

# 273. Markdown Standards

Documentation should use:

- clear headings
- tables where useful
- code blocks for exact syntax
- explicit status
- open decisions
- acceptance criteria

---

# 274. Architecture Decision Records

Important irreversible decisions should be recorded as ADRs or equivalent documented decisions.

---

# 275. Open Decisions

Unresolved decisions should be explicitly marked.

Do not silently convert an assumption into architecture.

---

# 276. Implementation Notes

Temporary implementation notes should not override formal architecture unless formally accepted.

---

# 277. Testing Documentation

Each major feature should identify:

- unit tests
- integration tests
- E2E tests
- security tests
- accessibility tests
- localization tests

---

# 278. Test Naming

Test names should describe behavior.

Prefer:

```text
does not allocate more than the verified payment amount
```

over:

```text
test1
```

---

# 279. Test Independence

Tests should avoid unnecessary ordering dependencies.

---

# 280. Test Cleanup

Tests must clean up temporary state appropriately.

---

# 281. Flaky Tests

Flaky tests should be treated as defects.

Do not repeatedly rerun a flaky test until it passes and call that verification.

---

# 282. Test Determinism

Tests should avoid unnecessary dependence on:

- current time
- random values
- network availability
- external services

Use controlled test inputs.

---

# 283. External Service Tests

External integrations should use approved test/sandbox mechanisms where available.

---

# 284. Time-Based Tests

Financial month logic should use controlled dates/timezones.

---

# 285. Concurrency Test Determinism

Concurrency tests should explicitly coordinate competing operations.

---

# 286. Snapshot Tests

Snapshots should be used selectively.

Do not use snapshots to hide meaningful UI regressions.

---

# 287. Visual Tests

Visual tests should focus on critical screens and stable states.

---

# 288. Accessibility Snapshots

Accessibility checks should be meaningful and reviewed when component structure changes.

---

# 289. Mobile Testing

Mobile tests should cover the supported platform matrix.

---

# 290. Web Testing

Web tests should cover supported browsers according to the deployment target.

---

# 291. Browser Support

The exact browser support matrix is an environment/release decision and must be documented before production.

---

# 292. API Client

The shared API client should provide consistent:

- request handling
- auth context
- error mapping
- idempotency support
- retry policy
- response validation

---

# 293. API Client Security

Do not allow the client to override server authorization headers or impersonate another user.

---

# 294. API Client Errors

Map errors to stable domain error types where appropriate.

---

# 295. API Response Validation

Critical external/API responses may be validated before use where the trust boundary requires it.

---

# 296. Mobile API Connectivity

Mobile networking should handle:

- offline
- timeout
- retry
- auth expiry
- server errors

without silently losing operations.

---

# 297. Web API Connectivity

Web should handle:

- network loss
- session expiry
- server errors
- realtime disconnects

with understandable UI.

---

# 298. Request Cancellation

Long-running or obsolete requests should be cancellable where supported.

---

# 299. Race Conditions in UI

Do not allow stale asynchronous responses to overwrite newer state.

---

# 300. Search Debouncing

Search inputs may use debouncing to reduce unnecessary network calls.

---

# 301. Form Double Submit

Buttons must enter a safe submitting state.

Server idempotency remains the final protection.

---

# 302. Navigation During Mutation

Do not navigate away from important pending operations without preserving appropriate state or confirmation.

---

# 303. Unsaved Changes

Sensitive or lengthy forms may warn before navigation when unsaved changes would otherwise be lost.

---

# 304. Draft Security

Drafts containing sensitive financial information must receive appropriate local storage/security treatment.

---

# 305. Clipboard

Copy functionality should copy exact values.

Sensitive clipboard use should be minimized and clearly initiated by the user.

---

# 306. QR Codes

If QR codes are used, they must have an accessible textual alternative.

---

# 307. Camera

If mobile camera capture is used for proofs/documents:

- request permission appropriately
- explain purpose
- handle denial
- provide file picker fallback where possible

---

# 308. Location

GPS attendance must:

- request location permission appropriately
- explain purpose
- handle denied permission
- avoid unnecessary background location
- validate authoritative attendance rules server-side

---

# 309. Permission Requests

Mobile permissions should be requested only when needed.

---

# 310. Permission Denial

If a permission is denied:

- explain the consequence
- provide a safe alternative if available
- do not repeatedly prompt without reason

---

# 311. Background Behavior

Background execution should be minimized.

Offline sync/background work must follow platform limits.

---

# 312. Battery

Avoid unnecessary:

- GPS polling
- realtime subscriptions
- background jobs
- repeated network requests

---

# 313. Network Efficiency

Use bounded queries and appropriate caching.

---

# 314. Data Freshness

Critical screens should communicate freshness where useful.

---

# 315. Stale Financial Data

Before sensitive financial finalization, revalidate if required by the domain architecture.

---

# 316. UI Race Prevention

Disable or guard conflicting actions while a command is processing.

---

# 317. Server Race Prevention

Database transactions, locks, constraints, or other appropriate mechanisms must protect authoritative state.

---

# 318. Code Duplication

Avoid duplication of business rules.

A rule such as FIFO allocation must have one authoritative implementation.

---

# 319. Shared Validation

Validation rules should be shared where appropriate, but server-side authority remains mandatory.

---

# 320. Utility Functions

Utility functions should have focused responsibilities.

Avoid giant utility modules.

---

# 321. Constants

Domain constants should be centralized.

Examples:

- role identifiers
- permission identifiers
- statuses
- event types

---

# 322. Enum Strategy

Choose a consistent strategy for domain statuses.

Do not mix:

- magic strings
- unrelated enums
- translated labels

for the same domain state.

---

# 323. Stable Identifiers

Database/API identifiers should remain stable and independent of UI wording.

---

# 324. Domain Modules

Recommended conceptual modules:

```text
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
audit
storage
```

---

# 325. Domain Isolation

A domain module should not directly manipulate unrelated domain internals without a clear application boundary.

---

# 326. Cross-Domain Operations

Cross-domain workflows should be explicitly documented.

Example:

```text
payment verification
    ↓
allocation
    ↓
finance transaction
    ↓
notification
    ↓
audit
```

---

# 327. Transaction Boundaries

The authoritative transaction boundary must be defined before implementation.

---

# 328. Event Boundaries

Notifications and secondary processing should be separated from the core financial transaction where appropriate.

---

# 329. Failure Isolation

Failure of a notification should not silently roll back an already committed financial operation unless explicitly required.

---

# 330. Audit Failure

Audit requirements are critical and should have a clear failure strategy.

---

# 331. Database Indexes

Indexes should be introduced based on query patterns.

Do not add indexes blindly.

---

# 332. Index Review

Every significant index should have a reason:

- query
- uniqueness
- foreign-key performance
- sorting
- filtering

---

# 333. Query Plans

Slow critical queries should be inspected using appropriate database tooling.

---

# 334. Large Tables

As financial/audit tables grow, design for:

- pagination
- indexes
- archival/retention where approved
- bounded queries

---

# 335. Audit Growth

Audit data may grow significantly.

Retention and archival policy must be documented.

---

# 336. Notification Growth

Notification history may also grow.

Use pagination and retention policies where appropriate.

---

# 337. Storage Growth

Proof/document storage requires monitoring and lifecycle management.

---

# 338. Cleanup Jobs

Cleanup jobs must be safe and idempotent.

---

# 339. Orphan Files

Storage/database reconciliation should detect orphaned files where practical.

---

# 340. Database Orphans

Referential integrity should prevent unauthorized orphaned records.

---

# 341. Referential Integrity

Use foreign keys where appropriate.

---

# 342. Soft Delete

Soft deletion should be used only when business/audit requirements justify it.

Do not add soft-delete columns everywhere by default.

---

# 343. Deactivation

User/member deactivation should preserve required history while preventing unauthorized future operations.

---

# 344. Historical Records

Historical financial records should remain traceable after member status changes.

---

# 345. Data Retention

Retention requirements must follow approved product/security/operational decisions.

---

# 346. Backup

Backup and recovery are governed by the backup/recovery specification.

Developers must not assume backups exist without verification.

---

# 347. Restore Testing

Backups are only useful if restore procedures are tested.

---

# 348. Disaster Recovery

Critical operational recovery should be documented.

---

# 349. Incident Security

Security incidents should preserve relevant evidence and avoid destructive cleanup before investigation.

---

# 350. Production Logs

Production logs must have appropriate retention and access controls.

---

# 351. Developer Access

Developers should receive only the access needed for their work.

---

# 352. AI Tool Access

AI tools should not receive secrets or unnecessary production data.

---

# 353. AI Context Privacy

When giving repository context to external AI tools, exclude:

- production credentials
- OTPs
- private member data
- payment proofs
- sensitive production exports

---

# 354. AI Generated Documentation

AI-generated documentation must be checked against repository requirements.

---

# 355. AI Generated Tests

AI-generated tests must be reviewed for whether they actually test the business rule.

---

# 356. False Confidence

Passing shallow tests does not prove financial correctness.

---

# 357. Review Evidence

Important reviews should reference actual files/lines/tests rather than vague statements.

---

# 358. Feature Handoff

When changing AI/tool ownership, document:

- current state
- files changed
- tests run
- known issues
- next action

---

# 359. Workspace Cleanliness

Generated temporary files should not pollute the repository.

---

# 360. Build Artifacts

Build outputs should remain excluded from source control unless explicitly required.

---

# 361. Generated Files

Generated code should have clear ownership and regeneration instructions.

---

# 362. Lockfiles

The workspace lockfile should remain committed.

---

# 363. Node/pnpm Version

The project should use the approved Node/pnpm baseline documented by the repository.

---

# 364. Toolchain Verification

Before major work, verify:

```text
node
pnpm
git
typescript
framework versions
```

against the repository expectations.

---

# 365. Local Setup

A new developer should be able to follow repository documentation to:

1. install dependencies
2. configure environment
3. run local applications
4. run tests
5. run typecheck
6. run formatting/lint
7. connect to the correct development backend

---

# 366. Onboarding

Development onboarding should not depend on undocumented personal knowledge.

---

# 367. README

The README should provide the high-level developer entry point.

Detailed standards belong in docs.

---

# 368. Troubleshooting

Recurring setup failures should be documented.

---

# 369. Dependency Failure Handling

When dependency installation fails:

1. inspect actual error
2. check compatibility
3. avoid random upgrades
4. update only with justification
5. rerun full verification

---

# 370. Framework Upgrade

Framework upgrades require:

- official release notes review
- compatibility check
- migration review
- full test
- build verification

---

# 371. Security Patch

Security patches should be prioritized according to severity and compatibility.

---

# 372. Breaking Dependency

Do not accept a dependency breaking change merely to make one warning disappear.

---

# 373. Package Ownership

Packages should have clear ownership/responsibility.

---

# 374. Import Boundaries

Use package exports rather than deep imports into another package's internal files.

---

# 375. Public APIs of Packages

Each shared package should expose a deliberate public API.

---

# 376. Internal Package Files

Internal implementation should not become accidental public API.

---

# 377. Circular Dependency Detection

Circular dependencies should be detected and resolved.

---

# 378. Dead Code

Unused code should be removed when safely identified.

---

# 379. Feature Removal

Removing a feature requires checking:

- routes
- permissions
- API
- database
- storage
- notifications
- tests
- documentation

---

# 380. Deprecation

Deprecated code should have:

- reason
- replacement
- removal target

---

# 381. Release Notes

Meaningful user-facing changes should be documented in release notes/changelog according to repository practice.

---

# 382. Versioning

Application/package versioning should follow the project's release strategy.

---

# 383. Environment Promotion

Promote tested artifacts/configuration rather than manually rebuilding uncertain production state.

---

# 384. Deployment Verification

After deployment verify:

- application health
- authentication
- critical routes
- database connectivity
- RLS
- storage
- notifications
- realtime
- financial workflows as appropriate

---

# 385. Smoke Tests

Production smoke tests should be safe and must not create real financial records unless using an approved isolated test mechanism.

---

# 386. Post-Deployment Monitoring

Monitor:

- errors
- auth failures
- API failures
- database performance
- realtime failures
- notification failures
- storage failures

---

# 387. Rollback Decision

Rollback criteria should be documented before major release.

---

# 388. Database Rollback Caution

Do not assume a database migration can always be reversed automatically.

Use forward-safe migrations where practical.

---

# 389. Data Migration

Data migrations must be:

- tested
- idempotent where practical
- observable
- reversible or recoverable where possible

---

# 390. Data Integrity Checks

After significant financial/data migrations, run integrity queries.

---

# 391. Financial Reconciliation

After financial schema/logic changes, verify reconciliation invariants.

---

# 392. Permission Reconciliation

After permission changes, verify all seven roles against the permission matrix.

---

# 393. Documentation Completion

Before implementation starts, the planned documentation set should be reviewed for contradictions.

---

# 394. Documentation Contradiction Handling

If two documents conflict:

1. identify the conflict
2. do not silently choose
3. resolve the decision
4. update affected documents
5. record the decision

---

# 395. Open Decision Discipline

Open decisions should remain visible until resolved.

---

# 396. No Silent Scope Expansion

A developer or AI must not add major functionality merely because it seems useful.

---

# 397. No Silent Business Rule Changes

Do not change:

- FIFO behavior
- payment allocation
- role permissions
- finance controls
- attendance rules
- notification semantics

without approval/documentation.

---

# 398. No Hidden Admin Powers

Do not add hidden override capabilities for convenience.

---

# 399. No Direct Financial Mutation from UI

UI code must not directly modify authoritative financial state outside approved API/domain boundaries.

---

# 400. No Client-Side Authorization as Security

Client-side checks are UX only.

---

# 401. No Public Sensitive Storage

Sensitive documents must remain private.

---

# 402. No Secret Exposure

Secrets must never be committed or shipped to clients.

---

# 403. No Unreviewed AI Code

AI-generated code must pass the same review standard as human-generated code.

---

# 404. No "Compiles Therefore Done"

Compilation is one verification layer, not completion criteria.

---

# 405. No "Tests Pass Therefore Correct"

Tests must be meaningful and cover business invariants.

---

# 406. No Production Experimentation

Experimental behavior belongs in development/test environments.

---

# 407. No Unbounded Queries

Avoid queries that can accidentally load entire large tables.

---

# 408. No Unscoped Realtime

Do not subscribe clients to unnecessary data.

---

# 409. No Uncontrolled Retries

Retries must be safe and bounded.

---

# 410. No Silent Data Loss

Errors must not silently discard:

- payment data
- form input
- offline operations
- financial evidence

---

# 411. No Hidden Localization Fallback

Missing translations must be detectable.

---

# 412. No Hard-Coded UI Terminology

Important domain labels should come from localization resources.

---

# 413. No LTR-Only Assumptions

RTL must be considered in all layout architecture.

---

# 414. No Color-Only Status

Statuses require text or accessible semantics.

---

# 415. No Mouse-Only Critical Workflow

Critical workflows must be keyboard-accessible on web.

---

# 416. No Accessibility Regression

Accessibility defects must be treated as real product defects.

---

# 417. Engineering Review Gates

Recommended gates:

```text
Gate 1 — Requirement
Gate 2 — Architecture
Gate 3 — Implementation
Gate 4 — Static verification
Gate 5 — Automated tests
Gate 6 — Security
Gate 7 — Accessibility/i18n
Gate 8 — Human review
Gate 9 — Release verification
```

---

# 418. Feature Review Template

Every major feature review should answer:

```text
Requirement:
Business rules:
Architecture:
Files changed:
Database changes:
API changes:
Permissions:
RLS:
Storage:
Realtime:
Offline:
Notifications:
Accessibility:
Localization:
Tests:
Known limitations:
```

---

# 419. Development Completion Record

Before declaring a feature complete:

```text
Implemented:
Verified:
Tests:
Security:
Accessibility:
Localization:
Known issues:
Documentation:
Commit:
```

---

# 420. Final Engineering Principle

Masjid-e-Mamoor should be developed as a real operational system, not as a collection of demo screens.

The engineering standard is:

```text
Correct
  +
Secure
  +
Auditable
  +
Tested
  +
Accessible
  +
Localized
  +
Maintainable
  +
Observable
```

A feature is complete only when its behavior, security, data integrity, user experience, and operational consequences have been verified.

---

# 421. Document Status

**Status:** Draft — Review Required

**Next actions:**

1. Review against `PROJECT_MASTER_SPEC.md`.
2. Review against `SYSTEM_ARCHITECTURE.md`.
3. Review against `RLS_SECURITY_MODEL.md`.
4. Review against `DATABASE_ARCHITECTURE.md`.
5. Review against `TESTING_STRATEGY.md` when generated.
6. Resolve any conflicting standards.
7. Approve development conventions before substantial feature implementation.
