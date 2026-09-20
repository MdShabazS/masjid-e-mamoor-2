# Masjid-e-Mamoor 2 — Data Privacy

**Document Status:** V1 Privacy Baseline  
**Version:** 1.0  
**Product:** Masjid-e-Mamoor 2 Internal Management Application  
**Scope:** V1  
**Platforms:** Web, Android, iOS  
**Related Documents:** SECURITY_REQUIREMENTS.md, AUTHORIZATION_MODEL.md, SECURITY_ARCHITECTURE.md, AUTHENTICATION.md, DATABASE_SCHEMA.md, ATTENDANCE_SYSTEM.md, FINANCE_SYSTEM.md, DONATION_SYSTEM.md, STORAGE_STRATEGY.md  
**Last Updated:** 2026-09-17

---

# 1. Purpose

This document defines the privacy requirements for Masjid-e-Mamoor 2.

The application is an internal management system for one Masjid. It processes personal, attendance, contribution, financial, committee-work, and operational information.

The privacy objective is:

```text
Collect what is needed
→ use it only for the intended application purpose
→ restrict access
→ retain it appropriately
→ avoid unnecessary data collection
```

---

# 2. Privacy Principles

V1 follows these principles:

1. Data minimization.
2. Purpose limitation.
3. Role-based access.
4. Least-privilege access.
5. Secure handling.
6. Accurate records.
7. Limited retention of unnecessary technical data.
8. No continuous location tracking.
9. No unnecessary public exposure.
10. Historical financial/accountability records are not deleted merely to reduce storage.

---

# 3. Product Privacy Boundary

Masjid-e-Mamoor 2 V1 is intended for internal Masjid administration.

The V1 product does not include:

```text
Public member directory
Public donation leaderboard
Public financial dashboard
Public attendance list
Public member search
Public committee performance rankings
Public personal profiles
Multi-Masjid public discovery
```

Private internal data must not become publicly visible through normal application screens.

---

# 4. Data Categories

V1 may contain the following data categories:

```text
Identity/Profile Data
Authentication Data
Membership Data
Referral Data
Contribution Data
Donation/Payment Data
Financial Data
Attendance Data
Committee Work Data
Meeting Data
Audit Data
File/Data Attachments
Notification Data
Technical/Operational Data
```

---

# 5. Identity and Profile Data

Possible fields:

```text
Full name
Mobile number
Email
Photo
Internal member/user identifiers
Role
Account status
```

### Purpose

Used for:

```text
Identification
Authentication association
Membership management
Role-based access
Internal communication
```

Only collect optional fields when they provide a defined application benefit.

---

# 6. Authentication Data

Authentication is based on mobile OTP.

The application may process:

```text
Mobile number
Authentication/session identifiers
Authentication timestamps
Rate-limit/security metadata
```

OTP values themselves must not be stored as ordinary application data.

Authentication secrets/tokens must not be exposed to other users.

---

# 7. Membership Data

Member records may include:

```text
Name
Mobile
Email where provided
Photo where provided
Registration date
Active/inactive state
Primary referrer
Agreed monthly contribution
Effective month
```

Membership data is internal Masjid data.

---

# 8. Referral Data

A member may have one primary referrer.

Store:

```text
Referred member
Primary referrer
Attribution date
Attribution/correction metadata where required
```

Purpose:

```text
Internal committee contribution tracking
Referral accountability
```

Referral data must not be used to create public rankings.

---

# 9. Contribution Data

The application may process:

```text
Agreed monthly contribution
Effective month
Expected monthly amount
Pending/outstanding state
Verified amount
Monthly donation history
```

Important privacy distinction:

```text
Agreed contribution
≠
Target
≠
Quota
≠
Public commitment
```

The contribution amount is internal member information unless explicitly presented to the member themselves or an authorized internal role.

---

# 10. Donation and Payment Data

Possible donation/payment data includes:

```text
Amount
Donation type
Month
Payment status
Payment date
Verification date
Payment reference/transaction reference
Method
Masjid account destination
Verifier
Internal transaction ID
```

