# Masjid-e-Mamoor 2 — Reporting and Audit

**Document Status:** V1 Implementation Baseline  
**Version:** 1.0  
**Product:** Masjid-e-Mamoor 2 Internal Management Application  
**Scope:** V1  
**Primary Areas:** Financial Reports, Audit Reports, Committee Reports, Attendance Reports, PDF Reports  
**Last Updated:** 2026-09-17

---

# 1. Purpose

This document defines the V1 reporting and audit-reporting layer for Masjid-e-Mamoor 2.

The reporting system converts authoritative application data into useful operational views and printable/downloadable reports.

It must support:

- Financial summaries
- Account-wise reports
- Income/receipt reports
- Expense reports
- Donation reports
- Outstanding donation reports
- Transfer reports
- Financial audit reports
- Committee work reports
- Meeting/decision/follow-up reports
- Attendance reports
- Audit-log reports
- Daily/monthly/yearly/custom reporting
- Printable/downloadable PDF reports

The core principle is:

> Reports are derived views of authoritative records. A report must never become a second source of financial or operational truth.

---

# 2. Reporting Design Principles

1. Reports derive from authoritative database records.
2. Reports do not manually maintain business totals.
3. Financial reports use exact monetary values.
4. Internal transfers must not be double-counted as income/expense.
5. Expected donations must not be presented as received money.
6. Only verified donations count as verified received money.
7. Historical records retain their original business meaning.
8. Report filters must be deterministic.
9. Report generation must not alter source records.
10. Report generation timestamp must be recorded.
11. PDF output should be suitable for printing.
12. Reports must respect role permissions.
13. Audit reports must remain traceable to source records.
14. Generated PDFs are report artifacts, not the source of truth.
15. Reports must support multilingual output where practical.
16. No report should create rankings or performance scores.

---

# 3. Reporting Scope

V1 reporting includes:

```text
Financial
├── Overall financial summary
├── Account-wise balances
├── Income/receipts
├── Donations
├── Expenses
├── Transfers
├── Adjustments
└── Financial audit

Committee
├── Task summary
├── Work history
├── Overdue work
├── Meeting summary
├── Decisions
└── Follow-up status

Attendance
├── Jummah attendance
├── Meeting attendance
└── Attendance trends

Audit
├── Financial audit trail
├── Administrative changes
└── Security-sensitive audit events
```

---

# 4. Reporting Periods

V1 supports:

```text
Daily
Monthly
Yearly
Custom date range
```

The user should always be able to see the selected period.

---

# 5. Annual Reporting Convention

The standard annual reporting concept is:

```text
January 1 → December 31
```

The application should also support custom ranges.

---

# 6. Date Semantics

Reports must distinguish among:

```text
Business date
Transaction date
Event timestamp
Record creation timestamp
```

For financial reporting, the selected financial reporting date field must be explicitly defined.

---

# 7. Time Zone

Server timestamps should use a consistent standard such as UTC.

User-facing reports should render dates/times using the application's configured local timezone.

Masjid-e-Mamoor 2 operates in India, so the report UI should present local Indian date/time appropriately.

---

# 8. Financial Reporting Source

Financial reports derive from the authoritative financial system:

```text
Financial Accounts
+
Financial Transactions
+
Verified Donation Records
+
Expenses
+
Transfers
+
Adjustments
```

Donation/payment records remain linked to their financial transactions.

---

# 9. Financial Summary

A high-level financial summary should include:

```text
Opening Balance
Income / Receipts
Donations
Other Receipts
Expenses / Payments
Adjustments
Transfers where relevant
Closing/Current Balance
```

The exact presentation must avoid double-counting.

---

# 10. Opening Balance

For a selected reporting period, opening balance represents the relevant account/fund position at the beginning of the reporting period according to the application's financial model.

The implementation must define boundary handling consistently.

---

# 11. Closing Balance

Closing balance represents the relevant financial position at the end of the selected reporting period under the report's defined accounting calculation.

For current operational balance, the system may also show the present account balance separately.

