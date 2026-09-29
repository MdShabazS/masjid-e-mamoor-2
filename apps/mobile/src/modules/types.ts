export interface MobileMember {
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

export interface MobileReferral {
  id: string;
  referralCode: string;
  status: string;
  applicantDisplayName: string | null;
  applicantPhone: string | null;
  referrerDisplayName: string | null;
  createdAt: string;
  submittedAt: string | null;
  reviewedAt: string | null;
  reviewReason: string | null;
  completedAt: string | null;
}
