export type ReferralProvisioningErrorCode =
  | "not_authorized"
  | "invalid_username"
  | "referral_not_found"
  | "referral_not_approved"
  | "phone_already_member"
  | "operation_id_conflict"
  | "referral_provisioning_failed"
  | "referral_provisioning_conflict"
  | "referral_provisioning_reconciliation_required";

export class ReferralProvisioningError extends Error {
  constructor(readonly code: ReferralProvisioningErrorCode) {
    super(code);
  }
}

export type ReferralProvisioningPrecheck =
  | { state: "absent" }
  | { state: "committed"; accountId: string };

export type ReferralProvisioningReconciliation =
  | { state: "committed_to_this_auth"; accountId: string }
  | { state: "committed_to_existing_account"; accountId: string }
  | { state: "absent" }
  | { state: "conflict" };

export interface ReferralFinalizationResult {
  accountId: string;
  usedSuppliedAuthUser: boolean;
}

export interface ReferralProvisioningDependencies {
  precheckDatabase(): Promise<ReferralProvisioningPrecheck>;
  createAuthUser(): Promise<string>;
  finalizeDatabase(authUserId: string): Promise<ReferralFinalizationResult>;
  reconcileDatabase(
    authUserId: string,
  ): Promise<ReferralProvisioningReconciliation>;
  deleteAuthUser(authUserId: string): Promise<void>;
  observeReconciliationRequired(
    reason: string,
    authUserId?: string,
  ): void;
}

function safeFinalizationError(
  error: unknown,
): ReferralProvisioningErrorCode {
  if (error instanceof ReferralProvisioningError) return error.code;
  return "referral_provisioning_failed";
}

async function deleteUnusedAuthUser(
  dependencies: ReferralProvisioningDependencies,
  authUserId: string,
) {
  try {
    await dependencies.deleteAuthUser(authUserId);
  } catch {
    dependencies.observeReconciliationRequired(
      "auth_cleanup_failed",
      authUserId,
    );
    throw new ReferralProvisioningError(
      "referral_provisioning_reconciliation_required",
    );
  }
}

export async function provisionReferralAcrossBoundaries(
  dependencies: ReferralProvisioningDependencies,
) {
  const precheck = await dependencies.precheckDatabase();

  if (precheck.state === "committed") {
    return {
      accountId: precheck.accountId,
      exposeCreatedCredential: false,
    };
  }

  const authUserId = await dependencies.createAuthUser();
  let finalization: ReferralFinalizationResult;

  try {
    finalization = await dependencies.finalizeDatabase(authUserId);
  } catch (finalizationError) {
    let reconciliation: ReferralProvisioningReconciliation;

    try {
      reconciliation = await dependencies.reconcileDatabase(authUserId);
    } catch {
      dependencies.observeReconciliationRequired("database_read_failed");
      throw new ReferralProvisioningError(
        "referral_provisioning_reconciliation_required",
      );
    }

    if (reconciliation.state === "committed_to_this_auth") {
      return {
        accountId: reconciliation.accountId,
        exposeCreatedCredential: true,
      };
    }

    if (reconciliation.state === "committed_to_existing_account") {
      await deleteUnusedAuthUser(dependencies, authUserId);
      return {
        accountId: reconciliation.accountId,
        exposeCreatedCredential: false,
      };
    }

    if (reconciliation.state === "conflict") {
      dependencies.observeReconciliationRequired("database_conflict");
      throw new ReferralProvisioningError(
        "referral_provisioning_conflict",
      );
    }

    await deleteUnusedAuthUser(dependencies, authUserId);
    throw new ReferralProvisioningError(
      safeFinalizationError(finalizationError),
    );
  }

  if (finalization.usedSuppliedAuthUser) {
    return {
      accountId: finalization.accountId,
      exposeCreatedCredential: true,
    };
  }

  let reconciliation: ReferralProvisioningReconciliation;

  try {
    reconciliation = await dependencies.reconcileDatabase(authUserId);
  } catch {
    dependencies.observeReconciliationRequired("database_read_failed");
    throw new ReferralProvisioningError(
      "referral_provisioning_reconciliation_required",
    );
  }

  if (reconciliation.state !== "committed_to_existing_account") {
    dependencies.observeReconciliationRequired("database_conflict");
    throw new ReferralProvisioningError("referral_provisioning_conflict");
  }

  await deleteUnusedAuthUser(dependencies, authUserId);
  return {
    accountId: reconciliation.accountId,
    exposeCreatedCredential: false,
  };
}
