"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentAccount } from "@/lib/accounts/server";
import { createClient } from "@/lib/supabase/server";

export async function updateMeetingLocationAction(form: FormData) {
  const account = await getCurrentAccount();
  if (!account || account.status !== "active" || account.role !== "system_admin") redirect("/dashboard");
  const latitude = Number(form.get("latitude"));
  const longitude = Number(form.get("longitude"));
  if (!String(form.get("latitude") ?? "").trim() || !String(form.get("longitude") ?? "").trim()
    || !Number.isFinite(latitude) || !Number.isFinite(longitude)
    || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180)
    redirect("/admin/meeting-location?error=invalid");
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_meeting_attendance_location", {
    p_latitude: latitude, p_longitude: longitude,
  });
  if (error) redirect("/admin/meeting-location?error=failed");
  revalidatePath("/admin/meeting-location");
  redirect("/admin/meeting-location?updated=1");
}
