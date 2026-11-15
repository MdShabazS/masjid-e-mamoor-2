-- Create durable notifications from authoritative approval-state transitions.
-- Recipient discovery follows existing permissions; payloads contain no financial details.

begin;

alter table public.notifications drop constraint notifications_kind_chk;
alter table public.notifications add constraint notifications_kind_chk check (
  kind in (
    'task_assigned', 'task_unassigned', 'task_updated', 'task_progress',
    'task_started', 'task_completed', 'task_declined', 'meeting_created',
    'meeting_updated', 'meeting_cancelled', 'announcement',
    'attendance_sync_rejected', 'expense_awaiting_approval',
    'expense_approved', 'expense_rejected', 'transfer_awaiting_approval',
    'transfer_approved', 'transfer_rejected', 'adjustment_awaiting_approval',
    'correction_applied', 'reversal_applied', 'adjustment_rejected',
    'payment_submitted', 'payment_verified', 'payment_rejected',
    'referral_awaiting_review', 'referral_approved', 'referral_rejected',
    'referral_completed'
  )
);

create unique index notifications_approval_event_recipient_uidx
  on public.notifications(recipient_application_user_id, source_entity_id, kind)
  where source_type in (
    'finance_expense', 'finance_transfer', 'finance_adjustment',
    'donation_payment', 'referral'
  );

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
    elsif tg_op = 'UPDATE' and old.status = 'submitted' and new.status in ('posted', 'rejected') then
      v_direct_recipient := v_submitter_id;
      v_actor_id := new.decided_by_application_user_id;
      v_kind := case new.status when 'posted' then 'expense_approved' else 'expense_rejected' end;
      v_title := case new.status when 'posted' then 'Expense approved' else 'Expense not approved' end;
      v_body := case new.status when 'posted' then 'Your submitted expense was approved.' else 'Your submitted expense was rejected.' end;
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

revoke all on function public.notify_approval_workflow_event()
  from public, anon, authenticated, service_role;

drop trigger if exists finance_expenses_notify_approvers on public.finance_expenses;
drop function if exists public.notify_finance_expense_awaiting_approval();

create trigger finance_expenses_approval_notifications
after insert or update of status on public.finance_expenses
for each row execute function public.notify_approval_workflow_event();
create trigger finance_transfers_approval_notifications
after insert or update of status on public.finance_transfers
for each row execute function public.notify_approval_workflow_event();
create trigger finance_adjustments_approval_notifications
after insert or update of status on public.finance_adjustments
for each row execute function public.notify_approval_workflow_event();
create trigger donation_payments_approval_notifications
after insert or update of status on public.donation_payments
for each row execute function public.notify_approval_workflow_event();
create trigger referrals_approval_notifications
after update of status on public.referrals
for each row execute function public.notify_approval_workflow_event();

commit;
