begin;

-- Member Management V1 hardening.
--
-- This migration does not add member fields or new business states. It
-- tightens the trusted operation boundary so direct RPC callers receive the
-- same server-authoritative validation as the web layer, and so idempotency
-- keys cannot be replayed across unrelated member operations.

alter table public.member_profiles
  drop constraint if exists member_profiles_display_name_v1_chk;

alter table public.member_profiles
  add constraint member_profiles_display_name_v1_chk
  check (
    length(btrim(display_name)) between 1 and 120
  )
  not valid;

alter table public.member_profiles
  drop constraint if exists member_profiles_phone_v1_chk;

alter table public.member_profiles
  add constraint member_profiles_phone_v1_chk
  check (
    phone is null
    or phone ~ '^\+[1-9][0-9]{7,14}$'
  )
  not valid;

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
  v_display_name text := nullif(btrim(p_display_name), '');
  v_phone text := nullif(btrim(p_phone), '');
  v_operation_id text := nullif(btrim(p_operation_id), '');
  v_history public.membership_history;
  v_changed_fields jsonb := '{}'::jsonb;
begin
  v_application_user_id := public.current_application_user_id();

  if v_application_user_id is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  if v_display_name is null then
    raise exception 'invalid_display_name' using errcode = '22023';
  end if;

  if length(v_display_name) > 120 then
    raise exception 'invalid_display_name' using errcode = '22023';
  end if;

  if v_phone is not null
     and v_phone !~ '^\+[1-9][0-9]{7,14}$' then
    raise exception 'invalid_phone' using errcode = '22023';
  end if;

  if v_operation_id is not null then
    select mh.*
    into v_history
    from public.membership_history mh
    where mh.operation_id = v_operation_id
    limit 1;

    if found then
      if v_history.event_type = 'profile_updated'
         and v_history.actor_application_user_id = v_application_user_id
         and v_history.application_user_id = v_application_user_id then
        select mp.*
        into v_member
        from public.member_profiles mp
        where mp.id = v_history.member_profile_id;

        return v_member;
      end if;

      raise exception 'operation_id_conflict' using errcode = '23505';
    end if;
  end if;

  select mp.display_name, mp.phone
  into v_old_display_name, v_old_phone
  from public.member_profiles mp
  where mp.application_user_id = v_application_user_id
  for update;

  if not found then
    raise exception 'member_profile_not_found' using errcode = 'P0002';
  end if;

  if v_display_name is distinct from v_old_display_name then
    v_changed_fields :=
      v_changed_fields || jsonb_build_object(
        'display_name',
        jsonb_build_object(
          'before', v_old_display_name,
          'after', v_display_name
        )
      );
  end if;

  if v_phone is distinct from v_old_phone then
    v_changed_fields :=
      v_changed_fields || jsonb_build_object(
        'phone',
        jsonb_build_object(
          'before', v_old_phone,
          'after', v_phone
        )
      );
  end if;

  update public.member_profiles
  set
    display_name = v_display_name,
    phone = v_phone,
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
      v_operation_id,
      v_application_user_id
    );
  end if;

  return v_member;
end;
$$;

create or replace function public.admin_create_member_profile(
  p_application_user_id uuid,
  p_display_name text,
  p_phone text default null,
  p_operation_id text default null,
  p_reason text default null
)
returns public.member_profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member public.member_profiles;
  v_actor uuid;
  v_display_name text := nullif(btrim(p_display_name), '');
  v_phone text := nullif(btrim(p_phone), '');
  v_operation_id text := nullif(btrim(p_operation_id), '');
  v_reason text := nullif(btrim(p_reason), '');
  v_history public.membership_history;
begin
  v_actor := public.current_application_user_id();

  if v_actor is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  if not public.has_application_permission('membership.members.create') then
    raise exception 'missing_permission' using errcode = '42501';
  end if;

  if v_display_name is null then
    raise exception 'invalid_display_name' using errcode = '22023';
  end if;

  if length(v_display_name) > 120 then
    raise exception 'invalid_display_name' using errcode = '22023';
  end if;

  if v_phone is not null
     and v_phone !~ '^\+[1-9][0-9]{7,14}$' then
    raise exception 'invalid_phone' using errcode = '22023';
  end if;

  if v_operation_id is not null then
    select mh.*
    into v_history
    from public.membership_history mh
    where mh.operation_id = v_operation_id
    limit 1;

    if found then
      if v_history.event_type = 'created'
         and v_history.application_user_id = p_application_user_id then
        select mp.*
        into v_member
        from public.member_profiles mp
        where mp.id = v_history.member_profile_id;

        return v_member;
      end if;

      raise exception 'operation_id_conflict' using errcode = '23505';
    end if;
  end if;

  if not exists (
    select 1
    from public.application_users au
    where au.id = p_application_user_id
  ) then
    raise exception 'application_user_not_found' using errcode = 'P0002';
  end if;

  if exists (
    select 1
    from public.member_profiles mp
    where mp.application_user_id = p_application_user_id
  ) then
    raise exception 'member_profile_exists' using errcode = '23505';
  end if;

  insert into public.member_profiles (
    application_user_id,
    status,
    display_name,
    phone
  )
  values (
    p_application_user_id,
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
    p_application_user_id,
    'created',
    v_member.status,
    v_operation_id,
    v_reason,
    v_actor
  );

  return v_member;
end;
$$;

