# Masjid-e-Mamoor 2 — Security Architecture

**Document Status:** Baseline  
**Version:** 1.0  
**Product:** Masjid-e-Mamoor 2 Internal Management Application  
**Scope:** V1  
**Last Updated:** 2026-09-17

---

## 1. Purpose

This document defines the security architecture for the Masjid-e-Mamoor 2 application.

Security is treated as a cross-cutting system requirement covering:

- Authentication
- Authorization
- Data protection
- Financial controls
- Record-level access
- File/document protection
- Audit integrity
- API security
- Abuse prevention
- Session security
- External integrations
- Mobile/web clients
- Offline data
- Backup and recovery

The final technical implementation will depend on the selected frameworks and infrastructure, but the security requirements in this document are technology-independent.

---

# 2. Security Objectives

The V1 security architecture must protect:

1. User identity
2. Member personal information
3. Mobile numbers
4. Donation records
5. Financial accounts and transactions
6. Bills and payment proofs
7. Committee work records
8. Meeting information
9. Attendance information
10. Audit records
11. Application configuration
12. Authentication credentials/tokens
13. External-service credentials

---

# 3. Security Principles

## 3.1 Least Privilege

Users receive only the access required for their role.

## 3.2 Defense in Depth

Security must exist at multiple layers:

```text
Client
 ↓
Transport
 ↓
Authentication
 ↓
Authorization
 ↓
Validation
 ↓
Business Rules
 ↓
Database / Storage
 ↓
Audit / Monitoring
```

## 3.3 Server Authority

The backend is authoritative for:

- Roles
- Permissions
- Financial state
- Payment verification
- Member uniqueness
- Task ownership
- Attendance validation
- Audit events

## 3.4 Fail Securely

When authorization or validation cannot be established, access should be denied rather than guessed.

## 3.5 Secure by Default

New endpoints, records, files, and configuration should not be public unless explicitly intended.

---

# 4. Threat Model Scope

The system should account for threats such as:

- Unauthorized account access
- OTP abuse
- Session theft
- Role escalation
- Insecure direct object access
- Manipulated API requests
- Duplicate transactions
- Financial tampering
- Unauthorized deletion
- File exposure
- Malicious file uploads
- Data leakage
- Notification leakage
- Replay attacks
- Concurrency/race conditions
- Excessive API usage
- Compromised client device
- Provider compromise/failure
- Accidental administrative actions

The V1 threat model focuses on realistic application and operational threats rather than nation-state or advanced infrastructure attacks outside the project's reasonable scope.

---

# 5. Security Boundary Model

```text
                    INTERNET
                       │
                       ▼
              ┌────────────────┐
              │ Web / Mobile   │
              │ Clients        │
              └───────┬────────┘
                      │
                      ▼
              ┌────────────────┐
              │ Transport      │
              │ Security       │
              └───────┬────────┘
                      │
                      ▼
              ┌────────────────┐
              │ Authentication │
              └───────┬────────┘
                      │
                      ▼
              ┌────────────────┐
              │ Authorization  │
              └───────┬────────┘
                      │
                      ▼
              ┌────────────────┐
              │ Backend        │
              │ Business Rules │
              └───────┬────────┘
                      │
          ┌───────────┼────────────┐
          ▼           ▼            ▼
      Database      Storage    External APIs
          │
          ▼
       Audit /
      Monitoring
```

---

# 6. Authentication

## 6.1 Primary Authentication

V1 uses:

```text
Mobile Number
      ↓
OTP
      ↓
Authenticated Session
```

Authentication establishes user identity.

It does not grant application permissions by itself.

---

# 7. OTP Security

OTP functionality must include controls against:

- Brute-force verification
- Excessive OTP requests
- OTP enumeration
- Automated abuse
- Replay
- Session fixation

The system should implement:

- Request rate limits
- Verification attempt limits
- Short OTP validity
- Single-use verification
- Abuse detection where supported
- Secure provider integration

Exact values must be selected during implementation based on the authentication provider and operational requirements.

---

# 8. Mobile Number Handling

Mobile numbers are sensitive personal identifiers.

The system should:

- Normalize them consistently.
- Store them in an appropriate canonical form.
- Enforce uniqueness where member identity requires it.
- Avoid exposing them unnecessarily.
- Avoid logging full mobile numbers in technical logs.

