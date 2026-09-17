# Masjid-e-Mamoor 2 — Meeting Management

**Document Status:** V1 Implementation Baseline  
**Version:** 1.0  
**Product:** Masjid-e-Mamoor 2 Internal Management Application  
**Scope:** V1  
**Primary Roles:** President, Secretary  
**Related Areas:** Attendance, Committee Work, Decisions, Notifications, Audit  
**Last Updated:** 2026-09-17

---

# 1. Purpose

This document defines the V1 meeting-management system for Masjid-e-Mamoor 2.

The meeting system is responsible for recording and organizing:

- Scheduled committee meetings
- Meeting title
- Date and time
- Location
- Agenda
- Invited members
- Attendance
- Decisions/minutes
- Follow-up work
- Responsible members
- Follow-up completion
- Permanent meeting history
- Meeting reminders
- Audit events

The core principle is:

> A meeting record should preserve what was planned, who participated, what was decided, who became responsible for follow-up work, and whether that work was completed.

---

# 2. V1 Scope

V1 supports:

```text
Scheduled committee meetings
Meeting details
Member invitations
Meeting attendance
Agenda
Decisions/minutes
Follow-up tasks
Responsible members
Follow-up completion
Meeting history
Meeting reminders
Audit trail
```

V1 does not include:

```text
Meeting attachments
Video conferencing
Built-in meeting chat
Public meetings
Public meeting registration
Automatic transcription
Complex recurring-meeting engines
Meeting scoring/ranking
```

---

# 3. Meeting Design Principles

1. A meeting must be a scheduled event.
2. Meeting identity must be stable.
3. Meeting history is permanent.
4. Attendance is linked to a specific scheduled meeting.
5. Decisions are separate records from the meeting.
6. A decision may exist without a task.
7. Follow-up work uses the normal task model.
8. A task may be linked to the decision that created it.
9. Responsibility must remain traceable.
10. Completion of a follow-up task is part of the meeting accountability chain.
11. Notifications do not determine meeting state.
12. Meeting records should not be deleted merely to save storage.
13. Important meeting changes are auditable.

---

# 4. Meeting Domain Overview

```text
                     SCHEDULED MEETING
                            │
          ┌─────────────────┼──────────────────┐
          │                 │                  │
          ▼                 ▼                  ▼
        AGENDA          ATTENDANCE         DECISIONS
                                                │
                                                ▼
                                         FOLLOW-UP TASKS
                                                │
                                                ▼
                                      RESPONSIBLE MEMBER
                                                │
                                                ▼
                                           COMPLETION
```

---

# 5. Meeting Identity

Every meeting receives a stable system-generated identity.

Example:

```text
MTG-2026-000001
```

The exact display format may change.

Database identity should use a UUID or equivalent stable key.

---

# 6. Meeting Creator

Every meeting should record the user who created it.

Conceptually:

```text
created_by
```

The creator is responsible for creating the meeting record but is not automatically responsible for all follow-up work.

---

# 7. Meeting Core Fields

Conceptually:

```text
id
meeting_reference
title
scheduled_at
location
agenda
status
created_by
created_at
updated_at
```

The physical schema is defined in:

```text
DATABASE_SCHEMA.md
```

---

# 8. Meeting Title

Meeting title is required.

Examples:

```text
Monthly Committee Meeting
Emergency Committee Meeting
September Planning Meeting
```

---

# 9. Meeting Date and Time

A scheduled meeting must include:

```text
scheduled_at
```

The timestamp is server-stored.

The UI renders it in the user's local timezone as appropriate.

---

# 10. Meeting Location

Location is required/expected for a normal scheduled meeting record unless the final operational flow explicitly permits another value.

Examples:

```text
Masjid-e-Mamoor 2 Committee Room
Masjid Hall
```

Do not add complex mapping/location tracking to V1.

---

# 11. Meeting Agenda

Agenda is meeting-level information describing the planned topics.

Example:

```text
1. Monthly financial review
2. Pending committee work
3. Upcoming Jummah arrangements
```

Agenda is not duplicated into every decision or task.

---

# 12. Meeting Status

Conceptual states:

```text
SCHEDULED
COMPLETED
CANCELLED
```

The final database representation may use another controlled model.

---

# 13. Scheduled

A meeting is `SCHEDULED` before it occurs.

It remains a scheduled event even if invitations or agenda content are later updated.

---

# 14. Completed

A meeting can be treated as `COMPLETED` after the scheduled meeting has occurred and the meeting record is finalized according to the operational workflow.

The exact UI action can be defined during implementation.

---

