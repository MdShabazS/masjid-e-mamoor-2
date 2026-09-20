# Masjid-e-Mamoor 2 — Attendance System

**Document Status:** V1 Implementation Baseline  
**Version:** 1.0  
**Product:** Masjid-e-Mamoor 2 Internal Management Application  
**Scope:** V1  
**Attendance Types:** Jummah Prayer + Scheduled Committee Meetings  
**Primary Technology:** Mobile GPS + PostgreSQL via Supabase  
**Last Updated:** 2026-09-17

---

# 1. Purpose

This document defines the V1 attendance system for Masjid-e-Mamoor 2.

The attendance system is intentionally limited to two operational use cases:

```text
1. Jummah prayer attendance
2. Scheduled committee meeting attendance
```

The system must provide:

- GPS-based Jummah attendance
- One-tap "Mark Present" flow
- Server-side location validation
- Accuracy validation
- Duplicate prevention
- Offline attendance capture and sync
- Server-authoritative records
- Individual attendance history
- Aggregate attendance counts
- Meeting-specific attendance
- Attendance reminders where configured
- Privacy-conscious location handling

---

# 2. Explicit V1 Scope

V1 includes only:

```text
Jummah attendance
Committee meeting attendance
```

---

# 3. Explicitly Excluded Attendance Types

The following are not part of V1:

```text
Fajr attendance
Zohr/Dhuhr attendance
Asr attendance
Maghrib attendance
Isha attendance
Azaan attendance
Jamaat-specific attendance
Continuous location tracking
Location history
GPS movement tracking
GPS-based committee presence outside attendance events
```

Do not add these through implementation convenience.

---

# 4. Attendance Design Principles

1. Attendance is an event, not continuous tracking.
2. Jummah attendance uses current device location at the time of marking present.
3. The backend validates the attendance event.
4. A member can have only one Jummah attendance record per Friday/session.
5. A member can have only one attendance record per scheduled meeting.
6. No checkout is required.
7. No continuous location tracking is performed.
8. Offline attendance may be captured and synchronized later.
9. Server state is authoritative after synchronization.
10. Duplicate synchronization must not create duplicate attendance.
11. Attendance history remains available according to retention rules.
12. Attendance data must be role-protected.
13. Location data must be minimized and protected.
14. V1 does not include GPS spoof/mock-location detection.
15. Attendance must not become a performance-ranking system.

---

# 5. Attendance Domain Overview

```text
                         ATTENDANCE
                              │
                 ┌────────────┴────────────┐
                 │                         │
                 ▼                         ▼
             JUMMAH                    MEETING
                 │                         │
                 ▼                         ▼
              GPS CHECK              SCHEDULED EVENT
                 │                         │
                 ▼                         ▼
           MARK PRESENT                ATTENDANCE
                 │                         │
                 └────────────┬────────────┘
                              ▼
                       SERVER VALIDATION
                              │
                              ▼
                       ATTENDANCE RECORD
                              │
                              ▼
                         AUDIT / REPORT
```

---

# 6. Attendance Identity

Attendance records should use stable:

```text
User/Member ID
```

rather than:

```text
Name
Mobile number
```

as the permanent relationship key.

---

# 7. Jummah Attendance

Jummah attendance is a single presence event for the Friday/Jummah session.

Conceptually:

```text
Member
+
Friday session/date
=
One attendance record
```

---

# 8. Jummah Attendance Workflow

```text
Member opens attendance
        ↓
System obtains current location
        ↓
Location permission available?
   ┌────────┴────────┐
  Yes                 No
   │                   │
Continue              Prompt permission
   ↓
Capture coordinates + accuracy
   ↓
Send attendance request
   ↓
Server validates
   ↓
Within allowed radius?
   ├───────────────┐
  Yes              No
   │                │
Create record     Reject
   ↓
Present
```

---

# 9. One-Tap Mark Present

The normal Jummah UX should be:

```text
MARK PRESENT
```

The member should not need to manually enter latitude/longitude.

The mobile application obtains the current location.

---

# 10. Location Permission

The mobile application must request location permission only when required for Jummah attendance.

Do not request continuous/background location permission for V1.

---

# 11. Precise Location

