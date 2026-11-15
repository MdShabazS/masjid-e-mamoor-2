begin;

alter table public.finance_expenses
  add column revision_number integer not null default 1
  constraint finance_expenses_revision_positive_chk check (revision_number > 0);

alter table public.finance_expense_bills
  add column revision_number integer not null default 1
  check (revision_number > 0);

create table public.finance_expense_revisions (
  id uuid primary key default gen_random_uuid(),
  finance_expense_id uuid not null references public.finance_expenses(id) on delete restrict,
  revision_number integer not null check (revision_number > 0),
  finance_account_id uuid not null references public.finance_accounts(id) on delete restrict,
  amount_paise bigint not null check (amount_paise > 0),
  description text not null,
  payee text,
  business_date date not null,
  missing_bill_reason text,
  submitted_by_application_user_id uuid not null references public.application_users(id) on delete restrict,
  decided_by_application_user_id uuid not null references public.application_users(id) on delete restrict,
  decided_at timestamptz not null,
  rejection_reason text not null,
  archived_at timestamptz not null default now(),
  unique(finance_expense_id,revision_number)
);
create trigger finance_expense_revisions_immutable
before update or delete on public.finance_expense_revisions
for each row execute function public.reject_finance_immutable_change();
alter table public.finance_expense_revisions enable row level security;
create policy finance_expense_revisions_authorized_read on public.finance_expense_revisions
for select to authenticated using (
  submitted_by_application_user_id = public.current_application_user_id()
  or public.has_application_permission('finance.expenses.approve')
  or public.has_application_permission('finance.expenses.pay')
);
revoke all on public.finance_expense_revisions from public,anon,authenticated;
grant select on public.finance_expense_revisions to authenticated;
grant all on public.finance_expense_revisions to service_role;

create or replace function public.register_finance_expense_bill(
  p_finance_expense_id uuid, p_storage_object_path text
) returns public.finance_expense_bills
language plpgsql security definer set search_path = pg_catalog, extensions
as $$
declare
  v_actor uuid := public.lock_active_finance_actor();
  v_expense public.finance_expenses;
  v_bill public.finance_expense_bills;
begin
  if p_storage_object_path is null or not public.can_upload_finance_expense_bill(p_storage_object_path)
     or split_part(p_storage_object_path,'/',1) <> p_finance_expense_id::text then
    raise exception 'bill_upload_not_allowed' using errcode = '42501'; end if;
  select * into v_expense from public.finance_expenses where id = p_finance_expense_id for update;
  if v_expense.status <> 'submitted' or v_expense.submitted_by_application_user_id <> v_actor then
    raise exception 'bill_upload_not_allowed' using errcode = '42501'; end if;
  select * into v_bill from public.finance_expense_bills
    where storage_object_path = p_storage_object_path;
  if found then
    if v_bill.finance_expense_id <> p_finance_expense_id or v_bill.uploaded_by_application_user_id <> v_actor then
      raise exception 'bill_path_conflict' using errcode = '23505'; end if;
    return v_bill;
  end if;
  if not exists (select 1 from storage.objects o where o.bucket_id = 'finance-expense-bills'
    and o.name = p_storage_object_path and o.owner_id = auth.uid()::text) then
    raise exception 'bill_object_missing_or_not_owned' using errcode = 'P0002'; end if;
  insert into public.finance_expense_bills(finance_expense_id,storage_object_path,uploaded_by_application_user_id,revision_number)
  values (p_finance_expense_id,p_storage_object_path,v_actor,v_expense.revision_number) returning * into v_bill;
  insert into public.finance_audit_events
    (actor_application_user_id,event_type,entity_type,entity_id,operation_id,details)
  values (v_actor,'expense_bill_attached','finance_expense',p_finance_expense_id,
    'bill:' || v_bill.id::text,jsonb_build_object('bill_id',v_bill.id));
  return v_bill;
end;
$$;

