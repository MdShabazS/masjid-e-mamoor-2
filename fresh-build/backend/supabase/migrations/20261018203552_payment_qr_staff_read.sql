-- Staff may review only the current QR for the account they selected.
begin;
create function public.active_payment_qr_for_staff(p_account_id uuid)
returns table(version_id uuid,asset_path text,sha256_hex text,asset_bytes bigint,
  activated_at timestamptz)
language plpgsql stable security definer set search_path=pg_catalog as $$
begin
  perform app_private.require_actor(array['president','treasurer']);
  if p_account_id is null then
    raise exception 'account_required' using errcode='22023'; end if;
  return query select q.id,q.asset_path,q.asset_sha256,a.bytes,q.activated_at
    from public.payment_qr_versions q
    join app_private.qr_assets a on a.asset_path=q.asset_path
      and a.sha256_hex=q.asset_sha256
    join public.masjid_accounts m on m.id=q.account_id
    where q.account_id=p_account_id and q.retired_at is null and m.active;
end;
$$;
revoke all on function public.active_payment_qr_for_staff(uuid) from public,anon,authenticated;
grant execute on function public.active_payment_qr_for_staff(uuid) to authenticated;
commit;
