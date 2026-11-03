-- Rollback-only A-MEET2 scenarios: every location, day, role and finalization rule.
begin;
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at)
select id,'00000000-0000-0000-0000-000000000000'::uuid,'authenticated','authenticated',email,'',now(),now(),now()
from (values
 ('e1000000-0000-0000-0000-000000000001'::uuid,'atp@example.invalid'),
 ('e1000000-0000-0000-0000-000000000002'::uuid,'atm1@example.invalid'),
 ('e1000000-0000-0000-0000-000000000003'::uuid,'atm2@example.invalid'),
 ('e1000000-0000-0000-0000-000000000004'::uuid,'atm3@example.invalid'),
 ('e1000000-0000-0000-0000-000000000005'::uuid,'atde@example.invalid'),
 ('e1000000-0000-0000-0000-000000000006'::uuid,'atsa@example.invalid'),
 ('e1000000-0000-0000-0000-000000000007'::uuid,'atvp@example.invalid')) f(id,email);
insert into public.app_users(id,role) values
 ('e1000000-0000-0000-0000-000000000001','president'),
 ('e1000000-0000-0000-0000-000000000002','member'),
 ('e1000000-0000-0000-0000-000000000003','member'),
 ('e1000000-0000-0000-0000-000000000004','member'),
 ('e1000000-0000-0000-0000-000000000005','data_entry'),
 ('e1000000-0000-0000-0000-000000000006','system_admin'),
 ('e1000000-0000-0000-0000-000000000007','vice_president');
insert into app_private.username_aliases(user_id,username,must_change_password) values
 ('e1000000-0000-0000-0000-000000000001','atpres',false),
 ('e1000000-0000-0000-0000-000000000002','atmemberone',false),
 ('e1000000-0000-0000-0000-000000000003','atmembertwo',false),
 ('e1000000-0000-0000-0000-000000000004','atmemberthree',false),
 ('e1000000-0000-0000-0000-000000000005','atentry',false),
 ('e1000000-0000-0000-0000-000000000006','atadmin',false),
 ('e1000000-0000-0000-0000-000000000007','atvice',false);
insert into auth.sessions(id,user_id,created_at,updated_at)
select id,id,now(),now() from auth.users where email like 'at%@example.invalid';
-- Today and yesterday in India, seeded directly because the create command refuses past starts.
insert into public.committee_meetings(id,creator_id,title,description,meeting_date,starts_at) values
 ('e2000000-0000-0000-0000-000000000001','e1000000-0000-0000-0000-000000000001','Today','d',
  (now() at time zone 'Asia/Kolkata')::date,now()),
 ('e2000000-0000-0000-0000-000000000002','e1000000-0000-0000-0000-000000000001','Past','d',
  ((now()-interval '1 day') at time zone 'Asia/Kolkata')::date,now()-interval '1 day'),
 ('e2000000-0000-0000-0000-000000000003','e1000000-0000-0000-0000-000000000001','Unfinished','d',
  ((now()-interval '1 day') at time zone 'Asia/Kolkata')::date,now()-interval '1 day');
insert into public.committee_meeting_invites(meeting_id,member_id,status,responded_at,decline_reason)
select m::uuid,u::uuid,s,case when s='invited' then null else now() end,null from (values
 ('e2000000-0000-0000-0000-000000000001','e1000000-0000-0000-0000-000000000002','accepted'),
 ('e2000000-0000-0000-0000-000000000001','e1000000-0000-0000-0000-000000000003','invited'),
 ('e2000000-0000-0000-0000-000000000001','e1000000-0000-0000-0000-000000000004','declined'),
 ('e2000000-0000-0000-0000-000000000002','e1000000-0000-0000-0000-000000000002','accepted'),
 ('e2000000-0000-0000-0000-000000000002','e1000000-0000-0000-0000-000000000003','invited'),
 ('e2000000-0000-0000-0000-000000000002','e1000000-0000-0000-0000-000000000004','declined'),
 ('e2000000-0000-0000-0000-000000000003','e1000000-0000-0000-0000-000000000003','accepted')) v(m,u,s);
