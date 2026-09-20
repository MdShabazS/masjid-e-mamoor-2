# Masjid-e-Mamoor --- Product Requirements Specification

**Document Status:** Draft --- Product Review Required\
**Version:** 1.0\
**Phase:** Documentation-First / Pre-Development\
**Repository:** `MdShabazS/masjid-e-mamoor-2`

------------------------------------------------------------------------

## 1. Purpose

This document defines what the Masjid-e-Mamoor platform must do from a
product and user-workflow perspective.

It is intentionally focused on **requirements and expected behavior**,
not implementation details. Database schema, RLS policies,
authentication mechanics, realtime implementation, and offline
synchronization details belong to their dedicated architecture
documents.

This document must be read together with:

-   `PROJECT_MASTER_SPEC.md`
-   `SYSTEM_ARCHITECTURE.md`
-   `ROLE_PERMISSION_MATRIX.md`

------------------------------------------------------------------------

## 2. Product Goals

The platform must provide a unified system for:

1.  Managing users and roles.
2.  Managing members and referrals.
3.  Managing recurring donation obligations and donation history.
4.  Accepting and tracking payment submissions.
5.  Allowing Finance to verify and allocate payments.
6.  Managing mosque finances and expenses.
7.  Managing committee operations.
8.  Recording attendance, including approved offline attendance
    workflows.
9.  Delivering notifications.
10. Producing operational, membership, donation, financial, and audit
    reports.
11. Maintaining a complete, traceable history of sensitive operations.
12. Supporting web and mobile users from the same authoritative backend.

------------------------------------------------------------------------

## 3. Product Scope

### 3.1 In Scope

-   Identity and role-based access
-   Member registration and management
-   Referral-based registration workflows
-   Donation obligations
-   Monthly donation history
-   Payment submission
-   Payment proof submission
-   UPI intent/deep-link payment flow
-   Finance verification
-   Payment allocation
-   Partial payments
-   Outstanding balances
-   FIFO allocation
-   Overpayment handling
-   Additional donations
-   Anonymous donations
-   Jummah cash donations
-   Finance accounts
-   Financial transactions
-   Transfers
-   Expenses
-   Corrections
-   Cancellations
-   Bills/proofs
-   Committee tasks
-   Task assignments
-   Meetings
-   Attendance
-   Approved offline attendance synchronization
-   Notifications
-   Reports
-   Audit records
-   Protected storage
-   Realtime operational updates
-   Web application
-   Mobile application

### 3.2 Out of Scope Unless Explicitly Added Later

The following must not be silently introduced:

-   additional application roles
-   unrestricted offline financial editing
-   a second authoritative database
-   client-side financial settlement
-   client-side authorization
-   arbitrary future-month donation behavior
-   unapproved payment gateways
-   automatic financial verification without an approved workflow
-   unrelated business modules

Any scope expansion requires documentation and review first.

------------------------------------------------------------------------

## 4. Users and Roles

The product has seven roles:

  -----------------------------------------------------------------------
  Role                                Primary product responsibility
  ----------------------------------- -----------------------------------
  President / Super Admin             Organization-wide administration
                                      and oversight

  Vice President                      Senior operational oversight

  Secretary                           Membership, committee, and
                                      administrative operations

  Finance                             Donation and financial operations

  Auditor                             Financial/audit oversight

  Committee Member                    Assigned committee operations

  Member                              Own membership and member-facing
                                      workflows
  -----------------------------------------------------------------------

Detailed authorization is defined in `ROLE_PERMISSION_MATRIX.md`.

------------------------------------------------------------------------

## 5. Core User Experience

The platform is one shared application.

After authentication, the user receives a role-appropriate experience.

The same underlying records must be reflected across authorized role
views.

Example:

``` text
Finance records a verified payment
        ↓
Authoritative backend state changes
        ↓
Member sees updated payment/donation status
        ↓
Authorized President/Auditor views update
        ↓
Reports reconcile to the same state
```

Role-specific dashboards must never create separate copies of business
data.

------------------------------------------------------------------------

## 6. Identity and Account Requirements

The system must:

-   authenticate users through Supabase Auth
-   associate authenticated identity with an application profile
-   maintain backend-controlled role assignment
-   prevent users from selecting or escalating their own role
-   support secure session handling
-   support role-aware navigation
-   ensure unauthorized routes/actions are rejected server-side

The exact authentication and session flow is defined in
`AUTHENTICATION_ARCHITECTURE.md`.

------------------------------------------------------------------------

## 7. Member Management Requirements

### 7.1 Member Registration

Authorized users must be able to register members according to their
permissions.

Member registration should capture the required organizational
information defined by the final data model.

### 7.2 Member Profile

Members should be able to view and update permitted portions of their
own profile.

Authorized administrative roles may view or update member information
according to the permission matrix.

### 7.3 Member Privacy

A member must not be able to browse other members' private or financial
information.

Access to another member's information must be role- and
scope-controlled.

### 7.4 Membership History

Important membership lifecycle changes should be traceable.

------------------------------------------------------------------------

## 8. Referral Requirements

The platform must support referral-based registration.

A referral workflow should allow the system to identify:

-   referring member/person
-   referred person
-   registration status
-   relevant timestamps
-   resulting membership relationship where applicable

Referral data must follow the same authorization and privacy rules as
other membership information.

------------------------------------------------------------------------

## 9. Donation Requirements

### 9.1 Donation Obligations

The system must support recurring donation obligations associated with
an effective month.

Changes to an obligation must preserve the required history.

### 9.2 Donation History

Authorized users must be able to view donation history according to role
and ownership.

Members should see their own relevant donation history.

Finance and authorized oversight roles may access broader
financial/donation information.

### 9.3 Payment Submission

A member must be able to submit a payment through the supported
workflow.

The submission may include:

-   amount
-   relevant obligation/payment context
-   payment method
-   reference information
-   payment proof where applicable

Client-submitted information is not final financial state.

### 9.4 UPI Flow

The product supports a UPI intent/deep-link flow.

The client may initiate the payment experience and return with relevant
payment information.

The system must not assume that launching or returning from a UPI
application proves successful settlement.

Final verification remains an authorized Finance workflow.

### 9.5 Payment Proof

Where required, users may upload payment proof.

Proofs must be securely stored and visible only to authorized users.

### 9.6 Finance Verification

Finance must be able to:

-   review pending payment submissions
-   inspect relevant payment information/proof
-   verify or reject according to the approved workflow
-   record relevant verification information

Verification must be authoritative and auditable.

### 9.7 Payment Allocation

After successful verification, the system must allocate the payment
according to the approved allocation rules.

Allocation must be authoritative and atomic.

### 9.8 Partial Payments

The product must support partial settlement of eligible donation
obligations.

The remaining outstanding amount must remain accurately represented.

### 9.9 FIFO

When FIFO applies, eligible outstanding obligations are allocated in the
approved first-in-first-out order.

The client must not be able to arbitrarily reorder authoritative
allocation.

### 9.10 Outstanding Amounts

Outstanding amounts must be derived from authoritative obligation and
allocation state.

They must not depend on manually maintained client totals.

### 9.11 Overpayment

The system must handle payment amounts greater than the currently
applicable outstanding amount according to the approved financial rules.

Overpayment must not silently become unrestricted future-month
prepayment.

### 9.12 Additional Donation

Additional donations must be supported separately from ordinary
obligation settlement where required.

### 9.13 Anonymous Donation

Authorized Finance workflows must support anonymous donations while
protecting donor identity from unauthorized users.

### 9.14 Jummah Cash

The product must support recording Jummah cash donations.

Cash entries must remain auditable and included in relevant financial
reporting.

### 9.15 Future-Month Rules

The product must enforce the approved rules for future-month donations.

Clients cannot bypass these rules by manipulating request payloads.

### 9.16 Combined Outstanding Payment

The product must support combined payment of eligible outstanding
amounts.

This must be processed as a trusted atomic operation.

------------------------------------------------------------------------

## 10. Finance Requirements

### 10.1 Accounts

Finance must be able to manage authorized financial accounts.

### 10.2 Transactions

Financial transactions must be traceable and linked to their business
context where applicable.

