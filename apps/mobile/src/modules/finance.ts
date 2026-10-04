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
