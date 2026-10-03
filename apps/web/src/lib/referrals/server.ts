import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { cache } from "react";

import type { AccountRecord } from "@/lib/accounts/server";
import {
  generateTemporaryPassword,
  getCurrentAccount,
  requireCurrentAccount,
  validatePasswordPolicy,
  validateUsernamePolicy,
} from "@/lib/accounts/server";
import { getOwnMemberProfile, hasPermission } from "@/lib/members/server";
import {
  provisionReferralAcrossBoundaries,
  ReferralProvisioningError,
  type ReferralProvisioningReconciliation,
} from "@/lib/referrals/provisioning";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { createMobileAuthClient } from "@/lib/supabase/mobile-auth";

type DbRow = Record<string, unknown>;

export interface ReferralRecord {
  id: string;
  referralCode: string;
  status: string;
  applicantDisplayName: string | null;
  applicantPhone: string | null;
  referrerDisplayName: string | null;
  createdAt: string;
  submittedAt: string | null;
  reviewedAt: string | null;
  reviewReason: string | null;
  completedAt: string | null;
}

export interface ReferralValidationResult {
  valid: boolean;
  status: string;
  referrerDisplayName: string | null;
}

function asString(value: unknown): string {
  return String(value);
}

function asNullableString(value: unknown): string | null {
  return value == null ? null : String(value);
}

function mapReferral(row: DbRow): ReferralRecord {
  const memberProfile = row.member_profiles as
    | { display_name?: unknown }
    | null
    | undefined;

  return {
    id: asString(row.id),
    referralCode: asString(row.referral_code),
    status: asString(row.status),
    applicantDisplayName: asNullableString(row.applicant_display_name),
    applicantPhone: asNullableString(row.applicant_phone),
    referrerDisplayName:
      memberProfile && !Array.isArray(memberProfile)
        ? asNullableString(memberProfile.display_name)
        : null,
    createdAt: asString(row.created_at),
    submittedAt: asNullableString(row.submitted_at),
    reviewedAt: asNullableString(row.reviewed_at),
    reviewReason: asNullableString(row.review_reason),
    completedAt: asNullableString(row.completed_at),
  };
}

function assertCanManageReferrals(account: AccountRecord) {
  if (
    account.status !== "active" ||
    (account.role !== "president" && account.role !== "system_admin")
  ) {
    throw new Error("not_authorized");
  }
}

function fingerprint(value: unknown) {
  return createHash("sha256")
    .update(JSON.stringify(value))
    .digest("hex");
}

function internalAuthEmail() {
  return `${randomUUID()}@auth.masjid.local`;
}

export const canManageReferrals = cache(async function canManageReferrals() {
  const account = await getCurrentAccount();
  return (
    account?.status === "active" &&
    (account.role === "president" || account.role === "system_admin")
  );
});

export const canUseReferrals = cache(async function canUseReferrals() {
  const account = await getCurrentAccount();
  if (!account || account.status !== "active") return false;
  if (account.role === "president" || account.role === "system_admin") {
    return true;
  }
  return hasPermission("membership.referrals.create");
});

export async function createReferral() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_referral", {
    p_operation_id: randomUUID(),
  });

  if (error || !data) throw new Error(error?.message ?? "referral_failed");

  return mapReferral(data as DbRow);
}

export async function listOwnReferrals() {
  const ownProfile = await getOwnMemberProfile();
  if (!ownProfile) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("referrals")
    .select(
      "id, referral_code, status, applicant_display_name, applicant_phone, created_at, submitted_at, reviewed_at, review_reason, completed_at",
    )
    .eq("referrer_member_profile_id", ownProfile.id)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => mapReferral(row as DbRow));
}

export async function validateReferralCode(
  referralCode: string,
): Promise<ReferralValidationResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("validate_referral_code", {
    p_referral_code: referralCode,
  });

  if (error) {
    return { valid: false, status: "invalid", referrerDisplayName: null };
  }

  const row = (data?.[0] ?? null) as DbRow | null;

  return {
    valid: row?.valid === true,
    status: row ? asString(row.status) : "invalid",
    referrerDisplayName: row
      ? asNullableString(row.referrer_display_name)
      : null,
  };
}

export async function submitReferralOnboarding(input: {
  referralCode: string;
  displayName: string;
  phone: string;
  operationId: string;
}) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_referral_onboarding", {
    p_referral_code: input.referralCode,
    p_display_name: input.displayName,
    p_phone: input.phone,
    p_operation_id: input.operationId,
  });

  if (error) throw new Error(error.message);
}

export async function listReferralOnboardingRequests(accessToken?: string) {
  const account = await requireCurrentAccount(accessToken);
  assertCanManageReferrals(account);

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("referrals")
    .select(
      "id, referral_code, status, applicant_display_name, applicant_phone, created_at, submitted_at, reviewed_at, review_reason, completed_at, member_profiles!referrals_referrer_member_profile_id_fkey(display_name)",
    )
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (data ?? []).map((row) => mapReferral(row as DbRow));
}

