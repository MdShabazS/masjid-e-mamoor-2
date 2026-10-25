-- Apply all fresh migrations first, then: psql -v ON_ERROR_STOP=1 -f tests/phase7_report.sql
begin;
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at)
select id,'00000000-0000-0000-0000-000000000000'::uuid,'authenticated',
 'authenticated',email,'',now(),now(),now() from (values
 ('e1000000-0000-0000-0000-000000000001'::uuid,'phase7p@example.invalid'),
 ('e1000000-0000-0000-0000-000000000002'::uuid,'phase7t@example.invalid'),
 ('e1000000-0000-0000-0000-000000000003'::uuid,'phase7m@example.invalid'),
 ('e1000000-0000-0000-0000-000000000004'::uuid,'phase7sa@example.invalid')) f(id,email);
insert into public.app_users(id,role) values
 ('e1000000-0000-0000-0000-000000000001','president'),
 ('e1000000-0000-0000-0000-000000000002','treasurer'),
 ('e1000000-0000-0000-0000-000000000003','member'),
 ('e1000000-0000-0000-0000-000000000004','system_admin');
insert into app_private.username_aliases(user_id,username,must_change_password) values
 ('e1000000-0000-0000-0000-000000000001','phase7president',false),
 ('e1000000-0000-0000-0000-000000000002','phase7treasurer',false),
 ('e1000000-0000-0000-0000-000000000003','phase7member',false),
 ('e1000000-0000-0000-0000-000000000004','phase7admin',false);
do $$ begin
 if has_table_privilege('authenticated','public.finance_report_runs','SELECT')
  or has_table_privilege('authenticated','public.finance_report_effects','INSERT')
  or has_function_privilege('anon','public.list_finance_report_lines(uuid)','EXECUTE')
  or has_function_privilege('anon','public.lookup_active_receipt(text)','EXECUTE')
  or has_function_privilege('authenticated','public.lookup_active_receipt(text)','EXECUTE')
  or not has_function_privilege('service_role','public.lookup_active_receipt(text)','EXECUTE') then
 raise exception 'report direct privilege leak'; end if;
end $$;
-- Synthetic JWTs use the actor UUID as their test session ID.
insert into auth.sessions(id,user_id)
select u.id,u.id from auth.users u join public.app_users a on a.id=u.id
on conflict do nothing;

select set_config('request.jwt.claims',
 '{"sub":"e1000000-0000-0000-0000-000000000001","session_id":"e1000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select public.create_finance_account('Phase7 cash','cash',null,null,null,
 'e2000000-0000-0000-0000-000000000001') as account_id \gset
select set_config('phase7.account',:'account_id',true);
reset role;
select set_config('request.jwt.claims',
 '{"sub":"e1000000-0000-0000-0000-000000000002","session_id":"e1000000-0000-0000-0000-000000000002","role":"authenticated"}',true);
set local role authenticated;
select public.submit_account_opening(current_setting('phase7.account')::uuid,10000,
 'cash counted','e2000000-0000-0000-0000-000000000002') as opening_id \gset
select set_config('phase7.opening',:'opening_id',true);
reset role;
select set_config('request.jwt.claims',
 '{"sub":"e1000000-0000-0000-0000-000000000001","session_id":"e1000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select public.verify_account_opening(current_setting('phase7.opening')::uuid,
 'e2000000-0000-0000-0000-000000000003');
select public.submit_one_time_donation('Report Donor','other',null,
 (now() at time zone 'Asia/Kolkata')::date,'cash',1500,'cash slip',
 'e2000000-0000-0000-0000-000000000004') as donation_id \gset
select set_config('phase7.donation',:'donation_id',true);
reset role;
select set_config('request.jwt.claims',
 '{"sub":"e1000000-0000-0000-0000-000000000002","session_id":"e1000000-0000-0000-0000-000000000002","role":"authenticated"}',true);
set local role authenticated;
select public.decide_one_time_donation(current_setting('phase7.donation')::uuid,'verify',1200,
 current_setting('phase7.account')::uuid,null,'e2000000-0000-0000-0000-000000000005');
