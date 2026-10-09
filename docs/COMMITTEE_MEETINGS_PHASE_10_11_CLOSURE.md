# Committee + Meetings — Phase 10/11 Closure Contract

**Status:** IMPLEMENTED AND VERIFIED — functional backend + mobile-domain closure for Phase 10 and Phase 11
**Scope:** Committee tasks, open/volunteer claiming, overdue derivation,
meeting decisions/outcomes, meeting follow-up tasks, meeting attendance query,
and mobile meeting-notification compatibility.

This document closes implementation-level details required by the approved
Phase 10 and Phase 11 master plan without changing the existing V1 role,
permission, authorization, or audit model.

---

## 1. Existing Behavior Preserved

The existing Committee Task implementation remains authoritative for:

- direct task creation;
- direct assignment;
- task progress;
- start;
- completion;
- task activity/history;
- stable per-actor operation IDs;
- idempotent replay;
- actor/operation serialization;
- backend authorization;
- assignment-scoped Committee Member and Finance behavior.

The existing Meeting implementation remains authoritative for:

- meeting creation;
- meeting scheduling;
- meeting participant assignment;
- meeting update;
- meeting cancellation;
- meeting attendance;
- meeting activity/history;
- participant-scoped Committee Member access;
- Auditor read-only access;
- stable operation IDs;
- durable meeting lifecycle notifications.

This closure extends those contracts rather than replacing them.

---

## 2. Open / Volunteer Committee Tasks

Phase 10 requires open/volunteer tasks and single-claimant concurrency.

### 2.1 Task Modes

A Committee Task has one of two assignment modes:

- `direct`
- `open`

Existing tasks are `direct`.

A `direct` task follows the current assignment workflow.

An `open` task is created by an authorized task assigner without an initial
assignee and is available for an eligible Committee Member to claim.

### 2.2 Open Task Lifecycle

Open task lifecycle:

`open -> assigned -> in_progress -> completed`

Claiming the task performs the transition:

`open -> assigned`

and creates the authoritative active assignee relationship.

Once successfully claimed, the task is no longer available for another
claimant.

### 2.3 Who May Create Open Tasks

Open tasks may be created only by users already authorized to assign Committee
Tasks.

This preserves the existing assignment authority:

- President
- Vice President
- Secretary

No new permission is introduced.

### 2.4 Who May Claim Open Tasks

V1 self-claiming is limited to an active application user whose application
role is:

`committee_member`

This gives Committee Members the approved volunteer workflow while preserving
the current rule that Finance receives Committee Tasks only when explicitly
assigned.

President, Vice President, and Secretary retain management/assignment
authority and do not require the volunteer claim workflow.

Ordinary Members cannot view or claim Committee Tasks.

### 2.5 Single-Claimant Concurrency

Task claiming is an authoritative trusted backend operation.

The operation must:

1. authenticate the actor;
2. validate the actor is an eligible active Committee Member;
3. serialize the actor/operation ID using the existing idempotency pattern;
4. lock the target task row;
5. re-check that the task is still `open`;
6. create exactly one active assignee relationship;
7. transition the task to `assigned`;
8. append task activity;
9. return the authoritative task.

Two simultaneous claim attempts must never produce two assignees.

Exactly one claimant may win.

A losing new operation receives a stable conflict/error result.

An exact retry of the successful claimant's operation ID returns the
authoritative original result without duplicating assignment or activity.

---

## 3. Open Task Read Scope

Open tasks must be visible to:

- President;
- Vice President;
- Secretary;
- Auditor, read-only;
- eligible active Committee Members.

Finance does not receive organization-wide visibility of open tasks.

Finance continues to see only tasks assigned to that Finance account.

After an open task is claimed, normal assignment-scoped Committee Member
visibility applies.

---

## 4. Overdue Task State

`overdue` is a derived presentation/query state.

It is **not** a new authoritative task lifecycle status.

A task is overdue when:

- `due_date` is earlier than the server's current business date; and
- task status is not `completed`.

The authoritative lifecycle remains:

For direct tasks:

`assigned -> in_progress -> completed`

For open tasks:

`open -> assigned -> in_progress -> completed`

The backend/query layer may expose a derived boolean such as:

`is_overdue`

The application must not persist a separate overdue lifecycle transition that
can drift from the due date.

---

## 5. Meeting Agenda

The current Meeting `details` field is the V1 agenda/details field.

No duplicate agenda entity is required for V1.

The mobile/UI layer may label this value as `Agenda` where appropriate.

A separate structured agenda-item subsystem is outside this closure unless
later approved.

---

## 6. Meeting Decisions / Outcomes

