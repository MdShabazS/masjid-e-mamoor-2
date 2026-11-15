-- psql -v ON_ERROR_STOP=1 -f tests/finance_foundation.sql (isolated dev DB).
begin;
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,
  email_confirmed_at,created_at,updated_at)
select id,'00000000-0000-0000-0000-000000000000'::uuid,'authenticated',
  'authenticated',email,'',now(),now(),now()
from (values
 ('c1000000-0000-0000-0000-000000000001'::uuid,'phase4p@example.invalid'),
 ('c1000000-0000-0000-0000-000000000002'::uuid,'phase4t@example.invalid'),
 ('c1000000-0000-0000-0000-000000000003'::uuid,'phase4m@example.invalid')
) fixture(id,email);
insert into public.app_users(id,role) values
 ('c1000000-0000-0000-0000-000000000001','president'),
 ('c1000000-0000-0000-0000-000000000002','treasurer'),
 ('c1000000-0000-0000-0000-000000000003','member');
insert into app_private.username_aliases(user_id,username,must_change_password) values
 ('c1000000-0000-0000-0000-000000000001','phase4president',false),
 ('c1000000-0000-0000-0000-000000000002','phase4treasurer',false),
 ('c1000000-0000-0000-0000-000000000003','phase4member',false);

do $$ begin
 if has_table_privilege('authenticated','public.finance_effects','INSERT')
    or has_table_privilege('authenticated','public.finance_effects','SELECT')
    or has_table_privilege('anon','public.account_openings','SELECT')
    or has_table_privilege('authenticated','app_private.account_beneficiaries','SELECT')
    or has_function_privilege('anon','public.post_finance_transfer(uuid,uuid,bigint,text,uuid)','EXECUTE')
    or has_function_privilege('anon','public.list_pending_finance_openings()','EXECUTE') then
   raise exception 'finance direct role privilege exposed'; end if;
end $$;

-- Synthetic JWTs use the actor UUID as their test session ID.
insert into auth.sessions(id,user_id)
select u.id,u.id from auth.users u join public.app_users a on a.id=u.id
on conflict do nothing;

select set_config('request.jwt.claims',
 '{"sub":"c1000000-0000-0000-0000-000000000001","session_id":"c1000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select public.create_finance_account('Cash box','cash',null,null,null,
 'c2000000-0000-0000-0000-000000000001') as cash_id \gset
select public.create_finance_account('Masjid bank','bank',null,'123456789012','HDFC0001234',
 'c2000000-0000-0000-0000-000000000002') as bank_id \gset
select public.create_finance_account('Cash box','cash',null,null,null,
 'c2000000-0000-0000-0000-000000000001') as replay_id \gset
select set_config('test.cash', :'cash_id',true),set_config('test.bank', :'bank_id',true),
  set_config('test.account_replay', :'replay_id',true);
do $$ begin
  begin
    perform public.post_finance_transfer(current_setting('test.cash',true)::uuid,current_setting('test.bank',true)::uuid,1,
      'not a T command','c3000000-0000-0000-0000-000000000001');
    raise exception 'President transferred money';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
do $$ begin
 if current_setting('test.cash',true)::uuid <> current_setting('test.account_replay',true)::uuid then raise exception 'account replay changed ID'; end if;
end $$;

select set_config('request.jwt.claims',
 '{"sub":"c1000000-0000-0000-0000-000000000002","session_id":"c1000000-0000-0000-0000-000000000002","role":"authenticated"}',true);
set local role authenticated;
select public.submit_account_opening(current_setting('test.cash',true)::uuid,100000,'counted cash',
 'c3000000-0000-0000-0000-000000000002') as cash_opening \gset
select public.submit_account_opening(current_setting('test.bank',true)::uuid,0,'bank statement',
 'c3000000-0000-0000-0000-000000000003') as bank_opening \gset
select set_config('test.cash_opening', :'cash_opening',true),
  set_config('test.bank_opening', :'bank_opening',true);
