#!/usr/bin/env bash

set -euo pipefail

db_container="${SUPABASE_DB_CONTAINER:-supabase_db_Masjid-e-Mamoor-2-Docs}"
admin_auth_id="73000000-0000-0000-0000-000000000001"
finance_auth_id="73000000-0000-0000-0000-000000000002"
president_auth_id="73000000-0000-0000-0000-000000000003"
vp_auth_id="73000000-0000-0000-0000-000000000004"
admin_account_id="74000000-0000-0000-0000-000000000001"
finance_account_user_id="74000000-0000-0000-0000-000000000002"
president_account_id="74000000-0000-0000-0000-000000000003"
vp_account_id="74000000-0000-0000-0000-000000000004"
source_account_id="75000000-0000-0000-0000-000000000001"
destination_account_id="75000000-0000-0000-0000-000000000002"
transfer_id="76000000-0000-0000-0000-000000000001"

psql_exec() {
  docker exec "$db_container" psql -U postgres -d postgres -v ON_ERROR_STOP=1 "$@"
}

cleanup() {
  psql_exec -c "
    drop trigger if exists test_delay_finance_actor_deactivation
      on public.application_users;
    drop function if exists public.test_delay_finance_actor_deactivation();
    drop trigger if exists test_delay_finance_transfer_approval
      on public.finance_transfers;
    drop function if exists public.test_delay_finance_transfer_approval();
    set session_replication_role = replica;
    delete from public.finance_audit_events
    where operation_id like 'finance-concurrency-%';
    delete from public.finance_operation_idempotency
    where operation_id like 'finance-concurrency-%';
    delete from public.financial_transactions
    where operation_id like 'finance-concurrency-%';
    delete from public.finance_expenses
    where description = 'Stale authorization expense';
    delete from public.finance_transfers where id = '$transfer_id';
    delete from public.finance_accounts
    where id in ('$source_account_id', '$destination_account_id');
    set session_replication_role = origin;
    delete from public.account_security_events
    where actor_application_user_id in (
      '$admin_account_id', '$finance_account_user_id',
      '$president_account_id', '$vp_account_id'
    ) or target_application_user_id in (
      '$admin_account_id', '$finance_account_user_id',
      '$president_account_id', '$vp_account_id'
    );
    delete from public.application_user_roles
    where application_user_id in (
      '$admin_account_id', '$finance_account_user_id',
      '$president_account_id', '$vp_account_id'
    );
    delete from public.application_users
    where id in (
      '$admin_account_id', '$finance_account_user_id',
      '$president_account_id', '$vp_account_id'
    );
    delete from auth.users
    where id in (
      '$admin_auth_id', '$finance_auth_id', '$president_auth_id', '$vp_auth_id'
    );
  " >/dev/null
}

on_exit() {
  local status=$?
  trap - EXIT
  cleanup
  rm -f /tmp/finance-transfer-first.log /tmp/finance-transfer-second.log \
    /tmp/finance-actor-revocation.log /tmp/finance-stale-operation.log
  exit "$status"
}

trap on_exit EXIT
cleanup

psql_exec -c "
  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at
  ) values
    ('$admin_auth_id', '00000000-0000-0000-0000-000000000000',
     'authenticated', 'authenticated', 'finance-race-admin@example.invalid', '',
     now(), now(), now()),
    ('$finance_auth_id', '00000000-0000-0000-0000-000000000000',
     'authenticated', 'authenticated', 'finance-race-maker@example.invalid', '',
     now(), now(), now()),
    ('$president_auth_id', '00000000-0000-0000-0000-000000000000',
     'authenticated', 'authenticated', 'finance-race-president@example.invalid', '',
     now(), now(), now()),
    ('$vp_auth_id', '00000000-0000-0000-0000-000000000000',
     'authenticated', 'authenticated', 'finance-race-vp@example.invalid', '',
     now(), now(), now());

  insert into public.application_users (id, auth_user_id, status)
  values
    ('$admin_account_id', '$admin_auth_id', 'active'),
    ('$finance_account_user_id', '$finance_auth_id', 'active'),
    ('$president_account_id', '$president_auth_id', 'active'),
    ('$vp_account_id', '$vp_auth_id', 'active');

  insert into public.application_user_roles (application_user_id, role_id)
  select x.application_user_id, r.id
  from (values
    ('$admin_account_id'::uuid, 'system_admin'),
    ('$finance_account_user_id'::uuid, 'finance'),
    ('$president_account_id'::uuid, 'president'),
    ('$vp_account_id'::uuid, 'vice_president')
  ) x(application_user_id, role_key)
  join public.roles r on r.key = x.role_key;

  insert into public.finance_accounts (
    id, name, account_type, created_by_application_user_id
  ) values
    ('$source_account_id', 'Concurrency source', 'cash', '$finance_account_user_id'),
    ('$destination_account_id', 'Concurrency destination', 'bank', '$finance_account_user_id');

  insert into public.finance_transfers (
    id, source_finance_account_id, destination_finance_account_id,
    amount_paise, reason, business_date, submitted_by_application_user_id
  ) values (
    '$transfer_id', '$source_account_id', '$destination_account_id',
    10000, 'Concurrent approval', current_date, '$finance_account_user_id'
  );

  create function public.test_delay_finance_transfer_approval()
  returns trigger
  language plpgsql
  set search_path = pg_catalog
  as \$\$
  begin
    if old.id = '$transfer_id'
       and old.status = 'submitted'
       and new.status = 'approved' then
      perform pg_catalog.pg_sleep(2);
    end if;
    return new;
  end;
  \$\$;

  create trigger test_delay_finance_transfer_approval
  before update on public.finance_transfers
  for each row execute function public.test_delay_finance_transfer_approval();
