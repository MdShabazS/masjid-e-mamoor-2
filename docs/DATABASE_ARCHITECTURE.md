# Masjid-e-Mamoor --- Database Architecture Specification

**Document Status:** Draft --- Architecture Review Required\
**Version:** 1.0\
**Phase:** Documentation-First / Pre-Development\
**Repository:** `MdShabazS/masjid-e-mamoor-2`

------------------------------------------------------------------------

## 1. Purpose

This document defines the planned PostgreSQL/Supabase database
architecture for Masjid-e-Mamoor.

It translates the approved product requirements, business rules, user
flows, system architecture, and role model into a data architecture.

This document defines:

-   domain entities
-   relationships
-   ownership
-   authoritative versus derived data
-   financial data structures
-   identity/application-user boundaries
-   donation obligations and allocations
-   finance accounts and transactions
-   committee operations
-   attendance and offline operations
-   notifications
-   audit records
-   storage metadata
-   constraints
-   indexes
-   lifecycle principles
-   transaction boundaries
-   migration expectations

It does not replace the detailed RLS, authentication, API,
financial-integrity, storage, or offline specifications.

------------------------------------------------------------------------

# 2. Database Principles

## DB-001 --- PostgreSQL Is the Authoritative Operational Store

PostgreSQL is the authoritative store for application business data.

Client state, local mobile storage, caches, and realtime events are not
authoritative.

## DB-002 --- Relational Integrity

Relationships must be represented with foreign keys where appropriate.

## DB-003 --- Database Constraints

Important invariants must be enforced at database level where practical.

Application validation must not be the only protection for critical
invariants.

## DB-004 --- Financial Immutability

Financial history must remain reconstructable.

Ordinary CRUD-style deletion must not be used to erase financial truth.

## DB-005 --- Derived Values

Balances, outstanding amounts, dashboard totals, and similar values
should be derived from authoritative records or maintained through
controlled atomic mechanisms.

## DB-006 --- Server Authority

The client cannot directly determine protected financial state.

## DB-007 --- RLS

Exposed application tables require appropriate Row Level Security.

Detailed policies are defined in `RLS_SECURITY_MODEL.md`.

## DB-008 --- Trusted Operations

Complex financial and multi-record operations should use trusted
database functions/server operations rather than exposing unrestricted
table mutations.

------------------------------------------------------------------------

# 3. Schema Organization

The exact physical schema name may be finalized during implementation,
but the architecture is logically divided into these domains:

``` text
Identity & Membership
├── application users
├── member profiles
├── roles / permissions
└── referrals

Donations
├── donation obligations
├── payment submissions
├── payment proofs
├── allocations
├── additional donations
├── anonymous donations
└── Jummah cash

Finance
├── accounts
├── transactions
├── transfers
├── expenses
├── corrections
└── financial audit/reconciliation

Committee
├── tasks
├── meetings
├── meeting attendance
└── assignments

Attendance
├── attendance events
├── attendance records
└── offline operation records

Notifications
├── notification events/outbox
├── user notifications
└── delivery attempts

Governance
├── audit events
├── idempotency records
└── configuration

Storage
└── protected file metadata
```

Physical table names are implementation details and must remain
consistent with the approved migration naming convention.

------------------------------------------------------------------------

# 4. Identity Boundary

Supabase Auth owns authentication identities.

Application tables own application-specific identity and authorization
data.

Conceptually:

``` text
auth.users
    |
    | 1:1 / controlled association
    v
application_user
    |
    +--> role assignments
    |
    +--> member profile
```

## Rules

-   Authentication identifiers must come from the authentication system.
-   Application role must not be stored only in unsafe client-controlled
    metadata.
-   Application records must reference the authenticated identity
    through a stable identifier.
-   Deleting or disabling application access must not silently destroy
    required financial history.

------------------------------------------------------------------------

# 5. Application User Entity

Conceptual fields:

  Field            Purpose
  ---------------- -----------------------------
  `id`             Application user identifier
  `auth_user_id`   Supabase Auth identity
  `status`         Application account state
  `created_at`     Creation timestamp
  `updated_at`     Last update timestamp

Additional fields may be added after the authentication architecture is
finalized.

### Constraints

-   `auth_user_id` must be unique.
-   timestamps must be server-controlled.
-   application status must use an approved state model.

------------------------------------------------------------------------

# 6. Role and Permission Model

The application supports:

