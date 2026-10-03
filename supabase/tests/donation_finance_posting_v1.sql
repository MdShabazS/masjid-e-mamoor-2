\set ON_ERROR_STOP on

begin;

\echo '============================================'
\echo ' DONATION -> FINANCE POSTING V1 TEST'
\echo '============================================'

-- ---------------------------------------------------------------------------
-- Fixed transactional fixtures
-- ---------------------------------------------------------------------------

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
values
(
  '73000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'phase9b-president@example.invalid',
  '',
  now(),
  now(),
  now()
),
(
  '73000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'phase9b-member@example.invalid',
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
values
(
  '74000000-0000-0000-0000-000000000001',
  '73000000-0000-0000-0000-000000000001',
  'active'
),
(
  '74000000-0000-0000-0000-000000000002',
  '73000000-0000-0000-0000-000000000002',
  'active'
);

insert into public.application_user_roles (
  application_user_id,
  role_id
)
select
  '74000000-0000-0000-0000-000000000001',
  id
from public.roles
where key = 'president';

insert into public.application_user_roles (
  application_user_id,
  role_id
)
select
  '74000000-0000-0000-0000-000000000002',
  id
from public.roles
where key = 'member';

insert into public.member_profiles (
  id,
  application_user_id,
  status,
  display_name
)
values
(
  '75000000-0000-0000-0000-000000000001',
  '74000000-0000-0000-0000-000000000001',
  'active',
  'Phase 9B President'
),
(
  '75000000-0000-0000-0000-000000000002',
  '74000000-0000-0000-0000-000000000002',
  'active',
  'Phase 9B Member'
);

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
  '76000000-0000-0000-0000-000000000001',
  'Phase 9B Active UPI',
  'upi',
  'active',
  'INR',
  '74000000-0000-0000-0000-000000000001'
),
(
  '76000000-0000-0000-0000-000000000002',
  'Phase 9B Inactive UPI',
  'upi',
  'inactive',
  'INR',
  '74000000-0000-0000-0000-000000000001'
);

insert into public.donation_obligations (
  id,
  member_profile_id,
  obligation_rule_id,
  effective_month,
  authoritative_amount_paise,
  status,
  created_by_application_user_id,
  operation_id
)
values (
  '77000000-0000-0000-0000-000000000001',
  '75000000-0000-0000-0000-000000000002',
  null,
  date '2026-01-01',
  50000,
  'outstanding',
  '74000000-0000-0000-0000-000000000001',
  'phase9b-obligation-main'
);

-- ---------------------------------------------------------------------------
-- Privilege boundary
-- ---------------------------------------------------------------------------

do $$
begin
  if has_function_privilege(
    'authenticated',
    'public.verify_and_allocate_donation_payment(uuid,text)',
    'execute'
  ) then
    raise exception
      'FAIL: authenticated can still execute legacy two-argument verifier';
  end if;

  if not has_function_privilege(
    'authenticated',
    'public.verify_and_allocate_donation_payment(uuid,uuid,date,text)',
    'execute'
  ) then
    raise exception
      'FAIL: authenticated cannot execute new trusted verifier';
  end if;

  raise notice
    'PASS: legacy verifier is internal and new verifier is the client boundary';
end $$;

-- ---------------------------------------------------------------------------
-- Submit payment as Member
-- ---------------------------------------------------------------------------

select set_config(
  'request.jwt.claim.sub',
  '73000000-0000-0000-0000-000000000002',
  true
);

select set_config(
  'request.jwt.claim.role',
  'authenticated',
  true
);

