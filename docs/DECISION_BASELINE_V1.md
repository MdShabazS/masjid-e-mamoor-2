# Masjid-e-Mamoor — V1 Decision Baseline

**Status:** Approved for v1 architecture  
**Purpose:** Canonical record of approved business, financial, accounting, and security decisions.  
**Date:** 2026-09-20

---

## 1. Donation & Obligation Decisions

### 1.1 Monthly Obligations

- Each active member receives one recurring obligation per calendar month.
- The applicable obligation amount is determined by the effective rule for that month.
- Changes use an explicit effective month.
- Historical obligations are not rewritten when future obligation amounts change.
- Historical financial records retain their original authoritative amounts.

### 1.2 Minimum Partial Payment

- Minimum valid partial payment: ₹1.
- Zero or negative payments are invalid.
- Positive partial payments are permitted subject to the applicable outstanding amount and payment rules.

### 1.3 Rejected Payments

Payment lifecycle:

`submitted → under_review → verified`

or

`submitted → under_review → rejected`

A rejected payment remains historically recorded.

A resubmission creates a new payment submission and a new operation ID.

A rejected payment is never silently converted into a verified payment.

### 1.4 Overpayment

After eligible FIFO recurring obligations are satisfied, any remaining amount is classified as an additional donation.

Example:

- Outstanding recurring obligation: ₹500
- Payment: ₹800
- Recurring allocation: ₹500
- Additional donation: ₹300

No amount may silently disappear.

### 1.5 Future-Month Prepayment

Normal payment processing does not automatically allocate money to future months.

FIFO applies to eligible existing outstanding obligations.

A future-month prepayment workflow is not enabled in v1.

### 1.6 Waiver

Waivers are controlled authorized operations.

A waiver:

- preserves the original obligation amount,
- records the waived amount,
- records the reason,
- records the actor,
- records the timestamp,
- records the operation identity,
- affects effective outstanding without rewriting historical truth.

---

## 2. Finance Control Decisions

### 2.1 Expense Approval

All posted expenses use maker/checker separation.

The creator/submitter cannot approve their own expense.

Posting requires an authorized second person.

Posted expenses are not directly edited or deleted.

Corrections/reversals use controlled workflows.

### 2.2 Transfer Approval

Transfers use maker/checker approval.

The creator cannot approve their own transfer.

Approved transfers execute atomically:

- source account decreases,
- destination account increases.

Duplicate execution is prevented through idempotency.

Self-transfers are rejected.

### 2.3 Correction Approval

Financial corrections require:

- explicit reason,
- original record reference,
- authorized second-person approval,
- audit record,
- compensating financial effect where applicable.

Original financial history remains preserved.

### 2.4 Reversal Approval

Reversals require stricter controlled handling.

A reversal requires:

- explicit reason,
- reference to the original transaction,
- authorized second-person approval,
- atomic compensating financial effect,
- audit record,
- applicable notification.

The original transaction remains preserved.

### 2.5 Monthly Closing

Formal hard monthly closing is not enabled in v1.

Late entries remain possible.

Business date and server timestamps remain distinct.

Corrections and reversals remain available through authorized workflows.

---

## 3. Accounting Decisions

### 3.1 Account Taxonomy

V1 account types:

1. Bank
2. UPI
3. Cash
4. Other

Each account has explicit currency and lifecycle/status information.

### 3.2 Transaction Categories

Controlled transaction categories:

- `DONATION_RECURRING`
- `DONATION_ADDITIONAL`
- `DONATION_ANONYMOUS`
- `DONATION_JUMMAH`
- `EXPENSE`
- `TRANSFER_IN`
- `TRANSFER_OUT`
- `CORRECTION`
- `REVERSAL`

Arbitrary free-text transaction categories are not authoritative.

### 3.3 Ledger Model

Use an append-oriented authoritative financial-effect model.

Historical financial effects are preserved.

Corrections and reversals add controlled compensating effects rather than silently modifying historical financial truth.

### 3.4 Account Balance

The authoritative account balance is calculated from authoritative financial effects.

Any future materialized/cache balance is derived data and is not the source of truth.

Materialized values must be reconcilable against authoritative financial records.

