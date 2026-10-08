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

import { supabase } from "../lib/supabase";

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
