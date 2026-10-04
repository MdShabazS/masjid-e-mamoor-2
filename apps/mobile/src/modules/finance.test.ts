import {
  financeAccountCreateSchema,
  financeAccountRenameSchema,
  financeAccountStatusChangeSchema,
} from "@masjid-e-mamoor/validation";

import {
  financeAccountStatusLabel,
  financeAccountTypeLabel,
  formatFinanceMoney,
} from "./finance";

jest.mock("../lib/supabase", () => ({
  supabase: {},
}));

describe("mobile Finance account contract", () => {
  it("validates Finance account creation", () => {
    expect(
      financeAccountCreateSchema.safeParse({
        name: "Main UPI",
        accountType: "upi",
        operationId: "finance-create-1",
      }).success,
    ).toBe(true);

    expect(
      financeAccountCreateSchema.safeParse({
        name: "",
        accountType: "upi",
        operationId: "finance-create-2",
      }).success,
    ).toBe(false);
  });

  it("validates Finance account rename", () => {
    const financeAccountId =
      "76000000-0000-4000-8000-000000000001";

    expect(
      financeAccountRenameSchema.safeParse({
        financeAccountId,
        name: "Masjid E Mamoor 2",
        operationId: "finance-rename-valid",
      }).success,
    ).toBe(true);

    expect(
      financeAccountRenameSchema.safeParse({
        financeAccountId,
        name: "",
        operationId: "finance-rename-invalid",
      }).success,
    ).toBe(false);
  });

  it("validates Finance lifecycle states", () => {
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

  it("formats Finance account labels and paise", () => {
    expect(financeAccountTypeLabel("bank")).toBe("Bank");
    expect(financeAccountTypeLabel("upi")).toBe("UPI");
    expect(financeAccountStatusLabel("inactive")).toBe(
      "Inactive",
    );
    expect(formatFinanceMoney(123456)).toBe("₹1,234.56");
    expect(formatFinanceMoney(-500)).toBe("-₹5.00");
  });
});
