# ERROR HANDLING SPEC

**Project:** Masjid-e-Mamoor 2  
**Version:** 1.0  
**Status:** Draft — Review Required

## 1. Purpose

This document defines the error-handling architecture for Masjid-e-Mamoor 2 across web, mobile, shared packages, Supabase/PostgreSQL, storage, realtime, offline synchronization, notifications, financial operations, observability, testing, and operational recovery.

Error handling is a product, security, reliability, privacy, and data-integrity concern. The system must detect, classify, safely communicate, recover from, observe, and test failures without converting uncertainty into false success.

## 2. Core Principles

Errors are expected system states. Never hide a failure. Never expose internal failure details. Never convert an unknown outcome into success. Financial errors are safety-critical. Security errors fail closed. The authoritative persisted state takes precedence over caches, optimistic UI, notifications, realtime assumptions, and offline state.

## 3. Error Taxonomy

Classify errors as validation, authentication, authorization, domain, financial-integrity, conflict, idempotency, database, storage, network, realtime, offline-sync, notification, and internal/system errors. Each class must have predictable user handling, retry behavior, logging, and tests.

## 4. Stable Error Codes

Client-visible application errors require stable machine-readable codes such as AUTH_SESSION_EXPIRED, AUTHZ_FORBIDDEN, VALIDATION_INVALID_AMOUNT, DONATION_FUTURE_MONTH_NOT_ALLOWED, FINANCE_CONCURRENT_UPDATE, IDEMPOTENCY_KEY_REUSED, STORAGE_FILE_TOO_LARGE, NETWORK_TIMEOUT, REALTIME_SUBSCRIPTION_FAILED, OFFLINE_OPERATION_REJECTED, and INTERNAL_UNEXPECTED_ERROR.

Codes describe application conditions rather than vendor implementation details. They should be uppercase, underscore-separated, domain-prefixed, documented, tested, localized, and governed.

## 5. API Error Contract

APIs should return a consistent safe error envelope containing an error code, safe user message or message key, retryability, correlation identifier, and optional structured validation/conflict metadata. Raw SQL, stack traces, tokens, secrets, internal paths, and unrelated private data must never be returned to ordinary clients.

Suggested HTTP semantics: 400 validation, 401 authentication, 403 authorization, 404 inaccessible/not-found resources as appropriate, 409 conflict/idempotency, 422 semantic validation where used, 429 rate limit, 500 unexpected server failure, 502/503/504 temporary upstream/service failure.

## 6. Validation Errors

Validate before mutation whenever possible. Field errors should preserve valid form input and identify the affected field. Cross-field rules should produce grouped or form-level errors. Validation failures are normally not retryable until input changes. Empty results must never be used to represent a failed request.

## 7. Authentication Errors

Handle invalid/expired OTP, session expiry, refresh failure, disabled accounts, rate limits, and provider failures without exposing unnecessary account information. On session expiry, preserve safe drafts, require reauthentication, refresh authorization, and never silently repeat a sensitive financial mutation.

## 8. Authorization Errors

Authorization is server-side. UI hiding is not security. Forbidden operations must fail through backend authorization/RLS/trusted-operation boundaries. If permission or role state is uncertain, fail closed. Sensitive resources may use not-found semantics where necessary to avoid existence leakage.

## 9. Domain Errors

Valid requests can still violate business rules. Examples include future-month donation restrictions, closed obligations, invalid lifecycle transitions, closed attendance windows, invalid expense state, or unauthorized workflow transitions. These are expected application outcomes, not infrastructure incidents.

## 10. Financial Error Handling

Financial operations require atomicity, idempotency, auditability, reconciliation, and explicit user feedback. The client must never infer financial success from request initiation, timeout, navigation away from the app, or optimistic UI. Unknown outcomes must be reconciled using stable operation identifiers.

## 11. Payment and UPI Errors

UPI/deep-link workflows can fail because an app is unavailable, the user cancels, a provider fails, connectivity disappears, or external payment succeeds while the application has not yet reconciled. These states must remain distinct. A client transition is not proof of payment success. Payment proof upload failure must never mark a payment verified.

## 12. FIFO and Combined Payment Errors

FIFO allocation and combined payments must execute atomically. Concurrent verification or allocation must return a conflict and refresh authoritative state. Combined payment processing must not leave unauthorized partial financial effects unless explicitly defined by the approved business workflow.

