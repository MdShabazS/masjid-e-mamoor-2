-- Atomically finalize an approved referral and its Member account aggregate
-- after the external Supabase Auth user has been created.

begin;

create or replace function public.finalize_referral_member_provisioning(
  p_referral_id uuid,
  p_operation_id text,
  p_auth_user_id uuid,
  p_auth_login_email text,
  p_username text,
  p_username_normalized text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_actor_id uuid;
  v_actor_role text;
  v_operation_id text := nullif(pg_catalog.btrim(p_operation_id), '');
  v_request_fingerprint text;
  v_existing public.referral_operation_idempotency;
  v_referral public.referrals;
  v_application_user_id uuid;
  v_linked_auth_user_id uuid;
  v_member_profile_id uuid;
  v_role_count integer;
  v_member_role_count integer;
  v_account_audit_count integer;
  v_referral_audit_count integer;
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

  if v_operation_id is null or pg_catalog.length(v_operation_id) > 200 then
    raise exception 'invalid_operation_id';
  end if;

  if p_referral_id is null then
    raise exception 'referral_not_found';
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

  v_request_fingerprint := encode(
    extensions.digest(
      pg_catalog.convert_to(
        pg_catalog.format(
          '{"referralId":"%s","username":"%s"}',
          p_referral_id,
          p_username_normalized
        ),
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  );

  -- All referral completion attempts use actor row -> operation advisory
  -- lock -> referral row -> Auth identity advisory lock.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_operation_id, 1734921187)
  );

  select *
  into v_existing
  from public.referral_operation_idempotency
  where operation_id = v_operation_id;

  if found then
    if v_existing.operation_type <> 'referral_complete'
       or v_existing.actor_application_user_id is distinct from v_actor_id
       or v_existing.referral_id <> p_referral_id
       or v_existing.request_fingerprint <> v_request_fingerprint then
      raise exception 'operation_id_conflict';
    end if;

    select *
    into v_referral
    from public.referrals
    where id = p_referral_id
    for update;

    if not found
       or v_referral.status <> 'completed'
       or v_referral.referred_application_user_id is null
       or v_referral.referred_member_profile_id is null
       or v_referral.completed_by_application_user_id is distinct from v_actor_id
       or v_referral.completed_at is null then
      raise exception 'referral_provisioning_conflict';
    end if;

    v_application_user_id := v_referral.referred_application_user_id;
    v_member_profile_id := v_referral.referred_member_profile_id;

    select
      count(*),
      count(*) filter (where r.key = 'member')
    into v_role_count, v_member_role_count
    from public.application_user_roles aur
    join public.roles r on r.id = aur.role_id
    where aur.application_user_id = v_application_user_id;

    if v_role_count <> 1
       or v_member_role_count <> 1
       or not exists (
         select 1
         from public.member_profiles mp
         where mp.id = v_member_profile_id
           and mp.application_user_id = v_application_user_id
       ) then
      raise exception 'referral_provisioning_conflict';
    end if;

    select count(*)
    into v_account_audit_count
    from public.account_security_events ase
    where ase.target_application_user_id = v_application_user_id
      and ase.actor_application_user_id = v_actor_id
      and ase.event_type = 'account.created'
      and ase.metadata ->> 'role' = 'member';

    select count(*)
    into v_referral_audit_count
    from public.referral_audit_events rae
    where rae.referral_id = p_referral_id
      and rae.actor_application_user_id = v_actor_id
      and rae.event_type = 'referral.completed'
      and rae.metadata ->> 'application_user_id' = v_application_user_id::text;

    if v_account_audit_count <> 1 or v_referral_audit_count <> 1 then
      raise exception 'referral_provisioning_conflict';
    end if;

    select au.auth_user_id
    into v_linked_auth_user_id
    from public.application_users au
    where au.id = v_application_user_id;

    if v_linked_auth_user_id is null then
      raise exception 'referral_provisioning_conflict';
    end if;

    if v_linked_auth_user_id <> p_auth_user_id
       and exists (
         select 1
         from public.application_users au
         where au.auth_user_id = p_auth_user_id
       ) then
      raise exception 'referral_provisioning_conflict';
    end if;

    return pg_catalog.jsonb_build_object(
      'application_user_id', v_application_user_id,
      'used_supplied_auth_user', v_linked_auth_user_id = p_auth_user_id
    );
  end if;

  select *
  into v_referral
  from public.referrals
  where id = p_referral_id
  for update;

  if not found then
    raise exception 'referral_not_found';
  end if;

  if v_referral.status <> 'approved' then
    raise exception 'referral_not_approved';
  end if;

  if v_referral.applicant_display_name is null
     or v_referral.applicant_display_name
       <> pg_catalog.btrim(v_referral.applicant_display_name)
     or pg_catalog.length(v_referral.applicant_display_name) not between 1 and 120
     or v_referral.applicant_phone is null
     or v_referral.applicant_phone !~ '^\+[1-9][0-9]{7,14}$' then
    raise exception 'referral_provisioning_conflict';
  end if;

  if exists (
    select 1
    from public.member_profiles mp
    where mp.phone = v_referral.applicant_phone
      and mp.status = 'active'
  ) then
    raise exception 'phone_already_member';
  end if;

  v_application_user_id := public.finalize_account_provisioning(
    p_auth_user_id,
    p_auth_login_email,
    p_username,
    p_username_normalized,
    v_referral.applicant_display_name,
    'member',
    v_referral.applicant_phone
  );

  select mp.id
  into v_member_profile_id
  from public.member_profiles mp
  where mp.application_user_id = v_application_user_id
    and mp.display_name = v_referral.applicant_display_name
    and mp.phone = v_referral.applicant_phone
    and mp.status = 'active';

  if v_member_profile_id is null then
    raise exception 'referral_provisioning_conflict';
  end if;

  update public.referrals
  set
    status = 'completed',
    referred_application_user_id = v_application_user_id,
    referred_member_profile_id = v_member_profile_id,
    completed_by_application_user_id = v_actor_id,
    completed_at = pg_catalog.now()
  where id = p_referral_id
    and status = 'approved';

  if not found then
    raise exception 'referral_not_approved';
  end if;

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
    v_actor_id,
    p_referral_id,
    v_request_fingerprint
  );

  insert into public.referral_audit_events (
    referral_id,
    actor_application_user_id,
    event_type,
    metadata
  )
  values (
    p_referral_id,
    v_actor_id,
    'referral.completed',
    pg_catalog.jsonb_build_object(
      'application_user_id', v_application_user_id
    )
  );

  return pg_catalog.jsonb_build_object(
    'application_user_id', v_application_user_id,
    'used_supplied_auth_user', true
  );
end;
$$;

revoke all on function public.finalize_referral_member_provisioning(
  uuid, text, uuid, text, text, text
) from public, anon;

grant execute on function public.finalize_referral_member_provisioning(
  uuid, text, uuid, text, text, text
) to authenticated;

commit;
