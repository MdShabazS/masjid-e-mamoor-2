# Phase 7 verified monthly contribution exports — 23 October 2026

## Disposable local journey

The existing built private PDF/CSV HTTP test now adds one synthetic, versioned-consent monthly donor after the earlier mixed-source report. A test-only approved consent version and QR snapshot are inserted into the disposable local database. The service role is denied direct access to `queue_monthly_request` (SQLSTATE 42501); the authorized first-Friday scheduler entrypoint queues exactly one request and one unsent outbox item. No message is dispatched to a provider.

An issued President session submits the claim. The finance effect count remains ten, proving that a pending claim does not post money. An issued Treasurer session verifies ₹30.00 into the second cash account and receives one receipt code. The new month report has eleven effects, exactly one `monthly_contribution` effect of 3,000 paise, and the second account closes at 9,200 paise: 5,000 opening + 2,000 transfer + 3,000 monthly income − 800 effective expense. The first account remains at 11,145 paise.

President CSV and Treasurer PDF downloads return the expected private formats and matching SHA-256 headers. The CSV contains the monthly source, ₹30.00 income and ₹92.00 closing balance. Anonymous CSV and Member PDF calls are denied. The ten-effect report and its CSV bytes remain unchanged after monthly verification. The existing donor correction, transfer, expense correction, password-gate and live-role-change assertions still pass in the same journey.

The script resets the local Supabase database even if an assertion fails. The post-run Auth users/sessions, app users, finance effects, report runs and Storage object counts are zero. All data and consent are synthetic and local; no real-data gate was enabled.

## Verification and remaining gates

The issued-session journey passed twice after using the intended scheduler entrypoint, including a final rerun with the direct-queue denial assertion. Both monthly-contribution and Phase 7 rollback-only SQL fixtures passed. All 131 Node tests, lint, typecheck, format, environment-template check and web build passed. A final seven-count query for Auth users/sessions, app users, finance effects, report runs, monthly outbox and Storage objects returned `0|0|0|0|0|0|0`.

The built local route now covers all existing posted source types: account openings, monthly and one-time contributions, transfers, expense payments and corrections. It has not established year/range export coverage, every authorized role, proof-reference display, artifact-worker output for this source mix, hosted/staging behavior, or client/device acceptance. Salary and advance/return posting are still absent from the fresh schema. Real-data exports remain gated by the named masjid signatory and field acceptance.
