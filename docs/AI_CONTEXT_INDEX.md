# AI CONTEXT INDEX

**Project:** Masjid-e-Mamoor 2  
**Version:** 1.0  
**Status:** Draft — Review Required  
**Purpose:** Provide a single navigation and context map for AI tools, developers, reviewers, and future sessions.

---

## 1. Purpose

This document is the entry point for AI-assisted work on Masjid-e-Mamoor 2.

It answers:

- What is this project?
- Which document controls which decision?
- Where should an AI agent start?
- Which documents are authoritative for a given task?
- What must be reviewed before implementation?
- How should an AI agent avoid inventing requirements?
- How can a future AI session continue work without relying on hidden conversation context?

The repository documentation, implementation, tests, and Git history form the project source of truth.

---

## 2. Source-of-Truth Order

When sources appear to conflict, use this order:

1. explicit approved product/business decision;
2. `PROJECT_MASTER_SPEC.md`;
3. domain-specific approved specification;
4. `SYSTEM_ARCHITECTURE.md`;
5. `ROLE_PERMISSION_MATRIX.md`;
6. security/RLS/financial integrity rules;
7. development and testing standards;
8. verified implementation behavior;
9. current official external provider documentation;
10. AI suggestions.

AI-generated suggestions never silently override approved project decisions.

---

## 3. Project Identity

**Product:** Masjid-e-Mamoor 2

**Architecture:** single application platform with shared authoritative backend.

**Primary backend direction:**

- Supabase Auth;
- PostgreSQL;
- Row Level Security;
- Supabase Storage;
- Supabase Realtime;
- trusted server-side/domain operations.

**Web direction:**

- Next.js App Router;
- TypeScript;
- React;
- Tailwind CSS;
- shadcn/ui-style component architecture;
- TanStack Query;
- React Hook Form;
- Zod.

**Mobile direction:**

- Expo;
- React Native;
- TypeScript;
- TanStack Query;
- React Hook Form;
- Zod;
- Secure Store;
- Expo/EAS.

**Repository structure:**

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

---

## 4. Roles

The application has exactly seven defined roles:

1. President / Super Admin
2. Vice President
3. Secretary
4. Finance
5. Auditor
6. Committee Member
7. Member

Do not invent additional roles without an explicit product/architecture decision.

---

## 5. Highest-Level Product Domains

The main domains are:

- authentication and identity;
- member management;
- referral registration;
- donation obligations;
- payments;
- UPI intent/deep-link flow;
- payment proof;
- Finance verification;
- FIFO allocation;
- partial payments;
- multi-month allocation;
- overpayment;
- additional donations;
- anonymous donations;
- Jummah cash;
- combined payments;
- finance accounts;
- transactions;
- transfers;
- expenses;
- corrections/reversals;
- committee tasks;
- meetings;
- attendance;
- GPS attendance;
- offline synchronization;
- notifications;
- reports;
- storage;
- audit;
- realtime;
- security;
- operations.

---

## 6. Master Document Map

| Document | Primary purpose |
|---|---|
| `PROJECT_MASTER_SPEC.md` | Overall project contract |
| `PRODUCT_REQUIREMENTS.md` | Product behavior and requirements |
| `BUSINESS_RULES.md` | Business invariants and domain rules |
| `USER_FLOWS.md` | End-to-end user journeys |
| `SYSTEM_ARCHITECTURE.md` | Overall technical architecture |
| `ROLE_PERMISSION_MATRIX.md` | Role and permission authority |
| `DATABASE_ARCHITECTURE.md` | Data model and database behavior |
| `RLS_SECURITY_MODEL.md` | Row-level authorization |
| `AUTHENTICATION_ARCHITECTURE.md` | Identity, OTP, sessions |
| `REALTIME_DATA_FLOW.md` | Realtime behavior |
| `OFFLINE_SYNC_ARCHITECTURE.md` | Offline data and replay |
| `API_DOMAIN_ARCHITECTURE.md` | Domain APIs and command/query boundaries |
| `STORAGE_ARCHITECTURE.md` | File/storage security |
| `NOTIFICATION_ARCHITECTURE.md` | In-app and push notifications |
| `DONATION_FINANCE_SPEC.md` | Donation and finance behavior |
| `FINANCIAL_INTEGRITY_SPEC.md` | Financial invariants and atomicity |
| `UI_UX_SPEC.md` | Product UX |
| `DESIGN_SYSTEM.md` | Visual/component system |
| `ACCESSIBILITY_I18N_SPEC.md` | Accessibility and localization |
| `DEVELOPMENT_STANDARDS.md` | Coding and engineering standards |
| `TESTING_STRATEGY.md` | Testing and release verification |
| `ERROR_HANDLING_SPEC.md` | Error contracts and recovery |
| `OBSERVABILITY_SPEC.md` | Logs, metrics, traces, alerts |
| `ENVIRONMENT_DEPLOYMENT_SPEC.md` | Environments and deployment |
| `BACKUP_RECOVERY_SPEC.md` | Backup and recovery |
| `SECURITY_OPERATIONS.md` | Operational security |
| `AI_DEVELOPMENT_GUIDE.md` | AI-assisted development rules |
| `AI_CONTEXT_INDEX.md` | This navigation/index document |

