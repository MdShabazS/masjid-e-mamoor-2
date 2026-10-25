# Hosted development migration catch-up — 23 October 2026

The isolated Supabase development project `masjid-e-mamoor-2-dev-20261016` (`necattvpncnsrfcrwpjn`) had 20 applied migrations and zero Auth users, sessions, app users, finance effects and Storage objects before this run. Its public tables were listed and the security advisor was inspected before schema changes.

Applied these seven local migrations in order through the Supabase migration tool:

1. `20261021060845_report_metadata_service_read.sql`
2. `20261021061949_public_receipt_lookup.sql`
3. `20261021111448_report_artifact_lifecycle.sql`
4. `20261021161858_report_artifact_operator_recovery.sql`
5. `20261023042818_direct_treasurer_cash_posting.sql`
6. `20261023101443_cash_collection_task_counts.sql`
7. `20261023103413_cash_collection_count_rejection.sql`

All seven returned success. Hosted migration history now has 27 entries. Supabase assigned its own hosted version numbers (`20261023155310` through `20261023155358`); names and order match the local files.

The rollback-only `identity_roles.sql`, `phase4_beneficiary_versions.sql`, `security_catalog.sql`, and `eight_role_reads.sql` fixtures succeeded via the connected SQL runner. The first attempt to run `finance_foundation.sql` there stopped on its `psql` `\gset` command before its transaction began. Nine fixtures use `psql` variables and need a direct `psql` hosted runner; no claim is made that they passed hosted. All 13 passed on the disposable local database before this run.

Post-migration counts were zero for Auth users, Auth sessions, app users, finance effects, cash counts, slip claims and Storage objects. Security advisor notices: 56 intentional no-policy RLS tables, one anonymous public-content definer, and 75 authenticated definer RPCs requiring continued function-by-function authorization review. Performance advisor notices: 69 unindexed foreign keys and three unused indexes. [Security advisor guidance](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable) and [foreign-key index guidance](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys) describe the notices; these counts are observations, not a clearance for production.

The project still has no real data. Hosted issued-session business outcomes for these seven migrations, the nine direct-`psql` fixtures, staging/production migration and restore, owner policy approval and release acceptance remain open.
