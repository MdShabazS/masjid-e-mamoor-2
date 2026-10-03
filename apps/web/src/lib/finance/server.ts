import "server-only";

import { cache } from "react";
import type {
  FinanceAccount,
  FinanceAccountSnapshot,
} from "@masjid-e-mamoor/types";

import { createClient } from "@/lib/supabase/server";

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
