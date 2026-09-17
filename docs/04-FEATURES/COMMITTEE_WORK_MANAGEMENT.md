# Masjid-e-Mamoor 2 — Committee Work Management

**Document Status:** V1 Implementation Baseline  
**Version:** 1.0  
**Product:** Masjid-e-Mamoor 2 Internal Management Application  
**Scope:** V1  
**Primary Roles:** President, Secretary, Committee Member  
**Related Areas:** Meetings, Members, Referrals, Notifications, Audit  
**Last Updated:** 2026-09-17

---

# 1. Purpose

This document defines the V1 committee work-management system for Masjid-e-Mamoor 2.

The work-management system exists to make committee work visible, traceable, and accountable.

It must support:

- Task creation
- Direct assignment
- Open/volunteer tasks
- Atomic task claiming
- Responsible-member tracking
- Priority
- Optional deadlines
- Progress updates
- Comments
- Attachments where applicable
- Completion
- Overdue handling
- Completion notes
- Permanent work history
- Related member/referral work
- Meeting/decision follow-up work
- Task notifications
- Auditability

The core principle is:

> Every meaningful committee task should have a clear owner or claim, a visible state, and a permanent record of what happened.

---

# 2. V1 Work-Management Scope

V1 supports:

```text
Task creation
Direct assignment
Open volunteer tasks
Single-user task claiming
Task priority
Optional deadline
Progress tracking
Comments/updates
Attachments where applicable
Task completion
Overdue state
Completion notes
Member-linked tasks
Referral-linked tasks
Meeting-linked tasks
Decision-linked tasks
Permanent work history
Task notifications
Audit trail
```

V1 does not include:

```text
Performance scoring
Leaderboards
Member rankings
Gamification
Complex project-management boards
Sprint management
Time-sheet/billable-hours tracking
Recurring task automation unless later approved
Complex dependency graphs
```

---

# 3. Work-Management Principles

1. Committee work is a factual operational record.
2. A task may be directly assigned or opened for volunteering.
3. An open task may have only one successful active claimant.
4. Task claiming is enforced atomically by the backend/database.
5. Responsibility must remain traceable.
6. Deadlines are optional.
7. Overdue status is based on server time.
8. Completing a task does not require President verification in V1.
9. Completed work is permanent history.
10. Committee Members cannot delete completed work.
11. Committee Members may edit their own completed work record.
12. Important edits record actor and timestamp.
13. Meeting follow-up work uses the same task model.
14. Related member/referral context should be referenced rather than duplicated.
15. Notifications support awareness but never replace the task record.
16. Work data must not become a hidden performance-ranking system.

---

# 4. Work Domain Overview

```text
                    COMMITTEE WORK
                          │
          ┌───────────────┼────────────────┐
          │               │                │
          ▼               ▼                ▼
      DIRECT TASK      OPEN TASK        MEETING TASK
          │               │                │
          ▼               ▼                ▼
      ASSIGNED          CLAIMED          DECISION
          │               │                │
          └───────────────┼────────────────┘
                          ▼
                     IN PROGRESS
                          │
                          ▼
                      COMPLETED
                          │
                          ▼
                   PERMANENT HISTORY
```

---

# 5. Task Identity

Every task receives a stable system-generated identity.

Example:

```text
TASK-2026-000001
```

The display reference may change.

The database should use a UUID or equivalent stable primary key.

---

# 6. Task Creator

Every task records the user who created it.

Conceptually:

```text
created_by
```

The creator is not necessarily the responsible person.

Example:

```text
President creates task
Committee Member owns task
```

---

# 7. Responsible Member

A task may have:

```text
responsible_user_id
```

This represents the current responsible Committee Member/user.

For an open task:

```text
responsible_user_id = NULL
```

until claimed.

---

# 8. Assignment Modes

V1 supports:

```text
DIRECT_ASSIGNMENT
OPEN_VOLUNTEER
```

---

# 9. Direct Assignment

Direct assignment flow:

```text
Task created
      ↓
Eligible member selected
      ↓
Responsible member set
      ↓
Task becomes assigned
      ↓
Notification
```

