-- A-MEET2: scheduled-day 100 m check-in, organizer onsite marking and post-day finalization.
-- The server computes distance and keeps only distance and accuracy, never a member's
-- coordinates. A phone can still fake its location, so this is evidence, not proof.
begin;
create table public.masjid_site (
 id boolean primary key default true check(id),
 latitude double precision not null check(latitude between -90 and 90),
 longitude double precision not null check(longitude between -180 and 180),
 radius_m integer not null default 100 check(radius_m=100),
 evidence_reference text not null,
 set_by uuid not null references public.app_users(id) on delete restrict,
 set_at timestamptz not null default now()
);
create table public.masjid_site_history (
 operation_id uuid primary key,
 latitude double precision not null,
 longitude double precision not null,
 evidence_reference text not null,
 set_by uuid not null references public.app_users(id) on delete restrict,
 set_at timestamptz not null default now()
);
create table public.committee_meeting_attendance (
 meeting_id uuid not null,
 member_id uuid not null,
 source text not null check(source in ('gps','organizer')),
 distance_m integer not null check(distance_m>=0),
 accuracy_m double precision not null,
 reason text check(reason is null or length(btrim(reason)) between 3 and 500),
 recorded_by uuid not null references public.app_users(id) on delete restrict,
 recorded_at timestamptz not null default now(),
 primary key(meeting_id,member_id),
 foreign key(meeting_id,member_id) references public.committee_meeting_invites(meeting_id,member_id)
  on delete restrict,
 check((source='gps' and reason is null and recorded_by=member_id)
  or (source='organizer' and reason is not null))
);
create table public.committee_meeting_finalizations (
 meeting_id uuid primary key references public.committee_meetings(id) on delete restrict,
 finalized_by uuid not null references public.app_users(id) on delete restrict,
 is_fallback boolean not null,
 fallback_reason text,
 finalized_at timestamptz not null default now(),
 check(is_fallback=(fallback_reason is not null))
);
create table public.committee_meeting_roster (
 meeting_id uuid not null references public.committee_meeting_finalizations(meeting_id) on delete restrict,
 member_id uuid not null references public.app_users(id) on delete restrict,
 outcome text not null check(outcome in ('attended','declined','absent')),
 primary key(meeting_id,member_id)
);
-- One row per absentee. Delivery is a later worker; the primary key prevents a second notice.
create table public.committee_meeting_absence_outbox (
 meeting_id uuid not null references public.committee_meeting_finalizations(meeting_id) on delete restrict,
 member_id uuid not null references public.app_users(id) on delete restrict,
 queued_at timestamptz not null default now(),
 primary key(meeting_id,member_id)
);
do $$ declare v_name text; begin
 foreach v_name in array array['masjid_site','masjid_site_history','committee_meeting_attendance',
  'committee_meeting_finalizations','committee_meeting_roster','committee_meeting_absence_outbox'] loop
  execute format('alter table public.%I enable row level security',v_name);
  execute format('revoke all on public.%I from public,anon,authenticated',v_name);
 end loop;
 foreach v_name in array array['masjid_site_history','committee_meeting_attendance',
  'committee_meeting_finalizations','committee_meeting_roster','committee_meeting_absence_outbox'] loop
  execute format('create trigger %I before update or delete on public.%I for each row
   execute function app_private.reject_immutable_finance_change()',v_name||'_immutable',v_name);
 end loop;
end $$;

create function app_private.site_distance_m(p_latitude double precision,
 p_longitude double precision,p_accuracy_m double precision,p_captured_at timestamptz,
 p_mocked boolean)
returns integer language plpgsql stable security definer set search_path=pg_catalog as $$
declare v_site public.masjid_site; v_dlat double precision; v_dlon double precision;
 v_h double precision; v_distance double precision;
begin
 select * into v_site from public.masjid_site;
 if not found then raise exception 'site_not_configured' using errcode='22023'; end if;
 if p_latitude is null or p_longitude is null or p_latitude not between -90 and 90
  or p_longitude not between -180 and 180 or p_captured_at is null or p_mocked is null then
  raise exception 'invalid_location' using errcode='22023'; end if;
 if p_mocked then raise exception 'mock_location' using errcode='22023'; end if;
 if p_captured_at>now()+interval '5 seconds' or p_captured_at<now()-interval '2 minutes' then
  raise exception 'stale_location' using errcode='22023'; end if;
 if p_accuracy_m is null or p_accuracy_m<=0 or p_accuracy_m>35 then
  raise exception 'low_accuracy_location' using errcode='22023'; end if;
 v_dlat:=radians(p_latitude-v_site.latitude);
 v_dlon:=radians(p_longitude-v_site.longitude);
 v_h:=sin(v_dlat/2)^2+cos(radians(v_site.latitude))*cos(radians(p_latitude))*sin(v_dlon/2)^2;
 v_distance:=6371000*2*atan2(sqrt(v_h),sqrt(1-v_h));
 if v_distance>v_site.radius_m then
  raise exception 'outside_masjid_area' using errcode='22023'; end if;
 return round(v_distance)::integer;
end $$;
revoke all on function app_private.site_distance_m(double precision,double precision,
 double precision,timestamptz,boolean) from public,anon,authenticated;

create function public.masjid_site_configured()
returns boolean language plpgsql stable security definer set search_path=pg_catalog as $$
begin
 perform app_private.require_actor(array['system_admin','president','vice_president','secretary',
  'treasurer','committee_member','member','data_entry']);
 return exists(select 1 from public.masjid_site);
end $$;

create function public.get_masjid_site()
returns table(latitude double precision,longitude double precision,radius_m integer,
 evidence_reference text,set_at timestamptz)
language plpgsql stable security definer set search_path=pg_catalog as $$
begin
 perform app_private.require_actor(array['system_admin']);
 return query select s.latitude,s.longitude,s.radius_m,s.evidence_reference,s.set_at
  from public.masjid_site s;
end $$;

create function public.set_masjid_site(p_latitude double precision,p_longitude double precision,
 p_evidence text,p_operation_id uuid)
returns uuid language plpgsql security definer set search_path=pg_catalog as $$
declare v_actor uuid:=app_private.require_actor(array['system_admin']);
 v_evidence text:=btrim(p_evidence); v_old public.masjid_site_history;
begin
 if p_operation_id is null or p_latitude is null or p_longitude is null
  or p_latitude not between -90 and 90 or p_longitude not between -180 and 180
  or length(v_evidence) not between 3 and 240 then
  raise exception 'invalid_site' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_operation_id::text,94));
 select * into v_old from public.masjid_site_history where operation_id=p_operation_id;
 if found then
  if v_old.set_by<>v_actor or v_old.latitude<>p_latitude or v_old.longitude<>p_longitude
   or v_old.evidence_reference<>v_evidence then
   raise exception 'operation_id_conflict' using errcode='23505'; end if;
  return p_operation_id;
 end if;
 insert into public.masjid_site_history(operation_id,latitude,longitude,evidence_reference,set_by)
 values(p_operation_id,p_latitude,p_longitude,v_evidence,v_actor);
 insert into public.masjid_site(id,latitude,longitude,evidence_reference,set_by)
 values(true,p_latitude,p_longitude,v_evidence,v_actor)
 on conflict (id) do update set latitude=excluded.latitude,longitude=excluded.longitude,
  evidence_reference=excluded.evidence_reference,set_by=excluded.set_by,set_at=now();
 return p_operation_id;
