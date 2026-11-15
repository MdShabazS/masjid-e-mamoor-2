begin;

alter table public.finance_expenses
  add column missing_bill_reason text
  constraint finance_expenses_missing_bill_reason_chk
  check (missing_bill_reason is null or length(btrim(missing_bill_reason)) between 10 and 1000);

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('finance-expense-bills','finance-expense-bills',false,5242880,
  array['image/jpeg','image/png','application/pdf']::text[])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create table public.finance_expense_bills (
  id uuid primary key default gen_random_uuid(),
  finance_expense_id uuid not null references public.finance_expenses(id) on delete restrict,
  storage_bucket text not null default 'finance-expense-bills'
    check (storage_bucket = 'finance-expense-bills'),
  storage_object_path text not null unique,
  uploaded_by_application_user_id uuid not null references public.application_users(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint finance_expense_bill_path_chk check (
    storage_object_path ~ '^[0-9a-fA-F]{8}(-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}/[0-9a-fA-F]{8}(-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}\.(jpg|jpeg|png|pdf)$'
  )
);
create index finance_expense_bills_expense_idx on public.finance_expense_bills(finance_expense_id,created_at);
create trigger finance_expense_bills_immutable before update or delete on public.finance_expense_bills
for each row execute function public.reject_finance_immutable_change();
alter table public.finance_expense_bills enable row level security;

create or replace function public.can_upload_finance_expense_bill(p_object_name text)
returns boolean language plpgsql stable security definer set search_path = pg_catalog, extensions
as $$
declare v_actor uuid := public.current_application_user_id();
begin
  if v_actor is null or not public.has_application_permission('finance.expenses.create')
    or p_object_name is null or p_object_name !~
      '^[0-9a-fA-F]{8}(-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}/[0-9a-fA-F]{8}(-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}\.(jpg|jpeg|png|pdf)$' then
    return false;
  end if;
  return exists (select 1 from public.finance_expenses e
    where e.id = split_part(p_object_name,'/',1)::uuid
      and e.submitted_by_application_user_id = v_actor and e.status = 'submitted');
end;
$$;

create or replace function public.can_read_finance_expense_bill(p_object_name text)
returns boolean language plpgsql stable security definer set search_path = pg_catalog, extensions
as $$
declare v_actor uuid := public.current_application_user_id();
begin
  if v_actor is null or p_object_name is null or p_object_name !~
    '^[0-9a-fA-F]{8}(-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}/[0-9a-fA-F]{8}(-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}\.(jpg|jpeg|png|pdf)$' then
    return false;
  end if;
  return exists (select 1 from public.finance_expenses e
    join public.finance_expense_bills b on b.finance_expense_id = e.id
    where b.storage_object_path = p_object_name and
      (e.submitted_by_application_user_id = v_actor
       or public.has_application_permission('finance.expenses.approve')
       or public.has_application_permission('finance.expenses.pay')));
end;
$$;

create policy finance_expense_bill_storage_insert on storage.objects for insert to authenticated
with check (bucket_id = 'finance-expense-bills' and public.can_upload_finance_expense_bill(name));
create policy finance_expense_bill_storage_select on storage.objects for select to authenticated
using (bucket_id = 'finance-expense-bills' and public.can_read_finance_expense_bill(name));
create policy finance_expense_bill_metadata_read on public.finance_expense_bills for select to authenticated
using (exists (select 1 from public.finance_expenses e where e.id = finance_expense_id
  and (e.submitted_by_application_user_id = public.current_application_user_id()
    or public.has_application_permission('finance.expenses.approve')
    or public.has_application_permission('finance.expenses.pay'))));
revoke all on public.finance_expense_bills from public, anon, authenticated;
grant select on public.finance_expense_bills to authenticated;
grant all on public.finance_expense_bills to service_role;

create or replace function public.submit_finance_expense_with_evidence(
  p_finance_account_id uuid, p_amount_paise bigint, p_description text,
  p_payee text, p_business_date date, p_operation_id text, p_missing_bill_reason text
) returns public.finance_expenses
language plpgsql security definer set search_path = pg_catalog, extensions
as $$
declare
  v_expense public.finance_expenses;
  v_reason text := nullif(btrim(p_missing_bill_reason),'');
  v_replay boolean;
begin
  if v_reason is not null and length(v_reason) not between 10 and 1000 then
    raise exception 'invalid_missing_bill_reason' using errcode = '22023'; end if;
  if nullif(btrim(p_operation_id),'') is null then
    raise exception 'invalid_operation_id' using errcode = '22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended('finance-operation:' || btrim(p_operation_id),0));
  select exists (select 1 from public.finance_operation_idempotency
    where operation_id = btrim(p_operation_id)) into v_replay;
  v_expense := public.submit_finance_expense(p_finance_account_id,p_amount_paise,
    p_description,p_payee,p_business_date,p_operation_id);
  if v_expense.missing_bill_reason is distinct from v_reason then
    if v_replay or v_expense.status <> 'submitted' then
      raise exception 'operation_id_conflict' using errcode = '23505'; end if;
    update public.finance_expenses set missing_bill_reason = v_reason
    where id = v_expense.id returning * into v_expense;
  end if;
  return v_expense;
end;
$$;

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
  insert into public.finance_expense_bills(finance_expense_id,storage_object_path,uploaded_by_application_user_id)
  values (p_finance_expense_id,p_storage_object_path,v_actor) returning * into v_bill;
  insert into public.finance_audit_events
    (actor_application_user_id,event_type,entity_type,entity_id,operation_id,details)
  values (v_actor,'expense_bill_attached','finance_expense',p_finance_expense_id,
    'bill:' || v_bill.id::text,jsonb_build_object('bill_id',v_bill.id));
  return v_bill;
end;
$$;

alter table public.finance_audit_events drop constraint finance_audit_events_type_chk;
alter table public.finance_audit_events add constraint finance_audit_events_type_chk check (
  event_type in ('account_created','account_status_changed','account_renamed',
    'expense_submitted','expense_approved','expense_payment_recorded','expense_posted','expense_rejected',
    'expense_bill_attached','transfer_submitted','transfer_approved','transfer_rejected',
    'adjustment_submitted','correction_applied','reversal_applied','adjustment_rejected',
    'donation_payment_posted','reconciliation_started','reconciliation_item_recorded',
    'reconciliation_discrepancy_recorded','reconciliation_completed')
);

revoke all on function public.submit_finance_expense_with_evidence(uuid,bigint,text,text,date,text,text)
  from public,anon,authenticated,service_role;
grant execute on function public.submit_finance_expense_with_evidence(uuid,bigint,text,text,date,text,text)
  to authenticated;
revoke all on function public.register_finance_expense_bill(uuid,text)
  from public,anon,authenticated,service_role;
grant execute on function public.register_finance_expense_bill(uuid,text) to authenticated;
revoke all on function public.can_upload_finance_expense_bill(text), public.can_read_finance_expense_bill(text)
  from public,anon,authenticated,service_role;
grant execute on function public.can_upload_finance_expense_bill(text), public.can_read_finance_expense_bill(text)
  to authenticated;

-- Existing historical submitted requests may lack evidence. They cannot be
-- approved until a bill is registered or a valid missing-bill reason is supplied.

create or replace function public.set_finance_expense_missing_bill_reason(
  p_finance_expense_id uuid, p_reason text
) returns public.finance_expenses
language plpgsql security definer set search_path = pg_catalog, extensions
as $$
declare
  v_actor uuid := public.lock_active_finance_actor();
  v_reason text := nullif(btrim(p_reason),'');
  v_expense public.finance_expenses;
begin
  if v_reason is null or length(v_reason) not between 10 and 1000 then
    raise exception 'invalid_missing_bill_reason' using errcode = '22023'; end if;
  select * into v_expense from public.finance_expenses where id = p_finance_expense_id for update;
  if not found or v_expense.status <> 'submitted' or v_expense.submitted_by_application_user_id <> v_actor then
    raise exception 'expense_not_editable' using errcode = '42501'; end if;
  if v_expense.missing_bill_reason is not null then
    raise exception 'reason_already_recorded' using errcode = '22023'; end if;
  update public.finance_expenses set missing_bill_reason = v_reason
  where id = p_finance_expense_id returning * into v_expense;
  insert into public.finance_audit_events
    (actor_application_user_id,event_type,entity_type,entity_id,operation_id,details)
  values (v_actor,'expense_missing_bill_explained','finance_expense',v_expense.id,
    'reason:' || gen_random_uuid()::text,jsonb_build_object('missing_bill_reason',v_reason));
  return v_expense;
end;
$$;
alter table public.finance_audit_events drop constraint finance_audit_events_type_chk;
alter table public.finance_audit_events add constraint finance_audit_events_type_chk check (
  event_type in ('account_created','account_status_changed','account_renamed',
    'expense_submitted','expense_approved','expense_payment_recorded','expense_posted','expense_rejected',
    'expense_bill_attached','expense_missing_bill_explained',
    'transfer_submitted','transfer_approved','transfer_rejected','adjustment_submitted',
    'correction_applied','reversal_applied','adjustment_rejected',
    'donation_payment_posted','reconciliation_started','reconciliation_item_recorded',
    'reconciliation_discrepancy_recorded','reconciliation_completed')
);
revoke all on function public.set_finance_expense_missing_bill_reason(uuid,text)
  from public,anon,authenticated,service_role;
grant execute on function public.set_finance_expense_missing_bill_reason(uuid,text) to authenticated;

-- Require evidence at the decision boundary even from old API clients.
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

commit;