---

# 10. Open Volunteer Task

Open task flow:

```text
Task created
      ↓
No responsible member
      ↓
Visible to eligible Committee Members
      ↓
Member chooses Claim
      ↓
Atomic backend claim
      ↓
One successful claimant
```

---

# 11. Open Task Eligibility

Only users with appropriate task permissions may claim an open task.

The backend determines eligibility.

The client must not be trusted to declare:

```text
I am a Committee Member
```

---

# 12. Atomic Claim Requirement

This is a mandatory system rule.

Example:

```text
Member A ─────┐
              ├── Claim TASK-101
Member B ─────┘
```

Only one request can succeed.

The database/service must prevent:

```text
Task has two active claimants
```

---

# 13. Claim Concurrency

Unsafe:

```text
A reads task as open
B reads task as open
A claims
B claims
```

Required behavior:

```text
Atomic operation
      ↓
A succeeds
B receives already-claimed/conflict result
```

---

# 14. Claim Record

The system should preserve:

```text
task_id
claimed_by
claimed_at
```

This may be stored directly on the task or through an assignment/claim table.

Historical claim information must not be lost.

---

# 15. Assignment History

Where responsibility can change, the system should preserve:

```text
Previous responsible member
New responsible member
Changed by
Changed at
```

This prevents responsibility history from being silently overwritten.

---

# 16. Reassignment

V1 does not define a large standalone reassignment module.

Where authorized reassignment is supported, it must remain auditable.

Example:

```text
Member A
   ↓
Task reassigned
   ↓
Member B
```

The history must show the change.

---

# 17. Task Title

Task title is mandatory.

It should be short and specific.

Example:

```text
Contact newly registered member
```

---

# 18. Task Description

Task description may include:

- Required work
- Expected result
- Context
- Instructions
- Constraints
- Supporting details

---

# 19. Priority

V1 priority levels:

```text
LOW
MEDIUM
HIGH
URGENT
```

Priority indicates operational importance.

It is not a performance score.

---

# 20. Deadline

Deadline is optional.

Example:

```text
Deadline = 2026-09-25 18:00
```

A task without a deadline is valid.

---

# 21. Server Time

Deadline evaluation must use server-authoritative time.

Do not calculate overdue status solely from a mobile/browser clock.

---

# 22. Task Status

Conceptual V1 lifecycle:

```text
CREATED
ASSIGNED
IN_PROGRESS
COMPLETED
```

An incomplete task may become:

```text
OVERDUE
```

when its deadline passes.

The exact database representation may use status + derived overdue state.

---

# 23. Created State

A newly created task is:

```text
CREATED
```

until responsibility is established or progress begins.

---

# 24. Assigned State

A directly assigned task can be represented as:

```text
ASSIGNED
```

when a responsible user exists but meaningful progress has not yet started.

---

# 25. In-Progress State

A task is In Progress when the responsible member has begun work.

This may be triggered explicitly or through the approved product workflow.

Do not infer progress merely from opening a task.

---

# 26. Completed State

A task becomes:

```text
COMPLETED
```

when the responsible member marks the work complete.

No separate President verification is required in V1.

---

# 27. Overdue State

A task is overdue when:

```text
deadline has passed
AND
task is not completed
```

Overdue can be displayed as a derived condition or stored state, but the meaning must remain deterministic.

---

# 28. Overdue Example

```text
Deadline = September 15
Today = September 17
Task not completed
```

Result:

```text
OVERDUE
```

---

# 29. Overdue Notification

When a task becomes overdue:

```text
Responsible Member
        ↓
Notification
```

President and Secretary do not require automatic overdue notifications under the current V1 workflow.

They can see overdue work in their dashboard.

---

# 30. Deadline Approaching

The system may notify a responsible member before an approaching deadline if the final notification configuration supports it.

This notification must not alter task state.

---

# 31. Task Completion

A Committee Member may mark an eligible task completed.

Completion should capture:

```text
completed_by
completed_at
completion_note
```

where applicable.

---

# 32. Completion Note

Completion note is optional.

It may explain:

```text
What was done
What result was achieved
Any relevant final information
```

---

# 33. Completion Timestamp

`completed_at` must use server-controlled timestamp.

The user's phone/browser clock is not authoritative.

---

# 34. Completion Ownership

The system should record who completed the task.

For normal self-completion:

```text
completed_by = responsible user
```

If a broader role is permitted to complete a task on behalf of another user, that distinction should remain auditable.

---

# 35. Permanent Work History

Completed work is permanent committee history.

Retain:

```text
Task
Creator
Assignment
Claim
Progress
Completion
Completion note
Related activity
Edit metadata
```

---

# 36. Completed Task Deletion

Committee Members cannot delete completed work.

The application must not expose a normal delete action for completed work to them.

---

# 37. Completed Task Editing

Committee Members may edit their own completed work record.

Example:

```text
Completion note
Date/context correction
Supporting information
```

---

# 38. Completed Task Edit Audit

At minimum record:

```text
Edited by
Edited at
Changed context
```

For important fields, also retain:

```text
Previous value
New value
```

---

# 39. No Full Version History V1

V1 does not require a complex revision engine for every field.

The audit model captures important changes.

Do not build a full document-versioning system unless later justified.

---

# 40. Task Progress Updates

A task may contain progress updates/comments.

Each update should preserve:

```text
Author
Timestamp
Content
```

---

# 41. Progress History

Progress updates are historical records.

A new progress update should not overwrite previous progress updates.

Example:

```text
Sept 5 — Contacted member
Sept 6 — Waiting for confirmation
Sept 7 — Completed
```

---

# 42. Task Comments

Comments may be used to communicate operational context.

Comments are not private chat history unless the final product explicitly defines them that way.

Keep comments relevant to the task.

---

# 43. Task Attachments

Attachments may be added when applicable.

Examples:

```text
Supporting image
Document
Evidence of work
```

Attachments are stored through protected object storage.

---

# 44. Attachment Reference

The task record should link to attachment metadata.

Conceptually:

```text
Task
  ↓
Attachment metadata
  ↓
Storage object
```

---

# 45. Task Attachment Security

Task attachments must not be public by default.

Use authenticated/protected access.

---

# 46. Related Member

A task may optionally reference a member.

Example:

```text
Task:
Follow up on monthly contribution

related_member_id = Member A
```

This avoids duplicating member details.

---

# 47. Related Referral

A task may optionally reference a referral record.

Example:

```text
Referral created
      ↓
Follow-up task
      ↓
related_referral_id
```

---

# 48. Related Meeting

A task may be linked to a meeting.

This is useful for follow-up work.

Conceptually:

```text
task.meeting_id
```

---

# 49. Related Decision

A task may optionally reference a meeting decision.

Conceptually:

```text
task.decision_id
```

This creates the accountability chain:

```text
Meeting
  ↓
Decision
  ↓
Task
```

---

# 50. Meeting Follow-Up

Follow-up work from meetings should use ordinary tasks rather than a separate task architecture.

Example:

```text
Meeting
   ↓
Decision
   ↓
Follow-up Task
   ↓
Responsible Member
   ↓
Completion
```

---

# 51. Decision Without Task

A decision may exist without a follow-up task.

Do not automatically create a task for every decision.

---

# 52. Task Without Meeting

A task may also exist independently of meetings.

Examples:

```text
Member registration follow-up
Financial document collection
Operational repair coordination
```

---

# 53. Task Source

Where useful, a task can identify its source:

```text
MEETING
DECISION
REFERRAL
MEMBER
OPERATIONAL
```

The exact database representation may use foreign-key relationships instead of a source enum.

---

# 54. Task Responsibility

A task can be:

```text
Directly assigned
Claimed from open work
```

This distinction should remain visible in history.

---

# 55. Task Ownership

Current responsibility means:

```text
Who is expected to complete the task now?
```

It is distinct from:

```text
Who created the task?
Who originally claimed the task?
```

---

# 56. Task Creator vs Responsible Person

Example:

```text
President = creator
Committee Member A = responsible
```

The system must retain both.

---

