# Masjid-e-Mamoor 2 — Deployment

**Document Status:** V1 Deployment Baseline  
**Version:** 1.0  
**Product:** Masjid-e-Mamoor 2 Internal Management Application  
**Scope:** V1  
**Platforms:** Web, Android, iOS  
**Related Documents:** TECHNOLOGY_STACK.md, FRONTEND_FRAMEWORK.md, BACKEND_FRAMEWORK.md, DATABASE_ARCHITECTURE.md, BACKUP_AND_RECOVERY.md, STORAGE_STRATEGY.md, MONITORING.md, SECURITY_REQUIREMENTS.md, SECURITY_CHECKLIST.md  
**Last Updated:** 2026-09-17

---

# 1. Purpose

This document defines the V1 deployment architecture and release process for Masjid-e-Mamoor 2.

The deployment model covers:

```text
Web application
Backend/server functions
Database
Private file storage
Authentication
Push notifications
SMS/WhatsApp integration where enabled
UPI/payment handoff
Android application
iOS application
Source control
CI/CD
Production configuration
Rollback
```

---

# 2. Deployment Principles

1. Production deployments must be repeatable.
2. Production secrets must never be committed to GitHub.
3. Database migrations must be version-controlled.
4. Code and database schema must remain compatible.
5. Security checks must run before release.
6. Production changes should be small and reversible where practical.
7. Financial integrity must be validated after deployment.
8. Deployment success is not the same as product acceptance.
9. Web, mobile, backend, and database releases must be coordinated.
10. Free/low-cost infrastructure is preferred initially, but actual production limits must be monitored.

---

# 3. Deployment Architecture

Recommended V1 deployment model:

```text
GitHub
   │
   ├── Web source
   ├── Mobile source
   ├── Database migrations
   └── Configuration templates
          │
          ▼
      CI / Build
          │
    ┌─────┴─────────┐
    ▼               ▼
  Vercel         Mobile EAS
    │               │
    ▼               ├── Android
 Web Application    └── iOS
    │
    ▼
Supabase
 ├── PostgreSQL
 ├── Auth
 ├── Storage
 └── Edge Functions
    │
    ├── Push integration
    ├── SMS/WhatsApp adapter
    └── Other trusted backend operations
```

The exact provider configuration may evolve without changing the application-level architecture.

---

# 4. Environments

V1 should distinguish:

```text
Development
CI/Test
Staging
Production
```

---

# 5. Development Environment

Purpose:

```text
Local coding
Feature development
Unit tests
Component tests
Local debugging
```

Development must use:

```text
Synthetic/test data
Development configuration
Non-production secrets
```

Do not connect casual local development directly to production.

---

# 6. CI/Test Environment

Purpose:

```text
Automated testing
Database/RLS testing
Integration testing
Build verification
Security checks
```

Use:

```text
Synthetic fixtures
Isolated test database
Mocked external services where appropriate
```

---

# 7. Staging Environment

Purpose:

```text
Production-like testing
Full integration testing
Web E2E
Device testing
UPI validation
Push validation
File/storage validation
Release-candidate testing
```

Staging must not accidentally use production member/financial data.

---

# 8. Production Environment

Production contains the live Masjid-e-Mamoor 2 application.

Production includes:

```text
Live web application
Live Supabase project
Production database
Production private storage
Production auth
Production integrations
Production mobile release configuration
```

---

# 9. Source Control

GitHub is the source-control system.

Production deployment must come from:

```text
Tracked Git commit
+
Reviewed changes
+
Known build/version
```

Do not deploy from undocumented local changes.

---

# 10. Branching Guidance

A simple V1 model is preferred.

Recommended:

```text
main
feature/*
fix/*
```

Production should deploy from a known stable `main` commit.

The exact branching policy may be expanded later if team size requires it.

---

# 11. Pull Request Requirements

Security-sensitive changes should not bypass review.

Before merge:

```text
Lint
Type check
Tests
Build
Relevant integration tests
Security tests
Database migration review
```

Financial/authorization/database changes require additional review.

---

# 12. Versioning

Each release should have an identifiable version.

Recommended:

```text
Web/app release version
Mobile app version
Database migration version
Git commit
```

Record enough information to determine exactly what was deployed.

---

# 13. Web Deployment

Web application uses the selected Next.js deployment platform.

V1 baseline:

```text
Next.js
+
Vercel
```

Deployment flow:

```text
Push/merge approved code
→ CI checks
→ Build
→ Preview
→ Verification
→ Production deployment
```

---

# 14. Web Preview Deployments

Every meaningful pull request should generate a preview environment where supported.

Use preview deployments to validate:

