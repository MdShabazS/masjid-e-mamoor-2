# Masjid-e-Mamoor --- Authentication Architecture

**Document Status:** Draft --- Security Review Required\
**Version:** 1.0\
**Phase:** Documentation-First / Pre-Development\
**Repository:** `MdShabazS/masjid-e-mamoor-2`

------------------------------------------------------------------------

## 1. Purpose

This document defines the authentication architecture for
Masjid-e-Mamoor.

It describes how the application will establish identity, maintain
sessions, connect authenticated identities to application users, resolve
roles, handle account lifecycle, and protect web/mobile clients.

Authentication answers:

> Who is this user?

Authorization answers:

> What is this user allowed to do?

This document covers authentication. Authorization is defined primarily
in:

-   `ROLE_PERMISSION_MATRIX.md`
-   `RLS_SECURITY_MODEL.md`

------------------------------------------------------------------------

# 2. Authentication Technology

The approved authentication direction is:

-   Supabase Auth
-   Phone number + OTP as the primary authentication mechanism
-   Supabase session handling
-   Web and mobile clients using platform-appropriate Supabase
    authentication clients
-   Application user/profile data stored separately from the
    authentication identity

The exact current Supabase SDK/API usage must be verified against the
current official Supabase documentation during implementation.

------------------------------------------------------------------------

# 3. Core Authentication Principles

## AUTH-001 --- Authentication Is Identity

Successful OTP verification establishes the authenticated identity.

It does not automatically grant application permissions.

## AUTH-002 --- Application Authorization Is Separate

Role and permission state come from trusted application data.

## AUTH-003 --- No Client Role Assignment

The client cannot assign or elevate its own role.

## AUTH-004 --- Stable Identity

The authenticated identity must map to a stable application-user record.

## AUTH-005 --- Server Authority

Sensitive identity/account changes must be processed through trusted
backend/database boundaries.

## AUTH-006 --- Session Security

Tokens and sessions must be handled using platform-appropriate secure
mechanisms.

## AUTH-007 --- Logout

Logout must invalidate/clear the local authenticated session according
to the platform authentication lifecycle.

------------------------------------------------------------------------

# 4. Authentication Actors

The authentication architecture supports:

### 4.1 Prospective User

A person who is not yet an authenticated application user.

### 4.2 Registered Member

An authenticated user associated with an application member profile.

### 4.3 Authorized Staff/Committee User

An authenticated user with one of the elevated application roles.

### 4.4 Deactivated/Restricted User

A previously known identity whose application access is no longer
active.

------------------------------------------------------------------------

# 5. Identity Model

Conceptually:

``` text
Supabase Auth identity
        |
        v
application_user
        |
        +---- member_profile
        |
        +---- role_assignment
        |
        +---- notification preferences
        |
        +---- audit actor identity
```

Authentication identity and application profile must not be treated as
the same conceptual object.

------------------------------------------------------------------------

# 6. Supabase Auth Identity

Supabase Auth owns the authentication identity.

The application should reference the stable authenticated subject
identifier rather than duplicating authentication secrets.

The application must not store:

-   passwords
-   OTP secrets
-   authentication provider secrets
-   refresh tokens in ordinary business tables

------------------------------------------------------------------------

# 7. Phone OTP Flow

## AUTH-FLOW-001 --- Request OTP

1.  User opens the sign-in/registration screen.
2.  User enters a phone number.
3.  Client performs basic format validation.
4.  Client requests OTP through the approved Supabase Auth mechanism.
5.  Authentication provider handles OTP delivery.
6.  Client displays the OTP entry state.

### Failure States

-   invalid phone number
-   provider error
-   rate limiting
-   delivery failure
-   network failure

The UI must distinguish recoverable delivery/network errors from invalid
authentication attempts where practical.

------------------------------------------------------------------------

# 8. OTP Verification Flow

## AUTH-FLOW-002 --- Verify OTP

1.  User enters OTP.
2.  Client submits verification request.
3.  Supabase Auth validates OTP.
4.  Authenticated session is established if verification succeeds.
5.  Application retrieves the application-user record.
6.  Application resolves current authorization context.
7.  Application routes the user to the appropriate authorized
    experience.

### Important

OTP success does not mean:

-   role assignment
-   member approval
-   financial authorization
-   administrative access

------------------------------------------------------------------------

# 9. New User Provisioning

After successful authentication, the application determines whether an
application-user record exists.

Conceptually:

