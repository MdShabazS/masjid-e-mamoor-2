-- Supabase can revoke a refresh session while its old access JWT remains
-- cryptographically valid. Domain authorization must also check the session.
begin;

create function app_private.active_auth_session()
returns boolean language sql stable security definer set search_path = pg_catalog
as $$
  select exists (
    select 1 from auth.sessions s
    where s.id = case
      when auth.jwt()->>'session_id' ~
        '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
      then (auth.jwt()->>'session_id')::uuid
      else null::uuid
    end
      and s.user_id = auth.uid()
      and (s.not_after is null or s.not_after > now())
  );
$$;
revoke all on function app_private.active_auth_session() from public, anon, authenticated;

create or replace function app_private.require_actor(p_roles text[])
returns uuid language plpgsql security definer set search_path = pg_catalog
as $$
declare v_actor uuid := auth.uid();
begin
  if v_actor is null or not app_private.active_auth_session() or not exists (
    select 1 from public.app_users u
    join app_private.username_aliases i on i.user_id=u.id
    where u.id=v_actor and u.active and not i.must_change_password
      and u.role=any(p_roles)
  ) then raise exception 'not_authorized' using errcode='42501'; end if;
  return v_actor;
end;
$$;

create or replace function public.current_app_role()
returns text language sql stable security definer set search_path = pg_catalog
as $$
  select u.role from public.app_users u
  join app_private.username_aliases i on i.user_id=u.id
  where u.id=auth.uid() and app_private.active_auth_session()
    and u.active and not i.must_change_password;
$$;

create or replace function public.current_identity_gate()
returns table(account_active boolean, must_change_password boolean, credential_version bigint)
language sql stable security definer set search_path = pg_catalog
as $$
  select u.active, i.must_change_password, i.credential_version
  from public.app_users u join app_private.username_aliases i on i.user_id=u.id
  where u.id=auth.uid() and app_private.active_auth_session();
$$;

commit;
