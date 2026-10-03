import {
  anonymousDonationCreateSchema,
  donationObligationGenerationSchema,
  donationObligationRuleCreateSchema,
  donationObligationWaiverSchema,
  donationPaymentRejectSchema,
  donationPaymentReviewSchema,
  donationPaymentSubmitSchema,
  donationPaymentVerifySchema,
  jummahCashDonationCreateSchema,
} from "@masjid-e-mamoor/validation";
import {
  canAttachDonationPaymentProof,
  deriveDonationCapabilities,
  deterministicDonationProofPath,
  DONATION_PROOF_MAX_BYTES,
  mapDonationOutstandingSnapshot,
  obligationStatusLabel,
  parseRupeesToPaise,
  paymentMethodLabel,
  paymentStatusLabel,
  validateDonationProofBytes,
  validateDonationProofMetadata,
} from "./donation-presentation";
import { hasActiveMemberProfile } from "../auth/types";

const paymentId = "00000000-0000-4000-8000-000000000001";
const obligationId = "00000000-0000-4000-8000-000000000002";

describe("mobile donation money", () => {
  it.each([
    ["1", 100],
    ["1.2", 120],
    ["1.23", 123],
    ["2500.00", 250000],
  ])("converts %s rupees to integer paise", (value, expected) => {
    expect(parseRupeesToPaise(value)).toBe(expected);
  });

  it.each(["", "-1", "1.234", "1,000", "abc"])("rejects invalid amount %s", (value) => {
    expect(parseRupeesToPaise(value)).toBeNull();
  });

  it("lets shared validation reject zero", () => {
    expect(donationPaymentSubmitSchema.safeParse({ amountPaise: parseRupeesToPaise("0"), paymentMethod: "upi", operationId: "op" }).success).toBe(false);
  });
});

describe("mobile donation capabilities", () => {
  const contributorPermissions = {
    obligationsRead: true,
    paymentsCreate: true,
    proofUpload: true,
    additionalCreate: true,
    paymentsVerify: false,
    paymentsAllocate: false,
    obligationsManage: false,
    anonymousCreate: false,
    jummahCreate: false,
  };

  it("enables contributor actions for an active member with permission", () => {
    const hasActiveProfile = hasActiveMemberProfile({
      memberProfile: { status: "active" },
    });
    const capabilities = deriveDonationCapabilities({
      ...contributorPermissions,
    }, hasActiveProfile);
    expect(capabilities.canReadDonations).toBe(true);
    expect(capabilities.canSubmitPayment).toBe(true);
    expect(capabilities.canUploadProof).toBe(true);
    expect(capabilities.canCreateAdditionalDonation).toBe(true);
    expect(capabilities.canManageDonations).toBe(false);
  });

  it.each([
    ["no member profile", null],
    ["inactive member profile", { id: "member-1", status: "inactive" as const }],
  ])("disables contributor actions with %s", (_label, memberProfile) => {
    const hasActiveProfile = hasActiveMemberProfile({ memberProfile });
    const capabilities = deriveDonationCapabilities(
      contributorPermissions,
      hasActiveProfile,
    );
    expect(capabilities.canSubmitPayment).toBe(false);
    expect(capabilities.canUploadProof).toBe(false);
    expect(capabilities.canCreateAdditionalDonation).toBe(false);
  });

  it("preserves staff read and management without a member profile", () => {
    const capabilities = deriveDonationCapabilities({
      ...contributorPermissions,
      paymentsVerify: true,
      paymentsAllocate: true,
      obligationsManage: true,
      anonymousCreate: true,
      jummahCreate: true,
    }, false);
    expect(capabilities.canReadDonations).toBe(true);
    expect(capabilities.canManageDonations).toBe(true);
    expect(capabilities.canVerifyAndAllocatePayments).toBe(true);
    expect(capabilities.canManageObligations).toBe(true);
    expect(capabilities.canCreateAnonymousDonation).toBe(true);
    expect(capabilities.canCreateJummahCashDonation).toBe(true);
    expect(capabilities.canSubmitPayment).toBe(false);
    expect(capabilities.canUploadProof).toBe(false);
    expect(capabilities.canCreateAdditionalDonation).toBe(false);
  });

  it("requires both resolved permissions for verify and allocate", () => {
    const capabilities = deriveDonationCapabilities({
      obligationsRead: true,
      paymentsCreate: false,
      proofUpload: false,
      additionalCreate: false,
      paymentsVerify: true,
      paymentsAllocate: false,
      obligationsManage: false,
      anonymousCreate: false,
      jummahCreate: false,
    }, false);
    expect(capabilities.canReviewPayments).toBe(true);
    expect(capabilities.canVerifyAndAllocatePayments).toBe(false);
    expect(capabilities.canManageDonations).toBe(true);
  });
});

describe("authoritative donation snapshot", () => {
  it("maps every database balance field without recomputing it", () => {
    const snapshot = mapDonationOutstandingSnapshot({
      total_outstanding_paise: 777,
      obligation_count: 1,
      obligations: [{
        id: obligationId,
        member_profile_id: paymentId,
        obligation_rule_id: null,
        effective_month: "2026-09-01",
        authoritative_amount_paise: 1000,
        allocated_amount_paise: 100,
        waived_amount_paise: 50,
        outstanding_amount_paise: 777,
        status: "partially_paid",
        created_at: "2026-09-01T00:00:00Z",
      }],
    });
    expect(snapshot.totalOutstandingPaise).toBe(777);
    expect(snapshot.obligations[0]).toMatchObject({
      authoritativeAmountPaise: 1000,
      allocatedAmountPaise: 100,
      waivedAmountPaise: 50,
      outstandingAmountPaise: 777,
      status: "partially_paid",
    });
  });
});

