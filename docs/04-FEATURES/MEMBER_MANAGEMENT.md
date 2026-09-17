# Masjid-e-Mamoor 2 — Member Management

**Document Status:** V1 Implementation Baseline  
**Version:** 1.0  
**Product:** Masjid-e-Mamoor 2 Internal Management Application  
**Scope:** V1  
**Primary Related Areas:** Authentication, Donations, Committee Referrals, Financial Audit  
**Last Updated:** 2026-09-17

---

# 1. Purpose

This document defines the V1 member-management system for Masjid-e-Mamoor 2.

The member system is responsible for:

- Registering Masjid members
- Linking members to authenticated users where applicable
- Recording the primary referring Committee Member
- Preventing duplicate members
- Managing member profiles
- Managing the agreed monthly contribution amount
- Preserving contribution history
- Supporting monthly donation records
- Supporting additional donations
- Showing appropriate member-level information
- Preserving referral and contribution attribution
- Supporting internal committee follow-up

The core principle is:

> A member is a stable Masjid identity whose profile and financial history remain traceable over time.

---

# 2. V1 Scope

V1 member management is for the single Masjid:

```text
Masjid-e-Mamoor 2
```

V1 does not include:

- Public Masjid discovery
- Multi-Masjid selection
- Public membership marketplace
- Public member directory
- Multiple referral credits
- Donation targets or quotas
- Public donor rankings
- Complex CRM pipelines

---

# 3. Member Management Principles

1. Each member has one stable identity.
2. Mobile number is the primary duplicate-prevention identifier.
3. One primary referrer is supported in V1.
4. Referral attribution is separate from financial verification.
5. Member history must remain intact when profile details change.
6. Monthly contribution amounts apply from an effective month.
7. Historical monthly records are never rewritten by future configuration changes.
8. Members cannot alter their own fixed monthly contribution amount.
9. Authorized staff can correct member information according to role permissions.
10. Financial history belongs to the financial model and must not be duplicated as editable member data.
11. Deactivation should preserve history.
12. Member deletion must not cascade into historical finance, committee, meeting, or audit records.

---

# 4. Member Identity Model

Conceptually:

```text
Member
│
├── Stable Member ID
├── Mobile Number
├── Full Name
├── Email
├── Photo
├── Active Status
├── Primary Referrer
├── Contribution Terms
└── Historical Activity
```

The exact physical schema is defined in:

```text
DATABASE_SCHEMA.md
```

---

# 5. Member ID

Every member must have a stable, system-generated identifier.

Example:

```text
MEM-2026-000001
```

The exact display format may change.

Database relationships should use a UUID or equivalent stable primary key.

---

# 6. Mobile Number

Mobile number is the primary identity/deduplication field for member creation.

The application must normalize the number consistently before comparison.

For India, the implementation should use a single canonical representation.

Example conceptual form:

```text
+91XXXXXXXXXX
```

---

# 7. Mobile Number Uniqueness

The system must prevent duplicate member identities for the same normalized mobile number.

Example:

```text
9876543210
+91 98765 43210
+919876543210
```

These should resolve to the same canonical number during validation where they represent the same phone.

The final normalization rules must be implemented consistently across web, Android, iOS, and backend services.

---

# 8. Member Registration Sources

A member may enter the system through:

```text
Committee Member referral
Authorized administrative creation
Authenticated self-onboarding where supported by the final product flow
```

V1's primary operational registration flow is Committee Member referral.

---

# 9. Referral Registration Flow

```text
Committee Member
      ↓
Meet person
      ↓
Collect name + mobile
      ↓
Search normalized mobile
      ↓
Existing member?
   ┌────┴────┐
  Yes        No
   │          │
Use existing  Create member
record        record
   │          │
   └────┬─────┘
        ▼
Primary referrer attribution
        ↓
Profile confirmation
        ↓
Member available in system
```

---

# 10. No President Approval for Referral Registration

A Committee Member can register a new member directly.

V1 does not require President approval for the basic referral/registration step.

The President retains the ability to correct member/referral data through authorized administrative controls.

---

# 11. Existing Member Handling

If the mobile number already exists:

```text
Do not create duplicate member.
```

The system should instead:

- Show that the member already exists to the authorized user.
- Follow the appropriate existing-member workflow.
- Preserve the original member ID.
- Avoid creating a second referral relationship.

