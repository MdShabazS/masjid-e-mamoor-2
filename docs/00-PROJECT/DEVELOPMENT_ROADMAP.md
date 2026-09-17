# Masjid-e-Mamoor 2 — Development Roadmap

**Document Status:** Baseline  
**Version:** 1.0  
**Product:** Masjid-e-Mamoor 2 Internal Management Application  
**Scope:** V1  
**Last Updated:** 2026-09-17

---

## 1. Purpose

This document defines the development roadmap for the Masjid-e-Mamoor 2 application.

The roadmap establishes the order in which product, architecture, database, security, frontend, backend, testing, and deployment work should be completed.

The goal is to avoid random feature development and ensure that dependent work is only started after its foundations are ready.

The detailed executable checklist will be maintained separately in:

`DEVELOPMENT_TASKS.md`

---

# 2. Development Philosophy

The project follows a documentation-first development model:

```text
Research
   ↓
Requirements
   ↓
Scope Freeze
   ↓
Architecture
   ↓
Technology Decisions
   ↓
Database Design
   ↓
Security Design
   ↓
API / Backend Design
   ↓
UI / UX Design
   ↓
Implementation
   ↓
Testing
   ↓
Validation
   ↓
Deployment
   ↓
Production Monitoring
```

The team should avoid beginning implementation before the relevant architecture and requirements are documented.

---

# 3. Product Priorities

The development sequence must protect the two primary product pillars.

## P0 — Financial Audit & Transparency

Includes:

- Accounts
- Donations
- Collections
- Payment verification
- Expenses
- Payments
- Transfers
- Financial balances
- Financial reports
- Audit trail
- Permanent financial history

## P0 — Committee Accountability

Includes:

- Referrals
- Verified contribution tracking
- Tasks
- Work records
- Work history
- Meeting decisions
- Follow-up tasks
- Committee progress visibility

## P1 — Supporting Operations

Includes:

- Authentication
- Attendance
- Meetings
- Notifications
- Multilingual interface
- Reporting/UI support

---

# 4. Phase 0 — Requirements and Scope Freeze

### Objective

Establish the product baseline before technical implementation.

### Work

- Finalize project overview.
- Finalize product requirements.
- Finalize V1 feature scope.
- Finalize roles and permissions.
- Identify unresolved product decisions.
- Record all approved business rules.
- Identify V1 exclusions.

### Documents

- `PROJECT_OVERVIEW.md`
- `PRODUCT_REQUIREMENTS.md`
- `FEATURE_SCOPE.md`
- `USER_ROLES_PERMISSIONS.md`

### Exit Criteria

- Core product purpose is documented.
- Core workflows are documented.
- V1 exclusions are documented.
- No major core workflow is dependent on an unstated assumption.

---

# 5. Phase 1 — Research and Technology Selection

### Objective

Select the technology stack using current technical and cost evidence.

### Areas to research

- Web frontend framework
- Mobile framework
- Backend framework/runtime
- Database platform
- Authentication
- File/object storage
- Hosting
- Cloud services
- Notification infrastructure
- SMS/WhatsApp integration
- UPI payment-link mechanism
- PDF/report generation
- Monitoring
- Backup/recovery
- CI/CD
- Security services
- Free-tier limits
- Expected storage requirements
- Expected operating cost

### Important constraint

The application should prioritize free/low-cost infrastructure where technically appropriate.

However, infrastructure cost must not justify removing:

- Financial history
- Donation history
- Committee work history
- Required audit records

### Output

Technology decisions must be recorded in:

- `TECHNOLOGY_STACK.md`
- `FRONTEND_FRAMEWORK.md`
- `BACKEND_FRAMEWORK.md`
- `DATABASE_ARCHITECTURE.md`
- `HOSTING_CLOUD_INFRASTRUCTURE.md`

### Exit Criteria

- Core technologies selected.
- Major external-service dependencies identified.
- Free-tier limitations understood.
- Production feasibility evaluated.
- No critical dependency remains undocumented.

---

# 6. Phase 2 — System Architecture

### Objective

Define how the complete application will operate as a system.

### Work

- Define high-level system architecture.
- Define frontend/backend boundaries.
- Define API boundaries.
- Define authentication flow.
- Define authorization flow.
- Define data flow.
- Define notification flow.
- Define payment flow.
- Define file-storage flow.
- Define reporting flow.
- Define audit-log flow.
- Define environment separation.

