# ENVIRONMENT DEPLOYMENT SPEC

**Project:** Masjid-e-Mamoor 2  
**Version:** 1.0  
**Status:** Draft — Review Required  
**Scope:** Local, CI/test, staging, production, web, mobile, Supabase, storage, realtime, notifications, database migrations, backup/recovery.

## 1. Purpose and Scope

This document defines how Masjid-e-Mamoor 2 is configured, developed, built, deployed, promoted, rolled back, and operated across development, test, staging, and production environments.

The goal is to prevent environment drift, accidental production access, secret leakage, incompatible releases, unsafe database migrations, and deployment-time data loss while keeping web and mobile clients aligned with the same authoritative backend.

## 2. Environment Principles

Environments must be isolated by default.

The system should use at least:

- local development;
- test/CI;
- staging/pre-production;
- production.

Production data must not be casually copied into lower environments. Environment-specific configuration must be explicit. A developer must be able to determine which environment is active without exposing secrets.

## 3. Environment Matrix

| Concern | Local | Test/CI | Staging | Production |
|---|---|---|---|---|
| Purpose | Development | Automated verification | Release validation | Real users |
| Data | Synthetic/local | Synthetic | Controlled test data | Authoritative |
| Secrets | Local secret store | CI secrets | Deployment secrets | Production secrets |
| Debug detail | Developer-safe | CI diagnostics | Restricted | User-safe only |
| External services | Sandbox/mock where possible | Mock/sandbox | Controlled | Production |
| Financial authority | Non-production | Non-production | Non-production | Authoritative |
| Deployment | Local | Automated | Controlled | Approved release |

## 4. Repository and Source Control

The Git repository is the source of truth for application code and documentation.

The default branch is `main`.

Production deployments must correspond to a traceable Git commit/tag.

Uncommitted local changes must not be treated as a release artifact.

## 5. Branching and Release Strategy

The project may use short-lived feature branches, pull requests, and protected main-branch changes as appropriate.

Regardless of branching style:

- production code must be reviewable;
- documentation and migration changes must be versioned;
- release commits must be traceable;
- emergency changes must be documented after stabilization.

The exact branch-protection configuration remains an operational decision.

## 6. Environment Configuration

Configuration must be separated from source code.

Classify configuration into:

1. public client configuration;
2. server-only secrets;
3. deployment configuration;
4. feature/configuration flags.

Secrets must never be committed to Git.

## 7. Environment Variables

Environment variables should be validated at startup/build time according to whether they are required for web, mobile, server, CI, or deployment.

A missing required configuration must fail early rather than causing a confusing runtime failure.

## 8. Public vs Secret Configuration

Only values explicitly designed to be public may be exposed to web/mobile bundles.

Service-role credentials, private keys, database passwords, provider secrets, and administrative credentials must remain server-side or in managed secret storage.

## 9. Supabase Environments

Development/staging/production should use appropriately isolated Supabase projects or approved equivalent isolation.

The production project must not be used casually for development experiments.

RLS, migrations, storage policies, functions, and configuration must be version-controlled and reproducible.

## 10. Supabase Migration Authority

Database schema changes must be represented by version-controlled migrations.

Manual production schema changes are prohibited except under a documented emergency process.

Every migration must be reviewed for:

- constraints;
- indexes;
- RLS;
- functions;
- triggers;
- storage relationships;
- backward compatibility;
- rollback/recovery implications.

## 11. Migration Ordering

Application releases and migrations must follow a safe order.

Where possible:

1. deploy backward-compatible schema;
2. verify schema;
3. deploy application using the new schema;
4. migrate/transform data;
5. remove deprecated structures only after compatibility is no longer required.

Destructive schema changes must not be performed while an older deployed client still depends on them.

## 12. Migration Failure

A failed migration must stop unsafe deployment.

Do not automatically guess a rollback if a migration has partially changed production state.

Use a documented recovery migration or restore procedure after assessing actual database state.

## 13. Database Backup Before Risky Changes

Production schema/data changes with material recovery risk require an appropriate verified backup/recovery posture before execution.

Backup existence must not be assumed merely because a platform advertises backups.

## 14. Web Deployment

The web application uses Next.js App Router and is intended for deployment through the approved hosting platform, with Vercel as the planned target subject to final eligibility/configuration.