---

# 12. Existing Member Referral

V1 uses one primary referrer.

If an existing member is encountered:

```text
Existing Member
      ↓
No duplicate member creation
      ↓
No automatic second referral credit
```

Any correction to referral attribution follows the approved President-controlled process.

---

# 13. Primary Referrer

A member may have:

```text
primary_referrer_id
```

or an equivalent referral relation.

This identifies the Committee Member who originally referred the member.

---

# 14. Primary Referrer Uniqueness

V1 supports only one primary referrer per member.

Do not add:

```text
co-referrer
secondary referrer
shared credit
multi-level referral
```

to V1.

---

# 15. Referral Attribution Correction

President may correct incorrect referral attribution.

The correction must record:

```text
Previous Referrer
New Referrer
Changed By
Changed At
Reason where required
```

The audit model handles the permanent change record.

---

# 16. Referral Is Not Payment Verification

The following must remain separate:

```text
Member referred
Member has monthly contribution agreement
Member generated payment link
Member made payment
Finance verified payment
```

Only the last state creates verified financial contribution.

---

# 17. Member Profile Fields

V1 member profile may include:

```text
Member ID
Full Name
Mobile Number
Email (optional)
Photo (optional)
Active/Inactive Status
Primary Referrer
Created At
Updated At
```

Additional fields should not be added unless required by the product.

---

# 18. Full Name

Full name is required for a normal member profile.

The member's name may be corrected by an authorized user.

Historical financial records should not depend on the name as the identity key.

---

# 19. Email

Email is optional in V1.

It may be used for profile/contact purposes but is not the primary login identity.

Changing email must not create a new member record.

---

# 20. Profile Photo

Photo is optional.

Member registration must work without a photo.

Photo storage should follow the application storage/privacy policy.

---

# 21. Active Status

Members should support a lifecycle state such as:

```text
ACTIVE
INACTIVE
```

The exact stored representation may use:

```text
is_active
```

or another equivalent field.

---

# 22. Member Deactivation

Deactivation should preserve:

- Member identity
- Referral relationship
- Donation history
- Payment history
- Attendance history
- Committee-related history
- Audit records

Deactivation means:

```text
No longer operationally active
```

not:

```text
Historically erased
```

---

# 23. Reactivation

An authorized user may reactivate a previously inactive member according to the role-permission model.

The original member ID remains unchanged.

---

# 24. Member Deletion

V1 should avoid ordinary hard deletion of members.

Historical financial and committee relationships make member deletion dangerous.

Where removal is needed operationally, prefer:

```text
Inactive
```

rather than destructive deletion.

---

# 25. Member History Preservation

A member's historical record should survive changes to:

- Name
- Email
- Photo
- Monthly contribution terms
- Referrer attribution
- Active status

History must continue to reference the same stable Member ID.

---

# 26. Member Search

Authorized users may search members by:

```text
Name
Mobile number
Member ID
```

Search results should be role-limited.

---

# 27. Member Filtering

Where useful, member lists may filter by:

```text
Active / Inactive
Referrer
Monthly contribution status
Payment status
Registration period
```

Financial filters must respect the financial permission model.

---

# 28. Member Data Visibility

Normal Members should only access the member information permitted to them.

They should not receive unrestricted access to:

- Other members' contact details
- Other members' donation history
- Referral attribution for unrelated members
- Financial audit details

---

# 29. Committee Member Visibility

Committee Members may access member information needed for:

- Referrals
- Follow-up work
- Contribution agreement management where permitted
- Assigned committee activity

The final field-level visibility follows the role permission model.

---

# 30. President Visibility

President has broad administrative access to member records, subject to the security model.

President can:

- Review members
- Correct member data
- Correct referral attribution
- Manage activity status
- Review member-related work context

---

# 31. Secretary Visibility

Secretary has broad operational access where defined in the role model.

This includes the ability to manage/change agreed monthly contribution amounts as specified by V1.

Secretary is not equivalent to unrestricted Finance authority.

---

# 32. Finance Visibility

Finance may access member information required for:

- Donation verification
- Payment allocation
- Contribution records
- Financial reporting

Finance may update the agreed monthly amount according to the locked V1 rule.

---

# 33. Member Self-Access