# 15. Cancelled

A meeting may be cancelled.

Cancellation should preserve:

```text
Meeting ID
Original date/time
Created information
Cancellation context
Audit history
```

Do not delete the meeting record.

---

# 16. Meeting Invitations

A meeting may have a list of invited members.

Conceptually:

```text
meeting_members
```

with:

```text
meeting_id
member_id
```

---

# 17. Invitee Identity

Invited members are linked using stable User/Member IDs.

Do not use names as the relationship key.

---

# 18. Invitation History

If invitation membership changes materially, the implementation should preserve the current authoritative invitee list and audit important changes.

A full invitation-versioning system is not required in V1.

---

# 19. Meeting Attendance

Meeting attendance is specific to a scheduled meeting.

Conceptually:

```text
Meeting
  ↓
Member
  ↓
Attendance
```

---

# 20. One Attendance Record

V1 invariant:

```text
One Member + One Meeting = One Attendance Record
```

This prevents duplicate attendance.

---

# 21. Attendance Data

Conceptually:

```text
meeting_id
member_id
status
marked_at
```

The detailed attendance behavior is defined in:

```text
ATTENDANCE_SYSTEM.md
```

---

# 22. Attendance and Invitation

A meeting attendance record should normally correspond to an invited/eligible participant according to the role rules.

The final implementation determines whether explicit invitation is mandatory or merely informational.

Do not create disconnected meeting attendance rows.

---

# 23. Meeting Attendance Summary

A meeting detail view may show:

```text
Invited Count
Present Count
Absent Count
Attendance Percentage
```

The percentage is descriptive.

It is not a performance score.

---

# 24. Meeting Agenda Workflow

Before meeting:

```text
Create meeting
     ↓
Set date/time/location
     ↓
Set agenda
     ↓
Invite members
     ↓
Send reminder
```

After meeting:

```text
Record attendance
     ↓
Record decisions/minutes
     ↓
Create follow-up tasks where needed
```

---

# 25. Meeting Reminders

The notification system may send a meeting reminder to invited members.

Example:

```text
Committee meeting reminder
Tomorrow at 6:00 PM
```

The exact timing is configured separately.

---

# 26. Notification Independence

Meeting reminder failure does not change meeting state.

Example:

```text
Reminder failed
→ Meeting still scheduled
```

---

# 27. Decisions

A meeting may produce zero or more decisions.

Conceptually:

```text
meeting
   └── decisions
```

---

# 28. Decision Identity

Every decision receives a stable ID.

Example:

```text
DEC-2026-000001
```

The exact display format may change.

---

# 29. Decision Core Fields

Conceptually:

```text
id
meeting_id
decision_text
created_by
created_at
updated_at
```

Optional fields may include:

```text
decision_date/context
```

if required by implementation.

---

# 30. Decision Text

Decision text should state the outcome clearly.

Example:

```text
The committee decided to complete the electrical repair before the next Friday.
```

---

# 31. Decision vs Discussion

The system should distinguish:

```text
Agenda/topic
Discussion/minutes
Decision
```

Do not mark every discussion note as a decision.

---

# 32. Minutes

V1 can store meeting decisions/minutes as structured text fields.

A complex rich-text document editor is not required unless separately approved.

---

# 33. Decision Without Task

A decision may exist without follow-up work.

Example:

```text
Decision:
Continue current Jummah arrangement.

Task:
None.
```

The system must not automatically create a task.

---

# 34. Decision With Follow-Up

Where work is required:

```text
Meeting
   ↓
Decision
   ↓
Task
```

---

# 35. Follow-Up Task Model

Follow-up work uses the normal Committee Work Management system.

Do not create a separate task lifecycle only for meetings.

The task can reference:

```text
meeting_id
decision_id
```

---

# 36. Follow-Up Responsible Member

Each follow-up task can be:

```text
Directly assigned
```

or:

```text
Open for volunteering
```

according to the standard task model.

---

# 37. Follow-Up Completion

Follow-up completion uses the same task lifecycle:

```text
Assigned/Claimed
     ↓
In Progress
     ↓
Completed
```

If the deadline passes before completion, it may become overdue.

---

# 38. Meeting Accountability Chain

The system must make this chain traceable:

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
   ↓
Completion Date
```

This is a core feature.

---

# 39. Follow-Up Task Without Decision

A meeting may create a practical task that does not correspond to a formal decision.

Example:

```text
Meeting
   ↓
