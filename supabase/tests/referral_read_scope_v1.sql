\set ON_ERROR_STOP on

BEGIN;

\echo '============================================'
\echo ' REFERRAL V1 RLS READ-SCOPE TEST'
\echo '============================================'

-- ============================================================
-- Fixed auth identities
-- ============================================================

insert into auth.users (
  id, instance_id, aud, role, email,
  encrypted_password, email_confirmed_at,
  created_at, updated_at
)
values
(
  '11000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated',
  'rls-president@test.local', '', now(), now(), now()
),
(
  '11000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated',
  'rls-vp@test.local', '', now(), now(), now()
),
(
  '11000000-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated',
  'rls-secretary@test.local', '', now(), now(), now()
),
(
  '11000000-0000-0000-0000-000000000004',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated',
  'rls-finance@test.local', '', now(), now(), now()
),
(
  '11000000-0000-0000-0000-000000000005',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated',
  'rls-auditor@test.local', '', now(), now(), now()
),
(
  '11000000-0000-0000-0000-000000000006',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated',
  'rls-committee-a@test.local', '', now(), now(), now()
),
(
  '11000000-0000-0000-0000-000000000007',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated',
  'rls-committee-b@test.local', '', now(), now(), now()
),
(
  '11000000-0000-0000-0000-000000000008',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated',
  'rls-member@test.local', '', now(), now(), now()
),
(
  '11000000-0000-0000-0000-000000000009',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated',
  'rls-referred@test.local', '', now(), now(), now()
);

-- ============================================================
-- Application users
-- ============================================================

insert into public.application_users (
  id, auth_user_id, status
)
values
('21000000-0000-0000-0000-000000000001',
 '11000000-0000-0000-0000-000000000001', 'active'),
('21000000-0000-0000-0000-000000000002',
 '11000000-0000-0000-0000-000000000002', 'active'),
('21000000-0000-0000-0000-000000000003',
 '11000000-0000-0000-0000-000000000003', 'active'),
('21000000-0000-0000-0000-000000000004',
 '11000000-0000-0000-0000-000000000004', 'active'),
('21000000-0000-0000-0000-000000000005',
 '11000000-0000-0000-0000-000000000005', 'active'),
('21000000-0000-0000-0000-000000000006',
 '11000000-0000-0000-0000-000000000006', 'active'),
('21000000-0000-0000-0000-000000000007',
 '11000000-0000-0000-0000-000000000007', 'active'),
('21000000-0000-0000-0000-000000000008',
 '11000000-0000-0000-0000-000000000008', 'active'),
('21000000-0000-0000-0000-000000000009',
 '11000000-0000-0000-0000-000000000009', 'active');

-- ============================================================
-- Assign exact product roles
-- ============================================================

insert into public.application_user_roles (
  application_user_id,
  role_id
)
select x.application_user_id, r.id
from (
  values
    ('21000000-0000-0000-0000-000000000001'::uuid, 'president'),
    ('21000000-0000-0000-0000-000000000002'::uuid, 'vice_president'),
    ('21000000-0000-0000-0000-000000000003'::uuid, 'secretary'),
    ('21000000-0000-0000-0000-000000000004'::uuid, 'finance'),
    ('21000000-0000-0000-0000-000000000005'::uuid, 'auditor'),
    ('21000000-0000-0000-0000-000000000006'::uuid, 'committee_member'),
    ('21000000-0000-0000-0000-000000000007'::uuid, 'committee_member'),
    ('21000000-0000-0000-0000-000000000008'::uuid, 'member'),
    ('21000000-0000-0000-0000-000000000009'::uuid, 'member')
) as x(application_user_id, role_key)
join public.roles r
  on r.key = x.role_key;

-- ============================================================
-- Member profiles
-- ============================================================

insert into public.member_profiles (
  id,
  application_user_id,
  status,
  display_name
)
values
('31000000-0000-0000-0000-000000000001',
 '21000000-0000-0000-0000-000000000001',
 'active', 'RLS President'),
