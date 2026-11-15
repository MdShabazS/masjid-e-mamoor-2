\set ON_ERROR_STOP on

begin;

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at
) values (
  'a7100000-0000-4000-8000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'push-test@invalid.example', '',
  now(), now(), now()
);

insert into public.application_users (id, auth_user_id, status)
values (
  'a7200000-0000-4000-8000-000000000001',
  'a7100000-0000-4000-8000-000000000001', 'active'
);

insert into public.application_user_roles (application_user_id, role_id)
select 'a7200000-0000-4000-8000-000000000001', r.id
from public.roles r where r.key = 'member';

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"a7100000-0000-4000-8000-000000000001","role":"authenticated"}', true);

do $$
begin
  begin
    select count(*) from public.notification_push_devices;
    raise exception 'FAIL: authenticated client can read push tokens';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.notification_push_devices (
      application_user_id, device_id, platform, expo_push_token
    ) values (
      'a7200000-0000-4000-8000-000000000001',
      'a7300000-0000-4000-8000-000000000001', 'android',
      'ExponentPushToken[unauthorized-direct-write]'
    );
    raise exception 'FAIL: authenticated client can write push-token table';
  exception when insufficient_privilege then null;
  end;
end;
$$;

select public.register_my_notification_push_device(
  'a7300000-0000-4000-8000-000000000001',
  'android',
  'ExponentPushToken[0123456789abcdefghijklmnopqrstuvwxyz]'
);

do $$
begin
  begin
    perform public.claim_notification_push_batch(10);
    raise exception 'FAIL: authenticated caller claimed server push work';
  exception when insufficient_privilege then null;
  end;
end;
$$;
reset role;

set local role anon;
do $$
begin
  begin
    perform public.register_my_notification_push_device(
      'a7300000-0000-4000-8000-000000000001', 'android',
      'ExponentPushToken[0123456789abcdefghijklmnopqrstuvwxyz]'
    );
    raise exception 'FAIL: anon executed device registration';
  exception when insufficient_privilege then null;
  end;
end;
$$;
reset role;

do $$
declare
  v_notification_id uuid;
  v_delivery_id uuid;
  v_receipt_delivery_id uuid;
  v_ticket_id text;
  v_count integer;
begin
  insert into public.notifications (
    recipient_application_user_id, kind, title, body,
    target_path, source_type, source_entity_id, metadata
  ) values (
    'a7200000-0000-4000-8000-000000000001',
    'task_assigned', 'Task assigned', 'A task is ready.',
    '/work', 'committee_task', gen_random_uuid(), '{}'::jsonb
  ) returning id into v_notification_id;

  select count(*) into v_count
  from public.notification_push_outbox
  where notification_id = v_notification_id and state = 'pending';
  if v_count <> 1 then
    raise exception 'FAIL: notification did not atomically enqueue one push job';
  end if;

  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  select c.delivery_id into v_delivery_id
  from public.claim_notification_push_batch(10) c
  where c.notification_id = v_notification_id;
  if v_delivery_id is null then
    raise exception 'FAIL: service worker did not claim the registered device';
  end if;

  v_ticket_id := 'ticket-' || v_delivery_id::text;
  perform public.record_notification_push_ticket(
    v_delivery_id, 'ok', v_ticket_id, null
  );
  update public.notification_push_deliveries
  set ticket_created_at = now() - interval '16 minutes'
  where id = v_delivery_id;

  select r.delivery_id into v_receipt_delivery_id
  from public.claim_notification_push_receipts(10) r
  where r.delivery_id = v_delivery_id;
  if v_receipt_delivery_id is null then
    raise exception 'FAIL: eligible Expo receipt was not claimed';
  end if;
  perform public.record_notification_push_receipt(v_delivery_id, 'ok', null);

  if (select state from public.notification_push_deliveries
      where id = v_delivery_id) <> 'delivered' then
    raise exception 'FAIL: successful provider receipt was not recorded';
  end if;
  if (select count(*) from public.notification_push_outbox
      where notification_id = v_notification_id) <> 1 then
    raise exception 'FAIL: duplicate outbox row created';
  end if;

end;
$$;

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"a7100000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select public.unregister_my_notification_push_device(
  'a7300000-0000-4000-8000-000000000001'
);
reset role;

do $$
declare
  v_notification_id uuid;
