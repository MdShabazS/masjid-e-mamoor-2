# TESTING STRATEGY

**Project:** Masjid-e-Mamoor  
**Document:** Testing Strategy  
**Version:** 1.0  
**Status:** Draft — Review Required  
**Audience:** Product owner, architects, developers, QA, security reviewers, DevOps, and AI development agents.

---

# 1. Purpose

This document defines the testing strategy for Masjid-e-Mamoor.

The system contains:

- authentication
- role-based authorization
- member management
- referral registration
- monthly donation obligations
- payment submissions
- UPI intent/deep-link flows
- payment proof
- finance verification
- FIFO allocation
- partial payments
- multi-month payments
- overpayments
- additional donations
- anonymous donations
- Jummah cash
- combined payments
- finance accounts
- transactions
- transfers
- expenses
- corrections
- reversals
- committee tasks
- meetings
- attendance
- GPS validation
- offline synchronization
- realtime updates
- notifications
- reports
- storage
- audit records
- localization
- Urdu RTL
- accessibility
- web
- mobile

Testing therefore MUST validate not only whether screens render, but whether the system preserves its security, business rules, financial integrity, usability, and operational guarantees.

---

# 2. Testing Philosophy

The project follows this principle:

```text
Test behavior
  +
Test invariants
  +
Test security boundaries
  +
Test failure paths
  +
Test user workflows
  +
Test operational recovery
```

A test suite that only confirms successful happy paths is insufficient.

---

# 3. Testing Goals

Testing must establish that the product:

1. implements approved requirements
2. enforces business rules
3. protects unauthorized data
4. preserves financial integrity
5. handles concurrency
6. handles retries safely
7. handles offline synchronization safely
8. handles realtime updates correctly
9. provides accessible workflows
10. supports localization
11. supports Urdu RTL
12. behaves consistently across web and mobile
13. fails safely
14. can be operated and recovered reliably

---

# 4. Testing Layers

The project should use multiple testing layers:

```text
Static checks
    ↓
Unit tests
    ↓
Component tests
    ↓
Integration tests
    ↓
Database/RLS tests
    ↓
API/domain tests
    ↓
End-to-end tests
    ↓
Accessibility tests
    ↓
Localization/RTL tests
    ↓
Performance tests
    ↓
Security tests
    ↓
Operational verification
```

Not every feature requires identical coverage at every layer, but critical workflows require multiple independent layers.

---

# 5. Testing Pyramid

Use the testing pyramid as a general guide:

```text
             E2E
           /     \
       Integration
       /          \
     Unit / Component
```

However, security and financial invariants should receive additional dedicated testing even when lower-level tests already exist.

---

# 6. Risk-Based Testing

Testing effort should increase with risk.

High-risk areas include:

- authentication
- authorization
- RLS
- financial mutations
- payment verification
- allocation
- transfers
- corrections
- reversals
- offline replay
- storage permissions
- role administration

---

# 7. Test Categories

The project should distinguish:

- functional tests
- business-rule tests
- financial-integrity tests
- authorization tests
- RLS tests
- security tests
- accessibility tests
- localization tests
- RTL tests
- realtime tests
- offline tests
- performance tests
- resilience tests
- regression tests
- smoke tests
- deployment verification

---

# 8. Static Verification

Before runtime tests:

- typecheck
- lint
- formatting
- build validation
- dependency checks where configured

A feature with static failures is not release-ready.

---

# 9. Typecheck

TypeScript typechecking should run in CI.

The project should treat type errors as defects unless an explicit exception is documented.

---

# 10. Formatting

Formatting must be deterministic.

CI should fail on formatting violations if formatting checks are part of the repository gate.

---

# 11. Linting

Linting should detect:

- unsafe patterns
- unused code
- problematic React patterns
- inconsistent imports
- dependency issues
- project-specific violations

---

# 12. Production Build

The web application production build must pass before a release candidate is accepted.

Mobile release candidates require the appropriate Expo/EAS validation.

---

# 13. Unit Testing

Unit tests are appropriate for deterministic logic.

Examples:

- amount calculations
- date/month calculations
- permission mapping
- validation
- status transitions
- FIFO allocation calculations
- localization helpers
- formatting helpers
- idempotency-key handling

---

# 14. Unit Test Requirements

Unit tests should:

- be deterministic
- have focused scope
- avoid unnecessary external dependencies
- cover normal and boundary cases
- use descriptive names

---

# 15. Business Rule Tests

Business rules should have direct tests.

Examples:

- donation obligation effective month
- FIFO ordering
- partial allocation
- overpayment handling
- future-month restrictions
- anonymous donation rules
- combined payment rules

---

# 16. Business Rule Test Principle

If a rule is important enough to document, it should normally be important enough to test.

---

# 17. Component Testing

Component tests should verify:

- rendering
- user interaction
- states
- validation
- accessibility semantics
- permission-aware behavior
- loading
- errors
- empty state

---

