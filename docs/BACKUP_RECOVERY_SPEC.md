# BACKUP RECOVERY SPEC

**Project:** Masjid-e-Mamoor 2  
**Version:** 1.0  
**Status:** Draft — Review Required  
**Scope:** Database, storage, application, configuration, audit, financial integrity, offline/realtime recovery, backup verification, disaster recovery.

## 1. Purpose and Scope

This document defines the backup, restore, business-continuity, and disaster-recovery architecture for Masjid-e-Mamoor 2.

It covers:

- PostgreSQL/Supabase data;
- database schema and migrations;
- storage objects and metadata;
- audit records;
- notification outbox;
- offline-operation records;
- configuration and deployment artifacts;
- recovery verification;
- restore testing;
- financial-integrity recovery;
- operational responsibilities.

Backup existence is not treated as proof of recoverability. A backup strategy is complete only when restoration is periodically tested and the restored system is verified.

## 2. Recovery Principles

Recovery must preserve:

1. data integrity;
2. financial correctness;
3. authorization/security;
4. auditability;
5. privacy;
6. application compatibility.

When speed conflicts with financial or data integrity, integrity takes precedence.

Recovery must establish the authoritative state before clients are allowed to resume normal sensitive operations.

## 3. Recovery Objectives

The project should define:

- Recovery Point Objective (RPO): maximum acceptable data loss window.
- Recovery Time Objective (RTO): maximum acceptable service restoration time.

Exact production RPO/RTO values remain an open operational decision and must be approved before production readiness.

## 4. Recovery Scope

Recovery planning must cover:

- application code;
- database schema;
- database data;
- RLS policies;
- functions/triggers;
- storage buckets and objects;
- storage metadata;
- notification outbox;
- audit records;
- environment configuration;
- deployment artifacts;
- required third-party configuration;
- operational documentation.

## 5. Data Classification

Not all data has identical recovery priority.

### Critical

- donation obligations;
- payment submissions;
- payment verification state;
- FIFO allocations;
- finance accounts;
- transactions;
- transfers;
- expenses;
- corrections/reversals;
- audit records;
- role/authorization state.

### Important

- member profiles;
- referrals;
- committee tasks;
- meetings;
- attendance;
- notifications.

### Reconstructible/replaceable

- cached client data;
- derived dashboard caches;
- temporary export artifacts where retention permits;
- non-authoritative client state.

## 6. Backup Layers

Recovery should use multiple layers where supported:

1. managed database backups;
2. point-in-time recovery where available and approved;
3. logical/export backups for selected datasets;
4. storage-object protection/versioning where available;
5. version-controlled application source;
6. version-controlled migrations;
7. version-controlled infrastructure/configuration;
8. documented secret-recovery procedures.

No single backup layer should be assumed to cover every failure mode.

## 7. Database Backup

The authoritative PostgreSQL database requires managed backup and recovery capability appropriate to production.

Backups must cover:

- tables;
- indexes where reconstructible;
- constraints;
- functions;
- triggers;
- RLS policies;
- required schema objects.

The exact Supabase plan/features and retention configuration must be verified before production approval.

## 8. Point-in-Time Recovery

If point-in-time recovery is enabled, operators must document:

- available recovery window;
- recovery procedure;
- target timestamp selection;
- restoration environment;
- post-restore verification;
- cutover process.

Point-in-time recovery must not be treated as a substitute for logical recovery testing.

## 9. Logical Backups

Logical backups may provide an additional recovery layer for selected data.

They must be:

- generated through approved tooling;
- protected;
- integrity-checked;
- retained according to policy;
- tested by restoration.

Sensitive exports must never be stored casually on personal devices.

## 10. Storage Backup

Database backup alone does not necessarily restore storage objects.

The storage recovery strategy must cover:

- payment proofs;
- financial documents;
- committee/member documents;
- required exports;
- storage metadata.

The exact object-versioning and backup capability depends on the chosen storage architecture and provider configuration.

## 11. Storage and Database Consistency

