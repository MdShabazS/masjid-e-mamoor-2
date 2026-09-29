import { roleLabels } from "./colors";

describe("mobile role labels", () => {
  it("maps canonical roles to human-readable labels", () => {
    expect(roleLabels.system_admin).toBe("System Admin");
    expect(roleLabels.committee_member).toBe("Committee Member");
    expect(roleLabels.member).toBe("Member");
  });
});
