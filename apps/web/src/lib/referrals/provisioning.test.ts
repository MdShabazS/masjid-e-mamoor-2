import { describe, expect, it, vi } from "vitest";

import {
  provisionReferralAcrossBoundaries,
  ReferralProvisioningError,
  type ReferralProvisioningDependencies,
} from "@/lib/referrals/provisioning";

function dependencies(
  overrides: Partial<ReferralProvisioningDependencies> = {},
): ReferralProvisioningDependencies {
  return {
    precheckDatabase: vi.fn().mockResolvedValue({ state: "absent" }),
    createAuthUser: vi.fn().mockResolvedValue("new-auth-user-id"),
    finalizeDatabase: vi.fn().mockResolvedValue({
      accountId: "new-account-id",
      usedSuppliedAuthUser: true,
    }),
    reconcileDatabase: vi.fn().mockResolvedValue({ state: "absent" }),
    deleteAuthUser: vi.fn().mockResolvedValue(undefined),
    observeReconciliationRequired: vi.fn(),
    ...overrides,
  };
}

describe("referral provisioning across Auth and PostgreSQL", () => {
  it("returns a completed matching operation before creating Auth", async () => {
    const deps = dependencies({
      precheckDatabase: vi.fn().mockResolvedValue({
        state: "committed",
        accountId: "existing-account-id",
      }),
    });

    await expect(provisionReferralAcrossBoundaries(deps)).resolves.toEqual({
      accountId: "existing-account-id",
      exposeCreatedCredential: false,
    });
    expect(deps.createAuthUser).not.toHaveBeenCalled();
    expect(deps.finalizeDatabase).not.toHaveBeenCalled();
  });

  it("returns the new credential only when the RPC used the new Auth user", async () => {
    const deps = dependencies();

    await expect(provisionReferralAcrossBoundaries(deps)).resolves.toEqual({
      accountId: "new-account-id",
      exposeCreatedCredential: true,
    });
    expect(deps.finalizeDatabase).toHaveBeenCalledWith("new-auth-user-id");
    expect(deps.deleteAuthUser).not.toHaveBeenCalled();
  });

  it("reconciles a lost response committed to the new Auth user", async () => {
    const deps = dependencies({
      finalizeDatabase: vi.fn().mockRejectedValue(new Error("response lost")),
      reconcileDatabase: vi.fn().mockResolvedValue({
        state: "committed_to_this_auth",
        accountId: "new-account-id",
      }),
    });

    await expect(provisionReferralAcrossBoundaries(deps)).resolves.toEqual({
      accountId: "new-account-id",
      exposeCreatedCredential: true,
    });
    expect(deps.deleteAuthUser).not.toHaveBeenCalled();
  });

  it("cleans up an unused concurrent Auth user and returns idempotent success", async () => {
    const deps = dependencies({
      finalizeDatabase: vi.fn().mockResolvedValue({
        accountId: "existing-account-id",
        usedSuppliedAuthUser: false,
      }),
      reconcileDatabase: vi.fn().mockResolvedValue({
        state: "committed_to_existing_account",
        accountId: "existing-account-id",
      }),
    });

    await expect(provisionReferralAcrossBoundaries(deps)).resolves.toEqual({
      accountId: "existing-account-id",
      exposeCreatedCredential: false,
    });
    expect(deps.deleteAuthUser).toHaveBeenCalledWith("new-auth-user-id");
  });

  it("does not clean up Auth when an existing-account response cannot be proven", async () => {
    const deps = dependencies({
      finalizeDatabase: vi.fn().mockResolvedValue({
        accountId: "existing-account-id",
        usedSuppliedAuthUser: false,
      }),
      reconcileDatabase: vi.fn().mockResolvedValue({ state: "conflict" }),
    });

    await expect(provisionReferralAcrossBoundaries(deps)).rejects.toMatchObject({
      message: "referral_provisioning_conflict",
    });
    expect(deps.deleteAuthUser).not.toHaveBeenCalled();
  });

  it("reconciles a lost concurrent response before deleting unused Auth", async () => {
    const deps = dependencies({
      finalizeDatabase: vi.fn().mockRejectedValue(new Error("response lost")),
      reconcileDatabase: vi.fn().mockResolvedValue({
        state: "committed_to_existing_account",
        accountId: "existing-account-id",
      }),
    });

    await expect(provisionReferralAcrossBoundaries(deps)).resolves.toEqual({
      accountId: "existing-account-id",
      exposeCreatedCredential: false,
    });
    expect(deps.deleteAuthUser).toHaveBeenCalledWith("new-auth-user-id");
  });

  it("cleans up Auth after proving no database commit occurred", async () => {
    const deps = dependencies({
      finalizeDatabase: vi
        .fn()
        .mockRejectedValue(
          new ReferralProvisioningError("referral_not_approved"),
        ),
    });

    await expect(provisionReferralAcrossBoundaries(deps)).rejects.toMatchObject({
      message: "referral_not_approved",
    });
    expect(deps.deleteAuthUser).toHaveBeenCalledWith("new-auth-user-id");
  });

  it("does not delete Auth when reconciliation finds conflicting state", async () => {
    const deps = dependencies({
      finalizeDatabase: vi.fn().mockRejectedValue(new Error("rpc failed")),
      reconcileDatabase: vi.fn().mockResolvedValue({ state: "conflict" }),
    });

    await expect(provisionReferralAcrossBoundaries(deps)).rejects.toMatchObject({
      message: "referral_provisioning_conflict",
    });
    expect(deps.deleteAuthUser).not.toHaveBeenCalled();
    expect(deps.observeReconciliationRequired).toHaveBeenCalledWith(
      "database_conflict",
    );
  });

  it("reports reconciliation required when Auth cleanup fails", async () => {
    const observeReconciliationRequired = vi.fn();
    const deps = dependencies({
      finalizeDatabase: vi
        .fn()
        .mockRejectedValue(
          new ReferralProvisioningError("referral_not_approved"),
        ),
      deleteAuthUser: vi.fn().mockRejectedValue(new Error("cleanup failed")),
      observeReconciliationRequired,
    });

    await expect(provisionReferralAcrossBoundaries(deps)).rejects.toMatchObject({
      message: "referral_provisioning_reconciliation_required",
    });
    expect(observeReconciliationRequired).toHaveBeenCalledWith(
      "auth_cleanup_failed",
      "new-auth-user-id",
    );
  });

  it("requires reconciliation when authoritative state cannot be read", async () => {
    const deps = dependencies({
      finalizeDatabase: vi.fn().mockRejectedValue(new Error("rpc failed")),
      reconcileDatabase: vi
        .fn()
        .mockRejectedValue(new Error("database unavailable")),
    });

    await expect(provisionReferralAcrossBoundaries(deps)).rejects.toMatchObject({
      message: "referral_provisioning_reconciliation_required",
    });
    expect(deps.deleteAuthUser).not.toHaveBeenCalled();
    expect(deps.observeReconciliationRequired).toHaveBeenCalledWith(
      "database_read_failed",
    );
  });
});
