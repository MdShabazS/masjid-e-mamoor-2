-- Durable, private push-delivery queue for V1 notifications.
-- Delivery is transport only; public.notifications remains authoritative.

begin;

create table public.notification_push_devices (
  id uuid primary key default gen_random_uuid(),
  application_user_id uuid not null
    references public.application_users(id) on delete restrict,
  device_id uuid not null,
  platform text not null check (platform in ('android', 'ios')),
  expo_push_token text not null,
  active boolean not null default true,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notification_push_device_token_format_chk check (
    length(expo_push_token) between 20 and 512
    and (
      expo_push_token like 'ExponentPushToken[%]'
      or expo_push_token like 'ExpoPushToken[%]'
    )
  ),
  constraint notification_push_device_user_device_uidx
    unique (application_user_id, device_id),
  constraint notification_push_device_token_uidx unique (expo_push_token)
);

create index notification_push_devices_active_user_idx
  on public.notification_push_devices(application_user_id)
  where active;

create table public.notification_push_outbox (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null unique
    references public.notifications(id) on delete restrict,
  state text not null default 'pending' check (
    state in ('pending', 'dispatching', 'dispatched', 'no_devices', 'dead_letter')
  ),
  attempts integer not null default 0 check (attempts between 0 and 8),
  available_at timestamptz not null default now(),
  locked_until timestamptz,
  last_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index notification_push_outbox_pending_idx
  on public.notification_push_outbox(available_at, created_at)
  where state = 'pending';

create table public.notification_push_deliveries (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null
    references public.notifications(id) on delete restrict,
  device_id uuid not null
    references public.notification_push_devices(id) on delete restrict,
  state text not null default 'pending' check (
    state in ('pending', 'sending', 'receipt_pending', 'checking_receipt', 'delivered', 'failed')
  ),
  attempts integer not null default 0 check (attempts between 0 and 8),
  available_at timestamptz not null default now(),
  locked_until timestamptz,
  expo_ticket_id text,
  ticket_created_at timestamptz,
  last_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notification_push_delivery_notification_device_uidx
    unique (notification_id, device_id)
);

create index notification_push_deliveries_pending_idx
  on public.notification_push_deliveries(available_at, created_at)
  where state = 'pending';
create index notification_push_deliveries_receipt_idx
  on public.notification_push_deliveries(ticket_created_at)
  where state = 'receipt_pending';

alter table public.notification_push_devices enable row level security;
alter table public.notification_push_outbox enable row level security;
alter table public.notification_push_deliveries enable row level security;

revoke all on table public.notification_push_devices,
  public.notification_push_outbox,
  public.notification_push_deliveries
from public, anon, authenticated, service_role;

create or replace function public.enqueue_notification_push()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, extensions
as $$
begin
  insert into public.notification_push_outbox(notification_id)
  values (new.id)
  on conflict (notification_id) do nothing;
  return new;
end;
$$;

revoke all on function public.enqueue_notification_push()
from public, anon, authenticated, service_role;

create trigger notifications_push_outbox_insert
after insert on public.notifications
for each row execute function public.enqueue_notification_push();

create or replace function public.register_my_notification_push_device(
  p_device_id uuid,
  p_platform text,
  p_expo_push_token text
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, extensions
as $$
declare
  v_application_user_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if p_device_id is null
     or p_platform not in ('android', 'ios')
     or p_expo_push_token is null
     or length(p_expo_push_token) not between 20 and 512
     or not (
       p_expo_push_token like 'ExponentPushToken[%]'
       or p_expo_push_token like 'ExpoPushToken[%]'
     ) then
    raise exception 'invalid_push_device' using errcode = '22023';
  end if;

  select au.id
  into v_application_user_id
  from public.application_users au
  where au.auth_user_id = auth.uid()
    and au.status = 'active'
    and public.has_application_permission('notifications.own.read');

  if v_application_user_id is null then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  insert into public.notification_push_devices (
    application_user_id, device_id, platform, expo_push_token,
    active, last_seen_at, updated_at
  ) values (
    v_application_user_id, p_device_id, p_platform, p_expo_push_token,
    true, now(), now()
  )
  on conflict (application_user_id, device_id) do update
    set platform = excluded.platform,
        expo_push_token = excluded.expo_push_token,
        active = true,
        last_seen_at = now(),
        updated_at = now();

  return true;
exception
  when unique_violation then
    raise exception 'push_token_already_registered' using errcode = '23505';
end;
$$;

revoke all on function public.register_my_notification_push_device(uuid, text, text)
from public, anon;
grant execute on function public.register_my_notification_push_device(uuid, text, text)
to authenticated;

create or replace function public.unregister_my_notification_push_device(
  p_device_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, extensions
as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  update public.notification_push_devices d
  set active = false, updated_at = now()
  from public.application_users au
  where au.id = d.application_user_id
    and au.auth_user_id = auth.uid()
    and d.device_id = p_device_id
    and d.active;

  return true;
end;
$$;

revoke all on function public.unregister_my_notification_push_device(uuid)
from public, anon;
grant execute on function public.unregister_my_notification_push_device(uuid)
to authenticated;

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

  for v_claimed in
    select o.id, o.notification_id
    from public.notification_push_outbox o
    where o.state = 'pending'
      and o.available_at <= now()
    order by o.available_at, o.created_at
    for update skip locked
    limit p_limit
  loop
    insert into public.notification_push_deliveries(notification_id, device_id)
    select v_claimed.notification_id, d.id
    from public.notifications n
    join public.application_users au
      on au.id = n.recipient_application_user_id
     and au.status = 'active'
    join public.notification_push_devices d
      on d.application_user_id = au.id
     and d.active
    where n.id = v_claimed.notification_id
    on conflict (notification_id, device_id) do nothing;

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

create or replace function public.record_notification_push_ticket(
  p_delivery_id uuid,
  p_ticket_status text,
  p_ticket_id text default null,
  p_error_code text default null
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, extensions
as $$
declare
  v_delivery public.notification_push_deliveries;
begin
  if coalesce(
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'),
    ''
  ) <> 'service_role' then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  select d.* into v_delivery
  from public.notification_push_deliveries d
  where d.id = p_delivery_id
  for update;
  if not found or v_delivery.state <> 'sending' then
    raise exception 'push_delivery_not_claimed' using errcode = '55000';
  end if;

  if p_ticket_status = 'ok' and p_ticket_id is not null then
    update public.notification_push_deliveries
    set state = 'receipt_pending', expo_ticket_id = p_ticket_id,
        ticket_created_at = now(), locked_until = null, updated_at = now()
    where id = p_delivery_id;
  elsif p_error_code = 'DeviceNotRegistered' then
    update public.notification_push_devices
    set active = false, updated_at = now()
    where id = v_delivery.device_id;
    update public.notification_push_deliveries
    set state = 'failed', last_error_code = p_error_code,
        locked_until = null, updated_at = now()
    where id = p_delivery_id;
  elsif v_delivery.attempts < 5 and p_error_code in (
    'NetworkError', 'TOO_MANY_REQUESTS', 'ServerError', 'ServiceUnavailable'
  ) then
    update public.notification_push_deliveries
    set state = 'pending', last_error_code = p_error_code,
        available_at = now() + make_interval(mins => least(60, (2 ^ v_delivery.attempts)::integer)),
        locked_until = null, updated_at = now()
    where id = p_delivery_id;
  else
    update public.notification_push_deliveries
    set state = 'failed', last_error_code = coalesce(p_error_code, 'invalid_ticket'),
        locked_until = null, updated_at = now()
    where id = p_delivery_id;
  end if;
  return true;
end;
$$;

revoke all on function public.record_notification_push_ticket(uuid, text, text, text)
from public, anon, authenticated;
grant execute on function public.record_notification_push_ticket(uuid, text, text, text)
to service_role;

create or replace function public.claim_notification_push_receipts(
  p_limit integer default 100
)
returns table (delivery_id uuid, expo_ticket_id text)
language plpgsql
security definer
set search_path = pg_catalog, extensions
as $$
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

  return query
  with candidates as (
    select d.id
    from public.notification_push_deliveries d
    where d.state = 'receipt_pending'
      and d.ticket_created_at <= now() - interval '15 minutes'
    order by d.ticket_created_at
    for update skip locked
    limit p_limit
  ), claimed as (
    update public.notification_push_deliveries d
    set state = 'checking_receipt', locked_until = now() + interval '5 minutes',
        updated_at = now()
    from candidates c
    where d.id = c.id
    returning d.id, d.expo_ticket_id
  )
  select claimed.id, claimed.expo_ticket_id
  from claimed;
end;
$$;

revoke all on function public.claim_notification_push_receipts(integer)
from public, anon, authenticated;
grant execute on function public.claim_notification_push_receipts(integer)
to service_role;

create or replace function public.record_notification_push_receipt(
  p_delivery_id uuid,
  p_receipt_status text,
  p_error_code text default null
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, extensions
as $$
declare
  v_delivery public.notification_push_deliveries;
begin
  if coalesce(
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'),
    ''
  ) <> 'service_role' then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  select d.* into v_delivery
  from public.notification_push_deliveries d
  where d.id = p_delivery_id
  for update;
  if not found or v_delivery.state <> 'checking_receipt' then
    raise exception 'push_receipt_not_claimed' using errcode = '55000';
  end if;

  if p_receipt_status = 'ok' then
    update public.notification_push_deliveries
    set state = 'delivered', locked_until = null, updated_at = now()
    where id = p_delivery_id;
  elsif p_receipt_status = 'pending' then
    update public.notification_push_deliveries
    set state = 'receipt_pending', ticket_created_at = now(),
        locked_until = null, updated_at = now()
    where id = p_delivery_id;
  elsif p_error_code = 'DeviceNotRegistered' then
    update public.notification_push_devices
    set active = false, updated_at = now()
    where id = v_delivery.device_id;
    update public.notification_push_deliveries
    set state = 'failed', last_error_code = p_error_code,
        locked_until = null, updated_at = now()
    where id = p_delivery_id;
  elsif v_delivery.attempts < 5 and p_error_code in (
    'NetworkError', 'TOO_MANY_REQUESTS', 'ServerError', 'ServiceUnavailable'
  ) then
    update public.notification_push_deliveries
    set state = 'pending', last_error_code = p_error_code,
        available_at = now() + make_interval(mins => least(60, (2 ^ v_delivery.attempts)::integer)),
        expo_ticket_id = null, ticket_created_at = null,
        locked_until = null, updated_at = now()
    where id = p_delivery_id;
  else
    update public.notification_push_deliveries
    set state = 'failed', last_error_code = coalesce(p_error_code, 'receipt_error'),
        locked_until = null, updated_at = now()
    where id = p_delivery_id;
  end if;
  return true;
end;
$$;

revoke all on function public.record_notification_push_receipt(uuid, text, text)
from public, anon, authenticated;
grant execute on function public.record_notification_push_receipt(uuid, text, text)
to service_role;

commit;
