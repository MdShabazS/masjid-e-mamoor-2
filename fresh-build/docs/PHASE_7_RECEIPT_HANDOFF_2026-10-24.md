# Receipt generation and handoff rule

**Owner instruction:** 24 October 2026 (India time). The owner will supply the masjid's receipt format later. Once the Treasurer verifies a payment, the receipt should be generated automatically; the Treasurer or a committee member may send that receipt to the donor.

## Intended flow

1. A payment claim or counted cash remains pending and cannot produce a valid receipt.
2. The Treasurer checks the masjid's actual bank/UPI or cash record, chooses the receiving account, and verifies the **amount actually received**.
3. Verification posts one ledger effect and issues one immutable receipt identity/code in the same transaction. The current monthly `verify_monthly_claim` command already does this; other donation paths also have receipt identities but need an end-to-end release audit.
4. A renderer uses the masjid-approved template and that issued receipt record to create the donor copy. It must show the verified amount, not the suggested or claimed amount. Template fields and public disclosure require Board review.
5. The Treasurer or a committee member with the granted send permission selects the issued receipt and sends it. Sending cannot change finance records or mint a second receipt. Record who sent it, when, to whom, by which channel and whether delivery succeeded. Retries must refer to the same receipt.
6. A void or correction changes validity and may require a linked replacement receipt; old copies remain traceable and must not be presented as current.

**24 October follow-up:** The owner deferred WhatsApp automation to a later release. For the first release, the Treasurer or authorized committee member may use an approved staff-led handoff after verification. If staff manually share a receipt on WhatsApp, they must use the approved masjid account/channel, have the recipient's opt-in and record the handoff; the app does not currently perform or audit such a send. App-initiated WhatsApp sends will need the masjid-owned Business Platform setup, approved templates, opt-in enforcement and provider tests later. No outbound receipt sending is active in the app today.

## 25 October audit groundwork

Migration `20261025125629_receipt_handoff_audit.sql` adds an immutable, staff-attested handoff record and a role-guarded `record_manual_receipt_handoff` database command. Its policy switch starts **off**. The command can record an existing current receipt's verified amount, acting staff member, recipient reference, manual channel (`in_person`, `email`, or `other_manual`), result, evidence reference and idempotent operation ID. It rejects an unverified, void or superseded receipt, rejects a Member, and never creates a finance effect or a new receipt. The eligible roles are President, Vice President, Secretary, Treasurer and Committee Member; the Board still needs to approve the final sender mapping. A `delivered` result is the staff member's attestation, not independent provider proof. There is no app screen or external send in this slice. WhatsApp is excluded from the command until its consent and channel rules are approved.

Verification: all 30 migrations applied to a disposable local database; all 14 rollback-only SQL fixtures and the local security advisor error gate passed. The new rollback-only handoff fixture and security catalog fixture also passed on the isolated Supabase development project. Readback after the hosted fixture: zero Auth users, handoff events, finance effects and Storage objects, with the handoff policy still off. The converted legacy report fixture also ran successfully on the disposable local stack after changing its `\gset` capture to a single JSON value. The full 14-fixture hosted sweep subsequently passed; see `HOSTED_SQL_FIXTURE_SWEEP_2026-10-25.md`.

Before switching the policy on, retain the full Board's recorded privacy and receipt-field decision, the approved rendered receipt template, the exact staff role/channel rule, recipient verification/consent procedure, and a test of the complete client handoff with corrected receipts. The current database command is groundwork only and does not make receipt delivery ready for public use.

## 26 October manual handoff web slice

Migration `20261026033610_receipt_handoff_capability.sql` exposes only the enabled/disabled policy state to an authenticated Treasurer or Committee Member. A database insert trigger narrows the older handoff command to those two roles, including direct RPC callers. The policy remains off, and neither the capability function nor the web page exposes the private decision reference or a receipt amount editor.

The web finance page links those two roles to a manual handoff form. It accepts an issued receipt code, recipient and evidence references, a permitted manual channel, and the actual outcome. It requires a staff attestation before recording. It does not generate a receipt or send email or WhatsApp. An operation ID is retained for an uncertain retry of the same form values; a successful record clears it. The database still checks current receipt validity and stores the verified amount independently of the client.

Verification: all 32 migrations applied on the disposable local stack; all 14 rollback-only SQL fixtures passed, including policy-off, Treasurer and Committee Member allow, Member and President deny, retry/conflict, invalid code, WhatsApp channel rejection and correction/void. The local security advisor returned no error-level issues. The isolated hosted development project received the migration; its receipt and security catalog fixtures passed and final counts were zero Auth users, app users, finance effects and handoff rows, with the gate off. Its security advisor reported the existing intentional RLS/no-policy and definer-RPC notices, with no new advisory category. The 153 Node tests, lint, format, typecheck, environment check, web production build, unconfigured HTTP route smoke and Android bundle export passed locally. A source archive passed checksum, file-digest and clean-restore verification; it is not a live-data backup.

This is an audit screen for a handoff already performed outside the app. It cannot replace the masjid-approved generated receipt, actual delivery proof, Board authorization or a staged signed-in browser/device journey. Leave the switch off until those are complete.

## Still needed

- Masjid receipt sample/template and exact approved fields.
- Board decision on donor-facing and public receipt content.
- Authorized committee sender role mapping and delivery channel.
- Render, actual send and delivery tests with issued and corrected receipts on web and Android; stage a signed-in manual audit journey after approval.
