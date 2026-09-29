begin;

-- Referral + Member Onboarding V1 closure
--
-- V1 is a closed-system onboarding flow:
--   1. An active member creates a one-use opaque referral code.
--   2. A public applicant submits name/contact information against that code.
--   3. President/System Admin reviews the request.
--   4. Account Administration provisions the application account as role=member.
--
-- Referral codes are context, not authorization. Public functions below expose
-- only narrow safe state and never create Auth/application accounts.

alter table public.referrals
  add column if not exists applicant_display_name text,
  add column if not exists applicant_phone text,
  add column if not exists submitted_at timestamptz,
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by_application_user_id uuid
    references public.application_users(id) on delete restrict,
  add column if not exists review_reason text,
  add column if not exists completed_at timestamptz,
  add column if not exists completed_by_application_user_id uuid
    references public.application_users(id) on delete restrict;

alter table public.referrals
  drop constraint if exists referrals_status_check;

alter table public.referrals
  add constraint referrals_status_check
  check (
    status in (
      'pending',
      'submitted',
      'approved',
      'rejected',
      'completed',
      'cancelled'
    )
  );

alter table public.referrals
  drop constraint if exists referrals_target_check;

alter table public.referrals
  add constraint referrals_target_check
  check (
    (
      status = 'pending'
      and referred_application_user_id is null
      and referred_member_profile_id is null
      and applicant_display_name is null
      and applicant_phone is null
    )
    or (
      status = 'submitted'
      and referred_application_user_id is null
      and referred_member_profile_id is null
      and applicant_display_name is not null
      and applicant_phone is not null
    )
    or (
      status = 'approved'
      and referred_application_user_id is null
      and referred_member_profile_id is null
      and applicant_display_name is not null
      and applicant_phone is not null
      and reviewed_by_application_user_id is not null
      and reviewed_at is not null
    )
    or (
      status = 'rejected'
      and referred_application_user_id is null
      and referred_member_profile_id is null
      and applicant_display_name is not null
      and applicant_phone is not null
      and reviewed_by_application_user_id is not null
      and reviewed_at is not null
    )
    or (
      status = 'completed'
      and referred_application_user_id is not null
      and referred_member_profile_id is not null
      and (
        (
          completed_by_application_user_id is null
          and completed_at is null
        )
        or (
          completed_by_application_user_id is not null
          and completed_at is not null
        )
      )
    )
    or status = 'cancelled'
  );

alter table public.referrals
  drop constraint if exists referrals_applicant_display_name_chk;

alter table public.referrals
  add constraint referrals_applicant_display_name_chk
  check (
    applicant_display_name is null
    or (
      length(btrim(applicant_display_name)) >= 1
      and length(btrim(applicant_display_name)) <= 120
    )
  );

alter table public.referrals
  drop constraint if exists referrals_applicant_phone_chk;

alter table public.referrals
  add constraint referrals_applicant_phone_chk
  check (
    applicant_phone is null
    or applicant_phone ~ '^\+[1-9][0-9]{7,14}$'
  );

alter table public.referrals
  drop constraint if exists referrals_review_reason_chk;

alter table public.referrals
  add constraint referrals_review_reason_chk
  check (
    review_reason is null
    or length(btrim(review_reason)) <= 500
  );

create index if not exists referrals_applicant_phone_idx
  on public.referrals(applicant_phone)
  where applicant_phone is not null;

create unique index if not exists referrals_active_applicant_phone_uidx
  on public.referrals(applicant_phone)
  where applicant_phone is not null
    and status in ('submitted', 'approved', 'completed');

alter table public.referral_operation_idempotency
  drop constraint if exists referral_operation_type_chk;

alter table public.referral_operation_idempotency
  add constraint referral_operation_type_chk
  check (
    operation_type in (
      'referral_create',
      'referral_submit',
      'referral_approve',
      'referral_reject',
      'referral_complete',
      'referral_cancel'
    )
  );

-- Referral V1 is member-facing: active Members may create referral
-- onboarding links, while review/provisioning remains administrative.
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p
  on p.key = 'membership.referrals.create'
where r.key = 'member'
on conflict do nothing;

