# Phase 1 — product rules and decision closure

**Prepared:** 15 October 2026. **Status:** five product rules accepted by the project owner on 17 October 2026; privacy/publication approval and implementation alignment remain open. This is not database or live-product verification. It reconciles the 100-question baseline, later user decisions, and acceptance criteria. The latest explicit decision wins. Defaults below are implementation proposals where the user did not specify an edge case; they must be visible in product acceptance and can be revised without rewriting historical postings.

**Identity and context:** one active app user has one role: SA System Admin, P President, VP Vice President, S Secretary, T Treasurer, C Committee Member, M Member, or L named data-entry employee using the dedicated masjid laptop account. Multiple people may hold P/VP/S/T. Inactive, unprovisioned, anonymous and expired-session actors have no protected command or member-data read. Every command resolves actor and current active role at the server; no client role claim is trusted. `Own` means only the authenticated actor's row; `Invited` means their meeting invitation; `Assigned` means confirmed task participation. A public visitor may read only published public content, active APK metadata and a narrowly throttled exact-code receipt lookup.

## Role/action/resource matrix

`Y` = permitted subject to object/state guards; `R` = scoped read only; `Own`/`Invited`/`Assigned` = row relationship; `—` = deny. This is the target contract, not a statement that current SQL enforces all cells. Reports are detailed financial reports, not the public salary projection. L is one account tied to one named employee at a time; a replacement receives a new identity.

| Action/data | SA | P | VP | S | T | C | M | L |
|---|---|---|---|---|---|---|---|---|
| Provision/reset/deactivate role; set release policy | Y | — | — | — | — | — | — | — |
| Read/edit own WhatsApp contact | Own | Own | Own | Own | Own | Own | Own | Own |
| Read member directory and permitted performance | R | R | R | R | R | R | R | R |
| Change other's name/role/profile administrative fields | Y, audited | — | — | — | — | — | — | Y for contact/profile fields only, audited |
| View donor roster and actual referrer, no donor phone/consent | R | R | R | R | R | R | R | R |
| Enroll monthly donor with consent and named referrer | — | Y | Y | Y | Y | Y | Y | Y |
| Change existing donor suggestion/consent/active state | — | Y | — | — | Y | — | — | —; correction request only |
| Submit payment claim or one-time donation | — | Y | Y | Y | Y | Y | Y | Y for claim/data entry only |
| Verify/reject donation or cash count; post income | — | — | — | — | Y | — | — | — |
| Read detailed finance/accounts/transactions/proof metadata | R, audited | R | R | R | R | — | — | — |
| Generate/download detailed month/year/range report | Download existing R only | Y | Y | Y | Y | — | — | — |
| Submit expense request with bill or explanation | — | Y | Y | Y | Y | Y | Y | Y |
| Review L's submitted expense evidence | — | — | — | — | Y | — | — | — |
| Decide ordinary/VP/T/C/M/L expense | — | Y, not own | — | — | — | — | — | — |
| Decide P expense | — | — | — | — | Y, not own | — | — | — |
| Pay expense, transfer, reconcile, correct posted finance | — | — | — | — | Y after valid approval | — | — | — |
| Enter account opening balance | — | — | — | — | Y | — | — | — |
| Verify opening balance | — | Y, different actor | — | — | — | — | — | — |
| Activate replacement QR with selected active beneficiary | — | Y | — | — | — | — | — | Y |
| Create/manage task | — | Y | Y | Y | — | — | — | — |
| Join task, submit own completion | — | Assigned/Own | Assigned/Own | Assigned/Own | Assigned/Own | Assigned/Own | Assigned/Own | Assigned/Own |
| Decide completion | — | Creator | Creator | Creator | — | — | — | — |
| Create/manage meeting | — | Y | Y | Y | — | — | — | Y |
| RSVP/check in meeting | Invited if any | Invited | Invited | Invited | Invited | Invited | Invited | Invited |
| Organizer onsite manual attendance / finalize | — | Creator | Creator | Creator | — | — | — | Creator; fallback finalization only after full day |
| Mark/correct five Hafiz prayer slots | — | Y | Y | Y | Y | — | — | — |
| Publish/modify public announcements and media | — | Y | Y | Y | — | — | — | Y |
| View salary member projection | R | R | R | R | R | R | R | R |
| Request audited staged restore | — | — | — | — | — | — | — | Y, server only |

