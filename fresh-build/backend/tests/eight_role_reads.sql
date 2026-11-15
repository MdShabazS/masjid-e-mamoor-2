-- Exercise the draft role matrix through the authenticated database role.
-- This tests SQL/JWT context only; issued Auth sessions and Data API remain open.
begin;

with actors as (
  select role,ord,('c1000000-0000-0000-0000-'||lpad(ord::text,12,'0'))::uuid id
  from unnest(array['system_admin','president','vice_president','secretary',
    'treasurer','committee_member','member','data_entry']) with ordinality
    as a(role,ord)
)
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,
  email_confirmed_at,created_at,updated_at)
select id,'00000000-0000-0000-0000-000000000000'::uuid,
  'authenticated','authenticated','role'||ord||'@fixture.invalid','',
  now(),now(),now() from actors;

with actors as (
  select role,ord,('c1000000-0000-0000-0000-'||lpad(ord::text,12,'0'))::uuid id
  from unnest(array['system_admin','president','vice_president','secretary',
    'treasurer','committee_member','member','data_entry']) with ordinality
    as a(role,ord)
)
insert into public.app_users(id,role)
select id,role from actors;

with actors as (
  select ord,('c1000000-0000-0000-0000-'||lpad(ord::text,12,'0'))::uuid id
  from generate_series(1,8) ord
)
insert into app_private.username_aliases(user_id,username,must_change_password)
select id,'fixture_role_'||ord,false from actors;

-- Synthetic JWTs use the actor UUID as their test session ID.
insert into auth.sessions(id,user_id)
select u.id,u.id from auth.users u join public.app_users a on a.id=u.id
on conflict do nothing;

set local role authenticated;
do $$
declare
  v_roles text[] := array['system_admin','president','vice_president',
    'secretary','treasurer','committee_member','member','data_entry'];
  v_id uuid;
begin
  for i in 1..8 loop
    v_id := ('c1000000-0000-0000-0000-'||lpad(i::text,12,'0'))::uuid;
    perform set_config('request.jwt.claims',
      json_build_object('sub',v_id,'session_id',v_id,'role','authenticated')::text,true);
    if public.current_app_role() is distinct from v_roles[i] then
      raise exception 'wrong role projection for %',v_roles[i];
    end if;
    perform count(*) from public.list_monthly_donors();

    if i<=5 then
      perform count(*) from public.list_finance_accounts();
    else
      begin
        perform count(*) from public.list_finance_accounts();
        raise exception 'finance read leaked to %',v_roles[i];
      exception when insufficient_privilege then null;
      end;
    end if;

    if i=1 then
      begin
        perform count(*) from public.list_visible_work_tasks();
        raise exception 'task read leaked to System Admin';
      exception when insufficient_privilege then null;
      end;
    else
      perform count(*) from public.list_visible_work_tasks();
    end if;

    if i between 2 and 5 then
      perform count(*) from public.list_hafiz_prayer_marks(
        '2026-10-01','2026-10-02');
    else
      begin
        perform count(*) from public.list_hafiz_prayer_marks(
          '2026-10-01','2026-10-02');
        raise exception 'prayer read leaked to %',v_roles[i];
      exception when insufficient_privilege then null;
      end;
    end if;
  end loop;
end $$;
reset role;
rollback;