alter table public.finance_operation_idempotency drop constraint finance_operation_idempotency_type_chk;
alter table public.finance_operation_idempotency add constraint finance_operation_idempotency_type_chk check (
  operation_type in ('account_create','account_status_change','account_rename',
    'expense_submit','expense_decide','expense_payment','expense_close','expense_resubmit',
    'transfer_submit','transfer_decide','adjustment_submit','adjustment_decide',
    'donation_verify_post','reconciliation_start','reconciliation_item_record',
    'reconciliation_complete')
);
alter table public.finance_audit_events drop constraint finance_audit_events_type_chk;
alter table public.finance_audit_events add constraint finance_audit_events_type_chk check (
  event_type in ('account_created','account_status_changed','account_renamed',
    'expense_submitted','expense_approved','expense_payment_recorded','expense_posted','expense_rejected',
    'expense_bill_attached','expense_missing_bill_explained','expense_closed','expense_resubmitted',
    'transfer_submitted','transfer_approved','transfer_rejected','adjustment_submitted',
    'correction_applied','reversal_applied','adjustment_rejected','donation_payment_posted',
    'reconciliation_started','reconciliation_item_recorded',
    'reconciliation_discrepancy_recorded','reconciliation_completed')
);

create or replace function public.resubmit_finance_expense(
  p_finance_expense_id uuid, p_finance_account_id uuid, p_amount_paise bigint,
  p_description text, p_payee text, p_business_date date,
  p_missing_bill_reason text, p_operation_id text
) returns public.finance_expenses
language plpgsql security definer set search_path = pg_catalog, extensions
as $$
declare
  v_actor uuid := public.lock_active_finance_actor();
  v_description text := nullif(btrim(p_description),'');
  v_payee text := nullif(btrim(p_payee),'');
  v_missing_reason text := nullif(btrim(p_missing_bill_reason),'');
  v_operation_id text := nullif(btrim(p_operation_id),'');
  v_fingerprint text;
  v_existing public.finance_operation_idempotency;
  v_expense public.finance_expenses;
  v_revision public.finance_expense_revisions;
  v_account public.finance_accounts;