```text
UI
Routing
Data loading
Responsive behavior
Authorization-visible UI
```

Do not connect previews to production destructive workflows.

---

# 15. Web Production Deployment

Before production:

- [ ] CI passes.
- [ ] Required environment variables exist.
- [ ] Database migration compatibility checked.
- [ ] Security checks pass.
- [ ] Relevant E2E tests pass.
- [ ] Release candidate is approved.

Then:

```text
Deploy
→ smoke test
→ monitor
```

---

# 16. Backend Deployment

Trusted backend logic uses Supabase Edge Functions where required.

Examples:

```text
Payment verification operations
Notification dispatch
SMS/WhatsApp adapter
Privileged financial operations
Other secure server-side workflows
```

---

# 17. Edge Function Deployment

For each backend function:

```text
Source
→ Type check
→ Unit/integration test
→ Secret/config verification
→ Deploy
→ Health/smoke test
```

Do not deploy functions containing hardcoded production secrets.

---

# 18. Backend Function Secrets

Secrets must be configured through platform/environment secret management.

Do not commit:

```text
Service-role keys
SMS credentials
WhatsApp credentials
Push secrets
Database passwords
Third-party API secrets
```

---

# 19. Database Deployment

Database schema changes must be version-controlled.

Recommended flow:

```text
Create migration
→ Test locally
→ Test against populated test database
→ Run RLS/security tests
→ Review
→ Staging
→ Production
```

---

# 20. Migration Rules

Every migration should:

```text
Be identifiable
Be repeatable where appropriate
Be reviewed
Be tested
Preserve existing data unless intentionally changed
Maintain required constraints
Maintain security policies
```

Avoid manually editing production schema without a tracked migration.

---

# 21. Migration Safety

Before production migration:

- [ ] Backup/recovery state verified.
- [ ] Migration tested on representative test data.
- [ ] Existing records validated.
- [ ] RLS policies checked.
- [ ] Index/constraint effects considered.
- [ ] Application compatibility verified.
- [ ] Rollback/recovery approach known.

---

# 22. Expand-and-Migrate Principle

For risky schema changes, prefer:

```text
Expand
→ deploy compatible code
→ migrate data
→ switch behavior
→ remove obsolete structure later
```

Avoid changes that require the old and new application versions to be mutually incompatible without a controlled release plan.

---

# 23. Database Rollback

Not every schema migration should be “rolled back” with a reverse SQL script.

For destructive/complex migrations:

```text
Restore/recover
+
forward-fix
```

may be safer than automated reversal.

The recovery strategy must be documented for high-risk migrations.

---

# 24. Storage Deployment

Supabase Storage configuration includes:

```text
Private buckets
Storage policies
Object access
File size/type controls
```

Storage policy changes must be tested before production.

---

# 25. Storage Migration

When changing storage structure:

```text
Database references
+
Storage objects
+
Authorization policies
```

must remain consistent.

Do not delete existing files until all references and replacement paths are verified.

---

# 26. Authentication Deployment

Before production authentication release verify:

```text
Phone OTP
Redirect/configuration
Session handling
Logout
Disabled accounts
Rate limits
```

Use production auth configuration only after test/staging validation.

---

# 27. Push Notification Deployment

Push notifications depend on the mobile platform configuration.

Release process:

```text
Configure credentials
→ test staging
→ build app
→ verify token registration
→ test notification
→ release
```

Push delivery is not business truth.

---

# 28. SMS/WhatsApp Deployment

Where enabled:

```text
Configure provider credentials
→ test sandbox/staging
→ verify templates/messages
→ verify recipients
→ verify error handling
→ enable production provider
```

Provider selection remains a separate integration decision.

---

# 29. UPI Deployment

UPI implementation must be validated independently before production.

Deployment checks:

```text
Payment destination
Amount
Reference/context
Mobile handoff
Return behavior
No false verification
```

Finance verification remains the authoritative source of payment status.

---

# 30. Android Deployment

Mobile builds use Expo/EAS baseline.

Recommended flow:

```text
Source
→ tests
→ EAS build
→ device validation
→ internal testing
→ release build
→ store/distribution process
```

---

# 31. iOS Deployment

Recommended flow:

```text
Source
→ tests
→ EAS build
→ physical-device validation
→ TestFlight/internal testing
→ release
```

Apple-specific signing/distribution requirements must be configured in the deployment environment.

---

# 32. Mobile Version Compatibility

Each mobile release must declare:

```text
App version
Build number
API/backend compatibility
Database compatibility where relevant
```

Do not release a mobile build that requires backend behavior unavailable in production.

---

# 33. Mobile Environment Configuration