---

## 7. Product Requirements Navigation

Use `PRODUCT_REQUIREMENTS.md` when the question is:

- What should the product do?
- What should a user be able to accomplish?
- What are the product acceptance criteria?
- What are the required workflows?
- What UX behavior is required?

Do not use AI assumptions to fill an undocumented product requirement.

---

## 8. Business Rules Navigation

Use `BUSINESS_RULES.md` when the question is:

- What is the authoritative business behavior?
- How does donation obligation history work?
- How does FIFO work?
- How are partial payments handled?
- What happens with overpayment?
- What is allowed for anonymous/Jummah donations?
- How are finance mutations constrained?

Business rules take priority over convenience of implementation.

---

## 9. User Flow Navigation

Use `USER_FLOWS.md` when the question is:

- What does the user do step-by-step?
- What happens after submission?
- What happens after Finance verification?
- What happens during offline attendance?
- What happens when authorization fails?
- What does a realtime update look like?

User flows should match business rules and architecture.

---

## 10. Architecture Navigation

Use `SYSTEM_ARCHITECTURE.md` when deciding:

- component boundaries;
- web/mobile/backend boundaries;
- authoritative data sources;
- trusted operations;
- realtime;
- offline;
- deployment;
- testing layers;
- cross-domain architecture.

If an implementation requires a structural deviation, review this document before coding.

---

## 11. Permission Navigation

Use `ROLE_PERMISSION_MATRIX.md` for:

- role access;
- permissions;
- separation of duties;
- sensitive operations;
- member privacy;
- Finance capabilities;
- Auditor boundaries;
- administration permissions.

Never infer authorization from UI visibility.

---

## 12. Database Navigation

Use `DATABASE_ARCHITECTURE.md` for:

- tables;
- relationships;
- constraints;
- indexes;
- monetary data;
- timestamps;
- transaction boundaries;
- concurrency;
- migrations;
- derived data;
- realtime source tables.

Use `FINANCIAL_INTEGRITY_SPEC.md` alongside it for financial mutations.

---

## 13. RLS Navigation

Use `RLS_SECURITY_MODEL.md` for:

- RLS policy design;
- role-based row access;
- member privacy;
- Finance access;
- Auditor access;
- storage authorization principles;
- trusted functions;
- negative authorization tests.

Every exposed protected table needs an explicit security strategy.

---

## 14. Authentication Navigation

Use `AUTHENTICATION_ARCHITECTURE.md` for:

- phone OTP;
- account provisioning;
- sessions;
- logout;
- refresh;
- account status;
- role resolution;
- web/mobile auth;
- deep links;
- recovery.

Authentication is not authorization.

---

## 15. Realtime Navigation

Use `REALTIME_DATA_FLOW.md` for:

- subscriptions;
- initial fetch/subscription race;
- duplicate events;
- missed events;
- reconnect;
- cache invalidation;
- role-scoped realtime;
- cross-role updates.

The database remains authoritative.

---

## 16. Offline Navigation

Use `OFFLINE_SYNC_ARCHITECTURE.md` for:

- offline capabilities;
- local queues;
- operation IDs;
- retry;
- conflicts;
- replay;
- crash recovery;
- offline attendance;
- restricted financial behavior.

Offline data is not automatically authoritative.

---

## 17. API Navigation

Use `API_DOMAIN_ARCHITECTURE.md` for:

- domain boundaries;
- queries;
- commands;
- validation;
- DTOs;
- idempotency;
- API errors;
- pagination;
- search;
- exports;
- storage integration.

---

## 18. Storage Navigation

Use `STORAGE_ARCHITECTURE.md` for:

- payment proofs;
- financial documents;
- member/committee files;
- private buckets;
- object paths;
- signed URLs;
- upload/download authorization;
- retention;
- cleanup.

Storage paths are not authorization by themselves.

---

## 19. Notification Navigation

Use `NOTIFICATION_ARCHITECTURE.md` for:

- notification events;
- outbox;
- push;
- in-app notifications;
- retries;
- deduplication;
- localization;
- notification privacy;
- deep links;
- push tokens.

---

## 20. Donation and Finance Navigation

Use `DONATION_FINANCE_SPEC.md` for the complete financial product workflow.

Use it when implementing:

- monthly obligations;
- payment submission;
- UPI;
- proof;
- Finance verification;
- FIFO;
- partial payments;
- multi-month payment;
- overpayment;
- additional donation;
- anonymous donation;
- Jummah cash;
- combined payment;
- accounts;
- transfers;
- expenses;
- corrections;
- reversals.