begin
  if not public.has_application_permission('finance.expenses.create') then
    raise exception 'not_authorized' using errcode = '42501'; end if;
  if p_amount_paise is null or p_amount_paise <= 0 then
    raise exception 'invalid_amount' using errcode = '22023'; end if;
  if v_description is null or length(v_description) > 2000 then
    raise exception 'invalid_description' using errcode = '22023'; end if;
  if v_payee is not null and length(v_payee) > 200 then
    raise exception 'invalid_payee' using errcode = '22023'; end if;
  if p_business_date is null then
    raise exception 'invalid_business_date' using errcode = '22023'; end if;
  if v_missing_reason is not null and length(v_missing_reason) not between 10 and 1000 then
    raise exception 'invalid_missing_bill_reason' using errcode = '22023'; end if;
  if v_operation_id is null or length(v_operation_id) > 200 then
    raise exception 'invalid_operation_id' using errcode = '22023'; end if;
  v_fingerprint := encode(digest(jsonb_build_object(
    'operation','expense_resubmit','expense_id',p_finance_expense_id,
    'finance_account_id',p_finance_account_id,'amount_paise',p_amount_paise,
    'description',v_description,'payee',v_payee,'business_date',p_business_date,
    'missing_bill_reason',v_missing_reason
  )::text,'sha256'),'hex');
  perform pg_advisory_xact_lock(hashtextextended('finance-operation:' || v_operation_id,0));
  select * into v_existing from public.finance_operation_idempotency where operation_id = v_operation_id;
  if found then
    if v_existing.actor_application_user_id <> v_actor
       or v_existing.operation_type <> 'expense_resubmit'
       or v_existing.request_fingerprint <> v_fingerprint then
      raise exception 'operation_id_conflict' using errcode = '23505'; end if;
    select * into v_expense from public.finance_expenses where id = v_existing.result_entity_id;
    return v_expense;
  end if;
  select * into v_expense from public.finance_expenses where id = p_finance_expense_id for update;
  if not found then raise exception 'expense_not_found' using errcode = 'P0002'; end if;
  if v_expense.status <> 'rejected' or v_expense.submitted_by_application_user_id <> v_actor then
    raise exception 'expense_not_editable' using errcode = '42501'; end if;
  select * into v_account from public.finance_accounts where id = p_finance_account_id for update;
  if not found then raise exception 'account_not_found' using errcode = 'P0002'; end if;
  if v_account.status <> 'active' then raise exception 'account_not_active' using errcode = '22023'; end if;
  insert into public.finance_expense_revisions (
    finance_expense_id,revision_number,finance_account_id,amount_paise,description,
    payee,business_date,missing_bill_reason,submitted_by_application_user_id,
    decided_by_application_user_id,decided_at,rejection_reason
  ) values (
    v_expense.id,v_expense.revision_number,v_expense.finance_account_id,v_expense.amount_paise,
    v_expense.description,v_expense.payee,v_expense.business_date,v_expense.missing_bill_reason,
    v_expense.submitted_by_application_user_id,v_expense.decided_by_application_user_id,
    v_expense.decided_at,v_expense.rejection_reason
  ) returning * into v_revision;
  update public.finance_expenses set
    revision_number = revision_number + 1,finance_account_id = p_finance_account_id,
    amount_paise = p_amount_paise,description = v_description,payee = v_payee,
    business_date = p_business_date,missing_bill_reason = v_missing_reason,
    status = 'submitted',decided_by_application_user_id = null,decided_at = null,
    rejection_reason = null
  where id = v_expense.id returning * into v_expense;
  insert into public.finance_audit_events
    (actor_application_user_id,event_type,entity_type,entity_id,operation_id,details)
  values (v_actor,'expense_resubmitted','finance_expense',v_expense.id,v_operation_id,
    jsonb_build_object('previous_revision_id',v_revision.id,
      'revision_number',v_expense.revision_number,
      'new_amount_paise',v_expense.amount_paise));
  insert into public.finance_operation_idempotency values
    (v_operation_id,'expense_resubmit',v_actor,v_fingerprint,'finance_expense',v_expense.id,now());

  -- The immutable revision is the notification event identity, so subsequent
  -- rejected revisions can alert approvers without the existing dedupe index
  -- suppressing them. The metadata points at the current expense record.
  insert into public.notifications (
    recipient_application_user_id,actor_application_user_id,kind,title,body,
    target_path,source_type,source_entity_id,metadata
  )
  select distinct au.id,v_actor,'expense_awaiting_approval',
    'Revised expense awaiting approval','A revised expense needs review.',
    '/finance/expenses','finance_expense',v_revision.id,
    jsonb_build_object('finance_expense_id',v_expense.id,'revision_number',v_expense.revision_number)
  from public.application_users au
  join public.application_user_roles aur on aur.application_user_id = au.id
  join public.role_permissions rp on rp.role_id = aur.role_id
  join public.permissions p on p.id = rp.permission_id and p.key = 'finance.expenses.approve'
  where au.status = 'active' and au.id <> v_actor
    and exists (select 1 from public.role_permissions nrp
      join public.permissions np on np.id = nrp.permission_id
      where nrp.role_id = aur.role_id and np.key = 'notifications.own.read')
  on conflict (recipient_application_user_id,source_entity_id,kind)
    where source_type in ('finance_expense','finance_transfer','finance_adjustment',
      'donation_payment','referral') do nothing;
  return v_expense;
end;
$$;

-- Approval accepts only evidence attached to the current revision.
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
  if v_decision = 'approve' and v_expense.missing_bill_reason is null and not exists (
    select 1 from public.finance_expense_bills b where b.finance_expense_id = v_expense.id
      and b.revision_number = v_expense.revision_number
  ) then
    raise exception 'expense_bill_or_reason_required' using errcode = '22023'; end if;
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


revoke all on function public.resubmit_finance_expense(uuid,uuid,bigint,text,text,date,text,text)
  from public,anon,authenticated,service_role;
grant execute on function public.resubmit_finance_expense(uuid,uuid,bigint,text,text,date,text,text)
  to authenticated;
commit;
