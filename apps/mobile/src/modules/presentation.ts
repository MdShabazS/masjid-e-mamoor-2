import type { MobileCapabilities } from "./capabilities";

export function visibleWorkspaceModules(capabilities: MobileCapabilities) {
  const modules = ["profile"];
  if (capabilities.canReadMembers) modules.push("members");
  if (capabilities.canUseReferrals) modules.push("referrals");
  return modules;
}

export const referralStatusLabels: Record<string, string> = {
  created: "Created",
  submitted: "Submitted",
  approved: "Approved",
  rejected: "Rejected",
  completed: "Completed",
};

export function referralStatusLabel(status: string) {
  return referralStatusLabels[status] ?? status;
}
