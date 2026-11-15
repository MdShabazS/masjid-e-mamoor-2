begin;

-- Expenses follow the approved maker/checker flow: Finance submits and the
-- President decides. The trusted RPC continues enforcing distinct actors.
delete from public.role_permissions rp
using public.roles r, public.permissions p
where rp.role_id = r.id
  and rp.permission_id = p.id
  and p.key = 'finance.expenses.create'
  and r.key in ('president', 'vice_president');

delete from public.role_permissions rp
using public.roles r, public.permissions p
where rp.role_id = r.id
  and rp.permission_id = p.id
  and p.key = 'finance.expenses.approve'
  and r.key in ('vice_president', 'finance');

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.key = 'finance.expenses.create'
where r.key = 'finance'
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.key = 'finance.expenses.approve'
where r.key = 'president'
on conflict do nothing;

commit;
