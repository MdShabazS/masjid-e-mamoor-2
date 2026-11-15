begin;

-- The existing posted rows already represent settled outflows. Keep their ledger
-- references intact while new approvals become unpaid obligations.
alter table public.finance_expenses
  add column paid_amount_paise bigint not null default 0;
update public.finance_expenses set paid_amount_paise = amount_paise
where status = 'posted';
alter table public.finance_expenses drop constraint finance_expenses_status_chk;
alter table public.finance_expenses add constraint finance_expenses_status_chk
  check (status in ('submitted', 'approved', 'partially_paid', 'posted', 'rejected'));
alter table public.finance_expenses drop constraint finance_expenses_decision_chk;
alter table public.finance_expenses add constraint finance_expenses_decision_chk check (
  paid_amount_paise >= 0 and paid_amount_paise <= amount_paise and
  ((status = 'submitted' and decided_by_application_user_id is null and
    decided_at is null and rejection_reason is null and posted_transaction_id is null and paid_amount_paise = 0)
  or (status = 'rejected' and decided_by_application_user_id is not null and
    decided_at is not null and rejection_reason is not null and posted_transaction_id is null and paid_amount_paise = 0)
  or (status = 'approved' and decided_by_application_user_id is not null and
    decided_at is not null and rejection_reason is null and posted_transaction_id is null and paid_amount_paise = 0)
  or (status = 'partially_paid' and decided_by_application_user_id is not null and
    decided_at is not null and rejection_reason is null and posted_transaction_id is null and
    paid_amount_paise > 0 and paid_amount_paise < amount_paise)
  or (status = 'posted' and decided_by_application_user_id is not null and
    decided_at is not null and rejection_reason is null and posted_transaction_id is not null and
    paid_amount_paise = amount_paise))
);

insert into public.permissions (key, name, description)
values ('finance.expenses.pay', 'Finance / Expenses / Pay', 'Record an approved expense payment')
on conflict (key) do nothing;
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r cross join public.permissions p
where r.key in ('finance', 'system_admin') and p.key = 'finance.expenses.pay'
on conflict do nothing;
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r cross join public.permissions p
where r.key in ('system_admin', 'president', 'vice_president', 'secretary', 'finance', 'committee_member')
  and p.key in ('finance.expenses.create', 'finance.accounts.read')
on conflict do nothing;
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r cross join public.permissions p
where r.key in ('system_admin', 'president', 'vice_president') and p.key = 'finance.expenses.approve'
on conflict do nothing;
delete from public.role_permissions rp using public.roles r, public.permissions p
where rp.role_id = r.id and rp.permission_id = p.id
  and r.key = 'finance' and p.key = 'finance.expenses.approve';

alter table public.finance_operation_idempotency drop constraint finance_operation_idempotency_type_chk;
alter table public.finance_operation_idempotency add constraint finance_operation_idempotency_type_chk check (
  operation_type in ('account_create','account_status_change','account_rename',
    'expense_submit','expense_decide','expense_payment','transfer_submit','transfer_decide',
    'adjustment_submit','adjustment_decide','donation_verify_post','reconciliation_start',
    'reconciliation_item_record','reconciliation_complete')
);
alter table public.finance_audit_events drop constraint finance_audit_events_type_chk;
alter table public.finance_audit_events add constraint finance_audit_events_type_chk check (
  event_type in ('account_created','account_status_changed','account_renamed',
    'expense_submitted','expense_approved','expense_payment_recorded','expense_posted','expense_rejected',
    'transfer_submitted','transfer_approved','transfer_rejected','adjustment_submitted',
    'correction_applied','reversal_applied','adjustment_rejected','donation_payment_posted',
    'reconciliation_started','reconciliation_item_recorded',
    'reconciliation_discrepancy_recorded','reconciliation_completed')
);

create or replace function public.decide_finance_expense(
  p_finance_expense_id uuid, p_decision text, p_reason text, p_operation_id text
) returns public.finance_expenses
language plpgsql security definer set search_path = pg_catalog, extensions
as $$
declare
  v_actor uuid := public.lock_active_finance_actor();
  v_decision text := lower(btrim(p_decision));
  v_reason text := nullif(btrim(p_reason), '');
  v_operation_id text := nullif(btrim(p_operation_id), '');
  v_fingerprint text;
  v_existing public.finance_operation_idempotency;
  v_expense public.finance_expenses;
