# Task 5 Decision Register and Deployment Inputs

**Date:** 15 October 2026  
**Status:** In progress. Ask material questions one at a time; a proposed design below is not a user answer. Latest explicit user choices remain authoritative. See `PRODUCT_ACCEPTANCE_CRITERIA_2026-10-15.md` for measurable scenarios.

## A. Settled by prior answers; implement without reopening

| Topic | Current rule | Safeguard / evidence |
|---|---|---|
| Product/platform | Masjid E Mamoor 2; Android APK and public/member web; English; INR and Asia/Kolkata | Real signed APK, website, shared backend. |
| QR instead of gateway | Current masjid QR, payment claim/transaction ID, Treasurer verifies funds; gateway later | No automatic bank-credit claim from WhatsApp text. President/laptop can replace active QR. |
| Receipt delivery | Formal PDF on website using receipt number; WhatsApp sends number/link only | New public code random/nonsequential, private PDF and throttle; old sequence conflict is implementation, not a request to send PDF. |
| Monthly contribution below suggested amount | Record the actual amount verified by Treasurer against that month; issue a receipt for exactly that amount. Once any positive amount is verified for the month, treat the month as contributed. Do not request or remind the donor about the difference. | A promised monthly figure is not posted as income. Never show an unpaid balance for that month or send a five-day reminder after a verified contribution. Corrections/voids recompute eligibility. |
| Suggested monthly amount change | Apply the new suggested amount to the current month when changed, including after its first Friday request. Keep the request as sent, all verified contributions and their receipts unchanged. | Version the suggestion with actor/time and show the latest suggestion in the donor profile. No supplemental or balance reminder is created by the change; next scheduled request uses the current amount. |
| QR beneficiary account | President or masjid laptop operator may select a different active masjid bank/UPI account when activating a replacement QR. | Store QR image digest, selected beneficiary account, actor and activation time as one version. Future messages use the current version; earlier messages and payment/account audit references keep their original version. Treasurer verifies actual funds in that account before posting. |
| System Admin finance visibility | System Admin may view detailed finance records and reports for support. Expense approval and payment remain with the President and Treasurer under the requester-specific rules. | Read actions must be independently authorized and audited where sensitive; admin role alone must not confer finance approval/payment. Other emergency write powers are not implied. |
| Masjid laptop operator | A dedicated laptop login is assigned to one data entry employee who enters masjid records. | Attribute each action to that account and employee; when the operator changes, System Admin deactivates the old account and provisions a new one, retaining old audit actor IDs. Do not share one credential among multiple operators. The account has only its explicit laptop permissions. |
| Laptop monthly donor enrollment | The data entry employee may add monthly donors using the dedicated account after recording consent. | Keep `created_by` distinct from `referred_by`; entering a donor on behalf of a member does not automatically give the data entry employee referral credit. No payment verification or posting permission follows from enrollment. |
| Meeting attendance finalization fallback | The meeting organizer normally finalizes the roster. If they have not done so, the named data entry employee may finalize it after the full scheduled-day attendance window closes. | Lock and snapshot roster, identify finalizer and reason/path as employee fallback, and send absence notifications once. Finalization itself does not mark anyone present and does not bypass 100 m proof for self or organizer manual presence. |
| Prelaunch receipt history | This is the first app version; no earlier app receipts have been issued to donors. | Issue new opaque receipt codes from launch. Inventory any development/test data before migration; do not expose sequential development codes publicly. There is no donor-facing legacy lookup requirement. |
| Technical support contact | Publish `md.shabaz.2005@gmail.com` and `7975512403` as contacts for website, Android app and other technical issues. | Label as technical support in the public website and APK update/error flow. Donation/payment assistance and donor privacy requests need their own masjid contact channel; do not repurpose the technical number as the WhatsApp Business sender without a separate decision. |
| Donor/payment contact | Donors use the masjid's dedicated WhatsApp Business number for questions about contributions and whether a payment was received. | The number will be supplied during WhatsApp onboarding. The bot may acknowledge/query status but only Treasurer verification may confirm funds or trigger a receipt. Keep technical support contacts separate. |
| Initial website address | No domain is owned yet. Deploy initially to a hosting-provided HTTPS address, with Vercel as the current candidate; buy and connect a custom domain later. | Store public base URL in configuration so WhatsApp receipt messages and APK update links use the current verified URL. Preserve/test old issued links through the domain transition before changing the configured URL. Hosting choice and quotas remain Task 10 verification. |
| Reports | Monthly, calendar-year annual, and date-range itemized finance; P/VP/Sec/Treasurer download | Preserve every rupee and separate transfers; members' salary-detail view is a different permission. |
| Expense approvals | President normally approves, Treasurer approves President request, President approves Treasurer request; Treasurer pays | No self approval; user-facing edits/deletes by Treasurer retain audit/corrected totals. |
| Task lifecycle | P/VP/Sec create; open/direct/mixed and waitlist; assignee submits, creator verifies; no deadline required | Creator cancellation has no outbound notification per latest answer, but status is visible in-app. |
| Meeting | P/VP/Sec/laptop create; decline reason optional, memo image anytime, one-hour reminder, scheduled-day 100 m check-in, onsite organizer fallback | Exact center unconfirmed; absence only after finalization. |
| Hafiz presence | Five slots; P/VP/Sec/Treasurer mark/correct after prayer without reason | Automatic before/after history; separate from member Jummah. |
| Backups | DB+objects daily, 30-day daily and one-year monthly; 4 TB Drive offered; only laptop initiates restore, without another confirmation screen | Server-side credentials, staging/preflight/audit and actual restore drill. Do not add an extra confirmation by default. |