1.  President / Super Admin
2.  Vice President
3.  Secretary
4.  Finance
5.  Auditor
6.  Committee Member
7.  Member

The final implementation may represent roles using a role table, enum,
or controlled assignment model.

The decision must be consistent with `ROLE_PERMISSION_MATRIX.md` and
`RLS_SECURITY_MODEL.md`.

Conceptual model:

``` text
application_user
      |
      v
role_assignment
      |
      v
role
      |
      v
permission
```

If permission overrides are introduced, they require explicit
architecture approval.

------------------------------------------------------------------------

# 7. Member Profile Entity

A member profile represents the application-level member identity and
member-specific information.

Conceptual fields:

  Field                   Purpose
  ----------------------- ---------------------------------------------
  `id`                    Member identifier
  `application_user_id`   Linked application identity when applicable
  `status`                Membership lifecycle state
  `display_name`          Member display name
  `phone`                 Contact information where applicable
  `created_at`            Creation timestamp
  `updated_at`            Update timestamp

The final member schema must distinguish identity, profile, and
financial information.

------------------------------------------------------------------------

# 8. Membership History

Important membership changes should be represented through history/audit
mechanisms.

Examples include:

-   activation
-   deactivation
-   administrative status changes
-   relevant profile changes

Historical records must remain reconstructable where required by
reporting or audit.

------------------------------------------------------------------------

# 9. Referral Entity

A referral represents attribution between a referrer and
registration/member creation.

Conceptual relationships:

``` text
referrer member
      |
      v
referral
      |
      v
referred registration/member
```

Possible fields:

-   referral identifier
-   referral code/token
-   referrer
-   referred member/application identity
-   status
-   created timestamp
-   expiration where approved

Exact expiration and lifecycle rules remain open until the product
decision is finalized.

------------------------------------------------------------------------

# 10. Donation Obligation Entity

A donation obligation represents an amount applicable to a member for a
defined obligation period.

Conceptual fields:

  Field               Purpose
  ------------------- ---------------------------------
  `id`                Obligation identifier
  `member_id`         Member
  `effective_month`   Applicable month
  `amount`            Authoritative obligation amount
  `status`            Obligation lifecycle state
  `created_at`        Creation timestamp
  `updated_at`        Update timestamp

## Constraints

A member must not accidentally receive duplicate obligations for the
same defined obligation period.

The exact uniqueness key depends on the finalized obligation model.

------------------------------------------------------------------------

# 11. Donation Obligation History

If obligation values can change over time, historical records must
preserve the values that were actually applicable.

Do not overwrite historical financial meaning merely because a current
monthly amount changed.

Possible implementation patterns:

-   effective-dated records
-   immutable obligation snapshots
-   versioned obligation records

The final implementation must select one explicit model.

------------------------------------------------------------------------

# 12. Payment Submission Entity

A payment submission represents a payment claim/request awaiting the
applicable verification process.

Conceptual fields:

  Field              Purpose
  ------------------ -----------------------------------------
  `id`               Payment identifier
  `member_id`        Submitting member where applicable
  `amount`           Submitted amount
  `payment_method`   UPI/cash/other approved type
  `status`           Payment lifecycle
  `operation_id`     Idempotency reference where required
  `submitted_at`     Submission timestamp
  `verified_at`      Verification timestamp where applicable
  `verified_by`      Verifying user where applicable
  `created_at`       Creation timestamp
  `updated_at`       Update timestamp

Payment status names must be finalized consistently across API and
database specifications.

------------------------------------------------------------------------

# 13. Payment Proof Metadata

Payment proof files must not rely on unrestricted public URLs.

Conceptual metadata:

  Field                 Purpose
  --------------------- -----------------------------
  `id`                  Proof identifier
  `payment_id`          Associated payment
  `storage_object_id`   Protected storage reference
  `file_name`           Display metadata
  `content_type`        File type
  `size_bytes`          Size
  `created_at`          Upload timestamp

Actual storage paths and bucket rules belong in
`STORAGE_ARCHITECTURE.md`.

------------------------------------------------------------------------

# 14. Donation Allocation Entity

Allocation is the authoritative relationship between a verified payment
and an eligible obligation or donation target.

Conceptual fields:

  Field                   Purpose
  ----------------------- ----------------------------------------
  `id`                    Allocation identifier
  `payment_id`            Payment
  `obligation_id`         Target obligation where applicable
  `amount`                Allocated amount
  `allocation_sequence`   Ordering within operation where needed
  `created_at`            Allocation timestamp