Never embed production secrets that belong only on trusted servers.

Client configuration may include public configuration such as:

```text
Public application identifiers
Public service URLs
Non-secret client configuration
```

Privileged secrets must remain server-side.

---

# 34. Deep-Link Deployment

Test configured links for:

```text
Task
Meeting
Payment
Finance
Reports
```

Before release verify:

```text
Link opens
Authentication works
Authorization is enforced
Correct record loads
Invalid/expired record handled safely
```

---

# 35. Environment Variables

Maintain:

```text
.env.example
```

containing placeholders only.

Example categories:

```text
Public web configuration
Supabase URL
Supabase public client key
Server-side secrets
Push provider configuration
SMS/WhatsApp credentials
```

Actual values belong in environment/secret management.

---

# 36. Production Configuration Checklist

Before production:

- [ ] Production Supabase project identified.
- [ ] Production database configured.
- [ ] RLS enabled.
- [ ] Private storage buckets configured.
- [ ] Auth configured.
- [ ] Edge Functions deployed.
- [ ] Required secrets configured.
- [ ] Web domain configured.
- [ ] CORS/origins configured.
- [ ] Push configured.
- [ ] SMS/WhatsApp configured if enabled.
- [ ] UPI configuration verified.
- [ ] Monitoring enabled.
- [ ] Backup/recovery process verified.

---

# 37. Domain Configuration

Production web domain should be configured with:

```text
HTTPS
Correct DNS
Correct application routing
Correct authentication redirects
```

Avoid using development URLs in production configuration.

---

# 38. CORS Configuration

Allow only intended production/approved origins.

Review after every domain/origin change.

---

# 39. Production Security Configuration

Verify:

```text
HTTPS
Secure authentication
RLS
Private storage
No debug mode
No test credentials
No exposed service-role secret
No public financial endpoints
```

---

# 40. Deployment Order

Recommended general production order:

```text
1. Backup/recovery verification
2. Database migration
3. Backend/Edge Functions
4. Web application
5. Mobile-compatible backend behavior
6. Mobile release where required
7. Smoke tests
8. Monitoring
```

For some changes, backend/web order may need to differ for compatibility. Use backward-compatible deployment when necessary.

---

# 41. Backward Compatibility

When web/mobile versions can remain in use simultaneously:

```text
Backend
→ support current released clients
```

Do not remove an API/data behavior while older production clients still depend on it unless coordinated.

---

# 42. Feature Flags

V1 should use feature flags only where they provide clear release value.

Avoid building a complex feature-flag platform.

Potential use:

```text
New integration
Experimental UI
Controlled rollout
```

---

# 43. Deployment Freeze

For a major release, optionally use a short freeze on unrelated changes:

```text
Release candidate
→ final testing
→ no unrelated merges
→ deploy
```

This reduces change noise during critical releases.

---

# 44. Pre-Deployment Checklist

- [ ] Requirements change reviewed.
- [ ] Code merged.
- [ ] Unit tests pass.
- [ ] Integration tests pass.
- [ ] RLS tests pass.
- [ ] Authorization tests pass.
- [ ] Financial tests pass.
- [ ] Security checks pass.
- [ ] Localization checks pass.
- [ ] Build succeeds.
- [ ] Migration reviewed.
- [ ] Backup/recovery readiness checked.
- [ ] Environment variables verified.
- [ ] Release version recorded.

---

# 45. Deployment Checklist

- [ ] Backup/recovery state confirmed.
- [ ] Database migrations applied.
- [ ] Backend functions deployed.
- [ ] Web deployed.
- [ ] Storage/configuration verified.
- [ ] Mobile build released when appropriate.
- [ ] Authentication smoke tested.
- [ ] Finance smoke tested.
- [ ] Task smoke tested.
- [ ] Attendance smoke tested where safe.
- [ ] Reports smoke tested.
- [ ] Logs reviewed.

---

# 46. Post-Deployment Smoke Test

Safe production checks:

```text
Login
Dashboard
Member lookup
Finance overview
Task list
Meeting list
Attendance screen
Report access
Private file authorization
```

Do not perform destructive financial tests in production.

---

# 47. Financial Post-Deployment Validation

After a finance/database release:

- [ ] Account balances are correct.
- [ ] Recent donation records are correct.
- [ ] Expense totals are correct.
- [ ] Transfer relationships remain correct.
- [ ] Reports match database totals.
- [ ] Audit events are being created.
- [ ] Payment verification still works.

---

# 48. Authorization Post-Deployment Validation

Verify at least:

```text
Member
Finance
Auditor
President
```

and representative restricted workflows.

Confirm:

```text
Allowed action → succeeds
Denied action → fails
```

