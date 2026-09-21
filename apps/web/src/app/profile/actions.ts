"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ownMemberProfileUpdateSchema } from "@masjid-e-mamoor/validation";
import { updateOwnMemberProfile } from "@/lib/members/server";

export async function saveOwnProfile(formData: FormData) {
  const parsed = ownMemberProfileUpdateSchema.safeParse({
    displayName: String(formData.get("displayName") ?? ""),
    phone: String(formData.get("phone") ?? "").trim() || null,
    operationId: randomUUID(),
  });
  if (!parsed.success) redirect("/profile?error=invalid_profile");
  try {
    await updateOwnMemberProfile(parsed.data.displayName, parsed.data.phone, parsed.data.operationId);
  } catch {
    redirect("/profile?error=save_failed");
  }
  revalidatePath("/profile");
  revalidatePath("/dashboard");
  redirect("/profile?saved=1");
}
