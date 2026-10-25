# Phase 5 QR orphan inventory — 19 October 2026

`backend/ops/qr_orphan_inventory.sql` is a read-only operator query for the private QR bucket. It reports rows older than 24 hours in three categories:

- `unregistered_object`: a stored image with no verified asset record.
- `registered_without_version`: a verified image never attached to a QR version.
- `registered_missing_object`: a verified asset record whose private image is missing. This is an integrity problem, not a deletion candidate.

The query executed successfully on the isolated hosted development project and returned zero rows. It did not create, change or remove data. Historical QR versions remain referenced and therefore are not listed for deletion.

This inventory does **not** complete automatic cleanup. Uploads can be retried under the same operation ID, and a concurrent activation may use a recently staged image. An operator must inspect candidates against retry activity before any removal. If removal is eventually approved, use the Supabase Storage API, not a SQL deletion from `storage.objects`; Supabase documents that SQL deletion leaves the underlying object orphaned. A race-safe cleanup workflow and a restore drill remain release gates.

Reference: [Supabase Storage object deletion](https://supabase.com/docs/guides/storage/management/delete-objects).