Jummah attendance requires an accurate enough current location to validate proximity to Masjid-e-Mamoor 2.

The app should request an appropriate precise location mode supported by the platform.

---

# 12. Location Data Sent for Validation

The attendance request may include:

```text
Latitude
Longitude
Location Accuracy
Client capture timestamp where useful
Attendance session/date
Request/idempotency identifier
```

The backend must determine the final attendance result.

---

# 13. Server-Side Location Validation

The server validates:

```text
Authenticated member
+
Active account
+
Attendance eligibility
+
Coordinates
+
Accuracy
+
Masjid radius
+
Duplicate state
+
Session/date
```

The client must not decide attendance validity.

---

# 14. Masjid Attendance Coordinates

The system maintains a configured Masjid attendance point.

Conceptually:

```text
Masjid Latitude
Masjid Longitude
```

The exact coordinates are configuration data and should not be hard-coded in multiple clients.

---

# 15. Attendance Radius

President may configure the allowed Jummah attendance radius.

Conceptually:

```text
distance(member_location, masjid_location)
≤ configured_radius
```

The final radius value is a system setting.

Do not hard-code a value in the client.

---

# 16. Accuracy Validation

Distance alone is not enough.

The backend should also inspect the reported location accuracy.

Example:

```text
Distance = 40 m
Accuracy = 300 m
```

This should not automatically be accepted because the location confidence is too poor.

The exact accuracy threshold must be tested and configured during implementation.

---

# 17. Accuracy Rule

A recommended conceptual rule is:

```text
Accept only when reported accuracy
is within the configured acceptable threshold
```

The final threshold should balance:

```text
Attendance usability
+
GPS reliability
+
False acceptance prevention
```

Do not hard-code an untested value here.

---

# 18. Distance Calculation

The backend should calculate distance using a proper geographic calculation.

Conceptually:

```text
Member GPS point
       ↓
Distance calculation
       ↓
Masjid GPS point
       ↓
Distance in meters
```

The client should not be trusted to submit its own calculated distance.

---

# 19. Attendance Acceptance

Jummah attendance is accepted only when:

```text
Valid authenticated user
+
Eligible attendance date/session
+
Valid location
+
Acceptable accuracy
+
Within configured radius
+
No existing attendance record
```

---

# 20. Attendance Rejection

Examples:

```text
Outside attendance radius
Poor GPS accuracy
Location unavailable
Already marked present
Invalid session/date
Unauthenticated user
Inactive account
```

The UI should give a clear, safe explanation.

---

# 21. Already Marked Present

If a member attempts to mark present twice:

```text
Do not create duplicate attendance.
```

The UI may display:

```text
Attendance already recorded.
```

---

# 22. Duplicate Constraint

Recommended conceptual constraint:

```text
UNIQUE(member_id, jummah_session_id)
```

or:

```text
UNIQUE(user_id, attendance_date)
```

depending on the final session model.

Database enforcement is mandatory.

---

# 23. Jummah Session Identity

The system should maintain a logical Jummah attendance session/date.

This can be represented by:

```text
jummah_session
```

or an equivalent date/session key.

The same session identity must be used for:

```text
Attendance
Reports
Duplicate prevention
```

---

# 24. One Friday Record

V1 expects one Jummah attendance event per member per Friday/session.

Do not create multiple attendance events merely because the member opens the screen repeatedly.

---

# 25. No Checkout

Jummah attendance has no checkout.

The only event is:

```text
Present
```

---

# 26. No Duration Tracking

V1 does not track:

```text
Arrival time
Departure time
Time spent in Masjid
```

beyond the attendance event timestamp needed for system integrity.

---

# 27. No Continuous Tracking

The app must not continuously monitor a member's location.

Location should be obtained only for the attendance action and handled according to privacy rules.

---

# 28. Attendance Timestamp

The server should record:

```text
marked_at
```

using server-controlled time.

The client clock is not authoritative.

---

# 29. Location Capture Timestamp

The client may send the time at which GPS was captured, but this is contextual information.

The server timestamp remains authoritative for the attendance event.

---

# 30. Stored Location Data

V1 should minimize persistent location storage.

The system does not require a historical GPS trail.

A design should prefer retaining only the minimum evidence necessary to validate/audit attendance.

