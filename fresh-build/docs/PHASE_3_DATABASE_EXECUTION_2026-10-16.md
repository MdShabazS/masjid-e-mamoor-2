# Isolated development database execution — 16–17 October 2026

## 17 October revoked-session and identity lifecycle addendum

Migration `20261017173050_revoked_session_gate.sql` is the seventeenth fresh
migration. It requires the JWT `session_id` to match a live `auth.sessions`
row for the same user before the shared actor guard, current role or identity
gate returns access. Missing, malformed, expired-by-session or revoked session
claims fail closed. The SQL fixtures now create rollback-only synthetic Auth
session rows and include matching session claims. A clean local reset applied
all 17 migrations and all 11 fixtures passed. The migration was also applied
to isolated hosted development; its rollback-only identity fixture passed.

A local real Auth/web API lifecycle used two synthetic users in the disposable
fresh stack. It passed System Admin provisioning, temporary password gating,
first password change, fresh sign-in, admin reset, old password denial,
revoked pre-reset session denial after the next password change, account
deactivation, identity audit and six-attempt login rate limiting. The test
first exposed that an old access JWT could regain the Member role after the
password gate cleared, even though its Auth session row was removed. The new
database check closes that path. A second check exposed that first password
change left the temporary Auth session alive; the server now calls Auth Admin
global sign-out before completing the password gate. A failed sign-out leaves
the account gated. The same lifecycle passed after both fixes, and its
cleanup reset removed the synthetic users. The local issued-session finance
API journey also passed after the session gate. Both client UIs and hosted
identity lifecycle remain unverified.

## 17 October owner-accepted enrollment addendum

Migration `20261017121234_phase1_accepted_donor_enrollment_roles.sql` is the
sixteenth fresh migration. It adds the accepted Member enrollment role to the
server-only function and requires an active recorded referrer. The web
enrollment endpoint now permits Member after its current identity gate. A fresh
local reset applied all 16 migrations, and all 11 rollback-only SQL fixtures
passed, including a successful synthetic Member enrollment, missing-referrer
denial and System Admin denial. The same migration was applied to isolated
hosted development. A hosted definition check found the Member guard and
required referrer, with no direct authenticated EXECUTE grant, zero approved
consent versions and zero app users. Thus real enrollment remains disabled.
The hosted advisors still report 48 deny-all RLS tables, one anonymous and
64 authenticated security-definer executables, 64 unindexed foreign keys and
two unused indexes; their body/performance review remains open.

The user selected **MdShabazS's Org**. A new project named
`masjid-e-mamoor-2-dev-20261016` was created in `ap-south-1` (Mumbai), project
ref `necattvpncnsrfcrwpjn`. The organization reports the free plan. The
connected cost lookup was unavailable; project creation succeeded without a
cost-confirmation request. The project reports PostgreSQL 17.11 and was empty
before the fresh migrations. No legacy migrations or real users were imported.

## Observed results

- All 15 files in `backend/supabase/migrations/` applied in filename order and
  appear in the project migration list. The Phase 6 migration first exposed
  two PL/pgSQL parser errors in `IF` expressions containing inline `CASE`;
  replacing those comparisons with equivalent Boolean predicates made the
  migration pass. This repaired source was applied to the new project.
- All nine workflow SQL scenarios in `backend/tests/` passed through the connected SQL
  runner. Eight use `backend/scripts/connector_fixture_sql.py` to translate
  psql `\gset` variables into transaction-local settings; the original
  rollback-only assertions and `BEGIN`/`ROLLBACK` boundaries remain.
  `backend/scripts/db_fixture_preflight.py` now finds 15 migrations and 11
  rollback-only fixtures, including the subsequently added catalog and
  eight-role read guards.
- `backend/tests/security_catalog.sql` passed on the same project. It checks
  definer grants, pinned search paths, visible actor guards, three private
  table grants, and RLS/no direct anon or authenticated DML for all 40 public
  base tables. It is a regression guard, not a complete authorization proof.
