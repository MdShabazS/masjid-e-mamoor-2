\set ON_ERROR_STOP on

begin;

do $$
declare
  v_count integer;
begin
  select count(*)
  into v_count
  from pg_constraint
  where conrelid = 'public.finance_monthly_reports'::regclass
    and conname in (
      'finance_monthly_reports_transfer_balance_chk',
      'finance_monthly_reports_balance_equation_chk',
      'finance_monthly_reports_account_breakdown_chk',
      'finance_monthly_reports_id_snapshot_uidx'
    );

  if v_count <> 4 then
    raise exception 'FAIL: expected Finance monthly report integrity constraints are missing';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid =
      'private.finance_monthly_report_snapshots'::regclass
      and conname =
        'finance_monthly_report_snapshots_content_hash_chk'
  ) then
    raise exception 'FAIL: snapshot content hash constraint missing';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid =
      'private.finance_monthly_report_snapshots'::regclass
      and conname =
        'finance_monthly_report_snapshots_report_sha_fkey'
  ) then
    raise exception 'FAIL: snapshot/report hash FK missing';
  end if;

  if not exists (
    select 1
    from pg_trigger
    where tgrelid =
      'private.finance_monthly_report_snapshots'::regclass
      and tgname =
        'finance_monthly_report_snapshots_immutable'
      and not tgisinternal
  ) then
    raise exception 'FAIL: snapshot immutability trigger missing';
  end if;
end
$$;

do $$
begin
  begin
    insert into public.finance_monthly_reports (
      report_month,
      revision,
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
      date '2035-01-01',
      1,
      'manual',
      repeat('a', 64),
      1000,
      500,
      200,
      0,
      101,
      100,
      1301,
      300,
      700,
      200,
      101,
      5,
      '2035/01/transfer-mismatch.pdf'
    );

    raise exception 'FAIL: unbalanced organizational transfer totals accepted';
  exception
    when check_violation then null;
  end;

  begin
    insert into public.finance_monthly_reports (
      report_month,
      revision,
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
      date '2035-02-01',
      1,
      'manual',
      repeat('b', 64),
      1000,
      500,
      200,
      0,
      100,
      100,
      1400,
      400,
      700,
      200,
      100,
      5,
      '2035/02/balance-mismatch.pdf'
    );

    raise exception 'FAIL: invalid closing balance equation accepted';
  exception
    when check_violation then null;
  end;

  begin
    insert into public.finance_monthly_reports (
      report_month,
      revision,
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
      date '2035-03-01',
      1,
      'manual',
      repeat('c', 64),
      1000,
      500,
      200,
      0,
      100,
      100,
      1300,
      300,
      700,
      200,
      101,
      5,
      '2035/03/account-breakdown-mismatch.pdf'
    );

    raise exception 'FAIL: invalid account closing breakdown accepted';
  exception
    when check_violation then null;
  end;
end
$$;

insert into public.finance_monthly_reports (
  report_month,
  revision,
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
  date '2036-01-01',
  1,
  'manual',
  encode(
    extensions.digest(
      jsonb_build_object('version', 1)::text,
      'sha256'
    ),
    'hex'
  ),
  1000,
  500,
  200,
  0,
  100,
  100,
  1300,
  300,
  700,
  200,
  100,
  5,
  '2036/01/valid-snapshot.pdf'
);

insert into private.finance_monthly_report_snapshots (
  report_id,
  snapshot,
  snapshot_sha256
)
select
  id,
  jsonb_build_object('version', 1),
  snapshot_sha256
from public.finance_monthly_reports
where report_month = date '2036-01-01'
  and revision = 1;

