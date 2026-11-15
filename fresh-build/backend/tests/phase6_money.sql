-- Run against a fresh migrated development database: psql -v ON_ERROR_STOP=1 -f tests/phase6_money.sql
begin;
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at)
select id,'00000000-0000-0000-0000-000000000000'::uuid,'authenticated',
 'authenticated',email,'',now(),now(),now() from (values
 ('d1000000-0000-0000-0000-000000000001'::uuid,'phase6p@example.invalid'),
 ('d1000000-0000-0000-0000-000000000002'::uuid,'phase6t@example.invalid'),
 ('d1000000-0000-0000-0000-000000000003'::uuid,'phase6m@example.invalid')) f(id,email);
insert into public.app_users(id,role) values
 ('d1000000-0000-0000-0000-000000000001','president'),
 ('d1000000-0000-0000-0000-000000000002','treasurer'),
 ('d1000000-0000-0000-0000-000000000003','member');
insert into app_private.username_aliases(user_id,username,must_change_password) values
 ('d1000000-0000-0000-0000-000000000001','phase6president',false),
 ('d1000000-0000-0000-0000-000000000002','phase6treasurer',false),
 ('d1000000-0000-0000-0000-000000000003','phase6member',false);
do $$ begin
 if has_table_privilege('authenticated','public.one_time_donations','SELECT')
 or has_table_privilege('authenticated','public.expense_payments','INSERT')
 or has_function_privilege('anon','public.post_expense_payment(uuid,uuid,bigint,text,date,text,uuid)','EXECUTE')
 or has_table_privilege('authenticated','public.direct_cash_posts','SELECT')
 or has_function_privilege('anon','public.post_direct_treasurer_cash(text,text,uuid,date,bigint,text,uuid,uuid)','EXECUTE')
 or has_function_privilege('anon','public.list_pending_one_time_donations()','EXECUTE')
 or has_function_privilege('anon','public.list_actionable_expenses()','EXECUTE') then
 raise exception 'phase6 direct privilege leak'; end if;
end $$;

-- Synthetic JWTs use the actor UUID as their test session ID.
insert into auth.sessions(id,user_id)
select u.id,u.id from auth.users u join public.app_users a on a.id=u.id
on conflict do nothing;

select set_config('request.jwt.claims',
 '{"sub":"d1000000-0000-0000-0000-000000000001","session_id":"d1000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select public.create_finance_account('Phase6 cash','cash',null,null,null,
 'd2000000-0000-0000-0000-000000000001') as account_id \gset
select set_config('phase6.account',:'account_id',true);
reset role;
select set_config('request.jwt.claims',
 '{"sub":"d1000000-0000-0000-0000-000000000002","session_id":"d1000000-0000-0000-0000-000000000002","role":"authenticated"}',true);
set local role authenticated;
select public.submit_account_opening(current_setting('phase6.account')::uuid,100000,
 'counted cash','d2000000-0000-0000-0000-000000000002') as opening_id \gset
select set_config('phase6.opening',:'opening_id',true);
reset role;
select set_config('request.jwt.claims',
 '{"sub":"d1000000-0000-0000-0000-000000000001","session_id":"d1000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select public.verify_account_opening(current_setting('phase6.opening')::uuid,
 'd2000000-0000-0000-0000-000000000003');
select public.submit_one_time_donation('Donor A','other',null,current_date,'cash',20000,
 'cash collection slip','d2000000-0000-0000-0000-000000000004') as donation_id \gset
select set_config('phase6.donation',:'donation_id',true);
do $$ begin
 begin
 perform public.list_pending_one_time_donations();
 raise exception 'President saw Treasurer donation queue';
 exception when insufficient_privilege then null; end;
 if (select balance_paise from public.list_finance_accounts()
   where account_id=current_setting('phase6.account')::uuid)<>'100000' then
 raise exception 'pending donation posted'; end if;
 begin
 perform public.decide_one_time_donation(current_setting('phase6.donation')::uuid,'verify',15000,
 current_setting('phase6.account')::uuid,null,'d2000000-0000-0000-0000-000000000005');
 raise exception 'President verified donation';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claims',
 '{"sub":"d1000000-0000-0000-0000-000000000002","session_id":"d1000000-0000-0000-0000-000000000002","role":"authenticated"}',true);
set local role authenticated;
do $$ begin
 if not exists(select 1 from public.list_pending_one_time_donations()
   where donation_id=current_setting('phase6.donation')::uuid) then
  raise exception 'pending donation missing from Treasurer queue'; end if;
