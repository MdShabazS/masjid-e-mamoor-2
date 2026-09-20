import type { ApplicationRole } from "@masjid-e-mamoor/types";

export const APP_NAME = "Masjid-e-Mamoor";

export const APPLICATION_ROLES = [
  "president",
  "vice_president",
  "secretary",
  "finance",
  "auditor",
  "committee_member",
  "member",
] as const satisfies readonly ApplicationRole[];

export function isApplicationRole(value: string): value is ApplicationRole {
  return (APPLICATION_ROLES as readonly string[]).includes(value);
}