### Purpose

Used for:

```text
Donation tracking
Financial accounting
Verification
Audit
Member history
Reporting
```

This is sensitive internal financial information.

---

# 11. Additional Donations

Additional donations are recorded as:

```text
General Donation
```

No purpose/category selection is required in V1.

The member can see their own additional donation history.

Other members cannot normally see it.

---

# 12. Anonymous Donations

V1 supports anonymous donations.

The record may contain:

```text
Anonymous donor designation
Amount
Date
Method
Account
Reference
Verifier
Financial transaction information
```

No member profile should be attached unless the donation was intentionally recorded as belonging to a known member.

Anonymous designation must not become a hidden identity inference mechanism.

---

# 13. Jummah Cash Collection Privacy

Jummah cash collection is recorded as one total collection record.

V1 does not require:

```text
Individual donor names
Individual donor mobile numbers
Individual donor contribution history
```

for the physical Jummah cash collection.

The collection total is part of internal financial records.

---

# 14. Financial Account Data

The application may store:

```text
Account name
Account type
Opening balance
Current calculated balance
Bank name
Account name where applicable
Last four digits where applicable
UPI ID
Account status
```

Sensitive bank information should be minimized.

Only the last four account digits are required for bank-account display in V1.

---

# 15. UPI Data Privacy

The application stores the Masjid's active UPI configuration.

Requirements:

- Only authorized users can view/change it according to authorization rules.
- Member-facing payment flows may show the necessary payment destination.
- Historical records retain appropriate financial context.
- UPI changes are auditable.
- UPI information must not be exposed to unauthorized users.

---

# 16. Expense Data

Expense records may include:

```text
Expense title
Description
Category
Amount
Date
Payment information
Bill
Payment proof
Reference
Created by
Updated by
Status
```

Expense records are internal Masjid financial information.

---

# 17. Financial Documents

Files may include:

```text
Bills
Invoices
Payment proofs
```

These documents can contain sensitive information.

Requirements:

- Store as private files.
- Restrict access through application authorization.
- Do not create unnecessary public URLs.
- Do not copy the same document into multiple storage locations.
- Do not place real financial documents in GitHub.

---

# 18. Committee Work Data

Committee work may include:

```text
Task title
Description
Responsible member
Priority
Deadline
Progress
Completion note
Related member/referral
Meeting/decision relationship
Attachments
Created/updated timestamps
```

Purpose:

```text
Operational coordination
Committee accountability
Work history
Follow-up tracking
```

Work records are internal.

---

# 19. Meeting Data

Meeting information may include:

```text
Title
Date/time
Location
Agenda
Invited members
Attendance
Decisions/minutes
Follow-up tasks
Responsible members
Completion status
```

Meeting information should be available only to authorized internal users.

No public meeting archive is part of V1.

---

# 20. Attendance Data

V1 attendance contains:

```text
Jummah attendance
Scheduled committee meeting attendance
```

The application does not include:

```text
Daily prayer attendance
Continuous location tracking
Prayer-by-prayer GPS history
```

---

# 21. GPS Privacy

GPS is used for Jummah attendance validation.

Privacy requirements:

- Request location only when needed for attendance.
- Do not continuously track the member.
- Do not collect a long-term movement history.
- Use the minimum location data necessary to validate attendance.
- Do not expose raw coordinates to normal members.
- Keep location-related records restricted to authorized purposes.

---

# 22. GPS Data Retention

The system should retain only what is required to:

```text
Validate the attendance
Detect duplicate attendance
Support legitimate audit/dispute handling
```

The application should not maintain an unnecessary historical movement database.

---

# 23. Offline Attendance Privacy

Offline attendance data may temporarily exist on the member's device until synchronized.

Requirements:

- Store only the minimum pending information.
- Use secure local storage where available.
- Remove successfully synchronized temporary data when no longer needed.
- Do not leave pending attendance data unnecessarily accessible to other users of the device.

---

# 24. Member Privacy Boundary

A normal Member may access:

```text
Own profile
Own donation/payment records
Own contribution information
Own attendance
```

