-- Apply fresh migrations first, then psql -v ON_ERROR_STOP=1 -f tests/phase9_meetings.sql
begin;
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at)
select id,'00000000-0000-0000-0000-000000000000'::uuid,'authenticated',
 'authenticated',email,'',now(),now(),now() from (values
 ('a9000000-0000-0000-0000-000000000001'::uuid,'phase9p@example.invalid'),
 ('a9000000-0000-0000-0000-000000000002'::uuid,'phase9m@example.invalid'),
 ('a9000000-0000-0000-0000-000000000003'::uuid,'phase9n@example.invalid')) f(id,email);
insert into public.app_users(id,role) values
 ('a9000000-0000-0000-0000-000000000001','president'),
 ('a9000000-0000-0000-0000-000000000002','member'),
 ('a9000000-0000-0000-0000-000000000003','member');
insert into app_private.username_aliases(user_id,username,must_change_password) values
 ('a9000000-0000-0000-0000-000000000001','phase9president',false),
 ('a9000000-0000-0000-0000-000000000002','phase9member',false),
 ('a9000000-0000-0000-0000-000000000003','phase9noninvite',false);
do $$ begin
 if has_table_privilege('authenticated','public.committee_meeting_invites','SELECT')
 or has_table_privilege('authenticated','public.committee_meeting_reminder_outbox','INSERT')
 or has_function_privilege('anon','public.respond_committee_meeting(uuid,text,text,uuid)','EXECUTE') then
 raise exception 'meeting direct privilege leak'; end if;
end $$;
-- Synthetic JWTs use the actor UUID as their test session ID.
insert into auth.sessions(id,user_id)
select u.id,u.id from auth.users u join public.app_users a on a.id=u.id
on conflict do nothing;

select set_config('request.jwt.claims',
 '{"sub":"a9000000-0000-0000-0000-000000000001","session_id":"a9000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select public.create_committee_meeting('Committee review','Agenda and updates',
 ((now()+interval '30 minutes') at time zone 'Asia/Kolkata')::date,
 now()+interval '30 minutes',null,'a9100000-0000-0000-0000-000000000001') as meeting_id \gset
select set_config('phase9.meeting',:'meeting_id',true);
select public.invite_committee_meeting(current_setting('phase9.meeting')::uuid,
 'a9000000-0000-0000-0000-000000000002','a9100000-0000-0000-0000-000000000002');
reset role;
select set_config('request.jwt.claims',
 '{"sub":"a9000000-0000-0000-0000-000000000003","session_id":"a9000000-0000-0000-0000-000000000003","role":"authenticated"}',true);
set local role authenticated;
do $$ begin
 if (select count(*) from public.list_visible_committee_meetings())<>0 then
  raise exception 'uninivited member saw meeting'; end if;
 begin
  perform public.respond_committee_meeting(current_setting('phase9.meeting')::uuid,
   'accept',null,'a9100000-0000-0000-0000-000000000003');
  raise exception 'uninvited member responded';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claims',
 '{"sub":"a9000000-0000-0000-0000-000000000002","session_id":"a9000000-0000-0000-0000-000000000002","role":"authenticated"}',true);
set local role authenticated;
select public.respond_committee_meeting(current_setting('phase9.meeting')::uuid,
 'decline','Unavailable','a9100000-0000-0000-0000-000000000004');
select public.respond_committee_meeting(current_setting('phase9.meeting')::uuid,
 'decline','Unavailable','a9100000-0000-0000-0000-000000000004');
reset role;
set local role service_role;
do $$ begin
 if public.queue_due_committee_meeting_reminders(now())<>0 then
  raise exception 'declined invite queued reminder'; end if;
end $$;
reset role;
do $$ begin
 if (select count(*) from public.committee_meeting_reminder_outbox
  where meeting_id=current_setting('phase9.meeting')::uuid)<>0 then
  raise exception 'declined invite remained in outbox'; end if;
end $$;
select set_config('request.jwt.claims',
 '{"sub":"a9000000-0000-0000-0000-000000000002","session_id":"a9000000-0000-0000-0000-000000000002","role":"authenticated"}',true);
set local role authenticated;
do $$ begin
 begin
 perform public.record_hafiz_prayer((now() at time zone 'Asia/Kolkata')::date,
  'fajr','present',true,'a9100000-0000-0000-0000-000000000005');
 raise exception 'member marked prayer';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claims',
 '{"sub":"a9000000-0000-0000-0000-000000000001","session_id":"a9000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
set local role authenticated;
do $$ begin
 begin
 perform public.record_hafiz_prayer((now() at time zone 'Asia/Kolkata')::date,
  'fajr','present',false,'a9100000-0000-0000-0000-000000000006');
 raise exception 'prayer marked without attestation';
 exception when invalid_parameter_value then null; end;
end $$;
select public.record_hafiz_prayer((now() at time zone 'Asia/Kolkata')::date,
 'fajr','present',true,'a9100000-0000-0000-0000-000000000007');
select public.record_hafiz_prayer((now() at time zone 'Asia/Kolkata')::date,
 'fajr','absent',true,'a9100000-0000-0000-0000-000000000008');
reset role;
do $$ begin
 if (select count(*) from public.hafiz_prayer_history
  where prayer_date=(now() at time zone 'Asia/Kolkata')::date and prayer_slot='fajr')<>2
 or (select old_mark from public.hafiz_prayer_history
  where operation_id='a9100000-0000-0000-0000-000000000008')<>'present' then
 raise exception 'prayer correction did not preserve prior value'; end if;
end $$;
rollback;