# 57. Work History Queries

Authorized users should be able to answer:

```text
What tasks are pending?
What tasks are overdue?
Who is responsible?
What has a member completed?
What did a member claim?
Which tasks came from a meeting?
Which tasks came from a decision?
Which tasks relate to a member/referral?
```

---

# 58. Member Work History

A member drilldown may show:

```text
Assigned
Claimed
In Progress
Completed
Pending
Overdue
```

This is factual work history.

It is not a performance score.

---

# 59. No Ranking

The work system must not produce:

```text
Best committee member
Worst committee member
Rank
Score
Points
Leaderboard
Performance tier
```

---

# 60. Dashboard Metrics

The President/Secretary dashboard may show:

```text
Total tasks
Completed
In progress
Pending
Overdue
Open/unassigned
Upcoming deadlines
Tasks created
Tasks completed
Monthly completion trend
Average completion time
```

These are operational metrics.

---

# 61. Average Completion Time

Where used:

```text
Completion Time
=
completed_at - responsibility_start_time
```

The exact start timestamp must be defined consistently.

The metric is descriptive, not a score.

---

# 62. Monthly Completion Trend

The system may show:

```text
Month
Tasks Created
Tasks Completed
```

This helps understand work volume.

It does not create a ranking.

---

# 63. Open Task View

Eligible Committee Members may see:

```text
Open tasks
Priority
Deadline
Description
Related context
```

and select:

```text
Claim
```

---

# 64. Claim Conflict UX

If another member claims the task first:

```text
This task has already been claimed.
```

The UI must refresh the current task state.

It must not show false ownership.

---

# 65. Task Assignment Notification

When a task is directly assigned:

```text
Responsible Member
        ↓
Push/in-app notification
```

---

# 66. Task Claim Notification

When a member claims an open task, the system may notify relevant users if configured.

The task state remains authoritative.

---

# 67. Completion Notification

When a task is completed, relevant users may receive a notification.

The notification does not constitute completion itself.

---

# 68. Notification Independence

If push/SMS/other delivery fails:

```text
Task remains unchanged
```

No task status should depend on successful notification delivery.

---

# 69. Task Security

Task operations must require:

```text
Authentication
+
Active user
+
Role/permission
+
Task state validation
```

---

# 70. Client Trust Boundary

The client must not be trusted to submit:

```text
arbitrary responsible_user_id
arbitrary completed_by
arbitrary task status
arbitrary creator
```

The backend validates each field.

---

# 71. Task API Commands

Prefer explicit operations such as:

```text
createTask()
assignTask()
claimTask()
startTask()
addProgressUpdate()
completeTask()
editCompletedTask()
reassignTask()
```

Avoid unrestricted generic task-row updates.

---

# 72. Task Claim API

Conceptually:

```text
claimTask(task_id)
```

The backend:

1. Authenticates user.
2. Checks eligibility.
3. Checks task is open.
4. Atomically claims.
5. Records claim event.
6. Creates audit event.
7. Returns authoritative task state.

---

# 73. Task Completion API

Conceptually:

```text
completeTask(task_id, completion_note)
```

The backend validates:

```text
User permission
Task responsibility/state
Required fields
```

then:

```text
Set completed state
Set completed_by
Set completed_at
Audit
```

---

# 74. Completed Task Edit API

Conceptually:

```text
editCompletedTask(task_id, changes)
```

The backend validates:

```text
Current user is allowed
Current task is completed
Changes are permitted
```

and records the audit event.

---

# 75. Task Concurrency

Concurrency protection is required for:

```text
Task claiming
Task completion
Task reassignment
Competing status updates
```

---

# 76. Task Claim Database Rule

The database should guarantee:

```text
At most one active claimant
```

for an open task.

Application-only checks are insufficient.

---

# 77. Task State Race Protection

Example:

```text
A claims
B completes
C tries to claim
```

The backend must reject invalid state transitions.

---

# 78. Invalid Task Transitions

Examples that should be rejected:

```text
Completed → Claim
Completed → Start
Completed → New claimant
```

unless an explicitly approved administrative workflow exists.

