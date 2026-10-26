# Masjid E Mamoor 2 — fresh build

This directory is the implementation home for the new Android and web product.
The superseded root `apps/`, `packages/`, and `supabase/` trees were removed
after a verified source backup. Their committed history remains available in
Git. New runtime code must not depend on those database migrations or assume
their older business rules are approved.

Use the confirmed decisions in `../docs/REQUIREMENTS_BASELINE_2026-10-15.md`,
`../docs/TASK_5_DECISION_REGISTER_2026-10-15.md`, and subsequent user decisions
as the product specification. Where those documents disagree, the later explicit
user decision wins. Record unresolved decisions in `tasks.md`; do not guess at
financial posting or access rules.

Planned source layout:

- `apps/android/` — Android app and device-specific behavior.
- `apps/web/` — public site and authenticated management UI.
- `packages/` — shared contracts and validation.
- `backend/` — new schema, trusted commands, authorization, and jobs.
- `docs/` — implementation decisions and verification evidence.

The current execution plan is `docs/MASTER_BUILD_PLAN.md`. Local setup,
environment custody and rollback boundaries are in
`docs/PHASE_0_LOCAL_OPERATIONS_2026-10-17.md`. Phase 1 proposed
rules and outstanding owner decisions are in `docs/PHASE_1_AUDIT.md`; Phase 2
architecture, API/data, threats/migration and acceptance mapping are in
`docs/PHASE_2_*.md`. Draft designs are not deployed behavior.

The previous Task 7 migrations and tests remain in Git history and the
pre-cleanup source backup. They are not applied to this fresh build.

## Local setup and checks

Use Node 24 and npm 11. From this directory run `npm ci`, `npm test`,
`npm run lint`, `npm run format:check`, `npm run typecheck`,
`npm run build:web`, `npm run export:android`, `npm run test:backup`, and
`npm run check:shell`, and `npm run check:env`. The environment check ensures
all statically referenced app variables appear in their app template and
rejects secret-looking names with a public client prefix. After building web, `npm run smoke:web` tests public
HTTP pages and the fail-closed unconfigured server routes. The root
`package-lock.json` pins the two app dependency
trees. Do not link either app to the older `node_modules` directories. The
Android export checks its JavaScript bundle, not an installable APK.

Copy `apps/web/.env.example` and `apps/android/.env.example` to their respective
local `.env` files. Browser/Android publishable keys may reach clients; the
service-role and Meta credentials belong only on trusted web/server processes.
Use separate development, staging and production credentials and databases.
Keep all `.env` files, signing keys and service credentials out of Git and source
archives. No environment is provisioned by this repository.

The database migrations in `backend/supabase/migrations/` are ordered by file
name. Apply them only to an isolated disposable development database, then set
`FRESH_BUILD_TEST_DATABASE_URL` plus
`FRESH_BUILD_TEST_DATABASE_CONFIRM=disposable` and run
`bash backend/scripts/run_fresh_db_checks.sh` for nine workflow SQL scenarios,
the security-catalog fixture and the eight-role read fixture. The
fixture runner performs an inventory/rollback boundary preflight but does not
itself apply migrations. Keep a verified database and
object backup before any staging or production migration; test rollback or
forward correction on a restored staging copy. On 16 October 2026 the 15
migrations and 11 rollback-only fixtures passed on the isolated development
project through the connected SQL runner. One issued Auth token passed 48
direct API checks as its database role was changed through all eight roles.
On 17 October a separate local stack passed a clean reset and all 11 original
fixtures through container `psql -X -v ON_ERROR_STOP=1`. Eight distinct local
Auth sessions passed 48 direct role/read checks, expiry rejection, role-change
and deactivation gates. Staging restore and signed-in client journeys remain
pending; see
`docs/PHASE_3_DATABASE_EXECUTION_2026-10-16.md`.

For the Phase 4 independent-session transfer race, start the separate local
stack from `backend/`, ensure it contains no users or finance effects, then run
`FRESH_BUILD_TEST_DATABASE_CONFIRM=disposable python3 scripts/phase4_concurrency.py`.
The script resets that **local fresh-build** database after the race. It is
not a hosted or production test; see `docs/PHASE_4_EXECUTION_2026-10-17.md`.
With the same disposable confirmation, `python3 scripts/phase4_auth_api.py`
uses two temporary local Auth Admin users to exercise the President and
Treasurer account RPCs, then resets the local database.

The repository CI runs a clean locked install, local checks and a source archive
restore. From the parent worktree, run `python3 scripts/backup_project_source.py`
and pass the printed archive path to
`python3 scripts/verify_project_source_backup.py <archive>` to verify checksum,
every manifest entry and extraction into a clean temporary directory. This
source restore is separate from database and private object recovery.
