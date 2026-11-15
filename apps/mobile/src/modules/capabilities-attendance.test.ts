import type { MobileAccount } from "../auth/types";
import { canMemberRecordOwnJummahAttendance } from "./jummah-attendance-permission";

const account = (role: MobileAccount["role"], status: "active" | "inactive" = "active") => ({
  id: "app-user",
  authUserId: "auth-user",
  username: null,
  status: "active",
  role,
  mustChangePassword: false,
  memberProfile: { id: "profile", displayName: "Member", phone: null, status },
}) satisfies MobileAccount;

describe("Member self-attendance capability", () => {
  it("requires the server permission, Member role, and active profile", () => {
    expect(canMemberRecordOwnJummahAttendance(account("member"), true)).toBe(true);
    expect(canMemberRecordOwnJummahAttendance(account("member"), false)).toBe(false);
    expect(canMemberRecordOwnJummahAttendance(account("president"), true)).toBe(false);
    expect(canMemberRecordOwnJummahAttendance(account("member", "inactive"), true)).toBe(false);
  });
});