## 13. Idempotency and Retry

Financial and other side-effecting commands require operation-specific retry policy. Identical idempotent retries should return the original authoritative result where available. Reuse of an idempotency key with a different payload must fail. A timeout means the outcome may be unknown; reconcile before creating another financial command.

Safe automatic retries are generally limited to reads and explicitly idempotent transient operations. Unsafe mutations must never be blindly retried.

## 14. Concurrency

Two authorized users can act concurrently. The first committed operation establishes authoritative state; later conflicting operations receive a stable conflict error. The UI should refresh, show the changed state, and require a new decision where necessary. Database transaction failures must not be exposed as raw database details.

## 15. Database and Transaction Errors

Map database constraint, serialization, deadlock, timeout, and availability failures into application-level errors. Transaction-scoped mutations must roll back atomically. The client must not assume partial success. Financial integrity failures require stronger telemetry, reconciliation, and escalation.

## 16. Storage Errors

Storage failures include invalid type, excessive size, permission denial, missing object, signed URL expiry, upload interruption, and provider unavailability. Database metadata must not claim an object exists until the storage lifecycle is confirmed. If storage succeeds but metadata creation fails, the system must reconcile or clean up the object safely.

## 17. Network Errors

Distinguish offline, timeout, connection failure, and unknown-result conditions. Network failure before sending differs from failure after the request may have reached the server. Financial unknown outcomes require reconciliation rather than duplicate submission.

## 18. Realtime Errors

Realtime is a freshness mechanism, not the authority. Subscription failures, disconnects, duplicate events, missed events, and stale subscriptions must be handled with bounded reconnect and authoritative refetch. Duplicate events must be harmless and missed events must not leave the client permanently stale.

## 19. Offline Sync Errors

Offline operations require explicit states such as QUEUED, SYNCING, APPLIED, REJECTED, CONFLICT, UNKNOWN, and CANCELLED. Every queued side effect needs a stable operation identifier. Reconnect logic must avoid duplicate replay. Role changes, deleted records, stale data, changed business rules, and expired attendance windows can produce conflicts or rejection.

## 20. Notification Errors

Business transactions should not normally roll back because notification delivery failed. Use an outbox model with bounded retry, backoff, permanent-failure state, invalid-token cleanup, and observability. Notifications communicate authoritative state but do not establish it.

## 21. User-Facing Error UX

Use inline errors for fields, summaries for complex forms, toasts for transient background conditions, dialogs for critical conflicts/destructive failures, and full-page states when a page cannot safely load. Distinguish loading, refreshing, stale, offline, failed, unauthorized, and empty states. Unknown financial outcomes require stronger presentation than ordinary transient errors.

## 22. Error Boundaries

Web and mobile UI trees need safe runtime-error boundaries. A boundary should prevent a local rendering failure from taking down the whole application where practical, offer recovery, log diagnostics safely, and preserve unrelated state. Production fallbacks must not expose stack traces.

## 23. Accessibility and Localization

Errors must be keyboard and screen-reader accessible, programmatically associated with fields, visible without relying on color alone, and announced appropriately. Support English, Hindi, Kannada, and Urdu. Urdu error layouts must support true RTL including icons, focus order, numeric content, dates, currency, dialogs, and notifications.

## 24. Observability

Unexpected and operationally significant failures require structured logs with timestamp, environment, severity, error code, correlation/request IDs, domain, operation, platform, app version, retry state, and duration where safe. Do not log OTPs, tokens, service-role keys, sensitive payment credentials, private documents, or unnecessary personal information.

## 25. Severity and Alerting

Use meaningful severity such as INFO, NOTICE, WARNING, ERROR, and CRITICAL. Alerts should distinguish normal business errors from infrastructure incidents. Critical examples include financial invariant violations, authorization failures indicating possible security issues, widespread authentication failures, data-integrity detection, and recovery failures.

## 26. Error Registry Governance

Every stable error code should document its definition, triggering condition, HTTP mapping, retry policy, user-message key, severity, security sensitivity, and recovery behavior. Adding or deprecating a code requires review, client compatibility consideration, tests, and localization.

## 27. Financial Reconciliation

