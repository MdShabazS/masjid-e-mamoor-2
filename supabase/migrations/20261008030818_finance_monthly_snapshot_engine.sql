begin;

create or replace function private.build_finance_monthly_report_snapshot(
  p_report_month date,
  p_generation_source text
)
returns public.finance_monthly_reports
language plpgsql
security definer
set search_path = pg_catalog, extensions
as $function$
declare
  v_month date;
  v_next_month date;
  v_month_end date;
  v_generation_source text;

  v_snapshot jsonb;
  v_snapshot_sha256 text;

  v_existing public.finance_monthly_reports;
  v_report public.finance_monthly_reports;

  v_revision integer;

  v_opening_balance_paise bigint;
  v_donation_inflow_paise bigint;
  v_expense_outflow_paise bigint;
  v_adjustments_net_paise bigint;
  v_transfer_in_paise bigint;
  v_transfer_out_paise bigint;
  v_closing_balance_paise bigint;

  v_cash_closing_paise bigint;
  v_bank_closing_paise bigint;
  v_upi_closing_paise bigint;
  v_other_closing_paise bigint;

  v_transaction_count bigint;

  v_accounts jsonb;
  v_ledger jsonb;
  v_expenses jsonb;
  v_transfers jsonb;
  v_adjustments jsonb;
  v_donations jsonb;
  v_outstanding jsonb;
  v_workflow jsonb;

  v_storage_path text;
