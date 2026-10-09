-- Masjid-e-Mamoor
-- Phase 10 / 11 closure:
-- Committee Meeting follow-up tasks.
--
-- Existing Committee Task remains the authoritative task entity.
--
-- A follow-up task may reference:
--   source_meeting_id          required for follow-up creation
--   source_meeting_decision_id optional
--
-- The decision, when supplied, must belong to the source meeting.
--
-- Existing direct/open creation semantics are preserved by delegating
-- to create_committee_task() / create_open_committee_task().
--
-- Follow-up creation authority remains committee.tasks.assign.
--
-- Linkage is historical and cannot later be silently rewritten.

begin;


-- ============================================================
-- 1. Historical source linkage
-- ============================================================

alter table public.committee_tasks
  add column source_meeting_id uuid
    references public.committee_meetings(id)
    on delete restrict,

  add column source_meeting_decision_id uuid
    references public.committee_meeting_decisions(id)
    on delete restrict;


alter table public.committee_tasks
  add constraint committee_tasks_meeting_decision_source_chk
  check (
    source_meeting_decision_id is null
    or source_meeting_id is not null
  );


create index committee_tasks_source_meeting_idx
  on public.committee_tasks(
    source_meeting_id,
    created_at,
    id
  )
  where source_meeting_id is not null;


create index committee_tasks_source_decision_idx
  on public.committee_tasks(
    source_meeting_decision_id,
    id
  )
  where source_meeting_decision_id is not null;


-- ============================================================
-- 2. Enforce meeting/decision consistency + historical
--    immutability.
-- ============================================================

create or replace function
public.enforce_committee_task_meeting_source()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, extensions
as $$
declare
  v_decision_meeting_id uuid;
begin
  if tg_op = 'UPDATE' then
    if old.source_meeting_id is not null
       and new.source_meeting_id
           is distinct from old.source_meeting_id then

      raise exception 'task_source_meeting_immutable'
        using errcode = '22023';
    end if;

    if old.source_meeting_decision_id is not null
       and new.source_meeting_decision_id
           is distinct from
              old.source_meeting_decision_id then

      raise exception 'task_source_decision_immutable'
        using errcode = '22023';
    end if;
  end if;

  if new.source_meeting_decision_id is not null then
    if new.source_meeting_id is null then
      raise exception 'meeting_source_required'
        using errcode = '23514';
    end if;

    select d.meeting_id
    into v_decision_meeting_id
    from public.committee_meeting_decisions d
    where d.id =
      new.source_meeting_decision_id;

    if not found then
      raise exception 'meeting_decision_not_found'
        using errcode = '23503';
    end if;

    if v_decision_meeting_id
       is distinct from new.source_meeting_id then

      raise exception 'meeting_decision_mismatch'
        using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;


revoke execute
on function public.enforce_committee_task_meeting_source()
from public, anon, authenticated, service_role;


create trigger committee_task_meeting_source_guard_trg
before insert or update of
  source_meeting_id,
  source_meeting_decision_id
on public.committee_tasks
for each row
execute function
  public.enforce_committee_task_meeting_source();


-- ============================================================
-- 3. Direct-assignment meeting follow-up task
-- ============================================================