---

# 79. Task Reopening

V1 does not define a general task-reopen feature.

Do not silently introduce:

```text
Completed → Open
```

without explicit product approval.

---

# 80. Overdue and Completion

If a task is overdue and then completed:

```text
Historical overdue condition
+
Completed status
```

should remain understandable from timestamps.

Do not erase the fact that the deadline passed.

---

# 81. Deadline Editing

If an authorized user changes a deadline, the change should be auditable.

Example:

```text
Deadline
Sept 20
→
Sept 25
```

---

# 82. Priority Editing

Authorized users may change priority according to role permissions.

Important priority changes should remain auditable where required.

---

# 83. Description Editing

Task description may be editable according to role and task state.

Do not overwrite important historical evidence without appropriate audit context.

---

# 84. Assignment Notification and Audit

When assignment occurs:

```text
Task assignment
   ├── Task state
   ├── Notification
   └── Audit event
```

Notification failure must not roll back a valid task assignment unless the implementation explicitly chooses notification as a required transactional side effect, which V1 does not.

---

# 85. Task History Data

The system should retain enough information to reconstruct:

```text
Creation
Assignment/claim
Progress
Deadline
Completion
Important edits
```

---

# 86. Task Attachments Retention

Required task attachments should be retained according to storage policy.

Do not delete attachments just because a task is completed.

---

# 87. Storage Optimization

Committee work data is mostly relational and lightweight.

Optimize through:

- References instead of duplicated member records.
- Object storage for files.
- Compressed images.
- File-size limits.
- Temporary report generation.
- No unnecessary duplicate copies.

Do not delete completed work to save storage.

---

# 88. Work History Retention

The following are permanent committee history:

```text
Completed tasks
Important task changes
Claim/assignment records
Meeting-linked work
Decision-linked work
Completion records
```

---

# 89. Audit Events

Important work events include:

```text
TASK_CREATED
TASK_ASSIGNED
TASK_CLAIMED
TASK_REASSIGNED
TASK_STARTED
TASK_COMPLETED
TASK_EDITED
TASK_DEADLINE_CHANGED
TASK_PRIORITY_CHANGED
```

Final event naming is defined by `AUDIT_LOG_MODEL.md`.

---

# 90. Audit and Work History

Task history and audit log serve different purposes.

```text
Task history
→ operational state/context

Audit log
→ important control/change evidence
```

Both may be required.

---

# 91. Work and Meetings

Meeting records may contain:

```text
Agenda
Attendance
Decisions
```

Work records contain:

```text
Follow-up tasks
Responsibility
Completion
```

This separation keeps meetings and work manageable.

---

# 92. Accountability Chain

The system must support:

```text
Meeting
   ↓
Decision
   ↓
Task
   ↓
Responsible Member
   ↓
Completion
```

For referral-based work:

```text
Referral
   ↓
Task
   ↓
Responsible Member
   ↓
Completion
```

---

# 93. Work and Member Referral

Example:

```text
Committee Member A
      ↓
Refers Member X
      ↓
Task:
Follow up with Member X
      ↓
Committee Member B claims task
      ↓
Completed
```

The referral owner and task owner remain separate concepts.

---

# 94. Work and Contribution

A task related to donation follow-up does not itself create a financial contribution.

Only Finance-verified financial activity counts as contribution.

---

# 95. Work and Attendance

Attendance does not automatically create a task.

Task participation and attendance are separate records.

---

# 96. Work and Notifications

Notifications are event delivery mechanisms.

The task database remains authoritative.

---

# 97. Work and Authorization

President and Secretary have broad operational visibility according to the role model.

Committee Members can manage tasks within their permitted ownership/participation.

Members do not receive unrestricted internal committee work access.

---

# 98. President Capabilities

President may:

- Create tasks
- Assign tasks
- View all tasks
- View work history
- Review meeting follow-ups
- Correct appropriate task data
- Review accountability history

according to authorization rules.

---

# 99. Secretary Capabilities

Secretary may:

- Create tasks
- Assign tasks
- View broad work progress
- Manage meeting follow-up work
- Review work history

