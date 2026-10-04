-- Masjid-e-Mamoor
-- Durable committee-task notification backend.

begin;

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_application_user_id uuid not null
    references public.application_users(id) on delete restrict,
  actor_application_user_id uuid
    references public.application_users(id) on delete restrict,
  kind text not null,
  title text not null,
  body text not null,
  target_path text not null,
  source_type text not null,
  source_entity_id uuid not null,
  source_activity_id uuid
    references public.committee_task_activity(id) on delete restrict,
  metadata jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now(),

  constraint notifications_kind_chk check (
    kind in (
      'task_assigned',
      'task_unassigned',
      'task_updated',
      'task_progress',
      'task_started',
      'task_completed'
    )
  ),
  constraint notifications_title_chk
    check (title = btrim(title) and length(title) between 1 and 120),
  constraint notifications_body_chk
    check (body = btrim(body) and length(body) between 1 and 500),
  constraint notifications_target_path_chk
    check (
      target_path = btrim(target_path)
      and length(target_path) between 1 and 500
      and left(target_path, 1) = '/'
    ),
  constraint notifications_source_type_chk
    check (
      source_type = btrim(source_type)
      and length(source_type) between 1 and 80
    ),
  constraint notifications_metadata_object_chk
    check (jsonb_typeof(metadata) = 'object')
);

create index notifications_recipient_created_idx
  on public.notifications(recipient_application_user_id, created_at desc, id desc);

create index notifications_recipient_unread_idx
  on public.notifications(recipient_application_user_id, created_at desc, id desc)
  where read_at is null;

create index notifications_source_idx
  on public.notifications(source_type, source_entity_id, created_at desc);

create unique index notifications_activity_kind_recipient_uidx
  on public.notifications(
    recipient_application_user_id,
    source_activity_id,
    kind
  )
  where source_activity_id is not null;

alter table public.notifications enable row level security;

revoke all privileges on table public.notifications
from public, anon, authenticated;

create or replace function public.committee_task_event_recipient_ids(
  p_task_id uuid
)
returns uuid[]
language sql
stable
security definer
set search_path = pg_catalog, extensions
as $$
  select coalesce(array_agg(distinct recipients.id order by recipients.id), '{}'::uuid[])
  from (
    select au.id
    from public.committee_task_assignees cta
    join public.application_users au
      on au.id = cta.application_user_id
    where cta.task_id = p_task_id
      and cta.removed_at is null
      and au.status = 'active'

    union

    select au.id
    from public.application_users au
    join public.application_user_roles aur
      on aur.application_user_id = au.id
    join public.role_permissions rp
      on rp.role_id = aur.role_id
    join public.permissions p
      on p.id = rp.permission_id
    where au.status = 'active'
      and p.key = 'committee.tasks.assign'
  ) recipients
  where recipients.id is distinct from public.current_application_user_id();
$$;

revoke execute on function public.committee_task_event_recipient_ids(uuid)
from public, anon, authenticated, service_role;

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
    'task_completed'
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

create or replace function public.start_committee_task(
  p_task_id uuid,
  p_operation_id text
)
returns public.committee_tasks
language plpgsql
security definer
set search_path = pg_catalog, extensions
as $$
declare
  v_actor uuid;
  v_operation_id text := nullif(btrim(p_operation_id), '');
  v_fingerprint text;
  v_existing public.committee_task_activity;
  v_activity public.committee_task_activity;
  v_task public.committee_tasks;
