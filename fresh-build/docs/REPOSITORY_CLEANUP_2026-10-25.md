# Repository cleanup and source verification — 25 October 2026

The active application remains in `fresh-build/`. The superseded root
`apps/`, `packages/`, `supabase/` and pnpm workspace were removed from the
working tree after the owner approved that exact scope. The 397 tracked
legacy-file removals are recoverable in Git history. The separate untracked
legacy changes are recoverable from the verified pre-cleanup local archive:

`backups/masjid-project-working-source-2026-10-25T181905Z.tar.gz`

The pre-cleanup SHA-256 is
`f00a83b503a7f502c105a340d3a998ca4575a66de988e66fc50be62e259e6fdf`.
Its verifier restored and checked 991 source files. Local backups are excluded
from Git. Historical requirements in root `docs/` remain available and are
marked as reference, while `fresh-build/tasks.md` is the current tracker.

The previous fresh-build source commit `71d9cde` passed GitHub Actions
[run 40220489391](https://github.com/MdShabazS/masjid-e-mamoor-2/actions/runs/40220489391).
It ran clean install, dependency gates, 151 Node tests, environment checks,
lint, format, typecheck, web build and HTTP smoke, Android bundle export,
public-bundle canary scan, backup tests, migration-fixture preflight and source
archive restore. It did not produce a signed release APK or test a real bank.

After local cleanup, 151 Node tests, lint, format, typecheck, environment
checks, web production build, Android export, HTTP smoke, canary scan of 48
public asset files, backup preflight and SQL converter tests passed. The HTTP
smoke needed permission to bind local loopback; its first sandboxed attempt
returned `EPERM`, and the permitted retry passed. The first canary scan lacked
its required synthetic values; the configured retry passed.

Migration `20261025181628_donor_staff_corrections.sql` was applied to the
isolated development project. The expanded rollback-only monthly contribution
fixture passed after test-data and private-table assertion corrections. The
final hosted check found zero donors, donor events, app users and Auth users;
anonymous EXECUTE is denied for the new staff opt-out RPC. This is not a
staging or production acceptance result.
