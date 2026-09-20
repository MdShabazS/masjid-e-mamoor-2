# Masjid-e-Mamoor 2 — Authentication

**Document Status:** V1 Implementation Baseline  
**Version:** 1.0  
**Product:** Masjid-e-Mamoor 2 Internal Management Application  
**Scope:** V1  
**Authentication Provider:** Supabase Auth  
**Primary Method:** Mobile Number + OTP  
**Last Updated:** 2026-09-17

---

# 1. Purpose

This document defines the authentication system for Masjid-e-Mamoor 2.

The authentication system is responsible for:

- User sign-in
- Mobile number verification
- OTP handling
- Account/session management
- User onboarding
- Role-aware access initiation
- Session expiry/refresh
- Logout
- Authentication error handling
- Security controls
- Authentication audit events

Authentication answers:

> Who is this user?

Authorization answers:

> What is this authenticated user allowed to do?

These must remain separate.

---

# 2. Authentication Principles

The V1 authentication system follows these principles:

1. Mobile number is the primary login identity.
2. OTP is used to verify ownership of the mobile number.
3. Supabase Auth is the authentication authority.
4. Application roles are separate from authentication identity.
5. The client must never decide its own role.
6. Authorization is enforced on the backend/database.
7. OTP values are never stored by the application.
8. Authentication secrets remain server/provider controlled.
9. Sessions use secure token mechanisms provided by the authentication platform.
10. Logout invalidates the local authenticated session.
11. Authentication failures must not expose unnecessary account information.
12. Sensitive authentication events may be audited.
13. Authentication must work consistently on web, Android, and iOS.

---

# 3. V1 Login Method

Primary login:

```text
Mobile Number
     ↓
Request OTP
     ↓
Receive OTP
     ↓
Enter OTP
     ↓
Verify OTP
     ↓
Authenticated Session
```

No password-based login is required for V1.

---

# 4. Supported Platforms

Authentication must operate on:

```text
Web
Android
iOS
```

The authentication behavior and security model should remain consistent across platforms.

---

# 5. Identity Provider

Supabase Auth is the V1 authentication service.

The application uses the authenticated Supabase user identity as the foundation for:

- User profile linkage
- Role lookup
- Database access policies
- Audit actor identity
- Session ownership

---

# 6. Supabase Auth User vs Application User

These are related but distinct concepts.

## Supabase Auth User

Represents:

```text
Authentication identity
```

## Application User Profile

Represents:

```text
Masjid-e-Mamoor 2 user information
```

Conceptually:

```text
Supabase Auth User
        │
        ▼
Application User Profile
        │
        ├── Name
        ├── Email
        ├── Photo
        ├── Role
        ├── Active status
        └── Masjid membership context
```

The exact database relationship is defined in `DATABASE_SCHEMA.md`.

---

# 7. Mobile Number as Login Identity

The mobile number is used for OTP authentication.

The backend/authentication provider must normalize the number consistently.

For India, implementation should use a consistent international representation where appropriate.

Example conceptual form:

```text
+91XXXXXXXXXX
```

Do not allow different formatting of the same number to create multiple identities.

---

# 8. Mobile Number Uniqueness

The authenticated identity must map to one application user.

A mobile number must not produce duplicate application accounts through formatting differences or race conditions.

The authentication provider's identity uniqueness and application-level uniqueness must both be respected.

---

# 9. OTP Request Flow

```text
User enters mobile number
        ↓
Client validates basic format
        ↓
Auth provider receives request
        ↓
OTP delivery
        ↓
User enters OTP
```

The client must not generate or validate the OTP itself.

---

# 10. OTP Verification Flow

```text
OTP entered
      ↓
Supabase Auth verifies OTP
      ↓
Success?
   ┌──┴──┐
  Yes    No
   │      │
Session  Error
created  shown safely
   │
   ▼
Application user lookup
   │
   ▼
Role/status evaluation
   │
   ▼
Authorized application access
```

