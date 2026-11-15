\set ON_ERROR_STOP on
begin;

insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at)
select id,'00000000-0000-0000-0000-000000000000'::uuid,'authenticated','authenticated',email,'',now(),now(),now()
from (values
 ('8a000000-0000-0000-0000-000000000001'::uuid,'response-president@example.invalid'),
 ('8a000000-0000-0000-0000-000000000002'::uuid,'response-treasurer@example.invalid'),
 ('8a000000-0000-0000-0000-000000000003'::uuid,'response-member@example.invalid')
) users(id,email);
insert into public.application_users(id,auth_user_id,status) values
 ('8b000000-0000-0000-0000-000000000001','8a000000-0000-0000-0000-000000000001','active'),
 ('8b000000-0000-0000-0000-000000000002','8a000000-0000-0000-0000-000000000002','active'),
 ('8b000000-0000-0000-0000-000000000003','8a000000-0000-0000-0000-000000000003','active');
insert into public.application_user_roles(application_user_id,role_id)
select u.id,r.id from (values
 ('8b000000-0000-0000-0000-000000000001'::uuid,'president'),
 ('8b000000-0000-0000-0000-000000000002'::uuid,'finance'),
 ('8b000000-0000-0000-0000-000000000003'::uuid,'committee_member')
) u(id,role_key) join public.roles r on r.key = u.role_key;

-- The meeting creator can discover and invite a Treasurer via the public RPC.
select set_config('request.jwt.claims',
  '{"sub":"8a000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
do $$ begin
  if not exists (select 1 from public.list_committee_meeting_participant_options()
    where application_user_id = '8b000000-0000-0000-0000-000000000002') then
    raise exception 'FAIL: Treasurer missing from invitee picker'; end if;
end $$;
select id as created_meeting_id from public.create_committee_meeting(
  'Treasurer invited by President', 'committee', null, 'Masjid',
  now() + interval '3 days', null,
  array['8b000000-0000-0000-0000-000000000002'::uuid],
  'treasurer-meeting-create') \gset
select id from public.update_committee_meeting(
  :'created_meeting_id'::uuid, 'Treasurer invitation updated', 'committee',
  null, 'Masjid', now() + interval '3 days', null,
  array['8b000000-0000-0000-0000-000000000002'::uuid],
  'treasurer-meeting-update');
select set_config('test.treasurer_meeting_id', :'created_meeting_id', true);
do $$ begin
  if not exists (select 1 from public.committee_meeting_participants
    where meeting_id = current_setting('test.treasurer_meeting_id')::uuid
      and application_user_id = '8b000000-0000-0000-0000-000000000002') then
    raise exception 'FAIL: Treasurer invitation not persisted'; end if;
end $$;
reset role;

insert into public.committee_meetings(id,title,scheduled_start,created_by_application_user_id)
values ('8c000000-0000-0000-0000-000000000001','Response integration test',now()+interval '2 days',
 '8b000000-0000-0000-0000-000000000001');
insert into public.committee_meeting_participants(meeting_id,application_user_id,assigned_by_application_user_id)
values ('8c000000-0000-0000-0000-000000000001','8b000000-0000-0000-0000-000000000002',
 '8b000000-0000-0000-0000-000000000001');

select set_config('request.jwt.claims', '{"sub":"8a000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
do $$ begin
  if not public.can_read_committee_meeting('8c000000-0000-0000-0000-000000000001') then
    raise exception 'FAIL: invited Treasurer cannot read meeting'; end if;
  begin
    perform public.respond_to_committee_meeting('8c000000-0000-0000-0000-000000000001',
      'declined',null,'response-no-reason');
    raise exception 'FAIL: decline without reason accepted';
  exception when invalid_parameter_value then null; end;
end $$;
select id from public.respond_to_committee_meeting('8c000000-0000-0000-0000-000000000001',
 'declined','Unable to travel','response-first') \gset
select id from public.respond_to_committee_meeting('8c000000-0000-0000-0000-000000000001',
 'declined','Unable to travel','response-first');
do $$ begin
  if (select count(*) from public.committee_meeting_responses) <> 1 then
    raise exception 'FAIL: retry duplicated meeting response'; end if;
  begin
    perform public.respond_to_committee_meeting('8c000000-0000-0000-0000-000000000001',
      'accepted',null,'response-first');
    raise exception 'FAIL: changed replay accepted';
  exception when unique_violation then null; end;
end $$;
select id from public.respond_to_committee_meeting('8c000000-0000-0000-0000-000000000001',
 'accepted',null,'response-second');
do $$ begin
  if (select count(*) from public.committee_meeting_responses) <> 2
    or (select response from public.list_committee_meeting_responses('8c000000-0000-0000-0000-000000000001')) <> 'accepted' then
    raise exception 'FAIL: response history or latest outcome incorrect'; end if;
  begin
    delete from public.committee_meeting_responses;
    raise exception 'FAIL: client deleted response history';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

select set_config('request.jwt.claims', '{"sub":"8a000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
set local role authenticated;
do $$ begin
  if public.can_read_committee_meeting('8c000000-0000-0000-0000-000000000001') then
    raise exception 'FAIL: uninvited committee member can read meeting'; end if;
  begin
    perform public.respond_to_committee_meeting('8c000000-0000-0000-0000-000000000001',
      'accepted',null,'response-uninvited');
    raise exception 'FAIL: uninvited member accepted';
  exception when insufficient_privilege then null; end;
  if (select count(*) from public.committee_meeting_responses) <> 0 then
    raise exception 'FAIL: uninvited member read another response'; end if;
end $$;
reset role;

select set_config('request.jwt.claims', '{"sub":"8a000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
do $$ begin
  if (select count(*) from public.list_committee_meeting_responses('8c000000-0000-0000-0000-000000000001')) <> 1 then
    raise exception 'FAIL: meeting creator cannot view latest response'; end if;
end $$;
reset role;

rollback;
