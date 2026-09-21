# Masjid-e-Mamoor --- RLS Security Model

**Document Status:** Draft --- Security Review Required\
**Version:** 1.0\
**Phase:** Documentation-First / Pre-Development\
**Repository:** `MdShabazS/masjid-e-mamoor-2`

------------------------------------------------------------------------

## 1. Purpose

This document defines the Row Level Security (RLS) and authorization
model for Masjid-e-Mamoor.

The objective is to ensure that:

-   authenticated users can access only data permitted by their current
    authorization context
-   members cannot access other members' private information
-   financial information is restricted to authorized scopes
-   sensitive operations cannot be performed by manipulating client
    requests
-   realtime and storage access follow the same authorization model
-   trusted financial operations are isolated from ordinary client CRUD
-   denial is the default when no explicit authorization exists

This document must be read together with:

-   `SYSTEM_ARCHITECTURE.md`
-   `ROLE_PERMISSION_MATRIX.md`
-   `BUSINESS_RULES.md`
-   `DATABASE_ARCHITECTURE.md`
-   `AUTHENTICATION_ARCHITECTURE.md`
-   `API_DOMAIN_ARCHITECTURE.md`

------------------------------------------------------------------------

# 2. Security Principles

## RLS-001 --- Deny by Default

If a user does not satisfy an explicit policy, access is denied.

## RLS-002 --- Authentication Is Not Authorization

A valid Supabase Auth session does not automatically grant application
permissions.

## RLS-003 --- Backend Authority

Authorization decisions must use trusted application data.

## RLS-004 --- UI Is Not Security

Hiding a button, route, menu item, dashboard card, or field is not an
authorization control.

## RLS-005 --- Client Input Is Untrusted

The client may request an operation but cannot decide:

-   role
-   permission
-   financial verification state
-   allocation result
-   account balance
-   audit identity
-   protected ownership

## RLS-006 --- Least Privilege

A user receives only the minimum data and operations required by their
role and workflow.

## RLS-007 --- Same Backend

All seven roles use the same authoritative backend and database.

Role-specific UI does not imply separate security domains or databases.

------------------------------------------------------------------------

# 3. Role Set

The security model supports exactly these roles:

1.  President / Super Admin
2.  Vice President
3.  Secretary
4.  Finance
5.  Auditor
6.  Committee Member
7.  Member

The role/permission matrix remains the authoritative product-level
mapping of business permissions.

------------------------------------------------------------------------

# 4. Authorization Layers

Authorization is layered:

``` text
Authentication
      |
      v
Application identity
      |
      v
Role / permission resolution
      |
      v
RLS row access
      |
      v
Trusted operation authorization
      |
      v
Business-rule validation
      |
      v
Database constraints / transaction
```

No lower layer should be treated as permission to bypass a higher layer.

------------------------------------------------------------------------

# 5. Supabase Auth Boundary

Supabase Auth establishes identity.

Application authorization must not depend on user-editable profile
fields.

Do not use ordinary client-controlled metadata as the authoritative role
source.

Application role/permission state must come from trusted application
data.

------------------------------------------------------------------------

# 6. Application User Authorization

Conceptual relationship:

``` text
auth.users
    |
    v
application_user
    |
    v
role_assignment
    |
    v
role / permission
```

The authenticated user's identity should be mapped to application
authorization using the authenticated subject identifier.

------------------------------------------------------------------------

# 7. Role Resolution

For each protected request:

1.  Identify authenticated user.
2.  Resolve application user.
3.  Resolve current active role assignment.
4.  Resolve applicable permission.
5.  Evaluate resource ownership/scope.
6.  Apply table RLS.
7.  For sensitive operations, invoke the approved trusted operation.
8.  Revalidate business rules before mutation.

Cached UI role state must not be sufficient for sensitive authorization.

------------------------------------------------------------------------

# 8. Role Scope

## President / Super Admin

Highest administrative application role.

May access functions explicitly assigned to this role.

Does not bypass database integrity, financial transaction boundaries, or
audit requirements.

## Vice President

