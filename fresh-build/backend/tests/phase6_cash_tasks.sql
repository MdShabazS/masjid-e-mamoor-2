-- Collection task cash is pending until a Treasurer verifies actual cash.
begin;
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at)
select id,'00000000-0000-0000-0000-000000000000'::uuid,'authenticated',
 'authenticated',email,'',now(),now(),now() from (values
 ('c1000000-0000-0000-0000-000000000001'::uuid,'cash-p@example.invalid'),
 ('c1000000-0000-0000-0000-000000000002'::uuid,'cash-t@example.invalid'),
 ('c1000000-0000-0000-0000-000000000003'::uuid,'cash-m1@example.invalid'),
 ('c1000000-0000-0000-0000-000000000004'::uuid,'cash-m2@example.invalid')) f(id,email);
insert into public.app_users(id,role) values
 ('c1000000-0000-0000-0000-000000000001','president'),
 ('c1000000-0000-0000-0000-000000000002','treasurer'),
 ('c1000000-0000-0000-0000-000000000003','member'),
 ('c1000000-0000-0000-0000-000000000004','member');
insert into app_private.username_aliases(user_id,username,must_change_password) values
 ('c1000000-0000-0000-0000-000000000001','cashpresident',false),
 ('c1000000-0000-0000-0000-000000000002','cashtreasurer',false),
 ('c1000000-0000-0000-0000-000000000003','cashmemberone',false),
 ('c1000000-0000-0000-0000-000000000004','cashmembertwo',false);
insert into auth.sessions(id,user_id)
select u.id,u.id from auth.users u join public.app_users a on a.id=u.id on conflict do nothing;
do $$ begin
 if has_table_privilege('authenticated','public.cash_task_counts','SELECT')
  or has_table_privilege('authenticated','public.cash_slip_claims','INSERT')
  or has_function_privilege('anon','public.verify_cash_task_count(uuid,bigint,uuid,uuid)','EXECUTE') then
  raise exception 'cash task direct privilege leak'; end if;
end $$;

select set_config('request.jwt.claims',
 '{"sub":"c1000000-0000-0000-0000-000000000001","session_id":"c1000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select public.create_finance_account('Collection cash','cash',null,null,null,
 'c2000000-0000-0000-0000-000000000001') as account_id \gset
select set_config('cash.account',:'account_id',true);
select public.create_work_task('Ordinary task','No cash count',null,null,'open',1,0,1,
 'c2000000-0000-0000-0000-000000000002') as ordinary_id \gset
select set_config('cash.ordinary',:'ordinary_id',true);
select public.create_cash_collection_task('Friday collection','Count one bag',null,null,
 'open',2,0,2,'c2000000-0000-0000-0000-000000000003') as task_id \gset
select set_config('cash.task',:'task_id',true);
reset role;
do $$ begin
 if not exists(select 1 from public.cash_collection_tasks
   where task_id=current_setting('cash.task')::uuid) then
  raise exception 'collection task marker missing'; end if;
end $$;
set local role authenticated;
do $$ begin
 begin
  perform public.create_cash_collection_task('Ordinary task','No cash count',null,null,
   'open',1,0,1,'c2000000-0000-0000-0000-000000000002');
  raise exception 'ordinary task converted by operation replay';
 exception when unique_violation then null; end;
end $$;
reset role;
select set_config('request.jwt.claims',
 '{"sub":"c1000000-0000-0000-0000-000000000002","session_id":"c1000000-0000-0000-0000-000000000002","role":"authenticated"}',true);
set local role authenticated;
select public.submit_account_opening(current_setting('cash.account')::uuid,10000,
 'Synthetic opening count','c2000000-0000-0000-0000-000000000004') as opening_id \gset
select set_config('cash.opening',:'opening_id',true);
reset role;
select set_config('request.jwt.claims',
 '{"sub":"c1000000-0000-0000-0000-000000000001","session_id":"c1000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select public.verify_account_opening(current_setting('cash.opening')::uuid,
 'c2000000-0000-0000-0000-000000000005');
reset role;

select set_config('request.jwt.claims',
 '{"sub":"c1000000-0000-0000-0000-000000000003","session_id":"c1000000-0000-0000-0000-000000000003","role":"authenticated"}',true);
set local role authenticated;
select public.join_work_task(current_setting('cash.task')::uuid,
 'c2000000-0000-0000-0000-000000000006');
