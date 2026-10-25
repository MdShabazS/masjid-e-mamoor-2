# Phase 7 report artifact claim, expiry and load proof — 21 October 2026

## Scope

This is a disposable local verification of the existing leased report worker. No production worker setting or migration changed. The database claim uses `FOR UPDATE SKIP LOCKED`, which [PostgreSQL documents for queue-like consumers](https://www.postgresql.org/docs/current/sql-select.html). The test asserts the actual claim outcomes rather than relying on that mechanism alone.

## Independent database sessions

`backend/scripts/phase7_artifact_claim_load.py` requires an empty local fresh-build database and `FRESH_BUILD_TEST_DATABASE_CONFIRM=disposable`. It inserts one synthetic President reference and 64 empty snapshot runs (128 CSV/PDF work items), then opens eight separate `psql` sessions at once. Each session holds its transaction briefly after claiming one item.

- All eight sessions returned distinct run/format pairs; eight rows were in `processing` state.
- An artificially expired lease could not finish. The next claim marked it terminal `lease_expired`, retained its exact attempted path and claimed a different item. The old lease could not later change that failure.
- The remaining queue drained without starvation: 128 distinct rows for all 64 runs ended `failed` after explicit terminal fixture completion; exactly one was the expired lease. A further claim returned no work. The local 119-item drain block took 0.039 seconds; this is a single-machine observation, not a throughput guarantee.
- The script reset the database even on failure. The final reset left zero synthetic Auth users, reports, artifacts and private objects.

## Built worker route

The existing issued-session HTTP journey now requests four additional snapshots and sends eight authenticated worker ticks concurrently. All eight responses completed `ready` for distinct run/format pairs, covering both formats of every run. Separate President downloads verified the saved SHA-256 for all eight files. The prior private Storage role denial, encrypted object replay and ambiguous-upload recovery checks still passed in the same journey. Its final reset again removed synthetic data.

## Other checks and remaining gates

All 131 Node tests, 12 rollback-only SQL fixtures, lint, typecheck, formatting, environment checks and web build passed. The final source archive checksum and clean restore are recorded in `tasks.md`.

Repeat these races on isolated hosted/staging with the intended scheduler and runtime limits. Test real large PDFs, worker termination during Storage upload, delayed old-worker completion, concurrency at the configured schedule, and operational metrics before enabling real-data exports. Named privacy/publication approval, report accessibility and full finance-source coverage remain open.
