"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ownMemberProfileUpdateSchema } from "@masjid-e-mamoor/validation";
import { ownPasswordChangeSchema } from "@masjid-e-mamoor/validation";
import { changeOwnPassword } from "@/lib/accounts/server";
import { updateOwnMemberProfile } from "@/lib/members/server";

export type ProfilePasswordActionState = {
  error?: string;
  message?: string;
};

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

export async function changeOwnPasswordAction(
  _state: ProfilePasswordActionState,
  formData: FormData,
): Promise<ProfilePasswordActionState> {
  const parsed = ownPasswordChangeSchema.safeParse({
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return { error: "Passwords must match and meet the required strength rules." };
  }

  try {
    await changeOwnPassword(parsed.data.password);
    return { message: "Password updated successfully." };
  } catch {
    return { error: "The password could not be updated." };
  }
}
