#!/usr/bin/env bash
set -euo pipefail

DB_CONTAINER="$(
  docker ps --format '{{.Names}}' \
    | grep '^supabase_db_' \
    | grep -Ei 'masjid-e-mamoor-2' \
    | head -n 1
)"

if [[ -z "${DB_CONTAINER}" ]]; then
  echo "FAIL: local Supabase database container not found"
  exit 1
fi

TMP_DIR="$(mktemp -d)"
TASK_ID=""

cleanup() {
  set +e

  if [[ -n "${TASK_ID}" ]]; then
    docker exec -i "${DB_CONTAINER}" \
      psql -U postgres -d postgres -v ON_ERROR_STOP=0 \
      >/dev/null 2>&1 <<SQL
delete from public.notifications
where source_type = 'committee_task'
  and source_entity_id = '${TASK_ID}';

delete from public.committee_task_activity
where task_id = '${TASK_ID}'::uuid;

delete from public.committee_task_assignees
where task_id = '${TASK_ID}'::uuid;

delete from public.committee_tasks
where id = '${TASK_ID}'::uuid;

delete from public.application_user_roles
where application_user_id in (
  'a3200000-0000-0000-0000-000000000001'::uuid,
  'a3200000-0000-0000-0000-000000000002'::uuid,
  'a3200000-0000-0000-0000-000000000003'::uuid
);

delete from public.application_users
where id in (
  'a3200000-0000-0000-0000-000000000001'::uuid,
  'a3200000-0000-0000-0000-000000000002'::uuid,
  'a3200000-0000-0000-0000-000000000003'::uuid
);

delete from auth.users
where id in (
  'a3100000-0000-0000-0000-000000000001'::uuid,
  'a3100000-0000-0000-0000-000000000002'::uuid,
  'a3100000-0000-0000-0000-000000000003'::uuid
);
SQL
  fi

  rm -rf "${TMP_DIR}"
}

trap cleanup EXIT


echo "===== CONCURRENCY FIXTURE SETUP ====="

docker exec -i "${DB_CONTAINER}" \
psql -U postgres -d postgres -v ON_ERROR_STOP=1 >/dev/null <<'SQL'
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
    'a3100000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'race-president@example.invalid',
    '',
    now(),
    now(),
    now()
  ),
  (
    'a3100000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'race-committee-a@example.invalid',
    '',
    now(),
    now(),
    now()
  ),
  (
    'a3100000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'race-committee-b@example.invalid',
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
    'a3200000-0000-0000-0000-000000000001',
    'a3100000-0000-0000-0000-000000000001',
    'active'
  ),
  (
    'a3200000-0000-0000-0000-000000000002',
    'a3100000-0000-0000-0000-000000000002',
    'active'
  ),
  (
    'a3200000-0000-0000-0000-000000000003',
    'a3100000-0000-0000-0000-000000000003',
    'active'
  );

insert into public.application_user_roles (
  application_user_id,
  role_id
)
select
  fixture.application_user_id,
  r.id
from (values
  ('a3200000-0000-0000-0000-000000000001'::uuid, 'president'),
  ('a3200000-0000-0000-0000-000000000002'::uuid, 'committee_member'),
  ('a3200000-0000-0000-0000-000000000003'::uuid, 'committee_member')
) fixture(application_user_id, role_key)
join public.roles r
  on r.key = fixture.role_key;
SQL


TASK_ID="$(
  docker exec -i "${DB_CONTAINER}" \
    psql -U postgres -d postgres \
      -v ON_ERROR_STOP=1 \
      -At <<'SQL' \
    | tail -n 1
select set_config(
  'request.jwt.claims',
  '{"sub":"a3100000-0000-0000-0000-000000000001","role":"authenticated"}',
  false
);

select id
from public.create_open_committee_task(
  'Concurrent volunteer task',
  'Exactly one Committee Member may claim this task',
  'high',
  current_date + 1,
  'race-open-create'
);
SQL
)"

if [[ -z "${TASK_ID}" ]]; then
  echo "FAIL: could not create race task"
  exit 1
fi

echo "Race task: ${TASK_ID}"


