# Masjid-e-Mamoor 2 — Codex End-to-End Development Master Plan

**Document Type:** AI Engineering Execution Master Plan
**Status:** Pre-Development Control Document — Human Review Required
**Version:** 1.0
**Product:** Masjid-e-Mamoor 2 Internal Management Application
**Platforms:** Web, Android, iOS
**Primary Implementation Agent:** Codex
**Architecture / Product Authority:** Project Owner + approved repository documentation
**Repository:** `MdShabazS/masjid-e-mamoor-2`
**Local Workspace:** `/Users/shabaz/Masjid app/Masjid-e-Mamoor-2-Docs`

---

## 1. Purpose

This document defines the controlled, task-by-task workflow Codex must follow for end-to-end development of Masjid-e-Mamoor 2.

The objective is not merely to generate code. The objective is to produce a production-quality, maintainable, secure, tested, future-compatible Web + Android + iOS application whose implementation remains traceable to approved requirements, business rules, architecture, security, database design, UI/UX, testing, and acceptance criteria.

Codex is the primary implementation engineer for this phase. It may inspect, research, implement, test, debug, refactor, harden, and document. It must not silently change approved product rules, financial rules, role definitions, security boundaries, or architecture.

---

## 2. Source-of-Truth Hierarchy

When information conflicts, use this order:

1. `docs/DECISION_BASELINE_V1.md`.
2. `docs/V1_IMPLEMENTATION_DECISION_CLOSURE.md`.
3. `docs/architecture/SYSTEM_ARCHITECTURE.md`.
4. `docs/architecture/ROLE_PERMISSION_MATRIX.md`.
5. `docs/PERMISSION_CATALOGUE_V1_DRAFT.md`.
6. Current domain specifications, including product, business, donation/finance, financial integrity, database, authentication, API, offline, realtime, notification, storage, security operations, backup/recovery, error handling, observability, accessibility/i18n, UI/UX, user flows, testing, and deployment documents.
7. AI/development/process documentation.
8. Verified implementation behavior, only as implementation evidence and never as a silent requirements change.
9. `docs/archive/legacy-v1/`, only where it does not conflict with current documentation.
10. Current authoritative provider documentation for provider-specific facts.
11. AI suggestions.

A chat response, generated code, or third-party example never overrides the repository's approved documentation. `docs/archive/legacy-v1/` is historical/reference material only and must never override current authoritative documentation.

---

## 3. Mandatory Pre-Development Gate

Codex must **not** begin broad feature implementation immediately.

First perform a complete **Documentation + Repository + Architecture Audit**.

Codex must:

- inventory current documentation;
- identify authoritative vs legacy documents;
- read the complete context package;
- inspect current code, migrations, tests and configuration;
- identify contradictions;
- identify unresolved decisions;
- identify security and implementation gaps;
- research version-sensitive technical questions;
- produce a baseline report.

If a contradiction affects product behavior, authorization, financial truth, security, or architecture, Codex must stop and report it rather than silently deciding.

---

## 4. Required Documentation Context Package

Before substantial implementation, inspect the current versions of:

### Product
- `docs/PROJECT_MASTER_SPEC.md`
- `docs/PRODUCT_REQUIREMENTS.md`
- `docs/BUSINESS_RULES.md`
- `docs/USER_FLOWS.md`
- `docs/AI_CONTEXT_INDEX.md`

### Architecture
- `docs/architecture/SYSTEM_ARCHITECTURE.md`
- `docs/architecture/ROLE_PERMISSION_MATRIX.md`
- `docs/DATABASE_ARCHITECTURE.md`
- `docs/API_DOMAIN_ARCHITECTURE.md`
- `docs/AUTHENTICATION_ARCHITECTURE.md`
- `docs/RLS_SECURITY_MODEL.md`
- `docs/REALTIME_DATA_FLOW.md`
- `docs/OFFLINE_SYNC_ARCHITECTURE.md`
- `docs/STORAGE_ARCHITECTURE.md`
- `docs/NOTIFICATION_ARCHITECTURE.md`

### Finance
- `docs/DONATION_FINANCE_SPEC.md`
- `docs/FINANCIAL_INTEGRITY_SPEC.md`

### UI/UX
- `docs/UI_UX_SPEC.md`
- `docs/DESIGN_SYSTEM.md`
- `docs/ACCESSIBILITY_I18N_SPEC.md`

