import type { MobileAccount } from "../auth/types";
import { supabase } from "../lib/supabase";

export interface MobileCapabilities {
  canReadMembers: boolean;
  canUpdateMembers: boolean;
  canUseReferrals: boolean;
  canManageReferrals: boolean;
}

async function hasPermission(permission: string) {
  const { data, error } = await supabase.rpc("has_application_permission", {
    requested_permission: permission,
  });
  return !error && data === true;
}

export async function loadCapabilities(
  account: MobileAccount,
): Promise<MobileCapabilities> {
  const [memberRead, memberUpdate, referralCreate] = await Promise.all([
    supabase.rpc("can_use_member_admin_read_operations"),
    hasPermission("membership.members.update"),
    hasPermission("membership.referrals.create"),
  ]);

  const canManageReferrals =
    account.role === "president" || account.role === "system_admin";

  return {
    canReadMembers: !memberRead.error && memberRead.data === true,
    canUpdateMembers: memberUpdate,
    canUseReferrals: canManageReferrals || referralCreate,
    canManageReferrals,
  };
}
