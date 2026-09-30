import { randomUUID } from "expo-crypto";
import { adminMemberProfileUpdateSchema, adminMemberStatusChangeSchema, ownMemberProfileUpdateSchema } from "@masjid-e-mamoor/validation";
import { supabase } from "../lib/supabase";
import type { MobileReferral, MobileMember, MemberPageCursor } from "./types";

function mapMember(row: Record<string, unknown>): MobileMember {
  return {
    id: String(row.id),
    applicationUserId: String(row.application_user_id),
    status: row.status === "inactive" ? "inactive" : "active",
    displayName: String(row.display_name),
    phone: row.phone == null ? null : String(row.phone),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function mapReferral(row: Record<string, unknown>): MobileReferral {
  return {
    id: String(row.id),
    referralCode: String(row.referral_code),
    status: String(row.status),
    applicantDisplayName: row.applicant_display_name == null ? null : String(row.applicant_display_name),
    applicantPhone: row.applicant_phone == null ? null : String(row.applicant_phone),
    referrerDisplayName: row.referrer_display_name == null ? null : String(row.referrer_display_name),
    createdAt: String(row.created_at),
    submittedAt: row.submitted_at == null ? null : String(row.submitted_at),
    reviewedAt: row.reviewed_at == null ? null : String(row.reviewed_at),
    reviewReason: row.review_reason == null ? null : String(row.review_reason),
    completedAt: row.completed_at == null ? null : String(row.completed_at),
  };
}

export async function listMembers(search: string, cursor?: MemberPageCursor | null) {
  const { data, error } = await supabase.rpc("admin_list_member_profiles", {
    p_search: search.trim() || null,
    p_limit: 50,
    p_after_created_at: cursor?.createdAt ?? null,
    p_after_id: cursor?.id ?? null,
  });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Record<string, unknown>[];
  const members = rows.map(mapMember);
  const last = members.at(-1);
  return {
    members,
    nextCursor: last ? { createdAt: last.createdAt, id: last.id } : null,
  };
}

export async function getMember(memberId: string) {
  const { data, error } = await supabase.rpc("admin_get_member_profile", {
    p_member_profile_id: memberId,
  });
  if (error) throw new Error(error.message);
  const row = (data?.[0] ?? null) as Record<string, unknown> | null;
  return row ? mapMember(row) : null;
}

export async function updateMember(input: {
  memberProfileId: string;
  displayName: string;
  phone: string | null;
  reason: string | null;
}) {
  const parsed = adminMemberProfileUpdateSchema.safeParse({
    ...input,
    operationId: randomUUID(),
  });
  if (!parsed.success) throw new Error("invalid_member");
  const { error } = await supabase.rpc("admin_update_member_profile", {
    p_member_profile_id: parsed.data.memberProfileId,
    p_display_name: parsed.data.displayName,
    p_phone: parsed.data.phone,
    p_operation_id: parsed.data.operationId,
    p_reason: parsed.data.reason ?? null,
  });
  if (error) throw new Error(error.message);
}

export async function changeMemberStatus(
  memberProfileId: string,
  status: "active" | "inactive",
  reason: string | null,
) {
  const parsed = adminMemberStatusChangeSchema.safeParse({
    memberProfileId,
    status,
    reason,
    operationId: randomUUID(),
  });
  if (!parsed.success) throw new Error("invalid_member");
  const { error } = await supabase.rpc("admin_change_member_status", {
    p_member_profile_id: parsed.data.memberProfileId,
    p_status: parsed.data.status,
    p_operation_id: parsed.data.operationId,
    p_reason: parsed.data.reason ?? null,
  });
  if (error) throw new Error(error.message);
}

export async function updateOwnMemberProfile(
  displayName: string,
  phone: string | null,
) {
  const parsed = ownMemberProfileUpdateSchema.safeParse({
    displayName,
    phone,
    operationId: randomUUID(),
  });
  if (!parsed.success) throw new Error("invalid_profile");
  const { error } = await supabase.rpc("update_own_member_profile", {
    p_display_name: parsed.data.displayName,
    p_phone: parsed.data.phone,
    p_operation_id: parsed.data.operationId,
  });
  if (error) throw new Error(error.message);
}

export async function listOwnReferrals(referrerMemberProfileId: string) {
  const { data, error } = await supabase
    .from("referrals")
    .select("id, referral_code, status, applicant_display_name, applicant_phone, created_at, submitted_at, reviewed_at, review_reason, completed_at")
    .eq("referrer_member_profile_id", referrerMemberProfileId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapReferral(row as Record<string, unknown>));
}

export async function createReferral() {
  const { data, error } = await supabase.rpc("create_referral", {
    p_operation_id: randomUUID(),
  });
  if (error || !data) throw new Error(error?.message ?? "referral_failed");
  return mapReferral(data as Record<string, unknown>);
}
