# Masjid-e-Mamoor 2 — Backup and Recovery

**Document Status:** V1 Backup & Recovery Baseline  
**Version:** 1.0  
**Product:** Masjid-e-Mamoor 2 Internal Management Application  
**Scope:** V1  
**Platforms:** Web, Android, iOS  
**Related Documents:** TECHNOLOGY_STACK.md, DATABASE_ARCHITECTURE.md, DATABASE_SCHEMA.md, SECURITY_REQUIREMENTS.md, DATA_PRIVACY.md, STORAGE_STRATEGY.md, MONITORING.md  
**Last Updated:** 2026-09-17

---

# 1. Purpose

This document defines how Masjid-e-Mamoor 2 protects against:

```text
Data loss
Database corruption
Accidental deletion
Failed migrations
Storage problems
Application deployment failures
Service outages
Credential loss
Operational mistakes
```

The primary recovery objective is to preserve:

```text
Financial history
Member records
Donation/payment history
Committee work history
Meeting history
Attendance history
Audit records
Required supporting documents
```

---

# 2. Recovery Principles

1. Financial data has the highest recovery priority.
2. Historical committee accountability data must not be sacrificed for storage savings.
3. Backups must be protected from unauthorized access.
4. Production should not depend on a single manually maintained copy.
5. Restore procedures must be documented before an incident occurs.
6. Backup availability does not guarantee recoverability; restore testing is required.
7. Backup scope must include both database data and required private files.
8. Credentials and configuration necessary for recovery must be securely documented.
9. Recovery must preserve data relationships and authorization boundaries.
10. Free-tier limitations must be treated as operational risk, not ignored.

---

# 3. Critical Data Classification

## Tier 1 — Critical

```text
Financial transactions
Account balances/source records
Donation/payment records
Expense/payment records
Transfers
Audit records
Member identity records
Contribution history
```

## Tier 2 — Operationally Important

```text
Committee tasks/work history
Meeting records
Meeting attendance
Jummah attendance
Notification-related business state
```

## Tier 3 — Re-creatable

```text
UI cache
Temporary files
Temporary generated PDFs
Non-authoritative client state
```

Tier 1 data must receive the strongest recovery attention.

---

# 4. What Must Be Recoverable

A valid recovery process must be able to restore or reconstruct, as applicable:

```text
Users and roles
Members
Referral relationships
Contribution history
Donation records
Payment verification records
Financial accounts
Financial transactions
Expense records
Expense payments
Transfers
Committee tasks
Meeting records
Meeting decisions
Meeting follow-ups
Attendance records
Audit logs
Required private financial documents
Required task attachments
Relevant configuration
```

---

# 5. What Does Not Need Permanent Backup

The following do not require permanent archival backup merely for convenience:

```text
UI caches
Expired temporary upload state
Temporary generated PDFs
Non-authoritative local client state
Transient notification payloads
```

Temporary data may still need short-term recovery during an active operation.

---

# 6. Database Recovery Scope

The primary database is PostgreSQL through Supabase.

Backup/recovery must cover:

```text
Tables
Relationships
Constraints
Indexes
RLS policies/configuration where applicable
Database functions/triggers where applicable
Migration history
Critical configuration
```

A data-only export without schema/configuration is not a complete recovery plan.

---

# 7. File Recovery Scope

Private files may include:

```text
Bills
Invoices
Payment proofs
Task attachments where applicable
```

Recovery planning must ensure that restored database records do not point to permanently missing required files.

---

# 8. Storage Strategy

V1 should minimize storage without weakening recovery.

Preferred principles:

```text
One authoritative file
+
Private storage
+
Database reference
+
No duplicate copies inside application storage
```

Do not intentionally duplicate every document across several storage locations unless required for recovery risk reduction.

---

# 9. Backup Layers

Recommended recovery layers:

### Layer 1

Managed platform/database recovery facilities available in the chosen deployment configuration.

### Layer 2

Periodic logical/export backup for critical database data where operationally feasible.

### Layer 3

Application source/configuration recovery through GitHub and controlled deployment configuration.

### Layer 4

Separate protected copy of critical required documents/data where justified.

The exact frequency and storage destination should be finalized based on production usage and platform capabilities.

---

# 10. V1 Free-Tier Constraint

The initial design is intended to minimize cost.

The project should prefer:

```text
Free/low-cost managed services
+
Minimal duplicate storage
+
Logical exports where feasible
```

However:

```text
Free tier ≠ full backup guarantee
```