reset role;
-- Build a second account and a verified monthly contribution in the same
-- period, then move cash between accounts and correct the first donation.
insert into app_private.approved_consent_versions(version,approved_at,approved_by)
values ('phase7-fixture-v1',now(),'e1000000-0000-0000-0000-000000000001');
select set_config('request.jwt.claims',
 '{"sub":"e1000000-0000-0000-0000-000000000001","session_id":"e1000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select public.create_finance_account('Phase7 second cash','cash',null,null,null,
 'e2000000-0000-0000-0000-000000000008') as second_account_id \gset
select set_config('phase7.second_account',:'second_account_id',true);
reset role;
-- Enrollment is a server-only RPC; the synthetic approved version exists
-- only inside this rollback-only transaction.
select public.enroll_versioned_monthly_donor('Report monthly donor','+919000000007',3000,
 'e1000000-0000-0000-0000-000000000001','e1000000-0000-0000-0000-000000000001','in-person',now(),
 'phase7-fixture-v1','synthetic signed consent') as donor_id \gset
select set_config('phase7.donor',:'donor_id',true);
insert into public.payment_qr_versions(id,account_id,asset_path,asset_sha256,created_by)
values ('e2100000-0000-0000-0000-000000000001',
 current_setting('phase7.second_account')::uuid,'phase7/qr.png',repeat('b',64),
 'e1000000-0000-0000-0000-000000000001');
select set_config('request.jwt.claims',
 '{"sub":"e1000000-0000-0000-0000-000000000002","session_id":"e1000000-0000-0000-0000-000000000002","role":"authenticated"}',true);
set local role authenticated;
select public.submit_account_opening(current_setting('phase7.second_account')::uuid,5000,
 'second cash counted','e2000000-0000-0000-0000-000000000009') as second_opening_id \gset
select set_config('phase7.second_opening',:'second_opening_id',true);
reset role;
select set_config('request.jwt.claims',
 '{"sub":"e1000000-0000-0000-0000-000000000001","session_id":"e1000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select public.verify_account_opening(current_setting('phase7.second_opening')::uuid,
 'e2000000-0000-0000-0000-000000000010');
reset role;
select public.queue_monthly_request(current_setting('phase7.donor')::uuid,
 date_trunc('month',now() at time zone 'Asia/Kolkata')::date);
select set_config('request.jwt.claims',
 '{"sub":"e1000000-0000-0000-0000-000000000001","session_id":"e1000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select public.submit_monthly_claim(current_setting('phase7.donor')::uuid,
 date_trunc('month',now() at time zone 'Asia/Kolkata')::date,'PHASE7-MONTHLY-1') as claim_id \gset
select set_config('phase7.claim',:'claim_id',true);
reset role;
select set_config('request.jwt.claims',
 '{"sub":"e1000000-0000-0000-0000-000000000002","session_id":"e1000000-0000-0000-0000-000000000002","role":"authenticated"}',true);
set local role authenticated;
select public.verify_monthly_claim(current_setting('phase7.claim')::uuid,
 current_setting('phase7.second_account')::uuid,3000,
 'e2000000-0000-0000-0000-000000000011');
select public.post_finance_transfer(current_setting('phase7.account')::uuid,
 current_setting('phase7.second_account')::uuid,2000,'move counted cash',
 'e2000000-0000-0000-0000-000000000012');
select public.submit_expense_request('Report repair','Synthetic wiring repair','maintenance',
 1000,'phase7 bill',null,'e2000000-0000-0000-0000-000000000013') as expense_id \gset
select set_config('phase7.expense',:'expense_id',true);
select effect_id from public.list_finance_account_history(current_setting('phase7.account')::uuid)
 where source_type='one_time_donation' \gset
select public.correct_finance_posting(:'effect_id'::uuid,
 current_setting('phase7.account')::uuid,900,'Counted cash revised',
 'e2000000-0000-0000-0000-000000000014') as correction_id \gset
select set_config('phase7.correction',:'correction_id',true);
reset role;
select set_config('request.jwt.claims',
 '{"sub":"e1000000-0000-0000-0000-000000000001","session_id":"e1000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select public.decide_expense_request(current_setting('phase7.expense')::uuid,'approve',null,
 'e2000000-0000-0000-0000-000000000015');
