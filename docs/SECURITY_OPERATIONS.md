# SECURITY OPERATIONS

**Project:** Masjid-e-Mamoor 2  
**Version:** 1.0  
**Status:** Draft — Review Required  
**Scope:** Application, database, RLS, authentication, authorization, storage, finance, web, mobile, offline, realtime, CI/CD, operations, incidents.

## 1. Purpose and Scope

This document defines the operational security model for Masjid-e-Mamoor 2 after the application, database, storage, authentication, and deployment foundations are in place.

It covers:

- identity and access management;
- role and permission security;
- Supabase/PostgreSQL/RLS security;
- trusted operations;
- financial security;
- storage security;
- client security;
- mobile/web security;
- secrets;
- session security;
- audit and monitoring;
- incident response;
- vulnerability management;
- dependency and supply-chain security;
- backup/recovery security;
- secure operations.

Security is a continuous operational responsibility. It is not limited to login and password/OTP handling.

## 2. Security Principles

The system follows these principles:

1. least privilege;
2. deny by default;
3. server-side authorization;
4. defense in depth;
5. data minimization;
6. explicit trust boundaries;
7. secure defaults;
8. immutable/auditable financial history;
9. separation of duties;
10. safe failure;
11. controlled recovery;
12. continuous monitoring.

A hidden UI control is never a security boundary.

## 3. Trust Boundaries

Important trust boundaries are:

- browser/mobile client -> backend;
- authenticated user -> authorized operation;
- public API -> trusted domain operation;
- application -> database;
- application -> storage;
- application -> notification provider;
- application -> external payment/UPI flow;
- local offline queue -> authoritative server;
- development/staging -> production;
- operators -> production infrastructure.

Every boundary must validate trust independently where appropriate.

## 4. Identity Security

Supabase Auth is the identity foundation.

The application must distinguish:

- authenticated identity;
- application user;
- member record;
- role;
- permission;
- account status.

Authentication proves identity. Authorization determines what that identity may do.

## 5. Phone OTP Security

OTP authentication must enforce:

- expiration;
- attempt limits;
- resend controls;
- rate limiting;
- secure transport;
- no OTP logging;
- safe error messages;
- session issuance only after successful verification.

The system must not expose provider secrets to clients.

## 6. Session Security

Sessions must be:

- securely stored according to platform;
- refreshed according to approved client architecture;
- invalidated on logout;
- invalidated/restricted when account status requires;
- revalidated before sensitive operations.

Mobile credentials must use secure platform storage rather than plain local storage.

## 7. Session Theft Response

If session compromise is suspected:

- invalidate affected sessions where supported;
- require reauthentication;
- review privileged actions;
- inspect audit/observability;
- rotate credentials where necessary.

The system must not assume that a valid session is permanently trustworthy.

## 8. Account Security

Account status must be server-authoritative.

States may include:

- active;
- disabled;
- pending;
- suspended;
- otherwise approved application states.

Deactivation must prevent protected mutations even if a stale client still displays privileged UI.

## 9. Role Security

The seven defined roles are:

1. President / Super Admin;
2. Vice President;
3. Secretary;
4. Finance;
5. Auditor;
6. Committee Member;
7. Member.

Role assignment is privileged and must be auditable.

## 10. Permission Security

Permissions should be resolved from trusted server-side role/permission data.

The client may cache permissions for UX, but the backend remains authoritative.

A stale permission cache must never grant access.

## 11. Separation of Duties

Sensitive operations should follow the approved role-separation model.

Examples:

- financial processing belongs to Finance workflows;
- auditing remains oversight-oriented;
- administration is restricted;
- members manage only permitted personal workflows.

Where a workflow requires multiple actors, the system must enforce the separation server-side.

## 12. Privileged Operations

Privileged operations require:

- authenticated session;
- current authorization;
- input validation;
- domain-state validation;
- audit logging where applicable;
- conflict/idempotency protection;
- safe error handling.

## 13. RLS Security