Phase 11 requires meeting decisions and Product Requirements require relevant
notes/outcomes.

V1 uses an append-oriented Meeting Decision record.

Each decision/outcome records:

- decision ID;
- meeting ID;
- decision/outcome text;
- actor application-user ID;
- stable operation ID;
- request fingerprint;
- created timestamp.

Decision history is preserved.

V1 does not silently edit or delete a recorded decision.

If another outcome must later be recorded, it is appended as another
decision/outcome record.

No ranking, score, approval voting system, or unapproved workflow is introduced.

---

## 7. Meeting Decision Authorization

President, Vice President, and Secretary may record decisions/outcomes for
meetings within their organization-wide meeting-management scope.

A Committee Member may record a decision/outcome only when that Committee
Member is an active participant in the meeting.

Auditor remains read-only.

Finance and ordinary Member roles cannot record Meeting decisions.

Read visibility follows the existing Meeting read scope.

---

## 8. Meeting Follow-Up Tasks

Meeting follow-up uses the existing Committee Task domain.

No second task subsystem is created.

A Committee Task may carry:

- nullable source Meeting ID;
- nullable source Meeting Decision ID.

A follow-up task may therefore be traced back to:

- the Meeting generally; or
- a specific recorded Meeting decision/outcome.

### 8.1 Follow-Up Creation Authority

Creation of a Meeting follow-up task requires the existing Committee Task
assignment authority.

Therefore the trusted follow-up task creation workflow is available to:

- President;
- Vice President;
- Secretary.

A Committee Member may participate in a Meeting and record an authorized
decision/outcome but does not gain task-assignment authority from that fact.

### 8.2 Follow-Up Assignment

A Meeting follow-up task may use either:

- direct assignment; or
- open/volunteer assignment mode.

The resulting task then follows the normal Committee Task lifecycle.

This preserves one authoritative Committee Task model.

---

## 9. Meeting Attendance Query

The API architecture requires an explicit Meeting attendance query.

Add a trusted read operation equivalent to:

`getMeetingAttendance(meetingId)`

It returns only attendance information the authenticated actor is already
authorized to read through the Meeting scope.

It does not broaden authorization beyond the existing Meeting/RLS rules.

---

## 10. Meeting Attachments

Meeting attachments are not implemented in this Phase 10/11 closure.

The repository audit found no approved detailed Meeting attachment/storage
contract.

Task evidence/attachment storage was also previously deferred to a later
approved storage/UI slice.

Therefore this closure must not invent:

- bucket layout;
- MIME policy;
- attachment lifecycle;
- deletion rules;
- signed URL policy;
- attachment role rules.

Those items must use the approved Storage Architecture when the storage slice
is implemented.

---

## 11. Meeting Notifications — Mobile Compatibility

The durable backend currently emits:

- `meeting_created`
- `meeting_updated`
- `meeting_cancelled`

The mobile notification contract must understand these existing kinds.

The mobile notification model must also map the Meeting notification activity
reference independently from the existing Committee Task activity reference.

Required mobile compatibility includes:

- `sourceMeetingActivityId`;
- Meeting notification labels;
- safe internal Meeting target handling;
- regression tests for existing task notifications.

This is client compatibility work only.

It does not make the broader Phase 14 notification system complete.

---

## 12. Idempotency

All new mutable trusted operations use the established Committee/Meeting
pattern:

- caller supplies a stable operation ID;
- operation ID is scoped per actor;
- actor/operation advisory lock occurs before authoritative mutation;
- request fingerprint detects changed-payload replay;
- same actor + same operation + same payload returns the original
  authoritative result;
- same actor + same operation + different payload returns
  `operation_id_conflict`;
- different actors may reuse the same textual operation ID.

This applies to:

- open-task claim;
- Meeting decision creation;
- Meeting follow-up task creation.

---

## 13. Authorization Is Backend Authority

Client capability flags are presentation hints only.

The backend remains authoritative through:

- authenticated application-user resolution;
- role/permission checks;
- assignment or Meeting-participant scope;
- RLS;
- trusted RPCs;
- database constraints;
- transactional locking.

Changing a client capability value must never grant access to a protected
resource.

---

## 14. Required Regression Tests

Phase 10/11 closure must prove at least:

### Open Tasks

- authorized manager can create open task;
- Committee Member can see eligible open task;
- Finance cannot see unrelated open task;
- ordinary Member cannot see open task;
- Committee Member can claim open task;
- two claimants cannot both succeed;
- exactly one active assignee exists after concurrent claim;
- claim replay is idempotent;
- changed-payload replay conflicts;
- claimed task follows existing progress/start/completion rules;
- open task overdue derivation is correct;
- completed task is never overdue.