according to authorization rules.

---

# 100. Committee Member Capabilities

Committee Members may:

- View eligible open tasks
- Claim open tasks
- View assigned tasks
- Update progress
- Complete eligible tasks
- Edit their own completed work records
- View relevant work history according to permission

They cannot delete completed work.

---

# 101. Member Boundary

A normal Member does not receive unrestricted access to internal committee tasks or work history.

---

# 102. Data Model Relationship

Conceptually:

```text
User
 ├── creates Task
 ├── responsible for Task
 ├── claims Task
 ├── comments on Task
 └── completes Task

Task
 ├── Member
 ├── Referral
 ├── Meeting
 └── Decision
```

---

# 103. Recommended Index Areas

The final database may index:

```text
tasks(status)
tasks(responsible_user_id)
tasks(created_by)
tasks(deadline)
tasks(priority)
tasks(meeting_id)
tasks(decision_id)
tasks(related_member_id)
tasks(related_referral_id)

task_progress(task_id, created_at)
task_assignments(task_id, assigned_to)
```

Exact indexing should be validated against actual queries.

---

# 104. Work History Queries

Common queries include:

```text
All overdue tasks
Tasks for one member
Tasks from one meeting
Tasks from one decision
Open tasks
Completed tasks in a date range
Tasks related to a referral
```

Indexes should support these.

---

# 105. Task Notifications as Event Sources

Notifications may be triggered by:

```text
Assignment
Claim
Deadline approaching
Overdue
Completion
```

Do not create separate business truth in the notification system.

---

# 106. Work Data Privacy

Committee work may contain internal operational details.

Access must follow:

```text
Authentication
+
Role Authorization
+
RLS
```

---

# 107. Work Attachment Privacy

Attachments may contain internal or member-related information.

Use protected file access.

---

# 108. Work Data Backup

Backup should preserve:

```text
Tasks
Assignments
Claims
Progress updates
Completion data
Meetings
Decisions
Task relationships
Audit metadata
Attachment metadata
```

---

# 109. Restore Validation

After restore, verify:

```text
Task counts
Assignment links
Claim ownership
Completion states
Meeting/task relationships
Decision/task relationships
Audit links
```

---

# 110. Work Testing Requirements

At minimum test:

1. Direct task creation.
2. Direct assignment.
3. Open task creation.
4. Open task visibility to eligible members.
5. Successful claim.
6. Two users claiming same task simultaneously.
7. Claim conflict behavior.
8. Assignment history.
9. Reassignment if enabled.
10. Progress update.
11. Multiple progress updates remain historical.
12. Completion.
13. Completion note.
14. Server completion timestamp.
15. Overdue detection.
16. Overdue notification trigger.
17. Deadline change.
18. Priority change.
19. Completed-task edit by owner.
20. Unauthorized completed-task edit.
21. Completed-task deletion attempt.
22. Task linked to member.
23. Task linked to referral.
24. Task linked to meeting.
25. Task linked to decision.
26. Decision without task.
27. Meeting follow-up task.
28. Task attachment.
29. Protected attachment access.
30. Role-based access.
31. Notification failure does not alter task state.
32. Invalid task-state transition rejection.
33. Task claim idempotency/conflict handling.
34. Audit event creation.
35. Work history survives deactivation.
36. Work history survives long-term retention.

---

# 111. Work Management Invariants

The following rules are mandatory:

### Invariant 1

Every task has a stable system-generated identity.

### Invariant 2

Every task identifies its creator.

### Invariant 3

A task may be directly assigned or open for volunteering.

### Invariant 4

An open task can have only one successful active claimant.

### Invariant 5

Task claiming is atomic.

### Invariant 6

Claiming is validated by backend authorization.

### Invariant 7

Current responsibility is distinguishable from task creation.

### Invariant 8

Important assignment changes remain traceable.

### Invariant 9

Deadlines are optional.

### Invariant 10

Overdue status is based on server time and completion state.

### Invariant 11

Completing a task does not require President verification in V1.

### Invariant 12

Completed work is permanent history.

### Invariant 13

Committee Members cannot delete completed work.

