-- Run with psql against a disposable database after the ordered fresh migrations.
-- This transaction leaves no test users or money behind.
begin;

insert into auth.users(id,instance_id,aud,role,email,encrypted_password,
  email_confirmed_at,created_at,updated_at)
select id,'00000000-0000-0000-0000-000000000000'::uuid,'authenticated',
  'authenticated',email,'',now(),now(),now()
from (values
  ('a1000000-0000-0000-0000-000000000001'::uuid,'entry@example.invalid'),
  ('a1000000-0000-0000-0000-000000000002'::uuid,'treasurer@example.invalid'),
  ('a1000000-0000-0000-0000-000000000003'::uuid,'admin@example.invalid'),
  ('a1000000-0000-0000-0000-000000000004'::uuid,'president@example.invalid'),
  ('a1000000-0000-0000-0000-000000000005'::uuid,'member@example.invalid')
) fixture(id,email);

insert into public.app_users(id,role) values
 ('a1000000-0000-0000-0000-000000000001','data_entry'),
 ('a1000000-0000-0000-0000-000000000002','treasurer'),
 ('a1000000-0000-0000-0000-000000000003','system_admin'),
 ('a1000000-0000-0000-0000-000000000004','president'),
 ('a1000000-0000-0000-0000-000000000005','member');
insert into app_private.username_aliases(user_id,username,must_change_password) values
 ('a1000000-0000-0000-0000-000000000001','fixtureentry',false),
 ('a1000000-0000-0000-0000-000000000002','fixturetreasurer',false),
 ('a1000000-0000-0000-0000-000000000003','fixtureadmin',false),
 ('a1000000-0000-0000-0000-000000000004','fixturepresident',false),
 ('a1000000-0000-0000-0000-000000000005','fixturemember',false);
insert into public.masjid_accounts(id,name,kind)
values ('a2000000-0000-0000-0000-000000000001','Test bank','bank');
insert into app_private.approved_consent_versions(version,approved_at,approved_by)
values ('fixture-v1',now(),'a1000000-0000-0000-0000-000000000004');
do $$
declare v_member_donor uuid;
begin
  v_member_donor := public.enroll_versioned_monthly_donor(
    'Member referred donor','+919000000005',10000,
    'a1000000-0000-0000-0000-000000000005',
    'a1000000-0000-0000-0000-000000000005',
    'in-person',now(),'fixture-v1','member consent evidence');
  if not exists (select 1 from public.monthly_donors where id=v_member_donor
      and entered_by='a1000000-0000-0000-0000-000000000005'
      and referrer_id='a1000000-0000-0000-0000-000000000005') then
    raise exception 'accepted member enrollment failed';
  end if;
  begin
    perform public.enroll_versioned_monthly_donor('No referrer','+919000000006',10000,
      null,'a1000000-0000-0000-0000-000000000005',
      'in-person',now(),'fixture-v1','member consent evidence');
    raise exception 'missing referrer accepted';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.enroll_versioned_monthly_donor('Admin entry','+919000000007',10000,
      'a1000000-0000-0000-0000-000000000005',
      'a1000000-0000-0000-0000-000000000003',
      'in-person',now(),'fixture-v1','admin consent evidence');
    raise exception 'system admin enrollment accepted';
  exception when insufficient_privilege then null;
  end;
end $$;
insert into public.account_openings(id,account_id,amount_paise,evidence_reference,
  submitted_by,submit_operation_id,verified_by,verify_operation_id,verified_at)
values ('a2200000-0000-0000-0000-000000000001',
  'a2000000-0000-0000-0000-000000000001',0,'zero opening evidence',
  'a1000000-0000-0000-0000-000000000002','a2300000-0000-0000-0000-000000000001',
  'a1000000-0000-0000-0000-000000000004','a2300000-0000-0000-0000-000000000002',now());
insert into public.finance_effects(account_id,source_type,source_id,leg,amount_paise)
values ('a2000000-0000-0000-0000-000000000001','account_opening',
  'a2200000-0000-0000-0000-000000000001',0,0);
insert into public.payment_qr_versions(id,account_id,asset_path,asset_sha256,created_by)
values ('a2100000-0000-0000-0000-000000000001',
  'a2000000-0000-0000-0000-000000000001','test/qr.png',repeat('a',64),
  'a1000000-0000-0000-0000-000000000001');
insert into app_private.qr_assets(asset_path,sha256_hex,bytes)
values ('test/qr.png',repeat('a',64),64);