### Engineering
- `docs/DEVELOPMENT_STANDARDS.md`
- `docs/TESTING_STRATEGY.md`
- `docs/ERROR_HANDLING_SPEC.md`
- `docs/OBSERVABILITY_SPEC.md`

### Operations/Security
- `docs/ENVIRONMENT_DEPLOYMENT_SPEC.md`
- `docs/BACKUP_RECOVERY_SPEC.md`
- `docs/SECURITY_OPERATIONS.md`

### AI/Governance
- `docs/AI_DEVELOPMENT_GUIDE.md`
- current governance/project-management documents actually present in the repository.

Legacy archives must not override current approved documents.

---

## 5. Documentation Reconciliation Rules

Codex must never silently reconcile conflicting documents.

For every contradiction:

1. identify both statements;
2. identify the documents;
3. determine whether one is clearly authoritative;
4. distinguish approved decisions from open decisions;
5. research external technical facts only where needed;
6. record the result;
7. stop before implementing the affected behavior when approval is required.

Known examples that require care include authorization scope, member administrative access, referral lifecycle, and any old-vs-new role definitions.

---

## 6. Current Product Roles

Exactly seven V1 roles:

1. President / Super Admin
2. Vice President
3. Secretary
4. Finance
5. Auditor
6. Committee Member
7. Member

Do not create additional roles without an approved product decision.

---

## 7. Current Known Architecture

The project uses a pnpm monorepo with:

- Supabase Auth
- PostgreSQL
- Supabase RLS
- Supabase Realtime
- Supabase Storage
- Next.js App Router
- TypeScript
- React
- Tailwind/shadcn-style UI
- React Hook Form
- Zod
- TanStack Query
- Expo / React Native
- shared packages/types/validation/API layers
- Git/GitHub

Exact installed versions must be verified from the repository and current official documentation. Do not perform major upgrades merely because newer versions exist.

---

## 8. Non-Negotiable Security Rules

- UI visibility is not authorization.
- Backend authorization is mandatory.
- RLS is mandatory where applicable.
- Trusted operations re-check authorization, state and invariants.
- Clients must not directly mutate protected financial/history records.
- SECURITY DEFINER functions must be hardened.
- Financial operations must be server-authoritative.
- Idempotency must be used where specified.
- Audit history must remain traceable.
- Client-controlled roles can never elevate privileges.
- Service-role credentials must never ship to clients.
- Secrets must never be committed or supplied to AI agents.
- Security decisions must never rely only on route/UI labels.

---

## 9. Known Open Decisions

Keep these explicit unless approved:

- legal/organizational retention requirements;
- external incident-notification obligations;
- production browser/platform support matrix;
- exact production observability/provider choices.

Closed V1 product, business, and security decisions must not be reopened merely because technical/provider-specific configuration remains undecided. For example, V1 referral behavior is approved and referrals do not automatically expire. Committee Member member-data access is limited to the member's own permitted profile information and the minimum member information required by an explicitly authorized workflow in which that Committee Member participates; `membership.members.read` is not organization-wide member browsing by itself.

Technical or provider-specific decisions still require implementation-time research where applicable, including Supabase OTP/provider configuration, session configuration, production realtime configuration, notification provider configuration, observability provider selection, browser/platform support matrix, backup operational settings, and version-specific Next.js/Supabase/Expo behavior.

Do not invent open decisions. If implementation genuinely requires a missing product/security/architecture decision, stop and produce a decision proposal.

---

## 10. Research and Open-Source Policy

For version-sensitive or security-sensitive topics, verify current official documentation.

Before adopting open-source code:

1. identify source;
2. verify license;
3. check maintenance/recency;
4. inspect implementation and dependencies;
5. assess security;
6. verify compatibility;
7. adapt rather than blindly copy;
8. test independently;
9. document source/license/version and meaningful modifications.

Prefer MIT, Apache-2.0 and BSD-family licenses. Escalate restrictive licensing.

---

# 11. End-to-End Development Phases

## Phase 0 — Documentation Audit

Deliver:

- documentation inventory;
- authoritative-document map;
- contradiction report;
- unresolved-decision register;
- implementation dependency map;
- technology/version report;
- repository baseline report.

No broad feature implementation during this phase.

## Phase 1 — Architecture Reconciliation

Verify:

- application architecture;
- database architecture;
- API/domain boundaries;
- authentication;
- authorization;
- RLS;
- realtime;
- offline synchronization;
- storage;
- notifications;
- financial integrity;
- error handling;
- observability;
- deployment.

Architecture gaps require a documented decision before implementation.

## Phase 2 — Toolchain Stabilization

Verify/fix only where necessary:

- pnpm workspace;
- TypeScript;
- lint/format;
- tests;
- builds;
- environment templates;
- shared packages;
- package exports;
- module boundaries;
- CI/deployment scripts.

No unrelated refactors.

## Phase 3 — Authentication and Identity

Implement/verify:

- phone authentication;
- OTP;
- sessions;
- logout;
- account status;
- application user;
- member profile relationship;
- role resolution;
- restricted/deactivated behavior.

Test valid/invalid/expired/reused OTP, logout, session expiry and disabled users.

## Phase 4 — Authorization and RLS

Implement/verify:

- role resolution;
- permission resolution;
- RLS;
- trusted operations;
- SECURITY DEFINER hardening;
- direct privilege boundaries;
- cross-user tests;
- privilege escalation tests.

Every important protected operation requires positive and negative tests.

## Phase 5 — Member Management

Implement end-to-end:

### Member
- own profile;
- permitted profile update;
- status;
- history;
- privacy.

### Registration
- referral registration;
- duplicate prevention;
- account/profile linking;
- registration state;
- referral attribution;
- traceability.

### Administration
- authorized listing;
- search/filter;
- detail;
- permitted updates;
- status lifecycle;
- audit/history.

Do not invent an operational scope model.

## Phase 6 — Referral Management

Implement:

- referral creation;
- referrer attribution;
- referred identity;
- registration linkage;
- lifecycle;
- duplicate prevention;
- authorization;
- auditability.

Never silently change historical referral attribution.

## Phase 7 — Donation Domain

Implement according to approved rules:

- recurring monthly obligations;
- effective-month history;
- FIFO outstanding allocation;
- partial payments;
- overpayment;
- additional donations;
- anonymous donations;
- Jummah cash;
- payment states;
- Finance verification;
- rejection/resubmission;
- combined outstanding payment;
- idempotency;
- concurrency protection.

**Expected donation is not verified money.**

## Phase 8 — UPI / Payment Workflow

Implement and test:

- UPI intent/deep links;
- payment initiation;
- submission;
- Finance verification;
- rejection;
- resubmission;
- duplicate prevention;
- recovery.

Opening a payment link or client confirmation is not payment verification.

## Phase 9 — Finance and Accounting

Implement:

- accounts;
- account taxonomy;
- transactions;
- transfers;
- expenses;
- bills/proofs;
- maker/checker;
- corrections;
- reversals;
- audit;
- reconciliation;
- cash lifecycle;
- balances;
- reports.

Historical financial meaning must not be silently rewritten.

## Phase 10 — Committee Work Management

Implement:

- tasks;
- assignment;
- volunteer/open tasks;
- single claimant concurrency;
- progress;
- deadlines;
- overdue state;
- completion;
- history;
- meeting follow-up.

No rankings, leaderboards or artificial performance scores.

## Phase 11 — Meetings

Implement:

- meeting creation;
- agenda;
- attendance;
- decisions;
- follow-up tasks;
- history;
- authorization.

## Phase 12 — Jummah Attendance

Implement:

- Friday attendance;
- one attendance per member per Friday;
- server validation;
- server-side V1 GPS validation using the approved 100 metre acceptance
  radius where GPS attendance applies;
- client-side GPS or distance checks for user feedback only;
- approved offline operation;
- synchronization;
- duplicate prevention;
- auditability.

Offline clients never become the ultimate source of attendance truth.

## Phase 13 — Offline Synchronization

Implement after server-authoritative contracts are stable.

Use:

- typed operations;
- stable operation IDs;
- deterministic payloads;
- validation;
- retry;
- idempotency;
- conflict handling;
- local persistence;
- sync state;
- safe recovery.

Never permit arbitrary offline DB commands.

## Phase 14 — Notifications

Implement:

- notification events;
- outbox;
- delivery attempts;
- retries;
- failure states;
- preferences where approved;
- read/unread.

Notifications never become business truth.

## Phase 15 — Reports and Audit

Implement authorized:

- financial reports;
- donation reports;
- committee reports;
- attendance reports;
- audit records;
- exports;
- print/download where approved.

