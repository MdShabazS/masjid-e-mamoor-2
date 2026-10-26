# Research and Risk Review — 15 October 2026

## 1. Research findings and practical design choices

### WhatsApp Business automation

Meta requires opt-in before the business messages people. A business-initiated conversation requires an approved message template. The platform reports inbound messages and outbound delivery status through webhooks. Billing is per delivered message and varies by recipient market and template category. Meta's current FAQ says that, from 1 October 2026, service messages are charged from the 1,001st service message per business phone number each month. Some Meta pages still display older pricing text; do not rely on that stale copy. Donation reminders may be classified as marketing; do not assume utility pricing. Final category and India rate must be checked in Meta’s live rate card during integration.

**Fallback/improvement:** opt-in recorded in-app; STOP suppression; non-WhatsApp in-app notification and dashboard queue as fallback; retry transient failures only; manual resend; message IDs and webhook idempotency. Do not automatically message people who have no consent or opted out.

Sources: [WhatsApp Business Messaging Policy](https://whatsappbusiness.com/policy/), [WhatsApp Business Platform features](https://whatsappbusiness.com/products/business-platform-features/), [Meta's current FAQ and service-message threshold](https://whatsappbusiness.com/resources/faq/), [Meta pricing](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing), [Meta webhook overview](https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/overview). The developer documentation returned HTTP 429 during this review; revisit at integration.

### 100 m meeting geofence

Android guidance warns that Wi-Fi location accuracy can be roughly 50 m where indoor location is unavailable; background geofence delivery on Android 8+ may be delayed by minutes. Thus a 100 m boundary cannot be treated as exact proof of presence or guaranteed instant availability.

**Fallback/improvement:** foreground check-in while the member is at the masjid, clear permission/error UI, configurable radius after the user supplies coordinates, server validation of event time/distance, and organizer manual attendance only while physically at the masjid. Avoid continuous background tracking; collect location only for the explicit check-in and retain minimal evidence.

Sources: [Android geofencing](https://developer.android.com/develop/sensors-and-location/location/geofencing), [Android background location](https://developer.android.com/develop/sensors-and-location/location/background), [Android permission guidance](https://developer.android.com/develop/sensors-and-location/location/permissions).

### Financial control and exact-rupee reporting

Nonprofit internal-control guidance recommends separating custody, recording, approval, and reconciliation. It specifically warns against one individual controlling multiple phases of the same cash operation. The project’s Treasurer self-entry, Treasurer approval for President expenses, and direct edit/delete permission may weaken separation. These were user-selected; document and test them, and provide compensating independent review.

**Fallback/improvement:** preserve a before/after audit record for any edit/delete, require reason, notify President and independent reviewer, reconcile bank statements, show unreconciled changes in audit reports. Recommended safer future rule: no author approves own expense; an independent approver other than payer verifies disbursement. Avoid hard deletion of posted ledger records.

Sources: [National Council of Nonprofits internal controls](https://www.councilofnonprofits.org/running-nonprofit/administration-and-financial-management/internal-controls-nonprofits), [Oregon DOJ nonprofit financial controls](https://www.doj.state.or.us/charitable-activities/laws-guides-for-charities/financial-control-recommendations-small-nonprofits/), [ICAI technical guide PDF](https://kb.icai.org/pdfs/PDFFile663b091d7320c1.62095921.pdf).

### Backups and free-tier assumptions

Supabase documentation recommends that Free projects regularly export data with `supabase db dump` and maintain off-site backups; managed daily backups are available on Pro/Team/Enterprise with plan-specific retention, and point-in-time recovery is an add-on. Database backups exclude Storage object bytes. A daily schedule requested by the user therefore cannot be represented as satisfied on an unspecified/free plan.

**Fallback/improvement:** before production choose either a plan with suitable managed backups or implement independent encrypted database exports plus object-file export, separate storage credentials, retention, alerting, and restore drills. The masjid laptop restore action must be strongly authenticated and audited. No untested restore procedure is release-ready.

Sources: [Supabase database backups](https://supabase.com/docs/guides/platform/backups), [Supabase Storage access control](https://supabase.com/docs/guides/storage/security/access-control).

### Google Drive 4 TB project allocation

The user has allocated 4 TB from their Google Drive storage. Google Drive supports files up to 5 TB when the account has sufficient quota; the total quota is shared with other Google services, so project capacity must be monitored. Drive is useful as a secondary archive but should not replace a transactional database or private application storage. A backup copy in the same user's account is not a complete disaster-recovery plan if that account is locked or compromised.

**Fallback/improvement:** encrypt archives before upload, keep a separate operational backup, use a dedicated project folder with tightly controlled sharing, alert on missed uploads and quota pressure, and test restore from Drive. Keep the service running if Drive upload is delayed. Verify OAuth/API access and retention semantics before coding.

Sources: [Google Drive file size limits](https://support.google.com/drive/answer/37603?hl=en), [Google storage quota behavior](https://support.google.com/drive/answer/9312312?hl=en).

### Role authorization and member privacy

OWASP recommends least privilege, server-side/object-level access checks, and security event logging; obscuring IDs alone is not access control. This matters for salary details visible to all members, all-member performance visibility, public receipt lookup, and laptop account on any device.

**Fallback/improvement:** separate public site/media from authenticated workspace; keep payroll and donor contact visibility explicitly consented and reviewed; use rate limiting and generic errors on receipt lookup. Receipt-number-only access remains weaker than a one-time code; use high-entropy unguessable IDs, per-IP/per-number throttling, monitoring, and no search enumeration. Consider optional OTP in a later change.

Sources: [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html), [OWASP Developer Guide access controls](https://devguide.owasp.org/en/04-design/02-web-app-checklist/07-access-controls/).

### Requirements quality and research papers

Requirements research identifies ambiguity, incompleteness, inconsistency, and instability as recurring requirements-engineering problems; an empirical IEEE study explores the relationship between defective natural-language requirements and test failures. This project already has important edge cases where decisions can conflict with earlier specs (financial transaction immutability, roles, approval independence, QR history, offline records, receipt access).

**Practical response:** keep an explicit decision register; attach a testable acceptance criterion to every requirement; reconcile contradictions before coding; trace each requirement to schema/API/UI/test; run a review pass after any scope change. Research is evidence for disciplined review, not a claim that every ambiguous sentence necessarily causes a defect.

Sources: [IEEE, Empirical Study on Defective Requirements and Test Failures](https://ieeexplore.ieee.org/document/4090239/), [IEEE, Review of Empirical Literature on Requirements Ambiguity](https://doi.org/10.1109/EmpiRE.2015.7431303), [IEEE, Ambiguity and inconsistency detection](https://ieeexplore.ieee.org/document/8746963/).

## 2. Confirmed choices with elevated risk

| Choice | Risk | Minimum safeguard for release |
|---|---|---|
| Treasurer can edit/delete verified transactions | Concealed changes or audit gaps | Versioned audit record, reason, second-person alert, immutable export of before/after values; no silent physical deletion |
| President expense may be approved by Treasurer; Treasurer’s by President | Approver may also control payment/recording | Record requester, approver, payer separately; reconciliation by another board member |
| Treasurer can direct-enter cash as immediately counted | Same person may count and post funds | Require source/memo and scheduled independent reconciliation |
| Laptop account can log in from any device, restore without confirmation | Shared/high privilege compromise and accidental restore | Unique credentials, MFA reconsideration, session alerts, audit logging, explicit restore preview, backup encryption |
| All members see payroll and all performance | Privacy, conflict, and coercion concerns | Keep access configurable; show only necessary fields; notify members; document community policy |
| Public receipt lookup uses receipt number alone | Receipt disclosure if number leaks or is guessed | Non-sequential high-entropy ID, strict rate limits, generic responses, alerts; recommend OTP before public launch |
| Task cancellation does not notify participants | Members may arrive for cancelled work | Display cancellation immediately in the task UI; seek a new decision before adding any outbound cancellation notification |
| Monthly amount changes immediately | Could rewrite current obligation or create over/underpayment ambiguity | Store effective timestamp and original amount; define adjustment policy before coding |
| QR has no historical version archive | Old pending request may refer to prior QR | Preserve QR snapshot/reference with each queued/sent request even if admin UI stores only current QR |

## 3. Performance calculation recommendation

Keep three transparent sub-scores and one combined score, as requested. Do not rank users solely by raw counts because role assignment, task difficulty, meeting invitation count, donor affordability, and availability differ. Recommended first release: report counts and denominator/period (e.g., verified tasks completed / assigned; meetings attended / invited; verified referral contributions) and label the combined score as a configurable weighted indicator, not an objective character judgment. Exclude declined meetings from absence; display declines separately. Publish the formula and permit correction of source records.

## 4. Platform and cost notes

- WhatsApp Business Platform, payment gateway, hosting/database, SMS/email, and file storage are separate cost categories. Obtain live provider quotes before deployment.
- The user elected QR + manual verification now; gateway fees and integration are deferred to a future update.
- Current hosting-provider backup limits must be checked against the selected plan before claiming daily backup coverage.
- Android location permission UX and geofence fallback require physical-device testing across common Android OEM battery/location settings.

## 5. Second-pass implementation constraints

- **Drive archive:** Drive API requests have quotas and 403/429 retry behavior. The documented 750 GB daily upload limit is scoped to Google Workspace users; do not assume it applies unchanged to this user's personal account. The allocated 4 TB is capacity, not an API integration or a guaranteed backup SLA. Use a narrow OAuth scope and encrypted archives, monitor failed uploads, and validate the actual account. [Drive API limits](https://developers.google.com/workspace/drive/api/guides/limits), [Drive OAuth scopes](https://developers.google.com/workspace/drive/api/guides/api-specific-auth).
- **Database and files:** Free Supabase projects have capacity/activity constraints; database dumps do not contain Storage object bytes. An end-to-end restore must separately export the database and object files, then prove relationships, checksums, and access controls after recovery. [Supabase backups](https://supabase.com/docs/guides/platform/backups), [Free plan restrictions](https://supabase.com/docs/guides/platform/manage-your-usage/disk-size), [Pausing](https://supabase.com/docs/guides/platform/project-inactivity).
- **APK upgrade:** A sideloaded Android update needs the same signing certificate and a higher version code. Keep the signing key in secure backed-up custody and test upgrade from the previous released APK. A server-side minimum-version gate requires an accessible download/recovery route when an old app is blocked. [Android signing](https://developer.android.com/studio/publish/app-signing), [Android versioning](https://developer.android.com/studio/publish/versioning).
- **Uploaded evidence:** Bills, meeting memo images, public images, QR files, and receipts need distinct private/public buckets, type and size validation, image processing where applicable, malware screening, and authorization per object. A filename or URL alone is not sufficient evidence of safe handling. [OWASP file-upload guidance](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html).
- **Offline and concurrency:** Store local pending entries durably and give each financial command a stable idempotency key. The server should enforce uniqueness and atomic posting; a serializable-transaction failure requires retrying the entire transaction, not just its final statement. Test two verifiers, reconnect replay, and duplicate webhooks. [Expo SQLite](https://docs.expo.dev/versions/latest/sdk/sqlite/), [PostgreSQL transaction isolation](https://www.postgresql.org/docs/current/transaction-iso.html).
- **Location and accessibility:** Browser geolocation needs HTTPS and user permission; Android users can grant approximate location and mock locations exist. A 100 m check can fail for a legitimately present person and cannot provide fraud-proof presence. Provide a logged organizer fallback and test WCAG 2.2 keyboard, text, contrast, and error flows on the website. [W3C Geolocation](https://www.w3.org/TR/geolocation/), [Android location permissions](https://developer.android.com/develop/sensors-and-location/location/permissions), [WCAG 2.2](https://www.w3.org/TR/WCAG22/).
- **India privacy:** The Digital Personal Data Protection Act and 2025 Rules have phased commencement. Do not state that every provision is already operative; map the actual commencement dates and obtain jurisdiction-specific review before production donor/member data collection. Consent, purpose, retention, access and deletion workflows should be designed now. [MeitY DPDP Rules 2025](https://www.meity.gov.in/static/uploads/2025/11/53450e6e5dc0bfa85ebd78686cadad39.pdf), [MeitY DPDP Act commencement notification](https://www.meity.gov.in/static/uploads/2025/11/c56ceae6c383460ca69577428d36828b.pdf).

The [feature research matrix](FEATURE_RESEARCH_MATRIX_2026-10-15.md) tracks each module's failure mode, safeguard, and release evidence. The [research closure and source audit](RESEARCH_CLOSURE_AND_SOURCE_AUDIT_2026-10-15.md) records the completed desk review and separates external deployment validation.

