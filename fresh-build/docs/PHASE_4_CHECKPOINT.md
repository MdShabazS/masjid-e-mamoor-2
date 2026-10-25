# Phase 4 — finance foundation checkpoint (15 October 2026)

Historical source checkpoint. See `PHASE_4_EXECUTION_2026-10-17.md` for the
subsequent hosted SQL, clean local reset and independent-session transfer
evidence. The Phase 4 exit remains open.

**Status: started; exit criteria unmet.** The migration and role test are
source drafts awaiting an isolated Postgres/Supabase run. No finance balance
from these files has been verified in a database.

## Built this checkpoint

- Migration 3, `backend/supabase/migrations/20261015133536_finance_accounts_openings_transfers.sql`, adds President-controlled Cash/UPI/Bank account creation, private validated beneficiary identifiers, zero-balance deactivation without an active QR, immutable finance audit and direct-table access denial.
- Treasurer submits one opening per account with evidence. President, as a different person, verifies it. Pending openings do not affect balances; verification inserts one effect. Idempotency keys bind actor and payload.
- Signed finance effects mirror verified monthly contribution ledger inserts in the same transaction, after a verified opening exists. Transfers lock both accounts in a stable order and insert equal opposite effects, requiring sufficient recorded source balance and evidence. `list_finance_accounts` returns per-account exact paise as strings. Reconciliation computes variance without changing the ledger.
- Migration 4 adds append-only reconciliation observations with required variance explanation and scoped keyset account/reconciliation history. `backend/tests/finance_foundation.sql` exercises real-role grant checks, pending/verified openings, retries, transfer conservation, overdraft denial, reconciliation and member denial. `packages/finance-ledger/` independently checks exact paise math; runtime tests pass across the fresh build.

## Still required for Phase 4

1. Run a clean fresh migration chain on disposable Postgres; fix every SQL defect and test actual `anon`, member, leadership, inactive and service behavior. Test concurrent opposite transfers and retries with separate sessions. No Docker daemon or connected new development project is available yet.
2. Account history pagination exists in migration 4, but must be exercised against real Postgres and wired to clients. Add beneficiary edit/version controls. Confirm account administration actor policy with leadership; no SA write grant is inferred.
3. Reconciliation observations and variance explanation/evidence exist in migration 4, but must be exercised against real Postgres and wired to clients. Add follow-up state, correction/void as reversal plus replacement, receipt/report supersession links, before/after audit, and no historical erasure.
4. Define bounded balance and business-date/report invariants across other income, expense, advance and salary postings as those Phase 5/6 slices are built. Test overflow, source uniqueness, zero/negative inputs, sums by period, and full accounting equation against actual database roles.
5. Wire web/Android account, opening, transfer and reconciliation journeys through the Phase 3 identity/API boundary. Run migration rollback and restore rehearsal.

The source-code backup is separate from a database/object backup. Do not treat
this checkpoint as a completed finance platform or a releasable balance.
