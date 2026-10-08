\set ON_ERROR_STOP on

begin;

do $test$
begin
  if has_function_privilege(
    'anon',
    'public.generate_finance_monthly_report_snapshot(date)',
    'execute'
  ) then
    raise exception
      'FAIL: anon can execute monthly snapshot generator';
  end if;

  if has_function_privilege(
    'service_role',
    'public.generate_finance_monthly_report_snapshot(date)',
    'execute'
  ) then
    raise exception
      'FAIL: service_role can execute manual monthly snapshot generator';
  end if;

  if not has_function_privilege(
    'authenticated',
    'public.generate_finance_monthly_report_snapshot(date)',
    'execute'
  ) then
    raise exception
      'FAIL: authenticated lacks snapshot generator execute';
  end if;

  if has_function_privilege(
    'authenticated',
    'private.build_finance_monthly_report_snapshot(date,text)',
    'execute'
  ) then
    raise exception
      'FAIL: authenticated can execute private snapshot core';
  end if;
end
$test$;

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
  '7b1b0000-0000-0000-0000-000000000001'::uuid,
  '00000000-0000-0000-0000-000000000000'::uuid,
  'authenticated',
  'authenticated',
  'monthly-snapshot-finance@example.invalid',
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
  '7b1b1000-0000-0000-0000-000000000001'::uuid,
  '7b1b0000-0000-0000-0000-000000000001'::uuid,
  'active'
);

insert into public.application_user_roles (
  application_user_id,
  role_id
)
select
  '7b1b1000-0000-0000-0000-000000000001'::uuid,
  r.id
from public.roles r
where r.key = 'finance';

insert into public.finance_accounts (
  id,
  name,
  account_type,
  status,
  currency,
  created_by_application_user_id
)
values
  (
    '7b1b2000-0000-0000-0000-000000000001'::uuid,
    'Test Cash',
    'cash',
    'active',
    'INR',
    '7b1b1000-0000-0000-0000-000000000001'::uuid
  ),
  (
    '7b1b2000-0000-0000-0000-000000000002'::uuid,
    'Test Bank',
    'bank',
    'active',
    'INR',
    '7b1b1000-0000-0000-0000-000000000001'::uuid
  );

insert into public.financial_transactions (
  id,
  finance_account_id,
  transaction_category,
  direction,
  amount_paise,
  business_date,
  reference_type,
  reference_id,
  related_transaction_id,
  operation_id,
  created_by_application_user_id
)
values
  (
    '7b1b3000-0000-0000-0000-000000000001'::uuid,
    '7b1b2000-0000-0000-0000-000000000001'::uuid,
    'DONATION_RECURRING',
    'inflow',
    10000,
    date '2034-12-31',
    'donation_payment',
    '7b1b4000-0000-0000-0000-000000000001'::uuid,
    null,
    '7b1b-opening',
    '7b1b1000-0000-0000-0000-000000000001'::uuid
  ),
  (
    '7b1b3000-0000-0000-0000-000000000002'::uuid,
    '7b1b2000-0000-0000-0000-000000000001'::uuid,
    'DONATION_RECURRING',
    'inflow',
    5000,
    date '2035-01-03',
    'donation_payment',
    '7b1b4000-0000-0000-0000-000000000002'::uuid,
    null,
    '7b1b-recurring',
    '7b1b1000-0000-0000-0000-000000000001'::uuid
  ),
  (
    '7b1b3000-0000-0000-0000-000000000003'::uuid,
    '7b1b2000-0000-0000-0000-000000000002'::uuid,
    'DONATION_ADDITIONAL',
    'inflow',
    2000,
    date '2035-01-04',
    'additional_donation',
    '7b1b4000-0000-0000-0000-000000000003'::uuid,
    null,
    '7b1b-additional',
    '7b1b1000-0000-0000-0000-000000000001'::uuid
  ),
  (
    '7b1b3000-0000-0000-0000-000000000004'::uuid,
    '7b1b2000-0000-0000-0000-000000000001'::uuid,
    'DONATION_ANONYMOUS',
    'inflow',
    1000,
    date '2035-01-05',
    'additional_donation',
    '7b1b4000-0000-0000-0000-000000000004'::uuid,
    null,
    '7b1b-anonymous',
    '7b1b1000-0000-0000-0000-000000000001'::uuid
  ),
  (
    '7b1b3000-0000-0000-0000-000000000005'::uuid,
    '7b1b2000-0000-0000-0000-000000000001'::uuid,
    'DONATION_JUMMAH',
    'inflow',
    500,
    date '2035-01-06',
    'additional_donation',
    '7b1b4000-0000-0000-0000-000000000005'::uuid,
    null,
    '7b1b-jummah',
    '7b1b1000-0000-0000-0000-000000000001'::uuid
  ),
  (
    '7b1b3000-0000-0000-0000-000000000006'::uuid,
    '7b1b2000-0000-0000-0000-000000000001'::uuid,
    'EXPENSE',
    'outflow',
    3000,
    date '2035-01-10',
    'finance_expense',
    '7b1b4000-0000-0000-0000-000000000006'::uuid,
    null,
    '7b1b-expense',
    '7b1b1000-0000-0000-0000-000000000001'::uuid
  ),
  (
    '7b1b3000-0000-0000-0000-000000000007'::uuid,
    '7b1b2000-0000-0000-0000-000000000001'::uuid,
    'TRANSFER_OUT',
    'outflow',
    1000,
    date '2035-01-15',
    'finance_transfer',
    '7b1b4000-0000-0000-0000-000000000007'::uuid,
    null,
    '7b1b-transfer',
    '7b1b1000-0000-0000-0000-000000000001'::uuid
  ),
  (
    '7b1b3000-0000-0000-0000-000000000008'::uuid,
    '7b1b2000-0000-0000-0000-000000000002'::uuid,
    'TRANSFER_IN',
    'inflow',
    1000,
    date '2035-01-15',
    'finance_transfer',
    '7b1b4000-0000-0000-0000-000000000007'::uuid,
    null,
    '7b1b-transfer',
    '7b1b1000-0000-0000-0000-000000000001'::uuid
  ),
  (
    '7b1b3000-0000-0000-0000-000000000009'::uuid,
    '7b1b2000-0000-0000-0000-000000000001'::uuid,
    'CORRECTION',
    'inflow',
    200,
    date '2035-01-20',
    'finance_adjustment',
    '7b1b4000-0000-0000-0000-000000000009'::uuid,
    '7b1b3000-0000-0000-0000-000000000006'::uuid,
    '7b1b-correction',
    '7b1b1000-0000-0000-0000-000000000001'::uuid
  );

