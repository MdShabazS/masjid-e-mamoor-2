# Masjid-e-Mamoor --- User Flows Specification

**Document Status:** Draft --- Product Flow Review Required\
**Version:** 1.0\
**Phase:** Documentation-First / Pre-Development\
**Repository:** `MdShabazS/masjid-e-mamoor-2`

------------------------------------------------------------------------

## 1. Purpose

This document defines the expected end-to-end user journeys of
Masjid-e-Mamoor.

It describes:

-   who starts a workflow
-   what the user sees
-   what actions are available
-   what validation occurs
-   what backend operation is authoritative
-   what state changes
-   what other roles can observe
-   what happens on failure
-   what happens when the device is offline

The flows are product behavior specifications. They do not replace API,
database, RLS, or financial integrity specifications.

------------------------------------------------------------------------

# 2. Flow Conventions

Each flow identifies:

-   **Actor** --- user initiating the workflow
-   **Preconditions** --- conditions required before starting
-   **Trigger** --- event that starts the flow
-   **Steps** --- expected interaction sequence
-   **Backend authority** --- authoritative operation
-   **Success state** --- resulting state
-   **Failure state** --- expected failure behavior
-   **Realtime impact** --- data that may update elsewhere
-   **Audit impact** --- whether the operation requires auditability

------------------------------------------------------------------------

# 3. Application Entry Flow

## UF-001 --- Application Launch

**Actor:** Any user

### Preconditions

-   Application is installed or web application is reachable.

### Steps

1.  User opens the application.
2.  Application loads configuration.
3.  Authentication state is checked.
4.  If authenticated, the application loads the user's authorized
    application context.
5.  If unauthenticated, the user is shown the authentication entry
    point.
6.  Authorized navigation is generated from current role/permission
    state.

### Rules

-   Authentication state is not equivalent to authorization.
-   UI navigation is not a security boundary.
-   Protected data must not be fetched merely because a route exists.

### Success

User reaches the appropriate authorized application area.

------------------------------------------------------------------------

# 4. Phone OTP Authentication Flow

## UF-002 --- Sign In With Phone OTP

**Actor:** Any registered user

### Steps

1.  User enters phone number.
2.  Client validates basic input.
3.  User requests OTP.
4.  Authentication provider sends OTP.
5.  User enters OTP.
6.  Authentication provider verifies OTP.
7.  Application establishes authenticated session.
8.  Application retrieves backend-controlled profile/role context.
9.  User is redirected to the authorized landing experience.

### Failure Cases

-   Invalid phone format
-   OTP delivery failure
-   Incorrect OTP
-   Expired OTP
-   Rate limiting
-   Session establishment failure
-   User authenticated but not provisioned for the application

### Rules

-   OTP verification authenticates identity.
-   Application role must come from trusted application data.
-   User input cannot assign a role.

------------------------------------------------------------------------

# 5. New Member / Referral Registration Flow

## UF-003 --- Referral Registration

**Actor:** Prospective member / referred person

### Preconditions

-   Registration workflow is enabled.
-   Referral information is valid if supplied.

### Steps

1.  User opens registration/referral link.
2.  Application identifies the referral context.
3.  User enters required registration information.
4.  Client performs input validation.
5.  Server validates referral context.
6.  Account/authentication is created through the approved
    authentication flow.
7.  Member profile is created or linked.
8.  Referral attribution is stored.
9.  User receives the appropriate onboarding state.

### Failure Cases

-   Invalid referral
-   Already used referral
-   Duplicate identity
-   Missing required information
-   Authentication failure

### Rules

-   Referral attribution must not be silently changed by the client.
-   Duplicate member identity handling follows membership business
    rules.

### Audit

Referral/member creation should be traceable.

------------------------------------------------------------------------

# 6. Member Profile Flow

## UF-004 --- View Own Profile

**Actor:** Member

### Steps

1.  Member opens profile.
2.  Application fetches authorized own-profile data.
3.  Application displays permitted fields.
4.  Sensitive administrative fields are not exposed.

### UF-005 --- Update Own Profile