``` text
Authenticated identity
       |
       v
application_user exists?
      / \
    yes  no
    |     |
    v     v
load    approved provisioning
context   workflow
```

Provisioning must be idempotent.

Repeated initialization must not create duplicate application-user
records.

------------------------------------------------------------------------

# 10. Member Linking

A member profile may be linked to an authenticated application user.

The linking process must be controlled.

The client must not be allowed to attach itself to an arbitrary existing
member merely by supplying that member's identifier.

Possible approved matching signals may include:

-   authenticated phone identity
-   verified registration context
-   administrator-assisted linking
-   referral registration context

The final matching policy must be defined before implementation.

------------------------------------------------------------------------

# 11. Referral Registration Authentication

Referral registration combines:

1.  referral context
2.  authentication
3.  member/application provisioning

Conceptually:

``` text
Referral
   |
   v
Registration
   |
   v
Phone OTP
   |
   v
Authenticated identity
   |
   v
Member/application-user link
```

The referral token must not grant authorization beyond its intended
registration purpose.

------------------------------------------------------------------------

# 12. Application User Creation

Application-user creation must:

-   associate the correct authentication identity
-   establish the correct initial status
-   avoid duplicate records
-   not assign elevated roles automatically unless explicitly approved
-   preserve referral context where applicable
-   create required audit records where required

------------------------------------------------------------------------

# 13. Default Role

A newly registered ordinary member does not automatically receive an
administrative role.

For v1, the default application state for a newly provisioned ordinary
member is:

- Application status: `pending`
- Application role: `Member`

The application account becomes `active` only through the approved
registration/provisioning workflow.

Any elevated role assignment must use an authorized administrative
workflow and the corresponding backend authorization controls.
------------------------------------------------------------------------

# 14. Role Resolution

After authentication:

``` text
auth session
    |
    v
authenticated subject
    |
    v
application user
    |
    v
active role assignment
    |
    v
permissions
```

Role resolution must be based on trusted application state.

The client must not infer authorization from route names, local storage,
or user-editable profile values.

------------------------------------------------------------------------

# 15. Multiple Role Assignments

For v1, each application user has one active application role.

The authorization model therefore resolves:

authenticated subject
    |
    v
application user
    |
    v
active role assignment
    |
    v
permissions

Multiple simultaneous roles are deferred.

Future multi-role support requires an explicit architecture decision
covering:

- whether multiple simultaneous roles are allowed
- how permissions are combined
- how conflicting permissions are resolved
- how the active role is selected
- whether switching role changes authorization or only UI context

Implementation must not introduce multi-role authorization before that
decision is approved.
------------------------------------------------------------------------

# 16. Session Model

The authenticated session consists of provider-managed authentication
state.

The application should use the official Supabase session mechanisms
appropriate to each platform.

Business records should not attempt to become a second session system.

------------------------------------------------------------------------

# 17. Web Session Architecture

The web application must use a secure server/client session pattern
appropriate for Next.js App Router and the current Supabase SSR
guidance.

The implementation must distinguish:

-   browser client
-   server-side client
-   authenticated request context
-   server-only privileged operations

Sensitive credentials must never be embedded in the browser bundle.

------------------------------------------------------------------------

# 18. Mobile Session Architecture

The Expo/React Native application must use a mobile-appropriate Supabase
authentication client and secure local persistence mechanism.

The approved direction includes secure device storage such as Expo
Secure Store where appropriate.

Authentication tokens must not be stored in ordinary plaintext
application storage.

------------------------------------------------------------------------

# 19. Session Restoration

On application startup:

1.  Client initializes authentication state.
2.  Existing session is checked/restored.
3.  Authenticated identity is resolved.
4.  Application-user context is loaded.
5.  Authorization context is resolved.
6.  Protected queries begin only after the appropriate auth state is
    known.

The application must avoid briefly showing protected data for a previous
user during session transitions.

------------------------------------------------------------------------

# 20. Authentication Loading State

The UI must distinguish:

-   authentication state loading
-   authenticated
-   unauthenticated
-   authenticated but application user missing
-   authenticated but application access restricted
-   authentication error

These states must not be collapsed into one generic loading screen.

------------------------------------------------------------------------

# 21. Logout Flow

## AUTH-FLOW-003 --- Logout

1.  User selects logout.
2.  Client requests the approved Supabase sign-out operation.
3.  Local session state is cleared.
4.  Query/cache state containing protected user data is cleared or
    invalidated.
5.  Application returns to unauthenticated state.
6.  Protected routes become inaccessible.