When a financial result is unknown, reconcile using authoritative operation IDs, payment submission IDs, transaction IDs, or deterministic external references where approved. Never search broadly and assume a matching record belongs to the operation without secure deterministic matching.

## 28. Role and Account Changes

Permission or account-status changes during an active session must invalidate stale authorization state. Future mutations must be rechecked server-side. Deactivated users must lose protected mutation ability and have sensitive cached data handled according to privacy policy.

## 29. Reports and Search

Report generation, export, pagination, and search errors must remain distinct from empty results. Already-loaded pages should remain visible if a later page fails. Partial exports must not be presented as complete files.

## 30. GPS and Attendance

GPS permission denial, unavailable location, low accuracy, timeout, or suspicious coordinates must follow the attendance policy rather than being silently accepted. Offline attendance synchronization must validate meeting state, attendance window, authorization, duplicate operation, and location requirements on the authoritative server.

## 31. Development Standards

Error handling is part of feature implementation, not final polish. Every feature should define validation, authentication, authorization, domain errors, conflict behavior, idempotency, retry, unknown-result handling, offline behavior, realtime behavior, storage behavior, notification behavior, localization, accessibility, telemetry, audit, and automated tests.

## 32. AI Development Guidance

AI-generated code must consult the business rules, API architecture, RLS model, financial-integrity specification, offline/realtime architecture, and this document. Review AI output for swallowed exceptions, unsafe retries, duplicate financial mutations, missing authorization, raw error leakage, incorrect optimistic updates, missing reconciliation, and secret logging.

## 33. Testing Strategy

Test expected and unexpected errors, API envelopes, RLS boundaries, financial idempotency, concurrency, timeout-after-commit, timeout-before-commit, rollback, reconciliation, storage failures, offline replay/conflict/crash recovery, realtime disconnect/missed/duplicate events, notification outbox failures, accessibility, localization, RTL, and security redaction. Controlled failure injection should be used in non-production environments.

## 34. Anti-Patterns

Never silently swallow failures. Never return success after an unknown financial result. Never retry every POST blindly. Never show raw backend errors. Never treat cache or realtime events as financial authority. Never use local offline state as final financial authority. Never log secrets. Never allow infinite retry loops.

## 35. Implementation Order

Define the centralized error registry; shared error types; API envelope; client normalization; authentication/authorization/validation/domain errors; financial/idempotency/conflict behavior; storage/offline/realtime/notification handling; UI mapping; accessibility/localization; correlation and monitoring; automated tests; failure injection; and production readiness review.

## 36. Open Decisions

Finalize the exact error registry, API transport convention, retry limits, correlation-ID propagation, observability tooling, error retention, notification/offline retention, financial reconciliation dashboard, incident ownership, alert thresholds, compatibility policy, storage/provider mappings, and audit-event failure guarantees.

## 37. Definition of Done

A feature is not complete when only the happy path works. It is complete when expected errors, unexpected failures, safe retries, conflicts, authorization boundaries, financial integrity, localization, accessibility, diagnostics, privacy, tests, and recovery procedures are all covered.

## 38. Final Rule

The system must never trade correctness, security, privacy, or financial integrity for the appearance of success. When an outcome is uncertain, preserve the operation identity, reconcile authoritative state, and communicate uncertainty honestly.

## 39. Starter Error Registry

