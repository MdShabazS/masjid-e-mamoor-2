# Phase 7 checkpoint — 15 October 2026

## First implementation slice

- `backend/supabase/migrations/20261015141000_finance_report_source.sql` creates an immutable, queued report request with idempotent operation ID, requester, month/year/range, `[start, end)` India business dates, optional proof choice and a server cutoff. Account names and the IDs of committed ledger effects through the cutoff are captured in the request transaction, so later postings cannot silently enter this run. It does not assert that a PDF is ready.
- Role checked read functions return itemized posted effects and per-account opening, period opening postings, income, expense, net transfers and closing, all as exact paise strings. They read the canonical `finance_effects` ledger. Pending donations, claims and unpaid expenses have no effect. President, Vice President, Secretary and Treasurer can request; System Admin can inspect an existing report but cannot request one.
- `packages/reports/index.js` independently sums projected rows with `BigInt` and validates transfer pairs. The fixture includes opening postings, both contribution types, expense and a two-leg transfer.
- Direct table privileges are revoked and RLS is enabled. No public report or receipt table access is granted.

## Local execution update — 17 October 2026

The isolated development database has all 15 migrations. The local fresh-build
stack ran the expanded `backend/tests/phase7_report.sql` inside a rollback-only
transaction. Its mixed-source month has two accounts and nine effects totaling
17,900 paise. A later correction and donation leave that report fixed while a
new 12-effect request totals 18,300 paise. The following range carries the
9,300/9,000-paise balances as openings with no period lines. Report access,
request replay and correction receipt states pass in the fixture. This validates
the SQL source snapshots, not PDF bytes or a published report revision.

## Next work and release gates

- Exercise simultaneous posting and report cutoff in independent sessions; extend date-boundary checks beyond the tested future-range opening carry-forward. Repeat full-source and role tests on staging before publication.
- Build a worker that snapshots source identities and revision, renders a formal, accessible PDF, stores bytes privately with digest, and transitions queued → ready/failed with retry. This first schema intentionally has only queued status; add a controlled state migration with the worker.
- Generate monthly and one-time receipts from verified source and exact amount, with private file delivery. Public exact-code lookup requires owner privacy approval and rate limiting; void/superseded status depends on the correction workflow.
- Reconcile per-account opening + period opening postings + income − expense + transfers = closing; compare rendered totals to source and handle corrections with new report revision, never silent PDF overwrite.
- Build authorized download, report status and finance hub on web and Android; test direct URL denials, proof access, empty and failed cases.

**Phase 7 remains incomplete.** This is a private report source and testable calculation, not a published report or receipt workflow.
