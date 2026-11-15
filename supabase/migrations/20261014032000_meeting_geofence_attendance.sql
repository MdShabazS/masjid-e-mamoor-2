-- Same-day masjid geofence attendance. The center starts unset until System Admin verifies it.
begin;

create table public.meeting_attendance_location (
  singleton boolean primary key default true check (singleton),
  center_latitude double precision,
  center_longitude double precision,
  updated_by_application_user_id uuid references public.application_users(id),
  updated_at timestamptz,
  constraint meeting_location_pair check ((center_latitude is null) = (center_longitude is null)),
  constraint meeting_location_lat check (center_latitude is null or center_latitude between -90 and 90),
  constraint meeting_location_lon check (center_longitude is null or center_longitude between -180 and 180)
);
insert into public.meeting_attendance_location(singleton) values (true);
revoke all on public.meeting_attendance_location from public,anon,authenticated;
grant all on public.meeting_attendance_location to service_role;
alter table public.meeting_attendance_location enable row level security;

create table public.meeting_attendance_audit (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.committee_meetings(id),
  attendance_id uuid not null references public.committee_meeting_attendance(id),
  actor_application_user_id uuid not null references public.application_users(id),
  subject_application_user_id uuid not null references public.application_users(id),
  source text not null check (source in ('gps','manual')),
  reason text,
  recorded_at timestamptz not null default now(),
  operation_id text not null,
  unique (actor_application_user_id, operation_id),
  check ((source='manual' and reason is not null and length(btrim(reason)) between 10 and 1000)
      or (source='gps' and reason is null))
);
revoke all on public.meeting_attendance_audit from public,anon,authenticated;
grant select on public.meeting_attendance_audit to authenticated;
grant all on public.meeting_attendance_audit to service_role;
alter table public.meeting_attendance_audit enable row level security;
create policy meeting_attendance_audit_read on public.meeting_attendance_audit
  for select to authenticated using (public.can_read_committee_meeting(meeting_id));

create function public.reject_meeting_attendance_audit_change() returns trigger
language plpgsql set search_path=pg_catalog as $$
begin raise exception 'attendance_audit_immutable' using errcode='55000'; end;
$$;
revoke all on function public.reject_meeting_attendance_audit_change() from public,anon,authenticated,service_role;
create trigger meeting_attendance_audit_immutable before update or delete
  on public.meeting_attendance_audit for each row execute function public.reject_meeting_attendance_audit_change();

alter table public.committee_meeting_attendance
  add column attendance_source text not null default 'legacy'
    check (attendance_source in ('legacy','gps','manual')),
  add column manual_reason text,
  add constraint meeting_attendance_manual_reason_check
    check ((attendance_source='manual' and manual_reason is not null and length(btrim(manual_reason)) between 10 and 1000)
      or (attendance_source<>'manual' and manual_reason is null));

create table public.meeting_attendance_location_audit (
  id uuid primary key default gen_random_uuid(),
  actor_application_user_id uuid not null references public.application_users(id),
  previous_latitude double precision,
  previous_longitude double precision,
  next_latitude double precision not null,
  next_longitude double precision not null,
  changed_at timestamptz not null default now()
);
revoke all on public.meeting_attendance_location_audit from public,anon,authenticated;
grant all on public.meeting_attendance_location_audit to service_role;
alter table public.meeting_attendance_location_audit enable row level security;
create trigger meeting_attendance_location_audit_immutable before update or delete
  on public.meeting_attendance_location_audit for each row execute function public.reject_meeting_attendance_audit_change();

create function public.set_meeting_attendance_location(p_latitude double precision, p_longitude double precision)
returns void language plpgsql security definer set search_path=pg_catalog,extensions as $$
declare v_actor uuid; v_old public.meeting_attendance_location;
begin
  select au.id into v_actor from public.application_users au
  join public.application_user_roles aur on aur.application_user_id=au.id
  join public.roles r on r.id=aur.role_id
  where au.auth_user_id=auth.uid() and au.status='active' and r.key='system_admin'
  for update of au,aur;
  if v_actor is null then raise exception 'not_authorized' using errcode='42501'; end if;
  if p_latitude is null or p_longitude is null
     or p_latitude not between -90 and 90 or p_longitude not between -180 and 180 then
    raise exception 'invalid_meeting_location' using errcode='22023';
  end if;
  select * into v_old from public.meeting_attendance_location where singleton for update;
  if v_old.center_latitude is not distinct from p_latitude and v_old.center_longitude is not distinct from p_longitude then return; end if;
  update public.meeting_attendance_location set center_latitude=p_latitude, center_longitude=p_longitude,
    updated_by_application_user_id=v_actor, updated_at=clock_timestamp() where singleton;
  insert into public.meeting_attendance_location_audit
    (actor_application_user_id,previous_latitude,previous_longitude,next_latitude,next_longitude)
  values (v_actor,v_old.center_latitude,v_old.center_longitude,p_latitude,p_longitude);
