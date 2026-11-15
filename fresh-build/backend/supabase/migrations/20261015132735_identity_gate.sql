-- Identity state is private. Auth owns passwords; this schema only gates access.
begin;

create table app_private.username_aliases (
  user_id uuid primary key references public.app_users(id) on delete restrict,
  username text not null unique,
  must_change_password boolean not null default true,
  credential_version bigint not null default 1 check (credential_version > 0),
  created_at timestamptz not null default now(),
  check (username ~ '^[a-z][a-z0-9._-]{2,31}$')
);
create table app_private.identity_audit (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references public.app_users(id) on delete restrict,
  target_id uuid not null references public.app_users(id) on delete restrict,
  event text not null check (event in ('provisioned','password_changed','password_reset_required','role_changed','deactivated','reactivated')),
  old_role text,
  new_role text,
  occurred_at timestamptz not null default now()
);
revoke all on schema app_private from public, anon, authenticated;
revoke all on all tables in schema app_private from public, anon, authenticated;
alter table app_private.username_aliases enable row level security;
alter table app_private.identity_audit enable row level security;
create trigger identity_audit_immutable before update or delete on app_private.identity_audit
for each row execute function app_private.reject_immutable_finance_change();

create or replace function app_private.require_actor(p_roles text[])
returns uuid language plpgsql security definer set search_path = pg_catalog
as $$
declare v_actor uuid := auth.uid();
begin
  if v_actor is null or not exists (
    select 1 from public.app_users u
    join app_private.username_aliases i on i.user_id=u.id
    where u.id=v_actor and u.active and not i.must_change_password
      and u.role=any(p_roles)
  ) then raise exception 'not_authorized' using errcode='42501'; end if;
  return v_actor;
end;
$$;
revoke all on function app_private.require_actor(text[]) from public, anon, authenticated;

create or replace function public.current_app_role()
returns text language sql stable security definer set search_path = pg_catalog
as $$
  select u.role from public.app_users u
  join app_private.username_aliases i on i.user_id=u.id
  where u.id=auth.uid() and u.active and not i.must_change_password;
$$;
revoke all on function public.current_app_role() from public, anon;
grant execute on function public.current_app_role() to authenticated;

-- The login broker calls this with the user's JWT after Auth has established
-- the identity. It reveals no username mapping or privileged domain data.
create function public.current_identity_gate()
returns table(account_active boolean, must_change_password boolean, credential_version bigint)
language sql stable security definer set search_path = pg_catalog
as $$
  select u.active, i.must_change_password, i.credential_version
  from public.app_users u join app_private.username_aliases i on i.user_id=u.id
  where u.id=auth.uid();
$$;
revoke all on function public.current_identity_gate() from public, anon, authenticated;
grant execute on function public.current_identity_gate() to authenticated;

-- Only a currently enabled SA can attach a previously created Auth user.
-- The broker must compensate an Auth create if this transaction fails.
create function public.admin_register_identity(p_user_id uuid, p_username text, p_role text)
returns void language plpgsql security definer set search_path = pg_catalog
as $$
declare v_actor uuid := app_private.require_actor(array['system_admin']);
        v_username text := lower(btrim(p_username));
begin
  if p_user_id is null or p_role is null or p_role not in
    ('system_admin','president','vice_president','secretary','treasurer',
     'committee_member','member','data_entry') or
     v_username !~ '^[a-z][a-z0-9._-]{2,31}$' then
    raise exception 'invalid_identity' using errcode='22023'; end if;
  insert into public.app_users(id,role) values (p_user_id,p_role);
  insert into app_private.username_aliases(user_id,username)
    values (p_user_id,v_username);
  insert into app_private.identity_audit(actor_id,target_id,event,new_role)
    values(v_actor,p_user_id,'provisioned',p_role);
end;
$$;

