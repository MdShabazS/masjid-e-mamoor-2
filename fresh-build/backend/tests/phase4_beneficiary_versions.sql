-- Rollback-only: an unused beneficiary can be corrected, while used accounts
-- require replacement. The original create operation remains idempotent.
begin;
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,
  email_confirmed_at,created_at,updated_at)
select id,'00000000-0000-0000-0000-000000000000'::uuid,'authenticated',
  'authenticated',email,'',now(),now(),now()
from (values
 ('d1000000-0000-0000-0000-000000000001'::uuid,'beneficiary-president@example.invalid'),
 ('d1000000-0000-0000-0000-000000000002'::uuid,'beneficiary-treasurer@example.invalid'),
 ('d1000000-0000-0000-0000-000000000003'::uuid,'beneficiary-member@example.invalid')
) fixture(id,email);
insert into public.app_users(id,role) values
 ('d1000000-0000-0000-0000-000000000001','president'),
 ('d1000000-0000-0000-0000-000000000002','treasurer'),
 ('d1000000-0000-0000-0000-000000000003','member');
insert into app_private.username_aliases(user_id,username,must_change_password) values
 ('d1000000-0000-0000-0000-000000000001','beneficiarypresident',false),
 ('d1000000-0000-0000-0000-000000000002','beneficiarytreasurer',false),
 ('d1000000-0000-0000-0000-000000000003','beneficiarymember',false);
insert into auth.sessions(id,user_id)
select id,id from public.app_users where id in
 ('d1000000-0000-0000-0000-000000000001',
  'd1000000-0000-0000-0000-000000000002',
  'd1000000-0000-0000-0000-000000000003');

do $$ begin perform set_config('request.jwt.claims',
 '{"sub":"d1000000-0000-0000-0000-000000000001","session_id":"d1000000-0000-0000-0000-000000000001","role":"authenticated"}',true); end $$;
set local role authenticated;
do $$
declare v_upi uuid; v_bank uuid; v_version uuid; v_retry uuid;
begin
  v_upi:=public.create_finance_account('Unissued UPI','upi','old@bank',null,null,
    'd2000000-0000-0000-0000-000000000001');
  if (select count(*) from public.list_account_beneficiary_versions(v_upi))<>1 then
    raise exception 'missing initial beneficiary version'; end if;
  v_version:=public.correct_account_beneficiary(v_upi,'new@bank',null,null,
    'Correct account typo before use','d2000000-0000-0000-0000-000000000002');
  v_retry:=public.correct_account_beneficiary(v_upi,'NEW@BANK',null,null,
    'Correct account typo before use','d2000000-0000-0000-0000-000000000002');
  if v_retry<>v_version or
    (select count(*) from public.list_account_beneficiary_versions(v_upi))<>2 or
    (select upi_id from public.list_account_beneficiary_versions(v_upi)
      where is_current)<>'new@bank' then
    raise exception 'beneficiary change/replay failed'; end if;
  if public.create_finance_account('Unissued UPI','upi','old@bank',null,null,
       'd2000000-0000-0000-0000-000000000001')<>v_upi then
    raise exception 'original create retry changed after beneficiary correction'; end if;
  begin
    perform public.correct_account_beneficiary(v_upi,'other@bank',null,null,
      'Changed retry must fail','d2000000-0000-0000-0000-000000000002');
    raise exception 'changed retry accepted';
  exception when unique_violation then null; end;
  begin
    perform public.correct_account_beneficiary(v_upi,'invalid',null,null,
      'Bad UPI must fail','d2000000-0000-0000-0000-000000000003');
    raise exception 'invalid UPI accepted';
  exception when invalid_parameter_value then null; end;

  v_bank:=public.create_finance_account('Unissued bank','bank',null,'123456789012',
    'HDFC0001234','d2000000-0000-0000-0000-000000000004');
  perform public.correct_account_beneficiary(v_bank,null,'123456789099',
    'HDFC0001234','Correct bank account before use',
    'd2000000-0000-0000-0000-000000000005');
  if (select bank_last_four from public.list_account_beneficiary_versions(v_bank)
      where is_current)<>'9099' then
    raise exception 'bank mask/version incorrect'; end if;
  perform set_config('test.beneficiary_account',v_upi::text,true);
  perform set_config('test.beneficiary_bank',v_bank::text,true);

  perform set_config('request.jwt.claims',
   '{"sub":"d1000000-0000-0000-0000-000000000003","session_id":"d1000000-0000-0000-0000-000000000003","role":"authenticated"}',true);
  begin
    perform public.list_account_beneficiary_versions(v_upi);
    raise exception 'member read beneficiary history';
  exception when insufficient_privilege then null; end;
  begin
    perform public.correct_account_beneficiary(v_upi,'other@bank',null,null,
      'Member must fail','d2000000-0000-0000-0000-000000000006');
    raise exception 'member changed beneficiary';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

do $$ begin perform set_config('request.jwt.claims',
 '{"sub":"d1000000-0000-0000-0000-000000000002","session_id":"d1000000-0000-0000-0000-000000000002","role":"authenticated"}',true); end $$;
set local role authenticated;
do $$ begin
  perform public.submit_account_opening(current_setting('test.beneficiary_account')::uuid,
    0,'Opening evidence','d2000000-0000-0000-0000-000000000007');
end $$;
reset role;

do $$ begin perform set_config('request.jwt.claims',
 '{"sub":"d1000000-0000-0000-0000-000000000001","session_id":"d1000000-0000-0000-0000-000000000001","role":"authenticated"}',true); end $$;
set local role authenticated;
do $$ begin
  begin
    perform public.correct_account_beneficiary(
      current_setting('test.beneficiary_account')::uuid,'latest@bank',null,null,
      'Used account should fail','d2000000-0000-0000-0000-000000000008');
    raise exception 'used account beneficiary changed';
  exception when invalid_parameter_value then null; end;
  if (select count(*) from public.list_account_beneficiary_versions(
      current_setting('test.beneficiary_account')::uuid))<>2 then
    raise exception 'used-account denial created a version'; end if;
end $$;
reset role;

do $$ begin
  if has_table_privilege('authenticated','app_private.account_beneficiary_versions','SELECT')
    or has_table_privilege('authenticated','app_private.account_beneficiaries','UPDATE')
    or has_function_privilege('anon',
      'public.correct_account_beneficiary(uuid,text,text,text,text,uuid)','EXECUTE') then
    raise exception 'beneficiary direct grant exposed'; end if;
  begin
    update app_private.account_beneficiary_versions set ifsc='HDFC0001234'
      where account_id=current_setting('test.beneficiary_bank')::uuid;
    raise exception 'beneficiary history mutable';
  exception when insufficient_privilege then null; end;
  if (select count(*) from public.finance_effects where account_id in
      (current_setting('test.beneficiary_account')::uuid,
       current_setting('test.beneficiary_bank')::uuid))<>0 then
    raise exception 'beneficiary change posted a money effect'; end if;
end $$;
select 'phase4_beneficiary_versions_passed' as result;
rollback;