| Domain | Error code | Default recovery |
|---|---|---|
|AUTH|AUTH_OTP_INVALID|No automatic retry; allow controlled correction|
|AUTH|AUTH_OTP_EXPIRED|Request a new OTP|
|AUTH|AUTH_SESSION_EXPIRED|Reauthenticate and revalidate|
|AUTH|AUTH_REFRESH_FAILED|Reauthenticate|
|AUTH|AUTH_ACCOUNT_DISABLED|No retry until account status changes|
|AUTHZ|AUTHZ_FORBIDDEN|No retry until authorization changes|
|AUTHZ|AUTHZ_ROLE_REQUIRED|Refresh authorization and verify role|
|VALIDATION|VALIDATION_REQUIRED|Correct missing input|
|VALIDATION|VALIDATION_INVALID_AMOUNT|Correct amount|
|VALIDATION|VALIDATION_INVALID_MONTH|Correct month|
|VALIDATION|VALIDATION_INVALID_FILE|Correct file|
|DONATION|DONATION_FUTURE_MONTH_NOT_ALLOWED|Correct payment scope|
|DONATION|DONATION_OBLIGATION_CLOSED|Refresh and select valid obligation|
|FINANCE|FINANCE_CONCURRENT_UPDATE|Refresh authoritative state|
|FINANCE|FINANCE_ALLOCATION_CONFLICT|Reconcile and retry after review|
|FINANCE|FINANCE_REVERSAL_NOT_ALLOWED|Follow approved correction workflow|
|FINANCE|FINANCE_RECONCILIATION_REQUIRED|Do not duplicate; reconcile|
|IDEMPOTENCY|IDEMPOTENCY_KEY_REUSED|Reject and preserve original operation|
|IDEMPOTENCY|IDEMPOTENCY_RESULT_ALREADY_AVAILABLE|Return original result|
|STORAGE|STORAGE_FILE_TOO_LARGE|Correct file|
|STORAGE|STORAGE_FILE_TYPE_NOT_ALLOWED|Correct file|
|STORAGE|STORAGE_ACCESS_DENIED|Refresh authorization|
|STORAGE|STORAGE_UPLOAD_FAILED|Limited retry|
|NETWORK|NETWORK_OFFLINE|Reconnect or queue only approved work|
|NETWORK|NETWORK_TIMEOUT|Reconcile if mutation could have committed|
|REALTIME|REALTIME_SUBSCRIPTION_FAILED|Reconnect and refetch|
|OFFLINE|OFFLINE_OPERATION_REJECTED|Show reason; do not loop|
|OFFLINE|OFFLINE_OPERATION_CONFLICT|Refresh and resolve|
|OFFLINE|OFFLINE_RESULT_UNKNOWN|Reconcile by operation ID|
|NOTIFICATION|NOTIFICATION_DELIVERY_FAILED|Outbox retry|
|INTERNAL|INTERNAL_UNEXPECTED_ERROR|Safe fallback and operator diagnostics|

## 40. Feature Error Contract Template

Every feature must define the following before implementation:

```text
Feature:
Operation:
Authoritative source:
Validation errors:
Authentication errors:
Authorization errors:
Domain errors:
Conflict errors:
Idempotency requirement:
Retry policy:
Unknown-result handling:
Offline behavior:
Realtime behavior:
Storage behavior:
Notification behavior:
User-facing message keys:
Accessibility behavior:
Localization behavior:
Correlation/telemetry:
Audit requirements:
Automated tests:
Failure-injection tests:
Recovery procedure:
```

Unresolved fields must be explicit approved open decisions, not silently invented during coding.

## 41. Error Review Questions

1. What is the authoritative source of truth?
2. Can the operation be duplicated by double-click, refresh, retry, reconnect, or restart?
3. What happens if the request reaches the server but the response is lost?
4. Can stale authorization permit a mutation?
5. Can the error reveal resource existence?
6. Does the response reveal sensitive information?
7. Is the error expected business behavior or infrastructure failure?
8. Should the client retry automatically?
9. Does retry require an idempotency key?
10. What happens under concurrent authorized actions?
11. What happens if the app terminates during the operation?
12. What happens if realtime delivery fails?
13. What happens if notification delivery fails?
14. What happens if storage succeeds but metadata persistence fails?
15. Can operators diagnose the problem without sensitive logs?
16. Is the error accessible?
17. Is it localized in every supported language?
18. Is Urdu RTL correct?
19. Is the failure covered by automated tests?
20. Is there a recovery and regression path?

## 42.1 Authentication Error Review

For **Authentication**, verify: input validation; current authentication; server-side authorization; domain-state validation; duplicate submission protection; concurrency behavior; retry classification; unknown-result reconciliation; safe user messaging; accessibility; localization; structured telemetry; audit requirements where applicable; and automated negative-path tests. If the subsystem can create a financial side effect, additionally verify atomicity, idempotency, invariant preservation, and post-timeout reconciliation.

## 42.2 Authorization Error Review

For **Authorization**, verify: input validation; current authentication; server-side authorization; domain-state validation; duplicate submission protection; concurrency behavior; retry classification; unknown-result reconciliation; safe user messaging; accessibility; localization; structured telemetry; audit requirements where applicable; and automated negative-path tests. If the subsystem can create a financial side effect, additionally verify atomicity, idempotency, invariant preservation, and post-timeout reconciliation.

