# Phase 3 hosted permitted reads — 19 October 2026

**Target:** isolated Supabase development project `necattvpncnsrfcrwpjn` in Mumbai. No masjid or production data was used. The project had zero Auth users, sessions, application users, accounts, tasks and Storage objects before this run.

Eight email-confirmed synthetic Auth accounts, one per application role, were created in the dashboard after user confirmation. Eight profiles and aliases were assigned in a single checked transaction. A bounded SQL fixture supplied one cash account and one task owned by each of President, Vice President and Secretary. No payment, finance effect, participant or Storage object was created.

`backend/scripts/phase3_hosted_allowed_reads.py` signed in every account separately through Auth and checked the live application role. It then used issued access tokens and the project publishable key to call the Data API. The exact RPC inventory is shared with the local permitted-read runner; the hosted runner checks its count against the 65-RPC catalog.

| Check | Expected | Actual |
| --- | --- | --- |
| Issued role sessions | Eight distinct sign-ins and correct projected roles | Pass |
| Permitted reads | HTTP 200 for each listed role against 23 read-oriented RPCs | 93/93 pass |
| Task participant scope | Each task creator may read their own task; another creator receives HTTP 403 / `42501` | Three allowed reads included above; 3/3 cross-creator denials pass |
| Synthetic data cleanup | Remove the one account, three tasks, eight profiles and aliases, Auth sessions and users | Final SQL count `users|sessions|profiles|aliases|accounts|tasks|effects|objects = 0|0|0|0|0|0|0|0` |

The [before](hosted-allowed-users-before-cleanup-2026-10-19.png) and [after](hosted-allowed-users-cleanup-2026-10-19.png) dashboard screenshots show the user cleanup. The eight Auth users were permanently deleted after a separate action-time confirmation. The temporary credential file outside the repository was removed.

These checks prove hosted role gates and Data API availability for the selected reads. Most business tables were empty. Report-line/balance RPCs require a report-run fixture and are outside this inventory. Field-level projection, accepted-policy mapping, allowed write outcomes, trusted service routes, private object delivery, both signed-in clients and staging remain open.
