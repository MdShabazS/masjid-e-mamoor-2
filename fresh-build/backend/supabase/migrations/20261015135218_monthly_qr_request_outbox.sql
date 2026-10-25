-- QR activation and safe, unsent request/reminder snapshots. No Meta send here.
begin;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('qr-private','qr-private',false,5242880,array['image/png','image/jpeg'])
on conflict (id) do nothing;
-- No authenticated/anon storage.objects policy is created. Only a server
-- secret can stage objects; the server validates actual bytes before registry.
create table app_private.qr_assets (
  asset_path text primary key,
  sha256_hex text not null check (sha256_hex ~ '^[0-9a-f]{64}$'),
  bytes bigint not null check (bytes between 1 and 5242880),
  verified_at timestamptz not null default now()
);
alter table app_private.qr_assets enable row level security;
revoke all on app_private.qr_assets from public,anon,authenticated;

alter table public.payment_qr_versions add column asset_sha256 text
  check (asset_sha256 ~ '^[0-9a-f]{64}$'),
  add column operation_id uuid unique;
alter table public.monthly_requests add column qr_sha256 text
  check (qr_sha256 ~ '^[0-9a-f]{64}$');

create function public.register_verified_qr_asset(p_asset_path text,p_sha256_hex text,p_bytes bigint)
returns void language plpgsql security definer set search_path=pg_catalog as $$
declare v_path text:=btrim(p_asset_path); v_digest text:=lower(btrim(p_sha256_hex));
begin
  if v_path is null or v_path !~ '^[a-z0-9/_-]+[.](png|jpg|jpeg)$'
    or v_digest is null or v_digest !~ '^[0-9a-f]{64}$'
    or p_bytes is null or p_bytes<1 or p_bytes>5242880 then
    raise exception 'invalid_qr_asset' using errcode='22023'; end if;
  if not exists(select 1 from storage.objects o where o.bucket_id='qr-private'
    and o.name=v_path) then
    raise exception 'qr_object_missing' using errcode='22023'; end if;
  insert into app_private.qr_assets(asset_path,sha256_hex,bytes)
    values(v_path,v_digest,p_bytes)
    on conflict(asset_path) do nothing;
  if not exists(select 1 from app_private.qr_assets
    where asset_path=v_path and sha256_hex=v_digest and bytes=p_bytes) then
    raise exception 'qr_asset_conflict' using errcode='23505'; end if;
end;
$$;

create function public.activate_payment_qr(
  p_account_id uuid,p_asset_path text,p_sha256_hex text,p_operation_id uuid)
returns uuid language plpgsql security definer set search_path=pg_catalog as $$
declare v_actor uuid:=app_private.require_actor(array['president','data_entry']);
        v_old public.payment_qr_versions; v_id uuid;
        v_path text:=btrim(p_asset_path); v_digest text:=lower(btrim(p_sha256_hex));
begin
  if p_operation_id is null or v_path is null or v_digest is null then
    raise exception 'invalid_activation' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(98341250);
  select * into v_old from public.payment_qr_versions where operation_id=p_operation_id;
  if found then
    if v_old.created_by<>v_actor or v_old.account_id<>p_account_id or
      v_old.asset_path<>v_path or v_old.asset_sha256<>v_digest then
      raise exception 'operation_id_conflict' using errcode='23505'; end if;
    return v_old.id;
  end if;
  perform 1 from public.masjid_accounts a where a.id=p_account_id and a.active
    and a.kind in ('upi','bank') for update;
  if not found then raise exception 'qr_account_not_active' using errcode='22023'; end if;
  if not exists(select 1 from app_private.qr_assets
      where asset_path=v_path and sha256_hex=v_digest) then
    raise exception 'qr_asset_not_verified' using errcode='22023'; end if;
  update public.payment_qr_versions
    set retired_at=greatest(clock_timestamp(),activated_at+interval '1 microsecond')
    where retired_at is null;
  insert into public.payment_qr_versions(account_id,asset_path,asset_sha256,created_by,operation_id)
    values(p_account_id,v_path,v_digest,v_actor,p_operation_id) returning id into v_id;
  return v_id;
end;
$$;

create table public.monthly_message_outbox (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.monthly_requests(id) on delete restrict,
  donor_id uuid not null references public.monthly_donors(id) on delete restrict,
  period_date date not null,
  purpose text not null check (purpose in ('request','reminder')),
  qr_sha256 text not null check (qr_sha256 ~ '^[0-9a-f]{64}$'),
  account_id uuid not null references public.masjid_accounts(id) on delete restrict,
  consent_version text not null,
  state text not null default 'queued' check (state in ('queued','sent','cancelled','failed')),
  queued_at timestamptz not null default now(),
  sent_at timestamptz,
  provider_message_id text unique,
  unique(donor_id,period_date,purpose),
  check ((state='sent' and sent_at is not null and provider_message_id is not null)
    or (state<>'sent' and sent_at is null and provider_message_id is null))
);
create index monthly_outbox_due on public.monthly_message_outbox(state,purpose,queued_at);
alter table public.monthly_message_outbox enable row level security;
revoke all on public.monthly_message_outbox from public,anon,authenticated;

