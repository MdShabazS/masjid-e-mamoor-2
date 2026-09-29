import type { ApplicationRole, ApplicationUserStatus } from "@masjid-e-mamoor/types";

export interface MobileMemberProfile {
  displayName: string;
  phone: string | null;
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

export type AuthRoute = "sign-in" | "change-password" | "app";

export function getAuthRoute(input: {
  hasSession: boolean;
  mustChangePassword: boolean;
}): AuthRoute {
  if (!input.hasSession) return "sign-in";
  return input.mustChangePassword ? "change-password" : "app";
}