**Cross-cutting guards:** SA finance support read never grants approve, pay, post, report generation or account mutation. P cannot approve their own expense; T may pay their own request only after P approval. L cannot verify their enrolled donor's payment. Approval/report/private file/download direct URLs must repeat permission and object checks. Public, inactive and unprovisioned actors have `—` for every row above. A service worker does not inherit a human role; it is restricted to its named job and authenticated server boundary.

**Open ambiguity captured:** An earlier matrix proposed M referral/enrollment, while the later baseline says “authorized” users and explicitly grants L enrollment. The owner accepted M enrollment and existing donor edits limited to P/T on 17 October 2026; Migration 16 and the web enrollment route now include M, but donor editing is not implemented and consent approval still gates enrollment. The earlier role matrix labels SA task/meeting/QR powers `Open`; no later explicit grant exists, so target denies those writes. L salary member projection is allowed as a logged-in employee only after privacy approval; payroll bank details, private proof and phone remain hidden. L profile edits are limited to contact fields and audited, never role/name/finance. See [owner packet](PHASE_1_OWNER_DECISION_PACKET.md); amend this matrix after a recorded owner decision.

## Financial and monthly contribution state rules

1. **Authoritative amount:** A suggestion/request is not debt or money. Post only a positive amount actually checked by T in the selected active Cash/UPI/Bank account. All amounts are integer paise. A submitted transaction reference or `PAID` text is pending evidence only.
2. **Monthly period:** Every claim names the donor and first day of the intended India-local month; creation requires a queued request or an audited T-created manual exception with recorded reason. A late verification stays attributed to that original period, with actual posting timestamp separately retained. If the period is ambiguous, hold claim pending for T to allocate; never silently use today's month.
3. **Several payments in one month:** Several distinct verified claims may produce separate actual-amount receipts and ledger entries. Month is `contributed` after the first positive verified claim. No difference from suggestion is a balance; no five-day or remaining-balance reminder after that point. The period total is the sum of actual verified postings net of later corrections. The accepted rule is at most one referral point per donor/month for the recorded actual referrer, recomputed after voids and corrections. Splitting payments never suppresses genuine receipts.
4. **Excess amount:** A verified payment above suggestion records the full actual amount and a matching receipt. It does not raise next month's suggestion or create an automatic credit/debt. A donor-requested future allocation needs a separately reviewed command and receipt policy; no implicit carry-forward.
5. **Reference uniqueness:** Normalize a provider reference for comparison (trim, provider/account context, case where provider rules permit), keep its original exact text as evidence, and reject duplicates within a provider/account across donors/periods. A truly ambiguous reference is pending investigation; no second post. An operation ID replay with identical actor/inputs returns the prior result; changed inputs conflict. A rejected reference remains in history and cannot be used to create a second financial posting without a reviewed correction path.
6. **Rejected claim:** T records reason; rejected claims post zero, award zero points and issue no receipt. The submitter may correct/resubmit as a new revision linked to the rejected claim; history remains. If the same bank reference was rejected solely for an input typo, T must resolve its unique-reference reservation before any corrected claim posts; no blind duplicate allowance.
7. **Receipt and referral:** Verification atomically creates ledger effect, receipt and audit; receipt number is high-entropy and nonsequential. A new payment claim is a new receipt, not a reissue of an old one. A void/reversal removes active contribution effect and recomputes month status/reminder eligibility; external reminder send still checks consent and state at dispatch. Referral identity is the recorded referrer, never the data-entry actor.
8. **Suggested amount change:** New suggestion applies to current profile immediately with actor/time history. Already queued/sent amount, QR/account and any issued receipt remain snapshots. It sends no supplemental request; the next ordinary scheduled request uses then-current amount. Existing verified month remains contributed.
9. **QR:** P/L upload a replacement asset and select an active beneficiary as one audited activation. Request at dispatch snapshots selected QR digest/account and amount. Earlier sent requests retain the beneficiary reference/digest; payment posting uses account in which T actually confirmed funds and flags mismatch for investigation. Production sending remains disabled until real QR and beneficiary are supplied/verified.
10. **Cash/other donation:** Member entry stays pending until T physically verifies cash or bank payment. T direct cash entry can post once. One-time donors have required name and actual amount/method/date; receipt only after posting. Cash-to-bank deposit is two linked account effects and zero new income.