Reports must obey authorization.

---

# 12. Web Product

Build against the approved design system.

Every important screen must include:

- responsive layout;
- accessibility;
- keyboard support;
- loading states;
- empty states;
- error states;
- retry states;
- success confirmation;
- safe handling of consequential actions;
- realtime updates where required;
- localization;
- no fake functionality.

---

# 13. Android Application

Build the Android application using the approved mobile architecture.

Verify:

- authentication;
- navigation;
- secure storage;
- permissions;
- offline;
- synchronization;
- notifications;
- deep links;
- lifecycle;
- network transitions;
- background limitations;
- Android compatibility;
- device-size behavior;
- accessibility;
- performance.

Test multiple realistic device profiles.

---

# 14. iOS Application

Build the iOS application using the approved mobile architecture.

Verify:

- authentication;
- navigation;
- secure storage;
- offline;
- synchronization;
- notifications;
- deep links;
- lifecycle;
- network transitions;
- background limitations;
- iOS compatibility;
- accessibility;
- performance.

Test multiple realistic device profiles.

---

# 15. Shared Mobile Architecture

Android and iOS are one product, not two unrelated implementations.

Share where platform-neutral:

- domain models;
- validation;
- API contracts;
- business logic;
- query/state patterns;
- localization resources;
- design tokens;
- fixtures/tests.

Use platform-specific code only where required.

---

# 16. Future Compatibility

Design for controlled future updates.

Avoid:

- unnecessary framework coupling;
- hard-coded API assumptions;
- irreversible DB design;
- unversioned contracts;
- destructive migrations;
- hidden client/server dependencies;
- platform-specific business logic where avoidable.

Use where appropriate:

- additive migrations;
- backward-compatible schema changes;
- versioned contracts;
- stable IDs;
- feature flags;
- explicit deprecation paths;
- compatibility tests;
- migration documentation.

For major dependency upgrades:

1. review official changelog/migration guide;
2. assess compatibility;
3. run automated tests;
4. verify Android/iOS/web;
5. consider rollback.

---

# 17. Continuous Testing Strategy

Testing is continuous, not a final phase.

### Unit
- validation;
- pure business logic;
- state transitions;
- allocation algorithms.

### Integration
- DB;
- RPCs;
- domain workflows;
- transactions;
- idempotency.

### RLS/Security
- all representative roles;
- own vs other user;
- authorized vs unauthorized;
- direct table access;
- RPC access;
- privilege escalation.

### Concurrency
- duplicate operation;
- simultaneous task claim;
- payment;
- transfer;
- status change.

### E2E
- authentication;
- registration;
- donation;
- Finance verification;
- finance workflows;
- committee workflows;
- attendance;
- reports.

### Mobile
- Android;
- iOS;
- offline;
- reconnect;
- restart;
- background/foreground;
- deep links;
- notifications.

### Regression
Every completed feature remains covered after later work.

---

# 18. Product-Level Error Standard

"Error-free" means no known blocking defect, no TypeScript error, no failing applicable automated test, no known critical security issue, no broken migration, no known authorization bypass, and no known critical broken flow.

A passing build alone is never evidence of production readiness.

---

# 19. Definition of Done

A feature is not complete merely because its UI exists or TypeScript compiles.

A feature is DONE only when applicable:

### Product
- requirements implemented;
- business rules enforced;
- edge cases handled.

### Security
- authorization enforced;
- RLS verified;
- direct writes blocked where required;
- privilege escalation tested.

### Data
- constraints correct;
- atomicity verified;
- idempotency verified;
- concurrency verified.

### UX
- loading;
- empty;
- error;
- retry;
- success;
- accessibility;
- localization.

### Quality
- unit;
- integration;
- RLS/security;
- E2E;
- regression.

### Operations
- observability;
- deployment behavior;
- migration safety;
- rollback consideration.

### Documentation
- implementation status updated;
- decisions recorded;
- limitations recorded.

---

# 20. Codex Task Execution Protocol

Every substantial task follows:

**READ → UNDERSTAND → RESEARCH → PLAN → IMPLEMENT → TEST → REVIEW → FIX → VERIFY → DOCUMENT → REPORT**

Before modifying files, identify:

- relevant requirements;
- business rules;
- security boundaries;
- affected files;
- migration impact;
- test impact;
- rollback implications.

---