Before production launch, the actual backup capabilities of the chosen Supabase plan must be verified against the required recovery objective.

---

# 11. Backup Responsibility

Recommended ownership:

```text
Technical Operator / Maintainer
→ verifies backup/recovery operation

President / Masjid Administrator
→ owns business continuity decision

Finance
→ validates financial integrity after financial recovery

Auditor
→ reviews recovered financial/audit records where appropriate
```

The exact people assigned to these responsibilities may be changed operationally.

---

# 12. Backup Frequency

V1 should use a risk-based approach.

Recommended minimum conceptual schedule:

```text
Database/provider recovery
→ use platform-supported continuous/automatic mechanisms where available

Critical logical export
→ periodic scheduled export

Configuration/source
→ version controlled continuously

Required private files
→ protected backup strategy according to file importance/storage limits
```

Exact frequencies should be finalized from actual production capability and data-change volume.

---

# 13. Financial Recovery Priority

If an incident requires partial recovery:

```text
Financial records
→ Member/donation records
→ Audit records
→ Committee work/meeting records
→ Attendance
→ Other operational data
```

Financial integrity must take priority over restoring convenience features.

---

# 14. Recovery Point Objective — RPO

RPO describes the acceptable amount of recent data that could be lost after a failure.

For V1:

```text
Critical financial data
→ target minimal recoverable loss

Other operational data
→ target reasonable periodic recoverability
```

The final numeric RPO should be documented after evaluating actual backup tooling and cost.

No unsupported “zero data loss” guarantee should be assumed.

---

# 15. Recovery Time Objective — RTO

RTO describes the target time to restore usable service.

V1 should prioritize:

```text
Database availability
+
Financial record access
+
Core application access
```

The exact numeric RTO should be finalized after deployment architecture and staffing are known.

---

# 16. Backup Security

Backups must be treated as sensitive data.

Requirements:

- [ ] Restrict backup access.
- [ ] Protect backup credentials.
- [ ] Do not expose backup URLs publicly.
- [ ] Do not store production backups in public GitHub repositories.
- [ ] Do not send full backups through ordinary messaging.
- [ ] Encrypt backups where supported/appropriate.
- [ ] Maintain access logs where available.
- [ ] Remove obsolete backup copies according to retention rules.

---

# 17. Backup Encryption

At minimum:

```text
Encryption in transit
+
Platform-supported encryption at rest
```

should be used.

Exported backups containing sensitive data should receive additional protection appropriate to the storage medium.

---

# 18. Database Export Security

Logical database exports may contain:

```text
Member data
Donation data
Financial data
Audit data
```

Therefore:

- [ ] Export only to protected storage.
- [ ] Do not keep unnecessary copies.
- [ ] Do not upload to public file hosting.
- [ ] Do not place raw exports in Git.
- [ ] Delete temporary exports after successful controlled transfer/validation where no longer needed.

---

# 19. File Backup Security

Financial documents can contain sensitive information.

Ensure:

```text
Private source storage
+
Protected recovery copy where required
+
Restricted access
```

Avoid creating public recovery links.

---

# 20. Backup Integrity Verification

A backup should not be considered valid merely because the export completed.

Where practical verify:

```text
File exists
Expected size/metadata
Archive/export can be opened
Database import can begin
Required tables exist
Critical records exist
Relationships remain valid
```

---

# 21. Restore Testing

Restore testing should be performed in an isolated environment.

Never test restoration by experimenting directly on production.

A restore test should verify:

```text
Database restores
Application reconnects
RLS remains correct
Financial totals remain correct
Private files resolve correctly
Reports work
Authentication works
```

---

# 22. Recovery Test Dataset

Maintain a synthetic recovery dataset containing:

```text
Members
Multiple contribution months
Verified donations
Pending donations
Overpayment
Anonymous donation
Jummah cash collection
Accounts
Expenses
Multiple expense payments
Transfers
Tasks
Meetings
Decisions
Attendance
Audit events
Private test documents
```

This allows recovery testing without using real member data.

---

# 23. Recovery Procedure Overview

General recovery flow:

```text
Incident detected
      ↓
Stop unsafe writes if required
      ↓
Assess affected services/data
      ↓
Identify latest trustworthy recovery point
      ↓
Create isolated recovery environment
      ↓
Restore database
      ↓
Restore/reconnect private files
      ↓
Run integrity checks
      ↓
Run security/RLS checks
      ↓
Validate financial totals
      ↓
Validate core application workflows
      ↓
Promote/restore service
      ↓
Monitor
      ↓
Document incident
```