-- A prior-day check-in, so the finalized roster has all three outcomes.
insert into public.committee_meeting_attendance(meeting_id,member_id,source,distance_m,accuracy_m,recorded_by)
values('e2000000-0000-0000-0000-000000000002','e1000000-0000-0000-0000-000000000002','gps',10,5,
 'e1000000-0000-0000-0000-000000000002');

do $$ begin
 if has_table_privilege('authenticated','public.committee_meeting_attendance','SELECT')
  or has_table_privilege('authenticated','public.masjid_site','SELECT')
  or has_function_privilege('anon','public.check_in_committee_meeting(uuid,double precision,double precision,double precision,timestamptz,boolean,uuid)','EXECUTE')
  or has_function_privilege('authenticated','app_private.site_distance_m(double precision,double precision,double precision,timestamptz,boolean)','EXECUTE') then
  raise exception 'attendance direct privilege leak'; end if;
 if exists(select 1 from information_schema.columns where table_schema='public'
   and table_name='committee_meeting_attendance' and column_name in ('latitude','longitude')) then
  raise exception 'member coordinates are stored'; end if;
end $$;

-- Member: center unset, then every rejected check-in.
select set_config('request.jwt.claims','{"sub":"e1000000-0000-0000-0000-000000000002","session_id":"e1000000-0000-0000-0000-000000000002","role":"authenticated"}',true);
set local role authenticated;
do $$ begin
 if public.masjid_site_configured() then raise exception 'site seeded'; end if;
 begin
  perform public.check_in_committee_meeting('e2000000-0000-0000-0000-000000000001',15,76,5,now(),false,'e3000000-0000-0000-0000-000000000001');
  raise exception 'checked in with center unset';
 exception when invalid_parameter_value then
  if sqlerrm<>'site_not_configured' then raise; end if; end;
 begin
  perform public.set_masjid_site(15,76,'member forged','e3000000-0000-0000-0000-000000000002');
  raise exception 'member set the site';
 exception when insufficient_privilege then null; end;
 begin
  perform public.get_masjid_site();
  raise exception 'member read site evidence';
 exception when insufficient_privilege then null; end;
end $$;
reset role;

select set_config('request.jwt.claims','{"sub":"e1000000-0000-0000-0000-000000000006","session_id":"e1000000-0000-0000-0000-000000000006","role":"authenticated"}',true);
set local role authenticated;
select public.set_masjid_site(15,76,'fixture survey','e3000000-0000-0000-0000-000000000003');
select public.set_masjid_site(15,76,'fixture survey','e3000000-0000-0000-0000-000000000003');
do $$ begin
 begin
  perform public.set_masjid_site(16,76,'changed retry','e3000000-0000-0000-0000-000000000003');
  raise exception 'changed site retry accepted';
 exception when unique_violation then null; end;
 begin
  perform public.set_masjid_site(95,76,'bad latitude','e3000000-0000-0000-0000-000000000004');
  raise exception 'invalid latitude accepted';
 exception when invalid_parameter_value then null; end;
end $$;
reset role;

select set_config('request.jwt.claims','{"sub":"e1000000-0000-0000-0000-000000000002","session_id":"e1000000-0000-0000-0000-000000000002","role":"authenticated"}',true);
set local role authenticated;
do $$
declare
 v_today uuid:='e2000000-0000-0000-0000-000000000001';
 v_case record;
