"use server";

import { redirect } from "next/navigation";
import { usernamePasswordLoginSchema } from "@masjid-e-mamoor/validation";
import { getLoginAccountByUsername } from "@/lib/accounts/server";
import { createClient } from "@/lib/supabase/server";

function invalidLogin(): never {
  redirect("/login?error=invalid_credentials");
}

export async function signInWithUsernamePassword(formData: FormData) {
  const parsed = usernamePasswordLoginSchema.safeParse({
    username: formData.get("username"),
    password: formData.get("password"),
  });

  if (!parsed.success) invalidLogin();

  const account = await getLoginAccountByUsername(parsed.data.username);

  if (!account || account.status !== "active") invalidLogin();

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: account.authLoginEmail,
    password: parsed.data.password,
  });

  if (error || data.user?.id !== account.authUserId) {
    await supabase.auth.signOut();
    invalidLogin();
  }

  redirect(account.mustChangePassword ? "/change-password" : "/dashboard");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
