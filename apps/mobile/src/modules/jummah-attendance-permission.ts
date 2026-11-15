import { hasActiveMemberProfile, type MobileAccount } from "../auth/types";

export function canMemberRecordOwnJummahAttendance(
  account: MobileAccount,
  hasCreatePermission: boolean,
) {
  return account.role === "member" &&
    hasCreatePermission &&
    hasActiveMemberProfile(account);
}
