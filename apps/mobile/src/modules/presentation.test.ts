import { referralStatusLabel, visibleWorkspaceModules } from "./presentation";

describe("mobile workspace presentation", () => {
  it("only exposes modules granted by resolved capabilities", () => {
    expect(
      visibleWorkspaceModules({
        canReadMembers: false,
        canUpdateMembers: false,
        canUseReferrals: true,
        canManageReferrals: false,
      }),
    ).toEqual(["profile", "referrals"]);
  });

  it("maps referral lifecycle states for display", () => {
    expect(referralStatusLabel("submitted")).toBe("Submitted");
    expect(referralStatusLabel("completed")).toBe("Completed");
  });
});
