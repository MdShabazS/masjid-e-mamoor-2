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
