import Link from "next/link";
import { redirect } from "next/navigation";
import { getExpenseCapabilities, getExpensePageData } from "@/lib/finance/expenses-server";
import { submitExpenseAction, resubmitExpenseAction, decideExpenseAction, payExpenseAction, closeExpenseAction, explainMissingBillAction } from "./actions";
import { ExpenseBillControl } from "./ExpenseBillControl";

type Props = { searchParams: Promise<{ error?: string; updated?: string }> };
const money = (paise: number) => `₹${(paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default async function ExpensesPage({ searchParams }: Props) {
  const [capabilities, params] = await Promise.all([getExpenseCapabilities(), searchParams]);
  if (!capabilities.canCreate && !capabilities.canApprove && !capabilities.canPay) redirect("/dashboard");
  const { expenses, bills, revisions, accounts, actorId } = await getExpensePageData(capabilities.canCreate);
  const today = new Date().toISOString().slice(0, 10);
  return <main className="min-h-screen px-5 py-8 sm:px-8"><div className="mx-auto max-w-5xl">
    <header className="border-b border-emerald-950/10 pb-8">
      <Link href="/dashboard" className="text-sm font-medium text-emerald-800">← Dashboard</Link>
      <p className="eyebrow mt-6">Finance</p><h1 className="page-title">Expenses</h1>
      <p className="page-intro">Submit expenses with a bill or an explanation. President or Vice President approval precedes Treasurer payment. Only payments affect the ledger.</p>
    </header>
    {params.error && <p role="alert" className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{params.error === "invalid" ? "Check the entered amount, date and required details." : params.error === "forbidden" ? "You do not have permission for this action." : "The action could not be completed. Check its status and evidence, then try again."}</p>}
    {params.updated && <p role="status" className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">Expense updated.</p>}
    {capabilities.canCreate && <section className="surface mt-8 p-6"><h2 className="section-title">Submit an expense</h2>
      <p className="mt-2 text-sm text-zinc-600">After submission, attach a bill below. If no bill is available, explain why before approval.</p>
      <ExpenseFields action={submitExpenseAction} accounts={accounts} date={today} button="Submit expense" />
    </section>}
    <section className="mt-8"><h2 className="section-title">Expense requests</h2>
      <div className="mt-5 grid gap-4">{expenses.map((expense) => {
        const remaining = Number(expense.amount_paise) - Number(expense.paid_amount_paise);
        const own = expense.submitted_by_application_user_id === actorId;
        const currentBills = bills.filter((bill) => bill.finance_expense_id === expense.id && bill.revision_number === expense.revision_number);
        const history = revisions.filter((revision) => revision.finance_expense_id === expense.id);
        return <article className="surface p-5 sm:p-6" key={expense.id}>
          <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-lg font-semibold text-emerald-950">{expense.description}</h3><p className="mt-1 text-sm text-zinc-600">{expense.payee || "No payee"} · {expense.business_date} · Revision {expense.revision_number}</p></div><span className="status-badge">{String(expense.status).replaceAll("_", " ")}</span></div>
          <div className="mt-4 grid gap-2 text-sm sm:grid-cols-3"><p>Requested <strong>{money(Number(expense.amount_paise))}</strong></p><p>Paid <strong>{money(Number(expense.paid_amount_paise))}</strong></p><p>Remaining <strong>{money(remaining)}</strong></p></div>
          {expense.rejection_reason && <p className="mt-3 text-sm text-red-800">Rejection: {expense.rejection_reason}</p>}
          {expense.close_reason && <p className="mt-3 text-sm text-zinc-600">Closed: {expense.close_reason}</p>}
          <p className="mt-3 text-sm text-zinc-600">Evidence: {currentBills.length} bill{currentBills.length === 1 ? "" : "s"}{expense.missing_bill_reason ? ` · No bill: ${expense.missing_bill_reason}` : ""}</p>
          {currentBills.length > 0 && <ul className="mt-2 flex flex-wrap gap-3 text-sm">{currentBills.map((bill) => <li key={bill.id}><ExpenseBillControl expenseId={expense.id} billId={bill.id} label={`View bill ${bill.id.slice(0, 8)}`} /></li>)}</ul>}
          {own && capabilities.canCreate && expense.status === "submitted" && <ExpenseBillControl expenseId={expense.id} upload />}
          {own && capabilities.canCreate && expense.status === "submitted" && !currentBills.length && !expense.missing_bill_reason && <form action={explainMissingBillAction} className="mt-3 flex flex-wrap items-end gap-2"><input type="hidden" name="expenseId" value={expense.id} /><label className="field-label flex-1">Why no bill is available<input name="reason" required minLength={10} maxLength={1000} className="field-input" /></label><button className="button-secondary">Save explanation</button></form>}
          {history.length > 0 && <details className="mt-4 text-sm"><summary className="cursor-pointer font-medium">Previous rejected revisions ({history.length})</summary><ul className="mt-2 space-y-1">{history.map((revision) => <li key={revision.id}>Revision {revision.revision_number}, rejected {new Date(revision.decided_at).toLocaleDateString("en-IN")}: {revision.rejection_reason}</li>)}</ul></details>}
          {own && capabilities.canCreate && expense.status === "rejected" && <details className="mt-5 border-t pt-4"><summary className="cursor-pointer font-medium text-emerald-900">Edit and resubmit</summary><ExpenseFields action={resubmitExpenseAction} accounts={accounts} date={expense.business_date} expense={expense} button="Resubmit for approval" /></details>}
          {capabilities.canApprove && expense.status === "submitted" && <div className="mt-5 grid gap-3 border-t pt-4 sm:grid-cols-2"><form action={decideExpenseAction}><input type="hidden" name="expenseId" value={expense.id} /><input type="hidden" name="decision" value="approve" /><button className="button-primary" disabled={!currentBills.length && !expense.missing_bill_reason}>Approve</button>{!currentBills.length && !expense.missing_bill_reason && <p className="mt-1 text-xs text-amber-800">Bill or missing bill explanation required.</p>}</form><form action={decideExpenseAction} className="flex flex-wrap items-end gap-2"><input type="hidden" name="expenseId" value={expense.id} /><input type="hidden" name="decision" value="reject" /><label className="field-label flex-1">Rejection reason<input name="reason" required maxLength={2000} className="field-input" /></label><button className="button-secondary">Reject</button></form></div>}
          {capabilities.canPay && (expense.status === "approved" || expense.status === "partially_paid") && <div className="mt-5 grid gap-3 border-t pt-4 sm:grid-cols-2"><form action={payExpenseAction} className="grid gap-3"><input type="hidden" name="expenseId" value={expense.id} /><label className="field-label">Payment amount (₹)<input name="amount" type="number" min="0.01" max={(remaining / 100).toFixed(2)} step="0.01" required className="field-input" /></label><label className="field-label">Payment date<input name="businessDate" type="date" defaultValue={today} required className="field-input" /></label><button className="button-primary">Record payment</button></form>{expense.status === "partially_paid" && <form action={closeExpenseAction} className="grid gap-3"><input type="hidden" name="expenseId" value={expense.id} /><label className="field-label">Reason for unused approval<input name="reason" minLength={10} maxLength={1000} required className="field-input" /></label><button className="button-secondary">Close unused balance</button></form>}</div>}
        </article>;
      })}{expenses.length === 0 && <p className="surface p-8 text-center text-sm text-zinc-600">No expense requests yet.</p>}</div>
    </section>
  </div></main>;
}

type Account = { id: string; name: string; account_type: string };
type Expense = { id: string; finance_account_id: string; amount_paise: number; description: string; payee: string | null; missing_bill_reason: string | null };
function ExpenseFields({ action, accounts, date, expense, button }: { action: (form: FormData) => Promise<void>; accounts: Account[]; date: string; expense?: Expense; button: string }) {
  return <form action={action} className="mt-5 grid gap-4 sm:grid-cols-2">{expense && <input type="hidden" name="expenseId" value={expense.id} />}
    <label className="field-label">Payment account<select name="financeAccountId" required defaultValue={expense?.finance_account_id ?? ""} className="field-input"><option value="">Select account</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name} ({account.account_type})</option>)}</select></label>
    <label className="field-label">Amount (₹)<input name="amount" type="number" min="0.01" step="0.01" required defaultValue={expense ? (Number(expense.amount_paise) / 100).toFixed(2) : undefined} className="field-input" /></label>
    <label className="field-label">Payee<input name="payee" maxLength={200} defaultValue={expense?.payee ?? ""} className="field-input" /></label>
    <label className="field-label">Expense date<input name="businessDate" type="date" required defaultValue={date} className="field-input" /></label>
    <label className="field-label sm:col-span-2">Description<textarea name="description" required maxLength={2000} defaultValue={expense?.description ?? ""} className="field-input" rows={3} /></label>
    <label className="field-label sm:col-span-2">If no bill is available, explain why (10–1000 characters)<textarea name="missingBillReason" minLength={10} maxLength={1000} defaultValue={expense?.missing_bill_reason ?? ""} className="field-input" rows={2} /></label>
    <div className="sm:col-span-2"><button className="button-primary" disabled={accounts.length === 0}>{button}</button></div>
  </form>;
}
