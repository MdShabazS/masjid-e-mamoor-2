# Masjid E Mamoor 2 — Consolidated Requirements Baseline

**Date:** 15 October 2026  
**Status:** Draft requirements baseline from the completed 100-question round; follow-up decisions and architecture reconciliation remain open.  
**Platforms:** Android APK and responsive web application.  
**Organization:** Masjid E Mamoor 2, Bellahalli, Karnataka, India.  
**Currency / timezone:** INR / Asia-Kolkata.
**User-provided storage allocation:** 4 TB of the user's available 5 TB Google Drive storage is reserved for project use; account access/integration is not yet configured.

This document records the user’s latest decisions. It supplements and takes precedence over conflicting earlier draft requirements in the repository. It does not claim that the features are already implemented or production-ready. Before implementation, map these decisions against the existing code, migrations, and earlier financial-integrity documents and explicitly resolve conflicts.

## 1. Product scope

One shared masjid system with an Android APK and a web application using a shared backend and role-based access. The public website presents masjid information, announcements, event images, and a receipt lookup page. Board/masjid users log in to the management application. English is the launch language.

The product is intended to manage finance, donations, recurring monthly donors, tasks, meetings, attendance, member performance, salaries, announcements, and operational records. Payment-gateway integration is deferred to a future update. Initial online payments use the masjid’s configurable QR code and Treasurer verification.

## 2. Roles and account lifecycle

Roles: System Admin, President, Vice President, Secretary, Treasurer, Committee Member, Member, and a dedicated masjid laptop account. Multiple people may hold each leadership role.

- System Admin creates accounts, assigns roles, manages the system, and issues temporary passwords. The user must set a new password on first login.
- Forgotten passwords are reset by the System Admin using a temporary password.
- When a user leaves, deactivate the account while preserving historical records.
- The System Admin uses password-only login (confirmed preference).
- The laptop account may enter expenses, manage meetings, edit member profiles, publish approved public content, update the QR code, view member profiles/performance, and restore backups. It may log in from any device.
- Every member profile must contain a WhatsApp number. Phone number entry is not verified by OTP.
- All roles’ profiles should show member performance. Members can view everyone’s performance. The laptop account can view all profiles and performance.

Detailed least-privilege permissions and a safe permission matrix remain an implementation gate; see the research/risk review.

## 3. Finance and accounting

### 3.1 Donations and monthly contributors

- Keep one-time donations and monthly contributors as distinct workflows.
- An authorized logged-in masjid role may add a monthly contributor after asking and confirming consent to WhatsApp messages. Capture donor name, WhatsApp number, expected monthly amount, referrer, active/opt-out state, and consent record.
- All logged-in users can view the monthly donor list and referrer. Monthly donors are not required to be app members.
- Send a monthly contribution request to every active donor who has not opted out on the first Friday of each month at 10:00 India time. If already paid, the donor message should say to ignore it.
- Payment request content includes the current masjid QR code, expected amount, instructions, and instructions to reply with a transaction ID.
- A donor can reply `STOP` to opt out. A `PAID` message alone does not mark payment paid; the donor supplies the transaction ID. Treasurer verifies amount and receipt of funds before the payment is recorded and receipt details are sent.
- Send a reminder five days after the request only if no payment has been verified. Retry message-delivery failures automatically and notify the Treasurer if retries still fail.
- Notify the referrer after three consecutive unpaid monthly periods. Give the referrer one performance point for each contribution verified by the Treasurer; points already earned remain if the donor later stops or opts out.
- Monthly amount changes take effect immediately, including the current month.
- Cash contributions are entered and verified by the Treasurer, then included in the ledger and receipt workflow.
- The QR code is updateable by the President or laptop account. Use the current QR for future requests; keep only the current uploaded QR asset (no QR version archive was selected).
- Use official WhatsApp Business Platform / Cloud API integration in the planned product. Payment gateway is deferred to a later version.