A recovered database may reference storage objects that are missing, and storage may contain objects that the recovered database no longer references.

Recovery procedures must therefore include reconciliation of:

- metadata;
- object existence;
- authorization;
- orphan objects;
- missing referenced objects.

## 12. Application Source Recovery

Application source is recoverable through Git.

A production release must be reproducible from:

- Git commit;
- lockfile;
- documented runtime versions;
- required build configuration;
- migration history.

Local uncommitted changes are not a valid production recovery source.

## 13. Migration Recovery

Database migrations are part of the recovery artifact.

A restored database must be identifiable by schema/migration state.

Recovery must not rely on manually remembering which SQL statements were previously executed.

## 14. Configuration Recovery

Recoverable configuration should include:

- environment definitions;
- redirect URLs;
- storage configuration;
- realtime configuration;
- notification configuration;
- feature flags;
- deployment settings.

Secrets themselves should be restored through the approved secret-management process rather than committed backup files.

## 15. Secret Recovery

Secret recovery must provide a secure process for:

- retrieving current secrets;
- rotating compromised secrets;
- replacing provider credentials;
- restoring server-side configuration.

Secrets must not be stored inside ordinary database exports or source archives unless explicitly encrypted and approved.

## 16. Backup Encryption

Backups containing sensitive data must be encrypted in transit and at rest according to the provider/security policy.

Encryption keys must not be stored beside the unprotected backup data.

## 17. Backup Access Control

Only authorized operational personnel/processes should access backups.

Backup access is equivalent to highly privileged data access because backups may contain:

- member data;
- financial records;
- audit data;
- authentication-related application data.

## 18. Backup Retention

Retention must balance:

- recovery needs;
- privacy;
- storage cost;
- operational requirements.

Exact retention periods must be approved.

Deleting old backups must not remove the only available recovery point for a required recovery window.

## 19. Backup Verification

Every backup mechanism must have a verification strategy.

Verification may include:

- successful completion status;
- checksum/integrity validation where available;
- test restore;
- schema validation;
- row-count/reconciliation checks;
- storage-object checks.

## 20. Restore Testing

Restore testing is mandatory for production readiness.

A restore test should demonstrate that the team can:

1. obtain a valid recovery point;
2. restore it into an isolated environment;
3. apply required configuration;
4. start the application;
5. verify database integrity;
6. verify storage relationships;
7. verify authorization;
8. run critical smoke tests.

## 21. Restore Environment

Restoration should initially occur in an isolated environment.

Do not overwrite production during the first recovery attempt.

The restored environment must be clearly identified to prevent accidental use as the live production environment.

## 22. Restore Verification

After restore, verify:

- schema version;
- critical table presence;
- constraints;
- RLS policies;
- functions/triggers;
- member records;
- donation obligations;
- payment states;
- FIFO allocations;
- finance balances;
- transfers;
- expenses;
- corrections/reversals;
- audit records.

## 23. Financial Restore Verification

Financial recovery requires stronger validation.

Verify invariants including:

- allocation totals;
- payment allocation does not exceed payment amount;
- obligations are not over-allocated;
- account balances reconcile to transaction history;
- transfers are atomic;
- reversals/corrections remain auditable;
- duplicate operation protection remains intact.

Any unexplained financial discrepancy blocks recovery completion.

## 24. Audit Restore Verification

Audit records required for financial/security accountability must be present and internally consistent.

If audit continuity cannot be established, the incident must be escalated rather than silently declaring recovery complete.

## 25. Storage Restore Verification

Verify:

- required bucket configuration;
- object existence;
- object metadata;
- private/public access state;
- signed URL behavior;
- file authorization;
- references from database records.

Missing financial proof objects require explicit incident handling.

## 26. Notification Recovery

After restore, notification outbox state must be assessed.

Avoid sending duplicate notifications because of restoration.

Outbox records should retain stable event identity and delivery state where possible.

## 27. Offline Recovery

Offline operations created by clients before an outage may still arrive after recovery.

The restored system must preserve idempotency and operation identity so queued client work can be safely reconciled.

