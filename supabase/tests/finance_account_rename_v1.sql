\set ON_ERROR_STOP on

begin;

\echo '============================================'
\echo ' FINANCE ACCOUNT RENAME V1 TEST'
\echo '============================================'

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
      '83000000-0000-0000-0000-000000000001'::uuid,
      'rename-president@example.invalid'
    ),
    (
      '83000000-0000-0000-0000-000000000002'::uuid,
      'rename-finance@example.invalid'
    ),
    (
      '83000000-0000-0000-0000-000000000003'::uuid,
      'rename-auditor@example.invalid'
    ),
    (
      '83000000-0000-0000-0000-000000000004'::uuid,
      'rename-member@example.invalid'
    )
) x(auth_id, email);

insert into public.application_users (
  id,
  auth_user_id,
  status
)
values
  (
    '84000000-0000-0000-0000-000000000001',
    '83000000-0000-0000-0000-000000000001',
    'active'
  ),
  (
    '84000000-0000-0000-0000-000000000002',
    '83000000-0000-0000-0000-000000000002',
    'active'
  ),
  (
    '84000000-0000-0000-0000-000000000003',
    '83000000-0000-0000-0000-000000000003',
    'active'
  ),
  (
    '84000000-0000-0000-0000-000000000004',
    '83000000-0000-0000-0000-000000000004',
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
      '84000000-0000-0000-0000-000000000001'::uuid,
      'president'
    ),
    (
      '84000000-0000-0000-0000-000000000002'::uuid,
      'finance'
    ),
    (
      '84000000-0000-0000-0000-000000000003'::uuid,
      'auditor'
    ),
    (
      '84000000-0000-0000-0000-000000000004'::uuid,
      'member'
    )
) x(application_user_id, role_key)
join public.roles r
  on r.key = x.role_key;


-- ---------------------------------------------------------------------------
-- Finance creates an active account containing the typo we need to correct.
-- ---------------------------------------------------------------------------

