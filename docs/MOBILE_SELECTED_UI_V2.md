# Masjid E Mamoor 2 — Selected Mobile UI V2

## Status

This document is the canonical implementation target for the next mobile UI pass.

The selected visual mockup shown to the product owner is now the source of truth for the mobile experience.

Do not recreate the previous plain institutional list-heavy Home screen.

The application must remain secure, capability-driven, auditable and backed by real data.

---

# 1. Core objective

Build a modern, easy-to-use, role-aware mobile dashboard matching the selected mockup.

Visual characteristics:

- clean modern sans-serif typography
- no handwritten/device-theme typography
- warm off-white background
- Masjid emerald as primary brand color
- spacious layout
- large rounded cards
- soft borders and restrained shadows
- colored semantic sections
- large tap targets
- clear icons
- compact readable text
- important actions visible without entering several screens
- 3–5 bottom navigation destinations only
- role/capability-specific navigation
- secondary modules under Quick Access / More
- notification bell with unread badge

The real application must visually resemble the selected mockup, not merely use the same information.

---

# 2. Selected Home layout

Order:

1. Brand header
2. Needs your attention
3. Assigned to you
4. Open tasks when available
5. Next meeting
6. Recent notifications
7. Quick access
8. Overview
9. Bottom navigation

The Home screen must not begin with a giant account/username card.

User identity may appear subtly in the header or greeting.

---

# 3. Header

Use:

Masjid E Mamoor 2
Assalamu Alaikum, <display name when available>

Left:
- simple mosque/brand mark

Right:
- notification bell
- red unread-count badge

Avoid oversized headings.

---

# 4. Needs your attention

When actionable items exist, show a compact highlighted attention banner near the top.

Examples:

- task requiring acceptance/start
- overdue assigned task
- upcoming meeting
- finance approval
- payment verification
- referral requiring administrative action
- attendance action
- important unread notification

Copy example:

Needs your attention
2 items need your response

When there is genuinely nothing actionable, show a compact green:
All caught up

Do not use a huge empty-state card that consumes most of the first screen.

---

# 5. Task cards

## Assigned to you

Card must show:

- task title
- priority
- due date/time when available
- status
- useful source/meeting context
- primary action
- secondary action

For directly assigned work that has not started:

Primary:
Accept & start

Secondary:
Decline

Also provide:
View

Do not fake Decline.

If the backend currently lacks decline-assignment support, implement a secure audited backend workflow.

Rules:

- only the current active assignee may decline their own assignment
- completed work cannot be declined
- started work must follow an explicit safe rule rather than being silently discarded
- decline reason should be supported
- assignment/task activity must record the action
- relevant assigner/manager should receive a notification
- multiple-assignee behavior must remain correct
- concurrency must be safe
- server authorization is mandatory
- add tests

## Open tasks

Show:

Open tasks
<count>

Each preview item:
- title
- due date
- priority/location/context where relevant
- Accept task

Use the existing atomic claim-open-task workflow.

Never implement claim as an unsafe client-side read-then-write sequence.

---

# 6. Meeting cards

Next meeting must display:

- title
- date
- start time
- end time when present
- location
- meeting type where useful

Meeting location already exists in the current domain model and must be surfaced everywhere appropriate.

Example visual:

Next meeting

Management Team Meeting
Today, 7:00 PM – 8:00 PM
Conference Room

Tap opens the actual meeting detail screen.

Upcoming meeting lists should use the same presentation language.

---

# 7. Recent notifications

Show 1–3 useful unread/recent notifications.

Card contains:

- event icon
- title
- relative/reasonable timestamp
- unread indicator
- tap/deep-link behavior

Examples:

Task assigned
Meeting rescheduled
Payment verified
Referral approved
Announcement

Use the existing notification authority model.

Notifications describe authoritative state; they are not themselves authoritative state.

---

# 8. Announcements

The selected UI contains Announcements, so provide a real implementation.

Prefer extending the existing notification architecture rather than creating a second duplicate messaging system.

Recommended V1:

- support notification kind `announcement`
- dedicated Announcements view/filter
- all authorized recipients can read announcements sent to them
- accounts with `notifications.admin.manage` may publish according to their actual authorization
- allow targeted audience selection only when safely authorized
- create recipient notifications server-side
- preserve auditability and idempotency
- distribute through existing realtime notification Broadcast
- never trust the client to impersonate administrative announcements