A Member should not access:

```text
Another member's donation history
Another member's contribution amount
Internal referral information unrelated to them
Internal audit data
Private financial documents
Committee work records unrelated to permitted participation
```

---

# 25. Committee Member Privacy Boundary

Committee Members may need access to limited member information for legitimate referral/work purposes.

Access should be limited to:

```text
Information needed to perform the relevant committee task
Their referral/contribution activity
Authorized work context
```

Do not expose the entire member database unnecessarily.

---

# 26. Finance Privacy Boundary

Finance requires broader access to financial information.

This can include:

```text
Transactions
Donations
Payments
Expenses
Accounts
UPI configuration
Supporting financial files
Relevant financial audit information
```

Finance access does not automatically grant unrestricted access to unrelated administrative records.

---

# 27. Auditor Privacy Boundary

Auditor may review:

```text
Financial records
Supporting financial documents
Reports
Audit records
```

Auditor is read-only for financial operations.

---

# 28. Secretary Privacy Boundary

Secretary may access broader operational data required for:

```text
Members
Meetings
Tasks
Attendance
Contribution administration
Jummah collection entry
Relevant reporting
```

Secretary does not automatically receive unrestricted Finance information.

---

# 29. President Privacy Boundary

President has broad administrative access needed to manage the Masjid application.

Even so:

```text
Access should remain purposeful.
Data should not be exported or shared unnecessarily.
```

Broad access is an authorization capability, not a requirement to expose every dataset on every screen.

---

# 30. Privacy and Notifications

Notifications should disclose the minimum necessary information.

Prefer:

```text
"Your monthly donation is pending."
```

rather than exposing unnecessary sensitive payment details.

Avoid putting into push/SMS notifications:

```text
Full financial account details
Raw GPS data
Private document contents
Authentication secrets
Unnecessary member information
```

---

# 31. SMS/WhatsApp Privacy

Where external messaging providers are used:

- Share only necessary message content.
- Do not send confidential internal audit details.
- Do not send private documents unless a secure, authorized delivery method is deliberately implemented.
- Provider credentials remain server-side.
- Provider delivery is not treated as business truth.

---

# 32. Notification Failure and Privacy

If notification delivery fails:

```text
The underlying business record remains unchanged.
```

Example:

```text
SMS failed
≠
Donation cancelled
```

---

# 33. Search Privacy

Search must respect authorization.

Do not allow a user to discover another member's sensitive information simply by searching a name or mobile number.

Search results must be filtered server-side.

---

# 34. Report Privacy

Reports may contain concentrated amounts of sensitive information.

Requirements:

- Apply the same authorization as underlying data.
- Do not expose hidden records through report generation.
- Generated reports should be treated as sensitive documents.
- Print/export functions must require appropriate access.

---

# 35. PDF Privacy

Financial/audit PDFs may contain:

```text
Balances
Transactions
Donations
Expenses
Supporting records
Audit information
```

Requirements:

- Generate only for authorized users.
- Do not publish automatically to public URLs.
- Use controlled temporary/private access.
- Do not retain duplicate generated PDFs unnecessarily.
- Printed copies are operationally sensitive and should be handled accordingly.

---

# 36. Audit Log Privacy

Audit logs can contain:

```text
Actor
Action
Entity
Timestamp
Reason
Before/after context
```

Because audit logs may reveal sensitive operational behavior, access must be restricted.

Ordinary members must not access internal audit logs.

---

# 37. Technical Metadata Privacy

Technical data may include:

```text
Timestamps
IP/network metadata where available
Device/application metadata
Error logs
Request IDs
```

Only retain what is useful for:

```text
Security
Reliability
Debugging
Abuse prevention
```

Do not collect unnecessary device tracking data.

---

# 38. Data Minimization Rules

Do not collect information merely because the application could.

Before adding a field, ask:

```text
What business function requires it?
Who needs it?
How long does it need to exist?
Can the function work without it?
```

If there is no clear answer, the field should not be added to V1.

---

# 39. No Continuous Tracking

