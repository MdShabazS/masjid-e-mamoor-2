import "server-only";

import { cache } from "react";
import type {
  FinanceAccount,
  FinanceAccountSnapshot,
} from "@masjid-e-mamoor/types";

import { createClient } from "@/lib/supabase/server";
import { isCompletedFinanceReportMonth } from "./monthly";

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

function unwrapFinanceAccount(
  data: unknown,
): FinanceAccount {
  const row = Array.isArray(data) ? data[0] : data;

  if (!row || typeof row !== "object") {
    throw new Error(
      "Trusted Finance account operation returned no result.",
    );
  }

  return mapFinanceAccount(row as DbRow);
}

export async function getActiveFinanceAccounts(): Promise<
  FinanceAccount[]
> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("finance_accounts")
    .select(
      "id, name, account_type, status, currency, created_at, updated_at",
    )
    .eq("status", "active")
    .order("name", { ascending: true })
    .order("id", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) =>
    mapFinanceAccount(row as DbRow),
  );
}

export async function getFinanceAccounts(): Promise<
  FinanceAccountSnapshot[]
> {
  const supabase = await createClient();

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

  if (accountsResult.error) {
    throw accountsResult.error;
  }

  if (balancesResult.error) {
    throw balancesResult.error;
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

export const getFinanceAccountCapabilities = cache(
  async function getFinanceAccountCapabilities() {
    const supabase = await createClient();

    const [
      { data: canReadAccounts, error: readError },
      { data: canManageAccounts, error: manageError },
    ] = await Promise.all([
      supabase.rpc("has_application_permission", {
        requested_permission: "finance.accounts.read",
      }),
      supabase.rpc("has_application_permission", {
        requested_permission: "finance.accounts.manage",
      }),
    ]);

    if (readError || manageError) {
      throw new Error(
        "Unable to resolve Finance account permissions.",
      );
    }

    return {
      canReadAccounts: canReadAccounts === true,
      canManageAccounts: canManageAccounts === true,
    };
  },
);

export async function createFinanceAccount(input: {
  name: string;
  accountType: FinanceAccount["accountType"];
  operationId: string;
}) {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc(
    "create_finance_account",
    {
      p_name: input.name,
      p_account_type: input.accountType,
      p_operation_id: input.operationId,
    },
  );

  if (error) {
    throw error;
  }

  return unwrapFinanceAccount(data);
}

export async function setFinanceAccountStatus(input: {
  financeAccountId: string;
  status: FinanceAccount["status"];
  operationId: string;
}) {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc(
    "set_finance_account_status",
    {
      p_finance_account_id: input.financeAccountId,
      p_status: input.status,
      p_operation_id: input.operationId,
    },
  );

  if (error) {
    throw error;
  }

  return unwrapFinanceAccount(data);
}

export async function renameFinanceAccount(input: {
  financeAccountId: string;
  name: string;
  operationId: string;
}) {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc(
    "rename_finance_account",
    {
      p_finance_account_id: input.financeAccountId,
      p_name: input.name,
      p_operation_id: input.operationId,
    },
  );

  if (error) {
    throw error;
  }

  return unwrapFinanceAccount(data);
}


export type FinanceMonthlyReport = {
  id: string;
  reportMonth: string;
  revision: number;
  status: "generating" | "ready" | "failed";
  generationSource: "scheduled" | "manual";
  attemptCount: number;
  openingBalancePaise: number;
  donationInflowPaise: number;
  expenseOutflowPaise: number;
  adjustmentsNetPaise: number;
  closingBalancePaise: number;
  cashClosingPaise: number;
  bankClosingPaise: number;
  upiClosingPaise: number;
  otherClosingPaise: number;
  transactionCount: number;
  storageBucket: string;
  storageObjectPath: string;
  fileSha256: string | null;
  fileSizeBytes: number | null;
  generatedAt: string | null;
  lastErrorCode: string | null;
  createdAt: string;
};

export type FinanceMonthlyReportGenerationResult =
  | { status: "ready"; reportId: string }
  | { status: "busy"; reportId: string | null }
  | { status: "forbidden" }
  | { status: "unauthenticated" }
  | { status: "failed" };

function mapFinanceMonthlyReport(
  row: DbRow,
): FinanceMonthlyReport {
  return {
    id: String(row.id),
    reportMonth: String(row.report_month),
    revision: Number(row.revision),
    status: row.status as FinanceMonthlyReport["status"],
    generationSource:
      row.generation_source as FinanceMonthlyReport["generationSource"],
    attemptCount: Number(row.attempt_count),
    openingBalancePaise: Number(row.opening_balance_paise),
    donationInflowPaise: Number(row.donation_inflow_paise),
    expenseOutflowPaise: Number(row.expense_outflow_paise),
    adjustmentsNetPaise: Number(row.adjustments_net_paise),
    closingBalancePaise: Number(row.closing_balance_paise),
    cashClosingPaise: Number(row.cash_closing_paise),
    bankClosingPaise: Number(row.bank_closing_paise),
    upiClosingPaise: Number(row.upi_closing_paise),
    otherClosingPaise: Number(row.other_closing_paise),
    transactionCount: Number(row.transaction_count),
    storageBucket: String(row.storage_bucket),
    storageObjectPath: String(row.storage_object_path),
    fileSha256:
      row.file_sha256 == null
        ? null
        : String(row.file_sha256),
    fileSizeBytes:
      row.file_size_bytes == null
        ? null
        : Number(row.file_size_bytes),
    generatedAt:
      row.generated_at == null
        ? null
        : String(row.generated_at),
    lastErrorCode:
      row.last_error_code == null
        ? null
        : String(row.last_error_code),
    createdAt: String(row.created_at),
  };
}

export const getFinanceMonthlyReportCapabilities = cache(
  async function getFinanceMonthlyReportCapabilities() {
    const supabase = await createClient();

    const [
      { data: canRead, error: readError },
      { data: canManage, error: manageError },
    ] = await Promise.all([
      supabase.rpc("has_application_permission", {
        requested_permission:
          "finance.monthly_reports.read",
      }),
      supabase.rpc("has_application_permission", {
        requested_permission:
          "finance.monthly_reports.manage",
      }),
    ]);

    if (readError || manageError) {
      throw new Error(
        "Unable to resolve monthly Finance report permissions.",
      );
    }

    return {
      canRead: canRead === true,
      canManage: canManage === true,
    };
  },
);

export async function getFinanceMonthlyReports(): Promise<
  FinanceMonthlyReport[]
> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("finance_monthly_reports")
    .select(
      "id, report_month, revision, status, generation_source, attempt_count, opening_balance_paise, donation_inflow_paise, expense_outflow_paise, adjustments_net_paise, closing_balance_paise, cash_closing_paise, bank_closing_paise, upi_closing_paise, other_closing_paise, transaction_count, storage_bucket, storage_object_path, file_sha256, file_size_bytes, generated_at, last_error_code, created_at",
    )
    .order("report_month", { ascending: false })
    .order("revision", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) =>
    mapFinanceMonthlyReport(row as DbRow),
  );
}

