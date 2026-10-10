-- Masjid E Mamoor 2
-- Selected Mobile UI V2: assignment decline, durable announcements, and metadata-only invalidation.

begin;

alter table public.committee_task_activity
  drop constraint committee_task_activity_type_chk;

alter table public.committee_task_activity
  add constraint committee_task_activity_type_chk
  check (
    activity_type in (
      'task_created',
      'task_updated',
      'progress_added',
      'status_changed',
      'task_completed',
      'assignment_declined'
    )
  );

alter table public.notifications
  drop constraint notifications_kind_chk;

alter table public.notifications
  add constraint notifications_kind_chk
  check (
    kind in (
      'task_assigned',
      'task_unassigned',
      'task_updated',
      'task_progress',
      'task_started',
      'task_completed',
      'task_declined',
      'meeting_created',
      'meeting_updated',
      'meeting_cancelled',
      'announcement'
    )
  );

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  created_by_application_user_id uuid not null
    references public.application_users(id) on delete restrict,
  title text not null,
  body text not null,
  target_path text not null default '/announcements',
  operation_id text not null,
  request_fingerprint text not null,
  created_at timestamptz not null default now(),

  constraint announcements_title_chk
    check (title = btrim(title) and length(title) between 1 and 120),
  constraint announcements_body_chk
    check (body = btrim(body) and length(body) between 1 and 2000),
  constraint announcements_target_path_chk
    check (
      target_path = btrim(target_path)
      and length(target_path) between 1 and 500
      and left(target_path, 1) = '/'
      and left(target_path, 2) <> '//'
      and position('\\' in target_path) = 0
    ),
  constraint announcements_operation_id_chk
    check (length(btrim(operation_id)) between 1 and 200),
  constraint announcements_fingerprint_chk
    check (request_fingerprint ~ '^[0-9a-f]{64}$')
);

create unique index announcements_actor_operation_uidx
  on public.announcements(created_by_application_user_id, operation_id);

create index announcements_created_idx
  on public.announcements(created_at desc, id desc);

create unique index notifications_announcement_recipient_uidx
  on public.notifications(
    recipient_application_user_id,
    source_entity_id,
    kind
  )
  where kind = 'announcement';

alter table public.announcements enable row level security;

revoke all privileges on table public.announcements
from public, anon, authenticated;

grant all privileges on table public.announcements to service_role;

create or replace function public.create_committee_task_notifications(
  p_task_id uuid,
  p_activity_id uuid,
  p_kind text,
  p_recipient_ids uuid[],
  p_title text,
  p_body text,
  p_target_path text,
  p_metadata jsonb default '{}'::jsonb
)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, extensions
as $$
declare
  v_actor uuid;
  v_inserted integer;
begin
  select activity.actor_application_user_id
  into v_actor
  from public.committee_task_activity activity
  where activity.id = p_activity_id
    and activity.task_id = p_task_id;

  if v_actor is null then
    raise exception 'invalid_notification_source' using errcode = '22023';
  end if;

  if p_kind is null or p_kind not in (
    'task_assigned',
    'task_unassigned',
    'task_updated',
    'task_progress',
    'task_started',
    'task_completed',
    'task_declined'
  ) then
    raise exception 'invalid_notification_kind' using errcode = '22023';
  end if;

  if p_metadata is null or jsonb_typeof(p_metadata) <> 'object' then
    raise exception 'invalid_notification_metadata' using errcode = '22023';
  end if;

  insert into public.notifications (
    recipient_application_user_id,
    actor_application_user_id,
    kind,
    title,
    body,
    target_path,
    source_type,
    source_entity_id,
    source_activity_id,
    metadata
  )
  select distinct
    recipient.id,
    v_actor,
    p_kind,
    btrim(p_title),
    btrim(p_body),
    btrim(p_target_path),
    'committee_task',
    p_task_id,
    p_activity_id,
    p_metadata || jsonb_build_object(
      'task_id', p_task_id,
      'activity_id', p_activity_id
    )
  from unnest(coalesce(p_recipient_ids, '{}'::uuid[])) recipient(id)
  join public.application_users au on au.id = recipient.id
  where recipient.id <> v_actor
    and au.status = 'active'
  on conflict (recipient_application_user_id, source_activity_id, kind)
    where source_activity_id is not null
    do nothing;

  get diagnostics v_inserted = row_count;
  return v_inserted;
end;
$$;

revoke execute on function public.create_committee_task_notifications(
  uuid, uuid, text, uuid[], text, text, text, jsonb
)
from public, anon, authenticated, service_role;

create or replace function public.decline_committee_task_assignment(
  p_task_id uuid,
  p_reason text,
  p_operation_id text
)
returns public.committee_tasks
language plpgsql
security definer
set search_path = pg_catalog, extensions
as $$
declare
  v_actor uuid := public.current_application_user_id();
  v_reason text := nullif(btrim(p_reason), '');
  v_operation_id text := nullif(btrim(p_operation_id), '');
  v_fingerprint text;
  v_existing public.committee_task_activity;
  v_activity public.committee_task_activity;
  v_assignment public.committee_task_assignees;
  v_task public.committee_tasks;
  v_remaining integer;