Web deployment must use environment-specific configuration and a traceable Git revision.

## 15. Web Build

Production web builds must:

- install locked dependencies;
- run type checking;
- run lint/format checks as configured;
- run relevant unit/integration tests;
- build successfully;
- validate required environment configuration;
- produce a traceable build identifier.

## 16. Mobile Build

The mobile application uses Expo SDK 57 with the approved React Native pairing.

Production mobile builds should use Expo/EAS or the approved equivalent.

Mobile builds must include a traceable application version and build number.

## 17. Mobile Environment Configuration

Mobile environment values must be selected at build time or through an approved runtime configuration mechanism.

Sensitive server credentials must never be embedded in the mobile application.

A mobile application is an untrusted client from a security perspective.

## 18. Versioning

Web releases and mobile releases must be identifiable.

Mobile releases require:

- semantic/product version where applicable;
- platform build number;
- Git commit/release reference;
- environment association.

Web deployments should expose a safe build/version identifier for diagnostics.

## 19. Dependency Reproducibility

Dependency installation must use the repository lockfile.

Developers and CI should use the documented package manager version.

Dependency upgrades must be intentional and tested rather than silently changing during deployment.

## 20. CI Pipeline

CI should enforce release-quality gates appropriate to the repository.

At minimum, the pipeline should validate:

- dependency installation;
- formatting;
- linting where configured;
- type checking;
- unit/component tests;
- relevant integration tests;
- web production build;
- mobile validation/build checks where configured;
- migration validation where applicable.

## 21. CI Security

CI secrets must be managed by the CI provider or approved secret store.

Secrets must not be echoed into logs.

Pull requests from untrusted contexts must not receive unrestricted production credentials.

## 22. Pull Request Gates

Changes affecting:

- database;
- RLS;
- authentication;
- financial logic;
- storage;
- offline synchronization;
- realtime;
- notifications;
- deployment configuration

require focused review and tests.

High-risk changes should not be merged solely because the application compiles.

## 23. Release Candidate

A release candidate should be identified by a specific commit/build.

The candidate must pass automated gates and targeted manual verification before production release.

## 24. Staging

Staging should approximate production architecture sufficiently to detect deployment/configuration issues.

Staging must not accidentally send real user notifications or manipulate production financial data.

## 25. Staging Data

Use synthetic or controlled data.

If realistic data is required, it must be appropriately sanitized and approved.

Production exports should not be copied into staging casually.

## 26. Production Deployment

Production deployment requires:

- approved release commit;
- passing CI;
- reviewed migration plan;
- verified environment configuration;
- deployment health checks;
- monitoring readiness;
- rollback/recovery plan for material changes.

## 27. Deployment Sequence

A preferred sequence is:

1. freeze/identify release;
2. run CI;
3. verify migrations;
4. verify backups/recovery posture where required;
5. apply backward-compatible database changes;
6. deploy application;
7. run smoke tests;
8. verify observability;
9. monitor;
10. declare release healthy.

## 28. Smoke Tests

Post-deployment smoke tests should verify:

- application loads;
- authentication works;
- authorized member access works;
- protected role boundaries remain enforced;
- database reads work;
- a safe non-production-like mutation works where appropriate;
- storage access works;
- realtime connects;
- notifications/outbox infrastructure is healthy.

## 29. Production Financial Smoke Tests

Production financial smoke testing must never create real financial effects merely to prove the deployment.

Use safe health checks, read-only validation, or an approved controlled test mechanism.

Never create fake real-world financial records in production without an explicit approved process.

## 30. Health Checks

Health checks should verify service availability without exposing secrets.

A health endpoint should not reveal:

- database credentials;
- internal hostnames;
- private configuration;
- stack traces;
- sensitive user information.

## 31. Deployment Verification

Verification should compare expected and observed:

- application version;
- database migration state;
- configuration;
- error rate;
- latency;
- authentication;
- realtime;
- storage;
- notifications;
- critical business workflows.

## 32. Progressive Rollout

Where the hosting platform supports it, releases may use staged or gradual rollout.

The exact strategy depends on platform capabilities and project scale.

Financially sensitive releases require additional monitoring regardless of rollout mechanism.

