# Phase 7 report-object backup and replay — 21 October 2026

## Implemented

- `backend/backup/report-objects.js` captures up to 10,000 **ready** PDF/CSV artifacts from the private report bucket. It validates each database path, byte count and SHA-256, downloads exact bytes, and rereads the ready-artifact inventory to catch a changed snapshot. A failed capture removes its partial plaintext directory.
- `backend/scripts/report_artifact_objects.mjs backup` places the captured objects and a supplied custom-format `pg_dump` in the existing authenticated CMS archive. Its temporary plaintext capture is removed when the command exits. It requires the server-only service key and `REPORT_ARTIFACT_BACKUP_ENABLED=true`. The output, checksum and HMAC sidecars must not already exist.
- The same CLI's `replay` action defaults to inspection. It compares the verified archive manifest with the target's ready records, checks every local byte and existing remote byte before uploading, and refuses changed metadata, symlinks and mismatched existing objects. `--apply` requires `REPORT_ARTIFACT_REPLAY_ENABLED=true` and an exact `--confirm-target` matching `SUPABASE_URL`; uploads use `upsert: false`. A partial replay can be rerun after investigation because matching existing objects are accepted.

## Operator sequence for an isolated recovery drill

1. Pause artifact generation and report/finance writes while taking the database dump and report-object capture. Use a trusted, encrypted maintenance filesystem and separately held recovery certificate and MAC key. Generate a custom-format `pg_dump` from the same environment; keep database credentials out of command arguments and logs.
2. Set `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` and `REPORT_ARTIFACT_BACKUP_ENABLED=true` only in the maintenance process. Run `node backend/scripts/report_artifact_objects.mjs backup --dump <database.dump> --certificate <recovery.pem> --mac-key <mac.key> --output <new-report.cms>`. Keep the `.cms`, `.sha256` and `.hmac` files together; hold the certificate's private key and MAC key separately.
3. On a clean authorized recovery target, verify and extract with `python3 backend/backup/archive.py verify --archive <report.cms> --certificate <recovery.pem> --private-key <recovery.key> --mac-key <mac.key> --staging <empty-directory>`. Restore and validate the database using the separate database recovery runbook before object replay.
4. Point the maintenance client at that target. Run `node backend/scripts/report_artifact_objects.mjs replay --staging <verified-directory>` for a dry-run count. Then set `REPORT_ARTIFACT_REPLAY_ENABLED=true` and run the same command with `--apply --confirm-target "$SUPABASE_URL"`. Verify the authorized CSV/PDF downloads and hashes, then disable both flags and securely dispose of the extracted plaintext staging files.

This captures only ready report artifacts. It does not back up QR, bill, media or orphaned Storage objects, nor does it create a daily schedule, offsite copy or retention policy. The double inventory read does not provide a database/Storage transaction; production capture needs a quiet window and a clean-target restore drill. [Supabase documents that Storage file metadata and bytes are separate](https://supabase.com/docs/guides/storage/management/download-objects), and its [backup/restore guide](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore) covers the broader database and Storage migration.

## Verification

- 131 Node tests passed, including corrupted capture, metadata drift, tampered archive bytes, wrong existing object, symlink and CLI guard cases. The existing Python CMS archive test, lint, typecheck, format, environment checks and web build passed.
- The disposable local built HTTP journey used separate issued President/Treasurer/Member sessions. Two generated private files were captured with an actual custom-format database dump, encrypted, authenticated and extracted. After both objects were removed, replay preview found two missing; apply uploaded two exact paths without overwrite. Authorized HTTP download hashes matched after replay, and direct Member Storage read was denied. The later ambiguous-orphan recovery journey also passed.
- The final reset left zero Auth users/sessions, app users, report runs/artifacts/recoveries and Storage objects. The temporary test archive and its keys were deleted.

## Remaining release gates

Repeat on isolated hosted/staging with approved credentials and a clean target, then prove the full encrypted database plus **all** private buckets backup, offsite retention, alerts and timed restore. The report worker schedule, concurrency/expiry/load tests, PDF accessibility, complete finance-source coverage and masjid publication approval remain open.
