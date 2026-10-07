\set ON_ERROR_STOP on

begin;

do $$
declare
  v_read_roles text[];
  v_manage_roles text[];
begin
  select array_agg(r.key order by r.key)
  into v_read_roles
  from public.role_permissions rp
  join public.roles r on r.id = rp.role_id
  join public.permissions p on p.id = rp.permission_id
  where p.key = 'finance.monthly_reports.read';

  if v_read_roles is distinct from array[
    'auditor',
    'committee_member',
    'finance',
    'president',
    'secretary',
    'vice_president'
  ]::text[] then
    raise exception 'FAIL: unexpected monthly report read roles: %', v_read_roles;
  end if;

  select array_agg(r.key order by r.key)
  into v_manage_roles
  from public.role_permissions rp
  join public.roles r on r.id = rp.role_id
  join public.permissions p on p.id = rp.permission_id
  where p.key = 'finance.monthly_reports.manage';

  if v_manage_roles is distinct from array[
    'finance',
    'president'
  ]::text[] then
    raise exception 'FAIL: unexpected monthly report manage roles: %', v_manage_roles;
  end if;

  if exists (
    select 1
    from public.role_permissions rp
    join public.roles r on r.id = rp.role_id
    join public.permissions p on p.id = rp.permission_id
    where p.key in ('finance.reports.read', 'reports.finance.read')
      and r.key in ('secretary', 'committee_member')
  ) then
    raise exception 'FAIL: monthly report access broadened legacy finance report permissions';
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'finance_monthly_reports'
      and c.relrowsecurity
  ) then
    raise exception 'FAIL: finance_monthly_reports RLS is not enabled';
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'finance_monthly_reports'
      and policyname = 'finance_monthly_reports_authorized_read'
      and cmd = 'SELECT'
  ) then
    raise exception 'FAIL: finance monthly report read policy missing';
  end if;

  if not has_table_privilege(
    'authenticated',
    'public.finance_monthly_reports',
    'SELECT'
  ) then
    raise exception 'FAIL: authenticated lacks SELECT grant on report metadata';
  end if;

  if has_table_privilege(
    'authenticated',
    'public.finance_monthly_reports',
    'INSERT'
  ) or has_table_privilege(
    'authenticated',
    'public.finance_monthly_reports',
    'UPDATE'
  ) or has_table_privilege(
    'authenticated',
    'public.finance_monthly_reports',
    'DELETE'
  ) then
    raise exception 'FAIL: authenticated can mutate report metadata directly';
  end if;

  if has_table_privilege(
    'anon',
    'public.finance_monthly_reports',
    'SELECT'
  ) then
    raise exception 'FAIL: anon can read report metadata';
  end if;

  if has_table_privilege(
    'service_role',
    'public.finance_monthly_reports',
    'SELECT'
  ) then
    raise exception 'FAIL: service_role has direct report metadata SELECT';
  end if;

  if has_schema_privilege('anon', 'private', 'USAGE')
     or has_schema_privilege('authenticated', 'private', 'USAGE')
     or has_schema_privilege('service_role', 'private', 'USAGE') then
    raise exception 'FAIL: private schema exposed to API roles';
  end if;

  if has_table_privilege(
    'authenticated',
    'private.finance_monthly_report_snapshots',
    'SELECT'
  ) or has_table_privilege(
    'service_role',
    'private.finance_monthly_report_snapshots',
    'SELECT'
  ) then
    raise exception 'FAIL: private snapshot table exposed directly';
  end if;
end
$$;

do $$
declare
  v_bucket storage.buckets;
begin
  select *
  into v_bucket
  from storage.buckets
  where id = 'finance-monthly-reports';

  if v_bucket.id is null then
    raise exception 'FAIL: finance monthly report bucket missing';
  end if;

  if v_bucket.public then
    raise exception 'FAIL: finance monthly report bucket is public';
  end if;

  if v_bucket.file_size_limit <> 20971520 then
    raise exception 'FAIL: unexpected finance report file size limit';
  end if;

  if v_bucket.allowed_mime_types is distinct from
     array['application/pdf']::text[] then
    raise exception 'FAIL: finance report bucket allows unexpected MIME types';
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'finance_monthly_reports_storage_select'
      and cmd = 'SELECT'
  ) then
    raise exception 'FAIL: finance monthly report Storage read policy missing';
  end if;