select public.join_work_task(current_setting('cash.ordinary')::uuid,
 'c2000000-0000-0000-0000-000000000007');
do $$ begin
 begin
  perform public.submit_cash_task_count(current_setting('cash.ordinary')::uuid,current_date,
   1500,'Friday slip 100','c2000000-0000-0000-0000-000000000008');
  raise exception 'ordinary task accepted cash';
 exception when insufficient_privilege then null; end;
end $$;
select public.submit_cash_task_count(current_setting('cash.task')::uuid,current_date,
 1500,'Friday slip 100','c2000000-0000-0000-0000-000000000009') as count_id \gset
select set_config('cash.count',:'count_id',true);
select public.submit_cash_task_count(current_setting('cash.task')::uuid,current_date,
 1500,'Friday slip 100','c2000000-0000-0000-0000-000000000009') as count_replay \gset
select set_config('cash.count_replay',:'count_replay',true);
do $$ begin
 if current_setting('cash.count')<>current_setting('cash.count_replay') then
  raise exception 'cash count replay changed id'; end if;
 if not exists(select 1 from public.list_cash_collection_workflow() w
   where w.task_id=current_setting('cash.task')::uuid
     and w.count_id=current_setting('cash.count')::uuid
     and w.count_status='pending' and w.claimed_amount_paise='1500') then
  raise exception 'counter cannot read own pending count'; end if;
 begin
  perform public.verify_cash_task_count(current_setting('cash.count')::uuid,1400,
   current_setting('cash.account')::uuid,'c2000000-0000-0000-0000-000000000010');
  raise exception 'member verified cash';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
do $$ begin
 if (select count(*) from public.finance_effects)<>1
  or (select status from public.cash_task_counts where id=current_setting('cash.count')::uuid)<>'pending' then
  raise exception 'pending cash changed money'; end if;
end $$;

select set_config('request.jwt.claims',
 '{"sub":"c1000000-0000-0000-0000-000000000004","session_id":"c1000000-0000-0000-0000-000000000004","role":"authenticated"}',true);
set local role authenticated;
do $$ begin
 if not exists(select 1 from public.list_cash_collection_workflow() w
   where w.task_id=current_setting('cash.task')::uuid
     and w.count_status='pending' and w.count_id is null
     and w.claimed_amount_paise is null) then
  raise exception 'unassigned member can read count details or cannot see task'; end if;
 begin
  perform public.submit_cash_task_count(current_setting('cash.task')::uuid,current_date,
   1500,'Friday slip 101','c2000000-0000-0000-0000-000000000011');
  raise exception 'unassigned member submitted count';
 exception when insufficient_privilege then null; end;
end $$;
reset role;

select set_config('request.jwt.claims',
 '{"sub":"c1000000-0000-0000-0000-000000000002","session_id":"c1000000-0000-0000-0000-000000000002","role":"authenticated"}',true);
set local role authenticated;
do $$ begin
 if not exists(select 1 from public.list_cash_collection_workflow() w
   where w.task_id=current_setting('cash.task')::uuid
     and w.count_id=current_setting('cash.count')::uuid
     and w.claimed_amount_paise='1500') then
  raise exception 'Treasurer cannot read pending count'; end if;
 begin
  perform public.submit_cash_task_count(current_setting('cash.task')::uuid,current_date,
   100,'Treasurer self count','c2000000-0000-0000-0000-000000000019');
  raise exception 'Treasurer submitted own task count';
 exception when insufficient_privilege then null; end;
 begin
  perform public.post_direct_treasurer_cash('Duplicate slip','other',null,current_date,
   1500,' FRIDAY SLIP 100 ',current_setting('cash.account')::uuid,
   'c2000000-0000-0000-0000-000000000012');
  raise exception 'task slip posted through direct path';
 exception when unique_violation then null; end;
 begin
  perform public.verify_cash_task_count(current_setting('cash.count')::uuid,1400,
   'c2000000-0000-0000-0000-000000000099','c2000000-0000-0000-0000-000000000013');
  raise exception 'invalid cash account verified count';
 exception when invalid_parameter_value or foreign_key_violation then null; end;
end $$;
select public.verify_cash_task_count(current_setting('cash.count')::uuid,1400,
 current_setting('cash.account')::uuid,'c2000000-0000-0000-0000-000000000014') as donation_id \gset
