export const APPLICATION_ROLES = [
  "president",
  "vice_president",
  "secretary",
  "finance",
  "auditor",
  "committee_member",
  "member",
] as const;

export type ApplicationRole = (typeof APPLICATION_ROLES)[number];

export const APPLICATION_USER_STATUSES = [
  "pending",
  "active",
  "restricted",
  "deactivated",
] as const;

export type ApplicationUserStatus =
  (typeof APPLICATION_USER_STATUSES)[number];

export interface AuthApplicationUser {
  id: string;
  authUserId: string;
  status: ApplicationUserStatus;
  role: ApplicationRole;
}

export interface AuthContext {
  userId: string;
  applicationUserId: string;
  status: ApplicationUserStatus;
  role: ApplicationRole;
  permissions: string[];
}

export interface MemberProfile {
  id: string;
  applicationUserId: string;
  status: "active" | "inactive";
  displayName: string;
  phone: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MemberPageCursor {
  createdAt: string;
  id: string;
}

export type DonationPaymentStatus =
  | "submitted"
  | "under_review"
  | "verified"
  | "rejected";

export type DonationPaymentMethod =
  | "cash"
  | "upi"
  | "bank_transfer"
  | "other";

export type DonationObligationStatus =
  | "outstanding"
  | "partially_paid"
  | "paid"
  | "waived";

export interface DonationObligation {
  id: string;
  memberProfileId: string;
  obligationRuleId: string | null;
  effectiveMonth: string;
  authoritativeAmountPaise: number;
  status: DonationObligationStatus;
  createdAt: string;
}

export interface DonationOutstandingObligation {
  id: string;
  memberProfileId: string;
  obligationRuleId: string | null;
  effectiveMonth: string;
  authoritativeAmountPaise: number;
  allocatedAmountPaise: number;
  waivedAmountPaise: number;
  outstandingAmountPaise: number;
  status: DonationObligationStatus;
  createdAt: string;
}

export interface DonationOutstandingSnapshot {
  totalOutstandingPaise: number;
  obligationCount: number;
  obligations: DonationOutstandingObligation[];
}

export interface DonationPayment {
  id: string;
  memberProfileId: string;
  amountPaise: number;
  paymentMethod: DonationPaymentMethod;
  status: DonationPaymentStatus;
  submittedByApplicationUserId: string;
  reviewedByApplicationUserId: string | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DonationPaymentAllocation {
  id: string;
  paymentId: string;
  obligationId: string;
  allocatedAmountPaise: number;
  allocationSequence: number;
  createdAt: string;
}

export interface DonationObligationWaiver {
  id: string;
  obligationId: string;
  waivedAmountPaise: number;
  reason: string;
  actorApplicationUserId: string;
  createdAt: string;
}

export interface AdditionalDonation {
  id: string;
  memberProfileId: string | null;
  sourcePaymentId: string | null;
  donationKind: string;
  amountPaise: number;
  createdAt: string;
}

export interface DonationObligationRule {
  id: string;
  effectiveFromMonth: string;
  monthlyAmountPaise: number;
  createdAt: string;
}