Supabase/PostgreSQL Row Level Security is a core data-access boundary for exposed application data.

Every relevant table must have an explicit RLS strategy.

Default posture for sensitive application data is deny until an approved policy allows access.

## 14. RLS and Service Role

Service-role or equivalent elevated credentials bypass normal client-facing RLS boundaries and therefore require strict server-side containment.

They must never be exposed to web/mobile clients.

Trusted operations must explicitly validate authentication, authorization, input, and business rules.

## 15. RLS Testing

RLS must be tested positively and negatively.

For each protected resource, test:

- authorized access;
- unauthorized role;
- unauthenticated access;
- cross-member access;
- deactivated account;
- stale role;
- privileged operation from an ordinary client.

## 16. Database Security

Database security includes:

- RLS;
- least-privilege database roles;
- constraints;
- secure functions;
- transaction boundaries;
- migration review;
- connection security;
- backup security;
- query review.

Database constraints complement application validation.

## 17. Trusted Operations

Trusted operations may be required for atomic workflows such as:

- financial verification;
- FIFO allocation;
- combined payments;
- transfers;
- corrections;
- reversals;
- other multi-table state transitions.

Trusted operations must not become authorization bypasses.

## 18. Trusted Function Rules

A trusted function/RPC must:

- validate caller identity;
- validate caller authorization;
- validate inputs;
- enforce business rules;
- perform atomic changes;
- record required audit information;
- return only safe data.

The fact that a function is trusted does not make every caller trusted.

## 19. Financial Security

Financial data is high sensitivity.

Security must preserve:

- authorization;
- atomicity;
- idempotency;
- auditability;
- immutable historical meaning;
- separation of duties;
- reconciliation.

## 20. Financial Mutation Controls

Financial mutations must be protected against:

- double submit;
- replay;
- concurrent verification;
- unauthorized correction;
- stale role;
- stale state;
- client tampering;
- direct API manipulation.

## 21. Financial Audit

Important financial events must be auditable.

Audit information should establish:

- actor;
- operation;
- time;
- target;
- resulting state;
- relevant operation/correlation ID.

Audit records must not be casually editable or deletable.

## 22. Financial Integrity Monitoring

Monitor for:

- duplicate effects;
- impossible balances;
- allocation mismatches;
- suspicious reversal/correction activity;
- repeated authorization failures;
- unusual privileged activity.

Observability is supplementary to authoritative financial data.

## 23. Donation Privacy

Member donation information is private.

Access should be limited according to role and documented business requirements.

Anonymous donations require additional care so donor identity is not unintentionally revealed through UI, reports, logs, exports, notifications, or storage.

## 24. Payment Proof Security

Payment proofs are private documents.

Use private storage and authorized access.

Do not expose permanent public URLs for sensitive proofs.

Signed access should be short-lived and permission-checked.

## 25. Storage Path Security

Object paths must not be treated as authorization.

The backend/storage policies must independently validate access.

Do not allow clients to choose arbitrary privileged storage paths without policy enforcement.

## 26. File Upload Security

Validate:

- file type;
- file size;
- file name/path;
- content expectations;
- authorization;
- ownership/scope.

Where necessary, inspect content rather than trusting only the filename or client MIME type.

## 27. File Download Security

Downloads require current authorization.

Expired or invalid signed URLs should not expose the object.

A previously valid URL must not be treated as permanent authorization.

## 28. Storage Orphans

Orphaned objects must be reconciled carefully.

Cleanup must not delete a financial/member document merely because database metadata is temporarily unavailable.

## 29. Web Security

Web security must include:

- secure session handling;
- server-side authorization;
- CSRF considerations for applicable flows;
- safe output rendering;
- dependency hygiene;
- secure headers where appropriate;
- protected server actions/API routes;
- no secret exposure in bundles.

## 30. XSS Prevention

User-controlled text must not be rendered as executable HTML unless explicitly sanitized and approved.

Avoid unsafe HTML injection.