### Invariant 14

Committee Members can edit their own completed work according to permissions.

### Invariant 15

Important edits record actor and timestamp.

### Invariant 16

Progress updates remain historical.

### Invariant 17

Meeting follow-up work uses the normal task model.

### Invariant 18

A meeting decision may exist without a task.

### Invariant 19

A task may exist without a meeting.

### Invariant 20

Related members/referrals are referenced rather than duplicated.

### Invariant 21

Notifications do not determine task state.

### Invariant 22

Clients cannot arbitrarily set responsibility or completion identity.

### Invariant 23

Invalid task-state transitions are rejected.

### Invariant 24

Task claiming is concurrency-safe.

### Invariant 25

Task creation/claim/completion commands are retry-safe where applicable.

### Invariant 26

Work history is not deleted for storage optimization.

### Invariant 27

Task records do not create donation/financial contribution by themselves.

### Invariant 28

No ranking, score, leaderboard, or performance tier is stored.

---

# 112. Acceptance Criteria

The Committee Work Management system is implementation-ready when it can:

- Create tasks.
- Assign tasks directly.
- Create open volunteer tasks.
- Allow eligible Committee Members to claim open tasks.
- Guarantee only one successful claimant.
- Preserve assignment/claim context.
- Track task priority.
- Support optional deadlines.
- Detect overdue work using server time.
- Send appropriate task notifications.
- Record progress updates.
- Support completion notes.
- Mark tasks completed without President verification.
- Preserve completed work permanently.
- Prevent Committee Members from deleting completed work.
- Allow Committee Members to edit their own completed work.
- Audit important changes.
- Link tasks to members/referrals.
- Link tasks to meetings/decisions.
- Support meeting follow-up work.
- Protect attachments.
- Support role-based access.
- Preserve work history through user deactivation.
- Produce accurate work dashboards.

---

# 113. Implementation Boundary

This document defines task/work behavior.

The following belong elsewhere:

```text
Task data relationships     → COMMITTEE_DATA_MODEL.md
Meeting behavior            → MEETING_MANAGEMENT.md
Member records              → MEMBER_MANAGEMENT.md
Referral behavior           → DONATION_SYSTEM.md / COMMITTEE_DATA_MODEL.md
Attendance                  → ATTENDANCE_SYSTEM.md
Notifications              → NOTIFICATION_SYSTEM.md
Audit trail                 → AUDIT_LOG_MODEL.md
Database tables             → DATABASE_SCHEMA.md
Authorization              → AUTHORIZATION_MODEL.md
Security/RLS                → SECURITY_ARCHITECTURE.md
UI screens                  → SCREEN_SPECIFICATIONS.md
Storage                     → STORAGE_STRATEGY.md
Reporting                   → REPORTING_AND_AUDIT.md
```

---

# 114. Related Documents

- `PROJECT_OVERVIEW.md`
- `PRODUCT_REQUIREMENTS.md`
- `FEATURE_SCOPE.md`
- `USER_ROLES_PERMISSIONS.md`
- `AUTHENTICATION.md`
- `MEMBER_MANAGEMENT.md`
- `COMMITTEE_DATA_MODEL.md`
- `FINANCIAL_DATA_MODEL.md`
- `DONATION_SYSTEM.md`
- `MEETING_MANAGEMENT.md`
- `ATTENDANCE_SYSTEM.md`
- `NOTIFICATION_SYSTEM.md`
- `AUDIT_LOG_MODEL.md`
- `DATABASE_SCHEMA.md`
- `DATA_RELATIONSHIPS.md`
- `AUTHORIZATION_MODEL.md`
- `SECURITY_ARCHITECTURE.md`
- `DATA_PRIVACY.md`
- `STORAGE_STRATEGY.md`
- `REPORTING_AND_AUDIT.md`

---

## Document Status

**Committee Work Management — V1 Implementation Baseline**

This document defines the authoritative operational task and accountability behavior for Masjid-e-Mamoor 2.

All work-management implementation must preserve the assignment, atomic-claim, completion, history, authorization, and audit invariants defined here.
