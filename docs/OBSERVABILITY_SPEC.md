# OBSERVABILITY SPEC

**Project:** Masjid-e-Mamoor 2  
**Version:** 1.0  
**Status:** Draft — Review Required  
**Scope:** Web, mobile, shared packages, Supabase/PostgreSQL, storage, realtime, offline sync, notifications, authentication, finance, operations.

## 1. Purpose and Scope

This document defines the observability architecture for Masjid-e-Mamoor 2 across web, mobile, shared packages, API/domain operations, Supabase/PostgreSQL, storage, realtime, offline synchronization, notifications, authentication, and financial workflows.

Observability must make the system understandable in production without exposing private member information, authentication secrets, payment credentials, or infrastructure secrets.

The observability model is based on three complementary signals:

1. Logs — what happened and why.
2. Metrics — how often, how long, and at what rate.
3. Traces/correlation — how one operation moved across system boundaries.

Observability is not a substitute for audit. Audit records authoritative business actions; observability explains system behavior around those actions.

## 2. Core Principles

Observability must be:

- actionable;
- privacy-preserving;
- structured;
- correlated;
- consistent across web and mobile;
- useful for financial integrity;
- useful for security investigation;
- resilient to partial infrastructure failure;
- environment-aware;
- testable.

The system should collect enough information to diagnose failures while minimizing sensitive data.

The authoritative database state remains the source of truth for business state.

## 3. Observability Boundaries

The primary boundaries are:

- Browser/mobile client;
- API and domain layer;
- authentication;
- authorization/RLS;
- database;
- storage;
- realtime;
- offline synchronization;
- notification outbox/delivery;
- scheduled/background jobs;
- external payment/UPI integration where applicable;
- deployment infrastructure.

Every boundary should have a defined correlation strategy and failure signal.

## 4. Correlation IDs

Every meaningful request should have a correlation identifier.

A correlation ID allows operators to connect:

client action -> API request -> domain command -> database transaction -> storage/outbox operation -> notification -> resulting response.

Correlation IDs must be opaque and must not encode phone numbers, member IDs, payment amounts, secrets, or other sensitive information.

The identifier should survive safe service-to-service propagation.

## 5. Request IDs

Each server-side request should also have a request identifier where the platform provides one.

Request IDs identify one transport-level request. Correlation IDs may cover a wider user operation involving retries or multiple requests.

When a request is retried, the system should preserve operation identity where appropriate while allowing individual attempts to remain distinguishable.

## 6. Structured Logging

Logs must be structured rather than relying on arbitrary human-readable strings.

Recommended fields include:

- timestamp;
- environment;
- severity;
- service/application;
- component;
- event name;
- error code;
- correlation ID;
- request ID;
- operation ID where applicable;
- authenticated user/application identifier where safe;
- role context where safe;
- route/function;
- operation type;
- platform;
- app version;
- duration;
- retry attempt;
- result status.

Fields must be deliberately selected to prevent sensitive-data leakage.

## 7. Log Levels

Suggested levels:

DEBUG — development diagnostics only where approved.
INFO — normal operational events.
NOTICE — meaningful state changes or expected unusual conditions.
WARNING — recoverable condition that may require attention.
ERROR — failed operation or abnormal condition.
CRITICAL — potential integrity, security, or systemic failure.

Production logging should avoid uncontrolled DEBUG volume.

## 8. Security and Privacy

Never log:

- OTP values;
- access tokens;
- refresh tokens;
- service-role keys;
- private keys;
- passwords;
- payment credentials;
- complete private documents;
- unnecessary phone numbers;
- unnecessary member personal data.

Sensitive values should be omitted or redacted.

Observability access itself must be restricted because logs can contain sensitive operational context.

## 9. Authentication Observability

Authentication telemetry should measure:

- OTP request volume;
- OTP verification success/failure;
- session expiry;
- refresh failures;
- account disablement;
- rate limiting;
- authentication-provider failures;
- suspicious repeated failures.

Do not record OTP contents.

Authentication events should support security investigation without exposing authentication secrets.

## 10. Authorization Observability

Authorization telemetry should identify meaningful denied operations without exposing protected data.

Useful events include:

- forbidden privileged operation;
- role mismatch;
- permission mismatch;
- access to inaccessible resource;
- role change;
- account deactivation;
- authorization context refresh.

