-- Staff correction paths keep donor consent and historical requests immutable.
begin;

alter table public.donor_events add column operation_id uuid unique;

create function public.update_monthly_donor_suggestion(
  p_donor_id uuid, p_expected_amount_paise bigint, p_new_amount_paise bigint,
  p_reason text, p_operation_id uuid)
returns void language plpgsql security definer set search_path=pg_catalog as $$
declare
  v_actor uuid := app_private.require_actor(array['president','treasurer']);
  v_donor public.monthly_donors;
  v_prior public.donor_events;
  v_reason text := btrim(p_reason);
begin
  if p_donor_id is null or p_operation_id is null or p_expected_amount_paise is null
    or p_new_amount_paise is null or p_expected_amount_paise <= 0
    or p_new_amount_paise <= 0 or p_new_amount_paise = p_expected_amount_paise
    or v_reason is null or length(v_reason) not between 3 and 240 then
    raise exception 'invalid_donor_correction' using errcode='22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_operation_id::text, 69));
  select * into v_prior from public.donor_events where operation_id=p_operation_id;
  if found then
    if v_prior.event <> 'suggestion_changed' or v_prior.donor_id <> p_donor_id
      or v_prior.actor_id <> v_actor or v_prior.old_amount_paise <> p_expected_amount_paise
      or v_prior.new_amount_paise <> p_new_amount_paise
      or v_prior.source_reference <> v_reason then
      raise exception 'operation_id_conflict' using errcode='23505';
    end if;
    return;
  end if;
  select * into v_donor from public.monthly_donors where id=p_donor_id for update;
  if not found or not v_donor.active then
    raise exception 'donor_not_active' using errcode='22023';
  end if;
  if v_donor.suggested_amount_paise <> p_expected_amount_paise then
    raise exception 'donor_suggestion_changed' using errcode='40001';
  end if;
  update public.monthly_donors set suggested_amount_paise=p_new_amount_paise
    where id=p_donor_id;
  insert into public.donor_events(donor_id,event,actor_id,source_reference,
    old_amount_paise,new_amount_paise,operation_id)
    values(p_donor_id,'suggestion_changed',v_actor,v_reason,
      p_expected_amount_paise,p_new_amount_paise,p_operation_id);
end;
$$;

create function public.staff_opt_out_monthly_donor(
  p_donor_id uuid, p_source_reference text, p_operation_id uuid)
returns void language plpgsql security definer set search_path=pg_catalog as $$
declare
  v_actor uuid := app_private.require_actor(array['president','treasurer']);
  v_donor public.monthly_donors;
  v_prior public.donor_events;
  v_source text := btrim(p_source_reference);
begin
  if p_donor_id is null or p_operation_id is null or v_source is null
    or length(v_source) not between 3 and 240 then
    raise exception 'invalid_opt_out_source' using errcode='22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_operation_id::text, 70));
  select * into v_prior from public.donor_events where operation_id=p_operation_id;
  if found then
    if v_prior.event <> 'opted_out' or v_prior.donor_id <> p_donor_id
      or v_prior.actor_id <> v_actor or v_prior.source_reference <> v_source then
      raise exception 'operation_id_conflict' using errcode='23505';
    end if;
    return;
  end if;
  select * into v_donor from public.monthly_donors where id=p_donor_id for update;
  if not found then raise exception 'donor_not_found' using errcode='22023'; end if;
  if not v_donor.active then return; end if;
  update public.monthly_donors set active=false,opted_out_at=now()
    where id=p_donor_id;
  insert into public.donor_events(donor_id,event,actor_id,source_reference,operation_id)
    values(p_donor_id,'opted_out',v_actor,v_source,p_operation_id);
end;
$$;

revoke all on function public.update_monthly_donor_suggestion(uuid,bigint,bigint,text,uuid)
  from public,anon,authenticated;
revoke all on function public.staff_opt_out_monthly_donor(uuid,text,uuid)
  from public,anon,authenticated;
grant execute on function public.update_monthly_donor_suggestion(uuid,bigint,bigint,text,uuid)
  to authenticated;
grant execute on function public.staff_opt_out_monthly_donor(uuid,text,uuid)
  to authenticated;

commit;