create table if not exists public.referral_audit_events (
  id uuid primary key default gen_random_uuid(),
  referral_id uuid not null
    references public.referrals(id) on delete restrict,
  actor_application_user_id uuid
    references public.application_users(id) on delete restrict,
  event_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),

  constraint referral_audit_event_type_chk
  check (
    event_type in (
      'referral.created',
      'referral.submitted',
      'referral.approved',
      'referral.rejected',
      'referral.completed'
    )
  ),

  constraint referral_audit_metadata_object_chk
  check (jsonb_typeof(metadata) = 'object')
);

alter table public.referral_audit_events enable row level security;

revoke all privileges on table public.referral_audit_events
from public, anon, authenticated;

grant select on table public.referral_audit_events to authenticated;
grant all privileges on table public.referral_audit_events to service_role;

drop policy if exists referral_audit_administrative_read
on public.referral_audit_events;

create policy referral_audit_administrative_read
on public.referral_audit_events
for select
to authenticated
using (
  public.current_application_role() in ('president', 'system_admin')
);

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

  insert into public.referral_audit_events (
    referral_id,
    actor_application_user_id,
    event_type,
    metadata
  )
  values (
    v_referral.id,
    v_actor,
    'referral.created',
    '{}'::jsonb
  );

  return v_referral;
end;
$$;

create or replace function public.complete_referral_registration(
  p_referral_code text,
  p_display_name text,
  p_phone text,
  p_operation_id text
)
returns public.referrals
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception 'referral_registration_closed'
    using errcode = '42501';
end;
$$;