begin
  if p_report_month is null then
    raise exception 'report_month_required'
      using errcode = '22023';
  end if;

  v_month :=
    date_trunc(
      'month',
      p_report_month::timestamp
    )::date;

  if p_report_month <> v_month then
    raise exception 'report_month_must_be_month_start'
      using errcode = '22023';
  end if;

  v_next_month :=
    (v_month + interval '1 month')::date;

  v_month_end :=
    v_next_month - 1;

  v_generation_source :=
    lower(nullif(btrim(p_generation_source), ''));

  if v_generation_source is null
     or v_generation_source not in ('manual', 'scheduled') then
    raise exception 'invalid_generation_source'
      using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      'finance-monthly-report:' || v_month::text,
      0
    )
  );

  select
    coalesce(
      sum(
        case ft.direction
          when 'inflow' then ft.amount_paise
          when 'outflow' then -ft.amount_paise
        end
      ),
      0
    )::bigint
  into v_opening_balance_paise
  from public.financial_transactions ft
  where ft.business_date < v_month;

  select
    coalesce(
      sum(ft.amount_paise)
        filter (
          where ft.transaction_category in (
            'DONATION_RECURRING',
            'DONATION_ADDITIONAL',
            'DONATION_ANONYMOUS',
            'DONATION_JUMMAH'
          )
        ),
      0
    )::bigint,
    coalesce(
      sum(ft.amount_paise)
        filter (
          where ft.transaction_category = 'EXPENSE'
        ),
      0
    )::bigint,
    coalesce(
      sum(
        case ft.direction
          when 'inflow' then ft.amount_paise
          when 'outflow' then -ft.amount_paise
        end
      )
        filter (
          where ft.transaction_category in (
            'CORRECTION',
            'REVERSAL'
          )
        ),
      0
    )::bigint,
    coalesce(
      sum(ft.amount_paise)
        filter (
          where ft.transaction_category = 'TRANSFER_IN'
        ),
      0
    )::bigint,
    coalesce(
      sum(ft.amount_paise)
        filter (
          where ft.transaction_category = 'TRANSFER_OUT'
        ),
      0
    )::bigint,
    count(*)::bigint
  into
    v_donation_inflow_paise,
    v_expense_outflow_paise,
    v_adjustments_net_paise,
    v_transfer_in_paise,
    v_transfer_out_paise,
    v_transaction_count
  from public.financial_transactions ft
  where ft.business_date >= v_month
    and ft.business_date < v_next_month;

  select
    coalesce(
      sum(
        case ft.direction
          when 'inflow' then ft.amount_paise
          when 'outflow' then -ft.amount_paise
        end
      ),
      0
    )::bigint
  into v_closing_balance_paise
  from public.financial_transactions ft
  where ft.business_date < v_next_month;

  with account_balances as (
    select
      fa.id,
      fa.name,
      fa.account_type,
      fa.status,
      fa.currency,

      coalesce(
        sum(
          case ft.direction
            when 'inflow' then ft.amount_paise
            when 'outflow' then -ft.amount_paise
          end
        ) filter (
          where ft.business_date < v_month
        ),
        0
      )::bigint as opening_balance_paise,

      coalesce(
        sum(ft.amount_paise) filter (
          where ft.business_date >= v_month
            and ft.business_date < v_next_month
            and ft.direction = 'inflow'
        ),
        0
      )::bigint as month_inflow_paise,

      coalesce(
        sum(ft.amount_paise) filter (
          where ft.business_date >= v_month
            and ft.business_date < v_next_month
            and ft.direction = 'outflow'
        ),
        0
      )::bigint as month_outflow_paise,

      coalesce(
        sum(
          case ft.direction
            when 'inflow' then ft.amount_paise
            when 'outflow' then -ft.amount_paise
          end
        ) filter (
          where ft.business_date < v_next_month
        ),
        0
      )::bigint as closing_balance_paise

    from public.finance_accounts fa
    left join public.financial_transactions ft
      on ft.finance_account_id = fa.id
    where
      fa.created_at <
        (
          v_next_month::timestamp
          at time zone 'Asia/Kolkata'
        )
      or exists (
        select 1
        from public.financial_transactions history_ft
        where history_ft.finance_account_id = fa.id
          and history_ft.business_date < v_next_month
      )
    group by
      fa.id,
      fa.name,
      fa.account_type,
      fa.status,
      fa.currency
  )
  select
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'finance_account_id', ab.id,
          'name', ab.name,
          'account_type', ab.account_type,
          'status', ab.status,
          'currency', ab.currency,
          'opening_balance_paise',
            ab.opening_balance_paise,
          'month_inflow_paise',
            ab.month_inflow_paise,
          'month_outflow_paise',
            ab.month_outflow_paise,
          'closing_balance_paise',
            ab.closing_balance_paise
        )
        order by
          ab.account_type,
          lower(ab.name),
          ab.id
      ),
      '[]'::jsonb
    ),

    coalesce(
      sum(ab.closing_balance_paise)
        filter (
          where ab.account_type = 'cash'
        ),
      0
    )::bigint,

    coalesce(
      sum(ab.closing_balance_paise)
        filter (
          where ab.account_type = 'bank'
        ),
      0
    )::bigint,

    coalesce(
      sum(ab.closing_balance_paise)
        filter (
          where ab.account_type = 'upi'
        ),
      0
    )::bigint,

    coalesce(
      sum(ab.closing_balance_paise)
        filter (
          where ab.account_type = 'other'
        ),
      0
    )::bigint

  into
    v_accounts,
    v_cash_closing_paise,
    v_bank_closing_paise,
    v_upi_closing_paise,
    v_other_closing_paise
  from account_balances ab;

  select
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', ft.id,
          'finance_account_id',
            ft.finance_account_id,
          'account_name',
            fa.name,
          'account_type',
            fa.account_type,
          'transaction_category',
            ft.transaction_category,
          'direction',
            ft.direction,
          'amount_paise',
            ft.amount_paise,
          'business_date',
            ft.business_date,
          'reference_type',
            ft.reference_type,
          'reference_id',
            ft.reference_id,
          'related_transaction_id',
            ft.related_transaction_id,
          'operation_id',
            ft.operation_id,
          'created_at',
            ft.created_at
        )
        order by
          ft.business_date,
          ft.created_at,
          ft.id
      ),
      '[]'::jsonb
    )
  into v_ledger
  from public.financial_transactions ft
  join public.finance_accounts fa
    on fa.id = ft.finance_account_id
  where ft.business_date >= v_month
    and ft.business_date < v_next_month;

  select
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'transaction_id',
            ft.id,
          'expense_id',
            e.id,
          'finance_account_id',
            ft.finance_account_id,
          'account_name',
            fa.name,
          'amount_paise',
            ft.amount_paise,
          'business_date',
            ft.business_date,
          'description',
            e.description,
          'payee',
            e.payee,
          'posted_at',
            e.decided_at
        )
        order by
          ft.business_date,
          ft.created_at,
          ft.id
      ),
      '[]'::jsonb
    )
  into v_expenses
  from public.financial_transactions ft
  join public.finance_accounts fa
    on fa.id = ft.finance_account_id
  left join public.finance_expenses e
    on e.id = ft.reference_id
    and ft.reference_type = 'finance_expense'
  where ft.transaction_category = 'EXPENSE'
    and ft.business_date >= v_month
    and ft.business_date < v_next_month;

  select
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'transfer_id',
            t.id,
          'business_date',
            t.business_date,
          'amount_paise',
            t.amount_paise,
          'reason',
            t.reason,
          'source_finance_account_id',
            t.source_finance_account_id,
          'source_account_name',
            source_account.name,
          'destination_finance_account_id',
            t.destination_finance_account_id,
          'destination_account_name',
            destination_account.name,
          'source_transaction_id',
            t.source_transaction_id,
          'destination_transaction_id',
            t.destination_transaction_id,
          'approved_at',
            t.decided_at
        )
        order by
          t.business_date,
          t.created_at,
          t.id
      ),
      '[]'::jsonb
    )
  into v_transfers
  from public.finance_transfers t
  join public.finance_accounts source_account
    on source_account.id =
      t.source_finance_account_id
  join public.finance_accounts destination_account
    on destination_account.id =
      t.destination_finance_account_id
  where t.status = 'approved'
    and t.business_date >= v_month
    and t.business_date < v_next_month;

  select
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'adjustment_id',
            a.id,
          'adjustment_type',
            a.adjustment_type,
          'target_transaction_id',
            a.target_transaction_id,
          'applied_transaction_id',
            a.applied_transaction_id,
          'reason',
            a.reason,
          'business_date',
            a.business_date,
          'correction_finance_account_id',
            a.correction_finance_account_id,
          'correction_direction',
            a.correction_direction,
          'correction_amount_paise',
            a.correction_amount_paise,
          'applied_at',
            a.decided_at
        )
        order by
          a.business_date,
          a.created_at,
          a.id
      ),
      '[]'::jsonb
    )
  into v_adjustments
  from public.finance_adjustments a
  where a.status = 'applied'
    and a.business_date >= v_month
    and a.business_date < v_next_month;

  select
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'transaction_id',
            ft.id,
          'category',
            ft.transaction_category,
          'amount_paise',
            ft.amount_paise,
          'business_date',
            ft.business_date,
          'finance_account_id',
            ft.finance_account_id,
          'account_name',
            fa.name,
          'reference_type',
            ft.reference_type,
          'reference_id',
            ft.reference_id,
          'member_profile_id',
            case
              when ft.reference_type =
                   'donation_payment'
                then dp.member_profile_id
              when ft.reference_type =
                   'additional_donation'
                then ad.member_profile_id
              else null
            end,
          'member_name',
            mp.display_name,
          'donation_kind',
            ad.donation_kind
        )
        order by
          ft.business_date,
          ft.created_at,
          ft.id
      ),
      '[]'::jsonb
    )
  into v_donations
  from public.financial_transactions ft
  join public.finance_accounts fa
    on fa.id = ft.finance_account_id
  left join public.donation_payments dp
    on ft.reference_type = 'donation_payment'
    and dp.id = ft.reference_id
  left join public.additional_donations ad
    on ft.reference_type = 'additional_donation'
    and ad.id = ft.reference_id
  left join public.member_profiles mp
    on mp.id = coalesce(
      dp.member_profile_id,
      ad.member_profile_id
    )
  where ft.transaction_category in (
      'DONATION_RECURRING',
      'DONATION_ADDITIONAL',
      'DONATION_ANONYMOUS',
      'DONATION_JUMMAH'
    )
    and ft.business_date >= v_month
    and ft.business_date < v_next_month;

  with obligation_balances as (
    select
      o.id,
      o.member_profile_id,
      mp.display_name as member_name,
      o.effective_month,
      o.authoritative_amount_paise,

      coalesce(
        (
          select sum(a.allocated_amount_paise)
          from public.donation_payment_allocations a
          where a.obligation_id = o.id
            and exists (
              select 1
              from public.financial_transactions allocation_ft
              where allocation_ft.reference_type =
                    'donation_payment'
                and allocation_ft.reference_id =
                    a.payment_id
                and allocation_ft.transaction_category =
                    'DONATION_RECURRING'
                and allocation_ft.business_date <
                    v_next_month
            )
        ),
        0
      )::bigint as allocated_amount_paise,

      coalesce(
        (
          select sum(w.waived_amount_paise)
          from public.donation_obligation_waivers w
          where w.obligation_id = o.id
            and w.created_at <
              (
                v_next_month::timestamp
                at time zone 'Asia/Kolkata'
              )
        ),
        0
      )::bigint as waived_amount_paise

    from public.donation_obligations o
    join public.member_profiles mp
      on mp.id = o.member_profile_id
    where o.effective_month <= v_month
  ),
  outstanding_rows as (
    select
      ob.*,
      greatest(
        ob.authoritative_amount_paise
          - ob.allocated_amount_paise
          - ob.waived_amount_paise,
        0
      )::bigint as outstanding_amount_paise
    from obligation_balances ob
  )
  select
    jsonb_build_object(
      'as_of_date',
        v_month_end,
      'total_outstanding_paise',
        coalesce(
          sum(orow.outstanding_amount_paise),
          0
        )::bigint,
      'outstanding_obligation_count',
        count(*) filter (
          where orow.outstanding_amount_paise > 0
        ),
      'obligations',
        coalesce(
          jsonb_agg(
            jsonb_build_object(
              'obligation_id',
                orow.id,
              'member_profile_id',
                orow.member_profile_id,
              'member_name',
                orow.member_name,
              'effective_month',
                orow.effective_month,
              'authoritative_amount_paise',
                orow.authoritative_amount_paise,
              'allocated_amount_paise',
                orow.allocated_amount_paise,
              'waived_amount_paise',
                orow.waived_amount_paise,
              'outstanding_amount_paise',
                orow.outstanding_amount_paise
            )
            order by
              orow.effective_month,
              lower(orow.member_name),
              orow.id
          ) filter (
            where orow.outstanding_amount_paise > 0
          ),
          '[]'::jsonb
        )
    )
  into v_outstanding
  from outstanding_rows orow;

  select
    jsonb_build_object(
      'expenses',
        jsonb_build_object(
          'submitted',
            count(*) filter (
              where entity_type = 'expense'
                and entity_status = 'submitted'
            ),
          'rejected',
            count(*) filter (
              where entity_type = 'expense'
                and entity_status = 'rejected'
            )
        ),
      'transfers',
        jsonb_build_object(
          'submitted',
            count(*) filter (
              where entity_type = 'transfer'
                and entity_status = 'submitted'
            ),
          'rejected',
            count(*) filter (
              where entity_type = 'transfer'
                and entity_status = 'rejected'
            )
        ),
      'adjustments',
        jsonb_build_object(
          'submitted',
            count(*) filter (
              where entity_type = 'adjustment'
                and entity_status = 'submitted'
            ),
          'rejected',
            count(*) filter (
              where entity_type = 'adjustment'
                and entity_status = 'rejected'
            )
        )
    )
  into v_workflow
  from (
    select
      'expense'::text as entity_type,
      e.status as entity_status
    from public.finance_expenses e
    where e.business_date >= v_month
      and e.business_date < v_next_month
      and e.status in ('submitted', 'rejected')

    union all

    select
      'transfer'::text,
      t.status
    from public.finance_transfers t
    where t.business_date >= v_month
      and t.business_date < v_next_month
      and t.status in ('submitted', 'rejected')

    union all

    select
      'adjustment'::text,
      a.status
    from public.finance_adjustments a
    where a.business_date >= v_month
      and a.business_date < v_next_month
      and a.status in ('submitted', 'rejected')
  ) workflow_rows;

  v_snapshot :=
    jsonb_build_object(
      'schema_version',
        1,
      'currency',
        'INR',
      'report_month',
        v_month,
      'period_start',
        v_month,
      'period_end',
        v_month_end,

      'summary',
        jsonb_build_object(
          'opening_balance_paise',
            v_opening_balance_paise,
          'donation_inflow_paise',
            v_donation_inflow_paise,
          'expense_outflow_paise',
            v_expense_outflow_paise,
          'adjustments_net_paise',
            v_adjustments_net_paise,
          'transfer_in_paise',
            v_transfer_in_paise,
          'transfer_out_paise',
            v_transfer_out_paise,
          'closing_balance_paise',
            v_closing_balance_paise,
          'transaction_count',
            v_transaction_count
        ),

      'donation_breakdown',
        jsonb_build_object(
          'recurring_paise',
            coalesce(
              (
                select sum(ft.amount_paise)
                from public.financial_transactions ft
                where ft.business_date >= v_month
                  and ft.business_date < v_next_month
                  and ft.transaction_category =
                    'DONATION_RECURRING'
              ),
              0
            ),
          'additional_paise',
            coalesce(
              (
                select sum(ft.amount_paise)
                from public.financial_transactions ft
                where ft.business_date >= v_month
                  and ft.business_date < v_next_month
                  and ft.transaction_category =
                    'DONATION_ADDITIONAL'
              ),
              0
            ),
          'anonymous_paise',
            coalesce(
              (
                select sum(ft.amount_paise)
                from public.financial_transactions ft
                where ft.business_date >= v_month
                  and ft.business_date < v_next_month
                  and ft.transaction_category =
                    'DONATION_ANONYMOUS'
              ),
              0
            ),
          'jummah_paise',
            coalesce(
              (
                select sum(ft.amount_paise)
                from public.financial_transactions ft
                where ft.business_date >= v_month
                  and ft.business_date < v_next_month
                  and ft.transaction_category =
                    'DONATION_JUMMAH'
              ),
              0
            )
        ),

      'closing_by_account_type',
        jsonb_build_object(
          'cash_paise',
            v_cash_closing_paise,
          'bank_paise',
            v_bank_closing_paise,
          'upi_paise',
            v_upi_closing_paise,
          'other_paise',
            v_other_closing_paise
        ),

      'accounts',
        v_accounts,
      'donations',
        v_donations,
      'expenses',
        v_expenses,
      'transfers',
        v_transfers,
      'adjustments',
        v_adjustments,
      'outstanding_obligations',
        v_outstanding,
      'workflow',
        v_workflow,
      'ledger',
        v_ledger
    );

  v_snapshot_sha256 :=
    encode(
      digest(
        v_snapshot::text,
        'sha256'
      ),
      'hex'
    );

  select *
  into v_existing
  from public.finance_monthly_reports r
  where r.report_month = v_month
    and r.snapshot_sha256 =
      v_snapshot_sha256;

  if found then
    return v_existing;
  end if;

  select
    coalesce(max(r.revision), 0) + 1
  into v_revision
  from public.finance_monthly_reports r
  where r.report_month = v_month;

  v_storage_path :=
    to_char(v_month, 'YYYY') ||
    '/' ||
    to_char(v_month, 'MM') ||
    '/masjid-e-mamoor-finance-' ||
    to_char(v_month, 'YYYY-MM') ||
    '-v' ||
    v_revision::text ||
    '.pdf';

  insert into public.finance_monthly_reports (
    report_month,
    revision,
    status,
    generation_source,
    snapshot_sha256,
    opening_balance_paise,
    donation_inflow_paise,
    expense_outflow_paise,
    adjustments_net_paise,
    transfer_in_paise,
    transfer_out_paise,
    closing_balance_paise,
    cash_closing_paise,
    bank_closing_paise,
    upi_closing_paise,
    other_closing_paise,
    transaction_count,
    storage_object_path
  )
  values (
    v_month,
    v_revision,
    'generating',
    v_generation_source,
    v_snapshot_sha256,
    v_opening_balance_paise,
    v_donation_inflow_paise,
    v_expense_outflow_paise,
    v_adjustments_net_paise,
    v_transfer_in_paise,
    v_transfer_out_paise,
    v_closing_balance_paise,
    v_cash_closing_paise,
    v_bank_closing_paise,
    v_upi_closing_paise,
    v_other_closing_paise,
    v_transaction_count,
    v_storage_path
  )
  returning *
  into v_report;

  insert into private.finance_monthly_report_snapshots (
    report_id,
    snapshot,
    snapshot_sha256
  )
  values (
    v_report.id,
    v_snapshot,
    v_snapshot_sha256
  );

  return v_report;
