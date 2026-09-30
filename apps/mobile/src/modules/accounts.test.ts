import {
  accountDirectoryQueryKey,
  accountStatusLabel,
  availableAccountRoles,
  canAccessAccountAdministration,
  canChangeAccountStatus,
  isProtectedSystemAdminTarget,
  parseManagedAccount,
  parseTemporaryPassword,
  type ManagedAccount,
} from "./accounts";

const account = (
  overrides: Partial<ManagedAccount> = {},
): ManagedAccount => ({
  id: "00000000-0000-4000-8000-000000000001",
  username: "member.user",
  status: "active",
  role: "member",
  mustChangePassword: false,
  credentialUpdatedAt: "2026-09-30T00:00:00.000Z",
  createdAt: "2026-09-29T00:00:00.000Z",
  displayName: "Member User",
  ...overrides,
});

describe("mobile account administration policy presentation", () => {
  it("limits entry presentation to System Admin and President", () => {
    expect(canAccessAccountAdministration("system_admin")).toBe(true);
    expect(canAccessAccountAdministration("president")).toBe(true);
    expect(canAccessAccountAdministration("vice_president")).toBe(false);
    expect(canAccessAccountAdministration("member")).toBe(false);
  });

  it("offers only roles each authorized actor may provision", () => {
    expect(availableAccountRoles("system_admin")).toEqual([
      "president",
      "vice_president",
      "secretary",
      "finance",
      "auditor",
      "committee_member",
      "member",
    ]);
    expect(availableAccountRoles("president")).toEqual([
      "vice_president",
      "secretary",
      "finance",
      "auditor",
      "committee_member",
      "member",
    ]);
    expect(availableAccountRoles("member")).toEqual([]);
    expect(availableAccountRoles("system_admin")).not.toContain(
      "system_admin",
    );
  });

  it("protects System Admin role and final/self deactivation controls", () => {
    const actor = account({ id: "admin-1", role: "system_admin" });
    const secondAdmin = account({ id: "admin-2", role: "system_admin" });

    expect(isProtectedSystemAdminTarget(actor)).toBe(true);
    expect(canChangeAccountStatus(actor.id, actor, [actor, secondAdmin])).toBe(
      false,
    );
    expect(canChangeAccountStatus(actor.id, secondAdmin, [actor])).toBe(false);
    expect(
      canChangeAccountStatus(actor.id, secondAdmin, [actor, secondAdmin]),
    ).toBe(true);
    expect(
      canChangeAccountStatus(
        actor.id,
        account({ status: "deactivated", role: "system_admin" }),
        [actor],
      ),
    ).toBe(true);
  });

  it("maps status labels and account-scoped directory keys", () => {
    expect(accountStatusLabel("active")).toBe("Active");
    expect(accountStatusLabel("deactivated")).toBe("Deactivated");
    expect(accountDirectoryQueryKey("actor-1")).toEqual([
      "accounts",
      "actor-1",
    ]);
  });
});

describe("mobile account response handling", () => {
  it("maps only the safe account response fields", () => {
    const result = parseManagedAccount({
      ...account(),
      internalOnly: "private-value",
    });

    expect(result).toEqual(account());
    expect(result).not.toHaveProperty("internalOnly");
  });

  it("accepts a one-time temporary credential without persistence helpers", () => {
    expect(parseTemporaryPassword({ temporaryPassword: "StrongTemp1!" })).toEqual(
      { temporaryPassword: "StrongTemp1!" },
    );
    expect(parseTemporaryPassword({ temporaryPassword: 42 })).toBeNull();
  });
});
