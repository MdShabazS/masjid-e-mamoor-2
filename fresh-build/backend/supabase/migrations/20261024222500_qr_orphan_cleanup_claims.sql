-- Claim stale, unreferenced QR objects before a Storage API removal.
-- Claims are permanent tombstones: an old operation ID cannot be reused after removal.
begin;

create table if not exists app_private.qr_cleanup_claims (
  asset_path text primary key check (asset_path ~ '^payment-qr/[0-9a-f-]{36}[.](png|jpg|jpeg)$'),
  claimed_at timestamptz not null default now(),
  removed_at timestamptz,
  check (removed_at is null or removed_at >= claimed_at)
);
alter table app_private.qr_cleanup_claims enable row level security;
revoke all on app_private.qr_cleanup_claims from public, anon, authenticated;

create or replace function public.claim_stale_qr_object(p_asset_path text)
returns boolean language plpgsql security definer set search_path=pg_catalog as $$
declare v_path text:=btrim(p_asset_path); v_created timestamptz; v_verified timestamptz;
begin
  if v_path is null or v_path !~ '^payment-qr/[0-9a-f-]{36}[.](png|jpg|jpeg)$' then
    raise exception 'invalid_qr_cleanup_path' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(98341250);
  if exists(select 1 from public.payment_qr_versions where asset_path=v_path) then
    return false; end if;
  if exists(select 1 from app_private.qr_cleanup_claims
      where asset_path=v_path and removed_at is null) then return true; end if;
  select o.created_at into v_created from storage.objects o
    where o.bucket_id='qr-private' and o.name=v_path;
  if v_created is null or v_created>=now()-interval '24 hours' then return false; end if;
  select a.verified_at into v_verified from app_private.qr_assets a
    where a.asset_path=v_path;
  if v_verified is not null and v_verified>=now()-interval '24 hours' then return false; end if;
  -- A late retry can re-upload to a previously removed path. Keep the
  -- tombstone, but permit another removal after the new object ages.
  insert into app_private.qr_cleanup_claims(asset_path) values(v_path)
    on conflict(asset_path) do update set claimed_at=now(),removed_at=null;
  return true;
end;
$$;

create or replace function public.finish_qr_object_cleanup(p_asset_path text)
returns boolean language plpgsql security definer set search_path=pg_catalog as $$
declare v_path text:=btrim(p_asset_path);
begin
  if v_path is null or v_path !~ '^payment-qr/[0-9a-f-]{36}[.](png|jpg|jpeg)$' then
    raise exception 'invalid_qr_cleanup_path' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(98341250);
  if not exists(select 1 from app_private.qr_cleanup_claims
      where asset_path=v_path and removed_at is null) then return false; end if;
  if exists(select 1 from public.payment_qr_versions where asset_path=v_path)
    or exists(select 1 from storage.objects
      where bucket_id='qr-private' and name=v_path) then return false; end if;
  delete from app_private.qr_assets where asset_path=v_path;
  update app_private.qr_cleanup_claims set removed_at=clock_timestamp()
    where asset_path=v_path and removed_at is null;
  return true;
end;
$$;

create or replace function public.register_verified_qr_asset(p_asset_path text,p_sha256_hex text,p_bytes bigint)
returns void language plpgsql security definer set search_path=pg_catalog as $$
declare v_path text:=btrim(p_asset_path); v_digest text:=lower(btrim(p_sha256_hex));
begin
  if v_path is null or v_path !~ '^[a-z0-9/_-]+[.](png|jpg|jpeg)$'
    or v_digest is null or v_digest !~ '^[0-9a-f]{64}$'
    or p_bytes is null or p_bytes<1 or p_bytes>5242880 then
    raise exception 'invalid_qr_asset' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(98341250);
  if exists(select 1 from app_private.qr_cleanup_claims where asset_path=v_path) then
    raise exception 'qr_operation_retired' using errcode='23505'; end if;
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

create or replace function public.activate_payment_qr(
  p_account_id uuid,p_asset_path text,p_sha256_hex text,p_operation_id uuid)
returns uuid language plpgsql security definer set search_path=pg_catalog as $$
declare v_actor uuid:=app_private.require_actor(array['president']);
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
  if exists(select 1 from app_private.qr_cleanup_claims where asset_path=v_path) then
    raise exception 'qr_operation_retired' using errcode='23505'; end if;
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

revoke all on function public.claim_stale_qr_object(text) from public,anon,authenticated;
revoke all on function public.finish_qr_object_cleanup(text) from public,anon,authenticated;
grant execute on function public.claim_stale_qr_object(text) to service_role;
grant execute on function public.finish_qr_object_cleanup(text) to service_role;
commit;