1.  Member opens editable profile.
2.  Member changes permitted fields.
3.  Client validates input.
4.  Server validates authorization and business rules.
5.  Update is committed.
6.  Updated state is returned.
7.  Relevant views refresh.

### Rules

-   Member cannot modify role.
-   Member cannot modify protected financial or administrative fields.
-   Update must not overwrite unrelated fields.

------------------------------------------------------------------------

# 7. Administrative Member Management Flow

## UF-006 --- Authorized User Views Members

**Actor:** Authorized administrative role

### Steps

1.  User opens member management.
2.  Backend evaluates current authorization.
3.  Authorized member data is returned.
4.  UI displays permitted member information.
5.  Search/filter operations remain within authorized scope.

### UF-007 --- Administrative Member Update

1.  Authorized user selects a member.
2.  Editable fields are displayed according to permission.
3.  User submits change.
4.  Backend validates authorization.
5.  Business rules are evaluated.
6.  Change is committed.
7.  Audit record is created where required.
8.  Realtime consumers receive the updated state where applicable.

------------------------------------------------------------------------

# 8. Donation Obligation Flow

## UF-008 --- View Monthly Obligation

**Actor:** Member

### Steps

1.  Member opens donations.
2.  Application retrieves authoritative obligations.
3.  Current applicable month is displayed.
4.  Payment/settlement history is displayed as authorized.
5.  Outstanding amount is calculated from authoritative state.

### Rules

-   Client does not calculate authoritative financial truth.
-   Historical obligation values remain reconstructable.

------------------------------------------------------------------------

# 9. Donation Payment Submission Flow

## UF-009 --- Start Donation Payment

**Actor:** Member

### Steps

1.  Member selects an eligible donation/payment target.
2.  Application displays authoritative outstanding information.
3.  Member enters payment amount where applicable.
4.  Client validates basic amount constraints.
5.  Application presents the approved payment method.
6.  For UPI, application may launch a UPI intent/deep link.
7.  User completes the external payment experience.
8.  User returns to the application.
9.  Payment submission is created/confirmed through the backend
    workflow.
10. Payment enters the appropriate non-final state.

### Critical Rule

Returning from UPI does not itself prove payment settlement.

### Failure Cases

-   Invalid amount
-   Payment app unavailable
-   User cancels UPI
-   Network loss
-   Duplicate submission
-   Payment proof missing where required

------------------------------------------------------------------------

# 10. Payment Proof Submission Flow

## UF-010 --- Upload Payment Proof

**Actor:** Member

### Steps

1.  Member selects a payment submission.
2.  Member selects proof.
3.  Client validates supported file constraints.
4.  File is uploaded to authorized storage.
5.  Backend associates the file with the payment.
6.  Payment remains in the applicable verification state.

### Rules

-   Storage authorization is enforced independently.
-   A public file URL must not be assumed.
-   Proof upload does not equal payment verification.

------------------------------------------------------------------------

# 11. Finance Payment Verification Flow

## UF-011 --- Verify Payment

**Actor:** Finance / authorized financial role

### Preconditions

-   Payment submission exists.
-   User has verification permission.

### Steps

1.  Finance opens pending payments.
2.  Application retrieves payment details and permitted proof.
3.  Finance reviews payment.
4.  Finance selects the applicable decision.
5.  Backend revalidates authorization.
6.  Backend performs the financial state transition.
7.  Allocation is performed according to approved rules.
8.  Financial records are committed atomically where required.
9.  Audit information is recorded.
10. Member-visible state updates.

### Failure Cases

-   Payment already processed
-   Invalid state transition
-   Amount inconsistency
-   Allocation conflict
-   Concurrent processing
-   Authorization failure

### Concurrency Rule

Two finance users processing the same payment must not create duplicate
financial effects.

------------------------------------------------------------------------

# 12. Payment Rejection Flow

## UF-012 --- Reject Payment

**Actor:** Authorized Finance user

### Steps