do $$
begin
  begin
    update private.finance_monthly_report_snapshots
    set snapshot =
      jsonb_build_object('version', 2)
    where report_id = (
      select id
      from public.finance_monthly_reports
      where report_month = date '2036-01-01'
        and revision = 1
    );

    raise exception 'FAIL: immutable snapshot was updated';
  exception
    when object_not_in_prerequisite_state then null;
  end;

  begin
    delete from private.finance_monthly_report_snapshots
    where report_id = (
      select id
      from public.finance_monthly_reports
      where report_month = date '2036-01-01'
        and revision = 1
    );

    raise exception 'FAIL: immutable snapshot was deleted';
  exception
    when object_not_in_prerequisite_state then null;
  end;
end
$$;

insert into public.finance_monthly_reports (
  report_month,
  revision,
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
  date '2036-02-01',
  1,
  'manual',
  repeat('d', 64),
  1000,
  500,
  200,
  0,
  100,
  100,
  1300,
  300,
  700,
  200,
  100,
  5,
  '2036/02/hash-mismatch.pdf'
);

do $$
declare
  v_report_id uuid;
begin
  select id
  into v_report_id
  from public.finance_monthly_reports
  where report_month = date '2036-02-01'
    and revision = 1;

  begin
    insert into private.finance_monthly_report_snapshots (
      report_id,
      snapshot,
      snapshot_sha256
    )
    values (
      v_report_id,
      jsonb_build_object('version', 99),
      encode(
        extensions.digest(
          jsonb_build_object('version', 99)::text,
          'sha256'
        ),
        'hex'
      )
    );

    raise exception 'FAIL: snapshot/report hash mismatch accepted';
  exception
    when foreign_key_violation then null;
  end;
end
$$;

insert into public.finance_monthly_reports (
  report_month,
  revision,
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
  date '2036-03-01',
  1,
  'manual',
  repeat('e', 64),
  1000,
  500,
  200,
  0,
  100,
  100,
  1300,
  300,
  700,
  200,
  100,
  5,
  '2036/03/generating.pdf'
);

insert into public.finance_monthly_reports (
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
  storage_object_path,
  file_sha256,
  file_size_bytes,
  generated_at
)
values (
  date '2036-04-01',
  1,
  'ready',
  'manual',
  repeat('f', 64),
  1000,
  500,
  200,
  0,
  100,
  100,
  1300,
  300,
  700,
  200,
  100,
  5,
  '2036/04/ready.pdf',
  repeat('1', 64),
  1000,
  now()
);

insert into storage.objects (
  bucket_id,
  name,
  metadata
)
values
  (
    'finance-monthly-reports',
    '2036/03/generating.pdf',
    '{}'::jsonb
  ),
  (
    'finance-monthly-reports',
    '2036/04/ready.pdf',
    '{}'::jsonb
  );

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
values (
  '7b1c0000-0000-0000-0000-000000000001'::uuid,
  '00000000-0000-0000-0000-000000000000'::uuid,
  'authenticated',
  'authenticated',
  'finance-integrity-president@example.invalid',
  '',
  now(),
  now(),
  now()
);

insert into public.application_users (
  id,
  auth_user_id,
  status
)
values (
  '7b1d0000-0000-0000-0000-000000000001'::uuid,
  '7b1c0000-0000-0000-0000-000000000001'::uuid,
  'active'
);

insert into public.application_user_roles (
  application_user_id,
  role_id
)
select
  '7b1d0000-0000-0000-0000-000000000001'::uuid,
  r.id
from public.roles r
where r.key = 'president';

select set_config(
  'request.jwt.claims',
  '{"sub":"7b1c0000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);

set local role authenticated;

do $$
begin
  if (
    select count(*)
    from storage.objects
    where bucket_id = 'finance-monthly-reports'
      and name = '2036/03/generating.pdf'
  ) <> 0 then
    raise exception 'FAIL: generating report PDF became downloadable';
  end if;

  if (
    select count(*)
    from storage.objects
    where bucket_id = 'finance-monthly-reports'
      and name = '2036/04/ready.pdf'
  ) <> 1 then
    raise exception 'FAIL: ready report PDF is not downloadable';
  end if;
end
$$;

reset role;

rollback;