# 18. Component Test Boundaries

Do not test implementation details unnecessarily.

Prefer:

```text
user sees
user clicks
user submits
user receives
```

over internal state implementation.

---

# 19. Form Tests

Forms should test:

- required fields
- invalid values
- valid values
- server errors
- duplicate submission
- loading state
- accessible errors
- localization
- preserved input after failure

---

# 20. Authentication Tests

Authentication must test:

- valid OTP
- invalid OTP
- expired OTP
- resend
- session creation
- session restoration
- logout
- token refresh
- session expiry
- account deactivation
- unauthorized access

---

# 21. OTP Abuse Tests

Test appropriate protection against:

- repeated OTP requests
- repeated verification attempts
- replay
- expired codes
- incorrect codes

Exact rate limits are governed by the authentication/security design.

---

# 22. Referral Registration Tests

Test:

- valid referral
- invalid referral
- expired/invalid referral if supported
- duplicate use
- registration completion
- member linking
- unauthorized referral access
- referral status changes

---

# 23. Member Management Tests

Test:

- member creation
- profile update
- permitted fields
- unauthorized fields
- member search
- filtering
- deactivation
- reactivation
- duplicate identity protection

---

# 24. Role Tests

Every supported role should have positive and negative authorization coverage.

Roles:

1. President / Super Admin
2. Vice President
3. Secretary
4. Finance
5. Auditor
6. Committee Member
7. Member

---

# 25. Permission Matrix Tests

For each sensitive permission:

```text
Allowed roles
Denied roles
```

must be tested.

The test suite should derive from the approved permission matrix where practical.

---

# 26. Direct Access Tests

Do not rely only on UI hiding.

Attempt direct access to protected:

- routes
- APIs
- records
- storage objects
- database operations

---

# 27. RLS Testing

RLS tests are mandatory for exposed sensitive data.

Test:

- select
- insert
- update
- delete where applicable

for authorized and unauthorized contexts.

---

# 28. RLS Negative Testing

Every important RLS policy should have a negative test.

Example:

```text
Member A must not read Member B's private financial record.
```

---

# 29. Role Change Tests

Test:

- role assignment
- role removal
- permission reduction
- cache invalidation
- existing sessions
- active realtime subscriptions

---

# 30. Deactivation Tests

When a user/member is deactivated:

- future access is restricted
- sensitive cached data is handled
- relevant sessions are handled
- historical records remain according to policy

---

# 31. Donation Obligation Tests

Test:

- new obligation
- effective month
- changed monthly amount
- historical amount
- future amount
- zero/disabled obligation where allowed
- obligation history

---

# 32. Obligation Boundary Tests

Test month boundaries around:

- first day
- last day
- timezone transition
- year transition

---

# 33. Payment Submission Tests

Test:

- valid payment
- invalid amount
- invalid reference
- missing proof where required
- duplicate submission
- unsupported future month
- partial payment
- multiple-month payment

---

# 34. Payment Lifecycle Tests

The expected lifecycle must be tested.

Example:

```text
Draft
  ↓
Submitted
  ↓
Pending Verification
  ↓
Verified
```

and rejection/error paths.

---

# 35. Payment Rejection Tests

Test:

- authorized rejection
- unauthorized rejection
- reason requirement if configured
- notification
- audit event
- state transition
- retry/resubmission behavior

---

# 36. Payment Verification Tests

Test:

- authorized verifier
- unauthorized user
- valid evidence
- invalid evidence
- duplicate verification
- stale record
- concurrent verification
- audit
- notification
- allocation

---

# 37. FIFO Tests

FIFO allocation is a critical financial invariant.

Test:

```text
payment
→ oldest eligible obligation
→ next obligation
→ next obligation
```

---

# 38. FIFO Example

Given:

```text
January outstanding = ₹1,000
February outstanding = ₹1,000
March outstanding = ₹1,000
Payment = ₹2,500
```

Expected allocation:

```text
January  = ₹1,000
February = ₹1,000
March    = ₹500
```

The exact expected result must be derived from the approved business rules.

---

# 39. FIFO Edge Cases

Test:

- zero outstanding
- one obligation
- multiple obligations
- partial oldest obligation
- equal months
- changed monthly amounts
- historical obligations
- payment less than oldest
- payment exactly matching oldest
- payment spanning many months

---

# 40. FIFO Concurrency

Two payments arriving simultaneously must not allocate the same outstanding amount twice.

Test concurrent submissions/verification.

---

# 41. Partial Payment Tests

Test:

- partial current month
- partial historical month
- multiple partial payments
- completion after multiple payments
- rejection after partial submission where applicable

---

# 42. Multi-Month Payment Tests

Test a single verified payment allocated across multiple eligible obligations.

Verify:

- total allocation
- remaining payment
- remaining outstanding
- audit
- notifications
- transaction integrity

---

# 43. Overpayment Tests

Test:

```text
required < verified payment
```

Verify the approved overpayment behavior.

