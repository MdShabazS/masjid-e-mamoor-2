-- Owner accepted member enrollment with documented consent and a real active referrer
-- on 17 October 2026. Activation still requires an approved consent version.
begin;
create or replace function public.enroll_versioned_monthly_donor(
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
    or p_consent_version is null or p_referrer_id is null
    or p_evidence_reference is null
    or length(btrim(p_evidence_reference)) not between 3 and 240 then
    raise exception 'invalid_donor_enrollment' using errcode='22023'; end if;
  if not exists(select 1 from app_private.approved_consent_versions
      where version=p_consent_version) then
    raise exception 'consent_version_not_approved' using errcode='42501'; end if;
  if not exists(select 1 from public.app_users where id=p_entered_by and active
      and role in ('president','vice_president','secretary','treasurer',
        'committee_member','member','data_entry')) then
    raise exception 'entry_actor_not_authorized' using errcode='42501'; end if;
  if not exists(select 1 from public.app_users
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
revoke all on function public.enroll_versioned_monthly_donor(text,text,bigint,uuid,uuid,text,timestamptz,text,text) from public,anon,authenticated;
grant execute on function public.enroll_versioned_monthly_donor(text,text,bigint,uuid,uuid,text,timestamptz,text,text) to service_role;
commit;