1.  Finance opens a pending payment.
2.  Finance reviews details.
3.  Finance selects rejection.
4.  Finance provides required reason if the final policy requires it.
5.  Backend validates current state.
6.  Payment transitions to the approved rejected state.
7.  No unauthorized settlement/allocation occurs.
8.  Audit event is recorded.
9.  Member receives the appropriate status/notification.

### Rule

A rejected payment must not be treated as verified payment.

------------------------------------------------------------------------

# 13. FIFO Allocation Flow

## UF-013 --- Allocate Verified Payment

**Actor:** Trusted financial operation

### Steps

1.  Verified payment amount is established.
2.  Eligible outstanding obligations are retrieved.
3.  Obligations are ordered according to approved FIFO ordering.
4.  Amount is applied to the oldest eligible outstanding obligation.
5.  If the obligation is not fully settled, allocation stops when
    payment is exhausted.
6.  If payment remains, the next eligible obligation is processed.
7.  Allocation records are created.
8.  Remaining outstanding values are derived from authoritative records.
9.  Result is committed atomically.

### Rules

-   Allocation cannot exceed payment.
-   Allocation cannot exceed eligible outstanding.
-   Client cannot force an invalid allocation.
-   Concurrent allocations must be protected.

------------------------------------------------------------------------

# 14. Partial Payment Flow

## UF-014 --- Partial Settlement

### Steps

1.  Payment amount is lower than an eligible obligation.
2.  Payment is verified.
3.  Applicable amount is allocated.
4.  Obligation remains partially outstanding.
5.  Member sees updated outstanding amount.
6.  Payment and allocation history remains available to authorized
    users.

------------------------------------------------------------------------

# 15. Combined Outstanding Payment Flow

## UF-015 --- Pay Multiple Outstanding Obligations

**Actor:** Member

### Steps

1.  Member opens outstanding summary.
2.  Application displays eligible outstanding obligations.
3.  Member chooses combined payment.
4.  Backend calculates authoritative eligible amount.
5.  Payment flow is initiated.
6.  Payment submission is created.
7.  Finance verifies through the authorized workflow.
8.  Trusted financial operation allocates the verified amount according
    to FIFO.
9.  All required financial records are committed atomically.
10. Updated outstanding state becomes visible across authorized clients.

### Retry

If the same operation is retried, idempotency prevents duplicate
financial effects.

------------------------------------------------------------------------

# 16. Overpayment Flow

## UF-016 --- Payment Exceeds Eligible Outstanding

### Steps

1.  Payment amount is verified.
2.  Backend calculates eligible outstanding.
3.  Excess amount is detected.
4.  System applies only approved allocation rules.
5.  Any remaining excess follows the explicitly approved overpayment
    policy.
6.  Result is shown distinctly in financial records.

### Rule

The system must not silently convert excess into future-month settlement
unless explicitly permitted.

------------------------------------------------------------------------

# 17. Additional Donation Flow

## UF-017 --- Record Additional Donation

**Actor:** Member or authorized intake role, according to final product
policy

### Steps

1.  User selects additional donation.
2.  User enters amount/details.
3.  Payment workflow proceeds.
4.  Finance verification occurs where required.
5.  Donation is classified separately from recurring obligation
    settlement.
6.  Financial reporting includes the additional donation correctly.

------------------------------------------------------------------------

# 18. Anonymous Donation Flow

## UF-018 --- Anonymous Donation

### Steps

1.  Donor selects anonymous option where supported.
2.  Donation is submitted through the appropriate workflow.
3.  Financial system retains required accounting information.
4.  Member-facing/reporting views hide identity according to
    authorization/privacy rules.
5.  Authorized financial users retain only the access required by
    policy.

------------------------------------------------------------------------

# 19. Jummah Cash Flow

## UF-019 --- Record Jummah Cash

**Actor:** Authorized finance/intake role

### Steps

1.  Authorized user opens Jummah cash entry.
2.  User enters required cash information.
3.  Application validates the entry.
4.  Backend validates authorization.
5.  Cash record is created.
6.  Relevant financial account/transaction records are updated through
    the approved financial operation.
