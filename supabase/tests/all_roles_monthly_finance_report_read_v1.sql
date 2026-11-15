\set ON_ERROR_STOP on
begin;
do $$
declare v_missing text;
begin
  select string_agg(r.key, ', ' order by r.key) into v_missing
  from public.roles r
  where r.key in ('system_admin','president','vice_president','secretary',
    'finance','committee_member','auditor','member')
  and not exists (
    select 1 from public.role_permissions rp
    join public.permissions p on p.id=rp.permission_id
    where rp.role_id=r.id and p.key='finance.monthly_reports.read'
  );
  if v_missing is not null then
    raise exception 'FAIL: roles missing report read: %',v_missing;
  end if;
  if exists (
    select 1 from public.role_permissions rp
    join public.roles r on r.id=rp.role_id
    join public.permissions p on p.id=rp.permission_id
    where r.key='committee_member' and p.key='finance.monthly_reports.manage'
  ) then raise exception 'FAIL: read access granted report generation'; end if;
end $$;
rollback;
