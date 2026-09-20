# Masjid-e-Mamoor 2 — Monitoring

**Document Status:** V1 Monitoring Baseline  
**Version:** 1.0  
**Product:** Masjid-e-Mamoor 2 Internal Management Application  
**Scope:** V1  
**Platforms:** Web, Android, iOS  
**Related Documents:** TECHNOLOGY_STACK.md, DEPLOYMENT.md, BACKUP_AND_RECOVERY.md, STORAGE_STRATEGY.md, SECURITY_REQUIREMENTS.md, SECURITY_CHECKLIST.md, TESTING_STRATEGY.md  
**Last Updated:** 2026-09-17

---

# 1. Purpose

This document defines the V1 monitoring and observability strategy for Masjid-e-Mamoor 2.

The goal is to detect:

```text
Application failures
Backend failures
Database problems
Authentication problems
Financial integrity issues
Storage failures
Notification failures
Security anomalies
Performance degradation
Deployment problems
```

Monitoring should remain practical and low-cost.

V1 does not require a large enterprise observability stack unless actual scale or risk later justifies it.

---

# 2. Monitoring Principles

1. Monitor the systems that can affect users or data.
2. Prioritize financial integrity and security.
3. Avoid collecting unnecessary personal data in logs.
4. Use logs for diagnosis, not as a second database.
5. Alerts must be actionable.
6. Do not create alert noise for harmless events.
7. Business truth must remain in authoritative data, not notification delivery.
8. Monitoring should support recovery and incident investigation.
9. Sensitive logs must remain protected.
10. Start simple and expand only when justified.

---

# 3. Monitoring Layers

V1 monitoring covers:

```text
Web Application
Backend/Edge Functions
Database
Authentication
Storage
Notifications
Payments/Financial Processing
Attendance
Mobile Applications
Deployment/CI
Security
Backup/Recovery
```

---

# 4. Monitoring Levels

## Level 1 — Health

Is the service available?

## Level 2 — Errors

Are requests/functions failing?

## Level 3 — Business Integrity

Are important records behaving correctly?

## Level 4 — Security

Are unauthorized/suspicious actions occurring?

## Level 5 — Capacity/Performance

Are services approaching operational limits?

---

# 5. Web Monitoring

Monitor:

```text
Application availability
Server/rendering errors
Client runtime errors
API failures
Authentication failures
Navigation/deep-link failures
```

Important user-facing areas:

```text
Login
Dashboard
Finance
Payments
Tasks
Meetings
Attendance
Reports
```

---

# 6. Web Error Monitoring

Track:

```text
Unhandled exceptions
Failed API requests
Unexpected HTTP errors
Failed route loads
Report-generation failures
File upload failures
```

Where practical capture:

```text
Request ID
Build/version
Route
Error category
Timestamp
```

Do not include unnecessary personal/financial data.

---

# 7. Backend Monitoring

Monitor Edge Functions/trusted backend operations for:

```text
Invocation count
Error count
Execution duration
Timeouts
Rejected authorization
Validation failures
External provider failures
```

Priority functions include:

```text
Payment verification
Financial posting
Transfers
Expense payment
Notifications
SMS/WhatsApp adapter
Attendance synchronization
Other privileged operations
```

---

# 8. Backend Error Severity

### Critical

```text
Financial posting corruption
Privilege escalation
Mass authorization failure
Service-wide backend failure
```

### High

```text
Payment verification failures
Transfer failures
Expense payment failures
Major notification failures
Repeated authentication failures
```

### Medium

```text
Limited feature errors
Individual report failures
Non-critical integration failures
```

### Low

```text
Minor non-blocking errors
```

---

# 9. Database Monitoring

Monitor:

```text
Database availability
Connection/connection-pool issues
Query errors
Slow queries
Storage usage
Migration errors
Constraint violations
RLS/policy errors where observable
```

Important database concerns:

```text
Financial transaction consistency
Duplicate prevention
Lock/contention
Long-running queries
```

---

# 10. Database Capacity Monitoring

Track:

```text
Database size
Growth rate
Index growth
Large tables
Query latency
Connection utilization where available
```

The purpose is early detection of limits, not aggressive deletion of historical data.

---

# 11. Database Error Monitoring

Watch for repeated:

```text
Unique constraint violations
Foreign-key failures
Check-constraint failures
Transaction conflicts
Timeouts
Deadlocks/contention
```

A sudden increase can indicate:

```text
Client bug
Backend bug
Migration issue
Concurrency defect
Malicious input
```

---

# 12. Financial Integrity Monitoring

Financial integrity receives the highest business priority.

Monitor for anomalies such as:

```text
Unexpected balance mismatch
Duplicate financial posting
Transfer imbalance
Payment verification duplication
Expense payment total > expense amount
Unexpected negative balance spikes
```

Monitoring should detect anomalies without silently modifying data.

---

# 13. Financial Reconciliation Monitoring

Where practical, periodically verify:

```text
Account balances
+
Recorded credits/debits
=
Expected calculated state
```

For internal transfers:

```text
Source change + destination change
=
Net zero across overall Masjid funds
```

Any mismatch should trigger investigation.

---

# 14. Donation Monitoring

Monitor for:

```text
Payment requests created
Payments verified
Verification failures
Duplicate verification attempts
Outstanding contribution growth
Unexpected allocation errors
```

Do not treat:

```text
Payment link opened
```

as proof of received money.

---

# 15. Payment Verification Monitoring

Track:

```text
Verification count
Rejection count
Verification failures
Duplicate attempts
External reference mismatches
Processing duration
```

A verified payment should correspond to a valid authoritative financial outcome.

---

# 16. UPI Monitoring

Monitor:

```text
UPI configuration changes
Payment-link generation failures
Unexpected handoff failures
Provider/integration errors where available
```

All UPI configuration changes should be auditable.

---

# 17. Expense Monitoring

Monitor:

```text
Expense creation
Payment failures
Payment proof failures
Partially paid expenses
Long-standing unpaid expenses
Amount-correction events
Cancellation events
```

Potential anomaly:

```text
Payment total > expense amount
```

must be detected/prevented by business logic and investigated if ever observed.

---

# 18. Transfer Monitoring

Monitor:

```text
Transfer creation
Transfer failures
Duplicate transfer attempts
Transfer relationship integrity
```

Potential anomaly:

```text
Source decreases by X
Destination increases by Y
X ≠ Y
```

should be impossible in an atomic transfer and must trigger investigation if observed.

---

# 19. Account Monitoring

Monitor:

```text
Account creation
Account deactivation
Balance changes
Unexpected negative balance
Repeated balance-related errors
```

Do not alert simply because a negative balance exists; alert based on agreed business thresholds or unusual change where appropriate.

---

# 20. Membership Monitoring

Monitor for:

```text
Duplicate mobile prevention events
Member creation failures
Referral attribution failures
Contribution update failures
```

A rise in duplicate attempts may indicate:

```text
UX confusion
Import/data issue
Repeated retries
Abuse
```

---

# 21. Contribution Monitoring

Monitor:

```text
Monthly record generation
Contribution amount changes
Effective-month changes
Outstanding record creation
Allocation failures
```

A failed monthly-generation process is operationally important because it affects donation tracking.

---

# 22. Committee Work Monitoring

Monitor:

```text
Task creation failures
Claim conflicts
Completion failures
Overdue task counts
Notification failures
```

The system should display factual overdue work rather than creating performance scores.

---

# 23. Task Claim Monitoring

Track:

```text
Successful claims
Rejected competing claims
Concurrency conflicts
Unexpected duplicate ownership
```

Expected invariant:

```text
One open task
→ at most one successful claimant
```

---

# 24. Meeting Monitoring

Monitor:

```text
Meeting creation failures
Attendance-recording failures
Decision-save failures
Follow-up task creation failures
```

Do not treat a meeting's operational status as a financial event.

---

# 25. Attendance Monitoring

V1 attendance:

```text
Jummah
Scheduled committee meetings
```

Monitor:

```text
Attendance submission count
Duplicate attempts
Location-validation failures
Poor-accuracy failures
Offline synchronization failures
Meeting attendance failures
```

---

# 26. GPS Monitoring

Track aggregate technical signals such as:

```text
Location permission denied
Location unavailable
Poor accuracy rejection
Outside-radius rejection
Sync failure
```

Do not create continuous member location monitoring.

Avoid retaining unnecessary raw coordinates in logs.

---

# 27. Offline Attendance Monitoring

Track:

```text
Pending sync count
Sync success count
Sync rejection count
Repeated sync failures
Oldest pending record age
```

A growing number of old pending attendance records may indicate:

```text
API outage
Device connectivity problem
Sync bug
```

---

# 28. Notification Monitoring

Monitor:

```text
Push attempts
Push failures
Delivery failure where provider reports it
Deep-link failures
SMS failures
WhatsApp failures
```

Do not store a permanent notification inbox in V1 solely for monitoring.

---

# 29. Notification Business Integrity

A notification failure must not cause business data changes.

Example:

```text
Push failed
≠
Task deleted
```

and:

```text
SMS failed
≠
Donation cancelled
```

Monitoring should preserve this separation.

---

# 30. File Storage Monitoring

Monitor:

```text
Upload failures
Download/access failures
Storage usage
Storage growth rate
Large files
Orphaned objects
Temporary object accumulation
```

---

# 31. File Security Monitoring

Watch for unusual:

```text
Repeated unauthorized file requests
Unexpected access-denied spikes
Suspicious object access patterns
```

Do not log private document contents.

---

# 32. PDF/Report Monitoring

Monitor:

```text
Report-generation failures
PDF rendering failures
Large report timeouts
Failed downloads
```

Where practical record:

```text
Report type
Build/version
Date/time
Result
Duration
```

Avoid logging full report contents.

---

# 33. Authentication Monitoring

Monitor:

```text
OTP requests
OTP failures
OTP rate-limit triggers
Repeated login failures
Session failures
Disabled-account access attempts
```

Possible security indicators:

```text
Large spike in OTP requests
Repeated failures from same source
Unusual authentication volume
```

Do not log OTP values.

---

# 34. Authorization Monitoring

Monitor security-relevant denied actions such as:

```text
Privilege escalation attempts
Unauthorized financial mutation
Unauthorized file access
Unauthorized role change
Unauthorized audit access
```

Record safe metadata:

```text
Timestamp
Actor if authenticated
Action
Resource category
Result
Request ID where useful
```

Do not log unnecessary sensitive content.

---

# 35. Security Event Categories

Recommended categories:

```text
AUTH_FAILURE
RATE_LIMIT
AUTHZ_DENIED
PRIVILEGE_CHANGE
FINANCIAL_SECURITY
FILE_ACCESS_DENIED
CONFIGURATION_CHANGE
SECURITY_ERROR
```

Exact implementation names may vary.

---

# 36. Audit vs Monitoring

These are different:

### Audit

Business/administrative history:

```text
Who changed what and when?
```

### Monitoring

Operational health:

```text
Is the system working correctly?
```

Do not use monitoring logs as a substitute for required business audit records.

---

# 37. Audit Monitoring

Monitor that critical audit events are being generated for:

```text
Financial correction
Financial deletion
Payment verification
Contribution changes
Referral correction
UPI change
Role change
Administrative changes
```

A sudden absence of expected audit events may indicate a defect.

---

# 38. Deployment Monitoring

After deployment watch:

```text
Error rate
API failures
Authentication
Database errors
Storage errors
Financial workflows
```

Compare against the pre-release baseline where practical.

---

# 39. Deployment Health Window

After a significant release:

```text
Deploy
→ smoke test
→ monitor closely
→ validate finance/security
→ continue normal monitoring
```

The exact observation period may depend on release risk and usage.

---

# 40. CI/CD Monitoring

Monitor:

```text
Build failures
Test failures
Deployment failures
Migration failures
Environment configuration failures
```

A failed build should prevent deployment.

---

# 41. Backup Monitoring

Monitor:

```text
Backup/export success
Backup/export failure
Age of latest successful backup/export
Storage availability
Recovery-test status
```

A stale or missing recovery copy should be treated as an operational issue.

---

# 42. Backup Recovery Drill Monitoring

Record:

```text
Recovery test date
Source backup
Restore result
Database validation
Financial validation
File validation
Authorization validation
Issues found
```

---

# 43. Storage Monitoring Thresholds

Exact thresholds should be set from actual production usage.

Recommended categories:

```text
Normal
Warning
Critical
```

Monitor:

```text
Database capacity
File storage capacity
Egress/transfer usage where applicable
```

Do not wait until capacity is exhausted.

---

# 44. Performance Monitoring

Track representative:

```text
Dashboard load
Member search
Transaction list
Expense list
Task list
Meeting list
Report generation
```

Measure:

```text
Latency
Error rate
Timeouts
```

---

# 45. Slow Operation Monitoring

Investigate operations that repeatedly become slow.

Potential causes:

```text
Missing index
Large query
Inefficient API
Large file
Database contention
External provider latency
```

---

# 46. External Service Monitoring

External dependencies may include:

