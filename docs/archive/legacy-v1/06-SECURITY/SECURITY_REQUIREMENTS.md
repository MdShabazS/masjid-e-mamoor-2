# Masjid-e-Mamoor 2 — Security Requirements

**Document Status:** V1 Security Baseline  
**Version:** 1.0  
**Product:** Masjid-e-Mamoor 2 Internal Management Application  
**Scope:** V1  
**Platforms:** Web, Android, iOS  
**Related Documents:** SECURITY_ARCHITECTURE.md, AUTHORIZATION_MODEL.md, DATA_PRIVACY.md, AUTHENTICATION.md, AUDIT_LOG_MODEL.md, DATABASE_SCHEMA.md  
**Last Updated:** 2026-09-17

---

# 1. Purpose

This document defines the security requirements for Masjid-e-Mamoor 2.

The application handles internal Masjid records, member information, attendance information, donation/payment information, financial transactions, expense documents, committee work records, and audit records.

Security requirements therefore apply to:

- Authentication
- Authorization
- Database access
- API/backend operations
- Financial integrity
- File storage
- GPS attendance
- Notifications
- Devices and sessions
- Audit logging
- Privacy
- Backups and recovery
- Operational security

---

# 2. Security Objectives

The system must preserve:

### Confidentiality

Only authorized users can access protected Masjid information.

### Integrity

Records, especially financial records and accountability history, cannot be altered by unauthorized users or client-side manipulation.

### Availability

Authorized users should be able to access core functions during normal operation.

### Accountability

Important actions must be attributable to an authenticated actor where technically applicable.

### Traceability

Financial and administrative changes must remain traceable.

---

# 3. Security Priorities

The following priorities apply to V1:

1. Financial integrity
2. Authentication and authorization
3. Protection of personal/member information
4. Protection of financial documents
5. Auditability
6. Secure attendance validation
7. Secure notifications
8. Device/session protection
9. Availability and recovery

---

# 4. Security Boundary

The trusted business logic resides on the backend/database layer.

The following are untrusted:

```text
Web client
Mobile client
Browser storage
User-entered values
Client-side role values
Client-side amount calculations
Client-side attendance decisions
Payment-link completion callbacks from the client
Uploaded filenames/content
Notification payloads
```

The server must independently validate security-sensitive operations.

---

# 5. Authentication Requirements

## 5.1 Phone OTP

Authentication uses:

```text
Mobile number
+
One-time password (OTP)
```

Requirements:

- OTP verification must be performed by the authentication service.
- OTP must have a limited validity period.
- OTP reuse must not be allowed after successful verification.
- OTP attempts must be rate-limited.
- OTP resend attempts must be rate-limited.
- Authentication errors must not disclose unnecessary account information.
- Sensitive auth events should be logged where appropriate.

---

# 6. Session Requirements

After authentication:

- Session tokens must be handled using supported secure mechanisms.
- Sensitive session credentials must not be stored in insecure plain-text storage.
- Session expiry/revocation must be supported.
- Logout must invalidate the application session appropriately.
- A user who becomes disabled must lose protected access.
- Session restoration must re-check authorization.

---

# 7. Client Storage Requirements

Do not store the following in ordinary insecure storage:

```text
Authentication tokens
Sensitive financial information
Private file URLs
Security secrets
OTP values
Service-role credentials
Database administrator credentials
```

Platform-secure storage should be used for necessary device credentials/tokens.

---

# 8. Authorization Requirements

Authorization must be enforced server-side.

The client must never be trusted to determine:

```text
Who is President
Who is Finance
Who is Auditor
Who can edit a transaction
Who can verify a payment
Who can delete a financial record
Who can change a contribution
Who can access an audit record
```

The server must derive access from authoritative user/role data.

---

# 9. Role Security

V1 roles:

```text
President
Vice President
Secretary
Finance
Auditor
Committee Member
Member
```

Role assignment must be protected.

Only authorized administrators may create/change roles according to the role model.

A client-side role field must not be sufficient to elevate privileges.

---

# 10. Privilege Escalation Prevention

The backend must reject unauthorized attempts such as:

```text
Member → Finance
Committee Member → President
Auditor → Financial Editor
Secretary → President
```

A user must not be able to modify their own role through a normal client request.

---

# 11. Database Security