create or replace function public.validate_referral_code(
  p_referral_code text
)
returns table (
  valid boolean,
  status text,
  referrer_display_name text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text := nullif(btrim(p_referral_code), '');
  v_referral record;
begin
  if v_code is null or length(v_code) < 16 or length(v_code) > 128 then
    return query select false, 'invalid'::text, null::text;
    return;
  end if;

  select
    r.status,
    mp.display_name
  into v_referral
  from public.referrals r
  join public.member_profiles mp
    on mp.id = r.referrer_member_profile_id
  where r.referral_code = v_code;

  if not found then
    return query select false, 'invalid'::text, null::text;
    return;
  end if;

  if v_referral.status = 'pending' then
    return query
    select true, 'valid'::text, v_referral.display_name::text;
    return;
  end if;

  return query
  select false, v_referral.status::text, null::text;
end;
$$;

create or replace function public.submit_referral_onboarding(
  p_referral_code text,
  p_display_name text,
  p_phone text,
  p_operation_id text
)
returns table (
  status text
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_code text := nullif(btrim(p_referral_code), '');
  v_display_name text := nullif(btrim(p_display_name), '');
  v_phone text := nullif(btrim(p_phone), '');
  v_operation_id text := nullif(btrim(p_operation_id), '');
  v_referral public.referrals;
  v_existing public.referral_operation_idempotency;
  v_fingerprint text;
begin
  if v_code is null or length(v_code) < 16 or length(v_code) > 128 then
    raise exception 'invalid_referral_code' using errcode = '22023';
  end if;

  if v_display_name is null or length(v_display_name) > 120 then
    raise exception 'invalid_display_name' using errcode = '22023';
  end if;

  if v_phone is null or v_phone !~ '^\+[1-9][0-9]{7,14}$' then
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
    if v_existing.operation_type <> 'referral_submit'
       or v_existing.referral_id <> v_referral.id
       or v_existing.request_fingerprint <> v_fingerprint then
      raise exception 'operation_id_conflict' using errcode = '23505';
    end if;

    return query select 'submitted'::text;
    return;
  end if;

  if v_referral.status <> 'pending' then
    raise exception 'referral_not_available' using errcode = '23505';
  end if;

  if exists (
    select 1
    from public.member_profiles mp
    where mp.phone = v_phone
      and mp.status = 'active'
  ) then
    raise exception 'phone_already_member' using errcode = '23505';
  end if;

  if exists (
    select 1
    from public.referrals r
    where r.id <> v_referral.id
      and r.applicant_phone = v_phone
      and r.status in ('submitted', 'approved', 'completed')
  ) then
    raise exception 'duplicate_onboarding_phone' using errcode = '23505';
  end if;

  update public.referrals
  set
    applicant_display_name = v_display_name,
    applicant_phone = v_phone,
    submitted_at = now(),
    status = 'submitted'
  where id = v_referral.id;

  insert into public.referral_operation_idempotency (
    operation_id,
    operation_type,
    actor_application_user_id,
    referral_id,
    request_fingerprint
  )
  values (
    v_operation_id,
    'referral_submit',
    null,
    v_referral.id,
    v_fingerprint
  );

  insert into public.referral_audit_events (
    referral_id,
    actor_application_user_id,
    event_type,
    metadata
  )
  values (
    v_referral.id,
    null,
    'referral.submitted',
    '{}'::jsonb
  );

  return query select 'submitted'::text;
end;
$$;

create or replace function public.admin_approve_referral(
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
  v_operation_id text := nullif(btrim(p_operation_id), '');
  v_referral public.referrals;
  v_existing public.referral_operation_idempotency;
  v_fingerprint text;
begin
  v_actor := public.current_application_user_id();

  if v_actor is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  if public.current_application_role() not in ('president', 'system_admin') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  if v_operation_id is null or length(v_operation_id) > 200 then
    raise exception 'invalid_operation_id' using errcode = '22023';
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
    digest(jsonb_build_object('referral_id', p_referral_id)::text, 'sha256'),
    'hex'
  );

  select *
  into v_existing
  from public.referral_operation_idempotency
  where operation_id = v_operation_id;

  if found then
    if v_existing.operation_type <> 'referral_approve'
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

  if v_referral.status <> 'submitted' then
    raise exception 'referral_not_submitted' using errcode = '23505';
  end if;

  update public.referrals
  set
    status = 'approved',
    reviewed_by_application_user_id = v_actor,
    reviewed_at = now(),
    review_reason = null
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
    'referral_approve',
    v_actor,
    v_referral.id,
    v_fingerprint
  );

  insert into public.referral_audit_events (
    referral_id,
    actor_application_user_id,
    event_type,
    metadata
  )
  values (
    v_referral.id,
    v_actor,
    'referral.approved',
    '{}'::jsonb
  );

  return v_referral;
end;
$$;

create or replace function public.admin_reject_referral(
  p_referral_id uuid,
  p_reason text,
  p_operation_id text
)
returns public.referrals
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_actor uuid;
  v_reason text := nullif(btrim(p_reason), '');
  v_operation_id text := nullif(btrim(p_operation_id), '');
  v_referral public.referrals;
  v_existing public.referral_operation_idempotency;
  v_fingerprint text;
begin
  v_actor := public.current_application_user_id();

  if v_actor is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  if public.current_application_role() not in ('president', 'system_admin') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  if v_operation_id is null or length(v_operation_id) > 200 then
    raise exception 'invalid_operation_id' using errcode = '22023';
  end if;

  if v_reason is not null and length(v_reason) > 500 then
    raise exception 'invalid_reason' using errcode = '22023';
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
        'referral_id', p_referral_id,
        'reason', v_reason
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
    if v_existing.operation_type <> 'referral_reject'
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

  if v_referral.status <> 'submitted' then
    raise exception 'referral_not_submitted' using errcode = '23505';
  end if;

  update public.referrals
  set
    status = 'rejected',
    reviewed_by_application_user_id = v_actor,
    reviewed_at = now(),
    review_reason = v_reason
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
    'referral_reject',
    v_actor,
    v_referral.id,
    v_fingerprint
  );

  insert into public.referral_audit_events (
    referral_id,
    actor_application_user_id,
    event_type,
    metadata
  )
  values (
    v_referral.id,
    v_actor,
    'referral.rejected',
    jsonb_build_object('reason_provided', v_reason is not null)
  );

  return v_referral;
end;
$$;

revoke all on function public.create_referral(text)
from public, anon, authenticated;

grant execute on function public.create_referral(text)
to authenticated;

revoke all on function public.complete_referral_registration(
  text, text, text, text
)
from public, anon, authenticated;

revoke all on function public.validate_referral_code(text)
from public, anon, authenticated;

grant execute on function public.validate_referral_code(text)
to anon, authenticated;

revoke all on function public.submit_referral_onboarding(
  text, text, text, text
)
from public, anon, authenticated;

grant execute on function public.submit_referral_onboarding(
  text, text, text, text
)
to anon, authenticated;

revoke all on function public.admin_approve_referral(uuid, text)
from public, anon, authenticated;

grant execute on function public.admin_approve_referral(uuid, text)
to authenticated;

revoke all on function public.admin_reject_referral(uuid, text, text)
from public, anon, authenticated;

grant execute on function public.admin_reject_referral(uuid, text, text)
to authenticated;

commit;
