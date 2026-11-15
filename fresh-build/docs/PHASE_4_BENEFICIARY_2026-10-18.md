# Phase 4 beneficiary correction — 18 October 2026

## Implemented

Migration `20261018092953_account_beneficiary_versions.sql` adds private, immutable beneficiary versions. The President can correct a UPI ID or bank account with an evidence reference before the account has an opening, QR, monthly request or posted effect. The command validates the account kind and identifier, serializes against QR activation and account use, and is idempotent only for the same actor and payload. Once used, the operator must create a replacement account; old payment details and account history are not rewritten. The original account-creation retry still compares against version 1 after a correction.

The President and Treasurer can read a scoped version history. Bank account numbers are shown only by their last four digits. Web and Android finance screens show that history and give the President a pre-use correction form. Direct table access remains denied.

## Evidence

- Applied migration 18 to isolated hosted development and recorded version `20261018092953` in its migration history. The new rollback-only fixture passed with synthetic President, Treasurer and Member identities: initial and corrected UPI/bank versions, normalized replay, changed-retry rejection, malformed UPI rejection, Member read/write denial, used-account denial, immutable history, direct grant denial, and zero money effects.
- The expanded security-catalog fixture passed after migration 18. Hosted final counts for synthetic Auth users, app accounts and beneficiary versions were `0|0|0`; the fixture rolled back.
- A fresh local reset in the separate `masjid-e-mamoor-2-fresh` stack applied all 18 migrations. All 12 SQL fixtures passed through container `psql` with `ON_ERROR_STOP=1`. Final local Auth users/sessions/app users/accounts/beneficiary versions/finance effects/Storage objects were `0|0|0|0|0|0|0`. Only that stack and the Colima engine started for this check were stopped.
- Lint, typecheck, Prettier, web production build, Android bundle export, 76 Node tests, fixture inventory (`18` migrations and `12` rollback-only fixtures), and the fixture preflight unit test passed.
- Supabase advisors after the new index: 49 RLS-without-policy notices (the added private table is intentionally RPC-only), one anonymous and 66 authenticated definer notices, 64 unindexed foreign keys and three unused-index notices. The new `changed_by` foreign key has its own index; index usage should be reviewed after representative traffic. Remediation references: [RLS without policy](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy), [authenticated definer](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), [unindexed foreign keys](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys).

## Remaining Phase 4 exit work

This closes the pre-use beneficiary edit/version gap, not the whole Phase 4 exit. Still required: hosted signed-in web/Android finance journeys, independent-session races and period reconciliations for advances/salaries and more correction schedules, private proof/report revision checks, staging restore, and named operator acceptance of real account/opening evidence. No real bank details or production money were used.