Do not grant `notifications.admin.manage` based solely on a UI role assumption.

Use actual permission resolution.

---

# 9. Quick access

Use visual square/rounded icon tiles similar to the selected mockup.

Do not show the same Quick Access options to every role.

Examples may include:

Members
Tasks
Meetings
Announcements
Donations
Payments
Finance
Expenses
Transfers
Reports
Accounts
Referrals
Profile

Only show a destination when the current capability set authorizes it.

---

# 10. Overview

Use compact metrics, not large vertical list rows.

Examples:

Assigned
Open tasks
Meetings
Unread

Role-specific alternatives:

Finance:
Pending payments
Expenses
Transfers
Accounts

President:
Pending actions
Members
Work
Finance

Member:
Outstanding
Payments
Unread
Referrals

Metric values must come from real data.

---

# 11. Role-aware experience

Authorization remains capability-driven.

Role may determine presentation priority, but must never bypass capability checks.

## President

Primary concern:
organization oversight.

Prioritize:

- attention requiring presidential action
- committee work
- meetings
- membership/referrals
- financial overview if authorized
- administrative notifications

Suggested bottom nav when capabilities support it:

Home
Tasks/Work
Meetings
Community
More

or substitute Finance for a lower-priority destination when Finance is one of the account's primary capabilities.

## system_admin

This is an emergency/system role.

Do NOT automatically grant Board/committee access merely because role = system_admin.

Navigation must be built from actual resolved capabilities.

Prioritize:

- account administration
- system/access state
- modules actually granted

## Vice President

Prioritize:

- committee work
- meetings
- members
- attendance
- permitted oversight/approvals
- notifications

When both task and meeting access exist:

Home
Tasks
Meetings
Community
More

## Secretary

Prioritize:

- tasks
- meetings
- members
- referrals
- committee administration
- attendance
- announcements/notifications

Preferred:

Home
Tasks
Meetings
Community
More

## Finance

Prioritize:

- pending payment verification
- donations
- accounts
- transactions
- expenses
- transfers
- reconciliation/reports
- assigned committee tasks if present

Suggested:

Home
Donations
Finance
Work when assigned/authorized
More

Never grant task assignment capability to Finance merely for navigation.

## Auditor

Read/oversight oriented.

Prioritize:

- finance overview
- reconciliation
- transactions
- reports
- audit information
- authorized read-only committee data

Avoid prominent mutation buttons when role is read-only.

Suggested:

Home
Finance
Notifications or authorized Work
More

## Committee Member

Prioritize:

- assigned tasks
- open volunteer tasks
- meetings
- attendance workflows
- notifications

Do not expose a broad member directory.

Preferred:

Home
Tasks
Meetings
Notifications
More/Profile

## Member

Prioritize personal workflows:

- own donation obligations
- payment status/history
- receipts
- own notifications
- own referrals when available
- profile

Suggested:

Home
Donations
Notifications
Profile

Do not show administrative cards.

---

# 12. Bottom navigation

On phones, use 3–5 primary destinations.

The set must be generated from resolved capabilities.

Rules:

- Home always first
- 3–5 destinations max
- highest-frequency role workflows get tabs
- More contains secondary authorized destinations
- never display unauthorized route
- notification bell remains globally available even when Notifications is not a bottom tab
- Tasks and Meetings may use lightweight top-level proxy routes if needed to provide direct tabs while preserving existing nested route ownership

Do not render 6+ bottom tabs.

---

# 13. Typography

Current Android screenshots inherit a device font that visually differs from the selected UI.

Make typography deterministic inside the app.

Use a clean modern sans-serif.

Prefer the lowest-risk implementation:

- explicit Android generic sans-serif families where sufficient, or
- a properly bundled permissive font through Expo if necessary

No handwritten/decorative font.

Ensure all weights render consistently.

---

# 14. Visual tokens

Target approximately:

Page background:
warm neutral / ivory

Primary:
deep emerald

Primary action:
clean emerald/green

Danger/urgent:
red

Assigned/tasks section:
very pale blue

Meetings:
very pale lavender

Notifications:
very pale warm amber

Quick access:
very pale mint

Overview:
very pale blue/gray

Cards:
16–20 px visual radius

Controls:
10–14 px visual radius

Touch targets:
minimum 44–48 px

