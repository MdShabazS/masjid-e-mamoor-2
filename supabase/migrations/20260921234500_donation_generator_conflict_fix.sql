-- Donation Obligation Generator Conflict Fix
--
-- Fixes PL/pgSQL ambiguity between the RETURNS TABLE output variable
-- effective_month and donation_obligations.effective_month.
--
-- Migration 018 is already part of local migration history, so the trusted
-- generator is corrected append-only by replacing the function here.

begin;

create or replace function public.generate_monthly_donation_obligations(
  p_effective_month date,
  p_operation_id text
)
returns table (
  effective_month date,
  obligation_rule_id uuid,
  authoritative_amount_paise bigint,
  created_count integer
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_actor uuid;
  v_operation_id text := nullif(btrim(p_operation_id), '');
  v_month date;
  v_rule public.donation_obligation_rules;
  v_fingerprint text;
  v_existing public.donation_operation_idempotency;
  v_created_count integer := 0;
  v_command_tag text;
begin
  v_actor := public.current_application_user_id();

  if v_actor is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  if not public.has_application_permission('donations.obligations.manage') then
    raise exception 'missing_permission' using errcode = '42501';
  end if;

  if p_effective_month is null
     or p_effective_month <>
        date_trunc('month', p_effective_month)::date then
    raise exception 'invalid_effective_month' using errcode = '22023';
  end if;

  v_month := p_effective_month;

  if v_operation_id is null or length(v_operation_id) > 200 then
    raise exception 'invalid_operation_id' using errcode = '22023';
  end if;

  v_command_tag := encode(
    digest(v_operation_id, 'sha256'),
    'hex'
  );

  -- Select the latest rule effective on or before the requested month.
  select r.*
  into v_rule
  from public.donation_obligation_rules r
  where r.effective_from_month <= v_month
  order by r.effective_from_month desc, r.id desc
  limit 1;

  if v_rule.id is null then
    raise exception 'obligation_rule_not_found' using errcode = 'P0002';
  end if;

  v_fingerprint := encode(
    digest(
      jsonb_build_object(
        'effective_month', v_month,
        'obligation_rule_id', v_rule.id,
        'authoritative_amount_paise', v_rule.monthly_amount_paise
      )::text,
      'sha256'
    ),
    'hex'
  );

  perform pg_advisory_xact_lock(
    hashtextextended('donation-operation:' || v_operation_id, 0)
  );

  -- Also serialize generation for the same business month even when callers
  -- accidentally supply different operation IDs.
  perform pg_advisory_xact_lock(
    hashtextextended('donation-obligation-month:' || v_month::text, 0)
  );

  select *
  into v_existing
  from public.donation_operation_idempotency
  where operation_id = v_operation_id;

  if found then
    if v_existing.operation_type <> 'obligation_create'
       or v_existing.actor_application_user_id <> v_actor
       or v_existing.request_fingerprint <> v_fingerprint then
      raise exception 'operation_id_conflict' using errcode = '23505';
    end if;

    select count(*)::integer
    into v_created_count
    from public.donation_obligations o
    where o.effective_month = v_month
      and o.obligation_rule_id = v_rule.id
      and o.created_by_application_user_id = v_actor
      and o.operation_id like
        'monthly:' || v_command_tag || ':%';

    return query
    select
      v_month,
      v_rule.id,
      v_rule.monthly_amount_paise,
      v_created_count;

    return;
  end if;

  insert into public.donation_obligations (
    member_profile_id,
    obligation_rule_id,
    effective_month,
    authoritative_amount_paise,
    created_by_application_user_id,
    operation_id
  )
  select
    mp.id,
    v_rule.id,
    v_month,
    v_rule.monthly_amount_paise,
    v_actor,
    'monthly:' ||
    v_command_tag ||
    ':' ||
    encode(
      digest(mp.id::text, 'sha256'),
      'hex'
    )
  from public.member_profiles mp
  where mp.status = 'active'
  on conflict on constraint donation_obligations_member_month_uidx
  do nothing;

  get diagnostics v_created_count = row_count;

  insert into public.donation_operation_idempotency (
    operation_id,
    operation_type,
    actor_application_user_id,
    request_fingerprint
  )
  values (
    v_operation_id,
    'obligation_create',
    v_actor,
    v_fingerprint
  );

  return query
  select
    v_month,
    v_rule.id,
    v_rule.monthly_amount_paise,
    v_created_count;
end;
$$;

-- Preserve the trusted-operation execution boundary explicitly.

revoke all on function public.generate_monthly_donation_obligations(
  date, text
)
from public, anon, authenticated;

grant execute on function public.generate_monthly_donation_obligations(
  date, text
)
to authenticated;

commit;