## B. Technical defaults inferred from accepted rules

These choices make the product reviewable; Task 5 may revise them if the user provides a different preference.

| Topic | Proposed default | Rationale and limit |
|---|---|---|
| Verified edit/delete | Treasurer sees Edit/Remove; server records a version/supersession or void with correction postings and keeps original history | Preserves requested workflow and every-rupee audit; never a physical ledger deletion. |
| VP expense | President approves VP submission; VP does not approve own | The latest exception named President and Treasurer only. |
| Laptop expense | Treasurer verifies submitted bill/details, President approves, Treasurer pays | Honors laptop-verification request and global President approval; if the President is requester, Treasurer exception still applies. |
| Salary detail | All logged-in members see employee name/role, salary month, amount, paid status/date/method; payroll bank details, proof files and personal contact remain leadership/private | Meets visibility choice while minimizing unrelated personal information. |
| Task waitlist | Joining waitlist authorizes automatic promotion to first free eligible place; notification shows new confirmed state; no offer-expiry timer in v1 | Avoids a stranded slot and respects FIFO. Creator cancellation remains silent externally as selected. |
| Performance | Show three independently explained counts: verified task completions, meetings attended/invited with declines/absences separate, and one point per verified monthly referral payment; combined indicator initially sums these earned points for selected period without a ranked leaderboard | Transparent and reversible after a source correction. Attendance percentage/denominators displayed to avoid misleading raw comparison. Final wording/weight is reviewable. |
| Announcements | Authorized publisher (P/VP/Sec/laptop) approves own public post; schedule/expiry governs visibility, no forced old 30-day archive | No separate second-person content approver was requested. |
| Hafiz timing | Entry is permitted after the responsible officer attests that the prayer occurred; retain mark time; later correction allowed | Automatic prayer-time enforcement requires a reliable daily timetable not yet provided. |
| Offline | Android may save local draft for donation, expense and task forms; sync submits a new pending command. Financial verification, approvals, public receipt issuance, restore and location check-in require online server validation | Limits stale financial and location assertions while permitting data entry. Add further offline commands only with explicit acceptance scenarios. |

