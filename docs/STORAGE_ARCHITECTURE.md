# Masjid-e-Mamoor --- Storage Architecture

**Document Status:** Draft --- Architecture Review Required\
**Version:** 1.0\
**Phase:** Documentation-First / Pre-Development\
**Repository:** `MdShabazS/masjid-e-mamoor-2`

------------------------------------------------------------------------

## 1. Purpose

This document defines the storage architecture for Masjid-e-Mamoor.

The storage architecture covers:

-   protected file storage
-   payment proofs
-   financial documents
-   member-related documents where approved
-   committee attachments
-   report/export artifacts where required
-   upload/download authorization
-   file metadata
-   object naming
-   storage lifecycle
-   privacy
-   retention
-   deletion
-   auditability
-   Supabase Storage integration
-   database/RLS relationship
-   web/mobile upload behavior
-   offline limitations

The storage system must never become an independent authorization
system. Every protected object must have an identifiable business owner
or business record and an authorization path.

------------------------------------------------------------------------

# 2. Storage Principles

## STO-001 --- Database Is the Business Authority

Storage objects represent files.

The database represents the business meaning of those files.

A file must not become authoritative merely because it exists in a
bucket.

------------------------------------------------------------------------

## STO-002 --- Private by Default

Sensitive files must use private storage.

Examples include:

-   payment screenshots
-   financial bills
-   receipts
-   identity-related documents
-   internal committee files
-   audit-related attachments

Public storage requires an explicit product decision.

------------------------------------------------------------------------

## STO-003 --- Authorization Before Access

A user must be authorized to access the underlying business record
before receiving a protected file.

------------------------------------------------------------------------

## STO-004 --- No Permanent Public URLs for Sensitive Files

Sensitive objects should not be exposed through permanently public URLs.

Controlled access may use short-lived signed URLs or an equivalent
protected download mechanism.

------------------------------------------------------------------------

## STO-005 --- Metadata in Database

Important metadata should be stored in PostgreSQL rather than inferred
only from object paths.

------------------------------------------------------------------------

## STO-006 --- Object Paths Are Not Authorization

Knowing or guessing an object path must never grant access.

------------------------------------------------------------------------

## STO-007 --- Upload Does Not Mean Acceptance

Uploading a payment proof does not mean:

-   payment verified
-   donation allocated
-   financial transaction posted

Those are separate authoritative business states.

------------------------------------------------------------------------

## STO-008 --- Delete Carefully

Deleting a file must not silently delete the business record that
referenced it.

Business deletion and physical object deletion are separate lifecycle
decisions.

------------------------------------------------------------------------

# 3. Storage Architecture

Conceptual architecture:

``` text
Web / Mobile
      |
      v
Authorization + Storage Service
      |
      +--------------------+
      |                    |
      v                    v
PostgreSQL metadata    Supabase Storage
      |                    |
      +---------+----------+
                |
                v
          Audit / Outbox
```

------------------------------------------------------------------------

# 4. Storage Responsibilities

## Client

Responsible for:

-   selecting files
-   basic UX validation
-   upload progress
-   retry presentation
-   preview where safe

## API/Trusted Layer

Responsible for:

-   authorization
-   file policy
-   metadata creation
-   upload authorization
-   protected download authorization
-   lifecycle decisions

## Database

Responsible for:

-   business relationship
-   ownership
-   metadata
-   lifecycle state
-   audit linkage

## Storage

Responsible for:

-   object bytes
-   object persistence
-   object retrieval

------------------------------------------------------------------------

# 5. Recommended Bucket Model

Bucket names should be stable and business-oriented.

A possible conceptual separation is:

``` text
payment-proofs
financial-documents
committee-files
member-documents
exports
```

The final bucket count must be reviewed against Supabase Storage/RLS
complexity before implementation.

Do not create a bucket for every screen.

------------------------------------------------------------------------

# 6. Payment Proof Bucket

Purpose:

Store evidence associated with payment submissions.

Possible file types:

-   UPI screenshots
-   payment receipts
-   transaction evidence

Access should be limited according to:

-   payment ownership
-   Finance authorization
-   Auditor authorization
-   approved administrative oversight

