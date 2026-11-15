import "server-only";
import { createClient } from "@/lib/supabase/server";

export type MemberActivity = {
  id: string;
  displayName: string;
  roleName: string;
  taskAssigned: number;
  taskCompleted: number;
  meetingInvited: number;
  meetingAttended: number;
  meetingDeclined: number;
  meetingAbsent: number;
  verifiedReferredDonationCount: number;
  verifiedReferredDonationPaise: number;
};

export async function listMemberActivity(startDate: string, endDate: string): Promise<MemberActivity[]> {
  const client = await createClient();
  const { data, error } = await client.rpc("list_member_activity", {
    p_start_date: startDate, p_end_date: endDate,
  });
  if (error) throw new Error("member_activity_unavailable");
  return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
    id: String(row.application_user_id),
    displayName: String(row.display_name),
    roleName: String(row.role_name),
    taskAssigned: Number(row.task_assigned_count),
    taskCompleted: Number(row.task_completed_count),
    meetingInvited: Number(row.meeting_invited_count),
    meetingAttended: Number(row.meeting_attended_count),
    meetingDeclined: Number(row.meeting_declined_count),
    meetingAbsent: Number(row.meeting_absent_count),
    verifiedReferredDonationCount: Number(row.verified_referred_donation_count),
    verifiedReferredDonationPaise: Number(row.verified_referred_donation_paise),
  }));
}
