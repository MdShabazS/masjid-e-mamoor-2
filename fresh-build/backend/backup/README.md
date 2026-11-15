# Operational backup preflight (not yet scheduled)

`archive.py` accepts a `pg_dump -Fc` custom-format dump, an inventory JSON
array of `{bucket,path,sha256,bytes}` exported from a **consistent** Storage
object snapshot, and a directory containing exactly those downloaded object
bytes under `objects/<bucket>/<path>`. The capture job that makes these inputs,
compares Storage metadata at snapshot time, runs daily, uploads offsite and
alerts on failure remains to be implemented against an isolated project.

Build an encrypted archive with a recovery recipient certificate and a
separately held random MAC key of at least 32 bytes:

```sh
python3 archive.py build --dump database.dump --inventory inventory.json \
  --objects objects --certificate recovery.pem --mac-key archive-mac.key \
  --output masjid-data.cms
```

The `.sha256` file is an accidental-corruption check. The `.hmac` file is the
authenticated archive tag; keep its secret key outside the project worktree.
Archive encryption uses CMS AES-256-CBC, and the tag authenticates the entire
encrypted byte stream. Build/verify fail on missing, extra, duplicate, unsafe
or mismatched object bytes. `verify` decrypts and checks all hashes before
extracting to an empty staging directory:

```sh
python3 archive.py verify --archive masjid-data.cms \
  --certificate recovery.pem --private-key recovery.key \
  --mac-key archive-mac.key --staging ./isolated-staging
```

The staging output is **not** a restored service. A real recovery still needs
`pg_restore` into a clean disposable database, Storage object re-upload,
Auth/Storage referential checks, operator authorization/audit and measured
cutover. Never point this tool at a production database for restore.

For the ready private PDF/CSV report bucket, `backend/scripts/report_artifact_objects.mjs`
now captures verified bytes into this archive and can replay them without
overwriting existing objects. See
`docs/PHASE_7_REPORT_OBJECT_BACKUP_REPLAY_2026-10-21.md`. It covers only ready
report artifacts; full private-bucket capture, scheduling and clean-target
database restore remain open.

For private payment QR images, `backend/scripts/qr_objects.mjs` captures the
bounded `payment-qr/` paths into the same encrypted archive and can replay
missing exact bytes without overwrite after separate database recovery. See
`docs/PHASE_5_QR_OBJECT_BACKUP_REPLAY_2026-10-25.md`. It does not cover the
other private buckets, a clean hosted database restore or an automated schedule.

For one archive covering **both current private buckets**, use
`backend/scripts/private_objects.mjs`. It inventories all objects in the QR
and finance-report buckets, including unreferenced objects with valid paths,
and refuses an unexpected private bucket or path. A disposable local encrypted
archive and exact-byte replay passed. See
`docs/PRIVATE_BUCKET_RECOVERY_2026-10-25.md`. Consistent capture across a live
database and Storage, clean-target database restore, hosted staging, offsite
copy, scheduling, retention and alerts remain open.

Local failure tests: `python3 -m unittest discover -s backend/backup -v` from
`fresh-build/`. Test certificate and key are generated in a temporary directory;
no recovery secret is committed or included in source backups.