create or replace function public.admin_update_member_profile(
  p_member_profile_id uuid,
  p_display_name text,
  p_phone text default null,
  p_operation_id text default null,
  p_reason text default null
)
returns public.member_profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member public.member_profiles;
  v_old_display_name text;
  v_old_phone text;
  v_display_name text := nullif(btrim(p_display_name), '');
  v_phone text := nullif(btrim(p_phone), '');
  v_operation_id text := nullif(btrim(p_operation_id), '');
  v_reason text := nullif(btrim(p_reason), '');
  v_history public.membership_history;
  v_changed_fields jsonb := '{}'::jsonb;
  v_actor uuid;
begin
  v_actor := public.current_application_user_id();

  if v_actor is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  if not public.has_application_permission('membership.members.update') then
    raise exception 'missing_permission' using errcode = '42501';
  end if;

  if v_display_name is null then
    raise exception 'invalid_display_name' using errcode = '22023';
  end if;

  if length(v_display_name) > 120 then
    raise exception 'invalid_display_name' using errcode = '22023';
  end if;

  if v_phone is not null
     and v_phone !~ '^\+[1-9][0-9]{7,14}$' then
    raise exception 'invalid_phone' using errcode = '22023';
  end if;

  if v_operation_id is not null then
    select mh.*
    into v_history
    from public.membership_history mh
    where mh.operation_id = v_operation_id
    limit 1;

    if found then
      if v_history.event_type = 'profile_updated'
         and v_history.member_profile_id = p_member_profile_id then
        select mp.*
        into v_member
        from public.member_profiles mp
        where mp.id = v_history.member_profile_id;

        return v_member;
      end if;

      raise exception 'operation_id_conflict' using errcode = '23505';
    end if;
  end if;

  select
    mp.display_name,
    mp.phone
  into
    v_old_display_name,
    v_old_phone
  from public.member_profiles mp
  where mp.id = p_member_profile_id
  for update;

  if not found then
    raise exception 'member_profile_not_found' using errcode = 'P0002';
  end if;

  if v_display_name is distinct from v_old_display_name then
    v_changed_fields :=
      v_changed_fields || jsonb_build_object(
        'display_name',
        jsonb_build_object(
          'before', v_old_display_name,
          'after', v_display_name
        )
      );
  end if;

  if v_phone is distinct from v_old_phone then
    v_changed_fields :=
      v_changed_fields || jsonb_build_object(
        'phone',
        jsonb_build_object(
          'before', v_old_phone,
          'after', v_phone
        )
      );
  end if;

  update public.member_profiles
  set
    display_name = v_display_name,
    phone = v_phone,
    updated_at = now()
  where id = p_member_profile_id
  returning * into v_member;

  if v_changed_fields <> '{}'::jsonb then
    insert into public.membership_history (
      member_profile_id,
      application_user_id,
      event_type,
      changed_fields,
      operation_id,
      reason,
      actor_application_user_id
    )
    values (
      v_member.id,
      v_member.application_user_id,
      'profile_updated',
      v_changed_fields,
      v_operation_id,
      v_reason,
      v_actor
    );
  end if;

  return v_member;
end;
$$;

create or replace function public.admin_change_member_status(
  p_member_profile_id uuid,
  p_status text,
  p_operation_id text default null,
  p_reason text default null
)
returns public.member_profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member public.member_profiles;
  v_old_status text;
  v_actor uuid;
  v_operation_id text := nullif(btrim(p_operation_id), '');
  v_reason text := nullif(btrim(p_reason), '');
  v_history public.membership_history;
begin
  v_actor := public.current_application_user_id();

  if v_actor is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  if not public.has_application_permission('membership.members.update') then
    raise exception 'missing_permission' using errcode = '42501';
  end if;

  if p_status not in ('active', 'inactive') then
    raise exception 'invalid_member_status' using errcode = '22023';
  end if;

  if v_operation_id is not null then
    select mh.*
    into v_history
    from public.membership_history mh
    where mh.operation_id = v_operation_id
    limit 1;

    if found then
      if v_history.event_type = 'status_changed'
         and v_history.member_profile_id = p_member_profile_id then
        select mp.*
        into v_member
        from public.member_profiles mp
        where mp.id = v_history.member_profile_id;

        return v_member;
      end if;

      raise exception 'operation_id_conflict' using errcode = '23505';
    end if;
  end if;

  select mp.status
  into v_old_status
  from public.member_profiles mp
  where mp.id = p_member_profile_id
  for update;

  if not found then
    raise exception 'member_profile_not_found' using errcode = 'P0002';
  end if;

  if v_old_status = p_status then
    select *
    into v_member
    from public.member_profiles
    where id = p_member_profile_id;

    return v_member;
  end if;

  update public.member_profiles
  set
    status = p_status,
    updated_at = now()
  where id = p_member_profile_id
  returning * into v_member;

  insert into public.membership_history (
    member_profile_id,
    application_user_id,
    event_type,
    previous_status,
    new_status,
    operation_id,
    reason,
    actor_application_user_id
  )
  values (
    v_member.id,
    v_member.application_user_id,
    'status_changed',
    v_old_status,
    p_status,
    v_operation_id,
    v_reason,
    v_actor
  );

  return v_member;
end;
$$;

revoke all on function public.update_own_member_profile(
  text, text, text
) from public;

grant execute on function public.update_own_member_profile(
  text, text, text
) to authenticated;

revoke all on function public.admin_create_member_profile(
  uuid, text, text, text, text
) from public;

revoke all on function public.admin_update_member_profile(
  uuid, text, text, text, text
) from public;

revoke all on function public.admin_change_member_status(
  uuid, text, text, text
) from public;

grant execute on function public.admin_create_member_profile(
  uuid, text, text, text, text
) to authenticated;

grant execute on function public.admin_update_member_profile(
  uuid, text, text, text, text
) to authenticated;

grant execute on function public.admin_change_member_status(
  uuid, text, text, text
) to authenticated;

commit;