Access follows the approved role matrix.

## Secretary

Access follows the approved role matrix.

## Finance

Financial operations are restricted to explicitly authorized finance
permissions.

## Auditor

Audit/oversight access is read-oriented unless an explicit permission
grants another operation.

## Committee Member

Access is primarily related to assigned committee workflows.

## Member

Access is primarily restricted to:

-   own profile
-   own permitted donation/payment information
-   own permitted attendance
-   assigned/authorized notifications
-   approved self-service workflows

------------------------------------------------------------------------

# 9. Permission Model

Permissions should be represented as explicit domain actions.

Examples:

``` text
members.read
members.update
members.manage

donations.read_own
donations.read_authorized
donations.submit

payments.submit
payments.read_own
payments.verify

finance.accounts.read
finance.accounts.manage
finance.transactions.read
finance.expenses.create
finance.expenses.approve
finance.corrections.create

committee.tasks.read
committee.tasks.manage

attendance.read
attendance.record

reports.read
audit.read
roles.manage
```

The final permission catalogue must remain synchronized with
`ROLE_PERMISSION_MATRIX.md`.

------------------------------------------------------------------------

# 10. Table Security Categories

Tables are grouped into security classes.

### Class A --- Public/Low Sensitivity

Only genuinely public information belongs here.

### Class B --- Authenticated User Data

Data available to authenticated users according to ownership/scope.

### Class C --- Administrative Data

Restricted to authorized administrative roles.

### Class D --- Financial Data

Restricted to explicitly authorized financial/oversight scopes.

### Class E --- Highly Sensitive Operations

Must use tightly controlled trusted operations and may have limited
direct table access.

Examples:

-   payment verification
-   FIFO allocation
-   transfers
-   financial corrections
-   role administration
-   sensitive audit operations

------------------------------------------------------------------------

# 11. Member Profile RLS

## SELECT

A member may read only permitted own-profile information.

Authorized administrative users may read member profiles according to
their role scope.

Committee Members do not receive general organization-wide member
browsing. Their member-profile access is limited to their own permitted
profile information and the minimum member information required by an
explicitly authorized workflow in which they participate. The
`membership.members.read` permission is not sufficient by itself to read
every member profile; backend authorization and RLS/trusted operations
must enforce the effective resource scope.

## INSERT

Member creation must follow the approved registration/trusted workflow.

## UPDATE

A member may update only explicitly self-editable fields.

Administrative updates require appropriate authorization.

## DELETE

Ordinary members must not delete member identity records.

Lifecycle changes should normally use controlled status changes.

------------------------------------------------------------------------

# 12. Referral RLS

Referral records must be scoped so that:

-   referrers can see only information explicitly allowed about their
    referrals
-   referred users cannot use referral identifiers to access unrelated
    private data
-   administrative users can access referral data according to
    permission
-   referral creation cannot forge another referrer's identity

The backend must derive the authenticated referrer identity rather than
trusting a client-supplied owner.

------------------------------------------------------------------------

# 13. Donation Obligation RLS

A member may read their own authorized obligations.

Authorized financial/administrative roles may read obligations within
their scope.

Members must not:

-   create authoritative obligations
-   change obligation amounts
-   change effective months
-   mark obligations paid
-   change allocation state

Obligation mutations must use approved trusted operations.

------------------------------------------------------------------------

# 14. Payment Submission RLS

## Member

A member may:

-   create permitted payment submissions
-   read their own submissions
-   attach permitted proof
-   see their own status

A member must not:

-   verify a payment
-   modify another user's payment
-   change authoritative amount after financial processing
-   change allocation
-   mark payment verified

## Finance

Finance may read and process payments within explicit permission scope.

------------------------------------------------------------------------

# 15. Payment Proof RLS

Payment proof access must be scoped to the associated payment and its
authorized users.

Members may access proof belonging to their own permitted payment.

Finance/authorized reviewers may access proofs required for
verification.

Unauthorized users must not obtain proof objects through:

-   table queries
-   storage paths
-   predictable filenames
-   realtime events
-   export/report endpoints