PostgreSQL Row Level Security (RLS) must be used wherever applicable.

Requirements:

- Protected tables must have explicit access policies.
- Default-deny behavior should be preferred.
- Policies must be tested for every role.
- Direct database access must not bypass required authorization.
- Service-level privileged operations must run only in trusted server-side environments.

---

# 12. Backend Security

All security-sensitive operations must execute through trusted backend paths.

Examples:

```text
Payment verification
Financial transaction creation
Financial correction
Financial deletion
Expense payment posting
Account transfers
Contribution changes
Role changes
Attendance acceptance
Referral attribution correction
Audit event creation
```

---

# 13. Input Validation

All user input must be validated server-side.

Validate:

```text
Type
Required fields
Length
Format
Range
Enum/status
Relationships
Authorization
Business constraints
```

Use shared schema validation where practical.

Client-side validation is for usability only and does not replace server validation.

---

# 14. Output and Data Exposure

Responses should return only data needed by the requesting role.

Do not expose:

```text
Unnecessary member personal data
Private file credentials/keys
Raw internal security metadata
Sensitive GPS information
Authentication secrets
Service credentials
Internal database connection details
```

---

# 15. Financial Security Requirements

Financial records are the highest-integrity data in V1.

The backend must enforce:

- Unique financial transaction IDs.
- Unique transfer IDs for internal transfers.
- Exact monetary arithmetic using appropriate numeric/decimal database types.
- Server-side balance calculations.
- Transactional posting of related financial changes.
- Authorization on every financial mutation.
- Permanent deletion authority limited to President.
- Required reasons where business rules require them.
- Audit logging for material financial changes.
- Historical records must not be silently rewritten.

---

# 16. Financial Amount Integrity

Never trust a client-provided calculated balance.

Examples:

```text
Current balance
Outstanding contribution
Paid amount
Remaining expense amount
Closing balance
```

must be derived from authoritative database data.

---

# 17. Financial Concurrency

Concurrent financial operations must be handled safely.

Examples:

```text
Two users posting payments
Two users recording expenses
Two transfers involving the same account
Two verification attempts
```

Backend/database transactions must prevent inconsistent state.

---

# 18. Financial Idempotency

Critical financial mutations should be idempotent where appropriate.

Repeated requests caused by:

```text
Double tap
Network retry
App retry
Browser refresh
Timeout retry
```

must not create duplicate financial postings.

---

# 19. Transaction Deletion

Financial deletion is restricted to the President.

Requirements:

- Strong authorization check.
- Explicit confirmation.
- Clear display of transaction being deleted.
- Audit event.
- Balance recalculation after successful deletion.
- Related transaction relationships must remain consistent.
- No client-only deletion.

---

# 20. Financial Correction

Financial corrections must:

- Identify the existing transaction.
- Use the same transaction ID where required by the finance design.
- Require authorized actor.
- Require correction reason.
- Preserve resulting historical/audit context.
- Update balances correctly.
- Use a database transaction.

---

# 21. Expense Security

Expense security requirements:

- Finance is the operational financial controller.
- Bill is required before an expense is considered fully paid.
- Payment proof is required before a payment makes the expense Paid.
- Multiple payments must be tied to the correct expense.
- Total payments cannot exceed the expense amount.
- Expense amount corrections require authorization and reason.
- Cancellation requires required reason.
- Unauthorized users cannot modify payment records.

---

# 22. Payment Verification Security

Payment request generation does not equal payment verification.

The system must distinguish:

```text
Payment link created
Payment link opened
Payment attempted
Payment reference supplied
Payment verified
```

Only authorized Finance verification may make the payment an authoritative verified donation/payment.

---

# 23. UPI Security

Requirements:

- Only one active Masjid UPI ID exists in V1.
- Only authorized Finance users may change it.
- UPI ID changes are audit logged.
- Historical transactions retain historical context.
- Client-generated payment parameters must be validated server-side.
- The system must not treat a UPI deep-link return/open event as proof of payment.

---

# 24. Donation Security

Expected monthly contributions must be separated from actual verified payments.

The system must never treat:

```text
Expected
Pending
Outstanding
Payment link generated
```

as equivalent to:

```text
Verified money received
```

---

# 25. Donation Allocation Security

For combined outstanding payment:

- Server determines eligible outstanding months.
- FIFO allocation is authoritative.
- Partial monthly payment does not mark a month complete.
- Overpayment is separated into General Donation as defined by product rules.
- Future monthly dues must not be silently reduced.
- Each historical monthly record remains intact.

---

# 26. Referral Attribution Security

Referrer attribution must be protected.

Requirements:

- One primary referrer per member in V1.
- Duplicate mobile numbers must not create duplicate members.
- Referral correction requires authorized access.
- Referrer correction is audit logged.
- Contribution attribution must use verified financial records only.

---

# 27. Committee Work Security

Task security must enforce:

- Only authorized users can create tasks.
- Direct assignment must reference a valid eligible user.
- Open task claiming must be atomic.
- Only one eligible member can successfully claim an open task.
- Completion must identify the responsible actor.
- Committee members cannot delete completed work.
- Edits to completed work must be restricted.
- Material edits must be auditable.
- Task attachments must respect file access controls.

---

# 28. Meeting Security

Meeting records are internal operational data.

Requirements:

- Only authorized internal users can create/edit meetings.
- Meeting attendance is restricted to authorized participants/roles.
- Decisions must be protected from unauthorized modification.
- Follow-up tasks must retain links to the originating meeting/decision.
- Meeting history must remain traceable.

---

# 29. Attendance Security

V1 attendance contains:

```text
Jummah attendance
Scheduled committee meeting attendance
```

Removed from V1:

```text
Daily prayer attendance
Continuous location tracking
Prayer-by-prayer GPS analytics
```

---

# 30. GPS Attendance Security

For Jummah attendance:

- Current location is requested only for the attendance action.
- No continuous tracking.
- Backend validates the submitted location against Masjid attendance rules.
- GPS accuracy should be evaluated.
- Radius validation must occur server-side.
- Duplicate attendance must be rejected.
- One member + one Friday = one accepted record.
- Raw GPS coordinates should not be shown to normal members.
- GPS data retention should be minimized to what is necessary for validation/audit.

---

# 31. Offline Attendance Security

Offline attendance must not become an unrestricted offline authorization mechanism.

Requirements:

- Offline records are marked pending locally.
- The server remains authoritative.
- Synchronization validates the same attendance rules.
- Duplicate submissions are rejected safely.
- Conflicting synchronization results must not silently overwrite accepted attendance.
- Secure local storage should be used for pending attendance data where necessary.

---

# 32. Meeting Attendance Security

Meeting attendance must be linked to a scheduled meeting.

Requirements:

- One member + one meeting = one attendance record.
- Attendance cannot be fabricated by changing a meeting ID on the client.
- Server verifies meeting existence and attendance eligibility.
- Correction rights follow authorization rules.

---

# 33. File Upload Security

Protected file uploads include:

```text
Expense bills
Payment proofs
Task attachments where applicable
```

Requirements:

- File type must be validated.
- File size must be limited.
- File names must not be trusted.
- Storage paths must not be user-controlled in an unsafe way.
- Access must be protected.
- Public permanent links should not be used for private files.
- Uploaders must be authorized.
- Replacement/deletion must enforce authorization.

---

# 34. File Type Requirements

V1 financial documents may support:

```text
PDF
JPG
PNG
```

Do not rely solely on filename extension.

Where practical, validate detected content type as well.

---

# 35. File Access

Private documents must be served through authorized access mechanisms.

A user who can view an expense does not automatically gain unrestricted access to every private storage object unless authorization permits it.

---

# 36. File Replacement and Deletion

Where replacement/deletion is allowed:

- Verify actor authorization.
- Verify file belongs to the intended record.
- Record who and when.
- Preserve financial/transactional integrity.
- Do not expose old private URLs unnecessarily.

---

# 37. Notification Security

Notifications must contain minimal sensitive information.

Avoid including:

```text
Full financial account details
Sensitive member data
Raw GPS coordinates
Authentication tokens
Private document links without access controls
```

Notification should generally provide:

```text
Event type
Minimal context
Safe deep link
```

---

# 38. Deep-Link Security

A notification deep link must never bypass authorization.

When opened:

```text
Authenticate
→ authorize
→ fetch current record
→ render if permitted
```

Do not assume that receiving the notification grants access.

---

# 39. SMS/WhatsApp Security