### Outputs

- `SYSTEM_ARCHITECTURE.md`
- `APPLICATION_ARCHITECTURE.md`
- `FRONTEND_ARCHITECTURE.md`
- `BACKEND_ARCHITECTURE.md`
- `SECURITY_ARCHITECTURE.md`

### Exit Criteria

A developer should be able to understand the major system components and how they communicate without looking at implementation code.

---

# 7. Phase 3 — Database Architecture

### Objective

Create the authoritative data model before feature implementation.

### Major domains

```text
Users
Roles
Members
Referrals
Monthly Donations
Additional Donations
Payment Records
Financial Accounts
Financial Transactions
Expenses
Expense Payments
Transfers
Committee Tasks
Work History
Meetings
Meeting Decisions
Meeting Attendance
Jummah Attendance
Notifications
Audit Logs
Settings
```

### Work

- Define entities.
- Define primary keys.
- Define foreign keys.
- Define unique constraints.
- Define indexes.
- Define status models.
- Define relationships.
- Define financial transaction model.
- Define referral attribution model.
- Define permanent-history model.
- Define audit-log model.
- Define file metadata model.

### Important principles

- Financial records must remain consistent.
- Mobile number uniqueness must be enforced.
- One primary referrer must be enforceable.
- Duplicate attendance must be prevented.
- One open task must not be claimable by multiple members simultaneously.
- Historical records must not be silently overwritten.
- Financial deletion must respect authorization rules.

### Outputs

- `DATABASE_SCHEMA.md`
- `DATA_RELATIONSHIPS.md`
- `FINANCIAL_DATA_MODEL.md`
- `COMMITTEE_DATA_MODEL.md`
- `AUDIT_LOG_MODEL.md`

### Exit Criteria

The database model can support all approved V1 workflows without ad-hoc data duplication.

---

# 8. Phase 4 — Security and Authorization Design

### Objective

Define security before protected functionality is implemented.

### Work

- Authentication architecture
- Session/token strategy
- Role-based access
- Record-level access
- Financial permission boundaries
- Data privacy
- File access security
- Audit logging
- Rate limiting
- Input validation
- Secure API design
- Secret management
- Error-handling policy

### Critical rules

Frontend visibility is not authorization.

Every protected backend operation must enforce permissions.

### Outputs

- `SECURITY_REQUIREMENTS.md`
- `AUTHORIZATION_MODEL.md`
- `DATA_PRIVACY.md`
- `SECURITY_CHECKLIST.md`

### Exit Criteria

All critical protected operations have explicit authorization requirements.

---

# 9. Phase 5 — UX and Application Design

### Objective

Design the actual user experience before large-scale implementation.

### Work

- Navigation structure
- Role-specific dashboards
- Member flow
- Referral flow
- Donation flow
- Payment flow
- Finance flow
- Expense flow
- Committee work flow
- Meeting flow
- Attendance flow
- Reports
- Settings
- Notification states
- Loading/error/empty states
- Mobile responsive behavior
- Urdu RTL behavior

### Outputs

- `UI_UX_REQUIREMENTS.md`
- `DESIGN_SYSTEM.md`
- `NAVIGATION_FLOW.md`
- `SCREEN_SPECIFICATIONS.md`

### Exit Criteria

Major V1 workflows have screen-level specifications.

---

# 10. Phase 6 — Development Environment and Repository Foundation

### Objective

Create a stable development foundation before feature implementation.

### Work

- Initialize application repositories/project structure.
- Configure package management.
- Configure environment files.
- Configure linting.
- Configure formatting.
- Configure type checking where applicable.
- Configure testing frameworks.
- Configure Git hooks where appropriate.
- Configure CI checks.
- Create development/staging/production environment strategy.
- Establish coding standards.
- Establish branching/commit conventions.

### Exit Criteria

A clean developer environment can install, run, test, lint, and build the project.

---

# 11. Phase 7 — Backend and Database Foundation

### Objective

Implement the backend foundation required by all higher-level features.

### Work

- Database setup.
- Migrations.
- Server configuration.
- Authentication integration.
- Authorization middleware/policies.
- Core user model.
- Role model.
- Error handling.
- Validation.
- Logging.
- Audit-event infrastructure.
- Storage integration.
- Base API conventions.

### Exit Criteria

The backend can securely authenticate users and execute authorized database operations.