### 3.2 Other donations and collection tasks

- One-time donors: donor name required; amount, date, payment method, auto receipt number. Reuse the selected formal receipt style.
- Jummah/cash collection amount can be entered by the Treasurer directly (then counts in the system) or by member(s) assigned to an open/assigned collection task (pending until Treasurer verification). A verified collection automatically posts as Cash income linked to the task.
- Record total cash only; denomination breakdown was declined.
- For cash-to-bank deposits, record an internal transfer with date, amount, reference, and proof. It must not inflate income or expense totals.

### 3.3 Expenses and advances

- Members/roles may submit expenses with title, description, amount, category, bill/proof, and relevant payment details. President approves before payment; rejection requires a reason and notifies the requester. If the President submitted the expense, the Treasurer approves it; if the Treasurer submitted it, the President approves it.
- Treasurer records payment date, amount paid, payment method, and bill/payment proof after approval.
- Changing the amount after approval requires reapproval.
- Track advances: approval by President or Vice President, amount and recipient, payment, later bill reconciliation, and return of unused amount.
- The laptop account may enter expenses; Treasurer verifies its submissions.
- A verified transaction may be directly edited or deleted by the Treasurer (user-selected). This is a high-risk exception to append-only accounting and is documented as a release risk rather than silently revised.

### 3.4 Opening balance, reports, payroll

- Treasurer enters initial opening balances for each cash/bank/payment account; President verifies them.
- Keep Hafiz and Muezzin salary records with amount, month, payment date, method, and payment status. All logged-in members can view these details (user-selected; privacy risk is documented).
- Monthly and annual reports cover every transaction plus summary totals: donations, expenses, transfers, and balances. Annual reporting uses 1 January–31 December. Currency is INR. Detailed reports are downloadable by President, Vice President, Secretary, and Treasurer.
- Proof references are optional per downloaded report at the Treasurer’s choice.
- Professional PDF reports include Masjid E Mamoor 2 heading and itemized details. Date-range report generation remains supported.

## 4. Receipt requirements

Selected template: **Formal**. Use the same receipt design for one-time and monthly donations. Show masjid name, title, auto receipt number, date, donor, amount, payment method, transaction reference where available, contribution type/period, Treasurer verification, and a brief thank-you.

- Generate a PDF receipt after Treasurer verification.
- Do not send the PDF through WhatsApp. Send the receipt number and current masjid website link to the donor; the donor enters the receipt number on the public receipt lookup page to download the PDF.
- Receipt numbers must be non-sequential and difficult to guess; rate-limit lookup attempts and avoid revealing whether an unknown receipt number exists.
- Payment-gateway receipts/automatic confirmations are future scope. QR transfers are manually verified.

## 5. Tasks and member performance

- President, Vice President, and Secretary can create and manage tasks. Laptop-account task creation was not confirmed and remains out of this permission until explicitly decided. A task has title, description, optional date, location, open-volunteer / directly-assigned / mixed mode, maximum participants, and for mixed tasks separate assigned/volunteer caps plus an overall cap. A deadline is not required.
- Full open tasks may take a waitlist; when a participant cancels, offer the place automatically to the first waitlisted person.
- If date/location changes, notify joined members but keep their participation confirmed. If creator cancels, no participant notification was selected; this is retained as a major operational-risk decision for review.
- Assignee submits completion with optional description. Creator verifies and closes. Rejected completion returns with a reason. If creator unavailable, leave pending. Award task points only after creator verifies/closes.
- Member performance displays separate referral, task, and meeting scores plus a combined score. Task metrics include assigned, accepted, completed, and verified history.

## 6. Meetings and attendance