External messaging providers are treated as separate trust boundaries.

Requirements:

- Provider credentials remain server-side.
- Do not put secrets in the app.
- Minimize sensitive message content.
- Do not treat message delivery as payment verification.
- Delivery failures must not corrupt business records.
- Provider-specific security requirements must be documented before production integration.

---

# 40. API Security

API/backend endpoints should:

- Authenticate requests.
- Authorize operations.
- Validate all input.
- Rate-limit abuse-sensitive operations.
- Return safe errors.
- Avoid leaking internal stack traces.
- Use HTTPS in all production environments.
- Reject malformed or unauthorized requests.

---

# 41. Rate Limiting

Rate limiting should protect at minimum:

```text
OTP requests
OTP verification attempts
Login attempts
Passwordless/authentication abuse endpoints
Payment-related endpoints
Financial mutations
File upload endpoints
Publicly reachable API endpoints if any
```

---

# 42. Error Handling

Production errors must not expose:

```text
Database credentials
SQL statements
Stack traces
Internal service URLs
Secrets
Sensitive member data
```

User-facing messages should be understandable and actionable.

Detailed diagnostic information belongs in protected server logs.

---

# 43. Secrets Management

Never commit secrets to Git.

Examples:

```text
Supabase service role key
JWT signing secrets
SMS/WhatsApp API credentials
Expo/FCM credentials
Database credentials
Third-party API keys
```

Use environment/secret management facilities.

---

# 44. Frontend Security

The frontend must assume it can be modified by a malicious user.

Therefore:

```text
Hidden button ≠ authorization
Disabled button ≠ authorization
Role in local state ≠ authorization
Local amount calculation ≠ financial truth
```

All sensitive actions require server enforcement.

---

# 45. XSS Prevention

User-entered text may include:

```text
Task descriptions
Comments
Meeting agenda/minutes
Member notes
Expense descriptions
```

Render safely.

Do not inject unsanitized HTML.

---

# 46. Injection Prevention

Use parameterized queries and trusted database APIs.

Never build SQL queries by concatenating raw user input.

Validate filter/sort fields against allowed server-side values.

---

# 47. CSRF and Request Security

Web state-changing requests must use appropriate framework/backend protections.

Authentication/session architecture should avoid exposing privileged operations through unsafe cross-site requests.

---

# 48. CORS Security

Production CORS policy should allow only intended origins.

Do not use unrestricted cross-origin access for privileged APIs unless explicitly required and secured.

---

# 49. Administrative Security

President-level operations require additional care.

Examples:

```text
Role changes
Financial deletion
Attendance configuration
Expense category administration
Financial corrections
```

The application should use clear confirmation for material actions.

---

# 50. Audit Logging Requirements

Audit logs must record important administrative/security/financial actions.

At minimum capture where applicable:

```text
Event ID
Actor
Role at event time
Action
Entity type
Entity ID
Timestamp
Result
Reason where required
Relevant before/after context
```

Audit records themselves require access control.

---

# 51. Audit Log Integrity

Normal application users must not be able to rewrite or delete audit events.

Audit records should be append-oriented.

Only tightly controlled backend processes may create audit events.

---

# 52. Audit Coverage

Audit important actions such as:

```text
Role changes
Member referral attribution changes
Contribution amount changes
UPI ID changes
Financial transaction creation
Financial transaction correction
Financial transaction deletion
Expense amount correction
Expense cancellation
Payment verification
Account changes
Transfer creation
Task ownership/completion edits where materially relevant
Attendance corrections where applicable
Administrative setting changes
```

---

# 53. Privacy Requirements

Collect only information necessary for V1.

Potential personal data includes:

```text
Name
Mobile
Email
Photo
Donation history
Attendance
Referral relationship
Committee work records
```

Access must be limited to legitimate application roles and purposes.

---

# 54. Data Minimization

Do not collect or retain unnecessary:

```text
Continuous GPS history
Unnecessary device identifiers
Unnecessary personal details
Unnecessary financial metadata
Duplicate documents
```

---

# 55. GPS Privacy

The application must not implement continuous member tracking.

Jummah GPS exists only to validate attendance.

---

# 56. Financial Privacy

Members should see their own contribution/payment history.

Internal finance/audit roles may see broader financial records according to authorization.

