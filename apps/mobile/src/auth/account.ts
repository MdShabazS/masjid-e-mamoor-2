import type { ApplicationRole } from "@masjid-e-mamoor/types";
import type { MobileAccount } from "./types";
import { supabase } from "../lib/supabase";

function asRole(value: unknown): ApplicationRole {
  const roles: ApplicationRole[] = [
    "system_admin",
    "president",
    "vice_president",
    "secretary",
    "finance",
    "auditor",
    "committee_member",
    "member",
  ];
  if (typeof value !== "string" || !roles.includes(value as ApplicationRole)) {
    throw new Error("account_role_missing");
  }
  return value as ApplicationRole;
}

export async function loadOwnAccount(): Promise<MobileAccount | null> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return null;

  const { data: account, error: accountError } = await supabase
    .from("application_users")
    .select("id, auth_user_id, username, status, must_change_password")
    .eq("auth_user_id", userData.user.id)
    .maybeSingle();

  if (accountError || !account) return null;

  const { data: assignment, error: roleError } = await supabase
    .from("application_user_roles")
    .select("roles(key)")
    .eq("application_user_id", account.id)
    .maybeSingle();

  if (roleError || !assignment) throw new Error("account_role_missing");

  const roleRow = assignment.roles;
  const roleKey =
    roleRow && !Array.isArray(roleRow)
      ? (roleRow as { key?: unknown }).key
      : undefined;

  let memberProfile: MobileAccount["memberProfile"] = null;
  const { data: profile } = await supabase
    .from("member_profiles")
    .select("display_name, phone")
    .eq("application_user_id", account.id)
    .maybeSingle();

  if (profile) {
    memberProfile = {
      displayName: String(profile.display_name),
      phone: profile.phone == null ? null : String(profile.phone),
    };
  }

  return {
    id: String(account.id),
    authUserId: String(account.auth_user_id),
    username: account.username == null ? null : String(account.username),
    status: account.status,
    role: asRole(roleKey),
    mustChangePassword: account.must_change_password === true,
    memberProfile,
  };
}
