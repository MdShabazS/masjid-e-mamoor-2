\set ON_ERROR_STOP on

begin;

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at
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
  ('91000000-0000-0000-0000-000000000001'::uuid, 'notify-president@example.invalid'),
  ('91000000-0000-0000-0000-000000000002'::uuid, 'notify-secretary@example.invalid'),
  ('91000000-0000-0000-0000-000000000003'::uuid, 'notify-committee-a@example.invalid'),
  ('91000000-0000-0000-0000-000000000004'::uuid, 'notify-committee-b@example.invalid'),
  ('91000000-0000-0000-0000-000000000005'::uuid, 'notify-committee-c@example.invalid'),
  ('91000000-0000-0000-0000-000000000006'::uuid, 'notify-member@example.invalid')
) fixture(auth_id, email);

insert into public.application_users (id, auth_user_id, status, display_name)
values
  ('92000000-0000-0000-0000-000000000001', '91000000-0000-0000-0000-000000000001', 'active', 'Notification President'),
  ('92000000-0000-0000-0000-000000000002', '91000000-0000-0000-0000-000000000002', 'active', 'Notification Secretary'),
  ('92000000-0000-0000-0000-000000000003', '91000000-0000-0000-0000-000000000003', 'active', 'Notification Member A'),
  ('92000000-0000-0000-0000-000000000004', '91000000-0000-0000-0000-000000000004', 'active', 'Notification Member B'),
  ('92000000-0000-0000-0000-000000000005', '91000000-0000-0000-0000-000000000005', 'active', 'Notification Member C'),
  ('92000000-0000-0000-0000-000000000006', '91000000-0000-0000-0000-000000000006', 'active', 'Notification Ordinary Member');

insert into public.application_user_roles (application_user_id, role_id)
select fixture.application_user_id, role_row.id
from (values
  ('92000000-0000-0000-0000-000000000001'::uuid, 'president'),
  ('92000000-0000-0000-0000-000000000002'::uuid, 'secretary'),
  ('92000000-0000-0000-0000-000000000003'::uuid, 'committee_member'),
  ('92000000-0000-0000-0000-000000000004'::uuid, 'committee_member'),
  ('92000000-0000-0000-0000-000000000005'::uuid, 'committee_member'),
  ('92000000-0000-0000-0000-000000000006'::uuid, 'member')
) fixture(application_user_id, role_key)
join public.roles role_row on role_row.key = fixture.role_key;