begin
 for v_case in select * from (values
  ('outside_masjid_area',15.002::float8,76::float8,5::float8,now(),false),
  ('mock_location',15,76,5,now(),true),
  ('stale_location',15,76,5,now()-interval '3 minutes',false),
  ('stale_location',15,76,5,now()+interval '1 minute',false),
  ('low_accuracy_location',15,76,36,now(),false),
  ('low_accuracy_location',15,76,0,now(),false),
  ('invalid_location',95,76,5,now(),false)) c(code,lat,lng,acc,at,mocked) loop
  begin
   perform public.check_in_committee_meeting(v_today,v_case.lat,v_case.lng,v_case.acc,v_case.at,v_case.mocked,gen_random_uuid());
   raise exception 'accepted bad fix: %',v_case.code;
  exception when invalid_parameter_value then
   if sqlerrm<>v_case.code then raise exception 'expected %, got %',v_case.code,sqlerrm; end if; end;
 end loop;
 begin
  perform public.check_in_committee_meeting('e2000000-0000-0000-0000-000000000002',15,76,5,now(),false,gen_random_uuid());
  raise exception 'checked in on the wrong day';
 exception when invalid_parameter_value then
  if sqlerrm<>'wrong_meeting_day' then raise; end if; end;
 if exists(select 1 from public.list_visible_committee_meetings() where meeting_id=v_today and my_rsvp<>'accepted') then
  raise exception 'fixture invite state wrong'; end if;
end $$;
-- About 55 m away: inside. Replay and a second operation keep one attendance row.
select public.check_in_committee_meeting('e2000000-0000-0000-0000-000000000001',15.0005,76,5,now(),false,'e3000000-0000-0000-0000-000000000010');
select public.check_in_committee_meeting('e2000000-0000-0000-0000-000000000001',15.0005,76,5,now(),false,'e3000000-0000-0000-0000-000000000010');
select public.check_in_committee_meeting('e2000000-0000-0000-0000-000000000001',15.0005,76,5,now(),false,'e3000000-0000-0000-0000-000000000011');
do $$ begin
 if (select attendance_source from public.my_committee_attendance() where meeting_id='e2000000-0000-0000-0000-000000000001')<>'gps' then
  raise exception 'own attendance not visible'; end if;
 begin
  perform public.list_committee_meeting_roster('e2000000-0000-0000-0000-000000000001');
  raise exception 'member read the roster';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
do $$ begin
 if (select count(*) from public.committee_meeting_attendance where meeting_id='e2000000-0000-0000-0000-000000000001')<>1
  or (select distance_m from public.committee_meeting_attendance where meeting_id='e2000000-0000-0000-0000-000000000001') not between 50 and 60 then
  raise exception 'check-in row or distance wrong'; end if;
end $$;

-- Declined member cannot check in.
select set_config('request.jwt.claims','{"sub":"e1000000-0000-0000-0000-000000000004","session_id":"e1000000-0000-0000-0000-000000000004","role":"authenticated"}',true);
set local role authenticated;
do $$ begin
 begin
  perform public.check_in_committee_meeting('e2000000-0000-0000-0000-000000000001',15,76,5,now(),false,gen_random_uuid());
  raise exception 'declined member checked in';
 exception when insufficient_privilege then null; end;
end $$;
reset role;

-- Another leader and the data entry fallback cannot create presence.
select set_config('request.jwt.claims','{"sub":"e1000000-0000-0000-0000-000000000005","session_id":"e1000000-0000-0000-0000-000000000005","role":"authenticated"}',true);
set local role authenticated;
do $$ begin
 begin
  perform public.mark_committee_attendance('e2000000-0000-0000-0000-000000000001','e1000000-0000-0000-0000-000000000003',15,76,5,now(),false,'forged presence',gen_random_uuid());
  raise exception 'data entry forged presence';
 exception when insufficient_privilege then null; end;
end $$;
reset role;

