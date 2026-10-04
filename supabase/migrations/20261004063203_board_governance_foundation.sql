-- Masjid-e-Mamoor 2
-- Phase 6B-1: Board governance foundation and Finance task eligibility.
--
-- Board designations describe organizational appointments. They do not replace
-- or mutate the application's authorization roles.

begin;

-- ---------------------------------------------------------------------------
-- Stable permissions and narrowly-scoped role grants.
-- ---------------------------------------------------------------------------

insert into public.permissions (key, name, description)
values
  (
    'committee.board.read',
    'Committee / Board / Read',
    'Read the current and historical Board of Trustees directory'
  ),
  (
    'committee.board.manage',
    'Committee / Board / Manage',
    'Manage Board of Trustees appointments through trusted operations'
  )
on conflict (key) do update
set name = excluded.name,
    description = excluded.description;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from (
  values
    ('president', 'committee.board.read'),
    ('vice_president', 'committee.board.read'),
    ('secretary', 'committee.board.read'),
    ('finance', 'committee.board.read'),
    ('auditor', 'committee.board.read'),
    ('committee_member', 'committee.board.read'),
    ('member', 'committee.board.read'),
    ('president', 'committee.board.manage'),
    ('finance', 'committee.tasks.read'),
    ('finance', 'committee.tasks.manage')
) grants(role_key, permission_key)
join public.roles r on r.key = grants.role_key
join public.permissions p on p.key = grants.permission_key
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Append-oriented Board appointment and audit model.
-- ---------------------------------------------------------------------------

create table public.board_appointments (
  id uuid primary key default gen_random_uuid(),
  application_user_id uuid not null
    references public.application_users(id) on delete restrict,
  designation text not null,
  status text not null default 'active',
  appointed_on date,
  ended_on date,
  created_by_application_user_id uuid not null
    references public.application_users(id) on delete restrict,
  ended_by_application_user_id uuid
    references public.application_users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint board_appointments_designation_chk check (
    designation in (
      'president',
      'vice_president',
      'secretary',
      'joint_secretary',
      'treasurer',
      'joint_treasurer',
      'trustee'
    )
  ),
  constraint board_appointments_status_chk check (
    status in ('active', 'ended')
  ),
  constraint board_appointments_lifecycle_chk check (
    (
      status = 'active'
      and ended_on is null
      and ended_by_application_user_id is null
    )
    or
    (
      status = 'ended'
      and ended_on is not null
      and ended_by_application_user_id is not null
    )
  ),
  constraint board_appointments_date_order_chk check (
    appointed_on is null
    or ended_on is null
    or ended_on >= appointed_on
  )
);

create unique index board_appointments_one_active_per_user_uidx
  on public.board_appointments(application_user_id)
  where status = 'active';

create unique index board_appointments_exclusive_designation_uidx
  on public.board_appointments(designation)
  where status = 'active'
    and designation in (
      'president',
      'vice_president',
      'secretary',
      'joint_secretary',
      'treasurer',
      'joint_treasurer'
    );

create index board_appointments_history_idx
  on public.board_appointments(application_user_id, created_at desc, id desc);

create table public.board_appointment_activity (
  id uuid primary key default gen_random_uuid(),
  board_appointment_id uuid not null
    references public.board_appointments(id) on delete restrict,
  actor_application_user_id uuid not null
    references public.application_users(id) on delete restrict,
  activity_type text not null,
  operation_id text not null,
  request_fingerprint text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),

  constraint board_appointment_activity_type_chk check (
    activity_type in (
      'board_member_appointed',
      'board_designation_changed',
      'board_appointment_ended'
    )
  ),
  constraint board_appointment_activity_operation_id_chk check (
    length(btrim(operation_id)) between 1 and 200
  ),
  constraint board_appointment_activity_fingerprint_chk check (
    request_fingerprint ~ '^[0-9a-f]{64}$'
  ),
  constraint board_appointment_activity_details_chk check (
    jsonb_typeof(details) = 'object'
  )
);

create unique index board_appointment_activity_actor_operation_uidx
  on public.board_appointment_activity(
    actor_application_user_id,
    operation_id
  );

create index board_appointment_activity_appointment_idx
  on public.board_appointment_activity(
    board_appointment_id,
    created_at,
    id
  );

create trigger board_appointments_set_updated_at
before update on public.board_appointments
for each row execute function public.set_updated_at();

create or replace function public.reject_board_appointment_delete()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  raise exception 'board_history_immutable' using errcode = '55000';
end;
$$;

