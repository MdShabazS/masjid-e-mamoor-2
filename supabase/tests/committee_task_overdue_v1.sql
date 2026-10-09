\set ON_ERROR_STOP on

begin;

\echo '============================================'
\echo ' COMMITTEE TASK DERIVED OVERDUE V1 TEST'
\echo '============================================'


-- ============================================================
-- Fixtures
-- ============================================================

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
  fixture.auth_id,
  '00000000-0000-0000-0000-000000000000'::uuid,
  'authenticated',
  'authenticated',
  fixture.email,
  '',
  now(),
  now(),
  now()
from (values
  (
    'b1100000-0000-0000-0000-000000000001'::uuid,
    'overdue-president@example.invalid'
  ),
  (
    'b1100000-0000-0000-0000-000000000002'::uuid,
    'overdue-committee@example.invalid'
  )
) fixture(auth_id, email);


insert into public.application_users (
  id,
  auth_user_id,
  status
)
values
  (
    'b1200000-0000-0000-0000-000000000001',
    'b1100000-0000-0000-0000-000000000001',
    'active'
  ),
  (
    'b1200000-0000-0000-0000-000000000002',
    'b1100000-0000-0000-0000-000000000002',
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
  (
    'b1200000-0000-0000-0000-000000000001'::uuid,
    'president'
  ),
  (
    'b1200000-0000-0000-0000-000000000002'::uuid,
    'committee_member'
  )
) fixture(application_user_id, role_key)
join public.roles r
  on r.key = fixture.role_key;


-- ============================================================
-- Create representative tasks
-- ============================================================

select set_config(
  'request.jwt.claims',
  '{"sub":"b1100000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);


select id as overdue_direct_id
from public.create_committee_task(
  'Overdue direct task',
  null,
  'normal',
  current_date - 1,
  array[
    'b1200000-0000-0000-0000-000000000002'::uuid
  ],
  'overdue-direct-create'
)
\gset


select id as today_direct_id
from public.create_committee_task(
  'Due today direct task',
  null,
  'normal',
  current_date,
  array[
    'b1200000-0000-0000-0000-000000000002'::uuid
  ],
  'today-direct-create'
)
\gset


select id as overdue_open_id
from public.create_open_committee_task(
  'Overdue open task',
  null,
  'high',
  current_date - 2,
  'overdue-open-create'
)
\gset


select id as completed_overdue_id
from public.create_committee_task(
  'Completed past-due task',
  null,
  'low',
  current_date - 3,
  array[
    'b1200000-0000-0000-0000-000000000002'::uuid
  ],
  'completed-overdue-create'
)
\gset


select set_config(
  'test.overdue_direct_id',
  :'overdue_direct_id',
  true
);

select set_config(
  'test.today_direct_id',
  :'today_direct_id',
  true
);

select set_config(
  'test.overdue_open_id',
  :'overdue_open_id',
  true
);

select set_config(
  'test.completed_overdue_id',
  :'completed_overdue_id',
  true
);


-- Complete the historical past-due task.
select set_config(
  'request.jwt.claims',
  '{"sub":"b1100000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);

select public.start_committee_task(
  :'completed_overdue_id'::uuid,
  'completed-overdue-start'
);

select public.complete_committee_task(
  :'completed_overdue_id'::uuid,
  'Completed despite past due date',
  'completed-overdue-finish'
);


-- ============================================================
-- Verify list contract
-- ============================================================

select set_config(
  'request.jwt.claims',
  '{"sub":"b1100000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);

do $$
begin
  if not exists (
    select 1
    from public.list_committee_tasks(100, 0)
    where id =
      current_setting('test.overdue_direct_id')::uuid
      and assignment_mode = 'direct'
      and is_overdue
      and status = 'assigned'
  ) then
    raise exception
      'FAIL: past-due active direct task not derived overdue';
  end if;

  if exists (
    select 1
    from public.list_committee_tasks(100, 0)
    where id =
      current_setting('test.today_direct_id')::uuid
      and is_overdue
  ) then
    raise exception
      'FAIL: task due today incorrectly marked overdue';
  end if;

  if not exists (
    select 1
    from public.list_committee_tasks(100, 0)
    where id =
      current_setting('test.overdue_open_id')::uuid
      and assignment_mode = 'open'
      and status = 'open'
      and is_overdue
  ) then
    raise exception
      'FAIL: past-due open task not derived overdue';
  end if;

  if exists (
    select 1
    from public.list_committee_tasks(100, 0)
    where id =
      current_setting('test.completed_overdue_id')::uuid
      and is_overdue
  ) then
    raise exception
      'FAIL: completed task incorrectly remains overdue';
  end if;
end $$;


-- ============================================================
-- Verify detail contract
-- ============================================================

do $$
declare
  v_detail jsonb;
begin
  v_detail :=
    public.get_committee_task(
      current_setting('test.overdue_direct_id')::uuid
    );

  if (v_detail -> 'task' ->> 'assignment_mode') <>
       'direct' then
    raise exception
      'FAIL: detail omitted assignment_mode';
  end if;

  if (v_detail -> 'task' ->> 'is_overdue')::boolean
       is not true then
    raise exception
      'FAIL: detail did not derive overdue=true';
  end if;

  v_detail :=
    public.get_committee_task(
      current_setting('test.completed_overdue_id')::uuid
    );

  if (v_detail -> 'task' ->> 'is_overdue')::boolean
       is not false then
    raise exception
      'FAIL: completed detail did not derive overdue=false';
  end if;
end $$;


-- ============================================================
-- Ensure overdue is not persisted
-- ============================================================

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'committee_tasks'
      and column_name = 'is_overdue'
  ) then
    raise exception
      'FAIL: is_overdue was persisted as a task column';
  end if;

  if exists (
    select 1
    from public.committee_tasks
    where status = 'overdue'
  ) then
    raise exception
      'FAIL: overdue was persisted as lifecycle status';
  end if;
end $$;


\echo ''
\echo 'PASS: overdue is derived and lifecycle status remains authoritative'
\echo '============================================'
\echo ' COMMITTEE TASK DERIVED OVERDUE V1 PASSED'
\echo '============================================'

rollback;