## Constraints

-   allocation amount \> 0 where a record exists
-   total allocations cannot exceed payment amount
-   allocation cannot exceed eligible outstanding amount
-   duplicate allocation must be prevented
-   allocation must be created through an authorized workflow

------------------------------------------------------------------------

# 15. FIFO Allocation

FIFO ordering must be deterministic.

The final ordering must use a stable combination of obligation period
and unique identifier or another explicitly approved ordering.

Conceptually:

``` text
eligible outstanding obligations
        |
        v
deterministic ordering
        |
        v
oldest obligation first
        |
        v
next obligation if amount remains
```

Concurrency protection is required so two simultaneous allocations
cannot both consume the same outstanding amount.

------------------------------------------------------------------------

# 16. Additional Donation Entity

An additional donation must be distinguishable from recurring obligation
settlement.

Possible attributes:

-   donor/member reference where permitted
-   amount
-   payment reference
-   classification
-   anonymity state
-   created timestamp

The final schema must ensure reports can distinguish recurring
settlement from additional donations.

------------------------------------------------------------------------

# 17. Anonymous Donation Model

Anonymous donations still require enough authoritative information for
financial reconciliation.

The data model must distinguish:

-   financial transaction identity
-   donor visibility
-   public/member-facing anonymity

Anonymity must be enforced at authorization/query boundaries rather than
only by hiding a UI field.

------------------------------------------------------------------------

# 18. Jummah Cash Entity

Jummah cash intake must be represented as a controlled financial intake.

Conceptual fields may include:

-   record identifier
-   date/event
-   amount
-   receiving account
-   recorder
-   notes/reference
-   created timestamp
-   verification/reconciliation state where applicable

Exact reconciliation workflow remains subject to the finance
specification.

------------------------------------------------------------------------

# 19. Finance Account Entity

A finance account represents a controlled financial account or ledger
bucket used by the organization.

Conceptual fields:

  Field          Purpose
  -------------- --------------------
  `id`           Account identifier
  `name`         Account name
  `type`         Account category
  `status`       Active/inactive
  `currency`     Currency
  `created_at`   Creation timestamp
  `updated_at`   Update timestamp

The application must not treat a client-provided balance as
authoritative.

------------------------------------------------------------------------

# 20. Financial Transaction Entity

A financial transaction represents an authoritative financial movement.

Conceptual fields:

  Field                Purpose
  -------------------- ---------------------------------------
  `id`                 Transaction identifier
  `account_id`         Affected account
  `transaction_type`   Controlled type
  `amount`             Monetary amount
  `direction`          Inflow/outflow or approved equivalent
  `reference_type`     Source business entity
  `reference_id`       Source identifier
  `operation_id`       Idempotency reference
  `created_by`         Actor
  `created_at`         Timestamp

The exact accounting model must be finalized in
`FINANCIAL_INTEGRITY_SPEC.md`.

------------------------------------------------------------------------

# 21. Transfer Entity

A transfer links source and destination financial accounts.

Conceptually:

``` text
source account
      |
      | transfer
      v
destination account
```

The transfer operation must preserve financial consistency.

The database transaction boundary must ensure the source and destination
effects cannot be committed independently.

------------------------------------------------------------------------

# 22. Expense Entity

An expense represents an authorized organizational expenditure.

Possible fields:

-   expense identifier
-   amount
-   account
-   category
-   description
-   vendor/payee where applicable
-   proof reference
-   status
-   created_by
-   approved_by
-   created_at
-   updated_at

Approval requirements are finalized by finance/security specifications.

------------------------------------------------------------------------

# 23. Financial Correction Entity

Corrections should be represented as controlled financial operations
rather than arbitrary mutation of historical rows.

Possible fields:

-   correction identifier
-   target entity
-   target transaction
-   reason
-   correcting operation
-   actor
-   timestamp

The final accounting model must preserve reconstructability.

------------------------------------------------------------------------

# 24. Cancellation/Reversal Entity

Where a financial action must be cancelled or reversed, the database
must preserve the relationship between the original action and the
corrective action.

A reversal must not make the original historical record disappear.

------------------------------------------------------------------------

# 25. Committee Task Entity

Conceptual fields:

-   task identifier
-   title
-   description
-   status
-   priority where approved
-   creator
-   assignee
-   due date
-   created timestamp
-   updated timestamp