create trigger board_appointments_reject_delete
before delete on public.board_appointments
for each row execute function public.reject_board_appointment_delete();

create or replace function public.reject_board_activity_change()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  raise exception 'board_activity_immutable' using errcode = '55000';
end;
$$;

create trigger board_appointment_activity_reject_change
before update or delete on public.board_appointment_activity
for each row execute function public.reject_board_activity_change();

alter table public.board_appointments enable row level security;
alter table public.board_appointment_activity enable row level security;

create policy board_appointments_authorized_read
on public.board_appointments
for select
to authenticated
using (public.has_application_permission('committee.board.read'));

revoke all privileges on table public.board_appointments
from public, anon, authenticated;
revoke all privileges on table public.board_appointment_activity
from public, anon, authenticated;


-- ---------------------------------------------------------------------------
-- Internal actor lock. Board mutations lock the active caller and current role
-- before checking permissions so role/status revocation has a transactional
-- authorization boundary.
-- ---------------------------------------------------------------------------

create or replace function public.lock_active_board_actor()
returns uuid
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_actor uuid;
begin
  select au.id
  into v_actor
  from public.application_users au
  join public.application_user_roles aur
    on aur.application_user_id = au.id
  where au.auth_user_id = auth.uid()
    and au.status = 'active'
  for update of au, aur;

  if v_actor is null then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  return v_actor;
end;
$$;

-- ---------------------------------------------------------------------------
-- Safe Board read models.
-- ---------------------------------------------------------------------------

create or replace function public.list_current_board()
returns table (
  board_appointment_id uuid,
  application_user_id uuid,
  display_name text,
  designation text,
  authorization_role_key text,
  authorization_role_label text,
  appointed_on date,
  status text
)
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
begin
  if public.current_application_user_id() is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  if not public.has_application_permission('committee.board.read') then
    raise exception 'missing_permission' using errcode = '42501';
  end if;

  return query
  select
    ba.id,
    ba.application_user_id,
    coalesce(
      nullif(btrim(au.display_name), ''),
      nullif(btrim(mp.display_name), ''),
      r.name
    ),
    ba.designation,
    r.key,
    r.name,
    ba.appointed_on,
    ba.status
  from public.board_appointments ba
  join public.application_users au
    on au.id = ba.application_user_id
  join public.application_user_roles aur
    on aur.application_user_id = au.id
  join public.roles r
    on r.id = aur.role_id
  left join public.member_profiles mp
    on mp.application_user_id = au.id
  where ba.status = 'active'
  order by
    case ba.designation
      when 'president' then 1
      when 'vice_president' then 2
      when 'secretary' then 3
      when 'joint_secretary' then 4
      when 'treasurer' then 5
      when 'joint_treasurer' then 6
      when 'trustee' then 7
    end,
    3,
    ba.id;
end;
$$;