-- Organizer: remote and premature actions fail, onsite mark succeeds.
select set_config('request.jwt.claims','{"sub":"e1000000-0000-0000-0000-000000000001","session_id":"e1000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
set local role authenticated;
do $$ begin
 begin
  perform public.mark_committee_attendance('e2000000-0000-0000-0000-000000000001','e1000000-0000-0000-0000-000000000003',15.01,76,5,now(),false,'phone failed',gen_random_uuid());
  raise exception 'organizer marked remotely';
 exception when invalid_parameter_value then
  if sqlerrm<>'outside_masjid_area' then raise; end if; end;
 begin
  perform public.mark_committee_attendance('e2000000-0000-0000-0000-000000000001','e1000000-0000-0000-0000-000000000004',15,76,5,now(),false,'declined member',gen_random_uuid());
  raise exception 'organizer marked a declined member';
 exception when insufficient_privilege then null; end;
 begin
  perform public.finalize_committee_meeting('e2000000-0000-0000-0000-000000000001',null,gen_random_uuid());
  raise exception 'finalized before the day ended';
 exception when invalid_parameter_value then
  if sqlerrm<>'meeting_day_not_over' then raise; end if; end;
end $$;
select public.mark_committee_attendance('e2000000-0000-0000-0000-000000000001','e1000000-0000-0000-0000-000000000003',15,76,5,now(),false,'phone failed','e3000000-0000-0000-0000-000000000020');
select public.finalize_committee_meeting('e2000000-0000-0000-0000-000000000002',null,'e3000000-0000-0000-0000-000000000021');
select public.finalize_committee_meeting('e2000000-0000-0000-0000-000000000002',null,'e3000000-0000-0000-0000-000000000021');
do $$ begin
 begin
  perform public.finalize_committee_meeting('e2000000-0000-0000-0000-000000000002',null,gen_random_uuid());
  raise exception 'finalized twice';
 exception when unique_violation then null; end;
 if (select string_agg(username||'='||coalesce(outcome,'-'),',' order by username)
   from public.list_committee_meeting_roster('e2000000-0000-0000-0000-000000000002'))
   <>'atmemberone=attended,atmemberthree=declined,atmembertwo=absent' then
  raise exception 'roster outcomes wrong'; end if;
end $$;
reset role;
do $$ begin
 if (select source from public.committee_meeting_attendance where meeting_id='e2000000-0000-0000-0000-000000000001' and member_id='e1000000-0000-0000-0000-000000000003')<>'organizer'
  or (select count(*) from public.committee_meeting_absence_outbox where meeting_id='e2000000-0000-0000-0000-000000000002')<>1
  or (select member_id from public.committee_meeting_absence_outbox where meeting_id='e2000000-0000-0000-0000-000000000002')<>'e1000000-0000-0000-0000-000000000003' then
  raise exception 'organizer mark or absence notice wrong'; end if;
end $$;

-- Another leader may not finalize; data entry may after the day, with a reason, and it counts as fallback.
select set_config('request.jwt.claims','{"sub":"e1000000-0000-0000-0000-000000000007","session_id":"e1000000-0000-0000-0000-000000000007","role":"authenticated"}',true);
set local role authenticated;
do $$ begin
 begin
  perform public.finalize_committee_meeting('e2000000-0000-0000-0000-000000000003','not organizer',gen_random_uuid());
  raise exception 'other leader finalized';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claims','{"sub":"e1000000-0000-0000-0000-000000000005","session_id":"e1000000-0000-0000-0000-000000000005","role":"authenticated"}',true);
set local role authenticated;
do $$ begin
 if (select count(*) from public.list_meetings_pending_finalization() where meeting_id='e2000000-0000-0000-0000-000000000003')<>1
  or exists(select 1 from public.list_meetings_pending_finalization() where meeting_id in
   ('e2000000-0000-0000-0000-000000000001','e2000000-0000-0000-0000-000000000002')) then
  raise exception 'pending finalization list wrong'; end if;
 begin
  perform public.finalize_committee_meeting('e2000000-0000-0000-0000-000000000003',null,gen_random_uuid());
  raise exception 'fallback without a reason';
 exception when invalid_parameter_value then null; end;
end $$;
select public.finalize_committee_meeting('e2000000-0000-0000-0000-000000000003','organizer away','e3000000-0000-0000-0000-000000000030');
reset role;
do $$ begin
 if not (select is_fallback from public.committee_meeting_finalizations where meeting_id='e2000000-0000-0000-0000-000000000003')
  or (select outcome from public.committee_meeting_roster where meeting_id='e2000000-0000-0000-0000-000000000003')<>'absent' then
  raise exception 'fallback finalization wrong'; end if;
 begin
  update public.committee_meeting_roster set outcome='attended' where meeting_id='e2000000-0000-0000-0000-000000000003';
  raise exception 'roster was edited';
 exception when others then
  if sqlerrm='roster was edited' then raise; end if; end;
end $$;
rollback;
