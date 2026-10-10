\set ON_ERROR_STOP on

begin;

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at
)
select auth_id, '00000000-0000-0000-0000-000000000000'::uuid,
  'authenticated', 'authenticated', email, '', now(), now(), now()
from (values
  ('a1000000-0000-0000-0000-000000000001'::uuid, 'v2-president@example.invalid'),
  ('a1000000-0000-0000-0000-000000000002'::uuid, 'v2-committee-a@example.invalid'),
  ('a1000000-0000-0000-0000-000000000003'::uuid, 'v2-committee-b@example.invalid'),
  ('a1000000-0000-0000-0000-000000000004'::uuid, 'v2-member@example.invalid')
) fixture(auth_id, email);

insert into public.application_users (id, auth_user_id, status, display_name)
values
  ('a2000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'active', 'V2 President'),
  ('a2000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000002', 'active', 'V2 Committee A'),
  ('a2000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000003', 'active', 'V2 Committee B'),
  ('a2000000-0000-0000-0000-000000000004', 'a1000000-0000-0000-0000-000000000004', 'active', 'V2 Member');

insert into public.application_user_roles (application_user_id, role_id)
select application_user_id, roles.id
from (values
  ('a2000000-0000-0000-0000-000000000001'::uuid, 'president'),
  ('a2000000-0000-0000-0000-000000000002'::uuid, 'committee_member'),
  ('a2000000-0000-0000-0000-000000000003'::uuid, 'committee_member'),
  ('a2000000-0000-0000-0000-000000000004'::uuid, 'member')
) fixture(application_user_id, role_key)
join public.roles on roles.key = fixture.role_key;

select set_config('request.jwt.claims', '{"sub":"a1000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
select id as task_id
from public.create_committee_task(
  'V2 direct assignment', null, 'normal', current_date + 7,
  array[
    'a2000000-0000-0000-0000-000000000002'::uuid,
    'a2000000-0000-0000-0000-000000000003'::uuid
  ],
  'v2-task-create'
) \gset
select set_config('test.v2_task_id', :'task_id', true);

select set_config('request.jwt.claims', '{"sub":"a1000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
select public.decline_committee_task_assignment(:'task_id'::uuid, 'Unavailable', 'v2-decline');
select public.decline_committee_task_assignment(:'task_id'::uuid, 'Unavailable', 'v2-decline');

do $$
begin
  if (select count(*) from public.committee_task_assignees
      where task_id = current_setting('test.v2_task_id')::uuid and removed_at is null) <> 1 then
    raise exception 'FAIL: decline did not preserve the other active assignee';
  end if;
  if (select count(*) from public.committee_task_activity
      where task_id = current_setting('test.v2_task_id')::uuid and operation_id = 'v2-decline') <> 1 then
    raise exception 'FAIL: decline replay duplicated activity';
  end if;
  if not exists (
    select 1 from public.committee_task_activity
    where task_id = current_setting('test.v2_task_id')::uuid
      and activity_type = 'assignment_declined'
      and details ->> 'remaining_assignee_count' = '1'
  ) then
    raise exception 'FAIL: decline activity did not retain multi-assignee semantics';
  end if;
  if not exists (
    select 1 from public.notifications
    where source_entity_id = current_setting('test.v2_task_id')::uuid and kind = 'task_declined'
  ) then
    raise exception 'FAIL: decline did not notify an authorized recipient';
  end if;
  begin
    perform public.decline_committee_task_assignment(current_setting('test.v2_task_id')::uuid, 'Changed', 'v2-decline');
    raise exception 'FAIL: conflicting decline replay was accepted';
  exception when unique_violation then null;
  end;
end $$;

select set_config('request.jwt.claims', '{"sub":"a1000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
select public.start_committee_task(:'task_id'::uuid, 'v2-task-start');
do $$
begin
  begin
    perform public.decline_committee_task_assignment(
      current_setting('test.v2_task_id')::uuid,
      null,
      'v2-decline-in-progress'
    );
    raise exception 'FAIL: in-progress task assignment was declined';
  exception when invalid_parameter_value then null;
  end;
end $$;

select set_config('request.jwt.claims', '{"sub":"a1000000-0000-0000-0000-000000000004","role":"authenticated"}', true);
do $$
begin
  begin
    perform public.decline_committee_task_assignment(current_setting('test.v2_task_id')::uuid, null, 'member-decline');
    raise exception 'FAIL: ordinary Member declined a task';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.publish_announcement('Forged announcement', 'Not allowed', '/announcements', 'member-announcement');
    raise exception 'FAIL: ordinary Member published an announcement';
  exception when insufficient_privilege then null;
  end;
end $$;

select set_config('request.jwt.claims', '{"sub":"a1000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
select id as announcement_id
from public.publish_announcement(
  'Committee update', 'The meeting time has changed.', '/announcements', 'v2-announcement'
) \gset
select set_config('test.v2_announcement_id', :'announcement_id', true);
select public.publish_announcement(
  'Committee update', 'The meeting time has changed.', '/announcements', 'v2-announcement'
);

do $$
begin
  if (select count(*) from public.announcements where operation_id = 'v2-announcement') <> 1 then
    raise exception 'FAIL: announcement replay duplicated the durable record';
  end if;
  if (select count(*) from public.notifications
      where source_entity_id = current_setting('test.v2_announcement_id')::uuid and kind = 'announcement') <> 4 then
    raise exception 'FAIL: announcement recipients did not resolve from active permission holders';
  end if;
  begin
    perform public.publish_announcement('Changed title', 'The meeting time has changed.', '/announcements', 'v2-announcement');
    raise exception 'FAIL: conflicting announcement replay was accepted';
  exception when unique_violation then null;
  end;
end $$;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a1000000-0000-0000-0000-000000000004","role":"authenticated"}', true);
do $$
begin
  if (select count(*) from public.list_my_announcements(50, 0)) <> 1 then
    raise exception 'FAIL: personal announcement list did not return own recipient row';
  end if;
  begin
    insert into public.announcements (
      created_by_application_user_id, title, body, operation_id, request_fingerprint
    ) values (
      'a2000000-0000-0000-0000-000000000004', 'Direct write', 'Forbidden', 'direct', repeat('a', 64)
    );
    raise exception 'FAIL: authenticated user directly inserted an announcement';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

do $$
begin
  if pg_catalog.has_function_privilege('anon', 'public.publish_announcement(text,text,text,text)', 'EXECUTE')
     or pg_catalog.has_function_privilege('anon', 'public.decline_committee_task_assignment(uuid,text,text)', 'EXECUTE')
     or pg_catalog.has_function_privilege('anon', 'public.list_my_announcements(integer,integer)', 'EXECUTE') then
    raise exception 'FAIL: anon can execute a V2 trusted operation';
  end if;
  if pg_catalog.has_table_privilege('authenticated', 'public.announcements', 'INSERT,UPDATE,DELETE,SELECT') then
    raise exception 'FAIL: authenticated has direct announcement table privileges';
  end if;
end $$;

rollback;
