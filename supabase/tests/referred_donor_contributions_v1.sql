\set ON_ERROR_STOP on
begin;
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at)
select id,'00000000-0000-0000-0000-000000000000'::uuid,'authenticated','authenticated',email,'',now(),now(),now()
from (values
 ('d1000000-0000-0000-0000-000000000001'::uuid,'ref-donor-member@example.invalid'),
 ('d1000000-0000-0000-0000-000000000002'::uuid,'ref-donor-finance@example.invalid'),
 ('d1000000-0000-0000-0000-000000000003'::uuid,'ref-donor-referrer@example.invalid'),
 ('d1000000-0000-0000-0000-000000000004'::uuid,'ref-donor-other@example.invalid')) u(id,email);
insert into public.application_users(id,auth_user_id,status) values
 ('d2000000-0000-0000-0000-000000000001','d1000000-0000-0000-0000-000000000001','active'),
 ('d2000000-0000-0000-0000-000000000002','d1000000-0000-0000-0000-000000000002','active'),
 ('d2000000-0000-0000-0000-000000000003','d1000000-0000-0000-0000-000000000003','active'),
 ('d2000000-0000-0000-0000-000000000004','d1000000-0000-0000-0000-000000000004','active');
insert into public.application_user_roles(application_user_id,role_id)
select u.id,r.id from (values
 ('d2000000-0000-0000-0000-000000000001'::uuid,'committee_member'),
 ('d2000000-0000-0000-0000-000000000002'::uuid,'finance'),
 ('d2000000-0000-0000-0000-000000000003'::uuid,'committee_member'),
 ('d2000000-0000-0000-0000-000000000004'::uuid,'committee_member')) u(id,role_key)
join public.roles r on r.key = u.role_key;
insert into public.finance_accounts(id,name,account_type,created_by_application_user_id)
values ('d3000000-0000-0000-0000-000000000001','Donor cash','cash','d2000000-0000-0000-0000-000000000002');

select set_config('request.jwt.claims','{"sub":"d1000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select public.submit_referred_donor_contribution('Ahmed',100000,'cash','ref-donor-submit-a',
 'd2000000-0000-0000-0000-000000000003','General donation',current_date,null,null);
do $$ declare v_row public.referred_donor_contributions; begin
  select * into v_row from public.submit_referred_donor_contribution('Ahmed',100000,'cash','ref-donor-submit-a',
    'd2000000-0000-0000-0000-000000000003','General donation',current_date,null,null);
  if v_row.status <> 'submitted' or v_row.receipt_number is not null then
    raise exception 'FAIL: receipt issued before verification'; end if;
  if (select count(*) from public.financial_transactions where reference_id = v_row.id) <> 0 then
    raise exception 'FAIL: unverified amount posted'; end if;
  begin
    perform public.submit_referred_donor_contribution('Changed',100000,'cash','ref-donor-submit-a',
      'd2000000-0000-0000-0000-000000000003','General donation',current_date,null,null);
    raise exception 'FAIL: conflicting submission accepted';
  exception when unique_violation then null; end;
  begin
    perform public.decide_referred_donor_contribution(v_row.id,true,
      'd3000000-0000-0000-0000-000000000001',current_date,null,'self-review');
    raise exception 'FAIL: submitter verified own donation';
  exception when insufficient_privilege then null; end;
  begin
    perform public.void_referred_donor_contribution(v_row.id,'Incorrect donation amount','member-void');
    raise exception 'FAIL: committee member could void a receipt';
  exception when insufficient_privilege then null; end;
  begin
    update public.referred_donor_contributions set amount_paise = 1 where id = v_row.id;
    raise exception 'FAIL: direct mutation allowed';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

select set_config('request.jwt.claims','{"sub":"d1000000-0000-0000-0000-000000000004","role":"authenticated"}',true);
set local role authenticated;
do $$ begin
  if (select count(*) from public.referred_donor_contributions) <> 0 then
    raise exception 'FAIL: unrelated member sees donor identity'; end if;
  if has_function_privilege('anon','public.decide_referred_donor_contribution(uuid,boolean,uuid,date,text,text)','EXECUTE') then
    raise exception 'FAIL: anonymous reviewer'; end if;
end $$;
reset role;