Task: Prepare next meeting agenda
```

The task can link to the meeting without requiring a decision relationship.

---

# 40. Meeting Without Follow-Up

A meeting may end with:

```text
No decisions
No follow-up tasks
```

This is valid.

Do not force artificial tasks.

---

# 41. Meeting Follow-Up Dashboard

Authorized users may see:

```text
Open follow-ups
Completed follow-ups
Overdue follow-ups
Responsible members
Upcoming deadlines
```

---

# 42. Meeting Detail View

A meeting detail screen should support:

```text
Title
Date/time
Location
Agenda
Invited members
Attendance
Decisions/minutes
Follow-up tasks
Completion status
Audit information where permitted
```

---

# 43. Meeting List View

The meeting list should show enough information to quickly identify:

```text
Title
Date/time
Status
Location
Attendance summary
Follow-up count
```

---

# 44. Meeting Search

Authorized users may search/filter meetings by:

```text
Date range
Title
Status
Location
```

Additional filters may be added if real operational need exists.

---

# 45. Meeting History

Meeting history is permanent.

Historical meetings should remain accessible according to role permissions.

---

# 46. Meeting Cancellation History

If a meeting is cancelled, preserve:

```text
Meeting
Previous status
New status
Cancellation actor
Cancellation timestamp
Reason where required
```

---

# 47. Meeting Rescheduling

A meeting date/time may need to change.

If authorized rescheduling is supported, important changes should be audited.

Example:

```text
September 20
→
September 22
```

---

# 48. Rescheduling and Notifications

When a meeting is rescheduled:

```text
Meeting record updated
      ↓
Relevant notification may be sent
```

The notification does not replace the meeting record.

---

# 49. Agenda Editing

Authorized users may edit the agenda before/around the meeting according to the role model.

Important changes may be audited.

A full immutable agenda versioning system is not required in V1.

---

# 50. Decision Editing

Authorized users may correct decision/minutes content.

Important corrections should record:

```text
Actor
Timestamp
Changed context
```

The audit log handles sensitive change history.

---

# 51. Decision Deletion

V1 should avoid destructive deletion of historical decisions.

If a decision is later determined to be invalid, the preferred approach is an explicit controlled correction/status mechanism rather than silently erasing history.

---

# 52. Follow-Up Task Editing

Follow-up tasks follow the standard Committee Work Management rules.

For example:

```text
Committee Member may edit own completed work
```

subject to the approved task permissions.

---

# 53. No Meeting Attachments

V1 does not require meeting attachments.

Do not create a meeting file-storage subsystem unless the scope is later expanded.

---

# 54. Meeting and Member Relationships

Meetings reference members through:

```text
Invitations
Attendance
Follow-up responsibility
```

These relationships use stable IDs.

---

# 55. Meeting and Tasks

Tasks may reference:

```text
meeting_id
```

This allows queries such as:

```text
Show all follow-up work from this meeting.
```

---

# 56. Meeting and Decisions

Decisions reference:

```text
meeting_id
```

This allows queries such as:

```text
Show all decisions made during this meeting.
```

---

# 57. Decision and Tasks

Tasks may reference:

```text
decision_id
```

where work directly results from a decision.

---

# 58. Accountability Query

Authorized users should be able to answer:

```text
What was decided at Meeting X?
```

Then:

```text
Which tasks came from those decisions?
```

Then:

```text
Who was responsible?
```

Then:

```text
What is the current status?
```

Then:

```text
When was it completed?
```

---

# 59. Meeting Dashboard Metrics

President/Secretary may see:

```text
Meetings held
Meetings scheduled
Meetings cancelled
Attendance rate
Decisions recorded
Open follow-ups
Completed follow-ups
Overdue follow-ups
```

These are descriptive operational metrics.

---

# 60. No Performance Ranking

Meeting participation must not be converted into:

```text
Best attendee
Worst attendee
Attendance rank
Committee score
Performance score
```

---

# 61. Meeting Attendance Percentage

Attendance percentage may be calculated:

```text
Present invited members
÷
Eligible/invited members
× 100
```

The exact denominator must be defined consistently.

---

# 62. Attendance Scope

The meeting system only concerns:

```text
Scheduled committee meetings
```

Jummah attendance is handled by the attendance system separately.

---

# 63. No General Prayer Attendance

The meeting system must not introduce attendance for:

```text
Fajr
Zohr
Asr
Maghrib
Isha
```

Those are outside the V1 meeting-management scope.

---

# 64. Meeting Notifications

Possible events:

```text
Meeting created
Meeting reminder
Meeting rescheduled
Meeting cancelled
Follow-up assigned
Follow-up completed
```

The notification system defines delivery.

---

# 65. Notification Payload Privacy

Meeting notifications should avoid unnecessary sensitive details.

Example:

```text
Committee meeting tomorrow at 6:00 PM.
```

---

# 66. Meeting Audit Events

Important meeting events include:

```text
MEETING_CREATED
MEETING_UPDATED
MEETING_RESCHEDULED
MEETING_CANCELLED
MEETING_ATTENDANCE_UPDATED
DECISION_CREATED
DECISION_UPDATED
FOLLOWUP_TASK_CREATED
```

Final event naming is defined in:

```text
AUDIT_LOG_MODEL.md
```

---

# 67. Audit Actor

Important changes should record:

```text
Actor User ID
Actor Role
Server Timestamp
```

---

# 68. Meeting Security

Meeting records are internal committee information.

Access follows:

```text
Authentication
+
Authorization
+
RLS
```

---

# 69. Role Access

High-level V1:

```text
President
→ broad meeting administration and visibility