begin
  v_actor := public.current_application_user_id();
  if v_actor is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if not public.has_application_permission('committee.tasks.manage') then
    raise exception 'missing_permission' using errcode = '42501';
  end if;
  if v_operation_id is null or length(v_operation_id) > 200 then
    raise exception 'invalid_operation_id' using errcode = '22023';
  end if;

  v_fingerprint := pg_catalog.encode(extensions.digest(pg_catalog.jsonb_build_object(
    'operation', 'task_start', 'task_id', p_task_id
  )::text, 'sha256'), 'hex');
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_actor::text || ':' || v_operation_id, 0)
  );

  select * into v_existing
  from public.committee_task_activity
  where actor_application_user_id = v_actor
    and operation_id = v_operation_id;
  if found then
    if v_existing.activity_type <> 'status_changed'
       or v_existing.task_id <> p_task_id
       or v_existing.request_fingerprint <> v_fingerprint then
      raise exception 'operation_id_conflict' using errcode = '23505';
    end if;
    select * into v_task from public.committee_tasks where id = p_task_id;
    return v_task;
  end if;

  select * into v_task
  from public.committee_tasks
  where id = p_task_id
  for update;
  if not found then
    raise exception 'task_not_found' using errcode = 'P0002';
  end if;

  if not public.has_application_permission('committee.tasks.assign') and not exists (
    select 1
    from public.committee_task_assignees
    where task_id = p_task_id
      and application_user_id = v_actor
      and removed_at is null
  ) then
    raise exception 'not_assigned' using errcode = '42501';
  end if;

  if v_task.status <> 'assigned' then
    raise exception 'invalid_status_transition' using errcode = '22023';
  end if;

  update public.committee_tasks
  set status = 'in_progress'
  where id = p_task_id
  returning * into v_task;

  insert into public.committee_task_activity (
    task_id, actor_application_user_id, activity_type, details,
    operation_id, request_fingerprint
  ) values (
    p_task_id,
    v_actor,
    'status_changed',
    jsonb_build_object(
      'from', 'assigned',
      'to', 'in_progress',
      'notification_event', 'task_started'
    ),
    v_operation_id,
    v_fingerprint
  ) returning * into v_activity;

  perform public.create_committee_task_notifications(
    v_task.id,
    v_activity.id,
    'task_started',
    public.committee_task_event_recipient_ids(v_task.id),
    'Task started',
    format('Work started on "%s".', v_task.title),
    '/work/' || v_task.id::text,
    jsonb_build_object('task_status', v_task.status)
  );

  return v_task;
end;
$$;

create or replace function public.complete_committee_task(
  p_task_id uuid,
  p_completion_notes text,
  p_operation_id text
)
returns public.committee_tasks
language plpgsql
security definer
set search_path = pg_catalog, extensions
as $$
declare
  v_actor uuid;
  v_notes text := nullif(btrim(p_completion_notes), '');
  v_operation_id text := nullif(btrim(p_operation_id), '');
  v_fingerprint text;
  v_existing public.committee_task_activity;
  v_activity public.committee_task_activity;
  v_task public.committee_tasks;
begin
  v_actor := public.current_application_user_id();
  if v_actor is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if not public.has_application_permission('committee.tasks.manage') then
    raise exception 'missing_permission' using errcode = '42501';
  end if;
  if v_notes is not null and length(v_notes) > 5000 then
    raise exception 'invalid_completion_notes' using errcode = '22023';
  end if;
  if v_operation_id is null or length(v_operation_id) > 200 then
    raise exception 'invalid_operation_id' using errcode = '22023';
  end if;

  v_fingerprint := pg_catalog.encode(extensions.digest(pg_catalog.jsonb_build_object(
    'operation', 'task_complete',
    'task_id', p_task_id,
    'completion_notes', v_notes
  )::text, 'sha256'), 'hex');
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_actor::text || ':' || v_operation_id, 0)
  );

  select * into v_existing
  from public.committee_task_activity
  where actor_application_user_id = v_actor
    and operation_id = v_operation_id;
  if found then
    if v_existing.activity_type <> 'task_completed'
       or v_existing.task_id <> p_task_id
       or v_existing.request_fingerprint <> v_fingerprint then
      raise exception 'operation_id_conflict' using errcode = '23505';
    end if;
    select * into v_task from public.committee_tasks where id = p_task_id;
    return v_task;
  end if;

  select * into v_task
  from public.committee_tasks
  where id = p_task_id
  for update;
  if not found then
    raise exception 'task_not_found' using errcode = 'P0002';
  end if;

  if not public.has_application_permission('committee.tasks.assign') and not exists (
    select 1
    from public.committee_task_assignees
    where task_id = p_task_id
      and application_user_id = v_actor
      and removed_at is null
  ) then
    raise exception 'not_assigned' using errcode = '42501';
  end if;

  if v_task.status <> 'in_progress' then
    raise exception 'invalid_status_transition' using errcode = '22023';
  end if;

  update public.committee_tasks
  set status = 'completed',
      completed_by_application_user_id = v_actor,
      completed_at = now()
  where id = p_task_id
  returning * into v_task;

  insert into public.committee_task_activity (
    task_id, actor_application_user_id, activity_type, remark, details,
    operation_id, request_fingerprint
  ) values (
    p_task_id,
    v_actor,
    'task_completed',
    v_notes,
    jsonb_build_object(
      'from', 'in_progress',
      'to', 'completed',
      'notification_event', 'task_completed'
    ),
    v_operation_id,
    v_fingerprint
  ) returning * into v_activity;

  perform public.create_committee_task_notifications(
    v_task.id,
    v_activity.id,
    'task_completed',
    public.committee_task_event_recipient_ids(v_task.id),
    'Task completed',
    format('"%s" was completed.', v_task.title),
    '/work/' || v_task.id::text,
    jsonb_build_object('task_status', v_task.status)
  );

  return v_task;
