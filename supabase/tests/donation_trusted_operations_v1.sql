\set ON_ERROR_STOP on

begin;

-- ============================================================================
-- Donation Trusted Operations V1
-- Behavioral verification
-- ============================================================================

do $$
declare
  v_president_auth uuid := gen_random_uuid();
  v_member_auth uuid := gen_random_uuid();

  v_president_app uuid;
  v_member_app uuid;

  v_president_profile uuid;
  v_member_profile uuid;

  v_president_role uuid;
  v_member_role uuid;

  v_rule public.donation_obligation_rules;
  v_rule_replay public.donation_obligation_rules;

  v_generation record;
  v_generation_replay record;

  v_obligation_jan uuid;
  v_obligation_feb uuid;
  v_obligation_future uuid;

  v_payment public.donation_payments;
  v_payment_replay public.donation_payments;

  v_count integer;
  v_amount bigint;
  v_status text;
begin
  -- --------------------------------------------------------------------------
  -- Identity fixtures
  -- --------------------------------------------------------------------------

  select id into v_president_role
  from public.roles
  where key = 'president';

  select id into v_member_role
  from public.roles
  where key = 'member';

  if v_president_role is null or v_member_role is null then
    raise exception 'TEST SETUP FAILED: required roles missing';
  end if;

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
    v_president_auth,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'donation-president-test@example.invalid',
    '',
    now(),
    now(),
    now()
  ),
  (
    v_member_auth,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'donation-member-test@example.invalid',
    '',
    now(),
    now(),
    now()
  );

  insert into public.application_users (
    auth_user_id,
    status
  )
  values (
    v_president_auth,
    'active'
  )
  returning id into v_president_app;

  insert into public.application_users (
    auth_user_id,
    status
  )
  values (
    v_member_auth,
    'active'
  )
  returning id into v_member_app;

  insert into public.application_user_roles (
    application_user_id,
    role_id
  )
  values
    (v_president_app, v_president_role),
    (v_member_app, v_member_role);

  insert into public.member_profiles (
    application_user_id,
    status,
    display_name
  )
  values (
    v_president_app,
    'active',
    'Donation Test President'
  )
  returning id into v_president_profile;

  insert into public.member_profiles (
    application_user_id,
    status,
    display_name
  )
  values (
    v_member_app,
    'active',
    'Donation Test Member'
  )
  returning id into v_member_profile;

  -- --------------------------------------------------------------------------
  -- President context
  -- --------------------------------------------------------------------------

  perform set_config('request.jwt.claim.sub', v_president_auth::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  -- --------------------------------------------------------------------------
  -- Rule creation + replay
  -- --------------------------------------------------------------------------

  select *
  into v_rule
  from public.create_donation_obligation_rule(
    date '2026-01-01',
    50000,
    'don-test-rule-001'
  );

  select *
  into v_rule_replay
  from public.create_donation_obligation_rule(
    date '2026-01-01',
    50000,
    'don-test-rule-001'
  );

  if v_rule.id is distinct from v_rule_replay.id then
    raise exception 'RULE IDEMPOTENCY FAILED';
  end if;

  begin
    perform public.create_donation_obligation_rule(
      date '2026-01-01',
      60000,
      'don-test-rule-001'
    );

    raise exception 'EXPECTED operation_id_conflict';
  exception
    when unique_violation then null;
  end;

  -- --------------------------------------------------------------------------
  -- Monthly generation + exact replay
  -- --------------------------------------------------------------------------

  select *
  into v_generation
  from public.generate_monthly_donation_obligations(
    date '2026-01-01',
    'don-test-generate-jan'
  );

  select *
  into v_generation_replay
  from public.generate_monthly_donation_obligations(
    date '2026-01-01',
    'don-test-generate-jan'
  );

  if v_generation.created_count <> v_generation_replay.created_count then
    raise exception
      'GENERATION REPLAY COUNT FAILED: original %, replay %',
      v_generation.created_count,
      v_generation_replay.created_count;
  end if;

  select id
  into v_obligation_jan
  from public.donation_obligations
  where member_profile_id = v_member_profile
    and effective_month = date '2026-01-01';

  if v_obligation_jan is null then
    raise exception 'JANUARY OBLIGATION MISSING';
  end if;

  perform public.generate_monthly_donation_obligations(
    date '2026-02-01',
    'don-test-generate-feb'
  );

  select id
  into v_obligation_feb
  from public.donation_obligations
  where member_profile_id = v_member_profile
    and effective_month = date '2026-02-01';

  if v_obligation_feb is null then
    raise exception 'FEBRUARY OBLIGATION MISSING';
  end if;

  -- Future obligation must never be consumed by normal verification.
  insert into public.donation_obligations (
    member_profile_id,
    obligation_rule_id,
    effective_month,
    authoritative_amount_paise,
    created_by_application_user_id,
    operation_id
  )
  values (
    v_member_profile,
    v_rule.id,
    (date_trunc('month', current_date)
      + interval '12 months')::date,
    50000,
    v_president_app,
    'don-test-future-obligation'
  )
  returning id into v_obligation_future;

  -- --------------------------------------------------------------------------
  -- Member payment minimum + submission replay
  -- --------------------------------------------------------------------------

  perform set_config('request.jwt.claim.sub', v_member_auth::text, true);

  begin
    perform public.submit_donation_payment(
      99,
      'upi',
      'don-test-payment-too-small'
    );

    raise exception 'EXPECTED payment_below_minimum';
  exception
    when sqlstate '22023' then null;
  end;

  select *
  into v_payment
  from public.submit_donation_payment(
    100,
    'upi',
    'don-test-payment-minimum'
  );

  if v_payment.status <> 'submitted'
     or v_payment.amount_paise <> 100 then
    raise exception 'MINIMUM PAYMENT SUBMISSION FAILED';
  end if;

  select *
  into v_payment_replay
  from public.submit_donation_payment(
    100,
    'upi',
    'don-test-payment-minimum'
  );

  if v_payment.id is distinct from v_payment_replay.id then
    raise exception 'PAYMENT IDEMPOTENCY FAILED';
  end if;

  begin
    perform public.submit_donation_payment(
      200,
      'upi',
      'don-test-payment-minimum'
    );

    raise exception 'EXPECTED payment operation conflict';
  exception
    when unique_violation then null;
  end;

  -- --------------------------------------------------------------------------
  -- Review + reject
  -- --------------------------------------------------------------------------

  perform set_config('request.jwt.claim.sub', v_president_auth::text, true);

  perform public.start_donation_payment_review(
    v_payment.id,
    'don-test-review-minimum'
  );

  select status into v_status
  from public.donation_payments
  where id = v_payment.id;

  if v_status <> 'under_review' then
    raise exception 'PAYMENT REVIEW TRANSITION FAILED';
  end if;

  perform public.reject_donation_payment(
    v_payment.id,
    'Behavioral test rejection',
    'don-test-reject-minimum'
  );

  select status into v_status
  from public.donation_payments
  where id = v_payment.id;

  if v_status <> 'rejected' then
    raise exception 'PAYMENT REJECTION FAILED';
  end if;

  -- --------------------------------------------------------------------------
  -- Resubmission = new payment identity
  -- Partial FIFO allocation
  -- --------------------------------------------------------------------------

  perform set_config('request.jwt.claim.sub', v_member_auth::text, true);

  select *
  into v_payment
  from public.submit_donation_payment(
    25000,
    'upi',
    'don-test-payment-partial'
  );

  perform set_config('request.jwt.claim.sub', v_president_auth::text, true);

  perform public.start_donation_payment_review(
    v_payment.id,
    'don-test-review-partial'
  );

  perform public.verify_and_allocate_donation_payment(
    v_payment.id,
    'don-test-verify-partial'
  );

  select coalesce(sum(allocated_amount_paise), 0)
  into v_amount
  from public.donation_payment_allocations
  where payment_id = v_payment.id
    and obligation_id = v_obligation_jan;

  if v_amount <> 25000 then
    raise exception
      'PARTIAL FIFO FAILED: expected 25000, got %',
      v_amount;
  end if;

  select status into v_status
  from public.donation_obligations
  where id = v_obligation_jan;

  if v_status <> 'partially_paid' then
    raise exception
      'PARTIAL OBLIGATION STATUS FAILED: %',
      v_status;
  end if;

  -- Verification replay must not duplicate allocations.
  perform public.verify_and_allocate_donation_payment(
    v_payment.id,
    'don-test-verify-partial'
  );

  select count(*)
  into v_count
  from public.donation_payment_allocations
  where payment_id = v_payment.id;

  if v_count <> 1 then
    raise exception
      'VERIFICATION REPLAY DUPLICATED ALLOCATIONS: %',
      v_count;
  end if;

  -- --------------------------------------------------------------------------
  -- Multi-month FIFO + overpayment
  --
  -- Jan remaining = 25000
  -- Feb remaining = 50000
  -- Payment = 100000
  -- Expected:
  --   Jan 25000
  --   Feb 50000
  --   overpayment additional donation 25000
  -- --------------------------------------------------------------------------

  perform set_config('request.jwt.claim.sub', v_member_auth::text, true);

  select *
  into v_payment
  from public.submit_donation_payment(
    100000,
    'bank_transfer',
    'don-test-payment-fifo-over'
  );

  perform set_config('request.jwt.claim.sub', v_president_auth::text, true);

  perform public.start_donation_payment_review(
    v_payment.id,
    'don-test-review-fifo-over'
  );

  perform public.verify_and_allocate_donation_payment(
    v_payment.id,
    'don-test-verify-fifo-over'
  );

  select coalesce(sum(allocated_amount_paise), 0)
  into v_amount
  from public.donation_payment_allocations
  where payment_id = v_payment.id
    and obligation_id = v_obligation_jan;

  if v_amount <> 25000 then
    raise exception
      'JAN FIFO REMAINDER FAILED: expected 25000, got %',
      v_amount;
  end if;

  select coalesce(sum(allocated_amount_paise), 0)
  into v_amount
  from public.donation_payment_allocations
  where payment_id = v_payment.id
    and obligation_id = v_obligation_feb;

  if v_amount <> 50000 then
    raise exception
      'FEB FIFO FAILED: expected 50000, got %',
      v_amount;
  end if;

  select coalesce(sum(amount_paise), 0)
  into v_amount
  from public.additional_donations
  where source_payment_id = v_payment.id
    and donation_kind = 'overpayment';

  if v_amount <> 25000 then
    raise exception
      'OVERPAYMENT CLASSIFICATION FAILED: expected 25000, got %',
      v_amount;
  end if;

  select count(*)
  into v_count
  from public.donation_payment_allocations
  where payment_id = v_payment.id
    and obligation_id = v_obligation_future;

  if v_count <> 0 then
    raise exception 'FUTURE-MONTH PREPAYMENT OCCURRED';
  end if;

  -- --------------------------------------------------------------------------
  -- Waiver
  -- --------------------------------------------------------------------------

  -- Create a current eligible obligation isolated from the settled Jan/Feb
  -- obligations.
  insert into public.donation_obligations (
    member_profile_id,
    obligation_rule_id,
    effective_month,
    authoritative_amount_paise,
    created_by_application_user_id,
    operation_id
  )
  values (
    v_member_profile,
    v_rule.id,
    date '2025-12-01',
    10000,
    v_president_app,
    'don-test-waiver-obligation'
  )
  returning id into v_obligation_jan;

  perform public.waive_donation_obligation(
    v_obligation_jan,
    4000,
    'Behavioral test waiver',
    'don-test-waiver'
  );

  select coalesce(sum(waived_amount_paise), 0)
  into v_amount
  from public.donation_obligation_waivers
  where obligation_id = v_obligation_jan;

  if v_amount <> 4000 then
    raise exception 'WAIVER RECORD FAILED';
  end if;

  begin
    perform public.waive_donation_obligation(
      v_obligation_jan,
      7000,
      'Too much waiver',
      'don-test-waiver-too-large'
    );

    raise exception 'EXPECTED waiver_exceeds_outstanding';
  exception
    when sqlstate '22023' then null;
  end;

  -- --------------------------------------------------------------------------
  -- Explicit additional donation
  -- --------------------------------------------------------------------------

  perform set_config('request.jwt.claim.sub', v_member_auth::text, true);

  perform public.create_additional_donation(
    12345,
    'don-test-additional'
  );

  select coalesce(sum(amount_paise), 0)
  into v_amount
  from public.additional_donations
  where member_profile_id = v_member_profile
    and donation_kind = 'additional'
    and operation_id = 'don-test-additional';

  if v_amount <> 12345 then
    raise exception 'EXPLICIT ADDITIONAL DONATION FAILED';
  end if;

  -- --------------------------------------------------------------------------
  -- Ordinary Member must not perform privileged financial commands
  -- --------------------------------------------------------------------------

  begin
    perform public.create_donation_obligation_rule(
      date '2098-01-01',
      50000,
      'don-test-member-rule-forbidden'
    );

    raise exception 'EXPECTED member rule authorization failure';
  exception
    when insufficient_privilege then null;
  end;

  begin
    perform public.waive_donation_obligation(
      v_obligation_jan,
      100,
      'Unauthorized waiver',
      'don-test-member-waiver-forbidden'
    );

    raise exception 'EXPECTED member waiver authorization failure';
  exception
    when insufficient_privilege then null;
  end;

  raise notice 'DONATION TRUSTED OPERATIONS V1 BEHAVIORAL TESTS PASSED';
end
$$;

-- ============================================================================
-- Direct authenticated mutation remains prohibited
-- ============================================================================

do $$
declare
  v_count integer;
begin
  select count(*)
  into v_count
  from information_schema.role_table_grants
  where table_schema = 'public'
    and grantee = 'authenticated'
    and (
      table_name like 'donation%'
      or table_name = 'additional_donations'
    )
    and privilege_type in ('INSERT', 'UPDATE', 'DELETE');

  if v_count <> 0 then
    raise exception
      'AUTHENTICATED MUTATION PRIVILEGE LEAK: %',
      v_count;
  end if;

  if has_table_privilege(
    'authenticated',
    'public.donation_operation_idempotency',
    'SELECT'
  ) then
    raise exception
      'IDEMPOTENCY REGISTRY MUST NOT BE CLIENT-READABLE';
  end if;

  raise notice 'DONATION TRUSTED OPERATIONS V1 PRIVILEGE TESTS PASSED';
end
$$;

rollback;

select
  (select count(*) from public.donation_obligation_rules)
    as rules_after_rollback,
  (select count(*) from public.donation_obligations)
    as obligations_after_rollback,
  (select count(*) from public.donation_payments)
    as payments_after_rollback,
  (select count(*) from public.donation_payment_allocations)
    as allocations_after_rollback,
  (select count(*) from public.donation_obligation_waivers)
    as waivers_after_rollback,
  (select count(*) from public.additional_donations)
    as additional_after_rollback;