---

# 11. OTP Storage

The application must never store the OTP value.

Do not store:

```text
OTP code
OTP hash created only for client verification
OTP in logs
OTP in analytics
OTP in audit metadata
```

The authentication provider handles OTP verification.

---

# 12. OTP Delivery

OTP delivery is dependent on the configured authentication provider and its supported SMS infrastructure.

The application should not assume SMS delivery is free.

Provider-specific costs/limits are operational concerns and belong in deployment documentation.

---

# 13. OTP Retry

OTP requests should be rate-limited.

The application should avoid allowing unlimited:

```text
OTP requests
OTP verification attempts
```

Rate limits may be enforced by Supabase and/or application-side controls.

---

# 14. OTP Verification Attempts

The UI should provide a clear error for invalid/expired OTP.

Do not reveal internal authentication details.

Example safe response:

```text
The OTP is invalid or has expired. Please request a new OTP.
```

---

# 15. OTP Expiry

OTP validity is controlled by the authentication provider/configuration.

The client should treat expired OTPs as invalid and require a new verification flow.

Do not hard-code a separate client-side validity period that conflicts with the provider.

---

# 16. OTP Resend

The user may request another OTP subject to rate limiting.

The application should prevent repeated rapid requests through:

- UI cooldown
- Provider rate limits
- Backend/security controls where applicable

A resend should never bypass authentication controls.

---

# 17. Account Enumeration Protection

Authentication responses should avoid unnecessary disclosure of whether a particular mobile number is already registered.

Where provider behavior permits, use neutral wording such as:

```text
If this number can receive an OTP, a code has been sent.
```

The exact UX may follow Supabase's capabilities.

---

# 18. First-Time Login

After successful OTP verification:

```text
Authenticated
      ↓
Application user exists?
   ┌──┴──┐
  Yes    No
   │      │
Continue  Onboarding
```

The application should distinguish authentication from application registration/onboarding.

---

# 19. Application Onboarding

V1 onboarding captures the information required by the product.

Relevant profile fields include:

- Full name
- Mobile number
- Email
- Photo (optional)

There is no V1 "which Masjid to join" selection because this application is dedicated to Masjid-e-Mamoor 2.

---

# 20. Single-Masjid Scope

V1 application access is for:

```text
Masjid-e-Mamoor 2
```

There is no user-facing multi-Masjid discovery or selection flow.

A future database architecture may be extensible, but V1 authentication should not expose multi-tenant behavior.

---

# 21. Profile Completion

The system should determine which onboarding fields are mandatory.

At minimum:

```text
Full Name
Mobile Number
```

are required.

Email and photo are optional unless another product feature later makes them mandatory.

---

# 22. Email

Email may be stored as profile information.

V1 authentication does not require email-password login.

The application must not assume email verification is part of the core login flow.

---

# 23. Profile Photo

Photo is optional.

Authentication must not fail merely because the user has no photo.

Photo storage follows the general storage/privacy rules.

---

# 24. Application User Record

After successful authentication, the application should have a corresponding user/profile record.

Conceptually:

```text
auth.users
      ↓
public/protected application user
```

The exact table names are defined in `DATABASE_SCHEMA.md`.

---

# 25. Role Assignment

The authenticated user does not choose their own role.

Role assignment is controlled by the application's administrative workflow.

V1 roles:

```text
President
Vice President
Secretary
Finance / Financer
Auditor
Committee Member
Member
```

---

# 26. President Account

The President is the Super Admin.

The initial President account must be established through a controlled bootstrap process.

Do not allow any arbitrary first user to automatically become President without a protected initialization mechanism.

---

# 27. Bootstrap Strategy

The initial deployment should use a controlled administrative setup for the first President.

A production-safe bootstrap process should ensure:

```text
Initial authenticated user
        ↓
Controlled verification
        ↓
President assignment
        ↓
Normal role-management rules
```