---

# 31. Recommended Location Retention

The final implementation should evaluate whether to store:

```text
Exact latitude
Exact longitude
Accuracy
```

after validation.

Where possible, the system should retain:

```text
Validation result
Distance
Accuracy
```

rather than maintaining unnecessary long-term location history.

Any exact-coordinate retention must be justified by audit/security requirements.

---

# 32. Attendance Privacy

Location information is sensitive.

Access must be tightly controlled.

Normal Members should not be able to browse another member's raw GPS evidence.

---

# 33. No Public Location Data

The attendance system must never expose individual attendance location data publicly.

---

# 34. GPS Spoof/Mock Location

V1 explicitly does not include GPS spoof/mock-location detection.

The system should not claim that GPS attendance is fraud-proof.

The documented controls are:

```text
Precise location request
+
Accuracy check
+
Radius check
+
Server validation
+
Duplicate prevention
```

---

# 35. GPS Failure

If the device cannot obtain a usable location:

```text
Attendance is not immediately accepted as a valid online event.
```

The UI should provide a retry path.

If an offline supported workflow is used, the event may be captured locally according to offline rules.

---

# 36. Offline Attendance

V1 supports offline attendance capture.

The intent is:

```text
Location/device available
       ↓
Attendance event captured locally
       ↓
Network unavailable
       ↓
Store pending local sync item
       ↓
Network returns
       ↓
Send to server
       ↓
Server validates
       ↓
Server authoritative result
```

---

# 37. Offline Does Not Mean Offline Truth

A locally recorded attendance event is:

```text
PENDING SYNC
```

not automatically:

```text
FINAL VERIFIED ATTENDANCE
```

The server decides the authoritative result.

---

# 38. Offline Data Required

A local pending event may need:

```text
Local event ID
Authenticated user context
Jummah session/date
Latitude
Longitude
Accuracy
Client capture time
Created locally timestamp
Sync state
```

Only the minimum required information should be retained.

---

# 39. Local Event Identity

Every offline attendance event should have a unique client-generated event ID.

Example:

```text
offline-event-UUID
```

This supports idempotent synchronization.

---

# 40. Offline Sync

When connectivity returns:

```text
Pending attendance
        ↓
Sync request
        ↓
Server validates
        ↓
Accepted / Rejected / Already Recorded
```

---

# 41. Sync Idempotency

Repeating the same sync request must not create duplicate attendance.

Use:

```text
offline event ID
+
database uniqueness
+
idempotent server operation
```

---

# 42. Offline Duplicate Example

```text
Local event sent
Network times out
Client sends again
```

Result:

```text
One authoritative attendance record
```

---

# 43. Server Conflict

If the server already contains an attendance record for that member/session:

```text
Do not create a second record.
```

The client should reconcile local state with the server.

---

# 44. Offline Location Validation

The offline client may capture location evidence.

However, final acceptance remains server-authoritative after synchronization.

The server validates the submitted coordinates and accuracy according to the configured rules.

---

# 45. Offline Staleness

An offline attendance event may be synchronized later.

The implementation must define an acceptable event-age policy so that an extremely old pending local record is not silently treated as a current attendance event.

The exact acceptable sync window must be finalized during implementation.

---

# 46. Network Retry

Attendance synchronization should retry safely.

Retries must be:

```text
Bounded
Idempotent
Non-duplicating
```

---

# 47. Attendance Sync Status

Conceptual local states:

```text
PENDING_SYNC
SYNCING
SYNCED
REJECTED
CONFLICT
```

The exact local state names may vary.

---

# 48. Final Server States

Conceptually:

```text
PRESENT
REJECTED
```

A server-side attendance record should represent only an authoritative state.

---

# 49. Attendance History — Individual

An authorized member may view their own:

```text
Jummah attendance history
Meeting attendance history where applicable
```

---

# 50. Attendance History — Committee

Authorized President/Secretary views may show:

```text
Member
Jummah attendance count
Meeting attendance
Attendance records by date
```

Visibility follows role permissions.

---

# 51. Attendance Aggregate Counts

The system may show:

```text
Jummah attendance count
```

for a session/date.

Example:

```text
Friday Attendance
Present = 185
```

---