begin
  if not public.has_application_permission('finance.expenses.approve') then
    raise exception 'not_authorized' using errcode = '42501'; end if;
  if v_decision is null or v_decision not in ('approve','reject') then
    raise exception 'invalid_decision' using errcode = '22023'; end if;
  if v_decision = 'reject' and v_reason is null then
    raise exception 'reason_required' using errcode = '22023'; end if;
  if v_reason is not null and length(v_reason) > 2000 then
    raise exception 'invalid_reason' using errcode = '22023'; end if;
  if v_operation_id is null or length(v_operation_id) > 200 then
    raise exception 'invalid_operation_id' using errcode = '22023'; end if;
  v_fingerprint := encode(digest(jsonb_build_object(
    'operation','expense_decide','finance_expense_id',p_finance_expense_id,
    'decision',v_decision,'reason',v_reason)::text,'sha256'),'hex');
  perform pg_advisory_xact_lock(hashtextextended('finance-operation:' || v_operation_id, 0));
  select * into v_existing from public.finance_operation_idempotency where operation_id = v_operation_id;
  if found then
    if v_existing.actor_application_user_id <> v_actor or v_existing.operation_type <> 'expense_decide'
       or v_existing.request_fingerprint <> v_fingerprint then
      raise exception 'operation_id_conflict' using errcode = '23505'; end if;
    select * into v_expense from public.finance_expenses where id = v_existing.result_entity_id;
    return v_expense;
  end if;
  select * into v_expense from public.finance_expenses where id = p_finance_expense_id for update;
  if not found then raise exception 'expense_not_found' using errcode = 'P0002'; end if;
  if v_expense.status <> 'submitted' then raise exception 'expense_invalid_state' using errcode = '22023'; end if;
  -- The President and Vice President may review their own requests under the
  -- approved product policy. The payment is still a separate Treasurer act.
  update public.finance_expenses set
    status = case v_decision when 'approve' then 'approved' else 'rejected' end,
    decided_by_application_user_id = v_actor, decided_at = now(),
    rejection_reason = case v_decision when 'reject' then v_reason else null end
  where id = v_expense.id returning * into v_expense;
  insert into public.finance_audit_events
    (actor_application_user_id,event_type,entity_type,entity_id,operation_id,reason,details)
  values (v_actor,case v_decision when 'approve' then 'expense_approved' else 'expense_rejected' end,
    'finance_expense',v_expense.id,v_operation_id,
    case v_decision when 'reject' then v_reason else null end,
    jsonb_build_object('amount_paise',v_expense.amount_paise));
  insert into public.finance_operation_idempotency values
    (v_operation_id,'expense_decide',v_actor,v_fingerprint,'finance_expense',v_expense.id,now());
  return v_expense;
end;
$$;

create or replace function public.pay_finance_expense(
  p_finance_expense_id uuid, p_amount_paise bigint, p_business_date date, p_operation_id text
) returns public.finance_expenses
language plpgsql security definer set search_path = pg_catalog, extensions
as $$
declare
  v_actor uuid := public.lock_active_finance_actor();
  v_operation_id text := nullif(btrim(p_operation_id),'');
  v_fingerprint text;
  v_existing public.finance_operation_idempotency;
  v_expense public.finance_expenses;
  v_account public.finance_accounts;
  v_transaction public.financial_transactions;
  v_total bigint;
