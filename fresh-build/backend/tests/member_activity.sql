-- Rollback-only A-PERF1 scenarios. Source rows are seeded directly with replication triggers
-- off, because each one stands for a workflow already covered by its own fixture.
begin;
set local session_replication_role = replica;
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at)
select id,'00000000-0000-0000-0000-000000000000'::uuid,'authenticated','authenticated',email,'',now(),now(),now()
from (values ('b7000000-0000-0000-0000-000000000001'::uuid,'acm@example.invalid'),
 ('b7000000-0000-0000-0000-000000000002'::uuid,'acp@example.invalid'),
 ('b7000000-0000-0000-0000-000000000003'::uuid,'acs@example.invalid')) f(id,email);
insert into public.app_users(id,role) values
 ('b7000000-0000-0000-0000-000000000001','member'),
 ('b7000000-0000-0000-0000-000000000002','president'),
 ('b7000000-0000-0000-0000-000000000003','system_admin');
insert into app_private.username_aliases(user_id,username,must_change_password) values
 ('b7000000-0000-0000-0000-000000000001','acmember',false),
 ('b7000000-0000-0000-0000-000000000002','acpres',false),
 ('b7000000-0000-0000-0000-000000000003','acadmin',false);
insert into auth.sessions(id,user_id,created_at,updated_at)
select id,id,now(),now() from auth.users where email like 'ac%@example.invalid';
-- Tasks in October 2026: one accepted, one accepted then the task was cancelled, one returned.
insert into public.work_tasks(id,creator_id,title,description,mode,total_cap,invited_cap,volunteer_cap,status)
values ('b7100000-0000-0000-0000-000000000001','b7000000-0000-0000-0000-000000000002','Clean','d','open',5,0,5,'active'),
 ('b7100000-0000-0000-0000-000000000002','b7000000-0000-0000-0000-000000000002','Paint','d','open',5,0,5,'cancelled'),
 ('b7100000-0000-0000-0000-000000000003','b7000000-0000-0000-0000-000000000002','Carry','d','open',5,0,5,'active');
insert into public.work_task_participants(task_id,member_id,source,status,queue_no,joined_at) values
 ('b7100000-0000-0000-0000-000000000001','b7000000-0000-0000-0000-000000000001','volunteer','verified',970001,'2026-10-05T06:00:00Z'),
 ('b7100000-0000-0000-0000-000000000002','b7000000-0000-0000-0000-000000000001','volunteer','verified',970002,'2026-10-06T06:00:00Z'),
 ('b7100000-0000-0000-0000-000000000003','b7000000-0000-0000-0000-000000000001','volunteer','returned',970003,'2026-10-07T06:00:00Z');
insert into public.work_task_operations(id,actor_id,task_id,action,payload,result_status,occurred_at) values
 ('b7200000-0000-0000-0000-000000000001','b7000000-0000-0000-0000-000000000002','b7100000-0000-0000-0000-000000000001','review',
  '{"member":"b7000000-0000-0000-0000-000000000001","decision":"accept","reason":null}','verified','2026-10-10T06:00:00Z'),
 ('b7200000-0000-0000-0000-000000000002','b7000000-0000-0000-0000-000000000002','b7100000-0000-0000-0000-000000000002','review',
  '{"member":"b7000000-0000-0000-0000-000000000001","decision":"accept","reason":null}','verified','2026-10-11T06:00:00Z'),
 ('b7200000-0000-0000-0000-000000000003','b7000000-0000-0000-0000-000000000002','b7100000-0000-0000-0000-000000000003','review',
  '{"member":"b7000000-0000-0000-0000-000000000001","decision":"return","reason":"redo it"}','returned','2026-10-12T06:00:00Z');