------------------------------------------------------------------------

# 7. Financial Documents Bucket

Purpose:

Store:

-   bills
-   invoices
-   receipts
-   supporting financial documents
-   approved expense evidence

Access is more restricted than ordinary member content.

------------------------------------------------------------------------

# 8. Committee Files Bucket

Potential contents:

-   meeting documents
-   task attachments
-   approved committee resources

Access follows the committee record and role permissions.

------------------------------------------------------------------------

# 9. Member Documents Bucket

This bucket should only exist if the product explicitly requires
document storage for member records.

Potential examples:

-   approved membership documentation

Sensitive personal documents require strict privacy controls.

The final scope remains a product/security decision.

------------------------------------------------------------------------

# 10. Exports Bucket

Generated reports may require temporary storage.

Examples:

-   CSV
-   PDF
-   spreadsheet-compatible exports

Exports should be:

-   private
-   associated with requesting actor
-   associated with report type
-   time-limited where practical
-   automatically cleaned up according to retention policy

------------------------------------------------------------------------

# 11. Object Naming

Object names should be deterministic enough for organization without
embedding sensitive information.

Conceptual:

``` text
<purpose>/<business-record-id>/<random-object-id>.<extension>
```

Example:

``` text
payment-proofs/<payment-id>/<object-id>.jpg
```

Avoid:

``` text
member-name/
phone-number/
government-id/
```

Do not place sensitive personal information into object paths.

------------------------------------------------------------------------

# 12. Object IDs

Use generated unique object identifiers.

The system should not rely on:

-   original filename
-   member name
-   phone number
-   payment reference
-   predictable sequential filename

for uniqueness.

------------------------------------------------------------------------

# 13. Original Filename

The original filename may be stored as metadata for user experience.

It must not be treated as:

-   a security identifier
-   an authorization key
-   a unique database key

Sanitize display handling.

------------------------------------------------------------------------

# 14. File Metadata

Recommended database metadata may include:

``` text
id
bucket
object_path
business_domain
business_record_type
business_record_id
uploaded_by
original_filename
content_type
size_bytes
checksum
upload_status
created_at
updated_at
deleted_at
```

Only fields actually required by the final product should be
implemented.

------------------------------------------------------------------------

# 15. Storage Metadata vs Business Metadata

Storage metadata describes the object.

Business metadata describes what the file means.

Example:

``` text
storage:
    object_path
    content_type
    size

business:
    payment_id
    proof_type
    submitted_by
```

The business relationship should be authoritative.

------------------------------------------------------------------------

# 16. File Lifecycle

Recommended conceptual lifecycle:

``` text
upload initiated
      |
      v
uploading
      |
      v
uploaded
      |
      v
attached to business record
      |
      v
active
      |
      +------> archived
      |
      +------> marked for deletion
      |
      v
deleted
```

Not every file requires every state.

------------------------------------------------------------------------

# 17. Upload Authorization

Before an upload is permitted:

1.  authenticate user
2.  resolve application user
3.  check account status
4.  check permission
5.  validate business-record access
6.  validate file policy
7.  create upload authorization/metadata
8.  upload object
9.  finalize attachment

------------------------------------------------------------------------

# 18. Upload Does Not Authorize Business Mutation

For example:

``` text
upload payment screenshot
```

does not automatically mean:

``` text
verify payment
```

The Finance workflow remains separate.

------------------------------------------------------------------------

# 19. Upload Strategies

Possible strategies:

### Strategy A --- Direct Signed Upload

Server authorizes a short-lived upload target.

Client uploads directly to storage.

### Strategy B --- Server-Proxied Upload

Client sends file through application server.

### Strategy C --- Storage Client + RLS

Client uploads using authenticated Supabase Storage policies.

The final strategy must be selected after reviewing file size, security,
mobile behavior, and current Supabase capabilities.

------------------------------------------------------------------------

# 20. Recommended Initial Direction

Prefer a protected direct-upload approach where current platform
capabilities support it safely.

The server should first authorize the intended object/business
relationship.

The client should not be able to choose an arbitrary protected object
path.

------------------------------------------------------------------------

# 21. Upload Completion

