begin;

-- ============================================================
-- Trusted administrative member operations
-- ============================================================

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
begin
  v_actor := public.current_application_user_id();

  if v_actor is null then
    raise exception 'Authenticated application user required';
  end if;

  if not public.has_application_permission('membership.members.create') then
    raise exception 'Missing permission: membership.members.create';
  end if;

  if p_operation_id is not null then
    select mp.*
    into v_member
    from public.member_profiles mp
    join public.membership_history mh
      on mh.member_profile_id = mp.id
    where mh.operation_id = p_operation_id
    limit 1;

    if found then
      return v_member;
    end if;
  end if;

  if not exists (
    select 1
    from public.application_users au
    where au.id = p_application_user_id
  ) then
    raise exception 'Application user not found';
  end if;

  if exists (
    select 1
    from public.member_profiles mp
    where mp.application_user_id = p_application_user_id
  ) then
    raise exception 'Member profile already exists for application user';
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
    p_display_name,
    p_phone
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
    p_operation_id,
    p_reason,
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
  v_changed_fields jsonb := '{}'::jsonb;
  v_actor uuid;
begin
  v_actor := public.current_application_user_id();

  if v_actor is null then
    raise exception 'Authenticated application user required';
  end if;

  if not public.has_application_permission('membership.members.update') then
    raise exception 'Missing permission: membership.members.update';
  end if;

  if p_operation_id is not null then
    select mp.*
    into v_member
    from public.member_profiles mp
    join public.membership_history mh
      on mh.member_profile_id = mp.id
    where mh.operation_id = p_operation_id
    limit 1;

    if found then
      return v_member;
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
      p_operation_id,
      p_reason,
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
begin
  v_actor := public.current_application_user_id();

  if v_actor is null then
    raise exception 'Authenticated application user required';
  end if;

  if not public.has_application_permission('membership.members.update') then
    raise exception 'Missing permission: membership.members.update';
  end if;

  if p_status not in ('active', 'inactive') then
    raise exception 'Invalid member status';
  end if;

  if p_operation_id is not null then
    select mp.*
    into v_member
    from public.member_profiles mp
    join public.membership_history mh
      on mh.member_profile_id = mp.id
    where mh.operation_id = p_operation_id
    limit 1;

    if found then
      return v_member;
    end if;
  end if;

  select mp.status
  into v_old_status
  from public.member_profiles mp
  where mp.id = p_member_profile_id
  for update;

  if not found then
    raise exception 'Member profile not found';
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
    p_operation_id,
    p_reason,
    v_actor
  );

  return v_member;
end;
$$;


-- Trusted functions are the only mutation path.
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
