-- Masjid-e-Mamoor
-- Migration 015: Referral / Onboarding V1 foundation
--
-- Establishes the trusted referral lifecycle:
--   pending -> completed
--   pending -> cancelled
--
-- Referral codes provide registration context only. They do not grant
-- application authorization.

begin;

-- ============================================================
-- Referral schema hardening
-- ============================================================

-- A pending referral exists before the referred person has authenticated,
-- so the original target constraint is too strict for the V1 flow.
alter table public.referrals
  drop constraint if exists referrals_target_check;

alter table public.referrals
  add constraint referrals_target_check
  check (
    (
      status = 'pending'
      and referred_application_user_id is null
      and referred_member_profile_id is null
    )
    or
    (
      status = 'completed'
      and referred_application_user_id is not null
      and referred_member_profile_id is not null
    )
    or
    (
      status = 'cancelled'
    )
  );

alter table public.referrals
  add constraint referrals_code_required_v1_chk
  check (
    referral_code is not null
    and length(btrim(referral_code)) >= 16
    and length(btrim(referral_code)) <= 128
  ) not valid;

-- Prevent one application/member identity from being successfully consumed
-- by multiple completed referrals.
create unique index if not exists referrals_completed_application_user_uidx
  on public.referrals(referred_application_user_id)
  where status = 'completed'
    and referred_application_user_id is not null;

create unique index if not exists referrals_completed_member_profile_uidx
  on public.referrals(referred_member_profile_id)
  where status = 'completed'
    and referred_member_profile_id is not null;

-- ============================================================
-- Referral operation idempotency
-- ============================================================

create table public.referral_operation_idempotency (
  operation_id text primary key,
  operation_type text not null,
  actor_application_user_id uuid
    references public.application_users(id) on delete restrict,
  referral_id uuid not null
    references public.referrals(id) on delete restrict,
  request_fingerprint text not null,
  created_at timestamptz not null default now(),

  constraint referral_operation_type_chk
    check (
      operation_type in (
        'referral_create',
        'referral_complete',
        'referral_cancel'
      )
    ),

  constraint referral_operation_id_chk
    check (
      length(btrim(operation_id)) >= 1
      and length(btrim(operation_id)) <= 200
    )
);

revoke all privileges on table public.referral_operation_idempotency
from public, anon, authenticated;

grant all privileges on table public.referral_operation_idempotency
to service_role;

-- ============================================================
-- Create referral
-- ============================================================

create or replace function public.create_referral(
  p_operation_id text
)
returns public.referrals
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_actor uuid;
  v_referrer_member_profile_id uuid;
  v_operation_id text := nullif(btrim(p_operation_id), '');
  v_fingerprint text;
  v_existing public.referral_operation_idempotency;
  v_referral public.referrals;
  v_code text;
begin
  v_actor := public.current_application_user_id();

  if v_actor is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  if not public.has_application_permission('membership.referrals.create') then
    raise exception 'missing_permission' using errcode = '42501';
  end if;

  if v_operation_id is null or length(v_operation_id) > 200 then
    raise exception 'invalid_operation_id' using errcode = '22023';
  end if;

  select mp.id
  into v_referrer_member_profile_id
  from public.member_profiles mp
  where mp.application_user_id = v_actor
    and mp.status = 'active';

  if v_referrer_member_profile_id is null then
    raise exception 'active_referrer_member_profile_required'
      using errcode = 'P0002';
  end if;

  v_fingerprint := encode(
    digest(
      jsonb_build_object(
        'referrer_member_profile_id',
        v_referrer_member_profile_id
      )::text,
      'sha256'
    ),
    'hex'
  );

  select *
  into v_existing
  from public.referral_operation_idempotency
  where operation_id = v_operation_id;

  if found then
    if v_existing.operation_type <> 'referral_create'
       or v_existing.actor_application_user_id is distinct from v_actor
       or v_existing.request_fingerprint <> v_fingerprint then
      raise exception 'operation_id_conflict' using errcode = '23505';
    end if;

    select *
    into v_referral
    from public.referrals
    where id = v_existing.referral_id;

    return v_referral;
  end if;

  -- 32 random bytes represented as hex gives a high-entropy opaque
  -- registration code. It is context, not authorization.
  loop
    v_code := encode(gen_random_bytes(32), 'hex');

    begin
      insert into public.referrals (
        referral_code,
        referrer_member_profile_id,
        status
      )
      values (
        v_code,
        v_referrer_member_profile_id,
        'pending'
      )
      returning * into v_referral;

      exit;
    exception
      when unique_violation then
        -- An astronomically unlikely referral-code collision is retried.
        null;
    end;
  end loop;

  insert into public.referral_operation_idempotency (
    operation_id,
    operation_type,
    actor_application_user_id,
    referral_id,
    request_fingerprint
  )
  values (
    v_operation_id,
    'referral_create',
    v_actor,
    v_referral.id,
    v_fingerprint
  );

  return v_referral;
