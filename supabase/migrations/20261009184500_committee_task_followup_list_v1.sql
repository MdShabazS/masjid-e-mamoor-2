-- Masjid-e-Mamoor
-- Phase 10/11 final compatibility:
-- preserve existing Committee Task list semantics while exposing
-- meeting follow-up source linkage added after the previous list RPC.

begin;

drop function if exists
public.list_committee_tasks(integer, integer);


create or replace function
public.list_committee_tasks(
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
  assignee_ids uuid[],
  source_meeting_id uuid,
  source_meeting_decision_id uuid
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
    ) as assignee_ids,

    ct.source_meeting_id,
    ct.source_meeting_decision_id

  from public.committee_tasks ct

  where public.can_read_committee_task(
    ct.id
  )

  order by
    ct.created_at desc,
    ct.id desc

  limit p_limit
  offset p_offset;
end;
$$;


revoke execute
on function public.list_committee_tasks(
  integer,
  integer
)
from public, anon, service_role;


grant execute
on function public.list_committee_tasks(
  integer,
  integer
)
to authenticated;


commit;
