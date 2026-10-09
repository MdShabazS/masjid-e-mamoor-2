-- Masjid-e-Mamoor
-- Phase 10 closure: derived Committee Task overdue state.
--
-- Overdue is presentation/query state only:
--   due_date < current_date
--   AND status <> 'completed'
--
-- It is intentionally NOT a persisted lifecycle status.

begin;


-- ============================================================
-- 1. List contract
--
-- PostgreSQL cannot CREATE OR REPLACE a table-returning function
-- with additional output columns, so recreate the same RPC
-- signature while preserving its authorization/pagination rules.
-- ============================================================

drop function public.list_committee_tasks(integer, integer);

create function public.list_committee_tasks(
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (
  id uuid,
  title text,
  description text,
  priority text,
  status text,
  assignment_mode text,
  due_date date,
  is_overdue boolean,
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
    ct.assignment_mode,
    ct.due_date,
    (
      ct.due_date is not null
      and ct.due_date < current_date
      and ct.status <> 'completed'
    ) as is_overdue,
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

revoke execute
on function public.list_committee_tasks(integer, integer)
from public, anon;

grant execute
on function public.list_committee_tasks(integer, integer)
to authenticated;


-- ============================================================
-- 2. Detail contract
--
-- Preserve the existing JSON structure while adding derived
-- is_overdue to the task object. assignment_mode already comes
-- from the task row itself.
-- ============================================================

create or replace function public.get_committee_task(
  p_task_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, extensions
as $$
declare
  v_result jsonb;
begin
  if public.current_application_user_id() is null then
    raise exception 'not_authenticated'
      using errcode = '42501';
  end if;

  if not public.can_read_committee_task(p_task_id) then
    raise exception 'task_not_found'
      using errcode = 'P0002';
  end if;

  select jsonb_build_object(
    'task',
      to_jsonb(ct)
      || jsonb_build_object(
        'is_overdue',
        (
          ct.due_date is not null
          and ct.due_date < current_date
          and ct.status <> 'completed'
        )
      ),
    'assignees',
      coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'id', cta.id,
              'application_user_id',
                cta.application_user_id,
              'display_name',
                coalesce(
                  nullif(
                    btrim(au.display_name),
                    ''
                  ),
                  nullif(
                    btrim(mp.display_name),
                    ''
                  ),
                  r.name
                ),
              'role_label',
                r.name,
              'assigned_at',
                cta.assigned_at,
              'removed_at',
                cta.removed_at
            )
            order by
              cta.assigned_at,
              cta.id
          )
          from public.committee_task_assignees cta
          join public.application_users au
            on au.id = cta.application_user_id
          join public.application_user_roles aur
            on aur.application_user_id = au.id
          join public.roles r
            on r.id = aur.role_id
          left join public.member_profiles mp
            on mp.application_user_id = au.id
          where cta.task_id = ct.id
        ),
        '[]'::jsonb
      ),
    'activity',
      coalesce(
        (
          select jsonb_agg(
            to_jsonb(a)
            order by
              a.created_at,
              a.id
          )
          from public.committee_task_activity a
          where a.task_id = ct.id
        ),
        '[]'::jsonb
      )
  )
  into v_result
  from public.committee_tasks ct
  where ct.id = p_task_id;

  if v_result is null then
    raise exception 'task_not_found'
      using errcode = 'P0002';
  end if;

  return v_result;
end;
$$;

revoke execute
on function public.get_committee_task(uuid)
from public, anon;

grant execute
on function public.get_committee_task(uuid)
to authenticated;


commit;