---

## 21. Financial Integrity Navigation

Use `FINANCIAL_INTEGRITY_SPEC.md` whenever code can change money-related state.

This document governs:

- invariants;
- atomicity;
- idempotency;
- concurrency;
- reconciliation;
- ledger/balance integrity;
- reversal/correction safety;
- financial failure recovery.

Financial code receives stricter review than ordinary UI code.

---

## 22. UI/UX Navigation

Use `UI_UX_SPEC.md` for:

- information architecture;
- dashboards;
- role-specific navigation;
- forms;
- payment UX;
- finance UX;
- committee UX;
- offline UX;
- realtime UX;
- errors;
- empty states;
- responsive behavior.

---

## 23. Design System Navigation

Use `DESIGN_SYSTEM.md` for:

- tokens;
- typography;
- spacing;
- colors;
- component states;
- buttons;
- inputs;
- tables;
- navigation;
- dashboards;
- financial components;
- responsive rules;
- component architecture.

Do not introduce arbitrary visual patterns when an approved component exists.

---

## 24. Accessibility and Localization Navigation

Use `ACCESSIBILITY_I18N_SPEC.md` for:

- keyboard behavior;
- screen readers;
- semantic structure;
- contrast;
- touch targets;
- English;
- Hindi;
- Kannada;
- Urdu;
- Urdu RTL;
- localization testing.

---

## 25. Development Standards Navigation

Use `DEVELOPMENT_STANDARDS.md` for:

- TypeScript;
- React;
- Next.js;
- Expo;
- Supabase;
- PostgreSQL;
- Git;
- dependencies;
- testing;
- security;
- migrations;
- AI-assisted development;
- release standards.

---

## 26. Testing Navigation

Use `TESTING_STRATEGY.md` for:

- unit tests;
- component tests;
- integration tests;
- E2E;
- RLS tests;
- financial tests;
- concurrency;
- idempotency;
- offline;
- realtime;
- storage;
- notifications;
- accessibility;
- localization;
- performance;
- release gates.

---

## 27. Error Handling Navigation

Use `ERROR_HANDLING_SPEC.md` for:

- error taxonomy;
- stable codes;
- validation;
- authorization;
- financial errors;
- idempotency errors;
- concurrency errors;
- offline errors;
- storage errors;
- UI mapping;
- logging;
- recovery.

Never represent an unknown financial outcome as a confirmed success or failure.

---

## 28. Observability Navigation

Use `OBSERVABILITY_SPEC.md` for:

- structured logs;
- metrics;
- traces;
- correlation IDs;
- API telemetry;
- financial telemetry;
- realtime telemetry;
- offline telemetry;
- storage;
- notifications;
- alerts;
- incident investigation.

Observability does not replace audit.

---

## 29. Deployment Navigation

Use `ENVIRONMENT_DEPLOYMENT_SPEC.md` for:

- local;
- test;
- staging;
- production;
- environment variables;
- migrations;
- CI/CD;
- Vercel;
- Expo/EAS;
- release;
- rollback;
- forward-fix;
- deployment evidence.

---

## 30. Backup and Recovery Navigation

Use `BACKUP_RECOVERY_SPEC.md` for:

- backup strategy;
- RPO;
- RTO;
- PITR;
- logical backups;
- storage recovery;
- restore testing;
- incident recovery;
- financial recovery verification.

A backup is not considered proven until restore behavior has been tested.

---

## 31. Security Operations Navigation

Use `SECURITY_OPERATIONS.md` for:

- threat model;
- secrets;
- sessions;
- OTP abuse;
- RLS;
- storage;
- financial security;
- incident response;
- vulnerability management;
- production access;
- security monitoring;
- penetration testing;
- security release gates.

---

## 32. AI Development Navigation

Use `AI_DEVELOPMENT_GUIDE.md` for:

- AI tool usage;
- prompt structure;
- implementation ownership;
- code review;
- multi-AI workflow;
- secret protection;
- testing;
- security review;
- generated UI;
- architecture deviations;
- AI handoffs;
- completion criteria.

---

## 33. Feature-to-Document Map

