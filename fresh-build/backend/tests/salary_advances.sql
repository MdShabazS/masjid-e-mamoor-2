-- Rollback-only salary and advance scenarios, including report reconciliation.
begin;
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at)
select id,'00000000-0000-0000-0000-000000000000'::uuid,'authenticated','authenticated',email,'',now(),now(),now()
from (values
 ('d1000000-0000-0000-0000-000000000001'::uuid,'sap@example.invalid'),
 ('d1000000-0000-0000-0000-000000000002'::uuid,'sat@example.invalid'),
 ('d1000000-0000-0000-0000-000000000003'::uuid,'savp@example.invalid'),
 ('d1000000-0000-0000-0000-000000000004'::uuid,'sam@example.invalid'),
 ('d1000000-0000-0000-0000-000000000005'::uuid,'sade@example.invalid')) f(id,email);
insert into public.app_users(id,role) values
 ('d1000000-0000-0000-0000-000000000001','president'),
 ('d1000000-0000-0000-0000-000000000002','treasurer'),
 ('d1000000-0000-0000-0000-000000000003','vice_president'),
 ('d1000000-0000-0000-0000-000000000004','member'),
 ('d1000000-0000-0000-0000-000000000005','data_entry');
insert into app_private.username_aliases(user_id,username,must_change_password) values
 ('d1000000-0000-0000-0000-000000000001','sapres',false),
 ('d1000000-0000-0000-0000-000000000002','satreas',false),
 ('d1000000-0000-0000-0000-000000000003','savice',false),
 ('d1000000-0000-0000-0000-000000000004','samember',false),
 ('d1000000-0000-0000-0000-000000000005','saentry',false);
insert into auth.sessions(id,user_id,created_at,updated_at)
select id,id,now(),now() from auth.users where email like 'sa%@example.invalid';

do $$ begin
 if has_table_privilege('authenticated','public.salary_payments','SELECT')
  or has_table_privilege('authenticated','public.advance_requests','SELECT')
  or has_function_privilege('anon','public.list_salary_records(date)','EXECUTE') then
  raise exception 'salary or advance direct privilege leak'; end if;
 if (select count(*) from public.masjid_accounts where kind='advance')<>1 then
  raise exception 'advance holding account missing'; end if;
end $$;