Test boundary:

```text
exact amount
one unit above
large excess
```

---

# 44. Additional Donation Tests

Test additional donations independently from monthly obligations.

Verify they do not silently alter obligation allocation rules.

---

# 45. Anonymous Donation Tests

Test:

- anonymous submission
- anonymous visibility
- finance access
- reports
- audit
- notifications
- privacy

---

# 46. Jummah Cash Tests

Test:

- recording
- authorization
- account impact
- aggregation
- audit
- reports
- duplicate prevention

---

# 47. Combined Payment Tests

Combined payments are high-risk.

Test:

- valid combined payment
- invalid component
- duplicate submission
- concurrent retry
- partial failure
- verification
- allocation
- notification
- audit

---

# 48. Combined Payment Atomicity

If a combined payment is defined as atomic:

```text
all required state changes succeed
```

or:

```text
no partial authoritative financial result
```

must be verified.

---

# 49. Combined Payment Idempotency

Repeat the same operation with the same idempotency key.

Verify:

- no duplicate payment
- no duplicate allocation
- no duplicate transaction
- consistent result

---

# 50. Finance Account Tests

Test:

- account creation where permitted
- account balance
- transaction recording
- account visibility
- authorization
- reconciliation

---

# 51. Transfer Tests

Test:

- valid transfer
- source account
- destination account
- equal debit/credit semantics
- insufficient conditions where applicable
- duplicate transfer
- concurrent transfers
- audit

---

# 52. Transfer Atomicity

A transfer must not leave:

```text
source changed
destination unchanged
```

unless the business architecture explicitly models such state.

---

# 53. Expense Tests

Test:

- create
- review/approval where applicable
- proof
- account impact
- cancellation
- correction
- unauthorized access
- duplicate submission

---

# 54. Expense Proof Tests

Test:

- valid file
- invalid file
- unauthorized download
- expired signed access
- missing file
- orphan handling

---

# 55. Correction Tests

Test:

- authorized correction
- unauthorized correction
- valid correction
- invalid correction
- audit trail
- balance impact
- downstream notification

---

# 56. Reversal Tests

Test:

- authorized reversal
- duplicate reversal
- invalid reversal
- audit
- resulting financial state
- reporting

---

# 57. Financial Invariant Tests

At all relevant stages verify:

- allocation does not exceed verified payment
- allocation does not exceed permitted obligation
- balances remain consistent
- transfers remain balanced
- reversed values remain traceable
- duplicate operations do not duplicate money

---

# 58. Financial Reconciliation Tests

Test that derived balances reconcile with authoritative transactions.

---

# 59. Financial Failure Injection

Where practical, simulate failures between related operations.

Examples:

```text
payment verification succeeds
allocation fails
notification fails
audit operation fails
```

Verify the approved transaction/failure strategy.

---

# 60. Financial Rollback Tests

Where database transaction rollback is expected, force an internal failure and verify no partial authoritative state remains.

---

# 61. Financial Audit Tests

Every consequential financial action should produce the required audit evidence.

Test:

- actor
- action
- timestamp
- record
- result
- related identifiers

---

# 62. Audit Immutability Tests

Verify ordinary users cannot:

- edit audit records
- delete audit records
- fabricate actor identity

---

# 63. Member Privacy Tests

Test:

- Member A cannot view Member B's private records
- unauthorized finance information remains hidden
- anonymous donations remain appropriately anonymous
- audit privacy is preserved

---

# 64. Committee Tests

Test:

- task creation
- assignment
- update
- completion
- unauthorized update
- due dates
- notifications

---

# 65. Meeting Tests

Test:

- creation
- update
- participants
- attendance
- notes
- permissions
- notifications

---

# 66. Attendance Tests

Test:

- valid attendance
- duplicate attendance
- GPS requirements
- location failure
- offline capture
- sync
- rejection
- already-applied operation

---

# 67. GPS Attendance Tests

Test:

- location permission granted
- permission denied
- unavailable location
- inaccurate location
- outside allowed area
- boundary condition
- stale location

Exact geographic rules follow the attendance architecture.

---

# 68. Offline Attendance Tests

Test:

```text
capture offline
→ persist locally
→ reconnect
→ submit
→ receive result
```

---

# 69. Offline Duplicate Tests

Replay the same operation multiple times.

Expected behavior must be idempotent.

---

# 70. Offline Conflict Tests

Simulate:

- record already changed
- record already processed
- authorization changed while offline
- stale client state

Verify safe resolution.

---

# 71. Offline Crash Recovery

Terminate the application while a queue exists.

Restart and verify queued operations remain correctly represented.

---

# 72. Offline Security

Verify local storage does not expose unauthorized sensitive data.

---

# 73. Realtime Tests

Test:

- subscription establishment
- authorized events
- unauthorized event exclusion
- insert/update/delete where applicable
- reconnect
- missed events
- duplicate events
- stale cache

---

# 74. Realtime Initial Fetch Race

