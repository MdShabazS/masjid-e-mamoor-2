import { describe, expect, it, vi } from "vitest";

import {
  AccountProvisioningError,
  provisionAccountAcrossBoundaries,
  type AccountProvisioningDependencies,
} from "@/lib/accounts/provisioning";

function dependencies(
  overrides: Partial<AccountProvisioningDependencies> = {},
): AccountProvisioningDependencies {
  return {
    createAuthUser: vi.fn().mockResolvedValue("auth-user-id"),
    finalizeDatabase: vi.fn().mockResolvedValue("application-user-id"),
    reconcileDatabase: vi.fn().mockResolvedValue({ state: "absent" }),
    deleteAuthUser: vi.fn().mockResolvedValue(undefined),
    observeReconciliationRequired: vi.fn(),
    ...overrides,
  };
}

describe("account provisioning across Auth and PostgreSQL", () => {
  it("creates Auth and returns the trusted finalization result", async () => {
    const deps = dependencies();

    await expect(provisionAccountAcrossBoundaries(deps)).resolves.toEqual({
      accountId: "application-user-id",
    });
    expect(deps.finalizeDatabase).toHaveBeenCalledWith("auth-user-id");
    expect(deps.reconcileDatabase).not.toHaveBeenCalled();
    expect(deps.deleteAuthUser).not.toHaveBeenCalled();
  });

  it("returns success without deleting Auth when reconciliation proves commit", async () => {
    const deps = dependencies({
      finalizeDatabase: vi.fn().mockRejectedValue(new Error("response lost")),
      reconcileDatabase: vi.fn().mockResolvedValue({
        state: "committed",
        accountId: "committed-account-id",
      }),
    });

    await expect(provisionAccountAcrossBoundaries(deps)).resolves.toEqual({
      accountId: "committed-account-id",
    });
    expect(deps.deleteAuthUser).not.toHaveBeenCalled();
  });

  it("cleans up Auth after proving database finalization did not commit", async () => {
    const deps = dependencies({
      finalizeDatabase: vi
        .fn()
        .mockRejectedValue(
          new AccountProvisioningError("account_create_conflict"),
        ),
    });

    await expect(provisionAccountAcrossBoundaries(deps)).rejects.toMatchObject({
      message: "account_create_conflict",
    });
    expect(deps.deleteAuthUser).toHaveBeenCalledWith("auth-user-id");
  });

  it("reports reconciliation required when Auth cleanup fails", async () => {
    const observeReconciliationRequired = vi.fn();
    const deps = dependencies({
      finalizeDatabase: vi.fn().mockRejectedValue(new Error("rpc failed")),
      deleteAuthUser: vi.fn().mockRejectedValue(new Error("cleanup failed")),
      observeReconciliationRequired,
    });

    await expect(provisionAccountAcrossBoundaries(deps)).rejects.toMatchObject({
      message: "account_create_reconciliation_required",
    });
    expect(observeReconciliationRequired).toHaveBeenCalledWith("auth-user-id");
  });

  it("does not delete Auth when reconciliation finds conflicting database state", async () => {
    const deps = dependencies({
      finalizeDatabase: vi.fn().mockRejectedValue(new Error("rpc failed")),
      reconcileDatabase: vi.fn().mockResolvedValue({ state: "conflict" }),
    });

    await expect(provisionAccountAcrossBoundaries(deps)).rejects.toMatchObject({
      message: "account_create_conflict",
    });
    expect(deps.deleteAuthUser).not.toHaveBeenCalled();
    expect(deps.observeReconciliationRequired).toHaveBeenCalledWith(
      "auth-user-id",
    );
  });
});