The implementation must not expose a public "claim President" endpoint.

---

# 28. Role Changes

After initialization, role changes are controlled by authorized administrative users according to `USER_ROLES_PERMISSIONS.md`.

Changing a role must not create a new authentication identity.

The same User ID remains associated with the user's history.

---

# 29. User Active Status

Application users should have an active/deactivated state.

Conceptually:

```text
is_active = true / false
```

Authentication and application authorization must both consider this state.

---

# 30. Deactivated User

If an application user is deactivated:

```text
User remains historically preserved
User cannot access protected Masjid functions
```

Historical:

- Tasks
- Meetings
- Attendance
- Referrals
- Financial attribution
- Audit records

must remain intact.

---

# 31. Authentication vs Deactivation

An authentication provider may still recognize a mobile identity even if the application user is deactivated.

Therefore:

```text
Successful OTP
≠
Automatic application access
```

After authentication, application-level active status must be checked.

---

# 32. Session Creation

After successful OTP verification, Supabase establishes an authenticated session.

The application should use the official SDK/session mechanisms rather than manually constructing access tokens.

---

# 33. Access Token

The client may use the authenticated access token through the official Supabase client/session mechanism.

The client must not:

- Modify token claims
- Set its own role claim
- Reuse expired tokens manually
- Expose privileged server tokens

---

# 34. Refresh Token

Refresh-token handling must follow Supabase's supported session mechanism.

Do not store refresh tokens in insecure application storage.

On mobile:

```text
Use platform-secure credential/session storage
```

On web:

```text
Use the secure session strategy recommended by Supabase/Next.js implementation
```

---

# 35. Service Role Key

The Supabase service-role key is a server-only secret.

Never place it in:

```text
Web client bundle
Android app
iOS app
Public GitHub repository
Client-side environment variables
```

Use it only in trusted server-side execution where absolutely necessary.

---

# 36. Anonymous/Public Client Key

The browser/mobile client may use the appropriate public Supabase key/configuration.

It must still rely on:

```text
Authentication
+
RLS
+
Backend authorization
```

for actual security.

A public client key is not a substitute for authorization.

---

# 37. Session Persistence — Web

The web application should persist authenticated sessions using the secure approach recommended for the selected Next.js/Supabase architecture.

The implementation must avoid accidental exposure of session credentials to unrelated scripts.

---

# 38. Session Persistence — Mobile

Android/iOS should persist required session state using secure platform mechanisms.

Do not store sensitive tokens in ordinary unencrypted local storage.

---

# 39. Session Refresh

The application should automatically refresh sessions using the authentication SDK where supported.

If refresh fails:

```text
Session considered invalid
        ↓
User returned to login
```

The application must not keep presenting protected screens after authentication is no longer valid.

---

# 40. Logout

Logout should:

```text
Terminate application session
Clear authenticated application state
Return user to login
```

The implementation should use the official Supabase sign-out mechanism.

---

# 41. Logout on Shared Masjid Laptop

The dedicated Masjid laptop may be used by multiple authorized committee users.

The application should provide a clear logout action.

Users must not rely on closing the browser alone to protect an authenticated session.

---

# 42. Session Timeout

A reasonable inactivity/session policy should be defined during implementation based on Supabase capabilities and the Masjid's security requirements.

The policy should balance:

```text
Security
+
Practical use on shared devices
```

Exact timeout values should not be hard-coded in this document without testing the final environment.

---

# 43. Shared Device Consideration

Because the application may run on a dedicated Masjid laptop:

- Logout must be obvious.
- Sensitive pages should not remain accessible after session termination.
- Browser caching must not expose private records to the next user.
- Reports/files should use protected access.

---

# 44. Route Protection

Protected routes must check authentication before showing protected application content.

Examples:

```text
/dashboard
/members
/tasks
/meetings
/finance
/audit
```

