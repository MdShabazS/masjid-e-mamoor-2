# Private payment QR object backup and replay — 25 October 2026

## Implemented

`backend/backup/qr-objects.js` captures every `payment-qr/<uuid>.png|jpg|jpeg` object listed in the private `qr-private` bucket, up to 10,000 images. It bounds each image at 5 MiB, records its byte count and SHA-256, writes private temporary files, and rereads the path inventory before completion. Unexpected paths, duplicates, missing bytes, changed path inventory and partial captures fail closed.

`backend/scripts/qr_objects.mjs backup` adds those files and a supplied custom-format `pg_dump` to the existing encrypted, HMAC-authenticated CMS archive. `replay` defaults to a dry run. It validates the manifest, all archived bytes and every existing target object before upload; it rejects extra target paths or mismatched bytes. `--apply` needs `QR_OBJECT_REPLAY_ENABLED=true` and an exact `--confirm-target` equal to `SUPABASE_URL`. Uploads use `upsert: false`, and a partial replay can be retried only when existing bytes match.

## Operator sequence for an isolated recovery drill

1. Pause QR uploads, cleanup and database writes. Capture a custom-format database dump and private QR objects from the same authorized environment. Keep database credentials out of command arguments and logs; use a trusted encrypted maintenance filesystem.
2. With the service key only in the maintenance process, set `QR_OBJECT_BACKUP_ENABLED=true` and run `node backend/scripts/qr_objects.mjs backup --dump <database.dump> --certificate <recovery.pem> --mac-key <mac.key> --output <new-qr.cms>`. Keep `.cms`, `.sha256` and `.hmac` together; hold the recovery private key and MAC key separately.
3. On a clean authorized target, verify and extract with `python3 backend/backup/archive.py verify --archive <qr.cms> --certificate <recovery.pem> --private-key <recovery.key> --mac-key <mac.key> --staging <empty-directory>`. Restore and check the database separately before QR object replay.
4. Run `node backend/scripts/qr_objects.mjs replay --staging <verified-directory>` for the dry run. Then set `QR_OBJECT_REPLAY_ENABLED=true` and repeat with `--apply --confirm-target "$SUPABASE_URL"`. Check the President/Treasurer private QR read and exact digest, confirm untrusted reads are denied, disable both flags, and securely remove extracted plaintext.

## Verification

Five new Node tests passed for exact capture/replay, malformed paths and manifests, archive tampering, existing target mismatch, extra objects, symlinks and CLI guards. The complete 142 Node tests, lint, typecheck and formatting checks passed. A disposable local Supabase journey used a real custom-format dump, three versioned private QR images, a temporary recovery certificate and MAC key, CMS archive verification, deletion of one image through the Storage API, dry-run preview, no-overwrite replay, exact Treasurer HTTP readback and Member direct-read denial. The final reset left Auth users, QR versions, QR assets, cleanup claims and Storage objects at `0|0|0|0|0`; the temporary archive and keys were removed.

This is a **local QR-bucket drill**, not a complete operational backup. Capture and database dump are not one transaction; a quiet window is required. It has not restored the database into a clean hosted target, nor covered bills, meeting media, reports, receipts, daily scheduling, offsite retention or alerts. Separate staging and production recovery, Board approval and official payment details remain launch gates. Supabase documents that a [database backup does not contain Storage object bytes](https://supabase.com/docs/guides/platform/backups) and that objects must be [managed through the Storage API](https://supabase.com/docs/guides/storage/management/delete-objects).