### 10.3 Transfers

The system must support authorized transfers between accounts.

Transfers must preserve balanced source/destination state.

### 10.4 Expenses

Finance must be able to create authorized expenses.

Expenses may require:

-   amount
-   account
-   category
-   date
-   description
-   proof/bill
-   status
-   relevant approval information

The exact fields are finalized in the database specification.

### 10.5 Corrections

Financial corrections must be controlled operations.

The product should preserve the original context rather than silently
overwriting historical financial truth.

### 10.6 Cancellations

Financial cancellation must be an explicit authorized operation.

The system must preserve sufficient history for audit and
reconciliation.

### 10.7 Reconciliation

Authorized Finance/Auditor workflows must support reconciliation of
financial records.

### 10.8 Financial Reports

The product must provide authorized financial reporting.

Reports must derive from authoritative financial records.

------------------------------------------------------------------------

## 11. Committee Requirements

### 11.1 Tasks

Authorized committee users must be able to:

-   create tasks
-   assign tasks
-   view assigned tasks
-   update task status
-   record relevant remarks

### 11.2 Meetings

The product must support:

-   meeting creation
-   meeting details
-   attendance
-   relevant notes/outcomes
-   authorized management

### 11.3 Committee Information

Committee members should only receive the operational information
required for their assigned responsibilities.

------------------------------------------------------------------------

## 12. Attendance Requirements

The platform must support attendance recording.

### 12.1 Online

When connected, attendance should synchronize directly with the
authoritative backend.

### 12.2 Offline

Approved attendance workflows may operate offline.

Offline attendance must support:

-   local pending records
-   stable operation identifiers
-   retries
-   duplicate prevention
-   synchronization status
-   server-side revalidation
-   explicit error/conflict handling

### 12.3 GPS

Where GPS is part of the approved attendance workflow, location
information must be handled according to documented privacy and
authorization requirements.

The system must not collect unnecessary location data.

------------------------------------------------------------------------

## 13. Notification Requirements

The platform must support:

-   in-app notifications
-   notification preferences
-   push notifications where supported
-   delivery status
-   failure handling
-   retry behavior

Business transactions must not fail merely because push delivery fails.

------------------------------------------------------------------------

## 14. Reporting Requirements

Reports must be role-aware.

Expected report categories include:

-   operational
-   membership
-   donation
-   financial
-   attendance
-   audit

Reports must be generated from authoritative data.

Cached dashboard totals must not become independent financial records.

------------------------------------------------------------------------

## 15. Audit Requirements

Sensitive actions should create audit records containing appropriate
information such as:

-   actor
-   action
-   entity
-   entity identifier
-   timestamp
-   relevant previous state
-   resulting state
-   reason/context
-   operation/idempotency reference

Audit information must be protected from ordinary modification.

------------------------------------------------------------------------

## 16. Storage Requirements

The platform must support protected storage for:

-   payment proofs
-   bills
-   receipts
-   other approved documents

Storage access must be authorized independently from UI visibility.

Objects containing sensitive information must not be assumed public.

------------------------------------------------------------------------

## 17. Search and Navigation

The final product should provide role-appropriate navigation.

Search functionality should respect authorization boundaries.

A user must never receive search results for records they are not
authorized to access merely because a matching keyword exists.

------------------------------------------------------------------------

## 18. Realtime Product Behavior

Realtime behavior should be used where users benefit from immediate
updates.

Examples:

-   task status
-   attendance status
-   payment/verification workflow status
-   notifications
-   operational dashboards

Realtime updates must reconcile with authoritative backend state.

The product must remain correct if a realtime event is delayed,
duplicated, or missed.

------------------------------------------------------------------------

## 19. Offline Product Behavior

Offline mode should communicate clearly:

-   online/offline status
-   pending synchronization
-   successful synchronization
-   synchronization failure
-   retry state

Users must not be led to believe that an offline mutation is
authoritative before server acceptance.

------------------------------------------------------------------------

## 20. Error and Empty States

Every major workflow must define:

-   loading state
-   empty state
-   validation state
-   authorization-denied state
-   network error
-   server error
-   synchronization error where applicable
-   success confirmation
-   retry behavior where appropriate