# 21. Small Verified Checkpoints

Do not make one uncontrolled mega-change.

Use:

```text
Database
  ↓
Authorization/RLS
  ↓
Backend/domain
  ↓
Shared types/validation
  ↓
Web
  ↓
Android
  ↓
iOS
  ↓
Tests
  ↓
Security verification
  ↓
Acceptance
```

Each checkpoint must be verifiable.

---

# 22. Git Discipline

Codex must:

- inspect status before work;
- preserve unrelated user changes;
- never reset without explicit authorization;
- never force-push;
- never rewrite history;
- keep changes logically grouped;
- review diffs;
- avoid generated noise.

**Do not commit or push unless explicitly requested.**

---

# 23. Database Migration Discipline

Never edit an already-applied migration just to clean it up.

Create a new corrective migration when required.

For every migration:

- test upgrade;
- verify migration history;
- verify schema;
- verify grants;
- verify RLS;
- verify trusted functions;
- test behavior.

Never reset production-like data for convenience.

---

# 24. Supabase Safety

Use the existing local environment safely.

Do not unnecessarily stop/recreate the healthy stack or change ports.

Never expose service-role credentials.

Never place service-role credentials in web/mobile code.

Verify local and production environments separately.

---

# 25. Efficient Codex Usage

Use Codex as the implementation owner.

### Efficient approach

- One implementation owner per feature area.
- Use the AI context index rather than pasting the entire repository repeatedly.
- Use task-specific prompts.
- Batch related inspection.
- Let Codex run terminal/tests directly.
- Let Codex fix failures inside the current task.
- Maintain a decision/open-issue log.
- Use verified checkpoints.
- Avoid repeated rediscovery of stable architecture.

### Avoid

- giant unrelated one-shot prompts;
- multiple agents editing the same files;
- blind dependency upgrades;
- asking for code before requirements are reconciled;
- accepting compile success as completion;
- repeatedly rewriting working code without evidence.

---

# 26. Recommended Codex Session Plan

## Session A — Master Audit

Only:

- documentation audit;
- repository audit;
- architecture reconciliation;
- open decision report;
- technical research;
- implementation roadmap.

## Session B — Foundation

- toolchain;
- shared packages;
- testing infrastructure;
- CI;
- environment;
- app shells.

## Session C onward — Vertical Slices

One complete capability at a time.

Each slice should include:

**Database + Authorization + Backend + Web + Android + iOS + Tests + Documentation**

Do not build a frontend-only illusion of a feature.

---

# 27. Master Prompt — Initial Codex Session

Paste this after giving Codex the local directory and repository:

```text
You are the primary implementation engineer for Masjid-e-Mamoor 2.

Do NOT start feature coding immediately.

First perform a complete Documentation + Repository + Architecture Audit.

Repository:
[LOCAL DIRECTORY]

GitHub:
MdShabazS/masjid-e-mamoor-2

Read the current authoritative documentation before making architectural or feature decisions.

Inspect:
- product requirements
- business rules
- user flows
- architecture
- role/permission matrix
- database architecture
- API/domain architecture
- authentication
- RLS/security
- realtime
- offline sync
- storage
- notifications
- finance/integrity
- UI/UX/design system
- accessibility/i18n
- testing
- error handling
- observability
- deployment
- backup/recovery
- AI development guide
- governance
- existing migrations
- source code
- tests
- configuration
- Git state

Treat the repository and approved documentation as the source of truth.

Do not silently reconcile contradictions.

Research current official documentation where version-sensitive technical facts matter.

Identify:
1. authoritative documents;
2. legacy documents;
3. contradictory requirements;
4. unresolved decisions;
5. security-sensitive gaps;
6. implementation gaps;
7. dependency/version risks;
8. Android risks;
9. iOS risks;
10. web risks;
11. database/RLS risks;
12. testing gaps;
13. deployment/recovery risks.

Do not implement broad features during this audit.

Produce:
- Documentation Audit Report
- Architecture Reconciliation Report
- Current Repository Report
- Open Decision Register
- Risk Register
- Dependency/Platform Compatibility Report
- Task-by-task implementation roadmap

Do not commit.
Do not push.
Do not reset.
Do not delete unrelated work.

If a contradiction affects product behavior, authorization, financial truth, security, or architecture, stop and report it for approval.
```

---

# 28. Master Prompt — Implementation Task Template

