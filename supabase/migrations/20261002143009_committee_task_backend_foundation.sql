-- Masjid-e-Mamoor
-- Phase 6A: Committee task backend foundation
--
-- Direct-assignment tasks only. Open/volunteer claiming, attachments, and
-- notification delivery are intentionally deferred.

begin;

create table public.committee_tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  priority text not null default 'normal',
  status text not null default 'assigned',
  due_date date,
  created_by_application_user_id uuid not null
    references public.application_users(id) on delete restrict,
  completed_by_application_user_id uuid
    references public.application_users(id) on delete restrict,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint committee_tasks_title_chk
    check (length(btrim(title)) between 1 and 200),
  constraint committee_tasks_description_chk
    check (description is null or length(description) <= 5000),
  constraint committee_tasks_priority_chk
    check (priority in ('low', 'normal', 'high')),
  constraint committee_tasks_status_chk
    check (status in ('assigned', 'in_progress', 'completed')),
  constraint committee_tasks_completion_chk
    check (
      (status = 'completed'
       and completed_by_application_user_id is not null
       and completed_at is not null)
      or
      (status <> 'completed'
       and completed_by_application_user_id is null
       and completed_at is null)
    )
);

create index committee_tasks_status_due_idx
  on public.committee_tasks(status, due_date);

create index committee_tasks_created_by_idx
  on public.committee_tasks(created_by_application_user_id, created_at desc);

create trigger committee_tasks_set_updated_at
before update on public.committee_tasks
for each row execute function public.set_updated_at();

create table public.committee_task_assignees (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null
    references public.committee_tasks(id) on delete restrict,
  application_user_id uuid not null
    references public.application_users(id) on delete restrict,
  assigned_by_application_user_id uuid not null
    references public.application_users(id) on delete restrict,
  assigned_at timestamptz not null default now(),
  removed_by_application_user_id uuid
    references public.application_users(id) on delete restrict,
  removed_at timestamptz,

  constraint committee_task_assignees_removal_chk
    check (
      (removed_at is null and removed_by_application_user_id is null)
      or
      (removed_at is not null and removed_by_application_user_id is not null)
    )
);

create unique index committee_task_assignees_active_uidx
  on public.committee_task_assignees(task_id, application_user_id)
  where removed_at is null;

create index committee_task_assignees_user_active_idx
  on public.committee_task_assignees(application_user_id, task_id)
  where removed_at is null;

create table public.committee_task_activity (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null
    references public.committee_tasks(id) on delete restrict,
  actor_application_user_id uuid not null
    references public.application_users(id) on delete restrict,
  activity_type text not null,
  remark text,
  details jsonb not null default '{}'::jsonb,
  operation_id text not null,
  request_fingerprint text not null,
  created_at timestamptz not null default now(),

  constraint committee_task_activity_type_chk
    check (
      activity_type in (
        'task_created',
        'task_updated',
        'progress_added',
        'status_changed',
        'task_completed'
      )
    ),
  constraint committee_task_activity_remark_chk
    check (remark is null or length(btrim(remark)) between 1 and 5000),
  constraint committee_task_activity_operation_id_chk
    check (length(btrim(operation_id)) between 1 and 200),
  constraint committee_task_activity_fingerprint_chk
    check (request_fingerprint ~ '^[0-9a-f]{64}$')
);

create index committee_task_activity_task_created_idx
  on public.committee_task_activity(task_id, created_at, id);

create unique index committee_task_activity_actor_operation_uidx
  on public.committee_task_activity(actor_application_user_id, operation_id);

alter table public.committee_tasks enable row level security;
alter table public.committee_task_assignees enable row level security;
alter table public.committee_task_activity enable row level security;

create or replace function public.can_read_committee_task(p_task_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, extensions
as $$
  select
    public.has_application_permission('committee.tasks.read')
    and (
      public.has_application_permission('committee.tasks.assign')
      or exists (
        select 1
        from public.committee_task_assignees cta
        where cta.task_id = p_task_id
          and cta.application_user_id = public.current_application_user_id()
          and cta.removed_at is null
      )
    );
$$;

revoke execute on function public.can_read_committee_task(uuid)
from public, anon;
grant execute on function public.can_read_committee_task(uuid)
to authenticated;

create policy committee_tasks_authorized_read
on public.committee_tasks
for select
to authenticated
using (public.can_read_committee_task(id));

create policy committee_task_assignees_authorized_read
on public.committee_task_assignees
for select
to authenticated
using (public.can_read_committee_task(task_id));

create policy committee_task_activity_authorized_read
on public.committee_task_activity
for select
to authenticated
using (public.can_read_committee_task(task_id));

revoke all privileges on table public.committee_tasks
from public, anon, authenticated;
revoke all privileges on table public.committee_task_assignees
from public, anon, authenticated;
revoke all privileges on table public.committee_task_activity
from public, anon, authenticated;

grant select on table public.committee_tasks to authenticated;
grant select on table public.committee_task_assignees to authenticated;
grant select on table public.committee_task_activity to authenticated;

grant all privileges on table public.committee_tasks to service_role;
grant all privileges on table public.committee_task_assignees to service_role;
grant all privileges on table public.committee_task_activity to service_role;

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
    select * into v_task from public.committee_tasks where id = v_existing.task_id;
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
  );

  return v_task;
