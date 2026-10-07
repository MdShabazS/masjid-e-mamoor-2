\set ON_ERROR_STOP on

begin;

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
    '95000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'realtime-notify-a@example.invalid',
    '',
    now(),
    now(),
    now()
  ),
  (
    '95000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'realtime-notify-b@example.invalid',
    '',
    now(),
    now(),
    now()
  );

insert into public.application_users (
  id,
  auth_user_id,
  status,
  display_name
)
values
  (
    '96000000-0000-0000-0000-000000000001',
    '95000000-0000-0000-0000-000000000001',
    'active',
    'Realtime Notification User A'
  ),
  (
    '96000000-0000-0000-0000-000000000002',
    '95000000-0000-0000-0000-000000000002',
    'active',
    'Realtime Notification User B'
  );

do $$
declare
  v_cmd text;
  v_roles name[];
  v_qual text;
  v_policy_count integer;
  v_rls boolean;
begin
  select count(*)
  into v_policy_count
  from pg_catalog.pg_policies
  where schemaname = 'realtime'
    and tablename = 'messages'
    and policyname = 'authenticated_receive_own_notification_broadcasts';

  if v_policy_count <> 1 then
    raise exception 'FAIL: expected exactly one notification Realtime policy';
  end if;

  select cmd, roles, qual
  into v_cmd, v_roles, v_qual
  from pg_catalog.pg_policies
  where schemaname = 'realtime'
    and tablename = 'messages'
    and policyname = 'authenticated_receive_own_notification_broadcasts';

  if v_cmd <> 'SELECT' then
    raise exception 'FAIL: notification Realtime policy is not SELECT-only';
  end if;

  if not ('authenticated'::name = any(v_roles))
     or cardinality(v_roles) <> 1 then
    raise exception 'FAIL: notification Realtime policy role is not authenticated-only';
  end if;

  if v_qual not ilike '%broadcast%'
     or v_qual not ilike '%realtime.topic%'
     or v_qual not ilike '%current_application_user_id%' then
    raise exception 'FAIL: notification Realtime policy ownership predicate is incomplete';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_policies
    where schemaname = 'realtime'
      and tablename = 'messages'
      and policyname = 'authenticated_receive_own_notification_broadcasts'
      and cmd = 'INSERT'
  ) then
    raise exception 'FAIL: notification Realtime policy unexpectedly permits INSERT';
  end if;

  select c.relrowsecurity
  into v_rls
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n
    on n.oid = c.relnamespace
  where n.nspname = 'realtime'
    and c.relname = 'messages';

  if v_rls is distinct from true then
    raise exception 'FAIL: realtime.messages RLS is not enabled';
  end if;
end
$$;

do $$
declare
  v_security_definer boolean;
  v_config text[];
  v_public_execute boolean;
  v_trigger_type smallint;
  v_trigger_function oid;
begin
  select p.prosecdef, p.proconfig
  into v_security_definer, v_config
  from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n
    on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'broadcast_notification_created'
    and pg_catalog.pg_get_function_identity_arguments(p.oid) = '';

  if not found then
    raise exception 'FAIL: broadcast_notification_created() not found';
  end if;

  if v_security_definer is distinct from true then
    raise exception 'FAIL: broadcast_notification_created() is not SECURITY DEFINER';
  end if;

  if not (
    'search_path=pg_catalog, extensions' = any(coalesce(v_config, '{}'::text[]))
  ) then
    raise exception 'FAIL: broadcast_notification_created() search_path is not pinned safely';
  end if;

  select exists (
    select 1
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n
      on n.oid = p.pronamespace
    cross join lateral pg_catalog.aclexplode(
      coalesce(
        p.proacl,
        pg_catalog.acldefault('f', p.proowner)
      )
    ) acl
    where n.nspname = 'public'
      and p.proname = 'broadcast_notification_created'
      and pg_catalog.pg_get_function_identity_arguments(p.oid) = ''
      and acl.grantee = 0
      and acl.privilege_type = 'EXECUTE'
  )
  into v_public_execute;

  if v_public_execute then
    raise exception 'FAIL: PUBLIC can execute broadcast_notification_created()';
  end if;

  if pg_catalog.has_function_privilege(
    'anon',
    'public.broadcast_notification_created()',
    'EXECUTE'
  ) then
    raise exception 'FAIL: anon can execute broadcast_notification_created()';
  end if;

  if pg_catalog.has_function_privilege(
    'authenticated',
    'public.broadcast_notification_created()',
    'EXECUTE'
  ) then
    raise exception 'FAIL: authenticated can execute broadcast_notification_created()';
  end if;

  if pg_catalog.has_function_privilege(
    'service_role',
    'public.broadcast_notification_created()',
    'EXECUTE'
  ) then
    raise exception 'FAIL: service_role can execute broadcast_notification_created()';
  end if;

  select t.tgtype, t.tgfoid
  into v_trigger_type, v_trigger_function
  from pg_catalog.pg_trigger t
  where t.tgrelid = 'public.notifications'::regclass
    and t.tgname = 'notifications_broadcast_created'
    and not t.tgisinternal;

  if not found then
    raise exception 'FAIL: notifications_broadcast_created trigger not found';
  end if;

  if (v_trigger_type & 1) = 0 then
    raise exception 'FAIL: notification broadcast trigger is not row-level';
  end if;

  if (v_trigger_type & 2) <> 0 then
    raise exception 'FAIL: notification broadcast trigger is BEFORE instead of AFTER';
  end if;

  if (v_trigger_type & 4) = 0 then
    raise exception 'FAIL: notification broadcast trigger does not fire on INSERT';
  end if;

  if (v_trigger_type & 8) <> 0
     or (v_trigger_type & 16) <> 0
     or (v_trigger_type & 32) <> 0 then
    raise exception 'FAIL: notification broadcast trigger fires on a forbidden operation';
  end if;

  if v_trigger_function <> 'public.broadcast_notification_created()'::regprocedure::oid then
    raise exception 'FAIL: notification broadcast trigger uses the wrong function';
  end if;
