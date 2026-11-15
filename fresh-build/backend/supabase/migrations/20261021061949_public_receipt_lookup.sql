-- Server-only projection for an exact active receipt code. Publication is
-- independently gated in the web route until masjid field approval is signed.
begin;
create function public.lookup_active_receipt(p_code text)
returns table(receipt_date date, amount_paise text)
language plpgsql stable security definer set search_path=pg_catalog as $$
declare v_uuid uuid;
begin
 if p_code is null or length(p_code)>40 then return; end if;
 if p_code ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
  v_uuid:=p_code::uuid;
 elsif p_code !~ '^MEM2-R-[0-9A-F]{32}$' then
  return;
 end if;
 return query
 select (r.issued_at at time zone 'Asia/Kolkata')::date,r.amount_paise::text
 from public.monthly_receipts r
 join public.ledger_entries le on le.id=r.ledger_entry_id
 join public.finance_effects e on e.source_type='monthly_contribution' and e.source_id=le.id
 where r.code=p_code and not exists
  (select 1 from public.finance_corrections c where c.original_effect_id=e.id)
 union all
 select (d.decided_at at time zone 'Asia/Kolkata')::date,d.actual_amount_paise::text
 from public.one_time_donations d
 join public.finance_effects e on e.source_type='one_time_donation' and e.source_id=d.id
 where d.receipt_code=v_uuid and d.status='verified' and not exists
  (select 1 from public.finance_corrections c where c.original_effect_id=e.id)
 union all
 select (r.issued_at at time zone 'Asia/Kolkata')::date,r.amount_paise::text
 from public.finance_correction_receipts r
 join public.finance_corrections c on c.id=r.correction_id
 join public.finance_effects e on e.source_type='correction' and e.source_id=c.id and e.leg=2
 where r.code=p_code and not exists
  (select 1 from public.finance_corrections later where later.original_effect_id=e.id)
 limit 2;
end $$;
revoke all on function public.lookup_active_receipt(text) from public,anon,authenticated;
grant execute on function public.lookup_active_receipt(text) to service_role;
commit;