Sensitive cached information must not remain visible after logout.

------------------------------------------------------------------------

# 22. Session Expiry Flow

## AUTH-FLOW-004 --- Expired Session

1.  Protected request encounters expired/invalid session.
2.  Authentication state is updated.
3.  Client attempts the approved session refresh mechanism if
    applicable.
4.  If refresh succeeds, the request may be retried safely.
5.  If refresh fails, local authenticated state is cleared.
6.  User is returned to authentication.

Retries must not duplicate financial mutations.

------------------------------------------------------------------------

# 23. Refresh Failure

If session refresh fails:

-   do not repeatedly retry indefinitely
-   do not fabricate an authenticated state
-   clear invalid local authentication state
-   preserve only safe non-sensitive draft data where appropriate
-   require reauthentication

------------------------------------------------------------------------

# 24. Concurrent Session Events

The application must safely handle:

-   logout in another browser tab
-   session refresh
-   account revocation
-   authentication state change
-   network interruption during refresh

Protected queries should reconcile with the current authentication
state.

------------------------------------------------------------------------

# 25. Multi-Tab Web Behavior

The web application should respond appropriately to authentication state
changes across tabs where supported by the selected Supabase/client
architecture.

Example:

``` text
Tab A logout
      |
      v
authentication state changes
      |
      v
Tab B re-evaluates session
      |
      v
protected data/cache cleared or revalidated
```

------------------------------------------------------------------------

# 26. Mobile Background/Foreground Behavior

When the mobile application returns to the foreground:

1.  authentication state may be rechecked
2.  session validity may be refreshed
3.  application authorization may be revalidated where required
4.  protected data may be reconciled

The app must not assume a session remains valid indefinitely while
suspended.

------------------------------------------------------------------------

# 27. Account Status

Application account status is separate from authentication status.

For v1, the approved application account states are:

- `pending`
- `active`
- `restricted`
- `deactivated`

A newly provisioned ordinary member starts in `pending`.

The approved registration/provisioning workflow changes the account to
`active` when application access is granted.

`restricted` limits application access without deleting the application
record.

`deactivated` disables application access while preserving required
historical records.

An authenticated Supabase identity can therefore exist while application
access is pending, restricted, or deactivated.

------------------------------------------------------------------------

# 28. Deactivation Flow

## AUTH-FLOW-005 --- Application Access Deactivation

1.  Authorized administrator initiates deactivation.
2.  Backend validates permission.
3.  Application account status changes.
4.  Change is audited.
5.  Future protected requests evaluate the new status.
6.  Existing clients reconcile authentication/application authorization
    state.

Deactivation must not delete required financial history.

------------------------------------------------------------------------

# 29. Reactivation Flow

If reactivation is supported:

1.  Authorized administrator selects eligible account.
2.  Backend validates permission.
3.  Application status changes to active.
4.  Audit record is created.
5.  User can access authorized application features after current
    authentication/authorization state is re-established.

------------------------------------------------------------------------

# 30. Phone Number Change

Phone number changes are authentication-sensitive.

The final implementation must define whether:

-   users may change their own phone
-   re-verification is required
-   administrative changes are allowed
-   member identity matching must be revalidated

No phone identity change should silently create a second member.

------------------------------------------------------------------------

# 31. Duplicate Identity Protection

The system must prevent accidental duplicate application identities
caused by:

-   repeated OTP registration
-   network retries
-   duplicate callback processing
-   simultaneous provisioning
-   repeated referral submission

Unique constraints and idempotent provisioning must protect the
database.

------------------------------------------------------------------------

# 32. Authentication Rate Limiting

OTP request and verification workflows should respect
authentication-provider rate limits.

The application should provide user-friendly handling for rate-limit
conditions without exposing unnecessary security details.

------------------------------------------------------------------------

# 33. OTP Security

The application must not:

-   log OTP values
-   store OTP values in business tables
-   display OTP values after submission
-   send OTP through an unapproved custom mechanism
-   bypass provider verification

------------------------------------------------------------------------

# 34. Authentication Error Handling

Errors should be classified conceptually as:

### User/Input Error

Example:

-   malformed phone number

### Authentication Error

Example:

-   invalid/expired OTP

### Provider Error

Example:

-   OTP service unavailable

### Network Error

Example:

-   request cannot reach authentication provider

### Application Provisioning Error

Example:

-   authentication succeeded but application-user initialization failed

The UI should present safe actionable messages.