" >/dev/null

set +e
(psql_exec -c "
  set role authenticated;
  set request.jwt.claims =
    '{\"sub\":\"$president_auth_id\",\"role\":\"authenticated\"}';
  select id from public.decide_finance_transfer(
    '$transfer_id', 'approve', null, 'finance-concurrency-transfer-first'
  );
" >/tmp/finance-transfer-first.log 2>&1) &
first_pid=$!

sleep 0.3

(psql_exec -c "
  set role authenticated;
  set request.jwt.claims =
    '{\"sub\":\"$vp_auth_id\",\"role\":\"authenticated\"}';
  select id from public.decide_finance_transfer(
    '$transfer_id', 'approve', null, 'finance-concurrency-transfer-second'
  );
" >/tmp/finance-transfer-second.log 2>&1) &
second_pid=$!

wait "$first_pid"
first_status=$?
wait "$second_pid"
second_status=$?
set -e

if [[ "$first_status" -ne 0 || "$second_status" -eq 0 ]]; then
  echo "FAIL: concurrent transfer decisions did not serialize"
  exit 1
fi

if ! grep -q "transfer_invalid_state" /tmp/finance-transfer-second.log; then
  echo "FAIL: losing transfer decision did not observe authoritative state"
  exit 1
fi

transfer_counts="$(psql_exec -Atc "
  select concat_ws(',',
    (select count(*) from public.financial_transactions
     where reference_type = 'finance_transfer' and reference_id = '$transfer_id'),
    (select count(*) from public.finance_audit_events
     where entity_id = '$transfer_id' and event_type = 'transfer_approved'),
    (select count(*) from public.finance_operation_idempotency
     where operation_id like 'finance-concurrency-transfer-%')
  );
")"

if [[ "$transfer_counts" != "2,1,1" ]]; then
  echo "FAIL: concurrent transfer approval duplicated authoritative effects"
  exit 1
fi

psql_exec -c "
  create function public.test_delay_finance_actor_deactivation()
  returns trigger
  language plpgsql
  set search_path = pg_catalog
  as \$\$
  begin
    if old.id = '$finance_account_user_id' and new.status = 'deactivated' then
      perform pg_catalog.pg_sleep(2);
    end if;
    return new;
  end;
  \$\$;

  create trigger test_delay_finance_actor_deactivation
  before update on public.application_users
  for each row execute function public.test_delay_finance_actor_deactivation();
" >/dev/null

set +e
(psql_exec -c "
  set role authenticated;
  set request.jwt.claims =
    '{\"sub\":\"$admin_auth_id\",\"role\":\"authenticated\"}';
  select public.change_account_status('$finance_account_user_id', 'deactivated');
" >/tmp/finance-actor-revocation.log 2>&1) &
revocation_pid=$!

sleep 0.3

(psql_exec -c "
  set role authenticated;
  set request.jwt.claims =
    '{\"sub\":\"$finance_auth_id\",\"role\":\"authenticated\"}';
  select id from public.submit_finance_expense(
    '$source_account_id', 100, 'Stale authorization expense', null,
    current_date, 'finance-concurrency-stale-actor'
  );
" >/tmp/finance-stale-operation.log 2>&1) &
stale_pid=$!

wait "$revocation_pid"
revocation_status=$?
wait "$stale_pid"
stale_status=$?
set -e

if [[ "$revocation_status" -ne 0 || "$stale_status" -eq 0 ]]; then
  echo "FAIL: actor revocation did not serialize finance authorization"
  exit 1
fi

if ! grep -q "not_authorized" /tmp/finance-stale-operation.log; then
  echo "FAIL: stale finance operation did not fail with not_authorized"
  exit 1
fi

stale_counts="$(psql_exec -Atc "
  select concat_ws(',',
    (select count(*) from public.finance_expenses
     where description = 'Stale authorization expense'),
    (select count(*) from public.finance_operation_idempotency
     where operation_id = 'finance-concurrency-stale-actor')
  );
")"

if [[ "$stale_counts" != "0,0" ]]; then
  echo "FAIL: denied stale operation left finance state"
  exit 1
fi

echo "PASS: finance decisions and actor revocation serialize without duplicate effects"
