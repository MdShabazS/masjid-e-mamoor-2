\set ON_ERROR_STOP on
begin;
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at)
select id,'00000000-0000-0000-0000-000000000000'::uuid,'authenticated','authenticated',email,'',now(),now(),now()
from (values
 ('8d000000-0000-0000-0000-000000000001'::uuid,'geofence-admin@example.invalid'),
 ('8d000000-0000-0000-0000-000000000002'::uuid,'geofence-creator@example.invalid'),
 ('8d000000-0000-0000-0000-000000000003'::uuid,'geofence-invitee@example.invalid'),
 ('8d000000-0000-0000-0000-000000000004'::uuid,'geofence-outsider@example.invalid')
) users(id,email);
insert into public.application_users(id,auth_user_id,status) values
 ('8e000000-0000-0000-0000-000000000001','8d000000-0000-0000-0000-000000000001','active'),
 ('8e000000-0000-0000-0000-000000000002','8d000000-0000-0000-0000-000000000002','active'),
 ('8e000000-0000-0000-0000-000000000003','8d000000-0000-0000-0000-000000000003','active'),
 ('8e000000-0000-0000-0000-000000000004','8d000000-0000-0000-0000-000000000004','active');
insert into public.application_user_roles(application_user_id,role_id)
select u.id,r.id from (values
 ('8e000000-0000-0000-0000-000000000001'::uuid,'system_admin'),
 ('8e000000-0000-0000-0000-000000000002'::uuid,'president'),
 ('8e000000-0000-0000-0000-000000000003'::uuid,'committee_member'),
 ('8e000000-0000-0000-0000-000000000004'::uuid,'committee_member')
) u(id,role_key) join public.roles r on r.key=u.role_key;
insert into public.committee_meetings(id,title,scheduled_start,created_by_application_user_id)
values ('8f000000-0000-0000-0000-000000000001','Today',now(),
 '8e000000-0000-0000-0000-000000000002'),
 ('8f000000-0000-0000-0000-000000000002','Tomorrow',now()+interval '1 day',
 '8e000000-0000-0000-0000-000000000002');
insert into public.committee_meeting_participants(meeting_id,application_user_id,assigned_by_application_user_id)
values ('8f000000-0000-0000-0000-000000000001','8e000000-0000-0000-0000-000000000002','8e000000-0000-0000-0000-000000000002'),
 ('8f000000-0000-0000-0000-000000000001','8e000000-0000-0000-0000-000000000003','8e000000-0000-0000-0000-000000000002'),
 ('8f000000-0000-0000-0000-000000000002','8e000000-0000-0000-0000-000000000003','8e000000-0000-0000-0000-000000000002');

select set_config('request.jwt.claims','{"sub":"8d000000-0000-0000-0000-000000000003","role":"authenticated"}',true);
set local role authenticated;
do $$ begin
  if has_function_privilege('authenticated','public.record_committee_meeting_attendance(uuid,uuid,text,text)','EXECUTE') then
    raise exception 'FAIL: legacy GPS bypass still executable'; end if;
  begin perform public.record_self_committee_meeting_attendance('8f000000-0000-0000-0000-000000000001',12,77,5,'unset');
    raise exception 'FAIL: unset location allowed';
  exception when object_not_in_prerequisite_state then null; end;
  begin perform public.set_meeting_attendance_location(12,77);
    raise exception 'FAIL: member configured location';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

select set_config('request.jwt.claims','{"sub":"8d000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select public.set_meeting_attendance_location(12,77);
do $$ begin
  if (select center_latitude from public.get_meeting_attendance_location())<>12 then
    raise exception 'FAIL: center not set'; end if;
end $$;
reset role;

select set_config('request.jwt.claims','{"sub":"8d000000-0000-0000-0000-000000000003","role":"authenticated"}',true);
set local role authenticated;
do $$ begin
  begin perform public.get_meeting_attendance_location();
    raise exception 'FAIL: member can read admin location';
  exception when insufficient_privilege then null; end;
  begin perform public.record_self_committee_meeting_attendance('8f000000-0000-0000-0000-000000000001',13,77,5,'far');
    raise exception 'FAIL: outside 100 m allowed';
  exception when invalid_parameter_value then null; end;
  begin perform public.record_self_committee_meeting_attendance('8f000000-0000-0000-0000-000000000002',12,77,5,'early');
    raise exception 'FAIL: early check-in allowed';
  exception when object_not_in_prerequisite_state then null; end;
  begin perform public.record_self_committee_meeting_attendance('8f000000-0000-0000-0000-000000000001',12,77,101,'imprecise');
    raise exception 'FAIL: imprecise location allowed';
  exception when invalid_parameter_value then null; end;
  begin perform public.record_manual_committee_meeting_attendance('8f000000-0000-0000-0000-000000000001',
    '8e000000-0000-0000-0000-000000000003','GPS unavailable today','manual-noncreator');
    raise exception 'FAIL: noncreator manual attendance allowed';
  exception when insufficient_privilege then null; end;
end $$;
select id from public.record_self_committee_meeting_attendance('8f000000-0000-0000-0000-000000000001',12,77,5,'gps-1');
select id from public.record_self_committee_meeting_attendance('8f000000-0000-0000-0000-000000000001',12,77,5,'gps-1');
do $$ begin
  if (select count(*) from public.meeting_attendance_audit where source='gps')<>1 then
    raise exception 'FAIL: GPS replay duplicated audit'; end if;
end $$;
reset role;

select set_config('request.jwt.claims','{"sub":"8d000000-0000-0000-0000-000000000002","role":"authenticated"}',true);
set local role authenticated;
do $$ begin
  begin perform public.record_manual_committee_meeting_attendance('8f000000-0000-0000-0000-000000000002',
    '8e000000-0000-0000-0000-000000000003','GPS unavailable today','early-manual');
    raise exception 'FAIL: early manual attendance allowed';
  exception when object_not_in_prerequisite_state then null; end;
  begin perform public.record_manual_committee_meeting_attendance('8f000000-0000-0000-0000-000000000001',
    '8e000000-0000-0000-0000-000000000004','GPS unavailable today','uninvited-manual');
    raise exception 'FAIL: uninvited attendance allowed';
  exception when insufficient_privilege then null; end;
end $$;
select id from public.record_manual_committee_meeting_attendance('8f000000-0000-0000-0000-000000000001',
  '8e000000-0000-0000-0000-000000000002','GPS device failed today','creator-manual');
select id from public.record_manual_committee_meeting_attendance('8f000000-0000-0000-0000-000000000001',
  '8e000000-0000-0000-0000-000000000002','GPS device failed today','creator-manual');
do $$ begin
  if (select count(*) from public.meeting_attendance_audit where source='manual' and reason='GPS device failed today')<>1 then
    raise exception 'FAIL: manual exception not audited exactly once'; end if;
  if (select count(*) from public.committee_meeting_attendance where meeting_id='8f000000-0000-0000-0000-000000000001')<>2 then
    raise exception 'FAIL: meeting attendance count incorrect'; end if;
end $$;
reset role;
rollback;
