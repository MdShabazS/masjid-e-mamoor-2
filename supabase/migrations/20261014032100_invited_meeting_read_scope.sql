-- All active invited roles can read their meetings. Meeting managers and legacy
-- Auditor retain organization-wide read scope. Permission remains mandatory.
begin;
create or replace function public.can_read_committee_meeting(p_meeting_id uuid)
returns boolean language plpgsql stable security definer
set search_path=pg_catalog,extensions as $$
declare v_actor uuid:=public.current_application_user_id(); v_role text;
begin
  if v_actor is null or not public.has_application_permission('committee.meetings.read') then
    return false; end if;
  select r.key into v_role from public.application_user_roles aur
    join public.roles r on r.id=aur.role_id
    where aur.application_user_id=v_actor limit 1;
  if v_role in ('system_admin','president','vice_president','secretary','auditor') then
    return true; end if;
  return exists(select 1 from public.committee_meeting_participants cmp
    where cmp.meeting_id=p_meeting_id and cmp.application_user_id=v_actor);
end;
$$;
commit;