## 33. Rollback Philosophy

Rollback must be considered before deployment.

Application rollback is not equivalent to database rollback.

If a migration is irreversible or destructive, the recovery strategy may require a forward-fix migration rather than reverting application code.

## 34. Web Rollback

Web rollback should restore a known-good application build when the failure is application-level and the database contract remains compatible.

Rollback must be coordinated with schema compatibility.

## 35. Mobile Rollback

Mobile releases cannot always be instantly rolled back for users who already installed the new version.

Therefore mobile changes require stronger backward compatibility and server-side feature control where appropriate.

## 36. Database Rollback

Do not blindly reverse database migrations.

A database rollback may destroy data written by the newer application.

Use forward-fix or backup restoration according to the incident and recovery plan.

## 37. Feature Flags

Feature flags may reduce deployment risk.

However:

- flags are not security boundaries;
- server authorization remains authoritative;
- disabled features must be unavailable server-side where required;
- stale clients must not bypass the flag through direct API calls.

## 38. Emergency Changes

Emergency production changes should be:

- minimal;
- traceable;
- reviewed as quickly as practical;
- tested at an appropriate level;
- documented after stabilization.

Emergency status does not permit bypassing authorization or financial integrity safeguards.

## 39. Hotfixes

Hotfixes should target the smallest safe change.

After the hotfix:

- merge/reconcile it into the normal development line;
- add regression tests;
- update documentation where required;
- review whether monitoring needs improvement.

## 40. Secrets Management

Secrets must be stored in approved secret-management facilities.

Never place secrets in:

- Git;
- markdown documentation;
- screenshots;
- issue comments;
- client bundles;
- logs;
- generated artifacts.

## 41. Secret Rotation

Production secrets should support controlled rotation.

Rotation plans must consider:

- active sessions;
- server deployments;
- third-party providers;
- mobile clients;
- background jobs;
- scheduled tasks.

A rotated secret must not be left in historical logs or source control.

## 42. Service-Role Protection

Supabase service-role credentials are server-side secrets.

They must never be embedded in web or mobile clients.

Trusted operations using elevated credentials require strict boundaries and authorization checks.

## 43. Authentication Configuration

Authentication settings must be environment-specific.

OTP settings, redirect URLs, allowed origins, session behavior, and provider configuration must be verified separately for staging and production.

## 44. URL and Domain Configuration

Production URLs, redirect URLs, callback routes, deep links, and allowed origins must be explicitly configured.

Development URLs must not accidentally become production authentication destinations.

## 45. Storage Configuration

Storage buckets and policies must be environment-specific and reproducible.

Production buckets must not be used for development testing.

Private financial/member documents must remain private according to the storage architecture.

## 46. Realtime Configuration

Realtime publication/subscription configuration must be verified after schema changes.

Authorization and RLS behavior must be tested alongside realtime deployment.

## 47. Notification Configuration

Push notification credentials and provider configuration must be environment-specific.

Staging should not accidentally send production notifications.

Notification delivery failures must be observable without blocking core business transactions.

## 48. Offline Compatibility

Server releases must consider queued operations from older mobile versions.

API contracts must remain compatible for the supported client window or return a safe explicit compatibility error.

## 49. API Compatibility

Breaking API changes require a compatibility plan.

Where older clients remain active:

- add new fields before removing old ones;
- maintain old command semantics where possible;
- version contracts when necessary;
- deprecate deliberately.

## 50. Database Compatibility Window

Database changes should maintain compatibility with the currently deployed application during rollout.

Do not remove columns, enum values, functions, or policies until dependent clients and jobs are no longer using them.

## 51. Environment Drift

Environment drift includes differences in:

- schema;
- RLS;
- storage;
- environment variables;
- feature flags;
- provider configuration;
- dependency versions.

Drift should be detected through automated checks where practical.

## 52. Infrastructure as Code / Configuration as Code

Where supported, deployment-critical configuration should be version-controlled or reproducibly documented.

Manual console-only configuration should be minimized for critical infrastructure.

## 53. Deployment Audit Trail

Each production deployment should record:

- release identifier;
- Git commit;
- deployer/automation identity;
- timestamp;
- migration versions;
- relevant configuration change;
- outcome;
- rollback or remediation if applicable.