------------------------------------------------------------------------

# 16. Allocation RLS

Allocation is highly sensitive.

Ordinary members must not directly insert/update/delete allocation rows.

Allocation must occur through the approved trusted financial operation.

Authorized read access may expose allocations appropriate to the viewer.

------------------------------------------------------------------------

# 17. Financial Account RLS

Account visibility is restricted to authorized finance/oversight roles.

Members must not access internal account balances or transaction details
unless a specific product rule grants such access.

Account mutations must use explicit finance permissions and trusted
operations where required.

------------------------------------------------------------------------

# 18. Financial Transaction RLS

Financial transaction data is sensitive.

Direct client mutation should generally be prohibited.

Transactions should be created through controlled financial operations.

Read access follows the role matrix.

Members must not be able to query organizational financial transactions
by manipulating filters or identifiers.

------------------------------------------------------------------------

# 19. Transfer RLS

Transfers are highly sensitive.

Users must not directly manipulate both sides of a transfer through
ordinary table updates.

The approved transfer operation must:

1.  authorize actor
2.  validate source/destination
3.  validate amount
4.  establish transaction boundary
5.  write source effect
6.  write destination effect
7.  record transfer
8.  record audit
9.  commit atomically

------------------------------------------------------------------------

# 20. Expense RLS

## Create

Only explicitly authorized users may create expenses.

## Read

Access follows finance/administrative/oversight permissions.

## Approve

Approval requires explicit permission.

## Update

Post-processing changes must use controlled workflows.

## Delete

Ordinary deletion of finalized financial records is prohibited.

------------------------------------------------------------------------

# 21. Correction/Reversal RLS

Corrections and reversals require explicit permissions.

Users must not:

-   overwrite financial history
-   delete original financial records
-   change audit history
-   create an untraceable offset

Trusted operations must preserve relationships between original and
correcting records.

------------------------------------------------------------------------

# 22. Committee Task RLS

Committee members should see tasks within their assigned scope.

An assigned committee member may update only fields/actions explicitly
permitted by the task workflow.

Administrative roles may manage tasks according to their permissions.

A user must not access another committee member's private task context
unless authorized.

------------------------------------------------------------------------

# 23. Meeting RLS

Meeting records are readable according to role/event scope.

Meeting management requires explicit permission.

Meeting attendance records must be protected separately from general
meeting visibility where appropriate.

------------------------------------------------------------------------

# 24. Attendance RLS

A member may access their own permitted attendance records.

Authorized attendance/committee roles may manage attendance according to
scope.

Attendance must not be writable by arbitrary authenticated users.

Offline attendance operations must be revalidated when synchronized.

------------------------------------------------------------------------

# 25. GPS Attendance Security

GPS attendance requires special handling.

Rules:

-   collect only required location data
-   do not expose location history unnecessarily
-   restrict raw location access
-   validate event eligibility
-   validate user identity
-   apply the approved V1 100 metre geographic rule server-side
-   treat client-side distance calculations as advisory feedback only
-   never allow the client to supply or override the authoritative
    acceptance radius
-   retain only the data required by the approved retention policy

The V1 GPS acceptance radius is 100 metres. Trusted server-side logic
must determine whether submitted location evidence satisfies the
attendance location requirement.

Retention policy remains a separate open decision. Do not introduce GPS
accuracy thresholds, spoof-detection algorithms, background tracking,
continuous tracking or additional location requirements unless separately
approved.

------------------------------------------------------------------------

# 26. Offline Operation RLS

Offline operations must not become an authorization bypass.

When synchronization occurs:

1.  authenticate actor
2.  validate operation identity
3.  validate current authorization
4.  validate current business state
5.  validate operation payload
6.  process transactionally where required
7.  record result
8.  return deterministic outcome

An operation that was authorized when created offline may become invalid
before synchronization.

------------------------------------------------------------------------

# 27. Idempotency Security

Idempotency records must be scoped so one user cannot replay or claim
another user's operation.

The server must derive actor identity from the authenticated session.

