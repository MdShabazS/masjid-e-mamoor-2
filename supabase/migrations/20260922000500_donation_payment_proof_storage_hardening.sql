-- ============================================================================
-- Donation payment proof Storage hardening
-- Migration 021
--
-- Append-only correction to migration 020:
--   * require canonical UUID proof filenames
--   * bind metadata registration to the authenticated Storage object owner
-- ============================================================================

create or replace function public.can_upload_donation_payment_proof(
  p_object_name text
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_actor uuid;
  v_payment_id uuid;
begin
  v_actor := public.current_application_user_id();

  if v_actor is null then
    return false;
  end if;

  if not public.has_application_permission(
    'donations.payments.proof_upload'
  ) then
    return false;
  end if;

  if p_object_name is null
     or p_object_name !~
       '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\.(jpg|jpeg|png|pdf)$'
  then
    return false;
  end if;

  begin
    v_payment_id :=
      split_part(p_object_name, '/', 1)::uuid;
  exception
    when invalid_text_representation then
      return false;
  end;

  return exists (
    select 1
    from public.donation_payments dp
    join public.member_profiles mp
      on mp.id = dp.member_profile_id
    where dp.id = v_payment_id
      and mp.application_user_id = v_actor
      and mp.status = 'active'
      and dp.status in ('submitted', 'under_review')
  );
end;
$$;


create or replace function public.register_donation_payment_proof(
  p_payment_id uuid,
  p_storage_object_path text
)
returns public.donation_payment_proofs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid;
  v_payment public.donation_payments;
  v_proof public.donation_payment_proofs;
begin
  v_actor := public.current_application_user_id();

  if v_actor is null then
    raise exception 'not_authenticated'
      using errcode = '42501';
  end if;

  if not public.has_application_permission(
    'donations.payments.proof_upload'
  ) then
    raise exception 'missing_permission'
      using errcode = '42501';
  end if;

  if p_payment_id is null then
    raise exception 'payment_required'
      using errcode = '22023';
  end if;

  if p_storage_object_path is null
     or length(btrim(p_storage_object_path)) < 1
     or length(btrim(p_storage_object_path)) > 1024
  then
    raise exception 'invalid_storage_object_path'
      using errcode = '22023';
  end if;

  if split_part(
       btrim(p_storage_object_path),
       '/',
       1
     ) <> p_payment_id::text
  then
    raise exception 'proof_path_payment_mismatch'
      using errcode = '22023';
  end if;

  if not public.can_upload_donation_payment_proof(
    btrim(p_storage_object_path)
  ) then
    raise exception 'proof_upload_not_allowed'
      using errcode = '42501';
  end if;

  select dp.*
  into v_payment
  from public.donation_payments dp
  join public.member_profiles mp
    on mp.id = dp.member_profile_id
  where dp.id = p_payment_id
    and mp.application_user_id = v_actor
    and mp.status = 'active'
  for update of dp;

  if v_payment.id is null then
    raise exception 'payment_not_found'
      using errcode = 'P0002';
  end if;

  if v_payment.status not in (
    'submitted',
    'under_review'
  ) then
    raise exception 'invalid_payment_state'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from storage.objects so
    where so.bucket_id = 'donation-payment-proofs'
      and so.name = btrim(p_storage_object_path)
      and so.owner_id = auth.uid()::text
  ) then
    raise exception 'proof_object_not_found_or_not_owned'
      using errcode = 'P0002';
  end if;

  insert into public.donation_payment_proofs (
    payment_id,
    storage_bucket,
    storage_object_path,
    uploaded_by_application_user_id
  )
  values (
    p_payment_id,
    'donation-payment-proofs',
    btrim(p_storage_object_path),
    v_actor
  )
  returning *
  into v_proof;

  return v_proof;
end;
$$;

revoke all on function
  public.can_upload_donation_payment_proof(text)
from public, anon, authenticated;

grant execute on function
  public.can_upload_donation_payment_proof(text)
to authenticated;

revoke all on function
  public.register_donation_payment_proof(uuid, text)
from public, anon, authenticated;

grant execute on function
  public.register_donation_payment_proof(uuid, text)
to authenticated;
