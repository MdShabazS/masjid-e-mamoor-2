# Phase 1 recheck — 15 October 2026

**17 October addendum:** The project owner accepted all five product rules in this chat. The rule matrix and acceptance trace now reflect that decision. Masjid privacy/publication delegation, wording, receipt PDF scope, salary disclosure and retention remain open; see `PHASE_1_PRIVACY_APPROVER_RECOMMENDATION_2026-10-17.md`.

**16 October addendum:** [Owner decision packet](PHASE_1_OWNER_DECISION_PACKET.md) now gives five specific recommended rules and four privacy/publication approval rows. The product-rule draft and individual acceptance trace were aligned with the recommended referral cap, score wording, narrower existing-donor edits and restricted public receipt projection; none is recorded as an owner answer. WhatsApp recipient opt-in was distinguished from a referring member's assertion, including in the enrollment form. An earlier enrollment RPC is revoked in migration 2, the approved-version table starts empty, and the server endpoint requires an approved version; these source checks still need real DB execution. Phase 1 remains **engineering-prepared, owner acceptance pending**; the later QR/account, coordinate, Business number and hosting-plan inputs are tracked for integration and launch rather than treated as Phase 1 sign-off.

**Verdict: partially complete.** The earlier response called the engineering specification complete, but the original Phase 1 task included owner review and an unambiguous acceptance trace. The trace has now been expanded to 25 individual rows. Owner decisions and privacy/publication approval are still outstanding. This document corrects the status; it does not manufacture approval.

| Original task | Evidence rechecked | Result |
|---|---|---|
| Consolidate 100-question baseline and later explicit choices | `../../docs/REQUIREMENTS_BASELINE_2026-10-15.md`, `../../docs/TASK_5_DECISION_REGISTER_2026-10-15.md`; product-rule document follows later choices. | Done as source reconciliation; older contradictory prose remains historical reference. |
| Settle smaller monthly amount, immediate suggestion, QR beneficiary, SA finance read, named L | Written in decision register and target rules. | Done as product decisions; fresh SQL/app enforcement is later work. |
| Eight-role and unauthenticated authorization | Product-rule matrix includes SA/P/VP/S/T/C/M/L and denies anonymous/inactive/unprovisioned callers. | Draft complete, not database-verified. M enrollment grant differs from current SQL. |
| Treasurer Edit/Remove, claim edge cases and other workflows | Explicit proposed states, reversal/replacement and late/extra payment rules in product-rule document. | Draft complete, but referral credit cap and L expense review sequence are owner choices before affected behavior is implemented. |
| Research and current prices/limits | Primary-source log covers documented models, grants, APK signing, Meta policy and phased Indian law. | Primary research complete; exact approved Meta template category/India rate and chosen hosting-plan capacity/cost are not known. |
| Individual acceptance mapping | `PHASE_1_ACCEPTANCE_TRACE.md` has one row each for all 25 `A-*` IDs, with actor, transition, evidence and input. | Mapping complete as specification, zero passing integration/device/DB tests claimed. |
| Donor consent, privacy, salary and public receipt review | Concrete publication packet in product rules; no approval record from the masjid owner, privacy contact or reviewed retention schedule. | **Open.** Real public/donor/payroll exposure remains gated. |

## Discrepancies found in this recheck

1. Previous Phase 1 checkbox said “complete” while the owner review item had been reworded to only “prepare packet.” The master and short trackers now state partial completion.
2. Previous acceptance mapping grouped many IDs in one row. The new individual trace covers all 25; it still specifies tests rather than claiming they passed.
3. Existing fresh Android/web forms sign in with email, while the product requirement says username plus temporary password/first-login change. Phase 2 must design this bridge and Phase 3 implement it; current screens are not a working account lifecycle.
4. Target M donor enrollment is absent from the draft SQL. The target contract and implementation delta name this gap; no migration was applied.
5. Provider-rate research did not establish an actual approved fundraising template category or price. Meta classifies the submitted template, and the masjid account and destination market determine the operational budget. Do not fill a fictional amount.
6. “Keep audit history for the lifetime of operational records” is an engineering preservation default, **not** an approved complete personal-data retention schedule. A written owner/local privacy review is outstanding.
7. The target matrix grants M donor enrollment and broad donor suggestion/consent changes to enrollment roles. The earlier draft matrix proposed M referral, but the latest baseline only says “authorized” users and explicitly grants L enrollment. The exact M and L donor-edit scope needs owner confirmation before those mutations are exposed.

## Remaining decisions to finish Phase 1 policy closure

| Decision | Concrete option in engineering draft | Needed before |
|---|---|---|
| Referral points for several verified payments by one donor in a month | One point per distinct verified claim; each has its own actual-amount receipt. Alternative: cap one point per donor/month while still receipting all genuine payments. | Performance implementation and release. |
| L expense routing | T reviews L's bill/details, P approves, T pays after approval. | L expense implementation. |
| Donor management grants | M can enroll with actual referrer and consent; P/VP/S/T/C/M/L can change suggestion/active/consent with audit. Safer alternative is narrower edits to donor manager/T/P while still permitting L enrollment. | Role SQL and donor-edit UI. |
| Combined performance text | Sum verified task + meeting attendance + verified referral points with denominators, no leaderboard. | Member-facing score release. |
| Donor privacy/publication | Review exact consent wording and collection method, notice/contact, exact-code receipt fields, salary projection and retention/deletion periods. | Real donor, public receipt and payroll data exposure. |

**Can proceed now:** Phase 2 module boundaries, generic actor/role contract, transactional ledger design, tests and schema for undisputed rules. **Cannot claim complete:** final policy sign-off, actual provider account/rates, live data processing readiness or product release. Later setup inputs (QR/account, geofence point, Business number, Drive folder and hosting URL) stay in their respective phases.