The application must not implement continuous location tracking for committee members or members in V1.

Attendance validation is event-based.

---

# 40. No Public Financial Exposure

V1 must not expose:

```text
Masjid bank balances publicly
Member donation amounts publicly
Member contribution amounts publicly
Committee contribution totals publicly
Financial transaction list publicly
Audit logs publicly
```

---

# 41. No Public Committee Ranking

The application must not create public or internal ranking features such as:

```text
Best donor
Best referrer
Top committee member
Donation leaderboard
Task leaderboard
Performance score
```

Operational reports should show factual activity without turning member data into rankings.

---

# 42. Data Accuracy

Privacy includes maintaining correct data.

Authorized corrections should:

```text
Update the correct record
Preserve required history
Record actor/time where required
Avoid creating duplicate identities
```

Wrong attribution or incorrect financial values should not be silently overwritten.

---

# 43. Duplicate Identity Protection

Mobile number is a key duplicate-prevention mechanism for member registration.

If the mobile number already exists:

```text
Do not create a duplicate member.
```

This protects:

```text
Donation history
Attendance history
Referral history
Identity integrity
```

---

# 44. Access Revocation

When a user's account becomes disabled:

```text
Protected application access must stop.
```

Historical records created by that user do not disappear.

This preserves financial and committee accountability history.

---

# 45. Data Retention Principles

Retain records when necessary for:

```text
Financial history
Audit
Committee accountability
Member donation history
Legal/administrative needs where applicable
```

Do not retain data that has no legitimate ongoing purpose.

---

# 46. Financial History Retention

Financial records must not be deleted merely because:

```text
Storage is limited
A new year started
A report was generated
A transaction is old
```

Historical financial integrity takes priority.

---

# 47. Committee Work History Retention

Completed committee work should remain available according to authorization.

Do not remove historical work merely to save storage.

This is part of the product's accountability purpose.

---

# 48. Temporary Data

Temporary data may include:

```text
Pending offline attendance
Temporary upload state
Short-lived generated report files
Cached non-sensitive UI state
```

Temporary data should be removed/expired when no longer needed.

---

# 49. Storage Minimization

To minimize storage without compromising history:

```text
Store one authoritative financial record.
Reference related records instead of duplicating them.
Avoid duplicate document uploads.
Compress images where appropriate.
Avoid permanently storing generated PDFs.
Remove unnecessary temporary files.
```

Do not optimize storage by deleting required financial/work history.

---

# 50. Real Data in Development

Production member/financial data should not be copied into development environments unless specifically necessary and properly protected.

Prefer:

```text
Synthetic test data
Anonymized data
Minimal test records
```

Do not use real financial documents in ordinary development/testing repositories.

---

# 51. GitHub Privacy

Never commit:

```text
Real member lists
Real donation records
Real bank details
Real financial documents
Real OTPs
Production secrets
Production database dumps
```

`.env` files containing secrets must remain outside the repository.

---

# 52. Third-Party Privacy Boundaries

The application may interact with:

```text
Supabase
Expo/FCM/APNs
SMS/WhatsApp provider
UPI/payment ecosystem
Vercel
```

Each external service is a separate trust boundary.

Only required data should be sent to each provider.

Provider credentials must remain confidential.

---

# 53. External Provider Data Minimization

Before integrating a third-party service, define:

```text
Data sent
Purpose
Storage location
Retention
Access
Failure behavior
```

Do not send the full member record when one field is sufficient.

---

# 54. UPI Privacy Boundary

UPI payment initiation may require:

```text
Amount
Payment destination
Payment context/reference
```

Only the minimum necessary information should be embedded in payment requests.

Finance verification remains authoritative.

---

# 55. OTP Privacy Boundary

OTP messages should contain only what is needed for login verification.

The app must not expose OTP contents to other users or store them as ordinary member data.

---

# 56. Privacy-Safe Error Messages

Errors must not reveal unnecessary private information.

Avoid messages such as:

```text
"Member X's account exists and is linked to Y."
```

Prefer safe responses where appropriate.

---

# 57. Privacy and Account Search