end $$;

create function public.check_in_committee_meeting(p_meeting_id uuid,p_latitude double precision,
 p_longitude double precision,p_accuracy_m double precision,p_captured_at timestamptz,
 p_mocked boolean,p_operation_id uuid)
returns uuid language plpgsql security definer set search_path=pg_catalog as $$
declare v_actor uuid:=app_private.require_actor(array['system_admin','president','vice_president',
  'secretary','treasurer','committee_member','member','data_entry']);
 v_meeting public.committee_meetings; v_invite public.committee_meeting_invites;
 v_distance integer;
begin
 if p_meeting_id is null then raise exception 'invalid_check_in' using errcode='22023'; end if;
 if app_private.meeting_replay(p_operation_id,v_actor,p_meeting_id,'check_in','{}'::jsonb) then
  return p_meeting_id; end if;
 select * into v_meeting from public.committee_meetings where id=p_meeting_id for share;
 select * into v_invite from public.committee_meeting_invites
  where meeting_id=p_meeting_id and member_id=v_actor;
 if not found or v_invite.status not in ('invited','accepted')
  or v_meeting.status is distinct from 'active' then
  raise exception 'check_in_not_allowed' using errcode='42501'; end if;
 if v_meeting.meeting_date<>(now() at time zone 'Asia/Kolkata')::date then
  raise exception 'wrong_meeting_day' using errcode='22023'; end if;
 v_distance:=app_private.site_distance_m(p_latitude,p_longitude,p_accuracy_m,p_captured_at,p_mocked);
 insert into public.committee_meeting_attendance(meeting_id,member_id,source,distance_m,accuracy_m,recorded_by)
 values(p_meeting_id,v_actor,'gps',v_distance,p_accuracy_m,v_actor)
 on conflict (meeting_id,member_id) do nothing;
 insert into public.committee_meeting_operations(id,actor_id,meeting_id,action,payload)
 values(p_operation_id,v_actor,p_meeting_id,'check_in','{}'::jsonb);
 return p_meeting_id;
