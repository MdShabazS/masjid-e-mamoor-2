# Masjid E Mamoor 2 — project status

**Updated:** 15 November 2026 (India time). This is the short, current list of what is done and what is left. `tasks.md` is the older dated evidence log, up to 29 October.

**Overall:** not ready for release. Real-money launch is NO-GO.

`Done` means it exists and passed the check named. It does not mean it has been accepted on a real phone or on staging.

## Completed

### Foundation

- [x] Clean npm workspace, CI on GitHub, lint, formatting, typecheck, 188 automated tests and 19 rollback-only database test files
- [x] 39 database migrations. Staging holds all 39 and no data yet; production is paused, holds no real data, and its migration history needs repair before use
- [x] Protected Vercel previews; nothing is live
- [x] 8-role permission system, wrong-role denial matrix, username login, temporary password flow

### Finance and donors

- [x] Accounts, opening balances, transfers, reconciliation, corrections (web and Android, except corrections: web only)
- [x] Monthly contributor enrollment, payment claims, Treasurer verify/reject, linked replacement
- [x] One-time donations and direct cash posting (web only)
- [x] Cash collection tasks with numbered slips (web and Android)
- [x] Expense request, approval, partial payment (web; Android only as an offline draft)
- [x] Payment QR upload, review and guarded cleanup

### Reports and receipts

- [x] Private PDF/CSV reports, worker, recovery and web screen
- [x] Receipt code issued on verification; public lookup built but switched off
- [x] Manual receipt handoff audit, switched off

### Work and communication

- [x] Tasks: capacity, waitlist, completion review (web and Android)
- [x] Meetings: create, invite, RSVP, cancel (web and Android)
- [x] Member inbox (web and Android); announcements (web)
- [x] Encrypted offline drafts (Android)
- [x] Encrypted backup and restore, proved locally only

### Android fixes made 2 November 2026

Checked on the Pixel 8 emulator against a local database with a fake Treasurer unless marked otherwise.

- [x] Tab layout (Home, Finance, Donors, Work) replaces one very long page; back button returns to Home
- [x] Hafiz prayer register added; a mark was saved and read back from the database
- [x] Readable error messages, including wrong password
- [x] Code fix, not exercised on the emulator: the hourly login refresh no longer wipes open screens, typed forms and retry IDs, while role changes still apply
- [x] Code fix, not exercised: login refresh pauses in the background and resumes in the foreground
- [x] Code fix, not exercised: offline sign-out now always clears the device
- [x] Code fix, not exercised: background draft sync no longer shows a message every 60 seconds or uses the network with nothing to send
- [x] Code fix, not exercised: System Admin no longer calls task functions it is denied
- [x] Code fix, not exercised: Members can see the enroll form, matching the 17 October owner decision
- [x] Code fix, not exercised: a crash in one tab shows a retry card instead of closing the app
- [x] Android app backup turned off for this finance app; keyboard resize set
- [x] Members may submit payment references and one-time donations and replace their own rejected claims (owner decision 2 November; database, Android and web). Verification stays Treasurer-only
- [x] Android member picker replaces typed account IDs for referrer and invitations; date, time and month pickers replace typed dates
- [x] Upgraded to Expo 58 and React Native 0.88: all high and low audit findings cleared, 12 moderate build-tool entries remain and are pinned in the CI check
- [x] Android screens for expense approval and payment, one-time donation review, direct cash posting, and report request, view and share (emulator journey below)
- [x] Meeting attendance: 100 m GPS check-in on the meeting day, organizer onsite marking with reason, post-day finalization, data entry fallback that cannot create presence, System Admin masjid point (database and Android)
- [x] Salary and advances: staff list, monthly payments, advance request, approval, payment, bills and returns, with reports reconciling through an "Advances outstanding" account (database and Android). Members see salaries only after the Board flag is set
- [x] Activity points: verified tasks + attended finalized meetings + one referral point per donor per month, each with its count out of the total, no ranking (database and Android)
- [x] 8 November: the five new migrations are applied to staging (history repaired first); all 18 database test files pass there. Production is paused and untouched
- [x] Web pages for attendance (check-in, roster, finalize, fallback, masjid point), salary, advances, Activity points and the prayer register; member pickers replace typed account IDs on web meetings, tasks and contributors
- [x] People and roles screen (web and Android): System Admin creates Presidents and backs up every role; President adds, resets, changes and deactivates the other roles. Temporary passwords are readable groups (e.g. KKNN-P9HW-ZE8H-WREZ), shown once and changed at first sign-in
- [x] Web enrollment form now shows for Members too
- [x] Web enrollment route returns an input error, not "service unavailable", for a bad amount