do $$ begin
 if (select count(*) from public.list_pending_finance_openings()
   where opening_id in (current_setting('test.cash_opening')::uuid,
    current_setting('test.bank_opening')::uuid))<>2 then
   raise exception 'pending opening projection missing'; end if;
 if (select balance_paise from public.list_finance_accounts() where account_id=current_setting('test.cash',true)::uuid) <> '0' then
   raise exception 'pending opening changed balance'; end if;
 begin
   perform public.verify_account_opening(current_setting('test.cash_opening',true)::uuid,
     'c3000000-0000-0000-0000-000000000004');
   raise exception 'Treasurer self verified opening';
 exception when insufficient_privilege then null;
 end;
 begin
   perform public.post_finance_transfer(current_setting('test.cash',true)::uuid,current_setting('test.bank',true)::uuid,1,
     'cash deposit proof','c3000000-0000-0000-0000-000000000005');
   raise exception 'unverified opening funded transfer';
 exception when invalid_parameter_value then null;
 end;
end $$;
reset role;

select set_config('request.jwt.claims',
 '{"sub":"c1000000-0000-0000-0000-000000000001","session_id":"c1000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
set local role authenticated;
do $$ begin
 if (select count(*) from public.list_pending_finance_openings()
   where opening_id in (current_setting('test.cash_opening')::uuid,
    current_setting('test.bank_opening')::uuid))<>2 then
   raise exception 'President pending opening projection missing'; end if;
end $$;
select public.verify_account_opening(current_setting('test.cash_opening',true)::uuid,
 'c3000000-0000-0000-0000-000000000004');
select public.verify_account_opening(current_setting('test.bank_opening',true)::uuid,
 'c3000000-0000-0000-0000-000000000006');
do $$ begin
 begin
   perform public.deactivate_finance_account(current_setting('test.cash',true)::uuid,
     'c3000000-0000-0000-0000-000000000017');
   raise exception 'funded account deactivated';
 exception when invalid_parameter_value then null;
 end;
end $$;
reset role;

select set_config('request.jwt.claims',
 '{"sub":"c1000000-0000-0000-0000-000000000002","session_id":"c1000000-0000-0000-0000-000000000002","role":"authenticated"}',true);
set local role authenticated;
select public.post_finance_transfer(current_setting('test.cash',true)::uuid,current_setting('test.bank',true)::uuid,30000,
 'deposit voucher','c3000000-0000-0000-0000-000000000007') as transfer_id \gset
select public.post_finance_transfer(current_setting('test.cash',true)::uuid,current_setting('test.bank',true)::uuid,30000,
 'deposit voucher','c3000000-0000-0000-0000-000000000007') as replay_transfer_id \gset
select set_config('test.transfer', :'transfer_id',true),
  set_config('test.transfer_replay', :'replay_transfer_id',true);
do $$ begin
 if (select balance_paise from public.list_finance_accounts() where account_id=current_setting('test.cash',true)::uuid) <> '70000'
   or (select balance_paise from public.list_finance_accounts() where account_id=current_setting('test.bank',true)::uuid) <> '30000'
   or (select variance_paise from public.reconcile_finance_account(current_setting('test.cash',true)::uuid,69000)) <> '-1000' then
   raise exception 'account sums or variance wrong'; end if;
 begin
   perform public.post_finance_transfer(current_setting('test.cash',true)::uuid,current_setting('test.bank',true)::uuid,30001,
     'deposit voucher','c3000000-0000-0000-0000-000000000007');
   raise exception 'changed retry accepted';
 exception when unique_violation then null;
 end;
 begin
   perform public.post_finance_transfer(current_setting('test.cash',true)::uuid,current_setting('test.bank',true)::uuid,70001,
     'deposit voucher','c3000000-0000-0000-0000-000000000008');
   raise exception 'overdraft accepted';
 exception when invalid_parameter_value then null;
 end;
 begin
   perform public.post_finance_transfer(current_setting('test.cash',true)::uuid,current_setting('test.bank',true)::uuid,0,
     'deposit voucher','c3000000-0000-0000-0000-000000000012');
   raise exception 'zero transfer accepted';
 exception when invalid_parameter_value then null;
 end;
 begin
   perform public.post_finance_transfer(current_setting('test.cash',true)::uuid,current_setting('test.bank',true)::uuid,-1,
     'deposit voucher','c3000000-0000-0000-0000-000000000013');
   raise exception 'negative transfer accepted';
 exception when invalid_parameter_value then null;
 end;
 begin
   perform public.post_finance_transfer(current_setting('test.cash',true)::uuid,current_setting('test.cash',true)::uuid,1,
     'deposit voucher','c3000000-0000-0000-0000-000000000014');
   raise exception 'same-account transfer accepted';
 exception when invalid_parameter_value then null;
 end;
 begin
   perform public.post_finance_transfer(current_setting('test.cash',true)::uuid,'00000000-0000-0000-0000-000000000000',1,
     'deposit voucher','c3000000-0000-0000-0000-000000000015');
   raise exception 'missing target account accepted';
 exception when invalid_parameter_value then null;
 end;
 begin
   perform public.post_finance_transfer(current_setting('test.cash',true)::uuid,current_setting('test.bank',true)::uuid,
     9223372036854775808::bigint,'deposit voucher','c3000000-0000-0000-0000-000000000016');
   raise exception 'overflow amount accepted';
 exception when numeric_value_out_of_range then null;
 end;
 begin
   perform public.record_finance_reconciliation(current_setting('test.cash',true)::uuid,69000,
     'cash count','', 'c3000000-0000-0000-0000-000000000010');
   raise exception 'unexplained variance accepted';
 exception when invalid_parameter_value then null;
 end;
end $$;
select public.record_finance_reconciliation(current_setting('test.cash',true)::uuid,69000,
  'cash count','One note missing at count','c3000000-0000-0000-0000-000000000011') as reconciliation_id \gset
select set_config('test.reconciliation', :'reconciliation_id',true);
select public.record_finance_reconciliation(current_setting('test.cash',true)::uuid,70000,
  'recount matches book',null,'c3000000-0000-0000-0000-000000000018');
do $$ declare v_first record; v_second record; begin
 if (select count(*) from public.list_finance_account_history(current_setting('test.cash',true)::uuid)) <> 2
   or (select variance_paise from public.list_finance_reconciliations(current_setting('test.cash',true)::uuid)
       where reconciliation_id=current_setting('test.reconciliation',true)::uuid) <> '-1000' then
   raise exception 'account history or reconciliation snapshot missing'; end if;
 select * into v_first from public.list_finance_account_history(
   current_setting('test.cash',true)::uuid,null,null,1);
 if (select count(*) from public.list_finance_account_history(
   current_setting('test.cash',true)::uuid,v_first.occurred_at,v_first.effect_id,1))<>1 then
   raise exception 'account history keyset page missing'; end if;
 select * into v_first from public.list_finance_reconciliations(
   current_setting('test.cash',true)::uuid,null,null,1);
 select * into v_second from public.list_finance_reconciliations(
   current_setting('test.cash',true)::uuid,v_first.recorded_at,v_first.reconciliation_id,1);
 if v_second.reconciliation_id is null or v_second.reconciliation_id=v_first.reconciliation_id
   or (select count(*) from public.list_finance_reconciliations(
     current_setting('test.cash',true)::uuid,v_second.recorded_at,v_second.reconciliation_id,1))<>0 then
   raise exception 'reconciliation keyset page missing, repeated, or unbounded'; end if;
end $$;
reset role;
do $$ begin
 if current_setting('test.transfer',true)::uuid <> current_setting('test.transfer_replay',true)::uuid
   or (select sum(amount_paise::numeric) from public.finance_effects
       where source_type='transfer' and source_id=current_setting('test.transfer',true)::uuid) <> 0
   or (select count(*) from public.finance_effects
       where source_type='transfer' and source_id=current_setting('test.transfer',true)::uuid) <> 2 then
   raise exception 'transfer double posted or created income'; end if;
 if (select sum(amount_paise::numeric) from public.finance_effects) <> 100000
   or (select count(*) from public.finance_transfers) <> 1 then
   raise exception 'opening plus transfer accounting equation failed'; end if;
end $$;

select set_config('request.jwt.claims',
 '{"sub":"c1000000-0000-0000-0000-000000000003","session_id":"c1000000-0000-0000-0000-000000000003","role":"authenticated"}',true);
set local role authenticated;
do $$ begin
 begin
   perform public.list_finance_accounts();
   raise exception 'member read private finance';
 exception when insufficient_privilege then null;
 end;
 begin
   perform public.post_finance_transfer(current_setting('test.cash',true)::uuid,current_setting('test.bank',true)::uuid,1,
     'forbidden','c3000000-0000-0000-0000-000000000009');
   raise exception 'member moved money';
 exception when insufficient_privilege then null;
 end;
end $$;
reset role;
rollback;
