"use server";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { hasPermission } from "@/lib/members/server";
import { getCurrentAccount } from "@/lib/accounts/server";
import { parseMeetingCreation } from "@/lib/work/meeting-input";
import { createClient } from "@/lib/supabase/server";

export async function respondToMeetingAction(form: FormData) {
  const id = String(form.get("meetingId") ?? "");
  const response = String(form.get("response") ?? "");
  const reason = String(form.get("reason") ?? "").trim() || null;
  if (!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id) ||
    !["accepted", "declined"].includes(response) ||
    (response === "declined" && (!reason || reason.length > 1000)) ||
    (response === "accepted" && reason !== null)) {
    redirect("/meetings?error=invalid");
  }
  if (!(await hasPermission("committee.meetings.read"))) redirect("/dashboard");
  const supabase = await createClient();
  const { error } = await supabase.rpc("respond_to_committee_meeting", {
    p_meeting_id: id, p_response: response, p_decline_reason: reason,
    p_operation_id: randomUUID(),
  });
  if (error) redirect("/meetings?error=failed");
  revalidatePath("/meetings");
  redirect("/meetings?updated=1");
}

export async function createMeetingAction(form: FormData) {
  const account = await getCurrentAccount();
  if (!account || account.status !== "active"
    || !["president", "vice_president", "secretary"].includes(account.role)
    || !(await hasPermission("committee.meetings.manage"))) redirect("/meetings");
  let draft: ReturnType<typeof parseMeetingCreation>;
  try { draft = parseMeetingCreation(form); }
  catch { redirect("/meetings/new?error=invalid"); }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_committee_meeting", {
    p_title: draft.title, p_meeting_type: draft.meetingType,
    p_details: draft.details, p_location: draft.location,
    p_scheduled_start: draft.scheduledStart, p_scheduled_end: draft.scheduledEnd,
    p_participant_ids: draft.participantIds, p_operation_id: randomUUID(),
  });
  if (error || !data) redirect("/meetings/new?error=failed");
  revalidatePath("/meetings");
  redirect("/meetings?created=1");
}

export async function recordManualMeetingAttendanceAction(form: FormData) {
  const account = await getCurrentAccount();
  if (!account || account.status !== "active") redirect("/dashboard");
  const meetingId = String(form.get("meetingId") ?? "");
  const participantId = String(form.get("participantId") ?? "");
  const reason = String(form.get("reason") ?? "").trim();
  const uuid = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
  if (!uuid.test(meetingId) || !uuid.test(participantId) || reason.length < 10 || reason.length > 1000)
    redirect("/meetings?error=manual-invalid");
  const supabase = await createClient();
  const { error } = await supabase.rpc("record_manual_committee_meeting_attendance", {
    p_meeting_id: meetingId, p_application_user_id: participantId,
    p_reason: reason, p_operation_id: randomUUID(),
  });
  if (error) redirect("/meetings?error=manual-failed");
  revalidatePath("/meetings");
  redirect("/meetings?attendance=1");
}

export async function updateMeetingAction(form: FormData) {
  const account = await getCurrentAccount();
  if (!account || account.status !== "active"
    || !["president", "vice_president", "secretary"].includes(account.role)
    || !(await hasPermission("committee.meetings.manage"))) redirect("/meetings");
  const meetingId = String(form.get("meetingId") ?? "");
  if (!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(meetingId)) redirect("/meetings");
  let draft: ReturnType<typeof parseMeetingCreation>;
  try { draft = parseMeetingCreation(form); }
  catch { redirect(`/meetings/${meetingId}/edit?error=invalid`); }
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_committee_meeting", {
    p_meeting_id: meetingId, p_title: draft.title, p_meeting_type: draft.meetingType,
    p_details: draft.details, p_location: draft.location,
    p_scheduled_start: draft.scheduledStart, p_scheduled_end: draft.scheduledEnd,
    p_participant_ids: draft.participantIds, p_operation_id: randomUUID(),
  });
  if (error) redirect(`/meetings/${meetingId}/edit?error=failed`);
  revalidatePath("/meetings");
  redirect("/meetings?updated=1");
}