reset role;
select set_config('request.jwt.claims',
 '{"sub":"e1000000-0000-0000-0000-000000000002","session_id":"e1000000-0000-0000-0000-000000000002","role":"authenticated"}',true);
set local role authenticated;
select public.post_expense_payment(current_setting('phase7.expense')::uuid,
 current_setting('phase7.second_account')::uuid,1000,'cash',
 (now() at time zone 'Asia/Kolkata')::date,'synthetic paid bill',
 'e2000000-0000-0000-0000-000000000016');
reset role;
select set_config('request.jwt.claims',
 '{"sub":"e1000000-0000-0000-0000-000000000003","session_id":"e1000000-0000-0000-0000-000000000003","role":"authenticated"}',true);
set local role authenticated;
do $$ begin
 begin
 perform public.request_finance_report('month',date_trunc('month',now() at time zone 'Asia/Kolkata')::date,
  (date_trunc('month',now() at time zone 'Asia/Kolkata')+interval '1 month')::date,
  false,'e2000000-0000-0000-0000-000000000006');
 raise exception 'member requested a report';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claims',
 '{"sub":"e1000000-0000-0000-0000-000000000001","session_id":"e1000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select public.request_finance_report('month',date_trunc('month',now() at time zone 'Asia/Kolkata')::date,
 (date_trunc('month',now() at time zone 'Asia/Kolkata')+interval '1 month')::date,
 false,'e2000000-0000-0000-0000-000000000006') as run_id \gset
select set_config('phase7.run',:'run_id',true);
select public.request_finance_report('month',date_trunc('month',now() at time zone 'Asia/Kolkata')::date,
 (date_trunc('month',now() at time zone 'Asia/Kolkata')+interval '1 month')::date,
 false,'e2000000-0000-0000-0000-000000000006') as replay_id \gset
select set_config('phase7.replay',:'replay_id',true);
reset role;
do $$ declare v_run uuid:=current_setting('phase7.run')::uuid;
 v_first uuid:=current_setting('phase7.account')::uuid;
 v_second uuid:=current_setting('phase7.second_account')::uuid;
begin
 if current_setting('phase7.run')<>current_setting('phase7.replay')
  or (select count(*) from public.finance_report_effects where run_id=v_run)<>9
  or (select count(*) from public.list_finance_report_lines(v_run))<>9
  or (select count(*) from public.list_finance_report_lines(v_run) where account_id=v_first)<>5
  or (select count(*) from public.list_finance_report_lines(v_run) where account_id=v_second)<>4
  or (select coalesce(sum(e.amount_paise::numeric),0) from public.finance_report_effects s
      join public.finance_effects e on e.id=s.effect_id where s.run_id=v_run)<>17900
  or (select coalesce(sum(amount_paise::numeric),0) from public.finance_effects)<>17900
  or (select coalesce(sum(amount_paise::numeric),0) from public.finance_effects
      where source_type='transfer')<>0 then
  raise exception 'mixed-source report snapshot or ledger total mismatch'; end if;
 if not exists(select 1 from public.list_finance_report_balances(v_run)
     where account_id=v_first and opening_paise='0' and period_openings_paise='10000'
       and income_paise='900' and expense_paise='0' and transfer_paise='-2000'
       and closing_paise='8900')
  or not exists(select 1 from public.list_finance_report_balances(v_run)
     where account_id=v_second and opening_paise='0' and period_openings_paise='5000'
       and income_paise='3000' and expense_paise='1000' and transfer_paise='2000'
       and closing_paise='9000') then
  raise exception 'mixed-source account report categories mismatch'; end if;
end $$;
reset role;
-- A later correction and posting belong in a new run; the first report
-- retains its nine original effect IDs, category totals and closing balances.
select set_config('request.jwt.claims',
 '{"sub":"e1000000-0000-0000-0000-000000000002","session_id":"e1000000-0000-0000-0000-000000000002","role":"authenticated"}',true);
set local role authenticated;
select effect_id from public.list_finance_account_history(current_setting('phase7.account')::uuid)
 where source_type='correction' and source_id=current_setting('phase7.correction')::uuid
 and leg=2 \gset
