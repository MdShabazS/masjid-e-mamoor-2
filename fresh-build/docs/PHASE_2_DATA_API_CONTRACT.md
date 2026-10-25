# Phase 2 — data, API and event contract

**Prepared:** 15 October 2026. **Status:** design draft, no live endpoint. This target replaces the incomplete direct-RPC prototype only after migration and client tests. Owner-dependent commands remain disabled until `PHASE_1_AUDIT.md` is resolved. The route names are versioned conceptual endpoints; exact HTTP implementation belongs to Phase 3.

## Shared wire rules

| Field | Rule |
|---|---|
| IDs | Server-generated UUID for aggregate/source; client-generated UUID v4 `operationId` for retryable mutation, unique by actor/command/payload. Never accept caller-supplied actor, role, approval status, receipt code or ledger amount as trusted. |
| Money | Decimal paise **string** in JSON, e.g. `"30000"`; no float/number serialization on the wire. Server validates positive bounded `bigint`. UI INR text is parsed exactly to paise. DB `bigint`; sums checked for overflow. |
| Time | Server `createdAt`/`postedAt` ISO UTC, business period/date `YYYY-MM-01`/`YYYY-MM-DD` in Asia/Kolkata. Financial report `[startDate, endExclusiveDate)` and timezone are explicit. |
| Mutation | `operationId`, typed payload, optional `expectedRevision` for update/decision. Server binds canonical payload hash + command + actor to operation ID in same DB transaction. Identical retry yields saved result; mismatched retry `OPERATION_CONFLICT`. |
| Read | Explicit projection, cursor pagination and stable ordering `(createdAt,id)` or domain equivalent. No `SELECT *`, donor phone, private URL or internal Auth identifier in broad roster. |
| Response | `{ "data": <typed result>, "requestId": "...", "revision": n }` on success. Error `{ "error": { "code": "...", "message": "safe text", "requestId": "...", "retryable": false } }`; no SQL error/secret leakage. |
| Status codes | 400 invalid input, 401 unauthenticated, 403 inactive/denied, 404 invisible or absent object (same outward shape where enumeration risk), 409 stale revision/state/idempotency conflict, 422 business rule, 429 throttled, 503 transient provider. Do not claim success after uncertain network result; retry stable operation ID. |
| Credentials | Bearer token/API session or secure server cookie. Current active account and required row relationship checked at DB-backed boundary on every protected action. Server secret keys are not in clients. |

**Example mutation:** `POST /v1/monthly-claims/{id}/verify` with `{ "operationId":"uuid", "expectedRevision":2, "accountId":"uuid", "actualAmountPaise":"30000", "evidenceReference":"bank-reconciliation-id" }`. T checks actual funds in the account; result `{ "receiptCode":"MEM2-R-<opaque>", "postedAmountPaise":"30000", "periodDate":"2026-10-01" }`. `evidenceReference` is internal evidence, not an assertion of verified funds by itself. Repeat request returns the same result, never a second ledger effect.

## Identity and username bridge

The approved user flow asks for **username plus password**, whereas the prototype web/Android screens currently call Supabase email/password directly. Target design:

1. SA's private `createUser` route atomically reserves a case-folded unique username alias and provisions an internal Auth login identifier; return temporary credential once to SA over a protected channel. Do not expose an email lookup endpoint or log plaintext credentials. Reconcile partial Auth/DB creation with a failed/provisioning state and safe retry.
2. `POST /v1/session` accepts username/password under TLS, per-account/IP throttling and uniform failure response. Server resolves alias privately and authenticates against Auth; it never performs password comparison in application SQL. A successful identity may receive a limited `mustChangePassword` session that cannot read protected domain data.
3. `POST /v1/session/change-password` proves the current session/temporary state, updates Auth password, then clears the DB gate only after Auth confirms success. The cross-service partial-failure path stays gated and retryable. Reset issues a new one-use temporary state and invalidates prior protection on the next command.
4. Browser keeps an appropriate secure session cookie; Android stores session material via secure native storage. Direct frontend email sign-in is removed before real account testing. Active DB status/role, not stale JWT app metadata, controls every command. Session revocation/short expiry and sensitive-operation checks are tested on deactivation.

No second factor is assumed for v1. No general self-registration. Internal Auth identifier mapping is an implementation choice to validate against actual Supabase Auth behavior in Phase 3; if that path proves unsuitable, use a reviewed username authentication broker without changing the user-facing identifier.

## Domain aggregate skeleton and constraints