begin
  if v_actor is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.application_users au
    where au.id = v_actor
      and au.status = 'active'
  ) or not public.has_application_permission('committee.tasks.manage') then
    raise exception 'missing_permission' using errcode = '42501';
  end if;

  if p_task_id is null then
    raise exception 'invalid_task_id' using errcode = '22023';
  end if;

  if v_reason is not null and length(v_reason) > 2000 then
    raise exception 'invalid_decline_reason' using errcode = '22023';
  end if;

  if v_operation_id is null or length(v_operation_id) > 200 then
    raise exception 'invalid_operation_id' using errcode = '22023';
  end if;

  v_fingerprint := pg_catalog.encode(
    extensions.digest(
      pg_catalog.jsonb_build_object(
        'operation', 'task_assignment_decline',
        'task_id', p_task_id,
        'reason', v_reason
      )::text,
      'sha256'
    ),
    'hex'
  );

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_actor::text || ':' || v_operation_id, 0)
  );

  select *
  into v_existing
  from public.committee_task_activity
  where actor_application_user_id = v_actor
    and operation_id = v_operation_id;

  if found then
    if v_existing.activity_type <> 'assignment_declined'
       or v_existing.task_id <> p_task_id
       or v_existing.request_fingerprint <> v_fingerprint then
      raise exception 'operation_id_conflict' using errcode = '23505';
    end if;

    select * into v_task
    from public.committee_tasks
    where id = p_task_id;

    return v_task;
  end if;

  select *
  into v_task
  from public.committee_tasks
  where id = p_task_id
  for update;

  if not found then
    raise exception 'task_not_found' using errcode = 'P0002';
  end if;

  if v_task.assignment_mode <> 'direct' then
    raise exception 'open_task_cannot_be_declined' using errcode = '22023';
  end if;

  if v_task.status <> 'assigned' then
    raise exception 'task_decline_not_allowed' using errcode = '22023';
  end if;

  select *
  into v_assignment
  from public.committee_task_assignees
  where task_id = p_task_id
    and application_user_id = v_actor
    and removed_at is null
  for update;

  if not found then
    raise exception 'not_assigned' using errcode = '42501';
  end if;

  update public.committee_task_assignees
  set removed_at = now(),
      removed_by_application_user_id = v_actor
  where id = v_assignment.id;

  select count(*)::integer
  into v_remaining
  from public.committee_task_assignees
  where task_id = p_task_id
    and removed_at is null;

  insert into public.committee_task_activity (
    task_id,
    actor_application_user_id,
    activity_type,
    remark,
    details,
    operation_id,
    request_fingerprint
  ) values (
    p_task_id,
    v_actor,
    'assignment_declined',
    v_reason,
    jsonb_build_object(
      'declined_application_user_id', v_actor,
      'remaining_assignee_count', v_remaining,
      'requires_reassignment', v_remaining = 0,
      'notification_event', 'task_declined'
    ),
    v_operation_id,
    v_fingerprint
  )
  returning * into v_activity;

  perform public.create_committee_task_notifications(
    v_task.id,
    v_activity.id,
    'task_declined',
    public.committee_task_event_recipient_ids(v_task.id),
    'Task assignment declined',
    format('An assignment for "%s" was declined.', v_task.title),
    '/work/' || v_task.id::text,
    jsonb_build_object(
      'task_status', v_task.status,
      'requires_reassignment', v_remaining = 0
    )
  );

  return v_task;
end;
$$;

revoke all on function public.decline_committee_task_assignment(uuid, text, text)
from public;
grant execute on function public.decline_committee_task_assignment(uuid, text, text)
to authenticated;

create or replace function public.publish_announcement(
  p_title text,
  p_body text,
  p_target_path text,
  p_operation_id text
)
returns public.announcements
language plpgsql
security definer
set search_path = pg_catalog, extensions
as $$
declare
  v_actor uuid := public.current_application_user_id();
  v_title text := btrim(coalesce(p_title, ''));
  v_body text := btrim(coalesce(p_body, ''));
  v_target_path text := coalesce(nullif(btrim(p_target_path), ''), '/announcements');
  v_operation_id text := nullif(btrim(p_operation_id), '');
  v_fingerprint text;
  v_existing public.announcements;
  v_announcement public.announcements;