### Expense, correction, report and salary rules

- Expense `draft → submitted → evidence review if L → approved/rejected → unpaid/partially paid/paid/closed`. Each submission snapshots amount, bill/explanation and requester role. Normal and VP requests: P decides. P request: another active T decides. T request: P decides. L request: T checks evidence, then P decides; T pays only after approval. No self approval. A rejected request may be revised and resubmitted with preserved history. Changing approved amount invalidates old approval and requires a new decision. Partial payments cannot exceed current approved amount and do not change it.
- Opening balance is pending until P verifies a T entry. A transfer changes two accounts exactly once and leaves overall income/expense unchanged. Advance disbursement remains outstanding until bills/unused return settle it. Salary payment posts only on actual disbursement; member-facing projection includes name, role, month, amount, paid state/date/method, but excludes bank identifiers, private proof and contact. **Owner review:** publication of salary amounts to every logged-in member is the user's choice and needs organizational privacy sign-off.
- T's requested **Edit/Remove** of a verified item is a user-facing correction or void, never physical deletion of ledger/audit/receipt. Require reason and actor/time. Correction locks source, records before/after, reverses original active effect and, for an edit, posts a replacement effect atomically; operation IDs prevent repeat. Original receipt becomes void/superseded in exact-code lookup and points to replacement if policy permits; replacement gets a new code/PDF. Existing report artifact retains its revision/cutoff and is marked superseded; new report recomputes with correction and audit linkage. Never silently overwrite an issued PDF.
- Detailed reports: P/VP/S/T generate and download, SA reads existing detailed finance/report for support only with audit; others denied. Monthly, Jan–Dec year and custom range use the same authoritative posted ledger. Internal transfers are separate. Pending claims, unapproved/unpaid expense, suggested amounts and unreconciled advance are not booked as income/expense. Proof references are optional at T's report choice.

## Work, location, messaging, offline and release rules

