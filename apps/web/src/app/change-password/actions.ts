"use server";

import { redirect } from "next/navigation";
import { ownPasswordChangeSchema } from "@masjid-e-mamoor/validation";
import { changeOwnPassword } from "@/lib/accounts/server";

export async function changePassword(formData: FormData) {
  const parsed = ownPasswordChangeSchema.safeParse({
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    redirect("/change-password?error=invalid_password");
  }

  await changeOwnPassword(parsed.data.password);
  redirect("/dashboard");
}