An authenticated Member may view their own relevant information, including where applicable:

- Own profile
- Own monthly donation records
- Own additional donation history
- Own attendance history

The member must not be able to modify protected financial configuration.

---

# 34. Monthly Contribution Agreement

A member may have an agreed monthly contribution amount.

Example:

```text
Member A
Agreed monthly amount = ₹500
```

This is a contribution agreement.

It is not:

```text
Target
Quota
Penalty
Performance requirement
```

---

# 35. Who Can Set the Monthly Amount

V1 authorized users:

```text
Committee Member
President
Secretary
Finance
```

The Member cannot set or change their own fixed monthly contribution amount.

---

# 36. Contribution Amount Data Model

Do not store only one mutable field such as:

```text
member.monthly_amount
```

without historical context.

The model should support effective periods.

Conceptually:

```text
Member
  ↓
Contribution Terms
  ├── Effective From
  ├── Amount
  └── Changed By
```

---

# 37. Effective Month

When the agreed amount changes, an effective month is selected.

Example:

```text
Old amount = ₹500
New amount = ₹700
Effective from = September 2026
```

Then:

```text
July → ₹500
August → ₹500
September → ₹700
```

---

# 38. Historical Monthly Records

Past monthly donation records must retain their original expected amount.

Example:

```text
July = ₹500
August = ₹500
September = ₹700
```

Changing September does not rewrite July or August.

---

# 39. Contribution Term Audit

Every change to the agreed monthly amount must be auditable.

Record:

```text
Previous amount
New amount
Effective month
Changed by
Changed at
Reason where needed
```

---

# 40. Monthly Donation Generation

The system automatically creates the next month's expected record.

Conceptually:

```text
Current month closes
        ↓
Next month generated
        ↓
Applicable contribution term applied
        ↓
Monthly donation record created
```

The generated record should inherit the amount applicable to that month.

---

# 41. Monthly Donation Records

Each member/month should have one monthly donation record.

Conceptual uniqueness:

```text
UNIQUE(member_id, donation_month)
```

---

# 42. Monthly Donation Status

Conceptual states:

```text
PENDING
PAID
```

A system may additionally represent current/expected status as needed.

The business meaning must remain clear.

---

# 43. Pending Monthly Donation

If the monthly amount has not been fully verified:

```text
Status = Pending
```

The monthly record remains in history.

It is not deleted.

---

# 44. Missed Month

If a member does not pay in a month:

```text
That month's record remains outstanding.
```

The system should not silently shift or erase the month.

---

# 45. Multiple Outstanding Months

If several months remain unpaid:

```text
July   ₹500 Pending
August ₹500 Pending
September ₹500 Pending
```

The member may settle the full outstanding amount in one payment.

---

# 46. FIFO Settlement

Combined payment is allocated:

```text
Oldest unpaid month first
```

Example:

```text
₹1,500 received

July      → ₹500
August    → ₹500
September → ₹500
```

---

# 47. Partial Monthly Payment

V1 does not treat a partial amount as completing the month.

Example:

```text
Due = ₹500
Received = ₹300
```

Result:

```text
Month remains unpaid/incomplete
```

The system must not mark the month Paid.

---

# 48. Overpayment

When payment exceeds outstanding complete monthly dues:

```text
Outstanding monthly dues
        +
Additional General Donation
```

Example:

```text
Outstanding = ₹1,000
Payment = ₹1,200

₹1,000 → monthly dues
₹200   → General Donation
```

---

# 49. Future Month Rule

Overpayment must not:

- Advance future months
- Reduce future monthly amount
- Mark future months paid
- Modify future contribution terms

Extra amount is a separate General Donation.

---

# 50. Additional Donation

A member can make an additional donation outside the fixed monthly contribution.

V1 category:

```text
General Donation
```

No purpose selection is required.

---

# 51. Additional Donation Separation

Additional donation does not modify:

```text
Monthly agreed amount
Future monthly dues
Contribution term
```

It is separate financial activity.

---

# 52. Payment Link

After member registration and confirmation of the agreed amount, the payment-link workflow may create/send a payment link.

The link is associated with:

```text
Member
Donation month or payment purpose
Amount
Active UPI configuration at generation time
Expiry
```

---

# 53. Payment Link Does Not Mean Payment