end;
$$;

-- ============================================================
-- Complete referral after authentication
-- ============================================================

create or replace function public.complete_referral_registration(
  p_referral_code text,
  p_display_name text,
  p_phone text,
  p_operation_id text
)
returns public.referrals
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_auth_user_id uuid;
  v_application_user public.application_users;
  v_member public.member_profiles;
  v_member_role_id uuid;
  v_referral public.referrals;
  v_existing public.referral_operation_idempotency;
  v_code text := nullif(btrim(p_referral_code), '');
  v_display_name text := nullif(btrim(p_display_name), '');
  v_phone text := nullif(btrim(p_phone), '');
  v_operation_id text := nullif(btrim(p_operation_id), '');
  v_fingerprint text;
begin
  v_auth_user_id := auth.uid();

  if v_auth_user_id is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  if v_code is null then
    raise exception 'invalid_referral_code' using errcode = '22023';
  end if;

  if v_display_name is null or length(v_display_name) > 120 then
    raise exception 'invalid_display_name' using errcode = '22023';
  end if;

  if v_phone is not null
     and v_phone !~ '^\+[1-9][0-9]{7,14}$' then
    raise exception 'invalid_phone' using errcode = '22023';
  end if;

  if v_operation_id is null or length(v_operation_id) > 200 then
    raise exception 'invalid_operation_id' using errcode = '22023';
  end if;

  select *
  into v_referral
  from public.referrals
  where referral_code = v_code
  for update;

  if not found then
    raise exception 'invalid_referral' using errcode = 'P0002';
  end if;

  v_fingerprint := encode(
    digest(
      jsonb_build_object(
        'referral_id', v_referral.id,
        'auth_user_id', v_auth_user_id,
        'display_name', v_display_name,
        'phone', v_phone
      )::text,
      'sha256'
    ),
    'hex'
  );

  select *
  into v_existing
  from public.referral_operation_idempotency
  where operation_id = v_operation_id;

  if found then
    if v_existing.operation_type <> 'referral_complete'
       or v_existing.referral_id <> v_referral.id
       or v_existing.request_fingerprint <> v_fingerprint then
      raise exception 'operation_id_conflict' using errcode = '23505';
    end if;

    select *
    into v_referral
    from public.referrals
    where id = v_existing.referral_id;

    return v_referral;
  end if;

  if v_referral.status <> 'pending' then
    raise exception 'referral_not_pending' using errcode = '23505';
  end if;

  select *
  into v_application_user
  from public.application_users
  where auth_user_id = v_auth_user_id
  for update;

  if not found then
    insert into public.application_users (
      auth_user_id,
      status
    )
    values (
      v_auth_user_id,
      'pending'
    )
    returning * into v_application_user;
  end if;

  if v_application_user.status = 'deactivated' then
    raise exception 'application_user_deactivated' using errcode = '42501';
  end if;

  select r.id
  into v_member_role_id
  from public.roles r
  where r.key = 'member';

  if v_member_role_id is null then
    raise exception 'member_role_not_found' using errcode = 'P0002';
  end if;

  if exists (
    select 1
    from public.application_user_roles aur
    join public.roles r on r.id = aur.role_id
    where aur.application_user_id = v_application_user.id
      and r.key <> 'member'
  ) then
    raise exception 'existing_elevated_role'
      using errcode = '42501';
  end if;

  insert into public.application_user_roles (
    application_user_id,
    role_id
  )
  values (
    v_application_user.id,
    v_member_role_id
  )
  on conflict (application_user_id) do nothing;

  select *
  into v_member
  from public.member_profiles
  where application_user_id = v_application_user.id
  for update;

  if found then
    raise exception 'member_profile_exists' using errcode = '23505';
  end if;

  insert into public.member_profiles (
    application_user_id,
    status,
    display_name,
    phone
  )
  values (
    v_application_user.id,
    'active',
    v_display_name,
    v_phone
  )
  returning * into v_member;

  insert into public.membership_history (
    member_profile_id,
    application_user_id,
    event_type,
    new_status,
    operation_id,
    reason,
    actor_application_user_id
  )
  values (
    v_member.id,
    v_application_user.id,
    'created',
    v_member.status,
    null,
    'referral_registration',
    v_application_user.id
  );

  update public.referrals
  set
    referred_application_user_id = v_application_user.id,
    referred_member_profile_id = v_member.id,
    status = 'completed'
  where id = v_referral.id
  returning * into v_referral;

  insert into public.referral_operation_idempotency (
    operation_id,
    operation_type,
    actor_application_user_id,
    referral_id,
    request_fingerprint
  )
  values (
    v_operation_id,
    'referral_complete',
    v_application_user.id,
    v_referral.id,
    v_fingerprint
  );

  return v_referral;