Repeated authorization failures may indicate either user confusion or a security issue; alerting must distinguish normal from anomalous patterns.

## 11. Database Observability

Database telemetry should cover:

- query latency;
- transaction latency;
- connection failures;
- transaction rollbacks;
- serialization conflicts;
- deadlocks;
- constraint violations;
- migration status;
- connection saturation;
- error rates.

Raw SQL statements containing sensitive values must not be logged indiscriminately.

Query-level diagnostics should use sanitized identifiers and approved database observability mechanisms.

## 12. Transaction Observability

Important transactions should record:

- operation type;
- transaction outcome;
- duration;
- correlation ID;
- operation ID;
- conflict/retry information;
- safe entity reference;
- resulting error code where applicable.

Financial transactions require stronger monitoring than ordinary reads.

## 13. Financial Observability

Financial observability must monitor:

- payment submission failures;
- verification failures;
- rejection volume;
- FIFO allocation conflicts;
- combined payment failures;
- duplicate commands;
- idempotency conflicts;
- transfer failures;
- expense failures;
- correction/reversal failures;
- reconciliation-required states;
- transaction latency;
- invariant violations.

Financial telemetry must never become a second source of financial truth. It describes operations; the ledger/database remains authoritative.

## 14. Financial Integrity Alerts

High-severity alerts should be considered for:

- impossible balance/invariant conditions;
- repeated allocation mismatch;
- duplicate financial effects;
- audit persistence failure where guaranteed;
- abnormal reversal frequency;
- repeated reconciliation-required states;
- unexplained transaction rollback spikes.

Thresholds must be approved before production rollout.

## 15. Payment and UPI Observability

Track payment workflow stages without logging sensitive payment credentials.

Useful events:

- payment intent created;
- UPI handoff initiated;
- return from UPI app;
- proof uploaded;
- payment submitted;
- Finance verification;
- Finance rejection;
- reconciliation required.

The telemetry must distinguish user cancellation, application failure, provider failure, and unresolved external payment state.

## 16. API Metrics

API metrics should include:

- request count;
- success rate;
- error rate;
- latency;
- timeout rate;
- status-code distribution;
- error-code distribution;
- retry count;
- concurrency conflict count;
- request size where useful and privacy-safe.

Metrics should be grouped by stable dimensions rather than high-cardinality user identifiers.

## 17. High-Cardinality Control

Do not use arbitrary user IDs, phone numbers, payment IDs, or correlation IDs as metric labels if that creates uncontrolled cardinality.

Correlation identifiers belong in logs/traces. Metrics should use bounded dimensions such as:

- environment;
- domain;
- endpoint family;
- operation;
- platform;
- status class;
- error category.

## 18. Latency Metrics

Track:

- total request latency;
- domain command latency;
- database latency;
- storage latency;
- notification delivery latency;
- realtime reconnect duration;
- offline synchronization duration.

Use percentiles such as p50, p95, and p99 where appropriate.

## 19. Error Rate Metrics

Measure both absolute count and rate.

A spike from 1 to 10 errors may be significant for a low-volume financial operation even if the percentage appears small.

Conversely, a high volume of normal validation failures should not automatically indicate infrastructure failure.

## 20. Availability Metrics

Availability should be measured by meaningful user operations rather than only server process uptime.

Examples:

- authenticated users can load authorized data;
- Finance users can process valid payment commands;
- members can submit allowed workflows;
- offline synchronization recovers after reconnect;
- notification outbox continues processing.

## 21. Realtime Observability

Track:

- subscription attempts;
- successful subscriptions;
- subscription failures;
- reconnect count;
- reconnect duration;
- channel lifecycle;
- authorization failures;
- stale connection duration;
- forced refetch after reconnect.

Do not treat the absence of a realtime event as proof that no database change occurred.

## 22. Realtime Freshness

Where practical, measure the time between an authoritative change and client cache convergence.

The objective is not to guarantee an arbitrary latency number but to detect regressions and persistent disconnects.

After reconnect, authoritative refetch should be observable.

## 23. Offline Observability

Track:

- queue size;
- oldest queued operation age;
- synchronization attempts;
- applied operations;
- rejected operations;
- conflicts;
- unknown results;
- retry counts;
- synchronization duration;
- permanently blocked operations.