## 42.3 Member Management Error Review

For **Member Management**, verify: input validation; current authentication; server-side authorization; domain-state validation; duplicate submission protection; concurrency behavior; retry classification; unknown-result reconciliation; safe user messaging; accessibility; localization; structured telemetry; audit requirements where applicable; and automated negative-path tests. If the subsystem can create a financial side effect, additionally verify atomicity, idempotency, invariant preservation, and post-timeout reconciliation.

## 42.4 Referrals Error Review

For **Referrals**, verify: input validation; current authentication; server-side authorization; domain-state validation; duplicate submission protection; concurrency behavior; retry classification; unknown-result reconciliation; safe user messaging; accessibility; localization; structured telemetry; audit requirements where applicable; and automated negative-path tests. If the subsystem can create a financial side effect, additionally verify atomicity, idempotency, invariant preservation, and post-timeout reconciliation.

## 42.5 Donations Error Review

For **Donations**, verify: input validation; current authentication; server-side authorization; domain-state validation; duplicate submission protection; concurrency behavior; retry classification; unknown-result reconciliation; safe user messaging; accessibility; localization; structured telemetry; audit requirements where applicable; and automated negative-path tests. If the subsystem can create a financial side effect, additionally verify atomicity, idempotency, invariant preservation, and post-timeout reconciliation.

## 42.6 Payment Submission Error Review

For **Payment Submission**, verify: input validation; current authentication; server-side authorization; domain-state validation; duplicate submission protection; concurrency behavior; retry classification; unknown-result reconciliation; safe user messaging; accessibility; localization; structured telemetry; audit requirements where applicable; and automated negative-path tests. If the subsystem can create a financial side effect, additionally verify atomicity, idempotency, invariant preservation, and post-timeout reconciliation.

## 42.7 Payment Verification Error Review

For **Payment Verification**, verify: input validation; current authentication; server-side authorization; domain-state validation; duplicate submission protection; concurrency behavior; retry classification; unknown-result reconciliation; safe user messaging; accessibility; localization; structured telemetry; audit requirements where applicable; and automated negative-path tests. If the subsystem can create a financial side effect, additionally verify atomicity, idempotency, invariant preservation, and post-timeout reconciliation.

## 42.8 FIFO Allocation Error Review

For **FIFO Allocation**, verify: input validation; current authentication; server-side authorization; domain-state validation; duplicate submission protection; concurrency behavior; retry classification; unknown-result reconciliation; safe user messaging; accessibility; localization; structured telemetry; audit requirements where applicable; and automated negative-path tests. If the subsystem can create a financial side effect, additionally verify atomicity, idempotency, invariant preservation, and post-timeout reconciliation.

## 42.9 Combined Payments Error Review

For **Combined Payments**, verify: input validation; current authentication; server-side authorization; domain-state validation; duplicate submission protection; concurrency behavior; retry classification; unknown-result reconciliation; safe user messaging; accessibility; localization; structured telemetry; audit requirements where applicable; and automated negative-path tests. If the subsystem can create a financial side effect, additionally verify atomicity, idempotency, invariant preservation, and post-timeout reconciliation.

## 42.10 Additional Donations Error Review

For **Additional Donations**, verify: input validation; current authentication; server-side authorization; domain-state validation; duplicate submission protection; concurrency behavior; retry classification; unknown-result reconciliation; safe user messaging; accessibility; localization; structured telemetry; audit requirements where applicable; and automated negative-path tests. If the subsystem can create a financial side effect, additionally verify atomicity, idempotency, invariant preservation, and post-timeout reconciliation.

## 42.11 Anonymous Donations Error Review

For **Anonymous Donations**, verify: input validation; current authentication; server-side authorization; domain-state validation; duplicate submission protection; concurrency behavior; retry classification; unknown-result reconciliation; safe user messaging; accessibility; localization; structured telemetry; audit requirements where applicable; and automated negative-path tests. If the subsystem can create a financial side effect, additionally verify atomicity, idempotency, invariant preservation, and post-timeout reconciliation.

## 42.12 Jummah Cash Error Review