-- Meetings: one finalized with all three outcomes across members, one still open.
insert into public.committee_meetings(id,creator_id,title,description,meeting_date,starts_at) values
 ('b7300000-0000-0000-0000-000000000001','b7000000-0000-0000-0000-000000000002','M1','d','2026-10-15','2026-10-15T12:00:00Z'),
 ('b7300000-0000-0000-0000-000000000002','b7000000-0000-0000-0000-000000000002','M2','d','2026-10-16','2026-10-16T12:00:00Z'),
 ('b7300000-0000-0000-0000-000000000003','b7000000-0000-0000-0000-000000000002','M3','d','2026-10-17','2026-10-17T12:00:00Z');
insert into public.committee_meeting_finalizations(meeting_id,finalized_by,is_fallback) values
 ('b7300000-0000-0000-0000-000000000001','b7000000-0000-0000-0000-000000000002',false),
 ('b7300000-0000-0000-0000-000000000002','b7000000-0000-0000-0000-000000000002',false);
insert into public.committee_meeting_roster(meeting_id,member_id,outcome) values
 ('b7300000-0000-0000-0000-000000000001','b7000000-0000-0000-0000-000000000001','attended'),
 ('b7300000-0000-0000-0000-000000000002','b7000000-0000-0000-0000-000000000001','absent');
-- Referrals: donor A paid twice in October (one point), donor B's only payment was voided,
-- donor C's payment was corrected with a replacement (still a point), donor A also paid in November.
insert into public.masjid_accounts(id,name,kind) values ('b7400000-0000-0000-0000-000000000001','AC cash','cash');
insert into public.monthly_donors(id,name,whatsapp,suggested_amount_paise,referrer_id,entered_by,consent_method,consent_recorded_at,active) values
 ('b7500000-0000-0000-0000-00000000000a','Donor A','+919000000001',100,'b7000000-0000-0000-0000-000000000001','b7000000-0000-0000-0000-000000000002','in-person',now(),false),
 ('b7500000-0000-0000-0000-00000000000b','Donor B','+919000000002',100,'b7000000-0000-0000-0000-000000000001','b7000000-0000-0000-0000-000000000002','in-person',now(),true),
 ('b7500000-0000-0000-0000-00000000000c','Donor C','+919000000003',100,'b7000000-0000-0000-0000-000000000001','b7000000-0000-0000-0000-000000000002','in-person',now(),true);
insert into public.monthly_requests(donor_id,period_date,suggested_amount_paise,qr_version_id,account_id)
select d,p::date,100,gen_random_uuid(),'b7400000-0000-0000-0000-000000000001' from (values
 ('b7500000-0000-0000-0000-00000000000a'::uuid,'2026-10-01'),('b7500000-0000-0000-0000-00000000000b','2026-10-01'),
 ('b7500000-0000-0000-0000-00000000000c','2026-10-01'),('b7500000-0000-0000-0000-00000000000a','2026-11-01')) v(d,p);
insert into public.payment_claims(id,donor_id,period_date,transaction_id,status,submitted_by) values
 ('b7600000-0000-0000-0000-000000000001','b7500000-0000-0000-0000-00000000000a','2026-10-01','AC-TX-1','verified','b7000000-0000-0000-0000-000000000002'),
 ('b7600000-0000-0000-0000-000000000002','b7500000-0000-0000-0000-00000000000a','2026-10-01','AC-TX-2','verified','b7000000-0000-0000-0000-000000000002'),
 ('b7600000-0000-0000-0000-000000000003','b7500000-0000-0000-0000-00000000000b','2026-10-01','AC-TX-3','verified','b7000000-0000-0000-0000-000000000002'),
 ('b7600000-0000-0000-0000-000000000004','b7500000-0000-0000-0000-00000000000c','2026-10-01','AC-TX-4','verified','b7000000-0000-0000-0000-000000000002'),
 ('b7600000-0000-0000-0000-000000000005','b7500000-0000-0000-0000-00000000000a','2026-11-01','AC-TX-5','verified','b7000000-0000-0000-0000-000000000002'),
 ('b7600000-0000-0000-0000-000000000006','b7500000-0000-0000-0000-00000000000b','2026-10-01','AC-TX-6','pending','b7000000-0000-0000-0000-000000000002');