| Aggregate/table family (conceptual) | Required keys, versions and constraints | Private vs scoped projection |
|---|---|---|
| `actor`, `username_alias`, `profile`, `role_event`, `credential_gate` | Unique normalized username; actor references Auth ID; active one role; actor IDs survive deactivation; credential version/state; role audit. | Username mapping private; profile/role projection by current actor permission. |
| `account`, `opening`, `ledger_effect`, `transfer`, `reconciliation`, `correction` | Account active/kind; one approved opening per account; unique source effect; paired transfer ID and zero net; immutable effect/correction/audit; `bigint` amount. | Financial detail P/VP/S/T and SA support; no C/M/L broad finance. |
| `monthly_donor`, `consent_event`, `suggestion_event`, `qr_version`, `monthly_request` | Donor identity/WhatsApp private; server-selected approved consent version + STOP state; recipient WhatsApp opt-in evidence separate from referring member's assertion; suggestion effective time; QR digest/account; unique donor+period+request purpose; sent snapshot not rewritten. | Roster name/suggestion/referrer only; phone/consent limited. |
| `claim`, `contribution`, `receipt`, `referral_event` | Claim unique verified provider/account/reference key; rejection/revision links; positive verified amount; contribution→one ledger source and receipt; random code unique; referral source unique. | T pending evidence; public exact-code minimal status/amount/date/masked identity only after owner approval. PDF remains private pending separate disclosure approval. |
| `expense`, `expense_revision`, `decision`, `payment`, `advance`, `salary` | Decision tied to submitted revision and different actor; payment total ≤ approved paise; one expense account unless reviewed change; bill metadata private. | P/VP/S/T/SA detail, narrow all-active salary fields after sign-off. |
| `task`, `slot`, `waitlist`, `completion`, `score_event` | One active slot per actor/task; locked overall and mode caps; FIFO `(joinedAt,id)`; verified completion generates unique score source. | Participant/creator scope and all-active performance projection. |
| `meeting`, `invite`, `attendance_evidence`, `roster`, `prayer_mark` | Unique invite; fresh location and local-day check; one final roster; one current Hafiz/day/prayer with revision history. | Invitee/creator scope, restricted raw coordinates and audit. |
| `content_revision`, `release_manifest`, `report_run`, `file_object` | Schedule/audience/version; signed APK version/hash/URL; report cutoff/hash/revision; object visibility and content digest. | Public approved content/release, private reports/files with per-object checks. |
| `operation`, `audit`, `outbox`, `inbox`, `delivery`, `backup_run`, `restore_run` | Unique operation+payload hash, unique provider event and send purpose; bounded attempts; immutable audit; backup manifest hash and restore actor/outcome. | Workers/server only; operator failure dashboards are redacted. |

Physical schema names and indexes are frozen in Phase 3 after role matrix sign-off. The draft `001_monthly_contributions.sql` lacks several of these families and must not be applied as a complete product schema.

## Command/query registry

Each command has actor and object guards in `PHASE_1_PRODUCT_RULES.md`; this list sets the expected state effect and test focus. `*` marks a policy-gated command. All commands produce an audit event. `Q` means query only.