end;
$$;

create or replace function public.update_committee_task(
  p_task_id uuid,
  p_title text,
  p_description text,
  p_priority text,
  p_due_date date,
  p_assignee_ids uuid[],
  p_operation_id text
)
returns public.committee_tasks
language plpgsql
security definer
set search_path = pg_catalog, extensions
as $$
declare
  v_actor uuid := public.current_application_user_id();
  v_title text := btrim(p_title);
  v_description text := nullif(btrim(p_description), '');
  v_priority text := lower(btrim(p_priority));
  v_operation_id text := nullif(btrim(p_operation_id), '');
  v_assignee_ids uuid[];
  v_old_assignee_ids uuid[];
  v_added_assignee_ids uuid[];
  v_removed_assignee_ids uuid[];
  v_existing_assignee_ids uuid[];
  v_existing_active_assignee_ids uuid[];
  v_details_changed boolean;
  v_fingerprint text;
  v_existing public.committee_task_activity;
  v_activity public.committee_task_activity;
  v_task public.committee_tasks;
begin
  if v_actor is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if not public.has_application_permission('committee.tasks.assign')
     or not public.has_application_permission('committee.tasks.manage') then
    raise exception 'missing_permission' using errcode = '42501';
  end if;
  if v_title is null or length(v_title) > 200 then
    raise exception 'invalid_title' using errcode = '22023';
  end if;
  if v_description is not null and length(v_description) > 5000 then
    raise exception 'invalid_description' using errcode = '22023';
  end if;
  if v_priority is null or v_priority not in ('low', 'normal', 'high') then
    raise exception 'invalid_priority' using errcode = '22023';
  end if;
  if v_operation_id is null or length(v_operation_id) > 200 then
    raise exception 'invalid_operation_id' using errcode = '22023';
  end if;

  select coalesce(array_agg(distinct x order by x), '{}'::uuid[])
  into v_assignee_ids
  from unnest(coalesce(p_assignee_ids, '{}'::uuid[])) x;
  if cardinality(v_assignee_ids) = 0 then
    raise exception 'assignee_required' using errcode = '22023';
  end if;

  v_fingerprint := pg_catalog.encode(extensions.digest(pg_catalog.jsonb_build_object(
    'operation', 'task_update',
    'task_id', p_task_id,
    'title', v_title,
    'description', v_description,
    'priority', v_priority,
    'due_date', p_due_date,
    'assignee_ids', to_jsonb(v_assignee_ids)
  )::text, 'sha256'), 'hex');

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_actor::text || ':' || v_operation_id, 0)
  );

  select * into v_existing
  from public.committee_task_activity
  where actor_application_user_id = v_actor
    and operation_id = v_operation_id;

  if found then
    if v_existing.activity_type <> 'task_updated'
       or v_existing.task_id <> p_task_id
       or v_existing.request_fingerprint <> v_fingerprint then
      raise exception 'operation_id_conflict' using errcode = '23505';
    end if;
    select * into v_task from public.committee_tasks where id = p_task_id;
    return v_task;
  end if;

  if exists (
    select 1
    from unnest(v_assignee_ids) requested(id)
    where not exists (
      select 1
      from public.application_users au
      join public.application_user_roles aur
        on aur.application_user_id = au.id
      join public.role_permissions rp on rp.role_id = aur.role_id
      join public.permissions p on p.id = rp.permission_id
      where au.id = requested.id
        and au.status = 'active'
        and p.key in ('committee.tasks.read', 'committee.tasks.manage')
      group by au.id
      having count(distinct p.key) = 2
    )
  ) then
    raise exception 'invalid_assignee' using errcode = '22023';
  end if;

  select * into v_task
  from public.committee_tasks
  where id = p_task_id
  for update;
  if not found then
    raise exception 'task_not_found' using errcode = 'P0002';
  end if;
  if v_task.status = 'completed' then
    raise exception 'completed_task_immutable' using errcode = '22023';
  end if;

  v_details_changed :=
    v_task.title is distinct from v_title
    or v_task.description is distinct from v_description
    or v_task.priority is distinct from v_priority
    or v_task.due_date is distinct from p_due_date;

  select coalesce(array_agg(application_user_id order by application_user_id), '{}'::uuid[])
  into v_old_assignee_ids
  from public.committee_task_assignees
  where task_id = p_task_id
    and removed_at is null;

  select coalesce(array_agg(id order by id), '{}'::uuid[])
  into v_added_assignee_ids
  from unnest(v_assignee_ids) requested(id)
  where not (id = any(v_old_assignee_ids));

  select coalesce(array_agg(id order by id), '{}'::uuid[])
  into v_removed_assignee_ids
  from unnest(v_old_assignee_ids) previous(id)
  where not (id = any(v_assignee_ids));

  select coalesce(array_agg(id order by id), '{}'::uuid[])
  into v_existing_assignee_ids
  from unnest(v_assignee_ids) requested(id)
  where id = any(v_old_assignee_ids);

  select coalesce(array_agg(existing.id order by existing.id), '{}'::uuid[])
  into v_existing_active_assignee_ids
  from unnest(v_existing_assignee_ids) existing(id)
  join public.application_users au on au.id = existing.id
  where au.status = 'active';

  update public.committee_task_assignees
  set removed_at = now(), removed_by_application_user_id = v_actor
  where task_id = p_task_id
    and removed_at is null
    and not (application_user_id = any(v_assignee_ids));

  insert into public.committee_task_assignees (
    task_id, application_user_id, assigned_by_application_user_id
  )
  select p_task_id, requested.id, v_actor
  from unnest(v_assignee_ids) requested(id)
  where not exists (
    select 1
    from public.committee_task_assignees existing
    where existing.task_id = p_task_id
      and existing.application_user_id = requested.id
      and existing.removed_at is null
  );

  update public.committee_tasks
  set title = v_title,
      description = v_description,
      priority = v_priority,
      due_date = p_due_date
  where id = p_task_id
  returning * into v_task;

  insert into public.committee_task_activity (
    task_id, actor_application_user_id, activity_type, details,
    operation_id, request_fingerprint
  ) values (
    p_task_id,
    v_actor,
    'task_updated',
    jsonb_build_object(
      'previous_assignee_ids', to_jsonb(v_old_assignee_ids),
      'assignee_ids', to_jsonb(v_assignee_ids),
      'added_assignee_ids', to_jsonb(v_added_assignee_ids),
      'removed_assignee_ids', to_jsonb(v_removed_assignee_ids),
      'priority', v_priority,
      'due_date', p_due_date,
      'notification_events',
      (case
        when v_details_changed then jsonb_build_array('task_updated')
        else '[]'::jsonb
      end)
      ||
      (case
        when cardinality(v_added_assignee_ids) > 0
          then jsonb_build_array('task_assigned')
        else '[]'::jsonb
      end)
      ||
      (case
        when cardinality(v_removed_assignee_ids) > 0
          then jsonb_build_array('task_unassigned')
        else '[]'::jsonb
      end)
    ),
    v_operation_id,
    v_fingerprint
  ) returning * into v_activity;

  perform public.create_committee_task_notifications(
    v_task.id,
    v_activity.id,
    'task_assigned',
    v_added_assignee_ids,
    'New task assigned',
    format('You were assigned to "%s".', v_task.title),
    '/work/' || v_task.id::text,
    jsonb_build_object('task_status', v_task.status)
  );

  perform public.create_committee_task_notifications(
    v_task.id,
    v_activity.id,
    'task_unassigned',
    v_removed_assignee_ids,
    'Task assignment removed',
    format('You were removed from "%s".', v_task.title),
    '/work',
    jsonb_build_object('task_status', v_task.status)
  );

  if v_details_changed then
    perform public.create_committee_task_notifications(
      v_task.id,
      v_activity.id,
      'task_updated',
      v_existing_active_assignee_ids,
      'Task details updated',
      format('Task details changed for "%s".', v_task.title),
      '/work/' || v_task.id::text,
      jsonb_build_object('task_status', v_task.status)
    );
  end if;

  return v_task;
