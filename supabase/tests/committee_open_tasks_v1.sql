\set ON_ERROR_STOP on

begin;

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
  x.auth_id,
  '00000000-0000-0000-0000-000000000000'::uuid,
  'authenticated',
  'authenticated',
  x.email,
  '',
  now(),
  now(),
  now()
from (values
  ('a1100000-0000-0000-0000-000000000001'::uuid, 'open-president@example.invalid'),
  ('a1100000-0000-0000-0000-000000000002'::uuid, 'open-auditor@example.invalid'),
  ('a1100000-0000-0000-0000-000000000003'::uuid, 'open-committee-a@example.invalid'),
  ('a1100000-0000-0000-0000-000000000004'::uuid, 'open-committee-b@example.invalid'),
  ('a1100000-0000-0000-0000-000000000005'::uuid, 'open-finance@example.invalid'),
  ('a1100000-0000-0000-0000-000000000006'::uuid, 'open-member@example.invalid')
) x(auth_id, email);

insert into public.application_users (
  id,
  auth_user_id,
  status
)
values
  ('a1200000-0000-0000-0000-000000000001', 'a1100000-0000-0000-0000-000000000001', 'active'),
  ('a1200000-0000-0000-0000-000000000002', 'a1100000-0000-0000-0000-000000000002', 'active'),
  ('a1200000-0000-0000-0000-000000000003', 'a1100000-0000-0000-0000-000000000003', 'active'),
  ('a1200000-0000-0000-0000-000000000004', 'a1100000-0000-0000-0000-000000000004', 'active'),
  ('a1200000-0000-0000-0000-000000000005', 'a1100000-0000-0000-0000-000000000005', 'active'),
  ('a1200000-0000-0000-0000-000000000006', 'a1100000-0000-0000-0000-000000000006', 'active');

insert into public.application_user_roles (
  application_user_id,
  role_id
)
select
  x.application_user_id,
  r.id
from (values
  ('a1200000-0000-0000-0000-000000000001'::uuid, 'president'),
  ('a1200000-0000-0000-0000-000000000002'::uuid, 'auditor'),
  ('a1200000-0000-0000-0000-000000000003'::uuid, 'committee_member'),
  ('a1200000-0000-0000-0000-000000000004'::uuid, 'committee_member'),
  ('a1200000-0000-0000-0000-000000000005'::uuid, 'finance'),
  ('a1200000-0000-0000-0000-000000000006'::uuid, 'member')
) x(application_user_id, role_key)
join public.roles r
  on r.key = x.role_key;


-- ============================================================
-- President creates OPEN task
-- ============================================================