end $$;

create function public.mark_committee_attendance(p_meeting_id uuid,p_member_id uuid,
 p_latitude double precision,p_longitude double precision,p_accuracy_m double precision,
 p_captured_at timestamptz,p_mocked boolean,p_reason text,p_operation_id uuid)
returns uuid language plpgsql security definer set search_path=pg_catalog as $$
declare v_actor uuid:=app_private.require_actor(array['president','vice_president','secretary','data_entry']);
 v_meeting public.committee_meetings; v_invite public.committee_meeting_invites;
 v_reason text:=btrim(p_reason); v_distance integer;
 v_payload jsonb:=jsonb_build_object('member',p_member_id,'reason',btrim(p_reason));
begin
 if p_meeting_id is null or p_member_id is null or length(v_reason) not between 3 and 500 then
  raise exception 'invalid_manual_attendance' using errcode='22023'; end if;
 if app_private.meeting_replay(p_operation_id,v_actor,p_meeting_id,'manual_attendance',v_payload) then
  return p_meeting_id; end if;
 select * into v_meeting from public.committee_meetings where id=p_meeting_id for share;
 select * into v_invite from public.committee_meeting_invites
  where meeting_id=p_meeting_id and member_id=p_member_id;
 -- A fallback finalizer is deliberately not an organizer here and can never create presence.
 if v_meeting.creator_id is distinct from v_actor or v_meeting.status<>'active'
  or v_invite.status is null or v_invite.status not in ('invited','accepted') then
  raise exception 'manual_attendance_not_allowed' using errcode='42501'; end if;
 if v_meeting.meeting_date<>(now() at time zone 'Asia/Kolkata')::date then
  raise exception 'wrong_meeting_day' using errcode='22023'; end if;
 v_distance:=app_private.site_distance_m(p_latitude,p_longitude,p_accuracy_m,p_captured_at,p_mocked);
 insert into public.committee_meeting_attendance(meeting_id,member_id,source,distance_m,accuracy_m,reason,recorded_by)
 values(p_meeting_id,p_member_id,'organizer',v_distance,p_accuracy_m,v_reason,v_actor)
 on conflict (meeting_id,member_id) do nothing;
 insert into public.committee_meeting_operations(id,actor_id,meeting_id,action,payload)
 values(p_operation_id,v_actor,p_meeting_id,'manual_attendance',v_payload);
 return p_meeting_id;
end $$;

create function public.finalize_committee_meeting(p_meeting_id uuid,p_reason text,p_operation_id uuid)
returns uuid language plpgsql security definer set search_path=pg_catalog as $$
declare v_actor uuid:=app_private.require_actor(array['president','vice_president','secretary','data_entry']);
 v_meeting public.committee_meetings; v_reason text:=nullif(btrim(p_reason),'');
 v_fallback boolean; v_payload jsonb:=jsonb_build_object('reason',nullif(btrim(p_reason),''));
begin
 if p_meeting_id is null then raise exception 'invalid_finalization' using errcode='22023'; end if;
 if app_private.meeting_replay(p_operation_id,v_actor,p_meeting_id,'finalize',v_payload) then
  return p_meeting_id; end if;
 select * into v_meeting from public.committee_meetings where id=p_meeting_id for update;
 if not found or v_meeting.status<>'active' then
  raise exception 'finalization_not_allowed' using errcode='42501'; end if;
 v_fallback:=v_meeting.creator_id<>v_actor;
 if v_fallback and not exists(select 1 from public.app_users where id=v_actor and role='data_entry') then
  raise exception 'finalization_not_allowed' using errcode='42501'; end if;
 if v_fallback and (v_reason is null or length(v_reason) not between 3 and 500) then
  raise exception 'fallback_reason_required' using errcode='22023'; end if;
 if not v_fallback then v_reason:=null; end if;
 if v_meeting.meeting_date>=(now() at time zone 'Asia/Kolkata')::date then
  raise exception 'meeting_day_not_over' using errcode='22023'; end if;
 if exists(select 1 from public.committee_meeting_finalizations where meeting_id=p_meeting_id) then
  raise exception 'meeting_already_finalized' using errcode='23505'; end if;
 insert into public.committee_meeting_finalizations(meeting_id,finalized_by,is_fallback,fallback_reason)
 values(p_meeting_id,v_actor,v_fallback,v_reason);
 insert into public.committee_meeting_roster(meeting_id,member_id,outcome)
 select i.meeting_id,i.member_id,case when a.member_id is not null then 'attended'
   when i.status='declined' then 'declined' else 'absent' end
 from public.committee_meeting_invites i
 left join public.committee_meeting_attendance a
  on a.meeting_id=i.meeting_id and a.member_id=i.member_id
 where i.meeting_id=p_meeting_id;
 insert into public.committee_meeting_absence_outbox(meeting_id,member_id)
 select meeting_id,member_id from public.committee_meeting_roster
 where meeting_id=p_meeting_id and outcome='absent';
 insert into public.committee_meeting_operations(id,actor_id,meeting_id,action,payload)
 values(p_operation_id,v_actor,p_meeting_id,'finalize',v_payload);
 return p_meeting_id;
