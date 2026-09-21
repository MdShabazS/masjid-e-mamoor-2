begin;

-- ============================================================================
-- Member trusted-operation idempotency registry
-- ============================================================================

create table public.member_operation_idempotency (
  operation_id text primary key,
  operation_type text not null,
  actor_application_user_id uuid not null
    references public.application_users(id) on delete restrict,
  target_application_user_id uuid
    references public.application_users(id) on delete restrict,
  target_member_profile_id uuid
    references public.member_profiles(id) on delete restrict,
  request_fingerprint text not null,
  result_member_profile_id uuid not null
    references public.member_profiles(id) on delete restrict,
  created_at timestamptz not null default now(),

  constraint member_operation_idempotency_operation_type_chk
    check (
      operation_type in (
        'own_profile_update',
        'admin_member_create',
        'admin_member_update',
        'admin_member_status_change'
      )
    )
);

revoke all privileges
on table public.member_operation_idempotency
from public, anon, authenticated;

-- ============================================================================
-- Own profile update
-- ============================================================================

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
  v_changed_fields jsonb := '{}'::jsonb;
  v_fingerprint text;
  v_existing public.member_operation_idempotency;
begin
  v_application_user_id := public.current_application_user_id();

  if v_application_user_id is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  if v_display_name is null or length(v_display_name) > 120 then
    raise exception 'invalid_display_name' using errcode = '22023';
  end if;

  if v_phone is not null
     and v_phone !~ '^\+[1-9][0-9]{7,14}$' then
    raise exception 'invalid_phone' using errcode = '22023';
  end if;

  v_fingerprint := encode(
    digest(
      jsonb_build_object(
        'display_name', v_display_name,
        'phone', v_phone
      )::text,
      'sha256'
    ),
    'hex'
  );

  if v_operation_id is not null then
    select *
    into v_existing
    from public.member_operation_idempotency
    where operation_id = v_operation_id;

    if found then
      if v_existing.operation_type <> 'own_profile_update'
         or v_existing.actor_application_user_id <> v_application_user_id
         or v_existing.target_application_user_id is distinct from v_application_user_id
         or v_existing.request_fingerprint <> v_fingerprint then
        raise exception 'operation_id_conflict' using errcode = '23505';
      end if;

      select *
      into v_member
      from public.member_profiles
      where id = v_existing.result_member_profile_id;

      return v_member;
    end if;
  end if;

  select mp.*
  into v_member
  from public.member_profiles mp
  where mp.application_user_id = v_application_user_id
  for update;

  if not found then
    raise exception 'member_profile_not_found' using errcode = 'P0002';
  end if;

  v_old_display_name := v_member.display_name;
  v_old_phone := v_member.phone;

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

  if v_changed_fields <> '{}'::jsonb then
    update public.member_profiles
    set
      display_name = v_display_name,
      phone = v_phone,
      updated_at = now()
    where id = v_member.id
    returning * into v_member;

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

  if v_operation_id is not null then
    insert into public.member_operation_idempotency (
      operation_id,
      operation_type,
      actor_application_user_id,
      target_application_user_id,
      target_member_profile_id,
      request_fingerprint,
      result_member_profile_id
    )
    values (
      v_operation_id,
      'own_profile_update',
      v_application_user_id,
      v_application_user_id,
      v_member.id,
      v_fingerprint,
      v_member.id
    );
  end if;

  return v_member;
end;
$$;

-- ============================================================================
-- Admin create
-- ============================================================================

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
  v_fingerprint text;
  v_existing public.member_operation_idempotency;
