# Phase 7 public receipt lookup — 21 October 2026

## Implemented

- Added `public.lookup_active_receipt(text)` with `EXECUTE` granted only to `service_role`. It returns the local issue date and exact paise amount for an active monthly, one-time or correction receipt. A void or superseded receipt returns no row. Donor identity, phone, proof, account and bank details are not projected.
- Added a server-only `POST /api/public/receipt` route. It accepts an exact receipt code in a bounded JSON body, applies shared global and same-code limits, and returns only `status`, `date` and decimal INR amount. Unknown, void and superseded codes return the same 404 response. Internal failures return a generic 503, with no receipt code in a URL.
- Added a public `/receipt` page. `PUBLIC_RECEIPT_LOOKUP_APPROVED=false` is the default; while disabled, the page shows a publication-approval notice and the API returns 503. The home page link appears only when enabled.

## Verification

- Five focused Node tests cover the disabled state, input bounds, exact paise, minimal projection, generic unknown/void/superseded response, limits and database failure. The full 115-test Node suite passes.
- The Phase 7 rollback-only SQL fixture checks service-only grants and active, void, superseded and unknown receipt states. All 12 rollback-only SQL fixtures pass on the disposable local database; the security catalog includes the new function and grant check.
- The built Next route was exercised against the disposable local Supabase database with the approval flag explicitly enabled: monthly ₹30.00, one-time ₹5.00 and correction ₹8.00 returned only verified date/amount; void, superseded and unknown codes returned identical 404 bodies; the sixth same-code request returned 429. The disposable database was reset afterward. Auth users, finance effects, monthly and one-time donations, correction receipts and Storage objects are all zero.
- The built server was separately checked with the flag off: `/receipt` returned 200 with the approval notice and `/api/public/receipt` returned 503. `npm run lint`, `npm run format:check`, `npm run typecheck`, `npm run check:env` and `npm run build:web` pass.

## Remaining gates

- A named masjid privacy/publication signatory must approve the exact public date/amount fields and notice before the flag is enabled outside this disposable test. The five product rules were accepted, but the signatory decision is still missing.
- Repeat actual route, rate-limit and accessibility checks on staging, including enumeration attempts and fresh issue/void/correction journeys. Full receipt PDF, report revision publication and broader field acceptance remain open.
