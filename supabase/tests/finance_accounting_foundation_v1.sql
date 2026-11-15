\set ON_ERROR_STOP on

begin;

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at
)
select
  x.auth_id,
  '00000000-0000-0000-0000-000000000000'::uuid,
  'authenticated', 'authenticated', x.email, '', now(), now(), now()
from (values
  ('71000000-0000-0000-0000-000000000001'::uuid, 'finance-president@example.invalid'),
  ('71000000-0000-0000-0000-000000000002'::uuid, 'finance-vp@example.invalid'),
  ('71000000-0000-0000-0000-000000000003'::uuid, 'finance-user@example.invalid'),
  ('71000000-0000-0000-0000-000000000004'::uuid, 'finance-auditor@example.invalid'),
  ('71000000-0000-0000-0000-000000000005'::uuid, 'finance-member@example.invalid')
) x(auth_id, email);

insert into public.application_users (id, auth_user_id, status)
values
  ('72000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000001', 'active'),
  ('72000000-0000-0000-0000-000000000002', '71000000-0000-0000-0000-000000000002', 'active'),
  ('72000000-0000-0000-0000-000000000003', '71000000-0000-0000-0000-000000000003', 'active'),
  ('72000000-0000-0000-0000-000000000004', '71000000-0000-0000-0000-000000000004', 'active'),
  ('72000000-0000-0000-0000-000000000005', '71000000-0000-0000-0000-000000000005', 'active');

insert into public.application_user_roles (application_user_id, role_id)
select x.application_user_id, r.id
from (values
  ('72000000-0000-0000-0000-000000000001'::uuid, 'president'),
  ('72000000-0000-0000-0000-000000000002'::uuid, 'vice_president'),
  ('72000000-0000-0000-0000-000000000003'::uuid, 'finance'),
  ('72000000-0000-0000-0000-000000000004'::uuid, 'auditor'),
  ('72000000-0000-0000-0000-000000000005'::uuid, 'member')
) x(application_user_id, role_key)
join public.roles r on r.key = x.role_key;

do $$
begin
  if (select count(distinct r.key) from public.role_permissions rp
      join public.roles r on r.id = rp.role_id
      join public.permissions p on p.id = rp.permission_id
      where r.key in ('president','vice_president','secretary','finance','committee_member')
        and p.key = 'finance.expenses.create') <> 5 then
    raise exception 'FAIL: required roles cannot submit expenses'; end if;
  if (select count(distinct r.key) from public.role_permissions rp
      join public.roles r on r.id = rp.role_id
      join public.permissions p on p.id = rp.permission_id
      where r.key in ('president','vice_president') and p.key = 'finance.expenses.approve') <> 2
    or exists (select 1 from public.role_permissions rp
      join public.roles r on r.id = rp.role_id
      join public.permissions p on p.id = rp.permission_id
      where r.key = 'finance' and p.key = 'finance.expenses.approve') then
    raise exception 'FAIL: expense approval permissions incorrect'; end if;
end $$;