end $$;
select public.decide_one_time_donation(current_setting('phase6.donation')::uuid,'verify',15000,
 current_setting('phase6.account')::uuid,null,'d2000000-0000-0000-0000-000000000005');
select public.decide_one_time_donation(current_setting('phase6.donation')::uuid,'verify',15000,
 current_setting('phase6.account')::uuid,null,'d2000000-0000-0000-0000-000000000005');
do $$ begin
 if (select balance_paise from public.list_finance_accounts()
   where account_id=current_setting('phase6.account')::uuid)<>'115000' then
 raise exception 'donation replay affected balance'; end if;
end $$;
select public.submit_expense_request('Repair','Fix wiring','maintenance',50000,
 'bill 17',null,'d2000000-0000-0000-0000-000000000006') as expense_id \gset
select set_config('phase6.expense',:'expense_id',true);
do $$ begin
 if exists(select 1 from public.list_actionable_expenses()
   where expense_id=current_setting('phase6.expense')::uuid) then
  raise exception 'Treasurer self approval appeared in queue'; end if;
 begin
 perform public.post_expense_payment(current_setting('phase6.expense')::uuid,
 current_setting('phase6.account')::uuid,10000,'cash',current_date,'paid receipt',
 'd2000000-0000-0000-0000-000000000007');
 raise exception 'unapproved expense paid';
 exception when invalid_parameter_value then null; end;
 begin
 perform public.decide_expense_request(current_setting('phase6.expense')::uuid,'approve',null,
 'd2000000-0000-0000-0000-000000000008');
 raise exception 'Treasurer self approved';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claims',
 '{"sub":"d1000000-0000-0000-0000-000000000001","session_id":"d1000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
set local role authenticated;
do $$ begin
 if not exists(select 1 from public.list_actionable_expenses()
  where expense_id=current_setting('phase6.expense')::uuid and status='submitted') then
  raise exception 'President approval queue missing expense'; end if;
end $$;
select public.decide_expense_request(current_setting('phase6.expense')::uuid,'approve',null,
 'd2000000-0000-0000-0000-000000000008');
reset role;
select set_config('request.jwt.claims',
 '{"sub":"d1000000-0000-0000-0000-000000000002","session_id":"d1000000-0000-0000-0000-000000000002","role":"authenticated"}',true);
set local role authenticated;
do $$ begin
 if not exists(select 1 from public.list_actionable_expenses()
  where expense_id=current_setting('phase6.expense')::uuid and status='approved') then
  raise exception 'Treasurer payment queue missing approved expense'; end if;
end $$;
select public.post_expense_payment(current_setting('phase6.expense')::uuid,
 current_setting('phase6.account')::uuid,20000,'cash',current_date,'paid receipt',
 'd2000000-0000-0000-0000-000000000009') as payment_id \gset
select public.post_expense_payment(current_setting('phase6.expense')::uuid,
 current_setting('phase6.account')::uuid,20000,'cash',current_date,'paid receipt',
 'd2000000-0000-0000-0000-000000000009') as replay_id \gset
select set_config('phase6.payment',:'payment_id',true),set_config('phase6.replay',:'replay_id',true);
do $$ begin
 if current_setting('phase6.payment')<>current_setting('phase6.replay') then
 raise exception 'payment replay changed id'; end if;
 if (select balance_paise from public.list_finance_accounts()
   where account_id=current_setting('phase6.account')::uuid)<>'95000' then
 raise exception 'payment replay affected balance'; end if;
 begin
 perform public.post_expense_payment(current_setting('phase6.expense')::uuid,
 current_setting('phase6.account')::uuid,30001,'cash',current_date,'paid receipt',
 'd2000000-0000-0000-0000-000000000010');
 raise exception 'overpayment accepted';
 exception when invalid_parameter_value then null; end;
end $$;
select public.post_expense_payment(current_setting('phase6.expense')::uuid,
 current_setting('phase6.account')::uuid,30000,'cash',current_date,'paid receipt',
 'd2000000-0000-0000-0000-000000000011');
