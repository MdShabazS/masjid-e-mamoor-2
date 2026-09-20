 "use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function signInWithOtp(formData: FormData) {
  const phone = String(formData.get("phone") ?? "").trim();

  if (!/^\+[1-9]\d{7,14}$/.test(phone)) {
    redirect("/login?error=invalid_phone");
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithOtp({
    phone,
  });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }

  redirect(`/login?sent=1&phone=${encodeURIComponent(phone)}`);
}

export async function verifyOtp(formData: FormData) {
  const phone = String(formData.get("phone") ?? "").trim();
  const token = String(formData.get("token") ?? "").trim();

  if (!/^\+[1-9]\d{7,14}$/.test(phone) || !/^\d{6}$/.test(token)) {
    redirect("/login?error=invalid_otp");
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.verifyOtp({
    phone,
    token,
    type: "sms",
  });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/dashboard");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
