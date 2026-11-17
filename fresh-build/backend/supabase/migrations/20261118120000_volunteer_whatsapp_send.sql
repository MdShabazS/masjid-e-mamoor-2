-- Owner decision 17 Nov 2026: until the WhatsApp Business API is integrated, volunteers send the
-- monthly request and reminder from their own WhatsApp. A donor's number is handed out only to
-- that donor's referrer, the Treasurer and the President, only for active donors who have not
-- opted out, and every hand-out is recorded. Receipt codes stay behind the receipt handoff gate.

create table app_private.donor_whatsapp_sends (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references public.app_users(id) on delete restrict,
  donor_id uuid not null references public.monthly_donors(id) on delete restrict,
  kind text not null check (kind in ('monthly_request','reminder')),
  period_date date not null check (extract(day from period_date) = 1),
  opened_at timestamptz not null default now()
);
create index donor_whatsapp_sends_donor on app_private.donor_whatsapp_sends(donor_id, period_date);
revoke all on app_private.donor_whatsapp_sends from public, anon, authenticated;
create trigger donor_whatsapp_sends_immutable before update or delete
on app_private.donor_whatsapp_sends
for each row execute function app_private.reject_immutable_finance_change();

-- The donors this person may message for a month, without their numbers.
create function public.list_messageable_donors(p_period date)
returns table(donor_id uuid, paid_for_period boolean)
language plpgsql stable security definer set search_path = pg_catalog
as $$
declare
  v_actor uuid := app_private.require_actor(array['president','vice_president','secretary',
    'treasurer','committee_member','member','data_entry']);
  v_all boolean;
begin
  if p_period is null or extract(day from p_period) <> 1 then
    raise exception 'invalid_whatsapp_send' using errcode = '22023';
  end if;
  select u.role in ('president','treasurer') into v_all from public.app_users u where u.id = v_actor;
  return query
    select d.id,
      exists (select 1 from public.payment_claims c
        where c.donor_id = d.id and c.period_date = p_period and c.status = 'verified')
    from public.monthly_donors d
    where d.active and d.opted_out_at is null and (v_all or d.referrer_id = v_actor)
    order by d.name, d.id;
end;
$$;

-- Hands out one donor's number for one message and records who asked.
create function public.prepare_donor_whatsapp(p_donor_id uuid, p_kind text, p_period date)
returns table(whatsapp text, donor_name text, suggested_amount_paise bigint)
language plpgsql security definer set search_path = pg_catalog
as $$
declare
  v_actor uuid := app_private.require_actor(array['president','vice_president','secretary',
    'treasurer','committee_member','member','data_entry']);
  v_role text;
  v_donor public.monthly_donors;
begin
  if p_kind is null or p_kind not in ('monthly_request','reminder')
     or p_period is null or extract(day from p_period) <> 1 then
    raise exception 'invalid_whatsapp_send' using errcode = '22023';
  end if;
  select u.role into v_role from public.app_users u where u.id = v_actor;
  select * into v_donor from public.monthly_donors d where d.id = p_donor_id;
  if not found or not v_donor.active or v_donor.opted_out_at is not null then
    raise exception 'donor_not_active' using errcode = '22023';
  end if;
  if v_role not in ('president','treasurer') and v_donor.referrer_id is distinct from v_actor then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if p_kind = 'reminder' and exists (select 1 from public.payment_claims c
      where c.donor_id = p_donor_id and c.period_date = p_period and c.status = 'verified') then
    raise exception 'already_paid_for_period' using errcode = '22023';
  end if;
  insert into app_private.donor_whatsapp_sends(actor_id, donor_id, kind, period_date)
    values (v_actor, p_donor_id, p_kind, p_period);
  return query select v_donor.whatsapp, v_donor.name, v_donor.suggested_amount_paise;
end;
$$;

revoke all on function public.list_messageable_donors(date) from public, anon, authenticated;
revoke all on function public.prepare_donor_whatsapp(uuid, text, date) from public, anon, authenticated;
grant execute on function public.list_messageable_donors(date) to authenticated;
grant execute on function public.prepare_donor_whatsapp(uuid, text, date) to authenticated;