# 52. Attendance Aggregate Source

Aggregate counts should derive from authoritative attendance records.

Do not maintain manually edited attendance totals.

---

# 53. Committee Meeting Attendance

Meeting attendance is separate from Jummah attendance.

It must be linked to:

```text
Meeting ID
Member ID
Attendance record
```

---

# 54. Meeting Attendance Workflow

```text
Scheduled Meeting
      ↓
Invited/eligible members
      ↓
Meeting attendance
      ↓
Mark present/attendance
      ↓
Server record
```

The exact attendance-marking UX may be defined by the meeting feature.

---

# 55. Meeting Attendance Requirement

A meeting must exist as a scheduled meeting before its attendance can be recorded.

No anonymous meeting-attendance event is allowed.

---

# 56. Meeting Attendance Identity

Conceptual uniqueness:

```text
UNIQUE(meeting_id, member_id)
```

---

# 57. Meeting Attendance Status

V1 may support:

```text
PRESENT
ABSENT
```

or equivalent meeting-level attendance representation.

The exact UI may record only present and derive absent from invited/eligible users.

---

# 58. Meeting Attendance and GPS

V1 does not require GPS for meeting attendance.

Meeting attendance is tied to the scheduled meeting and operational attendance workflow.

Do not automatically reuse Jummah GPS logic for meetings.

---

# 59. Meeting Attendance History

Authorized users may see:

```text
Meeting
Date
Member
Present/Absent
```

according to permissions.

---

# 60. Attendance Percentage

For meetings, the system may calculate:

```text
Present members
÷
eligible/invited members
× 100
```

The denominator must be consistently defined.

---

# 61. Attendance Percentage Is Not a Score

Attendance percentage is an operational statistic.

It must not be converted into:

```text
Performance score
Member rank
Best attendee
Worst attendee
```

---

# 62. Jummah Analytics

V1 may support aggregate Jummah attendance analytics such as:

```text
Attendance count by Friday
Monthly attendance trend
```

It should not introduce unrelated prayer analytics.

---

# 63. No Prayer-by-Prayer Analytics

Do not build dashboards for:

```text
Fajr
Zohr
Asr
Maghrib
Isha
```

because those attendance types are outside V1.

---

# 64. Attendance Reminder

The notification system may remind relevant users about:

```text
Upcoming meeting
Meeting attendance
Jummah attendance
```

according to configured business rules.

---

# 65. Notification Independence

Notification failure does not alter attendance.

Example:

```text
Reminder failed
→ Attendance feature remains unchanged
```

---

# 66. Attendance Notification Privacy

Push notifications should not expose unnecessary location details.

Never send:

```text
User latitude
User longitude
GPS accuracy
```

in normal push payloads.

---

# 67. Attendance Security

Attendance operations require:

```text
Authenticated user
+
Active account
+
Appropriate role/eligibility
+
Valid session/meeting
+
Server validation
```

---

# 68. Client Trust Boundary

The client must not be trusted to submit:

```text
attendance = true
verified = true
distance = 0
valid_location = true
marked_by = another user
```

The backend derives/validates these values.

---

# 69. Backend Attendance Command

Conceptually:

```text
markJummahPresent({
  session_id,
  latitude,
  longitude,
  accuracy,
  client_event_id
})
```

The server validates everything important.

---

# 70. Meeting Attendance Command

Conceptually:

```text
markMeetingAttendance({
  meeting_id,
  member_id/current-user,
  status
})
```

The server validates:

```text
meeting exists
meeting is valid
user is authorized
duplicate does not exist
```

---

# 71. Self Attendance

For Jummah, the normal V1 flow is self-attendance:

```text
Authenticated member
        ↓
Mark Present
```

The member is the subject of their own attendance event.

---

# 72. Administrative Attendance Correction

Authorized administrative users may need to correct a mistaken attendance record.

Any such correction must be:

```text
Authorized
Audited
Historically traceable
```

The exact permissions are defined in the role/authorization model.

---

# 73. Attendance Correction

Examples:

```text
Jummah marked for wrong member
Meeting attendance correction
Duplicate resolution
Incorrect attendance date/session
```

Corrections should not silently rewrite history.

---

# 74. Attendance Audit Events