After bytes are uploaded, the system should verify the expected object
and finalize metadata.

Conceptual:

``` text
create upload intent
       |
       v
upload bytes
       |
       v
complete upload
       |
       v
verify object
       |
       v
attach metadata
```

A failed completion must not create a misleading business attachment.

------------------------------------------------------------------------

# 22. Partial Uploads

The system must define behavior for:

-   interrupted upload
-   browser close
-   mobile app termination
-   network loss
-   duplicate upload
-   abandoned upload

Temporary objects should not accumulate indefinitely.

------------------------------------------------------------------------

# 23. Upload Size Limits

Each business file category should have a defined maximum size.

Example policy categories:

``` text
payment proof
financial document
committee attachment
member document
report export
```

Exact limits remain an implementation/product decision.

------------------------------------------------------------------------

# 24. Content-Type Validation

Do not trust only the client-provided MIME type.

The server/storage workflow should validate supported formats as far as
practical.

Potential allowed categories:

``` text
image/jpeg
image/png
application/pdf
```

Additional formats require explicit approval.

------------------------------------------------------------------------

# 25. Extension Validation

File extensions should not be treated as proof of content type.

The system should reject unsupported extensions and, where practical,
inspect actual content.

------------------------------------------------------------------------

# 26. Malware and Unsafe File Handling

If the deployment requires arbitrary document uploads, a malware/content
scanning strategy should be considered.

Until such a system exists, minimize accepted file types and size.

Do not allow executable files for ordinary business workflows.

------------------------------------------------------------------------

# 27. Image Handling

For image uploads:

-   validate dimensions where practical
-   enforce file-size limits
-   avoid unnecessary originals if policy permits
-   preserve evidence quality for payment proofs
-   generate thumbnails only where useful

Payment evidence must remain readable.

------------------------------------------------------------------------

# 28. Image Compression

Do not automatically compress financial evidence in a way that makes:

-   transaction IDs
-   dates
-   amounts
-   names
-   reference numbers

unreadable.

If optimization is introduced, retain an authoritative evidence copy or
verify the optimized result.

------------------------------------------------------------------------

# 29. PDF Handling

PDF uploads should have:

-   size limits
-   content-type checks
-   safe download behavior
-   private access

PDF preview should not bypass authorization.

------------------------------------------------------------------------

# 30. Download Authorization

A protected download should follow:

``` text
request file
   |
   v
authenticate
   |
   v
authorize business record
   |
   v
generate short-lived access
   |
   v
download
```

------------------------------------------------------------------------

# 31. Signed URL Policy

If signed URLs are used:

-   keep expiration short
-   do not store them permanently as business data
-   generate only after authorization
-   avoid exposing them in logs
-   never treat the URL itself as permission

Exact expiry duration should be configurable.

------------------------------------------------------------------------

# 32. Storage RLS

Supabase Storage policies must enforce protected access.

Policies should be designed around:

-   authenticated identity
-   application authorization
-   object/business relationship
-   allowed operation
-   bucket

Do not implement broad policies such as:

``` text
authenticated users can read everything
```

------------------------------------------------------------------------

# 33. Database RLS Relationship

Storage authorization may need business metadata from PostgreSQL.

Conceptually:

``` text
storage object
     |
     v
storage metadata
     |
     v
business record
     |
     v
authorization
```

The exact SQL/policy design must be verified against current Supabase
documentation before implementation.

------------------------------------------------------------------------

# 34. Payment Proof Privacy

A member may view their own payment evidence where permitted.

Finance may view evidence required for verification.

Auditor may view evidence required by oversight permissions.

Other members must not gain access.

------------------------------------------------------------------------

# 35. Anonymous Donation Privacy

If a donation is anonymous, file access must not expose donor identity
to users who are not authorized to see it.

The storage object itself must not encode the donor name.

------------------------------------------------------------------------

# 36. Financial Document Privacy

Bills and receipts may contain:

-   vendor information
-   amounts
-   account details
-   internal notes

Access must follow finance/audit permissions.

------------------------------------------------------------------------

# 37. Member Document Privacy

If member documents are supported, access should be explicitly scoped.