select public.correct_finance_posting(:'effect_id'::uuid,
 current_setting('phase7.account')::uuid,800,'Later count revision',
 'e2000000-0000-0000-0000-000000000020') as later_correction_id \gset
select set_config('phase7.later_correction',:'later_correction_id',true);
reset role;
do $$ begin
 if (select receipt_state from public.finance_receipt_state(
    (select code from public.finance_correction_receipts
      where correction_id=current_setting('phase7.correction')::uuid)))<>'superseded'
  or (select receipt_state from public.finance_receipt_state(
    (select code from public.finance_correction_receipts
      where correction_id=current_setting('phase7.later_correction')::uuid)))<>'active' then
  raise exception 'later correction receipt state mismatch'; end if;
end $$;
select set_config('request.jwt.claims',
 '{"sub":"e1000000-0000-0000-0000-000000000001","session_id":"e1000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select public.submit_one_time_donation('Later donor','other',null,
 (now() at time zone 'Asia/Kolkata')::date,'cash',500,'later cash slip',
 'e2000000-0000-0000-0000-000000000017') as later_donation_id \gset
select set_config('phase7.later_donation',:'later_donation_id',true);
reset role;
select set_config('request.jwt.claims',
 '{"sub":"e1000000-0000-0000-0000-000000000002","session_id":"e1000000-0000-0000-0000-000000000002","role":"authenticated"}',true);
set local role authenticated;
select public.decide_one_time_donation(current_setting('phase7.later_donation')::uuid,
 'verify',500,current_setting('phase7.account')::uuid,null,
 'e2000000-0000-0000-0000-000000000018');
reset role;
-- Only the server role gets the exact-code projection. Superseded and unknown
-- codes return no rows; the public route maps both to the same response.
select set_config('phase7.monthly_code',(select code from public.monthly_receipts
 where claim_id=current_setting('phase7.claim')::uuid),true);
select set_config('phase7.old_one_time_code',(select receipt_code::text
 from public.one_time_donations where id=current_setting('phase7.donation')::uuid),true);
select set_config('phase7.new_one_time_code',(select receipt_code::text
 from public.one_time_donations where id=current_setting('phase7.later_donation')::uuid),true);
select set_config('phase7.old_correction_code',(select code
 from public.finance_correction_receipts
 where correction_id=current_setting('phase7.correction')::uuid),true);
select set_config('phase7.new_correction_code',(select code
 from public.finance_correction_receipts
 where correction_id=current_setting('phase7.later_correction')::uuid),true);
set local role service_role;
do $$ begin
 if (select amount_paise from public.lookup_active_receipt(
     current_setting('phase7.monthly_code')))<>'3000'
  or (select amount_paise from public.lookup_active_receipt(
     current_setting('phase7.new_one_time_code')))<>'500'
  or (select amount_paise from public.lookup_active_receipt(
     current_setting('phase7.new_correction_code')))<>'800'
  or exists(select 1 from public.lookup_active_receipt(
     current_setting('phase7.old_one_time_code')))
  or exists(select 1 from public.lookup_active_receipt(
     current_setting('phase7.old_correction_code')))
  or exists(select 1 from public.lookup_active_receipt('MEM2-R-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'))
 then raise exception 'public receipt projection mismatch'; end if;
end $$;
reset role;
select set_config('request.jwt.claims',
 '{"sub":"e1000000-0000-0000-0000-000000000001","session_id":"e1000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select public.request_finance_report('month',date_trunc('month',now() at time zone 'Asia/Kolkata')::date,
 (date_trunc('month',now() at time zone 'Asia/Kolkata')+interval '1 month')::date,
 false,'e2000000-0000-0000-0000-000000000019') as revised_run_id \gset