Do not confuse:

```text
Period closing balance
```

with:

```text
Current balance today
```

---

# 12. Financial Report Equation

Conceptually:

```text
Opening Balance
+
External Receipts
-
External Payments
± Adjustments
=
Closing Balance
```

Internal transfers are movements between Masjid accounts and must not inflate or reduce overall Masjid funds.

---

# 13. Overall Funds

Overall Masjid funds can be represented as:

```text
Cash
+
Bank
+
UPI
+
Other legitimate accounts
```

subject to the account model.

---

# 14. Account-Wise Report

The report should support viewing each account separately:

```text
Cash
Bank
UPI
Other
```

where configured.

---

# 15. Account Report Fields

An account report may include:

```text
Account
Opening Balance
Credits
Debits
Internal Transfers In
Internal Transfers Out
Adjustments
Closing/Current Balance
```

---

# 16. Transfer Treatment in Account Reports

Internal transfers should appear in account-level movement:

```text
Cash → debit
Bank → credit
```

but should not be counted as external income or expense.

---

# 17. Income / Receipt Report

Income/receipt reporting may include:

```text
Monthly Donations
Additional General Donations
Anonymous Donations
Jummah Cash Collections
Other Receipts
```

Only verified/posted money should appear as received financial income.

---

# 18. Expected vs Received

Reports must distinguish:

```text
Expected Donation
Pending Donation
Verified Donation
```

Example:

```text
Expected = ₹50,000
Verified = ₹43,000
Pending = ₹7,000
```

Illustrative only.

Expected money must never be presented as cash received.

---

# 19. Donation Report

A donation report may include:

```text
Date/month
Member or Anonymous
Donation type
Expected amount
Verified amount
Payment reference
Account/method
Financial transaction ID
Verification actor
```

Field visibility depends on role.

---

# 20. Monthly Donation Report

A monthly donation report should show:

```text
Member
Month
Expected amount
Status
Verified amount
Payment reference where available
```

---

# 21. Outstanding Donation Report

The outstanding report should identify:

```text
Member
Outstanding month(s)
Expected amount
Outstanding amount
Current status
```

The calculation must avoid double-counting verified payments.

---

# 22. FIFO Allocation in Reports

Where a combined payment settles multiple monthly dues, reports should show each monthly allocation separately while preserving the single actual payment.

Example:

```text
Payment ₹1,500

July      ₹500
August    ₹500
September ₹500
```

The report must not count ₹1,500 three times.

---

# 23. Overpayment Reporting

If:

```text
Outstanding monthly dues = ₹1,000
Actual verified payment = ₹1,200
```

the report shows:

```text
Monthly settlement = ₹1,000
Additional General Donation = ₹200
Total actual payment = ₹1,200
```

The payment must not be counted twice.

---

# 24. Partial Monthly Payment Reporting

A partial monthly payment does not make the month Paid.

The report should make the incomplete state clear.

Example:

```text
Expected = ₹500
Verified received = ₹300
Status = Not fully settled
```

The exact presentation should align with the finalized allocation model.

---

# 25. Additional Donation Report

The report may include:

```text
Donation date
Member
Amount
Method
Reference
Verification status
Financial transaction
```

The donation remains separate from the monthly contribution obligation.

---

# 26. Anonymous Donation Report

Anonymous donations can be reported without donor identity.

Example:

```text
Date
Anonymous
Amount
Method
Reference
Verified By
Transaction ID
```

---

# 27. Jummah Collection Report

Jummah cash reporting is aggregate.

Example:

```text
Friday
Collection amount
Cash account
Recorded by
Transaction reference
```

No individual donor list is required for Jummah cash collection.

---

# 28. Expense Report

Expense reporting may include:

```text
Expense ID
Date
Title
Category
Expense amount
Paid amount
Remaining amount
Status
Payment methods
Accounts
```

---

# 29. Expense Status Report

Users can filter:

```text
Added
Partially Paid
Paid
Cancelled
```

---

# 30. Expense Amount vs Paid Amount

