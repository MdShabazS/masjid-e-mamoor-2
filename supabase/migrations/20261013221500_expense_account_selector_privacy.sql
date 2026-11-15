begin;

-- Expense submitters need to name the account they expect to pay from, but
-- committee members do not gain access to balances or the account ledger.
delete from public.role_permissions rp using public.roles r, public.permissions p
where rp.role_id = r.id and rp.permission_id = p.id
  and r.key = 'committee_member' and p.key = 'finance.accounts.read';

drop policy finance_expenses_authorized_read on public.finance_expenses;
create policy finance_expenses_authorized_read on public.finance_expenses for select to authenticated
using (
  public.has_application_permission('finance.transactions.read')
  or public.has_application_permission('finance.expenses.approve')
  or public.has_application_permission('finance.expenses.pay')
  or (public.has_application_permission('finance.expenses.create')
      and submitted_by_application_user_id = public.current_application_user_id())
);

create or replace function public.list_expense_payment_accounts()
returns table(id uuid, name text, account_type text)
language plpgsql stable security definer set search_path = pg_catalog, extensions
as $$
begin
  if public.current_application_user_id() is null
     or not public.has_application_permission('finance.expenses.create') then
    raise exception 'not_authorized' using errcode = '42501'; end if;
  return query select a.id,a.name,a.account_type from public.finance_accounts a
    where a.status = 'active' order by a.name,a.id;
end;
$$;
revoke all on function public.list_expense_payment_accounts()
  from public,anon,authenticated,service_role;
grant execute on function public.list_expense_payment_accounts() to authenticated;

commit;