select set_config('request.jwt.claims','{"sub":"d1000000-0000-0000-0000-000000000002","role":"authenticated"}',true);
set local role authenticated;
do $$ declare v_id uuid; v_row public.referred_donor_contributions; v_repeat public.referred_donor_contributions; v_activity record; begin
  select id into v_id from public.referred_donor_contributions where submitted_operation_id = 'ref-donor-submit-a';
  select * into v_row from public.decide_referred_donor_contribution(v_id,true,
    'd3000000-0000-0000-0000-000000000001',current_date,null,'ref-donor-verify-a');
  if v_row.status <> 'verified' or v_row.receipt_number !~ '^MEM2-[0-9]{4}-[0-9]{8}$'
    or v_row.posted_transaction_id is null then
    raise exception 'FAIL: verified receipt or posting missing'; end if;
  select * into v_repeat from public.decide_referred_donor_contribution(v_id,true,
    'd3000000-0000-0000-0000-000000000001',current_date,null,'ref-donor-verify-a');
  if v_repeat.posted_transaction_id <> v_row.posted_transaction_id
     or (select count(*) from public.financial_transactions where reference_id = v_id) <> 1 then
    raise exception 'FAIL: verification posted more than once'; end if;
  begin
    perform public.decide_referred_donor_contribution(v_id,true,
      'd3000000-0000-0000-0000-000000000001',current_date,null,'new-operation');
    raise exception 'FAIL: second decision accepted';
  exception when unique_violation then null; end;
  select * into v_activity from public.list_member_activity(
    (now() at time zone 'Asia/Kolkata')::date,(now() at time zone 'Asia/Kolkata')::date)
  where application_user_id = 'd2000000-0000-0000-0000-000000000003';
  if v_activity.verified_referred_donation_count <> 1
     or v_activity.verified_referred_donation_paise <> 100000 then
    raise exception 'FAIL: activity credit mismatch: %',row_to_json(v_activity); end if;
  select * into v_activity from public.list_member_activity(
    (now() at time zone 'Asia/Kolkata')::date,(now() at time zone 'Asia/Kolkata')::date)
  where application_user_id = 'd2000000-0000-0000-0000-000000000001';
  if v_activity.verified_referred_donation_count <> 0 then
    raise exception 'FAIL: submitter received someone else''s referral credit'; end if;
end $$;
reset role;

select set_config('request.jwt.claims','{"sub":"d1000000-0000-0000-0000-000000000003","role":"authenticated"}',true);
set local role authenticated;
do $$ declare v_entry jsonb; begin
  select item into v_entry from jsonb_array_elements(
    public.get_finance_date_range_report(current_date,current_date)->'ledger') item
  where item->>'reference_type'='referred_donor_contribution'
    and item->>'receipt_number' like 'MEM2-%';
  if v_entry->>'donor_name' <> 'Ahmed' or v_entry->>'donation_purpose' <> 'General donation'
     or v_entry->>'donation_payment_method' <> 'cash' or v_entry->>'amount_paise' <> '100000' then
    raise exception 'FAIL: verified donor missing from finance report: %',v_entry;
  end if;
end $$;
reset role;

do $$ declare v_report public.finance_monthly_reports; v_entry jsonb; begin
  select * into v_report from private.build_finance_monthly_report_snapshot(
    date_trunc('month',current_date)::date,'manual');
  select item into v_entry from private.finance_monthly_report_snapshots s,
    lateral jsonb_array_elements(s.snapshot->'donations') item
  where s.report_id=v_report.id and item->>'reference_type'='referred_donor_contribution'
    and item->>'receipt_number' like 'MEM2-%';
  if v_entry->>'donor_name' <> 'Ahmed' or v_entry->>'donation_purpose' <> 'General donation'
     or v_entry->>'donation_payment_method' <> 'cash' or v_entry->>'amount_paise' <> '100000' then
    raise exception 'FAIL: verified donor missing from monthly snapshot: %',v_entry;
  end if;
end $$;