```text
Supabase
Expo Push/FCM/APNs
SMS/WhatsApp provider
UPI/payment ecosystem
Vercel
```

Monitor:

```text
Availability
Error responses
Timeouts
Rate limits
Configuration failures
```

---

# 47. External Service Failure Policy

External service failure must fail safely.

Examples:

```text
SMS unavailable
→ donation state unchanged

Push unavailable
→ task state unchanged

Storage unavailable
→ file upload not falsely marked successful

UPI integration unavailable
→ payment request not falsely marked verified
```

---

# 48. Log Levels

Recommended:

### ERROR

Operation failed and needs attention.

### WARN

Potential problem but system remains functional.

### INFO

Important operational state.

### DEBUG

Development/troubleshooting only; disabled or restricted in production.

---

# 49. Production Logging Rules

Production logs must not contain:

```text
OTP values
Authentication tokens
Service-role keys
Database passwords
Private document contents
Unnecessary raw GPS coordinates
Unnecessary full financial payloads
```

---

# 50. Request Correlation

Use a request/correlation identifier where practical.

This helps connect:

```text
Frontend error
→ API request
→ Edge Function
→ Database operation
```

without copying sensitive data into every log line.

---

# 51. Error Context

Useful safe context:

```text
Request ID
Build/version
Environment
Route/function
Error type
Timestamp
```

Avoid unnecessary personal data.

---

# 52. Alerting Principles

Create alerts only when:

```text
Someone can investigate
+
there is meaningful operational impact
```

Avoid alerts for every normal user mistake.

---

# 53. P0 Alerts

Examples:

```text
Production database unavailable
Critical financial integrity failure
RLS/security failure
Service-wide authentication outage
Production deployment failure affecting core application
```

---

# 54. P1 Alerts

Examples:

```text
Payment verification failure spike
High backend error rate
Storage outage
Large notification failure spike
Repeated transfer failures
Backup failure
```

---

# 55. P2 Alerts

Examples:

```text
Rising report failures
High overdue-sync count
Performance degradation
Growing temporary storage
```

---

# 56. Alert Routing

V1 can use simple routing:

```text
Critical → responsible technical operator + administrator where appropriate
Finance-critical → Finance + technical operator
Security-critical → responsible administrator + technical operator
```

Avoid broad notifications to all committee members for technical alerts.

---

# 57. Alert Payload Privacy

Alerts should include:

```text
Problem
Severity
Timestamp
System/component
Action link/reference
```

Do not include unnecessary:

```text
Member details
Payment details
Raw GPS
Private document contents
Secrets
```

---

# 58. Health Checks

Where practical expose safe health checks for:

```text
Web
Backend
Database connectivity
Required configuration
```

Health checks should not expose secrets or sensitive data.

---

# 59. Business Health Checks

In addition to infrastructure health, monitor business invariants.

Examples:

```text
No transfer imbalance
No expense overpayment
No duplicate verified payment
No duplicate member mobile
No multiple open-task claimants
No duplicate Friday attendance
```

---

# 60. Automated Integrity Checks

Periodic checks can detect:

```text
Orphaned payment records
Broken financial relationships
Invalid account references
Missing required file references
Unexpected duplicate identities
Invalid task ownership
```

The check should report problems rather than silently repair critical data.

---

# 61. Financial Anomaly Review

Potential anomalies:

```text
Sudden unusual transaction volume
Unexpectedly large transaction
Repeated corrections
Repeated deletions
Multiple failed verifications
Unexpected balance change
```

V1 should not create complex financial fraud scoring.

Use simple factual anomaly signals.

---

# 62. Administrative Anomaly Review

Watch for:

```text
Unexpected role changes
Unexpected UPI changes
Repeated unauthorized access
Repeated financial corrections
Repeated financial deletions
```

All such activity should remain auditable.

---

# 63. Data Integrity Dashboard

A technical/admin-only monitoring view may display:

```text
Database health
Storage usage
Backup age
Error rate
Financial integrity status
Failed jobs
Notification failures
Pending attendance sync
```

This is an operational health screen, not a member-facing dashboard.

---

# 64. No Public Monitoring

Monitoring information must never be exposed publicly.

Do not expose:

```text
Error rate
Database status
Service configuration
Security events
Backup state
Internal logs
```

to ordinary application users.

---

# 65. Monitoring Data Retention

Retain logs long enough for:

```text
Troubleshooting
Security investigation
Incident review
Operational analysis
```