create or replace function public.list_board_history()
returns table (
  board_appointment_id uuid,
  application_user_id uuid,
  display_name text,
  designation text,
  authorization_role_key text,
  authorization_role_label text,
  appointed_on date,
  ended_on date,
  status text,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
begin
  if public.current_application_user_id() is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  if not public.has_application_permission('committee.board.read') then
    raise exception 'missing_permission' using errcode = '42501';
  end if;

  return query
  select
    ba.id,
    ba.application_user_id,
    coalesce(
      nullif(btrim(au.display_name), ''),
      nullif(btrim(mp.display_name), ''),
      r.name
    ),
    ba.designation,
    r.key,
    r.name,
    ba.appointed_on,
    ba.ended_on,
    ba.status,
    ba.created_at,
    ba.updated_at
  from public.board_appointments ba
  join public.application_users au
    on au.id = ba.application_user_id
  join public.application_user_roles aur
    on aur.application_user_id = au.id
  join public.roles r
    on r.id = aur.role_id
  left join public.member_profiles mp
    on mp.application_user_id = au.id
  order by
    case when ba.status = 'active' then 0 else 1 end,
    ba.ended_on desc nulls first,
    ba.appointed_on desc nulls last,
    ba.created_at desc,
    ba.id desc;
end;
$$;

-- ---------------------------------------------------------------------------
-- Trusted Board mutations.
-- ---------------------------------------------------------------------------

create or replace function public.appoint_board_member(
  p_application_user_id uuid,
  p_designation text,
  p_appointed_on date,
  p_operation_id text
)
returns public.board_appointments
language plpgsql
security definer
set search_path = pg_catalog, extensions
as $$
declare
  v_actor uuid;
  v_designation text := lower(btrim(p_designation));
  v_operation_id text := nullif(btrim(p_operation_id), '');
  v_fingerprint text;
  v_existing public.board_appointment_activity;
  v_appointment public.board_appointments;
  v_target_status text;
  v_role_key text;
  v_expected_role_key text;
begin
  v_actor := public.lock_active_board_actor();

  if not public.has_application_permission('committee.board.manage') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  if p_application_user_id is null then
    raise exception 'target_not_found' using errcode = 'P0002';
  end if;

  if v_designation is null or v_designation not in (
    'president',
    'vice_president',
    'secretary',
    'joint_secretary',
    'treasurer',
    'joint_treasurer',
    'trustee'
  ) then
    raise exception 'invalid_designation' using errcode = '22023';
  end if;

  if v_operation_id is null or length(v_operation_id) > 200 then
    raise exception 'invalid_operation_id' using errcode = '22023';
  end if;

  v_fingerprint := encode(digest(jsonb_build_object(
    'operation', 'board_member_appoint',
    'application_user_id', p_application_user_id,
    'designation', v_designation,
    'appointed_on', p_appointed_on
  )::text, 'sha256'), 'hex');

  perform pg_advisory_xact_lock(hashtextextended(
    'board-operation:' || v_actor::text || ':' || v_operation_id,
    0
  ));

  select *
  into v_existing
  from public.board_appointment_activity
  where actor_application_user_id = v_actor
    and operation_id = v_operation_id;

  if found then
    if v_existing.activity_type <> 'board_member_appointed'
       or v_existing.request_fingerprint <> v_fingerprint then
      raise exception 'operation_id_conflict' using errcode = '23505';
    end if;

    select *
    into v_appointment
    from public.board_appointments
    where id = v_existing.board_appointment_id;

    if v_appointment.id is null then
      raise exception 'idempotency_result_missing' using errcode = 'P0002';
    end if;

    return v_appointment;
  end if;

  select au.status, r.key
  into v_target_status, v_role_key
  from public.application_users au
  join public.application_user_roles aur
    on aur.application_user_id = au.id
  join public.roles r
    on r.id = aur.role_id
  where au.id = p_application_user_id
  for update of au, aur;

  if not found then
    raise exception 'target_not_found' using errcode = 'P0002';
  end if;

  if v_target_status <> 'active' then
    raise exception 'target_inactive' using errcode = '22023';
  end if;

  v_expected_role_key := case v_designation
    when 'president' then 'president'
    when 'vice_president' then 'vice_president'
    when 'secretary' then 'secretary'
    when 'joint_secretary' then 'committee_member'
    when 'treasurer' then 'finance'
    when 'joint_treasurer' then 'finance'
    when 'trustee' then 'committee_member'
  end;

  if v_role_key <> v_expected_role_key then
    raise exception 'incompatible_role' using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.board_appointments ba
    where ba.application_user_id = p_application_user_id
      and ba.status = 'active'
  ) then
    raise exception 'active_appointment_exists' using errcode = '23505';
  end if;

  begin
    insert into public.board_appointments (
      application_user_id,
      designation,
      appointed_on,
      created_by_application_user_id
    ) values (
      p_application_user_id,
      v_designation,
      p_appointed_on,
      v_actor
    )
    returning * into v_appointment;
  exception when unique_violation then
    raise exception 'active_appointment_conflict' using errcode = '23505';
  end;

  insert into public.board_appointment_activity (
    board_appointment_id,
    actor_application_user_id,
    activity_type,
    operation_id,
    request_fingerprint,
    details
  ) values (
    v_appointment.id,
    v_actor,
    'board_member_appointed',
    v_operation_id,
    v_fingerprint,
    jsonb_build_object(
      'application_user_id', v_appointment.application_user_id,
      'designation', v_appointment.designation,
      'appointed_on', v_appointment.appointed_on
    )
  );

  return v_appointment;
end;
$$;

create or replace function public.change_board_designation(
  p_board_appointment_id uuid,
  p_new_designation text,
  p_effective_on date,
  p_operation_id text
)
returns public.board_appointments
language plpgsql
security definer
set search_path = pg_catalog, extensions
as $$
declare
  v_actor uuid;
  v_new_designation text := lower(btrim(p_new_designation));
  v_operation_id text := nullif(btrim(p_operation_id), '');
  v_fingerprint text;
  v_existing public.board_appointment_activity;
  v_previous public.board_appointments;
  v_replacement public.board_appointments;
  v_target_status text;
  v_role_key text;
  v_expected_role_key text;