end
$$;

insert into auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at
)
select
  x.auth_id,
  '00000000-0000-0000-0000-000000000000'::uuid,
  'authenticated',
  'authenticated',
  x.email,
  '',
  now(),
  now(),
  now()
from (
  values
    ('7b1a0000-0000-0000-0000-000000000001'::uuid, 'monthly-secretary@example.invalid'),
    ('7b1a0000-0000-0000-0000-000000000002'::uuid, 'monthly-committee@example.invalid'),
    ('7b1a0000-0000-0000-0000-000000000003'::uuid, 'monthly-member@example.invalid'),
    ('7b1a0000-0000-0000-0000-000000000004'::uuid, 'monthly-admin@example.invalid')
) x(auth_id, email);

insert into public.application_users (
  id,
  auth_user_id,
  status
)
values
  ('7b1b0000-0000-0000-0000-000000000001', '7b1a0000-0000-0000-0000-000000000001', 'active'),
  ('7b1b0000-0000-0000-0000-000000000002', '7b1a0000-0000-0000-0000-000000000002', 'active'),
  ('7b1b0000-0000-0000-0000-000000000003', '7b1a0000-0000-0000-0000-000000000003', 'active'),
  ('7b1b0000-0000-0000-0000-000000000004', '7b1a0000-0000-0000-0000-000000000004', 'active');

insert into public.application_user_roles (
  application_user_id,
  role_id
)
select x.application_user_id, r.id
from (
  values
    ('7b1b0000-0000-0000-0000-000000000001'::uuid, 'secretary'),
    ('7b1b0000-0000-0000-0000-000000000002'::uuid, 'committee_member'),
    ('7b1b0000-0000-0000-0000-000000000003'::uuid, 'member'),
    ('7b1b0000-0000-0000-0000-000000000004'::uuid, 'system_admin')
) x(application_user_id, role_key)
join public.roles r on r.key = x.role_key;

insert into public.finance_monthly_reports (
  id,
  report_month,
  revision,
  status,
  generation_source,
  snapshot_sha256,
  opening_balance_paise,
  donation_inflow_paise,
  expense_outflow_paise,
  adjustments_net_paise,
  transfer_in_paise,
  transfer_out_paise,
  closing_balance_paise,
  cash_closing_paise,
  bank_closing_paise,
  upi_closing_paise,
  other_closing_paise,
  transaction_count,
  storage_object_path
)
values (
  '7b1c0000-0000-0000-0000-000000000001',
  date '2026-09-01',
  1,
  'generating',
  'manual',
  repeat('a', 64),
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  '2026/09/masjid-e-mamoor-finance-2026-09-v1.pdf'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"7b1a0000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);
set local role authenticated;
do $$
begin
  if (select count(*) from public.finance_monthly_reports) <> 1 then
    raise exception 'FAIL: Secretary cannot read monthly Finance reports';
  end if;
end
$$;
reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"7b1a0000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);
set local role authenticated;
do $$
begin
  if (select count(*) from public.finance_monthly_reports) <> 1 then
    raise exception 'FAIL: Committee Member cannot read monthly Finance reports';
  end if;
end
$$;
reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"7b1a0000-0000-0000-0000-000000000003","role":"authenticated"}',
  true
);
set local role authenticated;
do $$
begin
  if (select count(*) from public.finance_monthly_reports) <> 0 then
    raise exception 'FAIL: ordinary Member can read monthly Finance reports';
  end if;
end
$$;
reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"7b1a0000-0000-0000-0000-000000000004","role":"authenticated"}',
  true
);
set local role authenticated;
do $$
begin
  if (select count(*) from public.finance_monthly_reports) <> 0 then
    raise exception 'FAIL: System Admin can read monthly Finance reports';
  end if;
end
$$;
reset role;

rollback;
