# Fresh backend

This backend uses its own Supabase `config.toml` and 31 ordered migrations in
`supabase/migrations/`. The older root `supabase/` tree is preserved in Git history
and must never be applied to this project. The ordered migration tree is the
only executable schema source; the initial prototype is retained in Git history.

The isolated hosted development project has applied all 31 migrations. Its
expanded monthly-contribution rollback fixture passed after migration 31;
the local disposable stack needs a clean repeat at this version. Earlier
database checks used real PostgreSQL roles. Eight distinct issued sessions passed 48 direct API
role/read checks and 288 wrong-role calls across 65 guarded RPCs locally and on
hosted development. Local expiry, role change and deactivation, and hosted
President/Treasurer finance and independent-session task races also pass. These are development checks;
staging, production, signed-in client journeys and recovery remain open.

For exact local start, fixture, reset, source backup and environment custody
instructions, see `../docs/PHASE_0_LOCAL_OPERATIONS_2026-10-17.md`. For
observed database and money results, see
`../docs/PHASE_3_DATABASE_EXECUTION_2026-10-16.md` and
`../docs/PHASE_4_EXECUTION_2026-10-17.md`.

Owner-dependent donor enrollment remains server-only and inactive until an
approved consent version exists. No public report/PDF or message dispatch is
enabled merely by applying these migrations. The source archive is not a
database or private-object backup.