---

# 24. Scenario — Database Corruption

If database corruption is suspected:

1. Stop or restrict unsafe writes where necessary.
2. Determine affected tables/records.
3. Preserve logs and incident evidence.
4. Identify the latest known-good recovery point.
5. Restore into isolated environment.
6. Run schema/constraint checks.
7. Validate financial balances.
8. Validate member/donation relationships.
9. Validate audit records.
10. Perform security checks.
11. Promote recovered environment only after validation.

---

# 25. Scenario — Accidental Financial Deletion

Because President can permanently delete financial transactions, accidental deletion is a specific risk.

Response:

```text
Identify transaction
→ identify incident time
→ check audit record
→ determine recovery point/source
→ reconstruct/restore as appropriate
→ validate balances
→ validate audit context
```

The audit system is not itself a replacement for backup.

---

# 26. Scenario — Failed Migration

If a migration breaks production:

```text
Stop further migration changes
→ assess migration state
→ preserve logs
→ use documented recovery/rollback approach
→ restore affected structures/data if required
→ validate RLS/constraints
→ validate finance
→ validate application
```

Never improvise destructive SQL directly on production without controlled recovery planning.

---

# 27. Scenario — File Storage Failure

If private files become unavailable:

```text
Identify missing files
→ determine database references
→ restore required files
→ verify authorization
→ verify records still point to correct objects
```

Do not make all restored files public merely to restore accessibility.

---

# 28. Scenario — Credential Loss

Critical credentials/configuration should have a controlled recovery procedure.

Possible items:

```text
Supabase project access
Deployment account access
Domain access
Push notification credentials
SMS/WhatsApp provider credentials
Other production integrations
```

Secrets should not be copied into unprotected notes or GitHub.

---

# 29. Scenario — Environment Loss

If the production application environment is lost:

```text
Recover source code
→ restore infrastructure/configuration
→ restore database
→ restore private storage
→ restore secrets through secure secret management
→ run smoke tests
→ validate core workflows
```

---

# 30. Scenario — Total Service Outage

If the main backend becomes unavailable:

```text
Confirm outage
→ avoid duplicate/manual posting unless controlled
→ preserve critical operational records
→ restore/stand up service
→ validate data
→ resume normal writes
```

Do not manually recreate financial transactions without a controlled reconciliation process.

---

# 31. Financial Recovery Validation

After financial recovery, verify:

```text
Account balances
Donation totals
Expense totals
Transfer totals
Verified payment totals
Outstanding contributions
Historical contribution records
```

Use independently calculated expected values.

---

# 32. Financial Reconciliation After Recovery

Example:

```text
Opening funds
+
Receipts/income
-
Expenses/payments
+
/-
Adjustments/transfers as applicable
=
Closing funds
```

The recovered database, reports, and calculated expected result must agree.

---

# 33. Audit Recovery Validation

After recovery verify:

```text
Audit event IDs
Actor
Action
Entity
Timestamp
Reason
Relevant context
```

No audit records should disappear unexpectedly during recovery.

---

# 34. Member Recovery Validation

Verify:

```text
Member count
Unique mobile numbers
Primary referrers
Contribution amounts
Effective months
Donation history
```

No duplicate identities should be introduced by restore.

---

# 35. Committee Work Recovery Validation

Verify:

```text
Tasks
Responsible members
Completion status
Deadlines
Progress
Completed work history
```

No historical work records should be lost unnecessarily.

---

# 36. Meeting Recovery Validation

Verify:

```text
Meetings
Attendance
Decisions
Follow-up tasks
Completion status
```

The meeting → decision → task relationship must remain intact.

---

# 37. Attendance Recovery Validation

Verify:

```text
Jummah records
Meeting attendance
One member/Friday rule
One member/meeting rule
```

Do not reconstruct raw location history unnecessarily.

---

# 38. Notification Recovery

Notification delivery is not historical business truth.

After recovery:

```text
Do not resend notifications blindly.
```

Determine which notifications are still necessary from current business state.

---

# 39. Offline Attendance Recovery

If a device has pending attendance while the backend is recovering:

```text
Preserve pending local state
→ restore backend
→ synchronize
→ server validates
→ accepted/rejected result
```

Do not blindly mark pending records as accepted.

---

# 40. Recovery and Authorization

After restoring data:

- [ ] RLS remains enabled.
- [ ] Role relationships remain correct.
- [ ] Disabled users remain disabled.
- [ ] President-only actions remain protected.
- [ ] Finance permissions remain correct.
- [ ] Auditor remains read-only.
- [ ] Member privacy remains intact.