Test the race:

```text
initial fetch
+
realtime subscription
+
record changes
```

Verify no update is silently missed.

---

# 75. Realtime Duplicate Event

Deliver duplicate events and verify UI state remains correct.

---

# 76. Realtime Missed Event

Simulate disconnect and update while offline.

Verify reconnect reconciliation retrieves authoritative state.

---

# 77. Realtime Cross-Role Test

Verify one authorized role's change appears only to other users who are authorized to receive it.

---

# 78. Notification Tests

Test:

- event generation
- recipient resolution
- permission scope
- localization
- read/unread
- deep link
- retry
- duplicate prevention

---

# 79. Push Notification Tests

Where push is enabled, test:

- valid token
- expired token
- revoked token
- duplicate delivery protection
- localized content
- secure deep links

---

# 80. Notification Privacy Tests

Verify notification content does not expose unauthorized sensitive financial/member information.

---

# 81. Storage Tests

Test:

- authorized upload
- unauthorized upload
- authorized read
- unauthorized read
- signed URL
- invalid file
- oversized file
- orphan file
- deletion/replacement rules

---

# 82. Storage Path Tests

Verify users cannot alter object paths to access another user's files.

---

# 83. Signed URL Tests

Test:

- valid signed access
- expiration
- unauthorized generation
- object mismatch

---

# 84. API Tests

Every important API/domain command should have:

- valid input
- invalid input
- unauthorized input
- conflict
- duplicate/retry where relevant
- server error behavior

---

# 85. API Contract Tests

Verify client and server agree on:

- request shape
- response shape
- status
- errors
- identifiers

---

# 86. API Error Tests

Test stable domain errors such as:

```text
unauthorized
forbidden
validation_failed
not_found
conflict
already_processed
idempotency_conflict
server_error
```

The final error taxonomy is governed by the API architecture.

---

# 87. API Pagination Tests

Test:

- first page
- next page
- last page
- empty result
- invalid cursor/page
- authorization across pages

---

# 88. Search Tests

Test:

- authorized results only
- no results
- partial search
- pagination
- case behavior
- localization behavior where supported

---

# 89. Filter Tests

Test combinations of:

- status
- date
- account
- member
- role
- category

according to the screen's approved filters.

---

# 90. Sorting Tests

Verify sorting uses authoritative data types.

Especially:

- dates
- amounts
- numeric counts
- localized text

---

# 91. Dashboard Tests

Dashboards should test:

- correct metrics
- authorization
- empty state
- loading
- error
- realtime updates
- stale data
- responsive layout

---

# 92. Financial Dashboard Tests

Verify dashboard metrics reconcile with underlying authoritative data.

---

# 93. Member Dashboard Tests

Verify members see:

- their obligations
- their payments
- their notifications

and not unrelated member data.

---

# 94. Role Dashboard Tests

Each role's dashboard must match its permissions.

---

# 95. Navigation Tests

Test:

- authorized links
- unauthorized links
- route protection
- role changes
- logout
- deep links

---

# 96. Deep-Link Security Tests

Attempt direct deep links to unauthorized resources.

Expected:

```text
no sensitive data exposure
```

---

# 97. Authentication Route Tests

Test:

- logged-out access
- logged-in access
- expired session
- deactivated account
- missing role/application profile

---

# 98. Session Cache Tests

After logout or role reduction verify sensitive cached data is not still visible.

---

# 99. Web E2E

Web E2E should cover critical journeys using realistic seeded test data.

---

# 100. Mobile E2E

Mobile E2E should cover:

- authentication
- member workflow
- donation/payment
- attendance
- notifications
- offline sync

as supported by the chosen test tooling.

---

# 101. Cross-Platform Consistency

Equivalent workflows on web and mobile should produce consistent domain results.

Visual implementation may differ.

---

# 102. Browser Testing

The final browser matrix should follow the deployment specification.

At minimum, test the primary supported desktop/mobile browser combinations.

---

# 103. Device Testing

Mobile testing should include representative:

- Android
- iOS

devices/emulators according to the supported release matrix.

---

# 104. Responsive Testing

Test:

- small mobile
- large mobile
- tablet
- laptop
- desktop
- wide desktop

---

# 105. Accessibility Testing

Accessibility testing includes:

- keyboard
- screen reader
- focus
- contrast
- text scaling
- reduced motion
- semantic structure

---

# 106. Automated Accessibility Testing

Automated tooling should run against critical web components/pages.

It should be treated as an early-warning system, not complete certification.

---

# 107. Keyboard Testing

Critical web workflows must be completed without a mouse.

---

# 108. Screen Reader Testing

Representative critical workflows must be tested with supported screen-reader/platform combinations.

---

# 109. Mobile Accessibility Testing

Test:

- platform screen reader
- font scaling
- touch targets
- focus/order
- announcements

---

# 110. Localization Testing

For each supported locale test:

- navigation
- forms
- validation
- notifications
- dashboards
- finance
- errors
- empty states