select set_config(
  'request.jwt.claims',
  '{"sub":"91000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);

select id as notification_task_id
from public.create_committee_task(
  'Notification task',
  'Initial task description',
  'normal',
  current_date + 7,
  array[
    '92000000-0000-0000-0000-000000000001'::uuid,
    '92000000-0000-0000-0000-000000000003'::uuid,
    '92000000-0000-0000-0000-000000000004'::uuid
  ],
  'notify-create'
) \gset

select set_config('test.notification_task_id', :'notification_task_id', true);

do $$
begin
  if (select count(*) from public.notifications
      where source_entity_id = current_setting('test.notification_task_id')::uuid
        and kind = 'task_assigned') <> 2 then
    raise exception 'FAIL: task creation did not create one notification per non-actor assignee';
  end if;

  if exists (
    select 1 from public.notifications
    where recipient_application_user_id =
      '92000000-0000-0000-0000-000000000001'
  ) then
    raise exception 'FAIL: actor received a task creation self-notification';
  end if;

  if exists (
    select 1 from public.notifications
    where source_entity_id = current_setting('test.notification_task_id')::uuid
      and (
        source_activity_id is null
        or target_path <> '/work/' || current_setting('test.notification_task_id')
      )
  ) then
    raise exception 'FAIL: task creation notification source or target is incorrect';
  end if;
end $$;

-- Exact replay returns before notification generation.
select public.create_committee_task(
  'Notification task',
  'Initial task description',
  'normal',
  current_date + 7,
  array[
    '92000000-0000-0000-0000-000000000001'::uuid,
    '92000000-0000-0000-0000-000000000003'::uuid,
    '92000000-0000-0000-0000-000000000004'::uuid
  ],
  'notify-create'
);

do $$
begin
  if (select count(*) from public.notifications
      where source_entity_id = current_setting('test.notification_task_id')::uuid
        and kind = 'task_assigned') <> 2 then
    raise exception 'FAIL: task creation replay duplicated notifications';
  end if;
end $$;

-- A meaningful update assigns C, removes A, and updates existing B.
select public.update_committee_task(
  :'notification_task_id'::uuid,
  'Notification task updated',
  'Updated task description',
  'high',
  current_date + 10,
  array[
    '92000000-0000-0000-0000-000000000001'::uuid,
    '92000000-0000-0000-0000-000000000004'::uuid,
    '92000000-0000-0000-0000-000000000005'::uuid
  ],
  'notify-meaningful-update'
);

do $$
declare
  v_activity_id uuid;
begin
  select id into v_activity_id
  from public.committee_task_activity
  where operation_id = 'notify-meaningful-update';

  if not exists (
    select 1 from public.notifications
    where source_activity_id = v_activity_id
      and kind = 'task_assigned'
      and recipient_application_user_id =
        '92000000-0000-0000-0000-000000000005'
  ) then
    raise exception 'FAIL: newly added assignee did not receive task_assigned';
  end if;

  if not exists (
    select 1 from public.notifications
    where source_activity_id = v_activity_id
      and kind = 'task_unassigned'
      and recipient_application_user_id =
        '92000000-0000-0000-0000-000000000003'
      and target_path = '/work'
  ) then
    raise exception 'FAIL: removed assignee notification or target is incorrect';
  end if;

  if not exists (
    select 1 from public.notifications
    where source_activity_id = v_activity_id
      and kind = 'task_updated'
      and recipient_application_user_id =
        '92000000-0000-0000-0000-000000000004'
  ) then
    raise exception 'FAIL: existing assignee did not receive meaningful task update';
  end if;

  if exists (
    select 1 from public.notifications
    where source_activity_id = v_activity_id
      and kind = 'task_updated'
      and recipient_application_user_id in (
        '92000000-0000-0000-0000-000000000003',
        '92000000-0000-0000-0000-000000000005'
      )
  ) then
    raise exception 'FAIL: added or removed assignee also received task_updated';
  end if;
end $$;

-- Assignment-only changes do not notify existing assignees as task_updated.
select public.update_committee_task(
  :'notification_task_id'::uuid,
  'Notification task updated',
  'Updated task description',
  'high',
  current_date + 10,
  array[
    '92000000-0000-0000-0000-000000000002'::uuid,
    '92000000-0000-0000-0000-000000000004'::uuid,
    '92000000-0000-0000-0000-000000000005'::uuid
  ],
  'notify-assignment-only-update'
);

do $$
declare
  v_activity_id uuid;
begin
  select id into v_activity_id
  from public.committee_task_activity
  where operation_id = 'notify-assignment-only-update';

  if (select count(*) from public.notifications
      where source_activity_id = v_activity_id
        and kind = 'task_updated') <> 0 then
    raise exception 'FAIL: assignment-only change generated task_updated';
  end if;

  if (select count(*) from public.notifications
      where source_activity_id = v_activity_id
        and kind = 'task_assigned') <> 1 then
    raise exception 'FAIL: assignment-only added assignee notification is incorrect';
  end if;
end $$;

-- Progress by B notifies C plus President/Secretary managers. Secretary is
-- both manager and assignee and must still receive only one row.
select set_config(
  'request.jwt.claims',
  '{"sub":"91000000-0000-0000-0000-000000000004","role":"authenticated"}',
  true
);
select public.add_committee_task_progress(
  :'notification_task_id'::uuid,
  'Committee Member B progress',
  'notify-progress'
);

do $$
declare
  v_activity_id uuid;
begin
  select id into v_activity_id
  from public.committee_task_activity
  where operation_id = 'notify-progress';

  if (select count(*) from public.notifications
      where source_activity_id = v_activity_id
        and kind = 'task_progress') <> 3 then
    raise exception 'FAIL: progress recipient set is incorrect';
  end if;

  if exists (
    select 1 from public.notifications
    where source_activity_id = v_activity_id
      and recipient_application_user_id =
        '92000000-0000-0000-0000-000000000004'
  ) then
    raise exception 'FAIL: progress actor received self-notification';
  end if;

  if (select count(*) from public.notifications
      where source_activity_id = v_activity_id
        and recipient_application_user_id =
          '92000000-0000-0000-0000-000000000002') <> 1 then
    raise exception 'FAIL: duplicate manager/assignee progress notification';
  end if;
end $$;

-- Start by C and completion by Secretary use the same active assignee/manager
-- recipient rules and exclude each actor.
select set_config(
  'request.jwt.claims',
  '{"sub":"91000000-0000-0000-0000-000000000005","role":"authenticated"}',
  true
);
select public.start_committee_task(
  :'notification_task_id'::uuid,
  'notify-start'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"91000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);
select public.complete_committee_task(
  :'notification_task_id'::uuid,
  'Notification workflow complete',
  'notify-complete'
);

do $$
declare
  v_start_activity uuid;
  v_complete_activity uuid;
begin
  select id into v_start_activity
  from public.committee_task_activity
  where operation_id = 'notify-start';
  select id into v_complete_activity
  from public.committee_task_activity
  where operation_id = 'notify-complete';

  if (select count(*) from public.notifications
      where source_activity_id = v_start_activity
        and kind = 'task_started') <> 3 then
    raise exception 'FAIL: start recipient set is incorrect';
  end if;
  if exists (
    select 1 from public.notifications
    where source_activity_id = v_start_activity
      and recipient_application_user_id =
        '92000000-0000-0000-0000-000000000005'
  ) then
    raise exception 'FAIL: start actor received self-notification';
  end if;

  if (select count(*) from public.notifications
      where source_activity_id = v_complete_activity
        and kind = 'task_completed') <> 3 then
    raise exception 'FAIL: completion recipient set is incorrect';
  end if;
  if exists (
    select 1 from public.notifications
    where source_activity_id = v_complete_activity
      and recipient_application_user_id =
        '92000000-0000-0000-0000-000000000002'
  ) then
    raise exception 'FAIL: completion actor received self-notification';
  end if;
end $$;

-- Personal notification APIs derive ownership from the authenticated user.
select set_config(
  'test.other_notification_id',
  (
    select id::text
    from public.notifications
    where recipient_application_user_id =
      '92000000-0000-0000-0000-000000000005'
      and read_at is null
    limit 1
  ),
  true
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"91000000-0000-0000-0000-000000000004","role":"authenticated"}',
  true
);

do $$
declare
  v_own_count bigint;
  v_other_notification_id uuid;
  v_own_notification_id uuid;
  v_before bigint;
  v_marked integer;
begin
  select count(*) into v_own_count
  from public.list_my_notifications(100, 0, false);
  if v_own_count = 0 then
    raise exception 'FAIL: owner could not list notifications';
  end if;

  if v_own_count <> public.get_my_unread_notification_count() then
    raise exception 'FAIL: unread count does not match unread owner rows';
  end if;

  v_other_notification_id :=
    current_setting('test.other_notification_id')::uuid;

  begin
    perform public.mark_my_notification_read(v_other_notification_id);
    raise exception 'FAIL: user marked another recipient notification read';
  exception when no_data_found then null;
  end;

  select id into v_own_notification_id
  from public.list_my_notifications(1, 0, true);
  v_before := public.get_my_unread_notification_count();
  perform public.mark_my_notification_read(v_own_notification_id);
  if public.get_my_unread_notification_count() <> v_before - 1 then
    raise exception 'FAIL: mark_my_notification_read did not update owner row';
  end if;

  v_marked := public.mark_all_my_notifications_read();
  if v_marked <> v_before - 1
     or public.get_my_unread_notification_count() <> 0
     or (select count(*) from public.list_my_notifications(100, 0, true)) <> 0 then
    raise exception 'FAIL: mark_all_my_notifications_read result is incorrect';
  end if;

end $$;
reset role;

do $$
begin
  if not exists (
    select 1 from public.notifications
    where id = current_setting('test.other_notification_id')::uuid
      and read_at is null
  ) then
    raise exception 'FAIL: mark all altered another recipient notifications';
  end if;
end $$;

-- Authenticated clients cannot browse or mutate the notification table and
-- cannot invoke internal notification helpers.
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"91000000-0000-0000-0000-000000000004","role":"authenticated"}',
  true
);
do $$
begin
  begin
    perform count(*) from public.notifications;
    raise exception 'FAIL: authenticated browsed notification table';
  exception when insufficient_privilege then null;
  end;

  begin
    insert into public.notifications (
      recipient_application_user_id,
      kind,
      title,
      body,
      target_path,
      source_type,
      source_entity_id
    ) values (
      '92000000-0000-0000-0000-000000000004',
      'task_updated',
      'Forged',
      'Forged notification',
      '/work',
      'committee_task',
      current_setting('test.notification_task_id')::uuid
    );
    raise exception 'FAIL: authenticated directly inserted notification';
  exception when insufficient_privilege then null;
  end;

  begin
    update public.notifications set read_at = now();
    raise exception 'FAIL: authenticated directly updated notification table';
  exception when insufficient_privilege then null;
  end;

  begin
    delete from public.notifications;
    raise exception 'FAIL: authenticated directly deleted notifications';
  exception when insufficient_privilege then null;
  end;

  begin
    perform public.create_committee_task_notifications(
      current_setting('test.notification_task_id')::uuid,
      (select id from public.committee_task_activity limit 1),
      'task_updated',
      array['92000000-0000-0000-0000-000000000004'::uuid],
      'Forged',
      'Forged notification',
      '/work',
      '{}'::jsonb
    );
    raise exception 'FAIL: authenticated invoked internal notification helper';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