claim_task() {
  local auth_id="$1"
  local operation_id="$2"

  docker exec -i "${DB_CONTAINER}" \
    psql -U postgres -d postgres \
      -v ON_ERROR_STOP=1 >/dev/null <<SQL
begin;

select set_config(
  'request.jwt.claims',
  '{"sub":"${auth_id}","role":"authenticated"}',
  true
);

select public.claim_open_committee_task(
  '${TASK_ID}'::uuid,
  '${operation_id}'
);

commit;
SQL
}


echo ""
echo "===== TWO-CONNECTION CLAIM RACE ====="

set +e

claim_task \
  "a3100000-0000-0000-0000-000000000002" \
  "race-claim-a" \
  >"${TMP_DIR}/a.out" 2>&1 &
PID_A=$!

claim_task \
  "a3100000-0000-0000-0000-000000000003" \
  "race-claim-b" \
  >"${TMP_DIR}/b.out" 2>&1 &
PID_B=$!

wait "${PID_A}"
STATUS_A=$?

wait "${PID_B}"
STATUS_B=$?

set -e

SUCCESS_COUNT=0

if [[ "${STATUS_A}" -eq 0 ]]; then
  SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
fi

if [[ "${STATUS_B}" -eq 0 ]]; then
  SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
fi

if [[ "${SUCCESS_COUNT}" -ne 1 ]]; then
  echo "FAIL: expected exactly one successful claimant"
  echo "A status: ${STATUS_A}"
  echo "B status: ${STATUS_B}"
  echo "----- claimant A output -----"
  cat "${TMP_DIR}/a.out"
  echo "----- claimant B output -----"
  cat "${TMP_DIR}/b.out"
  exit 1
fi

if [[ "${STATUS_A}" -ne 0 ]]; then
  if ! grep -q "task_already_claimed" "${TMP_DIR}/a.out"; then
    echo "FAIL: claimant A failed for unexpected reason"
    cat "${TMP_DIR}/a.out"
    exit 1
  fi
fi

if [[ "${STATUS_B}" -ne 0 ]]; then
  if ! grep -q "task_already_claimed" "${TMP_DIR}/b.out"; then
    echo "FAIL: claimant B failed for unexpected reason"
    cat "${TMP_DIR}/b.out"
    exit 1
  fi
fi


echo ""
echo "===== POST-RACE DATABASE INTEGRITY ====="

docker exec -i "${DB_CONTAINER}" \
psql -U postgres -d postgres -v ON_ERROR_STOP=1 <<SQL
do \$\$
declare
  v_status text;
  v_mode text;
  v_assignee_count integer;
  v_claim_activity_count integer;
  v_claimant uuid;
begin
  select
    status,
    assignment_mode
  into
    v_status,
    v_mode
  from public.committee_tasks
  where id = '${TASK_ID}'::uuid;

  if v_status <> 'assigned'
     or v_mode <> 'open' then
    raise exception
      'FAIL: race task final state is not open-origin assigned';
  end if;

  select
    count(*),
    (
      array_agg(
        application_user_id
        order by application_user_id
      )
    )[1]
  into
    v_assignee_count,
    v_claimant
  from public.committee_task_assignees
  where task_id = '${TASK_ID}'::uuid
    and removed_at is null;

  if v_assignee_count <> 1 then
    raise exception
      'FAIL: expected exactly one active claimant, got %',
      v_assignee_count;
  end if;

  if v_claimant not in (
    'a3200000-0000-0000-0000-000000000002'::uuid,
    'a3200000-0000-0000-0000-000000000003'::uuid
  ) then
    raise exception
      'FAIL: unexpected authoritative claimant %',
      v_claimant;
  end if;

  select count(*)
  into v_claim_activity_count
  from public.committee_task_activity
  where task_id = '${TASK_ID}'::uuid
    and activity_type = 'status_changed'
    and details ->> 'from' = 'open'
    and details ->> 'to' = 'assigned';

  if v_claim_activity_count <> 1 then
    raise exception
      'FAIL: expected exactly one committed claim activity, got %',
      v_claim_activity_count;
  end if;
end
\$\$;
SQL

echo ""
echo "PASS: exactly one Committee Member won the concurrent claim"