create or replace function
public.create_committee_meeting_followup_task(
  p_meeting_id uuid,
  p_decision_id uuid,
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
  v_actor uuid :=
    public.current_application_user_id();

  v_operation_id text :=
    nullif(btrim(p_operation_id), '');

  v_internal_operation_id text;

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

  if p_meeting_id is null then
    raise exception 'invalid_meeting_id'
      using errcode = '22023';
  end if;

  if v_operation_id is null
     or length(v_operation_id) > 200 then
    raise exception 'invalid_operation_id'
      using errcode = '22023';
  end if;

  if not public.can_read_committee_meeting(
    p_meeting_id
  ) then
    raise exception 'meeting_not_found'
      using errcode = 'P0002';
  end if;

  if p_decision_id is not null
     and not exists (
       select 1
       from public.committee_meeting_decisions d
       where d.id = p_decision_id
         and d.meeting_id = p_meeting_id
     ) then

    raise exception 'meeting_decision_not_found'
      using errcode = 'P0002';
  end if;

  -- Keep the public operation ID independent from the existing
  -- task-create operation namespace while retaining deterministic
  -- replay/concurrency serialization.
  v_internal_operation_id :=
    'followup:'
    ||
    pg_catalog.encode(
      extensions.digest(
        v_actor::text
        || ':'
        || v_operation_id,
        'sha256'
      ),
      'hex'
    );

  select *
  into v_task
  from public.create_committee_task(
    p_title,
    p_description,
    p_priority,
    p_due_date,
    p_assignee_ids,
    v_internal_operation_id
  );

  -- First invocation attaches the immutable source.
  if v_task.source_meeting_id is null
     and v_task.source_meeting_decision_id is null then

    update public.committee_tasks
    set
      source_meeting_id =
        p_meeting_id,

      source_meeting_decision_id =
        p_decision_id
    where id = v_task.id
    returning *
    into v_task;

    update public.committee_task_activity
    set details =
      details
      ||
      pg_catalog.jsonb_build_object(
        'source_meeting_id',
          p_meeting_id,

        'source_meeting_decision_id',
          p_decision_id,

        'followup_operation_id',
          v_operation_id
      )
    where task_id = v_task.id
      and actor_application_user_id =
        v_actor
      and operation_id =
        v_internal_operation_id
      and activity_type =
        'task_created';

  elsif v_task.source_meeting_id
          is distinct from p_meeting_id

     or v_task.source_meeting_decision_id
          is distinct from p_decision_id then

    raise exception 'operation_id_conflict'
      using errcode = '23505';
  end if;

  return v_task;
end;
$$;


-- ============================================================
-- 4. Open / volunteer meeting follow-up task
-- ============================================================

create or replace function
public.create_open_committee_meeting_followup_task(
  p_meeting_id uuid,
  p_decision_id uuid,
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

  v_operation_id text :=
    nullif(btrim(p_operation_id), '');

  v_internal_operation_id text;

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

  if p_meeting_id is null then
    raise exception 'invalid_meeting_id'
      using errcode = '22023';
  end if;

  if v_operation_id is null
     or length(v_operation_id) > 200 then
    raise exception 'invalid_operation_id'
      using errcode = '22023';
  end if;

  if not public.can_read_committee_meeting(
    p_meeting_id
  ) then
    raise exception 'meeting_not_found'
      using errcode = 'P0002';
  end if;

  if p_decision_id is not null
     and not exists (
       select 1
       from public.committee_meeting_decisions d
       where d.id = p_decision_id
         and d.meeting_id = p_meeting_id
     ) then

    raise exception 'meeting_decision_not_found'
      using errcode = 'P0002';
  end if;

  v_internal_operation_id :=
    'followup:'
    ||
    pg_catalog.encode(
      extensions.digest(
        v_actor::text
        || ':'
        || v_operation_id,
        'sha256'
      ),
      'hex'
    );

  select *
  into v_task
  from public.create_open_committee_task(
    p_title,
    p_description,
    p_priority,
    p_due_date,
    v_internal_operation_id
  );

  if v_task.source_meeting_id is null
     and v_task.source_meeting_decision_id is null then

    update public.committee_tasks
    set
      source_meeting_id =
        p_meeting_id,

      source_meeting_decision_id =
        p_decision_id
    where id = v_task.id
    returning *
    into v_task;

    update public.committee_task_activity
    set details =
      details
      ||
      pg_catalog.jsonb_build_object(
        'source_meeting_id',
          p_meeting_id,

        'source_meeting_decision_id',
          p_decision_id,

        'followup_operation_id',
          v_operation_id
      )
    where task_id = v_task.id
      and actor_application_user_id =
        v_actor
      and operation_id =
        v_internal_operation_id
      and activity_type =
        'task_created';

  elsif v_task.source_meeting_id
          is distinct from p_meeting_id

     or v_task.source_meeting_decision_id
          is distinct from p_decision_id then

    raise exception 'operation_id_conflict'
      using errcode = '23505';
  end if;

  return v_task;
end;
$$;


-- ============================================================
-- 5. RPC boundary
-- ============================================================

revoke execute
on function public.create_committee_meeting_followup_task(
  uuid,
  uuid,
  text,
  text,
  text,
  date,
  uuid[],
  text
)
from public, anon, service_role;


revoke execute
on function public.create_open_committee_meeting_followup_task(
  uuid,
  uuid,
  text,
  text,
  text,
  date,
  text
)
from public, anon, service_role;


grant execute
on function public.create_committee_meeting_followup_task(
  uuid,
  uuid,
  text,
  text,
  text,
  date,
  uuid[],
  text
)
to authenticated;


grant execute
on function public.create_open_committee_meeting_followup_task(
  uuid,
  uuid,
  text,
  text,
  text,
  date,
  text
)
to authenticated;


commit;
