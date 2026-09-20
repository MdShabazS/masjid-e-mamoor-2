# V1 Implementation Decision Closure

## Purpose

This document closes the implementation-level decisions required to move
Masjid-e-Mamoor from the documentation baseline into application development.

The closure preserves the approved V1 business, security, accounting,
authorization, offline-sync, notification, and storage boundaries.

## 1. Identity and Membership

- Application users remain `pending`, `active`, `restricted`, or `deactivated`.
- V1 permits one active application role per application user.
- Member profiles remain independently represented from authentication accounts.
- A member profile may be linked to an application user through the approved
  identity relationship.
- Member profile lifecycle remains `active` or `inactive`.
- Account deactivation does not delete the member profile.
- Elevated role assignment remains an authorized administrative operation.
- Referral registration records the referring party, referred registration,
  status, timestamps, and resulting membership relationship.
- V1 does not automatically expire referrals.

## 2. Attendance

- Attendance identity is based on an `attendance_event_id` together with the
  member identity.
- Duplicate attendance submission must be rejected or recognized as already
  applied.
- Offline operations use stable operation IDs.
- GPS acceptance uses a server-side 100 metre radius.
- Client-side GPS validation is advisory only.
- Poor GPS accuracy does not silently widen the server acceptance radius.

## 3. Notifications

V1 notification events cover:

- referral registration;
- membership activation/deactivation;
- payment submitted, verified, rejected, or reversed;
- donation allocation;
- expense submitted, approved, or rejected;
- transfer submitted, approved, or rejected;
- reconciliation discrepancy;
- task assignment/due state;
- meeting creation/change;
- attendance synchronization rejection or action required;
- security/account restriction or deactivation.

Security/account notifications are mandatory where applicable.
Other notification categories may respect user preferences.

Mobile push delivery initially uses Expo Notifications / Expo Push Service.

## 4. API and Trusted Operations

- Ordinary reads use Supabase/PostgREST with RLS enforcement.
- Sensitive atomic workflows use PostgreSQL functions/trusted operations.
- Edge Functions are used for protected external HTTP workflows where required.
- Next.js Route Handlers act as a BFF only where an application-specific
  server boundary is required.
- Zod validation is used for application DTO/input validation.
- Financial and other sensitive mutation requests use stable idempotency keys.
- Pagination uses cursor-based mechanisms where applicable.
- API errors use stable application error codes.
- The client is never authoritative for actor identity, role, permission,
  balance, allocation, or financial invariants.

## 5. Offline Synchronization

- Mobile offline persistence uses Expo SQLite where required.
- Secure credentials/tokens use secure platform storage.
- Attendance and approved non-financial drafts may be prepared offline.
- Authoritative financial mutations are not performed offline.
- Offline operations are typed and carry stable operation IDs.
- The server revalidates every synchronized operation.
- Retry is bounded and idempotent.
- Synchronization outcomes are represented as accepted, already applied,
  rejected, or requiring reconciliation.
- GPS evidence is minimized to what is required for attendance validation.

## 6. Storage

V1 uses private storage buckets for:

- `payment-proofs`
- `expense-proofs`
- `financial-attachments`
- `member-documents`

Storage rules:

- maximum upload size: 10 MB;
- accepted baseline formats: PDF, JPEG, PNG;
- sensitive objects are not publicly readable;
- access uses authenticated or signed access;
- signed URLs expire after 5 minutes;
- clients cannot directly delete authoritative proof objects;
- no automatic destructive retention process is introduced until the
  applicable retention policy is formally established.

Malware scanning and thumbnail generation are not treated as available
security controls until actually deployed and verified.

## 7. Security and Authorization

- RLS remains the database security boundary.
- Trusted helper functions resolve the current application identity, active
  role, permissions, and account status from authoritative database state.
- Security-sensitive functions use a controlled `search_path`.
- Current account status is rechecked during sensitive operations.
- UI visibility is never treated as authorization.
- Clients cannot bypass RLS through alternate application paths.

## 8. Financial Integrity

The previously approved V1 financial decisions remain authoritative:

- monthly obligations use their applicable effective month;
- historical obligation amounts are not silently rewritten;
- minimum partial payment is ₹1;
- rejected payments remain historical;
- resubmission creates a new payment and operation identity;
- verified recurring obligations are allocated FIFO;
- eligible excess becomes additional donation;
- automatic future-month prepayment is not permitted;
- expenses and transfers use maker/checker controls;
- corrections and reversals preserve original history and require the
  applicable controlled approval;
- financial effects are append-oriented;
- balances are derived from authoritative financial effects;
- reconciliation discrepancies are recorded and investigated;
- financial idempotency records are retained for at least one year.

## 9. Retention and Incident Handling

The exact legal/organizational retention periods remain deferred policy work
and must be established before production retention automation is introduced.

Formal external incident-notification obligations are also deferred pending
organizational/legal confirmation.

Internal incident handling follows the defined severity model and must preserve
auditability and evidence.

## 10. Implementation Boundary

The following are implementation details rather than reasons to block the
application build:

- exact physical RLS helper function names;
- exact SQL predicate expressions;
- exact RPC names;
- exact notification template wording;
- exact UI component composition;
- exact database index selection beyond documented integrity requirements.

These implementation details must conform to the approved V1 business,
authorization, financial-integrity, security, and data-model rules.

## Status

V1 implementation decisions required for application development are closed
except for explicitly deferred legal/organizational policy items identified
above.

Implementation may proceed from this baseline.