end;
$$;

create function public.get_meeting_attendance_location()
returns table(center_latitude double precision,center_longitude double precision,updated_at timestamptz)
language plpgsql stable security definer set search_path=pg_catalog as $$
begin
  if not exists(select 1 from public.application_users au
    join public.application_user_roles aur on aur.application_user_id=au.id
    join public.roles r on r.id=aur.role_id
    where au.auth_user_id=auth.uid() and au.status='active' and r.key='system_admin') then
    raise exception 'not_authorized' using errcode='42501'; end if;
  return query select ml.center_latitude,ml.center_longitude,ml.updated_at
    from public.meeting_attendance_location ml where ml.singleton;
end;
$$;
revoke all on function public.get_meeting_attendance_location() from public,anon,authenticated,service_role;
grant execute on function public.get_meeting_attendance_location() to authenticated;

-- The original manager endpoint would bypass both location and date controls.
revoke all on function public.record_committee_meeting_attendance(uuid,uuid,text,text)
  from public,anon,authenticated,service_role;

create function public.record_self_committee_meeting_attendance(
  p_meeting_id uuid, p_latitude double precision, p_longitude double precision,
  p_accuracy_meters double precision, p_operation_id text
) returns public.committee_meeting_attendance
language plpgsql security definer set search_path=pg_catalog,extensions as $$
declare
  v_actor uuid := public.current_application_user_id();
  v_meeting public.committee_meetings;
  v_center public.meeting_attendance_location;
  v_existing public.committee_meeting_attendance;
  v_result public.committee_meeting_attendance;
  v_op text := nullif(btrim(p_operation_id),'');
  v_fingerprint text;
  v_delta_lat double precision; v_delta_lon double precision; v_hav double precision;
begin
  if v_actor is null then raise exception 'not_authenticated' using errcode='42501'; end if;
  if not public.has_application_permission('committee.meetings.read') then
    raise exception 'missing_permission' using errcode='42501'; end if;
  if v_op is null or length(v_op)>200 then raise exception 'invalid_operation_id' using errcode='22023'; end if;
  if p_latitude is null or p_longitude is null or p_accuracy_meters is null
    
     or p_latitude not between -90 and 90 or p_longitude not between -180 and 180
     or p_accuracy_meters < 0 or p_accuracy_meters > 100 then
    raise exception 'invalid_attendance_location' using errcode='22023'; end if;
  -- Coordinates are used only for this transaction; no raw member location is stored.
  v_fingerprint := encode(extensions.digest(concat_ws('|',p_meeting_id::text,v_actor::text,
    p_latitude::text,p_longitude::text,p_accuracy_meters::text,'gps'),'sha256'),'hex');
  perform pg_advisory_xact_lock(pg_catalog.hashtextextended(v_actor::text||':'||v_op,0));
  select * into v_existing from public.committee_meeting_attendance
    where recorded_by_application_user_id=v_actor and operation_id=v_op;
  if found then
    if v_existing.request_fingerprint<>v_fingerprint then raise exception 'operation_id_conflict' using errcode='23505'; end if;
    return v_existing;
  end if;
  select * into v_meeting from public.committee_meetings where id=p_meeting_id for update;
  if not found then raise exception 'meeting_not_found' using errcode='P0002'; end if;
  if v_meeting.status<>'scheduled' or
     (clock_timestamp() at time zone 'Asia/Kolkata')::date <>
     (v_meeting.scheduled_start at time zone 'Asia/Kolkata')::date then
    raise exception 'attendance_window_closed' using errcode='55000'; end if;
  if not exists(select 1 from public.committee_meeting_participants
    where meeting_id=p_meeting_id and application_user_id=v_actor) then
    raise exception 'not_meeting_participant' using errcode='42501'; end if;
  select * into v_center from public.meeting_attendance_location where singleton;
  if v_center.center_latitude is null then
    raise exception 'attendance_location_not_configured' using errcode='55000'; end if;
  v_delta_lat := radians(p_latitude-v_center.center_latitude);
  v_delta_lon := radians(p_longitude-v_center.center_longitude);
  v_hav := power(sin(v_delta_lat/2),2) + cos(radians(v_center.center_latitude))
    * cos(radians(p_latitude)) * power(sin(v_delta_lon/2),2);
  if 2*6371008.8*asin(sqrt(least(1,greatest(0,v_hav)))) > 100 then
    raise exception 'outside_attendance_radius' using errcode='22023'; end if;
  if exists(select 1 from public.committee_meeting_attendance
    where meeting_id=p_meeting_id and application_user_id=v_actor) then
    raise exception 'attendance_already_recorded' using errcode='23505'; end if;
  insert into public.committee_meeting_attendance
    (meeting_id,application_user_id,attendance_status,recorded_by_application_user_id,
     operation_id,request_fingerprint,attendance_source)
  values (p_meeting_id,v_actor,'present',v_actor,v_op,v_fingerprint,'gps') returning * into v_result;
  insert into public.meeting_attendance_audit
    (meeting_id,attendance_id,actor_application_user_id,subject_application_user_id,source,operation_id)
  values (p_meeting_id,v_result.id,v_actor,v_actor,'gps',v_op);
  return v_result;
