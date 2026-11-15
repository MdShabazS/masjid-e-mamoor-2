-- Phase 5 first slice. Owner-dependent public donor grants remain disabled.
begin;

alter table public.monthly_donors
  add column consent_version text not null default 'unreviewed',
  add column consent_evidence_ref text,
  add column opted_out_at timestamptz;
create index monthly_donors_whatsapp_lookup on public.monthly_donors(whatsapp);
create table app_private.approved_consent_versions (
  version text primary key,
  approved_at timestamptz not null,
  approved_by uuid not null references public.app_users(id) on delete restrict,
  check (length(btrim(version)) between 3 and 64)
);
-- Deliberately empty at migration: the operator has not approved donor wording.
create table public.donor_events (
  id uuid primary key default gen_random_uuid(),
  donor_id uuid not null references public.monthly_donors(id) on delete restrict,
  event text not null check (event in ('consent_recorded','suggestion_changed','opted_out')),
  actor_id uuid references public.app_users(id) on delete restrict,
  source_reference text,
  old_amount_paise bigint,
  new_amount_paise bigint,
  consent_version text,
  evidence_reference text,
  occurred_at timestamptz not null default now(),
  check (event<>'suggestion_changed' or (old_amount_paise>0 and new_amount_paise>0)),
  check (event<>'opted_out' or source_reference is not null)
);
create index donor_events_donor_time on public.donor_events(donor_id,occurred_at,id);
create table public.claim_rejections (
  claim_id uuid primary key references public.payment_claims(id) on delete restrict,
  operation_id uuid not null unique,
  rejected_by uuid not null references public.app_users(id) on delete restrict,
  reason text not null check (length(btrim(reason)) between 3 and 500),
  rejected_at timestamptz not null default now()
);
alter table public.payment_claims add column replaces_rejected_claim_id uuid unique
  references public.payment_claims(id) on delete restrict;
create table public.referral_provenance (
  claim_id uuid primary key references public.payment_claims(id) on delete restrict,
  referrer_id uuid not null references public.app_users(id) on delete restrict,
  donor_id uuid not null references public.monthly_donors(id) on delete restrict,
  recorded_at timestamptz not null default now()
);
-- Provenance is not a public points award. Scoring is owner-gated.

create function app_private.record_initial_donor_consent()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
begin
  insert into public.donor_events(donor_id,event,actor_id,consent_version,evidence_reference,occurred_at)
    values(new.id,'consent_recorded',new.entered_by,new.consent_version,
      new.consent_evidence_ref,new.consent_recorded_at);
  return new;
end;
$$;
revoke all on function app_private.record_initial_donor_consent() from public,anon,authenticated;
create trigger donor_initial_consent after insert on public.monthly_donors
for each row execute function app_private.record_initial_donor_consent();

create function app_private.record_referral_provenance()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
begin
  insert into public.referral_provenance(claim_id,referrer_id,donor_id)
    select new.claim_id,d.referrer_id,d.id from public.payment_claims c
    join public.monthly_donors d on d.id=c.donor_id
    where c.id=new.claim_id and d.referrer_id is not null;
  return new;
end;
$$;
revoke all on function app_private.record_referral_provenance() from public,anon,authenticated;
create trigger referral_provenance_after_verification after insert on public.contribution_audit
for each row execute function app_private.record_referral_provenance();

create trigger donor_events_immutable before update or delete on public.donor_events
for each row execute function app_private.reject_immutable_finance_change();
create trigger claim_rejections_immutable before update or delete on public.claim_rejections
for each row execute function app_private.reject_immutable_finance_change();
create trigger referral_provenance_immutable before update or delete on public.referral_provenance
for each row execute function app_private.reject_immutable_finance_change();
do $$ declare v_name text; begin
  foreach v_name in array array['donor_events','claim_rejections','referral_provenance'] loop
    execute format('alter table public.%I enable row level security',v_name);
    execute format('revoke all on public.%I from public,anon,authenticated',v_name);
  end loop;
