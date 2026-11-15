# Phase 5 — monthly contributions checkpoint (15 October 2026)

**Status: partial implementation; exit criteria unmet.** No fresh development
Postgres project is connected, so all SQL migrations and role tests are
unexecuted source drafts. No real QR, approved donor notice, Meta Business
account, provider webhook, or live message delivery is configured.

## Implemented in source

- Earlier slice: donor roster and consent entry prototype, queued request
  snapshot, pending transaction claim, Treasurer verified actual paise,
  immutable ledger/opaque receipt and idempotent operation. Phase 4 mirrors
  contribution postings into canonical finance effects after an approved
  account opening.
- Migration 5: versioned consent event and evidence, service-only enrollment
  behind an empty approved-consent registry, duplicate active phone review,
  STOP event and opt-out, Treasurer rejection and linked resubmission, private
  P/T contact projection, and immutable referral provenance per verified claim.
  Referral **points are not published** until the per-contribution versus
  per-donor/month cap is decided.
- Migration 6: private QR bucket and server-verified asset registry, P/data-entry
  replacement activation with active account/digest, QR/beneficiary snapshots,
  first-Friday 10:00 Asia/Kolkata request queue and five-day reminder queue
  after a provider-confirmed sent request. These are **outbox rows**, not sends.
  No anonymous or authenticated Storage upload/read policies are granted.
- The pure scheduler tests first-Friday boundary, full five-day delivery delay,
  STOP/paid suppression and three consecutive unpaid months. The SQL scenario
  includes smaller actual payment, same-operation retry, referral provenance,
  rejected claim, linked resubmission and opt-out.

## Still required

1. Run six fresh migrations and every SQL role test on isolated Postgres; repair
   errors, validate RLS/grants, direct REST/RPC denial, concurrent claims,
   request/QR/STOP races, repeated scheduler and separate sessions.
2. Obtain owner approval of donor management roles, exact consent notice and
   privacy/retention schedule. Record an actual approved version in a reviewed
   migration. Do not enable donor creation or live messages by silence.
3. Validate an actual QR image's bytes, digest, beneficiary/account and private
   storage path. Implement server upload and provider delivery worker with
   lease/retry, delivery receipt and just-in-time consent/paid-state recheck;
   authenticate and dedupe Meta webhooks before accepting STOP/reference.
4. Implement provider/account-scoped reference normalization and investigation,
   manual Treasurer period exception, correction/void and receipt supersession.
   Compute referral points from provenance only after owner cap decision; add
   durable three-unpaid-period referrer notice with a retry-safe key.
5. Wire web and Android through the Phase 3 username/API boundary. Test
   permission/validation/error states on provisioned users, late and multiple
   payments, actual amount below/above suggestion and repeated delivery.

No production send or donor-data exposure is authorized by this checkpoint.
The project source archive is not a database/Storage backup.