begin
  insert into public.notifications (
    recipient_application_user_id, kind, title, body,
    target_path, source_type, source_entity_id, metadata
  ) values (
    'a7200000-0000-4000-8000-000000000001',
    'task_assigned', 'Task assigned', 'A second task is ready.',
    '/work', 'committee_task', gen_random_uuid(), '{}'::jsonb
  ) returning id into v_notification_id;
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  if exists (select 1 from public.claim_notification_push_batch(10)) then
    raise exception 'FAIL: unregistered device received a push claim';
  end if;
  if (select state from public.notification_push_outbox
      where notification_id = v_notification_id) <> 'no_devices' then
    raise exception 'FAIL: missing device was not recorded on the outbox';
  end if;
end;
$$;

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"a7100000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select public.register_my_notification_push_device(
  'a7300000-0000-4000-8000-000000000001',
  'android',
  'ExponentPushToken[abcdefghijklmnopqrstuvwxyz0123456789]'
);
reset role;

do $$
declare
  v_notification_id uuid;
  v_delivery_id uuid;
begin
  insert into public.notifications (
    recipient_application_user_id, kind, title, body,
    target_path, source_type, source_entity_id, metadata
  ) values (
    'a7200000-0000-4000-8000-000000000001',
    'task_assigned', 'Task assigned', 'A third task is ready.',
    '/work', 'committee_task', gen_random_uuid(), '{}'::jsonb
  ) returning id into v_notification_id;
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  select c.delivery_id into v_delivery_id
  from public.claim_notification_push_batch(10) c
  where c.notification_id = v_notification_id;
  if v_delivery_id is null then
    raise exception 'FAIL: re-registered device was not claimable';
  end if;
  perform public.record_notification_push_ticket(
    v_delivery_id, 'error', null, 'DeviceNotRegistered'
  );
  if (select active from public.notification_push_devices
      where id = (select device_id from public.notification_push_deliveries
                 where id = v_delivery_id)) then
    raise exception 'FAIL: invalid Expo token remained active';
  end if;
end;
$$;

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"a7100000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select public.register_my_notification_push_device(
  'a7300000-0000-4000-8000-000000000001',
  'android',
  'ExponentPushToken[abcdefghijklmnopqrstuvwxyz0123456789]'
);
reset role;

do $$
declare
  v_notification_id uuid;
  v_delivery_id uuid;
  v_receipt_delivery_id uuid;
  v_attempt integer;
begin
  insert into public.notifications (
    recipient_application_user_id, kind, title, body,
    target_path, source_type, source_entity_id, metadata
  ) values (
    'a7200000-0000-4000-8000-000000000001',
    'task_assigned', 'Task assigned', 'A receipt retry task is ready.',
    '/work', 'committee_task', gen_random_uuid(), '{}'::jsonb
  ) returning id into v_notification_id;
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  select c.delivery_id into v_delivery_id
  from public.claim_notification_push_batch(10) c
  where c.notification_id = v_notification_id;
  perform public.record_notification_push_ticket(
    v_delivery_id, 'ok', 'ticket-receipt-retry', null
  );

  for v_attempt in 1..5 loop
    update public.notification_push_deliveries
    set ticket_created_at = now() - interval '16 minutes'
    where id = v_delivery_id;
    select r.delivery_id into v_receipt_delivery_id
    from public.claim_notification_push_receipts(10) r
    where r.delivery_id = v_delivery_id;
    if v_receipt_delivery_id is null then
      raise exception 'FAIL: receipt check % was not claimable', v_attempt;
    end if;
    perform public.record_notification_push_receipt(
      v_delivery_id, 'pending', null
    );
  end loop;

  update public.notification_push_deliveries
  set ticket_created_at = now() - interval '16 minutes'
  where id = v_delivery_id;
  if exists (
    select 1 from public.claim_notification_push_receipts(10)
    where delivery_id = v_delivery_id
  ) then
    raise exception 'FAIL: receipt polling exceeded the five-check bound';
  end if;
  if (select state from public.notification_push_deliveries
      where id = v_delivery_id) <> 'failed'
     or (select last_error_code from public.notification_push_deliveries
         where id = v_delivery_id) <> 'receipt_unavailable' then
    raise exception 'FAIL: exhausted receipt checks were not recorded as terminal';
  end if;
end;
$$;

rollback;