('31000000-0000-0000-0000-000000000002',
 '21000000-0000-0000-0000-000000000002',
 'active', 'RLS Vice President'),
('31000000-0000-0000-0000-000000000003',
 '21000000-0000-0000-0000-000000000003',
 'active', 'RLS Secretary'),
('31000000-0000-0000-0000-000000000004',
 '21000000-0000-0000-0000-000000000004',
 'active', 'RLS Finance'),
('31000000-0000-0000-0000-000000000005',
 '21000000-0000-0000-0000-000000000005',
 'active', 'RLS Auditor'),
('31000000-0000-0000-0000-000000000006',
 '21000000-0000-0000-0000-000000000006',
 'active', 'RLS Committee A'),
('31000000-0000-0000-0000-000000000007',
 '21000000-0000-0000-0000-000000000007',
 'active', 'RLS Committee B'),
('31000000-0000-0000-0000-000000000008',
 '21000000-0000-0000-0000-000000000008',
 'active', 'RLS Member'),
('31000000-0000-0000-0000-000000000009',
 '21000000-0000-0000-0000-000000000009',
 'active', 'RLS Referred Member');

-- ============================================================
-- Referral fixtures
-- PostgreSQL owner creates controlled fixtures.
-- ============================================================

insert into public.referrals (
  id,
  referral_code,
  referrer_member_profile_id,
  status
)
values
(
  '41000000-0000-0000-0000-000000000001',
  repeat('a', 64),
  '31000000-0000-0000-0000-000000000006',
  'pending'
),
(
  '41000000-0000-0000-0000-000000000002',
  repeat('b', 64),
  '31000000-0000-0000-0000-000000000007',
  'pending'
);

insert into public.referrals (
  id,
  referral_code,
  referrer_member_profile_id,
  referred_application_user_id,
  referred_member_profile_id,
  status
)
values (
  '41000000-0000-0000-0000-000000000003',
  repeat('c', 64),
  '31000000-0000-0000-0000-000000000006',
  '21000000-0000-0000-0000-000000000009',
  '31000000-0000-0000-0000-000000000009',
  'completed'
);

-- ============================================================
-- President: organization-wide
-- ============================================================

SET LOCAL ROLE authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"11000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);

DO $$
declare v_count integer;
begin
  select count(*) into v_count
  from public.referrals
  where id::text like '41000000-0000-0000-0000-%';

  if v_count <> 3 then
    raise exception 'FAIL: President saw % referrals, expected 3', v_count;
  end if;

  raise notice 'PASS: President sees organization-wide referrals';
end $$;
RESET ROLE;

-- ============================================================
-- Vice President: organization-wide
-- ============================================================

SET LOCAL ROLE authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"11000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);

DO $$
declare v_count integer;
begin
  select count(*) into v_count
  from public.referrals
  where id::text like '41000000-0000-0000-0000-%';

  if v_count <> 3 then
    raise exception 'FAIL: Vice President saw % referrals, expected 3', v_count;
  end if;

  raise notice 'PASS: Vice President sees organization-wide referrals';
end $$;
RESET ROLE;

-- ============================================================
-- Secretary: organization-wide
-- ============================================================

SET LOCAL ROLE authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"11000000-0000-0000-0000-000000000003","role":"authenticated"}',
  true
);

DO $$
declare v_count integer;
begin
  select count(*) into v_count
  from public.referrals
  where id::text like '41000000-0000-0000-0000-%';

  if v_count <> 3 then
    raise exception 'FAIL: Secretary saw % referrals, expected 3', v_count;
  end if;

  raise notice 'PASS: Secretary sees organization-wide referrals';
end $$;
RESET ROLE;

-- ============================================================
-- Committee A: own workflow only
-- Own pending + own completed = 2.
-- Must not see Committee B referral.
-- ============================================================

SET LOCAL ROLE authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"11000000-0000-0000-0000-000000000006","role":"authenticated"}',
  true
);

DO $$
declare
  v_count integer;
  v_other integer;