------------------------------------------------------------------------

# 35. Unauthorized Application User

A user may successfully authenticate but lack an application profile.

The application must not silently grant member/admin access.

The system should enter an explicit provisioning/restricted state
according to the final product policy.

------------------------------------------------------------------------

# 36. Role Resolution Failure

If authentication succeeds but role resolution fails:

1.  Do not assume Member.
2.  Do not assume highest privilege.
3.  Do not expose protected application data.
4.  Record/observe the failure through appropriate operational
    mechanisms.
5.  Present a safe restricted/error state.

------------------------------------------------------------------------

# 37. Authorization Refresh

Authentication state and authorization state may change independently.

Examples:

-   role changed
-   account deactivated
-   permission changed
-   member access restricted

Sensitive operations must use current backend authorization.

------------------------------------------------------------------------

# 38. Authentication and RLS

The authenticated Supabase subject provides identity context to RLS.

RLS then evaluates application authorization and resource scope.

Conceptually:

``` text
auth.uid()
    |
    v
application_user
    |
    v
role/permission
    |
    v
resource ownership/scope
    |
    v
RLS decision
```

RLS must not rely on a client-supplied user identifier.

------------------------------------------------------------------------

# 39. Authentication and Trusted Operations

Sensitive operations should establish actor identity from the
authenticated request context.

For example:

``` text
client:
    payment_id = X
    decision = verify

server/trusted operation:
    actor = authenticated identity
    authorization = current permission
    payment = X
    validate state
    execute transaction
```

The client does not choose the authoritative actor.

------------------------------------------------------------------------

# 40. Service Role Boundary

The Supabase service role must remain server-side.

It may be used only where the approved architecture requires elevated
operations.

It must never be:

-   sent to browser
-   bundled into mobile app
-   placed in public environment variables
-   returned through API
-   stored in client-visible logs

------------------------------------------------------------------------

# 41. Environment Separation

Authentication environments must remain separate.

Conceptually:

``` text
local/dev
   |
   v
test/staging
   |
   v
production
```

Production authentication users/data must not be casually mixed with
development seed data.

------------------------------------------------------------------------

# 42. Environment Variables

Client-safe and server-only configuration must be explicitly separated.

Client applications may receive only configuration intended for
public/client use.

Privileged credentials remain server-only.

Environment variable names and exposure rules must be documented in
`ENVIRONMENT_DEPLOYMENT_SPEC.md`.

------------------------------------------------------------------------

# 43. Deep-Link / Redirect Security

If authentication or payment flows use redirects/deep links:

-   redirect destinations must be controlled
-   arbitrary open redirects must be prevented
-   authentication state must be validated after returning
-   the app must not trust a callback merely because it originated from
    a deep link

Payment return does not independently prove payment verification.

------------------------------------------------------------------------

# 44. Web Route Protection

Protected web routes should use layered protection:

1.  authentication state
2.  application access status
3.  authorization
4.  backend/RLS enforcement

Server-side route protection is preferred for preventing unauthorized
page/data exposure.

------------------------------------------------------------------------

# 45. Mobile Route Protection

Mobile navigation must distinguish:

-   unauthenticated routes
-   authenticated member routes
-   authorized administrative routes

Navigation guards improve UX but do not replace backend authorization.

------------------------------------------------------------------------

# 46. Cache Security

Authentication changes must invalidate or partition protected
query/cache state.

The application must prevent:

``` text
User A logout
     |
     v
User B login
     |
     v
User A cached data visible
```

This applies to web query caches and mobile persisted state.

------------------------------------------------------------------------

# 47. Secure Local Storage

Only approved non-sensitive or securely stored authentication state may
persist locally.

Do not store sensitive business data in insecure plaintext storage
merely for convenience.

Offline business data requires its own security design.

------------------------------------------------------------------------

# 48. Authentication Logging

Logs must not contain:

-   OTP codes
-   access tokens
-   refresh tokens
-   service-role keys
-   sensitive authentication secrets

Useful operational events may include:

-   authentication failure category
-   session refresh failure category
-   account provisioning failure
-   role-resolution failure

------------------------------------------------------------------------

# 49. Account Recovery

The final product must explicitly define account recovery behavior for a
phone-based identity.

The implementation must not invent a password reset flow when passwords
are not the primary authentication mechanism.

If phone access is lost, the recovery process must follow an approved
identity-verification/admin policy.

------------------------------------------------------------------------

# 50. Lost Phone Scenario

If a member loses access to their phone:

1.  Existing authentication/session may eventually expire.
2.  New authentication requires access to the approved identity
    verification mechanism.
3.  Administrative recovery may be provided if approved.
4.  Recovery must not allow identity takeover through weak member
    identifiers.

Exact recovery policy remains an open decision.

------------------------------------------------------------------------

# 51. Account Takeover Protection

The system should reduce takeover risk by:

-   relying on verified phone authentication
-   protecting session credentials
-   avoiding client-controlled role data
-   requiring reauthentication/reverification for sensitive identity
    changes where appropriate
-   auditing administrative identity changes
-   limiting recovery pathways

------------------------------------------------------------------------

# 52. Authentication Test Matrix

At minimum, test:

  Scenario                   Expected
  -------------------------- ------------------------------------
  Valid OTP                  Authenticated
  Invalid OTP                Denied
  Expired OTP                Denied
  OTP retry                  Safe
  OTP rate limit             Safe error
  Existing user              Existing application context
  New user                   Idempotent provisioning
  Duplicate provisioning     No duplicate user
  Logout                     Session cleared
  Expired session            Refresh or reauthenticate
  Refresh failure            Unauthenticated/restricted
  Deactivated app user       Protected access denied
  Role change                Current authorization applied
  Missing application user   Restricted/provisioning state
  Role resolution failure    No privileged access
  Multi-tab logout           Other tab revalidates
  Mobile resume              Session revalidated as appropriate

------------------------------------------------------------------------

# 53. Security Negative Tests

The authentication implementation must explicitly test that a client
cannot:

-   choose another user ID
-   choose another member ID during linking
-   assign itself a role
-   edit role metadata to gain access
-   replay a registration operation
-   reuse another user's operation ID
-   bypass deactivation
-   use stale authorization to perform a sensitive operation
-   expose tokens through logs
-   access protected data after logout
-   retrieve another user's cached data

------------------------------------------------------------------------

# 54. Authentication Acceptance Criteria

Authentication architecture is implementation-ready when:

-   OTP flow is defined
-   user provisioning is defined
-   member linking is defined
-   role resolution is defined
-   session lifecycle is defined
-   web session architecture is defined
-   mobile session architecture is defined
-   logout is defined
-   expiry/refresh is defined
-   account status is defined
-   deactivation is defined
-   role changes are handled
-   cache/session security is defined
-   redirect/deep-link security is defined
-   service-role boundaries are defined
-   recovery behavior is defined
-   test matrix is defined

------------------------------------------------------------------------

# 55. Open Authentication Decisions

  Decision                                  Impact
  ----------------------------------------- -------------------
  Exact Supabase OTP configuration          Authentication
  New-user default status                   Provisioning
  Exact member-linking strategy             Identity
  Role assignment workflow                  Authorization
  Multiple simultaneous roles               Authorization
  Phone-change workflow                     Identity security
  Account recovery policy                   Account security
  Deactivation propagation behavior         Session/RLS
  Exact web session implementation          Next.js/Supabase
  Exact mobile persistence implementation   Expo/Supabase
  Deep-link redirect allowlist              Security
  Session lifetime/settings                 Security/UX

These must be resolved using the current official Supabase/Expo/Next.js
documentation before implementation.

------------------------------------------------------------------------

# 56. Implementation Order

Recommended authentication implementation order:

1.  Verify current Supabase Auth documentation
2.  Configure development Supabase project
3.  Establish auth client boundaries
4.  Implement application-user mapping
5.  Implement role resolution
6.  Implement phone OTP
7.  Implement registration/provisioning
8.  Implement web session lifecycle
9.  Implement mobile session lifecycle
10. Implement protected routing
11. Implement logout/expiry handling
12. Implement deactivation/revocation behavior
13. Add authentication/RLS tests
14. Add security regression tests

------------------------------------------------------------------------

# 57. Change Control

Authentication changes affect security and may affect every application
domain.

Any material authentication change must update:

-   this document
-   `RLS_SECURITY_MODEL.md`
-   `ROLE_PERMISSION_MATRIX.md` where relevant
-   database architecture
-   API architecture
-   web/mobile architecture
-   testing strategy
-   deployment/environment documentation

No authentication shortcut should be introduced solely to unblock UI
development.

------------------------------------------------------------------------

# 58. Status

**Current status: Authentication architecture specification generated
for review.**

Implementation must verify the current official Supabase, Next.js, and
Expo authentication guidance before locking the exact SDK/API
configuration.