end $$;
alter table app_private.approved_consent_versions enable row level security;
revoke all on app_private.approved_consent_versions from public,anon,authenticated;

-- STOP is an intake safety operation. The server must authenticate the source
-- (Meta webhook signature or human evidence) before calling the service RPC.
create function public.record_monthly_donor_opt_out(p_donor_id uuid,p_source_reference text)
returns void language plpgsql security definer set search_path=pg_catalog as $$
declare v_donor public.monthly_donors; v_source text:=btrim(p_source_reference);
begin
  if v_source is null or length(v_source) not between 3 and 240 then
    raise exception 'invalid_opt_out_source' using errcode='22023'; end if;
  select * into v_donor from public.monthly_donors where id=p_donor_id for update;
  if not found then raise exception 'donor_not_found' using errcode='22023'; end if;
  if not v_donor.active then return; end if;
  update public.monthly_donors set active=false,opted_out_at=now() where id=p_donor_id;
  insert into public.donor_events(donor_id,event,source_reference)
    values(p_donor_id,'opted_out',v_source);
end;
$$;

-- Server-only enrollment remains inert until an approved consent version is
-- inserted by a reviewed migration. The server verifies its named actor JWT.
create function public.enroll_versioned_monthly_donor(
  p_name text,p_whatsapp text,p_suggested_amount_paise bigint,p_referrer_id uuid,
  p_entered_by uuid,p_consent_method text,p_consent_recorded_at timestamptz,
  p_consent_version text,p_evidence_reference text)
returns uuid language plpgsql security definer set search_path=pg_catalog as $$
declare v_id uuid;
begin
  if p_name is null or length(btrim(p_name)) not between 1 and 200
    or p_whatsapp is null or p_whatsapp !~ '^\+[1-9][0-9]{7,14}$'
    or p_suggested_amount_paise is null or p_suggested_amount_paise<=0
    or p_consent_method is null or length(btrim(p_consent_method)) not between 1 and 120
    or p_consent_recorded_at is null or p_consent_recorded_at>now()
    or p_consent_version is null or p_evidence_reference is null
    or length(btrim(p_evidence_reference)) not between 3 and 240 then
    raise exception 'invalid_donor_enrollment' using errcode='22023'; end if;
  if not exists(select 1 from app_private.approved_consent_versions
      where version=p_consent_version) then
    raise exception 'consent_version_not_approved' using errcode='42501'; end if;
  if not exists(select 1 from public.app_users where id=p_entered_by and active
      and role in ('president','vice_president','secretary','treasurer',
        'committee_member','data_entry')) then
    raise exception 'entry_actor_not_authorized' using errcode='42501'; end if;
  if p_referrer_id is not null and not exists(select 1 from public.app_users
      where id=p_referrer_id and active) then
    raise exception 'referrer_not_active' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_whatsapp,49));
  if exists(select 1 from public.monthly_donors where whatsapp=p_whatsapp and active) then
    raise exception 'donor_phone_duplicate_review' using errcode='23505'; end if;
  insert into public.monthly_donors(name,whatsapp,suggested_amount_paise,
    referrer_id,entered_by,consent_method,consent_recorded_at,
    consent_version,consent_evidence_ref)
    values(btrim(p_name),p_whatsapp,p_suggested_amount_paise,p_referrer_id,
      p_entered_by,btrim(p_consent_method),p_consent_recorded_at,
      p_consent_version,btrim(p_evidence_reference)) returning id into v_id;
  return v_id;
end;
$$;

create function public.reject_monthly_claim(p_claim_id uuid,p_reason text,p_operation_id uuid)
returns void language plpgsql security definer set search_path=pg_catalog as $$
declare v_actor uuid:=app_private.require_actor(array['treasurer']);
        v_claim public.payment_claims; v_prior public.claim_rejections; v_reason text:=btrim(p_reason);