begin
  select count(*) into v_count
  from public.referrals
  where id::text like '41000000-0000-0000-0000-%';

  select count(*) into v_other
  from public.referrals
  where id = '41000000-0000-0000-0000-000000000002';

  if v_count <> 2 then
    raise exception 'FAIL: Committee A saw % referrals, expected 2', v_count;
  end if;

  if v_other <> 0 then
    raise exception 'FAIL: Committee A can see unrelated Committee B referral';
  end if;

  raise notice 'PASS: Committee Member sees own referral workflow only';
  raise notice 'PASS: Committee Member cannot see unrelated referral';
end $$;
RESET ROLE;

-- ============================================================
-- Committee B: own workflow only
-- ============================================================

SET LOCAL ROLE authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"11000000-0000-0000-0000-000000000007","role":"authenticated"}',
  true
);

DO $$
declare v_count integer;
begin
  select count(*) into v_count
  from public.referrals
  where id::text like '41000000-0000-0000-0000-%';

  if v_count <> 1 then
    raise exception 'FAIL: Committee B saw % referrals, expected 1', v_count;
  end if;

  raise notice 'PASS: second Committee Member sees only own referral';
end $$;
RESET ROLE;

-- ============================================================
-- Finance: no unrelated referrals
-- ============================================================

SET LOCAL ROLE authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"11000000-0000-0000-0000-000000000004","role":"authenticated"}',
  true
);

DO $$
declare v_count integer;
begin
  select count(*) into v_count
  from public.referrals
  where id::text like '41000000-0000-0000-0000-%';

  if v_count <> 0 then
    raise exception 'FAIL: Finance saw % unrelated referrals', v_count;
  end if;

  raise notice 'PASS: Finance cannot browse unrelated referrals';
end $$;
RESET ROLE;

-- ============================================================
-- Auditor: no unrelated referrals
-- ============================================================

SET LOCAL ROLE authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"11000000-0000-0000-0000-000000000005","role":"authenticated"}',
  true
);

DO $$
declare v_count integer;
begin
  select count(*) into v_count
  from public.referrals
  where id::text like '41000000-0000-0000-0000-%';

  if v_count <> 0 then
    raise exception 'FAIL: Auditor saw % unrelated referrals', v_count;
  end if;

  raise notice 'PASS: Auditor cannot browse unrelated referrals';
end $$;
RESET ROLE;

-- ============================================================
-- Ordinary Member: no unrelated referrals
-- ============================================================

SET LOCAL ROLE authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"11000000-0000-0000-0000-000000000008","role":"authenticated"}',
  true
);

DO $$
declare v_count integer;
begin
  select count(*) into v_count
  from public.referrals
  where id::text like '41000000-0000-0000-0000-%';

  if v_count <> 0 then
    raise exception 'FAIL: ordinary Member saw % unrelated referrals', v_count;
  end if;

  raise notice 'PASS: ordinary Member cannot browse unrelated referrals';
end $$;
RESET ROLE;

-- ============================================================
-- Referred Member: only own completed referral
-- ============================================================

SET LOCAL ROLE authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"11000000-0000-0000-0000-000000000009","role":"authenticated"}',
  true
);

DO $$
declare
  v_count integer;
  v_own integer;
begin
  select count(*) into v_count
  from public.referrals
  where id::text like '41000000-0000-0000-0000-%';

  select count(*) into v_own
  from public.referrals
  where id = '41000000-0000-0000-0000-000000000003';

  if v_count <> 1 then
    raise exception 'FAIL: referred Member saw % referrals, expected 1', v_count;
  end if;

  if v_own <> 1 then
    raise exception 'FAIL: referred Member cannot read own completed referral';
  end if;

  raise notice 'PASS: referred Member sees own completed referral';
  raise notice 'PASS: referred Member cannot browse unrelated referrals';
end $$;
RESET ROLE;

\echo '============================================'
\echo ' REFERRAL V1 RLS READ-SCOPE TESTS PASSED'
\echo '============================================'

ROLLBACK;