Secretary
→ broad meeting operational management

Committee Member
→ participation and relevant follow-up work

Member
→ no unrestricted internal meeting management
```

Exact permissions are defined in `USER_ROLES_PERMISSIONS.md`.

---

# 70. Meeting Data Privacy

Do not expose unrestricted internal meeting records to ordinary Members.

Decisions and follow-up work may contain operationally sensitive information.

---

# 71. Meeting API Principles

Prefer explicit commands:

```text
createMeeting()
updateMeeting()
scheduleMeeting()
cancelMeeting()
recordAttendance()
createDecision()
updateDecision()
createFollowupTask()
```

Avoid unrestricted generic row updates.

---

# 72. Meeting Creation Validation

Before creating a meeting, validate:

```text
Title
Scheduled date/time
Location
Creator authorization
```

Agenda/invitations may then be attached.

---

# 73. Meeting Update Validation

Updates must validate:

```text
Current meeting state
Authorized user
Allowed fields
```

---

# 74. Meeting Cancellation Validation

Cancellation must verify:

```text
Authorized user
Meeting not already invalidly finalized
```

and record required cancellation context.

---

# 75. Meeting Attendance Concurrency

If two requests attempt to mark the same member present simultaneously:

```text
One authoritative attendance record
```

The database should prevent duplicates.

---

# 76. Meeting Decision Concurrency

Two authorized users may create separate decisions for the same meeting.

This is normally valid because:

```text
One meeting → many decisions
```

Duplicate decision text is a content issue, not necessarily a database identity conflict.

---

# 77. Follow-Up Task Concurrency

Follow-up tasks use the normal task concurrency rules.

Open follow-up tasks can have only one successful claimant.

---

# 78. Meeting Storage

Meeting records are lightweight relational data.

Use PostgreSQL for:

```text
Meetings
Invitees
Attendance references
Decisions
Task relationships
Audit references
```

No meeting binary storage is required in V1.

---

# 79. Meeting Backup

Backup should preserve:

```text
Meetings
Meeting invitations
Attendance relationships
Decisions
Follow-up task relationships
Audit metadata
```

---

# 80. Restore Validation

After a restore, verify:

```text
Meeting count
Attendance relationships
Decision relationships
Task relationships
Historical status
Audit links
```

---

# 81. Meeting Indexing

Recommended index areas:

```text
meetings(scheduled_at)
meetings(status)
meetings(created_by)

meeting_members(meeting_id, member_id)

meeting_attendance(meeting_id, member_id)

decisions(meeting_id)

