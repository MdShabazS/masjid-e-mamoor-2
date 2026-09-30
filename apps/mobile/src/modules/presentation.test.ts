import { mergeMemberPages, referralStatusLabel, visibleWorkspaceModules } from "./presentation";

describe("mobile workspace presentation", () => {
  it("only exposes modules granted by resolved capabilities", () => {
    expect(
      visibleWorkspaceModules({
        canReadMembers: false,
        canUpdateMembers: false,
        canCreateReferral: false,
        canUseReferrals: true,
        canManageReferrals: false,
      }),
    ).toEqual(["profile", "referrals"]);
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
