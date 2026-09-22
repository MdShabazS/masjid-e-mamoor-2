-- Donation V1: authoritative outstanding-balance read model.
--
-- Monetary truth must be calculated by PostgreSQL from obligations,
-- allocations, and waivers in one database snapshot. Application code
-- renders this result and does not independently calculate outstanding
-- donation balances.

create or replace function public.get_donation_outstanding_snapshot()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  v_application_user_id uuid;
  v_role text;
  v_result jsonb;
begin
  if auth.uid() is null then
    raise exception 'Authentication required'
      using errcode = '42501';
  end if;

  v_application_user_id :=
    public.current_application_user_id();

  if v_application_user_id is null then
    raise exception 'Application user not found'
      using errcode = '42501';
  end if;

  v_role := public.current_application_role();

  with visible_obligations as (
    select
      o.id,
      o.member_profile_id,
      o.obligation_rule_id,
      o.effective_month,
      o.authoritative_amount_paise,
      o.status,
      o.created_at
    from public.donation_obligations o
    where
      exists (
        select 1
        from public.member_profiles mp
        where mp.id = o.member_profile_id
          and mp.application_user_id =
            v_application_user_id
      )
      or (
        public.has_application_permission(
          'donations.obligations.read'
        )
        and v_role = any (
          array[
            'president',
            'vice_president',
            'secretary',
            'finance',
            'auditor'
          ]::text[]
        )
      )
  ),
  allocation_totals as (
    select
      dpa.obligation_id,
      sum(dpa.allocated_amount_paise)
        as allocated_amount_paise
    from public.donation_payment_allocations dpa
    join visible_obligations vo
      on vo.id = dpa.obligation_id
    group by dpa.obligation_id
  ),
  waiver_totals as (
    select
      dow.obligation_id,
      sum(dow.waived_amount_paise)
        as waived_amount_paise
    from public.donation_obligation_waivers dow
    join visible_obligations vo
      on vo.id = dow.obligation_id
    group by dow.obligation_id
  ),
  balances as (
    select
      vo.id,
      vo.member_profile_id,
      vo.obligation_rule_id,
      vo.effective_month,
      vo.authoritative_amount_paise,
      coalesce(
        at.allocated_amount_paise,
        0
      )::bigint as allocated_amount_paise,
      coalesce(
        wt.waived_amount_paise,
        0
      )::bigint as waived_amount_paise,
      greatest(
        vo.authoritative_amount_paise
          - coalesce(
              at.allocated_amount_paise,
              0
            )
          - coalesce(
              wt.waived_amount_paise,
              0
            ),
        0
      )::bigint as outstanding_amount_paise,
      vo.status,
      vo.created_at
    from visible_obligations vo
    left join allocation_totals at
      on at.obligation_id = vo.id
    left join waiver_totals wt
      on wt.obligation_id = vo.id
  )
  select jsonb_build_object(
    'total_outstanding_paise',
      coalesce(
        sum(b.outstanding_amount_paise),
        0
      ),
    'obligation_count',
      count(*),
    'obligations',
      coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id',
              b.id,
            'member_profile_id',
              b.member_profile_id,
            'obligation_rule_id',
              b.obligation_rule_id,
            'effective_month',
              b.effective_month,
            'authoritative_amount_paise',
              b.authoritative_amount_paise,
            'allocated_amount_paise',
              b.allocated_amount_paise,
            'waived_amount_paise',
              b.waived_amount_paise,
            'outstanding_amount_paise',
              b.outstanding_amount_paise,
            'status',
              b.status,
            'created_at',
              b.created_at
          )
          order by
            b.effective_month desc,
            b.id desc
        ),
        '[]'::jsonb
      )
  )
  into v_result
  from balances b;

  return v_result;
end;
$$;

revoke all
on function public.get_donation_outstanding_snapshot()
from public;

revoke all
on function public.get_donation_outstanding_snapshot()
from anon;

grant execute
on function public.get_donation_outstanding_snapshot()
to authenticated;

comment on function
  public.get_donation_outstanding_snapshot()
is
  'Returns an atomic authoritative donation obligation balance snapshot for the caller''s permitted resource scope.';
