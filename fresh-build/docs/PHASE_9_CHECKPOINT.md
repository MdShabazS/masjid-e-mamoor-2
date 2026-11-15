# Phase 9 checkpoint — 15 October 2026

## Built in the fresh worktree

- `backend/supabase/migrations/20261015143000_meetings_invites_reminders.sql` drafts P/VP/Secretary/data-entry meeting creation, creator invitations, own RSVP or optional decline reason, creator cancellation, scoped meeting list, immutable operation history and one-hour reminder queue. Direct table access is revoked and RLS is enabled. The queue is restricted to `service_role`; a delivery worker must recheck current invite and meeting state immediately before sending.
- `backend/supabase/migrations/20261015143100_hafiz_prayer_history.sql` drafts the five separate India-local date slots. P/VP/Secretary/Treasurer explicitly attest that prayer occurred before marking Present/Absent. Corrections append old/new value, actor and time; the current slot is revised in place. No prayer schedule is invented.
- `packages/meetings` checks role, one-hour window, India-local day, fresh foreground evidence, accuracy, 100 m distance, mock flag, and after-day finalization eligibility. These local checks are **not** server proof that device coordinates are genuine.
- `backend/tests/phase9_meetings.sql` is a database fixture for invited-only RSVP, declined reminder exclusion, role denial and prayer correction history. It has not run.

## Release gates and remaining work

- The exact masjid center has not been confirmed. No center value is seeded, no attendance-posting RPC exists, and physical check-in cannot be used. Obtain a confirmed coordinate with owner/site verification, assess location spoofing, then perform a field test at the 100 m boundary with fresh foreground fixes and denied/poor accuracy cases.
- Add a private memo image upload and read contract with verified file type, size and object permissions; meeting edits and versioned invitation changes remain unbuilt.
- Build a delivery worker with consent/template validation, a final state recheck and deduplicated in-app/authorized WhatsApp sends. A queued record is not a delivered reminder.
- Add onsite organizer proof, invitee check-in, end-of-day roster finalization and data-entry fallback that cannot create presence. Absence messages need a unique outbox entry; no premature absence may be recorded.
- Build web and Android screens, event history/profile projections and live SQL role/race/replay tests. Local tests do not validate Supabase migrations.

**Phase 9 remains incomplete.** Meeting and prayer source can be reviewed, while onsite attendance remains disabled.
