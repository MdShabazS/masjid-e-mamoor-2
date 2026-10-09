\set ON_ERROR_STOP on

begin;

\echo '============================================'
\echo ' OPEN TASK FINAL CLOSURE V1 TEST'
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
  (
    'f1100000-0000-0000-0000-000000000001'::uuid,
    'closure-president@example.invalid'
  ),
  (
    'f1100000-0000-0000-0000-000000000002'::uuid,
    'closure-committee-a@example.invalid'
  ),
  (
    'f1100000-0000-0000-0000-000000000003'::uuid,
    'closure-committee-b@example.invalid'
  )
) x(auth_id, email);


insert into public.application_users (
  id,
  auth_user_id,
  status
)
values
  (
    'f1200000-0000-0000-0000-000000000001',
    'f1100000-0000-0000-0000-000000000001',
    'active'
  ),
  (
    'f1200000-0000-0000-0000-000000000002',
    'f1100000-0000-0000-0000-000000000002',
    'active'
  ),
  (
    'f1200000-0000-0000-0000-000000000003',
    'f1100000-0000-0000-0000-000000000003',
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
    'f1200000-0000-0000-0000-000000000001'::uuid,
    'president'
  ),
  (
    'f1200000-0000-0000-0000-000000000002'::uuid,
    'committee_member'
  ),
  (
    'f1200000-0000-0000-0000-000000000003'::uuid,
    'committee_member'
  )
) fixture(application_user_id, role_key)
join public.roles r
  on r.key = fixture.role_key;


-- ============================================================
-- President creates open task
-- ============================================================

select set_config(
  'request.jwt.claims',
  '{"sub":"f1100000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);


select id as closure_open_task
from public.create_open_committee_task(
  'Closure volunteer task',
  'Verify pre-claim and reassignment rules',
  'normal',
  current_date + 7,
  'closure-open-create'
)
\gset


select set_config(
  'test.closure_open_task',
  :'closure_open_task',
  true
);


-- ============================================================
-- Unclaimed Committee Member can READ open task but cannot
-- progress/start/complete it before winning claim.
-- ============================================================

select set_config(
  'request.jwt.claims',
  '{"sub":"f1100000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);


do $$
declare
  v_task_id uuid :=
    current_setting(
      'test.closure_open_task'
    )::uuid;
begin
  if not public.can_read_committee_task(
    v_task_id
  ) then
    raise exception
      'FAIL: eligible Committee Member cannot read open task';
  end if;

  begin
    perform public.add_committee_task_progress(
      v_task_id,
      'Forbidden pre-claim progress',
      'closure-preclaim-progress'
    );

    raise exception
      'FAIL: unclaimed Committee Member added progress';

  exception
    when insufficient_privilege then
      if sqlerrm <> 'not_assigned' then
        raise;
      end if;
  end;

  begin
    perform public.start_committee_task(
      v_task_id,
      'closure-preclaim-start'
    );

    raise exception
      'FAIL: unclaimed Committee Member started task';

  exception
    when insufficient_privilege then
      if sqlerrm <> 'not_assigned' then
        raise;
      end if;
  end;

  begin
    perform public.complete_committee_task(
      v_task_id,
      'Forbidden completion',
      'closure-preclaim-complete'
    );

    raise exception
      'FAIL: unclaimed Committee Member completed task';

  exception
    when insufficient_privilege then
      if sqlerrm <> 'not_assigned' then
        raise;
      end if;
  end;

  if (
    select status
    from public.committee_tasks
    where id = v_task_id
  ) <> 'open' then
    raise exception
      'FAIL: denied pre-claim operation changed task status';
  end if;
end $$;


-- ============================================================
-- Committee A claims successfully.
-- ============================================================

select public.claim_open_committee_task(
  :'closure_open_task'::uuid,
  'closure-claim-a'
);


-- ============================================================
-- Committee B loses with STABLE conflict 23505, not retryable
-- serialization SQLSTATE.
-- ============================================================

select set_config(
  'request.jwt.claims',
  '{"sub":"f1100000-0000-0000-0000-000000000003","role":"authenticated"}',
  true
);


do $$
begin
  begin
    perform public.claim_open_committee_task(
      current_setting(
        'test.closure_open_task'
      )::uuid,
      'closure-claim-b'
    );

    raise exception
      'FAIL: second Committee Member claimed task';

  exception
    when unique_violation then
      if sqlerrm <> 'task_already_claimed' then
        raise;
      end if;
  end;
end $$;


-- ============================================================
-- President reassigns claimed open-origin task from A to B.
-- Open origin remains immutable and exactly one active assignee.
-- ============================================================

select set_config(
  'request.jwt.claims',
  '{"sub":"f1100000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);


select public.update_committee_task(
  :'closure_open_task'::uuid,
  'Closure volunteer task reassigned',
  'Manager reassignment after successful claim',
  'high',
  current_date + 9,
  array[
    'f1200000-0000-0000-0000-000000000003'::uuid
  ],
  'closure-manager-reassign'
);


do $$
declare
  v_task public.committee_tasks;
begin
  select *
  into v_task
  from public.committee_tasks
  where id =
    current_setting(
      'test.closure_open_task'
    )::uuid;

  if v_task.assignment_mode <> 'open' then
    raise exception
      'FAIL: manager reassignment changed open origin';
  end if;

  if v_task.status <> 'assigned' then
    raise exception
      'FAIL: manager reassignment changed claimed status';
  end if;

  if (
    select count(*)
    from public.committee_task_assignees cta
    where cta.task_id = v_task.id
      and cta.removed_at is null
  ) <> 1 then
    raise exception
      'FAIL: reassigned open task does not have one active assignee';
  end if;

  if not exists (
    select 1
    from public.committee_task_assignees cta
    where cta.task_id = v_task.id
      and cta.application_user_id =
        'f1200000-0000-0000-0000-000000000003'::uuid
      and cta.removed_at is null
  ) then
    raise exception
      'FAIL: manager reassignment did not activate Committee B';
  end if;
end $$;


-- ============================================================
-- List contract: preserve legacy pagination/order/scope while
-- exposing current Phase 10/11 fields.
-- ============================================================

do $$
declare
  v_count integer;
  v_row record;
begin
  select count(*)
  into v_count
  from public.list_committee_tasks(
    1,
    0
  );

  if v_count <> 1 then
    raise exception
      'FAIL: list limit semantics changed';
  end if;

  select *
  into v_row
  from public.list_committee_tasks(
    100,
    0
  )
  where id =
    current_setting(
      'test.closure_open_task'
    )::uuid;

  if v_row.id is null then
    raise exception
      'FAIL: authorized task missing from list';
  end if;

  if v_row.assignment_mode <> 'open' then
    raise exception
      'FAIL: list assignment_mode incorrect';
  end if;

  if v_row.is_overdue is null then
    raise exception
      'FAIL: list overdue derivation missing';
  end if;

  -- Non-follow-up control must expose null source links.
  if v_row.source_meeting_id is not null
     or v_row.source_meeting_decision_id is not null then
    raise exception
      'FAIL: ordinary task unexpectedly has meeting source';
  end if;

  if v_row.assignee_ids <>
     array[
       'f1200000-0000-0000-0000-000000000003'::uuid
     ] then
    raise exception
      'FAIL: list active assignee semantics changed';
  end if;
end $$;


\echo ''
\echo 'PASS: open-task closure semantics verified'
\echo '============================================'
\echo ' OPEN TASK FINAL CLOSURE V1 PASSED'
\echo '============================================'

rollback;
