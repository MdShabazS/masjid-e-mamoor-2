-- Owner decision 10 November 2026: the System Admin creates Presidents and remains a backup
-- for every role; a President creates, resets, changes and deactivates the other roles.
-- A President never manages a President, a System Admin or their own account.
begin;
create function app_private.managed_by_president(p_role text) returns boolean
language sql immutable set search_path=pg_catalog as $$
 select p_role in ('vice_president','secretary','treasurer','committee_member','member','data_entry') $$;
revoke all on function app_private.managed_by_president(text) from public,anon,authenticated;

create or replace function public.admin_register_identity(p_user_id uuid, p_username text, p_role text)
returns void language plpgsql security definer set search_path = pg_catalog
as $$
declare v_actor uuid := app_private.require_actor(array['system_admin','president']);
        v_username text := lower(btrim(p_username));
begin
  if p_user_id is null or p_role is null or p_role not in
    ('system_admin','president','vice_president','secretary','treasurer',
     'committee_member','member','data_entry') or
     v_username !~ '^[a-z][a-z0-9._-]{2,31}$' then
    raise exception 'invalid_identity' using errcode='22023'; end if;
  if exists(select 1 from public.app_users where id=v_actor and role='president')
    and not app_private.managed_by_president(p_role) then
    raise exception 'role_not_manageable' using errcode='42501'; end if;
  insert into public.app_users(id,role) values (p_user_id,p_role);
  insert into app_private.username_aliases(user_id,username)
    values (p_user_id,v_username);
  insert into app_private.identity_audit(actor_id,target_id,event,new_role)
    values(v_actor,p_user_id,'provisioned',p_role);
end;
$$;

create or replace function public.admin_require_password_reset(p_target_id uuid)
returns void language plpgsql security definer set search_path = pg_catalog
as $$
declare v_actor uuid := app_private.require_actor(array['system_admin','president']);
        v_target_role text;
begin
  select role into v_target_role from public.app_users where id=p_target_id;
  if v_target_role is null then raise exception 'account_not_found' using errcode='22023'; end if;
  if exists(select 1 from public.app_users where id=v_actor and role='president')
    and (p_target_id=v_actor or not app_private.managed_by_president(v_target_role)) then
    raise exception 'role_not_manageable' using errcode='42501'; end if;
  update app_private.username_aliases
    set must_change_password=true, credential_version=credential_version+1
    where user_id=p_target_id;
  if not found then raise exception 'account_not_found' using errcode='22023'; end if;
  insert into app_private.identity_audit(actor_id,target_id,event)
    values(v_actor,p_target_id,'password_reset_required');
end;
$$;

create or replace function public.admin_set_account_state(p_target_id uuid, p_role text, p_active boolean)
returns void language plpgsql security definer set search_path = pg_catalog
as $$
declare v_actor uuid := app_private.require_actor(array['system_admin','president']);
        v_old public.app_users;
begin
  if p_role is null or p_active is null or p_role not in
    ('system_admin','president','vice_president','secretary','treasurer',
     'committee_member','member','data_entry') then
    raise exception 'invalid_identity' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(91543127); -- serialize last-admin decisions
  select * into v_old from public.app_users where id=p_target_id for update;
  if not found then raise exception 'account_not_found' using errcode='22023'; end if;
  if exists(select 1 from public.app_users where id=v_actor and role='president')
    and (p_target_id=v_actor or not app_private.managed_by_president(v_old.role)
      or not app_private.managed_by_president(p_role)) then
    raise exception 'role_not_manageable' using errcode='42501'; end if;
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

-- Account list for the management screen. `manageable` says whether this caller may change it.
create function public.list_managed_accounts()
returns table(user_id uuid,username text,role text,active boolean,must_change_password boolean,
 manageable boolean,created_at timestamptz)
language plpgsql stable security definer set search_path=pg_catalog as $$
declare v_actor uuid:=app_private.require_actor(array['system_admin','president']);
 v_admin boolean;
begin
 select u.role='system_admin' into v_admin from public.app_users u where u.id=v_actor;
 return query select u.id,a.username,u.role,u.active,a.must_change_password,
  u.id<>v_actor and (v_admin or app_private.managed_by_president(u.role)),u.created_at
  from public.app_users u join app_private.username_aliases a on a.user_id=u.id
  order by u.active desc,a.username;
end $$;
revoke all on function public.list_managed_accounts() from public,anon,authenticated;
grant execute on function public.list_managed_accounts() to authenticated;
commit;
