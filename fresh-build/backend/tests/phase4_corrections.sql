-- Run on a disposable fresh project after all migrations: psql -v ON_ERROR_STOP=1 -f tests/phase4_corrections.sql
begin;
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at)
select id,'00000000-0000-0000-0000-000000000000'::uuid,'authenticated',
 'authenticated',email,'',now(),now(),now() from (values
 ('c1000000-0000-0000-0000-000000000001'::uuid,'correctionp@example.invalid'),
 ('c1000000-0000-0000-0000-000000000002'::uuid,'correctiont@example.invalid'),
 ('c1000000-0000-0000-0000-000000000003'::uuid,'correctionm@example.invalid')) f(id,email);
insert into public.app_users(id,role) values
 ('c1000000-0000-0000-0000-000000000001','president'),
 ('c1000000-0000-0000-0000-000000000002','treasurer'),
 ('c1000000-0000-0000-0000-000000000003','member');
insert into app_private.username_aliases(user_id,username,must_change_password) values
 ('c1000000-0000-0000-0000-000000000001','correctionpresident',false),
 ('c1000000-0000-0000-0000-000000000002','correctiontreasurer',false),
 ('c1000000-0000-0000-0000-000000000003','correctionmember',false);
do $$ begin
 if has_table_privilege('authenticated','public.finance_corrections','INSERT')
  or has_table_privilege('anon','public.finance_correction_receipts','SELECT')
  or has_function_privilege('anon','public.correct_finance_posting(uuid,uuid,bigint,text,uuid)','EXECUTE')
  or has_function_privilege('anon','public.list_correctable_finance_effects(uuid)','EXECUTE') then
  raise exception 'correction privilege leak'; end if;
end $$;

-- Synthetic JWTs use the actor UUID as their test session ID.
insert into auth.sessions(id,user_id)
select u.id,u.id from auth.users u join public.app_users a on a.id=u.id
on conflict do nothing;

select set_config('request.jwt.claims',
 '{"sub":"c1000000-0000-0000-0000-000000000001","session_id":"c1000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select public.create_finance_account('Correction cash','cash',null,null,null,
 'c2000000-0000-0000-0000-000000000001') as account_id \gset
select set_config('correction.account',:'account_id',true);
reset role;
select set_config('request.jwt.claims',
 '{"sub":"c1000000-0000-0000-0000-000000000002","session_id":"c1000000-0000-0000-0000-000000000002","role":"authenticated"}',true);
set local role authenticated;
select public.submit_account_opening(current_setting('correction.account')::uuid,10000,
 'cash counted','c2000000-0000-0000-0000-000000000002') as opening_id \gset
select set_config('correction.opening',:'opening_id',true);
reset role;
select set_config('request.jwt.claims',
 '{"sub":"c1000000-0000-0000-0000-000000000001","session_id":"c1000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select public.verify_account_opening(current_setting('correction.opening')::uuid,
 'c2000000-0000-0000-0000-000000000003');
select public.submit_one_time_donation('Donor','other',null,
 (now() at time zone 'Asia/Kolkata')::date,'cash',1500,'slip reference',
 'c2000000-0000-0000-0000-000000000004') as donation_id \gset
select set_config('correction.donation',:'donation_id',true);
select public.submit_expense_request('Test repair','Replace broken equipment','maintenance',
 1000,'bill reference',null,'c2000000-0000-0000-0000-000000000009') as expense_id \gset
select set_config('correction.expense',:'expense_id',true);
reset role;
select set_config('request.jwt.claims',
 '{"sub":"c1000000-0000-0000-0000-000000000002","session_id":"c1000000-0000-0000-0000-000000000002","role":"authenticated"}',true);
set local role authenticated;
select public.decide_one_time_donation(current_setting('correction.donation')::uuid,'verify',1200,
 current_setting('correction.account')::uuid,null,'c2000000-0000-0000-0000-000000000005');
select effect_id from public.list_finance_account_history(current_setting('correction.account')::uuid)
 where source_type='one_time_donation' \gset
select set_config('correction.effect',:'effect_id',true);
select public.correct_finance_posting(current_setting('correction.effect')::uuid,
 current_setting('correction.account')::uuid,900,'Bank count revised',
 'c2000000-0000-0000-0000-000000000006') as correction_id \gset
select set_config('correction.id',:'correction_id',true);
do $$ declare v_balance text; begin
 select balance_paise into v_balance from public.list_finance_accounts()
 where account_id=current_setting('correction.account')::uuid;
 if v_balance<>'10900' or (select count(*) from public.list_finance_account_history(
  current_setting('correction.account')::uuid) where source_type='correction'
  and source_id=current_setting('correction.id')::uuid)<>2 then
  raise exception 'correction effects did not reconcile'; end if;
 if exists(select 1 from public.list_correctable_finance_effects(
  current_setting('correction.account')::uuid)
  where effect_id=current_setting('correction.effect')::uuid)
  or not exists(select 1 from public.list_correctable_finance_effects(
  current_setting('correction.account')::uuid) where effective_kind='one_time_donation'
  and amount_paise='900') then
  raise exception 'correction eligibility chain is wrong'; end if;
 begin
  perform public.correct_finance_posting(current_setting('correction.effect')::uuid,null,null,
   'Wrong second correction','c2000000-0000-0000-0000-000000000007');
  raise exception 'duplicate correction accepted';
 exception when unique_violation then null; end;
