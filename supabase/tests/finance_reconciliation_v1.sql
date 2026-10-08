\set ON_ERROR_STOP on

begin;

\echo '============================================'
\echo ' FINANCE RECONCILIATION V1 TEST'
\echo '============================================'

-- ---------------------------------------------------------------------------
-- Test identities
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
    (
      '85000000-0000-0000-0000-000000000001'::uuid,
      'reconciliation-president@example.invalid'
    ),
    (
      '85000000-0000-0000-0000-000000000002'::uuid,
      'reconciliation-finance@example.invalid'
    ),
    (
      '85000000-0000-0000-0000-000000000003'::uuid,
      'reconciliation-auditor@example.invalid'
    ),
    (
      '85000000-0000-0000-0000-000000000004'::uuid,
      'reconciliation-member@example.invalid'
    )
) x(auth_id, email);

insert into public.application_users (
  id,
  auth_user_id,
  status
)
values
  (
    '86000000-0000-0000-0000-000000000001',
    '85000000-0000-0000-0000-000000000001',
    'active'
  ),
  (
    '86000000-0000-0000-0000-000000000002',
    '85000000-0000-0000-0000-000000000002',
    'active'
  ),
  (
    '86000000-0000-0000-0000-000000000003',
    '85000000-0000-0000-0000-000000000003',
    'active'
  ),
  (
    '86000000-0000-0000-0000-000000000004',
    '85000000-0000-0000-0000-000000000004',
    'active'
  );

insert into public.application_user_roles (
  application_user_id,
  role_id
)
select
  x.application_user_id,
  r.id
from (
  values
    (
      '86000000-0000-0000-0000-000000000001'::uuid,
      'president'
    ),
    (
      '86000000-0000-0000-0000-000000000002'::uuid,
      'finance'
    ),
    (
      '86000000-0000-0000-0000-000000000003'::uuid,
      'auditor'
    ),
    (
      '86000000-0000-0000-0000-000000000004'::uuid,
      'member'
    )
) x(application_user_id, role_key)
join public.roles r
  on r.key = x.role_key;

-- ---------------------------------------------------------------------------
-- Finance creates two accounts.
-- ---------------------------------------------------------------------------