### Meeting Decisions

- President/VP/Secretary can record decision;
- participating Committee Member can record decision;
- non-participating Committee Member cannot record decision;
- Auditor cannot record decision;
- Finance/Member cannot record decision;
- exact replay is idempotent;
- changed-payload replay conflicts;
- history is append-oriented;
- Meeting cancellation does not erase previous decisions.

### Follow-Up Tasks

- authorized task assigner can create Meeting follow-up task;
- source Meeting link is preserved;
- optional source decision link is preserved;
- invalid Meeting or decision relationship is rejected;
- direct follow-up assignment works;
- open follow-up task works;
- follow-up creation replay is idempotent;
- unauthorized Meeting participant cannot gain task-assignment authority.

### Meeting Attendance Read

- authorized reader can obtain attendance;
- participant-scoped Committee Member can obtain attendance for assigned
  Meeting;
- unrelated Committee Member cannot obtain attendance;
- Auditor can read;
- Finance/Member cannot read.

### Notification Compatibility

- existing task notification tests remain green;
- mobile maps Meeting notification kinds;
- Meeting notification activity source maps correctly;
- safe internal Meeting target remains accepted;
- external/malformed targets remain rejected.

---

## 15. Explicit Non-Goals

This closure does not implement:

- Meeting attachment storage;
- task evidence attachment storage;
- task reopening;
- rankings or performance scoring;
- voting/polling;
- generic Jummah attendance;
- GPS attendance;
- offline attendance synchronization;
- the full Phase 14 notification delivery/outbox system;
- broader reports;
- UI redesign.

Those remain separate approved phases.

---

## 16. Closure Rule

Phase 10 and Phase 11 may be marked functionally implemented only after:

1. migrations apply from a fresh database reset;
2. authorization/RLS negative tests pass;
3. idempotency tests pass;
4. single-claimant concurrency is proven;
5. Meeting decisions and follow-up linking are proven;
6. Meeting attendance query scope is proven;
7. Committee Task regressions pass;
8. Meeting regressions pass;
9. mobile domain tests pass;
10. mobile typecheck passes;
11. mobile lint passes;
12. implementation-status documentation is updated from repository evidence.

UI implementation remains a separate step after functional closure and the
approved UI research/selection process.

---

## 15. Implementation and Verification Evidence

The Phase 10/11 functional closure described by this document is implemented.

Verified implementation includes:

- direct and open Committee Task modes;
- atomic single-winner Committee Member claiming;
- stable `task_already_claimed` conflict behavior;
- manager reassignment of claimed open-origin tasks;
- progress, start, completion, assignment history, and activity history;
- server-derived overdue state;
- Meeting creation, update, cancellation, participant scope, attendance, and history;
- append-only Meeting decisions/outcomes;
- explicit trusted Meeting attendance retrieval;
- Meeting-linked direct and open follow-up tasks;
- task and Meeting notification compatibility on mobile;
- backend-authoritative role/permission/RLS enforcement;
- stable operation IDs, replay handling, request fingerprints, and conflict detection.

Verification performed on 2026-10-09 includes:

- fresh Supabase database rebuild from migration history;
- Committee Task foundation regression;
- assignee-option regression;
- Committee Task notification regression;
- open-task behavior regression;
- dedicated open-task closure regression;
- real two-connection open-task claim race with exactly one winner;
- derived overdue regression;
- Meeting foundation and behavioral regressions;
- Meeting decision regression;
- Meeting attendance-query regression;
- Meeting follow-up-task regression;
- full mobile Jest regression: 27 suites / 191 tests passed;
- full web Vitest regression: 16 files / 116 tests passed after restoring the lockfile-declared local `jsdom` installation;
- root TypeScript typecheck passed;
- root ESLint passed;
- Next.js production build passed;
- Supabase database diff reported no schema changes;
- Git diff integrity checks passed.

Database lint continues to report only the previously known unused-parameter
warnings for the retired `complete_referral_registration` function. Those
warnings are unrelated to Phase 10/11.

This evidence closes the **functional backend and mobile-domain scope** of
Phase 10 and Phase 11.

It does **not** claim completion of:

- the final Committee/Meeting UI redesign or Meeting screen/navigation work;
- the separate generic Attendance domain;
- Meeting/task attachment storage;
- the broader notification product phase;
- generic offline attendance synchronization;
- full application security acceptance;
- release/device/accessibility/localization/E2E acceptance;
- staging or production deployment.

The next Committee/Meeting stage is intentionally:

`UI research -> user selects direction -> Codex implements selected UI`

No UI implementation is part of this closure commit.
