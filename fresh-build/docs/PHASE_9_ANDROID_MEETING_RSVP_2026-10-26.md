# Android meeting invitations — 26 October 2026

The signed-in Android screen now lists only meetings returned by `list_visible_committee_meetings`: meetings created by this actor or addressed to this actor. An invitee can accept or decline a still-active, future meeting; a decline reason is optional. The action calls `respond_committee_meeting` with a stable operation ID on a same-input retry. A saved response stays visible if the follow-up list refresh fails. Meeting times render in India time.

This adds invitation participation only. No Android location check-in, attendance mark, private memo image, meeting edit or push reminder is enabled by this client change. Those features require the confirmed site, policy and field evidence in the Phase 9 task list. The existing database function validates the invitation owner, active status and start time and denies direct table access to clients.

Verification: 160 Node tests, lint, typecheck, format and Android bundle export passed. The existing Phase 9 rollback-only SQL fixture and hosted role-denial matrix cover the protected meeting RPCs. A signed-in Android device journey and staging RSVP/retry test remain open.