7.  Audit information is recorded.
8.  Financial reports reflect the entry.

------------------------------------------------------------------------

# 20. Finance Account Flow

## UF-020 --- View Financial Accounts

**Actor:** Authorized financial/oversight role

### Steps

1.  User opens accounts.
2.  Backend evaluates permission.
3.  Authorized account information is loaded.
4.  Balances are derived from authoritative financial records.

### Rule

Client-side totals are not authoritative.

------------------------------------------------------------------------

# 21. Account Transfer Flow

## UF-021 --- Transfer Between Accounts

**Actor:** Authorized Finance user

### Steps

1.  User selects source account.
2.  User selects destination account.
3.  User enters amount and required context.
4.  Client validates basic input.
5.  Backend validates authorization and financial constraints.
6.  Source and destination effects are committed atomically.
7.  Audit information is recorded.
8.  Realtime financial views update.

### Failure

If any required part fails, the transfer must not be represented as
partially successful.

------------------------------------------------------------------------

# 22. Expense Flow

## UF-022 --- Create Expense

**Actor:** Authorized Finance user

### Steps

1.  Finance opens expense entry.
2.  User enters expense information.
3.  Required proof is attached where applicable.
4.  Backend validates the request.
5.  If approval is required, expense enters the appropriate pending
    state.
6.  If no approval is required, the authorized posting workflow
    proceeds.
7.  Financial records are updated atomically.
8.  Audit information is recorded.

------------------------------------------------------------------------

# 23. Expense Approval Flow

## UF-023 --- Approve Expense

**Actor:** Authorized approver

### Steps

1.  Approver opens pending expense.
2.  Expense details and proof are reviewed.
3.  Approver selects the permitted action.
4.  Backend rechecks authorization and current state.
5.  Approved state is committed.
6.  Financial posting occurs according to the approved architecture.
7.  Audit event is created.

------------------------------------------------------------------------

# 24. Financial Correction Flow

## UF-024 --- Correct Financial Record

**Actor:** Authorized role

### Steps

1.  User identifies incorrect financial record.
2.  User opens correction workflow.
3.  System displays relevant history.
4.  User provides correction information/reason.
5.  Backend validates authorization.
6.  Correction is applied through the approved financial operation.
7.  Original history remains reconstructable.
8.  Audit event is recorded.
9.  Derived balances/reports are recalculated or reconciled.

### Rule

Correction is not equivalent to silent deletion/editing.

------------------------------------------------------------------------

# 25. Reversal Flow

## UF-025 --- Reverse Financial Operation

**Actor:** Authorized role

### Steps

1.  User selects eligible record.
2.  System checks current state.
3.  User provides required reversal information.
4.  Backend validates permission.
5.  Appropriate state/financial reversal operation is executed.
6.  Audit record is written.
7.  Derived financial views update.

Exact reversal semantics remain subject to the approved financial
specification.

------------------------------------------------------------------------

# 26. Committee Task Flow

## UF-026 --- Create Committee Task

**Actor:** Authorized committee/administrative role

### Steps

1.  User opens task management.
2.  User creates task.
3.  User assigns permitted member(s).
4.  Backend validates assignment.
5.  Task is saved.
6.  Assigned users receive appropriate notification.
7.  Task appears in their authorized task views.

------------------------------------------------------------------------

# 27. Committee Task Completion Flow

## UF-027 --- Complete Assigned Task

**Actor:** Assigned committee member

### Steps

1.  Member opens assigned task.
2.  Member records progress.
3.  Member submits completion.
4.  Backend verifies assignment/permission.
5.  Task state changes.
6.  Relevant users see updated state.

------------------------------------------------------------------------

# 28. Meeting Flow

## UF-028 --- Create Meeting

**Actor:** Authorized committee/administrative role

### Steps

1.  User creates meeting.
2.  User specifies required meeting information.
3.  Backend validates permission.
4.  Meeting is created.
5.  Relevant participants are notified.

------------------------------------------------------------------------

# 29. Meeting Attendance Flow

## UF-029 --- Record Meeting Attendance

### Steps