If a duplicate mobile is detected, the internal workflow may identify an existing record to an authorized staff user, but the application must avoid unnecessarily exposing unrelated member details.

---

# 58. Privacy and Referral Attribution

Referral attribution is internal operational data.

Only authorized users should see the relationship where required.

Correction history should be auditable without exposing unnecessary internal details to ordinary members.

---

# 59. Privacy and Contribution Changes

When an authorized role changes the agreed monthly contribution:

```text
Previous amount
New amount
Effective month
Actor
Timestamp
```

should be retained where required for accountability.

Historical monthly records remain unchanged.

---

# 60. Privacy and Outstanding Payments

A member should be able to see their own outstanding months.

An ordinary member should not be able to query outstanding balances belonging to another member.

---

# 61. Privacy and Overpayment

When a member pays more than outstanding monthly dues:

```text
Outstanding dues
+
General Donation
```

may be visible to that member through their own donation history.

The system should not publicly display the overpayment or use it in ranking.

---

# 62. Privacy and Anonymous Donations

Anonymous donation records should not expose donor identity merely because the financial entry is visible to authorized reviewers.

The anonymous designation must be preserved.

---

# 63. Privacy and Jummah Attendance

Members may see their own attendance history.

Broader attendance reports are restricted to authorized internal roles.

Avoid displaying a public list of who attended Jummah.

---

# 64. Privacy and Meeting Attendance

Meeting attendance is internal committee information.

It should be visible only to users with a legitimate role/meeting relationship.

---

# 65. Privacy and Committee Work

Task history can identify:

```text
who was responsible
what work was assigned
when it was completed
```

This is internal accountability data.

Access should be role-controlled.

---

# 66. Data Export Privacy

Export functions can increase privacy risk.

Requirements:

- Apply normal authorization.
- Avoid exporting fields unnecessary for the chosen report.
- Do not automatically save exports to public locations.
- Treat downloaded reports as confidential internal files.

---

# 67. Print Privacy

The dedicated Masjid laptop/printer may print financial reports.

Users must ensure printed documents are not left unattended.

The application should make report titles/periods clear so printed documents are identifiable.

---

# 68. Device Privacy

The application should minimize confidential data cached locally.

Particularly protect:

```text
Financial documents
Member donation records
Attendance records
Authentication credentials
```

Logout should prevent further application access to protected data.

---

# 69. Privacy During Offline Use

Offline functionality is limited.

The system should not create a local full copy of the Masjid database.

For V1, offline support is primarily for:

```text
Jummah attendance capture pending synchronization
```

---

# 70. Privacy and Backups

Backups may contain sensitive application data.

Therefore:

```text
Restrict backup access
Secure backup credentials
Do not expose backups publicly
Do not put backups into GitHub
```

---

# 71. Privacy and Monitoring

Monitoring/logging should collect enough information to operate the system without turning logs into a duplicate personal-data database.

Avoid logging:

```text
OTP values
Auth tokens
Full private documents
Unnecessary raw GPS
Unnecessary financial details
```

---

# 72. Privacy Incident Response

If unauthorized disclosure is suspected:

```text
Identify
→ contain
→ investigate
→ preserve relevant logs
→ correct access issue
→ assess affected data
→ document actions
```

Production incident handling must be coordinated by the responsible administrator/technical operator.

---

# 73. Access Review

Authorized administrators should periodically review:

```text
Active users
Disabled users
Roles
Finance access
Audit access
Broad internal member access
```

Remove unnecessary access promptly.

---

# 74. Privacy by Design

Privacy must be considered during:

```text
Database design
API design
UI design
File storage
Notifications
Reports
Offline storage
Logging
Testing
Deployment
```

Privacy fixes should not be treated as only a frontend concern.

---

# 75. Privacy Testing Requirements

At minimum test:

```text
Member sees only own financial history
Member cannot view another member
Committee Member cannot access unrestricted financial data
Auditor cannot mutate financial data
Unauthorized user cannot open private documents
Private file URL cannot be used without authorization
Raw GPS is not exposed to normal members
Reports respect role restrictions
Search respects role restrictions
Export respects role restrictions
Logout removes protected application access
Disabled users cannot access protected data
```