end;
$$;

-- ============================================================
-- Cancel own pending referral
-- ============================================================

create or replace function public.cancel_referral(
  p_referral_id uuid,
  p_operation_id text
)
returns public.referrals
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_actor uuid;
  v_actor_member_profile_id uuid;
  v_referral public.referrals;
  v_existing public.referral_operation_idempotency;
  v_operation_id text := nullif(btrim(p_operation_id), '');
  v_fingerprint text;
begin
  v_actor := public.current_application_user_id();

  if v_actor is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  if not public.has_application_permission('membership.referrals.create') then
    raise exception 'missing_permission' using errcode = '42501';
  end if;

  if v_operation_id is null or length(v_operation_id) > 200 then
    raise exception 'invalid_operation_id' using errcode = '22023';
  end if;

  select mp.id
  into v_actor_member_profile_id
  from public.member_profiles mp
  where mp.application_user_id = v_actor
    and mp.status = 'active';

  if v_actor_member_profile_id is null then
    raise exception 'active_referrer_member_profile_required'
      using errcode = 'P0002';
  end if;

  select *
  into v_referral
  from public.referrals
  where id = p_referral_id
  for update;

  if not found then
    raise exception 'referral_not_found' using errcode = 'P0002';
  end if;

  v_fingerprint := encode(
    digest(
      jsonb_build_object(
        'referral_id', p_referral_id
      )::text,
      'sha256'
    ),
    'hex'
  );

  select *
  into v_existing
  from public.referral_operation_idempotency
  where operation_id = v_operation_id;

  if found then
    if v_existing.operation_type <> 'referral_cancel'
       or v_existing.actor_application_user_id is distinct from v_actor
       or v_existing.referral_id <> p_referral_id
       or v_existing.request_fingerprint <> v_fingerprint then
      raise exception 'operation_id_conflict' using errcode = '23505';
    end if;

    select *
    into v_referral
    from public.referrals
    where id = v_existing.referral_id;

    return v_referral;
  end if;

  if v_referral.referrer_member_profile_id
       is distinct from v_actor_member_profile_id then
    raise exception 'referral_not_owned' using errcode = '42501';
  end if;

  if v_referral.status <> 'pending' then
    raise exception 'referral_not_pending' using errcode = '23505';
  end if;

  update public.referrals
  set status = 'cancelled'
  where id = p_referral_id
  returning * into v_referral;

  insert into public.referral_operation_idempotency (
    operation_id,
    operation_type,
    actor_application_user_id,
    referral_id,
    request_fingerprint
  )
  values (
    v_operation_id,
    'referral_cancel',
    v_actor,
    v_referral.id,
    v_fingerprint
  );

  return v_referral;
end;
$$;

-- ============================================================
-- Function privileges
-- ============================================================

revoke all on function public.create_referral(text)
from public, anon, authenticated;

grant execute on function public.create_referral(text)
to authenticated;

revoke all on function public.complete_referral_registration(
  text, text, text, text
)
from public, anon, authenticated;

grant execute on function public.complete_referral_registration(
  text, text, text, text
)
to authenticated;

revoke all on function public.cancel_referral(uuid, text)
from public, anon, authenticated;

grant execute on function public.cancel_referral(uuid, text)
to authenticated;

commit;