end;
$$;

create or replace function public.add_committee_task_progress(
  p_task_id uuid,
  p_remark text,
  p_operation_id text
)
returns public.committee_task_activity
language plpgsql
security definer
set search_path = pg_catalog, extensions
as $$
declare
  v_actor uuid;
  v_remark text := nullif(btrim(p_remark), '');
  v_operation_id text := nullif(btrim(p_operation_id), '');
  v_fingerprint text;
  v_existing public.committee_task_activity;
  v_activity public.committee_task_activity;
  v_task public.committee_tasks;
begin
  v_actor := public.current_application_user_id();
  if v_actor is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if not public.has_application_permission('committee.tasks.manage') then
    raise exception 'missing_permission' using errcode = '42501';
  end if;
  if v_remark is null or length(v_remark) > 5000 then
    raise exception 'invalid_remark' using errcode = '22023';
  end if;
  if v_operation_id is null or length(v_operation_id) > 200 then
    raise exception 'invalid_operation_id' using errcode = '22023';
  end if;

  v_fingerprint := pg_catalog.encode(extensions.digest(pg_catalog.jsonb_build_object(
    'operation', 'progress_add', 'task_id', p_task_id, 'remark', v_remark
  )::text, 'sha256'), 'hex');
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_actor::text || ':' || v_operation_id, 0)
  );

  select * into v_existing
  from public.committee_task_activity
  where actor_application_user_id = v_actor
    and operation_id = v_operation_id;
  if found then
    if v_existing.activity_type <> 'progress_added'
       or v_existing.task_id <> p_task_id
       or v_existing.request_fingerprint <> v_fingerprint then
      raise exception 'operation_id_conflict' using errcode = '23505';
    end if;
    return v_existing;
  end if;

  select * into v_task
  from public.committee_tasks
  where id = p_task_id
  for update;
  if not found then
    raise exception 'task_not_found' using errcode = 'P0002';
  end if;

  if not public.has_application_permission('committee.tasks.assign') and not exists (
    select 1
    from public.committee_task_assignees
    where task_id = p_task_id
      and application_user_id = v_actor
      and removed_at is null
  ) then
    raise exception 'not_assigned' using errcode = '42501';
  end if;

  if v_task.status = 'completed' then
    raise exception 'completed_task_immutable' using errcode = '22023';
  end if;

  insert into public.committee_task_activity (
    task_id, actor_application_user_id, activity_type, remark, details,
    operation_id, request_fingerprint
  ) values (
    p_task_id,
    v_actor,
    'progress_added',
    v_remark,
    jsonb_build_object('notification_event', 'task_progress'),
    v_operation_id,
    v_fingerprint
  ) returning * into v_activity;

  perform public.create_committee_task_notifications(
    v_task.id,
    v_activity.id,
    'task_progress',
    public.committee_task_event_recipient_ids(v_task.id),
    'New task progress',
    format('Progress was added to "%s".', v_task.title),
    '/work/' || v_task.id::text,
    jsonb_build_object('task_status', v_task.status)
  );

  return v_activity;
