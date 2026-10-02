-- Masjid-e-Mamoor
-- Account-level human display names and safe committee-task assignee labels.

begin;

alter table public.application_users
  add column display_name text;

alter table public.application_users
  add constraint application_users_display_name_chk
  check (
    display_name is null
    or (
      display_name = btrim(display_name)
      and length(display_name) between 1 and 120
    )
  );

update public.application_users au
set display_name = btrim(mp.display_name)
from public.member_profiles mp
where mp.application_user_id = au.id
  and nullif(btrim(mp.display_name), '') is not null;

create or replace function public.list_committee_task_assignee_options()
returns table (
  application_user_id uuid,
  display_name text,
  role_label text
)
language plpgsql
stable
security definer
set search_path = pg_catalog, extensions
as $$
begin
  if public.current_application_user_id() is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  if not public.has_application_permission('committee.tasks.assign') then
    raise exception 'missing_permission' using errcode = '42501';
  end if;

  return query
  select
    au.id,
    coalesce(
      nullif(btrim(au.display_name), ''),
      nullif(btrim(mp.display_name), ''),
      r.name
    ) as display_name,
    r.name as role_label
  from public.application_users au
  join public.application_user_roles aur
    on aur.application_user_id = au.id
  join public.roles r
    on r.id = aur.role_id
  left join public.member_profiles mp
    on mp.application_user_id = au.id
  where au.status = 'active'
    and exists (
      select 1
      from public.role_permissions rp
      join public.permissions p on p.id = rp.permission_id
      where rp.role_id = r.id
        and p.key = 'committee.tasks.read'
    )
    and exists (
      select 1
      from public.role_permissions rp
      join public.permissions p on p.id = rp.permission_id
      where rp.role_id = r.id
        and p.key = 'committee.tasks.manage'
    )
  order by 2, 1;
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
      select jsonb_agg(
        jsonb_build_object(
          'id', cta.id,
          'application_user_id', cta.application_user_id,
          'display_name', coalesce(
            nullif(btrim(au.display_name), ''),
            nullif(btrim(mp.display_name), ''),
            r.name
          ),
          'role_label', r.name,
          'assigned_at', cta.assigned_at,
          'removed_at', cta.removed_at
        ) order by cta.assigned_at, cta.id
      )
      from public.committee_task_assignees cta
      join public.application_users au on au.id = cta.application_user_id
      join public.application_user_roles aur
        on aur.application_user_id = au.id
      join public.roles r on r.id = aur.role_id
      left join public.member_profiles mp
        on mp.application_user_id = au.id
      where cta.task_id = ct.id
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

revoke execute on function public.list_committee_task_assignee_options()
from public, anon;

grant execute on function public.list_committee_task_assignee_options()
to authenticated;

commit;
