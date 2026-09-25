import "server-only";

import { randomBytes, randomUUID } from "node:crypto";

import type {
  ApplicationRole,
  ApplicationUserStatus,
} from "@masjid-e-mamoor/types";

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
  if (
    password.length < 10 ||
    !/[a-z]/.test(password) ||
    !/[A-Z]/.test(password) ||
    !/\d/.test(password) ||
    /^(password|admin|123456)$/i.test(password) ||
    /password|admin|123456/i.test(password)
  ) {
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

export async function getCurrentAccount(): Promise<AccountRecord | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) return null;

  const admin = createAdminClient();
  const { data: account, error: accountError } = await admin
    .from("application_users")
    .select(
      "id, auth_user_id, username, username_normalized, status, must_change_password, credential_updated_at, created_at",
    )
    .eq("auth_user_id", data.user.id)
    .maybeSingle();

  if (accountError || !account) return null;

  const roles = await roleByApplicationUserId([String(account.id)]);

  const role = roles.get(String(account.id));

  return role ? mapAccount(account, role) : null;
}

export async function requireCurrentAccount() {
  const account = await getCurrentAccount();

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

async function countActiveSystemAdmins() {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("application_user_roles")
    .select("application_user_id, roles!inner(key), application_users!inner(status)")
    .eq("roles.key", "system_admin")
    .eq("application_users.status", "active");

  if (error) throw error;

  return data?.length ?? 0;
}

export async function listAccounts() {
  const actor = await requireCurrentAccount();

  if (actor.role !== "system_admin" && actor.role !== "president") {
    throw new Error("not_authorized");
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("application_users")
    .select(
      "id, auth_user_id, username, username_normalized, status, must_change_password, credential_updated_at, created_at",
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
      { ...row, display_name: displayNames.get(String(row.id)) ?? null },
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
      "id, auth_user_id, username, username_normalized, status, must_change_password, credential_updated_at, created_at",
    )
    .eq("id", accountId)
    .maybeSingle();

  if (error || !data) throw new Error("not_found");

  const roles = await roleByApplicationUserId([String(data.id)]);

  return mapAccount(data, roles.get(String(data.id)) ?? "member");
}

export async function createAccount(input: {
  username: string;
  role: AccountRole;
  password?: string;
  displayName?: string;
}) {
  const actor = await requireCurrentAccount();
  assertCanCreateRole(actor, input.role);

  const usernameNormalized = validateUsernamePolicy(input.username);
  const password = input.password ?? generateTemporaryPassword();
  validatePasswordPolicy(password);

  const admin = createAdminClient();
  const authEmail = internalAuthEmail();

  const { data: created, error: createError } =
    await admin.auth.admin.createUser({
      email: authEmail,
      password,
      email_confirm: true,
    });

  if (createError || !created.user) {
    throw new Error("account_create_failed");
  }

  let applicationUserId: string | null = null;

  try {
    const { data: account, error: accountError } = await admin
      .from("application_users")
      .insert({
        auth_user_id: created.user.id,
        auth_login_email: authEmail,
        username: input.username.trim(),
        username_normalized: usernameNormalized,
        status: "active",
        must_change_password: true,
        credential_updated_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (accountError || !account) throw accountError;

    applicationUserId = String(account.id);

    const { data: role, error: roleError } = await admin
      .from("roles")
      .select("id")
      .eq("key", input.role)
      .single();

    if (roleError || !role) throw roleError;

    const { error: roleInsertError } = await admin
      .from("application_user_roles")
      .insert({
        application_user_id: applicationUserId,
        role_id: role.id,
      });

    if (roleInsertError) throw roleInsertError;

    if (input.role === "member") {
      const { error: memberError } = await admin
        .from("member_profiles")
        .insert({
          application_user_id: applicationUserId,
          display_name: input.displayName?.trim() || input.username.trim(),
          status: "active",
        });

      if (memberError) throw memberError;
    }

    await insertAudit({
      actorId: actor.id,
      targetId: applicationUserId,
      eventType: "account.created",
      metadata: { role: input.role },
    });

    return {
      accountId: applicationUserId,
      temporaryPassword: password,
    };
  } catch (error) {
    await admin.auth.admin.deleteUser(created.user.id);
    throw error;
  }
}

export async function changeAccountUsername(
  accountId: string,
  username: string,
) {
  const actor = await requireCurrentAccount();
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
) {
  const actor = await requireCurrentAccount();
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
) {
  const actor = await requireCurrentAccount();
  const target = await getAccountById(accountId);
  assertCanManageAccount(actor, target);
  assertCanCreateRole(actor, role);

  if (target.role === "system_admin") {
    if (target.id === actor.id || (await countActiveSystemAdmins()) <= 1) {
      throw new Error("last_system_admin");
    }
  }

  const admin = createAdminClient();
  const { data: roleRow, error: roleError } = await admin
    .from("roles")
    .select("id")
    .eq("key", role)
    .single();

  if (roleError || !roleRow) throw new Error("invalid_role");

  const { error } = await admin
    .from("application_user_roles")
    .upsert(
      {
        application_user_id: accountId,
        role_id: roleRow.id,
      },
      { onConflict: "application_user_id" },
    );

  if (error) throw error;

  await insertAudit({
    actorId: actor.id,
    targetId: accountId,
    eventType: "role.changed",
    metadata: { role },
  });
}

export async function changeAccountStatus(
  accountId: string,
  status: "active" | "deactivated",
) {
  const actor = await requireCurrentAccount();
  const target = await getAccountById(accountId);
  assertCanManageAccount(actor, target);

  if (
    target.role === "system_admin" &&
    target.id === actor.id &&
    status === "deactivated"
  ) {
    throw new Error("not_authorized");
  }

  if (
    target.role === "system_admin" &&
    status === "deactivated"
  ) {
    if ((await countActiveSystemAdmins()) <= 1) {
      throw new Error("last_system_admin");
    }
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("application_users")
    .update({ status })
    .eq("id", accountId);

  if (error) throw error;

  await insertAudit({
    actorId: actor.id,
    targetId: accountId,
    eventType:
      status === "active" ? "account.activated" : "account.deactivated",
    metadata: {},
  });
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