The exact route structure belongs to `NAVIGATION_FLOW.md`.

---

# 45. Server-Side Authorization

Route protection alone is not security.

Every sensitive server operation must verify:

```text
Authenticated User
        ↓
Application User
        ↓
Active Status
        ↓
Role
        ↓
Permission
        ↓
Operation
```

---

# 46. RLS

PostgreSQL Row Level Security is mandatory for protected application data where applicable.

RLS should work with authenticated Supabase identities.

The exact RLS policy design belongs in:

```text
SECURITY_ARCHITECTURE.md
AUTHORIZATION_MODEL.md
```

---

# 47. Role Claims

Application roles should not be trusted merely because a client sends a value such as:

```json
{"role":"president"}
```

The authoritative role comes from protected application data/server-side authorization.

If custom JWT claims are later used, they must be securely generated and validated.

---

# 48. Authorization Failure

If an authenticated user lacks permission:

```text
Request rejected
```

The API must not perform a partial operation.

The UI may show:

```text
You do not have permission to perform this action.
```

---

# 49. Authentication Failure

Authentication failures should produce safe user-facing messages.

Avoid revealing:

```text
database structure
internal provider details
security configuration
secret values
```

---

# 50. Network Failure

If OTP or session requests fail due to network issues:

```text
No local authentication bypass
```

The user should receive a retryable error.

Authentication state must remain consistent.

---

# 51. Offline Authentication

V1 does not allow offline login without an existing valid authenticated session.

No local cache may be used to authenticate a user independently.

---

# 52. Offline Application Use

Some application features, such as approved attendance flows, may support offline operation.

However:

```text
Offline data sync
≠
Offline authentication
```

Authentication remains based on a valid authenticated identity.

---

# 53. Device Clock

Authentication security decisions should not rely on a client-provided clock.

Server/provider timestamps are authoritative.

---

# 54. Deep Links / Redirects

Mobile authentication may require secure redirect/deep-link handling.

The final Expo/Supabase implementation must register approved redirect URLs only.

Do not allow arbitrary external redirect targets.

---

# 55. Web Redirect Security

Authentication redirects must use a controlled allowlist of application URLs.

Avoid open redirects such as:

```text
?redirect=https://attacker.example
```

without validation.

---

# 56. Session Hijacking Protection

Use:

- HTTPS
- Secure session handling
- Short-lived access tokens as provided by the auth platform
- Refresh-token protection
- No tokens in URLs
- No secrets in logs
- Server-side authorization
- RLS

---

# 57. HTTPS Requirement

Production authentication traffic must use HTTPS.

No production authentication endpoint should accept insecure HTTP credentials.

---

# 58. OTP Brute-Force Protection

Protection should come from a combination of:

```text
Supabase/provider controls
+
rate limiting
+
attempt limits
+
UI cooldown
```

Exact numbers should be finalized from the actual provider capabilities.

---

# 59. OTP Abuse Protection

The system should protect against:

```text
OTP spam
Repeated resend attempts
Automated verification attempts
Excessive requests from one client
```

The provider's anti-abuse facilities should be enabled where available.

---

# 60. CAPTCHA / Anti-Bot Protection

If the selected Supabase authentication configuration supports CAPTCHA or equivalent anti-abuse controls, the production system should enable them when needed based on observed risk/abuse.

Do not introduce an unnecessary user-friction step without evidence.

---

# 61. Authentication Audit Events

The audit system may record security-sensitive events such as:

```text
LOGIN_SUCCESS
LOGIN_FAILURE
OTP_REQUEST
OTP_VERIFICATION_FAILURE
LOGOUT
ACCOUNT_DEACTIVATED
ROLE_CHANGED
```

The final event frequency and retention should be controlled to avoid excessive audit noise.

---

# 62. Authentication Audit Restrictions

Never place the following in an authentication audit event:

```text
OTP code
Password
Access token
Refresh token
Service-role key
Private API secret
Full authentication credential
```