| Feature | Primary documents | Security documents |
|---|---|---|
| OTP login | Authentication, User Flows | RLS, Security Operations |
| Referral registration | Requirements, Business Rules, User Flows | Authentication, RLS |
| Member profile | Requirements, User Flows | RLS, Permissions |
| Donation obligation | Business Rules, Donation/Finance | Financial Integrity, RLS |
| UPI payment | Donation/Finance, User Flows | Security, API, Storage |
| Payment proof | Donation/Finance, Storage | RLS, Storage, Security |
| Finance verification | Donation/Finance | Financial Integrity, RLS |
| FIFO allocation | Donation/Finance | Financial Integrity, Database |
| Combined payment | Donation/Finance | Financial Integrity, API |
| Overpayment | Donation/Finance | Financial Integrity |
| Anonymous donation | Donation/Finance | Privacy, RLS, Storage |
| Jummah cash | Donation/Finance | Financial Integrity |
| Accounts | Donation/Finance, Database | Financial Integrity, RLS |
| Transfers | Donation/Finance | Financial Integrity |
| Expenses | Donation/Finance | Financial Integrity, RLS |
| Corrections | Donation/Finance | Financial Integrity, Audit |
| Committee tasks | Requirements, User Flows | Permissions, RLS |
| Meetings | Requirements, User Flows | Permissions |
| Attendance | User Flows, Offline | RLS, Security |
| GPS attendance | User Flows, Offline | Security, Privacy |
| Offline sync | Offline, API | Security, RLS |
| Realtime dashboards | Realtime, UI/UX | RLS, Security |
| Notifications | Notifications | Security, Privacy |
| Reports | Requirements, API | RLS, Security |
| Exports | API, UI/UX | Security, Storage |
| File upload | Storage | RLS, Security |
| Role administration | Permissions | RLS, Authentication, Security |

---

## 34. Cross-Cutting Rule Map

### Authentication

Read:

- `AUTHENTICATION_ARCHITECTURE.md`
- `RLS_SECURITY_MODEL.md`
- `ROLE_PERMISSION_MATRIX.md`
- `SECURITY_OPERATIONS.md`

### Authorization

Read:

- `ROLE_PERMISSION_MATRIX.md`
- `RLS_SECURITY_MODEL.md`
- `SYSTEM_ARCHITECTURE.md`
- `SECURITY_OPERATIONS.md`

### Financial Changes

Read:

- `BUSINESS_RULES.md`
- `DONATION_FINANCE_SPEC.md`
- `FINANCIAL_INTEGRITY_SPEC.md`
- `DATABASE_ARCHITECTURE.md`
- `RLS_SECURITY_MODEL.md`

### Offline Changes

Read:

- `OFFLINE_SYNC_ARCHITECTURE.md`
- `API_DOMAIN_ARCHITECTURE.md`
- `REALTIME_DATA_FLOW.md`
- `SECURITY_OPERATIONS.md`
- `TESTING_STRATEGY.md`

### Storage Changes

Read:

- `STORAGE_ARCHITECTURE.md`
- `RLS_SECURITY_MODEL.md`
- `SECURITY_OPERATIONS.md`
- `API_DOMAIN_ARCHITECTURE.md`

### Deployment Changes

Read:

- `ENVIRONMENT_DEPLOYMENT_SPEC.md`
- `BACKUP_RECOVERY_SPEC.md`
- `OBSERVABILITY_SPEC.md`
- `SECURITY_OPERATIONS.md`

---

## 35. AI Agent Start Procedure

Before implementing a task, an AI agent should:

1. read this index;
2. identify the feature/domain;
3. open the relevant primary specification;
4. open applicable security/permission documents;
5. inspect the current implementation;
6. inspect existing tests;
7. identify allowed files;
8. state assumptions;
9. implement the smallest appropriate change;
10. run required verification.

---

## 36. AI Agent Stop Conditions

An AI agent should stop and ask for clarification when:

- business rules conflict;
- permissions are ambiguous;
- financial semantics are unclear;
- schema authority is unclear;
- security boundaries conflict;
- an architecture change is required;
- destructive migration is proposed;
- production secrets would be needed;
- required external behavior cannot be verified.

Do not invent an answer merely to continue coding.

---

## 37. AI Agent Forbidden Assumptions

An AI agent must not assume:

- UI hiding equals authorization;
- authenticated equals authorized;
- service role is safe in a client;
- random IDs provide authorization;
- successful navigation proves payment;
- client-reported balances are authoritative;
- offline data is authoritative;
- a realtime event is guaranteed exactly once;
- an AI-generated implementation is secure;
- compile success means completion.

---

## 38. Implementation Sequence

The preferred feature implementation sequence is:

1. confirm requirement;
2. confirm business rule;
3. confirm role/permission;
4. confirm data model;
5. confirm API/domain contract;
6. confirm security/RLS;
7. implement backend/domain behavior;
8. implement web/mobile clients;
9. implement realtime/offline behavior where applicable;
10. add tests;
11. review;
12. update documentation;
13. commit.

---

## 39. Verification Sequence

For a substantial feature:

```text
Format
  ↓
Typecheck
  ↓
Unit/Component Tests
  ↓
Integration Tests
  ↓
RLS/Security Tests
  ↓
Financial Tests if applicable
  ↓
E2E Tests
  ↓
Production Build
  ↓
Diff Review
  ↓
Documentation Review
```

Not every feature needs every layer, but the omitted layers must be intentionally judged.

