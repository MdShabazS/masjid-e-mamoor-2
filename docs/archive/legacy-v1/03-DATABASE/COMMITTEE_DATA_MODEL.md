# Masjid-e-Mamoor 2 — Committee Data Model

**Document Status:** V1 Implementation Baseline  
**Version:** 1.0  
**Product:** Masjid-e-Mamoor 2 Internal Management Application  
**Scope:** V1  
**Database:** PostgreSQL via Supabase  
**Last Updated:** 2026-09-17

---

# 1. Purpose

This document defines the authoritative data model for committee operations and accountability in Masjid-e-Mamoor 2.

The committee system is one of the two primary pillars of the application.

It must reliably record:

- Committee members
- Member referrals
- Referral attribution
- Contribution visibility
- Tasks
- Task assignment
- Open/volunteer work
- Task claims
- Progress
- Completion
- Work history
- Meetings
- Meeting attendance references
- Decisions
- Follow-up work
- Responsibility
- Completion of follow-up work

The central objective is:

> The system should make it clear what work was assigned or accepted, who was responsible, what was completed, and when it happened.

---

# 2. Committee Design Principles

The committee data model follows these principles:

1. Committee work history is permanent.
2. Work records must remain traceable to the responsible member.
3. Open tasks may be claimed by only one eligible member.
4. Task claiming must be enforced atomically by the backend/database.
5. A task can be assigned directly or opened for volunteering.
6. A completed task cannot be deleted by a Committee Member.
7. Committee Members may edit their own completed work records.
8. Important edits record who and when.
9. Meeting → Decision → Task relationships must remain traceable.
10. A decision may exist without a task.
11. A task may exist without originating from a meeting.
12. Referral attribution is separate from donation verification.
13. Referral credit belongs to one primary referrer in V1.
14. Contribution figures are based on Finance-verified donations.
15. No donation quotas, rankings, leaderboards, or performance scores are stored.

---

# 3. Committee Domain Overview

```text
                         COMMITTEE SYSTEM
                                │
          ┌─────────────────────┼─────────────────────┐
          │                     │                     │
          ▼                     ▼                     ▼
      MEMBERS                WORK/TASKS            MEETINGS
          │                     │                     │
          ▼                     ▼                     ▼
      REFERRALS             ASSIGNMENTS            DECISIONS
          │                     │                     │
          ▼                     ▼                     ▼
    CONTRIBUTIONS             CLAIMS              FOLLOW-UPS
                                │                     │
                                ▼                     ▼
                           COMPLETION            COMPLETION
```

---

# 4. Committee Member Identity

A committee participant must have a stable application User ID.

Do not use:

- Name
- Mobile number
- Email

as the permanent identity key.

A member may change profile information without changing historical work ownership.

---

# 5. Committee Role Context

V1 committee-related roles include:

```text
President
Vice President
Secretary
Finance / Financer
Auditor
Committee Member
Member
```

Only roles with explicit permissions may perform corresponding committee actions.

The final permission matrix is defined separately in:

```text
USER_ROLES_PERMISSIONS.md
```

---

# 6. Committee Work Eligibility

Task eligibility is determined by the backend.

A client must not be able to claim a task merely by manipulating a role or user ID in a request.

The backend must validate:

```text
Authenticated User
        ↓
Current Role
        ↓
Task Eligibility
        ↓
Current Task State
```

---

# 7. Member Referral Domain

A Committee Member can introduce/register a new Masjid member.

The referral process records:

```text
Referring Committee Member
        ↓
New Member
        ↓
Referral Relationship
```

---

# 8. Referral Creation Workflow

```text
Committee Member meets person
        ↓
Collect name + mobile
        ↓
Search existing mobile number
        ↓
Existing user/member?
   ┌────┴────┐
  Yes        No
   │          │
No duplicate  Create member
   │          │
   └────┬─────┘
        ▼
Assign one primary referrer
        ↓
Referral record
```

---

# 9. Referral Uniqueness

Mobile number is the duplicate-prevention key for registered members.

The system must not create a second member record merely because another Committee Member refers the same person.

Conceptually:

```text
One mobile number
        ↓
One member identity
```