Shadows:
subtle only

Avoid excessive gold.

Gold may remain a restrained brand accent.

---

# 15. Realtime architecture

Goal:
very low perceived delay without unsafe client state.

PostgreSQL remains authoritative.

Use Supabase Realtime Broadcast as the preferred realtime propagation mechanism.

Existing notification Broadcast architecture should be reused/extended.

Do not add polling as the primary mechanism.

Target domains:

- notifications
- committee tasks
- task assignment/status
- meetings
- meeting changes
- attendance when relevant
- donations/payment state
- finance state shown on dashboards
- referral/member administrative state shown on dashboards

Use private authorized channels.

Realtime payload should normally be a small invalidation hint:

- domain
- entity id
- event
- relevant scope/topic

Do not broadcast unnecessary sensitive record contents.

On event:

event
-> identify React Query keys
-> invalidate/refetch authoritative state
-> render

Use local mutation invalidation immediately.

Use optimistic UI only where rollback semantics are safe.

On reconnect / foreground:
reconcile authoritative queries.

Remove channels on cleanup.

Do not leak events across role/data scope boundaries.

---

# 16. Realtime performance target

Use a short coalescing/debounce window, approximately 100–250 ms where appropriate.

Avoid chains of sequential network calls where independent calls can run concurrently.

Avoid unnecessary full dashboard refetches.

Invalidate only affected query families where possible.

The experience should feel effectively immediate on a normal good connection.

A concrete engineering target is:

- local mutation response feels immediate
- realtime invalidation begins within ~100–250 ms after receipt
- affected card normally reconciles within ~500 ms on a healthy connection

This is a target, not a guaranteed network SLA.

---

# 17. React Query

Keep server data in React Query.

Required:

- stable domain query keys
- targeted invalidation
- foreground refresh
- reconnect recovery
- mutation invalidation
- avoid duplicate fetching
- preserve prior data during background refresh where appropriate
- no giant page-loading spinner after first successful data load

---

# 18. Existing functionality that must remain working

Do not regress:

- authentication
- forced password change
- account administration
- members
- referrals
- donations
- payment proof
- Finance workflows
- tasks
- open task claim
- task start/progress/complete
- meetings
- meeting location
- meeting decisions
- follow-up tasks
- meeting attendance
- notifications
- notification deep links
- secure role/capability boundaries
- Supabase RLS
- audit behavior
- production build configuration

---

# 19. Security requirements

Never use UI visibility as authorization.

All new mutations require server-side authorization.

Preserve:

- RLS
- permission checks
- assignment scope
- member privacy
- Finance maker/checker controls
- audit records
- idempotent operation IDs
- concurrency safety

No service-role credential in mobile code.

---

# 20. Testing requirements

Add/adjust tests covering at minimum:

- each role/capability navigation model
- no unauthorized tab leakage
- President
- system_admin capability boundary
- Vice President
- Secretary
- Finance
- Auditor
- Committee Member
- Member
- attention priority
- assigned task action
- open task claim
- decline assignment if added
- next meeting date/time/location
- notification badge
- recent notification
- announcement
- More screen capability filtering
- realtime invalidation
- realtime reconnect
- channel cleanup
- duplicate realtime events
- query invalidation scope
- loading/error/empty states

Existing tests remain green.

---

# 21. Performance / UX constraints

No giant Home payload if the user lacks those capabilities.

Do not fetch unauthorized or irrelevant Home data.

Fetch independent dashboard resources concurrently.

Keep initial Home interactive quickly.

Use compact previews and navigate to full lists.

Avoid unnecessary animations.

No layout shift caused by late capability resolution where it can reasonably be avoided.

---

# 22. Definition of done

The phase is complete only when:

1. Home visually matches the selected UI direction.
2. Role experiences are meaningfully different.
3. Navigation is capability-safe and limited to 3–5 primary phone tabs.
4. Meeting location/date/time are visible.
5. Task actions are real.
6. Decline is real if displayed.
7. Announcements are real if displayed.
8. Notifications and relevant dashboard data update through realtime.
9. No sensitive realtime leakage exists.
10. Existing business workflows remain functional.
11. Typecheck passes.
12. Lint passes.
13. Mobile tests pass.
14. Relevant backend/Supabase tests pass.
15. No secret is introduced.
16. Changes are committed but not pushed/deployed unless explicitly requested.