### Verified on 15 November 2026

- [x] All 188 automated tests, lint, format, typecheck, web build and Android export passed again. Device-level proof is only what the emulator and browser journeys below record; items marked "code fix, not exercised" are still unproven on a device
- [x] Documentation brought up to date: setup after cloning, environments, current counts. Unused local files and old backups removed; everything else is in Git
- [x] A fresh clone of the repository installed, tested, linted, type-checked and built for web and Android
- [x] Installable web app (owner decision 15 November: testers use the web app on Android and iPhone; the native app follows as a later update). Manifest, placeholder icon (dome and crescent until the masjid logo arrives) and a "No connection" page. Checked in a browser: the app is installable, and with the server stopped a screen showed the offline page. The phone stores only that page, never records

## Pending — before the phone ground test

- [x] 17 November: the staging web app is public at `https://masjid-e-mamoor-2.vercel.app` (Vercel free plan, staging database, test data only). Pages, install files and the sign-in API answer without a Vercel login; a wrong sign-in reaches staging. No signed-in journey there yet

- [x] 17 November: account management migration applied to staging (39 of 39). Staging test logins and the "STAGING TEST cash" account removed; all 19 database test files pass there
- [x] 17 November: first System Admin `sys.admin` created on staging with `backend/scripts/bootstrap_system_admin.py` (temporary password kept in a private local file, must be changed at first sign-in). Sign-in on the public site returned must-change-password. The check accidentally printed that test session's tokens; the session was deleted and its token is now rejected
- [x] 17 November: the owner signed in as `sys.admin` on the public site and set their own password (audited); the temporary password file was deleted
- [ ] Create the President and the test accounts for the ground test
- [ ] Set a test check-in location for attendance
- [ ] One-page tester guide: add to home screen on iPhone and Android, accounts, what to try
- [ ] Test on 3–4 real phones, including at least one iPhone
- [ ] Later: native Android APK from `eas.json` as a future update

## Pending — features not built

| Item                                                           | Android  | Web        | Database      | Blocked on                                |
| -------------------------------------------------------------- | -------- | ---------- | ------------- | ----------------------------------------- |
| Absence notice delivery (outbox row is written, no sender yet) | No       | No         | Outbox only   | Scheduler                                 |
| Attendance field test at the real 100 m boundary               | Not done | n/a        | n/a           | Masjid coordinate                         |
| Correcting a posted salary or advance entry                    | No       | No         | No            | —                                         |
| Member directory screen (pickers exist on web and Android)     | No       | No         | List function | Real names are not stored, only usernames |
| Own contact edit                                               | No       | No         | Check         | —                                         |
| Force-update for old app versions                              | No       | No         | No            | —                                         |
| Receipt PDF and send action                                    | No       | No         | Partial       | Masjid receipt layout                     |
| Meeting memo and private media                                 | No       | No         | No            | —                                         |
| Push notifications                                             | No       | n/a        | No            | —                                         |
| Scheduler for reminders and report worker                      | n/a      | Route only | Yes           | Hosting decision                          |

## Pending — Android screens that exist on web only

- [ ] Finance corrections
- [ ] Announcements management

## Pending — Android release quality

- [ ] App icon, adaptive icon and splash screen (none exist; needs the masjid logo)
- [ ] Permanent package name; `.fresh` is a development identity
- [ ] Signing key and who holds it; signed APK; upgrade test
- [ ] Test on a real phone: login, roles, offline, keyboard. The emulator's floating keyboard did not prove the full on-screen keyboard
- [ ] Accessibility check with a screen reader and large text

## Pending — owner and masjid inputs

- [ ] Full Board's recorded approval: donor consent, receipt fields, salary visibility, retention
- [ ] Official bank/UPI details and QR from the Treasurer; request is drafted but not sent
- [ ] Opening balances and official contact details, checked by two people
- [ ] Masjid coordinate
- [ ] Release owner's sign-off on the 2 remaining moderate build-tool advisories (`glob`, `minimatch`), or a compatible fix

