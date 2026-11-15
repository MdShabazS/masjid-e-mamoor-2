-- Account provisioning and management are reserved for active System Admins.
-- Keep existing account identities and audit history while closing older
-- President-accessible trusted operations.
begin;

delete from public.role_permissions rp
using public.roles r, public.permissions p
where rp.role_id = r.id
  and rp.permission_id = p.id
  and r.key = 'president'
  and p.key like 'accounts.%';

alter function public.finalize_account_provisioning(
  uuid, text, text, text, text, text, text
) rename to finalize_account_provisioning_legacy;
alter function public.change_account_role(uuid, text)
  rename to change_account_role_legacy;
alter function public.change_account_status(uuid, text)
  rename to change_account_status_legacy;

alter function public.finalize_account_provisioning_legacy(
  uuid, text, text, text, text, text, text
) set schema private;
alter function public.change_account_role_legacy(uuid, text)
  set schema private;
alter function public.change_account_status_legacy(uuid, text)
  set schema private;

revoke all on function private.finalize_account_provisioning_legacy(
  uuid, text, text, text, text, text, text
) from public, anon, authenticated, service_role;
revoke all on function private.change_account_role_legacy(uuid, text)
  from public, anon, authenticated, service_role;
revoke all on function private.change_account_status_legacy(uuid, text)
  from public, anon, authenticated, service_role;

create or replace function private.assert_account_system_admin()
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if not exists (
    select 1
    from public.application_users au
    join public.application_user_roles aur
      on aur.application_user_id = au.id
    join public.roles r on r.id = aur.role_id
    where au.auth_user_id = auth.uid()
      and au.status = 'active'
      and r.key = 'system_admin'
    for update of au, aur
  ) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
end;
$$;

revoke all on function private.assert_account_system_admin()
  from public, anon, authenticated, service_role;

create function public.finalize_account_provisioning(
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
set search_path = pg_catalog
as $$
begin
  perform private.assert_account_system_admin();
  if p_role_key not in (
    'president', 'vice_president', 'secretary', 'finance', 'committee_member'
  ) or p_role_key is null then
    raise exception 'invalid_role' using errcode = '22023';
  end if;
  return private.finalize_account_provisioning_legacy(
    p_auth_user_id, p_auth_login_email, p_username, p_username_normalized,
    p_display_name, p_role_key, p_phone
  );
end;
$$;

create function public.change_account_role(
  p_target_application_user_id uuid,
  p_role_key text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  -- The older operation takes the same advisory lock before changing roles.
  perform pg_catalog.pg_advisory_xact_lock(1296387405, 1);
  perform private.assert_account_system_admin();
  if p_role_key not in (
    'president', 'vice_president', 'secretary', 'finance', 'committee_member'
  ) or p_role_key is null then
    raise exception 'invalid_role' using errcode = '22023';
  end if;
  perform private.change_account_role_legacy(
    p_target_application_user_id, p_role_key
  );
end;
$$;

create function public.change_account_status(
  p_target_application_user_id uuid,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(1296387405, 1);
  perform private.assert_account_system_admin();
  perform private.change_account_status_legacy(
    p_target_application_user_id, p_status
  );
end;
$$;

revoke all on function public.finalize_account_provisioning(
  uuid, text, text, text, text, text, text
) from public, anon, authenticated, service_role;
revoke all on function public.change_account_role(uuid, text)
  from public, anon, authenticated, service_role;
revoke all on function public.change_account_status(uuid, text)
  from public, anon, authenticated, service_role;

grant execute on function public.finalize_account_provisioning(
  uuid, text, text, text, text, text, text
) to authenticated;
grant execute on function public.change_account_role(uuid, text)
  to authenticated;
grant execute on function public.change_account_status(uuid, text)
  to authenticated;

-- Existing Finance accounts continue to use the stable internal key.
update public.roles
set name = 'Treasurer',
    description = 'Maintains and verifies the masjid finances.'
where key = 'finance';

commit;