reset role;
do $$ begin
 if (select status from public.expense_requests where id=current_setting('phase6.expense')::uuid)<>'paid'
 or (select balance_paise from public.list_finance_accounts()
   where account_id=current_setting('phase6.account')::uuid)<>'65000' then
 raise exception 'partial/full expense transition failed'; end if;
 if (select count(*) from public.finance_effects
     where account_id=current_setting('phase6.account')::uuid)<>4
  or (select coalesce(sum(amount_paise::numeric),0) from public.finance_effects
     where account_id=current_setting('phase6.account')::uuid)<>65000
  or (select coalesce(sum(amount_paise::numeric),0) from public.finance_effects
     where account_id=current_setting('phase6.account')::uuid
       and source_type='account_opening')<>100000
  or (select coalesce(sum(amount_paise::numeric),0) from public.finance_effects
     where account_id=current_setting('phase6.account')::uuid
       and source_type='one_time_donation')<>15000
  or (select coalesce(sum(amount_paise::numeric),0) from public.finance_effects
     where account_id=current_setting('phase6.account')::uuid
       and source_type='expense_payment')<>-50000 then
 raise exception 'donation and expense source equation failed'; end if;
end $$;
-- A direct Treasurer cash donation atomically submits, verifies and posts.
select set_config('request.jwt.claims',
 '{"sub":"d1000000-0000-0000-0000-000000000003","session_id":"d1000000-0000-0000-0000-000000000003","role":"authenticated"}',true);
set local role authenticated;
do $$ begin
 begin
  perform public.post_direct_treasurer_cash('Named cash donor','other',null,current_date,
   1234,'numbered cash slip',current_setting('phase6.account')::uuid,
   'd2000000-0000-0000-0000-000000000012');
  raise exception 'Member posted direct cash';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claims',
 '{"sub":"d1000000-0000-0000-0000-000000000002","session_id":"d1000000-0000-0000-0000-000000000002","role":"authenticated"}',true);
set local role authenticated;
do $$ begin
 begin
  perform public.post_direct_treasurer_cash('Named cash donor','other',null,current_date,
   1234,'numbered cash slip','d2000000-0000-0000-0000-000000000099',
   'd2000000-0000-0000-0000-000000000013');
  raise exception 'invalid account posted cash';
 exception when invalid_parameter_value or foreign_key_violation then null; end;
end $$;
select public.post_direct_treasurer_cash('Named cash donor','other',null,current_date,
 1234,'numbered cash slip',current_setting('phase6.account')::uuid,
 'd2000000-0000-0000-0000-000000000012') as direct_id \gset
select public.post_direct_treasurer_cash('Named cash donor','other',null,current_date,
 1234,'numbered cash slip',current_setting('phase6.account')::uuid,
 'd2000000-0000-0000-0000-000000000012') as direct_replay \gset
select set_config('phase6.direct',:'direct_id',true),
 set_config('phase6.direct_replay',:'direct_replay',true);
do $$ begin
 begin
  perform public.post_direct_treasurer_cash('Named cash donor','other',null,current_date,
   1235,'numbered cash slip',current_setting('phase6.account')::uuid,
   'd2000000-0000-0000-0000-000000000012');
  raise exception 'changed direct cash replay accepted';
 exception when unique_violation then null; end;
 begin
  perform public.post_direct_treasurer_cash('Named cash donor','other',null,current_date,
   1234,' NUMBERED CASH SLIP ',current_setting('phase6.account')::uuid,
   'd2000000-0000-0000-0000-000000000015');
  raise exception 'same slip posted under a new operation ID';
 exception when unique_violation then null; end;
end $$;
select public.submit_one_time_donation('Separate pending donor','other',null,current_date,
 'cash',500,'pending count slip','d2000000-0000-0000-0000-000000000014');
do $$ begin
 begin
  perform public.post_direct_treasurer_cash('Separate pending donor','other',null,current_date,
   500,'pending count slip',current_setting('phase6.account')::uuid,
   'd2000000-0000-0000-0000-000000000014');
  raise exception 'pending donation was silently direct-posted';
 exception when unique_violation then null; end;
end $$;
reset role;
do $$ begin
 if current_setting('phase6.direct')<>current_setting('phase6.direct_replay') then
  raise exception 'direct cash replay changed id'; end if;
 if (select count(*) from public.direct_cash_posts)<>1
  or (select count(*) from public.finance_effects
      where source_type='one_time_donation' and source_id=current_setting('phase6.direct')::uuid)<>1
  or (select status from public.one_time_donations
      where id=current_setting('phase6.direct')::uuid)<>'verified'
  or (select receipt_code from public.one_time_donations
      where id=current_setting('phase6.direct')::uuid) is null
  or (select balance_paise from public.list_finance_accounts()
      where account_id=current_setting('phase6.account')::uuid)<>'66234'
  or exists(select 1 from public.one_time_donations
      where submit_operation_id='d2000000-0000-0000-0000-000000000013') then
  raise exception 'direct cash accounting or atomic failure'; end if;
end $$;
rollback;
