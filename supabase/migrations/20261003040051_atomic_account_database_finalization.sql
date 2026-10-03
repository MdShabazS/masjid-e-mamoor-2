-- Atomically finalize the database portion of an administratively provisioned
-- account after its external Supabase Auth user has been created.

begin;

create or replace function public.finalize_account_provisioning(
  p_auth_user_id uuid,
  p_auth_login_email text,
  p_username text,
  p_username_normalized text,
  p_display_name text,
  p_role_key text,
  p_phone text default null
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor_id uuid;
  v_actor_role text;
  v_auth_email text;
  v_role_id uuid;
  v_existing_id uuid;
  v_existing_username_display text;
  v_existing_username text;
  v_existing_auth_email text;
  v_existing_display_name text;
  v_existing_status text;
  v_existing_must_change_password boolean;
  v_existing_role text;
  v_role_count integer;
  v_profile_count integer;
  v_profile_display_name text;
  v_profile_phone text;
  v_profile_status text;
  v_audit_count integer;
  v_audit_role text;
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
    and au.status = 'active'
  for update of au, aur;

  if v_actor_id is null
     or v_actor_role not in ('system_admin', 'president') then
    raise exception 'not_authorized';
  end if;

  if p_role_key = 'system_admin' then
    raise exception 'not_authorized';
  end if;

  if v_actor_role = 'president'
     and p_role_key not in (
       'vice_president', 'secretary', 'finance', 'auditor',
       'committee_member', 'member'
     ) then
    raise exception 'not_authorized';
  end if;

  if v_actor_role = 'system_admin'
     and p_role_key not in (
       'president', 'vice_president', 'secretary', 'finance', 'auditor',
       'committee_member', 'member'
     ) then
    raise exception 'invalid_role';
  end if;

  select r.id
  into v_role_id
  from public.roles r
  where r.key = p_role_key;

  if v_role_id is null then
    raise exception 'invalid_role';
  end if;

  if p_username is null
     or p_username <> pg_catalog.btrim(p_username)
     or p_username !~ '^[A-Za-z0-9._-]{3,40}$'
     or p_username_normalized <> pg_catalog.lower(p_username)
     or p_username_normalized !~ '^[a-z0-9._-]{3,40}$'
     or p_username_normalized in (
       'admin', 'administrator', 'system', 'root', 'support'
     ) then
    raise exception 'invalid_username';
  end if;

  if p_display_name is null
     or p_display_name <> pg_catalog.btrim(p_display_name)
     or pg_catalog.length(p_display_name) not between 1 and 120 then
    raise exception 'invalid_display_name';
  end if;

  if p_auth_login_email is null
     or p_auth_login_email !~ '^[a-z0-9._%+-]+@auth\.masjid\.local$' then
    raise exception 'account_create_conflict';
  end if;

  if p_role_key <> 'member' and p_phone is not null then
    raise exception 'account_create_conflict';
  end if;

  if p_phone is not null
     and (
       p_phone <> pg_catalog.btrim(p_phone)
       or p_phone !~ '^\+[1-9][0-9]{7,14}$'
     ) then
    raise exception 'account_create_conflict';
  end if;

  -- Serialize retries for the same external Auth identity.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_auth_user_id::text, 1296387405)
  );

  select u.email
  into v_auth_email
  from auth.users u
  where u.id = p_auth_user_id;

  if v_auth_email is null or v_auth_email <> p_auth_login_email then
    raise exception 'account_create_conflict';
  end if;

  select
    au.id,
    au.username,
    au.username_normalized,
    au.auth_login_email,
    au.display_name,
    au.status,
    au.must_change_password
  into
    v_existing_id,
    v_existing_username_display,
    v_existing_username,
    v_existing_auth_email,
    v_existing_display_name,
    v_existing_status,
    v_existing_must_change_password
  from public.application_users au
  where au.auth_user_id = p_auth_user_id
  for update;

  if v_existing_id is not null then
    select count(*), pg_catalog.min(r.key)
    into v_role_count, v_existing_role
    from public.application_user_roles aur
    join public.roles r on r.id = aur.role_id
    where aur.application_user_id = v_existing_id;

    select
      count(*),
      pg_catalog.min(mp.display_name),
      pg_catalog.min(mp.phone),
      pg_catalog.min(mp.status)
    into
      v_profile_count,
      v_profile_display_name,
      v_profile_phone,
      v_profile_status
    from public.member_profiles mp
    where mp.application_user_id = v_existing_id;

    select count(*), pg_catalog.min(ase.metadata ->> 'role')
    into v_audit_count, v_audit_role
    from public.account_security_events ase
    where ase.target_application_user_id = v_existing_id
      and ase.event_type = 'account.created';

    if v_existing_username_display = p_username
       and v_existing_username = p_username_normalized
       and v_existing_auth_email = p_auth_login_email
       and v_existing_display_name = p_display_name
       and v_existing_status = 'active'
       and v_existing_must_change_password
       and v_role_count = 1
       and v_existing_role = p_role_key
       and v_audit_count = 1
       and v_audit_role = p_role_key
       and (
         (
           p_role_key = 'member'
           and v_profile_count = 1
           and v_profile_display_name = p_display_name
           and v_profile_phone is not distinct from p_phone
           and v_profile_status = 'active'
         )
         or (p_role_key <> 'member' and v_profile_count = 0)
       ) then
      return v_existing_id;
    end if;

    raise exception 'account_create_conflict';
  end if;

  insert into public.application_users (
    auth_user_id,
    auth_login_email,
    username,
    username_normalized,
    display_name,
    status,
    must_change_password,
    credential_updated_at
  )
  values (
    p_auth_user_id,
    p_auth_login_email,
    p_username,
    p_username_normalized,
    p_display_name,
    'active',
    true,
    pg_catalog.now()
  )
  returning id into v_existing_id;

  insert into public.application_user_roles (
    application_user_id,
    role_id
  )
  values (v_existing_id, v_role_id);

  if p_role_key = 'member' then
    insert into public.member_profiles (
      application_user_id,
      display_name,
      phone,
      status
    )
    values (
      v_existing_id,
      p_display_name,
      p_phone,
      'active'
    );
  end if;

  insert into public.account_security_events (
    actor_application_user_id,
    target_application_user_id,
    event_type,
    metadata
  )
  values (
    v_actor_id,
    v_existing_id,
    'account.created',
    pg_catalog.jsonb_build_object('role', p_role_key)
  );

  return v_existing_id;
exception
  when unique_violation then
    raise exception 'account_create_conflict';
end;
$$;

revoke all on function public.finalize_account_provisioning(
  uuid, text, text, text, text, text, text
) from public, anon;

grant execute on function public.finalize_account_provisioning(
  uuid, text, text, text, text, text, text
) to authenticated;

commit;