begin
  if not public.has_application_permission('finance.expenses.pay') then
    raise exception 'not_authorized' using errcode = '42501'; end if;
  if p_amount_paise is null or p_amount_paise <= 0 then
    raise exception 'invalid_amount' using errcode = '22023'; end if;
  if p_business_date is null then raise exception 'invalid_business_date' using errcode = '22023'; end if;
  if v_operation_id is null or length(v_operation_id) > 200 then
    raise exception 'invalid_operation_id' using errcode = '22023'; end if;
  v_fingerprint := encode(digest(jsonb_build_object('operation','expense_payment',
    'finance_expense_id',p_finance_expense_id,'amount_paise',p_amount_paise,
    'business_date',p_business_date)::text,'sha256'),'hex');
  perform pg_advisory_xact_lock(hashtextextended('finance-operation:' || v_operation_id, 0));
  select * into v_existing from public.finance_operation_idempotency where operation_id = v_operation_id;
  if found then
    if v_existing.actor_application_user_id <> v_actor or v_existing.operation_type <> 'expense_payment'
       or v_existing.request_fingerprint <> v_fingerprint then
      raise exception 'operation_id_conflict' using errcode = '23505'; end if;
    select * into v_expense from public.finance_expenses where id = v_existing.result_entity_id;
    return v_expense;
  end if;
  select * into v_expense from public.finance_expenses where id = p_finance_expense_id for update;
  if not found then raise exception 'expense_not_found' using errcode = 'P0002'; end if;
  if v_expense.status not in ('approved','partially_paid') then
    raise exception 'expense_not_approved_or_already_paid' using errcode = '22023'; end if;
  if p_amount_paise > v_expense.amount_paise - v_expense.paid_amount_paise then
    raise exception 'payment_exceeds_approved_amount' using errcode = '22023'; end if;
  select * into v_account from public.finance_accounts where id = v_expense.finance_account_id for update;
  if v_account.status <> 'active' then raise exception 'account_not_active' using errcode = '22023'; end if;
  insert into public.financial_transactions
    (finance_account_id,transaction_category,direction,amount_paise,business_date,
     reference_type,reference_id,operation_id,created_by_application_user_id)
  values (v_expense.finance_account_id,'EXPENSE','outflow',p_amount_paise,p_business_date,
    'finance_expense',v_expense.id,v_operation_id,v_actor)
  returning * into v_transaction;
  v_total := v_expense.paid_amount_paise + p_amount_paise;
  update public.finance_expenses set paid_amount_paise = v_total,
    status = case when v_total = amount_paise then 'posted' else 'partially_paid' end,
    posted_transaction_id = case when v_total = amount_paise then v_transaction.id else null end
  where id = v_expense.id returning * into v_expense;
  insert into public.finance_audit_events
    (actor_application_user_id,event_type,entity_type,entity_id,operation_id,details)
  values (v_actor,'expense_payment_recorded','finance_expense',v_expense.id,v_operation_id,
    jsonb_build_object('financial_transaction_id',v_transaction.id,
      'payment_amount_paise',p_amount_paise,'paid_total_paise',v_total,
      'business_date',p_business_date));
  insert into public.finance_operation_idempotency values
    (v_operation_id,'expense_payment',v_actor,v_fingerprint,'finance_expense',v_expense.id,now());
  return v_expense;
end;
$$;

revoke all on function public.pay_finance_expense(uuid,bigint,date,text) from public,anon,authenticated,service_role;
grant execute on function public.pay_finance_expense(uuid,bigint,date,text) to authenticated;

-- Notify the submitter at approval, before payment.
create or replace function public.notify_approval_workflow_event()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, extensions
as $$
declare
  v_source_type text;
  v_target_path text;
  v_entity_id uuid;
  v_actor_id uuid;
  v_submitter_id uuid;
  v_kind text;
  v_title text;
  v_body text;
  v_permission_keys text[];
  v_direct_recipient uuid;
  v_recipient_ids uuid[];
