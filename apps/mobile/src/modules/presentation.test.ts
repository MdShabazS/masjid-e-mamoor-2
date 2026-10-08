import type { MobileCapabilities } from "./capabilities";
import { mergeMemberPages, referralStatusLabel, visibleWorkspaceModules } from "./presentation";

describe("mobile workspace presentation", () => {
  it("only exposes modules granted by resolved capabilities", () => {
    expect(
      visibleWorkspaceModules({
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
        canUseReferrals: true,
        canManageReferrals: false,
        canReadDonations: true,
        canSubmitPayment: true,
        canUploadProof: true,
        canCreateAdditionalDonation: true,
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
      }),
    ).toEqual(["profile", "referrals", "donations"]);
  });

  it("shows account administration only for resolved account managers", () => {
    const capabilities: MobileCapabilities = {
      canManageAccounts: true,
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
      canReadCommitteeTasks: true,
      canManageCommitteeTasks: true,
      canAssignCommitteeTasks: true,
    };

    expect(visibleWorkspaceModules(capabilities)).toEqual([
      "profile",
      "accounts",
      "work",
    ]);
  });

  it("shows Finance workspace from resolved Finance read permissions", () => {
    const capabilities: MobileCapabilities = {
      canManageAccounts: false,
      canReadFinanceAccounts: true,
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
    };

    expect(visibleWorkspaceModules(capabilities)).toEqual([
      "profile",
      "finance",
    ]);

    expect(
      visibleWorkspaceModules({
        ...capabilities,
        canReadFinanceAccounts: false,
        canReadFinanceReconciliation: true,
      }),
    ).toEqual(["profile", "finance"]);
  });

  it("maps referral lifecycle states for display", () => {
    expect(referralStatusLabel("submitted")).toBe("Submitted");
    expect(referralStatusLabel("completed")).toBe("Completed");
  });

  it("labels current referral statuses", () => {
    expect(["pending", "submitted", "approved", "rejected", "completed", "cancelled"].map(referralStatusLabel)).toEqual([
      "Pending", "Submitted", "Approved", "Rejected", "Completed", "Cancelled",
    ]);
  });

  it("keeps all member pages available through the end cursor", () => {
    const member = (id: string) => ({ id, applicationUserId: id, status: "active" as const, displayName: id, phone: null, createdAt: id, updatedAt: id });
    expect(mergeMemberPages([
      { members: [member("page-1")] },
      { members: [member("page-2")] },
      { members: [member("page-3")] },
    ]).map((item) => item.id)).toEqual(["page-1", "page-2", "page-3"]);
  });
});