export async function generateFinanceMonthlyReport(
  reportMonth: string,
): Promise<FinanceMonthlyReportGenerationResult> {
  if (!isCompletedFinanceReportMonth(reportMonth)) {
    return { status: "failed" };
  }

  const supabase = await createClient();

  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError || !session?.access_token) {
    return { status: "unauthenticated" };
  }

  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !publishableKey) {
    throw new Error(
      "Missing Supabase web configuration.",
    );
  }

  let response: Response;

  try {
    response = await fetch(
      `${supabaseUrl}/functions/v1/render-finance-monthly-report`,
      {
        method: "POST",
        headers: {
          Authorization:
            `Bearer ${session.access_token}`,
          apikey: publishableKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          report_month: reportMonth,
        }),
        cache: "no-store",
      },
    );
  } catch {
    return { status: "failed" };
  }

  const payload = await response
    .json()
    .catch(() => null) as
    | Record<string, unknown>
    | null;

  if (
    response.status === 200 &&
    payload?.status === "ready" &&
    typeof payload.report_id === "string"
  ) {
    return {
      status: "ready",
      reportId: payload.report_id,
    };
  }

  if (
    response.status === 202 &&
    payload?.status === "busy"
  ) {
    return {
      status: "busy",
      reportId:
        typeof payload.report_id === "string"
          ? payload.report_id
          : null,
    };
  }

  if (response.status === 403) {
    return { status: "forbidden" };
  }

  if (response.status === 401) {
    return { status: "unauthenticated" };
  }

  return { status: "failed" };
}

export async function createFinanceMonthlyReportSignedUrl(
  reportId: string,
) {
  const supabase = await createClient();

  const { data: report, error: reportError } =
    await supabase
      .from("finance_monthly_reports")
      .select(
        "id, status, storage_bucket, storage_object_path",
      )
      .eq("id", reportId)
      .maybeSingle();

  if (
    reportError ||
    !report ||
    report.status !== "ready" ||
    report.storage_bucket !==
      "finance-monthly-reports" ||
    !report.storage_object_path
  ) {
    throw new Error(
      "Monthly Finance report is unavailable.",
    );
  }

  const { data, error } = await supabase.storage
    .from(report.storage_bucket)
    .createSignedUrl(
      report.storage_object_path,
      90,
      { download: true },
    );

  if (error || !data?.signedUrl) {
    throw new Error(
      "Monthly Finance report download is unavailable.",
    );
  }

  return data.signedUrl;
}