Example:

```text
Expense amount = ₹10,000
Paid = ₹4,000
Remaining = ₹6,000
```

The report must show these as separate concepts.

---

# 31. Multiple Expense Payments

One expense can have multiple payments.

Example:

```text
Expense = ₹10,000

UPI   ₹4,000
Cash  ₹3,000
Bank  ₹3,000
```

The report should show:

```text
One expense
Three payments
Total paid = ₹10,000
```

It must not count the expense as three separate expenses.

---

# 32. Expense Documentation Status

A detailed expense report may indicate:

```text
Bill present/missing
Payment proof present/missing
```

This helps Finance identify incomplete documentation.

---

# 33. Transfer Report

Transfer reports may include:

```text
Transfer ID
Date
Source
Destination
Amount
Created by
```

Transfers are account movements, not external income/expense.

---

# 34. Adjustment Report

Adjustment reporting may include:

```text
Date
Account
Amount
Direction
Reason
Actor
Transaction ID
```

Adjustments must be distinguishable from normal receipts/payments.

---

# 35. Financial Audit Report

The financial audit report is a core V1 output.

It should provide a structured view of:

```text
Masjid name
Reporting period
Opening balance
Receipts/income
Donations
Jummah collections
Other receipts
Expenses
Payments
Transfers
Adjustments
Closing balance
Transaction references
Audit information
Generated timestamp
Page numbers
Signature/approval areas where appropriate
```

---

# 36. Financial Audit Report Structure

Recommended structure:

```text
PAGE 1
Masjid + Reporting Period + Summary

PAGE 2+
Detailed Receipts

Detailed Expenses/Payments

Transfers

Adjustments

Relevant Audit Trail

Final Balance Summary
```

The final page arrangement may change based on data volume.

---

# 37. Transaction Detail Section

For detailed financial reports, include:

```text
Transaction ID
Date
Account
Type
Credit/Debit
Amount
Category
Method
Reference
Description
```

---

# 38. Audit Trail Section

Where audit information is included, show:

```text
Action
Entity
Actor
Timestamp
Relevant before/after context
Reason where applicable
```

Only information appropriate for the report viewer should be included.

---

# 39. Financial Deletion Reporting

When a financial transaction has been deleted by the President, the financial detail report may no longer contain the deleted transaction as an active ledger item.

However, the audit trail must preserve safe evidence that the deletion occurred.

The report should not falsely reconstruct the deleted transaction as current financial state.

---

# 40. Financial Correction Reporting

When a financial record was corrected:

```text
Current financial state
+
Relevant correction audit context
```

should remain understandable.

Reports should avoid counting both old and corrected amounts as active money movement unless the financial model explicitly treats the correction as a new transaction.

---

# 41. Historical Financial Stability

Reports must respect historical business meaning.

Examples:

```text
UPI ID changed
→ Historical payment request retains original UPI context

Monthly amount changed
→ Historical monthly records retain original amount

Category deactivated
→ Historical transactions remain categorized
```

---

# 42. Financial Report Filtering

Financial reports should support:

```text
Date/range
Account
Credit/Debit
Amount
Payment method
Category
Transaction ID
Transfer ID
Expense ID
Reference
```

---

# 43. Financial Search

The report UI should support efficient filtering/searching without requiring the user to manually inspect all transaction records.

---

# 44. Committee Reporting

Committee reporting should focus on factual operational activity.

It may include:

```text
Total tasks
Completed
In Progress
Pending
Overdue
Open/unassigned
Tasks by responsible member
Upcoming deadlines
Tasks created
Tasks completed
Monthly completion trend
Meetings held
Meeting attendance
Decisions
Follow-up tasks
```

---

# 45. Committee Work History Report

A work-history report may include:

```text
Task ID
Title
Responsible member
Created by
Assignment/claim
Priority
Deadline
Status
Completed by
Completed at
Related member/referral
Meeting/decision context
```

---

# 46. Overdue Work Report

Overdue report may show:

```text
Task
Responsible member
Deadline
Days overdue
Priority
Related meeting/referral/member
```

`Days overdue` is a descriptive measure.

---

# 47. No Performance Score

Committee reports must not calculate:

```text
Performance score
Contribution score
Attendance score
Task score
Points
Ranking
Leaderboard
Best/worst member
```

---

# 48. Member Drilldown Report

Authorized users may view:

```text
Member
Referral activity
Verified contribution through referrals
Task history
Meeting participation
Relevant attendance
```

This remains a factual drilldown.

---

# 49. Referral Contribution Report

Where permitted, the report may show:

```text
Committee Member
Members referred
Verified donors among referrals
Verified contribution amount
```

The report must clearly distinguish:

```text
Referrals
vs
Verified financial contribution
```

---

# 50. Meeting Report

A meeting report may include:

```text
Meeting title
Date/time
Location
Agenda
Invitees
Present/absent
Attendance percentage
Decisions
Follow-up tasks
Responsible members
Follow-up status
```

---

# 51. Meeting Accountability Report

The core chain is:

```text
Meeting
   ↓
Decision
   ↓
Task
   ↓
Responsible Member
   ↓
Status
   ↓
Completion
```

Reports should preserve these relationships.

---

# 52. Decision Report

A decision report may include:

```text
Meeting
Decision
Date
Created by
Follow-up required?
Linked task
Task status
Responsible member
```

A decision with no task remains a valid record.

---

# 53. Attendance Reporting

V1 attendance reporting includes:

```text
Jummah
Scheduled committee meetings
```

No other prayer attendance should appear.

---

# 54. Jummah Attendance Report

May include:

```text
Friday/session date
Present count
Individual attendance list where authorized
```

Raw GPS coordinates should not normally be included.

---

# 55. Meeting Attendance Report

May include:

```text
Meeting
Date
Invited members
Present
Absent
Attendance percentage
```

---

# 56. Attendance Trend

The system may show:

```text
Friday
Attendance count
```

or:

```text
Month
Meeting attendance percentage
```

These are descriptive trends.

---

# 57. No Attendance Ranking

Do not create:

```text
Top attendee
Attendance rank
Best attendance
Worst attendance
```

---

# 58. Audit Log Reporting

Authorized users may review audit data through filters such as:

```text
Date/range
Actor
Action
Entity type
Entity ID
Category
Result
Severity
```

---

# 59. Financial Audit Log Filters

Financial audit views may additionally filter by:

```text
Transaction ID
Expense ID
Payment ID
Account
Transfer ID
Reference
```

---

# 60. Audit Report Purpose

Audit reports answer:

```text
Who changed what?
When?
To which record?
What was the result?
What was the reason?
```

They do not replace the financial ledger.

---

# 61. Report Permissions

Every report must respect authorization.

Examples:

```text
President → broad reports
Finance   → finance reports
Auditor   → financial/audit review
Secretary → relevant operational reports
Committee Member → relevant work/member views
Member    → own permitted records
```

The exact permission matrix is defined separately.

---

# 62. Field-Level Privacy

A report should not expose fields merely because the underlying record contains them.

Examples:

```text
Raw GPS evidence
Bank details
Other members' donation history
Payment proofs
Internal audit metadata
```

must be permission-controlled.

---

# 63. Report Generation Authorization

Before generating a report:

```text
Authenticate
   ↓
Check role
   ↓
Check requested report access
   ↓
Apply row/field security
   ↓
Generate
```

---

# 64. Report Filters Must Not Bypass RLS

A query such as:

```text
?member_id=someone_else
```

must not allow a user to access unauthorized records.

Filtering is applied after authorization.

---

# 65. Report Data Consistency

A single report generation should use a consistent data snapshot/transactional read where practical.

This prevents:

```text
Summary calculated at 10:00
Details calculated at 10:02
```

from producing an internally contradictory report during active writes.

---

# 66. Report Generation Time

Every generated report should display:

```text
Generated at
```

using server-controlled time.

---

# 67. Report Version