begin
  if v_actor is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.application_users au
    where au.id = v_actor
      and au.status = 'active'
  ) or not public.has_application_permission('notifications.admin.manage') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  if length(v_title) not between 1 and 120
     or length(v_body) not between 1 and 2000 then
    raise exception 'invalid_announcement' using errcode = '22023';
  end if;

  if length(v_target_path) > 500
     or left(v_target_path, 1) <> '/'
     or left(v_target_path, 2) = '//'
     or position('\\' in v_target_path) > 0 then
    raise exception 'invalid_target_path' using errcode = '22023';
  end if;

  if v_operation_id is null or length(v_operation_id) > 200 then
    raise exception 'invalid_operation_id' using errcode = '22023';
  end if;

  v_fingerprint := pg_catalog.encode(
    extensions.digest(
      pg_catalog.jsonb_build_object(
        'operation', 'announcement_publish',
        'title', v_title,
        'body', v_body,
        'target_path', v_target_path
      )::text,
      'sha256'
    ),
    'hex'
  );

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_actor::text || ':' || v_operation_id, 0)
  );

  select *
  into v_existing
  from public.announcements
  where created_by_application_user_id = v_actor
    and operation_id = v_operation_id;

  if found then
    if v_existing.request_fingerprint <> v_fingerprint then
      raise exception 'operation_id_conflict' using errcode = '23505';
    end if;

    return v_existing;
  end if;

  insert into public.announcements (
    created_by_application_user_id,
    title,
    body,
    target_path,
    operation_id,
    request_fingerprint
  ) values (
    v_actor,
    v_title,
    v_body,
    v_target_path,
    v_operation_id,
    v_fingerprint
  )
  returning * into v_announcement;

  insert into public.notifications (
    recipient_application_user_id,
    actor_application_user_id,
    kind,
    title,
    body,
    target_path,
    source_type,
    source_entity_id,
    metadata
  )
  select distinct
    au.id,
    v_actor,
    'announcement',
    v_announcement.title,
    v_announcement.body,
    v_announcement.target_path,
    'announcement',
    v_announcement.id,
    jsonb_build_object('announcement_id', v_announcement.id)
  from public.application_users au
  join public.application_user_roles aur
    on aur.application_user_id = au.id
  join public.role_permissions rp
    on rp.role_id = aur.role_id
  join public.permissions p
    on p.id = rp.permission_id
  where au.status = 'active'
    and p.key = 'notifications.own.read'
  on conflict (recipient_application_user_id, source_entity_id, kind)
    where kind = 'announcement'
    do nothing;

  return v_announcement;
end;
$$;

revoke all on function public.publish_announcement(text, text, text, text)
from public;
grant execute on function public.publish_announcement(text, text, text, text)
to authenticated;

create or replace function public.list_my_announcements(
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (
  id uuid,
  actor_application_user_id uuid,
  kind text,
  title text,
  body text,
  target_path text,
  source_type text,
  source_entity_id uuid,
  source_activity_id uuid,
  metadata jsonb,
  read_at timestamptz,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = pg_catalog, extensions
as $$
declare
  v_recipient uuid := public.current_application_user_id();
begin
  if v_recipient is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  if p_limit is null or p_limit < 1 or p_limit > 100
     or p_offset is null or p_offset < 0 then
    raise exception 'invalid_pagination' using errcode = '22023';
  end if;

  return query
  select
    n.id,
    n.actor_application_user_id,
    n.kind,
    n.title,
    n.body,
    n.target_path,
    n.source_type,
    n.source_entity_id,
    n.source_activity_id,
    n.metadata,
    n.read_at,
    n.created_at
  from public.notifications n
  where n.recipient_application_user_id = v_recipient
    and n.kind = 'announcement'
  order by n.created_at desc, n.id desc
  limit p_limit offset p_offset;
end;
$$;

revoke all on function public.list_my_announcements(integer, integer)
from public;
grant execute on function public.list_my_announcements(integer, integer)
to authenticated;

create or replace function public.broadcast_notification_created()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, extensions
as $$
begin
  perform realtime.send(
    jsonb_build_object(
      'notification_id', new.id,
      'kind', new.kind,
      'source_type', new.source_type,
      'source_entity_id', new.source_entity_id
    ),
    'notification_created',
    'notifications:' || new.recipient_application_user_id::text,
    true
  );

  return new;
end;
$$;

revoke all on function public.broadcast_notification_created()
from public, anon, authenticated, service_role;


-- V2 trusted RPC final execute hardening
--
-- PostgreSQL grants EXECUTE on newly-created functions to PUBLIC by
-- default. These user-facing trusted operations must be callable only
-- by authenticated application sessions.

do $v2_rpc_privilege_hardening$
declare
  v_signature text;
  v_found integer := 0;
begin
  for v_signature in
    select pg_catalog.format(
      '%I.%I(%s)',
      n.nspname,
      p.proname,
      pg_catalog.pg_get_function_identity_arguments(p.oid)
    )
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n
      on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'decline_committee_task_assignment',
        'publish_announcement',
        'list_my_announcements'
      )
    order by p.proname
  loop
    v_found := v_found + 1;

    execute
      'revoke all privileges on function '
      || v_signature
      || ' from public, anon, service_role';

    execute
      'grant execute on function '
      || v_signature
      || ' to authenticated';
  end loop;

  if v_found <> 3 then
    raise exception
      'expected exactly 3 V2 trusted RPC signatures, found %',
      v_found;
  end if;
end
$v2_rpc_privilege_hardening$;

commit;