select set_config(
  'request.jwt.claims',
  '{"sub":"a1100000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);

select id as open_task_id
from public.create_open_committee_task(
  'Volunteer hall setup',
  'Prepare hall before programme',
  'high',
  current_date + 3,
  'open-create-1'
)
\gset

select set_config(
  'test.open_task_id',
  :'open_task_id',
  true
);

do $$
declare
  v_task public.committee_tasks;
begin
  select *
  into v_task
  from public.committee_tasks
  where id =
    current_setting('test.open_task_id')::uuid;

  if v_task.status <> 'open'
     or v_task.assignment_mode <> 'open' then
    raise exception
      'FAIL: open task lifecycle/origin incorrect';
  end if;

  if exists (
    select 1
    from public.committee_task_assignees
    where task_id = v_task.id
      and removed_at is null
  ) then
    raise exception
      'FAIL: new open task already has assignee';
  end if;
end $$;


-- ============================================================
-- Creation replay
-- ============================================================

do $$
declare
  v_replay public.committee_tasks;
begin
  select *
  into v_replay
  from public.create_open_committee_task(
    'Volunteer hall setup',
    'Prepare hall before programme',
    'high',
    current_date + 3,
    'open-create-1'
  );

  if v_replay.id <>
     current_setting('test.open_task_id')::uuid then
    raise exception
      'FAIL: open task replay changed identity';
  end if;

  if (
    select count(*)
    from public.committee_task_activity
    where actor_application_user_id =
      'a1200000-0000-0000-0000-000000000001'
      and operation_id = 'open-create-1'
  ) <> 1 then
    raise exception
      'FAIL: open create replay duplicated activity';
  end if;

  begin
    perform public.create_open_committee_task(
      'Changed title',
      'Prepare hall before programme',
      'high',
      current_date + 3,
      'open-create-1'
    );

    raise exception
      'FAIL: changed open-create replay accepted';
  exception
    when unique_violation then null;
  end;
end $$;


-- Second open task for replay/authorization tests.
select id as second_open_task_id
from public.create_open_committee_task(
  'Second volunteer task',
  null,
  'normal',
  current_date + 5,
  'open-create-2'
)
\gset

select set_config(
  'test.second_open_task_id',
  :'second_open_task_id',
  true
);


-- Direct-assignment creation remains DIRECT.
select id as direct_task_id
from public.create_committee_task(
  'Direct regression task',
  null,
  'normal',
  current_date + 7,
  array[
    'a1200000-0000-0000-0000-000000000003'::uuid
  ],
  'direct-regression-create'
)
\gset

select set_config(
  'test.direct_task_id',
  :'direct_task_id',
  true
);

do $$
begin
  if (
    select assignment_mode
    from public.committee_tasks
    where id =
      current_setting('test.direct_task_id')::uuid
  ) <> 'direct' then
    raise exception
      'FAIL: existing task creation did not default to direct';
  end if;
end $$;


-- ============================================================
-- Open-task read scope
-- ============================================================

-- Committee Member A sees OPEN task.
set local role authenticated;

select set_config(
  'request.jwt.claims',
  '{"sub":"a1100000-0000-0000-0000-000000000003","role":"authenticated"}',
  true
);

do $$
begin
  if not exists (
    select 1
    from public.committee_tasks
    where id =
      current_setting('test.open_task_id')::uuid
  ) then
    raise exception
      'FAIL: Committee Member cannot read open task';
  end if;

  if not exists (
    select 1
    from public.list_committee_tasks(100, 0)
    where id =
      current_setting('test.open_task_id')::uuid
  ) then
    raise exception
      'FAIL: Committee Member list omits open task';
  end if;
end $$;

reset role;


-- Committee Member B also sees OPEN task.
set local role authenticated;

select set_config(
  'request.jwt.claims',
  '{"sub":"a1100000-0000-0000-0000-000000000004","role":"authenticated"}',
  true
);

do $$
begin
  if not exists (
    select 1
    from public.committee_tasks
    where id =
      current_setting('test.open_task_id')::uuid
  ) then
    raise exception
      'FAIL: second Committee Member cannot read open task';
  end if;
end $$;

reset role;


-- Auditor gets read-only OPEN visibility.
set local role authenticated;

select set_config(
  'request.jwt.claims',
  '{"sub":"a1100000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);

do $$
begin
  if not exists (
    select 1
    from public.committee_tasks
    where id =
      current_setting('test.open_task_id')::uuid
  ) then
    raise exception
      'FAIL: Auditor cannot read open task';
  end if;

  begin
    perform public.claim_open_committee_task(
      current_setting('test.open_task_id')::uuid,
      'auditor-forbidden-claim'
    );

    raise exception
      'FAIL: Auditor claimed open task';
  exception
    when insufficient_privilege then
      if sqlerrm <> 'claim_not_allowed' then
        raise;
      end if;
  end;
end $$;

reset role;


-- Finance has no organization-wide OPEN visibility.
set local role authenticated;

select set_config(
  'request.jwt.claims',
  '{"sub":"a1100000-0000-0000-0000-000000000005","role":"authenticated"}',
  true
);

do $$
begin
  if exists (
    select 1
    from public.committee_tasks
    where id =
      current_setting('test.open_task_id')::uuid
  ) then
    raise exception
      'FAIL: Finance read unrelated open task';
  end if;

  if exists (
    select 1
    from public.list_committee_tasks(100, 0)
    where id =
      current_setting('test.open_task_id')::uuid
  ) then
    raise exception
      'FAIL: Finance list widened to open tasks';
  end if;

  begin
    perform public.claim_open_committee_task(
      current_setting('test.open_task_id')::uuid,
      'finance-forbidden-claim'
    );

    raise exception
      'FAIL: Finance claimed open task';
  exception
    when insufficient_privilege then
      if sqlerrm <> 'claim_not_allowed' then
        raise;
      end if;
  end;
end $$;

reset role;


-- Ordinary Member has no OPEN visibility.
set local role authenticated;

select set_config(
  'request.jwt.claims',
  '{"sub":"a1100000-0000-0000-0000-000000000006","role":"authenticated"}',
  true
);

do $$
begin
  if exists (
    select 1
    from public.committee_tasks
    where id =
      current_setting('test.open_task_id')::uuid
  ) then
    raise exception
      'FAIL: ordinary Member read open task';
  end if;

  begin
    perform public.claim_open_committee_task(
      current_setting('test.open_task_id')::uuid,
      'member-forbidden-claim'
    );

    raise exception
      'FAIL: ordinary Member claimed open task';
  exception
    when insufficient_privilege then
      if sqlerrm <> 'claim_not_allowed' then
        raise;
      end if;
  end;
end $$;

reset role;


-- Committee Member cannot CREATE an open task.
set local role authenticated;

select set_config(
  'request.jwt.claims',
  '{"sub":"a1100000-0000-0000-0000-000000000003","role":"authenticated"}',
  true
);

do $$
begin
  begin
    perform public.create_open_committee_task(
      'Forbidden self-created open task',
      null,
      'normal',
      null,
      'member-forbidden-open-create'
    );

    raise exception
      'FAIL: Committee Member created open task';
  exception
    when insufficient_privilege then null;
  end;
end $$;

reset role;


-- ============================================================
-- Committee Member A claims task
-- ============================================================

set local role authenticated;

select set_config(
  'request.jwt.claims',
  '{"sub":"a1100000-0000-0000-0000-000000000003","role":"authenticated"}',
  true
);

select id as claimed_task_id
from public.claim_open_committee_task(
  :'open_task_id'::uuid,
  'claim-open-a'
)
\gset

select set_config(
  'test.claimed_task_id',
  :'claimed_task_id',
  true
);

do $$
declare
  v_replay public.committee_tasks;
begin
  if current_setting('test.claimed_task_id')::uuid <>
     current_setting('test.open_task_id')::uuid then
    raise exception
      'FAIL: claim returned wrong task';
  end if;

  if (
    select status
    from public.committee_tasks
    where id =
      current_setting('test.open_task_id')::uuid
  ) <> 'assigned' then
    raise exception
      'FAIL: claim did not transition open -> assigned';
  end if;

  if (
    select count(*)
    from public.committee_task_assignees
    where task_id =
      current_setting('test.open_task_id')::uuid
      and removed_at is null
  ) <> 1 then
    raise exception
      'FAIL: claim did not create exactly one assignee';
  end if;

  if not exists (
    select 1
    from public.committee_task_assignees
    where task_id =
      current_setting('test.open_task_id')::uuid
      and application_user_id =
        'a1200000-0000-0000-0000-000000000003'
      and removed_at is null
  ) then
    raise exception
      'FAIL: claimant is not authoritative assignee';
  end if;

  select *
  into v_replay
  from public.claim_open_committee_task(
    current_setting('test.open_task_id')::uuid,
    'claim-open-a'
  );

  if v_replay.id <>
     current_setting('test.open_task_id')::uuid then
    raise exception
      'FAIL: claim replay changed task identity';
  end if;

  if (
    select count(*)
    from public.committee_task_activity
    where actor_application_user_id =
      'a1200000-0000-0000-0000-000000000003'
      and operation_id = 'claim-open-a'
  ) <> 1 then
    raise exception
      'FAIL: claim replay duplicated activity';
  end if;

  -- Same actor + same operation ID + different target
  -- is a changed-payload replay.
  begin
    perform public.claim_open_committee_task(
      current_setting('test.second_open_task_id')::uuid,
      'claim-open-a'
    );

    raise exception
      'FAIL: changed claim replay accepted';
  exception
    when unique_violation then null;
  end;
end $$;

reset role;


-- ============================================================
-- Second claimant must lose
-- ============================================================

set local role authenticated;

select set_config(
  'request.jwt.claims',
  '{"sub":"a1100000-0000-0000-0000-000000000004","role":"authenticated"}',
  true
);

do $$
begin
  begin
    perform public.claim_open_committee_task(
      current_setting('test.open_task_id')::uuid,
      'claim-open-b'
    );

    raise exception
      'FAIL: second claimant claimed assigned task';
  exception
    when unique_violation then
      if sqlerrm <> 'task_already_claimed' then
        raise;
      end if;
  end;

  -- After claim, unrelated Committee Member loses visibility.
  if exists (
    select 1
    from public.committee_tasks
    where id =
      current_setting('test.open_task_id')::uuid
  ) then
    raise exception
      'FAIL: unrelated Committee Member retained claimed-task visibility';
  end if;
end $$;

reset role;


-- Auditor also loses visibility once open task is claimed.
set local role authenticated;

select set_config(
  'request.jwt.claims',
  '{"sub":"a1100000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);

do $$
begin
  if exists (
    select 1
    from public.committee_tasks
    where id =
      current_setting('test.open_task_id')::uuid
  ) then
    raise exception
      'FAIL: Auditor retained claimed open-task visibility';
  end if;
end $$;

reset role;


-- ============================================================
-- Claimed task follows existing lifecycle
-- ============================================================

set local role authenticated;

select set_config(
  'request.jwt.claims',
  '{"sub":"a1100000-0000-0000-0000-000000000003","role":"authenticated"}',
  true
);

select public.add_committee_task_progress(
  :'open_task_id'::uuid,
  'Volunteer started preparation',
  'open-progress-a'
);

select public.start_committee_task(
  :'open_task_id'::uuid,
  'open-start-a'
);

select public.complete_committee_task(
  :'open_task_id'::uuid,
  'Volunteer work completed',
  'open-complete-a'
);

do $$
begin
  if (
    select status
    from public.committee_tasks
    where id =
      current_setting('test.open_task_id')::uuid
  ) <> 'completed' then
    raise exception
      'FAIL: claimed open task did not complete normally';
  end if;

  if (
    select assignment_mode
    from public.committee_tasks
    where id =
      current_setting('test.open_task_id')::uuid
  ) <> 'open' then
    raise exception
      'FAIL: original open-task origin was lost';
  end if;

  if (
    select count(*)
    from public.committee_task_assignees
    where task_id =
      current_setting('test.open_task_id')::uuid
      and removed_at is null
  ) <> 1 then
    raise exception
      'FAIL: completed claimed task lost single-assignee invariant';
  end if;
end $$;

reset role;


\echo ''
\echo '============================================'
\echo ' OPEN TASK BEHAVIOR TESTS PASSED'
\echo '============================================'

rollback;