---

# 12. Phase 8 — Core Member and Referral System

### Objective

Implement the basic member lifecycle.

### Work

- Member creation.
- Mobile uniqueness.
- Referral creation.
- Referrer relationship.
- Member profile.
- Authorized edits.
- Referral correction.
- Referral audit events.

### End-to-end flow

```text
Committee Member
      ↓
Enter Name + Mobile
      ↓
Duplicate Check
      ↓
Create Member
      ↓
Record Referrer
      ↓
Record Monthly Amount
```

### Exit Criteria

A committee member can safely register a new member and the backend prevents duplicates.

---

# 13. Phase 9 — Donation System

### Objective

Implement the complete member donation workflow.

### Work

- Monthly donation records.
- Effective monthly amount.
- Automatic monthly record generation.
- Due/pending/paid states.
- Outstanding calculation.
- Payment link generation.
- Link expiry.
- Combined outstanding payments.
- FIFO allocation.
- Additional General Donation.
- Overpayment handling.
- Anonymous donation record.
- Donation history.

### Exit Criteria

The complete donation lifecycle can be exercised end-to-end without manual database manipulation.

---

# 14. Phase 10 — UPI and Payment Verification

### Objective

Connect the donation workflow to actual payment operations.

### Work

- One active Masjid UPI ID.
- Finance UPI configuration.
- Payment-link construction.
- UPI redirection/intent flow as selected by the technology research.
- Payment reference capture.
- Finance verification workflow.
- Payment status rules.
- Combined-payment handling.
- Verification audit events.

### Critical rule

Payment verification must be based on actual payment evidence, not link interaction.

### Exit Criteria

A member can initiate payment and Finance can verify the actual transaction and update financial records correctly.

---

# 15. Phase 11 — Finance and Accounting Foundation

### Objective

Implement the financial ledger and account model.

### Work

- Account creation.
- Opening balances.
- Transaction model.
- Income.
- Donations.
- Collections.
- Running balances.
- Internal transfers.
- Transfer IDs.
- Negative balance handling.
- Account deactivation.
- Financial transaction IDs.
- Financial correction logic.

### Exit Criteria

Account balances and transaction history remain mathematically consistent under normal and corrective operations.

---

# 16. Phase 12 — Expense Management

### Objective

Implement expense and payment tracking.

### Work

- Expense creation.
- Expense categories.
- Bill upload.
- Payment records.
- Multiple payments.
- Payment proof.
- Added/Partially Paid/Paid/Cancelled statuses.
- Cancellation.
- Expense amount correction.
- Payment-proof replacement/deletion.
- Finance authorization.
- President deletion authority where applicable.

### Exit Criteria

Expenses can be created, paid, corrected, cancelled, and audited without breaking financial balances.

---

# 17. Phase 13 — Financial Reporting and Audit

### Objective

Turn financial records into usable audit information.

### Work

- Financial summaries.
- Daily reporting.
- Monthly reporting.
- Yearly reporting.
- Custom date ranges.
- Account-wise reports.
- Donation reports.
- Expense reports.
- Transaction reports.
- Audit log views.
- PDF generation.
- Print-ready layouts.

### Exit Criteria

The system can generate a complete, internally consistent financial report for a selected period.

---

# 18. Phase 14 — Committee Work Management

### Objective

Implement the committee accountability system.

### Work

- Task creation.
- Direct assignment.
- Open task.
- Atomic task claiming.
- Progress updates.
- Priority.
- Deadline.
- Overdue status.
- Completion.
- Completion note.
- Attachments where approved.
- Work history.
- Edit metadata.
- Committee dashboard.
- Member drill-down.

### Exit Criteria

A complete task can move from creation to permanent historical completion record.

---

# 19. Phase 15 — Meetings and Accountability Chain

### Objective

Connect meetings and decisions to committee work.

### Work

- Meeting scheduling.
- Agenda.
- Invited members.
- Meeting attendance.
- Decisions/minutes.
- Follow-up tasks.
- Responsible member.
- Completion tracking.
- Meeting history.

### Core relationship

```text
Meeting
   ↓
Decision
   ↓
Optional Task
   ↓
Responsible Member
   ↓
Completed Work
```

### Exit Criteria

The system can trace a meeting decision to resulting work and its completion.

---

# 20. Phase 16 — Attendance

### Objective

Implement only the approved V1 attendance features.