-- Replace the prototype's permissive queue with a consent/digest guarded one.
create or replace function public.queue_monthly_request(p_donor_id uuid,p_period_date date)
returns public.monthly_requests language plpgsql security definer set search_path=pg_catalog as $$
declare v_donor public.monthly_donors; v_qr public.payment_qr_versions;
        v_request public.monthly_requests;
begin
  if p_period_date is null or extract(day from p_period_date)<>1 then
    raise exception 'invalid_period' using errcode='22023'; end if;
  select * into v_donor from public.monthly_donors where id=p_donor_id for update;
  if not found or not v_donor.active or v_donor.opted_out_at is not null then
    raise exception 'donor_not_active' using errcode='22023'; end if;
  if not exists(select 1 from app_private.approved_consent_versions v
      where v.version=v_donor.consent_version) then
    raise exception 'consent_version_not_approved' using errcode='42501'; end if;
  select q.* into v_qr from public.payment_qr_versions q
    join public.masjid_accounts a on a.id=q.account_id
    where q.retired_at is null and q.asset_sha256 is not null and a.active;
  if not found then raise exception 'verified_qr_required' using errcode='22023'; end if;
  insert into public.monthly_requests(donor_id,period_date,suggested_amount_paise,
    qr_version_id,account_id,qr_sha256)
    values(p_donor_id,p_period_date,v_donor.suggested_amount_paise,
      v_qr.id,v_qr.account_id,v_qr.asset_sha256)
    on conflict(donor_id,period_date) do nothing returning * into v_request;
  if v_request.id is null then
    select * into v_request from public.monthly_requests
      where donor_id=p_donor_id and period_date=p_period_date;
  end if;
  return v_request;
end;
$$;
-- Scheduler is the only service entrypoint for new ordinary requests.
revoke execute on function public.queue_monthly_request(uuid,date) from service_role;

create function public.dispatch_first_friday_monthly_requests(p_now timestamptz)
returns integer language plpgsql security definer set search_path=pg_catalog as $$
declare v_local timestamp; v_first date; v_friday date; v_period date;
        v_donor record; v_request public.monthly_requests; v_count integer:=0;
begin
  if p_now is null then raise exception 'invalid_dispatch_time' using errcode='22023'; end if;
  v_local:=p_now at time zone 'Asia/Kolkata';
  v_first:=date_trunc('month',v_local)::date;
  v_friday:=v_first+((5-extract(isodow from v_first)::int+7)%7);
  if v_local::date<>v_friday or v_local::time<time '10:00' then
    raise exception 'not_first_friday_window' using errcode='22023'; end if;
  v_period:=v_first;
  for v_donor in select d.id,d.consent_version from public.monthly_donors d
    join app_private.approved_consent_versions v on v.version=d.consent_version
    where d.active and d.opted_out_at is null order by d.id loop
    v_request:=public.queue_monthly_request(v_donor.id,v_period);
    insert into public.monthly_message_outbox(request_id,donor_id,period_date,purpose,
      qr_sha256,account_id,consent_version)
      values(v_request.id,v_donor.id,v_period,'request',v_request.qr_sha256,
        v_request.account_id,v_donor.consent_version)
      on conflict(donor_id,period_date,purpose) do nothing;
    if found then v_count:=v_count+1; end if;
  end loop;
  return v_count;
end;
$$;

create function public.queue_due_monthly_reminders(p_now timestamptz)
returns integer language plpgsql security definer set search_path=pg_catalog as $$
declare v_count integer;
begin
  if p_now is null then raise exception 'invalid_dispatch_time' using errcode='22023'; end if;
  insert into public.monthly_message_outbox(request_id,donor_id,period_date,purpose,
    qr_sha256,account_id,consent_version)
    select r.request_id,r.donor_id,r.period_date,'reminder',r.qr_sha256,
      r.account_id,r.consent_version
    from public.monthly_message_outbox r
    join public.monthly_donors d on d.id=r.donor_id
    join app_private.approved_consent_versions v on v.version=d.consent_version
    where r.purpose='request' and r.state='sent' and r.sent_at<=p_now-interval '5 days'
      and d.active and d.opted_out_at is null
      and public.monthly_reminder_eligible(d.id,r.period_date)
    on conflict(donor_id,period_date,purpose) do nothing;
  get diagnostics v_count=row_count;
  return v_count;
end;
$$;

revoke all on function public.register_verified_qr_asset(text,text,bigint) from public,anon,authenticated;
revoke all on function public.activate_payment_qr(uuid,text,text,uuid) from public,anon,authenticated;
revoke all on function public.dispatch_first_friday_monthly_requests(timestamptz) from public,anon,authenticated;
revoke all on function public.queue_due_monthly_reminders(timestamptz) from public,anon,authenticated;
grant execute on function public.register_verified_qr_asset(text,text,bigint) to service_role;
grant execute on function public.activate_payment_qr(uuid,text,text,uuid) to authenticated;
grant execute on function public.dispatch_first_friday_monthly_requests(timestamptz) to service_role;
grant execute on function public.queue_due_monthly_reminders(timestamptz) to service_role;
commit;