do $$
begin
  if has_table_privilege('authenticated','public.ledger_entries','INSERT')
     or has_table_privilege('anon','public.monthly_donors','SELECT')
     or has_function_privilege('anon','public.verify_monthly_claim(uuid,uuid,bigint,uuid)','EXECUTE')
     or has_function_privilege('authenticated','public.queue_monthly_request(uuid,date)','EXECUTE')
     or has_function_privilege('authenticated','public.enroll_versioned_monthly_donor(text,text,bigint,uuid,uuid,text,timestamptz,text,text)','EXECUTE')
     or has_function_privilege('authenticated','public.record_monthly_donor_opt_out(uuid,text)','EXECUTE') then
    raise exception 'direct finance or anonymous access exposed'; end if;
end;
$$;

-- Synthetic JWTs use the actor UUID as their test session ID.
insert into auth.sessions(id,user_id)
select u.id,u.id from auth.users u join public.app_users a on a.id=u.id
on conflict do nothing;

select set_config('request.jwt.claims',
  '{"sub":"a1000000-0000-0000-0000-000000000004","session_id":"a1000000-0000-0000-0000-000000000004","role":"authenticated"}',true);
set local role authenticated;
do $$ begin
  if not public.payment_qr_account_eligible('a2000000-0000-0000-0000-000000000001')
    or public.payment_qr_account_eligible('a2000000-0000-0000-0000-000000000099') then
    raise exception 'QR account eligibility incorrect'; end if;
end $$;
do $$ begin
  if (select count(*) from public.active_payment_qr_for_staff(
      'a2000000-0000-0000-0000-000000000001'))<>1
     or (select count(*) from public.active_payment_qr_for_staff(
      'a2000000-0000-0000-0000-000000000099'))<>0 then
    raise exception 'President active QR read incorrect'; end if;
end $$;
select set_config('request.jwt.claims',
  '{"sub":"a1000000-0000-0000-0000-000000000002","session_id":"a1000000-0000-0000-0000-000000000002","role":"authenticated"}',true);
do $$ begin
  if (select count(*) from public.active_payment_qr_for_staff(
      'a2000000-0000-0000-0000-000000000001'))<>1 then
    raise exception 'Treasurer active QR read denied'; end if;
