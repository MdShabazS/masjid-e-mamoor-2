# Phase 10 checkpoint — 15 October 2026

## Built in the fresh worktree

- `backend/supabase/migrations/20261015144000_public_content_member_inbox.sql` creates text-only community posts, immutable create/publish/archive event history, scheduled public and member projections, and per-member inbox rows. P/VP/Secretary/data-entry can create drafts and publish or archive with an expected revision. Direct table privileges are revoked and RLS is enabled.
- Anonymous readers can call only the public projection, which filters audience, published status, start and expiry time. Authenticated active actors can read the member projection and only their own inbox. A service-only queue inserts member post notifications once per active user and revision; it does not send push or WhatsApp.
- The public home and `/announcements` route render published notices from the narrow RPC. They render an empty or unavailable state and no unapproved address. The authenticated `/inbox` route loads the actor's notices, refreshes and records read state through role checked RPCs. React renders body as text, preserving line breaks without injecting HTML.
- `backend/tests/phase10_content.sql` is a planned database fixture for anon/member visibility, service queue dedupe and role denial; it has **not** run without a development database.

## Still needed

- Obtain approved address, logo, photos, public contact and privacy/support copy; implement file validation and scoped media publication. Do not invent or display those facts before approval.
- Add editorial revisions with deliberate audience changes and re-notification policy; build publisher UI with accessible preview, scheduling and expiry controls.
- Add public privacy/support and verified receipt/APK routes only when their Phase 1, 7 and release gates are met. Do not expose a live receipt lookup before privacy approval and rate limiting.
- Add member directory and audited self-contact edit, approved combined performance display, Android navigation/inbox, device push registration and durable delivery worker. Verify direct URLs, signed-out and inactive users, expiry at request time, small screens and keyboard/screen reader behavior.
- Execute fresh migrations and SQL fixtures on an isolated Supabase project, then test anonymous direct REST/RPC denial and multi-session delivery/reconnect behavior. Web build and local domain tests do not prove the database migration.

**Phase 10 remains incomplete.** This is an initial public-content and member-inbox slice, not a production-ready site.
