-- Member domain foundation
-- Implements only the approved V1 member/referral requirements.
-- Referral expiration/lifecycle semantics remain intentionally unspecified.

begin;

-- ============================================================
-- Membership history
-- ============================================================

create table public.membership_history (
  id uuid primary key default gen_random_uuid(),
  member_profile_id uuid not null
    references public.member_profiles(id) on delete restrict,
  application_user_id uuid
    references public.application_users(id) on delete restrict,
  event_type text not null,
  previous_status text,
  new_status text,
  changed_fields jsonb,
  operation_id text,
  reason text,
  actor_application_user_id uuid
    references public.application_users(id) on delete restrict,
  created_at timestamptz not null default now(),

  constraint membership_history_event_type_check
    check (
      event_type in (
        'created',
        'activated',
        'deactivated',
        'profile_updated',
        'status_changed'
      )
    )
);

create index membership_history_member_idx
  on public.membership_history(member_profile_id, created_at desc);

create index membership_history_actor_idx
  on public.membership_history(actor_application_user_id, created_at desc);

create unique index membership_history_operation_uidx
  on public.membership_history(operation_id)
  where operation_id is not null;


-- ============================================================
-- Referrals
-- ============================================================

create table public.referrals (
  id uuid primary key default gen_random_uuid(),
  referral_code text,
  referrer_member_profile_id uuid
    references public.member_profiles(id) on delete restrict,
  referred_application_user_id uuid
    references public.application_users(id) on delete restrict,
  referred_member_profile_id uuid
    references public.member_profiles(id) on delete restrict,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint referrals_status_check
    check (
      status in (
        'pending',
        'completed',
        'cancelled'
      )
    ),

  constraint referrals_target_check
    check (
      referred_application_user_id is not null
      or referred_member_profile_id is not null
    )
);

create unique index referrals_code_uidx
  on public.referrals(referral_code)
  where referral_code is not null;

create index referrals_referrer_idx
  on public.referrals(referrer_member_profile_id, created_at desc);

create index referrals_referred_user_idx
  on public.referrals(referred_application_user_id);

create index referrals_referred_member_idx
  on public.referrals(referred_member_profile_id);

create index referrals_status_idx
  on public.referrals(status, created_at desc);


-- ============================================================
-- Updated-at helper
-- ============================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists referrals_set_updated_at on public.referrals;

create trigger referrals_set_updated_at
before update on public.referrals
for each row
execute function public.set_updated_at();


-- ============================================================
-- RLS
-- ============================================================

alter table public.membership_history enable row level security;
alter table public.referrals enable row level security;


-- Members can read their own history.
create policy membership_history_self_read
on public.membership_history
for select
to authenticated
using (
  member_profile_id in (
    select mp.id
    from public.member_profiles mp
    where mp.application_user_id =
      public.current_application_user_id()
  )
);


-- Authorized lifecycle readers can read membership history.
create policy membership_history_authorized_read
on public.membership_history
for select
to authenticated
using (
  public.has_application_permission('membership.lifecycle.read')
);


-- Authorized member readers can read referrals.
create policy referrals_authorized_read
on public.referrals
for select
to authenticated
using (
  public.has_application_permission('membership.members.read')
  or public.has_application_permission('membership.referrals.create')
);


-- Referrer may see their own referral records.
create policy referrals_referrer_read
on public.referrals
for select
to authenticated
using (
  referrer_member_profile_id in (
    select mp.id
    from public.member_profiles mp
    where mp.application_user_id =
      public.current_application_user_id()
  )
);


-- No direct client INSERT/UPDATE/DELETE policies are created.
-- Referral creation and member mutations must go through trusted
-- server-side operations which re-check authorization and invariants.


-- ============================================================
-- Controlled member profile update
-- ============================================================

create or replace function public.update_own_member_profile(
  p_display_name text,
  p_phone text,
  p_operation_id text default null
)
returns public.member_profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_application_user_id uuid;
  v_member public.member_profiles;
  v_old_display_name text;
  v_old_phone text;
  v_changed_fields jsonb := '{}'::jsonb;
begin
  v_application_user_id := public.current_application_user_id();

  if v_application_user_id is null then
    raise exception 'Authenticated application user required';
  end if;

  select mp.display_name, mp.phone
  into v_old_display_name, v_old_phone
  from public.member_profiles mp
  where mp.application_user_id = v_application_user_id
  for update;

  if not found then
    raise exception 'Member profile not found';
  end if;

  if p_display_name is distinct from v_old_display_name then
    v_changed_fields :=
      v_changed_fields || jsonb_build_object(
        'display_name',
        jsonb_build_object(
          'before', v_old_display_name,
          'after', p_display_name
        )
      );
  end if;

  if p_phone is distinct from v_old_phone then
    v_changed_fields :=
      v_changed_fields || jsonb_build_object(
        'phone',
        jsonb_build_object(
          'before', v_old_phone,
          'after', p_phone
        )
      );
  end if;

  update public.member_profiles
  set
    display_name = p_display_name,
    phone = p_phone,
    updated_at = now()
  where application_user_id = v_application_user_id
  returning * into v_member;

  if v_changed_fields <> '{}'::jsonb then
    insert into public.membership_history (
      member_profile_id,
      application_user_id,
      event_type,
      changed_fields,
      operation_id,
      actor_application_user_id
    )
    values (
      v_member.id,
      v_application_user_id,
      'profile_updated',
      v_changed_fields,
      p_operation_id,
      v_application_user_id
    );
  end if;

  return v_member;
end;
$$;

revoke all on function public.update_own_member_profile(text, text, text)
from public;

grant execute on function public.update_own_member_profile(text, text, text)
to authenticated;


commit;
