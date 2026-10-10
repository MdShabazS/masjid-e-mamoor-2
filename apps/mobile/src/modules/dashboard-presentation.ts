import type { Href } from "expo-router";

import type { MobileCapabilities } from "./capabilities";
import type { CommitteeMeetingSummary } from "./meetings";
import { visibleWorkspaceModules } from "./presentation";
import type { CommitteeTaskSummary } from "./work";

export interface DashboardWorkspaceModule {
  description: string;
  href: Href;
  key: string;
  title: string;
}

export function dashboardWorkspaceModules(
  capabilities: MobileCapabilities,
): DashboardWorkspaceModule[] {
  const descriptions = {
    profile: "Identity, membership details, and account security",
    accounts: "Manage authorized accounts, roles, and access",
    members: "View the authorized member directory",
    referrals: capabilities.canManageReferrals
      ? "Review and manage member onboarding"
      : "Create and track your referrals",
    work: capabilities.canAssignCommitteeTasks
      ? "Create, assign, and manage committee tasks"
      : "Review and update your assigned committee tasks",
    donations: capabilities.canManageDonations
      ? "Donation records and authorized management workflows"
      : "View obligations, submit payments, and review history",
    finance: capabilities.canManageFinanceAccounts
      ? "Finance accounts, balances, and account administration"
      : "Review authorized Finance accounts and balances",
  } as const;

  const definitions = {
    profile: { href: "/profile", title: "My Profile" },
    accounts: { href: "/accounts", title: "Account Administration" },
    members: { href: "/community/members", title: "Members" },
    referrals: { href: "/community/referrals", title: "Referrals" },
    work: { href: "/work", title: "Work" },
    donations: { href: "/donations", title: "Donations" },
    finance: { href: "/finance", title: "Finance" },
  } as const;

  return visibleWorkspaceModules(capabilities).map((key) => ({
    description: descriptions[key as keyof typeof descriptions],
    href: definitions[key as keyof typeof definitions].href,
    key,
    title: definitions[key as keyof typeof definitions].title,
  }));
}

export function activeDashboardTasks(tasks: readonly CommitteeTaskSummary[]) {
  return tasks
    .filter((task) => task.status !== "completed")
    .sort((left, right) => {
      if (left.isOverdue !== right.isOverdue) return left.isOverdue ? -1 : 1;
      if (left.dueDate && right.dueDate) return left.dueDate.localeCompare(right.dueDate);
      if (left.dueDate) return -1;
      if (right.dueDate) return 1;
      return right.updatedAt.localeCompare(left.updatedAt);
    });
}

export function upcomingDashboardMeetings(
  meetings: readonly CommitteeMeetingSummary[],
  now = new Date(),
) {
  const nowTime = now.getTime();

  return meetings
    .filter((meeting) => {
      if (meeting.status !== "scheduled") return false;
      const start = new Date(meeting.scheduledStart).getTime();
      return Number.isFinite(start) && start >= nowTime;
    })
    .sort(
      (left, right) =>
        new Date(left.scheduledStart).getTime() - new Date(right.scheduledStart).getTime(),
    );
}

export function formatDashboardMeetingDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";

  return date.toLocaleString(undefined, {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
    weekday: "short",
  });
}
