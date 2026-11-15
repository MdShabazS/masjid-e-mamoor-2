-- President-configured Jummah events and member self-attendance.
-- Attendee coordinates are validated in the trusted operation and never stored.

begin;

insert into public.permissions (key, name, description)
values (
  'attendance.events.manage',
  'Attendance / Events / Manage',
  'Create President-configured attendance events'
)
on conflict (key) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.key = 'attendance.events.manage'
where r.key = 'president'
on conflict do nothing;

create table public.jummah_attendance_events (
  id uuid primary key default gen_random_uuid(),
  scheduled_for timestamptz not null,
  checkin_opens_at timestamptz not null,
  checkin_closes_at timestamptz not null,
  center_latitude numeric(10, 7) not null,
  center_longitude numeric(10, 7) not null,
  created_by_application_user_id uuid not null
    references public.application_users(id) on delete restrict,
  operation_id text not null,
  request_fingerprint text not null,
  created_at timestamptz not null default clock_timestamp(),

  constraint jummah_attendance_event_window_chk
    check (checkin_closes_at > checkin_opens_at),
  constraint jummah_attendance_event_latitude_chk
    check (center_latitude between -90 and 90),
  constraint jummah_attendance_event_longitude_chk
    check (center_longitude between -180 and 180),
  constraint jummah_attendance_event_operation_chk
    check (length(btrim(operation_id)) between 1 and 200),
  constraint jummah_attendance_event_actor_operation_uidx
    unique (created_by_application_user_id, operation_id)
);

create index jummah_attendance_events_schedule_idx
  on public.jummah_attendance_events(scheduled_for desc, id desc);

create table public.jummah_attendance_records (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null
    references public.jummah_attendance_events(id) on delete restrict,
  member_profile_id uuid not null
    references public.member_profiles(id) on delete restrict,
  recorded_by_application_user_id uuid not null
    references public.application_users(id) on delete restrict,
  recorded_at timestamptz not null,
  source text not null,
  operation_id text not null,
  request_fingerprint text not null,

  constraint jummah_attendance_source_chk
    check (source in ('online', 'offline')),
  constraint jummah_attendance_operation_chk
    check (length(btrim(operation_id)) between 1 and 200),
  constraint jummah_attendance_event_member_uidx
    unique (event_id, member_profile_id),
  constraint jummah_attendance_actor_operation_uidx
    unique (recorded_by_application_user_id, operation_id)
);

create index jummah_attendance_records_member_recorded_idx
  on public.jummah_attendance_records(member_profile_id, recorded_at desc);

create table public.jummah_attendance_operations (
  actor_application_user_id uuid not null
    references public.application_users(id) on delete restrict,
  operation_id text not null,
  event_id uuid not null
    references public.jummah_attendance_events(id) on delete restrict,
  request_fingerprint text not null,
  outcome text not null,
  error_code text,
  attendance_record_id uuid
    references public.jummah_attendance_records(id) on delete restrict,
  created_at timestamptz not null default clock_timestamp(),

  primary key (actor_application_user_id, operation_id),
  constraint jummah_attendance_operation_id_chk
    check (length(btrim(operation_id)) between 1 and 200),
  constraint jummah_attendance_operation_outcome_chk
    check (outcome in ('accepted', 'already_recorded', 'rejected')),
  constraint jummah_attendance_operation_result_chk
    check (
      (outcome = 'rejected' and error_code is not null and attendance_record_id is null)
      or
      (outcome in ('accepted', 'already_recorded') and error_code is null and attendance_record_id is not null)
    )
);

