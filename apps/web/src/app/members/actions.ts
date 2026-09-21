"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  adminMemberProfileUpdateSchema,
  adminMemberStatusChangeSchema,
  memberSearchSchema,
} from "@masjid-e-mamoor/validation";
import { changeMemberStatus, updateMemberProfile } from "@/lib/members/server";

export async function searchMembers(formData: FormData) {
  const parsed = memberSearchSchema.safeParse({ search: String(formData.get("search") ?? "") });
  const search = parsed.success ? parsed.data.search : "";
  redirect(`/members${search ? `?search=${encodeURIComponent(search)}` : ""}`);
}

export async function saveMember(formData: FormData) {
  const parsed = adminMemberProfileUpdateSchema.safeParse({
    memberProfileId: String(formData.get("memberProfileId") ?? ""),
    displayName: String(formData.get("displayName") ?? ""),
    phone: String(formData.get("phone") ?? "").trim() || null,
    operationId: randomUUID(),
    reason: String(formData.get("reason") ?? "").trim() || null,
  });
  if (!parsed.success) redirect("/members?error=invalid_member_update");

  try {
    await updateMemberProfile(parsed.data.memberProfileId, parsed.data.displayName, parsed.data.phone, parsed.data.operationId, parsed.data.reason ?? null);
  } catch {
    redirect(`/members/${encodeURIComponent(parsed.data.memberProfileId)}?error=update_failed`);
  }

  revalidatePath("/members");
  revalidatePath(`/members/${parsed.data.memberProfileId}`);
  redirect(`/members/${parsed.data.memberProfileId}?saved=1`);
}

export async function toggleMemberStatus(formData: FormData) {
  const parsed = adminMemberStatusChangeSchema.safeParse({
    memberProfileId: String(formData.get("memberProfileId") ?? ""),
    status: String(formData.get("status") ?? ""),
    operationId: randomUUID(),
    reason: String(formData.get("reason") ?? "").trim() || null,
  });
  if (!parsed.success) redirect("/members?error=invalid_member_status");

  try {
    await changeMemberStatus(parsed.data.memberProfileId, parsed.data.status, parsed.data.operationId, parsed.data.reason ?? null);
  } catch {
    redirect(`/members/${encodeURIComponent(parsed.data.memberProfileId)}?error=status_failed`);
  }

  revalidatePath("/members");
  revalidatePath(`/members/${parsed.data.memberProfileId}`);
  redirect(`/members/${parsed.data.memberProfileId}?saved=1`);
}