select set_config('request.jwt.claims','{"sub":"d1000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
set local role authenticated;
-- Voiding must preserve the original receipt and post exactly one opposite ledger entry.
reset role;
do $$ declare v_target uuid; v_actor uuid; begin
  select posted_transaction_id,submitted_by_application_user_id into v_target,v_actor
    from public.referred_donor_contributions where submitted_operation_id='ref-donor-submit-a';
  begin
    insert into public.finance_adjustments
      (adjustment_type,target_transaction_id,reason,business_date,submitted_by_application_user_id)
    values ('reversal',v_target,'Incorrect receipt amount',current_date,v_actor);
    raise exception 'FAIL: generic reversal left verified donor receipt active';
  exception when invalid_parameter_value then
    if sqlerrm <> 'use_referred_donor_void' then raise; end if;
  end;
end $$;
select set_config('request.jwt.claims','{"sub":"d1000000-0000-0000-0000-000000000002","role":"authenticated"}',true);
set local role authenticated;
do $$ declare v_row public.referred_donor_contributions; v_repeat public.referred_donor_contributions; v_entry jsonb; begin
  select * into v_row from public.void_referred_donor_contribution(
    (select id from public.referred_donor_contributions where submitted_operation_id='ref-donor-submit-a'),
    'Original amount entered incorrectly','ref-donor-void-a');
  if v_row.status <> 'voided' or v_row.reversal_transaction_id is null
     or v_row.receipt_number is null then raise exception 'FAIL: void lost receipt history'; end if;
  if not exists (select 1 from public.financial_transactions ft
    where ft.id=v_row.reversal_transaction_id and ft.transaction_category='REVERSAL'
      and ft.direction='outflow' and ft.amount_paise=v_row.amount_paise
      and ft.related_transaction_id=v_row.posted_transaction_id) then
    raise exception 'FAIL: void lacks matching ledger reversal'; end if;
  select * into v_repeat from public.void_referred_donor_contribution(v_row.id,
    'Original amount entered incorrectly','ref-donor-void-a');
  if v_repeat.reversal_transaction_id<>v_row.reversal_transaction_id or
     (select count(*) from public.financial_transactions where reference_id=v_row.id)<>2 then
    raise exception 'FAIL: void retry posted twice'; end if;
  if (select verified_referred_donation_count from public.list_member_activity(
    (now() at time zone 'Asia/Kolkata')::date,(now() at time zone 'Asia/Kolkata')::date)
    where application_user_id='d2000000-0000-0000-0000-000000000003')<>0 then
    raise exception 'FAIL: voided donation still earns member activity credit'; end if;
  select item into v_entry from jsonb_array_elements(
    public.get_finance_date_range_report(current_date,current_date)->'ledger') item
    where item->>'id'=v_row.posted_transaction_id::text;
  if v_entry->>'donation_status'<>'voided' or v_entry->>'receipt_number'<>v_row.receipt_number then
    raise exception 'FAIL: report lost voided receipt history: %',v_entry; end if;
  begin
    perform public.void_referred_donor_contribution(v_row.id,
      'Another reason for this void','ref-donor-void-b');
    raise exception 'FAIL: second void accepted';
  exception when unique_violation then null; end;
end $$;
reset role;

select set_config('request.jwt.claims','{"sub":"d1000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
set local role authenticated;
do $$ declare v_old uuid; v_new public.referred_donor_contributions; begin
  select id into v_old from public.referred_donor_contributions
    where submitted_operation_id='ref-donor-submit-a';
  select * into v_new from public.submit_referred_donor_contribution('Ahmed',95000,'cash',
    'ref-donor-correct-void-a','d2000000-0000-0000-0000-000000000003',
    'General donation',current_date,null,null,v_old);
  if v_new.replaces_contribution_id<>v_old or v_new.status<>'submitted' then
    raise exception 'FAIL: voided receipt could not be corrected'; end if;
end $$;
select public.submit_referred_donor_contribution('Fatima',25000,'upi','ref-donor-submit-b',
 'd2000000-0000-0000-0000-000000000003','Education',current_date,null,'UPI-REF-123');
reset role;
select set_config('request.jwt.claims','{"sub":"d1000000-0000-0000-0000-000000000002","role":"authenticated"}',true);
set local role authenticated;
do $$ declare v_row public.referred_donor_contributions; begin
  select * into v_row from public.decide_referred_donor_contribution(
    (select id from public.referred_donor_contributions where submitted_operation_id='ref-donor-submit-b'),
    false,null,null,'Unconfirmed payment','ref-donor-reject-b');
  if v_row.status <> 'rejected' or v_row.receipt_number is not null
     or exists (select 1 from public.financial_transactions where reference_id=v_row.id) then
    raise exception 'FAIL: rejection created a financial effect'; end if;
end $$;
reset role;
select set_config('request.jwt.claims','{"sub":"d1000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
set local role authenticated;
do $$ declare v_original uuid; v_revised public.referred_donor_contributions; begin
  select id into v_original from public.referred_donor_contributions
    where submitted_operation_id = 'ref-donor-submit-b';
  select * into v_revised from public.submit_referred_donor_contribution(
    'Fatima',25000,'upi','ref-donor-submit-c',
    'd2000000-0000-0000-0000-000000000003','Education',current_date,null,'UPI-CORRECT-124',v_original);
  if v_revised.replaces_contribution_id <> v_original or v_revised.status <> 'submitted'
     or (select status from public.referred_donor_contributions where id=v_original) <> 'rejected' then
    raise exception 'FAIL: correction did not preserve the original rejection'; end if;
  begin
    perform public.submit_referred_donor_contribution(
      'Fatima',25000,'upi','ref-donor-submit-d',
      'd2000000-0000-0000-0000-000000000003','Education',current_date,null,'UPI-CORRECT-125',v_original);
    raise exception 'FAIL: duplicate correction accepted';
  exception when invalid_parameter_value then null; end;
end $$;
reset role;
rollback;
