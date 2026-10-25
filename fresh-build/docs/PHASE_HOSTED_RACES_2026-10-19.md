# Hosted finance and task race evidence — 19 October 2026

**Environment:** isolated Supabase development project `masjid-e-mamoor-2-dev-20261016` (`necattvpncnsrfcrwpjn`). Six temporary, email-confirmed synthetic Auth users independently signed in: one President, one Treasurer and four Members. `backend/scripts/phase_hosted_races.py` called the public Auth and Data APIs with their issued access tokens. No service key or production data was used.

## Expected and observed

| Check | Expected | Observed |
| --- | --- | --- |
| Session identity | Six live roles and active identity gates | All six passed |
| Competing transfer | Two 7,000-paise transfers from a 10,000-paise source: exactly one succeeds | One HTTP 200, one insufficient-balance HTTP 400; source/target balances 3,000/7,000 paise |
| Transfer retry | Same operation ID produces one transfer result | Both callers received the same successful result |
| Opposing transfers | Simultaneous opposite-direction requests reconcile | Both succeeded; final source/target balances 2,000/8,000 paise |
| Final task slot | Two Members compete for one slot | One confirmed, one waitlisted |
| Waitlist FIFO | A departure promotes the oldest waiter even with a concurrent new join | Oldest promoted; newcomer remained waitlisted; next departure promoted the next waiter |
| Task retry | Same Member and operation ID joined twice | Both returned `confirmed` |
| Competing reviews | A submitted completion is accepted once | One acceptance; stale second review denied; verified count was one |
| Cancellation | Cancelled task stops earning credit | Verified count became zero |

The script completed successfully. Its local manifest recorded two account IDs, two task IDs and 24 operation IDs so cleanup could be bounded to this fixture. A first cleanup transaction rolled back when an immutable beneficiary-version trigger rejected deletion; inspection identified that trigger, and a corrected transaction completed. No partial cleanup committed. The cleanup transaction disabled six immutable fixture-table triggers, removed only the identified account/task rows, and re-enabled each trigger before commit. The app aliases and users were then removed, followed by all six synthetic Auth users through the dashboard after action-time approval.

Final hosted SQL check returned **zero** Auth users, Auth sessions, app users, aliases, accounts, openings, transfers, effects, finance audit rows, tasks, participants, task operations, beneficiary versions and beneficiaries. The [dashboard cleanup screenshot](hosted-fixture-cleanup-2026-10-19.png) shows no Auth users. Temporary credentials and the local manifest were removed after recording this evidence.

This proves only the named direct hosted API race slice. It does not sign off every finance source, correction/reversal chain, all RPC and service permissions, signed-in web/Android journeys, staging or production behavior. Those remain open in `tasks.md`.
