import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export const getExpenseCapabilities = cache(async () => {
  const supabase = await createClient();
  const keys = ["finance.expenses.create", "finance.expenses.approve", "finance.expenses.pay"];
  const results = await Promise.all(keys.map((requested_permission) =>
    supabase.rpc("has_application_permission", { requested_permission })));
  if (results.some((result) => result.error)) throw new Error("Expense permissions unavailable");
  return { canCreate: results[0].data === true, canApprove: results[1].data === true, canPay: results[2].data === true };
});

export async function getExpensePageData(canCreate: boolean) {
  const supabase = await createClient();
  const [expenses, accounts] = await Promise.all([
    supabase.from("finance_expenses").select("id, finance_account_id, amount_paise, paid_amount_paise, missing_bill_reason, close_reason, revision_number, description, payee, business_date, status, submitted_by_application_user_id, rejection_reason, created_at").order("created_at", { ascending: false }).limit(100),
    canCreate ? supabase.rpc("list_expense_payment_accounts") : Promise.resolve({ data: [], error: null }),
  ]);
  if (expenses.error || accounts.error) throw new Error("Expense records unavailable");
  const ids = (expenses.data ?? []).map((expense) => expense.id);
  const [bills, revisions] = ids.length ? await Promise.all([
    supabase.from("finance_expense_bills").select("id, finance_expense_id, revision_number, storage_object_path").in("finance_expense_id", ids).order("created_at", { ascending: false }),
    supabase.from("finance_expense_revisions").select("id, finance_expense_id, revision_number, rejection_reason, decided_at").in("finance_expense_id", ids).order("archived_at", { ascending: false }),
  ]) : [{ data: [], error: null }, { data: [], error: null }];
  if (bills.error || revisions.error) throw new Error("Expense records unavailable");
  const { data: actor, error: actorError } = await supabase.rpc("current_application_user_id");
  if (actorError || !actor) throw new Error("Expense actor unavailable");
  return { expenses: expenses.data ?? [], bills: bills.data ?? [], revisions: revisions.data ?? [], accounts: accounts.data ?? [], actorId: String(actor) };
}

export async function expenseRpc(name: string, params: Record<string, unknown>) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(name, params);
  if (error) throw error;
  return data;
}