select set_config('phase7.revised_run',:'revised_run_id',true);
reset role;
do $$ begin
 if (select count(*) from public.finance_report_effects
     where run_id=current_setting('phase7.run')::uuid)<>9
  or (select count(*) from public.finance_report_effects
     where run_id=current_setting('phase7.revised_run')::uuid)<>12
  or (select closing_paise from public.list_finance_report_balances(
     current_setting('phase7.run')::uuid)
     where account_id=current_setting('phase7.account')::uuid)<>'8900'
  or (select closing_paise from public.list_finance_report_balances(
     current_setting('phase7.revised_run')::uuid)
     where account_id=current_setting('phase7.account')::uuid)<>'9300'
  or (select income_paise from public.list_finance_report_balances(
     current_setting('phase7.revised_run')::uuid)
     where account_id=current_setting('phase7.account')::uuid)<>'1300'
  or (select coalesce(sum(e.amount_paise::numeric),0) from public.finance_report_effects s
     join public.finance_effects e on e.id=s.effect_id
     where s.run_id=current_setting('phase7.revised_run')::uuid)<>18300 then
  raise exception 'report revision did not preserve original snapshot'; end if;
end $$;
reset role;
-- A range beginning tomorrow carries today's balances forward as opening
-- amounts and contains no period lines.
select set_config('request.jwt.claims',
 '{"sub":"e1000000-0000-0000-0000-000000000001","session_id":"e1000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select public.request_finance_report('range',
 (now() at time zone 'Asia/Kolkata')::date+1,
 (now() at time zone 'Asia/Kolkata')::date+2,false,
 'e2000000-0000-0000-0000-000000000021') as next_range_run_id \gset
select set_config('phase7.next_range',:'next_range_run_id',true);
reset role;
do $$ begin
 if (select count(*) from public.list_finance_report_lines(
     current_setting('phase7.next_range')::uuid))<>0
  or not exists(select 1 from public.list_finance_report_balances(
     current_setting('phase7.next_range')::uuid)
     where account_id=current_setting('phase7.account')::uuid
       and opening_paise='9300' and period_openings_paise='0'
       and income_paise='0' and expense_paise='0' and transfer_paise='0'
       and closing_paise='9300')
  or not exists(select 1 from public.list_finance_report_balances(
     current_setting('phase7.next_range')::uuid)
     where account_id=current_setting('phase7.second_account')::uuid
       and opening_paise='9000' and period_openings_paise='0'
       and income_paise='0' and expense_paise='0' and transfer_paise='0'
       and closing_paise='9000') then
  raise exception 'period opening carry-forward mismatch'; end if;
end $$;
select set_config('request.jwt.claims',
 '{"sub":"e1000000-0000-0000-0000-000000000004","session_id":"e1000000-0000-0000-0000-000000000004","role":"authenticated"}',true);
set local role authenticated;
do $$ begin
 perform public.list_finance_report_balances(current_setting('phase7.run')::uuid);
 begin
 perform public.request_finance_report('month',date_trunc('month',now() at time zone 'Asia/Kolkata')::date,
  (date_trunc('month',now() at time zone 'Asia/Kolkata')+interval '1 month')::date,
  false,'e2000000-0000-0000-0000-000000000007');
 raise exception 'System Admin generated a report';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claims',
 '{"sub":"e1000000-0000-0000-0000-000000000001","session_id":"e1000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
do $$ declare v_run uuid:=current_setting('phase7.revised_run')::uuid;
begin
 if (select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb)
     from public.worker_finance_report_lines(v_run) x)
    is distinct from
    (select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb)
     from public.list_finance_report_lines(v_run) x)
  or (select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb)
     from public.worker_finance_report_balances(v_run) x)
    is distinct from
    (select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb)
     from public.list_finance_report_balances(v_run) x) then
  raise exception 'worker and actor report projection drift'; end if;
end $$;
set local role service_role;
select artifact_claim from (select row_to_json(claim)::text as artifact_claim
 from public.claim_finance_report_artifact() claim) captured \gset
reset role;
select set_config('phase7.artifact_run',(:'artifact_claim'::jsonb->>'run_id'),true),
 set_config('phase7.artifact_format',(:'artifact_claim'::jsonb->>'format'),true),
 set_config('phase7.artifact_lease',(:'artifact_claim'::jsonb->>'lease_token'),true);
do $$ begin
 if not exists(select 1 from public.finance_report_artifacts
  where run_id=current_setting('phase7.artifact_run')::uuid
    and format=current_setting('phase7.artifact_format') and status='processing'
    and attempts=1 and lease_token=current_setting('phase7.artifact_lease')::uuid)
 then raise exception 'artifact claim state mismatch'; end if;