- `backend/tests/eight_role_reads.sql` passed on the same project with
  `SET LOCAL ROLE authenticated` and transaction-local JWT claims. It checked
  donor-roster reads for all eight roles, finance account reads for SA/P/VP/S/T,
  task reads for all except SA, and Hafiz prayer reads for P/VP/S/T, including
  denials for the other roles. A post-test query found zero synthetic fixture
  rows in `auth.users` and `app_users`. These were simulated JWT claims, not
  issued Auth sessions.
- A post-fixture query returned zero rows in `app_users`, `monthly_donors`,
  `finance_effects` and `expense_requests`.
- A read-only grant query confirmed the legacy donor-enrollment RPC is not
  executable by `authenticated`, the consent approval table is empty, and
  `anon` cannot select `app_users` or `authenticated` select `finance_effects`.
- A direct Data API probe with the development project's publishable key returned
  HTTP 200 and `[]` for `list_published_community_posts`, HTTP 401 / SQLSTATE
  `42501` for `app_users` select, and HTTP 401 / SQLSTATE `42501` for
  `list_monthly_donors`. These checks used no issued member session.
- Repeating the protected table and RPC requests with a malformed bearer token
  returned HTTP 401 / `PGRST301` for both. This tests invalid-token rejection,
  not an expired or revoked real session.
- The `qr-private` Storage bucket is nonpublic, limited to 5 MiB PNG/JPEG
  objects, and `storage.objects` currently has no policies. This is a catalog
  check; a real private-object read or signed-URL lifecycle has not run.
- With the user's approval, one synthetic confirmed Auth user was temporarily
  inserted into the isolated development database and signed in through
  `/auth/v1/token`. Supabase issued a real session for that user. The direct
  Data API returned HTTP 200 / `member` for `current_app_role`, HTTP 200 for
  the donor roster, HTTP 403 for detailed finance, and HTTP 403 for direct
  `app_users` access. The first-password gate was then set for the same user;
  without refreshing the token, `current_app_role` became `null` and the donor
  roster returned HTTP 403. Changing the database role to Treasurer made the
  same token report `treasurer` and read the empty finance account projection.
  Deactivation then made the same token report no app role and return HTTP 403
  on finance and donor RPCs. This proves the shared guard consults current
  database state for those paths, rather than trusting an old role claim.
- The Auth logout endpoint returned HTTP 204. Transactional cleanup removed the
  synthetic alias, app row and Auth user; a follow-up count found zero user,
  identity, session, app-user and alias rows for its ID. The temporary token
  file and generated credential were removed from the local test environment.
  No real email was used or sent.
- A second temporary synthetic account signed in through `/auth/v1/token` and
  received an issued session. With that same token, its database role was
  changed through `system_admin`, `president`, `vice_president`, `secretary`,
  `treasurer`, `committee_member`, `member` and `data_entry`. All 48 direct API
  expectations passed: `current_app_role` and `list_monthly_donors` returned
  HTTP 200 for each role; `list_finance_accounts` returned HTTP 200 for the
  five leadership/finance roles and 403 for the other three;
  `list_visible_work_tasks` returned 403 for System Admin and 200 for the
  other seven; `list_hafiz_prayer_marks` returned 200 for President, Vice
  President, Secretary and Treasurer and 403 for the other four; direct
  `app_users` select returned 403 for all eight. Logout returned HTTP 204.
  Cleanup removed the second synthetic alias, app row and Auth user. A
  project-wide follow-up count found zero `auth.users`, `auth.identities`,
  `auth.sessions` and `public.app_users` rows. This is a single issued token
  rechecked against eight current database roles, not eight separately
  provisioned accounts or sessions.
- A clean `npm ci`, 75 Node tests, lint, format, source typecheck, web build,
  unconfigured HTTP smoke, Android bundle export and backup preflight passed
  locally. The Android export is a JavaScript bundle, not an APK.

## Local clean reset and API checks — 17 October

- The fresh build now uses local ports 55320–55329 and inspector port 18083,
  avoiding the existing legacy Supabase stack on 54320–54329. The separate
  `masjid-e-mamoor-2-fresh` stack started with PostgreSQL 17. A local
  `supabase db reset --local --no-seed` applied all 15 migrations from scratch.