## C. User or external inputs still required

Ask one at a time in this order when it affects design. Do not interpret silence as approval. External account/device setup is a release gate even after design answers.

| Priority | Decision/input | Why it matters | State |
|---|---|---|---|
| Q101 | Monthly donor pays less than suggested amount | Period ledger, receipt and reminder rules | **Answered 15 Oct:** record actual verified amount, receipt for that amount, no remaining-balance reminder. The month counts as contributed once verified. |
| Q102 | If the donor's suggested monthly amount changes during a month, should the new amount appear for that month or start with next month's request? | Request schedule and amount history; verified receipts must never be rewritten | **Answered 15 Oct:** apply to the current month. Preserve sent-message and verified-payment history. |
| Q103 | Does the QR land in one fixed masjid bank/UPI account or can President/laptop select an account each time QR changes? | Treasurer bank reconciliation and account mapping | **Answered 15 Oct:** interpreted user's “yes” as allowing President/laptop to select a different masjid account on QR replacement. Actual account/QR asset still needed. |
| Q104 | Exact map latitude/longitude for 100 m attendance center | The Plus Code and Maps link identify the area but are not an approved precise geofence center | User said they would supply later; keep configurable/unset until confirmed |
| Q105a | May System Admin view detailed finance records for support without approving or paying? | Separates support visibility from business finance authority | **Answered 15 Oct: yes.** Read-only finance support access; President/Treasurer retain expense decisions/payment. |
| Q105b | Should each person using the masjid laptop sign in with their own account, or may the laptop use one shared login? | Attribution of expense entries, QR changes, meetings and restore requests | **Answered 15 Oct:** one dedicated laptop login held by the data entry employee. Assign one person at a time; replacement receives a new account for audit continuity. |
| Q105c | May the data entry employee enroll monthly donors, after recording their consent, or should only board/committee members do so? | Whether a laptop operator can handle donor phone and consent records | **Answered 15 Oct: yes.** Enrollment and consent entry only; Treasurer retains payment verification. |
| Q106 | If meeting organizer cannot finalize attendance, who may do so? | Absence notices cannot remain unresolved forever; adding another role is a product permission | **Answered 15 Oct:** the named data entry employee. Only after the meeting's full scheduled-day check-in window ends; audit fallback finalizer. |
| Q107a | Have earlier versions of the app issued donor receipts? | Whether live sequential receipts require donor-facing migration/lookup | **Answered 15 Oct: no.** This is the first version. Inventory development data but do not build a public legacy-code path. |
| Q107b | Which masjid account does the initial real QR pay into? | Treasury reconciliation and first WhatsApp QR template | **Deferred by user 15 Oct:** QR image and matching account details will be supplied later. Keep production requests disabled until paired and verified. |
| SETUP-1 | Masjid address, board roster, public logo/photos and first hosting-provided website URL | Display, support, credential provisioning and public publishing | User owns no domain yet and chose a hosting-provided URL initially, with Vercel as a candidate. Technical contacts confirmed; masjid WhatsApp Business is the donor/payment contact once onboarded. Actual URL and other assets remain to be supplied. |
| SETUP-2 | Actual masjid payment QR image and beneficiary account reference | Required for donor template and reconciliation; do not invent financial details | User will provide later; no asset has been supplied. |
| SETUP-3 | Google account/folder ownership and OAuth authorization for allocated 4 TB | Cannot implement automated backup upload/restore without a scoped connection; verify space and recovery access | Not configured |
| SETUP-4 | Masjid-owned WhatsApp Business number/account, donor opt-in workflow, template review and billing | Provider and consent obligations; current technical-support phone must not be assumed to be business API number | Donor/payment contact selected, but business number and provider account are not configured. |
| POLICY-1 | Written privacy notice, retention schedule beyond backup retention, complaints/contact channel, and publication policy for salary and donor data | Production data handling; local professional review of Indian rules | Draft below; organizational/legal review pending |

