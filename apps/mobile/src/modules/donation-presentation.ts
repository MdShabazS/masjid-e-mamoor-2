import type {
  DonationObligationStatus,
  DonationOutstandingSnapshot,
  DonationPaymentMethod,
  DonationPaymentStatus,
} from "@masjid-e-mamoor/types";

type DbRow = Record<string, unknown>;

export interface ResolvedDonationPermissions {
  obligationsRead: boolean;
  paymentsCreate: boolean;
  proofUpload: boolean;
  additionalCreate: boolean;
  paymentsVerify: boolean;
  paymentsAllocate: boolean;
  obligationsManage: boolean;
  anonymousCreate: boolean;
  jummahCreate: boolean;
}

export function deriveDonationCapabilities(
  permissions: ResolvedDonationPermissions,
) {
  const canVerifyAndAllocatePayments =
    permissions.paymentsVerify && permissions.paymentsAllocate;
  return {
    canReadDonations: permissions.obligationsRead,
    canSubmitPayment: permissions.paymentsCreate,
    canUploadProof: permissions.proofUpload,
    canCreateAdditionalDonation: permissions.additionalCreate,
    canReviewPayments: permissions.paymentsVerify,
    canAllocatePayments: permissions.paymentsAllocate,
    canVerifyAndAllocatePayments,
    canManageObligations: permissions.obligationsManage,
    canCreateAnonymousDonation: permissions.anonymousCreate,
    canCreateJummahCashDonation: permissions.jummahCreate,
    canManageDonations:
      permissions.paymentsVerify ||
      permissions.paymentsAllocate ||
      permissions.obligationsManage ||
      permissions.anonymousCreate ||
      permissions.jummahCreate,
  };
}

export const DONATION_PROOF_BUCKET = "donation-payment-proofs";
export const DONATION_PROOF_MAX_BYTES = 5 * 1024 * 1024;

const proofExtensions: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "application/pdf": "pdf",
};

export function parseRupeesToPaise(raw: string): number | null {
  const value = raw.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(value)) return null;

  const [rupees, fraction = ""] = value.split(".");
  try {
    const paise =
      BigInt(rupees) * BigInt(100) + BigInt(fraction.padEnd(2, "0"));
    return paise <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(paise) : null;
  } catch {
    return null;
  }
}

export function formatPaise(amountPaise: number) {
  const absolute = Math.abs(amountPaise);
  const rupees = Math.floor(absolute / 100);
  const paise = absolute % 100;
  const formatted = `${rupees.toLocaleString("en-IN")}.${String(paise).padStart(2, "0")}`;
  return `${amountPaise < 0 ? "-" : ""}₹${formatted}`;
}

export function formatDonationDate(value: string) {
  return new Date(value).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatDonationMonth(value: string) {
  const [year, month] = value.slice(0, 10).split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });
}

const paymentMethodLabels: Record<DonationPaymentMethod, string> = {
  cash: "Cash",
  upi: "UPI",
  bank_transfer: "Bank transfer",
  other: "Other",
};

const paymentStatusLabels: Record<DonationPaymentStatus, string> = {
  submitted: "Submitted",
  under_review: "Under review",
  verified: "Verified",
  rejected: "Rejected",
};

const obligationStatusLabels: Record<DonationObligationStatus, string> = {
  outstanding: "Outstanding",
  partially_paid: "Partially paid",
  paid: "Paid",
  waived: "Waived",
};

export function paymentMethodLabel(method: DonationPaymentMethod) {
  return paymentMethodLabels[method];
}

export function paymentStatusLabel(status: DonationPaymentStatus) {
  return paymentStatusLabels[status];
}

export function obligationStatusLabel(status: DonationObligationStatus) {
  return obligationStatusLabels[status];
}

function asNumber(value: unknown) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 0) {
    throw new Error("invalid_donation_snapshot");
  }
  return number;
}

export function mapDonationOutstandingSnapshot(
  value: unknown,
): DonationOutstandingSnapshot {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("invalid_donation_snapshot");
  }

  const snapshot = value as DbRow;
  if (!Array.isArray(snapshot.obligations)) {
    throw new Error("invalid_donation_snapshot");
  }

  return {
    totalOutstandingPaise: asNumber(snapshot.total_outstanding_paise),
    obligationCount: asNumber(snapshot.obligation_count),
    obligations: snapshot.obligations.map((value) => {
      if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw new Error("invalid_donation_snapshot");
      }
      const row = value as DbRow;
      return {
        id: String(row.id),
        memberProfileId: String(row.member_profile_id),
        obligationRuleId:
          row.obligation_rule_id == null ? null : String(row.obligation_rule_id),
        effectiveMonth: String(row.effective_month),
        authoritativeAmountPaise: asNumber(row.authoritative_amount_paise),
        allocatedAmountPaise: asNumber(row.allocated_amount_paise),
        waivedAmountPaise: asNumber(row.waived_amount_paise),
        outstandingAmountPaise: asNumber(row.outstanding_amount_paise),
        status: row.status as DonationObligationStatus,
        createdAt: String(row.created_at),
      };
    }),
  };
}

export function donationProofExtension(mimeType: string) {
  return proofExtensions[mimeType] ?? null;
}

export function validateDonationProofMetadata(
  mimeType: string | null | undefined,
  size: number | null | undefined,
) {
  if (!mimeType || !donationProofExtension(mimeType)) {
    return "Proof must be JPEG, PNG, or PDF.";
  }
  if (size != null && size < 1) return "Proof file is empty.";
  if (size != null && size > DONATION_PROOF_MAX_BYTES) {
    return "Proof file must not exceed 5 MiB.";
  }
  return null;
}

export function validateDonationProofBytes(
  mimeType: string,
  bytes: Uint8Array,
) {
  if (bytes.byteLength < 1) return "Proof file is empty.";
  if (bytes.byteLength > DONATION_PROOF_MAX_BYTES) {
    return "Proof file must not exceed 5 MiB.";
  }

  const signatures: Record<string, number[]> = {
    "image/jpeg": [0xff, 0xd8, 0xff],
    "image/png": [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
    "application/pdf": [0x25, 0x50, 0x44, 0x46, 0x2d],
  };
  const signature = signatures[mimeType];
  if (!signature || !signature.every((byte, index) => bytes[index] === byte)) {
    return "Proof content does not match its selected file type.";
  }
  return null;
}

export function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function deterministicDonationProofPath(
  paymentId: string,
  digestHex: string,
  mimeType: string,
) {
  const extension = donationProofExtension(mimeType);
  if (!extension || !/^[0-9a-f]{64}$/i.test(digestHex)) {
    throw new Error("invalid_donation_proof");
  }
  const proofId = [
    digestHex.slice(0, 8),
    digestHex.slice(8, 12),
    digestHex.slice(12, 16),
    digestHex.slice(16, 20),
    digestHex.slice(20, 32),
  ].join("-");
  return `${paymentId}/${proofId}.${extension}`;
}
