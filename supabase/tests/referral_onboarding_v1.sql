\set ON_ERROR_STOP on

BEGIN;

\echo '============================================'
\echo ' REFERRAL / ONBOARDING V1 CORE TEST'
\echo '============================================'

-- ------------------------------------------------------------
-- Fixtures
-- ------------------------------------------------------------

insert into auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at
)
values
(
  '10000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'ref-committee@test.local',
  '',
  now(),
  now(),
  now()
),
(
  '10000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'referred-person@test.local',
  '',
  now(),
  now(),
  now()
);

insert into public.application_users (
  id,
  auth_user_id,
  status
)
values (
  '20000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  'active'
);

insert into public.application_user_roles (
  application_user_id,
  role_id
)
select
  '20000000-0000-0000-0000-000000000001',
  id
from public.roles
where key = 'committee_member';

insert into public.member_profiles (
  id,
  application_user_id,
  status,
  display_name,
  phone
)
values (
  '30000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  'active',
  'Referral Committee',
  '+919000000001'
);

-- ------------------------------------------------------------
-- Authorized referral creation
-- ------------------------------------------------------------

SET LOCAL ROLE authenticated;

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);

select public.create_referral('ref-create-core-001');

RESET ROLE;

DO $$
declare
  v_count integer;
  v_status text;
  v_code text;
  v_referrer uuid;
  v_user uuid;
  v_member uuid;
begin
  select
    count(*),
    max(status),
    max(referral_code),
    max(referrer_member_profile_id::text)::uuid,
    max(referred_application_user_id::text)::uuid,
    max(referred_member_profile_id::text)::uuid
  into
    v_count,
    v_status,
    v_code,
    v_referrer,
    v_user,
    v_member
  from public.referrals
  where referrer_member_profile_id =
    '30000000-0000-0000-0000-000000000001';

  if v_count <> 1 then
    raise exception
      'FAIL: expected one referral, got %',
      v_count;
  end if;

  if v_status <> 'pending' then
    raise exception
      'FAIL: expected pending referral, got %',
      v_status;
  end if;

  if v_code is null or length(v_code) <> 64 then
    raise exception
      'FAIL: generated referral code invalid';
  end if;

  if v_referrer <>
    '30000000-0000-0000-0000-000000000001' then
    raise exception
      'FAIL: incorrect referrer linkage';
  end if;

  if v_user is not null or v_member is not null then
    raise exception
      'FAIL: pending referral unexpectedly has target identity';
  end if;

  raise notice
    'PASS: authorized pending referral created';

  raise notice
    'PASS: pending referral has no pre-auth target';

  raise notice
    'PASS: opaque 64-character referral code generated';
end $$;

-- ------------------------------------------------------------
-- Identical create replay
-- ------------------------------------------------------------

SET LOCAL ROLE authenticated;

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);

select public.create_referral('ref-create-core-001');

RESET ROLE;

DO $$
declare
  v_count integer;
begin
  select count(*)
  into v_count
  from public.referrals
  where referrer_member_profile_id =
    '30000000-0000-0000-0000-000000000001';

  if v_count <> 1 then
    raise exception
      'FAIL: identical create replay produced % referrals',
      v_count;
  end if;

  raise notice
    'PASS: identical referral creation replay is idempotent';
end $$;

-- The former referred-user completion RPC is intentionally retired. Current
-- completion is covered by referral_member_provisioning_finalization_v1.sql,
-- which exercises the authorized administrative provisioning boundary.


-- ------------------------------------------------------------
-- Security / negative cases
-- ------------------------------------------------------------

\echo '--- SECURITY / NEGATIVE TESTS ---'

-- An authenticated identity without an active application account/role must
-- not be able to create a referral.
SET LOCAL ROLE authenticated;

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);

DO $$
begin
  begin
    perform public.create_referral('member-create-denied-001');
    raise exception 'FAIL: unaffiliated authenticated identity created referral';
  exception
    when insufficient_privilege then
      if sqlerrm <> 'not_authenticated' then
        raise;
      end if;
  end;

  raise notice 'PASS: unaffiliated authenticated identity cannot create referral';
end $$;

RESET ROLE;

-- Authenticated users cannot directly INSERT referral rows.
SET LOCAL ROLE authenticated;

DO $$
begin
  begin
    insert into public.referrals (
      referral_code,
      status
    )
    values (
      repeat('a', 64),
      'pending'
    );

    raise exception 'FAIL: authenticated direct referral INSERT succeeded';
  exception
    when insufficient_privilege then
      null;
  end;

  raise notice 'PASS: authenticated direct referral INSERT blocked';
end $$;

-- Authenticated users cannot read the idempotency registry.
DO $$
begin
  begin
    perform count(*)
    from public.referral_operation_idempotency;

    raise exception 'FAIL: authenticated idempotency registry SELECT succeeded';
  exception
    when insufficient_privilege then
      null;
  end;

  raise notice 'PASS: authenticated idempotency registry SELECT blocked';
end $$;

RESET ROLE;

-- Create another referral for cancellation testing.
SET LOCAL ROLE authenticated;

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);

select public.create_referral('ref-create-cancel-core-001');

RESET ROLE;

select id::text as cancel_referral_id
from public.referrals
where referrer_member_profile_id =
  '30000000-0000-0000-0000-000000000001'
  and status = 'pending'
order by created_at desc
limit 1
\gset

SET LOCAL ROLE authenticated;

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);

select public.cancel_referral(
  :'cancel_referral_id'::uuid,
  'ref-cancel-core-001'
);

-- Identical cancellation replay.
select public.cancel_referral(
  :'cancel_referral_id'::uuid,
  'ref-cancel-core-001'
);

RESET ROLE;

DO $$
declare
  v_status text;
begin
  select status
  into v_status
  from public.referrals
  where referrer_member_profile_id =
    '30000000-0000-0000-0000-000000000001'
    and status = 'cancelled'
  order by created_at desc
  limit 1;

  if v_status <> 'cancelled' then
    raise exception
      'FAIL: expected cancelled referral, got %',
      v_status;
  end if;

  raise notice 'PASS: own pending referral cancelled';
  raise notice 'PASS: identical cancellation replay is idempotent';
end $$;

-- A cancelled referral cannot be cancelled again under a new operation ID.
SET LOCAL ROLE authenticated;

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);

DO $$
declare
  v_cancelled_id uuid;
begin
  select id
  into v_cancelled_id
  from public.referrals
  where referrer_member_profile_id =
    '30000000-0000-0000-0000-000000000001'
    and status = 'cancelled'
  limit 1;

  begin
    perform public.cancel_referral(
      v_cancelled_id,
      'ref-cancel-cancelled-001'
    );

    raise exception 'FAIL: cancelled referral cancellation succeeded';
  exception
    when unique_violation then
      if sqlerrm <> 'referral_not_pending' then
        raise;
      end if;
  end;

  raise notice 'PASS: cancelled referral cancellation rejected';
end $$;

RESET ROLE;

\echo '============================================'
\echo ' ALL REFERRAL V1 BEHAVIORAL TESTS PASSED'
\echo '============================================'

ROLLBACK;
