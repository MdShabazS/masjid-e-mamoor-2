# Phase 1 owner decision packet

**Prepared:** 16 October 2026 (India time). **Decision updated:** 17 October 2026. The project owner accepted all five recommended product rules in this chat. No masjid privacy or publication approval has been recorded. This packet is limited to Phase 1 policy. QR/account, site coordinate, signing key, Business number and hosting account are later setup inputs, not reasons to invent a Phase 1 answer.

**23 October committee update:** The owner supplied a Board of Trustees roster and clarified that trustees are committee members. The roster identifies Janab Abdulkhuddus Sab as President, Janab Samiullah A as Treasurer and Janab Syed Shahabuddin as Secretary; see `COMMITTEE_ROSTER_2026-10-23.md`. This supplies names for the proposed approval workflow but no delegation, signed policy decision, or working privacy contact channel.

**24 October approval-path update:** The owner identified the full Board of Trustees acting together as the masjid's privacy/publication approval body. No Board decision on the four items below has been supplied.

## Recommended rules to accept or change

| Decision | Recommended rule | Why and acceptance check |
|---|---|---|
| Several verified payments by one donor in a month | Issue a separate actual-amount receipt for every genuine verified payment, but award **one referral point at most per donor per month** to the recorded actual referrer. Voids/corrections recompute eligibility. | Payment splitting must not multiply performance credit. Two genuine payments still add to the ledger and each gets a receipt; one point remains. A void of the only valid payment removes the point. This deliberately narrows the earlier provisional “one point per payment” draft. |
| Combined performance display | Display the period's verified task points + attended-meeting points + eligible referral points, with each component and denominator visible; no ranking or leaderboard. Label it “Activity points”, not a measure of religious merit. | A member can explain the number; a reversed source changes the number. Meeting declines and absences remain separate counts. |
| Laptop employee expense | Named L submits bill/details; Treasurer reviews evidence; President decides approval (never own request); Treasurer pays only after approval. Review and decision are separate audit events. | Review cannot post or pay. Reject/revision restarts the approval path. |
| Monthly donor enrollment | P/VP/S/T/C/M and named L may enroll only with documented donor consent and a real referrer; L's `entered_by` never becomes `referred_by` automatically. System Admin cannot enroll. | Migration 16 and the web server route now include M; enrollment still requires a separately approved consent version and remains disabled. |
| Existing donor edits | Limit suggested amount, active status and consent/opt-out changes to President and Treasurer initially. A member or L may request a correction, but cannot directly alter existing consent or recipient status. Preserve old/new value, actor, reason and time. STOP or wrong-number reports suppress outbound immediately, independently of profile-edit permissions. | Prevents broad edits of another person's consent/phone. Must be implemented at both API and DB before enabling edits; do not interpret this recommendation as current enforcement. |

**Decision record:** On 17 October 2026 (India time), the project owner replied “Accept the five proposed rules” to the five-rule question. These are now the accepted product rules. The chat does not identify the person’s name or establish authority to approve the masjid’s privacy/publication policy. Current SQL and client permissions still need alignment before activation.

## Publication and privacy approval needed

The full Board should review the exact [consent and privacy draft](../../docs/TASK_5_DECISION_REGISTER_2026-10-15.md), then record its decision, date, approved text/version and masjid contact. A referred member's checkbox is their assertion; the donor's WhatsApp opt-in method and evidence must be supportable. No outbound messaging is active without the masjid Business account and provider approval.

| Item for owner review | Safe proposed release scope | Approval record needed |
|---|---|---|
| Donor consent and notice | Separate monthly contribution enrollment from WhatsApp message opt-in; store wording/version/method/time/evidence; make STOP and wrong-number reports suppress sends. Publish a notice with masjid identity, purposes, providers, correction/withdrawal and complaint path. | Exact approved wording, method of obtaining donor opt-in, notice URL/version, named privacy/contact owner. |
| Public receipt lookup | Opaque random exact code, throttle, no search/list. Show masjid name, receipt status, date, actual amount and masked donor identity; avoid phone, bank reference, account, referrer and private proof. Void/superseded status must be clear. A PDF download needs a separate reviewed disclosure rule. | Approve exact page/PDF fields and whether possession of the code authorizes download. |
| Salary visibility | Current user choice allows every logged-in member to see employee name/role, month, amount, paid state/date/method; no bank/contact/proof. Keep the projection disabled until employee notice and masjid approval. | Named approval for amount visibility and exact audience/fields. |
| Retention and deletion | Financial/audit history and required correction links are preserved without a destructive purge until a reviewed schedule exists. Backups have the separate already chosen 30-daily/12-monthly schedule. Minimize stored location samples and chat bodies. | Duration, access, correction/export/deletion process for donor profile/consent, member/payroll, finance/receipts, bill/memo/media, messages/webhooks and location evidence, including applicable statutory holds. |

## Phase 1 acceptance record

- [x] Baseline and later decisions reconciled; eight-role draft, 25 individual acceptance cases and primary-source research recorded.
- [x] Ambiguous rules reduced to five concrete owner choices and four publication/privacy approvals above.
- [x] Project owner accepts the five rules on 17 October 2026 in this chat; personal name was not supplied.
- [x] Owner identified the full Board of Trustees acting together as the privacy/publication approval body on 24 October 2026.
- [ ] Full Board approves the four rows and designates a working complaint/contact channel.
- [x] Update the Phase 1 role matrix and acceptance trace to the accepted version; implementation remains a separate gate.

**Remaining approval:** The full Board should minute its privacy/publication decision, with Treasurer review of financial and salary disclosures and a named Secretary/contact for privacy questions. The [draft Board record](BOARD_POLICY_DECISION_RECORD_2026-10-24.md) makes the four decisions reviewable. No policy approval is recorded. See [approval-path note](PHASE_1_PRIVACY_APPROVER_RECOMMENDATION_2026-10-17.md). Provider rates, QR, location and hosting capacity are later integration/launch checks.