## 54. Release Notes

Each meaningful release should document:

- user-visible changes;
- backend/database changes;
- security changes;
- migration changes;
- compatibility considerations;
- known limitations;
- rollback/recovery notes where relevant.

## 55. Production Monitoring

Deployment is incomplete until monitoring is active.

Observe:

- error rates;
- latency;
- database health;
- authentication;
- realtime;
- storage;
- notifications;
- offline backlog;
- financial integrity indicators.

## 56. Deployment Incident Detection

Compare post-deployment behavior against a pre-deployment baseline where practical.

Investigate sudden changes in:

- 5xx errors;
- authorization failures;
- database latency;
- transaction conflicts;
- payment failures;
- storage failures;
- mobile/API compatibility errors.

## 57. Maintenance Windows

Planned maintenance must be communicated where it affects users.

Financial workflows should be protected from partial availability states.

If a critical dependency is unavailable, the UI must communicate safe maintenance/unavailability rather than allowing misleading submissions.

## 58. Database Maintenance

Database maintenance must account for:

- active transactions;
- connection pools;
- realtime subscriptions;
- background jobs;
- offline replay;
- financial operations.

After maintenance, verify application/database convergence.

## 59. Backup Verification

A backup strategy is incomplete without restoration testing.

Recovery tests should verify that backups can actually restore:

- schema;
- data;
- required configuration;
- storage relationships;
- application compatibility.

## 60. Disaster Recovery

Disaster recovery must define:

- recovery point objective;
- recovery time objective;
- backup source;
- restoration procedure;
- application redeployment;
- secret/configuration restoration;
- storage recovery;
- validation;
- communication.

Exact RPO/RTO values remain an open operational decision.

## 61. Data Recovery

After restoration, verify:

- member data;
- donation obligations;
- payment records;
- FIFO allocations;
- finance accounts;
- transactions;
- audit events;
- storage metadata;
- notification outbox;
- offline reconciliation state.

## 62. Recovery from Partial Deployment

If application and database versions become mismatched:

1. stop further rollout;
2. identify actual schema and application versions;
3. determine compatibility;
4. restore compatibility using rollback or forward-fix;
5. verify financial integrity;
6. monitor before resuming rollout.

## 63. Mobile App Lifecycle

Mobile deployment must account for background execution, app termination, OS upgrades, stale clients, cached data, and intermittent connectivity.

Critical operation state should not depend only on in-memory state.

## 64. Web Cache and CDN

Production web caching must not serve stale authorization-sensitive content in a way that bypasses server controls.

After release, verify cache invalidation/version behavior.

## 65. Static Assets

Static assets should be versioned or content-addressed where practical.

A client must not receive incompatible JavaScript bundles and server contracts due to stale asset caching.

## 66. Environment Access

Production access should follow least privilege.

Developers should not automatically receive unrestricted production credentials.

Administrative access must be auditable.

## 67. Production Data Access

Production data access for debugging must be minimized.

Use approved operational queries and avoid copying private member/financial data into personal machines or development environments.

## 68. Support Access

Support tooling should expose only the minimum information needed to resolve user issues.

Support workflows must not bypass normal authorization or audit requirements.

## 69. Release Ownership

Each production release should have an identified owner responsible for:

- readiness;
- deployment;
- monitoring;
- rollback/recovery decision;
- communication;
- post-release review.

## 70. Release Checklist

Before production release:

- [ ] Git revision identified.
- [ ] CI passes.
- [ ] Tests pass.
- [ ] Build passes.
- [ ] Required configuration verified.
- [ ] Migrations reviewed.
- [ ] Backup/recovery posture verified where required.
- [ ] RLS/security checks pass.
- [ ] Observability ready.
- [ ] Smoke tests defined.
- [ ] Rollback/recovery plan defined.
- [ ] Release owner identified.

## 71. Post-Release Checklist

After deployment:

- [ ] Version verified.
- [ ] Health checks pass.
- [ ] Authentication works.
- [ ] Authorization boundaries work.
- [ ] Database queries work.
- [ ] Storage works.
- [ ] Realtime works.
- [ ] Notifications/outbox healthy.
- [ ] Error rates normal.
- [ ] Latency acceptable.
- [ ] Financial workflows remain safe.
- [ ] No compatibility issue detected.

