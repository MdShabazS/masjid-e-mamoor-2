# Masjid E Mamoor 2 — fresh build

This folder holds the whole product: the Android app, the web app, the shared
code and the Supabase database. What is done and what is left is in
[`PROJECT_STATUS.md`](PROJECT_STATUS.md). That is the current list; `tasks.md`
is the older dated evidence log (up to 29 October 2026).

## Layout

- `apps/android/`: the Android app (Expo 58, React Native 0.88). It has Home, Finance, Donors and Work tabs, shown by role.
- `apps/web/`: the web app (Next.js 16). It has the management pages and the `/api/v1` identity and enrollment routes the Android app also calls. Phones can install it from the browser (Add to Home Screen); `public/sw.js` only shows `public/offline.html` when there is no connection and stores no data.
- `packages/`: shared JavaScript: `api-client` (calls and readable messages), `offline-drafts`, `reports`, `contracts`, and tested business-rule modules (`contributions`, `expenses`, `finance-ledger`, `meetings`, `tasks`).
- `backend/`: Supabase config and 40 ordered migrations (`backend/supabase/migrations/`), 20 rollback-only SQL test files (`backend/tests/`), identity, report, receipt, QR, backup and job services, plus operator scripts.
- `scripts/`: repository checks (environment templates, dependency audit, bundle scan, release config, web smoke test, source backup) and `make_app_icons.mjs`, which rebuilds the web app's home-screen icons (pass the masjid logo SVG to replace the placeholder).
- `docs/`: dated decisions and evidence for each build phase. `docs/MASTER_BUILD_PLAN.md` is the phase plan, and `docs/PHASE_1_PRODUCT_RULES.md` holds the product rules and owner decisions.

The product specification is `../docs/REQUIREMENTS_BASELINE_2026-10-15.md` and
`../docs/TASK_5_DECISION_REGISTER_2026-10-15.md`, plus later owner decisions
recorded in `docs/PHASE_1_PRODUCT_RULES.md`. Where they disagree, the later
explicit owner decision wins.

## After cloning

1. Install Node 24 (see `.nvmrc`), which comes with npm 11. Python 3 is needed for the checks, and Docker plus the Supabase CLI for a local database.
2. From this folder run `npm ci`. This installs both apps and all packages from the locked `package-lock.json`.
3. Copy `apps/web/.env.example` to `apps/web/.env.local` and `apps/android/.env.example` to `apps/android/.env`, then fill in the Supabase URL and publishable key of the environment you use. `EXPO_PUBLIC_WEB_API_URL` is the web app's address, used by the Android app for sign-in and account management. Only the web server may hold the service-role key (`SUPABASE_SERVICE_ROLE_KEY`). Never put it in an `EXPO_PUBLIC_` or `NEXT_PUBLIC_` variable.
4. Web: `npm run dev --workspace=@masjid/fresh-web`. Android: `cd apps/android && npm run start`, then open Android (emulator or Expo Go development build).
5. Local database: `cd backend && supabase start`, then `supabase db reset` applies every migration to the local stack.

These things are not in Git and must be recreated or fetched from their owners: `.env` files, the Supabase CLI link (`cd backend && supabase link --project-ref <ref>`), database passwords, Vercel environment variables, and the Android signing key once one exists.

## Checks

These are the same steps CI runs (`.github/workflows/fresh-build-source.yml`):

```bash
npm ci
npm test
npm run lint
npm run format:check
npm run typecheck
npm run build:web
npm run smoke:web
npm run export:android
npm run check:bundle
npm run test:backup
npm run check:shell
npm run check:env
npm audit --json > /tmp/audit.json; python3 scripts/check_dependency_audit.py /tmp/audit.json
python3 backend/scripts/db_fixture_preflight.py
```

`npm run check:bundle` scans the built web and Android files for server secrets.
Build and scan with the fake `BUNDLE_SECRET_CANARIES`, `SUPABASE_SERVICE_ROLE_KEY`,
`META_APP_SECRET` and `QUEUE_CRON_SECRET` values from the workflow file, or it
stops and asks for them. `npm run export:android` checks the JavaScript bundle,
not an installable APK.
The APK profiles are in `apps/android/eas.json`.

Database tests run against a disposable database only. Set
`FRESH_BUILD_TEST_DATABASE_URL` and `FRESH_BUILD_TEST_DATABASE_CONFIRM=disposable`,
then run `bash backend/scripts/run_fresh_db_checks.sh`. Every test file rolls
back, so it leaves no data. The runner checks the inventory but does not apply
migrations.

## Environments

| Environment | Supabase project       | State                                                       |
| ----------- | ---------------------- | ----------------------------------------------------------- |
| Staging     | `mjcuxvcmebmhvqqzcshm` | Active. 39 of 40 migrations; System Admin only              |
| Production  | `ifyluztozjetusholoaw` | Paused. Untouched; its migration history needs repair first |
| Development | `necattvpncnsrfcrwpjn` | Paused                                                      |

Vercel previews are protected by Vercel login. Until the real launch, the
project's public main address `https://masjid-e-mamoor-2.vercel.app` serves
`main` against the **staging** database (test data only), so phones can install
and test it. At launch, switch its settings to the production project. Details:
`docs/STAGING_AND_VERCEL_2026-10-27.md`.

Before any staging or production migration, take a verified database and object
backup, and run `supabase db push --dry-run` first. Real-money launch stays
NO-GO until the gates in `PROJECT_STATUS.md` are closed.

## Source backup

CI also builds and restores a source archive. Locally, from the parent folder,
run `python3 scripts/backup_project_source.py`, then pass the printed path to
`python3 scripts/verify_project_source_backup.py <archive>`. This covers source
only, not the database or stored files.