Financial failures must never appear as successful financial updates.

------------------------------------------------------------------------

## 21. Internationalization

The planned product must support:

-   English
-   Hindi
-   Kannada
-   Urdu

Urdu requires RTL-aware presentation.

User-facing text should be designed for localization rather than
hard-coded into business logic.

------------------------------------------------------------------------

## 22. Accessibility and Responsive Behavior

The web interface should support:

-   keyboard navigation
-   semantic controls
-   readable contrast
-   clear focus states
-   accessible form errors
-   responsive layouts

Mobile interfaces should account for:

-   touch targets
-   varying screen sizes
-   network interruptions
-   platform conventions

------------------------------------------------------------------------

## 23. Security Product Requirements

The user experience must never imply capabilities that the backend does
not authorize.

Required protections include:

-   secure authentication
-   role-aware access
-   RLS
-   protected storage
-   least privilege
-   protected financial workflows
-   auditability
-   safe error handling
-   secure session behavior

No client-side-only permission check is sufficient.

------------------------------------------------------------------------

## 24. Performance Requirements

The product should provide responsive interfaces while preserving
correctness.

The implementation should:

-   avoid unnecessary requests
-   use server-state caching appropriately
-   paginate large datasets
-   avoid loading unauthorized data
-   handle realtime subscriptions selectively
-   keep mobile offline queues bounded and manageable

Exact performance targets should be established before production
release.

------------------------------------------------------------------------

## 25. Product-Level Acceptance Criteria

The product requirements phase is complete when:

-   all seven roles have defined product responsibilities
-   membership workflows are defined
-   referral workflow is defined
-   donation workflows are defined
-   payment verification is defined
-   allocation rules are defined
-   financial workflows are defined
-   committee workflows are defined
-   attendance and offline requirements are defined
-   notification behavior is defined
-   reporting requirements are defined
-   audit requirements are defined
-   storage requirements are defined
-   privacy/security expectations are defined
-   localization requirements are defined
-   error/empty states are defined
-   realtime/offline product behavior is defined

------------------------------------------------------------------------

## 26. Dependencies

This document depends on:

-   `PROJECT_MASTER_SPEC.md`
-   `SYSTEM_ARCHITECTURE.md`
-   `ROLE_PERMISSION_MATRIX.md`

It feeds:

-   `BUSINESS_RULES.md`
-   `USER_FLOWS.md`
-   `DATABASE_ARCHITECTURE.md`
-   `RLS_SECURITY_MODEL.md`
-   `AUTHENTICATION_ARCHITECTURE.md`
-   `API_DOMAIN_ARCHITECTURE.md`
-   `UI_UX_SPEC.md`
-   `TESTING_STRATEGY.md`

------------------------------------------------------------------------

## 27. Open Product Decisions

The following should be explicitly resolved before implementation of the
affected areas:

  -----------------------------------------------------------------------
  Decision                            Follow-up
  ----------------------------------- -----------------------------------
  Exact member registration fields    Database architecture

  Exact donation obligation fields    Database architecture / business
  and lifecycle                       rules

  Exact future-month handling         Business rules / finance
                                      specification

  Exact payment rejection/reversal    Finance specification
  behavior                            

  Exact approval requirements for     Finance specification
  transfers/expenses                  

  Exact attendance GPS policy         Attendance/security specification

  Exact notification event catalogue  Notification architecture

  Exact report catalogue and filters  Reporting/UI specification

  Exact localization coverage         Accessibility/i18n specification
  -----------------------------------------------------------------------

Open decisions must not be silently resolved in code.

------------------------------------------------------------------------

## 28. Change Control

If implementation reveals a product requirement conflict:

1.  Stop the affected implementation.
2.  Identify the conflict.
3.  Document the proposed change.
4.  Review impact on architecture, security, data, and UX.
5.  Update the appropriate specification.
6.  Update dependent documents.
7.  Resume implementation only after the change is accepted.

------------------------------------------------------------------------

## 29. Status

**Current status: Product requirements specification in progress.**

This document is intended to provide a stable product-level contract for
human developers and AI development tools before substantial
implementation begins.