---

# 111. Translation Completeness Tests

CI should detect:

- missing keys
- extra keys where invalid
- broken interpolation
- malformed translation files

---

# 112. Urdu RTL Tests

Test:

- navigation
- forms
- dialogs
- tables
- financial displays
- notifications
- mobile
- mixed-direction identifiers

---

# 113. Localization Overflow Tests

Test long translations in:

- buttons
- badges
- headings
- navigation
- dialogs
- tables
- cards

---

# 114. Date/Number Localization Tests

Test locale-aware:

- dates
- times
- counts
- currency
- percentages where used

---

# 115. Financial Display Tests

Verify:

- currency
- decimal precision
- negative values
- zero
- large values
- localized display

---

# 116. Visual Regression Testing

Visual regression should cover high-value stable screens.

Examples:

- login
- member dashboard
- donation
- payment review
- finance dashboard
- committee task
- attendance
- notification center
- reports

---

# 117. Visual Regression States

Capture representative:

- loading
- loaded
- empty
- error
- success
- offline
- RTL
- localized

states where useful.

---

# 118. Component Regression

Core shared components should have visual/behavioral regression coverage.

---

# 119. Performance Testing

Performance tests should cover:

- initial load
- dashboard
- member search
- payment list
- finance transaction list
- report generation
- realtime updates

---

# 120. Web Performance

Measure:

- bundle impact
- page load
- rendering
- API latency
- unnecessary network calls

---

# 121. Mobile Performance

Measure:

- startup
- screen transition
- list rendering
- offline queue behavior
- memory
- battery impact where relevant

---

# 122. Database Performance

Test critical queries under realistic dataset sizes.

---

# 123. Load Testing

Load testing should be introduced before production if expected traffic/risk warrants it.

Focus on:

- authentication
- member search
- payment review
- dashboards
- notifications
- database queries

---

# 124. Concurrency Testing

Concurrent operations are especially important for:

- payment verification
- allocation
- account transfers
- expenses
- corrections
- attendance sync

---

# 125. Race Condition Testing

Test competing requests arriving in different orders.

The final state must obey the same invariants regardless of valid request ordering.

---

# 126. Security Testing

Security tests should include:

- authentication bypass attempts
- authorization bypass
- RLS bypass attempts
- storage traversal
- injection
- XSS where applicable
- replay
- idempotency abuse
- rate-limit behavior

---

# 127. Secret Scanning

CI should scan for accidentally committed secrets where tooling is available.

---

# 128. Dependency Scanning

Dependency vulnerabilities should be detected and reviewed.

---

# 129. SQL Security Testing

Test for:

- injection
- unsafe dynamic SQL
- search-path problems
- privilege escalation
- missing RLS

---

# 130. Storage Security Testing

Test for:

- path manipulation
- unauthorized signed URL
- cross-user access
- public bucket exposure

---

# 131. Authentication Security Testing

Test:

- OTP abuse
- session fixation/replay
- unauthorized refresh
- deactivated accounts
- incorrect role resolution

---

# 132. Authorization Security Testing

Attempt direct privileged API calls as lower-privileged roles.

---

# 133. Rate Limit Testing

Verify rate limiting exists where required and does not create unintended denial of service for legitimate users.

---

# 134. Abuse Testing

Consider abuse scenarios such as:

- referral spam
- repeated payment submissions
- repeated OTP
- notification flooding
- large file upload
- search abuse

---

# 135. Resilience Testing

Test failures of:

- network
- realtime connection
- storage
- notification service
- external UPI handoff
- database command
- application restart

---

# 136. Recovery Testing

After a failure verify:

- no silent data loss
- retry behavior
- idempotency
- user-visible status
- authoritative reconciliation

---

# 137. Crash Recovery

Test application restart during:

- offline queue
- file upload
- payment draft
- attendance sync

---

# 138. Browser Refresh Recovery

Refresh during important workflows and verify appropriate persistence/authorization.

---

# 139. Mobile Background/Foreground

Test:

- app backgrounding
- app resume
- token expiry
- queued operations
- realtime reconnect

---

# 140. Reconnect Testing

Test:

```text
connected
→ disconnected
→ changes occur
→ reconnect
→ reconcile
```

---

# 141. Database Failure Testing

Where practical in non-production:

- transaction failure
- connection failure
- constraint violation
- timeout

Verify safe failure.

---

# 142. Storage Failure Testing

Simulate upload failure and verify:

- no false success
- retry
- cleanup
- user feedback

---

# 143. Notification Failure Testing

Notification failure must not incorrectly roll back a committed core transaction unless explicitly designed.

---

# 144. Financial Failure Injection

Financial operations should be tested under injected failures.

---

# 145. Test Environment Separation

Testing must use appropriate development/test Supabase environments.

Do not run destructive tests against production.

---

# 146. Test Data Isolation

Automated tests must not corrupt shared development data unexpectedly.

---

# 147. Database Reset