- **Tasks:** P/VP/S create direct/open/mixed mode, optional date/location, overall cap and mixed assigned/volunteer caps. Atomic join enforces per-source and overall caps. Overflow joins FIFO waitlist; when a place frees, first eligible active person auto-promotes and is told their status. No offer-expiry timer in v1. An assignee may withdraw; creator cancellation changes in-app status without outbound cancellation notice. Member submits completion with optional note; only creator's acceptance awards task point. Creator unavailable leaves it pending. Reject/return requires reason.
- **Meetings:** P/VP/S/L create and invite. Decline reason optional. One-hour reminder goes only to non-decliners. Check-in is during the entire scheduled Asia/Kolkata date within configured 100 m center with fresh accurate foreground location; unset center disables location check-in. Organizer manual presence needs organizer's own current onsite proof. Finalize after full scheduled-day window; L fallback only if creator did not finalize, cannot mark presence. Final roster distinguishes attended/declined/absent, queues each absence notice once. The exact center is an external input.
- **Hafiz prayer:** Fajr/Dhuhr/Asr/Maghrib/Isha are separate India-local date slots. P/VP/S/T attest prayer occurred before marking Present/Absent; subsequent correction needs no written reason but preserves old/new value, actor and time. No invented automatic prayer timetable. No reuse of separate member Jummah attendance.
- **Performance:** Show verified task completion, meeting attended/invited with declines and absences separate, and eligible referral months. The accepted “Activity points” indicator is the sum of earned task + meeting + referral points for the selected period, with components and denominators displayed and no leaderboard. Corrections/voids recompute source-dependent points. **Owner decision:** cap and wording accepted 17 October 2026; verify implementation before release.
- **Announcements:** P/VP/S/L may publish approved public content, schedule/expire/edit with history. Published edit notifies members. An expired post is not promoted; a private memo is never public. No automatic 30-day deletion from old draft.
- **Messaging:** persist consent evidence/version and opt-out source/time. First-Friday 10:00 Asia/Kolkata request, five-day reminder only if no verified contribution, three consecutive unpaid periods notice to referrer. STOP suppresses new and retry sends immediately. Outbox/inbox and provider event IDs dedupe. Only T verification queues receipt number plus current verified site URL; never a PDF attachment or claim of bank settlement from text alone. Actual Meta category/rate/template approval is an integration gate.
- **Offline:** initial Android offline operations are donation-entry, expense-entry and task-entry drafts only. Sync creates pending server records with stable operation ID. No offline approval, payment verification, public receipt, restore, GPS attendance proof or direct posting. Show pending/conflict/rejected; preserve drafts through app restart/upgrade.
- **Release:** System Admin controls min/latest Android version and published HTTPS APK link after upload. Server denies protected old-client commands; public website/update/contact remains reachable. Same package/signing identity and increasing versionCode; an APK bundle export is not a signed APK. Technical support is labeled separately from masjid donor/payment WhatsApp.
- **Audit/retention:** keep financial postings, correction links, role/consent and release/restore actor history for the lifetime of operational records; soft deactivate actor identities. Do not expose audit history generally. Backups retain 30 daily and 12 monthly archives; expiry of backup copies does not delete active source history. **Owner/legal review:** exact personal-data/deletion, attachment, message log and audit retention durations require an approved privacy schedule before launch. Until then, do not implement destructive purges or claim a finalized retention policy.

## Acceptance mapping and Phase 2 handoff

Each ID is defined in `../../docs/PRODUCT_ACCEPTANCE_CRITERIA_2026-10-15.md`. The command names are conceptual; Phase 2 freezes request/response shapes and storage ownership. All fail closed for public/inactive/unprovisioned callers.

| IDs | Product rule / server transition | Observable acceptance evidence |
|---|---|---|
| A-ID1, A-ID2, A-ID3 | SA provisions/resets/deactivates; active role/object guards; own contact update | One-use first-login flow, role denial, stale session denial, auditable actor identity |
| A-FIN0, A-FIN1 | Read-only SA projection; T enters opening, P verifies; reconcile | Direct mutation denied to SA; balances unchanged by pending entry; variance visible |
| A-FIN2, A-FIN3, A-FIN4 | Expense evidence→approver decision→T payment; correction/void; transfer/advance/salary | Separate actors, paise equation, no physical delete, private proof scope |
| A-DON1, A-DON2 | One-time/cash pending verification; consented donor, suggestion and QR snapshots | T-only posting, no wrong referrer, one request per donor/period, no opt-out send |
| A-DON3, A-DON4 | Claim→T actual verification→ledger/receipt/referral/outbox; masjid Business contact | Duplicate reference/replay denial, partial actual amount, no false `PAID` confirmation |
| A-REC1, A-REP1 | Exact opaque receipt lookup and authorized versioned itemized report | Throttled private PDF, corrected receipt status, all posted sums reconcile |
| A-TASK1, A-TASK2 | Atomic slot/waitlist→completion→creator verified score | No overfill/duplicate promotion or self-awarded point |
| A-MEET1, A-MEET2, A-HAF1 | Invite/RSVP→fresh location/onsite mark→full-day finalization; prayer correction | Declines excluded, no remote/premature presence, old/new prayer history |
| A-PERF1, A-SITE1 | Source-based score; scheduled public content | Reversal updates score; private/expired data absent publicly |
| A-MSG1, A-OFF1 | Authenticated deduped webhook/outbox; offline draft→server pending | STOP wins retry race; replay posts once; offline approval denied |
| A-BAK1, A-REL1 | Staged DB+object restore by L; SA release policy after signed upload | Clean restore and signed upgrade; old client retains public recovery path |

