import type { MobileCapabilities } from "./capabilities";

export interface FinanceWorkspaceModule {
  description: string;
  href:
    | "/finance/accounts"
    | "/finance/transactions"
    | "/finance/transfers"
    | "/finance/expenses"
    | "/finance/adjustments"
    | "/finance/reconciliation"
    | "/finance/reports";
  key: string;
  title: string;
}

export function financeWorkspaceModules(access: MobileCapabilities): FinanceWorkspaceModule[] {
  const modules: FinanceWorkspaceModule[] = [];

  if (access.canReadFinanceAccounts) {
    modules.push({
      key: "accounts",
      title: "Finance accounts",
      description: "Authoritative balances and account lifecycle",
      href: "/finance/accounts",
    });
  }
  if (access.canReadFinanceTransactions) {
    modules.push({
      key: "transactions",
      title: "Transaction ledger",
      description: "Read-only posted financial effects",
      href: "/finance/transactions",
    });
  }
  if (
    access.canReadFinanceTransactions ||
    access.canCreateFinanceTransfers ||
    access.canApproveFinanceTransfers
  ) {
    modules.push({
      key: "transfers",
      title: "Internal transfers",
      description: "Maker/checker movement between Finance accounts",
      href: "/finance/transfers",
    });
  }
  if (
    access.canReadFinanceTransactions ||
    access.canCreateFinanceExpenses ||
    access.canApproveFinanceExpenses
  ) {
    modules.push({
      key: "expenses",
      title: "Expenses",
      description: "Submit, review, and trace expense posting",
      href: "/finance/expenses",
    });
  }
  if (
    access.canReadFinanceTransactions ||
    access.canCreateFinanceCorrections ||
    access.canCreateFinanceReversals
  ) {
    modules.push({
      key: "adjustments",
      title: "Corrections & reversals",
      description: "Append-only financial correction history",
      href: "/finance/adjustments",
    });
  }
  if (access.canReadFinanceReconciliation) {
    modules.push({
      key: "reconciliation",
      title: "Reconciliation",
      description: "External evidence and discrepancy review",
      href: "/finance/reconciliation",
    });
  }
  if (access.canReadFinanceMonthlyReports) {
    modules.push({
      key: "reports",
      title: "Monthly reports",
      description: "Authoritative snapshots and PDF report packs",
      href: "/finance/reports",
    });
  }

  return modules;
}

export type FinanceSemanticTone = "neutral" | "success" | "warning" | "danger" | "info";

export function financeStatusTone(status: string): FinanceSemanticTone {
  if (
    [
      "approved",
      "applied",
      "completed",
      "investigated",
      "matched",
      "posted",
      "ready",
      "reconciled",
    ].includes(status)
  ) {
    return "success";
  }
  if (["failed", "rejected", "unresolved"].includes(status)) return "danger";
  if (["in_progress", "open", "pending", "rendering", "submitted"].includes(status)) {
    return "warning";
  }
  if (["active", "generated"].includes(status)) return "info";
  return "neutral";
}
