begin;

-- Jummah Cash Collection V1.
--
-- Jummah cash records only the collection amount. The authenticated staff
-- operator remains auditable through recorded_by_application_user_id.
-- Writes remain trusted-operation-only; no direct client INSERT/UPDATE/DELETE
-- policy or grant is introduced for public.additional_donations.

alter table public.donation_operation_idempotency
  drop constraint donation_operation_idempotency_operation_type_check;

alter table public.donation_operation_idempotency
  add constraint donation_operation_idempotency_operation_type_check
  check (
    operation_type in (
      'obligation_rule_create',
      'obligation_create',
      'obligation_waive',
      'payment_submit',
      'payment_review',
      'payment_reject',
      'payment_verify_allocate',
      'additional_donation_create',
      'anonymous_donation_create',
      'jummah_cash_create'
    )
  );

create or replace function public.create_jummah_cash_donation(
  p_amount_paise bigint,
  p_operation_id text
)
returns public.additional_donations
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_actor uuid;
  v_operation_id text := nullif(btrim(p_operation_id), '');
  v_fingerprint text;
  v_existing public.donation_operation_idempotency;
  v_donation public.additional_donations;
begin
  v_actor := public.current_application_user_id();

  if v_actor is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  if not public.has_application_permission('donations.jummah.create') then
    raise exception 'missing_permission' using errcode = '42501';
  end if;

  if p_amount_paise is null or p_amount_paise <= 0 then
    raise exception 'invalid_jummah_cash_amount'
      using errcode = '22023';
  end if;

  if v_operation_id is null or length(v_operation_id) > 200 then
    raise exception 'invalid_operation_id' using errcode = '22023';
  end if;

  v_fingerprint := encode(
    digest(
      jsonb_build_object(
        'amount_paise', p_amount_paise,
        'donation_kind', 'jummah_cash'
      )::text,
      'sha256'
    ),
    'hex'
  );

  perform pg_advisory_xact_lock(
    hashtextextended('donation-operation:' || v_operation_id, 0)
  );

  select *
  into v_existing
  from public.donation_operation_idempotency
  where operation_id = v_operation_id;

  if found then
    if v_existing.operation_type <> 'jummah_cash_create'
       or v_existing.actor_application_user_id <> v_actor
       or v_existing.target_member_profile_id is not null
       or v_existing.request_fingerprint <> v_fingerprint then
      raise exception 'operation_id_conflict' using errcode = '23505';
    end if;

    select *
    into v_donation
    from public.additional_donations
    where id = v_existing.additional_donation_id;

    if v_donation.id is null then
      raise exception 'idempotency_result_missing' using errcode = 'P0002';
    end if;

    return v_donation;
  end if;

  insert into public.additional_donations (
    member_profile_id,
    source_payment_id,
    donation_kind,
    amount_paise,
    recorded_by_application_user_id,
    operation_id
  )
  values (
    null,
    null,
    'jummah_cash',
    p_amount_paise,
    v_actor,
    v_operation_id
  )
  returning * into v_donation;

  insert into public.donation_operation_idempotency (
    operation_id,
    operation_type,
    actor_application_user_id,
    target_member_profile_id,
    additional_donation_id,
    request_fingerprint
  )
  values (
    v_operation_id,
    'jummah_cash_create',
    v_actor,
    null,
    v_donation.id,
    v_fingerprint
  );

  return v_donation;
end;
$$;

revoke all on function public.create_jummah_cash_donation(
  bigint, text
)
from public, anon, authenticated;

grant execute on function public.create_jummah_cash_donation(
  bigint, text
)
to authenticated;

commit;
