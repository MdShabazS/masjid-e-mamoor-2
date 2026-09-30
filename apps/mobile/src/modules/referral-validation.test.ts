import { referralRejectSchema } from "@masjid-e-mamoor/validation";

describe("mobile referral rejection validation", () => {
  const referralId = "00000000-0000-4000-8000-000000000001";

  it("accepts an omitted or empty reason as null", () => {
    expect(referralRejectSchema.parse({ referralId, operationId: "op-1", reason: null }).reason).toBeNull();
    expect(referralRejectSchema.parse({ referralId, operationId: "op-2", reason: "" }).reason).toBe("");
  });

  it("accepts a reviewer-entered reason", () => {
    expect(referralRejectSchema.parse({ referralId, operationId: "op-3", reason: "Phone number could not be verified." }).reason).toContain("verified");
  });

  it("rejects a reason over the existing maximum", () => {
    expect(referralRejectSchema.safeParse({ referralId, operationId: "op-4", reason: "x".repeat(501) }).success).toBe(false);
  });
});