Avoid indefinite retention of sensitive logs without purpose.

---

# 66. Monitoring Storage Minimization

Use:

```text
Structured logs
Sampling for high-volume low-risk events where practical
Retention/rotation
```

Do not duplicate entire database records inside logs.

---

# 67. Monitoring and Privacy

Monitoring must follow the same privacy principles as application data.

Avoid collecting:

```text
Continuous location
Full document contents
Authentication secrets
Unnecessary member metadata
```

---

# 68. Monitoring and Security

Monitoring systems themselves need access control.

Only authorized operators should access:

```text
Production logs
Security events
Database diagnostics
Operational dashboards
```

---

# 69. Mobile Monitoring

Monitor where platform tooling allows:

```text
App crashes
Build/version
Critical API failures
Push token registration problems
GPS attendance failures
Offline synchronization issues
```

Do not collect unnecessary personal/device telemetry.

---

# 70. Mobile Crash Reporting

If a crash-reporting provider is introduced:

```text
Review data collected
Disable unnecessary sensitive metadata
Protect access
Document provider
```

V1 can begin with platform/application logs and expand later if needed.

---

# 71. Web Monitoring with Low Cost

Initial V1 approach may rely on:

```text
Platform logs
Server logs
CI logs
Database/platform logs
Simple health checks
```

Add a dedicated observability platform only if actual usage justifies it.

---

# 72. Monitoring Runbook

When an alert fires:

```text
1. Identify component.
2. Check recent deployment.
3. Check error logs.
4. Check database/service health.
5. Check affected workflow.
6. Assess whether data integrity is affected.
7. Contain if necessary.
8. Recover.
9. Validate.
10. Document.
```

---

# 73. Financial Incident Runbook

For financial anomaly:

```text
Detect
→ stop unsafe operation if needed
→ identify affected records
→ preserve evidence
→ inspect audit trail
→ validate account balances
→ correct through controlled workflow
→ re-run integrity checks
```

Do not silently edit financial data.

---

# 74. Security Incident Runbook

For security anomaly:

```text
Detect
→ contain
→ identify affected access
→ preserve logs
→ revoke/rotate credentials if necessary
→ assess data impact
→ fix
→ re-test
→ document
```

---

# 75. Backup Incident Runbook

If backup monitoring reports failure:

```text
Confirm failed backup
→ identify last successful recovery point
→ repair backup process
→ create/verify new recovery point
→ document
```

---

# 76. Storage Incident Runbook

If storage approaches capacity:

```text
Measure
→ identify growth source
→ remove safe temporary/orphaned data
→ optimize files where safe
→ review backup/report accumulation
→ upgrade if necessary
```

Never delete required financial/work history as a first response.

---

# 77. Monitoring During Major Releases

During high-risk releases watch closely:

```text
Authentication
Financial writes
Payment verification
Database errors
RLS failures
Storage
Reports
Mobile/API compatibility
```

---

# 78. Monitoring After Schema Migration

Immediately verify:

```text
Database health
Application health
RLS
Core queries
Financial balances
Payment workflow
Reports
Audit
```

---

# 79. Monitoring After Finance Changes

Verify:

```text
Account balances
Donation posting
Expense posting
Transfers
Reports
Audit
```

Use synthetic/staging validation before production where possible.

---

# 80. Monitoring After Authentication Changes

Verify:

```text
OTP
Session creation
Logout
Session expiry
Disabled users
Role loading
```

---

# 81. Monitoring After Storage Changes

Verify:

```text
Upload
Download
Authorization
Private access
File references
Cleanup
```

---

# 82. Monitoring After Notification Changes

Verify:

```text
Recipient
Deep link
Message content
Provider response
Business-state independence
```

---

# 83. Monitoring After Attendance Changes

Verify:

```text
GPS validation
Radius
Accuracy
Duplicate prevention
Offline sync
Meeting attendance
```

---

# 84. Monitoring Metrics Catalogue

Recommended baseline metrics:

```text
app_requests_total
app_errors_total
api_latency
auth_requests
auth_failures
auth_rate_limit_events
authz_denied_events
db_errors
db_latency
db_size
storage_size
storage_upload_failures
payment_verifications
payment_verification_failures
financial_mutation_failures
transfer_failures
expense_payment_failures
task_claim_conflicts
attendance_sync_failures
push_failures
sms_failures
whatsapp_failures
report_generation_failures
backup_failures
```

Exact metric naming is implementation-specific.

---