-- Finance may create organizational accounts. A matching replay returns the
-- same resource while a changed payload using the same operation ID conflicts.
select set_config('request.jwt.claims', '{"sub":"71000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
select id as cash_account_id from public.create_finance_account(
  'Main cash', 'cash', 'finance-test-account-cash'
) \gset
select id as bank_account_id from public.create_finance_account(
  'Main bank', 'bank', 'finance-test-account-bank'
) \gset
select id as spare_account_id from public.create_finance_account(
  'Spare cash', 'cash', 'finance-test-account-spare'
) \gset

do $$
declare v_replay public.finance_accounts;
begin
  select * into v_replay from public.create_finance_account(
    'Main cash', 'cash', 'finance-test-account-cash'
  );
  if v_replay.id <> (select id from public.finance_accounts where name = 'Main cash') then
    raise exception 'FAIL: account replay changed resource identity';
  end if;
  if (select count(*) from public.finance_accounts where name = 'Main cash') <> 1 then
    raise exception 'FAIL: account replay duplicated the account';
  end if;
  begin
    perform public.create_finance_account(
      'Changed account', 'cash', 'finance-test-account-cash'
    );
    raise exception 'FAIL: conflicting account replay was accepted';
  exception when unique_violation then null;
  end;
end $$;

-- Ordinary Members and Auditors cannot mutate finance state.
select set_config('request.jwt.claims', '{"sub":"71000000-0000-0000-0000-000000000005","role":"authenticated"}', true);
do $$
begin
  begin
    perform public.create_finance_account('Forbidden', 'cash', 'finance-test-member-account');
    raise exception 'FAIL: Member created a finance account';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.submit_finance_expense(
      (select id from public.finance_accounts where name = 'Main cash'),
      100, 'Forbidden expense', null,
      current_date, 'finance-test-member-expense'
    );
    raise exception 'FAIL: Member submitted an expense';
  exception when insufficient_privilege then null;
  end;
end $$;

select set_config('request.jwt.claims', '{"sub":"71000000-0000-0000-0000-000000000004","role":"authenticated"}', true);
do $$
begin
  begin
    perform public.submit_finance_transfer(
      (select id from public.finance_accounts where name = 'Main cash'),
      (select id from public.finance_accounts where name = 'Main bank'), 100,
      'Forbidden transfer', current_date, 'finance-test-auditor-transfer'
    );
    raise exception 'FAIL: Auditor submitted a transfer';
  exception when insufficient_privilege then null;
  end;
end $$;

-- President and Vice President may submit their own requests.
select set_config('request.jwt.claims', '{"sub":"71000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
select id from public.submit_finance_expense(
  (select id from public.finance_accounts where name = 'Main cash'),
  100, 'President-submitted expense', null, current_date, 'finance-test-president-expense-submit'
);
select set_config('request.jwt.claims', '{"sub":"71000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
select id from public.submit_finance_expense(
  (select id from public.finance_accounts where name = 'Main cash'),
  100, 'Vice-President-submitted expense', null, current_date, 'finance-test-vp-expense-submit'
);

-- Approval creates no financial effect; Treasurer payments post separately.
select set_config('request.jwt.claims', '{"sub":"71000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
select id as expense_id from public.submit_finance_expense(
  (select id from public.finance_accounts where name = 'Main cash'),
  125000, 'Approved maintenance expense',
  'Local supplier', current_date - 1, 'finance-test-expense-submit'
) \gset

do $$
begin
  begin
    perform public.decide_finance_expense(
      (select id from public.finance_expenses where description = 'Approved maintenance expense'),
      'approve', null, 'finance-test-expense-self-approve'
    );
    raise exception 'FAIL: expense maker approved own expense';
  exception when insufficient_privilege then null;
  end;
  if exists (
    select 1 from public.finance_operation_idempotency
    where operation_id = 'finance-test-expense-self-approve'
  ) then raise exception 'FAIL: denied expense decision recorded idempotency'; end if;
end $$;

-- Vice President is also authorized to approve; exercise President below.
select set_config('request.jwt.claims', '{"sub":"71000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
-- No bill and no explanation must block a decision.
do $$
begin
  begin
    perform public.decide_finance_expense(
      (select id from public.finance_expenses where description = 'Approved maintenance expense'),
      'approve', null, 'finance-test-expense-no-evidence');
    raise exception 'FAIL: expense without evidence approved';
  exception when invalid_parameter_value then null; end;
end $$;
select set_config('request.jwt.claims', '{"sub":"71000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
select id from public.set_finance_expense_missing_bill_reason(
  (select id from public.finance_expenses where description = 'Approved maintenance expense'),
  'Supplier provided no printed receipt.'
);
select set_config('request.jwt.claims', '{"sub":"71000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
select id from public.decide_finance_expense(
  (select id from public.finance_expenses where description = 'Approved maintenance expense'),
  'approve', null, 'finance-test-expense-approve'
);
select id from public.decide_finance_expense(
  (select id from public.finance_expenses where description = 'Approved maintenance expense'),
  'approve', null, 'finance-test-expense-approve'
);

do $$
begin
  if (select status from public.finance_expenses where description = 'Approved maintenance expense') <> 'approved' then
    raise exception 'FAIL: expense did not remain unpaid after approval'; end if;
  if exists (select 1 from public.financial_transactions where reference_type = 'finance_expense'
    and reference_id = (select id from public.finance_expenses where description = 'Approved maintenance expense')) then
    raise exception 'FAIL: approval posted an outflow'; end if;
end $$;

select set_config('request.jwt.claims', '{"sub":"71000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
do $$
begin
  begin
    perform public.pay_finance_expense(
      (select id from public.finance_expenses where description = 'President-submitted expense'),
      100, current_date, 'finance-test-unapproved-payment');
    raise exception 'FAIL: unapproved expense was paid';
  exception when invalid_parameter_value then null; end;
end $$;
select id from public.pay_finance_expense(
  (select id from public.finance_expenses where description = 'Approved maintenance expense'),
  25000, current_date, 'finance-test-part-payment'
);
do $$
begin
  if (select status from public.finance_expenses where description = 'Approved maintenance expense') <> 'partially_paid' then
    raise exception 'FAIL: partial payment state incorrect'; end if;
  begin
    perform public.pay_finance_expense(
      (select id from public.finance_expenses where description = 'Approved maintenance expense'),
      100001, current_date, 'finance-test-overpay');
    raise exception 'FAIL: overpayment accepted';
  exception when invalid_parameter_value then null; end;
end $$;
select id from public.pay_finance_expense(
  (select id from public.finance_expenses where description = 'Approved maintenance expense'),
  25000, current_date, 'finance-test-part-payment'
);
do $$
begin
  if (select paid_amount_paise from public.finance_expenses where description = 'Approved maintenance expense') <> 25000
     or (select count(*) from public.financial_transactions where operation_id = 'finance-test-part-payment') <> 1 then
    raise exception 'FAIL: payment retry duplicated financial effect'; end if;
end $$;
select id from public.pay_finance_expense(
  (select id from public.finance_expenses where description = 'Approved maintenance expense'),
  100000, current_date, 'finance-test-final-payment'
);

select set_config('request.jwt.claims', '{"sub":"71000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
do $$
begin
  if (select status from public.finance_expenses where description = 'Approved maintenance expense') <> 'posted' then
    raise exception 'FAIL: settled expense not posted'; end if;
  if (select count(*) from public.financial_transactions
      where reference_type = 'finance_expense'
        and reference_id = (select id from public.finance_expenses where description = 'Approved maintenance expense')) <> 2 then
    raise exception 'FAIL: expense payment count mismatch';
  end if;
  if not exists (
    select 1 from public.financial_transactions
    where reference_id = (select id from public.finance_expenses where description = 'Approved maintenance expense')
      and transaction_category = 'EXPENSE'
      and direction = 'outflow'
      and amount_paise = 100000
  ) then raise exception 'FAIL: expense financial effect is incorrect'; end if;
  begin
    perform public.decide_finance_expense(
      (select id from public.finance_expenses where description = 'Approved maintenance expense'),
      'reject', 'Changed replay', 'finance-test-expense-approve'
    );
    raise exception 'FAIL: changed expense replay was accepted';
  exception when unique_violation then null;
  end;
  begin
    perform public.decide_finance_expense(
      (select id from public.finance_expenses where description = 'Approved maintenance expense'),
      'reject', 'Too late', 'finance-test-expense-invalid-state'
    );
    raise exception 'FAIL: posted expense accepted another transition';
  exception when invalid_parameter_value then null;
  end;
end $$;

select id from public.set_finance_expense_missing_bill_reason(
  (select id from public.finance_expenses where description = 'President-submitted expense'),
  'Supplier gave no printed invoice.'
);
-- President's own request is approvable, but remains unpaid.
select id from public.decide_finance_expense(
  (select id from public.finance_expenses where description = 'President-submitted expense'),
  'approve', null, 'finance-test-president-self-approve'
);
do $$
begin
  if (select status from public.finance_expenses where description = 'President-submitted expense') <> 'approved' then
    raise exception 'FAIL: President self approval was blocked'; end if;
  if exists (select 1 from public.financial_transactions
    where reference_id = (select id from public.finance_expenses where description = 'President-submitted expense')) then
    raise exception 'FAIL: self approval posted an outflow'; end if;
end $$;

-- A successful replay still requires the President's current permission.
delete from public.role_permissions
where role_id = (select id from public.roles where key = 'president')
  and permission_id = (
    select id from public.permissions where key = 'finance.expenses.approve'
  );
select set_config('request.jwt.claims', '{"sub":"71000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
do $$
begin
  begin
    perform public.decide_finance_expense(
      (select id from public.finance_expenses where description = 'Approved maintenance expense'),
      'approve', null, 'finance-test-expense-approve'
    );
    raise exception 'FAIL: expense replay bypassed current permission';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Transfer approval creates both balanced effects in the same transaction.
select set_config('request.jwt.claims', '{"sub":"71000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
do $$
begin
  begin
    perform public.submit_finance_transfer(
      (select id from public.finance_accounts where name = 'Main cash'),
      (select id from public.finance_accounts where name = 'Main cash'), 100,
      'Invalid self transfer', current_date, 'finance-test-transfer-self'
    );
    raise exception 'FAIL: same-account transfer was accepted';
  exception when invalid_parameter_value then null;
  end;
end $$;

select id as transfer_id from public.submit_finance_transfer(
  (select id from public.finance_accounts where name = 'Main cash'),
  (select id from public.finance_accounts where name = 'Main bank'), 50000,
  'Deposit cash', current_date, 'finance-test-transfer-submit'
) \gset

do $$
begin
  begin
    perform public.decide_finance_transfer(
      (select id from public.finance_transfers where reason = 'Deposit cash'),
      'approve', null, 'finance-test-transfer-self-approve'
    );
    raise exception 'FAIL: transfer maker approved own transfer';
  exception when insufficient_privilege then null;
  end;
end $$;

select set_config('request.jwt.claims', '{"sub":"71000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
select id from public.decide_finance_transfer(
  (select id from public.finance_transfers where reason = 'Deposit cash'),
  'approve', null, 'finance-test-transfer-approve'
);
select id from public.decide_finance_transfer(
  (select id from public.finance_transfers where reason = 'Deposit cash'),
  'approve', null, 'finance-test-transfer-approve'
);

do $$
begin
  if (select count(*) from public.financial_transactions
      where reference_type = 'finance_transfer'
        and reference_id = (select id from public.finance_transfers where reason = 'Deposit cash')) <> 2 then
    raise exception 'FAIL: transfer did not produce exactly two effects';
  end if;
  if (select coalesce(sum(case direction when 'inflow' then amount_paise else -amount_paise end), 0)
      from public.financial_transactions
      where reference_type = 'finance_transfer'
        and reference_id = (select id from public.finance_transfers where reason = 'Deposit cash')) <> 0 then
    raise exception 'FAIL: transfer effects are not balanced';
  end if;
  if (select count(*) from public.finance_audit_events
      where entity_id = (select id from public.finance_transfers where reason = 'Deposit cash')
        and event_type = 'transfer_approved') <> 1 then
    raise exception 'FAIL: transfer replay duplicated audit';
  end if;
end $$;

-- A consequential failure rolls back all effects, audit, lifecycle, and
-- idempotency records.
select set_config('request.jwt.claims', '{"sub":"71000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
select id as rollback_transfer_id from public.submit_finance_transfer(
  (select id from public.finance_accounts where name = 'Main cash'),
  (select id from public.finance_accounts where name = 'Spare cash'), 25000,
  'Rollback test', current_date, 'finance-test-transfer-rollback-submit'
) \gset
select id from public.set_finance_account_status(
  (select id from public.finance_accounts where name = 'Spare cash'),
  'inactive', 'finance-test-account-inactive'
);

select set_config('request.jwt.claims', '{"sub":"71000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
do $$
begin
  begin
    perform public.decide_finance_transfer(
      (select id from public.finance_transfers where reason = 'Rollback test'),
      'approve', null,
      'finance-test-transfer-rollback-approve'
    );
    raise exception 'FAIL: inactive-account transfer was approved';
  exception when invalid_parameter_value then null;
  end;
  if (select status from public.finance_transfers
      where reason = 'Rollback test') <> 'submitted' then
    raise exception 'FAIL: failed transfer changed lifecycle state';
  end if;
  if exists (
    select 1 from public.financial_transactions
    where reference_id = (select id from public.finance_transfers where reason = 'Rollback test')
  ) then raise exception 'FAIL: failed transfer left a financial effect'; end if;
  if exists (
    select 1 from public.finance_operation_idempotency
    where operation_id = 'finance-test-transfer-rollback-approve'
  ) then raise exception 'FAIL: failed transfer left idempotency state'; end if;
end $$;

-- Correction and reversal both preserve the original transaction and append
-- an explicitly related compensating effect after second-person approval.
select set_config('request.jwt.claims', '{"sub":"71000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
select id as correction_id from public.submit_finance_adjustment(
  (select posted_transaction_id from public.finance_expenses where description = 'Approved maintenance expense'),
  'correction', 'Correct a portion to the bank account',
  (select id from public.finance_accounts where name = 'Main bank'),
  'inflow', 5000, current_date,
  'finance-test-correction-submit'
) \gset
select id as reversal_id from public.submit_finance_adjustment(
  (select posted_transaction_id from public.finance_expenses where description = 'Approved maintenance expense'),
  'reversal', 'Reverse the original posted expense',
  null, null, null, current_date,
  'finance-test-reversal-submit'
) \gset

select set_config('request.jwt.claims', '{"sub":"71000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
select id from public.decide_finance_adjustment(
  (select id from public.finance_adjustments where reason = 'Correct a portion to the bank account'),
  'approve', null, 'finance-test-correction-approve'
);

-- A successful replay still requires the exact current permission. Retaining
-- another adjustment permission must not authorize a correction replay.
delete from public.role_permissions
where role_id = (select id from public.roles where key = 'president')
  and permission_id = (
    select id from public.permissions where key = 'finance.corrections.create'
  );
do $$
begin
  begin
    perform public.decide_finance_adjustment(
      (select id from public.finance_adjustments where reason = 'Correct a portion to the bank account'),
      'approve', null, 'finance-test-correction-approve'
    );
    raise exception 'FAIL: correction replay bypassed current permission';
  exception when insufficient_privilege then null;
  end;
end $$;

select set_config('request.jwt.claims', '{"sub":"71000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
select id from public.decide_finance_adjustment(
  (select id from public.finance_adjustments where reason = 'Reverse the original posted expense'),
  'approve', null, 'finance-test-reversal-approve'
);

do $$
declare
  v_original public.financial_transactions;
  v_reversal public.financial_transactions;
begin
  select * into v_original from public.financial_transactions
  where id = (select posted_transaction_id from public.finance_expenses where description = 'Approved maintenance expense');
  select * into v_reversal from public.financial_transactions
  where id = (select applied_transaction_id from public.finance_adjustments where reason = 'Reverse the original posted expense');
  if v_reversal.related_transaction_id <> v_original.id
     or v_reversal.amount_paise <> v_original.amount_paise
     or v_reversal.direction <> 'inflow'
     or v_reversal.transaction_category <> 'REVERSAL' then
    raise exception 'FAIL: reversal is not the expected compensating effect';
  end if;
  if not exists (
    select 1 from public.financial_transactions
    where id = (select applied_transaction_id from public.finance_adjustments where reason = 'Correct a portion to the bank account')
      and related_transaction_id = v_original.id
      and transaction_category = 'CORRECTION'
      and finance_account_id = (select id from public.finance_accounts where name = 'Main bank')
      and direction = 'inflow'
      and amount_paise = 5000
  ) then raise exception 'FAIL: correction effect is incorrect'; end if;
  if not exists (select 1 from public.financial_transactions where id = v_original.id) then
    raise exception 'FAIL: adjustment removed the original transaction';
  end if;
end $$;

-- Schema and immutable-history constraints are enforced independently of RPCs.
do $$
declare v_transaction_id uuid;
begin
  select posted_transaction_id into v_transaction_id
  from public.finance_expenses where description = 'Approved maintenance expense';
  begin
    update public.financial_transactions set amount_paise = amount_paise + 1
    where id = v_transaction_id;
    raise exception 'FAIL: financial history was updated';
  exception when sqlstate '55000' then null;
  end;
  begin
    delete from public.financial_transactions where id = v_transaction_id;
    raise exception 'FAIL: financial history was deleted';
  exception when sqlstate '55000' then null;
  end;
  begin
    update public.finance_audit_events set details = '{"forged":true}'::jsonb
    where entity_id = (select id from public.finance_expenses where description = 'Approved maintenance expense');
    raise exception 'FAIL: finance audit history was updated';
  exception when sqlstate '55000' then null;
  end;
  begin
    delete from public.finance_expenses
    where description = 'Approved maintenance expense';
    raise exception 'FAIL: posted expense history was deleted';
  exception when sqlstate '55000' then null;
  end;
  begin
    delete from public.finance_adjustments
    where reason = 'Correct a portion to the bank account';
    raise exception 'FAIL: applied adjustment history was deleted';
  exception when sqlstate '55000' then null;
  end;
  begin
    update public.finance_adjustments
    set target_transaction_id = (
      select source_transaction_id from public.finance_transfers
      where reason = 'Deposit cash'
    )
    where reason = 'Correct a portion to the bank account';
    raise exception 'FAIL: adjustment accepted unrelated original transaction';
  exception when check_violation then null;
  end;
  begin
    insert into public.financial_transactions (
      finance_account_id, transaction_category, direction, amount_paise,
      business_date, reference_type, reference_id, operation_id,
      created_by_application_user_id
    ) values (
      (select id from public.finance_accounts where name = 'Main cash'),
      'EXPENSE', 'outflow', 0,
      current_date, 'finance_expense', gen_random_uuid(),
      'finance-test-invalid-amount',
      '72000000-0000-0000-0000-000000000001'
    );
    raise exception 'FAIL: zero financial effect was accepted';
  exception when check_violation then null;
  end;
end $$;

-- RLS grants are read-only, idempotency is not client-readable, and no
-- trusted operation accepts a caller-controlled actor identifier.
do $$
declare
  v_table text;
  v_signature text;
begin
  foreach v_table in array array[
    'public.finance_accounts',
    'public.financial_transactions',
    'public.finance_expenses',
    'public.finance_transfers',
    'public.finance_adjustments',
    'public.finance_audit_events',
    'public.finance_account_balances'
  ] loop
    if has_table_privilege('authenticated', v_table, 'insert')
       or has_table_privilege('authenticated', v_table, 'update')
       or has_table_privilege('authenticated', v_table, 'delete') then
      raise exception 'FAIL: authenticated has direct mutation privilege on %', v_table;
    end if;
  end loop;
  if has_table_privilege('authenticated', 'public.finance_operation_idempotency', 'select') then
    raise exception 'FAIL: authenticated can read finance idempotency internals';
  end if;

  foreach v_signature in array array[
    'public.enforce_finance_adjustment_lineage()',
    'public.lock_active_finance_actor()',
    'public.create_finance_account(text,text,text)',
    'public.set_finance_account_status(uuid,text,text)',
    'public.rename_finance_account(uuid,text,text)',
    'public.submit_finance_expense(uuid,bigint,text,text,date,text)',
    'public.decide_finance_expense(uuid,text,text,text)',
    'public.submit_finance_transfer(uuid,uuid,bigint,text,date,text)',
    'public.decide_finance_transfer(uuid,text,text,text)',
    'public.submit_finance_adjustment(uuid,text,text,uuid,text,bigint,date,text)',
    'public.decide_finance_adjustment(uuid,text,text,text)'
  ] loop
    if has_function_privilege('anon', v_signature, 'execute') then
      raise exception 'FAIL: anon can execute %', v_signature;
    end if;
  end loop;
  if has_function_privilege(
    'authenticated', 'public.lock_active_finance_actor()', 'execute'
  ) then
    raise exception 'FAIL: authenticated can execute internal actor-lock helper';
  end if;

  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    cross join lateral unnest(coalesce(p.proargnames, '{}'::text[])) arg_name
    where n.nspname = 'public'
      and p.proname in (
        'create_finance_account', 'set_finance_account_status',
        'submit_finance_expense', 'decide_finance_expense',
        'submit_finance_transfer', 'decide_finance_transfer',
        'submit_finance_adjustment', 'decide_finance_adjustment'
      )
      and arg_name in ('actor_id', 'actor_application_user_id', 'created_by')
  ) then raise exception 'FAIL: trusted finance RPC accepts client actor identity'; end if;
end $$;

-- Exercise actual Data API roles rather than relying only on privilege
-- metadata. Authenticated clients cannot mutate trusted finance tables or
-- inspect the internal idempotency registry, and anon cannot read finance.
select set_config('request.jwt.claims', '{"sub":"71000000-0000-0000-0000-000000000005","role":"authenticated"}', true);
set local role authenticated;
do $$
begin
  begin
    insert into public.finance_accounts (
      name, account_type, created_by_application_user_id
    ) values (
      'Forged account', 'cash',
      '72000000-0000-0000-0000-000000000005'
    );
    raise exception 'FAIL: authenticated direct finance INSERT succeeded';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.finance_accounts set name = 'Forged update';
    raise exception 'FAIL: authenticated direct finance UPDATE succeeded';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.finance_accounts;
    raise exception 'FAIL: authenticated direct finance DELETE succeeded';
  exception when insufficient_privilege then null;
  end;
  begin
    perform count(*) from public.finance_operation_idempotency;
    raise exception 'FAIL: authenticated read finance idempotency internals';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
do $$
begin
  begin
    perform count(*) from public.finance_accounts;
    raise exception 'FAIL: anon read finance accounts';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- Verify actual RLS behavior under the Data API role.
select set_config('request.jwt.claims', '{"sub":"71000000-0000-0000-0000-000000000005","role":"authenticated"}', true);
set local role authenticated;
do $$
begin
  if (select count(*) from public.finance_accounts) <> 0 then
    raise exception 'FAIL: Member can read organizational finance accounts';
  end if;
  if (select count(*) from public.financial_transactions) <> 0 then
    raise exception 'FAIL: Member can read organizational financial transactions';
  end if;
  if (select count(*) from public.finance_account_balances) <> 0 then
    raise exception 'FAIL: Member can read organizational finance balances';
  end if;
end $$;
reset role;

select set_config('request.jwt.claims', '{"sub":"71000000-0000-0000-0000-000000000004","role":"authenticated"}', true);
set local role authenticated;
do $$
begin
  if (select count(*) from public.finance_accounts) < 3 then
    raise exception 'FAIL: Auditor cannot read authorized finance accounts';
  end if;
  if (select count(*) from public.financial_transactions) < 5 then
    raise exception 'FAIL: Auditor cannot read authorized financial transactions';
  end if;
  if (select balance_paise from public.finance_account_balances
      where finance_account_id = (select id from public.finance_accounts where name = 'Main cash')) <> -75000 then
    raise exception 'FAIL: calculated cash balance is not derived correctly';
  end if;
  if (select balance_paise from public.finance_account_balances
      where finance_account_id = (select id from public.finance_accounts where name = 'Main bank')) <> 55000 then
    raise exception 'FAIL: calculated bank balance is not derived correctly';
  end if;
end $$;
reset role;

-- A lower final bill closes only the unused approval; payment history remains.
select set_config('request.jwt.claims', '{"sub":"71000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
select id from public.submit_finance_expense_with_evidence(
  (select id from public.finance_accounts where name = 'Main cash'),
  10000, 'Lower final bill test', null, current_date,
  'finance-test-close-submit', 'Supplier provided no invoice for this expense.'
);
select set_config('request.jwt.claims', '{"sub":"71000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
select id from public.decide_finance_expense(
  (select id from public.finance_expenses where description = 'Lower final bill test'),
  'approve', null, 'finance-test-close-approve'
);
select set_config('request.jwt.claims', '{"sub":"71000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
select id from public.pay_finance_expense(
  (select id from public.finance_expenses where description = 'Lower final bill test'),
  2500, current_date, 'finance-test-close-payment'
);
select id from public.close_finance_expense(
  (select id from public.finance_expenses where description = 'Lower final bill test'),
  'Final invoice was lower than the approved estimate.', 'finance-test-close-operation'
);
select id from public.close_finance_expense(
  (select id from public.finance_expenses where description = 'Lower final bill test'),
  'Final invoice was lower than the approved estimate.', 'finance-test-close-operation'
);
do $$
declare v_id uuid;
begin
  select id into v_id from public.finance_expenses where description = 'Lower final bill test';
  if (select status from public.finance_expenses where id = v_id) <> 'closed'
     or (select amount_paise - paid_amount_paise from public.finance_expenses where id = v_id) <> 7500 then
    raise exception 'FAIL: unused approval not retained'; end if;
  if (select count(*) from public.financial_transactions
      where reference_type = 'finance_expense' and reference_id = v_id) <> 1 then
    raise exception 'FAIL: closing posted an additional outflow'; end if;
  begin
    perform public.pay_finance_expense(v_id,7500,current_date,'finance-test-close-late-payment');
    raise exception 'FAIL: closed expense accepted another payment';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.close_finance_expense(v_id,'Changed closure explanation here.',
      'finance-test-close-operation');
    raise exception 'FAIL: changed closure replay succeeded';
  exception when unique_violation then null; end;
end $$;

-- Rejected revisions retain the old decision and require a fresh approval.
select set_config('request.jwt.claims', '{"sub":"71000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
select id from public.submit_finance_expense_with_evidence(
  (select id from public.finance_accounts where name = 'Main cash'),
  11000,'Rejected revision test',null,current_date,
  'finance-test-revision-submit','Vendor did not provide a bill for this job.'
);
select set_config('request.jwt.claims', '{"sub":"71000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
select id from public.decide_finance_expense(
  (select id from public.finance_expenses where description = 'Rejected revision test'),
  'reject','Incorrect amount on the request.','finance-test-revision-reject'
);
do $$
begin
  begin
    perform public.resubmit_finance_expense(
      (select id from public.finance_expenses where description = 'Rejected revision test'),
      (select id from public.finance_accounts where name = 'Main cash'),
      9000,'Not owner',null,current_date,'No receipt was issued by the vendor.',
      'finance-test-revision-foreign');
    raise exception 'FAIL: another actor resubmitted the expense';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claims', '{"sub":"71000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
select id from public.resubmit_finance_expense(
  (select id from public.finance_expenses where description = 'Rejected revision test'),
  (select id from public.finance_accounts where name = 'Main cash'),
  9000,'Corrected revision test',null,current_date,'Vendor did not issue a receipt for this job.',
  'finance-test-revision-resubmit'
);
select id from public.resubmit_finance_expense(
  (select id from public.finance_expenses where description = 'Corrected revision test'),
  (select id from public.finance_accounts where name = 'Main cash'),
  9000,'Corrected revision test',null,current_date,'Vendor did not issue a receipt for this job.',
  'finance-test-revision-resubmit'
);
do $$
declare v_expense public.finance_expenses;
begin
  select * into v_expense from public.finance_expenses where description = 'Corrected revision test';
  if v_expense.status <> 'submitted' or v_expense.revision_number <> 2 or v_expense.amount_paise <> 9000
     or v_expense.decided_at is not null or v_expense.rejection_reason is not null then
    raise exception 'FAIL: revision did not reset approval'; end if;
  if not exists (select 1 from public.finance_expense_revisions r
    where r.finance_expense_id = v_expense.id and r.revision_number = 1
      and r.amount_paise = 11000 and r.rejection_reason = 'Incorrect amount on the request.') then
    raise exception 'FAIL: rejected revision history missing'; end if;
  if (select count(*) from public.finance_expense_revisions where finance_expense_id = v_expense.id) <> 1 then
    raise exception 'FAIL: revision retry duplicated history'; end if;
  begin
    perform public.resubmit_finance_expense(v_expense.id,v_expense.finance_account_id,
      10000,'Changed replay',null,current_date,'Vendor did not issue a receipt for this job.',
      'finance-test-revision-resubmit');
    raise exception 'FAIL: changed revision replay succeeded';
  exception when unique_violation then null; end;
end $$;
select set_config('request.jwt.claims', '{"sub":"71000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
select id from public.decide_finance_expense(
  (select id from public.finance_expenses where description = 'Corrected revision test'),
  'approve',null,'finance-test-revision-approve'
);

rollback;
