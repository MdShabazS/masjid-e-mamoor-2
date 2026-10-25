# Phase 7 private artifact operator recovery — 21 October 2026

## What changed

- Migration `20261021161858_report_artifact_operator_recovery.sql` retains the exact attempted private Storage path on a failure. An expired lease now stops at a terminal `lease_expired` state instead of automatically claiming another attempt while the old worker may still upload. The original three-attempt cap remains.
- The service-only recovery RPC accepts the expected run, format, failed path and failure code. It requires a terminal failed row with no live lease, refuses to requeue while that exact Storage object exists, and records an operator note in a private audit table. Ambiguous uploads and expired leases must remain failed for at least ten minutes. A stale or repeated requeue returns false.
- `backend/scripts/recover_report_artifact.mjs` is a server-side maintenance command. It defaults to read-only inspection. `--apply` needs the separate recovery flag, an exact run/format confirmation and an operator note. It lists the private prefix, removes only the recorded attempted path if present, verifies absence and invokes the guarded RPC. It never receives credentials from a browser.

## Operator procedure

1. Use a server or maintenance shell with `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. Keep the key out of logs and browser environments. Check the affected report and any current backup before changing a real object.
2. Inspect: `node backend/scripts/recover_report_artifact.mjs --run <uuid> --format csv`. Review `failureCode`, `path`, `objectPresent` and `readyAfter`. The command refuses nonterminal or legacy failures without a retained path; those need a separate manual investigation.
3. After the cooldown, set `REPORT_ARTIFACT_RECOVERY_ENABLED=true` only in the operator shell and apply: `node backend/scripts/recover_report_artifact.mjs --run <uuid> --format csv --operator "<name and ticket>" --confirm <uuid>/csv --apply`. Use `pdf` consistently for PDF recovery. Turn the flag off afterward.
4. Run the dedicated artifact tick, then check the guarded status RPC and authorized download SHA-256. Preserve the recovery audit row. Inspect the old prefix again if a delayed old worker was suspected.

Do not manually reset the table or grant public Storage access. An upload still in flight can finish after an object inspection; the ten-minute cooldown and unique lease paths reduce this race but do not prove it impossible. Hosted concurrent/expiry/load and private-object backup/replay drills remain release gates.

## Verification

- 24 migrations applied on a reset disposable local Supabase stack. All 12 rollback-only SQL fixtures passed, including terminal recovery, stale path, duplicate recovery, audit, expired lease and role-grant checks.
- 126 Node tests, lint, typecheck, formatting, environment checks and web build passed. The CLI unit test confirms the mutation flag, exact confirmation and operator note guards.
- Built local HTTP/Storage journey used issued President, Treasurer and Member sessions. A synthetic ambiguous CSV upload left an exact private orphan. Inspection found it; premature recovery was denied; direct DB requeue was denied while the object existed; a Member could not invoke recovery; the operator path removed only that orphan, recorded one audit row and regenerated both CSV and PDF to ready. The final local reset left `0|0|0|0|0|0|0` Auth users/sessions, app users, report runs/artifacts/recoveries and Storage objects.

## Still open

Hosted/staging migration and schedule, actual private-object backup/replay, concurrent/expiry/load proof, named privacy/publication approval, PDF accessibility and complete report-source coverage. Both export and artifact-worker flags stay off for real data.
