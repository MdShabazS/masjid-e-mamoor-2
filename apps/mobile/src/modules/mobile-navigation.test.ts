import type { MobileAccount } from "../auth/types";
import type { MobileCapabilities } from "./capabilities";
import { moreMobileModules, primaryMobileTabs } from "./mobile-navigation";

const roles: MobileAccount["role"][] = [
  "system_admin", "president", "vice_president", "secretary",
  "finance", "auditor", "committee_member", "member",
];

const capabilities = {
  canReadNotifications: true,
  canManageAnnouncements: true,
  canManageAccounts: true,
  canReadMembers: true,
  canUseReferrals: true,
  canReadDonations: true,
  canReadFinanceAccounts: true,
  canReadCommitteeTasks: true,
  canReadCommitteeMeetings: true,
} as MobileCapabilities;

describe("role-aware mobile navigation", () => {
  it.each(roles)("keeps %s navigation within five capability-backed tabs", (role) => {
    const tabs = primaryMobileTabs(role, capabilities);
    expect(tabs[0]).toBe("home");
    expect(tabs.length).toBeGreaterThanOrEqual(3);
    expect(tabs.length).toBeLessThanOrEqual(5);
    expect(new Set(tabs).size).toBe(tabs.length);
  });

  it("never exposes unauthorized destinations through tabs or More", () => {
    const restricted = {
      ...capabilities,
      canManageAccounts: false,
      canReadMembers: false,
      canUseReferrals: false,
      canReadFinanceAccounts: false,
      canReadDonations: false,
      canReadCommitteeMeetings: false,
      canManageAnnouncements: false,
    };
    const destinations = [
      ...primaryMobileTabs("committee_member", restricted),
      ...moreMobileModules("committee_member", restricted).map((item) => item.key),
    ];
    expect(destinations).toEqual(expect.arrayContaining(["home", "tasks", "notifications", "profile"]));
    expect(destinations).not.toEqual(expect.arrayContaining(["accounts", "finance", "donations", "announcements", "meetings"]));
  });

  it("prioritizes Finance modules without granting task assignment", () => {
    expect(primaryMobileTabs("finance", capabilities).slice(0, 3)).toEqual(["home", "donations", "finance"]);
  });
});