end $$;

create function public.list_committee_meeting_roster(p_meeting_id uuid)
returns table(member_id uuid,username text,invite_status text,attendance_source text,
 distance_m integer,outcome text)
language plpgsql stable security definer set search_path=pg_catalog as $$
declare v_actor uuid:=app_private.require_actor(array['president','vice_president','secretary','data_entry']);
begin
 if not exists(select 1 from public.committee_meetings m where m.id=p_meeting_id
   and (m.creator_id=v_actor or exists(select 1 from public.app_users u
    where u.id=v_actor and u.role='data_entry'))) then
  raise exception 'roster_not_allowed' using errcode='42501'; end if;
 return query select i.member_id,al.username,i.status,a.source,a.distance_m,r.outcome
  from public.committee_meeting_invites i
  join app_private.username_aliases al on al.user_id=i.member_id
  left join public.committee_meeting_attendance a
   on a.meeting_id=i.meeting_id and a.member_id=i.member_id
  left join public.committee_meeting_roster r
   on r.meeting_id=i.meeting_id and r.member_id=i.member_id
  where i.meeting_id=p_meeting_id order by al.username;
end $$;

create function public.my_committee_attendance()
returns table(meeting_id uuid,is_creator boolean,attendance_source text,outcome text,finalized boolean)
language plpgsql stable security definer set search_path=pg_catalog as $$
declare v_actor uuid:=app_private.require_actor(array['system_admin','president','vice_president',
  'secretary','treasurer','committee_member','member','data_entry']);
begin
 return query select m.id,m.creator_id=v_actor,a.source,r.outcome,f.meeting_id is not null
  from public.committee_meetings m
  left join public.committee_meeting_invites i on i.meeting_id=m.id and i.member_id=v_actor
  left join public.committee_meeting_attendance a on a.meeting_id=m.id and a.member_id=v_actor
  left join public.committee_meeting_roster r on r.meeting_id=m.id and r.member_id=v_actor
  left join public.committee_meeting_finalizations f on f.meeting_id=m.id
  where m.creator_id=v_actor or i.member_id is not null;
end $$;

create function public.list_meetings_pending_finalization()
returns table(meeting_id uuid,title text,meeting_date date,organizer text)
language plpgsql stable security definer set search_path=pg_catalog as $$
begin
 perform app_private.require_actor(array['data_entry']);
 return query select m.id,m.title,m.meeting_date,al.username
  from public.committee_meetings m
  join app_private.username_aliases al on al.user_id=m.creator_id
  left join public.committee_meeting_finalizations f on f.meeting_id=m.id
  where m.status='active' and f.meeting_id is null
   and m.meeting_date<(now() at time zone 'Asia/Kolkata')::date
  order by m.meeting_date,m.id;
end $$;

do $$ declare v_signature text; begin
 foreach v_signature in array array['masjid_site_configured()','get_masjid_site()',
  'set_masjid_site(double precision,double precision,text,uuid)',
  'check_in_committee_meeting(uuid,double precision,double precision,double precision,timestamptz,boolean,uuid)',
  'mark_committee_attendance(uuid,uuid,double precision,double precision,double precision,timestamptz,boolean,text,uuid)',
  'finalize_committee_meeting(uuid,text,uuid)','list_committee_meeting_roster(uuid)',
  'my_committee_attendance()','list_meetings_pending_finalization()'] loop
  execute format('revoke all on function public.%s from public,anon,authenticated',v_signature);
  execute format('grant execute on function public.%s to authenticated',v_signature);
 end loop;
end $$;
commit;
