-- Let the original submitter and Treasurer find rejected monthly claims that
-- still need a linked replacement. A repeated replacement request is safe.
begin;

create index claim_rejections_review_page
  on public.claim_rejections(rejected_at desc,claim_id desc);

create function public.list_rejected_monthly_claims(
  p_limit integer default 50,p_offset integer default 0)
returns table(rejected_claim_id uuid,donor_name text,period_date date,
  original_reference text,rejection_reason text,rejected_at timestamptz)
language plpgsql stable security definer set search_path=pg_catalog as $$
declare
  v_actor uuid:=app_private.require_actor(array['president','vice_president',
    'secretary','treasurer','committee_member','data_entry']);
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
revoke all on function public.list_rejected_monthly_claims(integer,integer)
  from public,anon,authenticated;
grant execute on function public.list_rejected_monthly_claims(integer,integer)
  to authenticated;

create or replace function public.resubmit_rejected_monthly_claim(
  p_claim_id uuid,p_transaction_id text)
returns uuid language plpgsql security definer set search_path=pg_catalog as $$
declare
  v_actor uuid:=app_private.require_actor(array['president','vice_president',
    'secretary','treasurer','committee_member','data_entry']);
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
revoke all on function public.resubmit_rejected_monthly_claim(uuid,text)
  from public,anon,authenticated;
grant execute on function public.resubmit_rejected_monthly_claim(uuid,text)
  to authenticated;

commit;