create table public.jummah_attendance_activity (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null
    references public.jummah_attendance_events(id) on delete restrict,
  attendance_record_id uuid
    references public.jummah_attendance_records(id) on delete restrict,
  actor_application_user_id uuid not null
    references public.application_users(id) on delete restrict,
  activity_type text not null,
  error_code text,
  operation_id text not null,
  request_fingerprint text not null,
  created_at timestamptz not null default clock_timestamp(),

  constraint jummah_attendance_activity_type_chk
    check (activity_type in ('event_created', 'attendance_recorded', 'attendance_rejected')),
  constraint jummah_attendance_activity_identity_chk
    check (
      (activity_type = 'event_created' and attendance_record_id is null)
      or
      (activity_type = 'attendance_recorded' and attendance_record_id is not null and error_code is null)
      or
      (activity_type = 'attendance_rejected' and attendance_record_id is null and error_code is not null)
    )
);

create index jummah_attendance_activity_event_idx
  on public.jummah_attendance_activity(event_id, created_at, id);

alter table public.jummah_attendance_events enable row level security;
alter table public.jummah_attendance_records enable row level security;
alter table public.jummah_attendance_operations enable row level security;
alter table public.jummah_attendance_activity enable row level security;

alter table public.notifications
  add column source_attendance_activity_id uuid
    references public.jummah_attendance_activity(id) on delete restrict;

alter table public.notifications
  drop constraint notifications_kind_chk;
alter table public.notifications
  add constraint notifications_kind_chk check (
    kind in (
      'task_assigned', 'task_unassigned', 'task_updated', 'task_progress',
      'task_started', 'task_completed', 'task_declined', 'meeting_created',
      'meeting_updated', 'meeting_cancelled', 'announcement',
      'attendance_sync_rejected'
    )
  );

alter table public.notifications
  drop constraint notifications_activity_source_exclusive_chk;
alter table public.notifications
  add constraint notifications_activity_source_exclusive_chk
  check (num_nonnulls(
    source_activity_id,
    source_meeting_activity_id,
    source_attendance_activity_id
  ) <= 1);

create unique index notifications_attendance_activity_kind_recipient_uidx
  on public.notifications(
    recipient_application_user_id,
    source_attendance_activity_id,
    kind
  )
  where source_attendance_activity_id is not null;

create index notifications_attendance_source_idx
  on public.notifications(source_type, source_entity_id, created_at desc)
  where source_type = 'jummah_attendance';

revoke all on table public.jummah_attendance_events
  from public, anon, authenticated, service_role;
revoke all on table public.jummah_attendance_records
  from public, anon, authenticated, service_role;
revoke all on table public.jummah_attendance_operations
  from public, anon, authenticated, service_role;
revoke all on table public.jummah_attendance_activity
  from public, anon, authenticated, service_role;

create or replace function public.reject_jummah_attendance_history_mutation()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  raise exception 'jummah_attendance_history_immutable'
    using errcode = '55000';
end;
$$;

revoke all on function public.reject_jummah_attendance_history_mutation()
  from public, anon, authenticated, service_role;

create trigger jummah_attendance_activity_immutable
before update or delete on public.jummah_attendance_activity
for each row execute function public.reject_jummah_attendance_history_mutation();

create trigger jummah_attendance_records_immutable
before update or delete on public.jummah_attendance_records
for each row execute function public.reject_jummah_attendance_history_mutation();

create trigger jummah_attendance_operations_immutable
before update or delete on public.jummah_attendance_operations
for each row execute function public.reject_jummah_attendance_history_mutation();