The exact database representation belongs in `DATABASE_SCHEMA.md`.

---

# 9. Session Security

Authenticated sessions/tokens must be:

- Short-lived or appropriately bounded
- Securely stored on clients
- Invalidated/revoked where supported
- Protected against token leakage
- Transmitted only through secure transport

On logout, sensitive client-side session state should be cleared.

---

# 10. Web Session Security

The web implementation should use secure browser session practices appropriate to the chosen authentication architecture.

Security considerations include:

- Secure cookies where applicable
- HttpOnly where applicable
- SameSite controls where applicable
- CSRF protection where applicable
- Secure transport
- Session expiration

The final mechanisms depend on the selected authentication model.

---

# 11. Mobile Session Security

Android/iOS clients should use platform-appropriate secure storage for persistent authentication material.

Do not store sensitive credentials or tokens in ordinary unprotected storage when secure alternatives are available.

The application should minimize the amount of sensitive data persisted locally.

---

# 12. Authorization Model

Authorization is role-based with record-level restrictions where necessary.

Roles:

- President
- Vice President
- Secretary
- Finance / Financer
- Auditor
- Committee Member
- Member

The detailed matrix is defined in:

`USER_ROLES_PERMISSIONS.md`

---

# 13. Backend Authorization Requirement

Every protected backend operation must verify authorization.

Example:

```text
Request
  ↓
Authenticated?
  ↓
Authorized?
  ↓
Allowed for this specific record?
  ↓
Business Rule Valid?
  ↓
Execute
```

Frontend hiding is not authorization.

---

# 14. Record-Level Authorization

The backend must verify the relationship between the user and the requested resource.

Examples:

```text
Member
→ Own donation records

Committee Member
→ Own work records

Committee Member
→ Authorized referral information

Auditor
→ Financial read/review access
```

Guessing or changing a record ID must not grant access.

---

# 15. Insecure Direct Object Reference Protection

The API must not trust client-provided identifiers.

For example:

```text
GET /members/MEMBER-123
```

must still verify:

```text
Is current user authorized to access MEMBER-123?
```

A user must not gain access merely by changing an ID in a URL/request.

---

# 16. Role Escalation Protection

Clients must never be trusted to define their own role.

The backend must derive role/capability information from trusted server-side state.

Example:

```text
Client says: "I am President"
        ↓
Backend ignores client claim
        ↓
Trusted user identity + stored role
        ↓
Authorization decision
```

---

# 17. User/Role Administration

President is the expected authority for:

- Adding/removing users
- Activating/deactivating users
- Assigning roles
- Changing roles

These operations must:

- Require strong authorization.
- Validate target user.
- Generate an audit event.
- Prevent unauthorized self-escalation.

---

# 18. Role Change Security

A role change must record:

- Actor
- Target user
- Previous role
- New role
- Timestamp
- Result

The system must not allow normal users to grant themselves elevated permissions.

---

# 19. Financial Security

Financial operations are treated as high-sensitivity operations.

Security controls should include:

- Strong role authorization
- Server-side validation
- Database transactions
- Idempotency
- Audit logging
- Controlled destructive actions
- Record-level checks
- Concurrency controls

---

# 20. Financial Source of Truth

Financial state must come from authoritative backend/database records.

The client must not be able to:

- Set account balance
- Mark arbitrary payments verified
- Alter financial totals directly
- Delete financial transactions
- Change another user's financial state

---

# 21. Payment Verification Security

A payment must not become verified solely because:

- A payment link was opened.
- A UPI app was launched.
- A client returned from an external app.
- The client reports success.

Only the approved verification mechanism should change the authoritative payment state.

Finance verification must be protected by authorization.

---

# 22. Payment Replay Protection

The system should prevent duplicate processing of the same payment/reference.

Possible controls include:

- Unique provider transaction/reference IDs
- Idempotency keys
- State-transition guards
- Database constraints
- Provider event IDs

Repeated events should not create duplicate financial transactions.

---

# 23. Combined Payment Security

When one payment settles multiple monthly donation records:

```text
Verified Payment
      ↓
Server loads outstanding months
      ↓
FIFO allocation
      ↓
Financial transaction(s)
      ↓
Additional donation if excess
```

The calculation must occur server-side.

Clients must not submit arbitrary allocation results as authoritative.

