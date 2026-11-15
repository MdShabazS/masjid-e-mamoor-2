-- Allow meeting creators to invite every active account role. The stable
-- finance key is displayed as Treasurer, and older Member/Auditor accounts
-- remain eligible so existing identities do not disappear from invitations.
begin;

insert into public.role_permissions(role_id, permission_id)
select r.id, p.id
from public.roles r cross join public.permissions p
where r.key = 'member' and p.key = 'committee.meetings.read'
on conflict do nothing;

do $$
declare
  v_name text;
  v_definition text;
  v_pattern text := $roles$'president',\s*'vice_president',\s*'secretary',\s*'auditor',\s*'committee_member'$roles$;
  v_new text := $roles$'system_admin',
      'president',
      'vice_president',
      'secretary',
      'finance',
      'auditor',
      'committee_member',
      'member'$roles$;
begin
  foreach v_name in array array[
    'list_committee_meeting_participant_options',
    'create_committee_meeting',
    'update_committee_meeting'
  ] loop
    select pg_catalog.pg_get_functiondef(p.oid) into v_definition
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = v_name;
    if v_definition is null or v_definition !~ v_pattern then
      raise exception 'meeting_invitation_source_changed: %', v_name;
    end if;
    v_definition := pg_catalog.regexp_replace(v_definition, v_pattern, v_new);
    execute v_definition;
  end loop;
end $$;

commit;