export async function approveReferral(
  referralId: string,
  operationId: string,
  accessToken?: string,
) {
  const account = await requireCurrentAccount(accessToken);
  assertCanManageReferrals(account);
  const supabase = accessToken
    ? createMobileAuthClient(accessToken)
    : await createClient();
  const { error } = await supabase.rpc("admin_approve_referral", {
    p_referral_id: referralId,
    p_operation_id: operationId,
  });

  if (error) throw new Error(error.message);
}

export async function rejectReferral(input: {
  referralId: string;
  reason: string | null;
  operationId: string;
}, accessToken?: string) {
  const account = await requireCurrentAccount(accessToken);
  assertCanManageReferrals(account);
  const supabase = accessToken
    ? createMobileAuthClient(accessToken)
    : await createClient();
  const { error } = await supabase.rpc("admin_reject_referral", {
    p_referral_id: input.referralId,
    p_reason: input.reason,
    p_operation_id: input.operationId,
  });

  if (error) throw new Error(error.message);
}

export async function completeReferralProvisioning(input: {
  referralId: string;
  username: string;
  password?: string;
  operationId: string;
}, accessToken?: string) {
  const actor = await requireCurrentAccount(accessToken);
  assertCanManageReferrals(actor);

  const admin = createAdminClient();
  const usernameNormalized = validateUsernamePolicy(input.username);
  const username = input.username.trim();
  const password = input.password ?? generateTemporaryPassword();
  validatePasswordPolicy(password);
  const requestFingerprint = fingerprint({
    referralId: input.referralId,
    username: usernameNormalized,
  });
  const authEmail = internalAuthEmail();
  const actorClient = accessToken
    ? createMobileAuthClient(accessToken)
    : await createClient();

  async function reconcileDatabase(
    authUserId: string | null,
  ): Promise<ReferralProvisioningReconciliation> {
    const { data: operation, error: operationError } = await admin
      .from("referral_operation_idempotency")
      .select(
        "operation_type, actor_application_user_id, referral_id, request_fingerprint",
      )
      .eq("operation_id", input.operationId.trim())
      .maybeSingle();

    if (operationError) throw new Error("referral_reconciliation_failed");

    if (!operation) {
      if (!authUserId) return { state: "absent" };

      const { data: authReference, error: authReferenceError } = await admin
        .from("application_users")
        .select("id")
        .eq("auth_user_id", authUserId)
        .maybeSingle();

      if (authReferenceError) {
        throw new Error("referral_reconciliation_failed");
      }

      return authReference ? { state: "conflict" } : { state: "absent" };
    }

    if (
      operation.operation_type !== "referral_complete" ||
      operation.actor_application_user_id !== actor.id ||
      operation.referral_id !== input.referralId ||
      operation.request_fingerprint !== requestFingerprint
    ) {
      return { state: "conflict" };
    }

    const { data: referral, error: referralError } = await admin
      .from("referrals")
      .select(
        "status, referred_application_user_id, referred_member_profile_id, completed_by_application_user_id, completed_at",
      )
      .eq("id", input.referralId)
      .maybeSingle();

    if (referralError) throw new Error("referral_reconciliation_failed");
    if (
      !referral ||
      referral.status !== "completed" ||
      !referral.referred_application_user_id ||
      !referral.referred_member_profile_id ||
      referral.completed_by_application_user_id !== actor.id ||
      !referral.completed_at
    ) {
      return { state: "conflict" };
    }

    const accountId = String(referral.referred_application_user_id);
    const memberProfileId = String(referral.referred_member_profile_id);
    const [accountResult, rolesResult, profilesResult, accountAuditsResult, referralAuditsResult] =
      await Promise.all([
        admin
          .from("application_users")
          .select("id, auth_user_id")
          .eq("id", accountId)
          .maybeSingle(),
        admin
          .from("application_user_roles")
          .select("roles!inner(key)")
          .eq("application_user_id", accountId),
        admin
          .from("member_profiles")
          .select("id, application_user_id")
          .eq("application_user_id", accountId),
        admin
          .from("account_security_events")
          .select("id, actor_application_user_id, metadata")
          .eq("target_application_user_id", accountId)
          .eq("event_type", "account.created"),
        admin
          .from("referral_audit_events")
          .select("id, actor_application_user_id, metadata")
          .eq("referral_id", input.referralId)
          .eq("event_type", "referral.completed"),
      ]);

    if (
      accountResult.error ||
      rolesResult.error ||
      profilesResult.error ||
      accountAuditsResult.error ||
      referralAuditsResult.error
    ) {
      throw new Error("referral_reconciliation_failed");
    }

    const roleKeys = (rolesResult.data ?? []).map((row) => {
      const role = row.roles;
      return role && !Array.isArray(role)
        ? String((role as { key?: unknown }).key)
        : null;
    });
    const profile = profilesResult.data?.[0];
    const matchingAccountAudits = (accountAuditsResult.data ?? []).filter(
      (audit) =>
        audit.actor_application_user_id === actor.id &&
        audit.metadata &&
        !Array.isArray(audit.metadata) &&
        String((audit.metadata as { role?: unknown }).role) === "member",
    );
    const matchingReferralAudits = (referralAuditsResult.data ?? []).filter(
      (audit) =>
        audit.actor_application_user_id === actor.id &&
        audit.metadata &&
        !Array.isArray(audit.metadata) &&
        String(
          (audit.metadata as { application_user_id?: unknown })
            .application_user_id,
        ) === accountId,
    );

    if (
      !accountResult.data ||
      roleKeys.length !== 1 ||
      roleKeys[0] !== "member" ||
      profilesResult.data?.length !== 1 ||
      String(profile?.id) !== memberProfileId ||
      String(profile?.application_user_id) !== accountId ||
      accountAuditsResult.data?.length !== 1 ||
      matchingAccountAudits.length !== 1 ||
      referralAuditsResult.data?.length !== 1 ||
      matchingReferralAudits.length !== 1
    ) {
      return { state: "conflict" };
    }

    if (!authUserId) {
      return { state: "committed_to_existing_account", accountId };
    }

    if (accountResult.data.auth_user_id === authUserId) {
      return { state: "committed_to_this_auth", accountId };
    }

    const { data: unexpectedReference, error: unexpectedReferenceError } =
      await admin
        .from("application_users")
        .select("id")
        .eq("auth_user_id", authUserId)
        .maybeSingle();

    if (unexpectedReferenceError) {
      throw new Error("referral_reconciliation_failed");
    }

    return unexpectedReference
      ? { state: "conflict" }
      : { state: "committed_to_existing_account", accountId };
  }

  const result = await provisionReferralAcrossBoundaries({
    async precheckDatabase() {
      const reconciliation = await reconcileDatabase(null);

      if (reconciliation.state === "committed_to_existing_account") {
        return {
          state: "committed",
          accountId: reconciliation.accountId,
        };
      }

      if (reconciliation.state === "conflict") {
        throw new ReferralProvisioningError("operation_id_conflict");
      }

      const { data: referral, error: referralError } = await admin
        .from("referrals")
        .select("status, applicant_phone")
        .eq("id", input.referralId)
        .maybeSingle();

      if (referralError || !referral) {
        throw new ReferralProvisioningError("referral_not_found");
      }

      if (referral.status !== "approved") {
        throw new ReferralProvisioningError("referral_not_approved");
      }

      if (!referral.applicant_phone) {
        throw new ReferralProvisioningError(
          "referral_provisioning_conflict",
        );
      }

      const { data: existingMember, error: existingMemberError } = await admin
        .from("member_profiles")
        .select("id")
        .eq("phone", asString(referral.applicant_phone))
        .eq("status", "active")
        .limit(1)
        .maybeSingle();

      if (existingMemberError) {
        throw new ReferralProvisioningError("referral_provisioning_failed");
      }

      if (existingMember) {
        throw new ReferralProvisioningError("phone_already_member");
      }

      return { state: "absent" };
    },

    async createAuthUser() {
      const { data, error } = await admin.auth.admin.createUser({
        email: authEmail,
        password,
        email_confirm: true,
      });

      if (error || !data.user) {
        throw new ReferralProvisioningError("referral_provisioning_failed");
      }

      return data.user.id;
    },

    async finalizeDatabase(authUserId) {
      const { data, error } = await actorClient.rpc(
        "finalize_referral_member_provisioning",
        {
          p_referral_id: input.referralId,
          p_operation_id: input.operationId,
          p_auth_user_id: authUserId,
          p_auth_login_email: authEmail,
          p_username: username,
          p_username_normalized: usernameNormalized,
        },
      );

      if (error) {
        const safeCode = [
          "not_authorized",
          "invalid_username",
          "referral_not_found",
          "referral_not_approved",
          "phone_already_member",
          "operation_id_conflict",
          "referral_provisioning_conflict",
        ].find((code) => error.message.includes(code));

        throw new ReferralProvisioningError(
          (safeCode ?? "referral_provisioning_failed") as
            | "not_authorized"
            | "invalid_username"
            | "referral_not_found"
            | "referral_not_approved"
            | "phone_already_member"
            | "operation_id_conflict"
            | "referral_provisioning_conflict"
            | "referral_provisioning_failed",
        );
      }

      if (!data || typeof data !== "object" || Array.isArray(data)) {
        throw new ReferralProvisioningError("referral_provisioning_failed");
      }

      const row = data as DbRow;
      if (
        !row.application_user_id ||
        typeof row.used_supplied_auth_user !== "boolean"
      ) {
        throw new ReferralProvisioningError("referral_provisioning_failed");
      }

      return {
        accountId: asString(row.application_user_id),
        usedSuppliedAuthUser: row.used_supplied_auth_user,
      };
    },
    reconcileDatabase,
    async deleteAuthUser(authUserId) {
      const { error } = await admin.auth.admin.deleteUser(authUserId);
      if (error) throw new Error("auth_cleanup_failed");
    },
    observeReconciliationRequired(reason, authUserId) {
      console.error("Referral provisioning requires manual reconciliation.", {
        referralId: input.referralId,
        operationId: input.operationId,
        authUserId,
        reason,
      });
    },
  });

  return {
    accountId: result.accountId,
    temporaryPassword: result.exposeCreatedCredential ? password : null,
  };
}
