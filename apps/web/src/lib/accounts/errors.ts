const trustedAccountMutationErrors = [
  "not_authorized",
  "last_system_admin",
  "invalid_role",
  "not_found",
] as const;

export function mapTrustedAccountMutationError(message: string) {
  const knownError = trustedAccountMutationErrors.find((code) =>
    message.includes(code),
  );

  return new Error(knownError ?? "account_update_failed");
}
