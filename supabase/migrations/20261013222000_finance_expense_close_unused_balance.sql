begin;

alter table public.finance_expenses
  add column closed_at timestamptz,
  add column closed_by_application_user_id uuid references public.application_users(id) on delete restrict,
  add column close_reason text constraint finance_expenses_close_reason_chk
    check (close_reason is null or length(btrim(close_reason)) between 10 and 1000);

alter table public.finance_expenses drop constraint finance_expenses_status_chk;
alter table public.finance_expenses add constraint finance_expenses_status_chk
  check (status in ('submitted','approved','partially_paid','posted','closed','rejected'));
alter table public.finance_expenses drop constraint finance_expenses_decision_chk;
alter table public.finance_expenses add constraint finance_expenses_decision_chk check (
  paid_amount_paise >= 0 and paid_amount_paise <= amount_paise and
  ((status = 'submitted' and decided_by_application_user_id is null and decided_at is null
    and rejection_reason is null and posted_transaction_id is null and paid_amount_paise = 0)
  or (status = 'rejected' and decided_by_application_user_id is not null and decided_at is not null
    and rejection_reason is not null and posted_transaction_id is null and paid_amount_paise = 0)
  or (status = 'approved' and decided_by_application_user_id is not null and decided_at is not null
    and rejection_reason is null and posted_transaction_id is null and paid_amount_paise = 0)
  or (status = 'partially_paid' and decided_by_application_user_id is not null and decided_at is not null
    and rejection_reason is null and posted_transaction_id is null
    and paid_amount_paise > 0 and paid_amount_paise < amount_paise)
  or (status = 'posted' and decided_by_application_user_id is not null and decided_at is not null
    and rejection_reason is null and posted_transaction_id is not null and paid_amount_paise = amount_paise)
  or (status = 'closed' and decided_by_application_user_id is not null and decided_at is not null
    and rejection_reason is null and posted_transaction_id is null
    and paid_amount_paise > 0 and paid_amount_paise < amount_paise))
  and ((status = 'closed' and closed_at is not null and closed_by_application_user_id is not null
    and close_reason is not null)
    or (status <> 'closed' and closed_at is null and closed_by_application_user_id is null
    and close_reason is null))
);

alter table public.finance_operation_idempotency drop constraint finance_operation_idempotency_type_chk;
alter table public.finance_operation_idempotency add constraint finance_operation_idempotency_type_chk check (
  operation_type in ('account_create','account_status_change','account_rename',
    'expense_submit','expense_decide','expense_payment','expense_close','transfer_submit','transfer_decide',
    'adjustment_submit','adjustment_decide','donation_verify_post','reconciliation_start',
    'reconciliation_item_record','reconciliation_complete')
);
alter table public.finance_audit_events drop constraint finance_audit_events_type_chk;
alter table public.finance_audit_events add constraint finance_audit_events_type_chk check (
  event_type in ('account_created','account_status_changed','account_renamed',
    'expense_submitted','expense_approved','expense_payment_recorded','expense_posted','expense_rejected',
    'expense_bill_attached','expense_missing_bill_explained','expense_closed',
    'transfer_submitted','transfer_approved','transfer_rejected','adjustment_submitted',
    'correction_applied','reversal_applied','adjustment_rejected','donation_payment_posted',
    'reconciliation_started','reconciliation_item_recorded',
    'reconciliation_discrepancy_recorded','reconciliation_completed')
);

create or replace function public.close_finance_expense(
  p_finance_expense_id uuid, p_reason text, p_operation_id text
) returns public.finance_expenses
language plpgsql security definer set search_path = pg_catalog, extensions
as $$
declare
  v_actor uuid := public.lock_active_finance_actor();
  v_reason text := nullif(btrim(p_reason),'');
  v_operation_id text := nullif(btrim(p_operation_id),'');
  v_fingerprint text;
  v_existing public.finance_operation_idempotency;
  v_expense public.finance_expenses;
begin
  if not public.has_application_permission('finance.expenses.pay') then
    raise exception 'not_authorized' using errcode = '42501'; end if;
  if v_reason is null or length(v_reason) not between 10 and 1000 then
    raise exception 'invalid_close_reason' using errcode = '22023'; end if;
  if v_operation_id is null or length(v_operation_id) > 200 then
    raise exception 'invalid_operation_id' using errcode = '22023'; end if;
  v_fingerprint := encode(digest(jsonb_build_object(
    'operation','expense_close','expense_id',p_finance_expense_id,'reason',v_reason
  )::text,'sha256'),'hex');
  perform pg_advisory_xact_lock(hashtextextended('finance-operation:' || v_operation_id,0));
  select * into v_existing from public.finance_operation_idempotency where operation_id = v_operation_id;
  if found then
    if v_existing.actor_application_user_id <> v_actor
      or v_existing.operation_type <> 'expense_close'
      or v_existing.request_fingerprint <> v_fingerprint then
      raise exception 'operation_id_conflict' using errcode = '23505'; end if;
    select * into v_expense from public.finance_expenses where id = v_existing.result_entity_id;
    return v_expense;
  end if;
  select * into v_expense from public.finance_expenses where id = p_finance_expense_id for update;
  if not found then raise exception 'expense_not_found' using errcode = 'P0002'; end if;
  if v_expense.status <> 'partially_paid' then
    raise exception 'expense_not_partially_paid' using errcode = '22023'; end if;
  update public.finance_expenses set status = 'closed',closed_at = now(),
    closed_by_application_user_id = v_actor,close_reason = v_reason
  where id = v_expense.id returning * into v_expense;
  insert into public.finance_audit_events
    (actor_application_user_id,event_type,entity_type,entity_id,operation_id,reason,details)
  values (v_actor,'expense_closed','finance_expense',v_expense.id,v_operation_id,v_reason,
    jsonb_build_object('approved_amount_paise',v_expense.amount_paise,
      'paid_amount_paise',v_expense.paid_amount_paise,
      'unused_amount_paise',v_expense.amount_paise - v_expense.paid_amount_paise));
  insert into public.finance_operation_idempotency values
    (v_operation_id,'expense_close',v_actor,v_fingerprint,'finance_expense',v_expense.id,now());
  return v_expense;
end;
$$;

revoke all on function public.close_finance_expense(uuid,text,text)
  from public,anon,authenticated,service_role;
grant execute on function public.close_finance_expense(uuid,text,text) to authenticated;
commit;
