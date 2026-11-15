# Phase 12 checkpoint — offline submissions started

## Implemented locally

- Android now has a secure, actor-scoped draft queue for **one-time donation submissions, expense requests and new work tasks**. Each saves a stable UUID and exact integer paise (where relevant). It keeps at most 20 drafts per signed-in account. Approval, payment posting, verification, receipt issuance, restore and GPS attendance have no offline draft path.
- The Android panel can save a draft without connectivity and sync manually or on foreground return; while active it retries every 60 seconds. It retains uncertain/network results, labels server operation conflicts and rejected inputs, and submits using the existing idempotent SQL command's original operation ID. A different signed-in account cannot replay another account's draft.
- The JavaScript tests cover restart, uncertain network result, stable IDs, cross-account blocking, conflict state and the permitted RPC mapping. This is a local/unit and Metro export check, not a physical-device or real database test.

## Remaining work and boundaries

1. Install on an actual Android device; test airplane mode, app kill, logout/account switch, upgrade, Keystore loss, storage limit, permission/role changes and reconnect while foreground. The draft stays on this device; SecureStore data is not a recoverable backup after uninstall/Keystore loss. An approval/rejection must still be performed online after the submitted record appears on the server.
2. Connect an isolated staging Supabase project and run every fresh migration, SQL role/concurrency fixture and real replay case. Confirm errors map to pending/conflict/rejected against the actual PostgREST response shape. The local environment did not have a running Docker daemon or configured staging database.
3. Design and deploy an **actual** operational backup job with a logical/physical database snapshot plus every private Storage object's bytes and metadata, encryption key custody, authenticated offsite copy, manifests, retention and alerting. Existing `backups/masjid-project-working-source-*.tar.gz` archives are **source only**. Supabase documents that its database backup contains Storage metadata but not the object bytes: https://supabase.com/docs/guides/platform/backups ; https://supabase.com/docs/guides/storage/management/download-objects
4. Implement named, currently authorized laptop restore request and server-side staging preflight. Recreate a clean database and private object set, compare hashes/references, audit the operator and cut over only after full validation. Rehearse corrupt archive, absent object, wrong Drive identity and restore failure; record elapsed recovery time and data-loss interval. Production/Drive accounts and key custodian are not configured.

`backend/backup/archive.py` now provides a local encrypted archive and strict byte/hash staging preflight, tested with a disposable certificate and corrupt/missing file cases. It expects an externally captured consistent `pg_dump -Fc` plus Storage inventory/bytes; no live capture schedule, offsite copy, `pg_restore`, operator cutover or production recovery claim exists yet. See `backend/backup/README.md`.

**Current status:** Phase 12 is **partially implemented**. Offline submissions have a local functional path, while a verified DB plus object recovery remains a release gate. Expo notes SecureStore entries cannot be decrypted from Android Auto Backup after uninstall: https://docs.expo.dev/versions/latest/sdk/securestore/
