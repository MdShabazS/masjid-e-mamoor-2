\set ON_ERROR_STOP on

begin;

-- Fixed identities keep role-context checks readable. The transaction is
-- rolled back, so no QA data survives the test.
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at
)
select
  x.auth_id,
  '00000000-0000-0000-0000-000000000000'::uuid,
  'authenticated', 'authenticated', x.email, '', now(), now(), now()
from (values
  ('61000000-0000-0000-0000-000000000001'::uuid, 'task-president@example.invalid'),
  ('61000000-0000-0000-0000-000000000002'::uuid, 'task-vp@example.invalid'),
  ('61000000-0000-0000-0000-000000000003'::uuid, 'task-secretary@example.invalid'),
  ('61000000-0000-0000-0000-000000000004'::uuid, 'task-auditor@example.invalid'),
  ('61000000-0000-0000-0000-000000000005'::uuid, 'task-committee-a@example.invalid'),
  ('61000000-0000-0000-0000-000000000006'::uuid, 'task-committee-b@example.invalid'),
  ('61000000-0000-0000-0000-000000000007'::uuid, 'task-member@example.invalid'),
  ('61000000-0000-0000-0000-000000000008'::uuid, 'task-inactive@example.invalid'),
  ('61000000-0000-0000-0000-000000000009'::uuid, 'task-finance@example.invalid')
) x(auth_id, email);

insert into public.application_users (id, auth_user_id, status)
values
  ('62000000-0000-0000-0000-000000000001', '61000000-0000-0000-0000-000000000001', 'active'),
  ('62000000-0000-0000-0000-000000000002', '61000000-0000-0000-0000-000000000002', 'active'),
  ('62000000-0000-0000-0000-000000000003', '61000000-0000-0000-0000-000000000003', 'active'),
  ('62000000-0000-0000-0000-000000000004', '61000000-0000-0000-0000-000000000004', 'active'),
  ('62000000-0000-0000-0000-000000000005', '61000000-0000-0000-0000-000000000005', 'active'),
  ('62000000-0000-0000-0000-000000000006', '61000000-0000-0000-0000-000000000006', 'active'),
  ('62000000-0000-0000-0000-000000000007', '61000000-0000-0000-0000-000000000007', 'active'),
  ('62000000-0000-0000-0000-000000000008', '61000000-0000-0000-0000-000000000008', 'deactivated'),
  ('62000000-0000-0000-0000-000000000009', '61000000-0000-0000-0000-000000000009', 'active');

insert into public.application_user_roles (application_user_id, role_id)
select x.application_user_id, r.id
from (values
  ('62000000-0000-0000-0000-000000000001'::uuid, 'president'),
  ('62000000-0000-0000-0000-000000000002'::uuid, 'vice_president'),
  ('62000000-0000-0000-0000-000000000003'::uuid, 'secretary'),
  ('62000000-0000-0000-0000-000000000004'::uuid, 'auditor'),
  ('62000000-0000-0000-0000-000000000005'::uuid, 'committee_member'),
  ('62000000-0000-0000-0000-000000000006'::uuid, 'committee_member'),
  ('62000000-0000-0000-0000-000000000007'::uuid, 'member'),
  ('62000000-0000-0000-0000-000000000008'::uuid, 'committee_member'),
  ('62000000-0000-0000-0000-000000000009'::uuid, 'finance')
) x(application_user_id, role_key)
join public.roles r on r.key = x.role_key;