## Pending — hosted proof before launch

- [ ] Signed-in finance, Storage, report and worker journeys on staging
- [ ] Hosted backup: write-consistent, offsite, scheduled, clean-target restore
- [ ] All 25 acceptance IDs, security and load tests, operator pilot
- [ ] Monitoring and named alert recipient

## Emulator journey on 2 November (Expo 58, fake data, local database)

- President approved a Member's expense; Treasurer verified a ₹500 donation, paid the ₹200 expense and posted ₹75.50 cash. The database shows one effect each, on top of the ₹1,000 opening
- Treasurer created a month report; PDF and CSV passed the digest check and reached the share sheet
- President uploaded a QR image through the system picker, activated it and read it back
- Not exercised on Android: rejecting a donation or expense, partial payment, year and date-range reports, opening a report by ID, the file's contents after sharing
- The `Error: undefined` log line is the development server's reconnect notice, not an app error

## Attendance emulator journey on 3 November (Expo 58, fake data, emulator GPS)

- System Admin saved the masjid point; the app requests foreground location only
- Member refused about 6.7 km away; checked in at 33 m. Only distance and accuracy were stored
- Organizer saw the roster, marked a second member present from 11 m with a reason, and finalized yesterday's meeting: the invited member who never checked in became absent
- Data entry finalized a meeting the organizer left open, with a recorded reason, and created no presence
- Two absence notices were queued. Nothing sends them yet
- Not exercised on the emulator: mock-location rejection (the database tests cover it), denied permission, location turned off, and a real field test at the 100 m boundary

## Salary and advances emulator journey on 3 November (fake data)

- Member requested a ₹500 advance; Vice President approved it
- Treasurer added a Hafiz at ₹300 a month and paid the month once
- Treasurer paid the advance, recorded ₹300 of bills and ₹200 returned: the advance shows settled, "Advances outstanding" is back to ₹0 and cash is ₹10,000 − ₹300 − ₹500 + ₹200 = ₹9,400
- Found and fixed: the settlement form kept its old values after saving, so the next entry was appended to them
- Not exercised on the emulator: rejecting an advance, editing or stopping a salary, a member viewing salaries after the Board flag (database tests cover it), and a report containing these lines

## Activity points on the emulator, 8 November (fake data)

- A member's October card showed 1 task, 1 of 2 finalized meetings (1 absent) and 2 of 3 referral months: 4 points, matching the database test. November showed the opted-out donor's later point
- Found and fixed: the Member box said "Choose member" while showing your own points

## Web pages in the browser, 8 November (fake data, local database)

- Member: requested a ₹400 advance; Activity points page and member list loaded; prayer register refused; salaries hidden until the Board flag; check-in showed the browser location prompt message (the test browser blocks location)
- Vice President: approved the advance and marked Fajr present
- Treasurer: added a ₹250 Hafiz and paid the month, paid the advance and settled it with bills. Cash ₹10,000 − ₹250 − ₹400 = ₹9,350 and "Advances outstanding" ₹0 in the database
- Fixed: double data load when salary and prayer pages open; prayer buttons ran together and had no prayer name for screen readers
- Not exercised in a browser: GPS check-in with real location, organizer roster and finalize, data entry fallback, System Admin masjid point, the payment confirmation dialogs (accepted automatically in the test)

## People and roles in the browser, 10 November (local database)

- System Admin created a President; the President was forced to set a new password, then saw only the six roles they manage and the System Admin as read-only
- President created a Treasurer, reset the password and deactivated and reactivated the account. Every step is in the audit trail under the right person
- Fixed: a shown temporary password stayed on screen after a later action; temporary passwords were 32 random characters and hard to read aloud
- Not tested on the Android emulator yet; the phone test will cover it

## Audit coverage on 2 November

**Read in full:** all Android files, shared package source, requirements baseline, product rules, the checklist.

**Read in part or by automated check:** backend services and API routes were read except a few small helpers. Every app database call was compared by script with the SQL function names and arguments and no real mismatch was found. Role guards were compared by script.

**Not yet read line by line:** most web pages, most SQL migration bodies, test fixtures, the operational scripts and the dated evidence docs.
