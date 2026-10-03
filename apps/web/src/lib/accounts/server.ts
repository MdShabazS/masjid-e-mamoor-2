import "server-only";

import { randomBytes, randomUUID } from "node:crypto";
import { cache } from "react";

import type {
  ApplicationRole,
  ApplicationUserStatus,
} from "@masjid-e-mamoor/types";
import { createMobileAuthClient } from "@/lib/supabase/mobile-auth";
import { mapTrustedAccountMutationError } from "@/lib/accounts/errors";
import {
  AccountProvisioningError,
  provisionAccountAcrossBoundaries,
  type AccountProvisioningReconciliation,
} from "@/lib/accounts/provisioning";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type DbRow = Record<string, unknown>;

export type AccountRole = ApplicationRole;

export interface AccountRecord {
  id: string;
  authUserId: string;
  username: string | null;
  usernameNormalized: string | null;
  status: ApplicationUserStatus;
  role: AccountRole;
  mustChangePassword: boolean;
  credentialUpdatedAt: string;
  createdAt: string;
  displayName: string | null;
}

export interface LoginAccountRecord {
  id: string;
  authUserId: string;
  authLoginEmail: string;
  status: ApplicationUserStatus;
  mustChangePassword: boolean;
}

const normalManageableRoles = [
  "vice_president",
  "secretary",
  "finance",
  "auditor",
  "committee_member",
  "member",
] as const;

const reservedUsernames = new Set([
  "admin",
  "administrator",
  "system",
  "root",
  "support",
]);

const usernamePattern = /^[a-z0-9._-]{3,40}$/;

function asString(value: unknown): string {
  return String(value);
}

function asNullableString(value: unknown): string | null {
  return value == null ? null : String(value);
}

function asBoolean(value: unknown): boolean {
  return value === true;
}

export function normalizeUsername(username: string) {
  return username.trim().toLowerCase();
}

export function validateUsernamePolicy(
  username: string,
  options: { allowSystemAdminUsername?: boolean } = {},
) {
  const normalized = normalizeUsername(username);

  if (!usernamePattern.test(normalized)) {
    throw new Error("invalid_username");
  }

  if (
    reservedUsernames.has(normalized) &&
    !(options.allowSystemAdminUsername && normalized === "admin")
  ) {
    throw new Error("reserved_username");
  }

  return normalized;
}

export function validatePasswordPolicy(password: string) {
  if (password.length < 8) {
    throw new Error("weak_password");
  }
}

export function generateTemporaryPassword() {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnopqrstuvwxyz";
  const digits = "23456789";
  const symbols = "!@#$%^*-_+=";
  const alphabet = upper + lower + digits + symbols;

  const required = [
    upper[randomBytes(1)[0] % upper.length],
    lower[randomBytes(1)[0] % lower.length],
    digits[randomBytes(1)[0] % digits.length],
    symbols[randomBytes(1)[0] % symbols.length],
  ];

  const rest = Array.from({ length: 12 }, () => {
    return alphabet[randomBytes(1)[0] % alphabet.length];
  });

  return [...required, ...rest]
    .sort(() => randomBytes(1)[0] - 128)
    .join("");
}

function internalAuthEmail() {
  return `${randomUUID()}@auth.masjid.local`;
}

function mapAccount(row: DbRow, role: AccountRole): AccountRecord {
  return {
    id: asString(row.id),
    authUserId: asString(row.auth_user_id),
    username: asNullableString(row.username),
    usernameNormalized: asNullableString(row.username_normalized),
    status: row.status as ApplicationUserStatus,
    role,
    mustChangePassword: asBoolean(row.must_change_password),
    credentialUpdatedAt: asString(row.credential_updated_at),
    createdAt: asString(row.created_at),
    displayName: asNullableString(row.display_name),
  };
}

function mapLoginAccount(row: DbRow): LoginAccountRecord {
  return {
    id: asString(row.id),
    authUserId: asString(row.auth_user_id),
    authLoginEmail: asString(row.auth_login_email),
    status: row.status as ApplicationUserStatus,
    mustChangePassword: asBoolean(row.must_change_password),
  };
}