Task assignment must reference valid application users/members.

------------------------------------------------------------------------

# 26. Meeting Entity

Conceptual fields:

-   meeting identifier
-   title/type
-   scheduled start
-   scheduled end
-   location/details
-   organizer
-   status
-   created timestamp
-   updated timestamp

------------------------------------------------------------------------

# 27. Meeting Attendance Entity

Meeting attendance represents a participant's attendance at a specific
meeting.

A uniqueness constraint should prevent duplicate attendance for the same
participant and meeting.

------------------------------------------------------------------------

# 28. Attendance Event Entity

Attendance events represent activities for which attendance may be
recorded.

Examples:

-   meeting
-   Jummah
-   approved organizational event

Conceptual fields:

-   event identifier
-   event type
-   scheduled date/time
-   location policy
-   status
-   created_by
-   created_at

------------------------------------------------------------------------

# 29. Attendance Record Entity

Conceptual fields:

  Field                  Purpose
  ---------------------- -----------------------------------------
  `id`                   Attendance identifier
  `event_id`             Event
  `member_id`            Member
  `recorded_at`          Timestamp
  `source`               Online/offline/manual/approved source
  `operation_id`         Idempotency reference
  `location_reference`   Approved location metadata if required
  `status`               Accepted/pending/rejected as applicable

Sensitive location data must be minimized.

------------------------------------------------------------------------

# 30. Offline Operation Entity

Offline-capable mutations require a durable operation identity.

Conceptual fields:

  Field                 Purpose
  --------------------- -----------------------------
  `operation_id`        Client-generated stable ID
  `actor_id`            Authenticated actor
  `operation_type`      Controlled operation
  `payload_reference`   Operation data/reference
  `status`              Pending/processed/rejected
  `created_at`          Original timestamp
  `processed_at`        Server processing timestamp
  `result_reference`    Result where applicable

The exact payload strategy must avoid creating an unsafe
arbitrary-command table.

------------------------------------------------------------------------

# 31. Idempotency Model

Retryable operations require a stable idempotency key.

A unique constraint should prevent duplicate processing of the same
logical operation within its defined scope.

Conceptually:

``` text
actor + operation_type + idempotency_key
                 |
                 v
          unique operation
```

The exact key scope must be defined per operation.

------------------------------------------------------------------------

# 32. Notification Outbox Entity

The outbox records business events that require reliable downstream
notification handling.

Conceptual fields:

-   event identifier
-   event type
-   aggregate/entity type
-   aggregate/entity identifier
-   recipient reference
-   payload/reference
-   status
-   attempt count
-   next attempt timestamp
-   created timestamp
-   processed timestamp

Business transaction and outbox creation should be atomic where reliable
delivery semantics require it.

------------------------------------------------------------------------

# 33. User Notification Entity

A user notification represents a notification visible to an authorized
user.

Possible fields:

-   notification identifier
-   recipient
-   event reference
-   title/content localization keys
-   read state
-   created timestamp
-   read timestamp

Sensitive notification content must respect authorization.

------------------------------------------------------------------------

# 34. Notification Delivery Attempt

Delivery attempts may be stored separately from business notification
state.

Possible fields:

-   attempt identifier
-   notification/outbox reference
-   channel
-   status
-   error classification
-   attempted_at

Delivery failure must not corrupt the underlying business transaction.

------------------------------------------------------------------------

# 35. Audit Event Entity

Audit events provide an immutable/restricted history of sensitive
actions.

Conceptual fields:

  Field                Purpose
  -------------------- -----------------------------------------
  `id`                 Audit identifier
  `actor_id`           Actor
  `action`             Controlled action
  `entity_type`        Affected entity type
  `entity_id`          Affected entity
  `operation_id`       Operation reference
  `before_reference`   Previous-state reference where required
  `after_reference`    New-state reference where required
  `reason`             Reason/context
  `created_at`         Timestamp

The implementation must avoid storing unnecessary sensitive copies of
entire records.

------------------------------------------------------------------------

# 36. Configuration Entity

Business configuration should be represented separately from
transactional data.

Potential configuration includes:

-   supported languages
-   approved organization settings
-   selected payment configuration
-   notification settings
-   approved operational thresholds

Configuration that affects financial history must use effective-dated or
versioned semantics where required.

------------------------------------------------------------------------