Where useful, reports may identify:

```text
Report version
Schema/report definition version
```

This helps explain future changes to report layouts/calculations.

---

# 68. PDF Output

The system supports professional printable/downloadable PDF output for important reports.

Priority:

```text
Financial audit
Finance reports
Committee/work reports
Attendance reports
```

---

# 69. PDF Layout

PDFs should be designed for printing.

Recommended elements:

```text
Masjid name/header
Report title
Reporting period
Generated timestamp
Summary
Tables
Page numbers
Footer
Signature/approval area where appropriate
```

---

# 70. PDF Page Numbers

Important multi-page reports should include:

```text
Page X of Y
```

where the renderer supports it.

---

# 71. PDF Signature Areas

Financial audit/documentation PDFs may include designated areas for:

```text
Prepared By
Reviewed By
Approved By
Date
Signature
```

The exact roles shown should match the operational workflow.

---

# 72. PDF Source of Truth

A PDF is a generated snapshot.

It is not the underlying accounting record.

The database remains authoritative.

---

# 73. PDF Storage Strategy

Generated PDFs should normally be temporary.

Do not permanently store every generated report unless an explicit retention requirement exists.

---

# 74. PDF Regeneration

The same report can be regenerated from current authorized data.

When historical signed/report-retention needs exist, the stored snapshot should be handled as a separate document-retention process.

---

# 75. Multilingual Reports

V1 languages:

```text
English
Hindi
Kannada
Urdu
```

Reports/PDFs should support localized labels where practical.

---

# 76. Urdu RTL in Reports

Urdu reports must support:

```text
Right-to-left text
Correct shaping
Appropriate font handling
Correct table alignment where required
```

The final PDF renderer must be tested before production.

---

# 77. Localized Numbers

Reports may use appropriate localized number/date formatting.

The underlying database remains exact and locale-independent.

---

# 78. Financial Amount Formatting

Financial amounts should be rendered consistently.

Example:

```text
₹1,80,000.00
```

or the chosen locale-appropriate format.

The database amount remains a precise numeric value.

---

# 79. Report Sorting

Financial reports may sort by:

```text
Date
Transaction ID
Amount
Category
Account
```

Committee reports may sort by:

```text
Deadline
Status
Creation date
Completion date
Responsible member
```

Sorting must not alter business meaning.

---

# 80. Report Pagination

Large reports must use pagination or streaming generation.

Do not load unlimited historical data into the client.

---

# 81. Report Export Security

Generated reports can contain sensitive information.

Use protected downloads.

Avoid permanent public URLs.

---

# 82. Report Auditability

Important report generations may be logged operationally where useful.

A report generation itself is not normally a business-state change.

---

# 83. Report Calculation Validation

Financial report calculations must be tested against known datasets.

At minimum validate:

```text
Opening balance
+
receipts
-
payments
=
closing balance
```

and ensure internal transfers do not double-count.

---

# 84. Financial Report Reconciliation

A generated financial report should be mathematically consistent with authoritative account balances under the selected report semantics.

Any discrepancy must be investigated rather than hidden.

---

# 85. Report Example — Overall Funds

```text
MASJID-E-MAMOOR 2
Financial Summary
September 2026

Cash              ₹35,000
Bank             ₹1,80,000
UPI                ₹35,000
Other                     ₹0
--------------------------------
Overall Funds    ₹2,50,000
```

Illustrative example only.

---

# 86. Report Example — Expense

```text
Expense: Electrical Repair
Expense Amount: ₹10,000
Paid: ₹7,000
Remaining: ₹3,000
Status: Partially Paid
```

Illustrative example only.

---

# 87. Report Example — Meeting Accountability

```text
Meeting
  ↓
Decision: Complete electrical repair
  ↓
Task: Coordinate repair
  ↓
Responsible: Committee Member A
  ↓
Status: Completed
  ↓
Completed At: 2026-09-10
```

Illustrative example only.

---

# 88. Report Example — Referral Contribution