### 3.5 Cash Reconciliation

Cash flow distinguishes:

`cash received → cash held → cash deposited/transferred`

Example:

A ₹10,000 cash collection increases the cash account.

When deposited into the bank:

- cash decreases by ₹10,000,
- bank increases by ₹10,000.

### 3.6 Reconciliation Schedule

V1 reconciliation:

- formal monthly reconciliation,
- additional on-demand reconciliation when required,
- discrepancies are recorded and investigated,
- discrepancies are never silently repaired.

### 3.7 Idempotency Retention

Successful financial idempotency records are retained for a minimum of one year.

Financial history and audit references remain independently traceable.

### 3.8 Currency

V1 operational currency:

`INR`

Authoritative monetary calculations use exact numeric representation with two decimal places.

Floating-point arithmetic is not authoritative for financial calculations.

---

## 4. Architecture & Security Decisions

### 4.1 Role Model

V1 uses:

`Application User → Role → Permissions`

One active application role exists per application user.

Roles:

1. President / Super Admin
2. Vice President
3. Secretary
4. Finance
5. Auditor
6. Committee Member
7. Member

### 4.2 Permission Overrides

V1 does not provide arbitrary per-user permission overrides.

Authorization is determined by the assigned application role and its permissions.

### 4.3 Application User / Member Relationship

An application user may have zero or one member profile.

Conceptually:

`auth.users → application_users → member_profiles`

Administrative/service users may exist without an ordinary member profile.

### 4.4 Obligation Representation

An obligation is associated with:

- member,
- effective month,
- authoritative amount,
- status,
- timestamps.

Historical obligation amounts remain stable.

### 4.5 Payment State

V1 payment lifecycle:

`submitted → under_review → verified`

or

`submitted → under_review → rejected`

Verified payments may subsequently enter:

`reversed`

where the authorized reversal workflow applies.

Payment proof does not itself constitute financial verification.

### 4.6 Ledger Authority

The client never determines authoritative financial state.

Financial effects are created through trusted backend/database operations.

### 4.7 Audit

Audit events are append-oriented.

Core audit information includes:

- actor,
- action,
- entity type,
- entity ID,
- operation ID,
- reason where applicable,
- timestamp.

Sensitive before/after information is controlled and must not contain secrets or unnecessary sensitive data.

Clients cannot modify or delete authoritative audit history.

### 4.8 Offline Operations

Offline operations use typed operation records.

An offline operation contains a stable operation identity and validated operation-specific payload.

Arbitrary executable database commands are not permitted.

Final financial authority remains server-side/trusted.

### 4.9 RLS

Supabase PostgreSQL RLS is a database security boundary.

Authorization is enforced independently of UI visibility.

Sensitive operations use trusted operations that re-check:

- authentication,
- authorization,
- current authoritative state,
- business rules,
- invariants,
- idempotency,
- concurrency requirements.

### 4.10 Sensitive Operations

Examples include:

- payment verification,
- FIFO allocation,
- combined payment,
- transfers,
- expense posting,
- corrections,
- reversals,
- role assignment.

These cannot rely solely on client-side checks.

### 4.11 Retention

Retention is category-specific.

Financial history, audit records, payment proofs, security events, notifications, and operational records follow governed retention policies.

The exact legal/organizational retention requirements must be verified before production retention settings are finalized.

---

## 5. Implementation Principle

These decisions are the v1 business and architecture baseline.

Implementation must not silently introduce different financial behavior.

Any future change must update the relevant specifications and this decision baseline where applicable.

The following remain engineering implementation decisions:

- exact PostgreSQL locking strategy,
- transaction isolation level,
- exact SQL/RPC implementation,
- physical table/index layout,
- exact RLS predicates/helper functions,
- implementation-specific performance optimizations.

Those decisions must preserve this baseline.

---

## 6. Approval Status

The v1 decision batches have been approved:

- Batch 1 — Donation behavior: Approved
- Batch 2 — Finance controls: Approved
- Batch 3 — Accounting model: Approved
- Batch 4 — Architecture/security: Approved

**No database migration should be created solely from this document.**

The next phase is cross-document synchronization and review.