## 28. Realtime Recovery

After recovery:

- realtime configuration must be verified;
- subscriptions should reconnect;
- clients should refetch authoritative data;
- stale caches must converge;
- missed events must not create permanent inconsistency.

## 29. Recovery from Accidental Deletion

For accidental deletion:

1. identify deletion time and scope;
2. preserve current state;
3. identify recovery point;
4. determine affected records;
5. restore into an isolated environment;
6. extract required data or perform approved point-in-time recovery;
7. reconcile dependencies;
8. document the correction.

Do not overwrite the entire production database merely to recover one record without assessing impact.

## 30. Recovery from Corruption

If corruption is suspected:

- stop unsafe writes if necessary;
- preserve evidence;
- identify first known-good recovery point;
- compare authoritative state;
- restore into isolation;
- determine affected range;
- recover using approved procedure;
- reconcile financial data.

## 31. Recovery from Bad Migration

A bad migration may require:

- immediate deployment pause;
- application compatibility assessment;
- database inspection;
- forward-fix migration;
- point-in-time restore;
- selective data recovery.

Do not assume a reverse migration is safe.

## 32. Recovery from Bad Deployment

For a bad application release:

1. identify deployed commit;
2. identify database changes;
3. determine whether old code remains compatible;
4. rollback application if safe;
5. otherwise forward-fix;
6. monitor;
7. run critical workflow verification.

## 33. Recovery from Secret Compromise

If a secret is suspected compromised:

1. contain access;
2. rotate/revoke secret;
3. redeploy affected services;
4. inspect access logs;
5. review potentially affected data;
6. invalidate sessions/tokens if required;
7. document incident.

Never restore a compromised secret from an old backup simply because it is convenient.

## 34. Recovery from Provider Outage

If Supabase, storage, notification, or another dependency becomes unavailable:

- preserve safe local/client state;
- avoid duplicate financial submissions;
- queue only approved offline operations;
- monitor provider recovery;
- reconcile after restoration.

Provider recovery does not automatically prove every previously timed-out request failed.

## 35. Disaster Scenarios

The recovery plan should be tested against scenarios including:

- database outage;
- database corruption;
- accidental deletion;
- failed migration;
- failed deployment;
- storage outage;
- storage object loss;
- secret compromise;
- authentication outage;
- notification outage;
- realtime outage;
- regional/infrastructure outage;
- operator error;
- compromised credentials.

## 36. Recovery Priority

Priority order should generally be:

1. protect users and prevent unsafe operations;
2. protect financial integrity;
3. preserve security/audit evidence;
4. restore authoritative database;
5. restore required storage;
6. restore application service;
7. restore realtime/notifications;
8. reconcile offline clients;
9. restore secondary/derived services.

## 37. Recovery Freeze

During a major financial or data-integrity incident, operators may need to freeze selected mutations.

The freeze must be communicated through safe UI behavior and server-side enforcement where required.

A UI-only freeze is not sufficient for privileged operations.

## 38. Recovery Mode

If a controlled recovery mode is implemented, it must:

- be server-authoritative;
- restrict sensitive mutations;
- be auditable;
- be visible to authorized operators;
- have a defined exit procedure.

Recovery mode must never become a permanent bypass mechanism.

## 39. Recovery Communication

Operational communication should distinguish:

- service outage;
- degraded service;
- financial reconciliation;
- maintenance;
- security incident.

Do not disclose sensitive incident details to ordinary users.

## 40. Recovery Ownership

Every production environment must have identified owners for:

- database recovery;
- application deployment;
- storage recovery;
- security response;
- financial reconciliation;
- notification recovery;
- communication.

Exact ownership remains an operational decision.

## 41. Recovery Runbooks

Runbooks should contain:

- trigger;
- prerequisites;
- access requirements;
- exact diagnostic checks;
- recovery steps;
- verification;
- rollback/abort criteria;
- escalation;
- post-recovery actions.

Runbooks must be version-controlled where practical.

## 42. Recovery Drills

Recovery drills should occur periodically.

A drill should measure:

