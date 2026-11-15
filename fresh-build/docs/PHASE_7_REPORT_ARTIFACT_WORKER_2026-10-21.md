# Phase 7 private report artifact worker — 21 October 2026

## Implemented

- Migration `20261021111448_report_artifact_lifecycle.sql` adds a private PDF/CSV Storage bucket and one artifact state per report and format. A service-only claim leases one item for five minutes. Completion requires the matching lease, exact path, SHA-256 and byte count. Failures are bounded to three attempts; an ambiguous upload is terminal for operator review. Browser roles have no direct table or Storage object grant. A guarded role-reader RPC exposes format and state without the object path.
- A dedicated `POST /api/jobs/report-artifacts/tick` route uses the existing server-only queue secret and runs one artifact per request. It is independent of the monthly queue tick, whose first-Friday window rejects calls on other dates. `REPORT_EXPORTS_APPROVED` and `REPORT_ARTIFACT_WORKER_ENABLED` both default to false in the web environment template.
- The worker reads the fixed report metadata and service-only line/balance projections, renders CSV or PDF with exact-paise reconciliation, uploads to the private bucket without overwrite, downloads the bytes to verify length and digest, then marks the artifact ready. The private report routes read the stored bytes only in worker mode, verify the saved digest and live role again, and return pending or failed states otherwise. The web report screen shows per-format status and offers refresh.

## Verification

- Seven focused Node tests cover disabled and unauthorized worker routes, ready readback, drift failure, terminal ambiguous upload, pending/failed reads and digest mismatch. The full 122-test Node suite passes.
- The Phase 7 rollback-only SQL fixture compares worker and actor projections on a corrected report, rejects a stale lease, validates authorized status, seeds more than 20 artifacts without starvation and stops after three retryable failures. All 12 rollback-only SQL fixtures pass on the disposable local database. Supabase local security and performance advisors report no issues.
- The built Next HTTP journey used separate issued President, Treasurer and Member sessions. A verified ₹123.45 opening produced pending CSV/PDF downloads; two authenticated worker ticks produced ready private files. Both downloaded SHA-256 headers matched bytes. Member report access, Member direct Storage download, anonymous download, missing cron authorization and a live role change were denied. The test removed the two Storage objects and reset the database; Auth users/sessions, app users, finance effects, report runs/artifacts and Storage objects all count zero.
- Lint, formatting, typecheck, environment template checks and production web build pass.

## Remaining gates

- Deploy the new migration and dedicated worker schedule only to an approved isolated environment, then repeat issued-session, concurrent-claim, expiry, retry and tamper tests there. The masjid privacy/publication signatory must approve the report fields before export flags are enabled for real data.
- Add operator recovery for terminal or ambiguous uploads, plus actual private-object backup/replay. Validate a worker runtime and schedule that can handle large PDFs within its execution limit.
- Complete PDF text accessibility and all finance source/revision cases in hosted/staging and named field acceptance. The original `finance_report_runs.status` remains `queued`; the per-format artifact table is the worker status source.