Do not expose unrelated member financial history to ordinary members.

---

# 57. Shared Device Security

The dedicated Masjid laptop may be used by authorized staff/users.

Requirements:

- Logout must be obvious.
- Protected session data must not remain accessible after logout.
- Browser/device should not be trusted as a permanent security boundary.
- Sensitive pages should re-fetch authorization-sensitive data.
- Auto-lock/session timeout should be considered for unattended use.
- Do not persist confidential data unnecessarily in browser storage.

---

# 58. Mobile Device Security

Mobile applications should:

- Use platform secure storage for sensitive credentials/tokens.
- Protect authenticated API access.
- Clear sensitive temporary data where practical on logout.
- Avoid storing private documents permanently unless necessary.
- Handle app backgrounding according to platform security best practices.

---

# 59. Secure Logging

Application logs must not contain:

```text
OTP values
Authentication tokens
Service keys
Full sensitive payment credentials
Private document URLs when avoidable
Unnecessary raw GPS coordinates
```

Logs should contain enough information for debugging without becoming a secondary sensitive-data store.

---

# 60. Dependency Security

Dependencies must be:

- Pinned/managed through a reproducible package lock.
- Regularly reviewed.
- Updated intentionally.
- Removed when unused.
- Scanned where suitable.

Critical vulnerabilities require prioritization.

---

# 61. GitHub Security

Repository requirements:

- No secrets committed.
- `.env` files containing secrets must not be committed.
- Use `.env.example` for configuration templates.
- Protect production branches as appropriate.
- Review sensitive changes.
- Do not upload private financial documents to the repository.
- Do not upload production database dumps containing real member data.

---

# 62. Environment Separation

Use separate environments for:

```text
Development
Testing/Staging where used
Production
```

Production credentials must not be used casually in local development.

---

# 63. Database Access Security

Database credentials must be restricted.

The application should use:

```text
Normal authenticated application access
+
Protected server-side privileged access only where required
```

Service-role credentials must never be shipped to web/mobile clients.

---

# 64. Production Transport Security

Production traffic must use:

```text
HTTPS/TLS
```

Do not send authentication or financial data over insecure transport.

---

# 65. Backup and Recovery Security

Backups containing sensitive data must be protected.

Requirements:

- Access restricted.
- Credentials secured.
- Backup copies not made public.
- Recovery procedure documented.
- Recovery testing performed periodically when feasible.

---

# 66. Data Deletion and Retention

Do not delete historical financial/work records merely to reduce storage.

Retention decisions must follow:

```text
Business need
Audit requirement
Privacy requirement
Storage constraints
```

---

# 67. Availability and Failure Handling

If a dependent service fails:

```text
Financial posting must fail safely.
Duplicate posting must not occur.
Attendance should remain pending where appropriate.
Notifications may fail without changing business truth.
```

The UI must communicate state accurately.

---

# 68. Push Notification Failure

Push delivery is not business truth.

A failed notification must not cause:

```text
Payment reversal
Task deletion
Attendance deletion
Financial rollback
```

Notifications are delivery mechanisms only.

---

# 69. SMS/WhatsApp Failure

Messaging failures must not change the underlying donation state.

Example:

```text
SMS failed
≠
Donation cancelled
```

---

# 70. Offline Security Boundary

The system is not fully offline-first.

Offline support is limited to approved cases, especially Jummah attendance.

Do not allow offline users to perform unrestricted:

```text
Financial verification
Financial deletion
Financial transfer
Role management
```

---

# 71. Authorization Testing

Every protected action must be tested for:

```text
Allowed role
Disallowed role
Unauthenticated user
Disabled user
Modified client request
Direct API call
Repeated request
Concurrent request
```

---

# 72. Security Test Cases

Minimum V1 security testing should include:

### Authentication

```text
Invalid OTP
Expired OTP
Repeated OTP
OTP rate limit
Logout
Session expiry
Disabled account
```

### Authorization

```text
Member attempts Finance action
Committee Member attempts President action
Auditor attempts financial mutation
Unauthorized direct API request
```

### Finance

```text
Duplicate payment
Duplicate transfer
Overpayment
Payment > expense amount
Unauthorized deletion
Unauthorized correction
Concurrent posting
```

### Attendance

