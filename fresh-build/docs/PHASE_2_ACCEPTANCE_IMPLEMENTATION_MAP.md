# Phase 2 — requirement to implementation map

**Draft:** 15 October 2026. Each acceptance ID from `../../docs/PRODUCT_ACCEPTANCE_CRITERIA_2026-10-15.md` appears exactly once. Endpoints are conceptual `/v1` contracts, not live routes. The evidence column names the required test *kind*; the exact test path and pass result are later Phase 3–13 work. Android and web flows are both required unless the row is inherently public web or server operations.

| ID | Endpoint/worker and data owner | Negative/invariant test | Journey / evidence owner |
|---|---|---|---|
| A-ID1 | `/users`, `/session`, `/change-password`, `/deactivate`; identity/credential gate | Expired one-use credential, inactive old JWT, non-SA provision | Web/Android login; identity backend |
| A-ID2 | `/me`, per-resource authorization; role/actor | 8-role direct command and object IDOR matrix | Web/Android each role; security/backend |
| A-ID3 | `/profiles/{id}`; profile/role history | Cross-member edit and role spoof | Web/Android own edit; identity backend |
| A-FIN0 | `/finance/*` read projection, `/reports/{id}` existing read; ledger/report | SA direct pay/approve/report-run denied, C report denied | SA support web; finance backend |
| A-FIN1 | `/accounts/openings`, `/verify`, `/reconciliations`; accounts/ledger | Pending zero balance, duplicate opening, variance | T/P finance web+Android; ledger backend |
| A-FIN2 | `/expenses`, `/evidence-review`, `/decide`, `/payments`; expense revision/ledger | Self approval, preapproval payment, concurrent cap | Requester/P/T/L web+Android; expense backend |
| A-FIN3 | `/corrections`; correction effect/receipt/report | Physical delete blocked, duplicate reversal, issued PDF revision | T finance web+Android; ledger/backend |
| A-FIN4 | `/transfers`, `/advances`, `/salaries`; ledger/advance/payroll | Transfer income zero, double disbursement, proof leak | T/P/VP/member projections; finance backend |
| A-DON1 | `/donations`, `/cash-counts`, `/verify`; donation/ledger | Pending not income, duplicate task source, referrer distinct | Member/T web+Android; donor backend |
| A-DON2 | `/donors`, `/suggestions`, `/qr/activate`, request job; consent/request | Consent absent, duplicate period, old QR, paid reminder | P/L/referrer/T web+Android; donor/worker |
| A-DON3 | `/monthly-claims`, `/verify`, Meta inbox/outbox; contribution/receipt/referral | Forged reference, wrong account, replay, actual paise | T web+Android; donor/ledger/worker |
| A-DON4 | `/public/contact`, donor bot status; content/config/inbox | Unconfigured Business number, `PAID` false success | Public web/WhatsApp; content/worker |
| A-REC1 | `/public/receipts/{code}`; private receipt/storage | Enumeration, invalid/void generic, donor phone leak | Anonymous web; receipt/security |
| A-REP1 | `/reports`, `/reports/{id}/file`; ledger/report run | ₹1 drift, transfer inflation, C/M direct download | Leadership web/Android; report backend |
| A-TASK1 | `/tasks`, `/join`; task/slot/waitlist | Concurrent last slot, duplicate FIFO promotion | P/VP/S and member web+Android; work backend |
| A-TASK2 | `/tasks/{id}/complete`, `/decide`; completion/score | Self score, cancelled acceptance, repeat close | Creator/participant web+Android; work backend |
| A-MEET1 | `/meetings`, `/rsvp`, `/memo`, reminder worker; invite/storage | Required decline reason, declined reminder, private memo URL | Organizer/invitee web+Android; meeting/worker |
| A-MEET2 | `/check-in`, `/manual-presence`, `/finalize`; evidence/roster | Wrong date/stale GPS, remote mark, early finalization | Physical Android/web trial; meeting backend |
| A-HAF1 | `/prayer-marks`, `/revise`; prayer revision/audit | Duplicate slot, wrong actor, silent correction | P/VP/S/T web+Android; attendance backend |
| A-PERF1 | `/performance/{actorId}`; verified score sources | Pending task/payment score, void recompute, private donor leak | All active role profiles; performance backend |
| A-SITE1 | `/public/content`, `/content`, `/release`; revision/media | Draft/expired/private publish leak, unsafe file | Anonymous web/editor web+Android; content backend |
| A-MSG1 | `/webhooks/meta`, outbox worker/failure queue; inbox/delivery | Forged/duplicate event, STOP race, exhausted retry | T dashboard/real provider; worker/backend |
| A-OFF1 | Android local draft + `/v1` mutation; operation | Kill/replay/conflict, offline verification denied | Android offline/reconnect; mobile/backend |
| A-BAK1 | Backup job, `/restore-requests`; manifest/object/run | Corrupt/missing object, wrong actor, partial cutover | Staging restore drill; operations backend |
| A-REL1 | `/release-policy`, `/public/release`; manifest/min version | Old direct command, broken URL, signing mismatch | Old→new signed APK/device; release backend |

**Owner gates:** Phase 1 decisions still hold donor-edit, L expense approval, referral performance and real salary/public receipt exposure. This mapping does not grant those permissions. **Execution evidence:** As each slice is built, add exact migration/function/test file paths and observed pass/fail result, rather than changing a planned test into a claimed pass.