Rich text, if ever introduced, requires dedicated sanitization rules.

## 31. Injection Prevention

Database access must use parameterized queries or approved query builders/functions.

Never construct SQL by concatenating untrusted input.

Search/filter/sort fields must be constrained to approved values.

## 32. Mobile Security

Mobile applications are untrusted clients.

Do not store privileged server credentials in the app.

Use secure storage for session material and assume reverse engineering is possible.

## 33. Deep Link Security

Deep links must validate:

- route;
- authentication;
- authorization;
- object scope;
- current resource state.

A deep link must never bypass RLS or trusted operation authorization.

## 34. UPI Security

UPI/deep-link flows must not treat client navigation as payment proof.

Payment status must be established through the approved workflow and Finance verification.

External payment references must be validated and protected from tampering.

## 35. API Security

Every mutation API must enforce:

- authentication;
- authorization;
- schema validation;
- domain validation;
- rate limiting where appropriate;
- idempotency for sensitive commands;
- safe error responses;
- audit/observability where required.

## 36. API Enumeration

Resource identifiers must not allow unauthorized users to discover private records.

Use authorization-aware queries and appropriate not-found/forbidden semantics.

Do not rely on random IDs alone as a security control.

## 37. Pagination Security

Pagination must enforce authorization for every page/query.

A user must not access unauthorized records by manipulating:

- page number;
- cursor;
- filters;
- sort fields;
- search terms.

## 38. Search Security

Search must be scoped to the user's authorized data.

Search endpoints must not become a side channel for discovering private member, finance, or audit information.

## 39. Export Security

Exports are high-risk because they aggregate data.

Export generation must enforce:

- role/permission;
- filter scope;
- data minimization;
- secure storage;
- controlled download;
- audit where required.

## 40. Report Security

Reports must not expose more financial/member information than the requesting role is authorized to view.

Derived dashboards must inherit underlying data authorization.

## 41. Notification Privacy

Notifications must avoid unnecessary sensitive information.

For example, a lock-screen notification should not expose private financial details where a generic message is sufficient.

## 42. Push Token Security

Push tokens are sensitive operational identifiers.

Store them securely, associate them with the correct authenticated account/device context, and invalidate stale tokens.

## 43. Notification Deep Links

A notification deep link must still perform authorization checks when opened.

Possession of a notification link is not proof of authorization.

## 44. Realtime Security

Realtime subscriptions must respect authorization/RLS boundaries.

Clients must not subscribe to channels or rows they are not permitted to access.

After role changes or logout, sensitive subscriptions must be removed or invalidated.

## 45. Realtime Data Leakage

Do not broadcast more data than the receiving role requires.

Avoid placing private fields into broadly visible realtime payloads.

## 46. Offline Security

Offline storage must assume the device may be lost or compromised.

Persist only the minimum required data.

Sensitive local data should use appropriate platform security mechanisms.

## 47. Offline Queue Security

Offline operations must include:

- authenticated identity context;
- stable operation ID;
- operation type;
- safe payload;
- integrity checks where appropriate;
- authorization revalidation at replay.

The server must not trust the offline client merely because the operation was created while online.

## 48. Offline Replay Authorization

At replay time, evaluate current:

- account status;
- role;
- permission;
- target resource;
- business state.

An operation authorized yesterday may be forbidden today.

## 49. Secret Management

Secrets must be managed outside source code.

Never commit:

- service-role keys;
- database passwords;
- private signing keys;
- provider secrets;
- authentication secrets.

## 50. Secret Rotation

Secret rotation must be planned.

After rotation:

- redeploy dependent services;
- invalidate old credentials where appropriate;
- verify functionality;
- inspect logs for continued use of old credentials.

## 51. Dependency Security

Dependencies must be:

- pinned/locked;
- reviewed;
- updated deliberately;
- monitored for known vulnerabilities.

Avoid adding dependencies without understanding maintenance, security, and license implications.

## 52. Supply Chain Security

