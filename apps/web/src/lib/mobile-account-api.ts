import "server-only";

import type { ApplicationRole, ApplicationUserStatus } from "@masjid-e-mamoor/types";
import type { AccountRecord } from "@/lib/accounts/server";

export interface MobileManagedAccount {
  id: string;
  username: string | null;
  status: ApplicationUserStatus;
  role: ApplicationRole;
  mustChangePassword: boolean;
  credentialUpdatedAt: string;
  createdAt: string;
  displayName: string | null;
}

export function toMobileManagedAccount(
  account: AccountRecord,
): MobileManagedAccount {
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