A Committee Member should not automatically receive access merely
because they can view committee records.

------------------------------------------------------------------------

# 38. Committee Attachment Privacy

Committee files should inherit authorization from the relevant committee
record where appropriate.

The exact access model depends on whether the file is:

-   public committee material
-   internal committee material
-   finance-related
-   member-sensitive

------------------------------------------------------------------------

# 39. File Ownership

Every protected object should have a business relationship.

Possible ownership models:

``` text
user-owned
member-owned
payment-owned
expense-owned
meeting-owned
task-owned
report-owned
```

The object metadata should make the relationship unambiguous.

------------------------------------------------------------------------

# 40. Orphan Detection

The system should periodically identify objects that have:

-   no metadata
-   metadata without business record
-   failed upload status
-   expired temporary upload
-   deleted business record

Orphan cleanup must be conservative.

------------------------------------------------------------------------

# 41. Safe Cleanup

Cleanup should not delete an object merely because a temporary query
cannot find its parent.

Use explicit lifecycle states and retention periods.

------------------------------------------------------------------------

# 42. Business Record Deletion

Deleting a business record does not automatically imply immediate
physical deletion.

Depending on retention requirements:

``` text
business record deleted/archived
        |
        v
file retained
        |
        v
retention expiry
        |
        v
physical deletion
```

------------------------------------------------------------------------

# 43. Financial Evidence Retention

Financial evidence may need longer retention than ordinary attachments.

The exact retention period must be decided with the mosque's
operational/accounting requirements.

Do not invent a legal retention period without a verified
jurisdiction-specific requirement.

------------------------------------------------------------------------

# 44. Auditability

Important file events should be auditable:

-   upload initiated
-   upload completed
-   attachment created
-   download/access authorization
-   replacement
-   deletion
-   retention cleanup

Do not log raw file contents.

------------------------------------------------------------------------

# 45. Audit Metadata

Useful event information:

``` text
actor
action
object/business record
timestamp
request ID
operation ID
result
```

Avoid storing:

-   signed URLs
-   file contents
-   unnecessary personal data

in audit logs.

------------------------------------------------------------------------

# 46. File Replacement

Replacement should be explicit.

Example:

``` text
replacePaymentProof(paymentId, oldFileId, newFile)
```

The system should preserve appropriate history.

Do not silently overwrite evidence if auditability requires historical
preservation.

------------------------------------------------------------------------

# 47. Multiple Files

A business record may support multiple files.

Examples:

``` text
payment:
    screenshot
    bank receipt

expense:
    bill
    invoice
    approval document
```

Each attachment should have a defined type/category.

------------------------------------------------------------------------

# 48. Primary Attachment

If one file is designated primary, that state belongs in business
metadata.

Do not infer the primary file from:

-   first upload
-   filename
-   object creation order

------------------------------------------------------------------------

# 49. Duplicate Files

The system may use:

-   operation IDs
-   checksums
-   business-level uniqueness

to reduce accidental duplicate uploads.

Duplicate detection should not prevent legitimate identical evidence
when business context differs.

------------------------------------------------------------------------

# 50. Checksum

Where practical, store a checksum for:

-   duplicate detection
-   integrity verification
-   upload completion validation

The checksum is metadata, not a security authorization mechanism.

------------------------------------------------------------------------

# 51. Mobile Storage Behavior

Mobile uploads must account for:

-   interrupted network
-   background restrictions
-   app termination
-   limited connectivity
-   large file sizes

The mobile app should not assume an upload continues indefinitely after
the app leaves the foreground.

------------------------------------------------------------------------

# 52. Web Storage Behavior

Web uploads should account for:

-   browser cancellation
-   tab closure
-   network interruption
-   retry
-   duplicate submissions

The UI should show explicit upload state.

------------------------------------------------------------------------

# 53. Offline Storage

Files should not automatically become offline-synchronized business
objects.

Offline support may allow:

-   local draft selection
-   queued upload intent
-   temporary local evidence

but final upload/attachment must be reconciled with the server.

------------------------------------------------------------------------

# 54. Offline Payment Proof

If the product permits capturing proof offline:

``` text
capture locally
     |
     v
store encrypted/local-private temporary file
     |
     v
queue upload
     |
     v
reconnect
     |
     v
server authorization
     |
     v
upload
     |
     v
attach
```

The final payment verification remains online/trusted.

------------------------------------------------------------------------

# 55. Local File Security

Mobile/local temporary files should be protected using
platform-supported secure mechanisms where practical.

Do not place sensitive files into publicly accessible application
directories.

------------------------------------------------------------------------

# 56. File Preview

Preview must enforce the same authorization as download.

A thumbnail is still sensitive information.

Do not expose preview URLs publicly merely to simplify UI development.

------------------------------------------------------------------------

# 57. Caching

Sensitive files should have conservative client/browser caching.

Avoid persistent shared browser caches for private evidence.

Mobile cached files should have controlled lifecycle.

------------------------------------------------------------------------

# 58. Access Revocation

When:

-   a user's role changes
-   membership is deactivated
-   permission is removed
-   a financial oversight role is revoked

future storage authorization must reflect the new state.

Existing signed URLs may remain valid until expiry, so expiry must be
appropriately short for sensitive content.

------------------------------------------------------------------------

# 59. Role-Specific Storage Access

### President / Super Admin

Access according to highest approved administrative permissions, subject
to sensitive-data controls.

### Vice President

Access only authorized administrative/operational records.

### Secretary

Access secretary/committee-related files and other explicitly granted
areas.

### Finance

Access financial evidence required for finance operations.

### Auditor

Read-oriented access to authorized financial/audit evidence.

### Committee Member

Access only files associated with authorized committee work.

### Member

Access own authorized files and files explicitly shared with the member.

------------------------------------------------------------------------

# 60. Storage and Separation of Duties

Storage access must not undermine financial separation.

For example, access to a payment proof does not imply permission to:

-   verify payment
-   alter allocation
-   create financial correction

File permission and financial mutation permission remain separate.

------------------------------------------------------------------------

# 61. Storage and Realtime

Storage object creation/deletion may update database metadata.

Realtime clients should primarily subscribe to business metadata/state.

Clients should not treat storage bucket listing as the source of truth
for business state.

------------------------------------------------------------------------

# 62. Storage Events

If storage events are required, they should be correlated to business
records.

Example:

``` text
payment_proof_attached
```

rather than exposing raw storage events directly to every client.

------------------------------------------------------------------------

# 63. Notification Integration

Important storage-related events may produce notifications:

-   proof rejected because unreadable
-   required document missing
-   upload failed
-   document requested

Notifications should originate from trusted server/outbox workflows.

------------------------------------------------------------------------

# 64. Storage and Reports

Reports may reference:

-   document availability
-   proof status
-   attachment counts

but should not automatically expose protected download links to
unauthorized users.

------------------------------------------------------------------------

# 65. Export Security

Generated exports may contain more data than individual pages.

Therefore:

-   authorize export separately
-   scope filters server-side
-   create private export object
-   associate export with requester
-   expire/clean up appropriately

------------------------------------------------------------------------

# 66. File Access Through API

For highly sensitive documents, an application-level download endpoint
may be preferable to directly returning storage paths.

Conceptual:

``` text
GET protected file
       |
       v
authorization
       |
       v
short-lived access
```

The final choice depends on Supabase Storage capabilities and
performance requirements.

------------------------------------------------------------------------

# 67. Storage Policy Testing

Test:

-   unauthenticated access
-   wrong member
-   wrong payment
-   wrong finance role
-   revoked role
-   expired signed URL
-   guessed object path
-   deleted business record
-   anonymous donation
-   cross-bucket access
-   upload without permission
-   oversized file
-   unsupported type

------------------------------------------------------------------------

# 68. Storage Integration Testing

Test full workflows:

``` text
upload
 -> metadata
 -> business attachment
 -> authorized read
 -> unauthorized read rejected
 -> replacement
 -> audit
 -> cleanup
```

------------------------------------------------------------------------

# 69. Storage Failure Handling

Handle:

-   upload failure
-   storage unavailable
-   metadata transaction failure
-   timeout
-   duplicate completion
-   expired upload authorization