begin
  v_actor := public.lock_active_board_actor();

  if not public.has_application_permission('committee.board.manage') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  if p_board_appointment_id is null then
    raise exception 'appointment_not_found' using errcode = 'P0002';
  end if;

  if v_new_designation is null or v_new_designation not in (
    'president',
    'vice_president',
    'secretary',
    'joint_secretary',
    'treasurer',
    'joint_treasurer',
    'trustee'
  ) then
    raise exception 'invalid_designation' using errcode = '22023';
  end if;

  if p_effective_on is null then
    raise exception 'effective_date_required' using errcode = '22023';
  end if;

  if v_operation_id is null or length(v_operation_id) > 200 then
    raise exception 'invalid_operation_id' using errcode = '22023';
  end if;

  v_fingerprint := encode(digest(jsonb_build_object(
    'operation', 'board_designation_change',
    'board_appointment_id', p_board_appointment_id,
    'new_designation', v_new_designation,
    'effective_on', p_effective_on
  )::text, 'sha256'), 'hex');

  perform pg_advisory_xact_lock(hashtextextended(
    'board-operation:' || v_actor::text || ':' || v_operation_id,
    0
  ));

  select *
  into v_existing
  from public.board_appointment_activity
  where actor_application_user_id = v_actor
    and operation_id = v_operation_id;

  if found then
    if v_existing.activity_type <> 'board_designation_changed'
       or v_existing.request_fingerprint <> v_fingerprint then
      raise exception 'operation_id_conflict' using errcode = '23505';
    end if;

    select *
    into v_replacement
    from public.board_appointments
    where id = v_existing.board_appointment_id;

    if v_replacement.id is null then
      raise exception 'idempotency_result_missing' using errcode = 'P0002';
    end if;

    return v_replacement;
  end if;

  select *
  into v_previous
  from public.board_appointments
  where id = p_board_appointment_id
  for update;

  if not found then
    raise exception 'appointment_not_found' using errcode = 'P0002';
  end if;

  if v_previous.status <> 'active' then
    raise exception 'appointment_not_active' using errcode = '22023';
  end if;

  if v_previous.designation = v_new_designation then
    raise exception 'designation_unchanged' using errcode = '22023';
  end if;

  if v_previous.appointed_on is not null
     and p_effective_on < v_previous.appointed_on then
    raise exception 'invalid_effective_date' using errcode = '22023';
  end if;

  select au.status, r.key
  into v_target_status, v_role_key
  from public.application_users au
  join public.application_user_roles aur
    on aur.application_user_id = au.id
  join public.roles r
    on r.id = aur.role_id
  where au.id = v_previous.application_user_id
  for update of au, aur;

  if not found then
    raise exception 'target_not_found' using errcode = 'P0002';
  end if;

  if v_target_status <> 'active' then
    raise exception 'target_inactive' using errcode = '22023';
  end if;

  v_expected_role_key := case v_new_designation
    when 'president' then 'president'
    when 'vice_president' then 'vice_president'
    when 'secretary' then 'secretary'
    when 'joint_secretary' then 'committee_member'
    when 'treasurer' then 'finance'
    when 'joint_treasurer' then 'finance'
    when 'trustee' then 'committee_member'
  end;

  if v_role_key <> v_expected_role_key then
    raise exception 'incompatible_role' using errcode = '22023';
  end if;

  update public.board_appointments
  set status = 'ended',
      ended_on = p_effective_on,
      ended_by_application_user_id = v_actor
  where id = v_previous.id;

  begin
    insert into public.board_appointments (
      application_user_id,
      designation,
      appointed_on,
      created_by_application_user_id
    ) values (
      v_previous.application_user_id,
      v_new_designation,
      p_effective_on,
      v_actor
    )
    returning * into v_replacement;
  exception when unique_violation then
    raise exception 'active_appointment_conflict' using errcode = '23505';
  end;

  insert into public.board_appointment_activity (
    board_appointment_id,
    actor_application_user_id,
    activity_type,
    operation_id,
    request_fingerprint,
    details
  ) values (
    v_replacement.id,
    v_actor,
    'board_designation_changed',
    v_operation_id,
    v_fingerprint,
    jsonb_build_object(
      'previous_board_appointment_id', v_previous.id,
      'application_user_id', v_previous.application_user_id,
      'previous_designation', v_previous.designation,
      'designation', v_replacement.designation,
      'effective_on', p_effective_on
    )
  );

  return v_replacement;
end;
$$;