The exact normalization strategy for Indian mobile numbers must be implemented consistently.

---

# 10. One Primary Referrer

V1 supports one primary referrer per member.

Conceptually:

```text
Member
  └── primary_referrer_id
```

or an equivalent referral relationship table.

Do not award multiple referral credits in V1.

---

# 11. Referral Attribution Change

President may correct referral attribution.

A change must record:

```text
Previous Referrer
New Referrer
Changed By
Changed At
```

The change must be auditable.

---

# 12. Referral vs Contribution

These are separate metrics.

```text
Referral
=
Who introduced the member

Contribution
=
What verified donation amount came through that member
```

A referred member who has made no verified donation contributes:

```text
₹0 verified contribution
```

but remains a valid referred member.

---

# 13. Contribution Attribution

For dashboard/reporting purposes, a committee member's contribution can be calculated from verified donations associated with members attributed to that committee member.

Conceptually:

```text
Committee Member
       ↓
Referred Members
       ↓
Verified Donations
       ↓
Contribution Total
```

Only verified payments count.

---

# 14. No Donation Target

The committee data model does not store:

```text
Target Amount
Quota
Required Collection
Minimum Donation
Performance Goal
```

The agreed monthly donation is a member-level financial arrangement, not a committee quota.

---

# 15. No Leaderboard

The database must not introduce ranking fields such as:

```text
rank
position
score
points
leaderboard_position
```

Committee visibility is factual rather than competitive.

---

# 16. Committee Dashboard Metrics

The committee dashboard may derive:

- Members referred
- Members with verified donations
- Verified contribution amount
- Current pending contributions where relevant
- Total tasks
- Completed tasks
- In-progress tasks
- Pending tasks
- Overdue tasks
- Open/unassigned tasks
- Meetings held
- Meeting attendance
- Decisions
- Follow-up tasks

These are operational metrics, not performance scores.

---

# 17. Task Domain

A task represents a unit of committee work.

A task may be:

```text
Assigned directly
```

or:

```text
Opened for eligible members to volunteer
```

---

# 18. Task Identity

Every task has a stable system-generated ID.

Example:

```text
TASK-2026-000001
```

The exact display format may change.

Database identity should use a UUID or equivalent stable primary key.

---

# 19. Task Core Fields

Conceptually:

```text
id
task_reference
title
description
priority
status
created_by
responsible_user_id
deadline
related_member_id
related_referral_id
completion_note
completed_at
created_at
updated_at
```

The exact schema is defined in `DATABASE_SCHEMA.md`.

---

# 20. Task Title

Required.

The title should describe the work clearly enough for dashboards and notifications.

Example:

```text
Contact newly registered member
```

---

# 21. Task Description

A task may contain a detailed description.

It may explain:

- Required work
- Expected output
- Relevant context
- Instructions
- Constraints

---

# 22. Task Priority

V1 priorities:

```text
LOW
MEDIUM
HIGH
URGENT
```

Priority is an operational indicator.

It is not a performance score.

---

# 23. Task Deadline

Deadline is optional.

A task without a deadline is valid.

Where present:

```text
deadline
```

is stored independently from completion time.

---

# 24. Task Assignment Modes

V1 supports:

```text
DIRECT_ASSIGNMENT
OPEN_VOLUNTEER
```

---

# 25. Direct Assignment

A task creator selects a responsible committee member.

Conceptually:

```text
created_by
      ↓
responsible_user_id = selected member
```

The assigned member receives the relevant notification.

---

# 26. Open Volunteer Task

For an open task:

```text
responsible_user_id = NULL
```

until a valid member claims it.

Once claimed:

```text
responsible_user_id = claimant
```

and the task is no longer available for another claim.

---

# 27. Atomic Single Claim

This is a mandatory backend invariant.

If two eligible members attempt to claim an open task simultaneously:

```text
Member A ─┐
          ├──> Atomic claim operation ──> ONE winner
Member B ─┘
```

Only one claim may succeed.

The other request must receive a conflict/already-claimed result.

---

# 28. Claim Record

The data model should preserve who claimed an open task and when.

Conceptually:

```text
task_id
claimed_by
claimed_at
```

