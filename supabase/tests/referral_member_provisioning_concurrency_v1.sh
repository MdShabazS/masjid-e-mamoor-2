#!/usr/bin/env bash

set -euo pipefail

db_container="${SUPABASE_DB_CONTAINER:-supabase_db_Masjid-e-Mamoor-2-Docs}"
president_auth_id="99000000-0000-0000-0000-000000000001"
first_auth_id="99000000-0000-0000-0000-000000000002"
second_auth_id="99000000-0000-0000-0000-000000000003"
president_account_id="99100000-0000-0000-0000-000000000001"
referral_id="99200000-0000-0000-0000-000000000001"
operation_id="referral-concurrent-finalize-001"

psql_exec() {
  docker exec "$db_container" psql -U postgres -d postgres -v ON_ERROR_STOP=1 "$@"
}

cleanup_data() {
  psql_exec -c "
    drop trigger if exists test_delay_referral_completion
      on public.referrals;
    drop function if exists public.test_delay_referral_completion();
    delete from public.referral_audit_events
    where referral_id = '$referral_id';
    delete from public.referral_operation_idempotency
    where operation_id = '$operation_id';
    delete from public.referrals
    where id = '$referral_id';
    delete from public.account_security_events
    where actor_application_user_id = '$president_account_id'
       or target_application_user_id in (
         select id from public.application_users
         where auth_user_id in ('$first_auth_id', '$second_auth_id')
       );
    delete from public.member_profiles
    where application_user_id in (
      select id from public.application_users
      where auth_user_id in ('$first_auth_id', '$second_auth_id')
    );
    delete from public.application_user_roles
    where application_user_id = '$president_account_id'
       or application_user_id in (
         select id from public.application_users
         where auth_user_id in ('$first_auth_id', '$second_auth_id')
       );
    delete from public.application_users
    where id = '$president_account_id'
       or auth_user_id in ('$first_auth_id', '$second_auth_id');
    delete from auth.users
    where id in ('$president_auth_id', '$first_auth_id', '$second_auth_id');
  " >/dev/null
}

on_exit() {
  local status=$?
  trap - EXIT
  cleanup_data
  rm -f /tmp/referral-finalization-first.log /tmp/referral-finalization-second.log
  exit "$status"
}

trap on_exit EXIT
cleanup_data

psql_exec -c "
  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at
  ) values
    ('$president_auth_id', '00000000-0000-0000-0000-000000000000',
     'authenticated', 'authenticated', 'ref-race-president@auth.masjid.local', '',
     now(), now(), now()),
    ('$first_auth_id', '00000000-0000-0000-0000-000000000000',
     'authenticated', 'authenticated', 'ref-race-first@auth.masjid.local', '',
     now(), now(), now()),
    ('$second_auth_id', '00000000-0000-0000-0000-000000000000',
     'authenticated', 'authenticated', 'ref-race-second@auth.masjid.local', '',
     now(), now(), now());

  insert into public.application_users (
    id, auth_user_id, status, display_name
  ) values (
    '$president_account_id', '$president_auth_id', 'active', 'Race President'
  );

  insert into public.application_user_roles (application_user_id, role_id)
  select '$president_account_id', id from public.roles where key = 'president';

  insert into public.referrals (
    id, referral_code, status, applicant_display_name, applicant_phone,
    reviewed_by_application_user_id, reviewed_at
  ) values (
    '$referral_id', 'referral-race-code-000001', 'approved',
    'Concurrent Applicant', '+15555550199', '$president_account_id', now()
  );

  create function public.test_delay_referral_completion()
  returns trigger
  language plpgsql
  set search_path = pg_catalog, public
  as \$\$
  begin
    if old.id = '$referral_id'
       and old.status = 'approved'
       and new.status = 'completed' then
      perform pg_catalog.pg_sleep(2);
    end if;
    return new;
  end;
  \$\$;

  create trigger test_delay_referral_completion
  before update on public.referrals
  for each row execute function public.test_delay_referral_completion();
" >/dev/null

(psql_exec -Atc "
  set role authenticated;
  set request.jwt.claims =
    '{\"sub\":\"$president_auth_id\",\"role\":\"authenticated\"}';
  select public.finalize_referral_member_provisioning(
    '$referral_id', '$operation_id', '$first_auth_id',
    'ref-race-first@auth.masjid.local', 'ref.race.member', 'ref.race.member'
  );
" >/tmp/referral-finalization-first.log 2>&1) &
first_pid=$!

sleep 0.3

(psql_exec -Atc "
  set role authenticated;
  set request.jwt.claims =
    '{\"sub\":\"$president_auth_id\",\"role\":\"authenticated\"}';
  select public.finalize_referral_member_provisioning(
    '$referral_id', '$operation_id', '$second_auth_id',
    'ref-race-second@auth.masjid.local', 'ref.race.member', 'ref.race.member'
  );
" >/tmp/referral-finalization-second.log 2>&1) &
second_pid=$!

set +e
wait "$first_pid"
first_status=$?
wait "$second_pid"
second_status=$?
set -e

if [[ "$first_status" -ne 0 || "$second_status" -ne 0 ]]; then
  echo "FAIL: concurrent referral finalization session failed"
  sed -n '/ERROR:/p' /tmp/referral-finalization-first.log
  sed -n '/ERROR:/p' /tmp/referral-finalization-second.log
  exit 1
fi

first_account_id="$(sed -n 's/.*"application_user_id": "\([^"]*\)".*/\1/p' /tmp/referral-finalization-first.log | tail -1)"
second_account_id="$(sed -n 's/.*"application_user_id": "\([^"]*\)".*/\1/p' /tmp/referral-finalization-second.log | tail -1)"
aggregate_counts="$(psql_exec -Atc "
  select concat_ws(',',
    (select count(*) from public.application_users
     where auth_user_id in ('$first_auth_id', '$second_auth_id')),
    (select count(*) from public.referrals
     where id = '$referral_id' and status = 'completed'),
    (select count(*) from public.referral_operation_idempotency
     where operation_id = '$operation_id'),
    (select count(*) from public.referral_audit_events
     where referral_id = '$referral_id' and event_type = 'referral.completed')
  );
")"
second_reference_count="$(psql_exec -Atc "
  select count(*) from public.application_users
  where auth_user_id = '$second_auth_id';
")"

if [[ -z "$first_account_id" || "$first_account_id" != "$second_account_id" ]]; then
  echo "FAIL: concurrent calls did not return the same application account"
  exit 1
fi

if [[ "$aggregate_counts" != "1,1,1,1" || "$second_reference_count" != "0" ]]; then
  echo "FAIL: concurrent completion created duplicate or inconsistent aggregates"
  exit 1
fi

if ! grep -q '"used_supplied_auth_user": true' /tmp/referral-finalization-first.log \
   || ! grep -q '"used_supplied_auth_user": false' /tmp/referral-finalization-second.log; then
  echo "FAIL: concurrent result did not identify the unused Auth user"
  exit 1
fi

echo "PASS: concurrent matching referral completion created one database aggregate"