1.  Authorized attendance workflow opens.
2.  Participant list is loaded.
3.  Attendance is recorded.
4.  Backend prevents duplicate attendance for the same defined
    event/person.
5.  Attendance state becomes authoritative.
6.  Relevant reports update.

------------------------------------------------------------------------

# 30. GPS Jummah Attendance Flow

## UF-030 --- Record GPS-Based Attendance

**Actor:** Authorized attendance user/member, depending on final policy

### Steps

1.  User opens eligible Jummah attendance event.
2.  Application requests location permission where required.
3.  Current location is collected.
4.  Client sends attendance request with event/operation context and
    permitted location evidence.
5.  Backend validates event eligibility and the approved V1 100 metre
    location rule.
6.  Attendance is accepted or rejected.
7.  Result is stored authoritatively.
8.  User sees the final state.

### Rules

-   V1 GPS attendance uses a 100 metre acceptance radius.
-   GPS data is collected only when required.
-   Trusted server-side logic must determine whether submitted location
    evidence satisfies the attendance location requirement.
-   Client-side location checks or distance calculations may be used for
    user feedback only and cannot replace authoritative backend
    validation.
-   The client must not supply or override the authoritative acceptance
    radius.
-   Do not introduce GPS accuracy thresholds, spoof-detection algorithms,
    background tracking, continuous tracking or additional location
    requirements unless separately approved.

------------------------------------------------------------------------

# 31. Offline Attendance Flow

## UF-031 --- Record Attendance Offline

### Steps

1.  User opens an eligible attendance workflow.
2.  Device has no network connection.
3.  Application records an approved offline attendance mutation.
4.  A stable operation ID is generated.
5.  Local state marks the operation pending.
6.  User can continue using approved offline features.
7.  Network becomes available.
8.  Sync process sends the pending operation.
9.  Backend validates authorization and current event rules.
10. Operation is accepted, rejected, or requires reconciliation.
11. Local state is updated.

### Retry

The same operation ID may be retried safely without duplicate
attendance.

------------------------------------------------------------------------

# 32. Notification Flow

## UF-032 --- Business Event to Notification

### Steps

1.  Authoritative business operation succeeds.
2.  Relevant notification event is generated.
3.  Outbox record is created according to architecture.
4.  Notification worker processes the event.
5.  Delivery channel is attempted.
6.  Delivery status is recorded.
7.  Retry occurs for recoverable delivery failures.

### Rule

Notification failure must not falsely indicate business-operation
failure.

------------------------------------------------------------------------

# 33. Realtime Update Flow

## UF-033 --- Cross-Role Realtime Update

### Example

Finance verifies a donation.

### Steps

1.  Finance submits verification.
2.  Backend commits authoritative financial state.
3.  Database change/event becomes available to authorized realtime
    consumers.
4.  Member's outstanding/payment view refreshes or reconciles.
5.  Authorized administrative/finance dashboards update.
6.  Unauthorized clients receive no protected data.

### Rule

Realtime is a propagation mechanism, not the source of truth.

------------------------------------------------------------------------

# 34. Session Expiry Flow

## UF-034 --- Expired Session

### Steps

1.  User attempts a protected operation.
2.  Session is expired/invalid.
3.  Request is rejected.
4.  Client clears/revalidates local session state.
5.  User is redirected to authentication.
6.  After reauthentication, authorization context is loaded again.

------------------------------------------------------------------------

# 35. Permission Denied Flow

## UF-035 --- Unauthorized Operation

### Steps

1.  User attempts an operation.
2.  Backend evaluates current authorization.
3.  Operation is denied.
4.  No protected state changes.
5.  Client shows a clear permission error.
6.  Security-sensitive details are not unnecessarily exposed.

------------------------------------------------------------------------

# 36. Concurrent Operation Flow

## UF-036 --- Two Users Modify the Same Resource

### Example

Two Finance users attempt to verify the same payment.

### Steps

