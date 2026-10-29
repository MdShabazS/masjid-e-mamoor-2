# Combined private-bucket recovery — 25 October 2026

The app currently defines two private Supabase Storage buckets: `qr-private` and `finance-reports-private`. `backend/scripts/private_objects.mjs` now captures every recognized object in both buckets into one encrypted database-plus-object archive. It recursively lists folders, checks the exact private bucket set, validates path shape and per-object size, downloads and hashes every byte, and compares the inventory again before packaging. A new or unrecognized private bucket/path makes the job fail instead of silently omitting its files. The archive uses the existing CMS encryption and HMAC verifier.

`replay` defaults to a dry run. It validates the manifest and every extracted file, rejects unexpected target objects or mismatched existing bytes, and uploads only missing objects with `upsert: false`. Applying replay requires `PRIVATE_OBJECT_REPLAY_ENABLED=true` and `--confirm-target` matching `SUPABASE_URL`. The existing QR-only and ready-report-only tools remain available for narrower recovery.

## Disposable local evidence

The separate local fresh Supabase stack initially had `0|0|0|0` Auth users/report artifacts/QR versions/Storage objects. `FRESH_BUILD_TEST_DATABASE_CONFIRM=disposable node backend/scripts/private_objects_drill.mjs` uploaded one synthetic QR and one synthetic PDF, captured both with a real custom-format `pg_dump`, built and verified an encrypted archive, deleted both objects, inspected a dry-run replay, applied replay, checked exact bytes and an idempotent retry, then removed both objects. Final counts were again `0|0|0|0`. Four focused unit tests cover both-bucket capture/replay, unknown buckets/paths, extra or corrupt target bytes, corrupt archive bytes and invalid manifests.

The test exercised local Storage and archive handling. It did **not** restore the database dump into a clean target, prove a write-consistent database/Storage snapshot, test a hosted/staging project, schedule daily capture, copy encrypted archives offsite, or set retention and alerts. Those remain release gates. Do not treat a standalone `pg_dump` followed by live object capture as a consistent backup while writes continue. A named operator must coordinate a write pause or equivalent snapshot procedure and separately test clean-target DB restore plus object replay before production use.

The full 147-test Node suite, Python archive test, lint, typecheck and formatting check passed. The disposable Supabase stack and the Colima runtime started for this drill were stopped after cleanup.

## 29 October size preflight

Private-object capture now checks a downloaded Blob's reported size before making a second in-memory copy. Replay checks an extracted file's `lstat` size before `readFile`. The existing byte-length and SHA-256 checks still run after reading. A focused test proves an oversized remote Blob's `arrayBuffer()` is never called and a sparse oversized archive file is refused before loading. All 169 Node tests, focused lint and formatting pass. Supabase's download implementation may itself buffer a response before returning a Blob, so this is a local copy guard, not a streaming or write-consistent hosted backup. The hosted capture/clean restore, offsite schedule, retention and alerts remain open.

## 29 October same-path mutation guard

After downloading the initial inventory, combined capture now re-downloads every private object with `cache: no-store` and compares its byte count and SHA-256 with the saved copy. It then rechecks the path inventory. A same-path overwrite during capture therefore fails the backup instead of silently packaging an earlier version. The failed capture removes its partial plaintext directory. A focused test mutates a synthetic report after its first download and proves failure and cleanup. The full **173/173** Node suite, Python archive test, lint, typecheck and formatting pass.

This doubles object-download traffic during capture. It cannot establish a single transaction across Postgres and Storage, nor prevent a write after the final check. The operator must still coordinate a write pause or an equivalent documented snapshot, then restore a database dump and both private buckets to a clean authorized target. Hosted capture, measured restore, offsite copy, scheduling, retention and alerts remain open.

## Operator outline for an authorized isolated target

1. Capture a verified custom-format database dump and coordinate a stable Storage capture window. Hold the recovery certificate, private key and random MAC key in approved custody outside the repository.
2. With service credentials in the maintenance process and `PRIVATE_OBJECT_BACKUP_ENABLED=true`, run `node backend/scripts/private_objects.mjs backup --dump <database.dump> --certificate <recovery.pem> --mac-key <mac.key> --output <new-private.cms>`.
3. Verify/decrypt with `python3 backend/backup/archive.py verify --archive <private.cms> --certificate <recovery.pem> --private-key <recovery.key> --mac-key <mac.key> --staging <empty-directory>`. Keep the archive and `.sha256`/`.hmac` sidecars together; keep keys separately.
4. Restore the database to a clean authorized target using the reviewed restore procedure. Point maintenance credentials at that exact target. Run `node backend/scripts/private_objects.mjs replay --staging <verified-directory>` and inspect counts. If approved, set `PRIVATE_OBJECT_REPLAY_ENABLED=true` and rerun with `--apply --confirm-target "$SUPABASE_URL"`.
5. Check DB/Storage referential integrity, hashes, authorized and denied reads, recovery time and cleanup of extracted plaintext. Disable the two flags after the drill.
