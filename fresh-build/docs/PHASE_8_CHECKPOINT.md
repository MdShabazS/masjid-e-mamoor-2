# Phase 8 checkpoint — 15 October 2026

## Built in the fresh worktree

- `backend/supabase/migrations/20261015142000_work_tasks_capacity.sql` drafts P/VP/Secretary task creation with direct, open and mixed capacity; optional date/location; invitations; member acceptance or volunteering; withdrawals and declines; FIFO promotion; completion submission; creator review or return; creator cancellation; visible task and creator participant read projections; and own verified task count.
- Every membership transition locks the task row before checking total and source cap. Waitlist order is a database sequence. Only active eligible members can join or be promoted. Creator participation is denied to avoid self-awarded completions.
- Operation IDs are recorded with actor/action/payload and original result. Replays are accepted only for the same command, even if the member's current status has changed. Direct table access is revoked and RLS enabled.
- `packages/tasks` holds independent state rules and tests. `backend/tests/phase8_tasks.sql` is a database fixture for direct privilege denial, overall/source capacity, FIFO promotion and the creator review boundary.

## Verification and remaining work

- The pure tests run with `npm test`; SQL has **not** been applied or executed because no isolated development database is provisioned. Run the fixture with actual database roles, then add independent sessions racing for the final slot and promotion.
- Add durable notification outbox for invitations, promotions, completion and review; a status refetch remains authoritative when delivery fails. Creator cancellation should update in-app status without outbound cancellation message.
- Build Android and web task drafts/forms, invitations, queues, detail/history and accessible status. Add date filters, per-member assigned/accepted/completed/verified counts, meeting/referral contributions and approved combined indicator wording.
- Define task correction/appeal history and point reversal explicitly. The current verified count excludes cancelled tasks, so a cancellation removes their displayed task point; audit operations retain the prior acceptance.
- Test creator deactivation, stale invitations, duplicate operations after intervening transitions, member deactivation while waitlisted, pagination, unauthorized IDs and client reconnect behavior in a live environment.

**Phase 8 remains incomplete.** This is reviewable backend and domain source, not a live task application.