Important events include:

```text
JUMMAH_ATTENDANCE_MARKED
JUMMAH_ATTENDANCE_REJECTED where security/audit value exists
MEETING_ATTENDANCE_MARKED
ATTENDANCE_CORRECTED
ATTENDANCE_REMOVED where an authorized removal is ever supported
```

Final event naming is controlled by `AUDIT_LOG_MODEL.md`.

---

# 75. Attendance Audit Actor

Audit records should contain:

```text
Actor User ID
Actor Role where useful
Server Timestamp
Affected attendance record
```

---

# 76. GPS Validation Evidence

Where required for audit/security, the system may record safe validation evidence such as:

```text
Distance from Masjid
Reported accuracy
Validation result
```

Avoid retaining exact coordinates indefinitely unless justified.

---

# 77. Location Data Minimization

The application should not create:

```text
Location history
Heat maps of individuals
Movement trails
Background GPS logs
```

for V1.

---

# 78. Location Permission Revocation

If the user revokes location permission:

```text
Jummah online GPS attendance cannot complete normally.
```

The UI should explain the required permission without requesting unrelated permissions.

---

# 79. GPS Accuracy Poor

If reported accuracy is outside the configured threshold:

```text
Attendance rejected or asked to retry
```

The application should not silently accept uncertain coordinates.

---

# 80. GPS Outside Radius

If distance exceeds the configured radius:

```text
Attendance rejected
```

The member can retry from a valid location.

---

# 81. Radius Configuration

Only authorized administrators, specifically President under the V1 configuration model, may change the attendance radius.

The change must be audited.

---

# 82. Radius Change History

When the radius changes:

```text
Old radius
New radius
Changed By
Changed At
```

should be available in audit history.

---

# 83. Masjid Location Configuration

Masjid attendance location should be centrally configured.

If the configured point changes, it should be audited.

Historical attendance remains unchanged.

---

# 84. Attendance Session Definition

A Jummah session should be uniquely identifiable.

Possible representation:

```text
JUMMAH-2026-09-18
```

or:

```text
UUID + session_date
```

The final schema decides the exact model.

---

# 85. One Friday Per Session

The application must not accidentally create two separate attendance sessions for the same Friday without explicit administrative reason.

A uniqueness/control mechanism should exist.

---

# 86. Attendance Date and Server Time

The application should derive the relevant Jummah date/session using the system's configured time zone/business rules.

The device must not be able to arbitrarily claim another date by changing its clock.

---

# 87. Client Clock Manipulation

Client-provided time must not determine whether:

```text
Friday attendance is valid
Meeting attendance is valid
```

Server/session state is authoritative.

---

# 88. Server Session Validation

The backend should determine whether the requested attendance session is valid.

This prevents clients from submitting arbitrary old/future attendance dates.

---

# 89. Future Attendance

The client must not create a valid attendance record for a future Jummah session.

---

# 90. Backdated Attendance

Normal self-attendance should not allow arbitrary backdated submission.

Administrative correction may address legitimate historical mistakes.

---

# 91. Attendance Record Model

Conceptually:

```text
attendance
├── id
├── attendance_type
├── member_id
├── session_id / meeting_id
├── status
├── marked_at
├── validation metadata
├── created_at
└── updated_at
```

The final physical schema is defined in `DATABASE_SCHEMA.md`.

---

# 92. Attendance Type

Controlled V1 values:

```text
JUMMAH
MEETING
```

Do not add generic prayer types.

---

# 93. Attendance Status

Conceptual values:

```text
PRESENT
ABSENT
```

with technical sync/rejection states handled separately where appropriate.

---

# 94. No Attendance Duplication

Do not maintain separate unrelated tables with conflicting "attendance truth" unless required by final schema design.

The database should provide one coherent attendance model.

---

# 95. Attendance Relationships

```text
Member
  ├── Jummah Attendance
  └── Meeting Attendance

Meeting
  └── Meeting Attendance

Jummah Session
  └── Jummah Attendance
```

---

# 96. Attendance Reporting

Reports may support:

```text
Jummah count by Friday
Meeting attendance by meeting
Individual history
Monthly aggregate trends
```

---

# 97. No Individual GPS Report