create or replace function public.create_jummah_attendance_event(
  p_scheduled_for timestamptz,
  p_checkin_opens_at timestamptz,
  p_checkin_closes_at timestamptz,
  p_center_latitude numeric,
  p_center_longitude numeric,
  p_operation_id text
)
returns table (
  event_id uuid,
  scheduled_for timestamptz,
  checkin_opens_at timestamptz,
  checkin_closes_at timestamptz,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_actor uuid := public.current_application_user_id();
  v_operation_id text := nullif(btrim(p_operation_id), '');
  v_fingerprint text;
  v_existing public.jummah_attendance_events%rowtype;
  v_event public.jummah_attendance_events%rowtype;
begin
  if auth.uid() is null or v_actor is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if not public.has_application_permission('attendance.events.manage') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  if p_scheduled_for is null
     or p_checkin_opens_at is null
     or p_checkin_closes_at is null
     or p_checkin_closes_at <= p_checkin_opens_at
     or p_center_latitude is null
     or p_center_longitude is null
     or p_center_latitude not between -90 and 90
     or p_center_longitude not between -180 and 180 then
    raise exception 'invalid_attendance_event' using errcode = '22023';
  end if;

  if v_operation_id is null or length(v_operation_id) > 200 then
    raise exception 'invalid_operation_id' using errcode = '22023';
  end if;

  v_fingerprint := pg_catalog.md5(
    p_scheduled_for::text || '|' ||
    p_checkin_opens_at::text || '|' ||
    p_checkin_closes_at::text || '|' ||
    p_center_latitude::text || '|' ||
    p_center_longitude::text
  );

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'jummah-event:' || v_actor::text || ':' || v_operation_id,
      0
    )
  );

  select e.*
  into v_existing
  from public.jummah_attendance_events e
  where e.created_by_application_user_id = v_actor
    and e.operation_id = v_operation_id;

  if found then
    if v_existing.request_fingerprint <> v_fingerprint then
      raise exception 'operation_id_conflict' using errcode = '22023';
    end if;
    return query select
      v_existing.id,
      v_existing.scheduled_for,
      v_existing.checkin_opens_at,
      v_existing.checkin_closes_at,
      v_existing.created_at;
    return;
  end if;

  insert into public.jummah_attendance_events (
    scheduled_for,
    checkin_opens_at,
    checkin_closes_at,
    center_latitude,
    center_longitude,
    created_by_application_user_id,
    operation_id,
    request_fingerprint
  ) values (
    p_scheduled_for,
    p_checkin_opens_at,
    p_checkin_closes_at,
    p_center_latitude,
    p_center_longitude,
    v_actor,
    v_operation_id,
    v_fingerprint
  ) returning * into v_event;

  insert into public.jummah_attendance_activity (
    event_id,
    actor_application_user_id,
    activity_type,
    operation_id,
    request_fingerprint
  ) values (
    v_event.id,
    v_actor,
    'event_created',
    v_operation_id,
    v_fingerprint
  );

  return query select
    v_event.id,
    v_event.scheduled_for,
    v_event.checkin_opens_at,
    v_event.checkin_closes_at,
    v_event.created_at;
end;
$$;