begin
  if tg_table_name = 'finance_expenses' then
    v_source_type := 'finance_expense';
    v_target_path := '/finance/expenses';
    v_entity_id := new.id;
    v_submitter_id := new.submitted_by_application_user_id;
    if tg_op = 'INSERT' and new.status = 'submitted' then
      v_kind := 'expense_awaiting_approval';
      v_title := 'Expense awaiting approval';
      v_body := 'A submitted expense needs review.';
      v_permission_keys := array['finance.expenses.approve'];
    elsif tg_op = 'UPDATE' and old.status = 'submitted' and new.status in ('approved', 'rejected') then
      v_direct_recipient := v_submitter_id;
      v_actor_id := new.decided_by_application_user_id;
      v_kind := case new.status when 'approved' then 'expense_approved' else 'expense_rejected' end;
      v_title := case new.status when 'approved' then 'Expense approved' else 'Expense not approved' end;
      v_body := case new.status when 'approved' then 'Your submitted expense was approved and is awaiting payment.' else 'Your submitted expense was rejected.' end;
    end if;
  elsif tg_table_name = 'finance_transfers' then
    v_source_type := 'finance_transfer';
    v_target_path := '/finance/transfers';
    v_entity_id := new.id;
    v_submitter_id := new.submitted_by_application_user_id;
    if tg_op = 'INSERT' and new.status = 'submitted' then
      v_kind := 'transfer_awaiting_approval';
      v_title := 'Transfer awaiting approval';
      v_body := 'A submitted transfer needs review.';
      v_permission_keys := array['finance.transfers.approve'];
    elsif tg_op = 'UPDATE' and old.status = 'submitted' and new.status in ('approved', 'rejected') then
      v_direct_recipient := v_submitter_id;
      v_actor_id := new.decided_by_application_user_id;
      v_kind := case new.status when 'approved' then 'transfer_approved' else 'transfer_rejected' end;
      v_title := case new.status when 'approved' then 'Transfer approved' else 'Transfer not approved' end;
      v_body := case new.status when 'approved' then 'Your submitted transfer was approved.' else 'Your submitted transfer was rejected.' end;
    end if;
  elsif tg_table_name = 'finance_adjustments' then
    v_source_type := 'finance_adjustment';
    v_target_path := '/finance/adjustments';
    v_entity_id := new.id;
    v_submitter_id := new.submitted_by_application_user_id;
    if tg_op = 'INSERT' and new.status = 'submitted' then
      v_kind := 'adjustment_awaiting_approval';
      v_title := 'Finance adjustment awaiting approval';
      v_body := 'A submitted finance adjustment needs review.';
      v_permission_keys := case new.adjustment_type
        when 'correction' then array['finance.corrections.create']
        else array['finance.cancellations.create'] end;
    elsif tg_op = 'UPDATE' and old.status = 'submitted' and new.status in ('applied', 'rejected') then
      v_direct_recipient := v_submitter_id;
      v_actor_id := new.decided_by_application_user_id;
      v_kind := case
        when new.status = 'rejected' then 'adjustment_rejected'
        when new.adjustment_type = 'correction' then 'correction_applied'
        else 'reversal_applied' end;
      v_title := case
        when new.status = 'rejected' then 'Finance adjustment not approved'
        when new.adjustment_type = 'correction' then 'Correction approved'
        else 'Reversal approved' end;
      v_body := case
        when new.status = 'rejected' then 'Your submitted finance adjustment was rejected.'
        when new.adjustment_type = 'correction' then 'Your submitted correction was approved.'
        else 'Your submitted reversal was approved.' end;
    end if;
  elsif tg_table_name = 'donation_payments' then
    v_source_type := 'donation_payment';
    v_target_path := '/donations';
    v_entity_id := new.id;
    v_submitter_id := new.submitted_by_application_user_id;
    if tg_op = 'INSERT' and new.status = 'submitted' then
      v_kind := 'payment_submitted';
      v_title := 'Payment awaiting review';
      v_body := 'A submitted payment needs review.';
      v_permission_keys := array['donations.payments.verify'];
    elsif tg_op = 'UPDATE' and old.status in ('submitted', 'under_review') and new.status in ('verified', 'rejected') then
      v_direct_recipient := v_submitter_id;
      v_actor_id := new.reviewed_by_application_user_id;
      v_kind := case new.status when 'verified' then 'payment_verified' else 'payment_rejected' end;
      v_title := case new.status when 'verified' then 'Payment verified' else 'Payment not verified' end;
      v_body := case new.status when 'verified' then 'Your payment was verified.' else 'Your payment was rejected.' end;
    end if;
  elsif tg_table_name = 'referrals' then
    v_source_type := 'referral';
    v_target_path := '/referrals';
    v_entity_id := new.id;
    if tg_op = 'UPDATE' and old.status in ('pending', 'cancelled') and new.status = 'submitted' then
      v_kind := 'referral_awaiting_review';
      v_title := 'Referral needs review';
      v_body := 'A referral registration is awaiting review.';
      v_permission_keys := array['notifications.own.read'];
    elsif tg_op = 'UPDATE' and old.status = 'submitted' and new.status in ('approved', 'rejected') then
      select mp.application_user_id into v_direct_recipient
      from public.member_profiles mp
      where mp.id = new.referrer_member_profile_id;
      v_actor_id := new.reviewed_by_application_user_id;
      v_kind := case new.status when 'approved' then 'referral_approved' else 'referral_rejected' end;
      v_title := case new.status when 'approved' then 'Referral approved' else 'Referral not approved' end;
      v_body := case new.status when 'approved' then 'A referral you submitted was approved.' else 'A referral you submitted was rejected.' end;
    elsif tg_op = 'UPDATE' and old.status = 'approved' and new.status = 'completed' then
      select mp.application_user_id into v_direct_recipient
      from public.member_profiles mp
      where mp.id = new.referrer_member_profile_id;
      v_actor_id := new.completed_by_application_user_id;
      v_kind := 'referral_completed';
      v_title := 'Referral registration completed';
      v_body := 'A referral you submitted completed registration.';
    end if;
  end if;

  if v_kind is null then
    return new;
  end if;

  if v_permission_keys is not null then
    insert into public.notifications (
      recipient_application_user_id, actor_application_user_id, kind,
      title, body, target_path, source_type, source_entity_id, metadata
    )
    select distinct au.id, coalesce(v_actor_id, v_submitter_id), v_kind,
      v_title, v_body, v_target_path, v_source_type, v_entity_id,
      case v_source_type
        when 'finance_expense' then jsonb_build_object('finance_expense_id', v_entity_id)
        else jsonb_build_object('entity_id', v_entity_id)
      end
    from public.application_users au
    join public.application_user_roles aur on aur.application_user_id = au.id
    join public.role_permissions rp on rp.role_id = aur.role_id
    join public.permissions p on p.id = rp.permission_id
    where au.status = 'active'
      and au.id is distinct from coalesce(v_actor_id, v_submitter_id)
      and p.key = any(v_permission_keys)
      and exists (
        select 1 from public.role_permissions nrp
        join public.permissions np on np.id = nrp.permission_id
        where nrp.role_id = aur.role_id and np.key = 'notifications.own.read'
      )
      and (tg_table_name <> 'referrals' or exists (
        select 1 from public.roles r where r.id = aur.role_id
          and r.key in ('president', 'system_admin')
      ))
    on conflict (recipient_application_user_id, source_entity_id, kind)
      where source_type in ('finance_expense', 'finance_transfer', 'finance_adjustment', 'donation_payment', 'referral')
      do nothing;
  elsif v_direct_recipient is not null then
    insert into public.notifications (
      recipient_application_user_id, actor_application_user_id, kind,
      title, body, target_path, source_type, source_entity_id, metadata
    )
    select au.id, v_actor_id, v_kind, v_title, v_body, v_target_path,
      v_source_type, v_entity_id,
      case v_source_type
        when 'finance_expense' then jsonb_build_object('finance_expense_id', v_entity_id)
        else jsonb_build_object('entity_id', v_entity_id)
      end
    from public.application_users au
    where au.id = v_direct_recipient
      and au.status = 'active'
      and au.id is distinct from v_actor_id
      and exists (
        select 1
        from public.application_user_roles recipient_role
        join public.role_permissions notification_permission
          on notification_permission.role_id = recipient_role.role_id
        join public.permissions notification_capability
          on notification_capability.id = notification_permission.permission_id
        where recipient_role.application_user_id = au.id
          and notification_capability.key = 'notifications.own.read'
      )
    on conflict (recipient_application_user_id, source_entity_id, kind)
      where source_type in ('finance_expense', 'finance_transfer', 'finance_adjustment', 'donation_payment', 'referral')
      do nothing;
  end if;

  return new;
end;
$$;

commit;