end;
$$;

create or replace function public.list_committee_tasks(
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (
  id uuid,
  title text,
  description text,
  priority text,
  status text,
  due_date date,
  created_by_application_user_id uuid,
  completed_by_application_user_id uuid,
  completed_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  assignee_ids uuid[]
)
language plpgsql
security definer
set search_path = pg_catalog, extensions
as $$
begin
  if public.current_application_user_id() is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if not public.has_application_permission('committee.tasks.read') then
    raise exception 'missing_permission' using errcode = '42501';
  end if;
  if p_limit is null or p_limit < 1 or p_limit > 100
     or p_offset is null or p_offset < 0 then
    raise exception 'invalid_pagination' using errcode = '22023';
  end if;

  return query
  select
    ct.id, ct.title, ct.description, ct.priority, ct.status, ct.due_date,
    ct.created_by_application_user_id, ct.completed_by_application_user_id,
    ct.completed_at, ct.created_at, ct.updated_at,
    array_agg(cta.application_user_id order by cta.application_user_id)
  from public.committee_tasks ct
  join public.committee_task_assignees cta
    on cta.task_id = ct.id and cta.removed_at is null
  where public.can_read_committee_task(ct.id)
  group by ct.id
  order by ct.created_at desc, ct.id desc
  limit p_limit offset p_offset;
end;
$$;

create or replace function public.get_committee_task(p_task_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, extensions
as $$
declare v_result jsonb;
begin
  if public.current_application_user_id() is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if not public.can_read_committee_task(p_task_id) then
    raise exception 'task_not_found' using errcode = 'P0002';
  end if;

  select jsonb_build_object(
    'task', to_jsonb(ct),
    'assignees', coalesce((
      select jsonb_agg(to_jsonb(cta) order by cta.assigned_at, cta.id)
      from public.committee_task_assignees cta where cta.task_id = ct.id
    ), '[]'::jsonb),
    'activity', coalesce((
      select jsonb_agg(to_jsonb(a) order by a.created_at, a.id)
      from public.committee_task_activity a where a.task_id = ct.id
    ), '[]'::jsonb)
  ) into v_result
  from public.committee_tasks ct where ct.id = p_task_id;

  if v_result is null then
    raise exception 'task_not_found' using errcode = 'P0002';
  end if;
  return v_result;
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
  v_fingerprint text;
  v_existing public.committee_task_activity;
  v_task public.committee_tasks;
begin
  if v_actor is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  if not public.has_application_permission('committee.tasks.assign')
     or not public.has_application_permission('committee.tasks.manage') then
    raise exception 'missing_permission' using errcode = '42501';
  end if;
  if v_title is null or length(v_title) > 200 then raise exception 'invalid_title' using errcode = '22023'; end if;
  if v_description is not null and length(v_description) > 5000 then raise exception 'invalid_description' using errcode = '22023'; end if;
  if v_priority is null or v_priority not in ('low', 'normal', 'high') then raise exception 'invalid_priority' using errcode = '22023'; end if;
  if v_operation_id is null or length(v_operation_id) > 200 then raise exception 'invalid_operation_id' using errcode = '22023'; end if;

  select coalesce(array_agg(distinct x order by x), '{}'::uuid[])
  into v_assignee_ids from unnest(coalesce(p_assignee_ids, '{}'::uuid[])) x;
  if cardinality(v_assignee_ids) = 0 then raise exception 'assignee_required' using errcode = '22023'; end if;
  v_fingerprint := pg_catalog.encode(extensions.digest(pg_catalog.jsonb_build_object(
    'operation', 'task_update', 'task_id', p_task_id, 'title', v_title,
    'description', v_description, 'priority', v_priority, 'due_date', p_due_date,
    'assignee_ids', to_jsonb(v_assignee_ids)
  )::text, 'sha256'), 'hex');
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_actor::text || ':' || v_operation_id, 0)
  );
  select * into v_existing from public.committee_task_activity
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
    select 1 from unnest(v_assignee_ids) requested(id)
    where not exists (
      select 1
      from public.application_users au
      join public.application_user_roles aur on aur.application_user_id = au.id
      join public.role_permissions rp on rp.role_id = aur.role_id
      join public.permissions p on p.id = rp.permission_id
      where au.id = requested.id
        and au.status = 'active'
        and p.key in ('committee.tasks.read', 'committee.tasks.manage')
      group by au.id
      having count(distinct p.key) = 2
    )
  ) then raise exception 'invalid_assignee' using errcode = '22023'; end if;

  select * into v_task from public.committee_tasks where id = p_task_id for update;
  if not found then raise exception 'task_not_found' using errcode = 'P0002'; end if;
  if v_task.status = 'completed' then raise exception 'completed_task_immutable' using errcode = '22023'; end if;

  select array_agg(application_user_id order by application_user_id)
  into v_old_assignee_ids from public.committee_task_assignees
  where task_id = p_task_id and removed_at is null;

  select coalesce(array_agg(id order by id), '{}'::uuid[])
  into v_added_assignee_ids
  from unnest(v_assignee_ids) requested(id)
  where not (id = any(coalesce(v_old_assignee_ids, '{}'::uuid[])));

  select coalesce(array_agg(id order by id), '{}'::uuid[])
  into v_removed_assignee_ids
  from unnest(coalesce(v_old_assignee_ids, '{}'::uuid[])) previous(id)
  where not (id = any(v_assignee_ids));

  update public.committee_task_assignees
  set removed_at = now(), removed_by_application_user_id = v_actor
  where task_id = p_task_id and removed_at is null
    and not (application_user_id = any(v_assignee_ids));

  insert into public.committee_task_assignees (
    task_id, application_user_id, assigned_by_application_user_id
  )
  select p_task_id, requested.id, v_actor
  from unnest(v_assignee_ids) requested(id)
  where not exists (
    select 1 from public.committee_task_assignees existing
    where existing.task_id = p_task_id
      and existing.application_user_id = requested.id
      and existing.removed_at is null
  );

  update public.committee_tasks
  set title = v_title, description = v_description, priority = v_priority,
      due_date = p_due_date
  where id = p_task_id returning * into v_task;

  insert into public.committee_task_activity (
    task_id, actor_application_user_id, activity_type, details,
    operation_id, request_fingerprint
  ) values (
    p_task_id, v_actor, 'task_updated', jsonb_build_object(
      'previous_assignee_ids', to_jsonb(coalesce(v_old_assignee_ids, '{}'::uuid[])),
      'assignee_ids', to_jsonb(v_assignee_ids),
      'added_assignee_ids', to_jsonb(v_added_assignee_ids),
      'removed_assignee_ids', to_jsonb(v_removed_assignee_ids),
      'priority', v_priority, 'due_date', p_due_date,
      'notification_events', case
        when cardinality(v_added_assignee_ids) > 0
          then jsonb_build_array('task_updated', 'task_assigned')
        else jsonb_build_array('task_updated')
      end
    ), v_operation_id, v_fingerprint
  );
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
  v_status text;