Whether this is stored directly on the task or through a task assignment/history table can be determined during final schema implementation.

The historical event must not be lost.

---

# 29. Task Status Lifecycle

V1 conceptual lifecycle:

```text
CREATED
   ↓
ASSIGNED / CLAIMED
   ↓
IN_PROGRESS
   ↓
COMPLETED
```

A deadline condition may additionally make an incomplete task:

```text
OVERDUE
```

---

# 30. Pending Task

A task remains pending when:

```text
Not completed
+
Not actively progressing
```

The exact UI presentation may group `CREATED`, `ASSIGNED`, and similar non-active states under pending where appropriate.

The underlying state should remain unambiguous.

---

# 31. Overdue Task

A task becomes overdue when:

```text
deadline < current server time
AND task is not completed
```

Server time is authoritative.

---

# 32. Overdue Notifications

For an overdue task:

```text
Responsible Member
        ↓
Notification
```

President and Secretary do not require automatic overdue notifications under V1.

Their dashboard can show overdue tasks directly.

---

# 33. Task Completion

A Committee Member may mark an eligible task as completed.

President/Secretary may have the broader operational access defined by the permission model.

No separate President verification step is required before a task becomes completed.

---

# 34. Completion Fields

A completed task should record:

```text
completed_at
completed_by
completion_note
```

where applicable.

`completion_note` is optional.

---

# 35. Completion Date

The authoritative completion timestamp is generated by the server.

The member's device timestamp must not be authoritative.

---

# 36. Work History Permanence

Completed work is part of permanent committee history.

The system must retain:

- Task
- Responsibility
- Claim/assignment
- Completion
- Completion date
- Related activity
- Edit metadata

---

# 37. Completed Work Deletion

Committee Members cannot delete completed work.

This prevents completed committee history from being erased.

President's broader authority does not change the requirement to preserve auditability.

---

# 38. Editing Completed Work

A Committee Member may edit their own completed work record.

The edit must capture:

```text
Edited By
Edited At
```

At minimum.

---

# 39. Edit Ownership Rule

For Committee Members:

```text
Can edit own completed work
Cannot edit another member's completed work
```

unless a broader role explicitly has permission.

---

# 40. No Full Version History V1

V1 does not require a complex immutable version table for every task edit.

However:

```text
who
when
what action
```

must be available for important changes.

A future version-history system may be introduced only when justified.

---

# 41. Task Progress Updates

A task may contain progress updates/comments.

Example:

```text
Task created
   ↓
Progress update
   ↓
Another progress update
   ↓
Completed
```

Progress updates should retain author and timestamp.

---

# 42. Task Attachments

Attachments are allowed where genuinely applicable to the work.

Examples:

- Supporting image
- Document
- Evidence of completed work

Storage should be through approved object storage.

The exact allowed file types and size limits belong in the application/storage requirements.

---

# 43. Related Member

A task may optionally reference a Masjid member.

Example:

```text
Task: Verify monthly donation contact
related_member_id = Member A
```

This creates operational context without duplicating member information.

---

# 44. Related Referral

A task may optionally reference a referral.

Example:

```text
Referral created
      ↓
Follow-up task
      ↓
related_referral_id
```

This allows work to be traced back to the originating activity.

---

# 45. Referral-to-Task Chain

A complete chain may look like:

```text
Committee Member
      ↓
Referral
      ↓
Registered Member
      ↓
Follow-up Task
      ↓
Responsible Committee Member
      ↓
Completion
```

---

# 46. Task Creation Sources

Tasks may be created from:

```text
Direct committee planning
Meeting decision
Member/referral activity
Operational need
```

The database may store an optional source relation.

---

# 47. Meeting Domain

A meeting is a scheduled committee event.

A meeting record contains:

- Title
- Date/time
- Location
- Agenda
- Invited members
- Attendance
- Decisions
- Follow-up tasks

---

# 48. Meeting Identity

Every meeting has a stable system-generated ID.

Example:

```text
MTG-2026-000001
```

The database primary key remains stable regardless of display reference.

---

# 49. Meeting Core Fields

Conceptually:

```text
id
meeting_reference
title
scheduled_at
location
agenda
created_by
created_at
updated_at
```

---

# 50. Scheduled Meeting Requirement

Meeting attendance requires a scheduled meeting.

There must not be an anonymous "meeting attendance" record disconnected from an actual meeting.

---

# 51. Meeting Invitations

The meeting can have an invited-member relation.

Conceptually:

```text
meeting_id
member_id
```

This is useful for calculating:

```text
Invited
Present
Absent
Attendance %
```

---

# 52. Meeting Attendance Relation

Attendance for meetings is a separate relation:

```text
meeting_attendance
```

Conceptually:

```text
meeting_id
member_id
status
marked_at
```

The exact attendance status model belongs to `ATTENDANCE_SYSTEM.md`.

---

# 53. One Attendance Record

Constraint:

```text
One member + One meeting = One attendance record
```

This prevents duplicate meeting attendance.

---

# 54. Meeting Agenda

Agenda is meeting-level content.

It should not be duplicated into every decision/task.

---

# 55. Meeting Decisions

A meeting may produce zero or more decisions.

Conceptually:

```text
Meeting
  └── Decisions
```

---

# 56. Decision Identity

Each decision has a stable ID.

Example:

```text
DEC-2026-000001
```

The exact display reference is implementation-defined.

---

# 57. Decision Core Fields

Conceptually:

```text
id
meeting_id
decision_text
created_by
created_at
updated_at
```

---

# 58. Decision Without Task

A decision may exist without any follow-up task.

Example:

```text
Decision:
Change meeting schedule next month.

Task:
None required.
```

Do not force a task relationship when no work is required.

---

# 59. Decision With Task

Where work is required:

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

This is the preferred accountability chain.

---

# 60. Decision-to-Task Relationship

A task may optionally reference:

```text
decision_id
```

This allows reporting:

```text
Which meeting decision created this task?
```

---

# 61. Follow-Up Work

Meeting follow-up work is represented using normal tasks.

The system should not create a second independent "follow-up task" data model unless implementation requires it.

A meeting's follow-up section can therefore query tasks:

```text
task.meeting_id
or
task.decision_id
```

---

# 62. Meeting Accountability Chain

The application should make it possible to answer:

```text
What was discussed?
       ↓
What was decided?
       ↓
Was any work required?
       ↓
Who was responsible?
       ↓
Was the work completed?
       ↓
When was it completed?
```

This is a core product requirement.

---

# 63. Meeting Follow-Up Completion

A follow-up task has the same lifecycle and permanence rules as any other task.

Its completion status is derived from the task record.

---

# 64. Meeting History Permanence

Meeting history is permanent.

Do not delete old meetings solely to reduce storage.

---

# 65. Meeting Attachments

V1 does not require meeting attachments.

The database should not introduce meeting document storage unless later approved.

---

# 66. Committee Work History Model

A complete work history should be queryable using:

```text
responsible member
date
status
priority
deadline
meeting
decision
referral
related member
creator
completion
```

---

# 67. Work History Examples

Example 1:

```text
TASK-001
Task: Contact new member
Responsible: Committee Member A
Created: 2026-09-01
Completed: 2026-09-02
```

Example 2:

```text
Meeting → Decision → Task → Completion

MTG-004
  ↓
DEC-009
  ↓
TASK-021
  ↓
Completed by Member B on 2026-09-10
```

---

# 68. Committee Dashboard Aggregation

Dashboard totals should be calculated from task/meeting data rather than manually maintained counters.

Example:

```text
Completed Tasks
=
COUNT(tasks WHERE status = COMPLETED)
```

This reduces counter drift.

---

# 69. Monthly Completion Trend

The dashboard may calculate:

```text
Month
+
Tasks Created
+
Tasks Completed
```

This is an operational trend and not a ranking.

---

# 70. Average Completion Time

Where sufficient timestamps exist:

```text
Average Completion Time
=
Average(completed_at - assigned/claimed_at)
```

The dashboard should clearly define which start timestamp is used.

No score should be derived from this.

---

# 71. Member Drilldown

Authorized President/Secretary views may show:

```text
Member
  ↓
Assigned Work
  ↓
Claimed Work
  ↓
Completed Work
  ↓
Pending
  ↓
Overdue
  ↓
Meeting participation
  ↓
Referral activity
```

---

# 72. Committee Accountability Data

Accountability is based on records, not subjective evaluation.

The system stores:

```text
Who
What
When
Status
Relationship
```

It does not store:

```text
Good/Bad member
Performance score
Best member
Worst member
```

---

# 73. Task Assignment History

The model should preserve assignment/claim context.

At minimum, the implementation must be able to determine:

- Who was responsible
- Whether task was directly assigned or claimed
- When responsibility began
- Whether task was completed

A dedicated assignment-history relation may be used where required.

---

# 74. Reassignment

V1 does not define a broad reassignment workflow as a separate feature.

If implementation permits authorized reassignment, it must preserve:

```text
Previous responsible member
New responsible member
Changed by
Changed at
```

Do not silently overwrite responsibility history.

---

# 75. Task Comments/Progress History

Task progress comments should preserve:

```text
Author
Timestamp
Content
```

Do not rewrite old progress comments when a later update is added.

---

# 76. Committee Notification Triggers

Relevant committee events may create notifications:

```text
Task assigned
Task claimed
Task approaching deadline
Task completed
Task overdue
Meeting scheduled
Meeting reminder
Follow-up assigned
```

Notifications are not the source of truth.

The task/meeting records are the source of truth.

---

# 77. Notification Independence

If push delivery fails:

```text
Task still exists
Meeting still exists
Attendance still exists
```

Critical committee logic must never depend on successful notification delivery.

---

# 78. Committee Data Security

Committee work can contain operationally sensitive information.

Role-based access must protect:

- Internal tasks
- Member information
- Meeting records
- Decisions
- Work history
- Referral data
- Contribution attribution

---

# 79. Committee Privacy

A normal Member should not receive unrestricted access to internal committee records.

Committee-level data should be exposed according to role.

---

# 80. Referral Privacy

Referral records may expose relationship information.

A Committee Member should only see referral information required for their role.

President has broader corrective/admin access.

---

# 81. Contribution Privacy

Contribution dashboards should use role-appropriate visibility.

Do not expose other members' financial information to ordinary Members.

---

# 82. Database Constraints

Recommended conceptual constraints include:

```text
Member mobile unique
One primary referrer per member
One meeting attendance per member/meeting
Task priority valid
Task status valid
Task claim single-owner invariant
Decision belongs to meeting
Task may reference decision
Task may reference member/referral
```

---

# 83. Foreign Key Integrity

Do not use destructive cascade deletion where it would erase committee history.

Examples:

```text
Deleting a profile
≠
Deleting completed tasks

Deleting a member
≠
Deleting meetings

Deleting a referral
≠
Deleting historical financial contribution data
```

Historical relationships must remain recoverable according to the data-retention rules.

---

# 84. Soft Deactivation vs Deletion

Where an operational entity should stop being active, prefer:

```text
is_active = false
```

or equivalent lifecycle state.

Historical work should remain readable.

---

# 85. Committee Data Corrections

Authorized administrators may correct erroneous committee records.

Corrections should capture:

```text
Actor
Timestamp
Changed field/context
Previous value
New value
Reason where required
```

The correction must not silently erase responsibility history.

---

# 86. Committee Audit Events

Important committee actions should generate audit events.

Examples:

```text
Referral created
Referral attribution changed
Task created
Task assigned
Task claimed
Task reassigned
Task completed
Completed task edited
Meeting created
Meeting updated
Decision created
Follow-up task created
```

---

# 87. Audit Actor

Audit events reference the stable User ID of the actor.

Names may be retained as display metadata where appropriate, but User ID is authoritative.

---

# 88. Server Time

Critical timestamps use server-controlled time:

```text
created_at
claimed_at
completed_at
changed_at
```

Client clock values are not authoritative.

---

# 89. Concurrency Rules

The backend must protect against race conditions for:

- Open task claims
- Task completion
- Referral duplicate creation
- Member duplicate creation
- Meeting attendance duplicate creation
- Referral attribution updates where concurrent edits are possible

---

# 90. Task Claim Concurrency Example