Offline telemetry must avoid uploading private payload contents merely for diagnostics.

## 24. Offline Queue Health

A growing queue can indicate:

- no connectivity;
- server outage;
- authentication expiry;
- a systemic validation problem;
- an application bug;
- an authorization change.

Queue age and rejection category should be monitored separately.

## 25. Storage Observability

Track:

- upload count;
- upload failures;
- download failures;
- signed URL generation failures;
- object-not-found events;
- authorization failures;
- file validation rejection;
- upload duration;
- orphan reconciliation count.

Never log file contents or sensitive document data.

## 26. Notification Observability

Track:

- outbox events created;
- delivery attempts;
- successful delivery;
- transient failures;
- permanent failures;
- invalid push tokens;
- retry count;
- delivery latency;
- dead-letter count where used.

Notification failure must remain distinguishable from business transaction failure.

## 27. Audit vs Observability

Audit answers: who performed an authoritative business action, when, and what state change was committed.

Observability answers: what the system did while processing the operation, how long it took, what failed, and how it recovered.

They must not be conflated.

An audit event must not be replaced by an ordinary log line.

## 28. Audit Correlation

Where appropriate, audit events may include correlation and operation identifiers so an auditor or operator can connect business activity with system diagnostics.

Audit data must follow its own immutability, access-control, retention, and privacy requirements.

## 29. Error Correlation

Every significant error should be traceable through:

- stable error code;
- correlation ID;
- request ID;
- operation ID when applicable;
- environment;
- application version;
- domain;
- timestamp.

The combination should allow diagnosis without exposing sensitive business payloads.

## 30. Client Observability

Web and mobile clients should capture safe diagnostic events such as:

- route/load failures;
- API error codes;
- mutation failures;
- sync state changes;
- realtime reconnect;
- app version;
- platform;
- locale.

Client telemetry must be sampled or bounded to avoid excessive volume and must respect privacy policy.

## 31. Crash Reporting

Unexpected web runtime errors and mobile crashes should be captured using the approved observability tooling.

Crash reports should include:

- application version;
- platform;
- environment;
- safe route/screen context;
- correlation context where available;
- sanitized error type.

Do not attach raw authentication tokens or private form contents.

## 32. Performance Observability

Measure important user journeys such as:

- login;
- dashboard load;
- payment submission;
- Finance verification;
- task/meeting load;
- attendance synchronization;
- report generation.

Performance telemetry must be separated from business success metrics.

## 33. Database Performance

Monitor slow queries, connection pressure, lock contention, transaction duration, and index/query regressions.

Database performance changes must be evaluated alongside RLS and authorization behavior so that performance optimization never weakens security.

## 34. RLS Observability

Security-sensitive authorization failures should be observable at a safe aggregate level.

Useful signals include:

- denied privileged mutations;
- repeated cross-scope access failures;
- role mismatch;
- policy evaluation errors;
- unexpected authorization latency.

Do not log protected rows merely because an RLS check failed.

## 35. Storage Security Observability

Monitor repeated unauthorized object access, suspicious signed URL failures, unusual download patterns, and invalid object paths.

Security telemetry should avoid exposing the protected file contents.

## 36. Rate Limiting Observability

Track rate-limit events by bounded dimensions such as operation class and environment.

Do not create unbounded metrics keyed by individual phone numbers or arbitrary identifiers.

## 37. Background Jobs

Every background job should expose:

- execution count;
- success/failure count;
- duration;
- retry count;
- last successful execution;
- oldest pending item;
- dead-letter or permanently failed item count where applicable.

Jobs must not silently stop processing after an exception.

## 38. Notification Outbox Monitoring

Monitor outbox age and backlog.

Important indicators:

- oldest unprocessed event;
- number of retrying events;
- permanent failures;
- throughput;
- processing latency.

A growing backlog should produce operational attention before users experience widespread notification delays.

## 39. Offline Reconciliation Monitoring

Monitor operations remaining in UNKNOWN or CONFLICT state.

Persistent unknown financial operations require priority investigation because the client cannot safely infer final state.

## 40. Deployment Observability

Every deployment should expose:

- version/build identifier;
- deployment timestamp;
- environment;
- migration status;
- application health;
- error-rate change;
- latency change.

Deployment diagnostics must make rollback or remediation decisions possible without exposing secrets.

## 41. Migration Observability