# 37. Storage Metadata

Database records should contain references to protected storage objects
rather than embedding file binaries.

Relationship:

``` text
business record
      |
      v
file metadata
      |
      v
protected storage object
```

Storage authorization is defined separately.

------------------------------------------------------------------------

# 38. Primary Keys

All major business entities should use stable primary keys.

UUIDs are the default architectural direction for
distributed/mobile-safe identifiers unless a specific entity requires
another type.

Primary keys must not be exposed as proof of authorization.

------------------------------------------------------------------------

# 39. Foreign Keys

Foreign keys should be used for relationships such as:

-   application user → auth user
-   member → application user
-   role assignment → user/role
-   referral → referrer/member
-   obligation → member
-   payment → member
-   allocation → payment/obligation
-   proof → payment
-   transaction → account
-   transfer → accounts
-   expense → account/user
-   task → user/member
-   meeting attendance → meeting/member
-   attendance → event/member
-   notification → user
-   audit event → actor

------------------------------------------------------------------------

# 40. Delete Strategy

Deletion must be entity-specific.

### Generally avoid cascading deletion for:

-   financial transactions
-   payments
-   allocations
-   obligations
-   audit events
-   attendance history
-   important membership history

### Prefer:

-   status changes
-   archival states
-   controlled soft deletion where justified
-   explicit correction/reversal records

The final schema must document every non-obvious delete behavior.

------------------------------------------------------------------------

# 41. Monetary Data

Money must not be stored as floating-point values.

The final database implementation should use an exact monetary
representation, with precision/scale selected consistently for the
organization's currency and accounting requirements.

All calculations must use the same representation.

------------------------------------------------------------------------

# 42. Timestamps

Authoritative timestamps must be generated by trusted server/database
mechanisms where practical.

The system must distinguish:

-   client event time
-   server receipt time
-   authoritative creation time
-   processing time

This distinction is especially important for offline synchronization and
audit.

------------------------------------------------------------------------

# 43. Time Zone

The database must use a consistent timestamp strategy.

Organization-local display time may be applied at the application layer.

Business rules involving dates/months must explicitly define which
timezone determines the effective business date.

------------------------------------------------------------------------

# 44. Donation Month Representation

Monthly obligations should use a canonical period representation rather
than relying on display strings.

The implementation must prevent ambiguous month parsing and
timezone-induced month changes.

------------------------------------------------------------------------

# 45. Financial Constraints

At minimum, the final database design must enforce or safely guarantee:

-   non-negative valid monetary amounts where applicable
-   allocation cannot exceed payment
-   allocation cannot exceed eligible outstanding
-   no duplicate authoritative operation
-   valid account references
-   valid member references
-   valid payment state transitions
-   valid transfer relationships
-   valid financial references

Complex constraints that cannot be represented safely with ordinary
CHECK constraints must be implemented through trusted transactional
operations.

------------------------------------------------------------------------

# 46. Index Strategy

Indexes should be designed around actual access patterns.

Expected index areas include:

### Identity

-   auth user identifier
-   application user status
-   role assignment

### Members

-   searchable member identity fields where approved
-   membership status
-   referral relationships

### Donations

-   member + obligation period
-   payment status
-   payment member
-   allocation payment
-   allocation obligation

### Finance

-   account
-   transaction date
-   transaction reference
-   expense status
-   transfer references

### Committee

-   assignee + task status
-   meeting date
-   attendance event + member

### Offline

-   operation ID
-   actor + operation
-   pending status

### Notifications

-   recipient + unread/read state
-   outbox status + next attempt

### Audit

-   actor
-   entity type + entity ID
-   created timestamp
-   operation ID

Indexes must be validated against real query plans after implementation.

------------------------------------------------------------------------

# 47. Unique Constraints

Expected uniqueness areas include:

-   auth identity association
-   approved role assignment combinations
-   referral codes where applicable
-   member + obligation period
-   payment operation/idempotency key
-   allocation operation constraints
-   attendance event + member
-   offline operation identity
-   notification/event identifiers where required

Exact composite keys are finalized with the relevant domain
specifications.

------------------------------------------------------------------------

# 48. Check Constraints

Where practical, use database constraints for:

-   valid non-negative amounts
-   valid status values
-   valid enum-like categories
-   required relationships
-   basic date consistency
-   valid direction/type combinations

Complex workflow transitions belong in trusted operations.

------------------------------------------------------------------------

