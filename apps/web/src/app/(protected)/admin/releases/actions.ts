"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentAccount } from "@/lib/accounts/server";
import { createClient } from "@/lib/supabase/server";
const version = /^(0|[1-9][0-9]{0,5})\.(0|[1-9][0-9]{0,5})\.(0|[1-9][0-9]{0,5})$/;
export async function updateAndroidReleaseAction(form: FormData) {
  const account = await getCurrentAccount();
  if (!account || account.status !== "active" || account.role !== "system_admin") redirect("/dashboard");
  const latest = String(form.get("latest") ?? "").trim();
  const minimum = String(form.get("minimum") ?? "").trim();
  const url = String(form.get("url") ?? "").trim();
  const message = String(form.get("message") ?? "").trim();
  if (!version.test(latest) || !version.test(minimum) || !/^https:\/\/[^\s]+$/.test(url)
    || url.length > 500 || !message || message.length > 500) redirect("/admin/releases?error=invalid");
  let parsedUrl: URL;
  try { parsedUrl = new URL(url); }
  catch { redirect("/admin/releases?error=invalid"); }
  if (parsedUrl.protocol !== "https:" || parsedUrl.username || parsedUrl.password
    || parsedUrl.port || !parsedUrl.pathname.toLowerCase().endsWith(".apk")) {
    redirect("/admin/releases?error=invalid");
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_android_release_policy", {
    p_latest_version: latest, p_minimum_supported_version: minimum,
    p_apk_url: url, p_update_message: message,
  });
  if (error) redirect("/admin/releases?error=failed");
  revalidatePath("/admin/releases");
  redirect("/admin/releases?updated=1");
}