- time to identify;
- time to restore;
- time to validate;
- data loss;
- unresolved records;
- operational confusion;
- missing documentation.

Drills should not modify production unless explicitly designed and approved as a production exercise.

## 43. Recovery Evidence

Every recovery exercise or real incident should record:

- scenario;
- recovery point;
- operator;
- start/end time;
- systems restored;
- validation results;
- discrepancies;
- corrective actions.

## 44. RPO Validation

Actual observed recovery point should be compared with the approved RPO.

If the system cannot meet the required RPO, production readiness must be reassessed.

## 45. RTO Validation

Actual restoration time should be measured from incident declaration to verified safe service.

RTO must include validation, not merely process startup.

## 46. Backup Monitoring

Monitor:

- last successful backup;
- backup age;
- backup failure;
- storage capacity;
- retention health;
- restore-test results.

A stale backup should produce operational attention.

## 47. Restore-Test Monitoring

Track the last successful restore test and its scope.

A team that has never restored a backup cannot assume its recovery procedure works.

## 48. Recovery Security

Recovery environments must enforce access control.

Restored production data must not become broadly accessible merely because it is in a temporary recovery environment.

## 49. Recovery Data Privacy

Temporary recovery copies must have:

- restricted access;
- defined retention;
- secure deletion;
- documented purpose.

Do not leave restored production data in developer workspaces after an incident.

## 50. Recovery Environment Isolation

Recovery environments must be clearly separated from production.

A restored staging environment must not accidentally send:

- production push notifications;
- production emails;
- real payment instructions;
- production webhooks.

## 51. External Integrations

Recovery must account for external systems.

Examples:

- payment/UPI references;
- push notification providers;
- authentication providers;
- storage;
- deployment provider.

External state cannot necessarily be rolled back with the database.

## 52. External Payment Recovery

If external payment state is uncertain after database recovery, reconciliation must use authoritative external references and approved Finance procedures.

Never recreate an external payment merely because an internal record is missing.

## 53. Notification Duplication Prevention

After recovery, stable notification event IDs should prevent replaying already delivered notifications where supported.

Where duplicate delivery is unavoidable, the product must tolerate it safely.

## 54. Scheduled Job Recovery

Scheduled jobs must resume without creating duplicate financial or notification effects.

Job execution must use idempotency or durable checkpoints where required.

## 55. Queue Recovery

Queued jobs must preserve:

- operation ID;
- attempt count;
- creation time;
- current state;
- error information;
- next retry time.

Recovery must not reset all queued work blindly.

## 56. Database Connection Recovery

After database restart/recovery:

- connection pools must reconnect;
- application readiness must be re-evaluated;
- transactions must not be duplicated;
- realtime should reconnect;
- background workers should resume safely.

## 57. Cache Recovery

Caches should be considered disposable.

After major recovery, invalidate or rebuild caches rather than assuming cached state survived correctly.

## 58. Client Recovery

Clients may have stale state after server recovery.

Web and mobile clients should:

- reconnect;
- refresh sessions if needed;
- refetch sensitive data;
- reconcile pending operations;
- clear invalid cache state where appropriate.

## 59. Financial Client Recovery

Finance clients must refresh:

- pending payments;
- verification states;
- account balances;
- transaction lists;
- allocations.

A cached financial dashboard must not be treated as authoritative after a recovery event.

## 60. Member Client Recovery

Members should receive consistent current:

- profile;
- donation obligation;
- payment status;
- notification state.

Any pending client workflow should be reconciled before duplicate submission is allowed.

## 61. Audit Recovery

Audit recovery must preserve chronological and causal relationships where possible.

If a restore creates gaps, those gaps must be documented and investigated.

## 62. Backup Integrity

Where supported, backups should be protected against accidental modification/deletion.

Operational roles should be separated so that an application compromise does not automatically grant unrestricted backup destruction capability.

## 63. Backup Isolation

Backups should not depend solely on the same credentials or infrastructure whose compromise they are intended to recover from.

Exact architecture depends on the provider and approved operational plan.

