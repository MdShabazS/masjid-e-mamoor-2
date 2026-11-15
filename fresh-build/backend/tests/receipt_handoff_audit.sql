-- Rollback-only synthetic audit of the default-off staff receipt handoff.
begin;
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at)
select id,'00000000-0000-0000-0000-000000000000'::uuid,'authenticated','authenticated',email,'',now(),now(),now()
from (values
 ('f1000000-0000-0000-0000-000000000001'::uuid,'handoff-treasurer@example.invalid'),
 ('f1000000-0000-0000-0000-000000000002'::uuid,'handoff-committee@example.invalid'),
 ('f1000000-0000-0000-0000-000000000003'::uuid,'handoff-member@example.invalid'),
 ('f1000000-0000-0000-0000-000000000004'::uuid,'handoff-president@example.invalid')) fixture(id,email);
insert into public.app_users(id,role) values
 ('f1000000-0000-0000-0000-000000000001','treasurer'),
 ('f1000000-0000-0000-0000-000000000002','committee_member'),
 ('f1000000-0000-0000-0000-000000000003','member'),
 ('f1000000-0000-0000-0000-000000000004','president');
insert into app_private.username_aliases(user_id,username,must_change_password) values
 ('f1000000-0000-0000-0000-000000000001','handofftreasurer',false),
 ('f1000000-0000-0000-0000-000000000002','handoffcommittee',false),
 ('f1000000-0000-0000-0000-000000000003','handoffmember',false),
 ('f1000000-0000-0000-0000-000000000004','handoffpresident',false);
insert into auth.sessions(id,user_id)
select id,id from public.app_users where id::text like 'f1000000-0000-0000-0000-%';
insert into public.masjid_accounts(id,name,kind)
values ('f2000000-0000-0000-0000-000000000001','Synthetic receipt cash','cash');
insert into public.one_time_donations(id,submit_operation_id,donor_name,donor_kind,
 donation_date,payment_method,claimed_amount_paise,evidence_reference,submitted_by,
 status,decision_operation_id,decided_by,decided_at,actual_amount_paise,account_id,receipt_code)
values ('f3000000-0000-0000-0000-000000000001',
 'f3000000-0000-0000-0000-000000000002','Synthetic donor','other',current_date,
 'cash',15000,'synthetic counted slip',
 'f1000000-0000-0000-0000-000000000002','verified',
 'f3000000-0000-0000-0000-000000000003',
 'f1000000-0000-0000-0000-000000000001',now(),12345,
 'f2000000-0000-0000-0000-000000000001',
 'f4000000-0000-0000-0000-000000000001');
insert into public.finance_effects(account_id,source_type,source_id,leg,amount_paise)
values ('f2000000-0000-0000-0000-000000000001','one_time_donation',
 'f3000000-0000-0000-0000-000000000001',0,12345);
select set_config('handoff.effect',(select id::text from public.finance_effects
 where source_type='one_time_donation' and source_id='f3000000-0000-0000-0000-000000000001'),true);

do $$ begin
 if (select enabled from app_private.receipt_handoff_policy where id)
  or has_table_privilege('authenticated','public.receipt_handoff_events','SELECT')
  or has_table_privilege('authenticated','app_private.receipt_handoff_policy','SELECT')
  or has_function_privilege('anon',
   'public.record_manual_receipt_handoff(uuid,text,text,text,text,text)','EXECUTE')
  or has_function_privilege('anon',
   'public.manual_receipt_handoff_enabled()','EXECUTE') then
   raise exception 'receipt handoff exposed before approval'; end if;
