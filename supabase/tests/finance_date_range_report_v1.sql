\set ON_ERROR_STOP on
begin;
select set_config('test.range_baseline',coalesce(sum(case when direction='inflow' then amount_paise else -amount_paise end),0)::text,true)
from public.financial_transactions where business_date<'2042-07-01';
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at)
select id,'00000000-0000-0000-0000-000000000000'::uuid,'authenticated','authenticated',email,'',now(),now(),now()
from (values ('91000000-0000-0000-0000-000000000001'::uuid,'range-president@example.invalid'),
 ('91000000-0000-0000-0000-000000000002'::uuid,'range-member@example.invalid')) u(id,email);
insert into public.application_users(id,auth_user_id,status) values
 ('92000000-0000-0000-0000-000000000001','91000000-0000-0000-0000-000000000001','active'),
 ('92000000-0000-0000-0000-000000000002','91000000-0000-0000-0000-000000000002','active');
insert into public.application_user_roles(application_user_id,role_id)
select u.id,r.id from (values
 ('92000000-0000-0000-0000-000000000001'::uuid,'president'),
 ('92000000-0000-0000-0000-000000000002'::uuid,'committee_member')) u(id,role_key)
join public.roles r on r.key=u.role_key;
insert into public.finance_accounts(id,name,account_type,created_by_application_user_id) values
 ('93000000-0000-0000-0000-000000000001','Range cash','cash','92000000-0000-0000-0000-000000000001'),
 ('93000000-0000-0000-0000-000000000002','Range bank','bank','92000000-0000-0000-0000-000000000001');
insert into public.financial_transactions(finance_account_id,transaction_category,direction,amount_paise,
 business_date,reference_type,reference_id,operation_id,created_by_application_user_id) values
 ('93000000-0000-0000-0000-000000000001','DONATION_ANONYMOUS','inflow',10000,
  '2042-06-30','anonymous_donation','94000000-0000-0000-0000-000000000001','range-opening','92000000-0000-0000-0000-000000000001'),
 ('93000000-0000-0000-0000-000000000001','DONATION_RECURRING','inflow',2500,
  '2042-07-01','donation_payment','94000000-0000-0000-0000-000000000002','range-donation','92000000-0000-0000-0000-000000000001'),
 ('93000000-0000-0000-0000-000000000001','EXPENSE','outflow',1000,
  '2042-07-02','finance_expense','94000000-0000-0000-0000-000000000003','range-expense','92000000-0000-0000-0000-000000000001'),
 ('93000000-0000-0000-0000-000000000001','TRANSFER_OUT','outflow',500,
  '2042-07-02','finance_transfer','94000000-0000-0000-0000-000000000004','range-transfer','92000000-0000-0000-0000-000000000001'),
 ('93000000-0000-0000-0000-000000000002','TRANSFER_IN','inflow',500,
  '2042-07-02','finance_transfer','94000000-0000-0000-0000-000000000004','range-transfer','92000000-0000-0000-0000-000000000001');

select set_config('request.jwt.claims','{"sub":"91000000-0000-0000-0000-000000000002","role":"authenticated"}',true);
set local role authenticated;
do $$ declare v jsonb; begin
  if has_table_privilege('authenticated','public.financial_transactions','INSERT') then
    raise exception 'FAIL: report readers can insert ledger'; end if;
  select public.get_finance_date_range_report('2042-07-01','2042-07-02') into v;
  if (v->'summary'->>'opening_balance_paise')::bigint<>current_setting('test.range_baseline')::bigint+10000
    or (v->'summary'->>'donation_inflow_paise')::bigint<>2500
    or (v->'summary'->>'expense_outflow_paise')::bigint<>1000
    or (v->'summary'->>'transfer_in_paise')::bigint<>500
    or (v->'summary'->>'transfer_out_paise')::bigint<>500
    or (v->'summary'->>'closing_balance_paise')::bigint<>current_setting('test.range_baseline')::bigint+11500
    or (v->'summary'->>'transaction_count')::bigint<>4
    or jsonb_array_length(v->'ledger')<>4 then
    raise exception 'FAIL: date range ledger totals wrong: %',v->'summary'; end if;
  if (select count(*) from public.financial_transactions where finance_account_id='93000000-0000-0000-0000-000000000001')<>0 then
    raise exception 'FAIL: report reader has direct ledger access'; end if;
  begin perform public.get_finance_date_range_report('2042-07-02','2042-07-01');
    raise exception 'FAIL: reversed range allowed';
  exception when invalid_parameter_value then null; end;
  begin perform public.get_finance_date_range_report('2042-01-01','2043-01-02');
    raise exception 'FAIL: oversized range allowed';
  exception when invalid_parameter_value then null; end;
end $$;
reset role;
select set_config('request.jwt.claims','{"sub":"91000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
set local role authenticated;
do $$ begin
  if (select (public.get_finance_date_range_report('2042-07-02','2042-07-02')->'summary'->>'transaction_count')::bigint)<>3 then
    raise exception 'FAIL: inclusive single day range wrong'; end if;
end $$;
reset role;
set local role anon;
do $$ begin
  if has_function_privilege('anon','public.get_finance_date_range_report(date,date)','EXECUTE') then
    raise exception 'FAIL: anonymous report access'; end if;
end $$;
reset role;
rollback;