---

# 63. Login Success Audit

A login-success event may record:

```text
User ID
Authentication method
Platform
Timestamp
Result
```

It does not require storing the token or OTP.

---

# 64. Login Failure Audit

Security-sensitive authentication failures may record:

```text
Attempt type
Timestamp
Result
Safe contextual metadata
```

Avoid storing excessive personal/network metadata.

---

# 65. Account Enumeration and Error UX

The UI should avoid messages that unnecessarily expose whether a mobile number exists.

Do not provide different UI wording such as:

```text
"This number is registered"
"This number is not registered"
```

unless required by the final onboarding flow.

---

# 66. New User Registration

Because this is an internal Masjid application, the product must distinguish:

```text
Authentication identity creation
```

from:

```text
Application membership/role enrollment
```

A user who authenticates successfully must still have an application user profile and appropriate role/status before gaining protected access.

---

# 67. Member Creation Through Referral

A Committee Member may register a new Masjid member through the referral workflow.

This should create/link the application member profile after the person's mobile identity is established according to the approved product flow.

The referral workflow must not create duplicate authentication identities.

---

# 68. Existing Mobile Number

When a Committee Member enters a mobile number that already exists:

```text
Do not create duplicate user/member identity.
```

The system should use the existing record according to permission and referral-correction rules.

---

# 69. Role-Dependent First Screen

After login:

```text
Authenticated
   ↓
Application profile loaded
   ↓
Role resolved
   ↓
Allowed navigation loaded
```

The landing experience may differ by role, but role resolution must be server-authoritative.

---

# 70. President Access

President is Super Admin and receives the broadest V1 administrative access.

Authentication only proves identity.

President permissions come from authorization.

---

# 71. Finance Access

Finance can authenticate normally through the same OTP flow.

Finance permissions are granted through the application role.

No separate finance login system is required.

---

# 72. Auditor Access

Auditor uses the same authentication system.

The application grants read/review access according to the role permission model.

No separate audit credential is required.

---

# 73. Committee Member Access

Committee Members use the same mobile + OTP authentication.

Their internal committee abilities are controlled by role/permission.

---

# 74. Member Access

Members use the same login flow.

They receive only the application functions permitted to Members.

---

# 75. Role Changes During Active Session

If a user's role changes while a session is active:

```text
Role change stored server-side
        ↓
Subsequent authorization uses current role
```

The implementation should avoid relying forever on stale client-side role information.

---

# 76. Deactivation During Active Session

If an authenticated user is deactivated:

```text
Future protected requests must be rejected
```

The frontend should transition the user out of protected state when the backend reports deactivation/session invalidation.

---

# 77. Account Recovery

Because V1 uses OTP-only authentication:

```text
No password reset flow
```

A user who loses access to their account must regain access to the registered mobile number or go through an authorized administrative identity-resolution process if a future recovery workflow is added.

---

# 78. Mobile Number Change

Changing the primary authentication mobile number is a high-risk operation.

V1 should not provide an unrestricted self-service number change that bypasses OTP verification.

Any future mobile-number change must verify ownership of the new number and preserve identity/history.

---

# 79. Duplicate Identity Prevention

The system must prevent:

```text
One person
→ multiple application identities
```

through:

- Normalized mobile numbers
- Auth provider uniqueness
- Database constraints
- Transaction handling

---

# 80. User ID Stability

Once an application user is created:

```text
user_id
```

should remain stable throughout the user's history.

Do not create a new application user merely because profile details change.

---

# 81. Authentication and Audit Identity

All business audit events should reference the same stable application User ID associated with the authenticated session.

This allows:

```text
Authenticated user
        ↓
Business action
        ↓
Audit actor
```

to remain consistent.

---

# 82. Secure Environment Variables

Sensitive configuration must be stored in environment/secret management.

Examples:

```text
SUPABASE_SERVICE_ROLE_KEY
SMS_PROVIDER_SECRET
WHATSAPP_PROVIDER_SECRET
```

These must not be committed to GitHub.

---

# 83. Public Configuration

Client-safe configuration may be included in web/mobile builds where required, such as:

```text
Supabase project URL
Supabase public/anon key
```

Only values explicitly designed to be public may be exposed.

---

# 84. Logging Restrictions

Authentication-related logs must avoid:

```text
OTP
Access token
Refresh token
Authorization header
Service secrets
```

Log only safe diagnostics.

---

# 85. Error Logging

Server logs may record:

```text
Operation
Error class
Request/correlation ID
Timestamp
Safe context
```

Do not log secrets while debugging.

---

# 86. Client Error Handling

The UI should translate authentication errors into clear user actions.

Examples:

```text
Invalid/expired OTP
→ Request new OTP

Network failure
→ Retry

Session expired
→ Sign in again

Account inactive
→ Contact authorized administrator
```

---

# 87. Login Screen Requirements

Minimum V1 fields:

```text
Mobile Number
```

and after OTP request:

```text
OTP
```

Primary actions:

```text
Continue / Send OTP
Verify OTP
Resend OTP
```

---

# 88. Login UX

The login flow should:

- Clearly show the entered mobile number.
- Provide a way to correct it before verification.
- Avoid exposing sensitive provider details.
- Prevent rapid duplicate submissions.
- Show loading state during requests.
- Show safe retry messages.

---

# 89. OTP UX

The OTP screen should:

- Accept numeric OTP.
- Support paste where platform allows.
- Show resend cooldown.
- Allow correction of the number.
- Avoid logging the OTP locally.
- Clear OTP input after failed/expired verification when appropriate.

---

# 90. Session State Model

Conceptual client states:

```text
INITIALIZING
AUTHENTICATED
UNAUTHENTICATED
SESSION_REFRESHING
AUTH_ERROR
ACCOUNT_INACTIVE
```

The final implementation may use a different internal state model.

---

# 91. Authentication State Source

The client should subscribe to Supabase authentication state changes where supported.

Do not depend only on local page state.

---

# 92. Protected Data Fetching

A protected data request should use the current authenticated session.

If no valid session exists:

```text
Do not send privileged data request
```

If backend authorization fails:

```text
Do not display cached privileged data as current truth
```

---

# 93. Cached Data After Logout

On logout:

```text
Clear authenticated user state
Invalidate protected queries
Clear sensitive cached data
```

The application must not show the previous user's financial/member data after logout.

---

# 94. Query Cache Security

TanStack Query or equivalent caches must be scoped/cleared appropriately during:

```text
Logout
User switch
Session invalidation
Account deactivation
```

This is especially important on the shared Masjid laptop.

---

# 95. Multiple Users on Same Browser

The application must support a clean sequence:

```text
User A logout
      ↓
User B login
      ↓
Only User B data visible
```

No User A private data should remain in User B's active UI state.

---

# 96. Mobile Device User Switching

On shared or transferred mobile devices:

```text
Logout
      ↓
Clear protected local cache
      ↓
New login
```

Secure storage should be handled according to the app's session lifecycle.

---

# 97. Authentication Testing

Minimum test scenarios:

1. Valid mobile number requests OTP.
2. Invalid mobile format is rejected client-side.
3. OTP verifies successfully.
4. Invalid OTP fails safely.
5. Expired OTP requires a new OTP.
6. OTP resend is rate-limited.
7. Repeated OTP requests are controlled.
8. Login establishes session.
9. Logout clears session.
10. Session refresh succeeds.
11. Session expiration returns user to login.
12. Deactivated user cannot access protected data.
13. Unauthorized role cannot call protected operation.
14. Role changes take effect server-side.
15. Duplicate mobile identity cannot be created.
16. Shared-browser logout prevents prior-user data exposure.
17. Mobile secure session storage works.
18. No token/OTP secrets appear in logs.
19. No service-role key reaches client builds.
20. Authentication works on web, Android, and iOS.

