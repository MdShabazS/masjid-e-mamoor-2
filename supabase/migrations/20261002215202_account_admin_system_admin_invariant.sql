-- Make account role/status changes and the final active System Admin
-- invariant one trusted database transaction.

begin;

create or replace function public.change_account_role(
  p_target_application_user_id uuid,
  p_role_key text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor_id uuid;
  v_actor_role text;
  v_target_role text;
  v_target_status text;
  v_requested_role_id uuid;
  v_active_system_admin_count integer;
begin
  if auth.uid() is null then
    raise exception 'not_authorized';
  end if;

  select au.id, r.key
  into v_actor_id, v_actor_role
  from public.application_users au
  join public.application_user_roles aur
    on aur.application_user_id = au.id
  join public.roles r
    on r.id = aur.role_id
  where au.auth_user_id = auth.uid()
    and au.status = 'active';

  if v_actor_id is null
     or v_actor_role not in ('system_admin', 'president') then
    raise exception 'not_authorized';
  end if;

  -- Both trusted account mutations use this lock before locking account rows.
  -- It serializes every operation that can affect the active-admin invariant.
  perform pg_catalog.pg_advisory_xact_lock(1296387405, 1);

  select au.id, r.key
  into v_actor_id, v_actor_role
  from public.application_users au
  join public.application_user_roles aur
    on aur.application_user_id = au.id
  join public.roles r
    on r.id = aur.role_id
  where au.auth_user_id = auth.uid()
    and au.status = 'active'
  for update of au, aur;

  if v_actor_id is null
     or v_actor_role not in ('system_admin', 'president') then
    raise exception 'not_authorized';
  end if;

  select r.key, au.status
  into v_target_role, v_target_status
  from public.application_users au
  join public.application_user_roles aur
    on aur.application_user_id = au.id
  join public.roles r
    on r.id = aur.role_id
  where au.id = p_target_application_user_id
  for update of au, aur;

  if v_target_role is null then
    raise exception 'not_found';
  end if;

  select r.id
  into v_requested_role_id
  from public.roles r
  where r.key = p_role_key;

  if v_requested_role_id is null then
    raise exception 'invalid_role';
  end if;

  if v_actor_role = 'system_admin' then
    if p_role_key = 'system_admin' then
      raise exception 'not_authorized';
    end if;
  elsif v_target_role not in (
    'vice_president', 'secretary', 'finance', 'auditor',
    'committee_member', 'member'
  ) or p_role_key not in (
    'vice_president', 'secretary', 'finance', 'auditor',
    'committee_member', 'member'
  ) then
    raise exception 'not_authorized';
  end if;

  if v_target_role = 'system_admin'
     and v_target_status = 'active'
     and p_role_key <> 'system_admin' then
    if p_target_application_user_id = v_actor_id then
      raise exception 'last_system_admin';
    end if;

    select count(*)
    into v_active_system_admin_count
    from public.application_users au
    join public.application_user_roles aur
      on aur.application_user_id = au.id
    join public.roles r
      on r.id = aur.role_id
    where au.status = 'active'
      and r.key = 'system_admin';

    if v_active_system_admin_count <= 1 then
      raise exception 'last_system_admin';
    end if;
  end if;

  update public.application_user_roles
  set role_id = v_requested_role_id
  where application_user_id = p_target_application_user_id;

  insert into public.account_security_events (
    actor_application_user_id,
    target_application_user_id,
    event_type,
    metadata
  )
  values (
    v_actor_id,
    p_target_application_user_id,
    'role.changed',
    pg_catalog.jsonb_build_object('role', p_role_key)
  );
end;
$$;

create or replace function public.change_account_status(
  p_target_application_user_id uuid,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor_id uuid;
  v_actor_role text;
  v_target_role text;
  v_target_status text;
  v_active_system_admin_count integer;
begin
  if auth.uid() is null then
    raise exception 'not_authorized';
  end if;

  if p_status not in ('active', 'deactivated') then
    raise exception 'invalid_status';
  end if;

  select au.id, r.key
  into v_actor_id, v_actor_role
  from public.application_users au
  join public.application_user_roles aur
    on aur.application_user_id = au.id
  join public.roles r
    on r.id = aur.role_id
  where au.auth_user_id = auth.uid()
    and au.status = 'active';

  if v_actor_id is null
     or v_actor_role not in ('system_admin', 'president') then
    raise exception 'not_authorized';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(1296387405, 1);

  select au.id, r.key
  into v_actor_id, v_actor_role
  from public.application_users au
  join public.application_user_roles aur
    on aur.application_user_id = au.id
  join public.roles r
    on r.id = aur.role_id
  where au.auth_user_id = auth.uid()
    and au.status = 'active'
  for update of au, aur;

  if v_actor_id is null
     or v_actor_role not in ('system_admin', 'president') then
    raise exception 'not_authorized';
  end if;

  select r.key, au.status
  into v_target_role, v_target_status
  from public.application_users au
  join public.application_user_roles aur
    on aur.application_user_id = au.id
  join public.roles r
    on r.id = aur.role_id
  where au.id = p_target_application_user_id
  for update of au, aur;

  if v_target_role is null then
    raise exception 'not_found';
  end if;

  if v_actor_role = 'president'
     and v_target_role not in (
       'vice_president', 'secretary', 'finance', 'auditor',
       'committee_member', 'member'
     ) then
    raise exception 'not_authorized';
  end if;

  if v_target_role = 'system_admin'
     and p_target_application_user_id = v_actor_id
     and p_status = 'deactivated' then
    raise exception 'not_authorized';
  end if;

  if v_target_role = 'system_admin'
     and v_target_status = 'active'
     and p_status = 'deactivated' then
    select count(*)
    into v_active_system_admin_count
    from public.application_users au
    join public.application_user_roles aur
      on aur.application_user_id = au.id
    join public.roles r
      on r.id = aur.role_id
    where au.status = 'active'
      and r.key = 'system_admin';

    if v_active_system_admin_count <= 1 then
      raise exception 'last_system_admin';
    end if;
  end if;

  update public.application_users
  set status = p_status
  where id = p_target_application_user_id;

  insert into public.account_security_events (
    actor_application_user_id,
    target_application_user_id,
    event_type,
    metadata
  )
  values (
    v_actor_id,
    p_target_application_user_id,
    case
      when p_status = 'active' then 'account.activated'
      else 'account.deactivated'
    end,
    '{}'::jsonb
  );
end;
$$;

revoke all on function public.change_account_role(uuid, text)
from public, anon;
revoke all on function public.change_account_status(uuid, text)
from public, anon;

grant execute on function public.change_account_role(uuid, text)
to authenticated;
grant execute on function public.change_account_status(uuid, text)
to authenticated;

commit;
