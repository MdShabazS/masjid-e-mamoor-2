-- Masjid-e-Mamoor
-- Phase 10 closure: open/volunteer Committee Tasks + atomic single claimant.

begin;


-- ============================================================
-- 1. Preserve task origin and add the open lifecycle state
-- ============================================================

alter table public.committee_tasks
  add column assignment_mode text not null default 'direct';

alter table public.committee_tasks
  add constraint committee_tasks_assignment_mode_chk
  check (assignment_mode in ('direct', 'open'));

alter table public.committee_tasks
  drop constraint committee_tasks_status_chk;

alter table public.committee_tasks
  add constraint committee_tasks_status_chk
  check (status in ('open', 'assigned', 'in_progress', 'completed'));

alter table public.committee_tasks
  add constraint committee_tasks_assignment_mode_state_chk
  check (
    (
      assignment_mode = 'direct'
      and status in ('assigned', 'in_progress', 'completed')
    )
    or
    (
      assignment_mode = 'open'
      and status in ('open', 'assigned', 'in_progress', 'completed')
    )
  );

create index committee_tasks_assignment_mode_status_due_idx
  on public.committee_tasks(
    assignment_mode,
    status,
    due_date
  );


-- ============================================================
-- 2. Prevent bypassing the open-task claim workflow
--
-- Direct table mutation is already unavailable to authenticated
-- clients, but this also protects trusted task-management RPCs.
-- ============================================================

create or replace function public.enforce_open_task_single_assignee()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, extensions
as $$
declare
  v_assignment_mode text;
  v_status text;
begin
  if new.removed_at is not null then
    return new;
  end if;

  select
    ct.assignment_mode,
    ct.status
  into
    v_assignment_mode,
    v_status
  from public.committee_tasks ct
  where ct.id = new.task_id;

  if not found then
    raise exception 'task_not_found'
      using errcode = 'P0002';
  end if;

  if v_assignment_mode <> 'open' then
    return new;
  end if;

  -- An open task must move to assigned through claim before an
  -- active assignee relationship may exist.
  if v_status = 'open' then
    raise exception 'open_task_requires_claim'
      using errcode = '55000';
  end if;

  -- An originally-open task always keeps at most one active
  -- assignee. Reassignment may replace that assignee, but cannot
  -- produce multiple active claimants.
  if exists (
    select 1
    from public.committee_task_assignees cta
    where cta.task_id = new.task_id
      and cta.removed_at is null
      and cta.id <> new.id
  ) then
    raise exception 'open_task_single_assignee'
      using errcode = '23505';
  end if;

  return new;
end;
$$;

revoke execute
on function public.enforce_open_task_single_assignee()
from public, anon, authenticated, service_role;

create trigger committee_task_open_single_assignee_trg
before insert or update
on public.committee_task_assignees
for each row
execute function public.enforce_open_task_single_assignee();


-- ============================================================
-- 3. Expand Committee Task read scope for eligible OPEN tasks
--
-- Existing behavior remains:
-- - assign-capable users see organization-wide tasks;
-- - assigned users see their assigned tasks.
--
-- New behavior:
-- - active Auditor and Committee Member may read an unclaimed
--   OPEN task while it remains open.
-- - Finance does not gain organization-wide open-task access.
-- ============================================================