1.  Both clients retrieve the resource.
2.  User A submits first.
3.  Backend validates and commits.
4.  User B submits using stale state.
5.  Backend rechecks current state.
6.  User B's operation is rejected or safely reconciled.
7.  No duplicate financial effect occurs.

### Rule

Client timestamps/state must never be treated as authoritative
concurrency control.

------------------------------------------------------------------------

# 37. Network Retry Flow

## UF-037 --- Mutation Times Out

### Steps

1.  User submits a mutation.
2.  Network response times out.
3.  Client cannot determine whether backend committed.
4.  Client retries using the same operation/idempotency identity.
5.  Backend returns the existing result or safely processes the
    operation once.
6.  UI reconciles with authoritative state.

### Rule

Timeout must not cause the user to unknowingly create duplicate
financial effects.

------------------------------------------------------------------------

# 38. Search and Navigation Flow

## UF-038 --- Authorized Search

### Steps

1.  User enters search/filter criteria.
2.  Client sends query.
3.  Backend applies authorization scope.
4.  Results are returned only from the permitted dataset.
5.  Pagination/filtering occurs within that scope.

### Rule

Search must never be used to bypass row-level authorization.

------------------------------------------------------------------------

# 39. File Upload Flow

## UF-039 --- Protected File Upload

### Steps

1.  User selects permitted file.
2.  Client validates basic constraints.
3.  Backend/storage authorization is checked.
4.  File is uploaded to the correct protected location.
5.  Metadata is associated with the owning business record.
6.  Authorized users can retrieve it through controlled access.

### Rule

A storage object existing successfully does not automatically make it
publicly accessible.

------------------------------------------------------------------------

# 40. Reporting Flow

## UF-040 --- Generate Authorized Report

### Steps

1.  User opens reports.
2.  Available report types are filtered by authorization.
3.  User selects date/filter parameters.
4.  Backend validates scope.
5.  Report data is generated from authoritative sources.
6.  Results are displayed/exported according to permission.
7.  Sensitive fields are omitted where required.

------------------------------------------------------------------------

# 41. Dashboard Flow

## UF-041 --- Role Dashboard

### Steps

1.  User authenticates.
2.  Application resolves authorized role/permissions.
3.  Dashboard loads role-relevant data.
4.  Cards/widgets are shown according to permissions.
5.  Data refreshes using standard query/realtime mechanisms.
6.  Unauthorized dashboard data is not fetched merely because the UI
    component exists.

### One Deployment Requirement

The same deployment can expose different dashboard experiences according
to authenticated authorization context.

------------------------------------------------------------------------

# 42. Multi-Role Same-Deployment Flow

## UF-042 --- Switch Between Role Test Accounts

For testing/presentation:

1.  User signs in as one authorized account.
2.  Corresponding dashboard is displayed.
3.  A second authorized account can sign in separately.
4.  Both use the same backend/database.
5.  A committed shared data change becomes visible according to
    authorization and realtime/query behavior.
6.  No separate database is created for each role.

### Rule

Role selection in the UI is not an authorization mechanism.

------------------------------------------------------------------------

# 43. Language Selection Flow

## UF-043 --- Change Language

### Steps

1.  User opens language settings.
2.  User selects English, Hindi, Kannada, or Urdu.
3.  Application changes localized labels/content.
4.  Business data remains unchanged.
5.  Urdu layout switches to RTL where required.

------------------------------------------------------------------------

# 44. Error Recovery Flow

## UF-044 --- Recover From Recoverable Error

### Steps

1.  Operation fails due to a recoverable condition.
2.  User receives a clear error state.
3.  Application retains safe input where appropriate.
4.  User can retry.
5.  Retry uses safe operation semantics.
6.  Final state is reconciled with backend.

------------------------------------------------------------------------

# 45. Empty-State Flow

## UF-045 --- No Data

Examples:

-   no outstanding donations
-   no pending payment submissions
-   no assigned tasks
-   no meetings
-   no notifications
-   no report results

### Rules

Empty states must clearly distinguish:

-   no data exists
-   data is still loading
-   user lacks permission
-   data failed to load

These states must not be conflated.

------------------------------------------------------------------------