## 72. CI/CD Separation

CI validates code and artifacts.

CD deploys approved artifacts.

Production deployment should not depend on a developer's local working directory or uncommitted files.

## 73. Artifact Integrity

Production artifacts should be traceable to the source commit and build process.

The deployed web/mobile artifact must be identifiable after release.

## 74. Build Reproducibility

Builds should be reproducible using:

- locked dependencies;
- documented Node/package-manager versions;
- deterministic configuration where possible;
- versioned source;
- controlled build environment.

## 75. Dependency Security

Dependency updates should be monitored and reviewed.

Security-sensitive updates may require expedited review.

Do not upgrade major framework versions merely to silence an unrelated warning without compatibility analysis.

## 76. Node and Package Manager

The project should use the documented Node.js and pnpm versions through repository tooling where practical.

CI and developer environments should remain aligned.

## 77. Web Framework Compatibility

Next.js, React, and related framework versions must remain within the approved compatibility set.

Framework upgrades require full foundation verification, including type checking, tests, and production build.

## 78. Mobile Framework Compatibility

Expo, React Native, and React versions must remain on a verified compatible pairing.

Mobile framework upgrades require Expo Doctor and build validation before adoption.

## 79. Environment Health Endpoint

A safe health mechanism should distinguish:

- application process health;
- dependency health;
- readiness;
- degraded state.

Do not expose dependency secrets or detailed infrastructure topology.

## 80. Readiness vs Liveness

Liveness asks whether the process is alive.

Readiness asks whether the service can safely accept traffic.

A service that cannot safely process financial commands should not be represented as fully ready merely because its process is running.

## 81. Deployment Dependencies

Deployment documentation must identify dependencies among:

- database migrations;
- server functions;
- web;
- mobile;
- storage policies;
- realtime;
- notification workers;
- scheduled jobs.

## 82. Scheduled Jobs

Scheduled jobs must be deployed and versioned alongside their required application/database contracts.

A job must not run against an incompatible schema.

## 83. Background Worker Rollout

Background workers should be compatible with both the current and transitional schema during migration windows.

Duplicate workers must be prevented or made idempotent.

## 84. Queue Recovery

After deployment/restart, queued notification and offline-related server operations must resume safely.

Queues must not lose operation identity.

## 85. Production Rollback Trigger

Rollback or forward-fix consideration should be triggered by:

- critical error-rate increase;
- financial integrity issue;
- authentication outage;
- widespread authorization failure;
- destructive data issue;
- severe performance regression;
- incompatible client behavior.

## 86. Rollback Decision

Rollback is a technical decision based on actual state and compatibility.

Do not roll back a database blindly because application errors increased.

First establish whether the database contains writes that the old application cannot understand.

## 87. Financial Release Gate

Any release touching financial logic must include:

- financial invariant tests;
- idempotency tests;
- concurrency tests;
- RLS tests;
- migration review;
- rollback/recovery analysis;
- reconciliation verification.

## 88. Security Release Gate

Any release touching authentication, authorization, RLS, storage policies, roles, or trusted operations must include:

- positive authorization tests;
- negative authorization tests;
- session tests;
- role-change tests;
- deactivation tests;
- storage access tests where applicable.

## 89. Offline Release Gate

Any release affecting offline sync must test:

- old queued operations;
- duplicate replay;
- conflict;
- rejection;
- unknown result;
- app termination;
- reconnect;
- server incompatibility.

## 90. Realtime Release Gate

Any release affecting realtime must test:

- subscription authorization;
- connection;
- reconnect;
- missed events;
- duplicate events;
- authoritative refetch;
- logout/session expiry.

## 91. Storage Release Gate

Any storage change must test:

- upload;
- download;
- private access;
- signed URL;
- invalid file;
- size limit;
- object lifecycle;
- metadata consistency.

## 92. Notification Release Gate

Any notification change must test:

- outbox creation;
- delivery;
- retry;
- permanent failure;
- invalid token;
- localization;
- deep-link authorization.

## 93. Localization Deployment

New error messages, UI strings, and notification templates must have approved translations or an explicit fallback policy before production release.

## 94. Accessibility Deployment

