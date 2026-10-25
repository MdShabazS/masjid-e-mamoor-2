-- Only the President may replace the masjid's payment destination QR.
-- Keep the account preflight and activation guard aligned with the server.
begin;

create or replace function public.payment_qr_account_eligible(p_account_id uuid)
returns boolean language plpgsql stable security definer set search_path=pg_catalog as $$
declare v_actor uuid:=app_private.require_actor(array['president']);
begin
  if p_account_id is null then return false; end if;
  return exists(select 1 from public.masjid_accounts a
    where a.id=p_account_id and a.active and a.kind in ('upi','bank'));
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

revoke all on function public.payment_qr_account_eligible(uuid) from public,anon,authenticated;
revoke all on function public.activate_payment_qr(uuid,text,text,uuid) from public,anon,authenticated;
grant execute on function public.payment_qr_account_eligible(uuid) to authenticated;
grant execute on function public.activate_payment_qr(uuid,text,text,uuid) to authenticated;
commit;
