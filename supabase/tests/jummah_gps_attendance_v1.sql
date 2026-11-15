\set ON_ERROR_STOP on

begin;

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at
)
values
  ('87000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'jummah-president@example.invalid', '', now(), now(), now()),
  ('87000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'jummah-member-one@example.invalid', '', now(), now(), now()),
  ('87000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'jummah-member-two@example.invalid', '', now(), now(), now());

insert into public.application_users (id, auth_user_id, status)
values
  ('88000000-0000-0000-0000-000000000001', '87000000-0000-0000-0000-000000000001', 'active'),
  ('88000000-0000-0000-0000-000000000002', '87000000-0000-0000-0000-000000000002', 'active'),
  ('88000000-0000-0000-0000-000000000003', '87000000-0000-0000-0000-000000000003', 'active');

insert into public.application_user_roles (application_user_id, role_id)
select x.application_user_id, r.id
from (values
  ('88000000-0000-0000-0000-000000000001'::uuid, 'president'),
  ('88000000-0000-0000-0000-000000000002'::uuid, 'member'),
  ('88000000-0000-0000-0000-000000000003'::uuid, 'member')
) x(application_user_id, role_key)
join public.roles r on r.key = x.role_key;

insert into public.member_profiles (
  id, application_user_id, status, display_name
)
values
  ('89000000-0000-0000-0000-000000000002', '88000000-0000-0000-0000-000000000002', 'active', 'Jummah Member One'),
  ('89000000-0000-0000-0000-000000000003', '88000000-0000-0000-0000-000000000003', 'active', 'Jummah Member Two'),
  ('89000000-0000-0000-0000-000000000001', '88000000-0000-0000-0000-000000000001', 'active', 'Jummah President');

do $$
declare
  v_president_role uuid;
  v_permission uuid;
begin
  select r.id into v_president_role
  from public.roles r where r.key = 'president';
  select p.id into v_permission
  from public.permissions p where p.key = 'attendance.events.manage';

  if not exists (
    select 1 from public.role_permissions rp
    where rp.role_id = v_president_role and rp.permission_id = v_permission
  ) then
    raise exception 'FAIL: President is not granted attendance.events.manage';
  end if;

  if exists (
    select 1 from public.role_permissions rp
    join public.roles r on r.id = rp.role_id
    where rp.permission_id = v_permission and r.key <> 'president'
  ) then
    raise exception 'FAIL: attendance.events.manage is granted outside President';
  end if;

  if not (select relrowsecurity from pg_catalog.pg_class where oid = 'public.jummah_attendance_events'::regclass)
     or not (select relrowsecurity from pg_catalog.pg_class where oid = 'public.jummah_attendance_records'::regclass)
     or not (select relrowsecurity from pg_catalog.pg_class where oid = 'public.jummah_attendance_operations'::regclass)
     or not (select relrowsecurity from pg_catalog.pg_class where oid = 'public.jummah_attendance_activity'::regclass) then
    raise exception 'FAIL: Jummah attendance RLS is not enabled';
  end if;

  if exists (
    select 1
    from unnest(array['anon', 'authenticated']) as client_role(role_name)
    cross join unnest(array[
      'public.jummah_attendance_events',
      'public.jummah_attendance_records',
      'public.jummah_attendance_operations',
      'public.jummah_attendance_activity'
    ]) as protected_table(table_name)
    where has_table_privilege(client_role.role_name, protected_table.table_name, 'SELECT')
       or has_table_privilege(client_role.role_name, protected_table.table_name, 'INSERT')
       or has_table_privilege(client_role.role_name, protected_table.table_name, 'UPDATE')
       or has_table_privilege(client_role.role_name, protected_table.table_name, 'DELETE')
  ) then
    raise exception 'FAIL: clients have direct attendance table access';
  end if;

  if has_function_privilege('anon', 'public.create_jummah_attendance_event(timestamptz,timestamptz,timestamptz,numeric,numeric,text)', 'EXECUTE')
     or has_function_privilege('anon', 'public.list_jummah_attendance_events(timestamptz,uuid,integer)', 'EXECUTE')
     or has_function_privilege('anon', 'public.record_self_jummah_attendance(uuid,uuid,numeric,numeric,text,text)', 'EXECUTE') then
    raise exception 'FAIL: anon can execute Jummah attendance operations';
  end if;

  if not has_function_privilege('authenticated', 'public.create_jummah_attendance_event(timestamptz,timestamptz,timestamptz,numeric,numeric,text)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.list_jummah_attendance_events(timestamptz,uuid,integer)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.record_self_jummah_attendance(uuid,uuid,numeric,numeric,text,text)', 'EXECUTE') then
    raise exception 'FAIL: authenticated RPC grants are incomplete';
  end if;

  if has_function_privilege('anon', 'public.persist_jummah_attendance_rejection(uuid,uuid,text,text,text,boolean)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.persist_jummah_attendance_rejection(uuid,uuid,text,text,text,boolean)', 'EXECUTE') then
    raise exception 'FAIL: internal attendance rejection helper is callable by clients';
  end if;

  if exists (
    select 1 from pg_catalog.pg_attribute
    where attrelid = 'public.jummah_attendance_records'::regclass
      and not attisdropped
      and attname in ('latitude', 'longitude', 'raw_location', 'gps_coordinates')
  ) then
    raise exception 'FAIL: raw attendee GPS coordinates are persisted';
  end if;

  if exists (
    select 1 from pg_catalog.pg_proc p
    where p.oid = 'public.list_jummah_attendance_events(timestamptz,uuid,integer)'::regprocedure
      and pg_catalog.pg_get_function_result(p.oid) ~ '(center_latitude|center_longitude)'
  ) then
    raise exception 'FAIL: event listing exposes geofence coordinates';
  end if;
end;
$$;

set local role authenticated;
select set_config('request.jwt.claim.sub', '87000000-0000-0000-0000-000000000001', true);

select event_id as jummah_event_id
from public.create_jummah_attendance_event(
  now(), now() - interval '1 hour', now() + interval '1 hour',
  12.9716000, 77.5946000, 'create-event-operation-1'
);
\gset
select set_config('test.jummah_event_id', :'jummah_event_id', true);

select event_id as closed_event_id
from public.create_jummah_attendance_event(
  now(), now() - interval '2 hours', now() - interval '1 hour',
  12.9716000, 77.5946000, 'create-event-operation-2'
);
\gset
select set_config('test.closed_event_id', :'closed_event_id', true);

do $$
begin
  begin
    perform * from public.create_jummah_attendance_event(
      now(), now() - interval '1 hour', now() + interval '1 hour',
      12.9726000, 77.5946000, 'create-event-operation-1'
    );
    raise exception 'FAIL: conflicting event operation was accepted';
  exception when sqlstate '22023' then
    if sqlerrm <> 'operation_id_conflict' then raise; end if;
  end;
end;
$$;

select set_config('request.jwt.claim.sub', '87000000-0000-0000-0000-000000000002', true);

do $$
declare
  v_event uuid := current_setting('test.jummah_event_id')::uuid;
  v_closed uuid := current_setting('test.closed_event_id')::uuid;
  v_record uuid;
  v_duplicate boolean;
  v_outcome text;
  v_error_code text;
begin
  begin
    perform * from public.create_jummah_attendance_event(
      now(), now() - interval '1 hour', now() + interval '1 hour',
      12.9716000, 77.5946000, 'member-event-operation'
    );
    raise exception 'FAIL: Member created an attendance event';
  exception when insufficient_privilege then
    if sqlerrm <> 'not_authorized' then raise; end if;
  end;

  if exists (
    select 1 from public.list_jummah_attendance_events(null, null, 100) e
    where e.event_id = v_event
      and to_jsonb(e) ?| array['center_latitude', 'center_longitude']
  ) then
    raise exception 'FAIL: event geofence centre leaked to Member';
  end if;

  begin
    perform * from public.record_self_jummah_attendance(
      '88000000-0000-0000-0000-000000000003',
      v_event, 12.9716000, 77.5946000, 'member-owner-mismatch', 'online'
    );
    raise exception 'FAIL: client-selected operation owner was accepted';
  exception when sqlstate '22023' then
    if sqlerrm <> 'operation_owner_mismatch' then raise; end if;
  end;

  select r.attendance_record_id, r.already_recorded
  into v_record, v_duplicate
  from public.record_self_jummah_attendance(
    '88000000-0000-0000-0000-000000000002',
    v_event, 12.9724990, 77.5946000, 'member-attendance-operation-1', 'online'
  ) r;
  if v_record is null or v_duplicate then
    raise exception 'FAIL: valid self-attendance was not newly accepted';
  end if;

  select r.attendance_record_id, r.already_recorded
  into v_record, v_duplicate
  from public.record_self_jummah_attendance(
    '88000000-0000-0000-0000-000000000002',
    v_event, 12.9724990, 77.5946000, 'member-attendance-operation-1', 'online'
  ) r;
  if not v_duplicate then
    raise exception 'FAIL: retry did not return the prior attendance';
  end if;

  select r.already_recorded into v_duplicate
  from public.record_self_jummah_attendance(
    '88000000-0000-0000-0000-000000000002',
    v_event, 12.9716000, 77.5946000, 'member-attendance-operation-duplicate', 'online'
  ) r;
  if not v_duplicate then
    raise exception 'FAIL: duplicate event/member attendance was not recognized';
  end if;

  select r.outcome, r.error_code into v_outcome, v_error_code
  from public.record_self_jummah_attendance(
      '88000000-0000-0000-0000-000000000002',
      v_closed, 12.9716000, 77.5946000,
      'member-offline-after-close', 'offline'
    ) r;
  if v_outcome <> 'rejected' or v_error_code <> 'attendance_window_closed' then
    raise exception 'FAIL: offline attendance did not receive a closed-window rejection';
  end if;

  select r.outcome, r.error_code into v_outcome, v_error_code
  from public.record_self_jummah_attendance(
      '88000000-0000-0000-0000-000000000002',
      v_closed, 12.9716000, 77.5946000,
      'member-offline-after-close', 'offline'
    ) r;
  if v_outcome <> 'rejected' or v_error_code <> 'attendance_window_closed' then
    raise exception 'FAIL: rejected operation replay was not stable';
  end if;

  select r.outcome, r.error_code into v_outcome, v_error_code
  from public.record_self_jummah_attendance(
      '88000000-0000-0000-0000-000000000002',
      v_event, 12.9736000, 77.5946000,
      'member-outside-radius', 'online'
    ) r;
  if v_outcome <> 'rejected' or v_error_code <> 'outside_attendance_radius' then
    raise exception 'FAIL: attendance outside the 100m radius was accepted';
  end if;
end;
$$;

reset role;

do $$
begin
  if (
    select count(*)
    from public.jummah_attendance_records ar
    where ar.event_id = current_setting('test.jummah_event_id')::uuid
  ) <> 1 then
    raise exception 'FAIL: duplicate attendance record was created';
  end if;
end;
$$;

create function pg_temp.fail_jummah_attendance_notification()
returns trigger
language plpgsql
as $$
begin
  if new.kind = 'attendance_sync_rejected' then
    raise exception 'injected_notification_failure';
  end if;
  return new;
end;
$$;

create trigger test_fail_jummah_attendance_notification
before insert on public.notifications
for each row execute function pg_temp.fail_jummah_attendance_notification();

set local role authenticated;
select set_config('request.jwt.claim.sub', '87000000-0000-0000-0000-000000000003', true);

do $$
declare
  v_event uuid := current_setting('test.jummah_event_id')::uuid;
  v_closed uuid := current_setting('test.closed_event_id')::uuid;
  v_record uuid;
  v_outcome text;
  v_error_code text;
begin
  select r.attendance_record_id into v_record
  from public.record_self_jummah_attendance(
    '88000000-0000-0000-0000-000000000003',
    v_event, 12.9716000, 77.5946000,
    'member-two-offline-operation', 'offline'
  ) r;
  if v_record is null then
    raise exception 'FAIL: queued attendance did not sync during its window';
  end if;

  select r.outcome, r.error_code into v_outcome, v_error_code
  from public.record_self_jummah_attendance(
      '88000000-0000-0000-0000-000000000003',
      v_closed, 12.9716000, 77.5946000,
      'member-two-offline-after-close', 'offline'
    ) r;
  if v_outcome <> 'rejected' or v_error_code <> 'attendance_window_closed' then
    raise exception 'FAIL: closed-window offline operation was accepted';
  end if;
end;
$$;

reset role;
drop trigger test_fail_jummah_attendance_notification on public.notifications;

set local role authenticated;
select set_config('request.jwt.claim.sub', '87000000-0000-0000-0000-000000000001', true);
do $$
begin
  begin
    perform * from public.record_self_jummah_attendance(
      '88000000-0000-0000-0000-000000000001',
      current_setting('test.jummah_event_id')::uuid,
      12.9716000, 77.5946000, 'president-self-attendance', 'online'
    );
    raise exception 'FAIL: President used Member self-attendance operation';
  exception when insufficient_privilege then
    if sqlerrm <> 'not_authorized' then raise; end if;
  end;
end;
$$;
reset role;

do $$
begin
  begin
    update public.jummah_attendance_records
    set source = 'online'
    where operation_id = 'member-attendance-operation-1';
    raise exception 'FAIL: attendance history update was allowed';
  exception when sqlstate '55000' then
    if sqlerrm <> 'jummah_attendance_history_immutable' then raise; end if;
  end;

  if (select count(*) from public.jummah_attendance_activity) <> 7 then
    raise exception 'FAIL: accepted attendance/event audit history is incomplete';
  end if;

  if (select count(*) from public.jummah_attendance_operations) <> 6 then
    raise exception 'FAIL: accepted, duplicate, and rejected operation results are incomplete';
  end if;

  if (select count(*) from public.notifications where kind = 'attendance_sync_rejected') <> 1 then
    raise exception 'FAIL: notification failure incorrectly changed rejection state or successful notification count';
  end if;
end;
$$;

rollback;
