import { randomUUID } from "expo-crypto";
import type {
  FinanceAccount,
  FinanceAccountSnapshot,
} from "@masjid-e-mamoor/types";
import {
  financeAccountCreateSchema,
  financeAccountRenameSchema,
  financeAccountStatusChangeSchema,
} from "@masjid-e-mamoor/validation";

import { isValidIsoDate } from "../lib/date-input";
import { supabase } from "../lib/supabase";
import { parseRupeesToPaise } from "./donation-presentation";

type DbRow = Record<string, unknown>;

function mapFinanceAccount(row: DbRow): FinanceAccount {
  return {
    id: String(row.id),
    name: String(row.name),
    accountType:
      row.account_type as FinanceAccount["accountType"],
    status: row.status as FinanceAccount["status"],
    currency: String(row.currency),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function unwrapFinanceAccount(data: unknown): FinanceAccount {
  const row = Array.isArray(data) ? data[0] : data;

  if (!row || typeof row !== "object") {
    throw new Error("finance_account_result_missing");
  }

  return mapFinanceAccount(row as DbRow);
}

export function financeAccountsQueryKey(
  applicationUserId?: string,
) {
  return [
    "finance",
    "accounts",
    applicationUserId ?? "anonymous",
  ] as const;
}

export async function listActiveFinanceAccounts(): Promise<
  FinanceAccount[]
> {
  const { data, error } = await supabase
    .from("finance_accounts")
    .select(
      "id, name, account_type, status, currency, created_at, updated_at",
    )
    .eq("status", "active")
    .order("name", { ascending: true })
    .order("id", { ascending: true });

  if (error) {
    throw new Error("finance_accounts_unavailable");
  }

  return (data ?? []).map((row) =>
    mapFinanceAccount(row as DbRow),
  );
}

export async function listFinanceAccounts(): Promise<
  FinanceAccountSnapshot[]
> {
  const [accountsResult, balancesResult] =
    await Promise.all([
      supabase
        .from("finance_accounts")
        .select(
          "id, name, account_type, status, currency, created_at, updated_at",
        )
        .order("name", { ascending: true })
        .order("id", { ascending: true }),
      supabase
        .from("finance_account_balances")
        .select(
          "finance_account_id, currency, balance_paise",
        ),
    ]);

  if (accountsResult.error || balancesResult.error) {
    throw new Error("finance_accounts_unavailable");
  }

  const balances = new Map<string, number>();

  for (const row of balancesResult.data ?? []) {
    balances.set(
      String(row.finance_account_id),
      Number(row.balance_paise),
    );
  }

  return (accountsResult.data ?? []).map((row) => {
    const account = mapFinanceAccount(row as DbRow);

    return {
      ...account,
      balancePaise: balances.get(account.id) ?? 0,
    };
  });
}

export async function createFinanceAccount(input: {
  name: string;
  accountType: FinanceAccount["accountType"];
}) {
  const parsed = financeAccountCreateSchema.parse({
    ...input,
    operationId: randomUUID(),
  });

  const { data, error } = await supabase.rpc(
    "create_finance_account",
    {
      p_name: parsed.name,
      p_account_type: parsed.accountType,
      p_operation_id: parsed.operationId,
    },
  );

  if (error) {
    throw new Error("finance_account_create_failed");
  }

  return unwrapFinanceAccount(data);
}

export async function changeFinanceAccountStatus(input: {
  financeAccountId: string;
  status: FinanceAccount["status"];
}) {
  const parsed = financeAccountStatusChangeSchema.parse({
    ...input,
    operationId: randomUUID(),
  });

  const { data, error } = await supabase.rpc(
    "set_finance_account_status",
    {
      p_finance_account_id: parsed.financeAccountId,
      p_status: parsed.status,
      p_operation_id: parsed.operationId,
    },
  );

  if (error) {
    throw new Error("finance_account_status_failed");
  }

  return unwrapFinanceAccount(data);
}

export async function renameFinanceAccount(input: {
  financeAccountId: string;
  name: string;
}) {
  const parsed = financeAccountRenameSchema.parse({
    ...input,
    operationId: randomUUID(),
  });

  const { data, error } = await supabase.rpc(
    "rename_finance_account",
    {
      p_finance_account_id: parsed.financeAccountId,
      p_name: parsed.name,
      p_operation_id: parsed.operationId,
    },
  );

  if (error) {
    throw new Error("finance_account_rename_failed");
  }

  return unwrapFinanceAccount(data);
}

export function formatFinanceMoney(amountPaise: number) {
  const sign = amountPaise < 0 ? "-" : "";
  const absolute = Math.abs(amountPaise);
  const rupees = Math.floor(absolute / 100);
  const paise = absolute % 100;

  return `${sign}₹${rupees.toLocaleString("en-IN")}.${String(
    paise,
  ).padStart(2, "0")}`;
}

export function financeAccountTypeLabel(
  type: FinanceAccount["accountType"],
) {
  return {
    bank: "Bank",
    upi: "UPI",
    cash: "Cash",
    other: "Other",
  }[type];
}

export function financeAccountStatusLabel(
  status: FinanceAccount["status"],
) {
  return {
    active: "Active",
    inactive: "Inactive",
    closed: "Closed",
  }[status];
}



export type FinanceTransactionCategory =
  | "DONATION_RECURRING"
  | "DONATION_ADDITIONAL"
  | "DONATION_ANONYMOUS"
  | "DONATION_JUMMAH"
  | "EXPENSE"
  | "TRANSFER_IN"
  | "TRANSFER_OUT"
  | "CORRECTION"
  | "REVERSAL";

export type FinanceTransactionDirection =
  | "inflow"
  | "outflow";

export interface FinanceTransaction {
  id: string;
  financeAccountId: string;
  transactionCategory: FinanceTransactionCategory;
  direction: FinanceTransactionDirection;
  amountPaise: number;
  currency: string;
  businessDate: string;
  referenceType: string;
  referenceId: string;
  relatedTransactionId: string | null;
  operationId: string;
  createdByApplicationUserId: string;
  createdAt: string;
}

function mapFinanceTransaction(
  row: DbRow,
): FinanceTransaction {
  return {
    id: String(row.id),
    financeAccountId: String(
      row.finance_account_id,
    ),
    transactionCategory:
      row.transaction_category as FinanceTransactionCategory,
    direction:
      row.direction as FinanceTransactionDirection,
    amountPaise: Number(row.amount_paise),
    currency: String(row.currency),
    businessDate: String(row.business_date),
    referenceType: String(row.reference_type),
    referenceId: String(row.reference_id),
    relatedTransactionId:
      row.related_transaction_id === null ||
      row.related_transaction_id === undefined
        ? null
        : String(row.related_transaction_id),
    operationId: String(row.operation_id),
    createdByApplicationUserId: String(
      row.created_by_application_user_id,
    ),
    createdAt: String(row.created_at),
  };
}

export function financeTransactionsQueryKey(
  applicationUserId?: string,
) {
  return [
    "finance",
    "transactions",
    applicationUserId ?? "anonymous",
  ] as const;
}

export async function listFinanceTransactions(): Promise<
  FinanceTransaction[]
> {
  const { data, error } = await supabase
    .from("financial_transactions")
    .select(
      [
        "id",
        "finance_account_id",
        "transaction_category",
        "direction",
        "amount_paise",
        "currency",
        "business_date",
        "reference_type",
        "reference_id",
        "related_transaction_id",
        "operation_id",
        "created_by_application_user_id",
        "created_at",
      ].join(", "),
    )
    .order("business_date", {
      ascending: false,
    })
    .order("created_at", {
      ascending: false,
    })
    .order("id", {
      ascending: false,
    });

  if (error) {
    throw new Error(
      "finance_transactions_unavailable",
    );
  }

  return (data ?? []).map((row) =>
    mapFinanceTransaction(
      row as unknown as DbRow,
    ),
  );
}

export function financeTransactionCategoryLabel(
  category: FinanceTransactionCategory,
) {
  return {
    DONATION_RECURRING: "Recurring donation",
    DONATION_ADDITIONAL: "Additional donation",
    DONATION_ANONYMOUS: "Anonymous donation",
    DONATION_JUMMAH: "Jummah donation",
    EXPENSE: "Expense",
    TRANSFER_IN: "Transfer in",
    TRANSFER_OUT: "Transfer out",
    CORRECTION: "Correction",
    REVERSAL: "Reversal",
  }[category];
}

export function financeTransactionDirectionLabel(
  direction: FinanceTransactionDirection,
) {
  return direction === "inflow"
    ? "Inflow"
    : "Outflow";
}

export function signedFinanceTransactionAmount(
  transaction: Pick<
    FinanceTransaction,
    "direction" | "amountPaise"
  >,
) {
  return transaction.direction === "inflow"
    ? transaction.amountPaise
    : -transaction.amountPaise;
}

export type FinanceTransferStatus =
  | "submitted"
  | "approved"
  | "rejected";

export interface FinanceTransfer {
  id: string;
  sourceFinanceAccountId: string;
  destinationFinanceAccountId: string;
  amountPaise: number;
  currency: string;
  reason: string;
  businessDate: string;
  status: FinanceTransferStatus;
  submittedByApplicationUserId: string;
  decidedByApplicationUserId: string | null;
  decidedAt: string | null;
  rejectionReason: string | null;
  sourceTransactionId: string | null;
  destinationTransactionId: string | null;
  createdAt: string;
  updatedAt: string;
}

function mapFinanceTransfer(
  row: DbRow,
): FinanceTransfer {
  return {
    id: String(row.id),
    sourceFinanceAccountId: String(
      row.source_finance_account_id,
    ),
    destinationFinanceAccountId: String(
      row.destination_finance_account_id,
    ),
    amountPaise: Number(row.amount_paise),
    currency: String(row.currency),
    reason: String(row.reason),
    businessDate: String(row.business_date),
    status: row.status as FinanceTransferStatus,
    submittedByApplicationUserId: String(
      row.submitted_by_application_user_id,
    ),
    decidedByApplicationUserId:
      row.decided_by_application_user_id === null ||
      row.decided_by_application_user_id === undefined
        ? null
        : String(
            row.decided_by_application_user_id,
          ),
    decidedAt:
      row.decided_at === null ||
      row.decided_at === undefined
        ? null
        : String(row.decided_at),
    rejectionReason:
      row.rejection_reason === null ||
      row.rejection_reason === undefined
        ? null
        : String(row.rejection_reason),
    sourceTransactionId:
      row.source_transaction_id === null ||
      row.source_transaction_id === undefined
        ? null
        : String(row.source_transaction_id),
    destinationTransactionId:
      row.destination_transaction_id === null ||
      row.destination_transaction_id === undefined
        ? null
        : String(row.destination_transaction_id),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function unwrapFinanceTransfer(
  data: unknown,
): FinanceTransfer {
  const row = Array.isArray(data) ? data[0] : data;

  if (!row || typeof row !== "object") {
    throw new Error(
      "finance_transfer_result_missing",
    );
  }

  return mapFinanceTransfer(row as DbRow);
}

export function financeTransfersQueryKey(
  applicationUserId?: string,
) {
  return [
    "finance",
    "transfers",
    applicationUserId ?? "anonymous",
  ] as const;
}

export async function listFinanceTransfers(): Promise<
  FinanceTransfer[]
> {
  const { data, error } = await supabase
    .from("finance_transfers")
    .select(
      [
        "id",
        "source_finance_account_id",
        "destination_finance_account_id",
        "amount_paise",
        "currency",
        "reason",
        "business_date",
        "status",
        "submitted_by_application_user_id",
        "decided_by_application_user_id",
        "decided_at",
        "rejection_reason",
        "source_transaction_id",
        "destination_transaction_id",
        "created_at",
        "updated_at",
      ].join(", "),
    )
    .order("created_at", {
      ascending: false,
    })
    .order("id", {
      ascending: false,
    });

  if (error) {
    throw new Error(
      "finance_transfers_unavailable",
    );
  }

  return (data ?? []).map((row) =>
    mapFinanceTransfer(
      row as unknown as DbRow,
    ),
  );
}

export async function submitFinanceTransfer(input: {
  sourceFinanceAccountId: string;
  destinationFinanceAccountId: string;
  amount: string;
  reason: string;
  businessDate: string;
}) {
  const sourceFinanceAccountId =
    input.sourceFinanceAccountId.trim();

  const destinationFinanceAccountId =
    input.destinationFinanceAccountId.trim();

  const amountPaise =
    parseRupeesToPaise(input.amount);

  const reason = input.reason.trim();
  const businessDate = input.businessDate.trim();

  if (
    !sourceFinanceAccountId ||
    !destinationFinanceAccountId
  ) {
    throw new Error(
      "finance_transfer_account_required",
    );
  }

  if (
    sourceFinanceAccountId ===
    destinationFinanceAccountId
  ) {
    throw new Error(
      "finance_transfer_self_transfer",
    );
  }

  if (
    amountPaise === null ||
    !Number.isSafeInteger(amountPaise) ||
    amountPaise <= 0
  ) {
    throw new Error(
      "finance_transfer_amount_invalid",
    );
  }

  if (
    reason.length < 1 ||
    reason.length > 1000
  ) {
    throw new Error(
      "finance_transfer_reason_invalid",
    );
  }

  if (!isValidIsoDate(businessDate)) {
    throw new Error(
      "finance_transfer_business_date_invalid",
    );
  }

  const { data, error } = await supabase.rpc(
    "submit_finance_transfer",
    {
      p_source_finance_account_id:
        sourceFinanceAccountId,
      p_destination_finance_account_id:
        destinationFinanceAccountId,
      p_amount_paise: amountPaise,
      p_reason: reason,
      p_business_date: businessDate,
      p_operation_id: randomUUID(),
    },
  );

  if (error) {
    throw new Error(
      "finance_transfer_submit_failed",
    );
  }

  return unwrapFinanceTransfer(data);
}

export async function decideFinanceTransfer(input: {
  financeTransferId: string;
  decision: "approve" | "reject";
  reason?: string;
}) {
  const financeTransferId =
    input.financeTransferId.trim();

  const reason =
    input.reason?.trim() || null;

  if (!financeTransferId) {
    throw new Error(
      "finance_transfer_id_required",
    );
  }

  if (
    input.decision !== "approve" &&
    input.decision !== "reject"
  ) {
    throw new Error(
      "finance_transfer_decision_invalid",
    );
  }

  if (
    input.decision === "reject" &&
    !reason
  ) {
    throw new Error(
      "finance_transfer_rejection_reason_required",
    );
  }

  if (
    reason !== null &&
    reason.length > 2000
  ) {
    throw new Error(
      "finance_transfer_decision_reason_invalid",
    );
  }

  const { data, error } = await supabase.rpc(
    "decide_finance_transfer",
    {
      p_finance_transfer_id:
        financeTransferId,
      p_decision: input.decision,
      p_reason: reason,
      p_operation_id: randomUUID(),
    },
  );

  if (error) {
    throw new Error(
      "finance_transfer_decide_failed",
    );
  }

  return unwrapFinanceTransfer(data);
}

export function financeTransferStatusLabel(
  status: FinanceTransferStatus,
) {
  return {
    submitted: "Submitted",
    approved: "Approved",
    rejected: "Rejected",
  }[status];
}

export type FinanceExpenseStatus =
  | "submitted"
  | "posted"
  | "rejected";

export interface FinanceExpense {
  id: string;
  financeAccountId: string;
  amountPaise: number;
  currency: string;
  description: string;
  payee: string | null;
  businessDate: string;
  status: FinanceExpenseStatus;
  submittedByApplicationUserId: string;
  decidedByApplicationUserId: string | null;
  decidedAt: string | null;
  rejectionReason: string | null;
  postedTransactionId: string | null;
  createdAt: string;
  updatedAt: string;
}

function nullableFinanceString(value: unknown) {
  return value === null || value === undefined
    ? null
    : String(value);
}

function mapFinanceExpense(
  row: DbRow,
): FinanceExpense {
  return {
    id: String(row.id),
    financeAccountId: String(row.finance_account_id),
    amountPaise: Number(row.amount_paise),
    currency: String(row.currency),
    description: String(row.description),
    payee: nullableFinanceString(row.payee),
    businessDate: String(row.business_date),
    status: row.status as FinanceExpenseStatus,
    submittedByApplicationUserId: String(
      row.submitted_by_application_user_id,
    ),
    decidedByApplicationUserId:
      nullableFinanceString(
        row.decided_by_application_user_id,
      ),
    decidedAt: nullableFinanceString(row.decided_at),
    rejectionReason:
      nullableFinanceString(row.rejection_reason),
    postedTransactionId:
      nullableFinanceString(row.posted_transaction_id),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function unwrapFinanceExpense(
  data: unknown,
): FinanceExpense {
  const row = Array.isArray(data) ? data[0] : data;

  if (!row || typeof row !== "object") {
    throw new Error("finance_expense_result_missing");
  }

  return mapFinanceExpense(row as DbRow);
}

export function financeExpensesQueryKey(
  applicationUserId?: string,
) {
  return [
    "finance",
    "expenses",
    applicationUserId ?? "anonymous",
  ] as const;
}

export async function listFinanceExpenses(): Promise<
  FinanceExpense[]
> {
  const { data, error } = await supabase
    .from("finance_expenses")
    .select(
      [
        "id",
        "finance_account_id",
        "amount_paise",
        "currency",
        "description",
        "payee",
        "business_date",
        "status",
        "submitted_by_application_user_id",
        "decided_by_application_user_id",
        "decided_at",
        "rejection_reason",
        "posted_transaction_id",
        "created_at",
        "updated_at",
      ].join(", "),
    )
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });

  if (error) {
    throw new Error("finance_expenses_unavailable");
  }

  return (data ?? []).map((row) =>
    mapFinanceExpense(row as unknown as DbRow),
  );
}

export async function submitFinanceExpense(input: {
  financeAccountId: string;
  amount: string;
  description: string;
  payee?: string;
  businessDate: string;
}) {
  const financeAccountId =
    input.financeAccountId.trim();
  const amountPaise =
    parseRupeesToPaise(input.amount);
  const description = input.description.trim();
  const payee = input.payee?.trim() || null;
  const businessDate = input.businessDate.trim();

  if (!financeAccountId) {
    throw new Error(
      "finance_expense_account_required",
    );
  }

  if (
    amountPaise === null ||
    !Number.isSafeInteger(amountPaise) ||
    amountPaise <= 0
  ) {
    throw new Error(
      "finance_expense_amount_invalid",
    );
  }

  if (
    description.length < 1 ||
    description.length > 2000
  ) {
    throw new Error(
      "finance_expense_description_invalid",
    );
  }

  if (payee !== null && payee.length > 200) {
    throw new Error(
      "finance_expense_payee_invalid",
    );
  }

  if (!isValidIsoDate(businessDate)) {
    throw new Error(
      "finance_expense_business_date_invalid",
    );
  }

  const { data, error } = await supabase.rpc(
    "submit_finance_expense",
    {
      p_finance_account_id: financeAccountId,
      p_amount_paise: amountPaise,
      p_description: description,
      p_payee: payee,
      p_business_date: businessDate,
      p_operation_id: randomUUID(),
    },
  );

  if (error) {
    throw new Error(
      "finance_expense_submit_failed",
    );
  }

  return unwrapFinanceExpense(data);
}

export async function decideFinanceExpense(input: {
  financeExpenseId: string;
  decision: "approve" | "reject";
  reason?: string;
}) {
  const financeExpenseId =
    input.financeExpenseId.trim();
  const reason = input.reason?.trim() || null;

  if (!financeExpenseId) {
    throw new Error("finance_expense_id_required");
  }

  if (
    input.decision !== "approve" &&
    input.decision !== "reject"
  ) {
    throw new Error(
      "finance_expense_decision_invalid",
    );
  }

  if (
    input.decision === "reject" &&
    !reason
  ) {
    throw new Error(
      "finance_expense_reason_required",
    );
  }

  if (reason !== null && reason.length > 2000) {
    throw new Error(
      "finance_expense_reason_invalid",
    );
  }

  const { data, error } = await supabase.rpc(
    "decide_finance_expense",
    {
      p_finance_expense_id: financeExpenseId,
      p_decision: input.decision,
      p_reason: reason,
      p_operation_id: randomUUID(),
    },
  );

  if (error) {
    throw new Error(
      "finance_expense_decide_failed",
    );
  }

  return unwrapFinanceExpense(data);
}

export function financeExpenseStatusLabel(
  status: FinanceExpenseStatus,
) {
  return {
    submitted: "Submitted",
    posted: "Posted",
    rejected: "Rejected",
  }[status];
}

export type FinanceMonthlyReportStatus =
  | "generating"
  | "ready"
  | "failed";

export interface FinanceMonthlyReport {
  id: string;
  reportMonth: string;
  revision: number;
  status: FinanceMonthlyReportStatus;
  generationSource: "scheduled" | "manual";
  attemptCount: number;
  openingBalancePaise: number;
  donationInflowPaise: number;
  expenseOutflowPaise: number;
  adjustmentsNetPaise: number;
  transferInPaise: number;
  transferOutPaise: number;
  closingBalancePaise: number;
  cashClosingPaise: number;
  bankClosingPaise: number;
  upiClosingPaise: number;
  otherClosingPaise: number;
  transactionCount: number;
  storageBucket: string;
  storageObjectPath: string;
  fileSizeBytes: number | null;
  generatedAt: string | null;
  lastErrorCode: string | null;
  createdAt: string;
  updatedAt: string;
}

function mapFinanceMonthlyReport(
  row: DbRow,
): FinanceMonthlyReport {
  return {
    id: String(row.id),
    reportMonth: String(row.report_month),
    revision: Number(row.revision),
    status: row.status as FinanceMonthlyReportStatus,
    generationSource:
      row.generation_source as FinanceMonthlyReport["generationSource"],
    attemptCount: Number(row.attempt_count),
    openingBalancePaise: Number(row.opening_balance_paise),
    donationInflowPaise: Number(row.donation_inflow_paise),
    expenseOutflowPaise: Number(row.expense_outflow_paise),
    adjustmentsNetPaise: Number(row.adjustments_net_paise),
    transferInPaise: Number(row.transfer_in_paise),
    transferOutPaise: Number(row.transfer_out_paise),
    closingBalancePaise: Number(row.closing_balance_paise),
    cashClosingPaise: Number(row.cash_closing_paise),
    bankClosingPaise: Number(row.bank_closing_paise),
    upiClosingPaise: Number(row.upi_closing_paise),
    otherClosingPaise: Number(row.other_closing_paise),
    transactionCount: Number(row.transaction_count),
    storageBucket: String(row.storage_bucket),
    storageObjectPath: String(row.storage_object_path),
    fileSizeBytes:
      row.file_size_bytes === null ||
      row.file_size_bytes === undefined
        ? null
        : Number(row.file_size_bytes),
    generatedAt:
      row.generated_at === null ||
      row.generated_at === undefined
        ? null
        : String(row.generated_at),
    lastErrorCode:
      row.last_error_code === null ||
      row.last_error_code === undefined
        ? null
        : String(row.last_error_code),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export function financeMonthlyReportsQueryKey(
  applicationUserId?: string,
) {
  return [
    "finance",
    "monthly-reports",
    applicationUserId ?? "anonymous",
  ] as const;
}

export async function listFinanceMonthlyReports(): Promise<
  FinanceMonthlyReport[]
> {
  const { data, error } = await supabase
    .from("finance_monthly_reports")
    .select(
      [
        "id",
        "report_month",
        "revision",
        "status",
        "generation_source",
        "attempt_count",
        "opening_balance_paise",
        "donation_inflow_paise",
        "expense_outflow_paise",
        "adjustments_net_paise",
        "transfer_in_paise",
        "transfer_out_paise",
        "closing_balance_paise",
        "cash_closing_paise",
        "bank_closing_paise",
        "upi_closing_paise",
        "other_closing_paise",
        "transaction_count",
        "storage_bucket",
        "storage_object_path",
        "file_size_bytes",
        "generated_at",
        "last_error_code",
        "created_at",
        "updated_at",
      ].join(", "),
    )
    .order("report_month", { ascending: false })
    .order("revision", { ascending: false });

  if (error) {
    throw new Error("finance_monthly_reports_unavailable");
  }

  return (data ?? []).map((row) =>
    mapFinanceMonthlyReport(row as unknown as DbRow),
  );
}

export function normalizeFinanceReportMonth(
  input: string,
) {
  const value = input.trim();

  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) {
    throw new Error("finance_monthly_report_month_invalid");
  }

  return `${value}-01`;
}

export async function generateFinanceMonthlyReport(
  reportMonthInput: string,
) {
  const reportMonth =
    normalizeFinanceReportMonth(reportMonthInput);

  const { data, error } = await supabase.functions.invoke(
    "render-finance-monthly-report",
    {
      body: {
        report_month: reportMonth,
      },
    },
  );

  if (error) {
    throw new Error(
      "finance_monthly_report_generate_failed",
    );
  }

  return data;
}

export async function getFinanceMonthlyReportPdfUrl(
  report: FinanceMonthlyReport,
) {
  if (report.status !== "ready") {
    throw new Error("finance_monthly_report_not_ready");
  }

  const { data, error } = await supabase.storage
    .from(report.storageBucket)
    .createSignedUrl(report.storageObjectPath, 60);

  if (error || !data?.signedUrl) {
    throw new Error("finance_monthly_report_pdf_unavailable");
  }

  return data.signedUrl;
}

export function financeMonthlyReportStatusLabel(
  status: FinanceMonthlyReportStatus,
) {
  return {
    generating: "Generating",
    ready: "Ready",
    failed: "Failed",
  }[status];
}

export function formatFinanceReportMonth(
  reportMonth: string,
) {
  const [year, month] = reportMonth
    .split("-")
    .map(Number);

  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  const monthName = monthNames[month - 1];

  if (!year || !monthName) {
    return reportMonth;
  }

  return `${monthName} ${year}`;
}