async function roleByApplicationUserId(accountIds: string[]) {
  if (accountIds.length === 0) return new Map<string, AccountRole>();

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("application_user_roles")
    .select("application_user_id, roles(key)")
    .in("application_user_id", accountIds);

  if (error) throw error;

  const roles = new Map<string, AccountRole>();

  for (const row of data ?? []) {
    const role = row.roles;
    const key =
      role && !Array.isArray(role)
        ? (role as { key?: unknown }).key
        : undefined;

    if (key) {
      roles.set(
        String(row.application_user_id),
        String(key) as AccountRole,
      );
    }
  }

  return roles;
}

export const getCurrentAccount = cache(async function getCurrentAccount(
  accessToken?: string,
): Promise<AccountRecord | null> {
  const supabase = accessToken
    ? createMobileAuthClient(accessToken)
    : await createClient();
  const { data, error } = accessToken
    ? await supabase.auth.getUser(accessToken)
    : await supabase.auth.getUser();

  if (error || !data.user) return null;

  const admin = createAdminClient();
  const { data: account, error: accountError } = await admin
    .from("application_users")
    .select(
      "id, auth_user_id, username, username_normalized, status, must_change_password, credential_updated_at, created_at, display_name",
    )
    .eq("auth_user_id", data.user.id)
    .maybeSingle();

  if (accountError || !account) return null;

  const roles = await roleByApplicationUserId([String(account.id)]);

  const role = roles.get(String(account.id));

  return role ? mapAccount(account, role) : null;
});

export async function requireCurrentAccount(accessToken?: string) {
  const account = await getCurrentAccount(accessToken);

  if (!account || account.status !== "active") {
    throw new Error("not_authorized");
  }

  return account;
}

function assertPresidentCanManageRole(role: AccountRole) {
  if (
    !normalManageableRoles.includes(
      role as (typeof normalManageableRoles)[number],
    )
  ) {
    throw new Error("not_authorized");
  }
}

function assertCanManageAccount(
  actor: AccountRecord,
  target: AccountRecord,
) {
  if (actor.role === "system_admin") return;

  if (actor.role !== "president") {
    throw new Error("not_authorized");
  }

  assertPresidentCanManageRole(target.role);
}

function assertCanCreateRole(actor: AccountRecord, role: AccountRole) {
  if (actor.role === "system_admin") {
    if (role === "system_admin") {
      throw new Error("not_authorized");
    }
    return;
  }

  if (actor.role === "president") {
    assertPresidentCanManageRole(role);
    return;
  }

  throw new Error("not_authorized");
}

async function insertAudit(input: {
  actorId: string | null;
  targetId: string | null;
  eventType: string;
  metadata?: Record<string, unknown>;
}) {
  const admin = createAdminClient();
  const { error } = await admin
    .from("account_security_events")
    .insert({
      actor_application_user_id: input.actorId,
      target_application_user_id: input.targetId,
      event_type: input.eventType,
      metadata: input.metadata ?? {},
    });

  if (error) throw error;
}

export async function getLoginAccountByUsername(username: string) {
  const usernameNormalized = normalizeUsername(username);
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("application_users")
    .select(
      "id, auth_user_id, auth_login_email, status, must_change_password",
    )
    .eq("username_normalized", usernameNormalized)
    .maybeSingle();

  if (error || !data || !data.auth_login_email) return null;

  return mapLoginAccount(data);
}

export async function canManageAccounts() {
  const account = await getCurrentAccount();
  return (
    account?.status === "active" &&
    (account.role === "system_admin" || account.role === "president")
  );
}

async function getMemberDisplayNames(accountIds: string[]) {
  if (accountIds.length === 0) return new Map<string, string>();

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("member_profiles")
    .select("application_user_id, display_name")
    .in("application_user_id", accountIds);

  if (error) throw error;

  return new Map(
    (data ?? [])
      .filter((row) => row.application_user_id)
      .map((row) => [
        String(row.application_user_id),
        String(row.display_name),
      ]),
  );
}