end $$;
set local role service_role;
do $$ begin
 if public.finish_finance_report_artifact(current_setting('phase7.artifact_run')::uuid,
   current_setting('phase7.artifact_format'),
   '00000000-0000-0000-0000-000000000001'::uuid,
   current_setting('phase7.artifact_run')||'/'||current_setting('phase7.artifact_format')||'/'||
   '00000000-0000-0000-0000-000000000001'||'.'||current_setting('phase7.artifact_format'),
   repeat('a',64),10)
 then raise exception 'stale artifact lease accepted'; end if;
 if not public.finish_finance_report_artifact(current_setting('phase7.artifact_run')::uuid,
   current_setting('phase7.artifact_format'),current_setting('phase7.artifact_lease')::uuid,
   current_setting('phase7.artifact_run')||'/'||current_setting('phase7.artifact_format')||'/'||
   current_setting('phase7.artifact_lease')||'.'||current_setting('phase7.artifact_format'),
   repeat('a',64),10)
 then raise exception 'valid artifact lease rejected'; end if;
 if public.fail_finance_report_artifact(current_setting('phase7.artifact_run')::uuid,
   current_setting('phase7.artifact_format'),current_setting('phase7.artifact_lease')::uuid,
   'upload_ambiguous',true)
 then raise exception 'late failure changed an already-ready artifact'; end if;
end $$;
reset role;
do $$ begin
 if not exists(select 1 from public.finance_report_artifacts
   where run_id=current_setting('phase7.artifact_run')::uuid
     and format=current_setting('phase7.artifact_format') and status='ready'
     and object_path=current_setting('phase7.artifact_run')||'/'||
       current_setting('phase7.artifact_format')||'/'||current_setting('phase7.artifact_lease')||'.'||
       current_setting('phase7.artifact_format') and failure_code is null)
 then raise exception 'late failure erased a ready artifact reference'; end if;
end $$;
set local role authenticated;
do $$ begin
 if not exists(select 1 from public.finance_report_artifact_status(
   current_setting('phase7.artifact_run')::uuid)
   where format=current_setting('phase7.artifact_format') and status='ready'
     and sha256=repeat('a',64))
 then raise exception 'authorized artifact status mismatch'; end if;
end $$;
reset role;
-- Queue seed must advance past the first 20 already-seeded artifacts.
set local role authenticated;
do $$ declare v_index integer;
begin
 for v_index in 1..11 loop
  perform public.request_finance_report('month',
   date_trunc('month',now() at time zone 'Asia/Kolkata')::date,
   (date_trunc('month',now() at time zone 'Asia/Kolkata')+interval '1 month')::date,
   false,gen_random_uuid());
 end loop;
end $$;
reset role;
set local role service_role;
do $$ declare v_claim record; v_index integer;
begin
 for v_index in 1..27 loop
  select * into v_claim from public.claim_finance_report_artifact();
  if not found then raise exception 'artifact queue starved at item %',v_index; end if;
  if not public.fail_finance_report_artifact(v_claim.run_id,v_claim.format,
   v_claim.lease_token,'render_failed',true) then
   raise exception 'artifact terminal failure was not recorded'; end if;
 end loop;
 if exists(select 1 from public.claim_finance_report_artifact())
  or (select count(*) from public.finance_report_artifacts)<>
    2*(select count(*) from public.finance_report_runs) then
  raise exception 'artifact queue did not cover every report format'; end if;
end $$;
reset role;
update public.finance_report_artifacts set status='queued',attempts=0,
 object_path=null,sha256=null,byte_count=null,failure_code=null
 where run_id=current_setting('phase7.artifact_run')::uuid
  and format=current_setting('phase7.artifact_format');
set local role service_role;
do $$ declare v_claim record; v_index integer;
begin
 for v_index in 1..3 loop
  select * into v_claim from public.claim_finance_report_artifact();
  if not found or v_claim.run_id<>current_setting('phase7.artifact_run')::uuid then
   raise exception 'bounded retry claim mismatch at %',v_index; end if;
  if not public.fail_finance_report_artifact(v_claim.run_id,v_claim.format,
   v_claim.lease_token,'render_failed',false) then
   raise exception 'retryable artifact failure rejected'; end if;
 end loop;
 if exists(select 1 from public.claim_finance_report_artifact()) then
  raise exception 'artifact retry cap failed'; end if;
