# Masjid-e-Mamoor 2 — Storage Strategy

**Document Status:** V1 Storage Baseline  
**Version:** 1.0  
**Product:** Masjid-e-Mamoor 2 Internal Management Application  
**Scope:** V1  
**Platforms:** Web, Android, iOS  
**Related Documents:** TECHNOLOGY_STACK.md, DATABASE_ARCHITECTURE.md, DATABASE_SCHEMA.md, DATA_PRIVACY.md, SECURITY_REQUIREMENTS.md, BACKUP_AND_RECOVERY.md, MONITORING.md  
**Last Updated:** 2026-09-17

---

# 1. Purpose

This document defines the V1 storage strategy for Masjid-e-Mamoor 2.

The objective is:

```text
Keep required history
+
Avoid duplicate storage
+
Minimize file usage
+
Protect private data
+
Stay practical for a low/no-investment deployment
```

Storage optimization must never compromise:

```text
Financial history
Committee work history
Donation history
Audit records
Required supporting documents
Member identity/history
```

---

# 2. Storage Principles

1. Store each authoritative record once.
2. Store relationships by IDs/references rather than duplicating full data.
3. Store files separately from structured database data.
4. Keep private documents private.
5. Avoid permanent storage of re-creatable outputs.
6. Compress/resize files where practical.
7. Clean temporary data automatically.
8. Retain required historical records.
9. Do not use storage savings as a reason to remove audit/financial history.
10. Monitor storage growth before capacity becomes a problem.

---

# 3. Primary Storage Components

V1 storage is divided into:

```text
PostgreSQL Database
Supabase Storage
Client Secure Storage
Temporary Client Cache
Generated Report Storage
Application Source Repository
```

Each serves a different purpose.

---

# 4. PostgreSQL Database

The database is the system of record for structured business data.

Store:

```text
Users
Roles
Members
Referral relationships
Contribution records
Donation records
Payment records
Financial accounts
Financial transactions
Expenses
Expense payments
Transfers
Task records
Task progress
Meetings
Meeting attendance
Meeting decisions
Jummah attendance
Audit records
Notification business state where required
Relevant configuration
```

Do not store uploaded PDF/JPG/PNG file binaries directly inside normal relational tables unless a deliberate exception is documented.

---

# 5. Database Storage Rules

Prefer:

```text
IDs
references
timestamps
structured values
text
status fields
numeric/decimal amounts
```

Avoid storing:

```text
duplicate profile objects
duplicate financial totals
duplicate report datasets
repeated full member objects inside many records
large binary documents
```

Derived values should be calculated when practical rather than duplicated into multiple authoritative columns.

---

# 6. Supabase Storage

Use protected object storage for:

```text
Expense bills
Payment proofs
Task attachments where applicable
Other approved internal documents
```

Recommended storage model:

```text
Private Bucket
    ↓
Object/File
    ↓
Database reference
    ↓
Authorized access
```

---

# 7. File Privacy

Financial/internal files must not be public by default.

Requirements:

- [ ] Buckets containing sensitive records are private.
- [ ] Access is checked through application authorization.
- [ ] Temporary/signed access is used where appropriate.
- [ ] Raw object paths do not grant unrestricted access.
- [ ] Public permanent links are avoided for private documents.

---

# 8. File Categories

V1 supported business documents:

```text
Bills
Invoices
Payment Proofs
Task Attachments
```

Do not create extra file categories without a product need.

---

# 9. File Format Strategy

Supported V1 financial document formats:

```text
PDF
JPG
PNG
```

Where practical:

```text
PDF → preserve original document
JPG/PNG → compress/resize without making text unreadable
```

Do not convert every uploaded file into multiple copies.

---

# 10. File Size Policy

Each upload category should have an explicit maximum file size.

The exact limit should be chosen during implementation based on:

```text
Expected bill/document size
Mobile upload reliability
Storage quota
PDF/report requirements
```

The important rule is:

