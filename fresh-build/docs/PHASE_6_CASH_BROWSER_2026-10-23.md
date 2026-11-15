# Phase 6 signed-in cash browser check — 23 October 2026

## Scope

Disposable local Supabase, local Next.js web client, and three separately issued synthetic Auth sessions. The fixture is `backend/scripts/phase6_cash_browser_fixture.mjs`. No real person, account, cash, or donor was used.

## Observed journey

1. President signed in through the web form and created an open cash collection task.
2. Member signed in, joined it, and submitted a pending ₹25.00 count on slip `BROWSER-CASH-001`.
3. Treasurer signed in and rejected the count with a reason. The web showed no pending count. SQL showed the rejected 2,500-paise count and only the 10,000-paise opening effect; the balance stayed ₹100.00.
4. Member signed in again, saw the reason, and submitted a corrected ₹23.50 count on new slip `BROWSER-CASH-002`.
5. Treasurer signed in again, verified physically received ₹23.50 and saw the balance rise to ₹123.50. SQL showed the rejected predecessor, the verified successor linked through `replaces_count_id`, exactly one 2,350-paise `one_time_donation` effect, and two claimed slip keys.
6. Treasurer signed out. The disposable database reset reported `0|0|0|0|0|0|0` for Auth users, Auth sessions, app users, finance effects, cash counts, slip claims, and Storage objects.

The first browser attempt at `127.0.0.1` left the Next development page in a loading state because that origin was blocked for development assets. The same local server at `localhost` loaded and completed the journey. The reusable fixture now presents `localhost` as its browser URL.

## Release boundary

This proves a local signed-in web path for rejection and replacement. It does not prove Android parity, hosted/staging behavior, independent physical slip reconciliation, real bank/opening approval, privacy sign-off, live backup/restore, or a signed production device build. Live cash remains gated.