create function public.admin_set_account_state(p_target_id uuid, p_role text, p_active boolean)
returns void language plpgsql security definer set search_path = pg_catalog
as $$
declare v_actor uuid := app_private.require_actor(array['system_admin']);
        v_old public.app_users;
begin
  if p_role is null or p_active is null or p_role not in
    ('system_admin','president','vice_president','secretary','treasurer',
     'committee_member','member','data_entry') then
    raise exception 'invalid_identity' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(91543127); -- serialize last-admin decisions
  select * into v_old from public.app_users where id=p_target_id for update;
  if not found then raise exception 'account_not_found' using errcode='22023'; end if;
  if p_target_id=v_actor and (not p_active or p_role <> 'system_admin') then
    raise exception 'self_admin_removal_denied' using errcode='42501'; end if;
  if v_old.active and v_old.role='system_admin' and
     (not p_active or p_role <> 'system_admin') and
     (select count(*) from public.app_users where active and role='system_admin') <= 1 then
    raise exception 'last_admin_required' using errcode='42501'; end if;
  update public.app_users set role=p_role,active=p_active where id=p_target_id;
  if v_old.role is distinct from p_role then
    insert into app_private.identity_audit(actor_id,target_id,event,old_role,new_role)
      values(v_actor,p_target_id,'role_changed',v_old.role,p_role);
  end if;
  if v_old.active is distinct from p_active then
    insert into app_private.identity_audit(actor_id,target_id,event,old_role,new_role)
      values(v_actor,p_target_id,case when p_active then 'reactivated' else 'deactivated' end,
        v_old.role,p_role);
  end if;
end;
$$;

-- Begin reset before changing Auth password. A failed Auth update leaves the
-- target gated; a retry can safely complete the reset.
create function public.admin_require_password_reset(p_target_id uuid)
returns void language plpgsql security definer set search_path = pg_catalog
as $$
declare v_actor uuid := app_private.require_actor(array['system_admin']);
begin
  update app_private.username_aliases
    set must_change_password=true, credential_version=credential_version+1
    where user_id=p_target_id;
  if not found then raise exception 'account_not_found' using errcode='22023'; end if;
  insert into app_private.identity_audit(actor_id,target_id,event)
    values(v_actor,p_target_id,'password_reset_required');
end;
$$;

-- Service-only completion is called after Auth has confirmed a password
-- update. The broker verifies the user's session and passes that same UID.
create function public.complete_password_change(p_user_id uuid, p_expected_version bigint)
returns void language plpgsql security definer set search_path = pg_catalog
as $$
begin
  if p_user_id is null then
    raise exception 'not_authorized' using errcode='42501'; end if;
  update app_private.username_aliases set must_change_password=false
    where user_id=p_user_id and credential_version=p_expected_version
      and must_change_password=true;
  if not found then raise exception 'stale_credential_gate' using errcode='40001'; end if;
  insert into app_private.identity_audit(actor_id,target_id,event)
    values(p_user_id,p_user_id,'password_changed');
end;
$$;

revoke all on function public.admin_register_identity(uuid,text,text) from public, anon, authenticated;
revoke all on function public.admin_set_account_state(uuid,text,boolean) from public, anon, authenticated;
revoke all on function public.admin_require_password_reset(uuid) from public, anon, authenticated;
revoke all on function public.complete_password_change(uuid,bigint) from public, anon, authenticated;
grant execute on function public.admin_register_identity(uuid,text,text) to authenticated;
grant execute on function public.admin_set_account_state(uuid,text,boolean) to authenticated;
grant execute on function public.admin_require_password_reset(uuid) to authenticated;
grant execute on function public.complete_password_change(uuid,bigint) to service_role;

-- Owner policy has not granted donor enrollment. Keep the prototype command
-- inaccessible even to signed-in users until consent/grant signoff.
revoke execute on function public.enroll_monthly_donor(text,text,bigint,uuid,text,timestamptz)
  from authenticated;
commit;
