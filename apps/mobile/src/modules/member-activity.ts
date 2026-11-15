import { supabase } from "../lib/supabase";
import { isValidIsoDate, isValidIsoMonth } from "../lib/date-input";

type DbRow = Record<string, unknown>;
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
export type ActivityRange = { from: string; to: string };

export function activityMonthRange(month: string): ActivityRange {
  if (!isValidIsoMonth(month)) throw new Error("invalid_activity_range");
  const [year, number] = month.split("-").map(Number);
  return { from: `${month}-01`, to: `${month}-${new Date(Date.UTC(year, number, 0)).getUTCDate()}` };
}
export function activityYearRange(year: string): ActivityRange {
  if (!/^\d{4}$/.test(year) || Number(year) < 2000 || Number(year) > 2100) throw new Error("invalid_activity_range");
  return { from: `${year}-01-01`, to: `${year}-12-31` };
}
export function activityCustomRange(from: string, to: string): ActivityRange {
  if (!isValidIsoDate(from) || !isValidIsoDate(to) || from > to
    || (Date.parse(to) - Date.parse(from)) / 86400000 > 3660) throw new Error("invalid_activity_range");
  return { from, to };
}
export function currentIndiaMonth(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit",
  }).formatToParts(date);
  return `${parts.find((part) => part.type === "year")?.value}-${parts.find((part) => part.type === "month")?.value}`;
}
export async function listMemberActivity(range: ActivityRange): Promise<MemberActivity[]> {
  const { data, error } = await supabase.rpc("list_member_activity", {
    p_start_date: range.from, p_end_date: range.to,
  });
  if (error) throw new Error("member_activity_unavailable");
  return ((data ?? []) as DbRow[]).map((row) => ({
    id: String(row.application_user_id), displayName: String(row.display_name), roleName: String(row.role_name),
    taskAssigned: Number(row.task_assigned_count), taskCompleted: Number(row.task_completed_count),
    meetingInvited: Number(row.meeting_invited_count), meetingAttended: Number(row.meeting_attended_count),
    meetingDeclined: Number(row.meeting_declined_count), meetingAbsent: Number(row.meeting_absent_count),
    verifiedReferredDonationCount: Number(row.verified_referred_donation_count),
    verifiedReferredDonationPaise: Number(row.verified_referred_donation_paise),
  }));
}