Production builds should use trusted package registries and lockfiles.

CI should avoid executing arbitrary unreviewed scripts with production credentials.

Build dependencies should be reviewed when they gain privileged capabilities.

## 53. Git Security

Protect the repository from:

- committed secrets;
- malicious workflow changes;
- unauthorized branch changes;
- unreviewed production configuration.

Production deployment credentials should not be broadly available to contributors.

## 54. CI/CD Security

CI/CD must follow least privilege.

Pull requests from untrusted sources must not receive unrestricted production secrets.

Deployment workflows should distinguish build permissions from production deployment permissions.

## 55. Environment Isolation

Development, staging, and production must be isolated.

A developer should not accidentally point local code at production and execute privileged operations.

## 56. Production Access

Production infrastructure access must be restricted and auditable.

Use named accounts where possible.

Shared administrator credentials should be avoided.

## 57. Break-Glass Access

Emergency access may exist for critical incidents.

Break-glass access must:

- be restricted;
- be auditable;
- have a defined reason;
- be reviewed after use;
- not become normal workflow.

## 58. Operator Security

Operators must use appropriate:

- authentication;
- MFA where supported;
- device security;
- credential storage;
- session controls.

Operational credentials must never be shared casually.

## 59. Security Logging

Security-relevant events should be observable:

- authentication failures;
- privileged actions;
- authorization denials;
- role changes;
- account deactivation;
- suspicious access patterns;
- secret rotation;
- production access.

## 60. Log Privacy

Logs must not contain:

- OTPs;
- access/refresh tokens;
- service-role credentials;
- passwords;
- private document contents;
- unnecessary financial details;
- unnecessary member PII.

## 61. Security Monitoring

Monitor for:

- authentication abuse;
- repeated authorization failures;
- unusual privileged operations;
- unexpected role changes;
- storage access anomalies;
- unusual export activity;
- repeated API abuse.

## 62. Rate Limiting

Apply rate limits to security-sensitive operations such as:

- OTP requests;
- OTP verification;
- login/session endpoints;
- sensitive searches;
- expensive reports;
- file upload;
- privileged commands.

Exact thresholds must be tuned from observed legitimate usage.

## 63. Abuse Prevention

The system should defend against:

- repeated OTP guessing;
- brute-force attempts;
- enumeration;
- automated form abuse;
- excessive file upload;
- API flooding;
- notification abuse.

## 64. Input Security

All external input is untrusted, including:

- form fields;
- URL parameters;
- headers;
- deep links;
- uploaded filenames;
- file metadata;
- mobile offline payloads;
- realtime-derived values.

## 65. Output Security

User-facing and exported output must be encoded/sanitized according to its destination.

Do not assume that data safe in a plain-text UI is safe in:

- HTML;
- CSV;
- PDF;
- notification;
- filename;
- log field.

## 66. CSV/Export Injection

If CSV or spreadsheet exports are introduced, protect against formula injection and unsafe cell interpretation.

Export values must be treated as untrusted content.

## 67. PDF Security

Generated reports should not unintentionally include:

- hidden sensitive metadata;
- internal identifiers;
- private information outside requested scope;
- debug details.

## 68. Error Security

Production errors must return safe application-level messages.

Never expose:

- SQL;
- stack traces;
- filesystem paths;
- internal hostnames;
- credentials;
- service topology.

## 69. Authorization Error Privacy

Authorization errors must be designed to minimize information leakage.

Where resource existence itself is sensitive, return a safe not-found result rather than confirming the object's existence.

## 70. Financial Role Security

Finance permissions must be explicitly defined.

Finance users should receive only the capabilities required for financial workflows.

Sensitive administration should remain separated according to the role matrix.

## 71. Auditor Security

Auditor access should remain primarily oversight/read-oriented according to the approved permission matrix.

Auditor access must not become an implicit write privilege.

## 72. President/Super Admin Security

The highest administrative role is still subject to:

- authentication;
- authorization;
- validation;
- audit;
- confirmation;
- safe operation boundaries.

Highest privilege does not justify unrestricted raw database access through the client.

## 73. Member Privacy

Members should only access their own private data and approved shared information.

Cross-member access must be denied server-side.

## 74. Referral Security

Referral tokens/identifiers must not grant broader authorization than intended.

Referral registration must validate:

- validity;
- expiry;
- usage state;
- intended scope.

## 75. Donation Obligation Security

Donation obligations must be protected from unauthorized modification.

Effective-month history is authoritative financial/business history and should not be silently overwritten.

## 76. Payment Verification Security

Payment verification must require appropriate Finance authorization and current payment state.

Concurrent verification must be handled atomically.

## 77. Combined Payment Security

Combined payment commands must be atomic and idempotent.

A malicious or buggy client must not manipulate allocation boundaries to create unauthorized financial effects.

## 78. Correction and Reversal Security

Corrections/reversals are sensitive operations.

They require:

- authorization;
- current-state validation;
- reason/context where required;
- audit;
- idempotency;
- invariant verification.

## 79. Account and Transfer Security

Transfers must be atomic and authorized.

The client must never be allowed to directly set account balances.

## 80. Expense Security

Expense creation must validate:

- role;
- amount;
- account;
- required metadata;
- duplicate operation;
- current account state.

Approval/separation rules must follow the business specification.

## 81. Attendance Security

Attendance data must be protected.

GPS data and attendance records should only be available to authorized workflows.

Offline attendance must be revalidated when synchronized.

## 82. GPS Security

Location input is untrusted.

The server should apply the approved location/accuracy/business rules.

A client cannot declare a location valid merely by sending coordinates.

## 83. Meeting Security

Meeting creation, modification, closure, and attendance windows must be authorized and auditable where required.

## 84. Task Security

Committee task access must be scoped to the appropriate committee/workflow.

Users must not modify tasks outside their authorization by changing identifiers in API requests.

## 85. Data Retention

Security and privacy require defined retention policies.

Do not retain sensitive information indefinitely merely because storage is inexpensive.

## 86. Secure Deletion

When data is approved for deletion, deletion must account for:

- primary database;
- related records;
- storage objects;
- caches;
- exports;
- logs where legally/operationally required.

Financial/audit history may have different retention rules.

## 87. Backup Security

Backups are highly sensitive.

Protect them with:

- encryption;
- restricted access;
- retention policy;
- monitoring;
- restore testing;
- secure disposal.

## 88. Recovery Security

Recovery environments must enforce access controls.

Restored production data must not become accessible to developers or testers merely because it was copied into a recovery environment.

## 89. Incident Response

Security incidents should follow a documented process:

1. detect;
2. classify;
3. contain;
4. preserve evidence;
5. investigate;
6. eradicate/root-cause;
7. recover;
8. validate;
9. communicate appropriately;
10. add regression controls.

## 90. Incident Severity

Security incidents should be classified by:

- confidentiality impact;
- integrity impact;
- availability impact;
- financial impact;
- affected population;
- exploitability;
- persistence.

Exact severity thresholds require operational approval.

## 91. Evidence Preservation

During an incident, preserve:

- relevant logs;
- audit records;
- correlation IDs;
- deployment version;
- configuration changes;
- affected operation IDs;
- security events.

Do not destroy evidence while attempting cleanup.

## 92. Containment

Containment may include:

- disabling compromised credentials;
- revoking sessions;
- restricting affected endpoints;
- disabling a vulnerable feature;
- freezing selected financial operations.

Containment actions must be documented and reversible where safe.

## 93. Security Recovery

Recovery must verify:

- access controls;
- sessions;
- roles;
- RLS;
- storage policies;
- financial integrity;
- audit;
- observability.

Service availability alone does not mean security recovery is complete.

## 94. Vulnerability Management

Security vulnerabilities should be tracked by:

- affected component;
- severity;
- exploitability;
- affected environments;
- remediation owner;
- target date;
- verification status.

## 95. Dependency Vulnerability Process

When a dependency vulnerability is identified:

1. determine whether the vulnerable path is actually used;
2. assess exploitability;
3. upgrade/patch or mitigate;
4. test compatibility;
5. deploy;
6. verify remediation.

## 96. Framework Security Updates

Security updates to Next.js, React, Expo, React Native, Supabase-related libraries, and other critical components must be evaluated deliberately.

Do not blindly perform major upgrades during a security incident unless compatibility is understood.

## 97. Secret Exposure Response

If a secret appears in Git, logs, screenshots, or a client bundle:

- assume compromise;
- rotate/revoke it;
- remove it from active source/history as appropriate;
- inspect access;
- redeploy;
- document the incident.

Removing the visible text alone is not sufficient if the credential remains valid.

## 98. Security Testing

Security testing should include:

- authentication;
- authorization;
- RLS;
- object access;
- storage;
- deep links;
- API manipulation;
- input injection;
- rate limiting;
- session handling;
- offline replay;
- financial mutation tampering.

## 99. Penetration Testing

Before mature production rollout, the project should consider an authorized security assessment covering:

- web;
- mobile;
- API;
- RLS;
- storage;
- authentication;
- privileged workflows.

Testing must be authorized and performed against appropriate environments.

## 100. Security Release Gate

Security-sensitive releases must not ship until:

- authentication tests pass;
- RLS tests pass;
- role/permission tests pass;
- storage access tests pass;
- secret scan passes;
- dependency review passes;
- financial authorization tests pass;
- critical vulnerabilities are resolved or explicitly accepted.

## 101. Security Documentation

Security-relevant changes must update the appropriate documentation:

- authentication architecture;
- RLS security model;
- role permission matrix;
- storage architecture;
- financial integrity;
- error handling;
- observability;
- deployment;
- backup/recovery.

## 102. Security Ownership

Security responsibilities must have named operational ownership for:

- application security;
- database/RLS;
- production access;
- secrets;
- incident response;
- dependency updates;
- backups;
- financial integrity.

## 103. Security Runbooks

Runbooks should exist for:

- compromised session;
- compromised secret;
- unauthorized role change;
- RLS regression;
- storage exposure;
- suspicious financial activity;
- database compromise;
- dependency vulnerability;
- production credential compromise.

## 104. Security and AI Development

AI tools may assist with implementation and review but must not be treated as security authorities.

AI-generated security code must be verified against:

- repository specifications;
- current provider documentation;
- automated tests;
- negative authorization tests;
- threat-model assumptions.

No AI-generated code is considered secure merely because it compiles.

## 105. Security and Multi-AI Workflow

ChatGPT, Cursor, Claude, Gemini, Codex, and other tools may be used interchangeably.

The repository documentation, tests, Git history, and approved architecture remain authoritative.

Only one implementation owner should modify a given security-sensitive area at a time; other tools may review and challenge the implementation.

## 106. Security Change Control

Changes to authentication, roles, RLS, storage policies, trusted operations, financial permissions, secrets, or production access require focused review.

The smallest safe change should be preferred.

## 107. Security Monitoring

Security monitoring should feed the observability system while preserving privacy.

Important signals include:

- repeated failed authentication;
- repeated authorization denial;
- unexpected privileged operations;
- role changes;
- account deactivation;
- unusual export activity;
- storage access denials;
- rate-limit spikes.

## 108. Security Metrics

Useful bounded metrics include:

- authentication failure rate;
- authorization denial rate;
- privileged operation count;
- security-sensitive error count;
- secret rotation events;
- dependency vulnerability count;
- storage authorization failure rate;
- suspicious rate-limit events.

## 109. Security Alerting

Alerts should be actionable and routed to an identified owner.

Do not alert on every ordinary member mistake.

Prioritize patterns indicating compromise, systemic authorization failure, or high-impact integrity risk.