end $$;
select set_config('request.jwt.claims',
 '{"sub":"f1000000-0000-0000-0000-000000000001","session_id":"f1000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
set local role authenticated;
do $$ begin
 if public.manual_receipt_handoff_enabled() then
  raise exception 'unapproved handoff shown as enabled'; end if;
 begin
  perform public.record_manual_receipt_handoff('f5000000-0000-0000-0000-000000000001',
   'f4000000-0000-0000-0000-000000000001','donation:f3000000','in_person',
   'delivered','signed synthetic receipt copy');
  raise exception 'unapproved handoff was accepted';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
update app_private.receipt_handoff_policy set enabled=true,
 decision_reference='synthetic rollback-only Board gate' where id;

select set_config('request.jwt.claims',
 '{"sub":"f1000000-0000-0000-0000-000000000003","session_id":"f1000000-0000-0000-0000-000000000003","role":"authenticated"}',true);
set local role authenticated;
do $$ begin
 begin
  perform public.manual_receipt_handoff_enabled();
  raise exception 'member handoff capability was visible';
 exception when insufficient_privilege then null; end;
 begin
  perform public.record_manual_receipt_handoff('f5000000-0000-0000-0000-000000000001',
   'f4000000-0000-0000-0000-000000000001','donation:f3000000','in_person',
   'delivered','signed synthetic receipt copy');
  raise exception 'member handoff was accepted';
 exception when insufficient_privilege then null; end;
end $$;
reset role;

select set_config('request.jwt.claims',
 '{"sub":"f1000000-0000-0000-0000-000000000004","session_id":"f1000000-0000-0000-0000-000000000004","role":"authenticated"}',true);
set local role authenticated;
do $$ begin
 begin
  perform public.manual_receipt_handoff_enabled();
  raise exception 'president handoff capability was visible';
 exception when insufficient_privilege then null; end;
 begin
  perform public.record_manual_receipt_handoff('f5000000-0000-0000-0000-000000000005',
   'f4000000-0000-0000-0000-000000000001','donation:f3000000','in_person',
   'delivered','signed synthetic receipt copy');
  raise exception 'president handoff write was accepted';
 exception when insufficient_privilege then null; end;
end $$;
reset role;

select set_config('request.jwt.claims',
 '{"sub":"f1000000-0000-0000-0000-000000000002","session_id":"f1000000-0000-0000-0000-000000000002","role":"authenticated"}',true);
set local role authenticated;
do $$ begin
 if not public.manual_receipt_handoff_enabled() then
  raise exception 'approved committee handoff not enabled'; end if;
 if public.record_manual_receipt_handoff('f5000000-0000-0000-0000-000000000001',
   'f4000000-0000-0000-0000-000000000001','donation:f3000000','in_person',
   'delivered','signed synthetic receipt copy')<>
   'f5000000-0000-0000-0000-000000000001' then
    raise exception 'committee handoff not recorded'; end if;
 if public.record_manual_receipt_handoff('f5000000-0000-0000-0000-000000000001',
   'f4000000-0000-0000-0000-000000000001','donation:f3000000','in_person',
   'delivered','signed synthetic receipt copy')<>
   'f5000000-0000-0000-0000-000000000001' then
    raise exception 'handoff retry not idempotent'; end if;
 begin
  perform public.record_manual_receipt_handoff('f5000000-0000-0000-0000-000000000001',
   'f4000000-0000-0000-0000-000000000001','donation:f3000000','in_person',
   'failed','signed synthetic receipt copy');
  raise exception 'operation conflict accepted';
 exception when unique_violation then null; end;
 begin
  perform public.record_manual_receipt_handoff('f5000000-0000-0000-0000-000000000002',
   'f4000000-0000-0000-0000-000000000001','donation:f3000000','whatsapp',
   'delivered','synthetic consent claim');
  raise exception 'WhatsApp handoff accepted';
 exception when invalid_parameter_value then null; end;
 begin
  perform public.record_manual_receipt_handoff('f5000000-0000-0000-0000-000000000003',
   'f4000000-0000-0000-0000-000000000099','donation:f3000000','in_person',
   'delivered','synthetic copy');
  raise exception 'unknown receipt handoff accepted';
 exception when invalid_parameter_value then null; end;
end $$;
reset role;
do $$ begin
 if (select amount_paise from public.receipt_handoff_events
   where operation_id='f5000000-0000-0000-0000-000000000001')<>12345
   or (select count(*) from public.receipt_handoff_events)<>1 then
  raise exception 'handoff changed amount or duplicated row'; end if;
end $$;

select set_config('request.jwt.claims',
 '{"sub":"f1000000-0000-0000-0000-000000000001","session_id":"f1000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select public.correct_finance_posting(current_setting('handoff.effect')::uuid,null,null,
 'synthetic void after receipt handoff','f6000000-0000-0000-0000-000000000001');
do $$ begin
 begin
  perform public.record_manual_receipt_handoff('f5000000-0000-0000-0000-000000000004',
   'f4000000-0000-0000-0000-000000000001','donation:f3000000','in_person',
   'delivered','late synthetic copy');
  raise exception 'superseded receipt handoff accepted';
 exception when invalid_parameter_value then null; end;
end $$;
reset role;
do $$ begin
 if (select count(*) from public.receipt_handoff_events)<>1
   or (select count(*) from public.finance_effects where source_type='one_time_donation')<>1 then
  raise exception 'handoff changed finance'; end if;
end $$;
rollback;