Do not trust a client-provided `user_id` as proof of ownership.

------------------------------------------------------------------------

# 28. Notification RLS

Users may read only notifications intended for them or their authorized
role scope.

Users must not:

-   read another user's private notifications
-   modify notification ownership
-   create arbitrary notification events
-   mark another user's notifications as read

System/outbox processing uses trusted server-side access.

------------------------------------------------------------------------

# 29. Audit RLS

Audit data is highly restricted.

Normal users must not:

-   insert arbitrary audit records
-   modify audit records
-   delete audit records
-   impersonate another actor

Audit records should be generated by trusted application/database
workflows.

Authorized oversight users may have read access according to the role
matrix.

------------------------------------------------------------------------

# 30. Storage Security

Storage authorization must mirror business authorization.

A file is not secure merely because its database row is secure.

The system must protect:

-   payment proofs
-   financial documents
-   member documents
-   sensitive reports
-   GPS-related files if any
-   administrative documents

Protected objects should use controlled access rather than unrestricted
public URLs.

------------------------------------------------------------------------

# 31. Realtime Security

Realtime subscriptions must be subject to the same authorization model
as normal reads.

A user who cannot SELECT a record must not receive that record through
realtime.

Realtime must not become a side channel for:

-   financial data
-   private member data
-   audit records
-   payment proofs
-   administrative data

------------------------------------------------------------------------

# 32. Search Security

Search queries must run within authorization scope.

Example:

``` text
authorized dataset
        |
        v
filters/search
        |
        v
results
```

Not:

``` text
entire dataset
        |
        v
search
        |
        v
hide unauthorized rows in UI
```

The second model is prohibited.

------------------------------------------------------------------------

# 33. Pagination Security

Pagination must not allow users to move outside their authorized
dataset.

Cursor/offset values are not authorization tokens.

Each query must independently enforce access rules.

------------------------------------------------------------------------

# 34. Export Security

Exports must be authorization-aware.

A user who cannot view a field in the application must not receive it
through CSV/PDF/export APIs.

Export generation must apply the same role/data scope rules as normal
reporting.

------------------------------------------------------------------------

# 35. RPC / Database Function Security

Every exposed function must have a defined security model.

For sensitive functions:

-   validate authenticated identity
-   resolve authorization
-   validate arguments
-   enforce business rules
-   enforce transaction boundaries
-   avoid arbitrary dynamic SQL
-   avoid broad elevated privileges
-   return only necessary data

Functions must not accept an arbitrary `actor_id` as the authority
identity.

------------------------------------------------------------------------

# 36. SECURITY DEFINER Principles

If elevated database functions are used:

1.  Keep them narrowly scoped.
2.  Validate caller identity.
3.  Avoid trusting caller-supplied ownership.
4.  Set safe search-path behavior.
5.  Limit accessible operations.
6.  Avoid exposing unnecessary rows.
7.  Test authorized and unauthorized paths.
8.  Document why elevated execution is required.

------------------------------------------------------------------------

# 37. Service Role Security

The Supabase service role or equivalent privileged credential must never
be exposed to:

-   browser bundles
-   mobile bundles
-   client environment variables
-   public API responses
-   logs
-   screenshots/documentation examples

Privileged credentials belong only in trusted server-side environments.

------------------------------------------------------------------------

# 38. Role Escalation Protection

A client must not be able to escalate privileges by:

-   changing a role field
-   editing metadata
-   modifying local storage
-   changing JWT-adjacent client state
-   sending a different user ID
-   changing route parameters
-   calling a hidden API endpoint
-   subscribing to another user's realtime channel

Authorization must derive from trusted state.

------------------------------------------------------------------------

# 39. Object-Level Authorization

Every sensitive object access must consider both:

1.  permission to perform the action
2.  permission to access that particular object

Example:

A Finance user may have permission to review payments, but object-level
rules still apply to the permitted payment dataset.

------------------------------------------------------------------------

# 40. Field-Level Privacy

Where a table contains mixed-sensitivity fields, the architecture must
consider:

-   separate tables
-   secure views
-   restricted RPC responses
-   carefully scoped queries

Do not assume row-level access automatically protects sensitive columns
from every application workflow.

------------------------------------------------------------------------

# 41. Member Financial Privacy

A member should see only their own financial information unless an
explicit policy says otherwise.

The system must prevent enumeration through:

-   sequential identifiers
-   search
-   URL manipulation
-   API filters
-   realtime
-   reports
-   exports
-   storage

------------------------------------------------------------------------

# 42. Finance Separation of Duties

The security model must preserve financial separation of duties defined
by the role matrix.

Examples may include:

-   payment verification
-   expense approval
-   corrections
-   account transfers
-   role administration

Exact maker/checker rules are finalized in the financial integrity
specification.

------------------------------------------------------------------------

# 43. Auditor Security Model

Auditor access should be read-oriented.

Where audit access is granted:

-   auditor can inspect permitted historical information
-   auditor cannot silently modify the records being audited
-   sensitive data exposure follows explicit scope
-   audit access itself may be logged where required

------------------------------------------------------------------------

# 44. President / Super Admin Security Model

The highest administrative role has broad application permissions but is
still subject to:

-   authentication
-   RLS/trusted-operation boundaries
-   financial integrity
-   auditability
-   database constraints
-   explicit business rules

"Super Admin" must not mean "bypass every control."

------------------------------------------------------------------------

# 45. Authorization Helper Model

The final implementation should centralize common authorization logic.

Conceptual helpers:

``` text
is_authenticated()
current_application_user()
current_role()
has_permission(permission)
is_member_owner(member_id)
can_access_financial_scope()
can_manage_members()
can_manage_tasks()
```

Actual SQL/function names will be finalized during implementation.

------------------------------------------------------------------------

# 46. RLS Policy Pattern

For each table:

``` text
authenticated?
      |
      v
current application user?
      |
      v
required permission?
      |
      v
resource ownership/scope?
      |
      v
business operation allowed?
      |
      v
ALLOW
```

If any required condition fails:

``` text
DENY
```

------------------------------------------------------------------------

# 47. SELECT Policy Principles

SELECT policies should answer:

-   who can see this row?
-   under what permission?
-   under what ownership/scope?
-   is the data sensitive?
-   should the row be visible through reports/realtime?

Do not create broad authenticated-user SELECT policies merely for
convenience.

------------------------------------------------------------------------

# 48. INSERT Policy Principles

INSERT policies should answer:

-   who may create this entity?
-   which ownership fields are derived from the session?
-   can the client choose the owner?
-   is direct insertion safe?
-   should creation instead use a trusted operation?

For sensitive entities, direct INSERT should often be prohibited.

------------------------------------------------------------------------

# 49. UPDATE Policy Principles

UPDATE policies must prevent privilege-changing or ownership-changing
mutations.

For sensitive records, prefer trusted operations over unrestricted
UPDATE.

An UPDATE policy must not unintentionally permit:

-   changing `member_id`
-   changing `created_by`
-   changing financial state
-   changing verification state
-   changing role
-   changing audit information

------------------------------------------------------------------------

# 50. DELETE Policy Principles

DELETE should be denied for immutable/history-bearing entities unless a
very specific approved business rule permits deletion.

Prefer controlled lifecycle states.

------------------------------------------------------------------------

# 51. Policy Testing Matrix

Every table policy should be tested against at least:

  ---------------------------------------------------------------------------------------
  Actor                 Own data       Other member         Admin data     Financial data
  ----------- ------------------ ------------------ ------------------ ------------------
  President     Allowed by scope   Allowed by scope   Allowed by scope   Allowed by scope

  Vice          Allowed by scope   Allowed by scope   Allowed by scope   Matrix-dependent
  President                                                            

  Secretary     Allowed by scope   Allowed by scope   Allowed by scope   Matrix-dependent

  Finance       Allowed by scope   Matrix-dependent   Matrix-dependent         Authorized

  Auditor       Matrix-dependent   Matrix-dependent    Authorized read    Authorized read
                                                                 scope              scope

  Committee         Own/assigned         Restricted     Assigned scope         Restricted
  Member                                                               

  Member                     Own             Denied             Denied Own permitted data
  ---------------------------------------------------------------------------------------