---

# 49. Mobile Post-Deployment Validation

Where a mobile release is included:

```text
Login
Push
GPS attendance
Offline attendance
UPI handoff
File upload
Logout
```

Use physical devices for GPS/UPI.

---

# 50. Monitoring During Release

Immediately after release watch:

```text
Application errors
Backend failures
Database errors
Authentication failures
Storage errors
Push failures
SMS/WhatsApp failures
Unexpected traffic
```

---

# 51. Deployment Failure

If deployment fails:

```text
Stop rollout
→ determine failed layer
→ inspect logs
→ restore previous stable application where appropriate
→ repair
→ re-test
```

Do not continue deploying new changes on top of an unknown broken state.

---

# 52. Web Rollback

If the web release is faulty:

```text
Promote/redeploy known-good version
→ verify
→ investigate failed release
```

Record:

```text
Failed version
Known-good version
Reason
Actions
```

---

# 53. Backend Rollback

If an Edge Function is faulty:

```text
Revert/deploy known-good function
→ verify dependent workflows
```

If database schema changed, application rollback must account for schema compatibility.

---

# 54. Database Failure Recovery

Database recovery follows:

```text
Assess
→ identify last known-good state
→ restore/recover
→ validate schema
→ validate RLS
→ validate financial data
→ validate application
```

Follow `BACKUP_AND_RECOVERY.md`.

---

# 55. Mobile Rollback

Mobile store releases cannot always be “rolled back” instantly.

Therefore:

```text
Backend compatibility
+
server-side mitigation
+
store update
```

must be considered.

Critical backend changes should preserve compatibility with the last released mobile version where feasible.

---

# 56. Hotfix Process

For urgent production defects:

```text
Identify
→ isolate
→ implement minimal fix
→ test
→ review
→ deploy
→ smoke test
→ monitor
```

Financial/security hotfixes receive highest priority.

---

# 57. Emergency Financial Fix

If a production financial defect is detected:

```text
Stop unsafe operation
→ preserve evidence
→ identify affected records
→ correct through controlled workflow
→ audit correction
→ validate balances
```

Never silently edit production financial values to hide an error.

---

# 58. Release Notes

Every meaningful production release should record:

```text
Version
Date
Changes
Database migrations
Security changes
Known issues
Rollback/reference version
```

---

# 59. Deployment Record

Recommended deployment record:

```text
Deployment ID
Git commit
Web version
Mobile version
Migration version
Environment
Deployed by
Date/time
Result
Rollback version if applicable
```

---

# 60. Production Access

Production credentials/access should be limited to authorized operators.

Do not share:

```text
Production admin passwords
Service-role keys
Database credentials
Provider secrets
```

through ordinary chat/messages.

---

# 61. Production Database Access

Direct production SQL access should be restricted.

Use tracked migrations and controlled administrative procedures.

Any emergency SQL action should be:

```text
Authorized
Documented
Validated
Audited where appropriate
```

---

# 62. Production File Access

Administrative access to private storage must be restricted.

Do not download large volumes of financial documents merely for troubleshooting.

---

# 63. Deployment and Privacy

Deployment artifacts must not contain:

```text
Real member exports
Financial backups
Private bills
Payment proofs
Production audit dumps
```

unless deliberately protected and required for an approved operational procedure.

---

# 64. CI/CD Security

CI should protect:

```text
Production secrets
Deployment tokens
Repository permissions
Build artifacts
Signing credentials
```

Use secret management rather than plaintext configuration.

---

# 65. Mobile Signing Security

Protect:

```text
Android signing credentials
iOS signing credentials
Apple credentials
EAS credentials
```

Do not commit signing keys to GitHub.

---

# 66. Dependency Installation

Production builds must use the committed lockfile.

Do not knowingly deploy with an untracked dependency set.

---

# 67. Production Build Reproducibility

The team should be able to identify:

```text
Source revision
Dependency versions
Build configuration
Migration version
Environment
```

for every release.

---

# 68. Maintenance Windows

Most normal releases should aim for low/no downtime.

For changes that require interruption:

```text
Announce internally
→ restrict risky operations
→ deploy
→ validate
→ restore normal operation
```

---

# 69. Financial Maintenance Safety

Never start a schema/deployment operation that could corrupt finance without:

```text
Recovery readiness
+
validated migration
+
controlled deployment
```

---

# 70. Deployment Testing Matrix