Database migrations should produce clear deployment status.

A failed migration must stop unsafe rollout where required.

Production diagnostics should identify migration version/status without exposing connection credentials or raw database internals.

## 42. Feature Flag Observability

If feature flags are used, telemetry should identify feature state where useful.

Unexpected combinations between client and server feature state should be diagnosable.

Flags must never be treated as a substitute for server-side authorization.

## 43. Environment Separation

Observability data must distinguish development, staging, and production.

Production data must not be copied into development telemetry merely for convenience.

Test environments should use synthetic or appropriately sanitized data.

## 44. Sampling

High-volume events may require sampling.

Sampling must not remove critical evidence for:

- financial integrity failures;
- authorization/security incidents;
- data corruption;
- unresolved financial operations;
- critical infrastructure outages.

Sampling rules should be documented.

## 45. Retention

Observability retention must be defined separately from audit retention.

Retention should balance:

- incident investigation;
- privacy;
- storage cost;
- regulatory/organizational requirements;
- security.

The exact retention periods remain an open deployment decision until approved.

## 46. Access Control

Observability dashboards, logs, traces, and crash reports must have restricted access.

Access should follow least privilege.

Not every application role should have operational telemetry access.

## 47. Dashboard Design

Dashboards should be organized by operational question rather than raw infrastructure.

Recommended dashboards:

- application health;
- authentication;
- finance;
- API;
- database;
- storage;
- realtime;
- offline sync;
- notifications;
- security;
- deployment/release.

## 48. Application Health Dashboard

Include:

- request success rate;
- error rate;
- latency;
- active incidents;
- deployment version;
- authentication health;
- database health;
- realtime health;
- notification backlog.

Use bounded dimensions and clear time windows.

## 49. Finance Dashboard

Include operational indicators such as:

- payment command failure rate;
- verification conflict rate;
- reconciliation-required count;
- FIFO conflict count;
- transfer/expense error rate;
- financial transaction latency;
- invariant alerts.

Do not expose financial data more broadly than authorized.

## 50. Authentication Dashboard

Monitor:

- OTP request rate;
- verification success rate;
- verification failure rate;
- expiry rate;
- session refresh failures;
- provider errors;
- rate-limit events;
- account disablement events.

Avoid displaying raw phone numbers.

## 51. Security Dashboard

Security telemetry may include:

- repeated forbidden operations;
- repeated authentication failures;
- suspicious rate-limit patterns;
- unusual privileged-operation failures;
- storage access denials;
- unexpected role changes.

Security analysts should be able to investigate without exposing unnecessary member data.

## 52. Realtime Dashboard

Monitor:

- subscription success;
- failure rate;
- reconnect frequency;
- reconnect duration;
- stale client indicators;
- channel errors.

Where client telemetry is used, sample and aggregate appropriately.

## 53. Offline Dashboard

Monitor:

- queue backlog;
- oldest queue item;
- rejected operation rate;
- conflict rate;
- unknown operation count;
- average synchronization duration;
- failed replay rate.

## 54. Storage Dashboard

Monitor:

- upload success/failure;
- validation rejection;
- signed URL errors;
- object-not-found rate;
- storage latency;
- orphan reconciliation backlog.

## 55. Notification Dashboard

Monitor:

- outbox throughput;
- delivery success;
- transient failure;
- permanent failure;
- invalid tokens;
- queue age;
- retry volume.

## 56. Alert Design

Alerts should be:

- actionable;
- bounded;
- severity-aware;
- owner-assigned;
- resistant to normal traffic spikes;
- linked to useful diagnostic context.

Avoid alerts that operators cannot act on.

## 57. Alert Thresholds

Thresholds must account for:

- baseline traffic;
- operation volume;
- time of day;
- expected scheduled jobs;
- maintenance windows.

Financial integrity and security signals may require lower thresholds than ordinary UI errors.

## 58. Alert Deduplication

Repeated occurrences of the same root problem should be grouped where the observability system supports alert grouping.

The grouping must not hide independent financial or security incidents.

## 59. Incident Correlation

An incident should connect:

- alert;
- relevant error codes;
- deployment version;
- correlation IDs;
- logs;
- metrics;
- traces;
- audit records where applicable;
- recovery actions.

This reduces time spent reconstructing the failure manually.

## 60. Incident Response