```text
Reject unreasonable files before they consume excessive storage.
```

---

# 11. Image Optimization

For JPG/PNG:

```text
Resize oversized images
Compress where quality permits
Strip unnecessary metadata where safe
```

Do not reduce resolution so far that:

```text
Bill number
Amount
Date
Vendor information
Payment evidence
```

becomes unreadable.

---

# 12. No Duplicate File Copies

Do not store the same bill/payment proof in multiple application buckets.

Preferred:

```text
One stored object
+
Multiple database references only when genuinely required
```

If the same business record is shown on several screens, do not copy the underlying file.

---

# 13. File Naming Strategy

User-provided filenames must not become the authoritative storage path.

Use an application-controlled object key.

Recommended pattern:

```text
<entity>/<entity_id>/<generated_file_id>
```

Example:

```text
expenses/{expense_id}/{file_id}
```

The exact path format can vary.

---

# 14. File Metadata

Database may store:

```text
File ID
Entity type
Entity ID
Storage object path
Original display filename where useful
MIME/content type
Size
Uploaded by
Uploaded at
```

Do not store unnecessary file metadata.

---

# 15. File Versioning

V1 does not require full document version history.

When a file is replaced:

```text
Replace authorized object/reference
+
record replacement metadata where required
```

Do not create unlimited historical file copies.

---

# 16. Payment Proof Replacement

Finance may replace/delete payment proof where permitted.

Requirements:

- [ ] Correct file is targeted.
- [ ] Authorization is checked.
- [ ] Replacement/deletion is auditable as required.
- [ ] Old file is removed/expired when no longer needed.
- [ ] No orphaned storage object remains unnecessarily.

---

# 17. Bill Replacement

Where business rules permit bill replacement:

```text
Authorized replacement
→ new file validated
→ reference updated
→ old temporary/object copy cleaned up
```

Do not leave stale duplicate files permanently.

---

# 18. Orphaned File Handling

An orphaned file is a storage object no longer referenced by an active database record.

V1 should periodically detect and clean up safe orphaned objects.

Cleanup must be conservative.

Never delete a file solely because a scanner failed to find its reference without validating the business relationship.

---

# 19. Temporary File Storage

Temporary data may include:

```text
Upload staging
Temporary report files
Temporary processing artifacts
```

Temporary files should have controlled expiration/cleanup.

---

# 20. Generated PDF Strategy

Financial/audit PDFs are generated outputs, not the primary source of truth.

Preferred workflow:

```text
Database records
→ Generate PDF
→ Preview/Print/Download
→ Short-lived storage if required
→ Cleanup
```

Do not permanently store every generated report unless there is a defined archival requirement.

---

# 21. PDF Storage Optimization

Avoid:

```text
Generate-and-store every report forever
```

Prefer:

```text
Generate on demand
+
short-lived temporary storage
```

This substantially reduces unnecessary storage growth.

---

# 22. Report Reproducibility

A report should be regenerable from authoritative records.

Therefore:

```text
Database = source of truth
PDF = derived output
```

If an old PDF is needed again, regenerate it from the correct historical data when practical.

---

# 23. Client Cache

Client caching should prioritize:

```text
User experience
+
low bandwidth
```

not become a second database.

Do not cache the entire Masjid dataset on a device.

---

# 24. Mobile Secure Storage

Use platform-secure mechanisms for necessary sensitive client data such as:

```text
Authentication/session credentials
Minimal device state
Approved offline attendance state
```

Do not store:

```text
Full financial database
Full member directory
Full audit database
All private documents
```

locally.

---

# 25. Offline Attendance Storage

V1 offline support is limited mainly to Jummah attendance.

Store only the minimum needed to synchronize:

```text
User/session association
Friday/session identifier
Required attendance context
Pending/sync state
Local created timestamp where needed
```

Do not build a full offline copy of application data.

---

# 26. Offline Data Cleanup

After successful synchronization:

```text
Pending local attendance record
→ mark synchronized
→ remove temporary local state when safe
```

If synchronization fails:

```text
retain only what is necessary for retry
```

---

# 27. Browser Storage

Do not use ordinary browser local storage for:

```text
Service-role secrets
Database passwords
OTP values
Private financial documents
Full financial datasets
```

Use the chosen authentication/session architecture and secure storage mechanisms appropriately.

---

# 28. Database Index Storage

Indexes improve speed but consume storage.

Create indexes for actual query patterns such as:

```text
Member mobile lookup
Donation by member/month
Transaction date
Transaction account
Expense status/date
Task responsible member/status
Meeting date
Attendance member/session
Audit timestamp/entity
```

Avoid indexing every column unnecessarily.

---

# 29. Query Efficiency and Storage

Efficient queries reduce:

```text
CPU usage
network transfer
cache size
unnecessary repeated data
```

Pagination should be used for large lists.

Do not fetch the full history when the screen needs only a page.

---

# 30. Data Duplication Policy

Avoid storing the same authoritative fact in multiple places.

Examples:

Do not maintain separate manually edited:

```text
Account balance
Donation total
Expense paid total
Committee completion total
```

when those can be derived from authoritative records.

Derived summaries may be cached for performance only when their invalidation strategy is well-defined.

---

# 31. Financial History Retention

Must preserve:

```text
Financial transactions
Donation records
Expense history
Payment history
Transfers
Contribution history
Required audit records
```

Do not delete old financial history simply because storage is growing.

---

# 32. Committee History Retention

Must preserve:

```text
Tasks
Progress
Completion records
Meeting decisions
Follow-up tasks
Relevant accountability history
```

Storage optimization must not remove committee performance/accountability history.

---

# 33. Attendance Retention

Retain:

```text
Jummah attendance
Meeting attendance
```

according to the operational/reporting needs.

Do not create unnecessary historical raw location trails.

---

# 34. Audit Storage

Audit records are structured database data.

Do not move audit logs to temporary files just to save database space.

If future scale requires archival, use a controlled archival strategy without weakening audit integrity.

---

# 35. Notification Storage

V1 does not require a notification inbox/history.

Do not permanently store every push message solely because it was sent.

Store only the business state required for:

```text
Notification delivery
Retry
Audit/operational handling where necessary
```

---

# 36. Storage Quota Monitoring

Monitor:

```text
Database size
File storage usage
File growth rate
Egress/transfer
Large object count
Temporary file accumulation
```

The goal is to detect growth before service limits are reached.

---

# 37. Free-Tier Strategy

The initial implementation should prefer the available free/low-cost tiers where acceptable.

Storage decisions:

```text
Use managed database
Use private object storage
Avoid duplicate documents
Avoid permanent generated PDFs
Use image compression
Use periodic cleanup
Monitor quotas
```

Do not assume a free tier is permanently sufficient for production.

---

# 38. Storage Growth Drivers

Most likely V1 storage drivers:

```text
Uploaded bills
Payment proofs
Task attachments
Database history
Audit records
```

Generated PDFs should not become a major storage driver when generated on demand.

---

# 39. Storage Budgeting

During production operation, estimate:

```text
Members per year
Donations per year
Transactions per year
Expenses per year
Average document size
Task attachments per month
Audit events per month
```

Then calculate expected storage growth.

Use real measurements after initial deployment rather than relying only on assumptions.

---

# 40. File Count Optimization

Large numbers of tiny objects can also become operationally expensive.

Therefore:

```text
Upload only necessary documents
Avoid duplicate thumbnails
Avoid generated preview copies unless required
Avoid unnecessary attachment copies
```

---

# 41. No Automatic Permanent PDF Archive

Unless a future business/legal requirement is introduced:

```text
Generated report
≠
permanent stored record
```

The underlying database and financial source records remain authoritative.

---

# 42. Storage Cleanup Jobs

Where platform capability allows, schedule controlled cleanup for:

```text
Expired temporary uploads
Orphaned objects
Temporary generated reports
Stale local sync artifacts where applicable
```

Cleanup must never target authoritative database records.

---

# 43. Safe Cleanup Rules

Before deleting any object:

```text
Check object type
→ check database reference
→ check active business record
→ check retention rule
→ delete only when safe
```

Never use broad “delete files older than X days” logic against financial documents without reference/retention validation.

---

# 44. Storage and Privacy

Storage minimization supports privacy.

Reduce:

```text
Duplicate personal documents
Duplicate financial files
Unnecessary technical logs
Unnecessary location data
Unnecessary client caches
```

---

# 45. Storage and Security

Storage controls must enforce:

```text
Authentication
Authorization
Private access
Secure transport
Secret protection
```

Storage optimization must not create public links as a shortcut.

---

# 46. Storage and Backup

Backup planning must cover:

```text
Database
+
Required private files
```

Do not assume a database backup automatically restores object-storage documents.

---

# 47. Recovery Consistency

After restoration verify:

```text
Database record exists
+
Referenced file exists
+
File is the correct object
+
Authorization remains correct
```

Broken references should be detected.

---

# 48. Storage Failure Handling

If file storage is temporarily unavailable:

```text
Do not silently mark upload successful.
```

Financial/payment records must remain consistent.

Example:

```text
Payment proof upload failed
≠
Payment proof exists
```

The UI should clearly show failed/pending state.

---

# 49. Storage Retry Safety

Repeated file uploads should avoid unnecessary duplicates.

Use controlled upload identifiers/state where practical.

Do not create five permanent copies because the user tapped retry five times.

---

# 50. File Upload Limits

Every upload feature must define:

```text
Allowed types
Maximum size
Maximum quantity
Authorization
Retention
Replacement behavior
```

Do not leave these implicit.

---

# 51. Task Attachment Storage

Task attachments are allowed where applicable.

Use:

```text
Private storage
+
task reference
+
authorized access
```

Do not duplicate the same attachment into the task database record itself.

---

# 52. Photo Storage

Member photos are optional.

Recommended:

```text
One optimized profile photo
```

Do not retain multiple obsolete profile-image versions in V1.

---

# 53. Profile Photo Optimization

Where profile photos are used:

```text
Resize to display requirements
Compress
Strip unnecessary metadata where safe
```

The goal is small, readable profile images.

---

# 54. Storage Access Review

Periodically review:

```text
Storage buckets
Bucket visibility
RLS/storage policies
Large files
Orphaned files
Unused files
Temporary files
```

---

# 55. Database Growth Review

Periodically review:

```text
Table sizes
Index sizes
Audit growth
Historical financial growth
Query performance
```

Do not delete historical financial/work data simply because a table is large.

---

# 56. Archival Strategy

V1 does not require a complex cold-storage archive.

If future scale requires archival:

```text
Define archive scope
→ preserve identifiers
→ preserve auditability
→ preserve reportability
→ secure archive
→ document retrieval
```

Do not move records into an archive that breaks application history.

---

# 57. Storage Cost Escalation

When free/low-cost capacity becomes insufficient:

Preferred order:

```text
Optimize duplicates
→ optimize file sizes
→ clean temporary/orphaned data
→ measure actual growth
→ upgrade storage
```

Do not:

```text
delete required history
```

as the first response.

---

# 58. Storage Incident Checklist

If storage approaches a limit:

- [ ] Measure database usage.
- [ ] Measure file usage.
- [ ] Identify largest objects.
- [ ] Identify temporary files.
- [ ] Identify safe orphaned files.
- [ ] Check generated-report accumulation.
- [ ] Optimize/compress where safe.
- [ ] Remove temporary/orphaned data.
- [ ] Recalculate growth.
- [ ] Upgrade storage if necessary.
- [ ] Preserve required financial/work history.

---

# 59. Storage Acceptance Criteria

