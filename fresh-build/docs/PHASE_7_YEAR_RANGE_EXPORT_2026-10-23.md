# Phase 7 year and range private exports — 23 October 2026

## Disposable issued-session journey

The built private report PDF/CSV route now runs the existing mixed-source fixture through all three period kinds. After the verified monthly contribution, an issued Treasurer session requests a full calendar-year snapshot. Its eleven effect rows and both account balances match the month report because every synthetic effect belongs to that year. President CSV and Treasurer PDF downloads return matching SHA-256 digests, and a Member is denied the direct PDF URL.

An issued President session then requests a one-day range beginning tomorrow in India time. It has no period effects. Its two account rows carry the entire prior ledger forward as opening and closing balances: 11,145 and 9,200 paise. Period opening, income, expense and transfer columns are each zero. Treasurer CSV and President PDF downloads succeed with matching digests; the CSV has no effect rows, and a Member is denied the direct CSV URL. The earlier month CSV bytes remain unchanged.

The route test continues to prove the monthly donor claim does not post money, the protected direct queue call is denied, the first-Friday scheduler creates only one unsent request, and the expense/donation correction snapshots remain frozen. The test resets the disposable database even on failure. No real people, money, messaging or hosted configuration are involved.

## Verification and remaining gates

The first extended run stopped before period assertions with `invalid_donor_enrollment`/SQLSTATE 22023. The synthetic consent timestamp was adjusted to one minute before the test call so it cannot be future-dated. The full journey then passed; the fixture now includes database error messages for any further diagnosis. This change addresses the immediate test failure; its original timing cause was not established.

Verification passed: 131 Node tests, lint, typecheck, format, web build, migration/fixture preflight (24 migrations and 12 fixtures), the rollback-only Phase 7 SQL fixture and a final zero-count check for Auth users, app users, finance effects, report runs, monthly outbox and Storage objects. The environment-template checker now prunes generated build trees before scanning; its three tests and the web build passed while run together. This removes the observed `.next` traversal race during parallel verification.

This covers month, year and a future empty range through the built local route for President and Treasurer. It does not establish every authorized role, a populated partial range crossing months, proof-reference display, private artifact-worker output for all periods, hosted/staging behavior, screen-reader acceptance or a device/browser field journey. Salary and advance/return posting remain unimplemented. Real-data export approval is still pending.

## Populated range spanning a month boundary

The issued Treasurer session also requested a `range` beginning on the previous month's last day and ending the day after the current India date. The eleven current-month effects, both account balances and the exact source lines matched the monthly snapshot. Treasurer CSV and President PDF downloads returned valid SHA-256 headers; the CSV contained the monthly contribution and 111.45/92.00 closing amounts. A Member's direct PDF URL returned 403. The earlier monthly CSV remained byte-identical after the range request.

This checked a populated range whose dates crossed a calendar boundary. That fixture's postings were all on the current-month side; the two-sided and partial cases were completed in the 24 October follow-up below. The full local journey and database reset passed again. The 131 Node tests, lint, typecheck, formatting, environment check run alongside the build, web build and rollback-only Phase 7 SQL fixture passed. Final Auth users, app users, finance effects, report runs, monthly outbox and Storage object counts were zero.

## Two-sided boundary and partial period — 24 October follow-up

The isolated local Supabase project was confirmed empty, reset through all 28 current migrations, and exercised through the built private PDF/CSV routes with issued President, Treasurer and Member sessions. The disposable fixture added a third cash account with a verified 5,000-paise opening dated on the previous month's last day. Since posted finance effects are immutable and the app cannot backdate them, this historical source/effect pair was seeded directly by the test owner role. A normal Treasurer RPC then posted a 700-paise transfer into that account on the current day.

The range spanning both dates returned 14 lines exactly once: the earlier eleven-source mix, the historical opening and two current transfer legs. Its three closing balances were 10,445, 9,200 and 5,700 paise. The current-day-only range excluded the historical opening from its 13 lines and carried 5,000 paise forward as that account's opening; its 700-paise transfer closed it at 5,700 paise. Treasurer CSV and President PDF SHA-256 headers matched downloaded bytes. The Member's direct CSV URL was denied, and the earlier monthly CSV stayed byte-identical. The fixture reset the local database; Auth users, finance effects, report runs and Storage objects were `0|0|0|0`. All 131 Node tests, lint, formatting and typecheck passed.

The same built route was rerun with six separately issued sessions. President and Treasurer PDF/CSV checks still passed; Vice President, Secretary and System Admin each downloaded the private monthly CSV and PDF with matching SHA-256 headers, while Member direct access stayed denied. The second reset again left Auth users, finance effects, report runs and Storage objects at `0|0|0|0`. This completes the **local two-sided/partial range projection and permitted private-reader checks**. It does not establish a backdated posting user workflow, hosted/staging exports, report-worker output, salary/advance sources or field accessibility acceptance.