A technically successful restore is not acceptable if authorization is weakened.

---

# 41. Recovery and Private Files

After restoration verify:

```text
Authorized user → access allowed
Unauthorized user → access denied
```

Do not assume that restored storage permissions match application permissions automatically.

---

# 42. Recovery and Configuration

Document recoverable configuration such as:

```text
Production environment variables
Authentication configuration
Allowed web origins/redirects
Storage configuration
Push configuration
External provider configuration
Application feature configuration
```

Secrets themselves must remain in protected secret storage.

---

# 43. Source Code Recovery

GitHub is the source-of-truth repository for application code.

Recovery process:

```text
Clone known-good revision
→ install locked dependencies
→ configure protected environment
→ build
→ run tests
→ deploy
```

Do not depend on developer-local uncommitted files for production recovery.

---

# 44. Database Migration Recovery

All production schema changes should be versioned.

The repository should preserve:

```text
Migration files
Schema version/history
Database change documentation
```

A production restore must be compatible with the recovered application version.

---

# 45. Version Compatibility

Before restoring:

```text
Database version
+
Application version
+
Migration state
```

must be compatible.

Do not connect an arbitrary old application build to a newer production database without validation.

---

# 46. Recovery Environment

Use an isolated recovery environment where practical:

```text
Recovery database
Recovery storage
Recovery application instance
```

This allows validation without damaging the original environment.

---

# 47. Restore Approval

Before returning a recovered environment to production:

```text
Technical validation
+
Financial validation
+
Security validation
```

should be completed.

Recommended stakeholders:

```text
Technical maintainer
Finance representative
President/authorized administrator
```

---

# 48. Backup Retention

Retention must balance:

```text
Recovery usefulness
+
Storage cost
+
Privacy
```

Avoid keeping unlimited sensitive exports.

A final retention schedule should be selected based on:

```text
Data importance
Incident window
Available storage
Legal/administrative requirements
```

---

# 49. Backup Rotation

Where periodic exports are used, use a controlled rotation model such as:

```text
Recent backups
+
Periodic checkpoints
```

rather than keeping every export forever.

Exact rotation frequency should be set during production operations.

---

# 50. Backup Monitoring

Monitor where possible:

```text
Backup success
Backup failure
Storage availability
Export age
Restore-test results
```

A missing recent backup should be treated as an operational alert.

---

# 51. Backup Failure Response

If a scheduled backup fails:

```text
Detect
→ record failure
→ investigate
→ repair backup process
→ confirm successful new backup
```

Do not silently continue without recovery coverage.

---

# 52. Recovery Drill

At regular operational intervals, perform a controlled restore drill.

Verify:

```text
Database restoration
File restoration
Application connection
RLS
Authentication
Financial totals
Reports
Private-file access
```

Document:

```text
Date
Recovery source
Duration
Problems
Resolution
Outcome
```

---

# 53. Recovery Drill Frequency

Exact frequency should be decided after deployment.

V1 minimum expectation:

```text
Perform recovery testing before production launch
+
repeat periodically
```

Do not wait for a real incident to discover that restoration does not work.

---

# 54. Disaster Scenarios to Rehearse

At minimum:

```text
Database corruption
Accidental transaction deletion
Failed migration
Storage/file failure
Production environment loss
Credential loss
External service outage
```

---

# 55. Recovery Logging

Record recovery actions such as:

```text
Incident ID
Detected time
Recovery point selected
Operator
Environment
Actions taken
Validation results
Restoration time
Final outcome
```

Do not include secrets in the incident record.

---

# 56. Recovery Incident Report

After a major recovery, document:

```text
What happened
What data was affected
What recovery source was used
What was restored
What could not be restored
Validation performed
Business impact
Corrective actions
Preventive actions
```

---

# 57. Data-Loss Handling

If some data cannot be recovered:

1. Identify exactly what is missing.
2. Do not invent replacement records.
3. Preserve whatever evidence exists.
4. Reconcile affected financial records carefully.
5. Record the incident.
6. Correct derived reports after authoritative records are restored/reconstructed.

Financial data must never be fabricated to make totals look correct.

---

# 58. Manual Recovery Restrictions

Avoid manual data reconstruction unless necessary.

If manual recovery is required:

```text
Identify source evidence
→ authorize action
→ record reason
→ execute controlled correction
→ verify result
→ audit action
```

Never silently overwrite missing financial history.

---

# 59. Recovery and PDF Reports