export async function listAccounts(accessToken?: string) {
  const actor = await requireCurrentAccount(accessToken);

  if (actor.role !== "system_admin" && actor.role !== "president") {
    throw new Error("not_authorized");
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("application_users")
    .select(
      "id, auth_user_id, username, username_normalized, status, must_change_password, credential_updated_at, created_at, display_name",
    )
    .order("created_at", { ascending: true });

  if (error) throw error;

  const roles = await roleByApplicationUserId(
    (data ?? []).map((row) => String(row.id)),
  );
  const displayNames = await getMemberDisplayNames(
    (data ?? []).map((row) => String(row.id)),
  );

  const accounts = (data ?? []).map((row) => {
    return mapAccount(
      {
        ...row,
        display_name:
          asNullableString(row.display_name) ??
          displayNames.get(String(row.id)) ??
          null,
      },
      roles.get(String(row.id)) ?? "member",
    );
  });

  return actor.role === "system_admin"
    ? accounts
    : accounts.filter((account) =>
        normalManageableRoles.includes(
          account.role as (typeof normalManageableRoles)[number],
        ),
      );
}

export async function getAccountById(accountId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("application_users")
    .select(
      "id, auth_user_id, username, username_normalized, status, must_change_password, credential_updated_at, created_at, display_name",
    )
    .eq("id", accountId)
    .maybeSingle();

  if (error || !data) throw new Error("not_found");

  const roles = await roleByApplicationUserId([String(data.id)]);

  return mapAccount(data, roles.get(String(data.id)) ?? "member");
}

async function reconcileProvisionedAccount(input: {
  actorApplicationUserId: string;
  authUserId: string;
  authLoginEmail: string;
  username: string;
  usernameNormalized: string;
  displayName: string;
  role: AccountRole;
  phone: string | null;
}): Promise<AccountProvisioningReconciliation> {
  const admin = createAdminClient();
  const { data: account, error: accountError } = await admin
    .from("application_users")
    .select(
      "id, auth_login_email, username, username_normalized, display_name, status, must_change_password",
    )
    .eq("auth_user_id", input.authUserId)
    .maybeSingle();

  if (accountError) throw new Error("account_reconciliation_failed");
  if (!account) return { state: "absent" };

  const accountId = String(account.id);
  const { data: roles, error: rolesError } = await admin
    .from("application_user_roles")
    .select("roles!inner(key)")
    .eq("application_user_id", accountId);
  const { data: profiles, error: profilesError } = await admin
    .from("member_profiles")
    .select("display_name, phone, status")
    .eq("application_user_id", accountId);
  const { data: audits, error: auditsError } = await admin
    .from("account_security_events")
    .select("id, actor_application_user_id, metadata")
    .eq("target_application_user_id", accountId)
    .eq("event_type", "account.created");

  if (rolesError || profilesError || auditsError) {
    throw new Error("account_reconciliation_failed");
  }

  const roleKeys = (roles ?? []).map((row) => {
    const role = row.roles;
    return role && !Array.isArray(role)
      ? String((role as { key?: unknown }).key)
      : null;
  });
  const expectedProfile = input.role === "member";
  const profile = profiles?.[0];
  const matchingAudits = (audits ?? []).filter(
    (audit) =>
      audit.metadata &&
      !Array.isArray(audit.metadata) &&
      audit.actor_application_user_id === input.actorApplicationUserId &&
      String((audit.metadata as { role?: unknown }).role) === input.role,
  );
  const matches =
    account.auth_login_email === input.authLoginEmail &&
    account.username === input.username &&
    account.username_normalized === input.usernameNormalized &&
    account.display_name === input.displayName &&
    account.status === "active" &&
    account.must_change_password === true &&
    roleKeys.length === 1 &&
    roleKeys[0] === input.role &&
    audits?.length === 1 &&
    matchingAudits.length === 1 &&
    (expectedProfile
      ? profiles?.length === 1 &&
        profile?.display_name === input.displayName &&
        (profile.phone ?? null) === input.phone &&
        profile.status === "active"
      : profiles?.length === 0);

  return matches
    ? { state: "committed", accountId }
    : { state: "conflict" };
}

export async function createAccount(input: {
  username: string;
  role: AccountRole;
  password?: string;
  displayName: string;
  phone?: string | null;
}, accessToken?: string) {
  const actor = await requireCurrentAccount(accessToken);
  assertCanCreateRole(actor, input.role);

  const usernameNormalized = validateUsernamePolicy(input.username);
  const displayName = input.displayName.trim();
  const password = input.password ?? generateTemporaryPassword();
  validatePasswordPolicy(password);

  if (!displayName || displayName.length > 120) {
    throw new Error("invalid_display_name");
  }

  const authEmail = internalAuthEmail();
  const username = input.username.trim();
  const phone = input.phone?.trim() || null;
  const admin = createAdminClient();
  const actorClient = accessToken
    ? createMobileAuthClient(accessToken)
    : await createClient();

  const result = await provisionAccountAcrossBoundaries({
    async createAuthUser() {
      const { data, error } = await admin.auth.admin.createUser({
        email: authEmail,
        password,
        email_confirm: true,
      });

      if (error || !data.user) {
        throw new AccountProvisioningError("account_create_failed");
      }

      return data.user.id;
    },
    async finalizeDatabase(authUserId) {
      const { data, error } = await actorClient.rpc(
        "finalize_account_provisioning",
        {
          p_auth_user_id: authUserId,
          p_auth_login_email: authEmail,
          p_username: username,
          p_username_normalized: usernameNormalized,
          p_display_name: displayName,
          p_role_key: input.role,
          p_phone: phone,
        },
      );

      if (error) {
        const safeCode = [
          "not_authorized",
          "invalid_username",
          "invalid_display_name",
          "account_create_conflict",
        ].find((code) => error.message.includes(code));
        throw new AccountProvisioningError(
          (safeCode ?? "account_create_failed") as
            | "not_authorized"
            | "invalid_username"
            | "invalid_display_name"
            | "account_create_conflict"
            | "account_create_failed",
        );
      }

      if (!data) throw new AccountProvisioningError("account_create_failed");
      return String(data);
    },
    reconcileDatabase(authUserId) {
      return reconcileProvisionedAccount({
        actorApplicationUserId: actor.id,
        authUserId,
        authLoginEmail: authEmail,
        username,
        usernameNormalized,
        displayName,
        role: input.role,
        phone,
      });
    },
    async deleteAuthUser(authUserId) {
      const { error } = await admin.auth.admin.deleteUser(authUserId);
      if (error) throw new Error("auth_cleanup_failed");
    },
    observeReconciliationRequired(authUserId) {
      console.error("Account provisioning requires manual reconciliation.", {
        authUserId,
      });
    },
  });

  return {
    accountId: result.accountId,
    temporaryPassword: password,
  };
}

export async function changeAccountUsername(
  accountId: string,
  username: string,
  accessToken?: string,
) {
  const actor = await requireCurrentAccount(accessToken);
  const target = await getAccountById(accountId);
  assertCanManageAccount(actor, target);

  const usernameNormalized = validateUsernamePolicy(username);
  const admin = createAdminClient();
  const { error } = await admin
    .from("application_users")
    .update({
      username: username.trim(),
      username_normalized: usernameNormalized,
      last_username_changed_at: new Date().toISOString(),
    })
    .eq("id", accountId);

  if (error) throw error;

  await insertAudit({
    actorId: actor.id,
    targetId: accountId,
    eventType: "username.changed",
    metadata: {},
  });
}

export async function changeOwnUsername(
  username: string,
  currentPassword: string,
) {
  const account = await requireCurrentAccount();

  if (account.role !== "system_admin" && account.role !== "president") {
    throw new Error("not_authorized");
  }

  const admin = createAdminClient();
  const { data: accountRow, error: accountError } = await admin
    .from("application_users")
    .select("auth_login_email")
    .eq("id", account.id)
    .single();

  if (accountError || !accountRow?.auth_login_email) {
    throw new Error("not_authorized");
  }

  const supabase = await createClient();
  const { data, error: passwordError } =
    await supabase.auth.signInWithPassword({
      email: String(accountRow.auth_login_email),
      password: currentPassword,
    });

  if (passwordError || data.user?.id !== account.authUserId) {
    throw new Error("not_authorized");
  }

  const usernameNormalized = validateUsernamePolicy(username, {
    allowSystemAdminUsername: account.role === "system_admin",
  });
  const { error } = await admin
    .from("application_users")
    .update({
      username: username.trim(),
      username_normalized: usernameNormalized,
      last_username_changed_at: new Date().toISOString(),
    })
    .eq("id", account.id);

  if (error) throw error;

  await insertAudit({
    actorId: account.id,
    targetId: account.id,
    eventType: "username.changed",
    metadata: { self: true },
  });
}

export async function resetAccountPassword(
  accountId: string,
  password?: string,
  accessToken?: string,
) {
  const actor = await requireCurrentAccount(accessToken);
  const target = await getAccountById(accountId);
  assertCanManageAccount(actor, target);

  const temporaryPassword = password ?? generateTemporaryPassword();
  validatePasswordPolicy(temporaryPassword);

  const admin = createAdminClient();
  const { error: authError } = await admin.auth.admin.updateUserById(
    target.authUserId,
    { password: temporaryPassword },
  );

  if (authError) throw new Error("password_reset_failed");

  const { error } = await admin
    .from("application_users")
    .update({
      must_change_password: true,
      credential_updated_at: new Date().toISOString(),
    })
    .eq("id", accountId);

  if (error) throw error;

  await insertAudit({
    actorId: actor.id,
    targetId: accountId,
    eventType: "password.reset",
    metadata: {},
  });

  return temporaryPassword;
}

export async function changeAccountRole(
  accountId: string,
  role: AccountRole,
  accessToken?: string,
) {
  const supabase = accessToken
    ? createMobileAuthClient(accessToken)
    : await createClient();
  const { error } = await supabase.rpc("change_account_role", {
    p_target_application_user_id: accountId,
    p_role_key: role,
  });

  if (error) throw mapTrustedAccountMutationError(error.message);
}

export async function changeAccountStatus(
  accountId: string,
  status: "active" | "deactivated",
  accessToken?: string,
) {
  const supabase = accessToken
    ? createMobileAuthClient(accessToken)
    : await createClient();
  const { error } = await supabase.rpc("change_account_status", {
    p_target_application_user_id: accountId,
    p_status: status,
  });

  if (error) throw mapTrustedAccountMutationError(error.message);
}

export async function changeOwnPassword(password: string) {
  validatePasswordPolicy(password);

  const account = await requireCurrentAccount();
  const supabase = await createClient();
  const { error: authError } = await supabase.auth.updateUser({
    password,
  });

  if (authError) throw new Error("password_change_failed");

  const admin = createAdminClient();
  const { error } = await admin
    .from("application_users")
    .update({
      must_change_password: false,
      credential_updated_at: new Date().toISOString(),
    })
    .eq("id", account.id);

  if (error) throw error;

  await insertAudit({
    actorId: account.id,
    targetId: account.id,
    eventType: "password.changed",
    metadata: {},
  });
}

export async function changePasswordWithAccessToken(
  accessToken: string,
  password: string,
) {
  validatePasswordPolicy(password);

  const supabase = createMobileAuthClient(accessToken);
  const { data: userData, error: userError } = await supabase.auth.getUser(
    accessToken,
  );

  if (userError || !userData.user) throw new Error("not_authorized");

  const admin = createAdminClient();
  const { data: account, error: accountError } = await admin
    .from("application_users")
    .select("id, auth_user_id, status")
    .eq("auth_user_id", userData.user.id)
    .maybeSingle();

  if (
    accountError ||
    !account ||
    account.auth_user_id !== userData.user.id ||
    account.status !== "active"
  ) {
    throw new Error("not_authorized");
  }

  const { error: authError } = await admin.auth.admin.updateUserById(
    userData.user.id,
    { password },
  );
  if (authError) throw new Error("password_change_failed");

  const { error: updateError } = await admin
    .from("application_users")
    .update({
      must_change_password: false,
      credential_updated_at: new Date().toISOString(),
    })
    .eq("id", account.id);

  if (updateError) throw new Error("password_change_failed");

  await insertAudit({
    actorId: String(account.id),
    targetId: String(account.id),
    eventType: "password.changed",
    metadata: { client: "mobile" },
  });
}
