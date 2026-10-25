# Phase 7 private CSV issued-session HTTP check — 21 October 2026

**Environment:** separate disposable `masjid-e-mamoor-2-fresh` local Supabase stack on ports 55320–55329, 20 fresh migrations, and a temporary production-built Next.js server on `127.0.0.1:18089`. The test enabled `REPORT_EXPORTS_APPROVED=true` only in that temporary process. It used three synthetic, email-confirmed Auth users and no real masjid records.

The runner `backend/scripts/phase7_csv_http.mjs` first required the exact disposable confirmation and verified zero Auth users, finance effects and Storage objects. It signed in distinct President, Treasurer and Member sessions, created one synthetic cash account, submitted and verified a 12,345-paise opening, requested a monthly report, and called the actual `/api/management/report-csv` route.

| Check | Expected | Actual |
| --- | --- | --- |
| President and Treasurer download | Both active finance readers can retrieve the same snapshot | HTTP 200 twice; each CSV contains the run/account IDs and `123.45` rupees |
| File integrity and privacy | Digest matches exact bytes; file is not cached | SHA-256 response header matched independently hashed bytes; `Cache-Control: private, no-store` |
| Anonymous and Member | Cannot download | HTTP 401 and 403 respectively |
| Invalid report ID | Rejected before database read | HTTP 400 |
| Temporary-password gate | Existing Treasurer session loses access after gate change | HTTP 403 |
| Live role change | Existing President session loses access after becoming Member | HTTP 403 |
| Cleanup | No synthetic state remains | Auth users/sessions, app users, accounts, finance effects, report runs and Storage objects all zero after local reset; temporary web port had no listener; only the fresh stack was stopped |

The integration command was `SUPABASE_TELEMETRY_DISABLED=1 FRESH_BUILD_TEST_DATABASE_CONFIRM=disposable node scripts/phase7_csv_http.mjs` from `fresh-build/backend/`. The test runner resets only the named disposable local database in `finally`. ESLint, TypeScript typecheck, Prettier and JavaScript syntax checks passed for the runner before execution.

This proves the CSV route with real local Auth sessions and Data API calls. Hosted web delivery, pagination beyond one page, PDF, queued/ready/failed worker lifecycle, salary/advance sources, report revisions, client download journey, staging and the named field-policy approval remain open. The default deployment setting remains off.

After the live check, the full 100-test Node suite, ESLint, TypeScript typecheck, Prettier and environment-template checks passed. The refreshed working-source archive passed its SHA-256 checksum, 883 file digests and clean restore. This archive does not include database or private Storage bytes.
