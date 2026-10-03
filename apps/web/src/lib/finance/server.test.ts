import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  financeAccountCreateSchema,
  financeAccountStatusChangeSchema,
} from "@masjid-e-mamoor/validation";

const repoFile = (path: string) =>
  resolve(process.cwd(), "../..", path);

describe("Finance account validation", () => {
  it("accepts supported account creation payloads", () => {
    expect(
      financeAccountCreateSchema.safeParse({
        name: "Main UPI",
        accountType: "upi",
        operationId: "finance-account-create-1",
      }).success,
    ).toBe(true);
  });

  it("rejects unsupported account types and empty names", () => {
    expect(
      financeAccountCreateSchema.safeParse({
        name: "",
        accountType: "upi",
        operationId: "finance-account-create-2",
      }).success,
    ).toBe(false);

    expect(
      financeAccountCreateSchema.safeParse({
        name: "Unsupported",
        accountType: "wallet",
        operationId: "finance-account-create-3",
      }).success,
    ).toBe(false);
  });

  it("accepts only valid Finance lifecycle states", () => {
    const financeAccountId =
      "76000000-0000-4000-8000-000000000001";

    for (const status of [
      "active",
      "inactive",
      "closed",
    ]) {
      expect(
        financeAccountStatusChangeSchema.safeParse({
          financeAccountId,
          status,
          operationId: `finance-status-${status}`,
        }).success,
      ).toBe(true);
    }

    expect(
      financeAccountStatusChangeSchema.safeParse({
        financeAccountId,
        status: "deleted",
        operationId: "finance-status-invalid",
      }).success,
    ).toBe(false);
  });
});

describe("Finance account SQL boundary", () => {
  const migration = readFileSync(
    repoFile(
      "supabase/migrations/20261003172301_finance_accounting_backend_foundation.sql",
    ),
    "utf8",
  );

  it("uses trusted account lifecycle operations", () => {
    expect(migration).toContain(
      "create_finance_account",
    );
    expect(migration).toContain(
      "set_finance_account_status",
    );
    expect(migration).toMatch(
      /security\s+definer/i,
    );
    expect(migration).toContain(
      "finance.accounts.manage",
    );
  });

  it("keeps direct Finance account writes closed", () => {
    expect(migration).toMatch(
      /revoke\s+all\s+on\s+table\s+public\.finance_accounts\s+from\s+public,\s*anon,\s*authenticated;/i,
    );

    expect(migration).toMatch(
      /grant\s+select\s+on\s+table\s+public\.finance_accounts\s+to\s+authenticated;/i,
    );
  });

  it("keeps the balance view under caller RLS", () => {
    expect(migration).toMatch(
      /create\s+view\s+public\.finance_account_balances\s+with\s*\(security_invoker\s*=\s*true\)/i,
    );
  });

  it("prevents reopening permanently closed accounts", () => {
    expect(migration).toMatch(
      /v_previous_status\s*=\s*'closed'\s+and\s+v_status\s*<>\s*'closed'/i,
    );

    expect(migration).toContain(
      "account_closed",
    );
  });
});