Test databases should have a reliable reset/seed process where appropriate.

---

# 148. Seed Reproducibility

The same seed should produce a predictable dataset.

---

# 149. Test Fixtures

Fixtures should represent realistic domain states.

Examples:

```text
member with no outstanding
member with one outstanding month
member with multiple outstanding months
pending payment
verified payment
rejected payment
overpayment
finance account
pending expense
committee task
offline attendance queue
```

---

# 150. Edge-Case Dataset

Maintain explicit edge cases.

Examples:

- zero
- one
- exact boundary
- maximum supported value
- empty
- null where allowed
- duplicate
- stale
- unauthorized

---

# 151. Boundary Testing

Test:

- minimum
- maximum
- just below
- exactly at
- just above

for important numeric/date constraints.

---

# 152. Property-Based Testing

Property-based testing may be used for complex pure logic.

Especially useful for:

- allocation
- arithmetic invariants
- idempotency transformations
- parsers

---

# 153. Financial Properties

Examples:

```text
sum(allocations) <= verified payment
```

and other approved invariants.

---

# 154. Mutation Testing

Mutation testing may be used selectively to evaluate whether financial/business tests detect incorrect logic.

---

# 155. Test Coverage

Coverage should be used as a signal, not a goal by itself.

High coverage with weak assertions is insufficient.

---

# 156. Critical Path Coverage

Critical financial/security workflows require meaningful coverage regardless of overall percentage.

---

# 157. Test Naming

Tests should describe behavior and expected outcome.

---

# 158. Test Organization

Organize tests by domain/workflow where practical.

Examples:

```text
auth
members
donations
payments
finance
committee
attendance
notifications
security
```

---

# 159. Test Utilities

Test helpers should be shared when they represent stable test infrastructure.

Avoid giant test utility modules.

---

# 160. Mocking

Mock only external or uncontrollable boundaries when practical.

Do not mock away the business logic being tested.

---

# 161. Database Integration

Financial and RLS tests should exercise real database behavior in controlled environments where possible.

---

# 162. Contract Mocks

Mocks must remain synchronized with actual contracts.

Stale mocks are a testing defect.

---

# 163. External API Mocks

External integrations should use controlled test fixtures.

---

# 164. Time Mocking

Time-dependent tests should use controlled clocks rather than relying on current wall-clock time.

---

# 165. Randomness

Randomness in tests should be seeded or controlled where possible.

---

# 166. Network Control

Tests must be able to simulate:

- success
- timeout
- offline
- server error
- retry

---

# 167. Test Reporting

CI should report:

- passed
- failed
- skipped
- flaky
- duration
- coverage where configured

---

# 168. Failed Test Handling

A failing test should be investigated.

Do not permanently skip tests to make CI green without documented reason.

---

# 169. Flaky Test Policy

Flaky tests should be:

1. identified
2. isolated
3. fixed
4. documented if temporarily quarantined

---

# 170. Regression Testing

Every fixed defect should have a regression test where practical.

---

# 171. Bug-to-Test Rule

Important bugs should produce a test that would have caught the bug.

---

# 172. Release Smoke Tests

Every release should execute a focused smoke suite.

Suggested:

- app loads
- login
- role resolution
- dashboard
- basic member access
- safe read
- critical API health

---

# 173. Financial Release Smoke Tests

Where safe test mechanisms exist:

- payment submission
- finance review test
- allocation test
- account transaction test

Production smoke tests must not create real financial data unless explicitly designed as isolated test data.

---

# 174. Post-Deployment Verification

After deployment verify:

- web availability
- authentication
- database connection
- RLS
- storage
- realtime
- notifications
- key routes

---

# 175. Production Monitoring

Testing does not stop at deployment.

Monitor:

- errors
- latency
- failed commands
- auth failures
- database health
- notification failures
- realtime failures

---

# 176. Alerting

Critical production failures should trigger appropriate alerts.

---

# 177. Financial Monitoring

Monitor for:

- reconciliation mismatch
- duplicate transaction patterns
- failed verification
- abnormal correction/reversal activity
- account imbalance

---

# 178. Audit Monitoring

Monitor for unexpected audit failures or missing events.

---

# 179. Security Monitoring

Monitor:

- repeated auth failures
- unusual privilege attempts
- suspicious storage access
- rate-limit violations

---

# 180. Test-Driven Development

TDD may be used where practical.

For high-risk business logic, writing tests before implementation is strongly encouraged.

---

# 181. Example TDD Flow

```text
Business rule
  ↓
Failing test
  ↓
Implementation
  ↓
Pass
  ↓
Refactor
```

---

# 182. Test First for Financial Logic

For FIFO and financial invariants:

1. define expected behavior
2. write tests
3. implement
4. run edge cases
5. review

---

# 183. Test First for Authorization

For sensitive permissions:

1. define allowed roles
2. define denied roles
3. write positive/negative tests
4. implement policy
5. verify direct access

---