For **Jummah Cash**, verify: input validation; current authentication; server-side authorization; domain-state validation; duplicate submission protection; concurrency behavior; retry classification; unknown-result reconciliation; safe user messaging; accessibility; localization; structured telemetry; audit requirements where applicable; and automated negative-path tests. If the subsystem can create a financial side effect, additionally verify atomicity, idempotency, invariant preservation, and post-timeout reconciliation.

## 42.13 Finance Accounts Error Review

For **Finance Accounts**, verify: input validation; current authentication; server-side authorization; domain-state validation; duplicate submission protection; concurrency behavior; retry classification; unknown-result reconciliation; safe user messaging; accessibility; localization; structured telemetry; audit requirements where applicable; and automated negative-path tests. If the subsystem can create a financial side effect, additionally verify atomicity, idempotency, invariant preservation, and post-timeout reconciliation.

## 42.14 Transfers Error Review

For **Transfers**, verify: input validation; current authentication; server-side authorization; domain-state validation; duplicate submission protection; concurrency behavior; retry classification; unknown-result reconciliation; safe user messaging; accessibility; localization; structured telemetry; audit requirements where applicable; and automated negative-path tests. If the subsystem can create a financial side effect, additionally verify atomicity, idempotency, invariant preservation, and post-timeout reconciliation.

## 42.15 Expenses Error Review

For **Expenses**, verify: input validation; current authentication; server-side authorization; domain-state validation; duplicate submission protection; concurrency behavior; retry classification; unknown-result reconciliation; safe user messaging; accessibility; localization; structured telemetry; audit requirements where applicable; and automated negative-path tests. If the subsystem can create a financial side effect, additionally verify atomicity, idempotency, invariant preservation, and post-timeout reconciliation.

## 42.16 Corrections Error Review

For **Corrections**, verify: input validation; current authentication; server-side authorization; domain-state validation; duplicate submission protection; concurrency behavior; retry classification; unknown-result reconciliation; safe user messaging; accessibility; localization; structured telemetry; audit requirements where applicable; and automated negative-path tests. If the subsystem can create a financial side effect, additionally verify atomicity, idempotency, invariant preservation, and post-timeout reconciliation.

## 42.17 Reversals Error Review

For **Reversals**, verify: input validation; current authentication; server-side authorization; domain-state validation; duplicate submission protection; concurrency behavior; retry classification; unknown-result reconciliation; safe user messaging; accessibility; localization; structured telemetry; audit requirements where applicable; and automated negative-path tests. If the subsystem can create a financial side effect, additionally verify atomicity, idempotency, invariant preservation, and post-timeout reconciliation.

## 42.18 Committee Tasks Error Review

For **Committee Tasks**, verify: input validation; current authentication; server-side authorization; domain-state validation; duplicate submission protection; concurrency behavior; retry classification; unknown-result reconciliation; safe user messaging; accessibility; localization; structured telemetry; audit requirements where applicable; and automated negative-path tests. If the subsystem can create a financial side effect, additionally verify atomicity, idempotency, invariant preservation, and post-timeout reconciliation.

## 42.19 Meetings Error Review

For **Meetings**, verify: input validation; current authentication; server-side authorization; domain-state validation; duplicate submission protection; concurrency behavior; retry classification; unknown-result reconciliation; safe user messaging; accessibility; localization; structured telemetry; audit requirements where applicable; and automated negative-path tests. If the subsystem can create a financial side effect, additionally verify atomicity, idempotency, invariant preservation, and post-timeout reconciliation.

## 42.20 Attendance Error Review

For **Attendance**, verify: input validation; current authentication; server-side authorization; domain-state validation; duplicate submission protection; concurrency behavior; retry classification; unknown-result reconciliation; safe user messaging; accessibility; localization; structured telemetry; audit requirements where applicable; and automated negative-path tests. If the subsystem can create a financial side effect, additionally verify atomicity, idempotency, invariant preservation, and post-timeout reconciliation.

## 42.21 Offline Sync Error Review

For **Offline Sync**, verify: input validation; current authentication; server-side authorization; domain-state validation; duplicate submission protection; concurrency behavior; retry classification; unknown-result reconciliation; safe user messaging; accessibility; localization; structured telemetry; audit requirements where applicable; and automated negative-path tests. If the subsystem can create a financial side effect, additionally verify atomicity, idempotency, invariant preservation, and post-timeout reconciliation.

## 42.22 Realtime Error Review