select set_config('cash.donation',:'donation_id',true);
select public.verify_cash_task_count(current_setting('cash.count')::uuid,1400,
 current_setting('cash.account')::uuid,'c2000000-0000-0000-0000-000000000014') as verify_replay \gset
select set_config('cash.verify_replay',:'verify_replay',true);
reset role;
do $$ begin
 if current_setting('cash.donation')<>current_setting('cash.verify_replay')
  or (select count(*) from public.finance_effects where source_type='one_time_donation')<>1
  or (select coalesce(sum(amount_paise),0) from public.finance_effects
      where account_id=current_setting('cash.account')::uuid)<>11400
  or (select status from public.cash_task_counts where id=current_setting('cash.count')::uuid)<>'verified'
  or (select receipt_code from public.one_time_donations
      where id=current_setting('cash.donation')::uuid) is null then
  raise exception 'cash task verification did not post once'; end if;
end $$;

-- Reserve a different slip through direct posting, then reject it from a task.
select set_config('request.jwt.claims',
 '{"sub":"c1000000-0000-0000-0000-000000000001","session_id":"c1000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select public.create_cash_collection_task('Second collection','Cross-path collision',null,null,
 'open',1,0,1,'c2000000-0000-0000-0000-000000000015') as task_two \gset
select set_config('cash.task_two',:'task_two',true);
reset role;
select set_config('request.jwt.claims',
 '{"sub":"c1000000-0000-0000-0000-000000000003","session_id":"c1000000-0000-0000-0000-000000000003","role":"authenticated"}',true);
set local role authenticated;
select public.join_work_task(current_setting('cash.task_two')::uuid,
 'c2000000-0000-0000-0000-000000000016');
reset role;
select set_config('request.jwt.claims',
 '{"sub":"c1000000-0000-0000-0000-000000000002","session_id":"c1000000-0000-0000-0000-000000000002","role":"authenticated"}',true);
set local role authenticated;
select public.post_direct_treasurer_cash('Second direct donor','other',null,current_date,
 100,'Friday slip 200',current_setting('cash.account')::uuid,
 'c2000000-0000-0000-0000-000000000017');
reset role;
select set_config('request.jwt.claims',
 '{"sub":"c1000000-0000-0000-0000-000000000003","session_id":"c1000000-0000-0000-0000-000000000003","role":"authenticated"}',true);
set local role authenticated;
do $$ begin
 begin
  perform public.submit_cash_task_count(current_setting('cash.task_two')::uuid,current_date,
   100,' FRIDAY SLIP 200 ','c2000000-0000-0000-0000-000000000018');
  raise exception 'direct slip accepted through task count';
 exception when unique_violation then null; end;
 begin
  perform public.submit_cash_task_count(current_setting('cash.task')::uuid,current_date,
   1500,'Friday slip 100','c2000000-0000-0000-0000-000000000009');
 exception when others then
  raise exception 'exact submitted-count replay failed'; end;
 begin
  perform public.submit_cash_task_count(current_setting('cash.task')::uuid,current_date,
   1600,'Friday slip 100','c2000000-0000-0000-0000-000000000009');
  raise exception 'changed submitted-count replay accepted';
 exception when unique_violation then null; end;
end $$;
reset role;
do $$ begin
 if (select count(*) from public.finance_effects where source_type='one_time_donation')<>2
  or (select coalesce(sum(amount_paise),0) from public.finance_effects
      where account_id=current_setting('cash.account')::uuid)<>11500
  or (select count(*) from public.cash_slip_claims)<>2
  or (select count(*) from public.cash_task_counts)<>1 then
  raise exception 'cross-path slip check changed money or count state'; end if;
end $$;

-- Ordinary reviewed cash must share the same slip register.
select set_config('request.jwt.claims',
 '{"sub":"c1000000-0000-0000-0000-000000000001","session_id":"c1000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select public.submit_one_time_donation('Generic cash donor','other',null,current_date,
 'cash',100,'Friday slip 300','c2000000-0000-0000-0000-000000000020') as generic_id \gset
select set_config('cash.generic',:'generic_id',true);
reset role;
select set_config('request.jwt.claims',
 '{"sub":"c1000000-0000-0000-0000-000000000002","session_id":"c1000000-0000-0000-0000-000000000002","role":"authenticated"}',true);
set local role authenticated;
select public.decide_one_time_donation(current_setting('cash.generic')::uuid,'verify',100,
 current_setting('cash.account')::uuid,null,'c2000000-0000-0000-0000-000000000021');