# 184. Test First for RLS

Define:

```text
who can read
who can insert
who can update
who can delete
```

before implementing policies.

---

# 185. Test First for Offline

Define operation lifecycle before writing queue code.

---

# 186. Test First for Realtime

Define:

- who receives event
- when
- what payload
- reconciliation behavior

before implementation.

---

# 187. Accessibility Test-First

For shared components, define keyboard/focus/accessibility behavior before implementation.

---

# 188. Localization Test-First

Define locale keys and supported states before hard-coding UI strings.

---

# 189. CI Testing Pipeline

A conceptual CI pipeline:

```text
Install
  ↓
Format check
  ↓
Lint
  ↓
Typecheck
  ↓
Unit tests
  ↓
Integration tests
  ↓
Security/RLS tests
  ↓
Build
  ↓
E2E
  ↓
Accessibility
```

Exact ordering may be optimized for speed.

---

# 190. Fast Feedback

Cheap tests should run earlier.

Expensive tests may run later or in parallel where safe.

---

# 191. Pre-Commit Checks

Pre-commit checks should remain fast.

Do not put very slow full-system tests into every local commit hook unless justified.

---

# 192. Pre-Push Checks

Pre-push checks may include broader verification.

---

# 193. Pull Request Checks

PRs should run required CI gates.

---

# 194. Main Branch Checks

Main should receive the strongest verification available before release.

---

# 195. Test Artifacts

CI should preserve useful artifacts such as:

- test reports
- screenshots
- logs
- coverage
- failed E2E traces

according to repository policy.

---

# 196. Screenshot Testing

For UI failures, screenshots should identify the state and viewport.

---

# 197. Mobile Test Artifacts

Mobile failures should preserve appropriate logs/screenshots where tooling supports them.

---

# 198. Security Test Artifacts

Security tests should record enough evidence for review without exposing secrets.

---

# 199. Database Test Artifacts

Database tests should report:

- migration result
- policy result
- invariant checks

---

# 200. Test Data Privacy

Test reports must not accidentally expose real user data.

---

# 201. Test Environment Credentials

Test credentials should be isolated and safe.

---

# 202. Production Test Restrictions

Never use production:

- real member credentials
- real OTP
- real payment proofs
- destructive test commands

unless explicitly authorized and safely isolated.

---

# 203. E2E Data Cleanup

E2E tests should clean up or isolate generated data.

---

# 204. Idempotent Test Setup

Test setup should itself be repeatable.

---

# 205. Parallel Tests

Parallel execution is encouraged only when tests are isolated.

---

# 206. Shared Database Tests

Tests sharing a database must avoid race conditions caused by shared mutable fixtures.

---

# 207. Test Naming by Domain

Example:

```text
payments/fifo
payments/verification
finance/transfers
attendance/offline
security/rls
```

---

# 208. Financial Test Matrix

At minimum:

| Area | Positive | Negative | Concurrency | Retry |
|---|---:|---:|---:|---:|
| Payment | Yes | Yes | Yes | Yes |
| FIFO | Yes | Yes | Yes | Yes |
| Combined payment | Yes | Yes | Yes | Yes |
| Transfer | Yes | Yes | Yes | Yes |
| Expense | Yes | Yes | Where relevant | Yes |
| Correction | Yes | Yes | Yes | Yes |
| Reversal | Yes | Yes | Yes | Yes |

---

# 209. Authorization Test Matrix

Each role must be evaluated against:

- member data
- referrals
- donations
- payments
- finance
- committee
- attendance
- notifications
- reports
- audit
- administration

---

# 210. Accessibility Test Matrix

Critical workflows:

- auth
- member
- donation
- payment
- finance
- committee
- attendance
- notifications
- reports

---

# 211. Localization Test Matrix

Critical screens:

- login
- registration
- dashboard
- member
- donation
- payment
- finance
- committee
- attendance
- notifications
- reports

---

# 212. Offline Test Matrix

Critical offline workflow:

```text
capture
queue
restart
reconnect
sync
duplicate
conflict
failure
retry
```

---

# 213. Realtime Test Matrix

Critical realtime workflow:

```text
initial load
subscribe
change
receive
duplicate
disconnect
reconnect
reconcile
```

---

# 214. Storage Test Matrix

Test:

```text
upload
invalid file
unauthorized upload
download
unauthorized download
signed URL
expiry
replacement
cleanup
```

---

# 215. Notification Test Matrix

Test:

```text
event
recipient
localization
delivery
read
deep link
retry
duplicate
```

---

# 216. Performance Test Matrix

Test:

- initial page
- dashboard
- large list
- search
- report
- realtime
- mobile startup

---

# 217. Resilience Matrix

Test:

- network loss
- timeout
- server error
- database error
- storage error
- notification failure
- app crash
- reconnect

---

# 218. Security Matrix

Test:

- authentication
- authorization
- RLS
- storage
- input
- injection
- secrets
- rate limits
- replay
- privilege escalation