# 49. Transaction Boundaries

The following should be treated as transactional workflows where
applicable:

### Payment verification

``` text
verify payment
    +
allocate amount
    +
create required financial records
    +
audit
```

### Account transfer

``` text
debit source
    +
credit destination
    +
record transfer
    +
audit
```

### Expense posting

``` text
approve/post expense
    +
financial transaction
    +
audit
```

### Combined payment

``` text
create/verify authoritative payment
    +
allocate FIFO
    +
update resulting state
    +
audit
```

Exact boundaries are finalized in the financial integrity specification.

------------------------------------------------------------------------

# 50. Concurrency

Financial allocation, verification, transfers, and other sensitive
mutations must account for concurrent requests.

The database/trusted operation must re-read authoritative state under
the appropriate transaction/locking strategy before committing.

Client-fetched outstanding values cannot be trusted for final
allocation.

------------------------------------------------------------------------

# 51. Derived Data

The following should generally be derived:

-   member outstanding amount
-   account balance
-   payment allocated amount
-   payment remaining amount
-   dashboard totals
-   unread notification counts
-   report aggregates

If materialized/cached values are introduced for performance, they must
have an explicit reconciliation strategy.

------------------------------------------------------------------------

# 52. Realtime Database Considerations

Realtime subscriptions should expose only data that the authenticated
user is allowed to receive.

Database changes must remain correct even if:

-   a realtime event is missed
-   a client disconnects
-   a subscription starts late
-   a client receives duplicate events

Clients must reconcile with database state.

------------------------------------------------------------------------

# 53. RLS Boundary

Every exposed table must be reviewed for:

1.  SELECT policy
2.  INSERT policy
3.  UPDATE policy
4.  DELETE policy
5.  ownership rules
6.  role/permission rules
7.  sensitive-field exposure
8.  trusted-operation exceptions

Detailed policies belong in `RLS_SECURITY_MODEL.md`.

------------------------------------------------------------------------

# 54. Service/Trusted Operations

Service-role or equivalent elevated database access must not be exposed
to browser/mobile clients.

Trusted operations should be narrowly scoped.

Examples:

-   financial verification
-   FIFO allocation
-   combined payment
-   transfer
-   sensitive correction
-   controlled role administration
-   notification outbox processing

------------------------------------------------------------------------

# 55. Database Functions

Database functions may be used where atomicity, locking, or server-side
integrity requires them.

Functions must:

-   accept validated inputs
-   re-check authorization/context as designed
-   operate transactionally
-   avoid unnecessary elevated privileges
-   return deterministic results
-   be covered by tests
-   be documented

Function names and signatures must be finalized in API/domain
specifications.

------------------------------------------------------------------------

# 56. Migration Strategy

Database changes must be migration-based.

Each migration must be:

-   ordered
-   reproducible
-   reviewable
-   tested
-   reversible where practical
-   compatible with the current application rollout strategy

Do not make undocumented manual production schema changes.

------------------------------------------------------------------------

# 57. Seed Data

Development/test seed data must be clearly separated from production
data.

Seed data may include:

-   test roles
-   test users
-   controlled sample members
-   sample obligations
-   sample finance accounts
-   sample committee data

Production seed behavior must be explicitly approved.

------------------------------------------------------------------------

# 58. Test Database Strategy

Automated database tests should verify:

-   constraints
-   foreign keys
-   RLS
-   role permissions
-   trusted functions
-   financial atomicity
-   idempotency
-   FIFO
-   partial payment
-   concurrent operations
-   offline operation processing
-   audit generation

Tests must use isolated test data.

------------------------------------------------------------------------

# 59. Backup and Recovery

The database architecture must support:

-   scheduled backups
-   point-in-time recovery where available/approved
-   restore testing
-   environment separation
-   controlled production access

Backup policy is detailed in `BACKUP_RECOVERY_SPEC.md`.

------------------------------------------------------------------------

# 60. Data Retention

Retention must be defined separately for:

-   financial records
-   audit records
-   notifications
-   payment proofs
-   attendance
-   application logs
-   temporary/offline operation records

No retention policy should silently delete records required for
financial or legal reconstruction.

------------------------------------------------------------------------

# 61. Data Access Layers

Application code should not scatter raw database access throughout UI
components.

Recommended boundary:

``` text
UI
 |
v
feature/domain hooks
 |
v
API/domain client
 |
v
trusted backend/database operation
 |
v
PostgreSQL
```

