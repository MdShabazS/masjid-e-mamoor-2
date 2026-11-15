type Row = Record<string, unknown>;

function object(value: unknown): Row {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("invalid_finance_snapshot");
  return value as Row;
}

function rows(value: unknown): Row[] {
  if (!Array.isArray(value) || value.length > 5000) throw new Error("invalid_finance_snapshot");
  return value.map(object);
}

function money(value: unknown): string {
  if (value === null || value === undefined) throw new Error("invalid_finance_amount");
  const raw = String(value);
  if (!/^-?\d{1,19}$/.test(raw)) throw new Error("invalid_finance_amount");
  const digits = raw.replace(/^-/, "").replace(/^0+(?=\d)/, "").padStart(3, "0");
  const sign = raw.startsWith("-") && !/^0+$/.test(digits) ? "-" : "";
  return `${sign}${digits.slice(0, -2)}.${digits.slice(-2)}`;
}

function safeText(value: unknown): string {
  const clean = String(value ?? "").replace(/[\r\n\t]+/g, " ").trim();
  return /^[=+\-@]/.test(clean) ? `'${clean}` : clean;
}

function csvCell(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

const columns = [
  "Record type", "Date", "Account", "Category", "Direction", "Donor / payee",
  "Purpose / description", "Payment method", "Receipt number", "Receipt status",
  "Amount (INR)", "Opening balance (INR)", "Closing balance (INR)",
  "Entry ID", "Reference type", "Reference ID", "Related entry ID", "Void reason",
] as const;

function line(values: unknown[]): string {
  return values.map((value) => csvCell(safeText(value))).join(",");
}

function amountLine(values: unknown[], amount: unknown, opening: unknown = "", closing: unknown = "",
  suffix: unknown[] = []) {
  const fields = [...values, amount === "" ? "" : money(amount), opening === "" ? "" : money(opening),
    closing === "" ? "" : money(closing), ...suffix, ...Array(5 - suffix.length).fill("")];
  return fields.map((field, index) => index >= 10 && index <= 12
    ? csvCell(String(field)) : csvCell(safeText(field))).join(",");
}

/** One spreadsheet-compatible export of the same bounded posted-ledger snapshot as the PDF. */
export function financeDateRangeCsv(snapshotValue: unknown): string {
  const snapshot = object(snapshotValue);
  const start = String(snapshot.period_start ?? "");
  const end = String(snapshot.period_end ?? "");
  if (snapshot.schema_version !== 1 || snapshot.masjid_name !== "Masjid E Mamoor 2"
    || snapshot.currency !== "INR" || !/^\d{4}-\d{2}-\d{2}$/.test(start)
    || !/^\d{4}-\d{2}-\d{2}$/.test(end) || start > end) {
    throw new Error("invalid_finance_snapshot");
  }
  const summary = object(snapshot.summary);
  const breakdown = object(snapshot.donation_breakdown);
  const accounts = rows(snapshot.accounts);
  const ledger = rows(snapshot.ledger);
  if (String(summary.transaction_count) !== String(ledger.length)) throw new Error("invalid_finance_snapshot");
  const output = [line([...columns])];
  const row = (fields: unknown[]) => output.push(line([...fields, ...Array(columns.length - fields.length).fill("")]));
  row(["REPORT", start, "Masjid E Mamoor 2", `Through ${end}`]);
  row(["NOTE", "", "", "On-demand posted ledger at download time; monthly PDF revisions are separate. Filter Record type to LEDGER before summing entries."]);
  const summaryAmounts: [string, unknown][] = [
    ["Donation inflow", summary.donation_inflow_paise],
    ["Expense outflow", summary.expense_outflow_paise],
    ["Adjustments net", summary.adjustments_net_paise],
    ["Transfer in", summary.transfer_in_paise],
    ["Transfer out", summary.transfer_out_paise],
  ];
  for (const [label, amount] of summaryAmounts) {
    output.push(amountLine(["SUMMARY", "", "", label, "", "", "", "", "", ""], amount));
  }
  output.push(amountLine(["SUMMARY", start, "", "Opening balance", "", "", "", "", "", ""],
    "", summary.opening_balance_paise));
  output.push(amountLine(["SUMMARY", end, "", "Closing balance", "", "", "", "", "", ""],
    "", "", summary.closing_balance_paise));
  for (const [label, value] of [
    ["Recurring", breakdown.recurring_paise], ["Additional", breakdown.additional_paise],
    ["Anonymous", breakdown.anonymous_paise], ["Jummah cash", breakdown.jummah_paise],
  ] as [string, unknown][]) {
    output.push(amountLine(["DONATION CATEGORY", "", "", label, "", "", "", "", "", ""], value));
  }
  for (const account of accounts) {
    output.push(amountLine(["ACCOUNT", end, account.name, account.account_type, "", "", "", "", "", account.status],
      "", account.opening_balance_paise, account.closing_balance_paise));
  }
  for (const entry of ledger) {
    const fields: unknown[] = [
      "LEDGER", entry.business_date, entry.account_name, entry.transaction_category,
      entry.direction, entry.donor_name ?? entry.expense_payee,
      entry.donation_purpose ?? entry.expense_description, entry.donation_payment_method,
      entry.receipt_number, entry.donation_status ?? "posted",
    ];
    const suffix = [entry.id, entry.reference_type, entry.reference_id,
      entry.related_transaction_id, entry.void_reason];
    output.push(amountLine(fields, entry.amount_paise, "", "", suffix));
  }
  return `\uFEFF${output.join("\r\n")}\r\n`;
}