end;
$function$;

revoke all
on function private.build_finance_monthly_report_snapshot(
  date,
  text
)
from public, anon, authenticated, service_role;

create or replace function public.generate_finance_monthly_report_snapshot(
  p_report_month date
)
returns public.finance_monthly_reports
language plpgsql
security definer
set search_path = pg_catalog, extensions
as $function$
declare
  v_actor uuid;
  v_report public.finance_monthly_reports;
begin
  v_actor :=
    public.lock_active_finance_actor();

  if v_actor is null then
    raise exception 'not_authorized'
      using errcode = '42501';
  end if;

  if not public.has_application_permission(
    'finance.monthly_reports.manage'
  ) then
    raise exception 'not_authorized'
      using errcode = '42501';
  end if;

  select *
  into v_report
  from private.build_finance_monthly_report_snapshot(
    p_report_month,
    'manual'
  );

  return v_report;
end;
$function$;

revoke all
on function public.generate_finance_monthly_report_snapshot(
  date
)
from public, anon, service_role;

grant execute
on function public.generate_finance_monthly_report_snapshot(
  date
)
to authenticated;

comment on function
  public.generate_finance_monthly_report_snapshot(date)
is
  'Creates or reuses an immutable authoritative monthly Finance snapshot. Same month plus same snapshot hash returns the existing revision; changed authoritative source data creates a new revision.';

commit;