---

# 24. Financial Deletion Security

Financial transaction deletion is President-only.

Deletion flow:

```text
Request
  ↓
Authenticate
  ↓
Verify President permission
  ↓
Identify exact record
  ↓
Confirm action
  ↓
Apply transaction-safe deletion
  ↓
Recalculate affected balances
  ↓
Audit
```

Unauthorized roles must receive an authorization failure.

---

# 25. Financial Correction Security

Financial corrections must:

- Require authorization.
- Validate the new amount.
- Preserve transaction identity where required.
- Require a reason when specified by product rules.
- Update related balances consistently.
- Create an audit record.

---

# 26. Expense Security

Expense operations must enforce:

- Finance authorization
- Bill requirements
- Payment limits
- Payment-proof requirements
- Valid state transitions
- Cancellation reason
- Correction reason
- File access controls

The client must not be able to force an expense directly to Paid.

---

# 27. File Security

Sensitive files include:

- Expense bills
- Payment proofs
- Task attachments
- Other approved records

Files must be protected by authorization.

Conceptually:

```text
Request File
    ↓
Authenticated
    ↓
Authorized for Related Record?
    ↓
Secure File Access
```

Do not expose sensitive documents through unrestricted public URLs.

---

# 28. File Upload Security

Uploads must validate:

- Authentication
- Authorization
- File type
- File size
- Content handling
- Storage path
- Record association

Where supported, the system should use safe content inspection/scanning mechanisms.

File extensions alone must not be treated as sufficient proof of file type.

---

# 29. File Replacement/Deletion

File replacement/deletion must be permission-controlled.

For sensitive financial proof:

- Verify Finance authorization.
- Record who performed the operation.
- Record timestamp.
- Keep associated financial/business records intact.
- Do not silently remove the audit trail of the action.

---

# 30. Storage Path Security

File paths should not be directly derived from untrusted user input.

Use server-controlled identifiers/namespaces.

Example conceptual structure:

```text
expenses/{expense_id}/...
payment-proofs/{expense_payment_id}/...
tasks/{task_id}/...
```

The storage access layer must still verify authorization.

---

# 31. API Security

The backend API should implement:

- Authentication
- Authorization
- Input validation
- Output filtering
- Rate limiting
- Secure error handling
- Request size limits
- Appropriate CORS/origin controls
- Secure transport
- Idempotency where required

---

# 32. Input Validation

All client-provided values are untrusted.

Validate:

- Strings
- Numbers
- Currency amounts
- Dates
- IDs
- Coordinates
- Roles
- Status transitions
- Files
- Transaction references
- UPI configuration
- Search/filter parameters

Validation must happen on the server.

---

# 33. Injection Protection

The backend must protect against injection attacks appropriate to the selected technology.

Examples include:

- SQL injection
- NoSQL injection
- Command injection
- Template injection
- XSS through stored/user-generated content

Use parameterized queries, safe ORM/query APIs, output encoding, and controlled rendering as applicable.

---

# 34. Cross-Site Scripting Protection

User-controlled text may exist in:

- Member information
- Task descriptions
- Meeting notes
- Expense descriptions
- Completion notes
- Announcements if later enabled

The application must safely render untrusted content.

Avoid raw HTML rendering unless explicitly required and safely sanitized.

---

# 35. CSRF Protection

If the chosen Web authentication architecture uses cookie-based sessions, appropriate CSRF protections must be implemented.

The exact mechanism depends on the framework.

---

# 36. CORS / Origin Security

The Web backend should allow only known application origins where practical.

Do not use unrestricted cross-origin access in production unless the architecture explicitly requires it.

---

# 37. Rate Limiting

Rate limits should protect:

- OTP request
- OTP verification
- Authentication endpoints
- Sensitive administrative endpoints
- File uploads
- Report generation
- Notification-triggering endpoints
- Payment-related endpoints

The selected values should balance security and legitimate Masjid usage.

---

# 38. Abuse Prevention

The system should detect or limit abnormal behavior such as:

- Repeated OTP requests
- Repeated login failures
- Repeated payment verification attempts
- Excessive API traffic
- Repeated task-claim requests
- Repeated attendance submissions
- Excessive file uploads

---

# 39. Concurrency Security

Security and data integrity overlap when multiple requests occur simultaneously.

Sensitive concurrent operations include:

