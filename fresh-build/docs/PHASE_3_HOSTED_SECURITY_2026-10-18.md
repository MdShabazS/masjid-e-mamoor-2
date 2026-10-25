# Hosted role and private Storage continuation — 18 October 2026

## Target and scope

The isolated free-plan Mumbai development project `necattvpncnsrfcrwpjn` was used. No masjid or production data was loaded. Eight synthetic Auth Admin users were created, one for each application role, and each signed in through hosted Auth to obtain a distinct issued session. This exercise checked the Data API and private Storage boundary; it did not complete all application journeys or release acceptance IDs.

## Checks completed

- The eight role sessions passed 48 direct API checks covering role resolution, scoped roster/finance/task/prayer reads, and direct table denial. The tests did not reuse one token while changing its database role.
- A 68-byte PNG was uploaded to `qr-private` with trusted service access. Trusted download matched the original bytes. Anonymous, member and public-URL reads, and anonymous upload, were denied.
- The expanded rollback-only `backend/tests/security_catalog.sql` passed on the hosted project. It checks 82 public `SECURITY DEFINER` functions (one anonymously executable and 64 authenticated), pinned `pg_catalog` search paths, visible actor/session guards, private helper grants, no public definer dynamic SQL or user metadata use, and RLS/direct DML denial on public base tables. This is a drift guard, not a proof of each function's behavior.
- The current public-post function has explicit public audience, published status and time-window filters. The 11 private definer helpers are not directly executable by anon/authenticated roles and have pinned search paths. The catalog check asserts these properties.
- Security advisors still report 48 RLS tables with no policies, consistent with RPC-only access; the one anonymous and 64 authenticated definer notices need continued review as migrations change. Performance advisors report 64 unindexed foreign keys and two unused indexes. Index work should follow representative query plans and traffic, since blanket indexing adds write cost.

## Cleanup and evidence limits

The first Auth Admin deletion attempt returned HTTP 500 because `app_users` and `username_aliases` have restrictive foreign keys. The eight exact synthetic aliases and app profiles were removed first; then all eight Auth Admin deletes returned HTTP 200. The Storage API removed the exact test object with HTTP 200. A final hosted query returned `0|0|0|0|0|0` for Auth users, Auth sessions, app users, username aliases, Storage objects and finance audit rows. The temporary local credentials file was deleted. No synthetic hosted data remains.

The session checks were API-level read/denial samples, not the full RPC/service authorization matrix. Still open: independent-session finance and task races, full private QR and bill lifecycle, web/Android signed-in journeys on hosted development, staging repetition, measured query plans, and release acceptance.