Generated PDFs are not the primary system-of-record.

After recovery:

```text
Regenerate reports from restored authoritative data.
```

Do not rely on old generated PDFs as the database replacement.

---

# 60. Recovery and Audit Reports

Audit reports should also be regenerable from recovered audit records.

Generated report files are secondary outputs.

---

# 61. Recovery and Storage Minimization

Do not reduce backup reliability solely to save storage.

Acceptable optimization:

```text
Compress exports
Remove temporary copies
Avoid duplicate document backups
Rotate old exports
```

Not acceptable:

```text
Delete required financial history
Delete required committee history
Delete audit records
```

merely to reduce storage.

---

# 62. Recovery and Free-Tier Planning

Before production launch, explicitly verify:

```text
Database backup availability
Storage backup method
Export limits
Retention
Pause/inactivity behavior where relevant
Recovery options
```

If the selected free tier cannot provide the required recovery characteristics, the production plan must be reconsidered.

---

# 63. Backup and Recovery Acceptance Criteria

V1 recovery capability is acceptable when:

- [ ] Critical data categories are identified.
- [ ] Database recovery process is documented.
- [ ] Required private files are included in recovery planning.
- [ ] Backup access is protected.
- [ ] Recovery environment exists or is documented.
- [ ] Database restore has been tested.
- [ ] RLS remains intact after restore.
- [ ] Financial totals validate after restore.
- [ ] Member relationships validate after restore.
- [ ] Committee work history validates after restore.
- [ ] Meeting relationships validate after restore.
- [ ] Attendance records validate after restore.
- [ ] Private files remain private after restore.
- [ ] Source code can be reconstructed from GitHub.
- [ ] Production configuration recovery is documented.
- [ ] Credential recovery is documented.
- [ ] Recovery failure handling is documented.
- [ ] At least one controlled recovery drill has been completed before production.
- [ ] No false data is invented during recovery.

---

# 64. Recovery Invariants

### Invariant 1

Backups are not considered valid until restoration has been verified.

### Invariant 2

Financial history has the highest recovery priority.

### Invariant 3

Required committee work history must not be deleted for storage savings.

### Invariant 4

Generated PDFs are not the primary source of truth.

### Invariant 5

Audit records must remain traceable after recovery.

### Invariant 6

Private files remain private after restoration.

### Invariant 7

RLS and authorization must remain active after recovery.

### Invariant 8

Recovery must not create duplicate members.

### Invariant 9

Recovery must not create duplicate financial postings.

### Invariant 10

Internal transfers remain internally balanced after recovery.

### Invariant 11

Pending offline attendance remains server-authoritative.

### Invariant 12

Notifications are not treated as business records.

### Invariant 13

Production secrets are not stored in ordinary backup repositories.

### Invariant 14

Manual reconstruction must be evidence-based and auditable.

### Invariant 15

No financial amount is invented merely to reconcile a report.

### Invariant 16

Free-tier assumptions do not replace verified recovery capability.

---

# 65. Final Recovery Workflow

```text
Incident
   ↓
Contain
   ↓
Assess
   ↓
Identify Last Known Good State
   ↓
Restore Isolated Environment
   ↓
Validate Schema/Data
   ↓
Validate RLS/Security
   ↓
Validate Finance
   ↓
Validate Files
   ↓
Validate Core Workflows
   ↓
Approve Recovery
   ↓
Restore Service
   ↓
Monitor
   ↓
Document
```

---

# 66. Related Documents

- `TECHNOLOGY_STACK.md`
- `BACKEND_FRAMEWORK.md`
- `DATABASE_ARCHITECTURE.md`
- `DATABASE_SCHEMA.md`
- `DATA_RELATIONSHIPS.md`
- `FINANCIAL_DATA_MODEL.md`
- `AUDIT_LOG_MODEL.md`
- `SECURITY_REQUIREMENTS.md`
- `SECURITY_CHECKLIST.md`
- `AUTHORIZATION_MODEL.md`
- `DATA_PRIVACY.md`
- `STORAGE_STRATEGY.md`
- `MONITORING.md`
- `TESTING_STRATEGY.md`
- `TEST_PLAN.md`
- `ACCEPTANCE_CRITERIA.md`
- `DEPLOYMENT.md`

---

## Document Status

**Backup and Recovery — V1 Backup & Recovery Baseline**

This document defines the minimum backup, restoration, validation, and disaster-recovery approach for Masjid-e-Mamoor 2 V1 while preserving financial integrity, privacy, authorization, and historical accountability.