V1 storage is acceptable when:

- [ ] Structured business data is stored in the database.
- [ ] Private documents use protected object storage.
- [ ] File types are controlled.
- [ ] File sizes are controlled.
- [ ] Duplicate file copies are minimized.
- [ ] Generated PDFs are not permanently stored by default.
- [ ] Temporary data has cleanup rules.
- [ ] Offline attendance stores only required local state.
- [ ] Full Masjid database is not cached on client devices.
- [ ] Required financial history is retained.
- [ ] Required committee work history is retained.
- [ ] Audit records are retained.
- [ ] Storage usage can be monitored.
- [ ] Backup/recovery includes required files.
- [ ] Storage limits are reviewed before production launch.

---

# 60. Storage Invariants

### Invariant 1

Database records are the authoritative structured source of truth.

### Invariant 2

Private business documents are not public by default.

### Invariant 3

Generated PDFs are derived outputs, not the primary data source.

### Invariant 4

Duplicate documents should not be stored unnecessarily.

### Invariant 5

Temporary files must have cleanup/expiration behavior.

### Invariant 6

Offline attendance must not create a full local database.

### Invariant 7

Financial history must not be deleted for convenience.

### Invariant 8

Committee work history must not be deleted for convenience.

### Invariant 9

Audit records must remain available according to retention rules.

### Invariant 10

Storage cleanup must not delete an object still required by an active record.

### Invariant 11

File upload retry must not create uncontrolled permanent duplicates.

### Invariant 12

Backup strategy must cover both structured data and required private files.

### Invariant 13

Storage optimization must not weaken authorization.

### Invariant 14

Storage optimization must not weaken privacy.

### Invariant 15

A low-cost/free-tier strategy is acceptable only while its actual capacity and recovery characteristics remain sufficient.

---

# 61. Recommended Storage Lifecycle

```text
Create Record
    ↓
Attach File if Required
    ↓
Validate
    ↓
Store Private Object
    ↓
Store Database Reference
    ↓
Use Authorized Access
    ↓
Replace/Delete Only When Permitted
    ↓
Clean Safe Temporary/Orphaned Objects
    ↓
Back Up/Recover as Required
```

---

# 62. Final Storage Strategy

The V1 strategy is:

```text
PostgreSQL
→ authoritative structured records

Private Object Storage
→ required business documents

Client Secure Storage
→ minimal credentials/pending offline state

Temporary Storage
→ short-lived processing only

Generated PDFs
→ on-demand derived outputs

GitHub
→ source code/config templates only
```

The system should remain economical without sacrificing:

```text
Financial transparency
Historical accountability
Privacy
Security
Recoverability
```

---

# 63. Related Documents

- `TECHNOLOGY_STACK.md`
- `BACKEND_FRAMEWORK.md`
- `DATABASE_ARCHITECTURE.md`
- `DATABASE_SCHEMA.md`
- `DATA_RELATIONSHIPS.md`
- `FINANCIAL_DATA_MODEL.md`
- `SECURITY_REQUIREMENTS.md`
- `AUTHORIZATION_MODEL.md`
- `DATA_PRIVACY.md`
- `BACKUP_AND_RECOVERY.md`
- `MONITORING.md`
- `DONATION_SYSTEM.md`
- `PAYMENT_SYSTEM.md`
- `FINANCE_SYSTEM.md`
- `EXPENSE_SYSTEM.md`
- `COMMITTEE_WORK_MANAGEMENT.md`
- `MEETING_MANAGEMENT.md`
- `ATTENDANCE_SYSTEM.md`
- `REPORTING_AND_AUDIT.md`
- `SCREEN_SPECIFICATIONS.md`
- `TESTING_STRATEGY.md`

---

## Document Status

**Storage Strategy — V1 Storage Baseline**

This document defines the V1 approach for storing structured data, private documents, temporary data, client state, generated reports, backups, and historical records while minimizing unnecessary storage consumption.