do $$ begin
 begin
  perform public.post_direct_treasurer_cash('Duplicate generic slip','other',null,current_date,
   100,' FRIDAY SLIP 300 ',current_setting('cash.account')::uuid,
   'c2000000-0000-0000-0000-000000000022');
  raise exception 'generic slip reused through direct path';
 exception when unique_violation then null; end;
end $$;
reset role;
select set_config('request.jwt.claims',
 '{"sub":"c1000000-0000-0000-0000-000000000003","session_id":"c1000000-0000-0000-0000-000000000003","role":"authenticated"}',true);
set local role authenticated;
do $$ begin
 begin
  perform public.submit_cash_task_count(current_setting('cash.task_two')::uuid,current_date,
   100,' FRIDAY SLIP 300 ','c2000000-0000-0000-0000-000000000023');
  raise exception 'generic slip reused through task path';
 exception when unique_violation then null; end;
end $$;
reset role;
select set_config('request.jwt.claims',
 '{"sub":"c1000000-0000-0000-0000-000000000001","session_id":"c1000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select public.submit_one_time_donation('Generic task duplicate','other',null,current_date,
 'cash',100,'Friday slip 100','c2000000-0000-0000-0000-000000000024') as generic_dup \gset
select set_config('cash.generic_dup',:'generic_dup',true);
reset role;
select set_config('request.jwt.claims',
 '{"sub":"c1000000-0000-0000-0000-000000000002","session_id":"c1000000-0000-0000-0000-000000000002","role":"authenticated"}',true);
set local role authenticated;
do $$ begin
 begin
  perform public.decide_one_time_donation(current_setting('cash.generic_dup')::uuid,
   'verify',100,current_setting('cash.account')::uuid,null,
   'c2000000-0000-0000-0000-000000000025');
  raise exception 'task slip reused through generic cash';
 exception when unique_violation then null; end;
end $$;
reset role;
do $$ begin
 if (select count(*) from public.finance_effects where source_type='one_time_donation')<>3
  or (select coalesce(sum(amount_paise),0) from public.finance_effects
      where account_id=current_setting('cash.account')::uuid)<>11600
  or (select count(*) from public.cash_slip_claims)<>3
  or (select count(*) from public.cash_task_verification_links)<>1
  or (select status from public.one_time_donations
      where id=current_setting('cash.generic_dup')::uuid)<>'pending' then
  raise exception 'generic cash collision changed money or claim state'; end if;
end $$;
-- Treasurer rejects a mistaken count; each replacement gets a new numbered slip.
select set_config('request.jwt.claims',
 '{"sub":"c1000000-0000-0000-0000-000000000003","session_id":"c1000000-0000-0000-0000-000000000003","role":"authenticated"}',true);
set local role authenticated;
select public.submit_cash_task_count(current_setting('cash.task_two')::uuid,current_date,
 1000,'Friday slip 400','c2000000-0000-0000-0000-000000000026') as first_count \gset
select set_config('cash.first_count',:'first_count',true);
do $$ begin
 begin
  perform public.reject_cash_task_count(current_setting('cash.first_count')::uuid,
   'Counted twice','c2000000-0000-0000-0000-000000000027');
  raise exception 'member rejected cash count';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claims',
 '{"sub":"c1000000-0000-0000-0000-000000000002","session_id":"c1000000-0000-0000-0000-000000000002","role":"authenticated"}',true);
set local role authenticated;
select public.reject_cash_task_count(current_setting('cash.first_count')::uuid,
 'Counted twice','c2000000-0000-0000-0000-000000000028') as first_reject \gset
select set_config('cash.first_reject',:'first_reject',true);
select public.reject_cash_task_count(current_setting('cash.first_count')::uuid,
 'Counted twice','c2000000-0000-0000-0000-000000000028') as reject_replay \gset