The exact cells must follow `ROLE_PERMISSION_MATRIX.md`.

------------------------------------------------------------------------

# 52. Negative Security Tests

For every sensitive table, tests must include:

-   unauthenticated SELECT
-   unauthenticated INSERT
-   unauthenticated UPDATE
-   unauthenticated DELETE
-   member reading another member
-   member changing another member
-   member changing own protected fields
-   committee member accessing unrelated data
-   finance accessing unauthorized administrative data
-   auditor attempting mutation
-   role escalation attempt
-   forged owner ID
-   forged actor ID
-   forged payment verification
-   forged allocation
-   forged transfer
-   forged audit event

------------------------------------------------------------------------

# 53. Financial RLS Tests

Financial tests must verify:

1.  Member cannot verify payment.
2.  Member cannot create allocation.
3.  Member cannot modify financial transaction.
4.  Finance can perform explicitly authorized financial operations.
5.  Unauthorized finance-adjacent roles cannot perform restricted
    operations.
6.  Auditor read access does not imply mutation access.
7.  Concurrent requests do not bypass business controls.
8.  Direct table manipulation cannot bypass trusted operation rules.

------------------------------------------------------------------------

# 54. Realtime RLS Tests

Tests must verify:

-   member receives own permitted changes
-   member does not receive another member's private changes
-   unauthorized finance data is not broadcast
-   audit data is not exposed
-   storage metadata is not leaked
-   stale subscriptions cannot bypass updated permissions

------------------------------------------------------------------------

# 55. Storage Authorization Tests

Tests must verify:

-   owner can access permitted proof
-   authorized reviewer can access required proof
-   unrelated member cannot access proof
-   guessed object path fails
-   expired/revoked authorization fails
-   public URL is not accidentally exposed for protected objects

------------------------------------------------------------------------

# 56. Role Change Security

When a user's role changes:

1.  Existing authorization must not be permanently trusted.
2.  New requests must use current authorization state.
3.  Cached UI state must refresh.
4.  Sensitive operations must revalidate.
5.  Role change should be auditable.

Exact session/token refresh behavior belongs to the authentication
specification.

------------------------------------------------------------------------

# 57. Revocation

When access is revoked:

-   future protected requests must fail according to the revocation
    model
-   realtime access must no longer expose newly unauthorized data
-   storage access must follow current authorization
-   cached UI must not be treated as permission

------------------------------------------------------------------------

# 58. Security Event Logging

Security-relevant events may include:

-   role changes
-   permission changes
-   failed sensitive operations
-   repeated authorization failures
-   financial corrections
-   unusual access patterns
-   protected file access where required

The final observability/security operations specification determines
retention and alerting.

------------------------------------------------------------------------

# 59. RLS Performance

Security policies must remain performant.

Avoid policy logic that causes unnecessary repeated expensive queries.

Where appropriate:

-   use indexed relationship columns
-   centralize helper functions
-   avoid unrestricted cross-table scans
-   test representative query plans
-   benchmark common role queries

Security must not be weakened solely for convenience or performance.

------------------------------------------------------------------------

# 60. Policy Change Management

RLS policies are production security controls.

Changes require:

1.  documentation update
2.  migration
3.  positive tests
4.  negative tests
5.  role matrix review
6.  API review
7.  realtime/storage review where applicable

Never modify production RLS manually without a migration record.

------------------------------------------------------------------------