## D. Draft donor consent and privacy copy for masjid review

**Monthly contributor enrollment (shown to the referring member):**

> I have asked this person and they agreed to be added as a monthly contributor to Masjid E Mamoor 2. They provided this WhatsApp number and agreed to receive monthly contribution requests, payment follow-ups, receipt details and relevant service messages from the masjid through its WhatsApp Business number. I explained that replying STOP ends these WhatsApp messages. I will record when and how they agreed.

Required audit fields: donor name/number, consent category, captured date/time, method (in person/call/message), referring member, exact copy/version presented, and an opt-out timestamp/source. A member's checkbox is an assertion about donor consent, not independent evidence that the WhatsApp recipient opted in. Do not initiate WhatsApp messages until the recipient's opt-in evidence has been obtained and recorded through an owner-approved workflow; never infer it from a referral alone. Donor enrollment itself also remains disabled until the notice and consent version are approved. A wrong-number complaint or STOP must suppress scheduled and retried sends. Do not request bank passwords or sensitive financial credentials in chat.

**First request template draft (subject to Meta classification and approval):**

> Assalamu alaikum, {{name}}. This is Masjid E Mamoor 2. Your monthly contribution for {{month}} is ₹{{amount}}. You may use the attached current masjid QR code. If you have already paid, please ignore this request. After paying, reply with the transaction ID so our Treasurer can verify it. For donation or payment questions, reply to this WhatsApp chat. Reply STOP to stop WhatsApp messages.

**Verified receipt message draft:**

> Thank you for your contribution to Masjid E Mamoor 2. Your verified receipt number is {{receipt_number}}. Download the receipt at {{current_website_url}} by entering that number. For donation or payment questions, reply to this WhatsApp chat.

**Privacy notice outline, not publication-ready:** Explain the masjid as operator and contact, purposes (contributions/receipts, finance, member work and attendance), data types, access by role, WhatsApp and hosting providers, public receipt-number exposure, India/other processing locations if any, correction/opt-out request channel, and actual retention periods. Minimize payroll and donor fields in general member views. The masjid must approve exact notice and retention schedule after applicable-law review. [WhatsApp policy](https://whatsappbusiness.com/policy/) requires opt-in, honoring opt-out, appropriate notices and a published privacy policy. [MeitY DPDP Rules](https://www.meity.gov.in/static/uploads/2025/11/53450e6e5dc0bfa85ebd78686cadad39.pdf) and [Act commencement notification](https://www.meity.gov.in/static/uploads/2025/11/c56ceae6c383460ca69577428d36828b.pdf) have phased commencement; do not describe every provision as already operative.

## E. Proposed retention inventory for review

| Data | Proposed treatment | Decision still needed |
|---|---|---|
| Finance ledger, approvals, receipts, salary and correction trail | Preserve with restricted access and documented retention; no silent edit/delete | Actual statutory/accounting retention duration and authorized deletion/export process |
| Donor profile/WhatsApp consent and opt-out | Keep enough consent/opt-out evidence to prevent repeat contact; restrict contact details | Retention after donor leaves and access/correction workflow |
| Meeting location sample | Validate on server for current action, store minimal attendance/audit result rather than full movement history | Exact forensic fields and retention duration |
| Uploaded bills, memos and media | Private bill/memo; only explicitly approved event images public; align file retention with related record | Event gallery expiry and old memo cleanup policy |
| Delivery/webhook logs | Keep message ID/status/error and consent evidence, minimize full chat text | Operational retention window and support access |
| Backups | User-selected daily 30 days and monthly one year, encrypted DB plus files | Account/folder ownership, deletion proof and separate emergency copy |

Task 5 cannot be marked DONE until its genuinely open policy/input questions are answered and acceptance criteria are reviewed. Q101–Q103 are settled; the actual QR/account asset, location and role/privacy questions remain. No monthly contribution is an obligation or a remaining-balance collection request.