### Included

#### Jummah

- Mark present.
- GPS validation.
- Configurable radius.
- Duplicate prevention.
- History.
- Aggregate information.
- Offline capture where supported.

#### Scheduled Meetings

- Meeting-specific attendance.
- Attendance history.
- Aggregate participation.

### Explicitly excluded

- Fajr attendance.
- Zohr attendance.
- Asr attendance.
- Maghrib attendance.
- Isha attendance.
- Azaan attendance.
- Jamaat attendance for each prayer.

### Exit Criteria

Both approved attendance workflows function reliably and do not create duplicate records.

---

# 21. Phase 17 — Notifications

### Objective

Implement event-based notification delivery.

### Work

- Push notifications.
- Payment-link notifications.
- Donation verification notifications.
- Donation reminder notifications.
- Task notifications.
- Meeting reminders.
- Expense notifications.
- Important administrative/security notifications.
- SMS/WhatsApp integration where selected and available.

### Important principle

Notification delivery is not the source of truth for business state.

### Exit Criteria

Users receive relevant notifications without critical workflow state depending on delivery success.

---

# 22. Phase 18 — Internationalization

### Objective

Enable the V1 language set.

### Languages

- English
- Hindi
- Kannada
- Urdu

### Work

- Translation structure.
- Language selection.
- RTL support for Urdu.
- Localized UI strings.
- Localized notifications where supported.
- Localized reports/PDFs where practical.
- Date/number localization.

### Exit Criteria

The core application can be used in all approved V1 languages without broken layouts or untranslated core workflows.

---

# 23. Phase 19 — Integrated Testing

### Objective

Validate the complete application rather than isolated modules only.

### Test categories

- Unit testing
- Integration testing
- API testing
- Database testing
- Authorization testing
- Security testing
- Financial consistency testing
- File-upload testing
- Notification testing
- Payment workflow testing
- Attendance testing
- Mobile testing
- Web testing
- Localization testing
- PDF/report testing

### Critical end-to-end scenarios

1. New member referral.
2. Duplicate member prevention.
3. Monthly donation.
4. Outstanding donation.
5. Combined payment.
6. FIFO allocation.
7. Overpayment.
8. Additional donation.
9. Anonymous donation.
10. Jummah collection.
11. Expense with bill and payment proof.
12. Multi-payment expense.
13. Internal transfer.
14. Committee task.
15. Open-task single claim.
16. Meeting decision → task → completion.
17. Jummah attendance.
18. Meeting attendance.
19. Role restriction.
20. Financial audit report.

---

# 24. Phase 20 — Security Validation

### Objective

Verify that the application remains secure when users attempt operations outside their authority.

### Work

- RBAC tests.
- Record-level authorization tests.
- API bypass tests.
- ID enumeration tests.
- Authentication abuse tests.
- OTP abuse/rate-limit tests.
- File authorization tests.
- Financial deletion authorization tests.
- Sensitive-data exposure checks.
- Notification payload checks.
- Audit-log integrity checks.

### Exit Criteria

Unauthorized operations are rejected at the backend.

---

# 25. Phase 21 — Production Readiness

### Objective

Prepare the system for real Masjid use.

### Work

- Production environment.
- Domain/configuration.
- Database backup strategy.
- Recovery process.
- Monitoring.
- Error reporting.
- Storage monitoring.
- Security secrets.
- Production access control.
- Initial data migration if required.
- Print/PDF verification.
- Final acceptance testing.

### Exit Criteria

The application can be deployed and operated safely under the agreed V1 infrastructure.

---

# 26. Phase 22 — Deployment

### Objective

Release the application to production.

### Release targets

- Web
- Android
- iOS

### Deployment sequence

```text
Production Backend
      ↓
Production Database
      ↓
Web Application
      ↓
Android Build
      ↓
iOS Build
      ↓
Production Validation
```

The exact deployment tooling will be defined after infrastructure research.

---

# 27. Phase 23 — Production Validation

After deployment, verify:

- Authentication.
- Role access.
- Member registration.
- Referral tracking.
- Donation generation.
- Payment links.
- UPI configuration.
- Finance verification.
- Accounts.
- Expenses.
- Reports.
- Committee tasks.
- Meetings.
- Attendance.
- Notifications.
- Language support.
- Audit logs.
- Backups.
- Storage.

No feature is considered production-ready solely because it works in a local development environment.