# 85. Metric Cardinality

Do not create metrics with high-cardinality sensitive labels such as:

```text
Full mobile number
Member name
Full transaction ID for every metric
Raw GPS coordinates
```

Use aggregate metrics and safe dimensions such as:

```text
feature
result
error category
environment
version
```

---

# 86. Dashboard Recommendations

V1 should have a small number of practical dashboards.

### Operations

```text
Availability
Errors
Latency
Deployments
Storage
Backups
```

### Finance/Integrity

```text
Financial integrity checks
Payment verification health
Transaction errors
Transfer health
Expense payment issues
```

### Security

```text
Auth failures
Rate limits
Authorization denials
Security events
```

No public dashboard is required.

---

# 87. Monitoring Acceptance Criteria

V1 monitoring is acceptable when:

- [ ] Web failures can be detected.
- [ ] Backend failures can be detected.
- [ ] Database health can be observed.
- [ ] Authentication failures can be observed.
- [ ] Authorization/security events can be observed.
- [ ] Financial integrity anomalies can be detected.
- [ ] Payment verification failures can be detected.
- [ ] Transfer integrity can be monitored.
- [ ] Expense payment issues can be monitored.
- [ ] Storage usage can be monitored.
- [ ] File failures can be detected.
- [ ] Notifications can be monitored.
- [ ] Attendance sync failures can be monitored.
- [ ] Backup status can be monitored.
- [ ] Deployment failures can be detected.
- [ ] Logs avoid secrets and unnecessary sensitive data.
- [ ] Alerts are actionable.
- [ ] Recovery/incident runbooks exist.
- [ ] Monitoring does not create continuous location tracking.
- [ ] Monitoring does not become a duplicate database.

---

# 88. Monitoring Invariants

### Invariant 1

Monitoring must not modify authoritative business data.

### Invariant 2

Monitoring must not replace audit logging.

### Invariant 3

Monitoring must not expose secrets.

### Invariant 4

Monitoring must not create continuous member location tracking.

### Invariant 5

Financial anomalies must be investigated, not silently corrected.

### Invariant 6

A notification failure does not mean business failure.

### Invariant 7

A payment-link event does not mean payment verification.

### Invariant 8

A transfer must remain balanced across accounts.

### Invariant 9

A verified payment must not be duplicated.

### Invariant 10

An open task must not have multiple successful claimants.

### Invariant 11

Offline attendance must remain server-authoritative.

### Invariant 12

Monitoring data must respect privacy and access controls.

### Invariant 13

Storage monitoring must not trigger deletion of required history.

### Invariant 14

Backup monitoring must identify stale/missing recovery coverage.

### Invariant 15

Production logs must not contain OTPs, authentication tokens, or service credentials.

---

# 89. Final Monitoring Workflow

```text
Event
 ↓
Capture Safe Signal
 ↓
Classify
 ↓
Monitor Metric/Log
 ↓
Alert if Actionable
 ↓
Investigate
 ↓
Contain if Required
 ↓
Validate Business/Data Integrity
 ↓
Recover
 ↓
Document
```

---

# 90. Related Documents

- `TECHNOLOGY_STACK.md`
- `FRONTEND_FRAMEWORK.md`
- `BACKEND_FRAMEWORK.md`
- `DATABASE_ARCHITECTURE.md`
- `DATABASE_SCHEMA.md`
- `SECURITY_ARCHITECTURE.md`
- `SECURITY_REQUIREMENTS.md`
- `SECURITY_CHECKLIST.md`
- `AUTHORIZATION_MODEL.md`
- `DATA_PRIVACY.md`
- `BACKUP_AND_RECOVERY.md`
- `STORAGE_STRATEGY.md`
- `DEPLOYMENT.md`
- `TESTING_STRATEGY.md`
- `TEST_PLAN.md`
- `ACCEPTANCE_CRITERIA.md`
- `FINANCE_SYSTEM.md`
- `PAYMENT_SYSTEM.md`
- `DONATION_SYSTEM.md`
- `EXPENSE_SYSTEM.md`
- `ATTENDANCE_SYSTEM.md`
- `NOTIFICATION_SYSTEM.md`
- `REPORTING_AND_AUDIT.md`

---

## Document Status

**Monitoring — V1 Monitoring Baseline**

This document defines the practical V1 monitoring, logging, alerting, integrity-check, and incident-observation approach for Masjid-e-Mamoor 2 without introducing unnecessary operational infrastructure.