begin
  v_actor := public.current_application_user_id();
  if v_actor is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  if not public.has_application_permission('committee.tasks.manage') then raise exception 'missing_permission' using errcode = '42501'; end if;
  if v_remark is null or length(v_remark) > 5000 then raise exception 'invalid_remark' using errcode = '22023'; end if;
  if v_operation_id is null or length(v_operation_id) > 200 then raise exception 'invalid_operation_id' using errcode = '22023'; end if;

  v_fingerprint := pg_catalog.encode(extensions.digest(pg_catalog.jsonb_build_object(
    'operation', 'progress_add', 'task_id', p_task_id, 'remark', v_remark
  )::text, 'sha256'), 'hex');
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_actor::text || ':' || v_operation_id, 0)
  );
  select * into v_existing from public.committee_task_activity
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

  select status into v_status
  from public.committee_tasks
  where id = p_task_id
  for update;
  if not found then raise exception 'task_not_found' using errcode = 'P0002'; end if;

  if not public.has_application_permission('committee.tasks.assign') and not exists (
    select 1 from public.committee_task_assignees
    where task_id = p_task_id and application_user_id = v_actor and removed_at is null
  ) then raise exception 'not_assigned' using errcode = '42501'; end if;

  if v_status = 'completed' then raise exception 'completed_task_immutable' using errcode = '22023'; end if;

  insert into public.committee_task_activity (
    task_id, actor_application_user_id, activity_type, remark, details,
    operation_id, request_fingerprint
  ) values (
    p_task_id, v_actor, 'progress_added', v_remark,
    jsonb_build_object('notification_event', 'task_updated'),
    v_operation_id, v_fingerprint
  ) returning * into v_activity;
  return v_activity;