# 61. Security Boundaries by Domain

  -----------------------------------------------------------------------
  Domain            Direct Client     Direct Client     Trusted Operation
                    Read              Write             
  ----------------- ----------------- ----------------- -----------------
  Own profile       Limited           Limited           Sometimes

  Member management Scoped            Controlled        Often

  Referral          Scoped            Controlled        As required

  Donation          Scoped            No direct         Yes
  obligations                         financial         
                                      mutation          

  Payment           Own/scoped        Limited           Yes for final
  submissions                                           state

  Payment proofs    Scoped            Controlled upload Sometimes

  Allocations       Scoped            No                Yes

  Finance accounts  Restricted        No/controlled     Yes

  Financial         Restricted        No                Yes
  transactions                                          

  Transfers         Restricted        No                Yes

  Expenses          Scoped            Controlled        Yes where posting

  Committee tasks   Scoped            Controlled        Sometimes

  Attendance        Scoped            Controlled        Yes where
                                                        validation
                                                        required

  Notifications     Own               Limited           Outbox/system

  Audit             Restricted read   No                System/trusted

  Roles             Restricted        No direct         Yes
  -----------------------------------------------------------------------

This table is architectural guidance; exact permissions come from the
role matrix.

------------------------------------------------------------------------

# 62. Security Anti-Patterns

The implementation must not use:

### Anti-pattern 1 --- UI-only security

``` text
Hide button
    ≠
Secure operation
```

### Anti-pattern 2 --- Client-selected owner

``` text
client sends member_id
    +
server trusts it
```

### Anti-pattern 3 --- Role in ordinary profile metadata

``` text
user changes role field
    =
privilege escalation
```

### Anti-pattern 4 --- Service role in client

Prohibited.

### Anti-pattern 5 --- Public storage for private proof

Prohibited unless the file is genuinely public.

### Anti-pattern 6 --- Broad authenticated policy

``` text
authenticated users
    -> all rows
```

Prohibited for sensitive tables.

### Anti-pattern 7 --- Realtime as authorization

A realtime channel must not be used to bypass row-level authorization.

------------------------------------------------------------------------

# 63. Security Acceptance Criteria

RLS/security architecture is implementation-ready when:

-   authentication boundary is defined
-   role resolution is defined
-   permission model is defined
-   member ownership is defined
-   financial access is defined
-   trusted operations are identified
-   storage security is defined
-   realtime security is defined
-   offline synchronization security is defined
-   audit access is defined
-   role escalation paths are addressed
-   service-role exposure is prohibited
-   positive tests are defined
-   negative tests are defined
-   performance review is defined
-   revocation behavior is defined

------------------------------------------------------------------------

# 64. Remaining Security Implementation Decisions

The V1 security implementation decisions are closed by
`docs/V1_IMPLEMENTATION_DECISION_CLOSURE.md`.

Approved:
- existing controlled role/permission representation;
- trusted current-user/permission helpers;
- Finance/Auditor and President/VP/Secretary scopes follow the approved
  matrix;
- Committee Member member-data access is workflow-scoped and does not
  include organization-wide member browsing;
- GPS follows the approved attendance policy;
- sensitive storage uses private buckets;
- account restriction/deactivation is checked on protected operations;
- offline payloads are typed and idempotent.

Security-event retention remains a non-blocking organizational/legal policy
item. No automated destructive deletion occurs before that policy is
approved.

# 65. Implementation Order

Recommended security implementation order:

1.  Authentication identity mapping
2.  Application user model
3.  Role/permission model
4.  Authorization helper functions
5.  Base member RLS
6.  Donation/payment RLS
7.  Finance RLS
8.  Committee/attendance RLS
9.  Notification RLS
10. Audit restrictions
11. Storage policies
12. Realtime authorization
13. Trusted financial functions
14. Negative security tests
15. Performance testing
16. Security review

------------------------------------------------------------------------

# 66. Change Control

Any authorization change must update:

-   `ROLE_PERMISSION_MATRIX.md`
-   this document
-   affected database policies
-   API/domain documentation
-   UI behavior
-   tests
-   audit expectations where applicable

Security behavior must never change silently through UI implementation.

------------------------------------------------------------------------

# 67. Status

**Current status: RLS security model synchronized with the approved v1 decision baseline; remaining implementation details are tracked explicitly.**

No production authorization policy should be considered final until the
authentication, role matrix, database, API, storage, and
financial-integrity specifications are aligned.
