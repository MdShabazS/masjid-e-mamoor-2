begin;

create or replace function public.claim_notification_push_batch(
  p_limit integer default 100
)
returns table (
  delivery_id uuid,
  notification_id uuid,
  expo_push_token text,
  title text,
  body text,
  target_path text
)
language plpgsql
security definer
set search_path = pg_catalog, extensions
as $$
declare
  v_claimed record;
  v_device_count integer;
begin
  if coalesce(
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'),
    ''
  ) <> 'service_role' then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if p_limit is null or p_limit not between 1 and 100 then
    raise exception 'invalid_batch_limit' using errcode = '22023';
  end if;

  update public.notification_push_deliveries d
  set state = 'failed', last_error_code = 'retry_limit_reached',
      locked_until = null, updated_at = now()
  where d.state = 'sending'
    and d.locked_until < now()
    and d.attempts >= 5;

  update public.notification_push_deliveries d
  set state = 'receipt_pending', locked_until = null, updated_at = now()
  where d.state = 'checking_receipt'
    and d.locked_until < now();

  for v_claimed in
    select o.id, o.notification_id
    from public.notification_push_outbox o
    where o.state = 'pending'
      and o.available_at <= now()
    order by o.available_at, o.created_at
    for update skip locked
    limit p_limit
  loop
    insert into public.notification_push_deliveries as existing (
      notification_id, device_id
    )
    select v_claimed.notification_id, d.id
    from public.notifications n
    join public.application_users au
      on au.id = n.recipient_application_user_id
     and au.status = 'active'
    join public.notification_push_devices d
      on d.application_user_id = au.id
     and d.active
    where n.id = v_claimed.notification_id
    on conflict on constraint notification_push_delivery_notification_device_uidx
      do nothing;

    get diagnostics v_device_count = row_count;
    if v_device_count = 0 and not exists (
      select 1 from public.notification_push_deliveries d
      where d.notification_id = v_claimed.notification_id
    ) then
      update public.notification_push_outbox o
      set state = 'no_devices', updated_at = now()
      where o.id = v_claimed.id;
    else
      update public.notification_push_outbox o
      set state = 'dispatched', updated_at = now()
      where o.id = v_claimed.id;
    end if;
  end loop;

  return query
  with candidates as (
    select d.id
    from public.notification_push_deliveries d
    join public.notification_push_outbox o
      on o.notification_id = d.notification_id
     and o.state = 'dispatched'
    where (
        (d.state = 'pending' and d.available_at <= now())
        or (d.state = 'sending' and d.locked_until < now())
      )
      and d.attempts < 5
    order by d.available_at, d.created_at
    for update of d skip locked
    limit p_limit
  ), claimed as (
    update public.notification_push_deliveries d
    set state = 'sending',
        attempts = d.attempts + 1,
        locked_until = now() + interval '5 minutes',
        updated_at = now()
    from candidates c
    where d.id = c.id
    returning d.id, d.notification_id, d.device_id
  )
  select c.id, n.id, device.expo_push_token, n.title, n.body, n.target_path
  from claimed c
  join public.notifications n on n.id = c.notification_id
  join public.notification_push_devices device
    on device.id = c.device_id and device.active
  order by c.id;
end;
$$;

revoke all on function public.claim_notification_push_batch(integer)
from public, anon, authenticated;
grant execute on function public.claim_notification_push_batch(integer)
to service_role;

commit;