---

# 28. Phase 24 — Controlled Post-V1 Improvements

After V1 is operational, improvements should be driven by:

- Actual Masjid feedback.
- Production issues.
- Security findings.
- Performance data.
- Operational needs.
- Cost data.
- Documented new requirements.

New features should not be added simply to increase feature count.

---

# 29. Development Dependency Map

The major dependency structure is:

```text
Requirements
    ↓
Scope
    ↓
Roles / Permissions
    ↓
Technology Research
    ↓
Architecture
    ↓
Database
    ↓
Security
    ↓
UI/UX
    ↓
Development Foundation
    ↓
Authentication
    ↓
Member + Referral
    ↓
Donations
    ↓
UPI / Verification
    ↓
Finance
    ↓
Expenses
    ↓
Financial Audit
    ↓
Committee Work
    ↓
Meetings
    ↓
Attendance
    ↓
Notifications
    ↓
Internationalization
    ↓
Integrated Testing
    ↓
Security Validation
    ↓
Production Readiness
    ↓
Deployment
```

Some workstreams may run in parallel after their dependencies are established, but no dependency should be bypassed without documentation.

---

# 30. Milestone Definitions

## Milestone 1 — Product Baseline

Requirements and scope documented.

## Milestone 2 — Technical Baseline

Technology, architecture, database, and security decisions documented.

## Milestone 3 — Development Foundation

Repository, environments, backend, database, authentication, and CI foundation operational.

## Milestone 4 — Member & Donation Core

Member, referral, monthly donation, payment, and verification workflows operational.

## Milestone 5 — Finance Core

Accounts, transactions, expenses, transfers, and audit reporting operational.

## Milestone 6 — Committee Accountability Core

Tasks, work history, contribution tracking, meetings, and follow-ups operational.

## Milestone 7 — Supporting Operations

Attendance, notifications, and internationalization operational.

## Milestone 8 — Production Validation

Testing, security validation, deployment, and production verification completed.

---

# 31. Definition of Done for a Development Phase

A phase is not complete merely because code exists.

A phase is complete when:

- Requirements are documented.
- Required architecture is documented.
- Implementation exists.
- Automated tests exist where appropriate.
- Manual validation is completed.
- Security checks are completed where applicable.
- Documentation is updated.
- Known limitations are recorded.
- Git changes are committed.
- The next dependent phase can begin safely.

---

# 32. Git and Documentation Discipline

Every meaningful development step should produce:

1. Code/configuration changes.
2. Appropriate tests.
3. Documentation updates.
4. A clear commit message.
5. Validation evidence where practical.

The repository should remain understandable to a new developer without relying on private conversation history.

---

# 33. Scope Protection

The roadmap is not permission to automatically implement every possible extension.

The following principles remain active throughout development:

- Do not add unapproved features.
- Do not weaken financial controls for convenience.
- Do not remove historical records to save storage.
- Do not weaken committee work history to save storage.
- Do not create unnecessary competitive metrics.
- Do not turn the app into a public platform without a documented scope change.
- Do not silently change business rules in code.

---

# 34. Master Execution Document

The actual day-to-day implementation sequence will be maintained in:

`DEVELOPMENT_TASKS.md`

That document must contain numbered tasks such as:

```text
TASK 1
TASK 2
TASK 3
...
TASK N
```

Each task should specify:

- Objective
- Why it is required
- Dependencies
- Exact work
- Expected output
- Files affected
- Validation
- Definition of Done
- Commit requirement
- Next task/dependency

The development team should work from that document one task at a time.

---

# 35. Related Documents

- `PROJECT_OVERVIEW.md`
- `PRODUCT_REQUIREMENTS.md`
- `FEATURE_SCOPE.md`
- `USER_ROLES_PERMISSIONS.md`
- `SYSTEM_ARCHITECTURE.md`
- `TECHNOLOGY_STACK.md`
- `DATABASE_ARCHITECTURE.md`
- `SECURITY_ARCHITECTURE.md`
- Feature specifications
- `TESTING_STRATEGY.md`
- `DEPLOYMENT.md`
- `STORAGE_STRATEGY.md`
- `DEVELOPMENT_TASKS.md`

---

## Document Status

**Development Roadmap — V1 Baseline**

This document defines the intended order of product development.

Detailed technical decisions and exact implementation tasks belong in their respective documents.