end $$;
reset role;
do $$ begin
 if not exists(select 1 from public.finance_report_artifacts
   where run_id=current_setting('phase7.artifact_run')::uuid
    and format=current_setting('phase7.artifact_format') and status='failed' and attempts=3)
 then raise exception 'artifact failure state after retry cap mismatch'; end if;
end $$;
set local role service_role;
do $$ declare v_path text; v_failure text;
begin
 select last_attempt_path,failure_code into v_path,v_failure
 from public.finance_report_artifacts
 where run_id=current_setting('phase7.artifact_run')::uuid
  and format=current_setting('phase7.artifact_format');
 if v_path is null or v_failure<>'render_failed' then
  raise exception 'failed artifact attempt path missing'; end if;
 if public.requeue_failed_finance_report_artifact(
   current_setting('phase7.artifact_run')::uuid,current_setting('phase7.artifact_format'),
   'wrong/path',v_failure,'fixture operator') then
  raise exception 'stale recovery path accepted'; end if;
 if not public.requeue_failed_finance_report_artifact(
   current_setting('phase7.artifact_run')::uuid,current_setting('phase7.artifact_format'),
   v_path,v_failure,'fixture operator') then
  raise exception 'terminal artifact recovery failed'; end if;
 if public.requeue_failed_finance_report_artifact(
   current_setting('phase7.artifact_run')::uuid,current_setting('phase7.artifact_format'),
   v_path,v_failure,'fixture operator') then
  raise exception 'duplicate artifact recovery accepted'; end if;
end $$;
reset role;
do $$ begin
 if not exists(select 1 from public.finance_report_artifacts
   where run_id=current_setting('phase7.artifact_run')::uuid
    and format=current_setting('phase7.artifact_format') and status='queued' and attempts=0)
  or not exists(select 1 from public.finance_report_artifact_recoveries
   where run_id=current_setting('phase7.artifact_run')::uuid
    and format=current_setting('phase7.artifact_format')
    and previous_failure_code='render_failed' and operator_note='fixture operator')
 then raise exception 'artifact recovery audit mismatch'; end if;
end $$;
set local role service_role;
select recovered_artifact_claim from (select row_to_json(claim)::text as recovered_artifact_claim
 from public.claim_finance_report_artifact() claim) captured \gset
reset role;
select set_config('phase7.recovered_run',(:'recovered_artifact_claim'::jsonb->>'run_id'),true),
 set_config('phase7.recovered_format',(:'recovered_artifact_claim'::jsonb->>'format'),true),
 set_config('phase7.expired_lease',(:'recovered_artifact_claim'::jsonb->>'lease_token'),true);
do $$ begin
 if current_setting('phase7.artifact_run')::uuid<>current_setting('phase7.recovered_run')::uuid
  or current_setting('phase7.artifact_format')<>current_setting('phase7.recovered_format')
 then raise exception 'recovered artifact was not claimable'; end if;
end $$;
update public.finance_report_artifacts set lease_expires_at=now()-interval '1 second'
 where run_id=current_setting('phase7.artifact_run')::uuid
  and format=current_setting('phase7.artifact_format');
set local role service_role;
do $$ begin
 if exists(select 1 from public.claim_finance_report_artifact()) then
  raise exception 'expired lease retried automatically'; end if;
end $$;
reset role;
do $$ begin
 if not exists(select 1 from public.finance_report_artifacts
  where run_id=current_setting('phase7.artifact_run')::uuid
   and format=current_setting('phase7.artifact_format')
   and status='failed' and attempts=3 and failure_code='lease_expired'
   and last_attempt_path=current_setting('phase7.artifact_run')||'/'||
    current_setting('phase7.artifact_format')||'/'||current_setting('phase7.expired_lease')||'.'||
    current_setting('phase7.artifact_format'))
 then raise exception 'expired lease path was not retained'; end if;
end $$;
rollback;
