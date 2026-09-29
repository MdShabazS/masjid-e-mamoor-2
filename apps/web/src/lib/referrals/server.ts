import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { cache } from "react";

import type { AccountRecord } from "@/lib/accounts/server";
import { createAccount, getCurrentAccount, requireCurrentAccount } from "@/lib/accounts/server";
import { getOwnMemberProfile, hasPermission } from "@/lib/members/server";
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
  const { data: referral, error: referralError } = await admin
    .from("referrals")
    .select(
      "id, status, applicant_display_name, applicant_phone, referred_application_user_id, referred_member_profile_id",
    )
    .eq("id", input.referralId)
    .single();

  if (referralError || !referral) throw new Error("referral_not_found");

  const requestFingerprint = fingerprint({
    referralId: input.referralId,
    username: input.username.trim().toLowerCase(),
  });

  const { data: existingOperation, error: operationError } = await admin
    .from("referral_operation_idempotency")
    .select("operation_type, actor_application_user_id, referral_id, request_fingerprint")
    .eq("operation_id", input.operationId)
    .maybeSingle();

  if (operationError) throw operationError;

  if (existingOperation) {
    if (
      existingOperation.operation_type !== "referral_complete" ||
      existingOperation.actor_application_user_id !== actor.id ||
      existingOperation.referral_id !== input.referralId ||
      existingOperation.request_fingerprint !== requestFingerprint
    ) {
      throw new Error("operation_id_conflict");
    }

    return { temporaryPassword: null };
  }

  if (referral.status !== "approved") {
    throw new Error("referral_not_approved");
  }

  const { data: existingMember, error: existingMemberError } = await admin
    .from("member_profiles")
    .select("id")
    .eq("phone", asString(referral.applicant_phone))
    .eq("status", "active")
    .maybeSingle();

  if (existingMemberError) throw existingMemberError;
  if (existingMember) throw new Error("phone_already_member");

  const result = await createAccount({
    username: input.username,
    role: "member",
    password: input.password,
    displayName: asString(referral.applicant_display_name),
    phone: asString(referral.applicant_phone),
  }, accessToken);

  const { data: memberProfile, error: memberError } = await admin
    .from("member_profiles")
    .select("id")
    .eq("application_user_id", result.accountId)
    .single();

  if (memberError || !memberProfile) throw new Error("member_profile_missing");

  const now = new Date().toISOString();
  const { data: completedReferral, error: updateError } = await admin
    .from("referrals")
    .update({
      status: "completed",
      referred_application_user_id: result.accountId,
      referred_member_profile_id: memberProfile.id,
      completed_at: now,
      completed_by_application_user_id: actor.id,
    })
    .eq("id", input.referralId)
    .eq("status", "approved")
    .select("id")
    .single();

  if (updateError || !completedReferral) throw new Error("referral_not_approved");

  const { error: operationInsertError } = await admin
    .from("referral_operation_idempotency")
    .insert({
      operation_id: input.operationId,
      operation_type: "referral_complete",
      actor_application_user_id: actor.id,
      referral_id: input.referralId,
      request_fingerprint: requestFingerprint,
    });

  if (operationInsertError) throw operationInsertError;

  const { error: auditError } = await admin
    .from("referral_audit_events")
    .insert({
      referral_id: input.referralId,
      actor_application_user_id: actor.id,
      event_type: "referral.completed",
      metadata: { application_user_id: result.accountId },
    });

  if (auditError) throw auditError;

  return { temporaryPassword: result.temporaryPassword };
}