For an operational incident:

1. identify scope;
2. determine whether financial/security integrity is affected;
3. stop unsafe operations if necessary;
4. preserve evidence;
5. identify affected versions/operations;
6. recover service;
7. reconcile authoritative state;
8. verify user-visible state;
9. document root cause;
10. create regression improvements.

## 61. Financial Incident Response

If financial integrity is suspected:

- do not rely on client state;
- identify affected operation IDs;
- inspect committed database state;
- inspect audit records;
- inspect idempotency records;
- check allocation/account invariants;
- prevent duplicate corrective mutations;
- document reconciliation.

Financial correctness takes precedence over rapid cosmetic recovery.

## 62. Security Incident Response

If security telemetry indicates unauthorized behavior:

- preserve evidence;
- verify authorization state;
- inspect relevant audit records;
- review sessions/roles as appropriate;
- contain the issue;
- rotate/revoke credentials if required;
- document impact.

Do not expose investigation details to ordinary users.

## 63. Recovery Verification

Recovery is not complete when the server returns to green.

Verify:

- authoritative data;
- caches;
- realtime convergence;
- offline queues;
- notification outbox;
- storage state;
- audit state;
- user-visible workflows.

## 64. Observability Failure

The observability system itself can fail.

Application correctness must not depend on telemetry being available.

Business transactions must continue according to their normal integrity rules when non-critical telemetry is unavailable.

Critical audit guarantees are governed separately.

## 65. Backpressure

Telemetry pipelines must use bounded queues and controlled backpressure.

A telemetry outage must not consume unbounded application memory or block critical financial requests indefinitely.

## 66. Logging Failure Policy

If ordinary diagnostic logging fails, the application should continue safely where possible.

For mandatory audit events, the system must follow the approved transactional/audit guarantee rather than silently dropping the event.

## 67. Privacy Review

Every new telemetry field should be reviewed for:

- necessity;
- sensitivity;
- retention;
- access;
- aggregation;
- deletion requirements.

Collecting a value merely because it is technically available is not sufficient justification.

## 68. Data Minimization

Prefer:

- stable error codes;
- bounded operation names;
- hashed or opaque identifiers where approved;
- aggregate metrics;
- sanitized metadata.

Avoid raw payload capture by default.

## 69. User Support Diagnostics

If support workflows need diagnostic information, provide a safe support/reference identifier such as a correlation ID.

Users should not be asked to copy tokens, OTPs, private payment information, or raw backend errors.

## 70. Operational Runbooks

High-risk alerts should have runbooks.

A runbook should include:

- symptoms;
- likely causes;
- diagnostic queries/dashboards;
- containment steps;
- recovery steps;
- reconciliation checks;
- escalation owner;
- rollback criteria;
- post-incident actions.

## 71. Development Observability

Development environments may provide richer diagnostics, but developers must still avoid credential logging.

Development should make it easy to inspect:

- request correlation;
- domain operation;
- error code;
- query timing;
- cache behavior;
- realtime lifecycle;
- offline queue state.

## 72. Test Observability

Automated tests should assert important telemetry behavior where it is part of the contract.

Examples:

- correct error code;
- correlation identifier present;
- no secret in log output;
- financial conflict emitted;
- offline rejection recorded;
- notification failure isolated from business commit.

## 73. Contract Tests

Error contracts should be tested so web and mobile clients can rely on stable codes and shapes.

Unknown error codes must degrade safely.

## 74. Performance Testing

Observability instrumentation must not materially distort application performance.

Measure telemetry overhead in production-like environments.

## 75. Load Testing

Load tests should verify that:

- logging remains bounded;
- metrics remain stable;
- tracing does not exhaust resources;
- error spikes do not create cascading telemetry failures;
- financial operations retain correctness under concurrency.

## 76. Failure Injection

Controlled failures should be injected for:

- database timeout;
- transaction conflict;
- storage outage;
- realtime disconnect;
- notification provider failure;
- authentication provider failure;
- network interruption;
- mobile process termination;
- offline replay conflict.

Observe both system failure and recovery.

## 77. Regression Tracking

Every meaningful production failure should be evaluated for:

- missing telemetry;
- insufficient diagnostics;
- incorrect alerting;
- missing test;
- missing runbook;
- privacy issue;
- product/UX gap.