```text
Committee Member A

Members Referred: 12
Verified Donors: 8
Verified Contribution Through Referrals: ₹24,500
```

Illustrative only.

---

# 89. No Target Comparison

Reports should not compare:

```text
Actual donation
vs
member target
```

because V1 has no donation target system.

---

# 90. No Ranking Comparison

Reports should not compare members using:

```text
Rank
Score
Best/worst
Leaderboard
```

---

# 91. Report Testing — Financial

At minimum test:

1. Daily report.
2. Monthly report.
3. Annual report.
4. Custom date range.
5. Account-wise report.
6. Income report.
7. Expense report.
8. Donation report.
9. Outstanding donation report.
10. Transfer report.
11. Adjustment report.
12. Opening balance calculation.
13. Closing balance calculation.
14. Internal transfer non-double-counting.
15. FIFO allocation reporting.
16. Overpayment reporting.
17. Partial payment reporting.
18. Corrected expense reporting.
19. Deleted transaction audit representation.
20. Negative balance reporting.

---

# 92. Report Testing — Committee

At minimum test:

1. Task summary.
2. Work history.
3. Overdue report.
4. Member drilldown.
5. Referral contribution report.
6. Meeting report.
7. Decision report.
8. Follow-up report.
9. Meeting accountability chain.
10. No ranking/score output.

---

# 93. Report Testing — Attendance

At minimum test:

1. Jummah count.
2. Jummah history.
3. Meeting attendance.
4. Meeting attendance percentage.
5. Attendance trend.
6. Duplicate records excluded.
7. Unauthorized member information excluded.
8. Raw GPS data excluded from normal reports.

---

# 94. Report Testing — PDF

At minimum test:

1. PDF generation.
2. Multi-page report.
3. Page numbering.
4. Correct totals.
5. Correct date range.
6. Protected download.
7. Print readability.
8. English.
9. Hindi.
10. Kannada.
11. Urdu.
12. Urdu RTL.
13. Large-table pagination.
14. Long names/text.
15. No clipped financial amounts.
16. Generated timestamp.
17. Signature/approval areas where configured.

---

# 95. Report Security Testing

At minimum test:

1. Member cannot access other member's report.
2. Committee Member cannot access restricted finance report.
3. Auditor cannot modify financial data through reports.
4. Unauthorized audit report access rejected.
5. Report filter cannot bypass RLS.
6. Protected PDF cannot be downloaded anonymously.
7. Deep-linked report IDs still require authorization.
8. Sensitive GPS evidence is not exposed.

---

# 96. Reporting Invariants

The following rules are mandatory:

### Invariant 1

Reports derive from authoritative application records.

### Invariant 2

Reports do not become a second source of truth.

### Invariant 3

Financial reports use exact monetary values.

### Invariant 4

Expected donations are not counted as received money.

### Invariant 5

Only verified/posted donations count as received financial money.

### Invariant 6

Combined payment allocations do not double-count the actual payment.

### Invariant 7

Overpayment is shown consistently as outstanding settlement plus Additional General Donation.

### Invariant 8

Internal transfers do not inflate or reduce overall Masjid funds.

### Invariant 9

One expense with multiple payments remains one expense.

### Invariant 10

Expense amount, paid amount, and remaining amount remain distinct.

### Invariant 11

Historical corrections do not create false duplicate financial activity.

### Invariant 12

Reports do not alter source data.

### Invariant 13

Report generation timestamp is server-controlled.

### Invariant 14

Report access follows authorization and RLS.

### Invariant 15

Generated PDFs are snapshots, not the financial source of truth.

### Invariant 16

Sensitive financial and personal data is not exposed to unauthorized roles.

### Invariant 17

Raw GPS coordinates are not included in normal attendance reports.

### Invariant 18

Committee reports do not create rankings or performance scores.

### Invariant 19

Meeting reports preserve decision → task → responsibility → completion relationships.

### Invariant 20

Jummah reporting remains aggregate rather than individual donor reporting.

### Invariant 21

V1 attendance reports include only Jummah and scheduled committee meetings.