Unsafe:

```text
A reads task = open
B reads task = open
A claims
B claims
```

Safe:

```text
Atomic database operation
       ↓
A claims successfully
B fails because task is no longer open
```

---

# 91. Referral Duplicate Protection

Unsafe:

```text
Member A registers mobile X
Member B simultaneously registers mobile X
```

Safe:

```text
Unique normalized mobile constraint
+
transaction handling
```

Only one member record is created.

---

# 92. Committee History Queryability

The schema should make common questions efficient:

```text
What is pending?
What is overdue?
Who is responsible?
What did a member complete?
What decisions came from a meeting?
Which tasks came from that decision?
Which referrals came from a committee member?
What verified contribution came through those referrals?
```

Indexes should support these common queries.

---

# 93. Recommended Index Areas

Final schema should consider indexes on:

```text
tasks(status)
tasks(responsible_user_id)
tasks(deadline)
tasks(created_by)
tasks(decision_id)
tasks(related_member_id)
tasks(related_referral_id)

meetings(scheduled_at)
meeting_attendance(meeting_id, member_id)

referrals(referrer_id)
referrals(member_id)

decisions(meeting_id)
```

Exact index selection must be validated against real query patterns.

---

# 94. Committee Storage Strategy

Committee data is primarily relational and lightweight.

Optimize by:

- Avoiding duplicate member data
- Using references instead of copied records
- Storing documents in object storage
- Avoiding unnecessary generated files
- Retaining work history

Do not delete historical tasks or decisions for storage savings.

---

# 95. Committee Work Attachments

Where attachments are used:

```text
Task
  ↓
Attachment metadata
  ↓
Object storage
```

The task record remains authoritative even if a file later becomes inaccessible; file integrity monitoring is handled separately.

---

# 96. Data Retention

The application should retain committee work history for the life of the system unless a formal retention/legal policy later specifies otherwise.

At minimum, preserve:

- Tasks
- Completion records
- Meetings
- Decisions
- Referral attribution
- Important change history

---

# 97. Committee Backup Requirements

Backup should include:

```text
Users/roles references
Members
Referrals
Tasks
Assignments/claims
Progress records
Meetings
Attendance relations
Decisions
Task relationships
Audit records
Attachment metadata
```

Actual binary attachments follow the storage backup strategy.

---

# 98. Committee Test Scenarios

At minimum test:

1. Direct task assignment.
2. Open task creation.
3. Successful task claim.
4. Two users claiming the same task simultaneously.
5. Task progress update.
6. Task completion.
7. Overdue task detection.
8. Completed task edit by owner.
9. Completed task edit by unauthorized member.
10. Completed task deletion attempt.
11. Meeting creation.
12. Meeting invitation.
13. Meeting attendance.
14. Duplicate meeting attendance.
15. Decision without task.
16. Decision with task.
17. Follow-up task completion.
18. Referral creation.
19. Duplicate mobile registration.
20. Referral attribution correction.
21. Verified contribution aggregation.
22. Contribution with no verified payment.
23. Role-based committee access.
24. Audit event creation.

---

# 99. Committee Invariants

The following rules are mandatory:

### Invariant 1

Every committee member uses a stable User ID.

### Invariant 2

A normalized mobile number cannot create duplicate member identities.

### Invariant 3

Each member has one primary referrer in V1.

### Invariant 4

Changing referral attribution is auditable.

### Invariant 5

A referred member is not automatically counted as a financial contribution.

### Invariant 6

Only Finance-verified donations count as verified contribution.

### Invariant 7

No donation target or quota is stored in V1.

### Invariant 8

Open task claims are atomic.

### Invariant 9

One open task can have only one successful active claimant.

### Invariant 10

Completed work history is permanent.

### Invariant 11

Committee Members cannot delete completed work.

### Invariant 12

Committee Members can edit their own completed work subject to permissions.

### Invariant 13

Important work edits record actor and timestamp.

### Invariant 14

Overdue status is based on server time and task completion state.

### Invariant 15

One member + one meeting has at most one attendance record.

### Invariant 16

A decision may exist without a task.

### Invariant 17

A follow-up task can be traced to its decision where applicable.

