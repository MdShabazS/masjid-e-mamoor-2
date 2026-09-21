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

-- ------------------------------------------------------------
-- Complete referral as authenticated referred person
-- ------------------------------------------------------------

RESET ROLE;

select referral_code as referral_code
from public.referrals
where referrer_member_profile_id =
  '30000000-0000-0000-0000-000000000001'
  and status = 'pending'
limit 1
\gset

SET LOCAL ROLE authenticated;

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);

select public.complete_referral_registration(
  :'referral_code',
  'Referred Person',
  '+919000000002',
  'ref-complete-core-001'
);

RESET ROLE;

-- ------------------------------------------------------------
-- Verify resulting application identity
-- ------------------------------------------------------------

DO $$
declare
  v_app_id uuid;
  v_app_status text;
  v_role_key text;
  v_member_id uuid;
  v_member_status text;
  v_display_name text;
  v_referral_status text;
  v_referral_app uuid;
  v_referral_member uuid;
begin
  select
    id,
    status
  into
    v_app_id,
    v_app_status
  from public.application_users
  where auth_user_id =
    '10000000-0000-0000-0000-000000000002';

  if v_app_id is null then
    raise exception
      'FAIL: referred application user not created';
  end if;

  if v_app_status <> 'pending' then
    raise exception
      'FAIL: expected application status pending, got %',
      v_app_status;
  end if;

  select r.key
  into v_role_key
  from public.application_user_roles aur
  join public.roles r
    on r.id = aur.role_id
  where aur.application_user_id = v_app_id;

  if v_role_key <> 'member' then
    raise exception
      'FAIL: expected member role, got %',
      v_role_key;
  end if;

  select
    id,
    status,
    display_name
  into
    v_member_id,
    v_member_status,
    v_display_name
  from public.member_profiles
  where application_user_id = v_app_id;

  if v_member_id is null then
    raise exception
      'FAIL: referred member profile not created';
  end if;

  if v_member_status <> 'active' then
    raise exception
      'FAIL: expected active member profile, got %',
      v_member_status;
  end if;

  if v_display_name <> 'Referred Person' then
    raise exception
      'FAIL: member profile display name mismatch';
  end if;

  select
    status,
    referred_application_user_id,
    referred_member_profile_id
  into
    v_referral_status,
    v_referral_app,
    v_referral_member
  from public.referrals
  where referrer_member_profile_id =
    '30000000-0000-0000-0000-000000000001';

  if v_referral_status <> 'completed' then
    raise exception
      'FAIL: expected completed referral, got %',
      v_referral_status;
  end if;

  if v_referral_app <> v_app_id then
    raise exception
      'FAIL: referral application-user linkage mismatch';
  end if;

  if v_referral_member <> v_member_id then
    raise exception
      'FAIL: referral member-profile linkage mismatch';
  end if;

  raise notice
    'PASS: referred application user created';

  raise notice
    'PASS: application user starts pending';

  raise notice
    'PASS: default member role assigned';

  raise notice
    'PASS: member profile created and linked';

  raise notice
    'PASS: referral transitioned pending -> completed';
end $$;

-- ------------------------------------------------------------
-- Completion identical replay
-- ------------------------------------------------------------

SET LOCAL ROLE authenticated;

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);

select public.complete_referral_registration(
  :'referral_code',
  'Referred Person',
  '+919000000002',
  'ref-complete-core-001'
);

RESET ROLE;

DO $$
declare
  v_app_count integer;
  v_member_count integer;
  v_referral_count integer;
  v_operation_count integer;
begin
  select count(*)
  into v_app_count
  from public.application_users
  where auth_user_id =
    '10000000-0000-0000-0000-000000000002';

  select count(*)
  into v_member_count
  from public.member_profiles mp
  join public.application_users au
    on au.id = mp.application_user_id
  where au.auth_user_id =
    '10000000-0000-0000-0000-000000000002';

  select count(*)
  into v_referral_count
  from public.referrals
  where referrer_member_profile_id =
    '30000000-0000-0000-0000-000000000001';

  select count(*)
  into v_operation_count
  from public.referral_operation_idempotency;

  if v_app_count <> 1 then
    raise exception
      'FAIL: completion replay duplicated application user';
  end if;

  if v_member_count <> 1 then
    raise exception
      'FAIL: completion replay duplicated member profile';
  end if;

  if v_referral_count <> 1 then
    raise exception
      'FAIL: completion replay duplicated referral';
  end if;

  if v_operation_count <> 2 then
    raise exception
      'FAIL: expected 2 idempotency operations, got %',
      v_operation_count;
  end if;

  raise notice
    'PASS: identical completion replay is idempotent';

  raise notice
    'PASS: exactly one application user exists';

  raise notice
    'PASS: exactly one member profile exists';

  raise notice
    'PASS: exactly one referral exists';

  raise notice
    'PASS: idempotency registry contains exactly 2 operations';
end $$;


-- ------------------------------------------------------------
-- Security / negative cases
-- ------------------------------------------------------------

\echo '--- SECURITY / NEGATIVE TESTS ---'

-- Ordinary Member must not be able to create a referral.
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
    raise exception 'FAIL: pending referred Member created referral';
  exception
    when insufficient_privilege then
      if sqlerrm <> 'missing_permission' then
        raise;
      end if;
  end;

  raise notice 'PASS: pending ordinary Member cannot create referral';
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

-- Changed payload with the same completion operation ID must conflict.
SET LOCAL ROLE authenticated;

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);

select set_config(
  'test.referral_code',
  :'referral_code',
  true
);

DO $$
declare
  v_code text := current_setting('test.referral_code');
begin
  begin
    perform public.complete_referral_registration(
      v_code,
      'Changed Referred Person',
      '+919000000002',
      'ref-complete-core-001'
    );

    raise exception 'FAIL: conflicting completion replay accepted';
  exception
    when unique_violation then
      if sqlerrm <> 'operation_id_conflict' then
        raise;
      end if;
  end;

  raise notice 'PASS: conflicting completion replay rejected';
end $$;

-- A completed referral cannot be consumed again under a new operation ID.
select set_config(
  'test.referral_code',
  :'referral_code',
  true
);

DO $$
declare
  v_code text := current_setting('test.referral_code');
begin
  begin
    perform public.complete_referral_registration(
      v_code,
      'Referred Person',
      '+919000000002',
      'ref-complete-second-operation'
    );

    raise exception 'FAIL: completed referral consumed twice';
  exception
    when unique_violation then
      if sqlerrm <> 'referral_not_pending' then
        raise;
      end if;
  end;

  raise notice 'PASS: duplicate referral consumption rejected';
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

-- A completed referral cannot be cancelled.
SET LOCAL ROLE authenticated;

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);

DO $$
declare
  v_completed_id uuid;
begin
  select id
  into v_completed_id
  from public.referrals
  where referrer_member_profile_id =
    '30000000-0000-0000-0000-000000000001'
    and status = 'completed'
  limit 1;

  begin
    perform public.cancel_referral(
      v_completed_id,
      'ref-cancel-completed-001'
    );

    raise exception 'FAIL: completed referral cancellation succeeded';
  exception
    when unique_violation then
      if sqlerrm <> 'referral_not_pending' then
        raise;
      end if;
  end;

  raise notice 'PASS: completed referral cancellation rejected';
end $$;

RESET ROLE;

\echo '============================================'
\echo ' ALL REFERRAL V1 BEHAVIORAL TESTS PASSED'
\echo '============================================'

ROLLBACK;