create or replace function public.list_jummah_attendance_events(
  p_before_scheduled_for timestamptz default null,
  p_before_event_id uuid default null,
  p_limit integer default 50
)
returns table (
  event_id uuid,
  scheduled_for timestamptz,
  checkin_opens_at timestamptz,
  checkin_closes_at timestamptz,
  is_open boolean,
  my_attendance_recorded_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := public.current_application_user_id();
  v_member_profile_id uuid;
  v_now timestamptz := clock_timestamp();
begin
  if auth.uid() is null or v_actor is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not public.has_application_permission('attendance.records.read') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if (p_before_scheduled_for is null) <> (p_before_event_id is null) then
    raise exception 'invalid_attendance_cursor' using errcode = '22023';
  end if;
  if p_limit is null or p_limit < 1 or p_limit > 100 then
    raise exception 'invalid_page_size' using errcode = '22023';
  end if;

  select mp.id into v_member_profile_id
  from public.member_profiles mp
  where mp.application_user_id = v_actor
    and mp.status = 'active';

  return query
  select
    e.id,
    e.scheduled_for,
    e.checkin_opens_at,
    e.checkin_closes_at,
    v_now >= e.checkin_opens_at and v_now <= e.checkin_closes_at,
    ar.recorded_at
  from public.jummah_attendance_events e
  left join public.jummah_attendance_records ar
    on ar.event_id = e.id
   and ar.member_profile_id = v_member_profile_id
  where p_before_scheduled_for is null
     or (e.scheduled_for, e.id) < (p_before_scheduled_for, p_before_event_id)
  order by e.scheduled_for desc, e.id desc
  limit p_limit;
end;
$$;

create or replace function public.persist_jummah_attendance_rejection(
  p_event_id uuid,
  p_actor_application_user_id uuid,
  p_operation_id text,
  p_request_fingerprint text,
  p_error_code text,
  p_notify boolean
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_activity_id uuid;
begin
  insert into public.jummah_attendance_operations (
    actor_application_user_id,
    operation_id,
    event_id,
    request_fingerprint,
    outcome,
    error_code
  ) values (
    p_actor_application_user_id,
    p_operation_id,
    p_event_id,
    p_request_fingerprint,
    'rejected',
    p_error_code
  );

  insert into public.jummah_attendance_activity (
    event_id,
    actor_application_user_id,
    activity_type,
    error_code,
    operation_id,
    request_fingerprint
  ) values (
    p_event_id,
    p_actor_application_user_id,
    'attendance_rejected',
    p_error_code,
    p_operation_id,
    p_request_fingerprint
  ) returning id into v_activity_id;

  if p_notify then
    begin
      insert into public.notifications (
        recipient_application_user_id,
        actor_application_user_id,
        kind,
        title,
        body,
        target_path,
        source_type,
        source_entity_id,
        source_attendance_activity_id,
        metadata
      ) values (
        p_actor_application_user_id,
        p_actor_application_user_id,
        'attendance_sync_rejected',
        'Attendance needs attention',
        'A queued Jummah attendance attempt was not accepted. Open attendance to review it.',
        '/attendance',
        'jummah_attendance',
        p_event_id,
        v_activity_id,
        jsonb_build_object('event_id', p_event_id, 'error_code', p_error_code)
      ) on conflict (
        recipient_application_user_id,
        source_attendance_activity_id,
        kind
      ) where source_attendance_activity_id is not null do nothing;
    exception when others then
      raise log 'Jummah offline rejection notification insert failed (SQLSTATE %)', SQLSTATE;
    end;
  end if;
end;
$$;

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
  ) on conflict (event_id, member_profile_id) do nothing
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

revoke all on function public.reject_jummah_attendance_history_mutation()
  from public, anon, authenticated, service_role;
revoke all on function public.persist_jummah_attendance_rejection(
  uuid, uuid, text, text, text, boolean
) from public, anon, authenticated, service_role;
revoke all on function public.create_jummah_attendance_event(
  timestamptz, timestamptz, timestamptz, numeric, numeric, text
) from public, anon, authenticated, service_role;
revoke all on function public.list_jummah_attendance_events(
  timestamptz, uuid, integer
) from public, anon, authenticated, service_role;
revoke all on function public.record_self_jummah_attendance(
  uuid, uuid, numeric, numeric, text, text
) from public, anon, authenticated, service_role;

grant execute on function public.create_jummah_attendance_event(
  timestamptz, timestamptz, timestamptz, numeric, numeric, text
) to authenticated;
grant execute on function public.list_jummah_attendance_events(
  timestamptz, uuid, integer
) to authenticated;
grant execute on function public.record_self_jummah_attendance(
  uuid, uuid, numeric, numeric, text, text
) to authenticated;

comment on table public.jummah_attendance_events is
  'President-created Jummah attendance events. The configured centre is private and returned only to event managers.';
comment on table public.jummah_attendance_records is
  'Immutable accepted self-attendance records. Submitted attendee coordinates are not persisted.';
comment on table public.jummah_attendance_activity is
  'Append-only audit history for Jummah attendance events and accepted attendance.';
comment on table public.jummah_attendance_operations is
  'Append-only idempotent outcomes for accepted, duplicate, and rejected Jummah attendance submissions.';

commit;