end $$;
select effect_id from public.list_finance_account_history(current_setting('correction.account')::uuid)
 where source_type='correction' and source_id=current_setting('correction.id')::uuid
 and leg=2 \gset
select public.correct_finance_posting(:'effect_id'::uuid,
 current_setting('correction.account')::uuid,800,'Second donor count revision',
 'c2000000-0000-0000-0000-000000000015') as second_correction_id \gset
select set_config('correction.second_id',:'second_correction_id',true);
select public.decide_expense_request(current_setting('correction.expense')::uuid,'approve',null,
 'c2000000-0000-0000-0000-000000000010');
select public.post_expense_payment(current_setting('correction.expense')::uuid,
 current_setting('correction.account')::uuid,1000,'cash',
 (now() at time zone 'Asia/Kolkata')::date,'expense proof',
 'c2000000-0000-0000-0000-000000000011') as payment_id \gset
select effect_id from public.list_finance_account_history(current_setting('correction.account')::uuid)
 where source_type='expense_payment' and source_id=:'payment_id'::uuid \gset
select set_config('correction.payment_effect',:'effect_id',true);
select public.correct_finance_posting(current_setting('correction.payment_effect')::uuid,
 null,null,'Payment was not made','c2000000-0000-0000-0000-000000000012');
reset role;
do $$ begin
 if (select status from public.expense_requests where id=current_setting('correction.expense')::uuid)<>'approved'
  or app_private.expense_effective_paid(current_setting('correction.expense')::uuid)<>0 then
  raise exception 'voided expense was not reopened'; end if;
end $$;
set local role authenticated;
select public.post_expense_payment(current_setting('correction.expense')::uuid,
 current_setting('correction.account')::uuid,800,'cash',
 (now() at time zone 'Asia/Kolkata')::date,'new expense proof',
 'c2000000-0000-0000-0000-000000000013') as replacement_payment_id \gset
select effect_id from public.list_finance_account_history(current_setting('correction.account')::uuid)
 where source_type='expense_payment' and source_id=:'replacement_payment_id'::uuid \gset
select public.correct_finance_posting(:'effect_id'::uuid,
 current_setting('correction.account')::uuid,-700,'Payment amount revised',
 'c2000000-0000-0000-0000-000000000014');
reset role;
do $$ begin
 if (select status from public.expense_requests where id=current_setting('correction.expense')::uuid)<>'partially_paid'
  or app_private.expense_effective_paid(current_setting('correction.expense')::uuid)<>700 then
  raise exception 'replacement expense did not reconcile'; end if;
end $$;
-- Rebuild the effective balance from every immutable source, including both
-- levels of the donation chain and both expense revisions.
do $$ declare v_account uuid:=current_setting('correction.account')::uuid;
begin
 if (select count(*) from public.finance_effects where account_id=v_account)<>11
  or (select coalesce(sum(amount_paise::numeric),0) from public.finance_effects
      where account_id=v_account)<>10100
  or (select balance_paise from public.list_finance_accounts()
      where account_id=v_account)<>'10100' then
  raise exception 'corrected account equation failed'; end if;
 if (select coalesce(sum(amount_paise::numeric),0) from public.finance_effects
      where account_id=v_account and source_type='account_opening')<>10000
  or (select coalesce(sum(amount_paise::numeric),0) from public.finance_effects
      where account_id=v_account and source_type='one_time_donation')<>1200
  or (select coalesce(sum(amount_paise::numeric),0) from public.finance_effects
      where account_id=v_account and source_type='expense_payment')<>-1800
  or (select coalesce(sum(amount_paise::numeric),0) from public.finance_effects
      where account_id=v_account and source_type='correction')<>700
  or (select count(*) from public.finance_effects
      where account_id=v_account and source_type='correction')<>7 then
  raise exception 'corrected source totals or legs failed'; end if;
 if (select count(*) from public.finance_corrections)<>4
  or (select count(*) from public.finance_correction_receipts)<>2 then
  raise exception 'correction chain or replacement receipt count failed'; end if;
 if (select receipt_state from public.finance_receipt_state(
    (select code from public.finance_correction_receipts
      where correction_id=current_setting('correction.id')::uuid)))<>'superseded'
  or (select receipt_state from public.finance_receipt_state(
    (select code from public.finance_correction_receipts
      where correction_id=current_setting('correction.second_id')::uuid)))<>'active' then
  raise exception 'correction receipt chain state failed'; end if;
end $$;
select set_config('request.jwt.claims',
 '{"sub":"c1000000-0000-0000-0000-000000000003","session_id":"c1000000-0000-0000-0000-000000000003","role":"authenticated"}',true);
set local role authenticated;
do $$ begin
 begin
  perform public.correct_finance_posting(current_setting('correction.effect')::uuid,null,null,
   'Member cannot correct','c2000000-0000-0000-0000-000000000008');
  raise exception 'member corrected finance';
 exception when insufficient_privilege then null; end;
end $$;
rollback;