- President, Vice President, Secretary, and laptop account create/manage meetings with date, location, invited members, and other meeting information. Members can accept/decline; decline reason is optional.
- Upload a meeting memo image any time after meeting creation.
- Send one-hour reminders by in-app notification and WhatsApp to invited members except those who declined. Send absence messages after the organizer finalizes attendance.
- Members check in within the 100 m masjid geofence. Organizer may manually mark attendance only when physically at the masjid, including when a member’s phone cannot verify location. The exact masjid map point remains to be supplied/confirmed.
- Each attended meeting earns one meeting point. Track declined separately; profiles show total absences.
- Hafiz attendance is separately recorded per Fajr, Dhuhr, Asr, Maghrib, and Isha; statuses are Present/Absent. President, Vice President, Secretary, or Treasurer may mark or correct after the prayer without a reason; preserve automatic change history.

## 7. Public website, content, and announcements

- Public pages show masjid information, announcements, and event images. English only at launch.
- Board/masjid roles log in to management features. Public announcement visibility is supported; member-only announcement capability is retained as an option if required.
- President, Vice President, Secretary, and laptop account may publish/edit announcements and public/event images. Published announcement edits notify members. Announcements support immediate/scheduled publishing and optional expiry.
- Public receipt lookup accepts receipt number only, as selected. Apply the safeguards specified above; do not expose a browsable receipt list.
- Latest APK is distributed from the masjid website. In-app update link and System Admin contact details are shown. Required releases block old app versions while preserving accounts/cloud data.

## 8. Notifications and WhatsApp policy

- Use WhatsApp Business Platform, not unofficial scraping/automation. Collect and persist explicit donor consent before proactive messages; support opt-out and suppression (`STOP`).
- Business-initiated messages require approved templates. Use webhooks for inbound replies and delivery status; make processing idempotent to handle provider retries/duplicate webhooks.
- Message categories/prices and approved donation-template classification must be verified against Meta’s current rate card at launch. Fundraising request classification may be marketing; budget conservatively. Message delivery is not proof of payment.
- In-app notifications are the fallback for members; WhatsApp delivery failures are visible to Treasurer/authorized operator.

## 9. Offline use and backups

- Allow offline entry and sync later. Offline finance entries remain pending and do not trigger approval notices or become approved until successfully synchronized online.
- Warn about possible duplicate financial entries and let Treasurer review.
- Create daily automatic backups and allow manual backup. Retain daily backups 30 days and monthly snapshots one year.
- Only laptop account may restore; selected workflow restores without an additional confirmation step. Backup restore access must be implemented with strong authentication and operational logging.
- Backup scope includes database and uploaded files; verify actual provider plan, exports, retention, encryption, and restoration in a test environment before production.
- The user has allocated 4 TB of Google Drive storage for this project. Proposed use: a secondary destination for encrypted backup archives, generated reports, and approved archived media. Google Drive is not the live application database or direct public-file origin; the app database and object storage remain the operational source of truth. Confirm the exact Drive integration method and folder ownership before automation.

## 10. Decisions that remain open or need reconciliation

1. Exact masjid geofence latitude/longitude (user will supply later); keep configurable, default radius 100 m.
2. Whether a monthly donor may make partial payments and how balances carry forward: not decided in the Q&A; do not infer.
3. Which message categories Meta approves for donation solicitation and exact live India price: verify before WhatsApp go-live.
4. Meaning of monthly amount changing “immediately” for an already-paid or partially-paid current month: define a non-destructive adjustment rule.
5. Which financial account QR contributions land in (UPI/bank account mapping) and how Treasurer reconciles it.
6. Whether receipt number alone is an acceptable privacy control after a stakeholder security review.
7. Existing repo has older role labels/financial integrity choices. Reconcile new Treasurer role, laptop account, direct edits/deletes, all-member salary visibility, expense self-approval exceptions, and task-cancellation notification behavior before coding.
8. Verify current masjid contact email/phone and exact public-site details before release; use the previously provided contacts only after user confirms they are still correct.
9. Confirm the Google account/folder to use for the 4 TB allocation, who administers access, and whether automated backup upload is acceptable.

