-- Authenticated preflight for the server's private QR upload path. Activation
-- repeats the active-account check under its account lock.
begin;
create function public.payment_qr_account_eligible(p_account_id uuid)
returns boolean language plpgsql stable security definer set search_path=pg_catalog as $$
declare v_actor uuid:=app_private.require_actor(array['president','data_entry']);
begin
  if p_account_id is null then return false; end if;
  return exists(select 1 from public.masjid_accounts a
    where a.id=p_account_id and a.active and a.kind in ('upi','bank'));
end;
$$;
revoke all on function public.payment_qr_account_eligible(uuid) from public,anon,authenticated;
grant execute on function public.payment_qr_account_eligible(uuid) to authenticated;
commit;