**Known implementation delta (rechecked 17 October):** Fresh SQL now includes M donor enrollment behind approved consent, but does not implement P/T-only existing-donor edit history, approved consent/recipient opt-in activation or the accepted donor-month referral cap. The approved consent-version table is empty; donor enrollment remains gated. Web and Android now use username sign-in, and local President/Treasurer issued sessions passed a signed-in web account/opening/transfer journey. Several later workflows and full client acceptance are still open. A product-rule acceptance is not a claim that every SQL/UI path already enforces it.

## Owner/external gates, not silently approved by this document

1. Masjid leadership/privacy owner reviews donor consent wording and notice, exact salary publication, public receipt-number disclosure, retention schedule and complaint contact. Draft copy is in `../../docs/TASK_5_DECISION_REGISTER_2026-10-15.md`; no publication until approved. Current exact-code public lookup remains a user-selected feature with high-entropy code and rate limiting.
2. Owner accepted a cap of one referral point per donor/month on 17 October 2026. Other money/receipt/reminder behavior above is implementable independently.
   Owner accepted M donor enrollment and P/T-only existing donor edits; L enrollment itself was explicitly approved. Migration 16 and the web enrollment route align on M; donor edits and consent activation remain gated.
3. Real initial QR and matching beneficiary account, confirmed 100 m center, masjid Business account/number, public site assets/roster, Drive folder/admin and signed release credentials are later setup inputs. Store unset values and disable affected production actions until verified.
4. Current provider policy/category/price, hosting quotas and Indian privacy applicability are rechecked at integration/release. This document is an engineering specification, not a legal determination or provider approval.

### Publication/privacy review packet

The following is a concrete review surface for the masjid's accountable owner; `pending` means no approval was inferred from silence. Engineering can build behind a disabled/publication gate while the review is pending.

| Item | Proposed visible behavior/copy | Approval state |
|---|---|---|
| Donor enrollment consent | Referring member records donor enrollment consent and evidence separately from recipient's own WhatsApp opt-in. Store wording/version, method, actor, date/time and actual referrer separately. An assertion checkbox alone is not proof of recipient opt-in. | Pending owner review of wording and real collection procedure; outbound disabled until recipient opt-in evidence. |
| Public receipt | Proposed exact random code lookup shows a limited page with masjid name, status, date, actual amount and masked donor identity; no donor phone, internal member ID, private proof or bank details. Formal PDF remains private unless its exact fields and code-holder disclosure rule are separately approved. Unknown/void code has generic response and throttle. | User selected number-only lookup; pending owner privacy sign-off before enabling anonymously. |
| Salary member view | Name/role, month, INR amount, paid status/date/method; no bank account, proof file or private contact. | User chose all logged-in visibility; pending organizational privacy sign-off before showing real payroll. |
| Privacy notice | Name masjid/operator and donor privacy contact, purposes, fields, recipients/processors, retention, consent/STOP, access/correction route and actual hosted processing locations. | Draft outline only; owner/local professional review and contact required. |
| Retention | Finance/audit history remains linked to active records; backup copies expire after 30 daily and 12 monthly snapshots. Personal-data/message/proof retention and deletion exceptions require a written schedule; no automatic purge before approval. | Pending owner/local professional review. |
