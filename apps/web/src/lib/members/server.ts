import type { MemberPageCursor, MemberProfile } from "@masjid-e-mamoor/types";
import { createClient } from "@/lib/supabase/server";

type MemberProfileRow = {
  id: string;
  application_user_id: string;
  status: "active" | "inactive";
  display_name: string;
  phone: string | null;
  created_at: string;
  updated_at: string;
};

function mapMember(row: MemberProfileRow): MemberProfile {
  return {
    id: row.id,
    applicationUserId: row.application_user_id,
    status: row.status,
    displayName: row.display_name,
    phone: row.phone,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getCurrentApplicationUserId() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("current_application_user_id");
  return !error && data ? (data as string) : null;
}

export async function hasPermission(permission: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("has_application_permission", {
    requested_permission: permission,
  });
  return !error && data === true;
}

export async function hasAdminMemberReadAccess() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(
    "can_use_member_admin_read_operations",
  );
  return !error && data === true;
}

export async function getOwnMemberProfile(): Promise<MemberProfile | null> {
  const supabase = await createClient();
  const applicationUserId = await getCurrentApplicationUserId();
  if (!applicationUserId) return null;

  const { data, error } = await supabase
    .from("member_profiles")
    .select("id, application_user_id, status, display_name, phone, created_at, updated_at")
    .eq("application_user_id", applicationUserId)
    .maybeSingle();

  if (error || !data) return null;
  return mapMember(data as MemberProfileRow);
}

export async function listMemberProfiles(search = "", limit = 50, cursor?: MemberPageCursor) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_list_member_profiles", {
    p_search: search || null,
    p_limit: limit,
    p_after_created_at: cursor?.createdAt ?? null,
    p_after_id: cursor?.id ?? null,
  });
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as MemberProfileRow[];
  const last = rows.at(-1);
  return {
    members: rows.map(mapMember),
    nextCursor: last ? { createdAt: last.created_at, id: last.id } : null,
  };
}

export async function getMemberProfile(memberProfileId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_get_member_profile", {
    p_member_profile_id: memberProfileId,
  });
  if (error) throw new Error(error.message);
  const row = (data?.[0] ?? null) as MemberProfileRow | null;
  return row ? mapMember(row) : null;
}

export async function updateOwnMemberProfile(displayName: string, phone: string | null, operationId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("update_own_member_profile", {
    p_display_name: displayName,
    p_phone: phone,
    p_operation_id: operationId,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function updateMemberProfile(
  memberProfileId: string,
  displayName: string,
  phone: string | null,
  operationId: string,
  reason: string | null,
) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_update_member_profile", {
    p_member_profile_id: memberProfileId,
    p_display_name: displayName,
    p_phone: phone,
    p_operation_id: operationId,
    p_reason: reason,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function changeMemberStatus(
  memberProfileId: string,
  status: "active" | "inactive",
  operationId: string,
  reason: string | null,
) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_change_member_status", {
    p_member_profile_id: memberProfileId,
    p_status: status,
    p_operation_id: operationId,
    p_reason: reason,
  });
  if (error) throw new Error(error.message);
  return data;
}
