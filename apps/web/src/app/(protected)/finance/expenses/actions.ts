"use server";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { parseExpenseAmount, parseExpenseFields } from "@/lib/finance/expense-input";
import { expenseRpc, getExpenseCapabilities } from "@/lib/finance/expenses-server";

const uuid = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const go = (code: string): never => redirect(`/finance/expenses?${code}`);
function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
async function run(permission: "canCreate" | "canApprove" | "canPay", name: string, params: Record<string, unknown>) {
  const capabilities = await getExpenseCapabilities();
  if (!capabilities[permission]) go("error=forbidden");
  try { await expenseRpc(name, { ...params, p_operation_id: randomUUID() }); }
  catch { go("error=failed"); }
  revalidatePath("/finance/expenses");
  revalidatePath("/dashboard");
  go("updated=1");
}

export async function submitExpenseAction(form: FormData) {
  const fields = parseExpenseFields(form);
  if (!fields) return go("error=invalid");
  await run("canCreate", "submit_finance_expense_with_evidence", {
    p_finance_account_id: fields.financeAccountId, p_amount_paise: fields.amountPaise,
    p_description: fields.description, p_payee: fields.payee,
    p_business_date: fields.businessDate, p_missing_bill_reason: fields.missingBillReason,
  });
}

export async function resubmitExpenseAction(form: FormData) {
  const fields = parseExpenseFields(form);
  const id = String(form.get("expenseId") ?? "");
  if (!fields || !uuid.test(id)) return go("error=invalid");
  await run("canCreate", "resubmit_finance_expense", {
    p_finance_expense_id: id, p_finance_account_id: fields.financeAccountId,
    p_amount_paise: fields.amountPaise, p_description: fields.description,
    p_payee: fields.payee, p_business_date: fields.businessDate,
    p_missing_bill_reason: fields.missingBillReason,
  });
}

export async function decideExpenseAction(form: FormData) {
  const id = String(form.get("expenseId") ?? "");
  const decision = String(form.get("decision") ?? "");
  const reason = String(form.get("reason") ?? "").trim() || null;
  if (!uuid.test(id) || !["approve", "reject"].includes(decision) ||
    (decision === "reject" && !reason) || (reason !== null && reason.length > 2000)) go("error=invalid");
  await run("canApprove", "decide_finance_expense", {
    p_finance_expense_id: id, p_decision: decision, p_reason: reason,
  });
}

export async function payExpenseAction(form: FormData) {
  const id = String(form.get("expenseId") ?? "");
  const amount = parseExpenseAmount(String(form.get("amount") ?? ""));
  const date = String(form.get("businessDate") ?? "");
  if (!uuid.test(id) || amount === null || !validDate(date)) go("error=invalid");
  await run("canPay", "pay_finance_expense", {
    p_finance_expense_id: id, p_amount_paise: amount, p_business_date: date,
  });
}

export async function closeExpenseAction(form: FormData) {
  const id = String(form.get("expenseId") ?? "");
  const reason = String(form.get("reason") ?? "").trim();
  if (!uuid.test(id) || reason.length < 10 || reason.length > 1000) go("error=invalid");
  await run("canPay", "close_finance_expense", { p_finance_expense_id: id, p_reason: reason });
}

export async function explainMissingBillAction(form: FormData) {
  const id = String(form.get("expenseId") ?? "");
  const reason = String(form.get("reason") ?? "").trim();
  if (!uuid.test(id) || reason.length < 10 || reason.length > 1000) return go("error=invalid");
  const capabilities = await getExpenseCapabilities();
  if (!capabilities.canCreate) return go("error=forbidden");
  try {
    await expenseRpc("set_finance_expense_missing_bill_reason", {
      p_finance_expense_id: id, p_reason: reason,
    });
  } catch { return go("error=failed"); }
  revalidatePath("/finance/expenses");
  go("updated=1");
}
