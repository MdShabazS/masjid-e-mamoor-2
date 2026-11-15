-- Run with psql -v ON_ERROR_STOP=1 after both fresh migrations, as postgres.
-- Rollback keeps Auth and application state clean.
begin;
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,
  email_confirmed_at,created_at,updated_at)
select id,'00000000-0000-0000-0000-000000000000'::uuid,'authenticated',
  'authenticated',email,'',now(),now(),now()
from (values
 ('b1000000-0000-0000-0000-000000000001'::uuid,'sa@accounts.masjid.invalid'),
 ('b1000000-0000-0000-0000-000000000002'::uuid,'entry@accounts.masjid.invalid'),
 ('b1000000-0000-0000-0000-000000000003'::uuid,'inactive@accounts.masjid.invalid')
) fixture(id,email);
insert into public.app_users(id,role,active) values
 ('b1000000-0000-0000-0000-000000000001','system_admin',true),
 ('b1000000-0000-0000-0000-000000000002','data_entry',true),
 ('b1000000-0000-0000-0000-000000000003','treasurer',false);
insert into app_private.username_aliases(user_id,username,must_change_password) values
 ('b1000000-0000-0000-0000-000000000001','testadmin',false),
 ('b1000000-0000-0000-0000-000000000002','testentry',true),
 ('b1000000-0000-0000-0000-000000000003','testinactive',false);

do $$ begin
 if has_table_privilege('anon','app_private.username_aliases','SELECT')
   or has_table_privilege('authenticated','app_private.identity_audit','SELECT')
   or has_table_privilege('authenticated','public.app_users','UPDATE')
   or has_function_privilege('anon','public.current_identity_gate()','EXECUTE')
   or has_function_privilege('authenticated','public.complete_password_change(uuid,bigint)','EXECUTE')
   or has_function_privilege('authenticated','public.enroll_monthly_donor(text,text,bigint,uuid,text,timestamptz)','EXECUTE') then
   raise exception 'identity or owner-gated donor command exposed'; end if;
end $$;

set local role anon;
do $$ begin
  begin
    perform public.current_identity_gate();
    raise exception 'anon read gate';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- Synthetic JWTs use the actor UUID as their test session ID.
insert into auth.sessions(id,user_id)
select u.id,u.id from auth.users u join public.app_users a on a.id=u.id
on conflict do nothing;

-- A signed claim without a live matching session must never gain a role.
select set_config('request.jwt.claims',
  '{"sub":"b1000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
set local role authenticated;
do $$ begin
  if public.current_app_role() is not null
    or exists(select 1 from public.current_identity_gate()) then
    raise exception 'missing session claim gained identity access'; end if;
  begin
    perform public.list_monthly_donors();
    raise exception 'missing session claim read protected domain';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

select set_config('request.jwt.claims',
  '{"sub":"b1000000-0000-0000-0000-000000000001","session_id":"b1000000-0000-0000-0000-000000000002","role":"authenticated"}',true);
set local role authenticated;
do $$ begin
  if public.current_app_role() is not null then
    raise exception 'other user session gained role'; end if;
end $$;
reset role;

select set_config('request.jwt.claims',
  '{"sub":"b1000000-0000-0000-0000-000000000002","session_id":"b1000000-0000-0000-0000-000000000002","role":"authenticated"}',true);
set local role authenticated;
do $$ begin
  if (select must_change_password from public.current_identity_gate()) is distinct from true
    or public.current_app_role() is not null then
    raise exception 'temporary user crossed password gate'; end if;
  begin
    perform public.list_monthly_donors();
    raise exception 'temporary user read protected domain';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.admin_set_account_state(
      'b1000000-0000-0000-0000-000000000001','member',false);
    raise exception 'temporary user changed role';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

select set_config('request.jwt.claims',
  '{"sub":"b1000000-0000-0000-0000-000000000003","session_id":"b1000000-0000-0000-0000-000000000003","role":"authenticated"}',true);
set local role authenticated;
do $$ begin
  if (select account_active from public.current_identity_gate()) is distinct from false
    or public.current_app_role() is not null then
    raise exception 'inactive actor regained access'; end if;
  begin
    perform public.list_monthly_donors();
    raise exception 'inactive actor read protected domain';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

select set_config('request.jwt.claims',
  '{"sub":"b1000000-0000-0000-0000-000000000001","session_id":"b1000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
set local role authenticated;
do $$ begin
  if public.current_app_role() <> 'system_admin' then
    raise exception 'admin missing'; end if;
  begin
    perform public.admin_set_account_state(
      'b1000000-0000-0000-0000-000000000001','member',false);
    raise exception 'last admin removed';
  exception when insufficient_privilege then null;
  end;
  perform public.admin_set_account_state(
    'b1000000-0000-0000-0000-000000000002','member',false);
end $$;
reset role;
do $$ begin
  if (select count(*) from app_private.identity_audit
      where target_id='b1000000-0000-0000-0000-000000000002') <> 2 then
    raise exception 'role/deactivation audit missing'; end if;
end $$;
rollback;
