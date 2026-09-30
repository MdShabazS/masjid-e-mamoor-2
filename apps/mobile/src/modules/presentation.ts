import type { MobileCapabilities } from "./capabilities";
import type { MobileMember } from "./types";

export function visibleWorkspaceModules(capabilities: MobileCapabilities) {
  const modules = ["profile"];
  if (capabilities.canReadMembers) modules.push("members");
  if (capabilities.canUseReferrals) modules.push("referrals");
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