insert into public.ledger_entries(id,account_id,amount_paise,direction,source_type,source_id,posted_by)
select ('b7700000-0000-0000-0000-00000000000'||n)::uuid,'b7400000-0000-0000-0000-000000000001',100,'income','monthly_contribution',
 ('b7600000-0000-0000-0000-00000000000'||n)::uuid,'b7000000-0000-0000-0000-000000000002' from generate_series(1,5) n;
insert into public.finance_effects(id,account_id,source_type,source_id,leg,amount_paise)
select ('b7800000-0000-0000-0000-00000000000'||n)::uuid,'b7400000-0000-0000-0000-000000000001','monthly_contribution',
 ('b7700000-0000-0000-0000-00000000000'||n)::uuid,0,100 from generate_series(1,5) n;
insert into public.finance_corrections(id,operation_id,original_effect_id,source_kind,original_account_id,original_amount_paise,
 replacement_account_id,replacement_amount_paise,reason,corrected_by) values
 ('b7900000-0000-0000-0000-000000000003',gen_random_uuid(),'b7800000-0000-0000-0000-000000000003','monthly_contribution',
  'b7400000-0000-0000-0000-000000000001',100,null,null,'void','b7000000-0000-0000-0000-000000000002'),
 ('b7900000-0000-0000-0000-000000000004',gen_random_uuid(),'b7800000-0000-0000-0000-000000000004','monthly_contribution',
  'b7400000-0000-0000-0000-000000000001',100,'b7400000-0000-0000-0000-000000000001',90,'fix amount','b7000000-0000-0000-0000-000000000002');
insert into public.finance_effects(account_id,source_type,source_id,leg,amount_paise) values
 ('b7400000-0000-0000-0000-000000000001','correction','b7900000-0000-0000-0000-000000000003',1,-100),
 ('b7400000-0000-0000-0000-000000000001','correction','b7900000-0000-0000-0000-000000000004',1,-100),
 ('b7400000-0000-0000-0000-000000000001','correction','b7900000-0000-0000-0000-000000000004',2,90);
set local session_replication_role = origin;

select set_config('request.jwt.claims','{"sub":"b7000000-0000-0000-0000-000000000002","session_id":"b7000000-0000-0000-0000-000000000002","role":"authenticated"}',true);
set local role authenticated;
do $$
declare v record;
begin
 select * into v from public.member_activity('b7000000-0000-0000-0000-000000000001','2026-10-01','2026-11-01');
 -- Tasks: 1 (cancelled task and returned work earn nothing), 2 joined on active tasks.
 -- Meetings: 1 attended of 2 finalized, 1 absent; the open meeting is not counted.
 -- Referrals: donor A once despite two payments, B voided, C corrected but standing = 2 of 3 requested.
 if (v.task_points,v.tasks_joined,v.meeting_points,v.meetings_finalized,v.meetings_declined,
   v.meetings_absent,v.referral_points,v.referral_months_requested,v.activity_points)
  <>(1,2,1,2,0,1,2,3,4) then
  raise exception 'activity wrong: %',row_to_json(v); end if;
 if (select referral_points from public.member_activity('b7000000-0000-0000-0000-000000000001','2026-11-01','2026-12-01'))<>1 then
  raise exception 'opted-out donor lost the later point'; end if;
 begin
  perform public.member_activity('b7000000-0000-0000-0000-000000000003','2026-10-01','2026-11-01');
  raise exception 'System Admin profile returned';
 exception when invalid_parameter_value then null; end;
 begin
  perform public.member_activity('b7000000-0000-0000-0000-000000000001','2026-01-01','2027-06-01');
  raise exception 'over-long period accepted';
 exception when invalid_parameter_value then null; end;
end $$;
reset role;
set local role anon;
do $$ begin
 begin
  perform public.member_activity('b7000000-0000-0000-0000-000000000001','2026-10-01','2026-11-01');
  raise exception 'anonymous caller read activity';
 exception when insufficient_privilege then null; end;
end $$;
rollback;