begin
  if p_operation_id is null or v_reason is null or length(v_reason) not between 3 and 500 then
    raise exception 'invalid_rejection' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_operation_id::text,47));
  select * into v_prior from public.claim_rejections where operation_id=p_operation_id;
  if found then
    if v_prior.claim_id<>p_claim_id or v_prior.rejected_by<>v_actor or v_prior.reason<>v_reason then
      raise exception 'operation_id_conflict' using errcode='23505'; end if;
    return;
  end if;
  select * into v_claim from public.payment_claims where id=p_claim_id for update;
  if not found or v_claim.status<>'pending' then
    raise exception 'claim_not_pending' using errcode='22023'; end if;
  update public.payment_claims set status='rejected' where id=p_claim_id;
  insert into public.claim_rejections(claim_id,operation_id,rejected_by,reason)
    values(p_claim_id,p_operation_id,v_actor,v_reason);
end;
$$;

create function public.resubmit_rejected_monthly_claim(p_claim_id uuid,p_transaction_id text)
returns uuid language plpgsql security definer set search_path=pg_catalog as $$
declare v_actor uuid:=app_private.require_actor(array['president','vice_president',
    'secretary','treasurer','committee_member','data_entry']);
        v_claim public.payment_claims; v_id uuid; v_reference text:=btrim(p_transaction_id);
begin
  if v_reference is null or length(v_reference) not between 3 and 200 then
    raise exception 'invalid_reference' using errcode='22023'; end if;
  select * into v_claim from public.payment_claims where id=p_claim_id for update;
  if not found or v_claim.status<>'rejected' then
    raise exception 'claim_not_rejected' using errcode='22023'; end if;
  if v_claim.submitted_by<>v_actor
    and not exists(select 1 from public.app_users where id=v_actor and role='treasurer') then
    raise exception 'not_authorized' using errcode='42501'; end if;
  insert into public.payment_claims(donor_id,period_date,transaction_id,submitted_by,replaces_rejected_claim_id)
    values(v_claim.donor_id,v_claim.period_date,v_reference,v_actor,p_claim_id)
    returning id into v_id;
  return v_id;
end;
$$;

-- Contact detail is restricted to Treasurer and President. No general roster
-- exposes phone/consent. Donor editing remains policy-gated.
create function public.get_monthly_donor_contact(p_donor_id uuid)
returns table(donor_id uuid,donor_name text,whatsapp text,consent_version text,
  active boolean,opted_out_at timestamptz)
language plpgsql stable security definer set search_path=pg_catalog as $$
begin
  perform app_private.require_actor(array['president','treasurer']);
  return query select d.id,d.name,d.whatsapp,d.consent_version,d.active,d.opted_out_at
    from public.monthly_donors d where d.id=p_donor_id;
end;
$$;

revoke all on function public.record_monthly_donor_opt_out(uuid,text) from public,anon,authenticated;
revoke all on function public.enroll_versioned_monthly_donor(text,text,bigint,uuid,uuid,text,timestamptz,text,text) from public,anon,authenticated;
revoke all on function public.reject_monthly_claim(uuid,text,uuid) from public,anon,authenticated;
revoke all on function public.resubmit_rejected_monthly_claim(uuid,text) from public,anon,authenticated;
revoke all on function public.get_monthly_donor_contact(uuid) from public,anon,authenticated;
grant execute on function public.record_monthly_donor_opt_out(uuid,text) to service_role;
grant execute on function public.enroll_versioned_monthly_donor(text,text,bigint,uuid,uuid,text,timestamptz,text,text) to service_role;
grant execute on function public.reject_monthly_claim(uuid,text,uuid) to authenticated;
grant execute on function public.resubmit_rejected_monthly_claim(uuid,text) to authenticated;
grant execute on function public.get_monthly_donor_contact(uuid) to authenticated;
commit;
