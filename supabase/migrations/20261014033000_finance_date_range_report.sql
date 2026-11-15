-- Read-only, bounded custom Finance report from the posted ledger.
-- Each response is computed from one statement snapshot; no pending payment
-- or unverified donation can change its totals.
begin;
create function public.get_finance_date_range_report(p_start_date date,p_end_date date)
returns jsonb language plpgsql security definer set search_path=pg_catalog,extensions as $$
declare v_result jsonb;
begin
  if auth.uid() is null or public.current_application_user_id() is null
    or not public.has_application_permission('finance.monthly_reports.read') then
    raise exception 'not_authorized' using errcode='42501'; end if;
  if p_start_date is null or p_end_date is null or p_end_date<p_start_date
    or p_end_date-p_start_date>365 then
    raise exception 'invalid_report_range' using errcode='22023'; end if;
  with period as materialized (
    select ft.id,ft.finance_account_id,fa.name as account_name,fa.account_type,
      ft.transaction_category,ft.direction,ft.amount_paise,ft.business_date,
      ft.reference_type,ft.reference_id,ft.related_transaction_id,ft.created_at,
      e.description as expense_description,e.payee as expense_payee
    from public.financial_transactions ft
    join public.finance_accounts fa on fa.id=ft.finance_account_id
    left join public.finance_expenses e on ft.reference_type='finance_expense' and e.id=ft.reference_id
    where ft.business_date between p_start_date and p_end_date
  ), opening as (
    select coalesce(sum(case when direction='inflow' then amount_paise else -amount_paise end),0)::bigint balance
    from public.financial_transactions where business_date<p_start_date
  ), totals as (
    select count(*)::bigint transaction_count,
      coalesce(sum(amount_paise) filter (where transaction_category in ('DONATION_RECURRING','DONATION_ADDITIONAL','DONATION_ANONYMOUS','DONATION_JUMMAH')),0)::bigint donations,
      coalesce(sum(amount_paise) filter (where transaction_category='EXPENSE'),0)::bigint expenses,
      coalesce(sum(case when direction='inflow' then amount_paise else -amount_paise end)
        filter (where transaction_category in ('CORRECTION','REVERSAL')),0)::bigint adjustments,
      coalesce(sum(amount_paise) filter (where transaction_category='TRANSFER_IN'),0)::bigint transfer_in,
      coalesce(sum(amount_paise) filter (where transaction_category='TRANSFER_OUT'),0)::bigint transfer_out,
      coalesce(sum(case when direction='inflow' then amount_paise else -amount_paise end),0)::bigint net_change,
      coalesce(sum(amount_paise) filter (where transaction_category='DONATION_RECURRING'),0)::bigint recurring,
      coalesce(sum(amount_paise) filter (where transaction_category='DONATION_ADDITIONAL'),0)::bigint additional,
      coalesce(sum(amount_paise) filter (where transaction_category='DONATION_ANONYMOUS'),0)::bigint anonymous,
      coalesce(sum(amount_paise) filter (where transaction_category='DONATION_JUMMAH'),0)::bigint jummah
    from period
  ), accounts as (
    select fa.id,fa.name,fa.account_type,fa.status,
      coalesce(sum(case when ft.direction='inflow' then ft.amount_paise else -ft.amount_paise end)
        filter (where ft.business_date<p_start_date),0)::bigint opening_balance,
      coalesce(sum(ft.amount_paise) filter (where ft.business_date between p_start_date and p_end_date
        and ft.direction='inflow'),0)::bigint inflow,
      coalesce(sum(ft.amount_paise) filter (where ft.business_date between p_start_date and p_end_date
        and ft.direction='outflow'),0)::bigint outflow,
      coalesce(sum(case when ft.direction='inflow' then ft.amount_paise else -ft.amount_paise end)
        filter (where ft.business_date<=p_end_date),0)::bigint closing_balance
    from public.finance_accounts fa left join public.financial_transactions ft
      on ft.finance_account_id=fa.id and ft.business_date<=p_end_date
    group by fa.id
  )
  select jsonb_build_object(
    'schema_version',1,'masjid_name','Masjid E Mamoor 2','currency','INR',
    'period_start',p_start_date,'period_end',p_end_date,
    'generated_at',clock_timestamp(),
    'summary',jsonb_build_object(
      'opening_balance_paise',o.balance::text,'donation_inflow_paise',t.donations::text,
      'expense_outflow_paise',t.expenses::text,'adjustments_net_paise',t.adjustments::text,
      'transfer_in_paise',t.transfer_in::text,'transfer_out_paise',t.transfer_out::text,
      'closing_balance_paise',(o.balance+t.net_change)::text,
      'transaction_count',t.transaction_count),
    'donation_breakdown',jsonb_build_object('recurring_paise',t.recurring::text,
      'additional_paise',t.additional::text,'anonymous_paise',t.anonymous::text,
      'jummah_paise',t.jummah::text),
    'accounts',coalesce((select jsonb_agg(jsonb_build_object(
      'name',a.name,'account_type',a.account_type,'status',a.status,
      'opening_balance_paise',a.opening_balance::text,'inflow_paise',a.inflow::text,
      'outflow_paise',a.outflow::text,'closing_balance_paise',a.closing_balance::text)
      order by a.name,a.id) from accounts a),'[]'::jsonb),
    'ledger',coalesce((select jsonb_agg(jsonb_build_object(
      'id',p.id,'business_date',p.business_date,'account_name',p.account_name,
      'transaction_category',p.transaction_category,'direction',p.direction,
      'amount_paise',p.amount_paise::text,'reference_type',p.reference_type,
      'reference_id',p.reference_id,'related_transaction_id',p.related_transaction_id,
      'expense_description',p.expense_description,'expense_payee',p.expense_payee)
      order by p.business_date,p.created_at,p.id) from period p),'[]'::jsonb)
  ) into v_result from totals t cross join opening o;
  if (v_result->'summary'->>'transaction_count')::bigint>5000 then
    raise exception 'report_range_too_large' using errcode='54000'; end if;
  return v_result;
end;
$$;
revoke all on function public.get_finance_date_range_report(date,date)
  from public,anon,authenticated,service_role;
grant execute on function public.get_finance_date_range_report(date,date) to authenticated;
commit;