create or replace function public.can_read_committee_task(
  p_task_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, extensions
as $$
  select
    public.has_application_permission(
      'committee.tasks.read'
    )
    and (
      public.has_application_permission(
        'committee.tasks.assign'
      )

      or exists (
        select 1
        from public.committee_task_assignees cta
        where cta.task_id = p_task_id
          and cta.application_user_id =
            public.current_application_user_id()
          and cta.removed_at is null
      )

      or exists (
        select 1
        from public.committee_tasks ct
        join public.application_users au
          on au.id =
            public.current_application_user_id()
        join public.application_user_roles aur
          on aur.application_user_id = au.id
        join public.roles r
          on r.id = aur.role_id
        where ct.id = p_task_id
          and ct.assignment_mode = 'open'
          and ct.status = 'open'
          and au.status = 'active'
          and r.key in (
            'auditor',
            'committee_member'
          )
      )
    );
$$;

revoke execute
on function public.can_read_committee_task(uuid)
from public, anon, service_role;

grant execute
on function public.can_read_committee_task(uuid)
to authenticated;


-- ============================================================
-- 4. Create an open / volunteer task
-- ============================================================

create or replace function public.create_open_committee_task(
  p_title text,
  p_description text,
  p_priority text,
  p_due_date date,
  p_operation_id text
)
returns public.committee_tasks
language plpgsql
security definer
set search_path = pg_catalog, extensions
as $$
declare
  v_actor uuid :=
    public.current_application_user_id();

  v_title text :=
    btrim(p_title);

  v_description text :=
    nullif(btrim(p_description), '');

  v_priority text :=
    lower(btrim(p_priority));

  v_operation_id text :=
    nullif(btrim(p_operation_id), '');

  v_fingerprint text;

  v_existing public.committee_task_activity;

  v_task public.committee_tasks;
begin
  if v_actor is null then
    raise exception 'not_authenticated'
      using errcode = '42501';
  end if;

  if not public.has_application_permission(
    'committee.tasks.assign'
  ) then
    raise exception 'missing_permission'
      using errcode = '42501';
  end if;

  if v_title is null
     or length(v_title) > 200 then
    raise exception 'invalid_title'
      using errcode = '22023';
  end if;

  if v_description is not null
     and length(v_description) > 5000 then
    raise exception 'invalid_description'
      using errcode = '22023';
  end if;

  if v_priority is null
     or v_priority not in (
       'low',
       'normal',
       'high'
     ) then
    raise exception 'invalid_priority'
      using errcode = '22023';
  end if;

  if v_operation_id is null
     or length(v_operation_id) > 200 then
    raise exception 'invalid_operation_id'
      using errcode = '22023';
  end if;

  v_fingerprint :=
    pg_catalog.encode(
      extensions.digest(
        pg_catalog.jsonb_build_object(
          'operation',
          'task_create_open',
          'title',
          v_title,
          'description',
          v_description,
          'priority',
          v_priority,
          'due_date',
          p_due_date
        )::text,
        'sha256'
      ),
      'hex'
    );

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      v_actor::text
      || ':'
      || v_operation_id,
      0
    )
  );

  select *
  into v_existing
  from public.committee_task_activity
  where actor_application_user_id =
        v_actor
    and operation_id =
        v_operation_id;

  if found then
    if v_existing.activity_type <>
         'task_created'
       or v_existing.request_fingerprint <>
         v_fingerprint then
      raise exception 'operation_id_conflict'
        using errcode = '23505';
    end if;

    select *
    into v_task
    from public.committee_tasks
    where id = v_existing.task_id;

    return v_task;
  end if;

  insert into public.committee_tasks (
    title,
    description,
    priority,
    status,
    assignment_mode,
    due_date,
    created_by_application_user_id
  )
  values (
    v_title,
    v_description,
    v_priority,
    'open',
    'open',
    p_due_date,
    v_actor
  )
  returning *
  into v_task;

  insert into public.committee_task_activity (
    task_id,
    actor_application_user_id,
    activity_type,
    details,
    operation_id,
    request_fingerprint
  )
  values (
    v_task.id,
    v_actor,
    'task_created',
    pg_catalog.jsonb_build_object(
      'status',
      'open',
      'assignment_mode',
      'open',
      'priority',
      v_priority,
      'due_date',
      p_due_date,
      'assignee_ids',
      '[]'::jsonb
    ),
    v_operation_id,
    v_fingerprint
  );

  return v_task;
end;
$$;


-- ============================================================
-- 5. Atomically claim an open / volunteer task
-- ============================================================

create or replace function public.claim_open_committee_task(
  p_task_id uuid,
  p_operation_id text
)
returns public.committee_tasks
language plpgsql
security definer
set search_path = pg_catalog, extensions
as $$
declare
  v_actor uuid :=
    public.current_application_user_id();

  v_operation_id text :=
    nullif(btrim(p_operation_id), '');

  v_fingerprint text;

  v_existing public.committee_task_activity;

  v_task public.committee_tasks;