---

# 76. Privacy Acceptance Criteria

V1 privacy is acceptable when:

- Data fields have defined purposes.
- Unnecessary personal fields are not collected.
- Member data is role-restricted.
- Donation data is role-restricted.
- Financial data is role-restricted.
- Private files are protected.
- GPS is event-based and not continuous.
- GPS data is minimized.
- Attendance records are private.
- Audit records are restricted.
- Reports/exports respect authorization.
- Notifications minimize sensitive content.
- Offline support does not create a full local database.
- Real production data is not placed in GitHub.
- Secrets are not stored in the repository.
- Development environments use synthetic/anonymized data where practical.
- Historical financial/work records remain intact.
- Disabled-user access is revoked.
- Privacy/security incidents have a documented response process.

---

# 77. Privacy Non-Goals for V1

The application does not require:

```text
Public social profiles
Public member directory
Continuous member location tracking
Public attendance maps
Public donation rankings
Facial recognition
Biometric identity database
Behavioral advertising
Cross-app user profiling
Unnecessary analytics based on personal activity
```

---

# 78. Privacy Invariants

### Invariant 1

Collect only data with a defined V1 purpose.

### Invariant 2

A user's authentication does not grant access to every Masjid record.

### Invariant 3

A Member can access their own protected records, not another member's records.

### Invariant 4

Payment requests are not equivalent to verified payments.

### Invariant 5

Attendance GPS is event-based, not continuous tracking.

### Invariant 6

Raw GPS coordinates are not shown to normal members.

### Invariant 7

Private financial documents are not public files.

### Invariant 8

Reports cannot bypass record-level privacy controls.

### Invariant 9

Exports cannot bypass authorization.

### Invariant 10

Notifications do not become a source of sensitive-data leakage.

### Invariant 11

Historical financial and committee-work records are not removed solely for storage optimization.

### Invariant 12

Disabled users lose protected access while their historical records remain intact.

### Invariant 13

Production secrets and real member data are never committed to GitHub.

### Invariant 14

Offline attendance does not create a full local copy of Masjid data.

### Invariant 15

Anonymous donations remain anonymous in application records.

### Invariant 16

No public ranking is derived from member donation, referral, or work data.

---

# 79. Final Privacy Rule

For every new data field or integration:

```text
Why is it needed?
→ Who needs it?
→ What is the minimum data required?
→ How is access protected?
→ How long is it needed?
→ Can it be removed?
```

A field that cannot satisfy this purpose/necessity test should not be added to V1.

---

# 80. Related Documents

- `SECURITY_REQUIREMENTS.md`
- `AUTHORIZATION_MODEL.md`
- `SECURITY_ARCHITECTURE.md`
- `AUTHENTICATION.md`
- `DATABASE_SCHEMA.md`
- `DATA_RELATIONSHIPS.md`
- `FINANCIAL_DATA_MODEL.md`
- `DONATION_SYSTEM.md`
- `PAYMENT_SYSTEM.md`
- `FINANCE_SYSTEM.md`
- `EXPENSE_SYSTEM.md`
- `COMMITTEE_WORK_MANAGEMENT.md`
- `MEETING_MANAGEMENT.md`
- `ATTENDANCE_SYSTEM.md`
- `NOTIFICATION_SYSTEM.md`
- `REPORTING_AND_AUDIT.md`
- `INTERNATIONALIZATION.md`
- `STORAGE_STRATEGY.md`
- `BACKUP_AND_RECOVERY.md`
- `MONITORING.md`
- `TESTING_STRATEGY.md`
- `TEST_PLAN.md`
- `ACCEPTANCE_CRITERIA.md`

---

## Document Status

**Data Privacy — V1 Privacy Baseline**

This document defines the privacy requirements for Masjid-e-Mamoor 2 V1. Privacy protections must be implemented at the database, backend, storage, notification, frontend, mobile, reporting, logging, and operational layers.
