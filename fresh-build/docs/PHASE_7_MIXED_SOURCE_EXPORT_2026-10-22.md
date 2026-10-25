# Phase 7 mixed-source private exports — 22 October 2026

## Disposable local journey

The built private CSV and PDF routes were exercised with separately issued President, Treasurer and Member sessions. Two synthetic cash accounts received verified openings. A Treasurer moved ₹20.00 between them, submitted an expense that a separate President approved, then paid ₹10.00 from the second account. The test requested a month snapshot and checked its eight immutable effects: the earlier donation and correction, two openings, both transfer legs and the expense payment.

The first account reconciled to ₹111.45 (₹123.45 opening + ₹8.00 corrected donation − ₹20.00 transfer). The second reconciled to ₹60.00 (₹50.00 opening + ₹20.00 transfer − ₹10.00 expense). The script checks the exact paise category columns, both opposite transfer legs with one source ID, the private CSV values and SHA-256, and an authorized Treasurer PDF digest.

The Treasurer then corrected the expense payment from −₹10.00 to −₹8.00. A new snapshot had ten effects, including the ₹10.00 reversal and −₹8.00 replacement, and closed the second account at ₹62.00 with an ₹8.00 effective expense. The prior report's lines, balances and CSV bytes remained unchanged. Both new export digests matched the downloaded bytes. Anonymous CSV access and Member PDF access were denied; the earlier password and live-role-change denials still passed. No report objects were stored by the direct export route.

The fixture always resets the disposable local Supabase database. The post-run counts for Auth users/sessions, app users, finance effects, report runs and Storage objects were zero. No real person or money was used.

The expanded HTTP journey passed twice, including the rerun after exact account-category assertions were added. The rollback-only Phase 7 SQL fixture also passed and left all six counts at zero. All 131 Node tests, lint, typecheck, formatting, environment template checks and the production web build passed.

## Remaining coverage

This proves the current opening, one-time donation, transfer, expense payment and correction effects through the local issued-session routes. Monthly contributions have rollback-only SQL projection coverage but do not yet have this built-route mixed-source proof. Salary and advance/return posting do not exist in the current fresh migrations; they require product design, schema, authorization, reconciliation and separate tests before those sources can appear in a report. Repeat source and period coverage in hosted development and staging, including year/range periods, proof references, private artifact-worker output and client downloads. The report approval gate remains off for real-data use pending the named masjid signatory.
