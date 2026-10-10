import type { MobileCapabilities } from "./capabilities";
import {
  activeDashboardTasks,
  dashboardWorkspaceModules,
  upcomingDashboardMeetings,
} from "./dashboard-presentation";
import type { CommitteeMeetingSummary } from "./meetings";
import type { CommitteeTaskSummary } from "./work";

const baseCapabilities: MobileCapabilities = {
  canManageAccounts: false,
  canReadFinanceAccounts: false,
  canManageFinanceAccounts: false,
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
  canReadMembers: false,
  canUpdateMembers: false,
  canCreateReferral: false,
  canUseReferrals: false,
  canManageReferrals: false,
  canReadDonations: false,
  canSubmitPayment: false,
  canUploadProof: false,
  canCreateAdditionalDonation: false,
  canReviewPayments: false,
  canAllocatePayments: false,
  canVerifyAndAllocatePayments: false,
  canManageObligations: false,
  canCreateAnonymousDonation: false,
  canCreateJummahCashDonation: false,
  canManageDonations: false,
  canReadCommitteeTasks: false,
  canManageCommitteeTasks: false,
  canAssignCommitteeTasks: false,
  canReadCommitteeMeetings: false,
  canAdministerCommitteeMeetings: false,
  canRecordCommitteeMeetingAttendance: false,
};

describe("dashboard presentation", () => {
  it("derives workspace modules and manager copy from capabilities", () => {
    const modules = dashboardWorkspaceModules({
      ...baseCapabilities,
      canManageAccounts: true,
      canReadCommitteeTasks: true,
      canAssignCommitteeTasks: true,
    });

    expect(modules.map((module) => module.key)).toEqual(["profile", "accounts", "work"]);
    expect(modules.find((module) => module.key === "work")?.description).toBe(
      "Create, assign, and manage committee tasks",
    );
  });

  it("keeps inaccessible workspace modules absent", () => {
    expect(dashboardWorkspaceModules(baseCapabilities)).toEqual([
      expect.objectContaining({ key: "profile", href: "/profile" }),
    ]);
  });

  it("orders active work by urgency without including completed tasks", () => {
    const tasks = [
      task({ id: "undated", dueDate: null, updatedAt: "2026-10-09T10:00:00Z" }),
      task({ id: "completed", status: "completed" }),
      task({ id: "nearest", dueDate: "2026-10-10" }),
      task({ id: "overdue", dueDate: "2026-10-01", isOverdue: true }),
    ];

    expect(activeDashboardTasks(tasks).map((item) => item.id)).toEqual([
      "overdue",
      "nearest",
      "undated",
    ]);
  });

  it("shows only future scheduled meetings in chronological order", () => {
    const meetings = [
      meeting({ id: "later", scheduledStart: "2026-10-20T10:00:00Z" }),
      meeting({ id: "past", scheduledStart: "2026-10-01T10:00:00Z" }),
      meeting({ id: "cancelled", status: "cancelled" }),
      meeting({ id: "next", scheduledStart: "2026-10-15T10:00:00Z" }),
    ];

    expect(
      upcomingDashboardMeetings(meetings, new Date("2026-10-09T00:00:00Z")).map((item) => item.id),
    ).toEqual(["next", "later"]);
  });
});

function task(overrides: Partial<CommitteeTaskSummary>): CommitteeTaskSummary {
  return {
    id: "task",
    title: "Committee task",
    description: null,
    priority: "normal",
    status: "assigned",
    assignmentMode: "direct",
    dueDate: null,
    isOverdue: false,
    sourceMeetingId: null,
    sourceMeetingDecisionId: null,
    createdByApplicationUserId: "creator",
    completedByApplicationUserId: null,
    completedAt: null,
    createdAt: "2026-10-01T10:00:00Z",
    updatedAt: "2026-10-01T10:00:00Z",
    assigneeIds: ["assignee"],
    ...overrides,
  };
}

function meeting(overrides: Partial<CommitteeMeetingSummary>): CommitteeMeetingSummary {
  return {
    id: "meeting",
    title: "Committee meeting",
    meetingType: "general",
    details: null,
    location: null,
    scheduledStart: "2026-10-12T10:00:00Z",
    scheduledEnd: null,
    status: "scheduled",
    createdByApplicationUserId: "creator",
    cancelledByApplicationUserId: null,
    cancelledAt: null,
    cancellationReason: null,
    createdAt: "2026-10-01T10:00:00Z",
    updatedAt: "2026-10-01T10:00:00Z",
    participantIds: [],
    ...overrides,
  };
}