Reports should not show individual raw GPS coordinates by default.

Attendance reporting focuses on:

```text
Present/absent
Date/session
Validation outcome where authorized
```

---

# 98. Attendance Export

Authorized administrative reports may include:

```text
Date
Member
Attendance type
Status
```

Raw coordinates should not be exported unless explicitly required.

---

# 99. Attendance PDF

Where attendance is included in a printable PDF:

```text
Session/Meeting
Date
Present count
Member attendance list where authorized
Generated timestamp
```

No raw GPS trail should be included.

---

# 100. Attendance Data Retention

Attendance history should be retained for operational accountability.

Do not automatically purge attendance records simply to save storage.

---

# 101. Local Offline Retention

Offline pending attendance data should be retained only as long as needed to synchronize or resolve the event.

After successful synchronization:

```text
Delete unnecessary local pending copy
```

according to secure-storage rules.

---

# 102. Secure Local Storage

Offline attendance data may contain:

```text
Location evidence
Member identity
Attendance date
```

Use platform-secure mechanisms where sensitive local storage is required.

---

# 103. Backup

The server-side attendance database should be included in standard backups.

Backup includes:

```text
Jummah sessions
Attendance records
Meeting relationships
Validation metadata
Audit references
```

---

# 104. Restore Validation

After restore, verify:

```text
Jummah session count
Attendance counts
Member attendance relationships
Meeting attendance
Duplicate constraints
Audit references
```

---

# 105. Attendance Indexing

Recommended indexes:

```text
attendance(member_id, attendance_type)
attendance(marked_at)
attendance(session_id)
attendance(meeting_id)
attendance(status)
```

The final schema should use indexes that match actual queries.

---

# 106. Attendance Query Requirements

Common queries:

```text
Has Member X attended this Jummah?
How many attended this Friday?
What is Member X's Jummah history?
Who attended Meeting Y?
What is the meeting attendance percentage?
```

The schema should support these efficiently.

---

# 107. Jummah Attendance Test Scenarios

At minimum test:

1. Valid GPS attendance.
2. Within radius.
3. Outside radius.
4. Poor accuracy.
5. Missing location permission.
6. Location unavailable.
7. Duplicate mark present.
8. Server-authoritative timestamp.
9. Future session rejection.
10. Invalid session rejection.
11. Offline capture.
12. Offline synchronization.
13. Sync retry.
14. Duplicate sync.
15. Server conflict.
16. Offline stale-event handling.
17. Radius configuration change.
18. Radius change audit.
19. Masjid-location configuration change.
20. No continuous background tracking.
21. Raw coordinate access restrictions.
22. Unauthorized attendance correction.
23. Authorized attendance correction.
24. Attendance aggregate count.
25. Historical attendance preservation.

---

# 108. Meeting Attendance Test Scenarios

At minimum test:

1. Scheduled meeting exists.
2. Member invited/eligible.
3. Mark present.
4. Duplicate attendance rejected.
5. Invalid meeting rejected.
6. Unauthorized attendance change rejected.
7. Attendance summary.
8. Attendance percentage.
9. Attendance history.
10. Meeting cancellation behavior.
11. Meeting relationship preserved.
12. Audit event created.

---

# 109. Offline Attendance Test Scenarios

At minimum test:

1. Mark present with network.
2. Mark present without network.
3. Store pending local event.
4. Network returns and syncs.
5. Sync retries after timeout.
6. Same event uploaded twice.
7. Server already has attendance.
8. Old local event becomes invalid.
9. Logout while pending event exists.
10. User changes account while pending event exists.
11. Secure local cleanup after synchronization.

---

# 110. Attendance Invariants

The following rules are mandatory:

### Invariant 1

V1 attendance includes only Jummah and scheduled committee meetings.

### Invariant 2

There is no prayer-by-prayer attendance in V1.

### Invariant 3

Jummah attendance uses current location validation.

### Invariant 4

Continuous location tracking is not performed.

### Invariant 5

No checkout is required for Jummah.

### Invariant 6

The backend is authoritative for Jummah location validation.

### Invariant 7

Reported coordinates are not trusted without server validation.

### Invariant 8

Reported accuracy is evaluated before accepting GPS attendance.

### Invariant 9

