\set ON_ERROR_STOP on
begin;

insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at)
select id,'00000000-0000-0000-0000-000000000000'::uuid,'authenticated','authenticated',email,'',now(),now(),now()
from (values
 ('a3000000-0000-0000-0000-000000000001'::uuid,'activity-president@example.invalid'),
 ('a3000000-0000-0000-0000-000000000002'::uuid,'activity-worker@example.invalid'),
 ('a3000000-0000-0000-0000-000000000003'::uuid,'activity-donor@example.invalid')
) x(id,email);
insert into public.application_users(id,auth_user_id,status,display_name) values
 ('a4000000-0000-0000-0000-000000000001','a3000000-0000-0000-0000-000000000001','active','Activity President'),
 ('a4000000-0000-0000-0000-000000000002','a3000000-0000-0000-0000-000000000002','active','Activity Worker'),
 ('a4000000-0000-0000-0000-000000000003','a3000000-0000-0000-0000-000000000003','active','Activity Donor');
insert into public.application_user_roles(application_user_id,role_id)
select x.id,r.id from (values
 ('a4000000-0000-0000-0000-000000000001'::uuid,'president'),
 ('a4000000-0000-0000-0000-000000000002'::uuid,'committee_member'),
 ('a4000000-0000-0000-0000-000000000003'::uuid,'member')
) x(id,key) join public.roles r on r.key=x.key;
insert into public.member_profiles(id,application_user_id,display_name,status) values
 ('a5000000-0000-0000-0000-000000000002','a4000000-0000-0000-0000-000000000002','Worker','active'),
 ('a5000000-0000-0000-0000-000000000003','a4000000-0000-0000-0000-000000000003','Donor','active');
insert into public.referrals(id,referral_code,referrer_member_profile_id,
 referred_application_user_id,referred_member_profile_id,status)
values ('a6000000-0000-0000-0000-000000000001','activity-referral-00000001',
 'a5000000-0000-0000-0000-000000000002',
 'a4000000-0000-0000-0000-000000000003',
 'a5000000-0000-0000-0000-000000000003','completed');
insert into public.donation_payments(member_profile_id,amount_paise,payment_method,status,
 submitted_by_application_user_id,reviewed_by_application_user_id,reviewed_at,operation_id)
values ('a5000000-0000-0000-0000-000000000003',125000,'upi','verified',
 'a4000000-0000-0000-0000-000000000001','a4000000-0000-0000-0000-000000000001',
 now(),'activity-verified-payment');
insert into public.committee_tasks(id,title,status,created_by_application_user_id,
 completed_by_application_user_id,completed_at)
values ('a7000000-0000-0000-0000-000000000001','Activity task','completed',
 'a4000000-0000-0000-0000-000000000001',
 'a4000000-0000-0000-0000-000000000002',now());
insert into public.committee_task_assignees(task_id,application_user_id,assigned_by_application_user_id,
 assigned_at) values ('a7000000-0000-0000-0000-000000000001',
 'a4000000-0000-0000-0000-000000000002','a4000000-0000-0000-0000-000000000001',
 now()-interval '1 hour');
insert into public.committee_meetings(id,title,scheduled_start,created_by_application_user_id)
select id,'Activity meeting', (((now() at time zone 'Asia/Kolkata')::date - 1) + time '12:00') at time zone 'Asia/Kolkata',
 'a4000000-0000-0000-0000-000000000001'
from (values
 ('a8000000-0000-0000-0000-000000000001'::uuid),
 ('a8000000-0000-0000-0000-000000000002'::uuid),
 ('a8000000-0000-0000-0000-000000000003'::uuid)
) x(id);
insert into public.committee_meeting_participants(meeting_id,application_user_id,assigned_by_application_user_id)
select id,'a4000000-0000-0000-0000-000000000002',
 'a4000000-0000-0000-0000-000000000001'
from public.committee_meetings where id in (
 'a8000000-0000-0000-0000-000000000001',
 'a8000000-0000-0000-0000-000000000002',
 'a8000000-0000-0000-0000-000000000003');
insert into public.committee_meeting_attendance(meeting_id,application_user_id,
 attendance_status,recorded_by_application_user_id,operation_id,request_fingerprint)
values ('a8000000-0000-0000-0000-000000000001',
 'a4000000-0000-0000-0000-000000000002','present',
 'a4000000-0000-0000-0000-000000000001','activity-attended',repeat('a',64));
insert into public.committee_meeting_responses(meeting_id,application_user_id,response,
 decline_reason,operation_id,request_fingerprint)
values ('a8000000-0000-0000-0000-000000000002',
 'a4000000-0000-0000-0000-000000000002','declined','Unavailable',
 'activity-declined',repeat('b',64));

select set_config('request.jwt.claims',
 '{"sub":"a3000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
set local role authenticated;
do $$
declare v_row record;
begin
  select * into v_row from public.list_member_activity(
    (now() at time zone 'Asia/Kolkata')::date - 7,
    (now() at time zone 'Asia/Kolkata')::date)
  where application_user_id='a4000000-0000-0000-0000-000000000002';
  if v_row.task_assigned_count <> 1 or v_row.task_completed_count <> 1
    or v_row.meeting_invited_count <> 3 or v_row.meeting_attended_count <> 1
    or v_row.meeting_declined_count <> 1 or v_row.meeting_absent_count <> 1
    or v_row.verified_referred_donation_count <> 1
    or v_row.verified_referred_donation_paise <> 125000 then
    raise exception 'FAIL: activity counts or verified referral attribution: %', row_to_json(v_row);
  end if;
  begin
    perform public.list_member_activity(current_date,current_date-1);
    raise exception 'FAIL: invalid range accepted';
  exception when invalid_parameter_value then null; end;
end $$;
reset role;
set local role anon;
do $$ begin
  begin
    perform public.list_member_activity(current_date,current_date);
    raise exception 'FAIL: anonymous activity access';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