end;
$$;

create function public.record_manual_committee_meeting_attendance(
  p_meeting_id uuid,p_application_user_id uuid,p_reason text,p_operation_id text
) returns public.committee_meeting_attendance
language plpgsql security definer set search_path=pg_catalog,extensions as $$
declare
  v_actor uuid:=public.current_application_user_id();
  v_meeting public.committee_meetings;
  v_result public.committee_meeting_attendance;
  v_reason text:=nullif(btrim(p_reason),'');
  v_op text:=nullif(btrim(p_operation_id),'');
  v_fingerprint text;
begin
  if v_actor is null then raise exception 'not_authenticated' using errcode='42501'; end if;
  if v_reason is null or length(v_reason) not between 10 and 1000 then
    raise exception 'manual_reason_required' using errcode='22023'; end if;
  if v_op is null or length(v_op)>200 then raise exception 'invalid_operation_id' using errcode='22023'; end if;
  v_fingerprint:=encode(extensions.digest(concat_ws('|',p_meeting_id::text,
    p_application_user_id::text,v_reason,'manual'),'sha256'),'hex');
  perform pg_advisory_xact_lock(pg_catalog.hashtextextended(v_actor::text||':'||v_op,0));
  select * into v_result from public.committee_meeting_attendance
    where recorded_by_application_user_id=v_actor and operation_id=v_op;
  if found then
    if v_result.request_fingerprint<>v_fingerprint then raise exception 'operation_id_conflict' using errcode='23505'; end if;
    return v_result;
  end if;
  select * into v_meeting from public.committee_meetings where id=p_meeting_id for update;
  if not found then raise exception 'meeting_not_found' using errcode='P0002'; end if;
  if v_meeting.created_by_application_user_id<>v_actor then
    raise exception 'not_meeting_creator' using errcode='42501'; end if;
  if v_meeting.status<>'scheduled' or
    (clock_timestamp() at time zone 'Asia/Kolkata')::date <>
    (v_meeting.scheduled_start at time zone 'Asia/Kolkata')::date then
    raise exception 'attendance_window_closed' using errcode='55000'; end if;
  if not exists(select 1 from public.committee_meeting_participants
    where meeting_id=p_meeting_id and application_user_id=p_application_user_id) then
    raise exception 'not_meeting_participant' using errcode='42501'; end if;
  if exists(select 1 from public.committee_meeting_attendance
    where meeting_id=p_meeting_id and application_user_id=p_application_user_id) then
    raise exception 'attendance_already_recorded' using errcode='23505'; end if;
  insert into public.committee_meeting_attendance
    (meeting_id,application_user_id,attendance_status,recorded_by_application_user_id,
     operation_id,request_fingerprint,attendance_source,manual_reason)
  values (p_meeting_id,p_application_user_id,'present',v_actor,v_op,v_fingerprint,'manual',v_reason)
  returning * into v_result;
  insert into public.meeting_attendance_audit
    (meeting_id,attendance_id,actor_application_user_id,subject_application_user_id,source,reason,operation_id)
  values (p_meeting_id,v_result.id,v_actor,p_application_user_id,'manual',v_reason,v_op);
  return v_result;
end;
$$;

revoke all on function public.set_meeting_attendance_location(double precision,double precision)
  from public,anon,authenticated,service_role;
revoke all on function public.record_self_committee_meeting_attendance(uuid,double precision,double precision,double precision,text)
  from public,anon,authenticated,service_role;
revoke all on function public.record_manual_committee_meeting_attendance(uuid,uuid,text,text)
  from public,anon,authenticated,service_role;
grant execute on function public.set_meeting_attendance_location(double precision,double precision) to authenticated;
grant execute on function public.record_self_committee_meeting_attendance(uuid,double precision,double precision,double precision,text) to authenticated;
grant execute on function public.record_manual_committee_meeting_attendance(uuid,uuid,text,text) to authenticated;
commit;
