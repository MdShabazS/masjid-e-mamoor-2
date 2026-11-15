import "server-only";
import { createClient } from "@/lib/supabase/server";

export type MeetingInvitation = {
  id: string; title: string; location: string | null; scheduled_start: string;
  status: string; participant_ids: string[]; created_by_application_user_id: string;
};
export type MeetingResponse = {
  application_user_id: string; response: "accepted" | "declined";
  decline_reason: string | null; responded_at: string;
};

export async function listInvitedMeetings(actorId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_committee_meetings", {
    p_limit: 200, p_offset: 0,
  });
  if (error) throw new Error("Meetings unavailable");
  return ((data ?? []) as MeetingInvitation[]).filter((meeting) =>
    meeting.participant_ids?.includes(actorId) || meeting.created_by_application_user_id === actorId);
}

export async function listMyMeetingResponses(actorId: string, meetingIds: string[]) {
  if (!meetingIds.length) return new Map<string, MeetingResponse>();
  const supabase = await createClient();
  const { data, error } = await supabase.from("committee_meeting_responses")
    .select("meeting_id, application_user_id, response, decline_reason, responded_at, response_sequence")
    .eq("application_user_id", actorId).in("meeting_id", meetingIds)
    .order("response_sequence", { ascending: false });
  if (error) throw new Error("Meeting responses unavailable");
  const latest = new Map<string, MeetingResponse>();
  for (const row of data ?? []) {
    if (!latest.has(row.meeting_id)) latest.set(row.meeting_id, row as MeetingResponse);
  }
  return latest;
}