-- President, Vice President, and Secretary can create and assign.
select set_config('request.jwt.claims', '{"sub":"61000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
select id as president_task_id
from public.create_committee_task(
  'President task', 'Direct assignment test', 'high', current_date + 7,
  array['62000000-0000-0000-0000-000000000005'::uuid],
  'task-test-shared-operation'
) \gset

do $$
declare v_replay public.committee_tasks;
begin
  select * into v_replay
  from public.create_committee_task(
    'President task', 'Direct assignment test', 'high', current_date + 7,
    array['62000000-0000-0000-0000-000000000005'::uuid],
    'task-test-shared-operation'
  );
  if v_replay.id <> (select id from public.committee_tasks where title = 'President task') then
    raise exception 'FAIL: task creation replay changed result';
  end if;
  begin
    perform public.create_committee_task(
      'Changed replay payload', null, 'high', null,
      array['62000000-0000-0000-0000-000000000005'::uuid],
      'task-test-shared-operation'
    );
    raise exception 'FAIL: changed idempotent payload was accepted';
  exception when unique_violation then null;
  end;
end $$;

select set_config('request.jwt.claims', '{"sub":"61000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
select id as vp_task_id
from public.create_committee_task(
  'Vice President task', null, 'normal', null,
  array['62000000-0000-0000-0000-000000000006'::uuid],
  'task-test-shared-operation'
) \gset

select set_config('request.jwt.claims', '{"sub":"61000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
select id as secretary_task_id
from public.create_committee_task(
  'Secretary task', null, 'low', null,
  array['62000000-0000-0000-0000-000000000005'::uuid],
  'task-test-secretary-create'
) \gset

-- Record a successful self-service operation before the assignee is removed.
select set_config('request.jwt.claims', '{"sub":"61000000-0000-0000-0000-000000000005","role":"authenticated"}', true);
select id as removed_assignee_progress_id
from public.add_committee_task_progress(
  (select id from public.committee_tasks where title = 'Secretary task'),
  'Progress before reassignment',
  'task-test-replay-after-removal'
) \gset

-- An assign-capable user can update/reassign, preserving assignment history
-- and a deterministic notification handoff for the newly assigned user.
select set_config('request.jwt.claims', '{"sub":"61000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
select id
from public.update_committee_task(
  (select id from public.committee_tasks where title = 'Secretary task'),
  'Secretary task', null, 'high', current_date + 14,
  array['62000000-0000-0000-0000-000000000006'::uuid],
  'task-test-president-reassign'
);

do $$
declare
  v_original_activity_id uuid;
  v_replay public.committee_task_activity;
begin
  if (select count(*) from public.committee_tasks
      where title in ('President task', 'Vice President task', 'Secretary task')) <> 3 then
    raise exception 'FAIL: assign-capable role creation';
  end if;
  if (select count(*) from public.committee_task_assignees
      where task_id = (select id from public.committee_tasks where title = 'Secretary task')) <> 2 then
    raise exception 'FAIL: reassignment history was not preserved';
  end if;
  if not exists (
    select 1 from public.committee_task_activity
    where task_id = (select id from public.committee_tasks where title = 'Secretary task')
      and activity_type = 'task_updated'
      and details @> '{"notification_events":["task_updated","task_assigned"]}'::jsonb
  ) then
    raise exception 'FAIL: reassignment notification integration missing';
  end if;
  if (select count(*) from public.list_committee_tasks(50, 0)) <> 3 then
    raise exception 'FAIL: assign-capable list did not return authorized tasks';
  end if;
  if public.get_committee_task(
    (select id from public.committee_tasks where title = 'President task')
  ) -> 'task' ->> 'title' <> 'President task' then
    raise exception 'FAIL: task detail did not return expected task';
  end if;
end $$;

-- Committee Member cannot create/assign and cannot use the management RPC.
select set_config('request.jwt.claims', '{"sub":"61000000-0000-0000-0000-000000000005","role":"authenticated"}', true);
do $$
declare
  v_original_activity_id uuid;
  v_replay public.committee_task_activity;
begin
  begin
    perform public.create_committee_task(
      'Forbidden', null, 'normal', null,
      array['62000000-0000-0000-0000-000000000005'::uuid],
      'task-test-forbidden-create'
    );
    raise exception 'FAIL: Committee Member assigned a task';
  exception when insufficient_privilege then null;
  end;

  begin
    perform public.update_committee_task(
      (select id from public.committee_tasks where title = 'President task'),
      'Forged title', null, 'normal', null,
      array['62000000-0000-0000-0000-000000000005'::uuid],
      'task-test-forbidden-update'
    );
    raise exception 'FAIL: Committee Member altered task definition';
  exception when insufficient_privilege then null;
  end;

  begin
    perform public.add_committee_task_progress(
      (select id from public.committee_tasks where title = 'Secretary task'),
      'Removed assignee progress', 'task-test-removed-assignee-progress'
    );
    raise exception 'FAIL: removed assignee progressed task';
  exception when insufficient_privilege then null;
  end;

  select id into v_original_activity_id
  from public.committee_task_activity
  where actor_application_user_id = '62000000-0000-0000-0000-000000000005'
    and operation_id = 'task-test-replay-after-removal';

  select * into v_replay
  from public.add_committee_task_progress(
    (select id from public.committee_tasks where title = 'Secretary task'),
    'Progress before reassignment',
    'task-test-replay-after-removal'
  );

  if v_replay.id <> v_original_activity_id then
    raise exception 'FAIL: replay after reassignment did not return original activity';
  end if;

  if (select count(*) from public.committee_task_activity
      where actor_application_user_id = '62000000-0000-0000-0000-000000000005'
        and operation_id = 'task-test-replay-after-removal') <> 1 then
    raise exception 'FAIL: replay after reassignment duplicated activity';
  end if;

  begin
    perform public.add_committee_task_progress(
      (select id from public.committee_tasks where title = 'Secretary task'),
      'Changed replay payload',
      'task-test-replay-after-removal'
    );
    raise exception 'FAIL: changed replay after reassignment was accepted';
  exception when unique_violation then null;
  end;
end $$;

-- Assigned Committee Member can read and progress own task but not an
-- unrelated Committee Member's task.
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"61000000-0000-0000-0000-000000000005","role":"authenticated"}', true);
do $$
begin
  if (select count(*) from public.committee_tasks where title = 'President task') <> 1 then
    raise exception 'FAIL: Committee Member cannot read own assigned task';
  end if;
  if (select count(*) from public.committee_tasks where title = 'Vice President task') <> 0 then
    raise exception 'FAIL: Committee Member read unrelated task';
  end if;
  if (select count(*) from public.committee_task_assignees
      where task_id = (select id from public.committee_tasks where title = 'Vice President task')) <> 0 then
    raise exception 'FAIL: Committee Member read unrelated assignees';
  end if;
  if (select count(*) from public.committee_task_activity
      where task_id = (select id from public.committee_tasks where title = 'Vice President task')) <> 0 then
    raise exception 'FAIL: Committee Member read unrelated activity';
  end if;
  if (select count(*) from public.list_committee_tasks(50, 0)) <> 1 then
    raise exception 'FAIL: Committee Member list widened task scope';
  end if;
  begin
    perform public.get_committee_task(
      (select id from public.committee_tasks where title = 'Vice President task')
    );
    raise exception 'FAIL: Committee Member detail widened task scope';
  exception when no_data_found then null;
  end;
end $$;
reset role;

select set_config('request.jwt.claims', '{"sub":"61000000-0000-0000-0000-000000000005","role":"authenticated"}', true);
select public.add_committee_task_progress(
  (select id from public.committee_tasks where title = 'President task'),
  'Progress recorded by assignee',
  'task-test-progress'
);

-- Auditor remains read-only but is not assignable and receives no invented
-- organization-wide task visibility.
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"61000000-0000-0000-0000-000000000004","role":"authenticated"}', true);
do $$
begin
  if (select count(*) from public.committee_tasks) <> 0
     or (select count(*) from public.committee_task_assignees) <> 0
     or (select count(*) from public.committee_task_activity) <> 0 then
    raise exception 'FAIL: Auditor received undocumented task visibility';
  end if;
end $$;
reset role;

select set_config('request.jwt.claims', '{"sub":"61000000-0000-0000-0000-000000000004","role":"authenticated"}', true);
do $$
begin
  begin
    perform public.add_committee_task_progress(
      (select id from public.committee_tasks where title = 'President task'),
      'Forbidden auditor progress',
      'task-test-auditor-progress'
    );
    raise exception 'FAIL: Auditor mutated task';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Ordinary Member has no task read access.
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"61000000-0000-0000-0000-000000000007","role":"authenticated"}', true);
do $$
begin
  if (select count(*) from public.committee_tasks) <> 0
     or (select count(*) from public.committee_task_assignees) <> 0
     or (select count(*) from public.committee_task_activity) <> 0 then
    raise exception 'FAIL: ordinary Member read committee task domain rows';
  end if;
  begin
    perform public.list_committee_tasks(50, 0);
    raise exception 'FAIL: ordinary Member used task list RPC';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

do $$
begin
  begin
    perform public.add_committee_task_progress(
      (select id from public.committee_tasks where title = 'President task'),
      'Forbidden Member progress', 'task-test-member-progress'
    );
    raise exception 'FAIL: ordinary Member mutated task';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Read-only, unrelated, ordinary, and inactive roles are not assignees.
select set_config('request.jwt.claims', '{"sub":"61000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
do $$
begin
  begin
    perform public.create_committee_task(
      'Invalid assignee', null, 'normal', null,
      array['62000000-0000-0000-0000-000000000008'::uuid],
      'task-test-inactive-assignee'
    );
    raise exception 'FAIL: inactive assignee accepted';
  exception when invalid_parameter_value then null;
  end;

  begin
    perform public.create_committee_task(
      'Auditor assignee', null, 'normal', null,
      array['62000000-0000-0000-0000-000000000004'::uuid],
      'task-test-auditor-assignee'
    );
    raise exception 'FAIL: read-only Auditor accepted as assignee';
  exception when invalid_parameter_value then null;
  end;

  begin
    perform public.create_committee_task(
      'Finance assignee', null, 'normal', null,
      array['62000000-0000-0000-0000-000000000009'::uuid],
      'task-test-finance-assignee'
    );
    raise exception 'FAIL: Finance accepted as assignee';
  exception when invalid_parameter_value then null;
  end;

  begin
    perform public.create_committee_task(
      'Member assignee', null, 'normal', null,
      array['62000000-0000-0000-0000-000000000007'::uuid],
      'task-test-member-assignee'
    );
    raise exception 'FAIL: ordinary Member accepted as assignee';
  exception when invalid_parameter_value then null;
  end;

  begin
    perform public.create_committee_task(
      'Null priority', null, null, null,
      array['62000000-0000-0000-0000-000000000005'::uuid],
      'task-test-null-priority'
    );
    raise exception 'FAIL: NULL priority was accepted';
  exception
    when invalid_parameter_value then
      if sqlerrm <> 'invalid_priority' then
        raise exception 'FAIL: NULL priority returned %', sqlerrm;
      end if;
  end;
end $$;

-- Completion requires assignment/manage and the exact state progression.
select set_config('request.jwt.claims', '{"sub":"61000000-0000-0000-0000-000000000006","role":"authenticated"}', true);
do $$
begin
  begin
    perform public.complete_committee_task(
      (select id from public.committee_tasks where title = 'President task'),
      null, 'task-test-unassigned-complete'
    );
    raise exception 'FAIL: unassigned Committee Member completed task';
  exception when insufficient_privilege then null;
  end;
end $$;

select set_config('request.jwt.claims', '{"sub":"61000000-0000-0000-0000-000000000005","role":"authenticated"}', true);
do $$
begin
  begin
    perform public.complete_committee_task(
      (select id from public.committee_tasks where title = 'President task'),
      null, 'task-test-invalid-transition'
    );
    raise exception 'FAIL: assigned task completed without in_progress';
  exception when invalid_parameter_value then null;
  end;
end $$;

select public.start_committee_task(
  (select id from public.committee_tasks where title = 'President task'),
  'task-test-start'
);
select public.complete_committee_task(
  (select id from public.committee_tasks where title = 'President task'),
  'Completion note', 'task-test-complete'
);

-- Replays are recognized before later task state is evaluated and do not
-- append duplicate activity.
select public.start_committee_task(
  (select id from public.committee_tasks where title = 'President task'),
  'task-test-start'
);
select public.complete_committee_task(
  (select id from public.committee_tasks where title = 'President task'),
  'Completion note', 'task-test-complete'
);

do $$
begin
  if (select status from public.committee_tasks where title = 'President task') <> 'completed' then
    raise exception 'FAIL: valid completion did not complete task';
  end if;
  if (select count(*) from public.committee_task_activity
      where task_id = (select id from public.committee_tasks where title = 'President task')) <> 4 then
    raise exception 'FAIL: expected create, progress, start, completion activity';
  end if;
  if exists (
    select 1 from public.committee_task_activity
    where task_id = (select id from public.committee_tasks where title = 'President task')
      and actor_application_user_id is null
  ) then
    raise exception 'FAIL: activity actor missing';
  end if;
end $$;

-- The Data API roles have read-only table grants governed by RLS; all domain
-- mutations must pass through trusted operations. Anonymous callers cannot
-- execute those operations.
do $$
declare
  v_table text;
  v_signature text;
begin
  foreach v_table in array array[
    'public.committee_tasks',
    'public.committee_task_assignees',
    'public.committee_task_activity'
  ] loop
    if has_table_privilege('authenticated', v_table, 'insert')
       or has_table_privilege('authenticated', v_table, 'update')
       or has_table_privilege('authenticated', v_table, 'delete') then
      raise exception 'FAIL: authenticated has direct mutation privilege on %', v_table;
    end if;
  end loop;

  foreach v_signature in array array[
    'public.create_committee_task(text,text,text,date,uuid[],text)',
    'public.list_committee_tasks(integer,integer)',
    'public.get_committee_task(uuid)',
    'public.update_committee_task(uuid,text,text,text,date,uuid[],text)',
    'public.add_committee_task_progress(uuid,text,text)',
    'public.start_committee_task(uuid,text)',
    'public.complete_committee_task(uuid,text,text)'
  ] loop
    if has_function_privilege('anon', v_signature, 'execute') then
      raise exception 'FAIL: anon can execute %', v_signature;
    end if;
  end loop;
end $$;

rollback;