- Member registration
- Task claiming
- Attendance submission
- Payment verification
- Expense payment
- Financial transfer
- Monthly record generation

Use atomic operations, database constraints, and transactional controls.

---

# 40. Task Claim Security

An open task can have only one successful claimant.

Backend flow:

```text
Claim Request
     ↓
Authorize User
     ↓
Atomically Check Task
     ↓
Task Still Open?
     ↓
Assign Claim
     ↓
Commit
```

Two simultaneous requests must not result in two successful claimants.

---

# 41. Attendance Security

Jummah attendance must validate:

- Authenticated member
- Date
- GPS/location data
- Configured radius
- Accuracy threshold where applicable
- Duplicate rule

Meeting attendance must validate:

- User
- Meeting
- Eligibility/invitation rules
- Duplicate rule

The client must not be trusted to supply a valid attendance state by itself.

---

# 42. GPS Security Limitations

V1 does not require full GPS-spoofing detection.

However, the backend should validate:

- Location presence
- Reasonable accuracy
- Radius
- Duplicate submission

The product should not claim that GPS attendance is impossible to spoof.

---

# 43. Offline Attendance Security

Offline attendance data is potentially sensitive.

Local storage should:

- Minimize retained data
- Use protected storage where available
- Avoid keeping unnecessary historical records
- Queue only required synchronization information
- Validate everything again on the server

A locally stored attendance record is not authoritative until server synchronization succeeds.

---

# 44. Notification Security

Notifications must not expose unnecessary sensitive information.

Avoid placing complete:

- Financial balances
- Private member information
- Full transaction details
- Audit information

in push/SMS/WhatsApp payloads.

Prefer:

```text
Notification
   ↓
Open Authenticated App
   ↓
Fetch Authorized Details
```

---

# 45. SMS/WhatsApp Security

When external messaging is used:

- Use provider credentials securely.
- Do not embed secrets in clients.
- Avoid sending unnecessary sensitive data.
- Treat delivery status separately from business state.
- Handle provider failures safely.
- Record operational delivery results where required.

---

# 46. UPI Configuration Security

Only authorized Finance users should change the active Masjid UPI ID according to the final permission model.

A UPI-ID change should record:

- Actor
- Previous configuration
- New configuration
- Timestamp
- Result

Historical transactions must remain associated with their historical payment context.

---

# 47. Secret Management

Secrets must never be committed to Git.

Examples:

- Database credentials
- Authentication secrets
- API keys
- SMS/WhatsApp credentials
- Storage credentials
- Payment integration secrets
- Signing keys
- Monitoring credentials

Use environment/secret-management facilities.

---

# 48. Environment Separation

Security-sensitive environments must remain separated:

```text
Development
      ↓
Staging/Test
      ↓
Production
```

Production secrets must not be reused in ordinary local development.

Production financial data should not be copied into development/test systems without a controlled approved process.

---

# 49. Logging Security

Technical logs must not contain unnecessary sensitive data.

Avoid logging:

- OTP values
- Authentication tokens
- Full payment credentials
- Full mobile numbers where unnecessary
- Sensitive financial details
- Private document contents

---

# 50. Audit Log Security

Business audit logs are themselves sensitive.

The system must protect them from unauthorized:

- Modification
- Deletion
- Fabrication

Audit records should be generated by trusted backend mechanisms.

At minimum, an audit event should identify:

- Actor
- Action
- Resource
- Timestamp
- Result

---

# 51. Audit Event Coverage

Important events include:

- User creation/deactivation
- Role assignment/change
- Referral correction
- Monthly donation amount change
- UPI-ID change
- Financial transaction creation
- Financial transaction edit
- Financial transaction deletion
- Expense actions
- Payment actions
- Attendance corrections
- Important settings changes
- Security-relevant authentication events

---

# 52. Audit Integrity

Where practical, audit records should be append-oriented.

Normal application users should not be allowed to edit prior audit events.

If the underlying provider supports stronger integrity controls, they should be considered during infrastructure/security design.

---

# 53. Data Privacy

Personal and financial data must be exposed according to role and business need.

Examples:

```text
Member
→ Own records

Committee Member
→ Authorized referral/contribution information
→ Own work history

Auditor
→ Financial review information

President
→ Broad administrative access
```

The exact data fields visible to each role must be documented before implementation.