end $$;
select set_config('request.jwt.claims',
  '{"sub":"a1000000-0000-0000-0000-000000000001","session_id":"a1000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
do $$ begin
  perform public.payment_qr_account_eligible('a2000000-0000-0000-0000-000000000001');
  raise exception 'Data Entry checked private QR eligibility';
exception when insufficient_privilege then null;
end $$;
do $$ begin
  perform public.activate_payment_qr(
    'a2000000-0000-0000-0000-000000000001',
    'test/qr.png',repeat('a',64),
    'a3000000-0000-4000-8000-000000000001');
  raise exception 'Data Entry activated payment QR';
exception when insufficient_privilege then null;
end $$;
do $$ begin
  perform public.active_payment_qr_for_staff('a2000000-0000-0000-0000-000000000001');
  raise exception 'Data Entry read active QR';
exception when insufficient_privilege then null; end $$;
select set_config('request.jwt.claims',
  '{"sub":"a1000000-0000-0000-0000-000000000005","session_id":"a1000000-0000-0000-0000-000000000005","role":"authenticated"}',true);
do $$ begin
  perform public.payment_qr_account_eligible('a2000000-0000-0000-0000-000000000001');
  raise exception 'member checked private QR eligibility';
exception when insufficient_privilege then null; end $$;
do $$ begin
  perform public.active_payment_qr_for_staff('a2000000-0000-0000-0000-000000000001');
  raise exception 'Member read active QR';
exception when insufficient_privilege then null; end $$;
reset role;

select set_config('request.jwt.claims',
  '{"sub":"a1000000-0000-0000-0000-000000000001","session_id":"a1000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
select public.enroll_versioned_monthly_donor('Test donor','+919000000000',100000,
  'a1000000-0000-0000-0000-000000000003',
  'a1000000-0000-0000-0000-000000000001',
  'in-person',now(),'fixture-v1','test signed consent') as donor_id \gset
select public.queue_monthly_request(:'donor_id'::uuid,'2026-10-01');
select public.dispatch_first_friday_monthly_requests('2026-10-02T04:30:00Z');
select public.submit_monthly_claim(:'donor_id'::uuid,'2026-10-01','TEST-UPI-123')
  as claim_id \gset
select set_config('test.donor', :'donor_id',true);
do $$ begin
  if (select qr_sha256 from public.monthly_requests
      where donor_id=current_setting('test.donor',true)::uuid) <> repeat('a',64)
    or public.queue_due_monthly_reminders(now()+interval '4 days') <> 0 then
    raise exception 'QR digest snapshot or early reminder invalid'; end if;
  begin
    perform public.dispatch_first_friday_monthly_requests('2026-10-09T04:30:00Z');
    raise exception 'second Friday dispatch accepted';
  exception when invalid_parameter_value then null;
  end;
end $$;
update public.monthly_message_outbox set state='sent',sent_at=now(),
  provider_message_id='fixture-request-1'
  where donor_id=:'donor_id'::uuid and purpose='request';
select public.queue_due_monthly_reminders(now()+interval '5 days');
select public.queue_monthly_request(:'donor_id'::uuid,'2026-10-01');
do $$
begin
  if (select count(*) from public.monthly_requests
      where donor_id=current_setting('test.donor',true)::uuid) <> 1
    or (select count(*) from public.monthly_message_outbox
      where donor_id=current_setting('test.donor',true)::uuid) <> 2
    or not public.monthly_reminder_eligible(
      current_setting('test.donor',true)::uuid,'2026-10-01') then
    raise exception 'pending month request or reminder state incorrect'; end if;
  if (select count(*) from public.list_monthly_donors()
    where donor_id=current_setting('test.donor',true)::uuid) <> 1 then
    raise exception 'donor roster missing'; end if;
end;
$$;

select set_config('test.claim', :'claim_id',true);
do $$
begin
  if exists (select 1 from public.ledger_entries
    where source_id=current_setting('test.claim',true)::uuid) then
    raise exception 'unverified claim posted money'; end if;
  begin
    perform public.verify_monthly_claim(current_setting('test.claim',true)::uuid,
      'a2000000-0000-0000-0000-000000000001',30000,
      'a3000000-0000-0000-0000-000000000001');
    raise exception 'data entry employee verified money';
  exception when insufficient_privilege then null;
  end;
end;
$$;

select set_config('request.jwt.claims',
  '{"sub":"a1000000-0000-0000-0000-000000000003","session_id":"a1000000-0000-0000-0000-000000000003","role":"authenticated"}',true);
do $$
begin
  begin
    perform public.verify_monthly_claim(current_setting('test.claim',true)::uuid,
      'a2000000-0000-0000-0000-000000000001',30000,
      'a3000000-0000-0000-0000-000000000002');
    raise exception 'System Admin verified money';
  exception when insufficient_privilege then null;
  end;
end;
$$;

select set_config('request.jwt.claims',
  '{"sub":"a1000000-0000-0000-0000-000000000002","session_id":"a1000000-0000-0000-0000-000000000002","role":"authenticated"}',true);
do $$
begin
  if (select count(*) from public.list_pending_monthly_claims()) <> 1
    or (select count(*) from public.list_active_masjid_accounts()) <> 1 then
    raise exception 'Treasurer review projection missing pending claim or account'; end if;
end;
$$;
select public.verify_monthly_claim(:'claim_id'::uuid,
  'a2000000-0000-0000-0000-000000000001',30000,
  'a3000000-0000-0000-0000-000000000001') as receipt_code \gset

do $$
declare v_receipt public.monthly_receipts;
begin
  select * into v_receipt from public.monthly_receipts
  where claim_id=current_setting('test.claim',true)::uuid;
  if v_receipt.amount_paise <> 30000
    or v_receipt.code !~ '^MEM2-R-[0-9A-F]{32}$'
    or (select amount_paise from public.ledger_entries
        where id=v_receipt.ledger_entry_id) <> 30000 then
    raise exception 'receipt and ledger disagree with actual payment'; end if;
  if (select count(*) from public.contribution_audit
      where claim_id=current_setting('test.claim',true)::uuid) <> 1 then
    raise exception 'verification audit missing'; end if;
  if (select count(*) from public.referral_provenance
      where claim_id=current_setting('test.claim',true)::uuid
        and referrer_id='a1000000-0000-0000-0000-000000000003') <> 1 then
    raise exception 'referrer provenance missing'; end if;
  if (select count(*) from public.finance_effects
      where source_type='monthly_contribution' and source_id=v_receipt.ledger_entry_id
        and amount_paise=30000 and account_id='a2000000-0000-0000-0000-000000000001') <> 1 then
    raise exception 'monthly contribution missing canonical finance effect'; end if;
  if (select count(*) from public.finance_effects
      where account_id='a2000000-0000-0000-0000-000000000001') <> 2
    or (select coalesce(sum(amount_paise::numeric),0) from public.finance_effects
      where account_id='a2000000-0000-0000-0000-000000000001') <> 30000
    or (select balance_paise from public.list_finance_accounts()
      where account_id='a2000000-0000-0000-0000-000000000001') <> '30000' then
    raise exception 'monthly account equation failed'; end if;
  if public.monthly_reminder_eligible(v_receipt.donor_id,'2026-10-01') then
    raise exception 'paid donor would receive a balance reminder'; end if;
  if exists (select 1 from public.list_pending_monthly_claims()) then
    raise exception 'verified claim still pending'; end if;
  begin
    update public.ledger_entries set amount_paise=1
      where id=v_receipt.ledger_entry_id;
    raise exception 'ledger entry was mutable';
  exception when insufficient_privilege then null;
  end;
end;
$$;

do $$
declare v_replay text;
begin
  v_replay := public.verify_monthly_claim(current_setting('test.claim',true)::uuid,
    'a2000000-0000-0000-0000-000000000001',30000,
    'a3000000-0000-0000-0000-000000000001');
  if v_replay <> (select code from public.monthly_receipts
      where claim_id=current_setting('test.claim',true)::uuid)
    or (select count(*) from public.ledger_entries
      where source_id=current_setting('test.claim',true)::uuid) <> 1 then
    raise exception 'idempotent retry duplicated posting'; end if;
end;
$$;

select set_config('request.jwt.claims',
  '{"sub":"a1000000-0000-0000-0000-000000000001","session_id":"a1000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
select public.submit_monthly_claim(:'donor_id'::uuid,'2026-10-01','TEST-UPI-456')
  as rejected_claim_id \gset
select set_config('test.rejected_claim', :'rejected_claim_id',true);
select set_config('request.jwt.claims',
  '{"sub":"a1000000-0000-0000-0000-000000000002","session_id":"a1000000-0000-0000-0000-000000000002","role":"authenticated"}',true);
select public.reject_monthly_claim(:'rejected_claim_id'::uuid,'Reference not found in bank',
  'a3000000-0000-0000-0000-000000000009');
do $$ begin
  if (select count(*) from public.list_rejected_monthly_claims())<>1
    or (select count(*) from public.list_rejected_monthly_claims(1,1))<>0
    or (select original_reference from public.list_rejected_monthly_claims())<>'TEST-UPI-456' then
    raise exception 'Treasurer rejected-claim review projection failed'; end if;
  begin
    perform public.list_rejected_monthly_claims(0,0);
    raise exception 'unbounded rejected-claim page accepted';
  exception when invalid_parameter_value then null; end;
end $$;
select set_config('request.jwt.claims',
  '{"sub":"a1000000-0000-0000-0000-000000000004","session_id":"a1000000-0000-0000-0000-000000000004","role":"authenticated"}',true);
do $$ begin
  if exists(select 1 from public.list_rejected_monthly_claims()) then
    raise exception 'other leader saw a claim they did not submit'; end if;
end $$;
select set_config('request.jwt.claims',
  '{"sub":"a1000000-0000-0000-0000-000000000005","session_id":"a1000000-0000-0000-0000-000000000005","role":"authenticated"}',true);
do $$ begin
  begin
    perform public.list_rejected_monthly_claims();
    raise exception 'Member read rejected-claim references';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claims',
  '{"sub":"a1000000-0000-0000-0000-000000000001","session_id":"a1000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
do $$ begin
  if (select count(*) from public.list_rejected_monthly_claims())<>1 then
    raise exception 'original submitter cannot review rejected claim'; end if;
end $$;
select public.resubmit_rejected_monthly_claim(:'rejected_claim_id'::uuid,'TEST-UPI-457')
  as replacement_claim_id \gset
select set_config('test.replacement_claim', :'replacement_claim_id',true);
do $$ begin
  if (select status from public.payment_claims
      where id=current_setting('test.rejected_claim',true)::uuid) <> 'rejected'
    or (select replaces_rejected_claim_id from public.payment_claims
      where id=current_setting('test.replacement_claim',true)::uuid)
      <> current_setting('test.rejected_claim',true)::uuid
    or public.resubmit_rejected_monthly_claim(
      current_setting('test.rejected_claim',true)::uuid,'TEST-UPI-457')
      <> current_setting('test.replacement_claim',true)::uuid
    or exists(select 1 from public.list_rejected_monthly_claims())
    or (select count(*) from public.monthly_receipts) <> 1 then
    raise exception 'rejection/resubmission changed financial posting'; end if;
  begin
    perform public.resubmit_rejected_monthly_claim(
      current_setting('test.rejected_claim',true)::uuid,'TEST-UPI-458');
    raise exception 'conflicting rejected-claim replacement accepted';
  exception when unique_violation then null; end;
end $$;

-- Staff edits are audited, retry-safe and restricted to President/Treasurer.
select public.enroll_versioned_monthly_donor(
  'Staff opt-out fixture','+919000000008',10000,
  'a1000000-0000-0000-0000-000000000005',
  'a1000000-0000-0000-0000-000000000005',
  'in-person',now(),'fixture-v1','staff stop consent evidence') as stop_donor_id \gset
select set_config('test.stop_donor', :'stop_donor_id',true);
select set_config('request.jwt.claims',
  '{"sub":"a1000000-0000-0000-0000-000000000004","session_id":"a1000000-0000-0000-0000-000000000004","role":"authenticated"}',true);
set local role authenticated;
select public.update_monthly_donor_suggestion(:'donor_id'::uuid,100000,125000,
  'Donor requested a revised suggestion','a3000000-0000-4000-8000-000000000011');
select public.update_monthly_donor_suggestion(:'donor_id'::uuid,100000,125000,
  'Donor requested a revised suggestion','a3000000-0000-4000-8000-000000000011');
reset role;
do $$ begin
  if (select suggested_amount_paise from public.monthly_donors
      where id=current_setting('test.donor',true)::uuid) <> 125000
    or (select count(*) from public.donor_events
      where donor_id=current_setting('test.donor',true)::uuid
        and event='suggestion_changed') <> 1 then
    raise exception 'staff suggestion edit or retry failed';
  end if;
end $$;
set local role authenticated;
do $$ begin
  begin
    perform public.update_monthly_donor_suggestion(
      current_setting('test.donor',true)::uuid,100000,130000,
      'Stale suggestion', 'a3000000-0000-4000-8000-000000000012');
    raise exception 'stale suggestion accepted';
  exception when serialization_failure then null;
  end;
  begin
    perform public.update_monthly_donor_suggestion(
      current_setting('test.donor',true)::uuid,100000,140000,
      'Conflicting retry', 'a3000000-0000-4000-8000-000000000011');
    raise exception 'operation conflict accepted';
  exception when unique_violation then null;
  end;
end $$;
select set_config('request.jwt.claims',
  '{"sub":"a1000000-0000-0000-0000-000000000005","session_id":"a1000000-0000-0000-0000-000000000005","role":"authenticated"}',true);
do $$ begin
  begin
    perform public.staff_opt_out_monthly_donor(
      current_setting('test.stop_donor',true)::uuid,'Donor requested STOP',
      'a3000000-0000-4000-8000-000000000013');
    raise exception 'Member opted donor out';
  exception when insufficient_privilege then null;
  end;
end $$;
select set_config('request.jwt.claims',
  '{"sub":"a1000000-0000-0000-0000-000000000002","session_id":"a1000000-0000-0000-0000-000000000002","role":"authenticated"}',true);
select public.staff_opt_out_monthly_donor(:'stop_donor_id'::uuid,
  'Donor requested STOP','a3000000-0000-4000-8000-000000000013');
select public.staff_opt_out_monthly_donor(:'stop_donor_id'::uuid,
  'Donor requested STOP','a3000000-0000-4000-8000-000000000013');
reset role;
do $$ begin
  if (select active from public.monthly_donors
      where id=current_setting('test.stop_donor',true)::uuid)
    or (select count(*) from public.donor_events
      where donor_id=current_setting('test.stop_donor',true)::uuid
        and event='opted_out') <> 1
    or public.monthly_reminder_eligible(
      current_setting('test.stop_donor',true)::uuid,'2026-10-01') then
    raise exception 'staff opt-out or retry failed';
  end if;
end $$;

select public.record_monthly_donor_opt_out(:'donor_id'::uuid,'verified STOP test');
do $$ begin
  if (select active from public.monthly_donors
      where id=current_setting('test.donor',true)::uuid)
    or public.monthly_reminder_eligible(current_setting('test.donor',true)::uuid,'2026-10-01') then
    raise exception 'STOP did not suppress reminder'; end if;
end $$;

rollback;
