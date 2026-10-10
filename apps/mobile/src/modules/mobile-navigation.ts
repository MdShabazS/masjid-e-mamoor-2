import type { Href } from "expo-router";

import type { MobileAccount } from "../auth/types";
import type { MobileCapabilities } from "./capabilities";

export type MobileModuleKey =
  | "home"
  | "tasks"
  | "meetings"
  | "community"
  | "donations"
  | "finance"
  | "accounts"
  | "notifications"
  | "profile"
  | "announcements"
  | "more";

export interface MobileModuleDefinition {
  description: string;
  href: Href;
  key: MobileModuleKey;
  label: string;
}

const definitions: Record<Exclude<MobileModuleKey, "home" | "more">, MobileModuleDefinition> = {
  tasks: { key: "tasks", label: "Tasks", href: "/work", description: "Assigned and open committee work" },
  meetings: { key: "meetings", label: "Meetings", href: "/work/meetings", description: "Committee schedules, agendas, and records" },
  community: { key: "community", label: "Community", href: "/community", description: "Members and referral workflows" },
  donations: { key: "donations", label: "Donations", href: "/donations", description: "Obligations, payments, and donation records" },
  finance: { key: "finance", label: "Finance", href: "/finance", description: "Authorized accounts and financial workflows" },
  accounts: { key: "accounts", label: "Accounts", href: "/accounts", description: "Account administration and access" },
  notifications: { key: "notifications", label: "Updates", href: "/notifications", description: "Recent personal notifications" },
  profile: { key: "profile", label: "Profile", href: "/profile", description: "Identity, membership, and security" },
  announcements: { key: "announcements", label: "Announcements", href: "/announcements", description: "Publish organization-wide updates" },
};

function authorizedModules(capabilities: MobileCapabilities): MobileModuleKey[] {
  const modules: MobileModuleKey[] = [];
  if (capabilities.canReadCommitteeTasks) modules.push("tasks");
  if (capabilities.canReadCommitteeMeetings) modules.push("meetings");
  if (capabilities.canReadMembers || capabilities.canUseReferrals) modules.push("community");
  if (capabilities.canReadDonations) modules.push("donations");
  if (hasFinanceAccess(capabilities)) modules.push("finance");
  if (capabilities.canManageAccounts) modules.push("accounts");
  if (capabilities.canReadNotifications) modules.push("notifications");
  if (capabilities.canManageAnnouncements) modules.push("announcements");
  modules.push("profile");
  return modules;
}

export function primaryMobileTabs(
  role: MobileAccount["role"],
  capabilities: MobileCapabilities,
): MobileModuleKey[] {
  const available = new Set(authorizedModules(capabilities));
  const preference: MobileModuleKey[] =
    role === "finance"
      ? ["donations", "finance", "tasks", "notifications", "profile"]
      : role === "auditor"
        ? ["finance", "tasks", "notifications", "profile"]
        : role === "member"
          ? ["donations", "community", "notifications", "profile"]
          : role === "system_admin"
            ? ["accounts", "notifications", "profile"]
            : ["tasks", "meetings", "community", "notifications", "profile"];
  const selected = preference.filter((key) => available.has(key));
  const remaining = authorizedModules(capabilities).filter((key) => !selected.includes(key));
  const direct = selected.slice(0, remaining.length > 0 || selected.length > 4 ? 3 : 4);

  return ["home", ...direct, ...(remaining.length > 0 || selected.length > 4 ? ["more" as const] : [])];
}

export function moreMobileModules(
  role: MobileAccount["role"],
  capabilities: MobileCapabilities,
): MobileModuleDefinition[] {
  const primary = new Set(primaryMobileTabs(role, capabilities));
  return authorizedModules(capabilities)
    .filter((key) => !primary.has(key))
    .map((key) => definitions[key as keyof typeof definitions]);
}

function hasFinanceAccess(capabilities: MobileCapabilities) {
  return capabilities.canReadFinanceAccounts ||
    capabilities.canReadFinanceMonthlyReports ||
    capabilities.canReadFinanceReconciliation ||
    capabilities.canReadFinanceTransactions ||
    capabilities.canCreateFinanceTransfers ||
    capabilities.canApproveFinanceTransfers ||
    capabilities.canCreateFinanceExpenses ||
    capabilities.canApproveFinanceExpenses ||
    capabilities.canCreateFinanceCorrections ||
    capabilities.canCreateFinanceReversals;
}
