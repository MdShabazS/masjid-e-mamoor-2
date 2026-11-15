# Fresh backend

This folder holds the Supabase project (`supabase/config.toml`) and its 39
ordered migrations in `supabase/migrations/`, applied in file-name order. They
are the only schema source. The old root `supabase/` tree is in Git history only
and must never be applied.

Every app action goes through a `SECURITY DEFINER` function that checks the
caller's role. Direct table access is revoked, money is stored in paise, finance
history cannot be edited, and repeated requests are made safe by operation IDs.

- `tests/`: 19 rollback-only SQL test files. Run them with `scripts/run_fresh_db_checks.sh` against a disposable database (see `../README.md`). `scripts/db_fixture_preflight.py` checks the list is complete and that every file rolls back.
- `identity/`, `api/`: username sign-in, account creation and reset (used by the web `/api/v1` route).
- `reports/`, `receipts/`, `qr/`, `jobs/`, `whatsapp/`, `backup/`, `ops/`: server services. Each is switched off by an environment flag until the owner approves it.
- `scripts/`: operator and test scripts.

State on 15 November 2026: staging has 38 of the 39 migrations (the 10 November
account management migration is next). Production is paused and untouched. See
`../PROJECT_STATUS.md`.

For local start, reset and environment custody, see
`../docs/PHASE_0_LOCAL_OPERATIONS_2026-10-17.md`. Applying migrations does not
turn on donor enrollment, public receipts, reports or messaging.
