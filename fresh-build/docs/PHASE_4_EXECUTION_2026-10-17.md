# Phase 4 finance execution — 17 October 2026

Phase 4 is **in progress**. All 16 fresh migrations and the existing finance,
correction and report fixtures passed on the isolated hosted development
database. A separate local PostgreSQL 17 stack passed a clean reset and all 11
rollback-only fixtures through container `psql -X -v ON_ERROR_STOP=1`.

## Signed-in local web journey, 17 October 2026

Two distinct synthetic Auth Admin users signed in through the actual web username
form against the isolated local stack. President created synthetic Cash and UPI
accounts. Treasurer submitted a ₹100.00 Cash opening; the page kept both
balances at ₹0.00 while pending. President verified it and Cash showed ₹100.00.
Treasurer posted a ₹25.00 Cash-to-UPI transfer; the page showed ₹75.00 and
₹25.00, with the debit and original opening in Cash history. Treasurer recorded
an observed ₹74.50 with a 50-paise variance; the book balance remained ₹75.00.
The browser showed success states for each step. Only synthetic local data was
used; reset removes both users, accounts, opening, transfer and observation.
This does not establish Android, hosted UI, accessibility or poor-network proof.

The journey exposed a pre-hydration login fallback that sent form fields by GET.
The login form now uses POST, so a submission before JavaScript hydration does
not place a password in the URL. The development script now uses webpack, the
same bundler as the working production build, because the default Turbopack
workspace resolution failed on `@supabase/supabase-js`.

## Independent-session transfer evidence

`backend/scripts/phase4_concurrency.py` was run four times against the disposable
local fresh-build stack with `FRESH_BUILD_TEST_DATABASE_CONFIRM=disposable`.
It uses separate `psql` sessions, real `authenticated` database roles and
current JWT claims for a synthetic Treasurer. The script resets that local
database afterward; it requires zero Auth users and finance effects before
starting. Its final run waited for the first session's transfer result before
starting the second, so the transactions overlapped while the first held its
account locks.

- Two overlapping 7,000-paise transfers from an account with 10,000 paise:
  one posted, the other received `insufficient_account_balance` after waiting
  for the first transaction. No overdraft occurred.
- Opposite-direction 2,000-paise transfers both posted without a deadlock.
- Two overlapping retries with the same operation ID returned one transfer ID
  and produced one pair of effects.
- Independent sums after all four successful transfers were 2,000 and 18,000
  paise across the two accounts. Eight transfer legs summed to zero. The
  authorized `list_finance_accounts` projection matched both independent sums.
- One final run also raced two corrections of the same synthetic 5,000-paise
  donation effect. One 4,000-paise replacement posted; the other session
  received `posting_already_corrected`. One correction and one new receipt
  record existed, the original receipt became `superseded`, and the final
  account balances were 6,000 and 18,000 paise.
- The extended disposable race then submitted two overlapping 4,000-paise
  payments against one approved 5,000-paise expense. One posted and the other
  received `expense_overpayment`; the request remained `partially_paid` with
  exactly one 4,000-paise effect. Two overlapping retries of the final
  1,000-paise payment returned the same payment ID, one effect and `paid`
  status. Independent effect sums ended at 1,000 and 18,000 paise.
- The correction fixture now follows a second revision of the donation
  replacement, from 900 to 800 paise. The first replacement receipt becomes
  `superseded`; the newest remains `active`. It independently sums 11 effect
  legs by opening, donation, payment and correction source to 10,100 paise,
  including a voided payment and its corrected replacement.
- The monthly and one-time-donation/expense fixtures independently compare
  source effect counts and sums with account projections: 30,000 paise for a
  verified monthly contribution and 65,000 paise for the opening + verified
  donation − two expense payments. All 11 rollback-only SQL fixtures passed
  again on the isolated local stack after these additions.
- The report fixture now reconciles two accounts in one India-month snapshot:
  15,000 paise of openings, 3,000 monthly income, a one-time donation corrected
  to 900, a 1,000 expense and a balanced 2,000 transfer. Nine immutable effects
  sum to 17,900 paise; per-account report closes at 8,900 and 9,000 paise.
  A later second correction and 500-paise donation leave that snapshot fixed;
  a new 12-effect report closes at 9,300 and 9,000 paise. The earlier
  replacement receipt is superseded and the newest is active. A subsequent
  range starts with those two balances and has zero in-period lines. This is
  SQL source/report proof, not rendered PDF or published-report revision proof.
- A disposable local targeted `pg_dump`/`pg_restore` rehearsal restored two
  synthetic Auth/app users, one account and beneficiary, one verified opening
  and its 12,345-paise effect into a separate scratch database with matching
  counts and totals. A private 68-byte Storage object was backed up, deleted,
  replayed and SHA-256 checked. Full Supabase-managed restore and hosted
  database/object recovery remain open; details and cleanup are in
  `PHASE_0_4_AUDIT_2026-10-17.md`.
- The expanded `finance_foundation.sql` fixture passed with zero, negative,
  same-account, missing-target and bigint-overflow denials, funded-account
  deactivation denial, account/reconciliation keyset pages, and the
  opening-plus-transfer accounting equation.
- Android now has a role-scoped account screen in `apps/android/lib/FinanceAccounts.jsx`:
  balances, recent effects and observations for authorized readers; President
  account creation/opening verification; Treasurer opening submission,
  transfer and reconciliation. It uses exact shared paise parsing/formatting
  and stable operation IDs on retries. Lint, source typecheck, format check,
  75 Node tests and Android bundle export passed. This is source/build proof,
  not a signed-in device journey.
- `backend/scripts/phase4_auth_api.py` created two synthetic users through the
  supported local Auth Admin API and signed each in separately. With the
  issued President and Treasurer tokens, direct RPC checks passed: President
  created two cash accounts, Treasurer submitted 10,000/0-paise openings,
  pending balances stayed zero, President verified both, Treasurer transferred
  3,000 paise, and President read 7,000/3,000-paise balances. President transfer,
  Treasurer opening verification and direct `app_users` reads returned 403.
  The script reset the disposable local database afterward. This is local
  Auth/Data API proof, not a hosted or client UI test.

These checks prove the tested transfer, expense-payment and donation correction
paths, not all Phase 4 money sources or all possible concurrent schedules. The local
fixture uses synthetic opening and donation records as setup; the normal
commands are separately covered by rollback-only SQL fixtures.

## Remaining Phase 4 work

1. Add beneficiary edit/version control and complete the account administration
   policy review. The current creation path validates a beneficiary once; it
   does not provide a reviewed edit history.
2. Exercise web and Android account/opening/transfer/reconciliation journeys
   against distinct issued role sessions on devices, including poor-network
   retry, keyboard and accessibility checks. Add full history pagination and
   Android correction controls.
3. Extend independent account and period reconciliation beyond the tested
   mixed-source month and two-level donation correction to advances, salaries,
   more date boundaries and payment/correction races.
4. Link corrected receipts and reports to their published revisions, verify
   private proof files, and complete a supported full managed-database plus
   object restore drill on staging.
5. Confirm real account identifiers, opening amounts and operator evidence with
   the masjid before any real money is entered. Owner policy approvals from
   Phase 1 remain separate gates.

No production money or personal data was used.