```text
Implement TASK-[ID]: [TASK NAME].

Before coding:
1. Read relevant requirements.
2. Read relevant business rules.
3. Read relevant architecture.
4. Read authorization/RLS rules.
5. Read UI/UX requirements.
6. Read relevant tests/acceptance criteria.
7. Inspect existing implementation.
8. Research current official technical documentation where needed.

Do not invent requirements.

Plan the implementation.

Implement end-to-end:
- database if required;
- authorization/RLS;
- backend/domain;
- shared types/validation;
- web;
- Android;
- iOS;
- tests;
- documentation.

Verify:
- typecheck;
- lint;
- unit tests;
- integration tests;
- RLS/security tests;
- E2E tests applicable to the task;
- mobile tests applicable to the task;
- build;
- migration verification;
- git diff check.

Test negative cases and duplicate/concurrent cases where applicable.

Fix discovered defects before reporting completion.

Update implementation status and decision documentation where appropriate.

Do not commit or push unless explicitly requested.

Report:
- files changed;
- database changes;
- security changes;
- tests run/results;
- known limitations;
- remaining risks;
- acceptance status.
```

---

# 29. Master Prompt — Final Product Verification

```text
Perform a full production-readiness audit of Masjid-e-Mamoor 2.

Do not assume the implementation is correct because previous tasks passed.

Re-read authoritative documentation and acceptance criteria.

Audit:
1. every V1 product requirement;
2. every approved business rule;
3. every role/permission;
4. RLS;
5. trusted operations;
6. financial invariants;
7. idempotency;
8. concurrency;
9. auditability;
10. offline sync;
11. realtime;
12. notifications;
13. web UX;
14. Android UX;
15. iOS UX;
16. accessibility;
17. English/Hindi/Kannada/Urdu;
18. Urdu RTL;
19. error states;
20. loading states;
21. empty states;
22. network failures;
23. authentication failures;
24. migration safety;
25. dependency compatibility;
26. build/release configuration;
27. backup/recovery;
28. observability;
29. security;
30. test coverage;
31. regression risk.

Run the complete applicable automated test suite.

Perform targeted E2E/manual verification where automation cannot establish product behavior.

Search for:
- TODO/FIXME;
- placeholder UI;
- mock data;
- fake success states;
- disabled security checks;
- swallowed errors;
- unhandled promises;
- unsafe any;
- client-side authorization assumptions;
- direct protected table mutations;
- exposed secrets;
- stale dependencies;
- broken routes/links;
- console/runtime errors.

Do not claim production readiness without evidence.

Produce:
- final verification report;
- requirement traceability summary;
- test summary;
- security summary;
- platform summary;
- known issues;
- release blockers;
- recommended release decision.

Do not commit or push.
```

---

# 30. Required Codex Evidence

Every completed task must report:

```text
TASK ID
TASK NAME

Requirements covered:
Business rules covered:
Architecture affected:
Security affected:
Database affected:
Web affected:
Android affected:
iOS affected:

Files changed:
Migrations:
Dependencies:

Tests:
Typecheck:
Lint:
Unit:
Integration:
RLS/Security:
E2E:
Mobile:
Build:

Failures encountered:
Fixes made:

Known limitations:
Open decisions:
Rollback considerations:

Acceptance:
PASS / FAIL / BLOCKED
```

---

# 31. Final Product Quality Gate

The V1 release candidate requires:

```text
Requirements
+
Business Rules
+
Security
+
Database Integrity
+
Authorization
+
Web
+
Android
+
iOS
+
Accessibility
+
Localization
+
Offline
+
Realtime
+
Testing
+
Observability
+
Deployment
+
Backup/Recovery
+
Documentation
+
UAT
=
V1 RELEASE CANDIDATE
```

A missing critical component means the product remains incomplete.

---

# 32. Final Principle

The goal is not:

> "Let AI build the app."

The goal is:

> **Use Codex as a high-capability implementation engineer operating under a documented engineering system, with repository-controlled requirements, verified architecture, automated tests, security boundaries, product-level acceptance criteria, and explicit human approval for consequential decisions.**

Codex should perform the maximum amount of implementation work possible.

The project owner remains the authority for what the product is.

The repository remains the source of truth.

Tests remain evidence.

Security remains mandatory.

Documentation remains synchronized with implementation.

No AI-generated implementation becomes authoritative merely because it compiles.
