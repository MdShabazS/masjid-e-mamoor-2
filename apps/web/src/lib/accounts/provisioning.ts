export type AccountProvisioningErrorCode =
  | "not_authorized"
  | "invalid_username"
  | "invalid_display_name"
  | "account_create_failed"
  | "account_create_conflict"
  | "account_create_reconciliation_required";

export class AccountProvisioningError extends Error {
  constructor(readonly code: AccountProvisioningErrorCode) {
    super(code);
  }
}

export type AccountProvisioningReconciliation =
  | { state: "committed"; accountId: string }
  | { state: "absent" }
  | { state: "conflict" };

export interface AccountProvisioningDependencies {
  createAuthUser(): Promise<string>;
  finalizeDatabase(authUserId: string): Promise<string>;
  reconcileDatabase(
    authUserId: string,
  ): Promise<AccountProvisioningReconciliation>;
  deleteAuthUser(authUserId: string): Promise<void>;
  observeReconciliationRequired(authUserId: string): void;
}

function safeFinalizationError(error: unknown): AccountProvisioningErrorCode {
  if (error instanceof AccountProvisioningError) return error.code;
  return "account_create_failed";
}

export async function provisionAccountAcrossBoundaries(
  dependencies: AccountProvisioningDependencies,
) {
  const authUserId = await dependencies.createAuthUser();

  try {
    const accountId = await dependencies.finalizeDatabase(authUserId);
    return { accountId };
  } catch (finalizationError) {
    let reconciliation: AccountProvisioningReconciliation;

    try {
      reconciliation = await dependencies.reconcileDatabase(authUserId);
    } catch {
      dependencies.observeReconciliationRequired(authUserId);
      throw new AccountProvisioningError(
        "account_create_reconciliation_required",
      );
    }

    if (reconciliation.state === "committed") {
      return { accountId: reconciliation.accountId };
    }

    if (reconciliation.state === "conflict") {
      dependencies.observeReconciliationRequired(authUserId);
      throw new AccountProvisioningError("account_create_conflict");
    }

    try {
      await dependencies.deleteAuthUser(authUserId);
    } catch {
      dependencies.observeReconciliationRequired(authUserId);
      throw new AccountProvisioningError(
        "account_create_reconciliation_required",
      );
    }

    throw new AccountProvisioningError(
      safeFinalizationError(finalizationError),
    );
  }
}