The following does not make a donation Paid:

```text
Link generated
Link sent
Link opened
UPI app opened
Payment button pressed
```

Only Finance verification establishes the financial result.

---

# 54. Payment Link Snapshot

Historical payment requests should retain the relevant values used when the link was generated, including the UPI destination in effect at generation time.

A later UPI configuration change must not rewrite historical payment-link records.

---

# 55. Payment Link Expiry

Monthly payment links expire at the end of the relevant donation month.

Example:

```text
September monthly link
→ expires at the end of September
```

Expiry does not delete:

- Monthly donation record
- Pending amount
- Member history

---

# 56. New Month, New Link

For a new monthly cycle:

```text
New monthly record
      ↓
New payment link
```

The new link uses the current active UPI configuration.

---

# 57. Pending Payment Reminder

The application should notify members about pending/missed monthly donations.

V1 channels:

```text
App Push
+
SMS/WhatsApp where available
```

Delivery channel availability may depend on provider configuration and cost.

---

# 58. Notification Independence

Notification failure must not change the financial state.

Example:

```text
SMS failed
→ Monthly donation remains Pending
```

---

# 59. Member Payment Verification

Finance is responsible for verifying actual payment against the relevant bank/UPI evidence and recording the external transaction/reference where available.

The member cannot self-confirm a financial receipt as verified.

---

# 60. Member Donation History

A member's financial history may include:

```text
Monthly Donations
Additional Donations
Combined Payment Allocations
Verified Payments
Outstanding Months
```

The authoritative monetary details come from the financial system.

---

# 61. Financial History Integrity

Member management must not independently calculate or rewrite the authoritative financial ledger.

For financial totals:

```text
Financial Data Model
        ↓
Authoritative financial records
```

The member screen only presents the authorized view.

---

# 62. Contribution Status

The system may show a member's monthly contribution state:

```text
Paid
Pending
Outstanding
```

Any UI term should match the underlying financial definition.

---

# 63. Active Donor Concept

For reporting, the system may derive:

```text
Active/actual donor
```

from verified donation activity.

Do not infer donation activity merely from having an agreed monthly amount.

---

# 64. Referred Member vs Donor

These remain distinct:

```text
Referred Member
=
registered member associated with a Committee Member

Verified Donor
=
member with verified financial contribution
```

One does not automatically imply the other.

---

# 65. Referral Contribution Dashboard

Committee-level reporting may show:

```text
Members Referred
Verified Donors
Verified Contribution
```

These should be labeled separately.

---

# 66. Member-Related Tasks

A Committee Member or authorized user may create a task linked to a member.

Example:

```text
Task:
Follow up regarding pending monthly contribution

Related Member:
Member A
```

This relation allows work accountability without duplicating member information.

---

# 67. Referral-Related Tasks

A task may also reference the referral record.

Example:

```text
Referral
  ↓
Follow-up Task
```

The task then remains attributable to the responsible Committee Member.

---

# 68. Member and Meeting Context

Meetings may reference members through:

- Invited attendees
- Attendance
- Responsible follow-up

Member identity remains stable across these records.

---

# 69. Attendance History

Where applicable, member management may display the member's own attendance summary.

V1 attendance scope is:

```text
Jummah
+
Scheduled committee meetings
```

No additional prayer attendance types are introduced here.

---

# 70. Member Data Corrections

Authorized users may correct member profile information.

Examples:

```text
Name typo
Email correction
Photo replacement
Referral correction
```

Corrections must preserve identity and relevant history.

---

# 71. Correction Audit

Important member changes should record:

```text
Actor
Timestamp
Changed context
Previous value where needed
New value where needed
Reason where required
```

The central audit trail is defined in `AUDIT_LOG_MODEL.md`.

---

# 72. Mobile Number Correction

Changing the primary mobile number is a high-risk identity operation.

V1 should not allow unrestricted self-service change without ownership verification.

Any future number-change process must:

- Verify the new number
- Preserve the same Member ID where appropriate
- Prevent duplicate identity creation
- Preserve history
- Be audited

---

# 73. Member Merge

V1 does not require a general member-merge feature.

Because merging financial and referral histories is high risk, it should not be implemented casually.

Any future merge system requires explicit design and audit controls.

---

# 74. Member Deactivation Effects