select set_config(
  'request.jwt.claims',
  '{"sub":"73000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);

select public.submit_donation_payment(
  80000,
  'upi',
  'phase9b-payment-main'
);

-- ---------------------------------------------------------------------------
-- Begin review as President
-- ---------------------------------------------------------------------------

select set_config(
  'request.jwt.claim.sub',
  '73000000-0000-0000-0000-000000000001',
  true
);

select set_config(
  'request.jwt.claim.role',
  'authenticated',
  true
);

select set_config(
  'request.jwt.claims',
  '{"sub":"73000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);

select public.start_donation_payment_review(
  (
    select id
    from public.donation_payments
    where operation_id = 'phase9b-payment-main'
  ),
  'phase9b-review-main'
);

-- ---------------------------------------------------------------------------
-- Verify + allocate + post
--
-- Payment:       80000
-- Obligation:    50000
-- Recurring:     50000
-- Overpayment:   30000
-- ---------------------------------------------------------------------------

select public.verify_and_allocate_donation_payment(
  (
    select id
    from public.donation_payments
    where operation_id = 'phase9b-payment-main'
  ),
  '76000000-0000-0000-0000-000000000001',
  date '2026-10-04',
  'phase9b-verify-main'
);

do $$
declare
  v_payment_id uuid;
  v_overpayment_id uuid;
  v_payment_status text;

  v_allocated bigint;
  v_overpayment bigint;
  v_ledger_total bigint;

  v_recurring_count bigint;
  v_additional_count bigint;
  v_audit_count bigint;
  v_idempotency_count bigint;
begin
  select id, status
  into v_payment_id, v_payment_status
  from public.donation_payments
  where operation_id = 'phase9b-payment-main';

  if v_payment_status <> 'verified' then
    raise exception
      'FAIL: expected verified payment, got %',
      v_payment_status;
  end if;

  select coalesce(sum(allocated_amount_paise), 0)
  into v_allocated
  from public.donation_payment_allocations
  where payment_id = v_payment_id;

  if v_allocated <> 50000 then
    raise exception
      'FAIL: recurring allocation expected 50000, got %',
      v_allocated;
  end if;

  select
    id,
    amount_paise
  into
    v_overpayment_id,
    v_overpayment
  from public.additional_donations
  where source_payment_id = v_payment_id
    and donation_kind = 'overpayment';

  if v_overpayment <> 30000 then
    raise exception
      'FAIL: overpayment expected 30000, got %',
      v_overpayment;
  end if;

  select count(*)
  into v_recurring_count
  from public.financial_transactions
  where reference_type = 'donation_payment'
    and reference_id = v_payment_id
    and transaction_category = 'DONATION_RECURRING'
    and direction = 'inflow'
    and finance_account_id =
      '76000000-0000-0000-0000-000000000001'
    and business_date = date '2026-10-04'
    and amount_paise = 50000;

  if v_recurring_count <> 1 then
    raise exception
      'FAIL: expected exactly one recurring ledger effect, got %',
      v_recurring_count;
  end if;

  select count(*)
  into v_additional_count
  from public.financial_transactions
  where reference_type = 'additional_donation'
    and reference_id = v_overpayment_id
    and transaction_category = 'DONATION_ADDITIONAL'
    and direction = 'inflow'
    and finance_account_id =
      '76000000-0000-0000-0000-000000000001'
    and business_date = date '2026-10-04'
    and amount_paise = 30000;

  if v_additional_count <> 1 then
    raise exception
      'FAIL: expected exactly one overpayment ledger effect, got %',
      v_additional_count;
  end if;

  select coalesce(sum(amount_paise), 0)
  into v_ledger_total
  from public.financial_transactions
  where (
    reference_type = 'donation_payment'
    and reference_id = v_payment_id
  )
  or (
    reference_type = 'additional_donation'
    and reference_id = v_overpayment_id
  );

  if v_ledger_total <> 80000 then
    raise exception
      'FAIL: ledger recognition expected 80000, got %',
      v_ledger_total;
  end if;

  select count(*)
  into v_audit_count
  from public.finance_audit_events
  where event_type = 'donation_payment_posted'
    and entity_type = 'donation_payment'
    and entity_id = v_payment_id
    and operation_id = 'phase9b-verify-main';

  if v_audit_count <> 1 then
    raise exception
      'FAIL: expected one Finance audit event, got %',
      v_audit_count;
  end if;

  select count(*)
  into v_idempotency_count
  from public.finance_operation_idempotency
  where operation_id = 'phase9b-verify-main'
    and operation_type = 'donation_verify_post'
    and result_entity_type = 'donation_payment'
    and result_entity_id = v_payment_id;

  if v_idempotency_count <> 1 then
    raise exception
      'FAIL: expected one Finance idempotency record, got %',
      v_idempotency_count;
  end if;

  raise notice
    'PASS: verified payment posted exact recurring + overpayment financial effects';
end $$;

-- ---------------------------------------------------------------------------
-- Exact replay must not duplicate allocations, ledger, audit or money.
-- ---------------------------------------------------------------------------

select public.verify_and_allocate_donation_payment(
  (
    select id
    from public.donation_payments
    where operation_id = 'phase9b-payment-main'
  ),
  '76000000-0000-0000-0000-000000000001',
  date '2026-10-04',
  'phase9b-verify-main'
);

do $$
declare
  v_payment_id uuid;
  v_effect_count bigint;
  v_effect_total bigint;
  v_audit_count bigint;
  v_finance_idem_count bigint;
begin
  select id
  into v_payment_id
  from public.donation_payments
  where operation_id = 'phase9b-payment-main';

  select
    count(*),
    coalesce(sum(amount_paise), 0)
  into
    v_effect_count,
    v_effect_total
  from public.financial_transactions
  where operation_id like 'donation-ledger:%'
    and (
      reference_id = v_payment_id
      or reference_id in (
        select id
        from public.additional_donations
        where source_payment_id = v_payment_id
      )
    );

  if v_effect_count <> 2
     or v_effect_total <> 80000 then
    raise exception
      'FAIL: replay changed ledger: count %, total %',
      v_effect_count,
      v_effect_total;
  end if;

  select count(*)
  into v_audit_count
  from public.finance_audit_events
  where operation_id = 'phase9b-verify-main';

  if v_audit_count <> 1 then
    raise exception
      'FAIL: replay duplicated Finance audit: %',
      v_audit_count;
  end if;

  select count(*)
  into v_finance_idem_count
  from public.finance_operation_idempotency
  where operation_id = 'phase9b-verify-main';

  if v_finance_idem_count <> 1 then
    raise exception
      'FAIL: replay duplicated Finance idempotency: %',
      v_finance_idem_count;
  end if;

  raise notice
    'PASS: exact verification replay created no duplicate money';
end $$;

-- ---------------------------------------------------------------------------
-- Same operation ID with changed authoritative input must conflict.
-- ---------------------------------------------------------------------------

do $$
declare
  v_payment_id uuid;
begin
  select id
  into v_payment_id
  from public.donation_payments
  where operation_id = 'phase9b-payment-main';

  begin
    perform public.verify_and_allocate_donation_payment(
      v_payment_id,
      '76000000-0000-0000-0000-000000000001',
      date '2026-10-05',
      'phase9b-verify-main'
    );

    raise exception
      'FAIL: changed verification replay was accepted';
  exception
    when unique_violation then
      if sqlerrm <> 'operation_id_conflict' then
        raise;
      end if;
  end;

  raise notice
    'PASS: changed verification replay rejected';
end $$;

-- ---------------------------------------------------------------------------
-- Actual Data API role cannot invoke retired two-argument verifier.
-- ---------------------------------------------------------------------------

set local role authenticated;

do $$
declare
  v_payment_id uuid;
begin
  select id
  into v_payment_id
  from public.donation_payments
  where operation_id = 'phase9b-payment-main';

  begin
    perform public.verify_and_allocate_donation_payment(
      v_payment_id,
      'phase9b-forbidden-old-rpc'
    );

    raise exception
      'FAIL: authenticated invoked retired verifier';
  exception
    when insufficient_privilege then
      null;
  end;

  raise notice
    'PASS: authenticated cannot execute retired verifier';
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- Create second pending payment to test authorization/account rejection.
-- ---------------------------------------------------------------------------

select set_config(
  'request.jwt.claim.sub',
  '73000000-0000-0000-0000-000000000002',
  true
);

select set_config(
  'request.jwt.claim.role',
  'authenticated',
  true
);

select set_config(
  'request.jwt.claims',
  '{"sub":"73000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);

select public.submit_donation_payment(
  10000,
  'cash',
  'phase9b-payment-denied'
);

select set_config(
  'request.jwt.claim.sub',
  '73000000-0000-0000-0000-000000000001',
  true
);

select set_config(
  'request.jwt.claim.role',
  'authenticated',
  true
);

select set_config(
  'request.jwt.claims',
  '{"sub":"73000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);

select public.start_donation_payment_review(
  (
    select id
    from public.donation_payments
    where operation_id = 'phase9b-payment-denied'
  ),
  'phase9b-review-denied'
);

-- Member may know/guess the Finance account UUID but still cannot post money.
select set_config(
  'request.jwt.claim.sub',
  '73000000-0000-0000-0000-000000000002',
  true
);

select set_config(
  'request.jwt.claim.role',
  'authenticated',
  true
);

select set_config(
  'request.jwt.claims',
  '{"sub":"73000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);

set local role authenticated;

do $$
declare
  v_payment_id uuid;
begin
  select id
  into v_payment_id
  from public.donation_payments
  where operation_id = 'phase9b-payment-denied';

  begin
    perform public.verify_and_allocate_donation_payment(
      v_payment_id,
      '76000000-0000-0000-0000-000000000001',
      date '2026-10-04',
      'phase9b-member-forbidden'
    );

    raise exception
      'FAIL: Member posted verified donation money';
  exception
    when insufficient_privilege then
      null;
  end;

  raise notice
    'PASS: Member cannot post donation financial effects';
end $$;

reset role;

-- Restore President.
select set_config(
  'request.jwt.claim.sub',
  '73000000-0000-0000-0000-000000000001',
  true
);

select set_config(
  'request.jwt.claim.role',
  'authenticated',
  true
);

select set_config(
  'request.jwt.claims',
  '{"sub":"73000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);

-- Inactive account must reject before donation state changes.
do $$
declare
  v_payment_id uuid;
begin
  select id
  into v_payment_id
  from public.donation_payments
  where operation_id = 'phase9b-payment-denied';

  begin
    perform public.verify_and_allocate_donation_payment(
      v_payment_id,
      '76000000-0000-0000-0000-000000000002',
      date '2026-10-04',
      'phase9b-inactive-account'
    );

    raise exception
      'FAIL: inactive Finance account accepted';
  exception
    when invalid_parameter_value then
      if sqlerrm <> 'finance_account_not_active' then
        raise;
      end if;
  end;

  if (
    select status
    from public.donation_payments
    where id = v_payment_id
  ) <> 'under_review' then
    raise exception
      'FAIL: inactive-account failure changed payment state';
  end if;

  if exists (
    select 1
    from public.financial_transactions
    where reference_type = 'donation_payment'
      and reference_id = v_payment_id
  ) then
    raise exception
      'FAIL: inactive-account failure created ledger state';
  end if;

  if exists (
    select 1
    from public.finance_operation_idempotency
    where operation_id = 'phase9b-inactive-account'
  ) then
    raise exception
      'FAIL: failed inactive-account operation persisted Finance idempotency';
  end if;

  raise notice
    'PASS: inactive Finance account rejected without financial mutation';
end $$;

-- ---------------------------------------------------------------------------
-- Failure injection: verify that donation verification/allocation and Finance
-- posting are one atomic PostgreSQL operation.
-- ---------------------------------------------------------------------------

insert into public.donation_obligations (
  id,
  member_profile_id,
  obligation_rule_id,
  effective_month,
  authoritative_amount_paise,
  status,
  created_by_application_user_id,
  operation_id
)
values (
  '77000000-0000-0000-0000-000000000002',
  '75000000-0000-0000-0000-000000000002',
  null,
  date '2026-02-01',
  15000,
  'outstanding',
  '74000000-0000-0000-0000-000000000001',
  'phase9b-obligation-atomic'
);

select set_config(
  'request.jwt.claim.sub',
  '73000000-0000-0000-0000-000000000002',
  true
);

select set_config(
  'request.jwt.claim.role',
  'authenticated',
  true
);

select set_config(
  'request.jwt.claims',
  '{"sub":"73000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);

select public.submit_donation_payment(
  20000,
  'upi',
  'phase9b-payment-atomic'
);

select set_config(
  'request.jwt.claim.sub',
  '73000000-0000-0000-0000-000000000001',
  true
);

select set_config(
  'request.jwt.claim.role',
  'authenticated',
  true
);

select set_config(
  'request.jwt.claims',
  '{"sub":"73000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);

select public.start_donation_payment_review(
  (
    select id
    from public.donation_payments
    where operation_id = 'phase9b-payment-atomic'
  ),
  'phase9b-review-atomic'
);

create or replace function public.test_fail_phase9b_finance_posting()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if new.transaction_category in (
    'DONATION_RECURRING',
    'DONATION_ADDITIONAL'
  ) then
    raise exception 'forced_phase9b_posting_failure'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

create trigger test_fail_phase9b_finance_posting
before insert on public.financial_transactions
for each row
execute function public.test_fail_phase9b_finance_posting();

do $$
declare
  v_payment_id uuid;
  v_status text;
  v_allocation_count bigint;
  v_overpayment_count bigint;
  v_ledger_count bigint;
  v_finance_idem_count bigint;
  v_donation_verify_idem_count bigint;
begin
  select id
  into v_payment_id
  from public.donation_payments
  where operation_id = 'phase9b-payment-atomic';

  begin
    perform public.verify_and_allocate_donation_payment(
      v_payment_id,
      '76000000-0000-0000-0000-000000000001',
      date '2026-10-04',
      'phase9b-verify-atomic'
    );

    raise exception
      'FAIL: forced Finance posting failure did not abort';
  exception
    when raise_exception then
      if sqlerrm <> 'forced_phase9b_posting_failure' then
        raise;
      end if;
  end;

  select status
  into v_status
  from public.donation_payments
  where id = v_payment_id;

  if v_status <> 'under_review' then
    raise exception
      'FAIL: failed posting left payment status %',
      v_status;
  end if;

  select count(*)
  into v_allocation_count
  from public.donation_payment_allocations
  where payment_id = v_payment_id;

  if v_allocation_count <> 0 then
    raise exception
      'FAIL: failed posting left % allocations',
      v_allocation_count;
  end if;

  select count(*)
  into v_overpayment_count
  from public.additional_donations
  where source_payment_id = v_payment_id;

  if v_overpayment_count <> 0 then
    raise exception
      'FAIL: failed posting left % overpayment records',
      v_overpayment_count;
  end if;

  select count(*)
  into v_ledger_count
  from public.financial_transactions
  where reference_id = v_payment_id
     or reference_id in (
       select id
       from public.additional_donations
       where source_payment_id = v_payment_id
     );

  if v_ledger_count <> 0 then
    raise exception
      'FAIL: failed posting left % ledger rows',
      v_ledger_count;
  end if;

  select count(*)
  into v_finance_idem_count
  from public.finance_operation_idempotency
  where operation_id = 'phase9b-verify-atomic';

  if v_finance_idem_count <> 0 then
    raise exception
      'FAIL: failed posting persisted Finance idempotency';
  end if;

  select count(*)
  into v_donation_verify_idem_count
  from public.donation_operation_idempotency
  where payment_id = v_payment_id
    and operation_type = 'payment_verify_allocate';

  if v_donation_verify_idem_count <> 0 then
    raise exception
      'FAIL: failed posting persisted donation verification idempotency';
  end if;

  if (
    select status
    from public.donation_obligations
    where id =
      '77000000-0000-0000-0000-000000000002'
  ) <> 'outstanding' then
    raise exception
      'FAIL: failed posting mutated obligation state';
  end if;

  raise notice
    'PASS: forced Finance failure rolled back verification, allocation and posting';
end $$;

drop trigger test_fail_phase9b_finance_posting
on public.financial_transactions;

drop function public.test_fail_phase9b_finance_posting();

\echo '============================================'
\echo ' ALL DONATION -> FINANCE POSTING TESTS PASSED'
\echo '============================================'

rollback;
