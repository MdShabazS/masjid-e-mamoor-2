-- Rollback-only proof of who may create and change accounts (owner decision 10 Nov 2026).
begin;
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at)
select id,'00000000-0000-0000-0000-000000000000'::uuid,'authenticated','authenticated',email,'',now(),now(),now()
from (values
 ('c9000000-0000-0000-0000-000000000001'::uuid,'amsa@example.invalid'),
 ('c9000000-0000-0000-0000-000000000002'::uuid,'ampres@example.invalid'),
 ('c9000000-0000-0000-0000-000000000003'::uuid,'ampres2@example.invalid'),
 ('c9000000-0000-0000-0000-000000000004'::uuid,'amtreas@example.invalid'),
 ('c9000000-0000-0000-0000-000000000005'::uuid,'ammem@example.invalid'),
 ('c9000000-0000-0000-0000-000000000006'::uuid,'amnew1@example.invalid'),
 ('c9000000-0000-0000-0000-000000000007'::uuid,'amnew2@example.invalid'),
 ('c9000000-0000-0000-0000-000000000008'::uuid,'amnew3@example.invalid')) f(id,email);
insert into public.app_users(id,role) values
 ('c9000000-0000-0000-0000-000000000001','system_admin'),
 ('c9000000-0000-0000-0000-000000000002','president'),
 ('c9000000-0000-0000-0000-000000000003','president'),
 ('c9000000-0000-0000-0000-000000000004','treasurer'),
 ('c9000000-0000-0000-0000-000000000005','member');
insert into app_private.username_aliases(user_id,username,must_change_password) values
 ('c9000000-0000-0000-0000-000000000001','amadmin',false),
 ('c9000000-0000-0000-0000-000000000002','ampres',false),
 ('c9000000-0000-0000-0000-000000000003','ampresother',false),
 ('c9000000-0000-0000-0000-000000000004','amtreas',false),
 ('c9000000-0000-0000-0000-000000000005','ammember',false);
insert into auth.sessions(id,user_id,created_at,updated_at)
select id,id,now(),now() from auth.users where email like 'am%@example.invalid';

-- President: may create, reset and deactivate managed roles.
select set_config('request.jwt.claims','{"sub":"c9000000-0000-0000-0000-000000000002","session_id":"c9000000-0000-0000-0000-000000000002","role":"authenticated"}',true);
set local role authenticated;
select public.admin_register_identity('c9000000-0000-0000-0000-000000000006','amnewtreasurer','treasurer');
select public.admin_require_password_reset('c9000000-0000-0000-0000-000000000004');
select public.admin_set_account_state('c9000000-0000-0000-0000-000000000005','committee_member',true);
select public.admin_set_account_state('c9000000-0000-0000-0000-000000000005','committee_member',false);
do $$ begin
  begin
    perform public.admin_register_identity('c9000000-0000-0000-0000-000000000007','amnewpres','president');
    raise exception 'President created a President';
  exception when insufficient_privilege then null; end;
  begin
    perform public.admin_register_identity('c9000000-0000-0000-0000-000000000007','amnewadmin','system_admin');
    raise exception 'President created a System Admin';
  exception when insufficient_privilege then null; end;
  begin
    perform public.admin_set_account_state('c9000000-0000-0000-0000-000000000004','president',true);
    raise exception 'President promoted someone to President';
  exception when insufficient_privilege then null; end;
  begin
    perform public.admin_set_account_state('c9000000-0000-0000-0000-000000000003','member',false);
    raise exception 'President changed another President';
  exception when insufficient_privilege then null; end;
  begin
    perform public.admin_require_password_reset('c9000000-0000-0000-0000-000000000001');
    raise exception 'President reset the System Admin';
  exception when insufficient_privilege then null; end;
  begin
    perform public.admin_require_password_reset('c9000000-0000-0000-0000-000000000002');
    raise exception 'President reset their own account';
  exception when insufficient_privilege then null; end;
  if (select manageable from public.list_managed_accounts() where username='amtreas') is not true
   or (select manageable from public.list_managed_accounts() where username='ampresother') is not false
   or (select manageable from public.list_managed_accounts() where username='ampres') is not false then
    raise exception 'manageable flags wrong for President'; end if;
end $$;
reset role;

-- Other roles: no account management at all.
select set_config('request.jwt.claims','{"sub":"c9000000-0000-0000-0000-000000000004","session_id":"c9000000-0000-0000-0000-000000000004","role":"authenticated"}',true);
set local role authenticated;
do $$ begin
  begin
    perform public.admin_register_identity('c9000000-0000-0000-0000-000000000007','amsneaky','member');
    raise exception 'Treasurer created an account';
  exception when insufficient_privilege then null; end;
  begin
    perform public.list_managed_accounts();
    raise exception 'Treasurer listed accounts';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- System Admin: creates a President and stays a backup for any role.
select set_config('request.jwt.claims','{"sub":"c9000000-0000-0000-0000-000000000001","session_id":"c9000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select public.admin_register_identity('c9000000-0000-0000-0000-000000000007','amsecondpres','president');
select public.admin_register_identity('c9000000-0000-0000-0000-000000000008','amsamember','member');
select public.admin_set_account_state('c9000000-0000-0000-0000-000000000003','president',false);
do $$ begin
  if (select manageable from public.list_managed_accounts() where username='ampres') is not true
   or (select manageable from public.list_managed_accounts() where username='amadmin') is not false then
    raise exception 'manageable flags wrong for System Admin'; end if;
end $$;
reset role;
do $$ begin
  if (select count(*) from app_private.identity_audit where actor_id='c9000000-0000-0000-0000-000000000002')<>4 then
    raise exception 'President actions were not audited'; end if;
  if (select role from public.app_users where id='c9000000-0000-0000-0000-000000000007')<>'president' then
    raise exception 'System Admin could not create a President'; end if;
end $$;
rollback;