### Invariant 18

Meeting history remains permanent.

### Invariant 19

Critical committee logic does not depend on notifications.

### Invariant 20

Historical committee records are not removed for storage optimization.

---

# 100. Committee Dashboard Data Model

The dashboard should derive the following operational sections:

```text
┌─────────────────────────────────────────┐
│ COMMITTEE OVERVIEW                      │
├─────────────────────────────────────────┤
│ Tasks Total                             │
│ Completed                               │
│ In Progress                             │
│ Pending                                 │
│ Overdue                                 │
│ Open / Unassigned                       │
├─────────────────────────────────────────┤
│ MEMBER ACTIVITY                         │
│ Referred Members                        │
│ Verified Contribution                   │
│ Work History                            │
├─────────────────────────────────────────┤
│ MEETINGS                                │
│ Meetings Held                           │
│ Attendance                              │
│ Decisions                               │
│ Follow-Ups                              │
└─────────────────────────────────────────┘
```

No ranking section should be added.

---

# 101. Member Drilldown Data Model

For an authorized internal user:

```text
Member
│
├── Referral Activity
│   ├── Members Referred
│   └── Verified Contribution Through Referrals
│
├── Work
│   ├── Assigned
│   ├── Claimed
│   ├── In Progress
│   ├── Completed
│   ├── Pending
│   └── Overdue
│
└── Meetings
    ├── Invited
    ├── Attended
    └── Absent
```

---

# 102. Accountability Chain

The complete model supports:

```text
MEMBER
  │
  ├── Referral
  │     └── Referred Member
  │
  ├── Task
  │     ├── Assignment
  │     ├── Progress
  │     └── Completion
  │
  └── Meeting Participation
        └── Decisions / Follow-ups
```

And for meeting-originated work:

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

This is the core accountability structure.

---

# 103. Implementation Boundary

This document defines the business-level committee data model.

The following implementation concerns belong in their respective documents:

```text
SQL table definitions       → DATABASE_SCHEMA.md
Row Level Security          → SECURITY_ARCHITECTURE.md
Feature behavior            → FEATURE_SCOPE.md
Role permissions            → USER_ROLES_PERMISSIONS.md
UI screens                  → SCREEN_SPECIFICATIONS.md
Attendance specifics        → ATTENDANCE_SYSTEM.md
Notifications               → NOTIFICATION_SYSTEM.md
Financial attribution       → FINANCIAL_DATA_MODEL.md
```

---

# 104. Completion Criteria

The committee data model is implementation-ready when the database can represent:

- Users and committee roles
- Members
- Primary referrals
- Referral corrections
- Verified contribution attribution
- Direct tasks
- Open tasks
- Atomic claims
- Assignment/claim history
- Task progress
- Completion
- Completed work edits
- Meetings
- Invitations
- Meeting attendance
- Decisions
- Decision-to-task relationships
- Follow-up completion
- Audit events

without requiring duplicate or contradictory sources of truth.

---

# 105. Related Documents

- `PROJECT_OVERVIEW.md`
- `PRODUCT_REQUIREMENTS.md`
- `FEATURE_SCOPE.md`
- `USER_ROLES_PERMISSIONS.md`
- `DEVELOPMENT_ROADMAP.md`
- `SYSTEM_ARCHITECTURE.md`
- `APPLICATION_ARCHITECTURE.md`
- `BACKEND_ARCHITECTURE.md`
- `SECURITY_ARCHITECTURE.md`
- `DATABASE_ARCHITECTURE.md`
- `DATABASE_SCHEMA.md`
- `DATA_RELATIONSHIPS.md`
- `FINANCIAL_DATA_MODEL.md`
- `AUDIT_LOG_MODEL.md`
- `COMMITTEE_WORK_MANAGEMENT.md`
- `MEETING_MANAGEMENT.md`
- `ATTENDANCE_SYSTEM.md`
- `NOTIFICATION_SYSTEM.md`

---

## Document Status

**Committee Data Model — V1 Implementation Baseline**

This document defines the authoritative committee/work/accountability data model for Masjid-e-Mamoor 2.

All committee implementation should preserve the invariants defined here.
