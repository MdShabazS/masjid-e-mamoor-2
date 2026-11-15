# Phase 7 corrected export proof — 21 October 2026

## Scenario

The disposable local integration test `backend/scripts/phase7_pdf_http.mjs` now signs in separately issued President, Treasurer and Member sessions. It verifies a ₹123.45 account opening and a ₹15.00 one-time donation, requests an original monthly report, then corrects the donation to ₹8.00 and requests a new report. The two runs have distinct IDs and fixed source effects.

## Result

- The original actor-scoped balance remains 13,845 paise after the correction. Its CSV bytes remain identical, and its first export shows ₹138.45 closing and ₹15.00 donation.
- The revised report has four effects: opening, original donation, reversal and replacement. Its actor-scoped balance is 13,145 paise; the CSV shows ₹131.45 closing, −₹15.00 reversal and ₹8.00 replacement.
- Both reports download through the built private CSV/PDF routes. Returned SHA-256 headers match downloaded bytes. The revised PDF is a distinct private export. The PDF renderer calls the same exact-paise reconciliation as CSV before returning bytes.
- Anonymous and Member requests are denied. The test also denies a Treasurer after the password gate is set and a President after a live role change. Storage objects remain zero because these routes render on demand.
- The test reset the disposable database. No synthetic Auth, finance or Storage fixture remains. The `finance_report_runs` status is still `queued`; this proof does not claim worker readiness or persisted files.

## Remaining work

The local private artifact worker is now implemented and tested; see `PHASE_7_REPORT_ARTIFACT_WORKER_2026-10-21.md`. Repeat corrected exports for expense, salary/advance and transfer sources, and run hosted/staging, accessibility and masjid-approved publication checks.