do $$
begin
  begin
    perform public.list_my_notifications(50, 0, false);
    raise exception 'FAIL: anon listed notifications';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.get_my_unread_notification_count();
    raise exception 'FAIL: anon read unread notification count';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.mark_all_my_notifications_read();
    raise exception 'FAIL: anon marked notifications read';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- Notification failure aborts the task, activity, and notification together.
create function public.test_reject_task_notification()
returns trigger
language plpgsql
as $$
begin
  if new.body like '%Rollback notification task%' then
    raise exception 'injected_notification_failure';
  end if;
  return new;
end;
$$;

create trigger test_reject_task_notification
before insert on public.notifications
for each row execute function public.test_reject_task_notification();

select set_config(
  'request.jwt.claims',
  '{"sub":"91000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);
do $$
begin
  begin
    perform public.create_committee_task(
      'Rollback notification task',
      null,
      'normal',
      null,
      array['92000000-0000-0000-0000-000000000003'::uuid],
      'notify-rollback'
    );
    raise exception 'FAIL: notification failure did not abort task creation';
  exception when raise_exception then
    if sqlerrm <> 'injected_notification_failure' then
      raise;
    end if;
  end;

  if exists (
    select 1 from public.committee_tasks
    where title = 'Rollback notification task'
  ) or exists (
    select 1 from public.committee_task_activity
    where operation_id = 'notify-rollback'
  ) then
    raise exception 'FAIL: notification failure left task or activity state';
  end if;
end $$;

drop trigger test_reject_task_notification on public.notifications;
drop function public.test_reject_task_notification();

-- Grant, RLS, uniqueness, and legacy task authorization assertions.
do $$
begin
  if not (
    select relrowsecurity
    from pg_class
    where oid = 'public.notifications'::regclass
  ) then
    raise exception 'FAIL: notifications RLS is disabled';
  end if;

  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'notifications'
  ) then
    raise exception 'FAIL: notifications table has a direct client RLS policy';
  end if;

  if has_table_privilege('anon', 'public.notifications', 'select')
     or has_table_privilege('authenticated', 'public.notifications', 'select')
     or has_table_privilege('authenticated', 'public.notifications', 'insert')
     or has_table_privilege('authenticated', 'public.notifications', 'update')
     or has_table_privilege('authenticated', 'public.notifications', 'delete') then
    raise exception 'FAIL: notification table has client privileges';
  end if;

  if has_function_privilege(
       'authenticated',
       'public.create_committee_task_notifications(uuid,uuid,text,uuid[],text,text,text,jsonb)',
       'execute'
     ) or has_function_privilege(
       'authenticated',
       'public.committee_task_event_recipient_ids(uuid)',
       'execute'
     ) then
    raise exception 'FAIL: internal notification helper is client callable';
  end if;

  if has_function_privilege(
       'anon',
       'public.list_my_notifications(integer,integer,boolean)',
       'execute'
     ) or has_function_privilege(
       'anon',
       'public.get_my_unread_notification_count()',
       'execute'
     ) or has_function_privilege(
       'anon',
       'public.mark_my_notification_read(uuid)',
       'execute'
     ) or has_function_privilege(
       'anon',
       'public.mark_all_my_notifications_read()',
       'execute'
     ) or not has_function_privilege(
       'authenticated',
       'public.list_my_notifications(integer,integer,boolean)',
       'execute'
     ) or not has_function_privilege(
       'authenticated',
       'public.get_my_unread_notification_count()',
       'execute'
     ) or not has_function_privilege(
       'authenticated',
       'public.mark_my_notification_read(uuid)',
       'execute'
     ) or not has_function_privilege(
       'authenticated',
       'public.mark_all_my_notifications_read()',
       'execute'
     ) then
    raise exception 'FAIL: personal notification RPC grants are incorrect';
  end if;
end $$;

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"91000000-0000-0000-0000-000000000006","role":"authenticated"}',
  true
);
do $$
begin
  begin
    perform public.list_committee_tasks(50, 0);
    raise exception 'FAIL: notification work broadened Member task access';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

\echo '============================================'
\echo ' ALL COMMITTEE TASK NOTIFICATION TESTS PASSED'
\echo '============================================'

rollback;