## 110. Security Review Questions

Before release ask:

1. Can an unauthenticated user access protected data?
2. Can a Member access another member's private data?
3. Can a non-Finance user verify a payment?
4. Can a client call a trusted operation without server-side authorization?
5. Can stale permissions grant access?
6. Can an offline operation bypass current authorization?
7. Can a deep link bypass access checks?
8. Can a storage path bypass authorization?
9. Can an attacker manipulate financial amounts or allocations?
10. Can a duplicate command create a duplicate financial effect?
11. Can errors reveal private data?
12. Are secrets absent from clients and logs?
13. Can backups be accessed by unauthorized users?
14. Can production credentials be used from CI pull requests?
15. Can an operator access more production data than required?
16. Are security events observable?
17. Are critical incidents recoverable?
18. Are negative security tests automated?
19. Has the latest security-sensitive change been reviewed?
20. Is the documented architecture still consistent with implementation?

## 111. Open Decisions

Finalize:

1. production security owner;
2. incident severity matrix;
3. exact operator access model;
4. break-glass procedure;
5. MFA requirements for operators;
6. vulnerability disclosure/response process;
7. dependency scanning provider;
8. secret-scanning provider;
9. security monitoring/alerting provider;
10. penetration-testing schedule;
11. retention periods for security logs;
12. backup access model;
13. production support-access model;
14. exact rate limits;
15. exact export controls;
16. security incident communication procedure.

## 112. Definition of Done

Security operations are ready when authentication, authorization, RLS, storage, financial controls, sessions, secrets, environments, monitoring, incident response, backups, recovery, dependency security, and operational access all have documented controls and automated verification where practical.

**Final rule:** security is enforced at the authoritative boundary, observed continuously, tested negatively, and recovered deliberately.

## 113. Security Control Matrix

| Control | Primary boundary | Verification |
|---|---|---|
| Authentication | Supabase Auth/session layer | Auth tests |
| Authorization | Server/domain/RLS | Positive + negative role tests |
| Member privacy | RLS/domain scope | Cross-member tests |
| Financial integrity | Transaction/trusted operation | Invariant/concurrency tests |
| Storage privacy | Storage policies + authorization | Object-access tests |
| Offline security | Replay authorization | Queue/conflict tests |
| Realtime security | Subscription authorization | Subscription tests |
| Secret protection | Secret manager/build boundary | Secret scans |
| CI security | CI permissions | Workflow review |
| Backup security | Backup access | Access review + restore test |
| Incident response | Operations | Drill/runbook test |
| Dependency security | Supply chain | Vulnerability scanning |

## 114. Security Release Checklist

- [ ] Authentication behavior verified.
- [ ] Session expiry and refresh verified.
- [ ] Role/permission matrix verified.
- [ ] RLS enabled and tested on protected tables.
- [ ] Trusted operations validate caller authorization.
- [ ] Cross-member access denied.
- [ ] Finance mutations protected.
- [ ] Financial idempotency verified.
- [ ] Storage paths do not act as authorization.
- [ ] Private objects remain private.
- [ ] Deep links revalidate authorization.
- [ ] Offline replay revalidates current authorization.
- [ ] Realtime subscriptions respect authorization.
- [ ] Secrets absent from repository and client bundles.
- [ ] Secrets absent from logs.
- [ ] Dependency vulnerabilities reviewed.
- [ ] CI production-secret exposure reviewed.
- [ ] Backup access restricted.
- [ ] Security monitoring configured.
- [ ] Critical negative-path tests pass.

## 115. Incident Record Template

```text
Incident ID:
Detected at:
Environment:
Severity:
Security owner:
Affected system:
Affected roles/users:
Confidentiality impact:
Integrity impact:
Availability impact:
Financial impact:
Initial containment:
Evidence preserved:
Credentials/sessions rotated:
Affected releases:
Root cause:
Recovery:
Validation:
User communication:
Regression tests:
Preventive controls:
Closed at:
```