- All 11 original rollback-only fixture files passed in the fresh database
  container through `psql -X -U postgres -d postgres -v ON_ERROR_STOP=1`.
  This includes the enhanced security catalog assertion that `qr-private` is
  nonpublic, is limited to 5 MiB PNG/JPEG, and has no `storage.objects`
  policies. The preflight again counted 15 migrations and 11 fixtures.
- A synthetic one-pixel PNG was rejected for anonymous upload (HTTP 400).
  A trusted service upload (200) and exact-byte read (200) worked. Anonymous
  private download and public URL access returned 400; anonymous listing
  returned an empty array. The trusted service deleted the object (200).
- Local Auth Admin creation of a confirmed synthetic user returned HTTP 200,
  but initial password sign-in returned HTTP 422 `email_provider_disabled`.
  The local `[auth.email]` setting was corrected to enable email login while
  global `[auth] enable_signup=false` remains. After restarting this stack,
  Admin creation, password sign-in with an issued session, and Admin deletion
  each returned 200. Public `/signup` returned 422 `signup_disabled`.
- Final local counts were zero for `auth.users`, `auth.identities`,
  `auth.sessions`, `public.app_users`, and `qr-private` objects. The temporary
  local credential file was removed. These tests use only synthetic data.

## Advisor review still required

Security advisor: [one anon executable definer function](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable) is the public published-post projection, whose SQL filters public, published, current posts. [64 authenticated executable definer functions](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable) require a complete grant and body audit against the role matrix. [48 RLS tables without policies](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) appear to implement deny-all direct table access; verify each direct Data API path before accepting this design.

A read-only catalog pass found 82 public `SECURITY DEFINER` functions. All 82 pin `search_path=pg_catalog`. Of the 64 executable by `authenticated`, 61 directly call `app_private.require_actor`; the other three are `current_app_role`, `current_identity_gate` and the public published-post projection. The shared guard resolves `auth.uid()` against an active `app_users` row, an alias with completed first password change, and the supplied allowed-role list. The catalog result and issued-session 48-check read matrix narrow the review; they do not establish that every allowed-role list, returned column or nested call is correct.

Performance advisor: [64 unindexed foreign keys](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys) need workload-based prioritization. [Two unused-index notices](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index) are expected on a new empty project and need review after representative traffic.

The current Supabase [PostgreSQL 17.11 changelog](https://supabase.com/changelog/postgres-15-19-17-11-breaking-changes) was checked. Its listed ltree, legacy pgcrypto cipher, btree_gist float and custom-operator upgrade cases do not appear in the fresh migration source; this is a source inference, not a database detection-query result.

## Eight distinct local Auth sessions — 17 October

`backend/scripts/phase3_issued_role_matrix.py` used the supported local Auth
Admin create and password sign-in endpoints to issue separate tokens for all
eight application roles. With each token, direct REST/RPC checks passed the
same 48 role/read expectations as the earlier SQL matrix: current role,
donor roster, finance accounts, work tasks, prayer marks and denied direct
`app_users` access. A correctly signed but expired local JWT received HTTP 401.
An existing issued Data Entry token followed a database role change to
Treasurer, then lost its role and protected RPC access after deactivation.
The script reset only the disposable fresh-build local database afterward;
Auth users and finance effects returned to zero. This is separate-session
local Auth/Data API proof, not eight hosted sessions or client UI proof.

## Gates still open

The original psql harness and clean reset now pass locally. Eight distinct
issued sessions, an expired local token and independent-session finance races
pass on the local fresh-build stack. Hosted private-object lifecycle, hosted
distinct sessions, staging restore and both-client integration are still
needed. The hosted temporary Auth user was seeded directly into
Supabase-managed Auth tables only for this isolated test. Supported Auth Admin
create/sign-in/delete was proven locally, but the hosted provisioning path and
first-password-change broker are still open. The dashboard's supported user
form requires a new password and was left unsubmitted.
No production money or personal data should enter this project.
