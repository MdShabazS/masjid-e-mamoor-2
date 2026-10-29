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

## 29 October staging and production-candidate advisor readback

Read-only advisor checks on staging `mjcuxvcmebmhvqqzcshm` and the isolated production candidate `ifyluztozjetusholoaw` returned the same security counts: 59 [RLS enabled without policy](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) INFO notices, one [anon-executable definer](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable) WARN, and 80 [authenticated-executable definers](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable) WARN. The anon function remains the intentionally public, filtered `list_published_community_posts(integer)`; the current SQL catalog fixture asserts 107 total public definers, the exact one/80 grants, pinned search paths, sampled guards and direct-table denials. These checks do not prove every RPC's data projection or consent policy, so authorization review remains open.

Performance checks returned 70 [unindexed foreign keys](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys) INFO notices in each project, and [unused indexes](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index) INFO notices of three in staging and four in the production candidate. No index change is justified from an empty synthetic database alone; measure the affected queries after representative safe traffic. These are newer counts than the 18 October development snapshot above.