end;
$$;

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
  v_task public.committee_tasks;
begin
  v_actor := public.current_application_user_id();
  if v_actor is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  if not public.has_application_permission('committee.tasks.manage') then raise exception 'missing_permission' using errcode = '42501'; end if;
  if v_operation_id is null or length(v_operation_id) > 200 then raise exception 'invalid_operation_id' using errcode = '22023'; end if;
  v_fingerprint := pg_catalog.encode(extensions.digest(pg_catalog.jsonb_build_object(
    'operation', 'task_start', 'task_id', p_task_id
  )::text, 'sha256'), 'hex');
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_actor::text || ':' || v_operation_id, 0)
  );
  select * into v_existing from public.committee_task_activity
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
  if not found then raise exception 'task_not_found' using errcode = 'P0002'; end if;

  if not public.has_application_permission('committee.tasks.assign') and not exists (
    select 1 from public.committee_task_assignees
    where task_id = p_task_id and application_user_id = v_actor and removed_at is null
  ) then raise exception 'not_assigned' using errcode = '42501'; end if;

  if v_task.status <> 'assigned' then raise exception 'invalid_status_transition' using errcode = '22023'; end if;
  update public.committee_tasks set status = 'in_progress'
  where id = p_task_id returning * into v_task;
  insert into public.committee_task_activity (
    task_id, actor_application_user_id, activity_type, details,
    operation_id, request_fingerprint
  ) values (
    p_task_id, v_actor, 'status_changed',
    jsonb_build_object('from', 'assigned', 'to', 'in_progress', 'notification_event', 'task_updated'),
    v_operation_id, v_fingerprint
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
  v_task public.committee_tasks;
begin
  v_actor := public.current_application_user_id();
  if v_actor is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  if not public.has_application_permission('committee.tasks.manage') then raise exception 'missing_permission' using errcode = '42501'; end if;
  if v_notes is not null and length(v_notes) > 5000 then raise exception 'invalid_completion_notes' using errcode = '22023'; end if;
  if v_operation_id is null or length(v_operation_id) > 200 then raise exception 'invalid_operation_id' using errcode = '22023'; end if;
  v_fingerprint := pg_catalog.encode(extensions.digest(pg_catalog.jsonb_build_object(
    'operation', 'task_complete', 'task_id', p_task_id, 'completion_notes', v_notes
  )::text, 'sha256'), 'hex');
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_actor::text || ':' || v_operation_id, 0)
  );
  select * into v_existing from public.committee_task_activity
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
  if not found then raise exception 'task_not_found' using errcode = 'P0002'; end if;

  if not public.has_application_permission('committee.tasks.assign') and not exists (
    select 1 from public.committee_task_assignees
    where task_id = p_task_id and application_user_id = v_actor and removed_at is null
  ) then raise exception 'not_assigned' using errcode = '42501'; end if;

  if v_task.status <> 'in_progress' then raise exception 'invalid_status_transition' using errcode = '22023'; end if;
  update public.committee_tasks
  set status = 'completed', completed_by_application_user_id = v_actor,
      completed_at = now()
  where id = p_task_id returning * into v_task;
  insert into public.committee_task_activity (
    task_id, actor_application_user_id, activity_type, remark, details,
    operation_id, request_fingerprint
  ) values (
    p_task_id, v_actor, 'task_completed', v_notes,
    jsonb_build_object('from', 'in_progress', 'to', 'completed', 'notification_event', 'task_completed'),
    v_operation_id, v_fingerprint
  );
  return v_task;
end;
$$;

revoke execute on function public.create_committee_task(text, text, text, date, uuid[], text) from public, anon;
revoke execute on function public.list_committee_tasks(integer, integer) from public, anon;
revoke execute on function public.get_committee_task(uuid) from public, anon;
revoke execute on function public.update_committee_task(uuid, text, text, text, date, uuid[], text) from public, anon;
revoke execute on function public.add_committee_task_progress(uuid, text, text) from public, anon;
revoke execute on function public.start_committee_task(uuid, text) from public, anon;
revoke execute on function public.complete_committee_task(uuid, text, text) from public, anon;

grant execute on function public.create_committee_task(text, text, text, date, uuid[], text) to authenticated;
grant execute on function public.list_committee_tasks(integer, integer) to authenticated;
grant execute on function public.get_committee_task(uuid) to authenticated;
grant execute on function public.update_committee_task(uuid, text, text, text, date, uuid[], text) to authenticated;
grant execute on function public.add_committee_task_progress(uuid, text, text) to authenticated;
grant execute on function public.start_committee_task(uuid, text) to authenticated;
grant execute on function public.complete_committee_task(uuid, text, text) to authenticated;

commit;