select set_config('cash.reject_replay',:'reject_replay',true);
do $$ begin
 if current_setting('cash.first_count')<>current_setting('cash.first_reject')
   or current_setting('cash.first_count')<>current_setting('cash.reject_replay') then
  raise exception 'rejection replay changed count'; end if;
 if not exists(select 1 from public.list_cash_collection_workflow() w
   where w.task_id=current_setting('cash.task_two')::uuid and w.count_status='rejected'
     and w.rejection_reason='Counted twice') then
  raise exception 'rejection reason not visible to Treasurer'; end if;
 begin
  perform public.reject_cash_task_count(current_setting('cash.first_count')::uuid,
   'Changed reason','c2000000-0000-0000-0000-000000000028');
  raise exception 'changed rejection replay accepted';
 exception when unique_violation then null; end;
 begin
  perform public.verify_cash_task_count(current_setting('cash.first_count')::uuid,1000,
   current_setting('cash.account')::uuid,'c2000000-0000-0000-0000-000000000029');
  raise exception 'rejected count verified';
 exception when unique_violation then null; end;
 begin
  perform public.post_direct_treasurer_cash('Rejected slip reuse','other',null,current_date,
   1000,'FRIDAY SLIP 400',current_setting('cash.account')::uuid,
   'c2000000-0000-0000-0000-000000000030');
  raise exception 'rejected slip reused directly';
 exception when unique_violation then null; end;
end $$;
reset role;
select set_config('request.jwt.claims',
 '{"sub":"c1000000-0000-0000-0000-000000000003","session_id":"c1000000-0000-0000-0000-000000000003","role":"authenticated"}',true);
set local role authenticated;
do $$ begin
 if public.submit_cash_task_count(current_setting('cash.task_two')::uuid,current_date,
    1000,'Friday slip 400','c2000000-0000-0000-0000-000000000026')
    <> current_setting('cash.first_count')::uuid then
  raise exception 'original submission replay created a replacement'; end if;
 begin
  perform public.submit_cash_task_count(current_setting('cash.task_two')::uuid,current_date,
   1100,'FRIDAY SLIP 400','c2000000-0000-0000-0000-000000000031');
  raise exception 'rejected slip reused for replacement';
 exception when unique_violation then null; end;
end $$;
select public.submit_cash_task_count(current_setting('cash.task_two')::uuid,current_date,
 1100,'Friday slip 401','c2000000-0000-0000-0000-000000000032') as second_count \gset
select set_config('cash.second_count',:'second_count',true);
reset role;
select set_config('request.jwt.claims',
 '{"sub":"c1000000-0000-0000-0000-000000000002","session_id":"c1000000-0000-0000-0000-000000000002","role":"authenticated"}',true);
set local role authenticated;
select public.reject_cash_task_count(current_setting('cash.second_count')::uuid,
 'Slip total was copied incorrectly','c2000000-0000-0000-0000-000000000033');
reset role;
select set_config('request.jwt.claims',
 '{"sub":"c1000000-0000-0000-0000-000000000003","session_id":"c1000000-0000-0000-0000-000000000003","role":"authenticated"}',true);
set local role authenticated;
select public.submit_cash_task_count(current_setting('cash.task_two')::uuid,current_date,
 1200,'Friday slip 402','c2000000-0000-0000-0000-000000000034') as third_count \gset
select set_config('cash.third_count',:'third_count',true);
reset role;
select set_config('request.jwt.claims',
 '{"sub":"c1000000-0000-0000-0000-000000000002","session_id":"c1000000-0000-0000-0000-000000000002","role":"authenticated"}',true);
set local role authenticated;
select public.verify_cash_task_count(current_setting('cash.third_count')::uuid,1150,
 current_setting('cash.account')::uuid,'c2000000-0000-0000-0000-000000000035');
do $$ begin
 begin
  perform public.reject_cash_task_count(current_setting('cash.third_count')::uuid,
   'Too late','c2000000-0000-0000-0000-000000000036');
  raise exception 'verified count rejected';
 exception when unique_violation then null; end;
end $$;
reset role;
do $$ begin
 if (select count(*) from public.cash_task_counts where task_id=current_setting('cash.task_two')::uuid)<>3
  or (select count(*) from public.cash_task_counts
      where task_id=current_setting('cash.task_two')::uuid and status='rejected')<>2
  or (select replaces_count_id from public.cash_task_counts
      where id=current_setting('cash.second_count')::uuid)<>current_setting('cash.first_count')::uuid
  or (select replaces_count_id from public.cash_task_counts
      where id=current_setting('cash.third_count')::uuid)<>current_setting('cash.second_count')::uuid
  or (select count(*) from public.cash_slip_claims)<>6
  or (select count(*) from public.finance_effects where source_type='one_time_donation')<>4
  or (select coalesce(sum(amount_paise),0) from public.finance_effects
      where account_id=current_setting('cash.account')::uuid)<>12750 then
  raise exception 'rejection chain changed money or audit state'; end if;
end $$;
rollback;