## 64. Backup Testing Data

Restore tests may use synthetic environments, but production-data restoration tests must follow strict privacy controls.

Use the minimum data necessary to prove recovery.

## 65. Recovery After Long Outage

After a long outage, clients may have accumulated significant offline state.

Recovery should include:

- queue-age assessment;
- client compatibility review;
- authorization revalidation;
- idempotency verification;
- controlled replay;
- conflict reporting.

## 66. Recovery After Role Changes

Roles may change during an outage.

When clients reconnect, queued operations must be reauthorized using current server permissions rather than permissions cached when the operation was created.

## 67. Recovery After Account Deactivation

Queued operations from deactivated accounts must be rejected or handled according to domain rules.

The system must not replay privileged work solely because it was authorized when originally queued.

## 68. Recovery After Schema Evolution

Queued mobile commands must remain compatible or be safely rejected.

If the server cannot safely interpret an old operation, it must return a deterministic compatibility error rather than guessing.

## 69. Recovery from Orphan Storage

Orphan objects should be detected through reconciliation.

Cleanup must be conservative around financial/member documents and must not delete objects merely because metadata is temporarily missing.

## 70. Recovery from Missing Storage Object

If a database record references a missing required file:

- mark the issue;
- preserve the database record;
- restrict unsafe assumptions;
- identify backup/recovery options;
- escalate if the file is financially or legally important.

## 71. Recovery from Missing Audit Event

A missing audit event for a required operation is an integrity issue.

Do not fabricate historical audit records without a documented reconstruction method.

Any reconstructed event must be clearly marked as reconstructed if the audit model permits such notation.

## 72. Recovery from Missing Notification

Missing notification is generally recoverable through notification outbox/state.

Do not alter the underlying business transaction merely to regenerate a notification.

## 73. Recovery from Duplicate Notification

Duplicate notifications should not imply duplicate business transactions.

Users and support personnel should be able to distinguish notification duplication from business duplication.

## 74. Recovery from Duplicate Financial Command

If duplicate financial commands are detected:

- identify operation IDs;
- determine committed effects;
- preserve the first authoritative result;
- prevent further duplicate effects;
- reconcile balances/allocations;
- document the incident.

## 75. Recovery from Balance Mismatch

A balance mismatch must trigger reconciliation.

Do not manually overwrite the displayed balance without identifying the underlying transaction cause.

## 76. Recovery from Allocation Mismatch

If FIFO allocation totals do not reconcile:

- freeze affected allocation mutation if necessary;
- identify source payment;
- identify obligation rows;
- inspect transaction history;
- correct through approved financial workflow;
- preserve audit evidence.

## 77. Recovery from Transfer Mismatch

If a transfer appears partially applied:

- inspect atomic transaction state;
- determine actual source/destination effects;
- prevent a second transfer;
- reconcile through controlled correction.

## 78. Recovery from Expense Mismatch

If an expense appears duplicated or missing:

- identify operation ID;
- inspect transaction/account state;
- inspect audit;
- determine whether commit occurred;
- correct through approved workflow.

## 79. Recovery from Correction/Reversal Mismatch

Corrections and reversals must remain linked to original operations.

Do not delete the original financial event to hide an error.

Use the approved correction/reversal model.

## 80. Recovery Documentation

Every recovery procedure should link to:

- system architecture;
- database architecture;
- financial integrity specification;
- security operations;
- observability;
- deployment specification;
- error handling;
- testing strategy.

## 81. Recovery and Testing

Recovery procedures must be tested alongside normal feature tests.

The objective is to prove that the system can recover from realistic failure rather than only detect it.

## 82. Recovery and AI Development

AI-generated recovery code, migrations, scripts, or runbooks must be reviewed carefully.

AI tools must not invent backup capabilities, provider guarantees, RPO/RTO values, or rollback safety.

Repository documentation and verified provider capabilities remain authoritative.

## 83. Recovery and Change Management

Any change to:

- schema;
- storage;
- authentication;
- financial logic;
- deployment;
- backup configuration;
- provider integration