| Component | Dev | CI | Staging | Production |
|---|---:|---:|---:|---:|
| Web | ✓ | ✓ | ✓ | ✓ |
| Edge Functions | ✓ | ✓ | ✓ | ✓ |
| Database migrations | ✓ | ✓ | ✓ | ✓ |
| RLS | ✓ | ✓ | ✓ | ✓ |
| Storage | ✓ | ✓ | ✓ | ✓ |
| Auth | ✓ | ✓ | ✓ | ✓ |
| Push | Limited | Mock/limited | ✓ | ✓ |
| SMS/WhatsApp | Mock/sandbox | Mock | ✓ | ✓ |
| UPI | Limited | Mock | ✓ | Safe validation |
| Android | ✓ | Build | ✓ | ✓ |
| iOS | ✓ | Build | ✓ | ✓ |

---

# 71. Production Release Gates

Release must stop when any of these fail:

```text
Critical test
RLS/authorization
Financial integrity
Migration validation
Security scan
Required backup/recovery readiness
Build
Critical smoke test
```

---

# 72. Deployment Acceptance Criteria

V1 deployment is acceptable when:

- [ ] Environments are separated.
- [ ] GitHub is the source of deployed code.
- [ ] Production deployment is reproducible.
- [ ] Database migrations are versioned.
- [ ] RLS is verified after migrations.
- [ ] Web deployment is automated/repeatable.
- [ ] Edge Functions are deployed from tracked source.
- [ ] Private storage is configured securely.
- [ ] Authentication is configured.
- [ ] Push configuration is tested.
- [ ] External messaging configuration is controlled.
- [ ] UPI behavior is validated.
- [ ] Android/iOS builds are reproducible.
- [ ] Production secrets are protected.
- [ ] Rollback/recovery procedures are documented.
- [ ] Release smoke tests are defined.
- [ ] Financial post-deployment validation is defined.
- [ ] Monitoring is available.
- [ ] Deployment records are maintained.

---

# 73. Deployment Invariants

### Invariant 1

Production code must come from a tracked source revision.

### Invariant 2

Production secrets must never be committed to GitHub.

### Invariant 3

Database schema changes must be tracked as migrations.

### Invariant 4

Database migrations must be tested before production.

### Invariant 5

RLS must remain active after deployment.

### Invariant 6

A deployment must not silently change financial meaning.

### Invariant 7

Payment-link behavior must not become automatic payment verification.

### Invariant 8

Mobile clients must remain compatible with backend behavior during rollout.

### Invariant 9

Private storage remains private after deployment.

### Invariant 10

A notification failure must not change business truth.

### Invariant 11

Production smoke tests must avoid destructive financial operations.

### Invariant 12

Failed deployments must have a known recovery/rollback path.

### Invariant 13

Financial/security hotfixes receive controlled validation before release.

### Invariant 14

Deployment artifacts must not contain unnecessary production personal data.

### Invariant 15

Mobile signing credentials remain protected.

### Invariant 16

Every production release is identifiable by version/commit/migration information.

---

# 74. Final Deployment Workflow

```text
Requirement
    ↓
Implementation
    ↓
Pull Request
    ↓
CI
    ↓
Unit/Integration/RLS/Security Tests
    ↓
Staging
    ↓
Web + Mobile + Device Validation
    ↓
Release Candidate
    ↓
Backup/Recovery Readiness
    ↓
Production Migration
    ↓
Backend Deployment
    ↓
Web/Mobile Release
    ↓
Smoke Tests
    ↓
Financial/Security Validation
    ↓
Monitoring
    ↓
Release Complete
```

---

# 75. Related Documents

- `TECHNOLOGY_STACK.md`
- `FRONTEND_FRAMEWORK.md`
- `BACKEND_FRAMEWORK.md`
- `DATABASE_ARCHITECTURE.md`
- `DATABASE_SCHEMA.md`
- `DATA_RELATIONSHIPS.md`
- `SECURITY_ARCHITECTURE.md`
- `SECURITY_REQUIREMENTS.md`
- `SECURITY_CHECKLIST.md`
- `AUTHORIZATION_MODEL.md`
- `DATA_PRIVACY.md`
- `STORAGE_STRATEGY.md`
- `BACKUP_AND_RECOVERY.md`
- `MONITORING.md`
- `TESTING_STRATEGY.md`
- `TEST_PLAN.md`
- `ACCEPTANCE_CRITERIA.md`
- `SCREEN_SPECIFICATIONS.md`
- `NOTIFICATION_SYSTEM.md`
- `PAYMENT_SYSTEM.md`
- `FINANCE_SYSTEM.md`
- `REPORTING_AND_AUDIT.md`

---

## Document Status

**Deployment — V1 Deployment Baseline**

This document defines the repeatable deployment, release, compatibility, rollback, and production validation process for Masjid-e-Mamoor 2 V1.