describe("donation payment presentation and payload validation", () => {
  it("labels every payment method and current state", () => {
    expect(["cash", "upi", "bank_transfer", "other"].map((value) => paymentMethodLabel(value as never))).toEqual(["Cash", "UPI", "Bank transfer", "Other"]);
    expect(["submitted", "under_review", "verified", "rejected"].map((value) => paymentStatusLabel(value as never))).toEqual(["Submitted", "Under review", "Verified", "Rejected"]);
    expect(obligationStatusLabel("partially_paid")).toBe("Partially paid");
  });

  it("validates submit, review, reject, and verify payloads", () => {
    expect(donationPaymentSubmitSchema.safeParse({ amountPaise: 100, paymentMethod: "upi", operationId: "op-1" }).success).toBe(true);
    expect(donationPaymentReviewSchema.safeParse({ paymentId, operationId: "op-2" }).success).toBe(true);
    expect(donationPaymentRejectSchema.safeParse({ paymentId, reason: "Duplicate payment", operationId: "op-3" }).success).toBe(true);
    expect(donationPaymentRejectSchema.safeParse({ paymentId, reason: "", operationId: "op-4" }).success).toBe(false);
    expect(
      donationPaymentVerifySchema.safeParse({
        paymentId,
        financeAccountId:
          "00000000-0000-4000-8000-000000000003",
        businessDate: "2026-10-04",
        operationId: "op-5",
      }).success,
    ).toBe(true);

    expect(
      donationPaymentVerifySchema.safeParse({
        paymentId,
        businessDate: "2026-10-04",
        operationId: "op-6",
      }).success,
    ).toBe(false);

    expect(
      donationPaymentVerifySchema.safeParse({
        paymentId,
        financeAccountId:
          "00000000-0000-4000-8000-000000000003",
        businessDate: "2026-02-31",
        operationId: "op-7",
      }).success,
    ).toBe(false);
  });
});

describe("donation proof validation", () => {
  it("accepts supported types and enforces the 5 MiB boundary", () => {
    expect(validateDonationProofMetadata("image/jpeg", DONATION_PROOF_MAX_BYTES)).toBeNull();
    expect(validateDonationProofMetadata("text/plain", 10)).toContain("JPEG");
    expect(validateDonationProofMetadata("application/pdf", DONATION_PROOF_MAX_BYTES + 1)).toContain("5 MiB");
  });

  it("checks magic bytes and constructs the canonical deterministic path", () => {
    expect(validateDonationProofBytes("application/pdf", new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]))).toBeNull();
    expect(validateDonationProofBytes("image/png", new Uint8Array([1, 2, 3]))).not.toBeNull();
    expect(deterministicDonationProofPath(paymentId, "a".repeat(64), "image/png")).toBe(`${paymentId}/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa.png`);
  });

  it.each([
    ["own active payment", { memberProfile: { id: "member-1", status: "active" as const }, paymentMemberProfileId: "member-1", paymentStatus: "submitted" as const, proofCount: 0 }, true],
    ["own inactive membership", { memberProfile: { id: "member-1", status: "inactive" as const }, paymentMemberProfileId: "member-1", paymentStatus: "submitted" as const, proofCount: 0 }, false],
    ["another member's payment", { memberProfile: { id: "member-1", status: "active" as const }, paymentMemberProfileId: "member-2", paymentStatus: "submitted" as const, proofCount: 0 }, false],
    ["verified payment", { memberProfile: { id: "member-1", status: "active" as const }, paymentMemberProfileId: "member-1", paymentStatus: "verified" as const, proofCount: 0 }, false],
    ["rejected payment", { memberProfile: { id: "member-1", status: "active" as const }, paymentMemberProfileId: "member-1", paymentStatus: "rejected" as const, proofCount: 0 }, false],
    ["existing proof", { memberProfile: { id: "member-1", status: "active" as const }, paymentMemberProfileId: "member-1", paymentStatus: "under_review" as const, proofCount: 1 }, false],
  ])("gates proof attachment for %s", (_label, input, expected) => {
    expect(canAttachDonationPaymentProof({
      canUploadProof: true,
      ...input,
    })).toBe(expected);
  });
});

describe("donation management validation", () => {
  it("validates waiver, rule, generation, anonymous, and Jummah payloads", () => {
    expect(donationObligationWaiverSchema.safeParse({ obligationId, waivedAmountPaise: 100, reason: "Approved correction", operationId: "op-1" }).success).toBe(true);
    expect(donationObligationRuleCreateSchema.safeParse({ effectiveFromMonth: "2026-10", monthlyAmountPaise: 10000, operationId: "op-2" }).success).toBe(true);
    expect(donationObligationGenerationSchema.safeParse({ effectiveMonth: "2026-10", operationId: "op-3" }).success).toBe(true);
    expect(anonymousDonationCreateSchema.safeParse({ amountPaise: 100, operationId: "op-4" }).success).toBe(true);
    expect(jummahCashDonationCreateSchema.safeParse({ amountPaise: 100, operationId: "op-5" }).success).toBe(true);
    expect(donationObligationGenerationSchema.safeParse({ effectiveMonth: "10-2026", operationId: "op-6" }).success).toBe(false);
  });
});