---

## 40. Repository Navigation

Expected major paths:

```text
apps/
  web/
  mobile/

packages/
  shared/
  types/
  validation/
  api-client/
  config/

docs/
  architecture/
  ...
```

Before creating a new directory, inspect the existing repository structure and current development standards.

---

## 41. Architecture Documents Already Established

The architecture foundation includes:

- `SYSTEM_ARCHITECTURE.md`
- `ROLE_PERMISSION_MATRIX.md`

These define the initial technical architecture and authorization model.

They are drafts until the documentation review phase is completed.

---

## 42. Documentation Set Completion

The documentation-first set currently includes:

1. `PROJECT_MASTER_SPEC.md`
2. `PRODUCT_REQUIREMENTS.md`
3. `BUSINESS_RULES.md`
4. `USER_FLOWS.md`
5. `DATABASE_ARCHITECTURE.md`
6. `RLS_SECURITY_MODEL.md`
7. `AUTHENTICATION_ARCHITECTURE.md`
8. `REALTIME_DATA_FLOW.md`
9. `OFFLINE_SYNC_ARCHITECTURE.md`
10. `API_DOMAIN_ARCHITECTURE.md`
11. `STORAGE_ARCHITECTURE.md`
12. `NOTIFICATION_ARCHITECTURE.md`
13. `DONATION_FINANCE_SPEC.md`
14. `FINANCIAL_INTEGRITY_SPEC.md`
15. `UI_UX_SPEC.md`
16. `DESIGN_SYSTEM.md`
17. `ACCESSIBILITY_I18N_SPEC.md`
18. `DEVELOPMENT_STANDARDS.md`
19. `TESTING_STRATEGY.md`
20. `ERROR_HANDLING_SPEC.md`
21. `OBSERVABILITY_SPEC.md`
22. `ENVIRONMENT_DEPLOYMENT_SPEC.md`
23. `BACKUP_RECOVERY_SPEC.md`
24. `SECURITY_OPERATIONS.md`
25. `AI_DEVELOPMENT_GUIDE.md`
26. `AI_CONTEXT_INDEX.md`

---

## 43. Documentation Status

The documents are currently a documentation-generation baseline.

They should be reviewed for:

- contradictions;
- missing requirements;
- duplicated rules;
- terminology consistency;
- permission consistency;
- financial consistency;
- security consistency;
- implementation feasibility.

Do not begin substantial application implementation solely because all filenames exist.

---

## 44. Planned Review Order

After all documents are placed into the repository:

### Review 1 — Product

Review:

- Master Spec;
- Requirements;
- Business Rules;
- User Flows.

### Review 2 — Architecture

Review:

- System Architecture;
- Database;
- API;
- Authentication;
- Realtime;
- Offline;
- Storage.

### Review 3 — Security

Review:

- Role Matrix;
- RLS;
- Financial Integrity;
- Security Operations;
- Authentication;
- Storage.

### Review 4 — UX

Review:

- UI/UX;
- Design System;
- Accessibility/i18n.

### Review 5 — Engineering

Review:

- Development Standards;
- Testing;
- Error Handling;
- Observability;
- Deployment;
- Backup/Recovery.

### Review 6 — AI Workflow

Review:

- AI Development Guide;
- AI Context Index.

---

## 45. Conflict Resolution Procedure

If two documents conflict:

1. identify both statements;
2. determine whether one is more authoritative;
3. check business impact;
4. check security/financial impact;
5. decide explicitly;
6. update all affected documents;
7. record the change;
8. only then implement.

Do not allow code to become the accidental decision-maker.

---

## 46. Terminology Control

Use consistent terms.

Examples:

- **Member** = application user/member domain entity as defined by the data model;
- **Finance** = the defined application role, not an arbitrary administrator;
- **Payment Submission** = user-submitted payment intent/record before final Finance verification;
- **Verified Payment** = payment state accepted according to financial rules;
- **Allocation** = authoritative application of a verified payment to obligations;
- **Additional Donation** = donation outside required monthly obligation;
- **Anonymous Donation** = donation whose donor identity is intentionally not exposed according to the approved workflow;
- **Trusted Operation** = server-controlled operation requiring stronger validation/atomicity.

If a term is ambiguous, consult the relevant domain document.

---

## 47. Data Authority Map

| Data | Authority |
|---|---|
| Identity | Supabase Auth |
| Application user | Application database |
| Role/permission | Trusted application authorization model |
| Member profile | Application database |
| Donation obligation | Application database |
| Payment state | Application database/domain transaction |
| FIFO allocation | Authoritative financial transaction |
| Account balance | Authoritative financial records/derived verified state |
| Audit | Audit system |
| File metadata | Application database |
| File bytes | Supabase Storage |
| Realtime event | Delivery mechanism, not authority |
| Offline queue | Temporary client state |
| UI cache | Non-authoritative |
| Notification delivery | Delivery mechanism |

