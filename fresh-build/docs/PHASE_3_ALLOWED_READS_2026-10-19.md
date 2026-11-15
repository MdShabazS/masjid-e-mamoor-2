# Phase 3 local permitted-read and QR gate check — 19 October 2026

## Environment and method

Disposable `masjid-e-mamoor-2-fresh` Supabase stack, separate from the legacy stack. The local Data API schema cache was refreshed after migration reset. `backend/scripts/phase3_issued_role_matrix.py` created eight email-confirmed synthetic Auth users, signed in separately as every application role, then reset the fresh database in `finally`.

The read inventory is explicit in that script. It covers 23 read-oriented RPCs from the 65-function guarded matrix. A President created a synthetic cash account. President, Vice President and Secretary each created a separate task so the participant-list read was tested against a task owned by the caller. The script used issued access tokens through the Data API, not fabricated JWT claims.

## Expected and actual

| Check | Expected | Actual |
| --- | --- | --- |
| Baseline role/read and direct-table checks | 48 pass | 48 pass |
| Permitted read calls | HTTP 200 for every role allowed by the current RPC guard, using valid fixture scope | 93 pass across 23 RPCs |
| Task participant ownership | Creator reads own task; another creator receives 403/42501 | Three creator reads included above; three cross-creator denials pass |
| Wrong-role RPC calls | 403/42501 for every disallowed role/function pair | 288 pass across 65 functions |
| Expired, changed and deactivated identities | Expired JWT rejected; live role change reflected; inactive user loses protected access | Pass |
| QR upload/read gate tests | Inactive and temporary-password users receive 403 before Storage upload/download | Four added gate cases pass; 11 focused QR tests pass |
| Cleanup | No synthetic users, sessions, accounts, tasks, finance effects or Storage objects | `0|0|0|0|0|0|0`; fresh stack stopped |

Focused QR tests, lint and JavaScript typecheck passed. Formatting was corrected with Prettier after its first check identified only the two edited QR test files; the final formatting check is recorded in the turn output.

## Limits and next checks

These are local development results. Most reads used an empty business result set, so they prove route availability and role gates, not complete field-level output correctness. `list_finance_report_lines` and `list_finance_report_balances` need a real report-run fixture and were deliberately excluded from the permitted-read count. The task participant RPC has a creator ownership rule in addition to its broad role guard; the three cross-creator denials exercise that rule. Hosted permitted reads, trusted service-route calls with issued sessions, accepted-policy mapping, staging, and signed-in web/Android journeys remain open.