For **Realtime**, verify: input validation; current authentication; server-side authorization; domain-state validation; duplicate submission protection; concurrency behavior; retry classification; unknown-result reconciliation; safe user messaging; accessibility; localization; structured telemetry; audit requirements where applicable; and automated negative-path tests. If the subsystem can create a financial side effect, additionally verify atomicity, idempotency, invariant preservation, and post-timeout reconciliation.

## 42.23 Notifications Error Review

For **Notifications**, verify: input validation; current authentication; server-side authorization; domain-state validation; duplicate submission protection; concurrency behavior; retry classification; unknown-result reconciliation; safe user messaging; accessibility; localization; structured telemetry; audit requirements where applicable; and automated negative-path tests. If the subsystem can create a financial side effect, additionally verify atomicity, idempotency, invariant preservation, and post-timeout reconciliation.

## 42.24 Storage Error Review

For **Storage**, verify: input validation; current authentication; server-side authorization; domain-state validation; duplicate submission protection; concurrency behavior; retry classification; unknown-result reconciliation; safe user messaging; accessibility; localization; structured telemetry; audit requirements where applicable; and automated negative-path tests. If the subsystem can create a financial side effect, additionally verify atomicity, idempotency, invariant preservation, and post-timeout reconciliation.

## 42.25 Reports Error Review

For **Reports**, verify: input validation; current authentication; server-side authorization; domain-state validation; duplicate submission protection; concurrency behavior; retry classification; unknown-result reconciliation; safe user messaging; accessibility; localization; structured telemetry; audit requirements where applicable; and automated negative-path tests. If the subsystem can create a financial side effect, additionally verify atomicity, idempotency, invariant preservation, and post-timeout reconciliation.

## 42.26 Exports Error Review

For **Exports**, verify: input validation; current authentication; server-side authorization; domain-state validation; duplicate submission protection; concurrency behavior; retry classification; unknown-result reconciliation; safe user messaging; accessibility; localization; structured telemetry; audit requirements where applicable; and automated negative-path tests. If the subsystem can create a financial side effect, additionally verify atomicity, idempotency, invariant preservation, and post-timeout reconciliation.

## 42.27 Search Error Review

For **Search**, verify: input validation; current authentication; server-side authorization; domain-state validation; duplicate submission protection; concurrency behavior; retry classification; unknown-result reconciliation; safe user messaging; accessibility; localization; structured telemetry; audit requirements where applicable; and automated negative-path tests. If the subsystem can create a financial side effect, additionally verify atomicity, idempotency, invariant preservation, and post-timeout reconciliation.

## 42.28 Web UI Error Review

For **Web UI**, verify: input validation; current authentication; server-side authorization; domain-state validation; duplicate submission protection; concurrency behavior; retry classification; unknown-result reconciliation; safe user messaging; accessibility; localization; structured telemetry; audit requirements where applicable; and automated negative-path tests. If the subsystem can create a financial side effect, additionally verify atomicity, idempotency, invariant preservation, and post-timeout reconciliation.

## 42.29 Mobile UI Error Review

For **Mobile UI**, verify: input validation; current authentication; server-side authorization; domain-state validation; duplicate submission protection; concurrency behavior; retry classification; unknown-result reconciliation; safe user messaging; accessibility; localization; structured telemetry; audit requirements where applicable; and automated negative-path tests. If the subsystem can create a financial side effect, additionally verify atomicity, idempotency, invariant preservation, and post-timeout reconciliation.

## 43. Release Gate

Before release, confirm:

- [ ] No critical path silently converts failure to success.
- [ ] Financial mutations have idempotency and reconciliation behavior.
- [ ] Authorization failures are enforced server-side.
- [ ] Raw infrastructure errors are not exposed.
- [ ] Sensitive logs are redacted.
- [ ] Realtime recovery refetches authoritative state.
- [ ] Offline replay cannot duplicate protected side effects.
- [ ] Storage failures cannot create false proof/metadata state.
- [ ] Notification failure does not incorrectly roll back committed business state.
- [ ] Error messages are localized and accessible.
- [ ] Critical negative-path tests pass.
- [ ] Failure-injection tests cover high-risk workflows.
- [ ] Operational recovery procedures are documented.
- [ ] Production monitoring and alerts are configured.

**Final acceptance principle:** correctness and integrity take precedence over apparent success.