end;
$$;

create or replace function public.list_my_notifications(
  p_limit integer default 50,
  p_offset integer default 0,
  p_unread_only boolean default false
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
     or p_offset is null or p_offset < 0
     or p_unread_only is null then
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
    and (not p_unread_only or n.read_at is null)
  order by n.created_at desc, n.id desc
  limit p_limit offset p_offset;
end;
$$;

create or replace function public.get_my_unread_notification_count()
returns bigint
language plpgsql
stable
security definer
set search_path = pg_catalog, extensions
as $$
declare
  v_recipient uuid := public.current_application_user_id();
  v_count bigint;
begin
  if v_recipient is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  select count(*) into v_count
  from public.notifications n
  where n.recipient_application_user_id = v_recipient
    and n.read_at is null;
  return v_count;
end;
$$;

create or replace function public.mark_my_notification_read(
  p_notification_id uuid
)
returns timestamptz
language plpgsql
security definer
set search_path = pg_catalog, extensions
as $$
declare
  v_recipient uuid := public.current_application_user_id();
  v_read_at timestamptz;
begin
  if v_recipient is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if p_notification_id is null then
    raise exception 'invalid_notification_id' using errcode = '22023';
  end if;

  update public.notifications n
  set read_at = coalesce(n.read_at, now())
  where n.id = p_notification_id
    and n.recipient_application_user_id = v_recipient
  returning n.read_at into v_read_at;

  if v_read_at is null then
    raise exception 'notification_not_found' using errcode = 'P0002';
  end if;
  return v_read_at;
end;
$$;

create or replace function public.mark_all_my_notifications_read()
returns integer
language plpgsql
security definer
set search_path = pg_catalog, extensions
as $$
declare
  v_recipient uuid := public.current_application_user_id();
  v_updated integer;
begin
  if v_recipient is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  update public.notifications n
  set read_at = now()
  where n.recipient_application_user_id = v_recipient
    and n.read_at is null;
  get diagnostics v_updated = row_count;
  return v_updated;
end;
$$;

revoke execute on function public.list_my_notifications(integer, integer, boolean)
from public, anon;
revoke execute on function public.get_my_unread_notification_count()
from public, anon;
revoke execute on function public.mark_my_notification_read(uuid)
from public, anon;
revoke execute on function public.mark_all_my_notifications_read()
from public, anon;

grant execute on function public.list_my_notifications(integer, integer, boolean)
to authenticated;
grant execute on function public.get_my_unread_notification_count()
to authenticated;
grant execute on function public.mark_my_notification_read(uuid)
to authenticated;
grant execute on function public.mark_all_my_notifications_read()
to authenticated;

create or replace function public.create_committee_task(
  p_title text,
  p_description text,
  p_priority text,
  p_due_date date,
  p_assignee_ids uuid[],
  p_operation_id text
)
returns public.committee_tasks
language plpgsql
security definer
set search_path = pg_catalog, extensions
as $$
declare
  v_actor uuid := public.current_application_user_id();
  v_title text := btrim(p_title);
  v_description text := nullif(btrim(p_description), '');
  v_priority text := lower(btrim(p_priority));
  v_operation_id text := nullif(btrim(p_operation_id), '');
  v_assignee_ids uuid[];
  v_fingerprint text;
  v_existing public.committee_task_activity;
  v_activity public.committee_task_activity;
  v_task public.committee_tasks;
begin
  if v_actor is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if not public.has_application_permission('committee.tasks.assign') then
    raise exception 'missing_permission' using errcode = '42501';
  end if;
  if v_title is null or length(v_title) > 200 then
    raise exception 'invalid_title' using errcode = '22023';
  end if;
  if v_description is not null and length(v_description) > 5000 then
    raise exception 'invalid_description' using errcode = '22023';
  end if;
  if v_priority is null or v_priority not in ('low', 'normal', 'high') then
    raise exception 'invalid_priority' using errcode = '22023';
  end if;
  if v_operation_id is null or length(v_operation_id) > 200 then
    raise exception 'invalid_operation_id' using errcode = '22023';
  end if;

  select coalesce(array_agg(distinct x order by x), '{}'::uuid[])
  into v_assignee_ids
  from unnest(coalesce(p_assignee_ids, '{}'::uuid[])) x;

  if cardinality(v_assignee_ids) = 0 then
    raise exception 'assignee_required' using errcode = '22023';
  end if;

  v_fingerprint := pg_catalog.encode(extensions.digest(pg_catalog.jsonb_build_object(
    'operation', 'task_create',
    'title', v_title,
    'description', v_description,
    'priority', v_priority,
    'due_date', p_due_date,
    'assignee_ids', to_jsonb(v_assignee_ids)
  )::text, 'sha256'), 'hex');

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_actor::text || ':' || v_operation_id, 0)
  );

  select * into v_existing
  from public.committee_task_activity
  where actor_application_user_id = v_actor
    and operation_id = v_operation_id;

  if found then
    if v_existing.activity_type <> 'task_created'
       or v_existing.request_fingerprint <> v_fingerprint then
      raise exception 'operation_id_conflict' using errcode = '23505';
    end if;
    select * into v_task
    from public.committee_tasks
    where id = v_existing.task_id;
    return v_task;
  end if;

  if exists (
    select 1
    from unnest(v_assignee_ids) requested(id)
    where not exists (
      select 1
      from public.application_users au
      join public.application_user_roles aur
        on aur.application_user_id = au.id
      join public.role_permissions rp
        on rp.role_id = aur.role_id
      join public.permissions p on p.id = rp.permission_id
      where au.id = requested.id
        and au.status = 'active'
        and p.key in ('committee.tasks.read', 'committee.tasks.manage')
      group by au.id
      having count(distinct p.key) = 2
    )
  ) then
    raise exception 'invalid_assignee' using errcode = '22023';
  end if;

  insert into public.committee_tasks (
    title, description, priority, due_date, created_by_application_user_id
  ) values (
    v_title, v_description, v_priority, p_due_date, v_actor
  ) returning * into v_task;

  insert into public.committee_task_assignees (
    task_id, application_user_id, assigned_by_application_user_id
  )
  select v_task.id, id, v_actor from unnest(v_assignee_ids) id;

  insert into public.committee_task_activity (
    task_id, actor_application_user_id, activity_type, details,
    operation_id, request_fingerprint
  ) values (
    v_task.id, v_actor, 'task_created',
    jsonb_build_object(
      'status', 'assigned',
      'priority', v_priority,
      'due_date', p_due_date,
      'assignee_ids', to_jsonb(v_assignee_ids),
      'notification_event', 'task_assigned'
    ),
    v_operation_id, v_fingerprint
  ) returning * into v_activity;

  perform public.create_committee_task_notifications(
    v_task.id,
    v_activity.id,
    'task_assigned',
    v_assignee_ids,
    'New task assigned',
    format('You were assigned to "%s".', v_task.title),
    '/work/' || v_task.id::text,
    jsonb_build_object('task_status', v_task.status)
  );

  return v_task;
end;
$$;

revoke execute on function public.create_committee_task(
  text, text, text, date, uuid[], text
) from public, anon;
revoke execute on function public.update_committee_task(
  uuid, text, text, text, date, uuid[], text
) from public, anon;
revoke execute on function public.add_committee_task_progress(uuid, text, text)
from public, anon;
revoke execute on function public.start_committee_task(uuid, text)
from public, anon;
revoke execute on function public.complete_committee_task(uuid, text, text)
from public, anon;

grant execute on function public.create_committee_task(
  text, text, text, date, uuid[], text
) to authenticated;
grant execute on function public.update_committee_task(
  uuid, text, text, text, date, uuid[], text
) to authenticated;
grant execute on function public.add_committee_task_progress(uuid, text, text)
to authenticated;
grant execute on function public.start_committee_task(uuid, text)
to authenticated;
grant execute on function public.complete_committee_task(uuid, text, text)
to authenticated;

commit;