begin
  v_actor := public.current_application_user_id();

  if v_actor is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  if not public.has_application_permission('membership.members.create') then
    raise exception 'missing_permission' using errcode = '42501';
  end if;

  if v_display_name is null or length(v_display_name) > 120 then
    raise exception 'invalid_display_name' using errcode = '22023';
  end if;

  if v_phone is not null
     and v_phone !~ '^\+[1-9][0-9]{7,14}$' then
    raise exception 'invalid_phone' using errcode = '22023';
  end if;

  v_fingerprint := encode(
    digest(
      jsonb_build_object(
        'application_user_id', p_application_user_id,
        'display_name', v_display_name,
        'phone', v_phone,
        'reason', v_reason
      )::text,
      'sha256'
    ),
    'hex'
  );

  if v_operation_id is not null then
    select *
    into v_existing
    from public.member_operation_idempotency
    where operation_id = v_operation_id;

    if found then
      if v_existing.operation_type <> 'admin_member_create'
         or v_existing.actor_application_user_id <> v_actor
         or v_existing.target_application_user_id is distinct from p_application_user_id
         or v_existing.request_fingerprint <> v_fingerprint then
        raise exception 'operation_id_conflict' using errcode = '23505';
      end if;

      select *
      into v_member
      from public.member_profiles
      where id = v_existing.result_member_profile_id;

      return v_member;
    end if;
  end if;

  if not exists (
    select 1
    from public.application_users
    where id = p_application_user_id
  ) then
    raise exception 'application_user_not_found' using errcode = 'P0002';
  end if;

  if exists (
    select 1
    from public.member_profiles
    where application_user_id = p_application_user_id
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

  if v_operation_id is not null then
    insert into public.member_operation_idempotency (
      operation_id,
      operation_type,
      actor_application_user_id,
      target_application_user_id,
      target_member_profile_id,
      request_fingerprint,
      result_member_profile_id
    )
    values (
      v_operation_id,
      'admin_member_create',
      v_actor,
      p_application_user_id,
      v_member.id,
      v_fingerprint,
      v_member.id
    );
  end if;

  return v_member;
end;
$$;

-- ============================================================================
-- Admin profile update
-- ============================================================================

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
  v_changed_fields jsonb := '{}'::jsonb;
  v_actor uuid;
  v_fingerprint text;
  v_existing public.member_operation_idempotency;
begin
  v_actor := public.current_application_user_id();

  if v_actor is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  if not public.has_application_permission('membership.members.update') then
    raise exception 'missing_permission' using errcode = '42501';
  end if;

  if v_display_name is null or length(v_display_name) > 120 then
    raise exception 'invalid_display_name' using errcode = '22023';
  end if;

  if v_phone is not null
     and v_phone !~ '^\+[1-9][0-9]{7,14}$' then
    raise exception 'invalid_phone' using errcode = '22023';
  end if;

  v_fingerprint := encode(
    digest(
      jsonb_build_object(
        'member_profile_id', p_member_profile_id,
        'display_name', v_display_name,
        'phone', v_phone,
        'reason', v_reason
      )::text,
      'sha256'
    ),
    'hex'
  );

  if v_operation_id is not null then
    select *
    into v_existing
    from public.member_operation_idempotency
    where operation_id = v_operation_id;

    if found then
      if v_existing.operation_type <> 'admin_member_update'
         or v_existing.actor_application_user_id <> v_actor
         or v_existing.target_member_profile_id is distinct from p_member_profile_id
         or v_existing.request_fingerprint <> v_fingerprint then
        raise exception 'operation_id_conflict' using errcode = '23505';
      end if;

      select *
      into v_member
      from public.member_profiles
      where id = v_existing.result_member_profile_id;

      return v_member;
    end if;
  end if;

  select *
  into v_member
  from public.member_profiles
  where id = p_member_profile_id
  for update;

  if not found then
    raise exception 'member_profile_not_found' using errcode = 'P0002';
  end if;

  v_old_display_name := v_member.display_name;
  v_old_phone := v_member.phone;

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

  if v_changed_fields <> '{}'::jsonb then
    update public.member_profiles
    set
      display_name = v_display_name,
      phone = v_phone,
      updated_at = now()
    where id = p_member_profile_id
    returning * into v_member;

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

  if v_operation_id is not null then
    insert into public.member_operation_idempotency (
      operation_id,
      operation_type,
      actor_application_user_id,
      target_application_user_id,
      target_member_profile_id,
      request_fingerprint,
      result_member_profile_id
    )
    values (
      v_operation_id,
      'admin_member_update',
      v_actor,
      v_member.application_user_id,
      v_member.id,
      v_fingerprint,
      v_member.id
    );
  end if;

  return v_member;
end;
$$;

-- ============================================================================
-- Admin status change
-- ============================================================================

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
  v_fingerprint text;
  v_existing public.member_operation_idempotency;
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

  v_fingerprint := encode(
    digest(
      jsonb_build_object(
        'member_profile_id', p_member_profile_id,
        'status', p_status,
        'reason', v_reason
      )::text,
      'sha256'
    ),
    'hex'
  );

  if v_operation_id is not null then
    select *
    into v_existing
    from public.member_operation_idempotency
    where operation_id = v_operation_id;

    if found then
      if v_existing.operation_type <> 'admin_member_status_change'
         or v_existing.actor_application_user_id <> v_actor
         or v_existing.target_member_profile_id is distinct from p_member_profile_id
         or v_existing.request_fingerprint <> v_fingerprint then
        raise exception 'operation_id_conflict' using errcode = '23505';
      end if;

      select *
      into v_member
      from public.member_profiles
      where id = v_existing.result_member_profile_id;

      return v_member;
    end if;
  end if;

  select *
  into v_member
  from public.member_profiles
  where id = p_member_profile_id
  for update;

  if not found then
    raise exception 'member_profile_not_found' using errcode = 'P0002';
  end if;

  v_old_status := v_member.status;

  if v_old_status is distinct from p_status then
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
  end if;

  if v_operation_id is not null then
    insert into public.member_operation_idempotency (
      operation_id,
      operation_type,
      actor_application_user_id,
      target_application_user_id,
      target_member_profile_id,
      request_fingerprint,
      result_member_profile_id
    )
    values (
      v_operation_id,
      'admin_member_status_change',
      v_actor,
      v_member.application_user_id,
      v_member.id,
      v_fingerprint,
      v_member.id
    );
  end if;

  return v_member;
end;
$$;

-- Preserve trusted-operation execution boundaries.

revoke all on function public.update_own_member_profile(
  text, text, text
) from public, anon;

grant execute on function public.update_own_member_profile(
  text, text, text
) to authenticated;

revoke all on function public.admin_create_member_profile(
  uuid, text, text, text, text
) from public, anon;

grant execute on function public.admin_create_member_profile(
  uuid, text, text, text, text
) to authenticated;

revoke all on function public.admin_update_member_profile(
  uuid, text, text, text, text
) from public, anon;

grant execute on function public.admin_update_member_profile(
  uuid, text, text, text, text
) to authenticated;

revoke all on function public.admin_change_member_status(
  uuid, text, text, text
) from public, anon;

grant execute on function public.admin_change_member_status(
  uuid, text, text, text
) to authenticated;

commit;