Deactivation should not erase:

```text
Donation records
Payments
Expenses linked through tasks where applicable
Attendance
Referral history
Meeting participation
Tasks
Audit trail
```

---

# 75. Member Reactivation Effects

Reactivation restores operational access/participation according to role and product state.

It does not create a new member ID.

---

# 76. Member Deactivation and Financial Records

A deactivated member may still have historical financial records.

Historical contributions remain in financial reports.

The financial history is not removed because the member is inactive.

---

# 77. Member Deactivation and Monthly Cycle

The exact behavior for generating future monthly donation obligations after deactivation must be explicitly defined during implementation.

The system must not silently invent a financial obligation policy.

Until a final rule is selected, avoid assuming that deactivation automatically cancels future monthly dues.

---

# 78. Member Data Privacy

Member data is private internal Masjid data.

Access should follow:

```text
Authentication
+
Role Authorization
+
RLS
+
Field-level/business checks where needed
```

---

# 79. Sensitive Member Information

The system should treat the following as sensitive:

- Mobile number
- Email
- Photo
- Donation information
- Referral attribution
- Attendance
- Internal notes where applicable

Only necessary information should be exposed per role.

---

# 80. Member List Safety

A broad member directory should not be publicly accessible.

V1 is an internal committee-management application.

---

# 81. Database Constraints

Recommended conceptual constraints:

```text
Unique normalized mobile number
One stable member ID
One primary referrer
One monthly donation record per member/month
Valid active status
Valid contribution term effective periods
```

Exact SQL constraints are defined in `DATABASE_SCHEMA.md`.

---

# 82. Contribution Term Integrity

Contribution terms for a member must not create ambiguous overlaps.

Example of valid history:

```text
July 2026 → ₹500
September 2026 → ₹700
```

The implementation should make the amount for any month deterministic.

---

# 83. Historical Determinism

For any historical month, the application should be able to answer:

```text
What amount was agreed/applicable for this month?
```

without relying on the current amount.

---

# 84. Member Financial Traceability

The following chain should remain possible:

```text
Member
   ↓
Monthly Donation
   ↓
Payment
   ↓
Allocation
   ↓
Financial Transaction
   ↓
Account
   ↓
Audit
```

---

# 85. Member Referral Traceability

The following chain should remain possible:

```text
Committee Member
   ↓
Referral
   ↓
Member
   ↓
Verified Donations
```

This supports accurate committee contribution reporting.

---

# 86. Member Work Traceability

The following chain should remain possible:

```text
Member
   ↓
Related Task
   ↓
Responsible Committee Member
   ↓
Completion
   ↓
Audit
```

---

# 87. Member Search Performance

Indexes should support common lookups on:

```text
normalized_mobile
name/search fields as appropriate
member_id
primary_referrer_id
active status
```

The final index strategy should be validated against actual query patterns.

---

# 88. Data Storage

Member profile data is lightweight.

Use relational database fields for normal profile information.

Use object storage for photos where required.

Do not store large images directly inside PostgreSQL rows.

---

# 89. Photo Storage Optimization

To minimize storage:

- Limit upload size.
- Resize/compress photos appropriately.
- Store only the required quality.
- Avoid duplicate copies.
- Reference storage objects from the member record.

Do not compromise required member history.

---

# 90. Backup Requirements

Backups should preserve:

```text
Member profiles
Referral relationships
Contribution terms
Monthly donation references
Related payment metadata
Attendance relationships
Task relationships
Meeting relationships
Audit references
```

Financial records are backed up according to the financial backup policy.

---

# 91. Member Testing Requirements

At minimum test:

1. Create member through Committee referral.
2. Duplicate mobile number.
3. Mobile normalization.
4. Existing member detection.
5. Primary referrer assignment.
6. Referral correction by President.
7. Unauthorized referral correction.
8. Profile update.
9. Member deactivation.
10. Member reactivation.
11. Historical record preservation.
12. Monthly contribution creation.
13. Contribution amount change with effective month.
14. Historical monthly amount preservation.
15. Member cannot change own fixed amount.
16. Authorized role can change amount.
17. Monthly pending status.
18. Combined outstanding payment.
19. FIFO allocation.
20. Partial monthly payment remains incomplete.
21. Overpayment creates General Donation.
22. Future months are not advanced by overpayment.
23. Payment-link expiry.
24. UPI snapshot preservation.
25. Member's own financial history visibility.
26. Unauthorized access to another member's financial data.
27. Member deactivation does not delete financial history.
28. Member-related task remains traceable.