---

# 219. Release Gate

A release candidate must not have unresolved critical failures in:

- security
- financial integrity
- authentication
- authorization
- data integrity

---

# 220. Release Gate — Accessibility

Critical accessibility failures must be resolved or explicitly accepted through documented release governance.

---

# 221. Release Gate — Localization

Critical localization/RTL failures must be resolved or explicitly accepted.

---

# 222. Release Gate — Performance

Critical performance regressions must be investigated before release.

---

# 223. Release Gate — Offline

Approved offline workflows must pass their required sync/recovery tests.

---

# 224. Release Gate — Realtime

Critical realtime workflows must pass reconnect/reconciliation tests.

---

# 225. Release Gate — Storage

Sensitive storage access tests must pass.

---

# 226. Release Gate — Notifications

Critical notification workflows must pass recipient and authorization tests.

---

# 227. Release Gate — Database

Migrations and integrity checks must pass in the release environment.

---

# 228. Release Gate — Build

Production builds must succeed.

---

# 229. Release Gate — Documentation

Relevant documentation must match implementation.

---

# 230. Defect Severity

Defect severity should be based on:

- user impact
- data loss
- financial impact
- security impact
- frequency
- recoverability

Exact severity labels are governed by project QA policy.

---

# 231. Critical Defects

Examples:

- unauthorized financial access
- incorrect money movement
- duplicate financial transaction
- authentication bypass
- RLS bypass
- irreversible data loss

---

# 232. High Defects

Examples:

- important workflow blocked
- incorrect allocation
- significant notification failure
- major offline data loss risk
- serious accessibility failure

---

# 233. Medium Defects

Examples:

- non-critical workflow issue
- visual inconsistency
- limited localization problem

---

# 234. Low Defects

Examples:

- minor visual issue
- copy improvement
- low-impact layout refinement

Severity is determined by impact, not implementation effort.

---

# 235. Bug Lifecycle

Suggested:

```text
Detected
  ↓
Triaged
  ↓
Reproduced
  ↓
Assigned
  ↓
Fixed
  ↓
Regression tested
  ↓
Verified
  ↓
Closed
```

---

# 236. Bug Reproduction

A bug report should include:

- environment
- role
- steps
- expected
- actual
- evidence
- relevant identifiers without sensitive data

---

# 237. Regression Test Requirement

Critical/high bugs should receive regression coverage where technically appropriate.

---

# 238. Test Documentation

Important test decisions should be documented.

---

# 239. Test Plan per Feature

Each major feature should have a mini test plan.

Template:

```text
Feature:
Requirements:
Business rules:
Roles:
Security:
Database:
API:
UI:
Offline:
Realtime:
Notifications:
Accessibility:
Localization:
Positive cases:
Negative cases:
Edge cases:
Concurrency:
Retry:
```

---

# 240. AI Testing Policy

AI tools may generate tests.

Human review must confirm:

- assertions are meaningful
- expected behavior is correct
- tests are not over-mocked
- security boundaries are covered
- edge cases are present

---

# 241. AI Test Review

Ask a second AI to challenge:

- missing cases
- false positives
- weak assertions
- business-rule mistakes
- security gaps

---

# 242. AI Cannot Declare Completion

AI may report test results, but project completion remains an engineering decision based on evidence.

---

# 243. Test Evidence

Important claims should have evidence:

```text
command
result
environment
date/context
```

---

# 244. Verification Log

For substantial features maintain a concise verification record.

Example:

```text
Typecheck: PASS
Lint: PASS
Unit: PASS
Integration: PASS
RLS: PASS
E2E: PASS
Accessibility: PASS
RTL: PASS
Build: PASS
Known issues: None
```

---

# 245. Failed Verification

If a check fails:

1. record it
2. determine cause
3. fix or document exception
4. rerun
5. do not hide the failure

---

# 246. Partial Verification

Do not describe partial verification as complete verification.

---

# 247. Test Environment State

Record environment assumptions for difficult-to-reproduce tests.

---

# 248. Production Readiness

Testing contributes evidence toward production readiness but does not replace operational review.

---

# 249. Final Testing Principle

Testing is a continuous engineering activity.

The standard is:

```text
Requirements
  ↓
Rules
  ↓
Implementation
  ↓
Tests
  ↓
Security
  ↓
Accessibility
  ↓
Localization
  ↓
Resilience
  ↓
Verification
  ↓
Release
```

---

# 250. Document Status

**Status:** Draft — Review Required

**Next actions:**

1. Review against `DEVELOPMENT_STANDARDS.md`.
2. Review against `FINANCIAL_INTEGRITY_SPEC.md`.
3. Review against `RLS_SECURITY_MODEL.md`.
4. Review against `OFFLINE_SYNC_ARCHITECTURE.md`.
5. Review against `REALTIME_DATA_FLOW.md`.
6. Resolve contradictions before implementation.
7. Use this strategy as the testing baseline for feature development.
