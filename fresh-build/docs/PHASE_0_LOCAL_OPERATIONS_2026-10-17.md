# Phase 0 local operations and environment ownership — 17 October 2026

This describes the current **fresh-build** development path. The older root
`supabase/` migration tree and applications are reference material. Keep
`sources/` read-only. Do not run a reset against the hosted development project,
the older local stack, staging or production.

## Clean setup

1. Use Node 24, npm 11, Python 3 and Docker Desktop. From `fresh-build/`, run
   `npm ci --ignore-scripts --no-audit --no-fund` and then `npm test`,
   `npm run check:env`, `npm run lint`, `npm run format:check`,
   `npm run typecheck`, `npm run build:web`, `npm run smoke:web`,
   `npm run export:android`, `npm run test:backup` and `npm run check:shell`.
   The CI source workflow runs these gates from a clean checkout. Android
   export checks the bundle; native APK and device checks are separate.
2. For a disposable database, run from `fresh-build/backend/`:
   `supabase start --exclude studio,postgres-meta,logflare,vector,imgproxy,supavisor,realtime,mailpit,edge-runtime`.
   This project's `config.toml` uses `project_id = "masjid-e-mamoor-2-fresh"`
   and ports 55320–55329. Verify that ID with `supabase status -o json` before
   any reset. The older `masjid-e-mamoor-2` local stack is a different project.
3. Only when this fresh local database is confirmed disposable, run
   `supabase db reset --local --no-seed` from `fresh-build/backend/`. This
   applies the 18 ordered migrations. Run
   `python3 scripts/db_fixture_preflight.py` from the backend directory, then
   `bash scripts/run_fresh_db_checks.sh` with
   `FRESH_BUILD_TEST_DATABASE_URL` pointing to this local direct Postgres URL
   and `FRESH_BUILD_TEST_DATABASE_CONFIRM=disposable`. The runner's 12 SQL
   fixtures each begin a transaction and roll it back. They need an owner DB
   role because they create synthetic Auth fixtures and set database roles.
   If host `psql` is unavailable, run each fixture from the parent worktree
   through `docker exec -i supabase_db_masjid-e-mamoor-2-fresh psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 -Atq < fresh-build/backend/tests/<fixture>.sql`.
4. From `fresh-build/backend/`, with the same disposable confirmation, run
   `python3 scripts/phase3_issued_role_matrix.py`,
   `python3 scripts/phase4_auth_api.py` and
   `python3 scripts/phase4_concurrency.py` separately. Each script requires an
   empty local test database and resets **only this fresh local project** in a
   `finally` block. Check its output and verify zero Auth users/effects after
   a failure before continuing. Stop it with
   `supabase stop --project-id masjid-e-mamoor-2-fresh`.
5. From the parent worktree, run `python3 scripts/backup_project_source.py`
   and `python3 scripts/verify_project_source_backup.py <printed-archive>`.
   This restores source into a clean temporary directory and compares every
   file digest. It is not a database or private Storage backup.

## Environment separation and custody

Create separate development, staging and production Supabase projects, web
deployments and credentials. The local stack is disposable. The hosted
development project is isolated, but staging and production are not yet
provisioned. No real donor, account, salary or masjid data belongs in local
fixtures. Never copy production secrets into development or public app values.

| Variables or material | Runtime exposure | Responsible custodian before launch |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `EXPO_PUBLIC_WEB_API_URL` | Public web/Android build | Deployment owner chooses the matching environment URL and publishable key. |
| `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Trusted web/server only; service key never in a client | Backend/deployment owner stores a separate secret for each environment. |
| `IDENTITY_INTERNAL_DOMAIN`, `APPROVED_DONOR_CONSENT_VERSION` | Trusted web/server configuration | Identity owner; consent version remains unset until masjid approval. |
| `META_APP_SECRET`, `META_WEBHOOK_VERIFY_TOKEN`, `META_PHONE_NUMBER_ID`, `META_ACCESS_TOKEN`, `META_GRAPH_API_VERSION` | Trusted webhook/worker only | Masjid Business account owner and backend owner; outbound remains disabled. |
| `QUEUE_CRON_SECRET` | Trusted scheduler and web route only | Deployment owner; create per environment when a scheduler is deployed. |
| Android signing key, Auth Admin credentials, database backup key and offsite destination | Private operator custody | Named release/backup owners must be recorded before staging and launch. |

The template coverage gate checks that app-referenced variable names appear in
the templates and that public prefixes do not name obvious secrets. It cannot
verify account custody, deployed values or URLs. Named custodians and actual
staging/production secret stores remain open owner inputs.

## Migration and recovery boundary

- The hosted development project already received all 18 fresh migrations.
  Local `db reset` is a destructive **disposable-only** test command.
- Before staging/production schema changes, capture and verify a real Postgres
  backup plus private object bytes, restore both into a separate environment,
  record counts and hashes, and rehearse the specific forward correction or
  rollback there. Do not assume a down migration can reverse posted finance
  history. Keep a release-specific recovery decision and operator sign-off.
- The current source archive cannot recover database rows or private objects.
  A clean database/object restore drill and its owner are still required.

## Current evidence and open gates

Local clean dependency/build checks, 18 migrations and 12 rollback-only fixtures,
plus hosted migration 18 and its twelfth rollback-only fixture,
eight distinct issued Auth sessions, expired-token denial, and Phase 4 transfer,
correction and expense races have passed. The exact commands and observations
are recorded in the Phase 3 and Phase 4 execution notes. Hosted CI has not
run from a committed clean checkout. Named secret owners, staging/production,
real database/object restore, signed-in device journeys and owner policies
remain open.
