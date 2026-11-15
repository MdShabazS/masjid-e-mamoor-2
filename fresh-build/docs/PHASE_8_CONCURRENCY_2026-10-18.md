# Phase 8 task concurrency — 18 October 2026

The disposable `masjid-e-mamoor-2-fresh` local database applied the current 18 migrations. `backend/scripts/phase8_concurrency.py` created five synthetic Auth users with live sessions and exercised the public task RPCs through separate `psql` connections using the authenticated role. One transaction held its task lock while the second attempted the competing command.

Observed results:

- Two volunteers competed for the final place: one was confirmed and the other waitlisted; the committed task had exactly one confirmed participant and one waiter.
- With two members already waiting, the confirmed member left while a newcomer joined. The oldest waiter was promoted, the newcomer stayed waitlisted, and the next departure promoted the next oldest waiter.
- Two sessions retried the same join operation ID. Both received `confirmed`; the database stored one participant and one operation.
- Two reviewer sessions competed over one submitted completion. The first accepted it, and the second was denied because it was no longer submitted. The member had exactly one verified task; cancelling that task reduced the verified count to zero.

The final expanded run passed. An earlier expanded run failed because its test helper rolled back the completion submission; the helper was corrected and the entire test rerun. The script reset only the disposable local stack after every run. A final direct query returned `0|0|0|0|0|0|0|0` for Auth users, sessions, app users, tasks, participants, task operations, finance effects and Storage objects.

This completes the local independent-session capacity, FIFO, retry, review and verified-count reversal slice. Android participation, hosted issued-session races and field acceptance remain open. Do not treat this as Phase 8 or release sign-off.