---

# 54. Data Minimization

Collect and store only information required for approved V1 workflows.

Avoid collecting:

- Unnecessary personal details
- Unnecessary financial information
- Unnecessary location history
- Unnecessary device identifiers
- Unnecessary notification metadata

---

# 55. Location Privacy

V1 uses GPS only where required for attendance validation.

The system should not implement continuous location tracking.

Store only the location information needed to validate the attendance event according to the final data-retention design.

---

# 56. Data Retention

The following must not be deleted to save storage:

- Financial history
- Donation history
- Expense/payment history
- Transfer history
- Committee work history
- Required audit history

Technical logs may have controlled retention.

---

# 57. Financial Data Retention

Financial records should remain available for the application's required historical period.

V1 principle:

**Do not automatically delete financial records for storage optimization.**

---

# 58. Committee Work Retention

Committee work history is a core accountability record.

It must not be automatically deleted for storage optimization.

Completed work history remains part of the application record.

---

# 59. Backup Security

Backups must be protected with:

- Access controls
- Encryption where supported
- Secure credentials
- Appropriate retention
- Controlled restoration access

Backup data should be treated as sensitive production data.

---

# 60. Recovery Security

Recovery operations should be restricted to authorized operational administrators.

Restoration must not bypass:

- Role model
- Data integrity
- Audit requirements
- Security controls

---

# 61. Database Security

The database should use:

- Strong authentication
- Restricted network access where supported
- Least-privilege database credentials
- Encrypted transport
- Secure backups
- Appropriate indexes/constraints
- Migration controls

Application clients should not receive privileged database credentials.

---

# 62. Database Row/Record Security

Where the selected database/platform supports row-level security or equivalent policy controls, it should be evaluated for sensitive domains.

At minimum, the application backend must enforce authorization even if database-native policies are not available.

---

# 63. Transaction Integrity

Financial operations that modify multiple records should use atomic database transactions.

Examples:

### Donation verification

```text
Donation
+
Payment
+
Financial transaction
+
Contribution impact
+
Audit
```

### Expense payment

```text
Expense payment
+
Financial transaction
+
Expense status
+
Audit
```

### Internal transfer

```text
Source effect
+
Destination effect
+
Transfer linkage
+
Audit
```

---

# 64. Idempotency

Idempotency is a security and integrity requirement for retryable operations.

Protect at least:

- Member creation
- Monthly record generation
- Payment verification
- Provider callbacks/events
- Attendance synchronization
- Task claiming
- Financial writes
- Notification jobs

---

# 65. Replay Attack Protection

Requests/events that can be replayed should include appropriate protections.

Potential mechanisms:

- Unique event IDs
- Idempotency keys
- Timestamp/expiry checks
- State-transition validation
- Provider signatures/webhook verification where applicable

---

# 66. External Webhook Security

If the selected payment/notification providers use webhooks:

The backend must validate:

- Provider signature
- Event authenticity
- Event ID uniqueness
- Relevant timestamps
- Expected resource/state
- Idempotency

Never trust a webhook solely because it reaches an application endpoint.

---

# 67. Secure Error Handling

The backend should not expose:

- Stack traces
- Database credentials
- SQL statements
- Internal file paths
- Secret configuration
- Provider credentials

Errors should be categorized and safely returned.

Detailed technical information should remain in protected server logs.

---

# 68. Security Headers

The Web application should use appropriate HTTP security headers supported by the selected platform.

Potential controls include:

- Content Security Policy
- HSTS
- X-Content-Type-Options
- Frame protection
- Referrer policy
- Permissions policy

Exact policy values depend on the final deployment architecture.

---

# 69. Transport Security

All production traffic should use secure transport.

The application should not transmit:

- OTPs
- Tokens
- Financial data
- Personal data
- File data

over insecure production connections.

---

# 70. Dependency Security

The project should maintain:

- Dependency version control
- Vulnerability scanning
- Timely security updates
- Removal of unused dependencies

Do not add a package merely because a small utility can be installed instead of implemented safely with existing tooling.

---

# 71. Supply-Chain Security

The project should use trusted package sources and CI checks where practical.

Protect:

- Package-lock files where applicable
- Build scripts
- CI workflows
- Deployment credentials
- Release signing credentials

---

# 72. Git Repository Security

Never commit:

- Secrets
- API keys
- OTP provider credentials
- Database passwords
- Production configuration containing secrets
- Private certificates
- Personal financial/member exports

Use `.gitignore` and secret scanning where available.

---

# 73. CI/CD Security

CI/CD should:

- Use least-privilege credentials.
- Separate environments.
- Protect production deployment credentials.
- Avoid printing secrets.
- Require appropriate checks before production deployment.
- Keep deployment actions auditable.

---

# 74. Build Artifact Security

Build artifacts should not include:

- Development secrets
- Test credentials
- Debug credentials
- Unnecessary sensitive data

Production builds should use production-safe configuration.

---

# 75. Client Security Limitations

The client application must be treated as potentially compromised.

Never trust the client to enforce:

- Role permissions
- Financial totals
- Payment verification
- Record ownership
- Task claim ownership
- Attendance validity

---

# 76. Device Compromise Assumption

The architecture should assume that a user's device can be:

- Lost
- Stolen
- Rooted/jailbroken
- Malware-infected
- Shared with another person

Therefore, sensitive data exposure on the client should be minimized.

---

# 77. Logout and Local Cleanup

On logout:

- Clear session/authentication state.
- Clear sensitive transient state.
- Clear unnecessary cached private data.
- Do not leave financial documents or authentication material unnecessarily accessible.

---

# 78. Screenshots / Local Export Consideration

The application cannot fully prevent users from taking screenshots or photographing screens.

Therefore, the security strategy should focus on:

- Minimum necessary data exposure
- Correct authorization
- Clear sensitive-data handling
- No unnecessary secrets in notifications

---

# 79. Administrative Security

High-impact administrative actions should receive stronger protection.

Examples:

- Role changes
- Financial deletion
- UPI changes
- Major financial corrections
- Attendance corrections
- Important settings changes

These actions should be auditable.

---

# 80. Destructive Action UX Security

For destructive operations:

```text
User Action
   ↓
Authorization
   ↓
Clear Confirmation
   ↓
Operation
   ↓
Audit
```

This reduces accidental administrative changes.

---

# 81. Security Monitoring

Operational monitoring should detect:

- Authentication failures
- OTP abuse
- Authorization failures
- Suspicious API activity
- Provider failures
- File upload failures
- Database failures
- Unexpected error spikes
- Repeated financial operation failures

Monitoring should avoid exposing sensitive information.

---

# 82. Security Incident Response

A basic response process should exist for:

- Compromised account
- Compromised credential
- Data leakage
- Unauthorized financial modification
- Suspicious role change
- File exposure
- Provider credential compromise

The response should include:

```text
Detect
 ↓
Contain
 ↓
Assess
 ↓
Correct
 ↓
Audit
 ↓
Recover
```

Exact operational runbooks belong in the deployment/operations documentation.

---

# 83. Account Compromise Response

If a user account is suspected to be compromised:

- Revoke active sessions where supported.
- Review recent sensitive actions.
- Review audit records.
- Correct unauthorized changes.
- Rotate affected credentials/secrets where necessary.
- Re-authenticate the user.
- Document the incident.

---

# 84. Financial Incident Response

If unauthorized financial activity is suspected:

1. Restrict affected account access if necessary.
2. Preserve audit records.
3. Identify affected transactions.
4. Review financial state.
5. Correct unauthorized records through approved procedures.
6. Review related credentials/roles.
7. Document the incident.

Financial history must not be erased to hide an incident.

---

# 85. Security Testing

Security testing must include:

- Authentication testing
- Authorization testing
- IDOR testing
- Role escalation testing
- Input validation
- File-upload testing
- Session security
- Rate limiting
- OTP abuse testing
- Payment replay testing
- Webhook verification
- Concurrency testing
- Sensitive-data exposure checks

---

# 86. Role Matrix Testing

Every role must be tested for both:

### Allowed actions

Operations the role should perform.

### Denied actions

Operations the role must not perform.

Tests must be executed against backend APIs, not only UI menus.

---

# 87. Financial Security Test Cases

At minimum:

```text
Committee Member → cannot delete financial transaction
Auditor → cannot modify financial transaction
Member → cannot modify monthly donation amount
Unauthorized User → cannot change UPI ID
Non-President → cannot delete financial transaction
Client-manipulated role → rejected
Duplicate payment event → no duplicate ledger entry
```

