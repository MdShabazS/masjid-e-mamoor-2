import "server-only";

import type { FinanceAccount } from "@masjid-e-mamoor/types";

import { createClient } from "@/lib/supabase/server";

type DbRow = Record<string, unknown>;

function mapFinanceAccount(row: DbRow): FinanceAccount {
  return {
    id: String(row.id),
    name: String(row.name),
    accountType: row.account_type as FinanceAccount["accountType"],
    status: row.status as FinanceAccount["status"],
    currency: String(row.currency),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
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