end
$$;

select set_config(
  'test.notification_broadcast_before',
  (
    select count(*)::text
    from realtime.messages
    where topic =
      'notifications:96000000-0000-0000-0000-000000000001'
      and event = 'notification_created'
  ),
  true
);

select set_config(
  'test.durable_notification_before',
  (
    select count(*)::text
    from public.notifications
    where id = '97000000-0000-0000-0000-000000000001'
  ),
  true
);

insert into public.notifications (
  id,
  recipient_application_user_id,
  actor_application_user_id,
  kind,
  title,
  body,
  target_path,
  source_type,
  source_entity_id,
  metadata
)
values (
  '97000000-0000-0000-0000-000000000001',
  '96000000-0000-0000-0000-000000000001',
  null,
  'task_assigned',
  'Realtime notification test',
  'Realtime broadcast trigger test.',
  '/work/98000000-0000-0000-0000-000000000001',
  'committee_task',
  '98000000-0000-0000-0000-000000000001',
  '{}'::jsonb
);

do $$
declare
  v_broadcast_before integer;
  v_broadcast_after integer;
  v_durable_before integer;
  v_durable_after integer;
begin
  v_broadcast_before :=
    current_setting('test.notification_broadcast_before')::integer;

  v_durable_before :=
    current_setting('test.durable_notification_before')::integer;

  select count(*)
  into v_broadcast_after
  from realtime.messages
  where topic =
      'notifications:96000000-0000-0000-0000-000000000001'
    and event = 'notification_created';

  if v_broadcast_after <> v_broadcast_before + 1 then
    raise exception
      'FAIL: notification INSERT did not create exactly one Realtime Broadcast message';
  end if;

  if not exists (
    select 1
    from realtime.messages
    where topic =
        'notifications:96000000-0000-0000-0000-000000000001'
      and event = 'notification_created'
      and extension = 'broadcast'
      and private is true
      and payload ->> 'operation' = 'INSERT'
      and payload ->> 'table' = 'notifications'
      and payload ->> 'schema' = 'public'
      and payload -> 'record' ->> 'id' =
        '97000000-0000-0000-0000-000000000001'
      and payload -> 'record' ->> 'recipient_application_user_id' =
        '96000000-0000-0000-0000-000000000001'
  ) then
    raise exception 'FAIL: Realtime Broadcast payload or private topic is incorrect';
  end if;

  select count(*)
  into v_durable_after
  from public.notifications
  where id = '97000000-0000-0000-0000-000000000001';

  if v_durable_after <> v_durable_before + 1 then
    raise exception 'FAIL: durable notification insert was not preserved exactly once';
  end if;

  perform set_config(
    'test.notification_broadcast_after_insert',
    v_broadcast_after::text,
    true
  );
end
$$;

update public.notifications
set read_at = now()
where id = '97000000-0000-0000-0000-000000000001';

do $$
declare
  v_after_insert integer;
  v_after_read_update integer;
begin
  v_after_insert :=
    current_setting('test.notification_broadcast_after_insert')::integer;

  select count(*)
  into v_after_read_update
  from realtime.messages
  where topic =
      'notifications:96000000-0000-0000-0000-000000000001'
    and event = 'notification_created';

  if v_after_read_update <> v_after_insert then
    raise exception 'FAIL: notification read_at UPDATE emitted a creation Broadcast';
  end if;

  if (
    select count(*)
    from public.notifications
    where id = '97000000-0000-0000-0000-000000000001'
  ) <> 1 then
    raise exception 'FAIL: realtime trigger duplicated the durable notification';
  end if;
end
$$;

set local role authenticated;

select set_config(
  'request.jwt.claims',
  '{"sub":"95000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);

select set_config(
  'realtime.topic',
  'notifications:96000000-0000-0000-0000-000000000001',
  true
);

do $$
begin
  if not exists (
    select 1
    from realtime.messages
    where topic =
        'notifications:96000000-0000-0000-0000-000000000001'
      and event = 'notification_created'
      and extension = 'broadcast'
      and payload -> 'record' ->> 'id' =
        '97000000-0000-0000-0000-000000000001'
  ) then
    raise exception 'FAIL: authenticated user cannot receive own notification topic';
  end if;
end
$$;

select set_config(
  'realtime.topic',
  'notifications:96000000-0000-0000-0000-000000000002',
  true
);

do $$
begin
  if exists (
    select 1
    from realtime.messages
    where topic =
        'notifications:96000000-0000-0000-0000-000000000001'
      and event = 'notification_created'
      and extension = 'broadcast'
      and payload -> 'record' ->> 'id' =
        '97000000-0000-0000-0000-000000000001'
  ) then
    raise exception 'FAIL: authenticated user can receive another notification topic';
  end if;
end
$$;

reset role;

set local role anon;

select set_config(
  'request.jwt.claims',
  '{"role":"anon"}',
  true
);

select set_config(
  'realtime.topic',
  'notifications:96000000-0000-0000-0000-000000000001',
  true
);

do $$
begin
  if exists (
    select 1
    from realtime.messages
    where event = 'notification_created'
      and extension = 'broadcast'
      and payload -> 'record' ->> 'id' =
        '97000000-0000-0000-0000-000000000001'
  ) then
    raise exception 'FAIL: anon can receive private notification broadcasts';
  end if;
end
$$;

reset role;

rollback;