select set_config(
  'request.jwt.claims',
  '{"sub":"83000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);

select id as main_account_id
from public.create_finance_account(
  'MASJID E MAROOR 2',
  'bank',
  'rename-test-account-create'
)
\gset
select set_config(
  'test.main_account_id',
  :'main_account_id',
  true
);

-- Give the account an authoritative ledger effect so rename must demonstrably
-- preserve both transaction history and the calculated balance.
select id as sentinel_expense_id
from public.submit_finance_expense(
  current_setting('test.main_account_id')::uuid,
  2500,
  'Rename ledger sentinel',
  null,
  current_date,
  'rename-test-sentinel-submit'
)
\gset

select set_config(
  'request.jwt.claims',
  '{"sub":"83000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);

select id
from public.decide_finance_expense(
  :'sentinel_expense_id'::uuid,
  'approve',
  null,
  'rename-test-sentinel-approve'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"83000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);


-- ---------------------------------------------------------------------------
-- Rename preserves identity and every non-name Finance property.
-- ---------------------------------------------------------------------------

select id
from public.rename_finance_account(
  current_setting('test.main_account_id')::uuid,
  'MASJID E MAMOOR 2',
  'rename-test-main'
);

do $$
declare
  v_account public.finance_accounts;
begin
  select *
  into v_account
  from public.finance_accounts
  where id = current_setting('test.main_account_id')::uuid;

  if v_account.name <> 'MASJID E MAMOOR 2' then
    raise exception
      'FAIL: account name was not corrected';
  end if;

  if v_account.account_type <> 'bank'
     or v_account.status <> 'active'
     or v_account.currency <> 'INR' then
    raise exception
      'FAIL: rename changed non-name account state';
  end if;

  if (
    select count(*)
    from public.financial_transactions
    where finance_account_id = current_setting('test.main_account_id')::uuid
  ) <> 1 then
    raise exception
      'FAIL: rename changed Finance ledger history';
  end if;

  if (
    select balance_paise
    from public.finance_account_balances
    where finance_account_id = current_setting('test.main_account_id')::uuid
  ) <> -2500 then
    raise exception
      'FAIL: rename changed the calculated Finance balance';
  end if;

  if (
    select count(*)
    from public.finance_audit_events
    where entity_id = current_setting('test.main_account_id')::uuid
      and event_type = 'account_renamed'
      and operation_id = 'rename-test-main'
      and details ->> 'previous_name' =
        'MASJID E MAROOR 2'
      and details ->> 'name' =
        'MASJID E MAMOOR 2'
  ) <> 1 then
    raise exception
      'FAIL: rename audit event is missing or incorrect';
  end if;

  if (
    select count(*)
    from public.finance_operation_idempotency
    where operation_id = 'rename-test-main'
      and operation_type = 'account_rename'
      and result_entity_type = 'finance_account'
      and result_entity_id = current_setting('test.main_account_id')::uuid
  ) <> 1 then
    raise exception
      'FAIL: rename idempotency record is missing';
  end if;
end $$;

\echo 'PASS: authorized rename preserves Finance identity and records immutable audit'


-- ---------------------------------------------------------------------------
-- Exact replay is idempotent and does not duplicate audit.
-- ---------------------------------------------------------------------------

select id
from public.rename_finance_account(
  current_setting('test.main_account_id')::uuid,
  'MASJID E MAMOOR 2',
  'rename-test-main'
);

do $$
begin
  if (
    select count(*)
    from public.finance_audit_events
    where entity_id = current_setting('test.main_account_id')::uuid
      and event_type = 'account_renamed'
      and operation_id = 'rename-test-main'
  ) <> 1 then
    raise exception
      'FAIL: rename replay duplicated audit';
  end if;
end $$;

\echo 'PASS: exact rename replay is idempotent'


-- ---------------------------------------------------------------------------
-- Reusing the operation ID for a different name must conflict.
-- ---------------------------------------------------------------------------

do $$
begin
  begin
    perform public.rename_finance_account(
      current_setting('test.main_account_id')::uuid,
      'DIFFERENT NAME',
      'rename-test-main'
    );

    raise exception
      'FAIL: changed rename replay was accepted';
  exception
    when unique_violation then
      null;
  end;
end $$;

\echo 'PASS: changed rename replay is rejected'


-- ---------------------------------------------------------------------------
-- No-op rename is rejected and leaves no idempotency/audit state.
-- ---------------------------------------------------------------------------

do $$
begin
  begin
    perform public.rename_finance_account(
      current_setting('test.main_account_id')::uuid,
      'MASJID E MAMOOR 2',
      'rename-test-noop'
    );

    raise exception
      'FAIL: no-op rename was accepted';
  exception
    when invalid_parameter_value then
      null;
  end;

  if exists (
    select 1
    from public.finance_operation_idempotency
    where operation_id = 'rename-test-noop'
  ) then
    raise exception
      'FAIL: rejected no-op rename left idempotency state';
  end if;

  if exists (
    select 1
    from public.finance_audit_events
    where operation_id = 'rename-test-noop'
  ) then
    raise exception
      'FAIL: rejected no-op rename left audit state';
  end if;
end $$;

\echo 'PASS: no-op rename is rejected without side effects'


-- ---------------------------------------------------------------------------
-- Closed accounts may have their label corrected but remain closed.
-- ---------------------------------------------------------------------------

select id as closed_account_id
from public.create_finance_account(
  'Historic typoo',
  'upi',
  'rename-test-closed-create'
)
\gset
select set_config(
  'test.closed_account_id',
  :'closed_account_id',
  true
);

select id
from public.set_finance_account_status(
  current_setting('test.closed_account_id')::uuid,
  'closed',
  'rename-test-closed-status'
);

select id
from public.rename_finance_account(
  current_setting('test.closed_account_id')::uuid,
  'Historic corrected',
  'rename-test-closed'
);

do $$
begin
  if (
    select name
    from public.finance_accounts
    where id = current_setting('test.closed_account_id')::uuid
  ) <> 'Historic corrected' then
    raise exception
      'FAIL: closed account label was not corrected';
  end if;

  if (
    select status
    from public.finance_accounts
    where id = current_setting('test.closed_account_id')::uuid
  ) <> 'closed' then
    raise exception
      'FAIL: closed account rename changed lifecycle state';
  end if;
end $$;

\echo 'PASS: closed account label can be corrected without reopening it'


-- ---------------------------------------------------------------------------
-- Auditor and ordinary Member cannot rename Finance accounts.
-- ---------------------------------------------------------------------------

select set_config(
  'request.jwt.claims',
  '{"sub":"83000000-0000-0000-0000-000000000003","role":"authenticated"}',
  true
);

do $$
begin
  begin
    perform public.rename_finance_account(
      current_setting('test.main_account_id')::uuid,
      'AUDITOR FORGED NAME',
      'rename-test-auditor'
    );

    raise exception
      'FAIL: Auditor renamed Finance account';
  exception
    when insufficient_privilege then
      null;
  end;
end $$;

select set_config(
  'request.jwt.claims',
  '{"sub":"83000000-0000-0000-0000-000000000004","role":"authenticated"}',
  true
);

do $$
begin
  begin
    perform public.rename_finance_account(
      current_setting('test.main_account_id')::uuid,
      'MEMBER FORGED NAME',
      'rename-test-member'
    );

    raise exception
      'FAIL: Member renamed Finance account';
  exception
    when insufficient_privilege then
      null;
  end;
end $$;

\echo 'PASS: unauthorized roles cannot rename Finance accounts'


-- ---------------------------------------------------------------------------
-- Failure during immutable audit insertion rolls the name update back.
-- ---------------------------------------------------------------------------

select set_config(
  'request.jwt.claims',
  '{"sub":"83000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);

select id as rollback_account_id
from public.create_finance_account(
  'Rollback original',
  'other',
  'rename-test-rollback-create'
)
\gset
select set_config(
  'test.rollback_account_id',
  :'rollback_account_id',
  true
);

create or replace function public.test_fail_account_rename_audit()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if new.event_type = 'account_renamed'
     and new.operation_id = 'rename-test-rollback' then
    raise exception 'forced_rename_audit_failure';
  end if;

  return new;
end;
$$;

create trigger test_fail_account_rename_audit
before insert on public.finance_audit_events
for each row
execute function public.test_fail_account_rename_audit();

do $$
begin
  begin
    perform public.rename_finance_account(
      current_setting('test.rollback_account_id')::uuid,
      'Rollback changed',
      'rename-test-rollback'
    );

    raise exception
      'FAIL: forced rename audit failure did not fail';
  exception
    when raise_exception then
      null;
  end;

  if (
    select name
    from public.finance_accounts
    where id = current_setting('test.rollback_account_id')::uuid
  ) <> 'Rollback original' then
    raise exception
      'FAIL: failed rename did not roll back account name';
  end if;

  if exists (
    select 1
    from public.finance_operation_idempotency
    where operation_id = 'rename-test-rollback'
  ) then
    raise exception
      'FAIL: failed rename left idempotency state';
  end if;
end $$;

drop trigger test_fail_account_rename_audit
  on public.finance_audit_events;

drop function public.test_fail_account_rename_audit();

\echo 'PASS: consequential audit failure rolls back rename atomically'


-- ---------------------------------------------------------------------------
-- RPC privilege boundary.
-- ---------------------------------------------------------------------------

do $$
begin
  if has_function_privilege(
    'anon',
    'public.rename_finance_account(uuid,text,text)',
    'execute'
  ) then
    raise exception
      'FAIL: anon can execute Finance account rename';
  end if;

  if not has_function_privilege(
    'authenticated',
    'public.rename_finance_account(uuid,text,text)',
    'execute'
  ) then
    raise exception
      'FAIL: authenticated role lacks trusted rename RPC';
  end if;

  if has_function_privilege(
    'service_role',
    'public.rename_finance_account(uuid,text,text)',
    'execute'
  ) then
    raise exception
      'FAIL: service_role has an unnecessary direct rename grant';
  end if;
end $$;

\echo 'PASS: Finance account rename RPC privilege boundary is correct'

\echo '============================================'
\echo ' ALL FINANCE ACCOUNT RENAME TESTS PASSED'
\echo '============================================'

rollback;