tasks(meeting_id)
tasks(decision_id)
```

Exact indexes should be validated against actual queries.

---

# 82. Meeting History Queryability

Common questions should be efficient:

```text
What meetings happened this month?
What meetings are upcoming?
Who attended?
What decisions came from a meeting?
What follow-up tasks remain?
Who is responsible?
Which follow-ups are overdue?
```

---

# 83. Data Retention

Meeting history should remain available for the life of the application unless a future formal retention policy says otherwise.

Do not purge old meetings for storage savings.

---

# 84. Meeting Testing Requirements

At minimum test:

1. Create scheduled meeting.
2. Validate required title/date/location.
3. Add agenda.
4. Invite members.
5. Send reminder.
6. Record meeting attendance.
7. Prevent duplicate member attendance.
8. Calculate attendance summary.
9. Record decision.
10. Record multiple decisions.
11. Create decision without task.
12. Create follow-up task from decision.
13. Link follow-up task to meeting.
14. Link follow-up task to decision.
15. Assign follow-up task.
16. Open follow-up task for volunteering.
17. Atomic claim of open follow-up.
18. Complete follow-up.
19. Show overdue follow-up.
20. Reschedule meeting.
21. Cancel meeting.
22. Preserve cancelled meeting history.
23. Edit agenda.
24. Edit decision.
25. Audit important changes.
26. Role-based meeting access.
27. Unauthorized meeting modification rejected.
28. Notification failure does not alter meeting state.
29. Restore meeting relationships.
30. Preserve historical meeting records.

---

# 85. Meeting Invariants

The following rules are mandatory:

### Invariant 1

Every meeting has a stable system-generated identity.

### Invariant 2

Every meeting records its creator.

### Invariant 3

A meeting is a scheduled committee event.

### Invariant 4

Meeting attendance belongs to a specific meeting.

### Invariant 5

One member + one meeting has at most one attendance record.

### Invariant 6

Attendance is separate from general prayer attendance.

### Invariant 7

A meeting may have zero or more decisions.

### Invariant 8

A decision may exist without a task.

### Invariant 9

Follow-up work uses the standard task model.

### Invariant 10

A task may link to a meeting.

### Invariant 11

A task may link to a decision.

### Invariant 12

Meeting accountability can trace decision → task → responsible member → completion.

### Invariant 13

Meeting reminders do not determine meeting state.

### Invariant 14

Meeting history is permanent.

### Invariant 15

Cancellation does not erase the meeting record.

### Invariant 16

Important meeting changes are audited.

### Invariant 17

Meeting attachments are not part of V1.

### Invariant 18

Meeting participation is not converted into a ranking or score.

### Invariant 19

Clients cannot bypass meeting authorization.

### Invariant 20

Duplicate attendance is prevented.

### Invariant 21

Follow-up task claim concurrency follows the global task rules.

### Invariant 22

Historical relationships survive user deactivation.

### Invariant 23

Meeting records are not purged for storage optimization.

---

# 86. Acceptance Criteria

The Meeting Management system is implementation-ready when it can:

- Create scheduled committee meetings.
- Record title, date/time, location, and agenda.
- Invite relevant members.
- Record meeting attendance.
- Prevent duplicate attendance.
- Show attendance summary.
- Record decisions/minutes.
- Allow decisions without tasks.
- Create follow-up tasks where required.
- Link follow-up tasks to meetings/decisions.
- Assign or open follow-up work.
- Track completion and overdue state through the task system.
- Reschedule meetings.
- Cancel meetings without deleting history.
- Notify members of relevant meeting events.
- Preserve meeting history.
- Maintain role-based access.
- Audit important meeting changes.
- Restore meeting/decision/task relationships correctly.

---

# 87. Implementation Boundary

This document defines meeting-specific behavior.

The following belong elsewhere:

```text
Meeting data relationships     → COMMITTEE_DATA_MODEL.md
Task behavior                  → COMMITTEE_WORK_MANAGEMENT.md
Member records                 → MEMBER_MANAGEMENT.md
Attendance rules               → ATTENDANCE_SYSTEM.md
Notifications                  → NOTIFICATION_SYSTEM.md
Audit trail                    → AUDIT_LOG_MODEL.md
Roles/permissions              → USER_ROLES_PERMISSIONS.md
Database                       → DATABASE_SCHEMA.md
Security/RLS                   → SECURITY_ARCHITECTURE.md
UI screens                     → SCREEN_SPECIFICATIONS.md
Reporting                      → REPORTING_AND_AUDIT.md
```

---

# 88. Related Documents

- `PROJECT_OVERVIEW.md`
- `PRODUCT_REQUIREMENTS.md`
- `FEATURE_SCOPE.md`
- `USER_ROLES_PERMISSIONS.md`
- `AUTHENTICATION.md`
- `MEMBER_MANAGEMENT.md`
- `COMMITTEE_DATA_MODEL.md`
- `COMMITTEE_WORK_MANAGEMENT.md`
- `ATTENDANCE_SYSTEM.md`
- `NOTIFICATION_SYSTEM.md`
- `AUDIT_LOG_MODEL.md`
- `DATABASE_SCHEMA.md`
- `DATA_RELATIONSHIPS.md`
- `SECURITY_ARCHITECTURE.md`
- `DATA_PRIVACY.md`
- `SCREEN_SPECIFICATIONS.md`
- `REPORTING_AND_AUDIT.md`

---

## Document Status

**Meeting Management — V1 Implementation Baseline**

This document defines the authoritative meeting, decision, and follow-up behavior for Masjid-e-Mamoor 2.

All meeting implementation must preserve the scheduling, attendance linkage, decision, accountability, history, authorization, and audit invariants defined here.
