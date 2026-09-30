import type { Session } from "@supabase/supabase-js";
import type {
  ApplicationRole,
  ApplicationUserStatus,
} from "@masjid-e-mamoor/types";
import { getMobileConfig } from "../lib/config";

export type AccountProvisionRole = Exclude<ApplicationRole, "system_admin">;

export interface ManagedAccount {
  id: string;
  username: string | null;
  status: ApplicationUserStatus;
  role: ApplicationRole;
  mustChangePassword: boolean;
  credentialUpdatedAt: string;
  createdAt: string;
  displayName: string | null;
}

const presidentRoles: readonly AccountProvisionRole[] = [
  "vice_president",
  "secretary",
  "finance",
  "auditor",
  "committee_member",
  "member",
];

const systemAdminRoles: readonly AccountProvisionRole[] = [
  "president",
  ...presidentRoles,
];

export function canAccessAccountAdministration(role: ApplicationRole) {
  return role === "system_admin" || role === "president";
}

export function availableAccountRoles(
  actorRole: ApplicationRole,
): readonly AccountProvisionRole[] {
  if (actorRole === "system_admin") return systemAdminRoles;
  if (actorRole === "president") return presidentRoles;
  return [];
}

export function isProtectedSystemAdminTarget(account: ManagedAccount) {
  return account.role === "system_admin";
}

export function canChangeAccountStatus(
  actorId: string,
  target: ManagedAccount,
  accounts: readonly ManagedAccount[],
) {
  if (target.status === "deactivated") return true;
  if (target.role !== "system_admin") return true;

  const activeSystemAdmins = accounts.filter(
    (account) =>
      account.role === "system_admin" && account.status === "active",
  ).length;

  return target.id !== actorId && activeSystemAdmins > 1;
}

export function accountStatusLabel(status: ApplicationUserStatus) {
  return status === "active" ? "Active" : "Deactivated";
}

export function accountDirectoryQueryKey(actorId: string | undefined) {
  return ["accounts", actorId] as const;
}

function isRole(value: unknown): value is ApplicationRole {
  return [
    "system_admin",
    "president",
    "vice_president",
    "secretary",
    "finance",
    "auditor",
    "committee_member",
    "member",
  ].includes(String(value));
}

function isStatus(value: unknown): value is ApplicationUserStatus {
  return value === "active" || value === "deactivated";
}

export function parseManagedAccount(value: unknown): ManagedAccount | null {
  if (!value || typeof value !== "object") return null;
  const account = value as Record<string, unknown>;

  if (
    typeof account.id !== "string" ||
    !(typeof account.username === "string" || account.username === null) ||
    !isStatus(account.status) ||
    !isRole(account.role) ||
    typeof account.mustChangePassword !== "boolean" ||
    typeof account.credentialUpdatedAt !== "string" ||
    typeof account.createdAt !== "string" ||
    !(typeof account.displayName === "string" || account.displayName === null)
  ) {
    return null;
  }

  return {
    id: account.id,
    username: account.username,
    status: account.status,
    role: account.role,
    mustChangePassword: account.mustChangePassword,
    credentialUpdatedAt: account.credentialUpdatedAt,
    createdAt: account.createdAt,
    displayName: account.displayName,
  };
}

export function parseTemporaryPassword(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const temporaryPassword = (value as Record<string, unknown>)
    .temporaryPassword;
  return typeof temporaryPassword === "string"
    ? { temporaryPassword }
    : null;
}

async function accountRequest(
  session: Session,
  path: string,
  method: "GET" | "POST",
  body?: unknown,
) {
  const { apiUrl } = getMobileConfig();
  const response = await fetch(`${apiUrl}/api/mobile/accounts${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  if (!response.ok) throw new Error("account_request_failed");

  try {
    return (await response.json()) as unknown;
  } catch {
    throw new Error("account_request_failed");
  }
}

export async function listManagedAccounts(session: Session) {
  const result = await accountRequest(session, "", "GET");
  if (!result || typeof result !== "object") {
    throw new Error("account_request_failed");
  }

  const accounts = (result as { accounts?: unknown }).accounts;
  if (!Array.isArray(accounts)) throw new Error("account_request_failed");

  const parsed = accounts.map(parseManagedAccount);
  if (parsed.some((account) => account === null)) {
    throw new Error("account_request_failed");
  }

  return parsed as ManagedAccount[];
}

export async function createManagedAccount(
  session: Session,
  input: {
    username: string;
    role: AccountProvisionRole;
    displayName?: string;
  },
) {
  const result = await accountRequest(session, "/create", "POST", input);
  if (!result || typeof result !== "object") {
    throw new Error("account_request_failed");
  }

  const accountId = (result as Record<string, unknown>).accountId;
  const credential = parseTemporaryPassword(result);
  if (typeof accountId !== "string" || !credential) {
    throw new Error("account_request_failed");
  }

  return { accountId, temporaryPassword: credential.temporaryPassword };
}

export async function changeManagedAccountUsername(
  session: Session,
  accountId: string,
  username: string,
) {
  await accountRequest(session, "/change-username", "POST", {
    accountId,
    username,
  });
}

export async function changeManagedAccountRole(
  session: Session,
  accountId: string,
  role: AccountProvisionRole,
) {
  await accountRequest(session, "/change-role", "POST", {
    accountId,
    role,
  });
}

export async function changeManagedAccountStatus(
  session: Session,
  accountId: string,
  status: ApplicationUserStatus,
) {
  await accountRequest(session, "/change-status", "POST", {
    accountId,
    status,
  });
}

export async function resetManagedAccountPassword(
  session: Session,
  accountId: string,
) {
  const result = await accountRequest(session, "/reset-password", "POST", {
    accountId,
  });
  const credential = parseTemporaryPassword(result);
  if (!credential) throw new Error("account_request_failed");
  return credential;
}
