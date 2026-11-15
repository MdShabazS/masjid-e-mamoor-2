export function parseExpenseAmount(raw: string): number | null {
  const value = raw.trim();
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(value)) return null;
  const [rupees, fraction = ""] = value.split(".");
  const paise = Number(rupees) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(paise) && paise > 0 ? paise : null;
}

export function parseExpenseFields(form: FormData) {
  const financeAccountId = String(form.get("financeAccountId") ?? "").trim();
  const amountPaise = parseExpenseAmount(String(form.get("amount") ?? ""));
  const description = String(form.get("description") ?? "").trim();
  const payee = String(form.get("payee") ?? "").trim() || null;
  const businessDate = String(form.get("businessDate") ?? "").trim();
  const missingBillReason = String(form.get("missingBillReason") ?? "").trim() || null;
  if (!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(financeAccountId) ||
    amountPaise === null || description.length < 1 || description.length > 2000 ||
    (payee !== null && payee.length > 200) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(businessDate) ||
    (Number.isNaN(Date.parse(`${businessDate}T00:00:00Z`)) ||
      new Date(`${businessDate}T00:00:00Z`).toISOString().slice(0, 10) !== businessDate) ||
    (missingBillReason !== null && (missingBillReason.length < 10 || missingBillReason.length > 1000))) {
    return null;
  }
  return { financeAccountId, amountPaise, description, payee, businessDate, missingBillReason };
}
