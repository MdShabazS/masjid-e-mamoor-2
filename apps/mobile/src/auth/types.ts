import type {
  ApplicationRole,
  ApplicationUserStatus,
  MemberProfile,
} from "@masjid-e-mamoor/types";

export interface MobileMemberProfile {
  id: string;
  displayName: string;
  phone: string | null;
  status: MemberProfile["status"];
}

export interface MobileAccount {
  id: string;
  authUserId: string;
  username: string | null;
  status: ApplicationUserStatus;
  role: ApplicationRole;
  mustChangePassword: boolean;
  memberProfile: MobileMemberProfile | null;
}

export function hasActiveMemberProfile(
  account: {
    memberProfile: Pick<MobileMemberProfile, "status"> | null;
  },
) {
  return account.memberProfile?.status === "active";
}

export type AuthRoute = "sign-in" | "change-password" | "app";

export function getAuthRoute(input: {
  hasSession: boolean;
  mustChangePassword: boolean;
}): AuthRoute {
  if (!input.hasSession) return "sign-in";
  return input.mustChangePassword ? "change-password" : "app";
}
