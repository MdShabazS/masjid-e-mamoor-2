# Masjid E Mamoor 2 — project status

**Updated:** 2 November 2026 (India time). This is the short, current list of what is done and what is left. `tasks.md` remains the detailed dated evidence log.

**Overall:** not ready for release. Real-money launch is NO-GO.

`Done` means it exists and passed the check named. It does not mean it has been accepted on a real phone or on staging.

## Completed

### Foundation

- [x] Clean npm workspace, CI on GitHub, lint, formatting, typecheck, 178 automated tests
- [x] 35 database migrations; staging and production Supabase projects hold the schema with no real data
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
- [x] Web enrollment form now shows for Members too
- [x] Web enrollment route returns an input error, not "service unavailable", for a bad amount

## Pending — features not built

| Item | Android | Web | Database | Blocked on |
|---|---|---|---|---|
| Meeting attendance / GPS check-in, finalization | No | No | No | Masjid coordinate for field test |
| Salary records | No | No | No | Board visibility decision |
| Advances and returns | No | No | No | — |
| Member scores / performance | No | No | No | Board wording of metrics |
| Member directory screen, and member picker on web (Android has the picker) | Picker only | No | List function | Real names are not stored, only usernames |
| Own contact edit | No | No | Check | — |
| Force-update for old app versions | No | No | No | — |
| Receipt PDF and send action | No | No | Partial | Masjid receipt layout |
| Meeting memo and private media | No | No | No | — |
| Push notifications | No | n/a | No | — |
| Scheduler for reminders and report worker | n/a | Route only | Yes | Hosting decision |
| Hafiz prayer register on web | Yes | No | Yes | — |

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

## Audit coverage on 2 November

**Read in full:** all Android files, shared package source, requirements baseline, product rules, the checklist.

**Read in part or by automated check:** backend services and API routes were read except a few small helpers. Every app database call was compared by script with the SQL function names and arguments and no real mismatch was found. Role guards were compared by script.

**Not yet read line by line:** most web pages, most SQL migration bodies, test fixtures, the operational scripts and the dated evidence docs.
