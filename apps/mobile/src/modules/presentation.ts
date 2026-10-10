import type { MobileCapabilities } from "./capabilities";
import type { MobileMember } from "./types";

export function visibleWorkspaceModules(capabilities: MobileCapabilities) {
  const modules: string[] = [];
  if (capabilities.canManageAccounts) modules.push("accounts");
  if (capabilities.canReadMembers) modules.push("members");
  if (capabilities.canUseReferrals) modules.push("referrals");
  if (capabilities.canReadCommitteeTasks) modules.push("work");
  if (capabilities.canReadCommitteeMeetings) modules.push("meetings");
  if (capabilities.canReadDonations) modules.push("donations");
  if (
    capabilities.canReadFinanceAccounts ||
    capabilities.canReadFinanceMonthlyReports ||
    capabilities.canReadFinanceReconciliation ||
    capabilities.canReadFinanceTransactions ||
    capabilities.canCreateFinanceTransfers ||
    capabilities.canApproveFinanceTransfers ||
    capabilities.canCreateFinanceExpenses ||
    capabilities.canApproveFinanceExpenses ||
    capabilities.canCreateFinanceCorrections ||
    capabilities.canCreateFinanceReversals
  ) {
    modules.push("finance");
  }
  if (capabilities.canReadNotifications) modules.push("notifications");
  if (capabilities.canManageAnnouncements) modules.push("announcements");
  modules.push("profile");
  return modules;
}

export function mergeMemberPages(
  pages: readonly { members: readonly MobileMember[] }[],
) {
  return pages.flatMap((page) => page.members);
}

export const referralStatusLabels: Record<string, string> = {
  pending: "Pending",
  submitted: "Submitted",
  approved: "Approved",
  rejected: "Rejected",
  completed: "Completed",
  cancelled: "Cancelled",
};

export function referralStatusLabel(status: string) {
  return referralStatusLabels[status] ?? status;
}