---

# 98. Security Acceptance Criteria

Authentication is considered acceptable for V1 only when:

- OTP verification works reliably.
- Session handling is secure.
- Application roles are server-authoritative.
- RLS protects database access.
- Deactivated users cannot use protected application functions.
- Duplicate identities are prevented.
- Tokens/secrets are not exposed.
- Shared-device logout is safe.
- Audit events are generated for required security-sensitive actions.
- Authentication failure messages are safe.
- Production traffic uses HTTPS.

---

# 99. Implementation Boundary

This document defines authentication behavior.

The following belong elsewhere:

```text
Role permissions            → USER_ROLES_PERMISSIONS.md
Authorization policies      → AUTHORIZATION_MODEL.md
Database users/roles        → DATABASE_SCHEMA.md
RLS                         → SECURITY_ARCHITECTURE.md
Personal data handling      → DATA_PRIVACY.md
Storage security            → STORAGE_STRATEGY.md
UI screen details           → SCREEN_SPECIFICATIONS.md
Notifications               → NOTIFICATION_SYSTEM.md
Hosting/deployment          → DEPLOYMENT.md
```

---

# 100. Authentication Invariants

The following rules are mandatory:

### Invariant 1

Mobile number + OTP is the V1 primary authentication method.

### Invariant 2

OTP values are never stored by the application.

### Invariant 3

The client cannot choose or elevate its own role.

### Invariant 4

Successful OTP verification does not automatically grant application-level authorization.

### Invariant 5

Application access requires an active authorized user.

### Invariant 6

A deactivated user remains historically preserved.

### Invariant 7

Service-role credentials are server-only.

### Invariant 8

Authentication/session secrets are not written to ordinary logs.

### Invariant 9

Duplicate mobile identities are prevented.

### Invariant 10

Authentication failures do not expose unnecessary internal details.

### Invariant 11

Protected requests require a valid authenticated session.

### Invariant 12

Critical authorization is enforced server-side and through database security controls where applicable.

### Invariant 13

Logout clears protected application state.

### Invariant 14

A user's stable identity remains unchanged when profile or role information changes.

### Invariant 15

Authentication is not available as an offline bypass.

---

# 101. Completion Criteria

The authentication system is implementation-ready when the application can:

- Request OTP.
- Verify OTP.
- Create a secure session.
- Restore a valid session.
- Refresh a session.
- Logout.
- Onboard a first-time user.
- Resolve the application user.
- Resolve the active role.
- Reject inactive users.
- Protect routes.
- Protect API/database operations.
- Prevent duplicate identities.
- Safely handle errors.
- Support web, Android, and iOS.
- Preserve audit identity.

---

# 102. Related Documents

- `PROJECT_OVERVIEW.md`
- `PRODUCT_REQUIREMENTS.md`
- `FEATURE_SCOPE.md`
- `USER_ROLES_PERMISSIONS.md`
- `SYSTEM_ARCHITECTURE.md`
- `APPLICATION_ARCHITECTURE.md`
- `BACKEND_ARCHITECTURE.md`
- `SECURITY_ARCHITECTURE.md`
- `DATABASE_ARCHITECTURE.md`
- `DATABASE_SCHEMA.md`
- `DATA_RELATIONSHIPS.md`
- `AUDIT_LOG_MODEL.md`
- `AUTHORIZATION_MODEL.md`
- `DATA_PRIVACY.md`
- `SECURITY_CHECKLIST.md`
- `NAVIGATION_FLOW.md`
- `SCREEN_SPECIFICATIONS.md`

---

## Document Status

**Authentication — V1 Implementation Baseline**

This document defines the authoritative authentication behavior for Masjid-e-Mamoor 2.

All authentication implementation must preserve the security and identity invariants defined here.