---

# 92. Member Management Invariants

The following rules are mandatory:

### Invariant 1

A member has one stable system-generated identity.

### Invariant 2

Normalized mobile number prevents duplicate member identities.

### Invariant 3

One member has one primary referrer in V1.

### Invariant 4

Referral attribution changes are auditable.

### Invariant 5

Referral does not equal verified donation.

### Invariant 6

Only Finance-verified payment counts as verified financial contribution.

### Invariant 7

Members cannot change their own fixed monthly contribution amount.

### Invariant 8

Contribution amount changes use an effective month.

### Invariant 9

Historical monthly donation records remain unchanged after future amount changes.

### Invariant 10

There is at most one monthly donation record per member/month.

### Invariant 11

Partial monthly payment does not mark a month Paid.

### Invariant 12

Combined outstanding payments use FIFO allocation.

### Invariant 13

Overpayment beyond outstanding monthly dues becomes Additional General Donation.

### Invariant 14

Additional donations do not prepay future monthly dues.

### Invariant 15

Payment-link generation/opening does not equal payment verification.

### Invariant 16

Expired payment links do not delete donation records.

### Invariant 17

Historical member records survive deactivation.

### Invariant 18

Member deactivation does not delete financial history.

### Invariant 19

Hard deletion should not be the ordinary member lifecycle mechanism.

### Invariant 20

Member financial totals are derived from the authoritative financial system.

---

# 93. Acceptance Criteria

Member management is implementation-ready when the system can:

- Register a member through the referral workflow.
- Prevent duplicate mobile identities.
- Preserve one primary referrer.
- Correct attribution through authorized control.
- Maintain a stable Member ID.
- Store required profile information.
- Deactivate/reactivate without history loss.
- Maintain effective monthly contribution terms.
- Preserve historical monthly values.
- Generate monthly donation records.
- Handle pending/missed months.
- Support combined payment allocation.
- Handle overpayment correctly.
- Support additional General Donations.
- Preserve payment-link history.
- Restrict member access to their own permitted information.
- Maintain traceability into financial and committee systems.
- Preserve member-related audit history.

---

# 94. Implementation Boundary

This document defines member-management business behavior.

The following belong elsewhere:

```text
Authentication identity         → AUTHENTICATION.md
Role permissions                → USER_ROLES_PERMISSIONS.md
Financial ledger                → FINANCIAL_DATA_MODEL.md
Donation processing             → DONATION_SYSTEM.md
Payment implementation           → PAYMENT_SYSTEM.md
Referral/work accountability     → COMMITTEE_DATA_MODEL.md
Attendance                       → ATTENDANCE_SYSTEM.md
Audit trail                      → AUDIT_LOG_MODEL.md
Database tables                  → DATABASE_SCHEMA.md
RLS/security                     → SECURITY_ARCHITECTURE.md
Privacy                          → DATA_PRIVACY.md
UI screens                       → SCREEN_SPECIFICATIONS.md
```

---

# 95. Related Documents

- `PROJECT_OVERVIEW.md`
- `PRODUCT_REQUIREMENTS.md`
- `FEATURE_SCOPE.md`
- `USER_ROLES_PERMISSIONS.md`
- `AUTHENTICATION.md`
- `FINANCIAL_DATA_MODEL.md`
- `COMMITTEE_DATA_MODEL.md`
- `AUDIT_LOG_MODEL.md`
- `DATABASE_SCHEMA.md`
- `DATA_RELATIONSHIPS.md`
- `DONATION_SYSTEM.md`
- `PAYMENT_SYSTEM.md`
- `ATTENDANCE_SYSTEM.md`
- `SECURITY_ARCHITECTURE.md`
- `DATA_PRIVACY.md`
- `SCREEN_SPECIFICATIONS.md`

---

## Document Status

**Member Management — V1 Implementation Baseline**

This document defines the authoritative member lifecycle and member-management behavior for Masjid-e-Mamoor 2.

All member-management implementation must preserve the identity, history, referral, and contribution invariants defined here.