| Route family / command | Input and result | Transition and invariant | Primary test |
|---|---|---|---|
| `POST /v1/users`, `/reset`, `/deactivate`; `GET /v1/me` | SA username/role/credential; actor ID/state | Provisioning/temporary→active; deactivation keeps attribution | Wrong role, reset replay, old token |
| `PATCH /v1/profiles/{id}` | Allowed contact fields + revision | Self or audited L contact edit; SA administrative fields separate | Forged role/other row |
| `POST /v1/accounts/openings`, `/verify`; `GET /v1/accounts` | Account/paise/evidence; approved opening | T→P verification, no pending balance | Duplicate, self-approval, reconciliation |
| `POST /v1/transfers`, `/reconciliations`, `/corrections` | Two account IDs/paise/proof or correction source/reason | Balanced pair; correction reversal+replacement | Same op replay, sum zero, old receipt |
| `POST /v1/donors`*, `/suggestions`*, `/opt-out`; `GET /v1/donors` | Consent/version/referrer; narrow roster | Active donor and current suggestion, immutable send history | Entry actor ≠ referrer, unauthorized phone |
| `POST /v1/qr/activate` | Asset digest and active beneficiary | P/L atomic replacement, future snapshot | Wrong account and queued-send race |
| `POST /v1/monthly-requests/dispatch` (job only) | Period/purpose idempotency | One request donor/period; current consent/QR/account | Repeat scheduler and STOP race |
| `POST /v1/monthly-claims`, `/reject`, `/verify`; T queue Q | Donor/period/reference or actual account/paise; receipt | Pending→rejected/verified; verified posts once | Fake/duplicate ref, wrong account, replay |
| `POST /v1/donations`, `/cash-counts`, `/verify` | Donor/actual method/date or task total | Pending→T verified/rejected; direct T cash once | Two counters, task double count |
| `POST /v1/expenses`*, `/evidence-review`*, `/decide`, `/payments` | Submitted version/bill, decision reason, payment paise | Separate P/T approver; T outflow only after approval | Self decision, revision, concurrent overpay |
| `POST /v1/advances`, `/settlements`, `/salaries` | Recipient/amount/proof/payment | Advance outstanding then settles; actual salary outflow | Duplicate disbursement, private salary proof |
| `GET /v1/reports`, `POST /v1/reports`, `GET /v1/reports/{id}/file` | Period/cutoff/proof option; run status/PDF | Leadership generation, SA existing read; versioned snapshot | C/M/anon download, ₹1 drift |
| `GET /v1/public/receipts/{code}`* | Exact code; owner-approved minimal response | Throttled valid active receipt only; PDF requires separate disclosure approval | Enumeration, void and phone leak |
| `POST /v1/tasks`, `/join`, `/complete`, `/decide` | Mode/caps/slot/optional note | FIFO cap and creator verification | Concurrent last slot and self-score |
| `POST /v1/meetings`, `/rsvp`, `/check-in`, `/manual-presence`, `/finalize` | Invite/nullable reason/fresh location | Scheduled-day presence; post-day finalization | Remote organizer, decline reminder |
| `POST /v1/prayer-marks`, `/revise` | Local date/prayer/status | One current mark with before/after audit | Wrong actor/time, duplicate slot |
| `POST /v1/content`, `/publish`, `/release-policy`; public Q | Audience/schedule/revision or APK manifest | Public only after schedule and signed APK upload | Private leak, old client bypass |
| `POST /v1/webhooks/meta` (provider only), outbox worker | Signed event ID/body; delivery state | Deduped STOP/reference/status; no automatic posting | Forgery, retry, post-STOP send |
| `POST /v1/restore-requests`* | Backup manifest ID; job status | L request→server preflight/staging/cutover | Wrong actor, corrupt archive |

`*` is **not enabled** merely by writing this contract. Donor management grants, laptop expense sequence, public receipt/salary publication and restore retention need the Phase 1 owner/operational gate. A policy-gated feature may have a private schema and test fixtures without real-data exposure.

## Storage and asynchronous event contract

1. Upload begins in private staging under an opaque object ID. Server validates bytes, MIME, extension, size and ownership; promotion registers digest/visibility/source in DB. A rejected upload never marks a bill verified or content published. Orphan cleanup is idempotent.
2. A financial transaction inserts an outbox row with unique `(purpose,sourceId,recipientId,period)` alongside posting. Worker claims a lease, rechecks consent and current state, sends after commit, and records provider message ID/status. Retry increments attempt, honors backoff and retains failure; webhook events use provider unique ID. STOP suppresses pending/retry messages before dispatch.
3. Report generation records source cutoff and revision, builds from canonical ledger selection, stores private bytes and hash, then marks ready. Failure remains visible and retryable without changing included source set silently.
4. Backup manifest records DB dump and each object path/digest/bytes plus environment/schema version. Staging restore validates counts/hashes and referential links before controlled cutover. A source-code `.tar.gz` is not this operational backup.

## Error catalog for first vertical slices

`AUTH_REQUIRED`, `PASSWORD_CHANGE_REQUIRED`, `ACCOUNT_INACTIVE`, `FORBIDDEN`, `NOT_FOUND`, `VALIDATION_FAILED`, `CONSENT_REQUIRED`, `DONOR_INACTIVE`, `REQUEST_MISSING`, `CLAIM_PENDING`, `CLAIM_REJECTED`, `REFERENCE_CONFLICT`, `ACCOUNT_MISMATCH`, `STALE_REVISION`, `APPROVAL_REQUIRED`, `SELF_APPROVAL_DENIED`, `PAYMENT_EXCEEDS_APPROVED`, `OPERATION_CONFLICT`, `RATE_LIMITED`, `SERVICE_UNAVAILABLE`, `CLIENT_UPDATE_REQUIRED`.

The UI maps these stable codes to safe actions and preserves operation IDs across retries. Database detail belongs in server logs with request ID and sanitized audit; never in public error body.