The UI should distinguish:

``` text
upload failed
```

from:

``` text
business operation failed
```

when possible.

------------------------------------------------------------------------

# 70. Metadata Transaction Safety

Where upload and metadata creation cannot be one physical transaction,
use explicit states.

Example:

``` text
PENDING_UPLOAD
UPLOADED
ATTACHED
FAILED
EXPIRED
```

Do not represent an object as fully attached before successful
completion.

------------------------------------------------------------------------

# 71. Storage and Idempotency

Upload completion should support idempotent behavior.

If the client retries:

``` text
completeUpload(operationId)
```

the server should avoid creating duplicate attachment records.

------------------------------------------------------------------------

# 72. Storage Authorization Matrix

  ----------------------------------------------------------------------------
  Object      Member       Committee    Finance      Auditor      Admin
  ----------- ------------ ------------ ------------ ------------ ------------
  Own payment Own          No           Authorized   Authorized   Authorized
  proof                                                           

  Other       No           No           Authorized   Authorized   Authorized
  payment                                                         
  proof                                                           

  Finance     No           If           Authorized   Authorized   Authorized
  bill                     explicitly                             
                           shared                                 

  Committee   If shared    Authorized   If shared    If           Authorized
  file                     scope                     authorized   scope

  Own member  Own          No by        No by        No by        Authorized
  document                 default      default      default      scope

  Export      Own          Own          Own          Own          Authorized
              authorized   authorized   authorized   authorized   scope
              export       export       export       export       
  ----------------------------------------------------------------------------

This table is a conceptual policy map. Final permissions must align with
the approved role-permission matrix and RLS implementation.

------------------------------------------------------------------------

# 73. Storage Naming Security

Never encode sensitive facts into object paths.

Avoid:

``` text
finance/president-name/...
member/phone-number/...
donor-name/...
```

Prefer opaque identifiers.

------------------------------------------------------------------------

# 74. Bucket Exposure

Buckets containing protected data should remain private.

Public buckets should be exceptional and documented.

A public object must not contain data that the product considers
confidential.

------------------------------------------------------------------------

# 75. Environment Separation

Development, staging, and production storage must be separated.

Do not allow development clients to point at production storage.

Environment variables must identify the correct Supabase project.

------------------------------------------------------------------------

# 76. Test Data

Test environments should use synthetic data.

Do not upload real member/payment documents into development merely for
convenience.

------------------------------------------------------------------------

# 77. Backup Considerations

Storage backup/recovery must be considered separately from database
backup.

A database backup containing object metadata does not automatically
guarantee recovery of object bytes.

The final backup architecture must cover both.

------------------------------------------------------------------------

# 78. Recovery

Recovery testing should answer:

-   Can metadata be restored?
-   Can file objects be restored?
-   Can business relationships be reconstructed?
-   Are object paths stable?
-   Are deleted files recoverable during retention?
-   Are signed URLs regenerated after recovery?

------------------------------------------------------------------------

# 79. Retention Policy

The project should define retention classes.

Conceptually:

``` text
temporary upload
short-lived export
ordinary attachment
financial evidence
audit-supporting evidence
```

Each class should have an explicit lifecycle.

------------------------------------------------------------------------

# 80. Legal/Regulatory Considerations

Retention and deletion requirements may depend on:

-   applicable law
-   financial/accounting practices
-   organizational policy
-   privacy requirements

This architecture does not assume a specific legal retention period.

Such requirements must be verified before implementation if they apply.

------------------------------------------------------------------------

# 81. Privacy by Design

Storage should follow:

-   least privilege
-   minimum necessary collection
-   minimum necessary retention
-   private-by-default access
-   controlled sharing
-   auditable sensitive access

------------------------------------------------------------------------

# 82. Data Minimization

Do not store documents merely because the system can.

Before adding a file category ask:

1.  Why is it required?
2.  Who needs it?
3.  How long is it needed?
4.  What happens if it leaks?
5.  Can metadata replace the document?
6.  Can the workflow operate without it?

------------------------------------------------------------------------

# 83. Storage Cost Management

Control:

-   maximum file size
-   duplicate uploads
-   abandoned uploads
-   export retention
-   unnecessary thumbnails
-   old temporary objects

Do not optimize cost by weakening financial evidence retention.

------------------------------------------------------------------------

# 84. Storage Monitoring

Monitor:

-   storage usage
-   upload failure rate
-   orphan count
-   oversized uploads
-   access errors
-   signed URL failures
-   cleanup failures

------------------------------------------------------------------------

# 85. Operational Alerts

Potential alerts:

``` text
storage usage threshold
cleanup job failure
abnormal upload failure spike
unexpected public exposure
large orphan growth
```

Thresholds should be configured after deployment baseline measurements.

------------------------------------------------------------------------

# 86. Storage Documentation

Every production bucket must document:

-   purpose
-   sensitivity
-   owner
-   allowed file types
-   maximum size
-   retention
-   access roles
-   object naming
-   RLS/storage policy
-   cleanup process
-   recovery process

------------------------------------------------------------------------

# 87. Storage Implementation Checklist

Before implementation:

-   [ ] Finalize bucket list
-   [ ] Finalize allowed file categories
-   [ ] Finalize file size limits
-   [ ] Finalize MIME/type rules
-   [ ] Finalize object naming
-   [ ] Finalize metadata schema
-   [ ] Finalize upload lifecycle
-   [ ] Finalize download strategy
-   [ ] Finalize signed URL duration
-   [ ] Finalize storage policies
-   [ ] Finalize retention classes
-   [ ] Finalize cleanup strategy
-   [ ] Finalize audit events
-   [ ] Finalize backup/recovery
-   [ ] Verify current Supabase Storage documentation

------------------------------------------------------------------------

# 88. Storage Acceptance Criteria

The storage architecture is implementation-ready when:

1.  Every protected file category has an owner.
2.  Every object has a business relationship.
3.  Storage is private by default.
4.  Upload authorization is defined.
5.  Download authorization is defined.
6.  Object paths cannot grant access.
7.  Metadata ownership is defined.
8.  File lifecycle is defined.
9.  Financial evidence lifecycle is defined.
10. Retention policy is defined or explicitly marked pending.
11. RLS/storage policy boundaries are defined.
12. Web/mobile behavior is defined.
13. Offline behavior is defined.
14. Audit requirements are defined.
15. Recovery requirements are defined.
16. Storage tests are defined.

------------------------------------------------------------------------

# 89. Open Decisions

  Decision                              Status
  ------------------------------------- ------------------------------
  Exact bucket names                    Review
  Exact bucket count                    Review
  Maximum file sizes                    Open
  Accepted MIME types                   Open
  Direct vs proxied upload              Open
  Signed URL expiry                     Open
  Malware scanning                      Open
  Thumbnail generation                  Open
  Retention periods                     Open
  Export retention                      Open
  Physical deletion workflow            Open
  Backup provider/strategy              Open
  Storage access function design        Open
  Exact Supabase Storage RLS policies   Verify during implementation

------------------------------------------------------------------------

# 90. Implementation Order

1.  Review product file requirements
2.  Review database attachment model
3.  Review RLS/security model
4.  Verify current Supabase Storage capabilities
5.  Finalize bucket structure
6.  Finalize metadata schema
7.  Implement storage policies
8.  Implement upload authorization
9.  Implement upload completion
10. Implement protected download
11. Implement attachment lifecycle
12. Implement audit events
13. Implement cleanup
14. Implement tests
15. Verify web uploads
16. Verify mobile uploads
17. Verify unauthorized access
18. Verify recovery behavior

------------------------------------------------------------------------

# 91. Change Control

Any change to storage must review:

-   product requirements
-   business rules
-   database architecture
-   RLS security
-   authentication
-   API domain architecture
-   realtime
-   offline sync
-   privacy
-   backup/recovery

A new file category is a security/data-retention change and must not be
added casually.

------------------------------------------------------------------------

# 92. Status

**Current status: Storage architecture generated for review.**

This document intentionally leaves platform-specific storage API details
and final policy syntax for implementation after current official
Supabase documentation is verified.

The storage design must remain subordinate to the approved database,
RLS, API, privacy, and business-rule documents.