```text
Outside radius
Poor accuracy
Duplicate Friday attendance
Offline retry
Unauthorized attendance correction
```

### Files

```text
Invalid extension
Invalid MIME
Oversized file
Unauthorized download
Unauthorized replacement
```

### Security

```text
XSS input
Injection input
Malformed requests
Secret exposure checks
Unsafe logs
```

---

# 73. Security Acceptance Criteria

V1 security is acceptable only when:

- Authentication is implemented securely.
- Role-based authorization is enforced server-side.
- Database RLS/policies are active and tested.
- Service-role credentials are never exposed to clients.
- Financial mutations are protected.
- Financial calculations are server-authoritative.
- Critical operations are idempotent or safely transaction-protected.
- Payment verification is distinct from payment initiation.
- File access is private and authorization-controlled.
- GPS attendance is validated server-side.
- No continuous location tracking exists.
- Audit logging covers material financial/admin changes.
- Audit records cannot be casually edited/deleted.
- Notifications do not contain unnecessary sensitive data.
- Secrets are not committed to GitHub.
- Production uses secure transport.
- Error responses do not expose internal secrets/details.
- Security tests cover role boundaries and critical workflows.

---

# 74. Security Non-Goals for V1

The following are not required unless the product scope changes:

```text
Continuous GPS tracking
Advanced anti-spoofing for mock GPS
Biometric authentication
Custom enterprise SSO
Hardware security keys
Complex fraud scoring
Advanced SIEM platform
Full zero-trust infrastructure
Sophisticated endpoint-device management
```

Their absence must not weaken the mandatory V1 controls above.

---

# 75. Security Design Rule

For every sensitive workflow, apply:

```text
Authenticate
→ Authorize
→ Validate
→ Execute transactionally
→ Record audit event where required
→ Return safe result
```

---

# 76. Final Security Invariants

The following rules are mandatory:

### Invariant 1

The client is never the authority for permissions.

### Invariant 2

The client is never the authority for financial balances.

### Invariant 3

Expected donations are not verified donations.

### Invariant 4

Payment-link creation is not payment verification.

### Invariant 5

Opening a UPI link is not proof of payment.

### Invariant 6

Finance verification is required before a digital payment becomes authoritative verified money.

### Invariant 7

Financial deletion is President-only.

### Invariant 8

Material financial correction requires authorization and reason.

### Invariant 9

Audit records are protected from ordinary modification/deletion.

### Invariant 10

Private documents require authorized access.

### Invariant 11

GPS attendance is session-based, not continuous tracking.

### Invariant 12

Meeting attendance is separate from Jummah GPS attendance.

### Invariant 13

Offline attendance is pending until server synchronization validates it.

### Invariant 14

Open task claiming is atomic.

### Invariant 15

Committee Members cannot delete completed work.

### Invariant 16

Role changes cannot be self-assigned.

### Invariant 17

Secrets never ship to clients.

### Invariant 18

Notifications never become the source of business truth.

### Invariant 19

Production errors never expose secrets or internal implementation details.

### Invariant 20

Historical financial and accountability records are not removed for convenience.

---

# 77. Related Documents

- `SECURITY_ARCHITECTURE.md`
- `AUTHORIZATION_MODEL.md`
- `DATA_PRIVACY.md`
- `AUTHENTICATION.md`
- `AUDIT_LOG_MODEL.md`
- `DATABASE_SCHEMA.md`
- `DATA_RELATIONSHIPS.md`
- `FINANCIAL_DATA_MODEL.md`
- `FINANCE_SYSTEM.md`
- `PAYMENT_SYSTEM.md`
- `DONATION_SYSTEM.md`
- `EXPENSE_SYSTEM.md`
- `ATTENDANCE_SYSTEM.md`
- `COMMITTEE_WORK_MANAGEMENT.md`
- `NOTIFICATION_SYSTEM.md`
- `STORAGE_STRATEGY.md`
- `BACKUP_AND_RECOVERY.md`
- `TESTING_STRATEGY.md`
- `TEST_PLAN.md`
- `ACCEPTANCE_CRITERIA.md`

---

## Document Status

**Security Requirements — V1 Security Baseline**

This document is the security requirements contract for Masjid-e-Mamoor 2 V1 and must be used together with the authorization, privacy, architecture, database, feature, testing, and operational documents.
