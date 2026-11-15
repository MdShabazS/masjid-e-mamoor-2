begin;

create or replace function public.record_self_jummah_attendance(
  p_expected_actor_application_user_id uuid,
  p_event_id uuid,
  p_latitude numeric,
  p_longitude numeric,
  p_operation_id text,
  p_source text default 'online'
)
returns table (
  attendance_record_id uuid,
  event_id uuid,
  recorded_at timestamptz,
  already_recorded boolean,
  outcome text,
  error_code text
)
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_actor uuid := public.current_application_user_id();
  v_member_profile_id uuid;
  v_operation_id text := nullif(btrim(p_operation_id), '');
  v_source text := lower(nullif(btrim(p_source), ''));
  v_fingerprint text;
  v_existing_operation public.jummah_attendance_operations%rowtype;
  v_existing_record public.jummah_attendance_records%rowtype;
  v_event public.jummah_attendance_events%rowtype;
  v_record public.jummah_attendance_records%rowtype;
  v_now timestamptz := clock_timestamp();
  v_haversine double precision;
  v_distance_meters double precision;
begin
  if auth.uid() is null or v_actor is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if p_expected_actor_application_user_id is distinct from v_actor then
    raise exception 'operation_owner_mismatch' using errcode = '22023';
  end if;
  if not public.has_application_permission('attendance.records.create')
     or public.current_application_role() is distinct from 'member' then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if p_event_id is null
     or p_latitude is null
     or p_longitude is null
     or p_latitude not between -90 and 90
     or p_longitude not between -180 and 180 then
    raise exception 'invalid_attendance_location' using errcode = '22023';
  end if;
  if v_operation_id is null or length(v_operation_id) > 200 then
    raise exception 'invalid_operation_id' using errcode = '22023';
  end if;
  if v_source is null or v_source not in ('online', 'offline') then
    raise exception 'invalid_attendance_source' using errcode = '22023';
  end if;

  v_fingerprint := pg_catalog.md5(
    p_event_id::text || '|' || p_latitude::text || '|' ||
    p_longitude::text || '|' || v_source
  );

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'jummah-attendance:' || v_actor::text || ':' || v_operation_id,
      0
    )
  );

  select ao.* into v_existing_operation
  from public.jummah_attendance_operations ao
  where ao.actor_application_user_id = v_actor
    and ao.operation_id = v_operation_id;

  if found then
    if v_existing_operation.event_id <> p_event_id
       or v_existing_operation.request_fingerprint <> v_fingerprint then
      raise exception 'operation_id_conflict' using errcode = '22023';
    end if;
    if v_existing_operation.outcome = 'rejected' then
      return query select null::uuid, v_existing_operation.event_id,
        null::timestamptz, false, 'rejected'::text,
        v_existing_operation.error_code;
    else
      select ar.* into v_existing_record
      from public.jummah_attendance_records ar
      where ar.id = v_existing_operation.attendance_record_id;
      return query select v_existing_record.id, v_existing_record.event_id,
        v_existing_record.recorded_at, true,
        v_existing_operation.outcome, null::text;
    end if;
    return;
  end if;

  select e.* into v_event
  from public.jummah_attendance_events e
  where e.id = p_event_id;
  if not found then
    raise exception 'attendance_event_not_found' using errcode = 'P0002';
  end if;

  if v_now < v_event.checkin_opens_at
     or v_now > v_event.checkin_closes_at then
    perform public.persist_jummah_attendance_rejection(
      p_event_id, v_actor, v_operation_id, v_fingerprint,
      'attendance_window_closed', v_source = 'offline'
    );
    return query select null::uuid, p_event_id, null::timestamptz,
      false, 'rejected'::text, 'attendance_window_closed'::text;
    return;
  end if;

  select mp.id into v_member_profile_id
  from public.member_profiles mp
  where mp.application_user_id = v_actor
    and mp.status = 'active';
  if v_member_profile_id is null then
    perform public.persist_jummah_attendance_rejection(
      p_event_id, v_actor, v_operation_id, v_fingerprint,
      'active_member_profile_required', v_source = 'offline'
    );
    return query select null::uuid, p_event_id, null::timestamptz,
      false, 'rejected'::text, 'active_member_profile_required'::text;
    return;
  end if;

  v_haversine :=
    power(sin(radians((p_latitude::double precision - v_event.center_latitude::double precision) / 2)), 2)
    + cos(radians(v_event.center_latitude::double precision))
    * cos(radians(p_latitude::double precision))
    * power(sin(radians((p_longitude::double precision - v_event.center_longitude::double precision) / 2)), 2);
  v_distance_meters := 2 * 6371008.8 * asin(sqrt(least(1::double precision, greatest(0::double precision, v_haversine))));

  if v_distance_meters > 100 then
    perform public.persist_jummah_attendance_rejection(
      p_event_id, v_actor, v_operation_id, v_fingerprint,
      'outside_attendance_radius', v_source = 'offline'
    );
    return query select null::uuid, p_event_id, null::timestamptz,
      false, 'rejected'::text, 'outside_attendance_radius'::text;
    return;
  end if;

  insert into public.jummah_attendance_records (
    event_id,
    member_profile_id,
    recorded_by_application_user_id,
    recorded_at,
    source,
    operation_id,
    request_fingerprint
  ) values (
    p_event_id,
    v_member_profile_id,
    v_actor,
    v_now,
    v_source,
    v_operation_id,
    v_fingerprint
  ) on conflict on constraint jummah_attendance_event_member_uidx do nothing
  returning * into v_record;

  if not found then
    select ar.* into v_existing_record
    from public.jummah_attendance_records ar
    where ar.event_id = p_event_id
      and ar.member_profile_id = v_member_profile_id;
    insert into public.jummah_attendance_operations (
      actor_application_user_id,
      operation_id,
      event_id,
      request_fingerprint,
      outcome,
      attendance_record_id
    ) values (
      v_actor,
      v_operation_id,
      p_event_id,
      v_fingerprint,
      'already_recorded',
      v_existing_record.id
    );
    return query select v_existing_record.id, v_existing_record.event_id,
      v_existing_record.recorded_at, true, 'already_recorded'::text, null::text;
    return;
  end if;

  insert into public.jummah_attendance_operations (
    actor_application_user_id,
    operation_id,
    event_id,
    request_fingerprint,
    outcome,
    attendance_record_id
  ) values (
    v_actor,
    v_operation_id,
    p_event_id,
    v_fingerprint,
    'accepted',
    v_record.id
  );

  insert into public.jummah_attendance_activity (
    event_id,
    attendance_record_id,
    actor_application_user_id,
    activity_type,
    operation_id,
    request_fingerprint
  ) values (
    p_event_id,
    v_record.id,
    v_actor,
    'attendance_recorded',
    v_operation_id,
    v_fingerprint
  );

  return query select v_record.id, v_record.event_id,
    v_record.recorded_at, false, 'accepted'::text, null::text;
end;
$$;

commit;