Read/query operations may use controlled Supabase clients where
appropriate.

Sensitive mutations must use the approved trusted operation.

------------------------------------------------------------------------

# 62. Shared Type Strategy

Database-derived types should feed shared application types where
practical.

The repository should avoid independently redefining the same entity
shape across:

-   web
-   mobile
-   API
-   validation
-   database

Generated types must not replace domain validation.

------------------------------------------------------------------------

# 63. Schema Naming Standards

Names must be:

-   lowercase
-   consistent
-   descriptive
-   stable
-   free from UI terminology
-   singular/plural convention chosen once and applied consistently

The final naming convention must be documented before migrations are
written.

------------------------------------------------------------------------

# 64. Auditability Requirements

The database must make it possible to answer:

-   who performed a sensitive operation?
-   what entity changed?
-   when did it happen?
-   what operation caused it?
-   what financial records were affected?
-   what correction/reversal followed?
-   what relevant historical state existed?

The database must not rely exclusively on application logs for critical
financial auditability.

------------------------------------------------------------------------

# 65. Privacy Requirements

The schema must support least-privilege access.

Sensitive information should be separated logically where that improves
authorization safety.

Examples:

-   financial information
-   private member information
-   payment proofs
-   GPS/location metadata
-   administrative records

Do not duplicate sensitive information unnecessarily across tables.

------------------------------------------------------------------------

# 66. Data Lifecycle

Typical lifecycle:

``` text
Create
  |
Validate
  |
Authorize
  |
Commit
  |
Propagate
  |
Report
  |
Archive/retain
```

Financial records may additionally follow:

``` text
Created
  |
Verified
  |
Allocated/Posted
  |
Corrected/Reversed if necessary
  |
Retained
```

------------------------------------------------------------------------

# 67. Open Database Decisions

The following require explicit review before migration implementation:

  Decision                               Impact
  -------------------------------------- ----------------------
  Exact role storage model               Auth/RLS
  Permission override model              Authorization
  Member/application-user relationship   Identity
  Obligation effective-date model        Donation history
  Payment status enum                    Finance/API
  Exact accounting representation        Financial integrity
  Transaction/ledger model               Account balances
  Expense approval structure             Separation of duties
  Transfer approval structure            Financial controls
  Attendance event model                 Offline/GPS
  Offline payload storage                Sync security
  Notification schema                    Realtime/outbox
  Audit before/after representation      Audit/privacy
  Retention periods                      Operations
  Physical table naming convention       Migrations

------------------------------------------------------------------------

# 68. Implementation Order

The database implementation should proceed approximately in this
dependency order:

1.  Base extensions/configuration
2.  Application user/profile
3.  Roles/permissions
4.  Membership/referrals
5.  Donation obligations
6.  Payment submissions
7.  Payment proofs/storage metadata
8.  Allocation model
9.  Finance accounts
10. Financial transactions
11. Transfers
12. Expenses
13. Corrections/reversals
14. Committee tasks/meetings
15. Attendance
16. Offline operations
17. Notifications/outbox
18. Audit
19. RLS policies
20. Trusted functions
21. Indexes and performance tuning
22. Seed/test data

This order may change after the API/security documents are finalized.

------------------------------------------------------------------------

# 69. Database Definition of Done

The database architecture is implementation-ready when:

-   entities are documented
-   relationships are documented
-   ownership is documented
-   financial authority is documented
-   donation allocation is documented
-   constraints are identified
-   indexes are identified
-   RLS boundaries are identified
-   trusted operations are identified
-   idempotency is identified
-   offline storage model is identified
-   audit model is identified
-   storage metadata is identified
-   migration strategy is defined
-   test requirements are defined
-   retention dependencies are defined
-   open decisions are explicitly tracked

------------------------------------------------------------------------

# 70. Change Control

A database design change must not be made only because implementation is
inconvenient.

For every material schema change:

1.  Identify the affected business rule.
2.  Identify affected user flows.
3.  Identify API/RLS/security impact.
4.  Identify migration impact.
5.  Update this document and dependent specifications.
6.  Review the change.
7.  Implement through a migration.

------------------------------------------------------------------------

# 71. Status

**Current status: Database architecture specification generated for
review.**

No production schema should be created solely from this document until
the dependent authentication, RLS, financial-integrity, API, storage,
and offline specifications are aligned.
