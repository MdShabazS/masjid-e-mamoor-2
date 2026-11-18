-- Rollback-only proof that members see due member announcements, with their text, without the
-- queue job (found in the 17 Nov 2026 phone test).
begin;
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at)
select id,'00000000-0000-0000-0000-000000000000'::uuid,'authenticated','authenticated',email,'',now(),now(),now()
from (values
 ('e9000000-0000-0000-0000-000000000001'::uuid,'inboxpres@example.invalid'),
 ('e9000000-0000-0000-0000-000000000002'::uuid,'inboxmem@example.invalid')) f(id,email);
insert into public.app_users(id,role) values
 ('e9000000-0000-0000-0000-000000000001','president'),
 ('e9000000-0000-0000-0000-000000000002','member');
insert into app_private.username_aliases(user_id,username,must_change_password) values
 ('e9000000-0000-0000-0000-000000000001','inboxpres',false),
 ('e9000000-0000-0000-0000-000000000002','inboxmember',false);
insert into auth.sessions(id,user_id,created_at,updated_at)
select id,id,now(),now() from auth.users where email like 'inbox%@example.invalid';

select set_config('request.jwt.claims','{"sub":"e9000000-0000-0000-0000-000000000001","session_id":"e9000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select public.create_community_post('Committee meeting Friday','Please attend after Isha.','members',
 'e9100000-0000-0000-0000-000000000001') as members_id \gset
select public.create_community_post('Jummah time','Khutbah at 1:15 pm.','public',
 'e9100000-0000-0000-0000-000000000002') as public_id \gset
select public.create_community_post('Not yet','Scheduled for tomorrow.','members',
 'e9100000-0000-0000-0000-000000000003') as later_id \gset
select set_config('inbox.members',:'members_id',true), set_config('inbox.public',:'public_id',true),
 set_config('inbox.later',:'later_id',true);
select public.publish_community_post(current_setting('inbox.members')::uuid,now()-interval '1 minute',null,1,
 'e9100000-0000-0000-0000-000000000004');
select public.publish_community_post(current_setting('inbox.public')::uuid,now()-interval '1 minute',null,1,
 'e9100000-0000-0000-0000-000000000005');
select public.publish_community_post(current_setting('inbox.later')::uuid,now()+interval '1 day',null,1,
 'e9100000-0000-0000-0000-000000000006');
reset role;

-- No queue job has run. The member opens Notifications.
select set_config('request.jwt.claims','{"sub":"e9000000-0000-0000-0000-000000000002","session_id":"e9000000-0000-0000-0000-000000000002","role":"authenticated"}',true);
set local role authenticated;
do $$ begin
  if (select count(*) from public.list_my_member_inbox(25)) <> 1 then
    raise exception 'member did not see exactly the one due member announcement'; end if;
  if (select body from public.list_my_member_inbox(25)) <> 'Please attend after Isha.' then
    raise exception 'announcement text missing'; end if;
  if (select count(*) from public.list_my_member_inbox(25)) <> 1 then
    raise exception 'opening Notifications again duplicated the announcement'; end if;
end $$;
reset role;

-- The queue job is still harmless afterwards.
do $$ begin
  if (select count(*) from public.member_inbox where member_id='e9000000-0000-0000-0000-000000000002') <> 1 then
    raise exception 'inbox row count wrong'; end if;
end $$;
set local role service_role;
select public.queue_due_member_post_notifications();
reset role;
do $$ begin
  if (select count(*) from public.member_inbox where member_id='e9000000-0000-0000-0000-000000000002') <> 1 then
    raise exception 'queue job duplicated an announcement'; end if;
end $$;
rollback;
