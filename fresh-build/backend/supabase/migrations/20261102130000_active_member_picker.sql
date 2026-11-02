-- Member directory read for pickers. Every active role may read it (Phase 1 matrix).
-- It carries no phone, consent, or finance data. System Admin is excluded as a
-- target because tasks, meetings and referrals never apply to that account.
begin;
create function public.list_active_members()
returns table(member_id uuid,username text,role text,is_self boolean)
language plpgsql stable security definer set search_path=pg_catalog as $$
declare
  v_actor uuid:=app_private.require_actor(array['system_admin','president','vice_president',
    'secretary','treasurer','committee_member','member','data_entry']);
begin
  return query
    select u.id,a.username,u.role,u.id=v_actor
      from public.app_users u
      join app_private.username_aliases a on a.user_id=u.id
      where u.active and u.role<>'system_admin'
      order by a.username;
end $$;
revoke all on function public.list_active_members() from public,anon,authenticated;
grant execute on function public.list_active_members() to authenticated;
commit;