select set_config(
  'request.jwt.claims',
  '{"sub":"7b1b0000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);

set local role authenticated;

do $test$
declare
  v_first public.finance_monthly_reports;
  v_second public.finance_monthly_reports;
begin
  select *
  into v_first
  from public.generate_finance_monthly_report_snapshot(
    date '2035-01-01'
  );

  if v_first.revision <> 1 then
    raise exception
      'FAIL: first snapshot revision is not 1';
  end if;

  if v_first.opening_balance_paise <> 10000 then
    raise exception
      'FAIL: opening balance mismatch: %',
      v_first.opening_balance_paise;
  end if;

  if v_first.donation_inflow_paise <> 8500 then
    raise exception
      'FAIL: donation total mismatch: %',
      v_first.donation_inflow_paise;
  end if;

  if v_first.expense_outflow_paise <> 3000 then
    raise exception
      'FAIL: expense total mismatch: %',
      v_first.expense_outflow_paise;
  end if;

  if v_first.adjustments_net_paise <> 200 then
    raise exception
      'FAIL: adjustment total mismatch: %',
      v_first.adjustments_net_paise;
  end if;

  if v_first.transfer_in_paise <> 1000
     or v_first.transfer_out_paise <> 1000 then
    raise exception
      'FAIL: transfer totals mismatch';
  end if;

  if v_first.closing_balance_paise <> 15700 then
    raise exception
      'FAIL: closing balance mismatch: %',
      v_first.closing_balance_paise;
  end if;

  if v_first.cash_closing_paise <> 12700 then
    raise exception
      'FAIL: cash closing mismatch: %',
      v_first.cash_closing_paise;
  end if;

  if v_first.bank_closing_paise <> 3000 then
    raise exception
      'FAIL: bank closing mismatch: %',
      v_first.bank_closing_paise;
  end if;

  if v_first.transaction_count <> 8 then
    raise exception
      'FAIL: transaction count mismatch: %',
      v_first.transaction_count;
  end if;

  select *
  into v_second
  from public.generate_finance_monthly_report_snapshot(
    date '2035-01-01'
  );

  if v_second.id <> v_first.id
     or v_second.revision <> 1
     or v_second.snapshot_sha256 <>
        v_first.snapshot_sha256 then
    raise exception
      'FAIL: unchanged snapshot was not reused';
  end if;

  begin
    perform
      public.generate_finance_monthly_report_snapshot(
        date '2035-01-02'
      );

    raise exception
      'FAIL: non-month-start date accepted';
  exception
    when sqlstate '22023' then
      null;
  end;
end
$test$;

reset role;

insert into public.financial_transactions (
  id,
  finance_account_id,
  transaction_category,
  direction,
  amount_paise,
  business_date,
  reference_type,
  reference_id,
  related_transaction_id,
  operation_id,
  created_by_application_user_id
)
values (
  '7b1b3000-0000-0000-0000-000000000010'::uuid,
  '7b1b2000-0000-0000-0000-000000000002'::uuid,
  'CORRECTION',
  'inflow',
  300,
  date '2035-01-25',
  'finance_adjustment',
  '7b1b4000-0000-0000-0000-000000000010'::uuid,
  '7b1b3000-0000-0000-0000-000000000003'::uuid,
  '7b1b-backdated-correction',
  '7b1b1000-0000-0000-0000-000000000001'::uuid
);

set local role authenticated;

do $test$
declare
  v_latest public.finance_monthly_reports;
begin
  select *
  into v_latest
  from public.generate_finance_monthly_report_snapshot(
    date '2035-01-01'
  );

  if v_latest.revision <> 2 then
    raise exception
      'FAIL: changed historical ledger did not create revision 2';
  end if;

  if v_latest.adjustments_net_paise <> 500 then
    raise exception
      'FAIL: revision 2 adjustment total mismatch: %',
      v_latest.adjustments_net_paise;
  end if;

  if v_latest.closing_balance_paise <> 16000 then
    raise exception
      'FAIL: revision 2 closing balance mismatch: %',
      v_latest.closing_balance_paise;
  end if;

  if v_latest.transaction_count <> 9 then
    raise exception
      'FAIL: revision 2 transaction count mismatch: %',
      v_latest.transaction_count;
  end if;
end
$test$;

reset role;

do $test$
declare
  v_count integer;
  v_snapshot jsonb;
begin
  select count(*)
  into v_count
  from public.finance_monthly_reports
  where report_month = date '2035-01-01';

  if v_count <> 2 then
    raise exception
      'FAIL: expected exactly two report revisions, got %',
      v_count;
  end if;

  select s.snapshot
  into v_snapshot
  from private.finance_monthly_report_snapshots s
  join public.finance_monthly_reports r
    on r.id = s.report_id
  where r.report_month = date '2035-01-01'
    and r.revision = 2;

  if (v_snapshot #>>
      '{donation_breakdown,recurring_paise}')::bigint
      <> 5000 then
    raise exception
      'FAIL: recurring breakdown mismatch';
  end if;

  if (v_snapshot #>>
      '{donation_breakdown,additional_paise}')::bigint
      <> 2000 then
    raise exception
      'FAIL: additional breakdown mismatch';
  end if;

  if (v_snapshot #>>
      '{donation_breakdown,anonymous_paise}')::bigint
      <> 1000 then
    raise exception
      'FAIL: anonymous breakdown mismatch';
  end if;

  if (v_snapshot #>>
      '{donation_breakdown,jummah_paise}')::bigint
      <> 500 then
    raise exception
      'FAIL: Jummah breakdown mismatch';
  end if;

  if jsonb_array_length(
      v_snapshot -> 'ledger'
    ) <> 9 then
    raise exception
      'FAIL: ledger appendix count mismatch';
  end if;

  if jsonb_array_length(
      v_snapshot -> 'accounts'
    ) <> 2 then
    raise exception
      'FAIL: account snapshot count mismatch';
  end if;
end
$test$;


do $test$
begin
  begin
    perform private.build_finance_monthly_report_snapshot(
      date '2035-01-01',
      null
    );

    raise exception
      'FAIL: null generation source accepted';
  exception
    when sqlstate '22023' then
      null;
  end;
end
$test$;

insert into public.finance_accounts (
  id,
  name,
  account_type,
  status,
  currency,
  created_by_application_user_id,
  created_at,
  updated_at
)
values (
  '7b1b2000-0000-0000-0000-000000000099'::uuid,
  'Future Unused Account',
  'bank',
  'active',
  'INR',
  '7b1b1000-0000-0000-0000-000000000001'::uuid,
  timestamptz '2035-02-01 00:00:00+05:30',
  timestamptz '2035-02-01 00:00:00+05:30'
);

set local role authenticated;

do $test$
declare
  v_report public.finance_monthly_reports;
begin
  select *
  into v_report
  from public.generate_finance_monthly_report_snapshot(
    date '2035-01-01'
  );

  if v_report.revision <> 2 then
    raise exception
      'FAIL: future unused account created false revision %',
      v_report.revision;
  end if;
end
$test$;

reset role;

insert into public.member_profiles (
  id,
  application_user_id,
  status,
  display_name,
  created_at,
  updated_at
)
values (
  '7b1b5000-0000-0000-0000-000000000001'::uuid,
  null,
  'active',
  'Backdated Donation Member',
  timestamptz '2035-02-05 10:00:00+05:30',
  timestamptz '2035-02-05 10:00:00+05:30'
);

insert into public.donation_obligations (
  id,
  member_profile_id,
  obligation_rule_id,
  effective_month,
  authoritative_amount_paise,
  status,
  created_by_application_user_id,
  operation_id,
  created_at
)
values (
  '7b1b5100-0000-0000-0000-000000000001'::uuid,
  '7b1b5000-0000-0000-0000-000000000001'::uuid,
  null,
  date '2035-01-01',
  400,
  'paid',
  '7b1b1000-0000-0000-0000-000000000001'::uuid,
  '7b1b-backdated-obligation',
  timestamptz '2035-02-05 10:00:00+05:30'
);

insert into public.donation_payments (
  id,
  member_profile_id,
  amount_paise,
  payment_method,
  status,
  submitted_by_application_user_id,
  reviewed_by_application_user_id,
  reviewed_at,
  rejection_reason,
  operation_id,
  created_at,
  updated_at
)
values (
  '7b1b6000-0000-0000-0000-000000000001'::uuid,
  '7b1b5000-0000-0000-0000-000000000001'::uuid,
  400,
  'cash',
  'verified',
  '7b1b1000-0000-0000-0000-000000000001'::uuid,
  '7b1b1000-0000-0000-0000-000000000001'::uuid,
  timestamptz '2035-02-05 10:00:00+05:30',
  null,
  '7b1b-backdated-payment',
  timestamptz '2035-02-05 10:00:00+05:30',
  timestamptz '2035-02-05 10:00:00+05:30'
);

insert into public.donation_payment_allocations (
  id,
  payment_id,
  obligation_id,
  allocated_amount_paise,
  allocation_sequence,
  operation_id,
  created_by_application_user_id,
  created_at
)
values (
  '7b1b6100-0000-0000-0000-000000000001'::uuid,
  '7b1b6000-0000-0000-0000-000000000001'::uuid,
  '7b1b5100-0000-0000-0000-000000000001'::uuid,
  400,
  1,
  '7b1b-backdated-allocation',
  '7b1b1000-0000-0000-0000-000000000001'::uuid,
  timestamptz '2035-02-05 10:00:00+05:30'
);

insert into public.financial_transactions (
  id,
  finance_account_id,
  transaction_category,
  direction,
  amount_paise,
  currency,
  business_date,
  reference_type,
  reference_id,
  related_transaction_id,
  operation_id,
  created_by_application_user_id,
  created_at
)
values (
  '7b1b3000-0000-0000-0000-000000000011'::uuid,
  '7b1b2000-0000-0000-0000-000000000001'::uuid,
  'DONATION_RECURRING',
  'inflow',
  400,
  'INR',
  date '2035-01-28',
  'donation_payment',
  '7b1b6000-0000-0000-0000-000000000001'::uuid,
  null,
  '7b1b-backdated-ledger-post',
  '7b1b1000-0000-0000-0000-000000000001'::uuid,
  timestamptz '2035-02-05 10:00:00+05:30'
);

set local role authenticated;

do $test$
declare
  v_report public.finance_monthly_reports;
begin
  select *
  into v_report
  from public.generate_finance_monthly_report_snapshot(
    date '2035-01-01'
  );

  if v_report.revision <> 3 then
    raise exception
      'FAIL: backdated financial posting did not create revision 3: %',
      v_report.revision;
  end if;

  if v_report.donation_inflow_paise <> 8900 then
    raise exception
      'FAIL: revision 3 donation total mismatch: %',
      v_report.donation_inflow_paise;
  end if;

  if v_report.closing_balance_paise <> 16400 then
    raise exception
      'FAIL: revision 3 closing balance mismatch: %',
      v_report.closing_balance_paise;
  end if;

  if v_report.transaction_count <> 10 then
    raise exception
      'FAIL: revision 3 transaction count mismatch: %',
      v_report.transaction_count;
  end if;
end
$test$;

reset role;

do $test$
declare
  v_snapshot jsonb;
begin
  select s.snapshot
  into v_snapshot
  from private.finance_monthly_report_snapshots s
  join public.finance_monthly_reports r
    on r.id = s.report_id
  where r.report_month = date '2035-01-01'
    and r.revision = 3;

  if (
    v_snapshot #>>
      '{outstanding_obligations,total_outstanding_paise}'
  )::bigint <> 0 then
    raise exception
      'FAIL: backdated allocated donation remains outstanding';
  end if;

  if jsonb_array_length(
    v_snapshot #>
      '{outstanding_obligations,obligations}'
  ) <> 0 then
    raise exception
      'FAIL: paid backdated obligation remains in outstanding list';
  end if;
end
$test$;


rollback;