select set_config('fixture.adv',(select id::text from public.masjid_accounts where kind='advance'),true);
-- A funded Cash account through the normal opening commands.
select set_config('request.jwt.claims','{"sub":"d1000000-0000-0000-0000-000000000001","session_id":"d1000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select public.create_finance_account('Fixture cash','cash',null,null,null,'d2000000-0000-0000-0000-000000000001') as cash \gset
reset role;
select set_config('fixture.cash',:'cash',true);
select set_config('request.jwt.claims','{"sub":"d1000000-0000-0000-0000-000000000002","session_id":"d1000000-0000-0000-0000-000000000002","role":"authenticated"}',true);
set local role authenticated;
select public.submit_account_opening(current_setting('fixture.cash')::uuid,10000,'fixture count','d2000000-0000-0000-0000-000000000002') as opening \gset
reset role;
select set_config('request.jwt.claims','{"sub":"d1000000-0000-0000-0000-000000000001","session_id":"d1000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select public.verify_account_opening(:'opening'::uuid,'d2000000-0000-0000-0000-000000000003');
-- President may add staff; the member view stays closed until the Board flag is set.
select public.add_salary_staff('Fixture Hafiz','hafiz',3000,'d2000000-0000-0000-0000-000000000010') as staff \gset
select public.add_salary_staff('Fixture Hafiz','hafiz',3000,'d2000000-0000-0000-0000-000000000010');
reset role;
select set_config('fixture.staff',:'staff',true);

select set_config('request.jwt.claims','{"sub":"d1000000-0000-0000-0000-000000000004","session_id":"d1000000-0000-0000-0000-000000000004","role":"authenticated"}',true);
set local role authenticated;
do $$ begin
 begin
  perform public.list_salary_records(date_trunc('month',now() at time zone 'Asia/Kolkata')::date);
  raise exception 'member read salary before approval';
 exception when insufficient_privilege then null; end;
 begin
  perform public.add_salary_staff('Forged','muezzin',100,gen_random_uuid());
  raise exception 'member added staff';
 exception when insufficient_privilege then null; end;
end $$;
reset role;

-- Treasurer: update amount, reject a no-op, pay once per month.
select set_config('request.jwt.claims','{"sub":"d1000000-0000-0000-0000-000000000002","session_id":"d1000000-0000-0000-0000-000000000002","role":"authenticated"}',true);
set local role authenticated;
select public.update_salary_staff(current_setting('fixture.staff')::uuid,3500,true,'Board raise','d2000000-0000-0000-0000-000000000011');
do $$
declare v_month date:=date_trunc('month',now() at time zone 'Asia/Kolkata')::date;
 v_today date:=(now() at time zone 'Asia/Kolkata')::date;
begin
 begin
  perform public.update_salary_staff(current_setting('fixture.staff')::uuid,3500,true,'same again',gen_random_uuid());
  raise exception 'unchanged staff accepted';
 exception when invalid_parameter_value then null; end;
 perform public.record_salary_payment(current_setting('fixture.staff')::uuid,v_month,
  current_setting('fixture.cash')::uuid,3500,v_today,'SAL-1','d2000000-0000-0000-0000-000000000012');
 perform public.record_salary_payment(current_setting('fixture.staff')::uuid,v_month,
  current_setting('fixture.cash')::uuid,3500,v_today,'SAL-1','d2000000-0000-0000-0000-000000000012');
 begin
  perform public.record_salary_payment(current_setting('fixture.staff')::uuid,v_month,
   current_setting('fixture.cash')::uuid,3500,v_today,'SAL-2',gen_random_uuid());
  raise exception 'salary paid twice for one month';
 exception when unique_violation then null; end;
 begin
  perform public.record_salary_payment(current_setting('fixture.staff')::uuid,(v_month-interval '1 month')::date,
   current_setting('fixture.adv')::uuid,100,v_today,'SAL-3',gen_random_uuid());
  raise exception 'salary paid from the advance account';
 exception when invalid_parameter_value then null; end;
end $$;
reset role;

-- Member requests an advance; nobody approves their own; VP approves the member's.
select set_config('request.jwt.claims','{"sub":"d1000000-0000-0000-0000-000000000004","session_id":"d1000000-0000-0000-0000-000000000004","role":"authenticated"}',true);
set local role authenticated;
select public.submit_advance_request('Fixture plumber','Repair materials',5000,'d2000000-0000-0000-0000-000000000020') as advance \gset
do $$ begin
 begin
  perform public.decide_advance_request(gen_random_uuid(),'approve',null,gen_random_uuid());
  raise exception 'member approved';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('fixture.advance',:'advance',true);
select set_config('request.jwt.claims','{"sub":"d1000000-0000-0000-0000-000000000003","session_id":"d1000000-0000-0000-0000-000000000003","role":"authenticated"}',true);
set local role authenticated;
select public.submit_advance_request('Self','Own advance',100,'d2000000-0000-0000-0000-000000000021') as own \gset
select public.decide_advance_request(current_setting('fixture.advance')::uuid,'approve',null,'d2000000-0000-0000-0000-000000000022');
select public.decide_advance_request(current_setting('fixture.advance')::uuid,'approve',null,'d2000000-0000-0000-0000-000000000022');
reset role;
select set_config('fixture.own',:'own',true);
select set_config('request.jwt.claims','{"sub":"d1000000-0000-0000-0000-000000000003","session_id":"d1000000-0000-0000-0000-000000000003","role":"authenticated"}',true);
set local role authenticated;
do $$ begin
 begin
  perform public.decide_advance_request(current_setting('fixture.own')::uuid,'approve',null,gen_random_uuid());
  raise exception 'self approval accepted';
 exception when insufficient_privilege then null; end;
end $$;
reset role;

-- Treasurer pays the advance, cannot use the reserved account elsewhere, then settles it.
select set_config('request.jwt.claims','{"sub":"d1000000-0000-0000-0000-000000000002","session_id":"d1000000-0000-0000-0000-000000000002","role":"authenticated"}',true);
set local role authenticated;
do $$
declare v_today date:=(now() at time zone 'Asia/Kolkata')::date;
begin
 begin
  perform public.pay_advance(current_setting('fixture.own')::uuid,current_setting('fixture.cash')::uuid,v_today,'ADV-X',gen_random_uuid());
  raise exception 'unapproved advance paid';
 exception when invalid_parameter_value then null; end;
 perform public.pay_advance(current_setting('fixture.advance')::uuid,current_setting('fixture.cash')::uuid,v_today,'ADV-1','d2000000-0000-0000-0000-000000000030');
 begin
  perform public.post_finance_transfer(current_setting('fixture.cash')::uuid,current_setting('fixture.adv')::uuid,100,'sneak in',gen_random_uuid());
  raise exception 'transfer into the advance account accepted';
 exception when invalid_parameter_value then
  if sqlerrm<>'advance_account_reserved' then raise; end if; end;
 perform public.settle_advance(current_setting('fixture.advance')::uuid,'bill',3000,null,'BILL-9','d2000000-0000-0000-0000-000000000031');
 perform public.settle_advance(current_setting('fixture.advance')::uuid,'bill',3000,null,'BILL-9','d2000000-0000-0000-0000-000000000031');
 begin
  perform public.settle_advance(current_setting('fixture.advance')::uuid,'bill',2500,null,'BILL-10',gen_random_uuid());
  raise exception 'advance oversettled';
 exception when invalid_parameter_value then null; end;
 perform public.settle_advance(current_setting('fixture.advance')::uuid,'return',2000,current_setting('fixture.cash')::uuid,'RET-1','d2000000-0000-0000-0000-000000000032');
 if (select status from public.list_advances() where advance_id=current_setting('fixture.advance')::uuid)<>'settled'
  or (select outstanding_paise from public.list_advances() where advance_id=current_setting('fixture.advance')::uuid)<>'0' then
  raise exception 'advance not settled'; end if;
end $$;
select public.request_finance_report('month',date_trunc('month',now() at time zone 'Asia/Kolkata')::date,
 (date_trunc('month',now() at time zone 'Asia/Kolkata')+interval '1 month')::date,false,
 'd2000000-0000-0000-0000-000000000040') as run \gset
reset role;
select set_config('fixture.run',:'run',true);
select set_config('request.jwt.claims','{"sub":"d1000000-0000-0000-0000-000000000002","session_id":"d1000000-0000-0000-0000-000000000002","role":"authenticated"}',true);
set local role authenticated;
do $$
declare v_cash record; v_adv record;
begin
 -- Cash: 10,000 opening − 3,500 salary − 5,000 advance + 2,000 returned = 3,500.
 select * into v_cash from public.list_finance_report_balances(current_setting('fixture.run')::uuid)
  where account_id=current_setting('fixture.cash')::uuid;
 select * into v_adv from public.list_finance_report_balances(current_setting('fixture.run')::uuid)
  where account_id=current_setting('fixture.adv')::uuid;
 if v_cash.expense_paise<>'3500' or v_cash.transfer_paise<>'-3000' or v_cash.closing_paise<>'3500'
  or v_adv.expense_paise<>'3000' or v_adv.transfer_paise<>'3000' or v_adv.closing_paise<>'0' then
  raise exception 'report balances wrong: cash %, advance %',row_to_json(v_cash),row_to_json(v_adv); end if;
 if exists(select 1 from public.list_finance_report_lines(current_setting('fixture.run')::uuid)
   where source_type in ('salary_payment','advance_settlement') and category<>'expense')
  or exists(select 1 from public.list_finance_report_lines(current_setting('fixture.run')::uuid)
   where source_type in ('advance_disbursement','advance_return') and category<>'transfer')
  or not exists(select 1 from public.list_finance_report_lines(current_setting('fixture.run')::uuid)
   where description like 'Salary: Fixture Hafiz%') then
  raise exception 'report categories or descriptions wrong'; end if;
end $$;
reset role;

-- Member sees only their own advance; after the Board flag, the salary projection opens.
insert into public.app_policy_flags(flag,enabled,decision_reference) values ('salary_member_view',true,'fixture minutes');
select set_config('request.jwt.claims','{"sub":"d1000000-0000-0000-0000-000000000004","session_id":"d1000000-0000-0000-0000-000000000004","role":"authenticated"}',true);
set local role authenticated;
do $$ begin
 if (select count(*) from public.list_advances())<>1 or not (select is_mine from public.list_advances()) then
  raise exception 'member advance scope wrong'; end if;
 if (select paid_amount_paise from public.list_salary_records(date_trunc('month',now() at time zone 'Asia/Kolkata')::date)
   where staff_name='Fixture Hafiz')<>'3500' then
  raise exception 'member salary projection wrong'; end if;
end $$;
reset role;
select set_config('request.jwt.claims','{"sub":"d1000000-0000-0000-0000-000000000005","session_id":"d1000000-0000-0000-0000-000000000005","role":"authenticated"}',true);
set local role authenticated;
do $$ begin
 begin
  perform public.list_advances();
  raise exception 'data entry read advances';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