Distance is calculated server-side or through trusted backend geospatial logic.

### Invariant 10

A configured attendance radius controls proximity acceptance.

### Invariant 11

One member/session can have only one Jummah attendance record.

### Invariant 12

One member/meeting can have only one meeting attendance record.

### Invariant 13

Duplicate attendance requests cannot create duplicate records.

### Invariant 14

Offline attendance is pending until server synchronization/validation.

### Invariant 15

Offline synchronization is idempotent.

### Invariant 16

Server timestamps are authoritative.

### Invariant 17

Client clock changes cannot create arbitrary attendance dates.

### Invariant 18

Future self-attendance is rejected.

### Invariant 19

V1 does not include GPS spoof/mock-location detection.

### Invariant 20

Raw GPS data is not publicly exposed.

### Invariant 21

Location information is minimized and protected.

### Invariant 22

Attendance reminders do not determine attendance state.

### Invariant 23

Attendance data does not create performance scores or rankings.

### Invariant 24

Attendance history is preserved.

### Invariant 25

Administrative attendance corrections are authorized and audited.

### Invariant 26

Offline local data is securely handled and cleaned after successful synchronization.

---

# 111. Acceptance Criteria

The Attendance System is implementation-ready when it can:

- Support only Jummah and committee meeting attendance.
- Obtain current location for Jummah.
- Validate radius server-side.
- Validate GPS accuracy.
- Prevent duplicate Jummah records.
- Prevent duplicate meeting attendance.
- Use server-authoritative timestamps.
- Reject invalid/future attendance sessions.
- Support offline attendance capture.
- Synchronize offline attendance safely.
- Prevent duplicate sync.
- Resolve server conflicts.
- Preserve individual attendance history.
- Produce aggregate counts.
- Produce meeting attendance percentages.
- Allow authorized corrections.
- Audit important attendance changes.
- Restrict raw location information.
- Avoid continuous location tracking.
- Work correctly on supported Android/iOS devices.
- Handle location permission/network failures gracefully.

---

# 112. Implementation Boundary

This document defines attendance-specific business behavior.

The following belong elsewhere:

```text
Member identity              → MEMBER_MANAGEMENT.md
Meeting workflow             → MEETING_MANAGEMENT.md
Committee work                → COMMITTEE_WORK_MANAGEMENT.md
Authentication                → AUTHENTICATION.md
Roles/permissions             → USER_ROLES_PERMISSIONS.md
Authorization/RLS             → AUTHORIZATION_MODEL.md
Audit trail                   → AUDIT_LOG_MODEL.md
Notifications                 → NOTIFICATION_SYSTEM.md
Database tables               → DATABASE_SCHEMA.md
Data relationships            → DATA_RELATIONSHIPS.md
Privacy                       → DATA_PRIVACY.md
Mobile architecture           → APPLICATION_ARCHITECTURE.md
Storage                       → STORAGE_STRATEGY.md
Testing                       → TESTING_STRATEGY.md
```

---

# 113. Related Documents

- `PROJECT_OVERVIEW.md`
- `PRODUCT_REQUIREMENTS.md`
- `FEATURE_SCOPE.md`
- `USER_ROLES_PERMISSIONS.md`
- `AUTHENTICATION.md`
- `MEMBER_MANAGEMENT.md`
- `COMMITTEE_DATA_MODEL.md`
- `COMMITTEE_WORK_MANAGEMENT.md`
- `MEETING_MANAGEMENT.md`
- `NOTIFICATION_SYSTEM.md`
- `AUDIT_LOG_MODEL.md`
- `DATABASE_SCHEMA.md`
- `DATA_RELATIONSHIPS.md`
- `SECURITY_ARCHITECTURE.md`
- `AUTHORIZATION_MODEL.md`
- `DATA_PRIVACY.md`
- `REPORTING_AND_AUDIT.md`
- `TESTING_STRATEGY.md`
- `TEST_PLAN.md`

---

## Document Status

**Attendance System — V1 Implementation Baseline**

This document defines the authoritative attendance behavior for Masjid-e-Mamoor 2.

All attendance implementation must preserve the scope, GPS validation, duplicate prevention, offline synchronization, privacy, and history invariants defined here.