create or replace function public.end_board_appointment(
  p_board_appointment_id uuid,
  p_ended_on date,
  p_operation_id text
)
returns public.board_appointments
language plpgsql
security definer
set search_path = pg_catalog, extensions
as $$
declare
  v_actor uuid;
  v_operation_id text := nullif(btrim(p_operation_id), '');
  v_fingerprint text;
  v_existing public.board_appointment_activity;
  v_appointment public.board_appointments;
begin
  v_actor := public.lock_active_board_actor();

  if not public.has_application_permission('committee.board.manage') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  if p_board_appointment_id is null then
    raise exception 'appointment_not_found' using errcode = 'P0002';
  end if;

  if p_ended_on is null then
    raise exception 'ended_date_required' using errcode = '22023';
  end if;

  if v_operation_id is null or length(v_operation_id) > 200 then
    raise exception 'invalid_operation_id' using errcode = '22023';
  end if;

  v_fingerprint := encode(digest(jsonb_build_object(
    'operation', 'board_appointment_end',
    'board_appointment_id', p_board_appointment_id,
    'ended_on', p_ended_on
  )::text, 'sha256'), 'hex');

  perform pg_advisory_xact_lock(hashtextextended(
    'board-operation:' || v_actor::text || ':' || v_operation_id,
    0
  ));

  select *
  into v_existing
  from public.board_appointment_activity
  where actor_application_user_id = v_actor
    and operation_id = v_operation_id;

  if found then
    if v_existing.activity_type <> 'board_appointment_ended'
       or v_existing.request_fingerprint <> v_fingerprint then
      raise exception 'operation_id_conflict' using errcode = '23505';
    end if;

    select *
    into v_appointment
    from public.board_appointments
    where id = v_existing.board_appointment_id;

    if v_appointment.id is null then
      raise exception 'idempotency_result_missing' using errcode = 'P0002';
    end if;

    return v_appointment;
  end if;

  select *
  into v_appointment
  from public.board_appointments
  where id = p_board_appointment_id
  for update;

  if not found then
    raise exception 'appointment_not_found' using errcode = 'P0002';
  end if;

  if v_appointment.status <> 'active' then
    raise exception 'appointment_not_active' using errcode = '22023';
  end if;

  if v_appointment.appointed_on is not null
     and p_ended_on < v_appointment.appointed_on then
    raise exception 'invalid_ended_date' using errcode = '22023';
  end if;

  update public.board_appointments
  set status = 'ended',
      ended_on = p_ended_on,
      ended_by_application_user_id = v_actor
  where id = v_appointment.id
  returning * into v_appointment;

  insert into public.board_appointment_activity (
    board_appointment_id,
    actor_application_user_id,
    activity_type,
    operation_id,
    request_fingerprint,
    details
  ) values (
    v_appointment.id,
    v_actor,
    'board_appointment_ended',
    v_operation_id,
    v_fingerprint,
    jsonb_build_object(
      'application_user_id', v_appointment.application_user_id,
      'designation', v_appointment.designation,
      'ended_on', v_appointment.ended_on
    )
  );

  return v_appointment;
end;
$$;

-- ---------------------------------------------------------------------------
-- Function execution boundaries.
-- ---------------------------------------------------------------------------

revoke execute on function public.reject_board_appointment_delete()
from public, anon, authenticated, service_role;
revoke execute on function public.reject_board_activity_change()
from public, anon, authenticated, service_role;
revoke execute on function public.lock_active_board_actor()
from public, anon, authenticated, service_role;

revoke execute on function public.list_current_board()
from public, anon, authenticated, service_role;
revoke execute on function public.list_board_history()
from public, anon, authenticated, service_role;
revoke execute on function public.appoint_board_member(uuid, text, date, text)
from public, anon, authenticated, service_role;
revoke execute on function public.change_board_designation(uuid, text, date, text)
from public, anon, authenticated, service_role;
revoke execute on function public.end_board_appointment(uuid, date, text)
from public, anon, authenticated, service_role;

grant execute on function public.list_current_board() to authenticated;
grant execute on function public.list_board_history() to authenticated;
grant execute on function public.appoint_board_member(uuid, text, date, text)
to authenticated;
grant execute on function public.change_board_designation(uuid, text, date, text)
to authenticated;
grant execute on function public.end_board_appointment(uuid, date, text)
to authenticated;

comment on table public.board_appointments is
  'Append-oriented Board of Trustees appointment history; authorization roles remain separate.';
comment on table public.board_appointment_activity is
  'Immutable Board governance activity and operation-idempotency record.';

commit;
