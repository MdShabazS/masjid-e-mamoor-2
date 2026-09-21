begin;

-- Interim administrative read boundary.
--
-- membership.members.read is intentionally granted to all V1 roles, but it
-- only means "read member information within authorized scope". Until the
-- operational scope model is defined, ordinary Member and assigned-only
-- Committee Member roles must not be able to use broad administrative member
-- read operations to browse unrelated member profiles.

create or replace function public.can_use_member_admin_read_operations()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.has_application_permission('membership.members.read')
    and public.current_application_role() in (
      'president',
      'vice_president',
      'secretary',
      'finance',
      'auditor'
    );
$$;

revoke all on function public.can_use_member_admin_read_operations()
from public;

grant execute on function public.can_use_member_admin_read_operations()
to authenticated;

create or replace function public.admin_list_member_profiles(
  p_search text default null,
  p_limit integer default 50,
  p_after_created_at timestamptz default null,
  p_after_id uuid default null
)
returns table (
  id uuid,
  application_user_id uuid,
  status text,
  display_name text,
  phone text,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_search text := nullif(trim(p_search), '');
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 100);
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  if not public.can_use_member_admin_read_operations() then
    raise exception 'missing_permission' using errcode = '42501';
  end if;

  return query
  select mp.id, mp.application_user_id, mp.status, mp.display_name,
         mp.phone, mp.created_at, mp.updated_at
  from public.member_profiles mp
  where (
    v_search is null
    or mp.display_name ilike '%' || v_search || '%'
    or coalesce(mp.phone, '') ilike '%' || v_search || '%'
  )
  and (
    p_after_created_at is null
    or p_after_id is null
    or (mp.created_at, mp.id) < (p_after_created_at, p_after_id)
  )
  order by mp.created_at desc, mp.id desc
  limit v_limit;
end;
$$;

create or replace function public.admin_get_member_profile(
  p_member_profile_id uuid
)
returns table (
  id uuid,
  application_user_id uuid,
  status text,
  display_name text,
  phone text,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  if not public.can_use_member_admin_read_operations() then
    raise exception 'missing_permission' using errcode = '42501';
  end if;

  return query
  select mp.id, mp.application_user_id, mp.status, mp.display_name,
         mp.phone, mp.created_at, mp.updated_at
  from public.member_profiles mp
  where mp.id = p_member_profile_id;
end;
$$;

revoke execute on function public.admin_list_member_profiles(
  text, integer, timestamptz, uuid
) from public, anon;

revoke execute on function public.admin_get_member_profile(uuid)
from public, anon;

grant execute on function public.admin_list_member_profiles(
  text, integer, timestamptz, uuid
) to authenticated;

grant execute on function public.admin_get_member_profile(uuid)
to authenticated;

commit;