select set_config(
  'request.jwt.claims',
  '{"sub":"85000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);

select id as bank_account_id
from public.create_finance_account(
  'Reconciliation Bank',
  'bank',
  'recon-test-bank-create'
)
\gset

select set_config(
  'test.bank_account_id',
  :'bank_account_id',
  true
);

select id as cash_account_id
from public.create_finance_account(
  'Reconciliation Cash',
  'cash',
  'recon-test-cash-create'
)
\gset

select set_config(
  'test.cash_account_id',
  :'cash_account_id',
  true
);

-- ---------------------------------------------------------------------------
-- Produce one authoritative ledger effect.
-- Finance submits; President approves.
-- ---------------------------------------------------------------------------

select id as expense_id
from public.submit_finance_expense(
  current_setting('test.bank_account_id')::uuid,
  2500,
  'Reconciliation opening sentinel',
  null,
  current_date,
  'recon-test-expense-submit'
)
\gset

select set_config(
  'request.jwt.claims',
  '{"sub":"85000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);

select id
from public.decide_finance_expense(
  :'expense_id'::uuid,
  'approve',
  null,
  'recon-test-expense-approve'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"85000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);

do $$
begin
  if (
    select balance_paise
    from public.finance_account_balances
    where finance_account_id =
      current_setting('test.bank_account_id')::uuid
  ) <> -2500 then
    raise exception
      'FAIL: authoritative bank balance setup is incorrect';
  end if;

  if (
    select balance_paise
    from public.finance_account_balances
    where finance_account_id =
      current_setting('test.cash_account_id')::uuid
  ) <> 0 then
    raise exception
      'FAIL: authoritative cash balance setup is incorrect';
  end if;
end $$;

\echo 'PASS: authoritative reconciliation test balances are established'

-- ---------------------------------------------------------------------------
-- Start an on-demand reconciliation.
-- ---------------------------------------------------------------------------

select id as reconciliation_id
from public.start_finance_reconciliation(
  'on_demand',
  null,
  current_date,
  'Daily Finance verification',
  'recon-test-start'
)
\gset

select set_config(
  'test.reconciliation_id',
  :'reconciliation_id',
  true
);

do $$
begin
  if (
    select count(*)
    from public.finance_reconciliation_items
    where reconciliation_id =
      current_setting('test.reconciliation_id')::uuid
  ) <> 2 then
    raise exception
      'FAIL: reconciliation did not snapshot all Finance accounts';
  end if;

  if (
    select system_balance_paise
    from public.finance_reconciliation_items
    where reconciliation_id =
      current_setting('test.reconciliation_id')::uuid
      and finance_account_id =
        current_setting('test.bank_account_id')::uuid
  ) <> -2500 then
    raise exception
      'FAIL: bank reconciliation snapshot is not ledger-derived';
  end if;

  if (
    select system_balance_paise
    from public.finance_reconciliation_items
    where reconciliation_id =
      current_setting('test.reconciliation_id')::uuid
      and finance_account_id =
        current_setting('test.cash_account_id')::uuid
  ) <> 0 then
    raise exception
      'FAIL: cash reconciliation snapshot is incorrect';
  end if;

  if (
    select count(*)
    from public.finance_audit_events
    where event_type = 'reconciliation_started'
      and entity_id =
        current_setting('test.reconciliation_id')::uuid
      and operation_id = 'recon-test-start'
  ) <> 1 then
    raise exception
      'FAIL: reconciliation start audit is missing';
  end if;

  if (
    select count(*)
    from public.finance_operation_idempotency
    where operation_id = 'recon-test-start'
      and operation_type = 'reconciliation_start'
      and result_entity_type = 'finance_reconciliation'
      and result_entity_id =
        current_setting('test.reconciliation_id')::uuid
  ) <> 1 then
    raise exception
      'FAIL: reconciliation start idempotency is missing';
  end if;
end $$;

\echo 'PASS: reconciliation starts from authoritative ledger-derived balances'

-- ---------------------------------------------------------------------------
-- Exact start replay is idempotent.
-- ---------------------------------------------------------------------------

select id
from public.start_finance_reconciliation(
  'on_demand',
  null,
  current_date,
  'Daily Finance verification',
  'recon-test-start'
);

do $$
begin
  if (
    select count(*)
    from public.finance_audit_events
    where event_type = 'reconciliation_started'
      and operation_id = 'recon-test-start'
  ) <> 1 then
    raise exception
      'FAIL: reconciliation start replay duplicated audit';
  end if;
end $$;

\echo 'PASS: exact reconciliation start replay is idempotent'

-- ---------------------------------------------------------------------------
-- Changed request under the same operation ID must conflict.
-- ---------------------------------------------------------------------------

do $$
begin
  begin
    perform public.start_finance_reconciliation(
      'on_demand',
      null,
      current_date - 1,
      'Different request',
      'recon-test-start'
    );

    raise exception
      'FAIL: changed reconciliation replay was accepted';
  exception
    when unique_violation then
      null;
  end;
end $$;

\echo 'PASS: changed reconciliation start replay is rejected'

-- ---------------------------------------------------------------------------
-- Record an exact external match for bank.
-- ---------------------------------------------------------------------------

select id as bank_item_id
from public.record_finance_reconciliation_item(
  current_setting('test.reconciliation_id')::uuid,
  current_setting('test.bank_account_id')::uuid,
  -2500,
  'bank_statement',
  'BANK-STMT-001',
  null,
  'recon-test-bank-record'
)
\gset

select set_config(
  'test.bank_item_id',
  :'bank_item_id',
  true
);

do $$
begin
  if (
    select discrepancy_status
    from public.finance_reconciliation_items
    where id = current_setting('test.bank_item_id')::uuid
  ) <> 'matched' then
    raise exception
      'FAIL: exact external match was not marked matched';
  end if;

  if (
    select difference_paise
    from public.finance_reconciliation_items
    where id = current_setting('test.bank_item_id')::uuid
  ) <> 0 then
    raise exception
      'FAIL: exact external match has non-zero difference';
  end if;
end $$;

\echo 'PASS: exact external balance is recorded as matched'

-- ---------------------------------------------------------------------------
-- Cash mismatch must be explicit and completion must be blocked.
-- ---------------------------------------------------------------------------

select id as cash_item_id
from public.record_finance_reconciliation_item(
  current_setting('test.reconciliation_id')::uuid,
  current_setting('test.cash_account_id')::uuid,
  1000,
  'cash_count',
  'Physical cash count',
  null,
  'recon-test-cash-open'
)
\gset

select set_config(
  'test.cash_item_id',
  :'cash_item_id',
  true
);

do $$
begin
  if (
    select difference_paise
    from public.finance_reconciliation_items
    where id = current_setting('test.cash_item_id')::uuid
  ) <> 1000 then
    raise exception
      'FAIL: cash discrepancy amount is incorrect';
  end if;

  if (
    select discrepancy_status
    from public.finance_reconciliation_items
    where id = current_setting('test.cash_item_id')::uuid
  ) <> 'open' then
    raise exception
      'FAIL: unexplained discrepancy was not marked open';
  end if;

  if (
    select count(*)
    from public.finance_audit_events
    where event_type = 'reconciliation_discrepancy_recorded'
      and entity_id =
        current_setting('test.cash_item_id')::uuid
      and operation_id = 'recon-test-cash-open'
  ) <> 1 then
    raise exception
      'FAIL: discrepancy audit event is missing';
  end if;

  begin
    perform public.complete_finance_reconciliation(
      current_setting('test.reconciliation_id')::uuid,
      'Should not complete',
      'recon-test-complete-too-early'
    );

    raise exception
      'FAIL: unresolved reconciliation discrepancy was completed';
  exception
    when object_not_in_prerequisite_state then
      null;
  end;

  if exists (
    select 1
    from public.finance_operation_idempotency
    where operation_id = 'recon-test-complete-too-early'
  ) then
    raise exception
      'FAIL: rejected completion left idempotency state';
  end if;
end $$;

\echo 'PASS: discrepancy is recorded and blocks completion until investigated'

-- ---------------------------------------------------------------------------
-- Investigate discrepancy. Reconciliation must not repair the ledger.
-- ---------------------------------------------------------------------------

select id
from public.record_finance_reconciliation_item(
  current_setting('test.reconciliation_id')::uuid,
  current_setting('test.cash_account_id')::uuid,
  1000,
  'cash_count',
  'Physical cash count',
  'Cash count exceeds ledger by Rs 10; retained for follow-up.',
  'recon-test-cash-investigated'
);

do $$
begin
  if (
    select discrepancy_status
    from public.finance_reconciliation_items
    where id = current_setting('test.cash_item_id')::uuid
  ) <> 'investigated' then
    raise exception
      'FAIL: investigated discrepancy did not transition correctly';
  end if;

  if (
    select balance_paise
    from public.finance_account_balances
    where finance_account_id =
      current_setting('test.cash_account_id')::uuid
  ) <> 0 then
    raise exception
      'FAIL: reconciliation silently changed authoritative cash balance';
  end if;

  if exists (
    select 1
    from public.financial_transactions
    where finance_account_id =
      current_setting('test.cash_account_id')::uuid
  ) then
    raise exception
      'FAIL: reconciliation created a ledger transaction for discrepancy';
  end if;
end $$;

\echo 'PASS: investigated discrepancy remains evidence and does not repair ledger'

-- ---------------------------------------------------------------------------
-- Record replay is idempotent.
-- ---------------------------------------------------------------------------

select id
from public.record_finance_reconciliation_item(
  current_setting('test.reconciliation_id')::uuid,
  current_setting('test.cash_account_id')::uuid,
  1000,
  'cash_count',
  'Physical cash count',
  'Cash count exceeds ledger by Rs 10; retained for follow-up.',
  'recon-test-cash-investigated'
);

do $$
begin
  if (
    select count(*)
    from public.finance_audit_events
    where event_type = 'reconciliation_item_recorded'
      and operation_id = 'recon-test-cash-investigated'
  ) <> 1 then
    raise exception
      'FAIL: reconciliation item replay duplicated audit';
  end if;
end $$;

\echo 'PASS: exact reconciliation item replay is idempotent'

-- ---------------------------------------------------------------------------
-- Complete reconciliation after every item is reconciled/investigated.
-- ---------------------------------------------------------------------------

select id
from public.complete_finance_reconciliation(
  current_setting('test.reconciliation_id')::uuid,
  'Reviewed by Finance',
  'recon-test-complete'
);

do $$
begin
  if (
    select status
    from public.finance_reconciliations
    where id = current_setting('test.reconciliation_id')::uuid
  ) <> 'completed' then
    raise exception
      'FAIL: valid reconciliation was not completed';
  end if;

  if (
    select count(*)
    from public.finance_audit_events
    where event_type = 'reconciliation_completed'
      and entity_id =
        current_setting('test.reconciliation_id')::uuid
      and operation_id = 'recon-test-complete'
  ) <> 1 then
    raise exception
      'FAIL: reconciliation completion audit is missing';
  end if;

  if (
    select count(*)
    from public.finance_operation_idempotency
    where operation_id = 'recon-test-complete'
      and operation_type = 'reconciliation_complete'
      and result_entity_type = 'finance_reconciliation'
  ) <> 1 then
    raise exception
      'FAIL: reconciliation completion idempotency is missing';
  end if;
end $$;

\echo 'PASS: fully reviewed reconciliation completes with audit and idempotency'

-- ---------------------------------------------------------------------------
-- Completed reconciliation and its items are immutable.
-- ---------------------------------------------------------------------------

do $$
begin
  begin
    update public.finance_reconciliations
    set completion_notes = 'tampered'
    where id = current_setting('test.reconciliation_id')::uuid;

    raise exception
      'FAIL: completed reconciliation header was mutable';
  exception
    when object_not_in_prerequisite_state then
      null;
  end;

  begin
    update public.finance_reconciliation_items
    set external_balance_paise = 999999
    where id = current_setting('test.cash_item_id')::uuid;

    raise exception
      'FAIL: completed reconciliation item was mutable';
  exception
    when object_not_in_prerequisite_state then
      null;
  end;

  begin
    delete from public.finance_reconciliation_items
    where id = current_setting('test.cash_item_id')::uuid;

    raise exception
      'FAIL: reconciliation item could be deleted';
  exception
    when object_not_in_prerequisite_state then
      null;
  end;
end $$;

\echo 'PASS: completed reconciliation history is immutable'

-- ---------------------------------------------------------------------------
-- Monthly run normalizes period and prevents duplicate formal run.
-- Use previous month so the period end is not in the future.
-- ---------------------------------------------------------------------------

select id as monthly_reconciliation_id
from public.start_finance_reconciliation(
  'monthly',
  (
    date_trunc('month', current_date)::date
    - interval '1 month'
    + interval '10 days'
  )::date,
  null,
  'Prior month formal reconciliation',
  'recon-test-monthly'
)
\gset

select set_config(
  'test.monthly_reconciliation_id',
  :'monthly_reconciliation_id',
  true
);

do $$
declare
  v_expected_month date :=
    (
      date_trunc('month', current_date)::date
      - interval '1 month'
    )::date;
  v_expected_end date :=
    (
      date_trunc('month', current_date)::date
      - interval '1 day'
    )::date;
begin
  if (
    select period_month
    from public.finance_reconciliations
    where id =
      current_setting('test.monthly_reconciliation_id')::uuid
  ) <> v_expected_month then
    raise exception
      'FAIL: monthly reconciliation period was not normalized';
  end if;

  if (
    select as_of_business_date
    from public.finance_reconciliations
    where id =
      current_setting('test.monthly_reconciliation_id')::uuid
  ) <> v_expected_end then
    raise exception
      'FAIL: monthly reconciliation as-of date is incorrect';
  end if;

  begin
    perform public.start_finance_reconciliation(
      'monthly',
      v_expected_month,
      null,
      'Duplicate formal month',
      'recon-test-monthly-duplicate'
    );

    raise exception
      'FAIL: duplicate monthly reconciliation was accepted';
  exception
    when unique_violation then
      null;
  end;
end $$;

\echo 'PASS: formal monthly reconciliation has deterministic period semantics'

-- ---------------------------------------------------------------------------
-- Pending account evidence prevents completion.
-- ---------------------------------------------------------------------------

select id as incomplete_reconciliation_id
from public.start_finance_reconciliation(
  'on_demand',
  null,
  current_date,
  'Incomplete evidence test',
  'recon-test-incomplete-start'
)
\gset

select set_config(
  'test.incomplete_reconciliation_id',
  :'incomplete_reconciliation_id',
  true
);

select id
from public.record_finance_reconciliation_item(
  current_setting('test.incomplete_reconciliation_id')::uuid,
  current_setting('test.bank_account_id')::uuid,
  -2500,
  'bank_statement',
  'BANK-STMT-INCOMPLETE',
  null,
  'recon-test-incomplete-bank'
);

do $$
begin
  begin
    perform public.complete_finance_reconciliation(
      current_setting('test.incomplete_reconciliation_id')::uuid,
      null,
      'recon-test-incomplete-complete'
    );

    raise exception
      'FAIL: reconciliation completed with pending account evidence';
  exception
    when object_not_in_prerequisite_state then
      null;
  end;
end $$;

\echo 'PASS: every reconciliation account requires external evidence'

-- ---------------------------------------------------------------------------
-- Stale ledger snapshot must block completion.
-- ---------------------------------------------------------------------------

select id as stale_reconciliation_id
from public.start_finance_reconciliation(
  'on_demand',
  null,
  current_date,
  'Stale snapshot test',
  'recon-test-stale-start'
)
\gset

select set_config(
  'test.stale_reconciliation_id',
  :'stale_reconciliation_id',
  true
);

select id
from public.record_finance_reconciliation_item(
  current_setting('test.stale_reconciliation_id')::uuid,
  current_setting('test.bank_account_id')::uuid,
  -2500,
  'bank_statement',
  'BANK-STMT-STALE',
  null,
  'recon-test-stale-bank-before'
);

select id
from public.record_finance_reconciliation_item(
  current_setting('test.stale_reconciliation_id')::uuid,
  current_setting('test.cash_account_id')::uuid,
  0,
  'cash_count',
  'Zero cash count',
  null,
  'recon-test-stale-cash'
);

-- Post another authoritative expense after evidence was recorded.
select id as stale_expense_id
from public.submit_finance_expense(
  current_setting('test.bank_account_id')::uuid,
  500,
  'Late reconciliation sentinel',
  null,
  current_date,
  'recon-test-stale-expense-submit'
)
\gset

select set_config(
  'request.jwt.claims',
  '{"sub":"85000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);

select id
from public.decide_finance_expense(
  :'stale_expense_id'::uuid,
  'approve',
  null,
  'recon-test-stale-expense-approve'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"85000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);

do $$
begin
  begin
    perform public.complete_finance_reconciliation(
      current_setting('test.stale_reconciliation_id')::uuid,
      null,
      'recon-test-stale-complete-fail'
    );

    raise exception
      'FAIL: stale reconciliation snapshot completed';
  exception
    when object_not_in_prerequisite_state then
      null;
  end;
end $$;

\echo 'PASS: authoritative ledger change invalidates stale reconciliation evidence'

-- Re-record affected account against the new authoritative balance.
select id
from public.record_finance_reconciliation_item(
  current_setting('test.stale_reconciliation_id')::uuid,
  current_setting('test.bank_account_id')::uuid,
  -3000,
  'bank_statement',
  'BANK-STMT-STALE-UPDATED',
  null,
  'recon-test-stale-bank-after'
);

select id
from public.complete_finance_reconciliation(
  current_setting('test.stale_reconciliation_id')::uuid,
  'Evidence refreshed after authoritative posting',
  'recon-test-stale-complete'
);

\echo 'PASS: stale account can be re-reconciled before completion'

-- ---------------------------------------------------------------------------
-- Auditor and Member cannot mutate reconciliation.
-- ---------------------------------------------------------------------------

select set_config(
  'request.jwt.claims',
  '{"sub":"85000000-0000-0000-0000-000000000003","role":"authenticated"}',
  true
);

do $$
begin
  begin
    perform public.start_finance_reconciliation(
      'on_demand',
      null,
      current_date,
      null,
      'recon-test-auditor-start'
    );

    raise exception
      'FAIL: Auditor started Finance reconciliation';
  exception
    when insufficient_privilege then
      null;
  end;
end $$;

select set_config(
  'request.jwt.claims',
  '{"sub":"85000000-0000-0000-0000-000000000004","role":"authenticated"}',
  true
);

do $$
begin
  begin
    perform public.start_finance_reconciliation(
      'on_demand',
      null,
      current_date,
      null,
      'recon-test-member-start'
    );

    raise exception
      'FAIL: Member started Finance reconciliation';
  exception
    when insufficient_privilege then
      null;
  end;
end $$;

\echo 'PASS: Auditor and Member cannot mutate Finance reconciliation'

-- ---------------------------------------------------------------------------
-- Auditor has read-only reconciliation oversight via audit.records.read.
-- Member does not.
-- ---------------------------------------------------------------------------

set local role authenticated;

select set_config(
  'request.jwt.claims',
  '{"sub":"85000000-0000-0000-0000-000000000003","role":"authenticated"}',
  true
);

do $$
begin
  if not exists (
    select 1
    from public.finance_reconciliations
    where id = current_setting('test.reconciliation_id')::uuid
  ) then
    raise exception
      'FAIL: Auditor cannot read reconciliation oversight history';
  end if;
end $$;

select set_config(
  'request.jwt.claims',
  '{"sub":"85000000-0000-0000-0000-000000000004","role":"authenticated"}',
  true
);

do $$
begin
  if exists (
    select 1
    from public.finance_reconciliations
    where id = current_setting('test.reconciliation_id')::uuid
  ) then
    raise exception
      'FAIL: Member can read Finance reconciliation history';
  end if;
end $$;

reset role;

\echo 'PASS: reconciliation oversight is read-only for Auditor and hidden from Member'

-- ---------------------------------------------------------------------------
-- Failure during audit insertion must roll reconciliation start back.
-- ---------------------------------------------------------------------------

select set_config(
  'request.jwt.claims',
  '{"sub":"85000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);

create or replace function public.test_fail_reconciliation_audit()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if new.event_type = 'reconciliation_started'
     and new.operation_id = 'recon-test-rollback' then
    raise exception 'forced_reconciliation_audit_failure';
  end if;

  return new;
end;
$$;

create trigger test_fail_reconciliation_audit
before insert on public.finance_audit_events
for each row
execute function public.test_fail_reconciliation_audit();

do $$
declare
  v_before_count bigint;
begin
  select count(*)
  into v_before_count
  from public.finance_reconciliations;

  begin
    perform public.start_finance_reconciliation(
      'on_demand',
      null,
      current_date,
      'Atomic rollback test',
      'recon-test-rollback'
    );

    raise exception
      'FAIL: forced reconciliation audit failure did not fail';
  exception
    when raise_exception then
      null;
  end;

  if (
    select count(*)
    from public.finance_reconciliations
  ) <> v_before_count then
    raise exception
      'FAIL: audit failure left reconciliation header state';
  end if;

  if exists (
    select 1
    from public.finance_operation_idempotency
    where operation_id = 'recon-test-rollback'
  ) then
    raise exception
      'FAIL: audit failure left reconciliation idempotency state';
  end if;

  if exists (
    select 1
    from public.finance_audit_events
    where operation_id = 'recon-test-rollback'
  ) then
    raise exception
      'FAIL: audit failure left partial audit state';
  end if;
end $$;

drop trigger test_fail_reconciliation_audit
  on public.finance_audit_events;

drop function public.test_fail_reconciliation_audit();

\echo 'PASS: reconciliation audit failure rolls back atomically'

-- ---------------------------------------------------------------------------
-- Reconciliation itself must not create correction/reversal/ledger effects.
-- ---------------------------------------------------------------------------

do $$
begin
  if exists (
    select 1
    from public.financial_transactions
    where finance_account_id =
      current_setting('test.cash_account_id')::uuid
  ) then
    raise exception
      'FAIL: reconciliation discrepancy mutated cash ledger';
  end if;

  if exists (
    select 1
    from public.finance_adjustments
    where reason ilike '%reconciliation%'
  ) then
    raise exception
      'FAIL: reconciliation silently created Finance adjustment';
  end if;
end $$;

\echo 'PASS: reconciliation never silently repairs authoritative Finance state'

-- ---------------------------------------------------------------------------
-- RPC privilege boundary.
-- ---------------------------------------------------------------------------

do $$
begin
  if has_function_privilege(
    'anon',
    'public.start_finance_reconciliation(text,date,date,text,text)',
    'execute'
  ) then
    raise exception
      'FAIL: anon can execute reconciliation start';
  end if;

  if has_function_privilege(
    'anon',
    'public.record_finance_reconciliation_item(uuid,uuid,bigint,text,text,text,text)',
    'execute'
  ) then
    raise exception
      'FAIL: anon can execute reconciliation item recording';
  end if;

  if has_function_privilege(
    'anon',
    'public.complete_finance_reconciliation(uuid,text,text)',
    'execute'
  ) then
    raise exception
      'FAIL: anon can execute reconciliation completion';
  end if;

  if not has_function_privilege(
    'authenticated',
    'public.start_finance_reconciliation(text,date,date,text,text)',
    'execute'
  ) then
    raise exception
      'FAIL: authenticated lacks reconciliation start RPC';
  end if;

  if not has_function_privilege(
    'authenticated',
    'public.record_finance_reconciliation_item(uuid,uuid,bigint,text,text,text,text)',
    'execute'
  ) then
    raise exception
      'FAIL: authenticated lacks reconciliation item RPC';
  end if;

  if not has_function_privilege(
    'authenticated',
    'public.complete_finance_reconciliation(uuid,text,text)',
    'execute'
  ) then
    raise exception
      'FAIL: authenticated lacks reconciliation completion RPC';
  end if;

  if has_function_privilege(
    'service_role',
    'public.start_finance_reconciliation(text,date,date,text,text)',
    'execute'
  ) then
    raise exception
      'FAIL: service_role has unnecessary direct reconciliation start grant';
  end if;

  if has_function_privilege(
    'service_role',
    'public.record_finance_reconciliation_item(uuid,uuid,bigint,text,text,text,text)',
    'execute'
  ) then
    raise exception
      'FAIL: service_role has unnecessary direct reconciliation item grant';
  end if;

  if has_function_privilege(
    'service_role',
    'public.complete_finance_reconciliation(uuid,text,text)',
    'execute'
  ) then
    raise exception
      'FAIL: service_role has unnecessary direct reconciliation completion grant';
  end if;
end $$;

\echo 'PASS: reconciliation RPC privilege boundary is correct'

\echo '============================================'
\echo ' ALL FINANCE RECONCILIATION TESTS PASSED'
\echo '============================================'

rollback;
