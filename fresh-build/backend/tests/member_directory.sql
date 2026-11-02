-- Rollback-only proof of the active member picker projection.
begin;
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,
  email_confirmed_at,created_at,updated_at)
select id,'00000000-0000-0000-0000-000000000000'::uuid,'authenticated',
  'authenticated',email,'',now(),now(),now()
from (values
  ('c1000000-0000-0000-0000-000000000001'::uuid,'dirmember@example.invalid'),
  ('c1000000-0000-0000-0000-000000000002'::uuid,'dirgone@example.invalid'),
  ('c1000000-0000-0000-0000-000000000003'::uuid,'diradmin@example.invalid')
) fixture(id,email);
insert into public.app_users(id,role,active) values
 ('c1000000-0000-0000-0000-000000000001','member',true),
 ('c1000000-0000-0000-0000-000000000002','member',false),
 ('c1000000-0000-0000-0000-000000000003','system_admin',true);
insert into app_private.username_aliases(user_id,username,must_change_password) values
 ('c1000000-0000-0000-0000-000000000001','dirmember',false),
 ('c1000000-0000-0000-0000-000000000002','dirgone',false),
 ('c1000000-0000-0000-0000-000000000003','diradmin',false);
insert into auth.sessions(id,user_id,created_at,updated_at) values
 ('c1000000-0000-0000-0000-000000000001','c1000000-0000-0000-0000-000000000001',now(),now()),
 ('c1000000-0000-0000-0000-000000000003','c1000000-0000-0000-0000-000000000003',now(),now());
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"c1000000-0000-0000-0000-000000000001","session_id":"c1000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
do $$ begin
  if (select count(*) from public.list_active_members() where username in ('dirgone','diradmin'))<>0
    then raise exception 'inactive or System Admin account listed'; end if;
  if not (select is_self from public.list_active_members() where username='dirmember')
    then raise exception 'own row was not marked'; end if;
end $$;
select set_config('request.jwt.claims',
  '{"sub":"c1000000-0000-0000-0000-000000000003","session_id":"c1000000-0000-0000-0000-000000000003","role":"authenticated"}',true);
do $$ begin
  if (select is_self from public.list_active_members() where username='dirmember')
    then raise exception 'another account marked as self'; end if;
end $$;
reset role;
set local role anon;
do $$ begin
  begin
    perform public.list_active_members();
    raise exception 'anonymous caller read the directory';
  exception when insufficient_privilege then null; end;
end $$;
rollback;
