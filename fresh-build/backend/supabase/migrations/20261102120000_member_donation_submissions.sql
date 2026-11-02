-- Owner decision 2 November 2026: Members may submit payment references and one-time

-- donations, and see and replace their own rejected claims. A submission stays pending:

-- verification and posting remain Treasurer-only.

begin;

create or replace function public.submit_monthly_claim(
  p_donor_id uuid, p_period_date date, p_transaction_id text
) returns uuid language plpgsql security definer set search_path = pg_catalog
as $$
declare
  v_actor uuid := app_private.require_actor(array['president','vice_president',
    'secretary','treasurer','committee_member','member','data_entry']);
  v_id uuid;
begin
  insert into public.payment_claims(donor_id,period_date,transaction_id,submitted_by)
  values (p_donor_id,p_period_date,btrim(p_transaction_id),v_actor)
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.submit_one_time_donation(p_name text,p_kind text,p_referrer_id uuid,
 p_date date,p_method text,p_amount_paise bigint,p_evidence text,p_operation_id uuid)
returns uuid language plpgsql security definer set search_path=pg_catalog as $$
declare v_actor uuid := app_private.require_actor(array['president','vice_president','secretary',
 'treasurer','committee_member','member','data_entry']); v_old public.one_time_donations; v_id uuid;
begin
 if p_operation_id is null or length(btrim(p_name)) not between 1 and 200
   or p_kind not in ('member','other') or p_date is null
   or p_date>(now() at time zone 'Asia/Kolkata')::date
   or p_method not in ('cash','upi','bank') or p_amount_paise is null or p_amount_paise<=0
   or length(btrim(p_evidence)) not between 3 and 240 then
  raise exception 'invalid_donation' using errcode='22023'; end if;
 if p_referrer_id is not null and not exists(select 1 from public.app_users
   where id=p_referrer_id and active) then
  raise exception 'invalid_referrer' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_operation_id::text,61));
 select * into v_old from public.one_time_donations where submit_operation_id=p_operation_id;
 if found then
  if v_old.submitted_by<>v_actor or v_old.donor_name<>btrim(p_name)
    or v_old.donor_kind<>p_kind or v_old.referrer_id is distinct from p_referrer_id
    or v_old.donation_date<>p_date or v_old.payment_method<>p_method
    or v_old.claimed_amount_paise<>p_amount_paise or v_old.evidence_reference<>btrim(p_evidence) then
   raise exception 'operation_id_conflict' using errcode='23505'; end if;
  return v_old.id;
 end if;
 insert into public.one_time_donations(submit_operation_id,donor_name,donor_kind,referrer_id,
 donation_date,payment_method,claimed_amount_paise,evidence_reference,submitted_by)
 values(p_operation_id,btrim(p_name),p_kind,p_referrer_id,p_date,p_method,p_amount_paise,btrim(p_evidence),v_actor)
 returning id into v_id;
 return v_id;
end $$;

create or replace function public.resubmit_rejected_monthly_claim(
  p_claim_id uuid,p_transaction_id text)
returns uuid language plpgsql security definer set search_path=pg_catalog as $$
declare
  v_actor uuid:=app_private.require_actor(array['president','vice_president',
    'secretary','treasurer','committee_member','member','data_entry']);
  v_claim public.payment_claims;
  v_prior public.payment_claims;
  v_id uuid;
  v_reference text:=btrim(p_transaction_id);
begin
  if v_reference is null or length(v_reference) not between 3 and 200 then
    raise exception 'invalid_reference' using errcode='22023'; end if;
  select * into v_claim from public.payment_claims where id=p_claim_id for update;
  if not found or v_claim.status<>'rejected' then
    raise exception 'claim_not_rejected' using errcode='22023'; end if;
  if v_claim.submitted_by<>v_actor
    and not exists(select 1 from public.app_users where id=v_actor and role='treasurer') then
    raise exception 'not_authorized' using errcode='42501'; end if;
  select * into v_prior from public.payment_claims
    where replaces_rejected_claim_id=p_claim_id;
  if found then
    if v_prior.submitted_by=v_actor and v_prior.transaction_id=v_reference then
      return v_prior.id;
    end if;
    raise exception 'claim_already_replaced' using errcode='23505';
  end if;
  insert into public.payment_claims(donor_id,period_date,transaction_id,
    submitted_by,replaces_rejected_claim_id)
    values(v_claim.donor_id,v_claim.period_date,v_reference,v_actor,p_claim_id)
    returning id into v_id;
  return v_id;
end $$;

create or replace function public.list_rejected_monthly_claims(
  p_limit integer default 50,p_offset integer default 0)
returns table(rejected_claim_id uuid,donor_name text,period_date date,
  original_reference text,rejection_reason text,rejected_at timestamptz)
language plpgsql stable security definer set search_path=pg_catalog as $$
declare
  v_actor uuid:=app_private.require_actor(array['president','vice_president',
    'secretary','treasurer','committee_member','member','data_entry']);
  v_role text;
begin
  if p_limit is null or p_limit not between 1 and 100
    or p_offset is null or p_offset not between 0 and 100000 then
    raise exception 'invalid_rejected_claim_page' using errcode='22023'; end if;
  select u.role into v_role from public.app_users u where u.id=v_actor;
  return query
    select c.id,d.name,c.period_date,c.transaction_id,r.reason,r.rejected_at
      from public.claim_rejections r
      join public.payment_claims c on c.id=r.claim_id
      join public.monthly_donors d on d.id=c.donor_id
      left join public.payment_claims replacement
        on replacement.replaces_rejected_claim_id=c.id
      where replacement.id is null
        and (v_role='treasurer' or c.submitted_by=v_actor)
      order by r.rejected_at desc,r.claim_id desc
      limit p_limit offset p_offset;
end $$;

commit;