begin
  if v_actor is null then
    raise exception 'not_authenticated'
      using errcode = '42501';
  end if;

  if v_operation_id is null
     or length(v_operation_id) > 200 then
    raise exception 'invalid_operation_id'
      using errcode = '22023';
  end if;

  -- V1 volunteer claiming is specifically a Committee Member
  -- self-service workflow.
  if not exists (
    select 1
    from public.application_users au
    join public.application_user_roles aur
      on aur.application_user_id = au.id
    join public.roles r
      on r.id = aur.role_id
    where au.id = v_actor
      and au.status = 'active'
      and r.key = 'committee_member'
  ) then
    raise exception 'claim_not_allowed'
      using errcode = '42501';
  end if;

  if not public.has_application_permission(
       'committee.tasks.read'
     )
     or not public.has_application_permission(
       'committee.tasks.manage'
     ) then
    raise exception 'missing_permission'
      using errcode = '42501';
  end if;

  v_fingerprint :=
    pg_catalog.encode(
      extensions.digest(
        pg_catalog.jsonb_build_object(
          'operation',
          'task_claim_open',
          'task_id',
          p_task_id
        )::text,
        'sha256'
      ),
      'hex'
    );

  -- Preserve the established actor/operation serialization
  -- before touching authoritative task state.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      v_actor::text
      || ':'
      || v_operation_id,
      0
    )
  );

  select *
  into v_existing
  from public.committee_task_activity
  where actor_application_user_id =
        v_actor
    and operation_id =
        v_operation_id;

  if found then
    if v_existing.activity_type <>
         'status_changed'
       or v_existing.task_id <>
         p_task_id
       or v_existing.request_fingerprint <>
         v_fingerprint then
      raise exception 'operation_id_conflict'
        using errcode = '23505';
    end if;

    select *
    into v_task
    from public.committee_tasks
    where id = p_task_id;

    return v_task;
  end if;

  -- This row lock is the single-claimant serialization point.
  -- Competing actors have different operation locks, so they
  -- converge here on one authoritative task row.
  select *
  into v_task
  from public.committee_tasks
  where id = p_task_id
  for update;

  if not found then
    raise exception 'task_not_found'
      using errcode = 'P0002';
  end if;

  if v_task.assignment_mode <> 'open' then
    raise exception 'task_not_open'
      using errcode = '22023';
  end if;

  if v_task.status <> 'open' then
    raise exception 'task_already_claimed'
      using errcode = '23505';
  end if;

  -- Change state first. The assignee integrity trigger then
  -- permits exactly one active assignee for the claimed task.
  update public.committee_tasks
  set status = 'assigned'
  where id = p_task_id
  returning *
  into v_task;

  insert into public.committee_task_assignees (
    task_id,
    application_user_id,
    assigned_by_application_user_id
  )
  values (
    p_task_id,
    v_actor,
    v_actor
  );

  insert into public.committee_task_activity (
    task_id,
    actor_application_user_id,
    activity_type,
    details,
    operation_id,
    request_fingerprint
  )
  values (
    p_task_id,
    v_actor,
    'status_changed',
    pg_catalog.jsonb_build_object(
      'from',
      'open',
      'to',
      'assigned',
      'assignment_mode',
      'open',
      'claimed_by_application_user_id',
      v_actor,
      'notification_event',
      'task_assigned'
    ),
    v_operation_id,
    v_fingerprint
  );

  return v_task;
end;
$$;



-- ============================================================
-- OPEN_TASK_LIST_SCOPE_V1
-- 5.5. Committee Task list uses the same authoritative
--      read-scope helper as direct RLS/detail reads.
-- ============================================================

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
stable
security definer
set search_path = pg_catalog, extensions
as $$
begin
  if public.current_application_user_id() is null then
    raise exception 'not_authenticated'
      using errcode = '42501';
  end if;

  if not public.has_application_permission(
    'committee.tasks.read'
  ) then
    raise exception 'missing_permission'
      using errcode = '42501';
  end if;

  if p_limit is null
     or p_limit < 1
     or p_limit > 100 then
    raise exception 'invalid_limit'
      using errcode = '22023';
  end if;

  if p_offset is null
     or p_offset < 0 then
    raise exception 'invalid_offset'
      using errcode = '22023';
  end if;

  return query
  select
    ct.id,
    ct.title,
    ct.description,
    ct.priority,
    ct.status,
    ct.due_date,
    ct.created_by_application_user_id,
    ct.completed_by_application_user_id,
    ct.completed_at,
    ct.created_at,
    ct.updated_at,
    coalesce(
      (
        select array_agg(
          cta.application_user_id
          order by cta.application_user_id
        )
        from public.committee_task_assignees cta
        where cta.task_id = ct.id
          and cta.removed_at is null
      ),
      '{}'::uuid[]
    ) as assignee_ids
  from public.committee_tasks ct
  where public.can_read_committee_task(ct.id)
  order by
    ct.created_at desc,
    ct.id desc
  limit p_limit
  offset p_offset;
end;
$$;

-- ============================================================
-- 6. RPC exposure
-- ============================================================

revoke execute
on function public.create_open_committee_task(
  text,
  text,
  text,
  date,
  text
)
from public, anon, authenticated, service_role;

revoke execute
on function public.claim_open_committee_task(
  uuid,
  text
)
from public, anon, authenticated, service_role;

grant execute
on function public.create_open_committee_task(
  text,
  text,
  text,
  date,
  text
)
to authenticated;

grant execute
on function public.claim_open_committee_task(
  uuid,
  text
)
to authenticated;


commit;