### Invariant 22

Reports do not silently mix current balance with period closing balance.

### Invariant 23

Large reports use safe pagination/streaming.

### Invariant 24

Multilingual report output does not change underlying financial values.

### Invariant 25

Report filtering cannot bypass security controls.

---

# 97. Acceptance Criteria

The Reporting and Audit system is implementation-ready when it can:

- Generate daily/monthly/yearly/custom financial reports.
- Generate account-wise reports.
- Show receipts, donations, expenses, transfers, adjustments, and balances.
- Distinguish expected vs verified donations.
- Show outstanding donations correctly.
- Handle FIFO combined payments without double-counting.
- Show overpayment correctly.
- Show expense amount/paid/remaining separately.
- Handle multiple expense payments.
- Produce a professional financial audit PDF.
- Include report period and generation timestamp.
- Include page numbers.
- Include signature/approval areas where required.
- Generate committee work reports.
- Generate meeting/decision/follow-up reports.
- Generate attendance summaries.
- Generate authorized audit-log reports.
- Enforce role-based report access.
- Protect sensitive financial/GPS information.
- Support English, Hindi, Kannada, and Urdu where practical.
- Render Urdu RTL correctly.
- Prevent report filtering from bypassing RLS.
- Preserve the distinction between reports and authoritative source data.

---

# 98. Implementation Boundary

This document defines reporting behavior.

The following belong elsewhere:

```text
Financial data model       → FINANCIAL_DATA_MODEL.md
Finance operations         → FINANCE_SYSTEM.md
Donation rules             → DONATION_SYSTEM.md
Payment rules              → PAYMENT_SYSTEM.md
Expense rules              → EXPENSE_SYSTEM.md
Committee work             → COMMITTEE_WORK_MANAGEMENT.md
Meeting management         → MEETING_MANAGEMENT.md
Attendance                 → ATTENDANCE_SYSTEM.md
Audit event structure      → AUDIT_LOG_MODEL.md
Roles/permissions          → USER_ROLES_PERMISSIONS.md
Authorization/RLS          → AUTHORIZATION_MODEL.md
Database                   → DATABASE_SCHEMA.md
PDF renderer/technology    → TECHNOLOGY_STACK.md
Storage                    → STORAGE_STRATEGY.md
Backup                     → BACKUP_AND_RECOVERY.md
Localization               → INTERNATIONALIZATION.md
UI                         → SCREEN_SPECIFICATIONS.md
```

---

# 99. Related Documents

- `PROJECT_OVERVIEW.md`
- `PRODUCT_REQUIREMENTS.md`
- `FEATURE_SCOPE.md`
- `USER_ROLES_PERMISSIONS.md`
- `AUTHENTICATION.md`
- `MEMBER_MANAGEMENT.md`
- `DONATION_SYSTEM.md`
- `PAYMENT_SYSTEM.md`
- `FINANCE_SYSTEM.md`
- `EXPENSE_SYSTEM.md`
- `FINANCIAL_DATA_MODEL.md`
- `COMMITTEE_DATA_MODEL.md`
- `COMMITTEE_WORK_MANAGEMENT.md`
- `MEETING_MANAGEMENT.md`
- `ATTENDANCE_SYSTEM.md`
- `AUDIT_LOG_MODEL.md`
- `DATABASE_SCHEMA.md`
- `DATA_RELATIONSHIPS.md`
- `INTERNATIONALIZATION.md`
- `AUTHORIZATION_MODEL.md`
- `SECURITY_ARCHITECTURE.md`
- `STORAGE_STRATEGY.md`
- `BACKUP_AND_RECOVERY.md`
- `SCREEN_SPECIFICATIONS.md`

---

## Document Status

**Reporting and Audit — V1 Implementation Baseline**

This document defines the authoritative reporting behavior for Masjid-e-Mamoor 2.

All reporting implementation must preserve source-data integrity, calculation correctness, permission boundaries, financial non-double-counting, audit traceability, and multilingual output requirements.