---

# 88. File Security Test Cases

Test that:

- Unauthorized user cannot download a bill.
- Unauthorized user cannot download payment proof.
- Guessing file identifiers does not bypass access.
- Invalid file types are rejected.
- Oversized files are rejected.
- Removed/replaced files are handled correctly.
- Public links cannot expose sensitive files.

---

# 89. Attendance Security Test Cases

Test:

- Duplicate Jummah attendance.
- Duplicate meeting attendance.
- Invalid location.
- Outside-radius location.
- Poor accuracy handling.
- Unauthorized attendance submission.
- Offline duplicate synchronization.
- Replayed sync request.

---

# 90. Committee Task Security Test Cases

Test:

- Unauthorized task edits.
- Unauthorized completion.
- Double claim race.
- Editing another member's completed work.
- Deleting completed work.
- Manipulated task ownership.

---

# 91. Privacy Testing

Verify that:

- Members cannot see other members' private data unnecessarily.
- Committee Members cannot see unauthorized work histories.
- Financial data is protected by role.
- Audit data is protected.
- Notifications do not leak sensitive information.
- Files obey record-level authorization.

---

# 92. Security Documentation Requirements

Before production, document:

- Authentication provider
- Session model
- Role model
- Authorization policies
- File security
- Database security
- Secrets
- External provider security
- Backup security
- Incident response
- Monitoring
- Security test results

---

# 93. Security Architecture Invariants

The following are mandatory:

1. Authentication and authorization are separate.
2. Backend authorization is mandatory.
3. Frontend hiding is not security.
4. Client-controlled roles are never trusted.
5. Member mobile uniqueness is server/database enforced.
6. Financial state is server authoritative.
7. Payment link interaction is not payment verification.
8. Payment replay must not create duplicate financial records.
9. Financial deletion is President-only.
10. Sensitive files require authorization.
11. Audit logs cannot be freely edited by normal users.
12. Financial and committee history are not deleted for storage savings.
13. Task claiming is atomic.
14. Attendance duplication is prevented server-side.
15. Offline attendance is revalidated on synchronization.
16. Secrets are never stored in source control.
17. External webhooks are verified where used.
18. Notification payloads minimize sensitive information.
19. External-service failure must not corrupt core business state.
20. Security-sensitive actions are auditable.

---

# 94. Security Decision Boundaries

The following require implementation-stage decisions based on selected technology:

- OTP provider
- Token/session mechanism
- Web CSRF strategy
- Mobile secure-storage implementation
- Database security model
- Row-level security use
- File scanning
- WAF/rate limiting options
- Secret-management provider
- Webhook signature verification
- Security monitoring tools
- Device security controls
- Dependency scanning tools

These are technical choices, not reasons to weaken the documented security requirements.

---

# 95. Definition of Done

Security architecture is ready for implementation when:

- Authentication model is documented.
- Authorization model is documented.
- Record-level security is documented.
- Financial security boundaries are documented.
- File security is documented.
- Audit integrity is documented.
- API security requirements are documented.
- Offline security is documented.
- External integration security is documented.
- Secret handling is documented.
- Security test requirements are documented.
- Incident-response expectations are documented.
- Technology-specific security decisions are tracked separately.

---

# 96. Related Documents

This document should be used with:

- `PROJECT_OVERVIEW.md`
- `PRODUCT_REQUIREMENTS.md`
- `FEATURE_SCOPE.md`
- `USER_ROLES_PERMISSIONS.md`
- `SYSTEM_ARCHITECTURE.md`
- `APPLICATION_ARCHITECTURE.md`
- `BACKEND_ARCHITECTURE.md`
- `DATABASE_ARCHITECTURE.md`
- `DATABASE_SCHEMA.md`
- `AUDIT_LOG_MODEL.md`
- `DATA_PRIVACY.md`
- `SECURITY_CHECKLIST.md`
- `HOSTING_CLOUD_INFRASTRUCTURE.md`
- `BACKUP_AND_RECOVERY.md`
- `DEVELOPMENT_TASKS.md`

---

## Document Status

**Security Architecture — V1 Baseline**

This document defines the security requirements and architectural boundaries for Masjid-e-Mamoor 2.

Specific security technologies and providers must be selected through technical research and documented without violating these baseline security requirements.