must be reviewed for its impact on recovery.

## 84. Recovery Readiness Checklist

Before production:

- [ ] Backup mechanism verified.
- [ ] Backup retention defined.
- [ ] Restore procedure documented.
- [ ] Restore test completed.
- [ ] Database migration recovery understood.
- [ ] Storage recovery understood.
- [ ] Financial reconciliation procedure tested.
- [ ] Audit recovery considered.
- [ ] Notification/outbox recovery tested.
- [ ] Offline replay after outage tested.
- [ ] RPO/RTO approved.
- [ ] Recovery owners assigned.
- [ ] Runbooks accessible.
- [ ] Recovery access secured.

## 85. Open Decisions

Finalize:

1. production RPO;
2. production RTO;
3. exact Supabase backup/PITR configuration;
4. logical backup strategy;
5. storage backup/versioning strategy;
6. backup retention;
7. backup encryption/key management;
8. restore-test frequency;
9. recovery owners;
10. incident communication process;
11. recovery environment topology;
12. financial reconciliation tooling;
13. disaster-recovery drill schedule;
14. acceptable data-loss boundaries;
15. backup access roles.

## 86. Definition of Done

Backup and recovery architecture is complete only when the team can demonstrate that a known recovery point can be restored into an isolated environment, the application can run against it, security controls remain active, storage relationships are verified, financial invariants reconcile, audit requirements are understood, clients can recover safely, and the documented RPO/RTO can be measured.

**Final rule:** a backup that has never been restored is an assumption, not a proven recovery capability.

## 87. Recovery Runbook Template

```text
Incident:
Environment:
Detected at:
Incident owner:
Recovery owner:
Affected systems:
Affected data domains:
Last known-good recovery point:
Target recovery point:
RPO:
RTO:
Database action:
Storage action:
Application action:
Notification action:
Offline/realtime action:
Financial reconciliation:
Audit verification:
Security verification:
Smoke tests:
Discrepancies:
User impact:
Recovery completed at:
Post-incident actions:
```

## 88. Restore Validation Matrix

| Area | Validation | Completion rule |
|---|---|---|
|Database schema|Expected migrations present|Block completion if missing|
|RLS|Policies active and tested|Block completion if protection is weakened|
|Authentication|Authorized login works|Block completion if sessions unsafe|
|Member data|Expected records recover|Investigate discrepancy|
|Donation obligations|History/effective months reconcile|Block financial release if incorrect|
|Payments|States and references reconcile|Block financial release if incorrect|
|FIFO allocations|Allocation invariants hold|Block financial release|
|Finance accounts|Balances reconcile|Block financial release|
|Transfers|Atomicity preserved|Block financial release|
|Expenses|Transaction history reconciles|Block financial release|
|Corrections/reversals|Links and audit preserved|Block financial release|
|Storage|Required referenced objects exist|Escalate missing critical objects|
|Audit|Required records available|Escalate integrity gaps|
|Notifications|Outbox state consistent|Recover/replay safely|
|Realtime|Subscriptions reconnect|Continue only after convergence|
|Offline|Queued work reconciles|Monitor until safe|

## 89. Recovery Review Questions

1. Where is the authoritative recovery point?
2. How much data could be lost under the approved RPO?
3. How long does verified recovery take under the approved RTO?
4. Has restoration actually been tested?
5. Can the restored database be identified by migration version?
6. Are RLS policies restored and verified?
7. Are storage objects restored or separately recoverable?
8. Can financial balances be reconciled?
9. Can FIFO allocations be reconciled?
10. Can duplicate operations be prevented after restore?
11. Can old mobile clients safely reconnect?
12. Can offline queues replay safely?
13. Can realtime clients converge?
14. Can notification outbox state be recovered without duplicate delivery?
15. Can audit continuity be demonstrated?
16. Are recovery copies protected from unauthorized access?
17. Can secrets be restored/rotated safely?
18. Can the team recover without relying on one individual's memory?
19. Is every recovery step documented?
20. Has the recovery process been rehearsed recently?