---

## 48. Client Trust Model

Web and mobile clients are untrusted.

Never rely solely on:

- hidden fields;
- disabled buttons;
- route guards;
- client-side role checks;
- local cache;
- local balance calculations;
- local permission state.

All sensitive mutations require authoritative server-side enforcement.

---

## 49. Financial Trust Model

The client may request a financial action.

The server determines whether the action is valid.

The server/database must determine:

- permitted actor;
- current state;
- amount validity;
- allocation;
- idempotency;
- concurrency outcome;
- final authoritative state.

---

## 50. Realtime Trust Model

Realtime informs clients about changes.

It does not authorize changes.

A client receiving an event does not gain permission to:

- edit the record;
- inspect unrelated records;
- perform privileged operations.

---

## 51. Offline Trust Model

Offline clients can hold pending work.

Server replay is authoritative.

When synchronization occurs, the server must revalidate:

- identity;
- current role;
- permission;
- operation state;
- target resource;
- business rules.

---

## 52. Storage Trust Model

Storage object possession is not authorization.

Every private object access must respect:

- authenticated identity;
- application permission;
- object scope;
- current account state.

---

## 53. Notification Trust Model

Notifications are delivery artifacts.

Opening a notification must lead back through normal authorization.

A notification link cannot become a privileged shortcut.

---

## 54. Environment Trust Model

Local, test, staging, and production are separate trust zones.

A local developer environment must not silently inherit production authority.

---

## 55. AI Trust Model

AI output is untrusted until reviewed.

Treat generated code as external contribution.

Review:

- behavior;
- security;
- correctness;
- maintainability;
- tests;
- documentation alignment.

---

## 56. Common AI Failure Modes

Watch for:

- hallucinated APIs;
- outdated framework behavior;
- incorrect Supabase assumptions;
- unsafe RLS;
- client-side authorization;
- missing transaction boundaries;
- duplicate financial effects;
- incomplete error handling;
- broken mobile lifecycle;
- missing RTL behavior;
- inaccessible UI;
- unnecessary dependencies;
- unrelated file changes;
- hidden scope expansion.

---

## 57. AI Prompt Safety

Prompts should explicitly tell agents:

- do not invent requirements;
- do not expose secrets;
- do not modify unrelated files;
- do not bypass tests;
- do not weaken RLS;
- do not change financial rules;
- do not perform destructive actions without approval;
- stop on ambiguity.

---

## 58. AI Review Strategy

For critical changes, use independent review.

Example:

```text
Implementation Agent
        ↓
Automated Tests
        ↓
Independent AI Review
        ↓
Human Review
        ↓
Commit
```

For financial/security changes, add stronger negative testing before acceptance.

---

## 59. Definition of Done

A feature is not complete merely because it appears in the UI.

It is complete when:

- requirements are satisfied;
- business rules are satisfied;
- permissions are enforced;
- data access is secure;
- tests pass;
- errors are handled;
- accessibility is addressed;
- localization is addressed;
- realtime/offline behavior is correct where applicable;
- documentation is synchronized;
- Git diff is reviewed.

---

## 60. Current Implementation State

At the point this index is created, the repository is still in the documentation-first/foundation phase.

The correct next engineering activity after documentation review is controlled implementation, not uncontrolled feature generation.

---

## 61. Recommended First Implementation Domains

After documentation acceptance, implementation should begin with the foundational dependencies:

1. environment configuration;
2. Supabase project configuration;
3. database migrations;
4. authentication;
5. application user/profile provisioning;
6. roles/permissions;
7. RLS;
8. shared types/validation;
9. API/domain infrastructure;
10. base web/mobile shells.

Feature-specific financial and committee workflows should build on these foundations.

---

## 62. Security-Critical First Principles

Before any production-sensitive feature:

- RLS must be enabled and tested;
- service-role credentials must remain server-only;
- authorization must be server-side;
- secrets must be outside source code;
- financial commands must be transactional;
- audit requirements must be defined;
- tests must include unauthorized attempts.

---

## 63. Documentation-to-Code Rule

Every important architectural decision should have a documentation reference.

Every major implementation area should have:

- specification;
- code;
- tests;
- review evidence.

This creates traceability from requirement to production behavior.

---

## 64. Requirement-to-Test Traceability

For important requirements, maintain the conceptual chain:

```text
Requirement
    ↓
Business Rule
    ↓
Architecture
    ↓
Implementation
    ↓
Test
    ↓
Release Verification
```

A missing link is a review signal.

---

## 65. AI Handoff Record

When moving work from one AI tool to another, provide:

```text
Current objective:
Completed work:
Files changed:
Tests passed:
Known failures:
Open decisions:
Relevant documents:
Next exact action:
```

Do not rely on the previous AI tool retaining context.

