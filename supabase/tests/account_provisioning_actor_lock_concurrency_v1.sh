#!/usr/bin/env bash

set -euo pipefail

db_container="${SUPABASE_DB_CONTAINER:-supabase_db_Masjid-e-Mamoor-2-Docs}"
admin_auth_id="93000000-0000-0000-0000-000000000001"
president_auth_id="93000000-0000-0000-0000-000000000002"
target_auth_id="93000000-0000-0000-0000-000000000003"
admin_account_id="94000000-0000-0000-0000-000000000001"
president_account_id="94000000-0000-0000-0000-000000000002"

psql_exec() {
  docker exec "$db_container" psql -U postgres -d postgres -v ON_ERROR_STOP=1 "$@"
}

cleanup() {
  psql_exec -c "
    drop trigger if exists test_delay_president_deactivation
      on public.application_users;
    drop function if exists public.test_delay_president_deactivation();
    delete from public.account_security_events
    where actor_application_user_id in (
      select id from public.application_users
      where auth_user_id in ('$admin_auth_id', '$president_auth_id', '$target_auth_id')
    ) or target_application_user_id in (
      select id from public.application_users
      where auth_user_id in ('$admin_auth_id', '$president_auth_id', '$target_auth_id')
    );
    delete from public.member_profiles
    where application_user_id in (
      select id from public.application_users
      where auth_user_id in ('$admin_auth_id', '$president_auth_id', '$target_auth_id')
    );
    delete from public.application_user_roles
    where application_user_id in (
      select id from public.application_users
      where auth_user_id in ('$admin_auth_id', '$president_auth_id', '$target_auth_id')
    );
    delete from public.application_users
    where auth_user_id in ('$admin_auth_id', '$president_auth_id', '$target_auth_id');
    delete from auth.users
    where id in ('$admin_auth_id', '$president_auth_id', '$target_auth_id');
  " >/dev/null
}

trap cleanup EXIT
cleanup

psql_exec -c "
  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at
  ) values
    ('$admin_auth_id', '00000000-0000-0000-0000-000000000000',
     'authenticated', 'authenticated', 'lock-admin@auth.masjid.local', '',
     now(), now(), now()),
    ('$president_auth_id', '00000000-0000-0000-0000-000000000000',
     'authenticated', 'authenticated', 'lock-president@auth.masjid.local', '',
     now(), now(), now()),
    ('$target_auth_id', '00000000-0000-0000-0000-000000000000',
     'authenticated', 'authenticated', 'lock-target@auth.masjid.local', '',
     now(), now(), now());

  insert into public.application_users (id, auth_user_id, status)
  values
    ('$admin_account_id', '$admin_auth_id', 'active'),
    ('$president_account_id', '$president_auth_id', 'active');

  insert into public.application_user_roles (application_user_id, role_id)
  select x.application_user_id, r.id
  from (values
    ('$admin_account_id'::uuid, 'system_admin'),
    ('$president_account_id'::uuid, 'president')
  ) x(application_user_id, role_key)
  join public.roles r on r.key = x.role_key;

  create function public.test_delay_president_deactivation()
  returns trigger
  language plpgsql
  set search_path = pg_catalog, public
  as \$\$
  begin
    if old.id = '$president_account_id' and new.status = 'deactivated' then
      perform pg_catalog.pg_sleep(2);
    end if;
    return new;
  end;
  \$\$;

  create trigger test_delay_president_deactivation
  before update on public.application_users
  for each row execute function public.test_delay_president_deactivation();
" >/dev/null

set +e
(psql_exec -c "
  set role authenticated;
  set request.jwt.claims =
    '{\"sub\":\"$admin_auth_id\",\"role\":\"authenticated\"}';
  select public.change_account_status('$president_account_id', 'deactivated');
" >/tmp/account-provisioning-revocation.log 2>&1) &
revocation_pid=$!

sleep 0.3

(psql_exec -c "
  set role authenticated;
  set request.jwt.claims =
    '{\"sub\":\"$president_auth_id\",\"role\":\"authenticated\"}';
  select public.finalize_account_provisioning(
    '$target_auth_id',
    'lock-target@auth.masjid.local',
    'lock.target',
    'lock.target',
    'Lock Target',
    'member',
    null
  );
" >/tmp/account-provisioning-finalization.log 2>&1) &
finalization_pid=$!

wait "$revocation_pid"
revocation_status=$?
wait "$finalization_pid"
finalization_status=$?
set -e

president_status="$(psql_exec -Atc "
  select status from public.application_users
  where id = '$president_account_id';
")"
target_count="$(psql_exec -Atc "
  select count(*) from public.application_users
  where auth_user_id = '$target_auth_id';
")"

if [[ "$revocation_status" -ne 0 ]]; then
  echo "FAIL: trusted President deactivation failed"
  exit 1
fi

if [[ "$finalization_status" -eq 0 ]]; then
  echo "FAIL: provisioning used stale President authorization"
  exit 1
fi

if ! grep -q "not_authorized" /tmp/account-provisioning-finalization.log; then
  echo "FAIL: provisioning did not fail with not_authorized"
  exit 1
fi

if [[ "$president_status" != "deactivated" || "$target_count" != "0" ]]; then
  echo "FAIL: race left an unexpected account or President state"
  exit 1
fi

echo "PASS: revocation committed first; provisioning observed current authorization"
