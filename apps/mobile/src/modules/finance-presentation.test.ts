import type { MobileCapabilities } from "./capabilities";
import { financeStatusTone, financeWorkspaceModules } from "./finance-presentation";

const capabilities = {
  canReadFinanceAccounts: false,
  canReadFinanceMonthlyReports: false,
  canManageFinanceMonthlyReports: false,
  canReadFinanceTransactions: false,
  canCreateFinanceTransfers: false,
  canApproveFinanceTransfers: false,
  canCreateFinanceExpenses: false,
  canApproveFinanceExpenses: false,
  canCreateFinanceCorrections: false,
  canCreateFinanceReversals: false,
  canReadFinanceReconciliation: false,
  canManageFinanceReconciliation: false,
} as MobileCapabilities;

describe("Finance presentation", () => {
  it("derives workspace modules only from existing capabilities", () => {
    expect(
      financeWorkspaceModules({
        ...capabilities,
        canReadFinanceAccounts: true,
        canCreateFinanceExpenses: true,
        canReadFinanceMonthlyReports: true,
      }).map((module) => module.key),
    ).toEqual(["accounts", "expenses", "reports"]);
  });

  it("keeps maker/checker modules visible to creators and approvers without role names", () => {
    expect(
      financeWorkspaceModules({
        ...capabilities,
        canApproveFinanceTransfers: true,
        canApproveFinanceExpenses: true,
        canCreateFinanceCorrections: true,
      }).map((module) => module.key),
    ).toEqual(["transfers", "expenses", "adjustments"]);
  });

  it("maps existing lifecycle terms to calm semantic tones", () => {
    expect(financeStatusTone("posted")).toBe("success");
    expect(financeStatusTone("submitted")).toBe("warning");
    expect(financeStatusTone("unresolved")).toBe("danger");
    expect(financeStatusTone("matched")).toBe("success");
    expect(financeStatusTone("open")).toBe("warning");
    expect(financeStatusTone("closed")).toBe("neutral");
  });
});