---

## 66. Multi-Agent Parallelization

Parallel work is acceptable when boundaries are clear.

Example:

- Agent A: database/RLS;
- Agent B: shared validation/types;
- Agent C: web UI;
- Agent D: mobile UI;
- Agent E: test review.

Shared contracts must be agreed before integration.

---

## 67. Parallel Work Restrictions

Do not parallelize changes that can conflict heavily, such as multiple agents simultaneously modifying:

- the same migration;
- the same RLS policy;
- the same financial command;
- the same shared API contract.

Sequence these changes instead.

---

## 68. Contract-First Parallel Development

When multiple agents need the same interface:

1. define contract;
2. approve contract;
3. implement consumers/providers separately;
4. integrate;
5. run contract/integration tests.

This reduces cross-agent drift.

---

## 69. AI Generated Documentation Review

AI-generated documentation must be reviewed for:

- contradictions;
- invented requirements;
- outdated technical claims;
- duplicated rules;
- impossible constraints;
- missing security controls.

The existence of a document is not evidence that its contents are correct.

---

## 70. AI Generated UI Review

Before accepting generated UI:

- compare against design system;
- verify responsive behavior;
- verify role visibility;
- verify authorization;
- verify loading/error/empty states;
- verify keyboard/touch behavior;
- verify localization;
- verify sensitive-data exposure.

---

## 71. AI Generated Database Review

Before accepting generated database code:

- inspect migration;
- inspect constraints;
- inspect indexes;
- inspect RLS;
- inspect functions;
- inspect grants;
- inspect transaction behavior;
- inspect rollback/recovery implications.

---

## 72. AI Generated API Review

Before accepting generated APIs:

- verify auth;
- verify permission;
- validate inputs;
- validate domain state;
- validate idempotency;
- validate error contract;
- verify response privacy;
- test unauthorized requests.

---

## 73. AI Generated Financial Review

Before accepting financial code:

- test duplicate command;
- test concurrent command;
- test stale state;
- test invalid amount;
- test unauthorized role;
- test partial allocation;
- test FIFO;
- test overpayment;
- test reversal/correction;
- verify audit;
- verify reconciliation.

---

## 74. AI Generated Offline Review

Before accepting offline code:

- disable network;
- create operation;
- restart application;
- reconnect;
- replay;
- simulate duplicate replay;
- simulate permission change;
- simulate conflicting state;
- verify final server state.

---

## 75. AI Generated Realtime Review

Before accepting realtime code:

- test initial fetch;
- test event arrival during initial fetch;
- test duplicate event;
- test missed event/reconnect;
- test stale cache;
- test logout;
- test role change;
- test unauthorized subscription.

---

## 76. AI Generated Storage Review

Before accepting storage code:

- test unauthorized upload;
- test unauthorized download;
- test cross-member object access;
- test expired signed URL;
- test malformed file;
- test oversized file;
- test replacement;
- test deletion;
- test orphan handling.

---

## 77. AI Generated Notification Review

Before accepting notification code:

- test recipient scope;
- test duplicate delivery;
- test retry;
- test stale token;
- test localization;
- test sensitive content;
- test deep-link authorization.

---

## 78. AI Generated Deployment Review

Before deployment:

- inspect generated workflow;
- inspect environment variables;
- inspect secret permissions;
- inspect migration sequence;
- inspect rollback/forward-fix strategy;
- inspect production approval gates.

---

## 79. AI Context Refresh

Whenever a major architecture decision changes, regenerate or update the context index so future AI sessions do not receive stale navigation guidance.

---

## 80. Documentation Naming

Use the exact approved filenames.

Avoid creating alternate near-duplicates such as:

- `AUTH.md`;
- `SECURITY.md`;
- `DB_SPEC.md`;

unless explicitly approved.

The canonical documents should remain discoverable.

---

## 81. Documentation Versioning

When a document changes materially:

- update its version/status;
- record meaningful change information;
- review dependent documents;
- update this index if scope changes.

---

## 82. Status Labels

Use clear document statuses such as:

- Draft — Review Required;
- Approved;
- Superseded;
- Archived.

Do not describe a draft as approved.

---

## 83. Open Decisions

AI agents should identify unresolved decisions instead of hiding them.

Examples include:

- exact notification provider;
- exact production observability provider;
- exact rate limits;
- final backup retention;
- final role administration workflow;
- final deployment configuration.

---

## 84. Decision Recording

When an open decision is resolved:

1. record the decision;
2. update affected specification;
3. update dependent docs;
4. update implementation plan;
5. test affected behavior.

---

## 85. No Hidden Decisions

A decision made only inside an AI chat should not be considered part of the product until transferred into the repository's approved documentation or explicit project decision record.

---

## 86. AI Context Size

Do not send every document to every AI task.

Select context based on the domain.

For example, a button styling task usually needs:

- UI/UX;
- design system;
- accessibility.

It does not require the entire financial integrity specification.

---

## 87. Security Context Size

For security-sensitive tasks, provide enough context to avoid accidental bypasses.

Example:

- role matrix;
- RLS;
- authentication;
- security operations;
- relevant domain rules.

---

## 88. Financial Context Size

For financial tasks, provide:

- business rules;
- donation/finance specification;
- financial integrity;
- database;
- RLS;
- API contract;
- testing strategy.

---

## 89. AI Output Formatting

Prefer outputs that are:

- structured;
- scoped;
- testable;
- explicit about assumptions;
- explicit about changed files.

Avoid vague “here is the complete production-ready solution” claims.

---

## 90. AI Review Language

Review findings should distinguish:

- confirmed defect;
- likely defect;
- potential risk;
- architectural concern;
- documentation gap;
- enhancement suggestion.

Do not present speculation as fact.

---

## 91. AI Coding Language

Implementation requests should prefer precise verbs:

- inspect;
- implement;
- modify;
- validate;
- test;
- compare;
- document;
- review.

Avoid ambiguous instructions such as “make it better” for security-critical work.

---

## 92. Human Decision Points

The human owner must decide when the question involves:

- product scope;
- financial policy;
- role authority;
- privacy policy;
- production risk acceptance;
- major architecture;
- unresolved conflicting requirements.

AI may present options and consequences but should not silently choose a product policy.

---

## 93. AI as Reviewer

AI review is especially useful for:

- edge cases;
- missing tests;
- consistency;
- code smell detection;
- accessibility;
- documentation gaps;
- security attack paths.

The reviewer still needs evidence.

---

## 94. AI as Researcher

AI research should produce:

- question;
- sources;
- findings;
- confidence/limitations;
- project impact;
- recommended documentation update.

---

## 95. AI as Implementer

AI implementation should be constrained by:

- file scope;
- architecture;
- acceptance criteria;
- security;
- tests.

---

## 96. AI as Tester

AI-generated tests should target:

- happy path;
- invalid input;
- unauthorized access;
- concurrency;
- retries;
- failure recovery;
- edge cases.

---

## 97. AI as Documentation Assistant

AI may help maintain:

- architecture docs;
- API contracts;
- changelogs;
- test plans;
- runbooks.

Documentation changes must still be reviewed for factual accuracy.

---

## 98. AI Tool Selection

Choose a tool based on task needs, not loyalty.

Examples:

| Need | Suitable tool category |
|---|---|
| Architecture/research | Reasoning/research AI |
| Local code navigation | Coding agent/IDE |
| Independent review | Separate AI model |
| UI exploration | UI generation tool |
| Testing assistance | Coding/reasoning AI |
| Documentation | Reasoning/writing AI |

The exact tool can change over time.

---

## 99. No Vendor Lock-In

Project continuity must not depend on:

- one AI subscription;
- one agent's memory;
- one proprietary prompt;
- one hidden workflow.

Repository artifacts must contain the required engineering knowledge.

---

## 100. Final AI Context Checklist

Before starting a new feature, confirm:

- [ ] I know which document defines the requirement.
- [ ] I know which business rules apply.
- [ ] I know which roles can perform the action.
- [ ] I know the authoritative data source.
- [ ] I know the security boundary.
- [ ] I know the API/domain boundary.
- [ ] I know the required tests.
- [ ] I know which files may change.
- [ ] I know whether documentation must change.
- [ ] I know whether the feature affects deployment/recovery.

---

## 101. Final Repository Checklist

Before implementation begins after the documentation phase:

- [ ] All planned documents exist.
- [ ] Files are in the correct repository locations.
- [ ] Duplicate/obsolete documents are identified.
- [ ] Terminology is consistent.
- [ ] Role permissions are consistent.
- [ ] Financial rules are consistent.
- [ ] Security rules are consistent.
- [ ] Architecture is internally consistent.
- [ ] Open decisions are explicitly listed.
- [ ] Documentation review is complete.
- [ ] Git baseline is clean and understandable.

---

## 102. Current Documentation Baseline

The documentation set is intentionally comprehensive.

The next step after this document is not to blindly start coding every feature.

The next step is:

1. move all generated documents into the repository;
2. inspect them together;
3. run consistency checks;
4. resolve contradictions;
5. approve the documentation baseline;
6. commit the baseline;
7. begin controlled implementation.

---

## 103. Final Rule

**An AI agent should be able to enter the repository, understand where the answer lives, identify the applicable constraints, make a scoped change, prove the change with tests, and leave enough evidence for another engineer or AI agent to continue without guessing.**

---

## 104. AI Context Index Status

**Status:** Draft — Review Required

**Documentation set:** 26/26 planned documents generated.

**Next phase:** Repository consolidation and cross-document review before substantial application feature development.
