\set ON_ERROR_STOP on
begin;
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at)
select id,'00000000-0000-0000-0000-000000000000'::uuid,'authenticated','authenticated',email,'',now(),now(),now()
from (values
 ('a9000000-0000-0000-0000-000000000001'::uuid,'release-admin@example.invalid'),
 ('a9000000-0000-0000-0000-000000000002'::uuid,'release-president@example.invalid')
) x(id,email);
insert into public.application_users(id,auth_user_id,status) values
 ('aa000000-0000-0000-0000-000000000001','a9000000-0000-0000-0000-000000000001','active'),
 ('aa000000-0000-0000-0000-000000000002','a9000000-0000-0000-0000-000000000002','active');
insert into public.application_user_roles(application_user_id,role_id)
select x.id,r.id from (values
 ('aa000000-0000-0000-0000-000000000001'::uuid,'system_admin'),
 ('aa000000-0000-0000-0000-000000000002'::uuid,'president')
) x(id,key) join public.roles r on r.key=x.key;
set local role authenticated;
select set_config('request.jwt.claims',
 '{"sub":"a9000000-0000-0000-0000-000000000002","role":"authenticated"}',true);
do $$ begin
  begin
    perform public.set_android_release_policy('1.1.0','1.1.0','https://example.org/test.apk','Update');
    raise exception 'FAIL: President changed release policy';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claims',
 '{"sub":"a9000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
select platform from public.set_android_release_policy(
 '1.1.0','1.1.0','https://example.org/test.apk','Please install the new APK');
select platform from public.set_android_release_policy(
 '1.1.0','1.1.0','https://example.org/test.apk','Please install the new APK');
do $$ begin
  if (select count(*) from public.mobile_release_policy_audit
      where actor_application_user_id='aa000000-0000-0000-0000-000000000001') <> 1
    or (select update_status from public.get_mobile_release_status('android','1.0.0')) <> 'required' then
    raise exception 'FAIL: required update or audit incorrect';
  end if;
  begin
    perform public.set_android_release_policy('1.0.0','1.0.0',
      'https://example.org/test.apk','Rollback');
    raise exception 'FAIL: version regression accepted';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.set_android_release_policy('1.2.0','1.2.0',null,'No download');
    raise exception 'FAIL: missing APK URL accepted';
  exception when invalid_parameter_value then null; end;
  begin
    delete from public.mobile_release_policy_audit;
    raise exception 'FAIL: audit history was deleted';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role anon;
do $$ begin
  begin
    perform public.set_android_release_policy('1.2.0','1.2.0','https://example.org/test.apk','Update');
    raise exception 'FAIL: anonymous release mutation';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
