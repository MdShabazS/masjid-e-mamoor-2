# Phase 7 hosted issued-session report reads — 20 October 2026

**Environment:** isolated Supabase development project `masjid-e-mamoor-2-dev-20261016` (`necattvpncnsrfcrwpjn`), with 20 fresh migrations. All accounts and finance entries were synthetic. No masjid or production records were used.

Five temporary, email-confirmed Auth users signed in separately as System Admin, President, Vice President, Secretary and Treasurer. The President created a synthetic cash account, the Treasurer submitted a 12,345-paise opening, and the President verified it. Four permitted roles requested their own current-month report through the hosted Data API. The runner is `backend/scripts/phase7_hosted_report_reads.py`.

| Check | Expected | Actual |
| --- | --- | --- |
| Issued role sessions | Five distinct sign-ins resolve to the assigned live roles | Five sign-ins and five `current_app_role` checks passed |
| Report request | President, Vice President, Secretary and Treasurer may request a month snapshot | Four HTTP 200 responses returned distinct report run IDs |
| Request denial | System Admin may not request a report under the current guard | HTTP 403 / SQLSTATE 42501 |
| Shared report readers | All five roles may read the President's run under the current guard | Ten HTTP 200 calls across `list_finance_report_lines` and `list_finance_report_balances` |
| Own-run readers | Each requester may read both projections of its own run | Eight more HTTP 200 calls |
| Snapshot amounts | One `account_opening` line and one account balance, each at exactly 12,345 paise | Exact line amount, period opening and closing checked on all applicable reads |

The runner output was: `Five issued sessions, four report requests, 18 exact report reads and System Admin request denial passed`. Hosted SQL before cleanup showed five Auth users/sessions/profiles/aliases, one account/opening/effect, four report runs/effect snapshots/account snapshots, and zero Storage objects.

After explicit user approval, the report tables were emptied, the one identified synthetic account and its dependent finance rows were removed in a guarded transaction, and the five app profiles and aliases were removed. The Supabase Auth dashboard then deleted the five selected temporary users. Final hosted SQL returned **zero** for Auth users and sessions, profiles, aliases, accounts, openings, finance effects and audit, beneficiary rows and versions, report runs/effects/accounts, and Storage objects. The [dashboard cleanup screenshot](phase7-hosted-report-cleanup-2026-10-20.png) shows the empty Auth list and successful deletion toast. The temporary credential file was removed.

This closes the hosted issued-session read gap for these two RPCs. It does not validate generated PDF/CSV bytes, worker status or retry handling, report publication policy, complete field projections, stale-role behavior on these report routes, or staging and production operation. The current guard allows System Admin to read an existing report but denies report creation; that role distinction still needs accepted-policy review.

Local regression checks after cleanup passed: 92 Node tests, ESLint, TypeScript typecheck, Prettier, and Python source compilation of the hosted runner. The refreshed working-source archive passed its checksum, 875 file digests and clean restore verification. The first `py_compile` invocation could not write Apple's default bytecode cache outside the sandbox; compiling the source in memory passed.