## 78. AI Development Guidance

AI-generated observability code must be reviewed for:

- high-cardinality metrics;
- secret logging;
- PII leakage;
- missing correlation;
- swallowed errors;
- noisy logging;
- false success;
- incorrect severity;
- unsafe telemetry dependencies.

AI tools must consult this document and the project's security, financial integrity, error handling, RLS, and testing specifications before adding instrumentation.

## 79. Multi-AI Workflow

No single AI tool is authoritative.

The repository documentation and Git history remain the source of truth. One implementation owner should own a given observability file/module at a time; other AI tools may review, test, or suggest improvements without creating conflicting implementations.

## 80. Definition of Done

Observability is complete when critical workflows can be diagnosed from structured evidence; logs are privacy-safe; metrics are actionable; important operations are correlated; financial and security failures are visible; offline/realtime behavior is measurable; alerts have owners; recovery is documented; and tests verify instrumentation where it forms part of the contract.

## 81. Recommended Event Naming

Use stable, domain-oriented event names.

Examples:

```text
auth.otp.requested
auth.otp.verified
auth.session.expired

authorization.denied
member.profile.updated

donation.payment.submitted
donation.payment.verified
donation.payment.rejected
donation.allocation.completed

finance.transfer.completed
finance.expense.created
finance.correction.applied

offline.operation.queued
offline.operation.applied
offline.operation.rejected
offline.operation.conflict

realtime.subscription.connected
realtime.subscription.failed
realtime.reconnect.completed

notification.outbox.created
notification.delivery.succeeded
notification.delivery.failed

storage.upload.succeeded
storage.upload.failed
```

Event names describe what happened, not an implementation detail.

## 82. Suggested Metric Families

| Family | Metric | Meaning | Bounded dimensions |
|---|---|---|---|
|API|request_total|Count of requests|domain,operation,status_class|
|API|request_duration|Request latency|domain,operation|
|API|error_total|Application/infrastructure errors|domain,error_category|
|Finance|financial_command_total|Financial command outcomes|operation,result|
|Finance|financial_conflict_total|Financial concurrency conflicts|operation|
|Finance|reconciliation_required_total|Unresolved financial outcomes|operation|
|Database|transaction_duration|Transaction latency|operation|
|Database|transaction_failure_total|Transaction failures|failure_category|
|Realtime|subscription_total|Subscription outcomes|channel_group,result|
|Realtime|reconnect_total|Reconnect events|platform|
|Offline|queue_depth|Current queue size|platform|
|Offline|operation_total|Offline operation outcomes|operation,result|
|Storage|upload_total|Upload outcomes|file_category,result|
|Notification|outbox_depth|Pending outbox count|notification_type|
|Notification|delivery_total|Delivery outcomes|notification_type,result|

## 83. Observability Review Checklist

- [ ] Every important request has correlation context.
- [ ] Financial commands have operation identifiers.
- [ ] Raw secrets are excluded from logs.
- [ ] PII collection is minimized.
- [ ] Error codes are stable and documented.
- [ ] Metrics avoid uncontrolled cardinality.
- [ ] Realtime reconnect is observable.
- [ ] Offline queue health is observable.
- [ ] Notification backlog is observable.
- [ ] Storage failures are observable.
- [ ] Database transaction failures are observable.
- [ ] Critical security failures are observable.
- [ ] Financial invariant failures have high-priority telemetry.
- [ ] Alerts have an owner and runbook.
- [ ] Telemetry failure cannot silently change business correctness.
- [ ] Audit and observability remain separate concerns.
- [ ] Production and non-production telemetry are separated.
- [ ] Retention is defined.
- [ ] Observability access is restricted.
- [ ] Critical failure paths are covered by tests.

## 84. Open Decisions

1. Select final observability provider/tooling.
2. Select final log storage and retention policy.
3. Select final metrics/tracing stack.
4. Define exact correlation-ID propagation.
5. Define client crash-reporting policy.
6. Define sampling percentages by event class.
7. Define production alert thresholds.
8. Define financial alert severity and escalation thresholds.
9. Define security alert ownership.
10. Define dashboard ownership.
11. Define support-facing diagnostic workflow.
12. Define observability access roles.
13. Define telemetry retention and deletion schedule.
14. Define mandatory audit-event durability guarantees.
15. Define exact production runbooks.