New error and critical workflow UI must be checked for keyboard navigation, screen readers, focus management, touch targets, contrast, and RTL behavior where applicable.

## 95. Documentation Deployment

Changes affecting architecture, deployment, security, financial behavior, or recovery must update the corresponding documentation before or with the implementation change.

## 96. AI-Assisted Deployment

AI-generated changes require human verification through repository tests, documentation checks, security review, and appropriate domain-specific testing. No AI tool is itself a release authority.

## 97. Release Evidence

A release should retain enough evidence to answer:

- what changed;
- which commit was deployed;
- which migration ran;
- who/what deployed it;
- which tests passed;
- what configuration was used;
- whether smoke tests passed;
- whether rollback/recovery was needed.

## 98. Open Decisions

Finalize:

1. hosting and deployment provider configuration;
2. staging topology;
3. production/staging Supabase isolation;
4. CI provider and exact gates;
5. branch protection;
6. secret manager;
7. mobile release channels;
8. web release channels;
9. exact versioning scheme;
10. RPO/RTO;
11. backup restoration schedule;
12. maintenance policy;
13. alert thresholds;
14. rollback ownership;
15. production access roles;
16. client compatibility window;
17. feature-flag provider/implementation;
18. deployment approval workflow.

## 99. Implementation Order

Recommended order:

1. finalize environment matrix;
2. establish local environment validation;
3. establish CI;
4. establish staging;
5. version database migrations;
6. configure Supabase environments;
7. configure web deployment;
8. configure mobile/EAS builds;
9. configure secrets;
10. configure observability;
11. configure backup/recovery;
12. define smoke tests;
13. perform staging release;
14. perform disaster/recovery rehearsal;
15. perform production readiness review;
16. release production.

## 100. Definition of Done

Environment/deployment architecture is complete only when environments are isolated, secrets are protected, builds are reproducible, migrations are versioned, CI gates are enforced, production releases are traceable, recovery is tested, mobile/web compatibility is defined, observability is active, and rollback/recovery procedures are documented.

**Final rule:** deployment speed must never take precedence over security, data integrity, financial correctness, or recoverability.

## 101. Environment Variable Classification

| Variable type | Local | CI | Staging | Production | Client exposure |
|---|---|---|---|---|---|
| Public application URL | Yes | Yes | Yes | Yes | Allowed if designed public |
| Public Supabase URL | Yes | Yes | Yes | Yes | Allowed |
| Supabase anonymous/publishable key | Yes | Yes | Yes | Yes | Allowed under RLS model |
| Service-role key | Local secret only | Secret | Secret | Secret | Never |
| Database password | Secret | Secret | Secret | Secret | Never |
| Notification provider secret | Secret | Secret | Secret | Secret | Never |
| OAuth/provider secret | Secret | Secret | Secret | Secret | Never |
| Signing/private key | Secret | Secret | Secret | Secret | Never |

Exact secret names and provider-specific configuration belong in the environment implementation documentation, not in public source code.

## 102. Release Evidence Template

```text
Release:
Environment:
Git commit:
Web build:
Mobile version/build:
Database migration range:
Deployment timestamp:
Release owner:
CI run:
Tests:
Smoke tests:
Observability status:
Backup/recovery verification:
Known issues:
Rollback/recovery plan:
Final release decision:
```

## 103. Production Readiness Questions

1. Can the exact production commit be identified?
2. Can every production secret be rotated without source changes?
3. Can the database schema be reconstructed from migrations?
4. Can a failed migration be diagnosed without guessing?
5. Can the application be redeployed without a developer laptop?
6. Can a mobile client older than the current release safely interact with the server?
7. Can a production incident be correlated across logs, metrics, audit, and database state?
8. Can a financial operation be reconciled after a deployment-time timeout?
9. Can storage and database state be reconciled after a partial upload?
10. Can notification backlog be detected?
11. Can realtime failure be distinguished from database failure?
12. Can offline queues recover after a server deployment?
13. Can the service be safely declared not-ready?
14. Can production data be recovered from a verified backup?
15. Has restoration actually been tested?
16. Are production access permissions limited?
17. Are emergency changes traceable?
18. Can an old mobile build be disabled safely if necessary?
19. Are rollback and forward-fix criteria understood?
20. Has staging been tested against the intended production topology?