# 46. Loading-State Flow

## UF-046 --- Data Loading

### Rules

The application must show a meaningful loading state while authorized
data is being fetched.

A loading state must not be interpreted as an empty state.

------------------------------------------------------------------------

# 47. Offline/Online Transition Flow

## UF-047 --- Connection Restored

### Steps

1.  Device regains network.
2.  Application detects connectivity.
3.  Approved pending mutations enter synchronization.
4.  Operations are sent using stable operation IDs.
5.  Backend validates them.
6.  Local state is reconciled.
7.  Failed/rejected items receive actionable status.
8.  Authoritative data is refetched/reconciled.

------------------------------------------------------------------------

# 48. Flow Invariants

Across all workflows:

1.  Authentication does not imply authorization.
2.  UI visibility does not imply permission.
3.  Financial truth comes from authoritative backend records.
4.  Sensitive operations are backend-controlled.
5.  Atomic operations cannot leave partial financial state.
6.  Retryable operations must be idempotent where required.
7.  Offline state is provisional.
8.  Realtime is not a source of truth.
9.  Historical financial records remain reconstructable.
10. Unauthorized data must not be exposed through alternate routes,
    search, realtime, storage, or exports.

------------------------------------------------------------------------

# 49. Cross-Flow Dependencies

The following flows depend on later specifications:

  Flow                    Primary dependency
  ----------------------- -----------------------------------
  Authentication          Authentication architecture
  Referral registration   Database + identity architecture
  Donation payment        Donation/finance specification
  Payment verification    Financial integrity specification
  FIFO allocation         Financial integrity specification
  Combined payment        API + financial integrity
  Account transfer        Database + financial integrity
  Expense                 Finance + authorization
  Attendance              Offline sync + database
  GPS attendance          Business decision + security
  Notifications           Notification architecture
  Realtime                Realtime data flow
  File upload             Storage architecture
  Reports                 Database/reporting architecture

------------------------------------------------------------------------

# 50. Open Flow Decisions

The V1 flow decisions are closed by
`docs/V1_IMPLEMENTATION_DECISION_CLOSURE.md`.

Approved:
- no referral auto-expiration;
- active/inactive member lifecycle;
- no automatic future-month prepayment;
- FIFO plus additional-donation overpayment;
- new operation for rejected-payment resubmission;
- controlled reversal;
- maker/checker expense and transfer approval;
- 100 m GPS attendance;
- stable offline operation IDs and server revalidation;
- authoritative notification events;
- role-matrix-controlled report/export permissions.

Only organizational/legal retention and formal incident-notification policy
remain deferred and do not block V1 implementation.

# 51. User Flow Acceptance Criteria

The flow documentation is considered implementation-ready when:

-   authentication flow is defined
-   registration/referral flow is defined
-   member self-service is defined
-   administrative member management is defined
-   donation lifecycle is defined
-   payment submission is defined
-   payment verification is defined
-   FIFO allocation is defined
-   combined payment is defined
-   overpayment is explicitly handled
-   additional donation is defined
-   anonymous donation is defined
-   Jummah cash is defined
-   finance account operations are defined
-   expenses/corrections/reversals are defined
-   committee workflows are defined
-   attendance is defined
-   offline attendance is defined
-   notifications are defined
-   realtime propagation is defined
-   session/authorization failures are defined
-   file upload is defined
-   reporting is defined
-   localization is defined
-   recovery/empty/loading states are defined
-   unresolved behavior is explicitly identified

------------------------------------------------------------------------

# 52. Change Control

A workflow must not be changed silently during implementation.

If implementation reveals a flow conflict:

1.  Identify the affected flow.
2.  Identify the conflicting business rule.
3.  Document the proposed change.
4.  Assess database/API/security/UI/testing impact.
5.  Update the affected specification.
6.  Review the change.
7.  Implement only after the specification is aligned.

------------------------------------------------------------------------

# 53. Status

**Current status: User-flow specification generated for review.**

This document becomes an implementation reference only after the
relevant product, business-rule, architecture, and security decisions
are approved.
