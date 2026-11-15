-- Final product decision: every registered role may view and download reports.
-- Generation and finance mutations remain separate permissions.
begin;
insert into public.role_permissions(role_id, permission_id)
select r.id, p.id
from public.roles r cross join public.permissions p
where r.key in (
  'system_admin','president','vice_president','secretary',
  'finance','committee_member','auditor','member'
) and p.key = 'finance.monthly_reports.read'
on conflict do nothing;
commit;
