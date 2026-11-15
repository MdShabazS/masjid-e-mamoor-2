import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentAccount } from "@/lib/accounts/server";
import { hasPermission } from "@/lib/members/server";
import { listInvitedMeetings, listMyMeetingResponses } from "@/lib/work/meeting-responses";
import { recordManualMeetingAttendanceAction, respondToMeetingAction } from "./actions";
import { createClient } from "@/lib/supabase/server";
import { CheckInButton } from "./CheckInButton";

type Props = { searchParams: Promise<{ error?: string; updated?: string; created?: string; attendance?: string }> };
const indiaDate = (value: Date) => {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(value);
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
};

export default async function MeetingsPage({ searchParams }: Props) {
  const [account, allowed, params] = await Promise.all([getCurrentAccount(), hasPermission("committee.meetings.read"), searchParams]);
  if (!account || !allowed) redirect("/dashboard");
  const canCreate = ["president", "vice_president", "secretary"].includes(account.role) && await hasPermission("committee.meetings.manage");
  const meetings = await listInvitedMeetings(account.id);
  const responses = await listMyMeetingResponses(account.id, meetings.map((meeting) => meeting.id));
  const supabase = await createClient();
  const meetingIds = meetings.map((meeting) => meeting.id);
  const { data: myRows, error: attendanceError } = meetingIds.length ? await supabase
    .from("committee_meeting_attendance").select("meeting_id")
    .eq("application_user_id", account.id).in("meeting_id", meetingIds) : { data: [], error: null };
  if (attendanceError) throw new Error("meeting_attendance_unavailable");
  const checkedIn = new Set((myRows ?? []).map((row) => row.meeting_id));
  const creatorMeetings = meetings.filter((meeting) => meeting.created_by_application_user_id === account.id);
  const { data: participantOptions, error: optionsError } = creatorMeetings.length
    ? await supabase.rpc("list_committee_meeting_participant_options") : { data: [], error: null };
  if (optionsError) throw new Error("meeting_participants_unavailable");
  const names = new Map(((participantOptions ?? []) as { application_user_id: string; display_name: string }[])
    .map((option) => [option.application_user_id, option.display_name]));
  const today = indiaDate(new Date());
  return <main className="min-h-screen px-5 py-8 sm:px-8"><div className="mx-auto max-w-5xl">
    <header className="border-b border-emerald-950/10 pb-8"><Link href="/dashboard" className="text-sm font-medium text-emerald-800">← Dashboard</Link><p className="eyebrow mt-6">Committee operations</p><h1 className="page-title">Meetings</h1><p className="page-intro">Manage meeting invitations and responses. Invited participants can check in at the masjid on the scheduled day.</p>{canCreate && <Link href="/meetings/new" className="button-primary mt-5 inline-flex">Create meeting</Link>}</header>
    {params.attendance && <p role="status" className="mt-6 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-900">Manual attendance saved with its reason.</p>}
    {params.created && <p role="status" className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">Meeting created and invitees saved.</p>}
    {params.error && <p role="alert" className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{params.error === "manual-invalid" ? "Select an invitee and enter a reason of at least 10 characters." : params.error === "manual-failed" ? "Manual attendance could not be recorded. Check the scheduled date and invitee." : params.error === "invalid" ? "Enter a reason when declining." : "The invitation response could not be saved. Check its date and try again."}</p>}
    {params.updated && <p role="status" className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">Invitation response saved.</p>}
    <section className="mt-8 grid gap-4">{meetings.map((meeting) => {
      const current = responses.get(meeting.id);
      const open = meeting.status === "scheduled" && meeting.participant_ids?.includes(account.id) && today <= indiaDate(new Date(meeting.scheduled_start));
      return <article key={meeting.id} className="surface p-6"><div className="flex flex-wrap justify-between gap-3"><h2 className="text-lg font-semibold text-emerald-950">{meeting.title}</h2><span className="status-badge">{meeting.status}</span></div>
        {canCreate && meeting.status === "scheduled" && <Link href={`/meetings/${meeting.id}/edit`} className="mt-2 inline-flex text-sm font-medium text-emerald-800 underline">Edit meeting</Link>}
        <p className="mt-2 text-sm text-zinc-600">{new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }).format(new Date(meeting.scheduled_start))} · {meeting.location || "Location not recorded"}</p>
        <p className="mt-3 text-sm">Response: <strong>{current?.response ?? "Awaiting response"}</strong>{current?.decline_reason ? ` · ${current.decline_reason}` : ""}</p>
        {meeting.status === "scheduled" && meeting.participant_ids?.includes(account.id) && today === indiaDate(new Date(meeting.scheduled_start)) &&
          (checkedIn.has(meeting.id) ? <p className="mt-4 text-sm font-medium text-emerald-800">Attendance recorded</p> : <CheckInButton meetingId={meeting.id} />)}
        {meeting.status === "scheduled" && meeting.created_by_application_user_id === account.id && today === indiaDate(new Date(meeting.scheduled_start)) &&
          <form action={recordManualMeetingAttendanceAction} className="mt-5 grid gap-3 border-t pt-4">
            <h3 className="font-semibold text-emerald-950">Manual attendance exception</h3>
            <p className="text-sm text-zinc-600">Use when GPS fails. Your reason is kept in the audit history.</p>
            <input type="hidden" name="meetingId" value={meeting.id} />
            <label className="field-label">Invited participant<select name="participantId" required className="field-input" defaultValue=""><option value="" disabled>Select an invitee</option>{meeting.participant_ids?.map((id) => <option key={id} value={id}>{names.get(id) ?? id}</option>)}</select></label>
            <label className="field-label">Reason<textarea name="reason" required minLength={10} maxLength={1000} className="field-input" /></label>
            <button className="button-secondary justify-self-start">Mark present manually</button>
          </form>}
        {open && <div className="mt-5 grid gap-3 border-t pt-4 sm:grid-cols-2"><form action={respondToMeetingAction}><input type="hidden" name="meetingId" value={meeting.id} /><input type="hidden" name="response" value="accepted" /><button className="button-primary">Accept invitation</button></form><form action={respondToMeetingAction} className="grid gap-2"><input type="hidden" name="meetingId" value={meeting.id} /><input type="hidden" name="response" value="declined" /><label className="field-label">Reason for declining<input name="reason" required maxLength={1000} className="field-input" /></label><button className="button-secondary">Decline invitation</button></form></div>}
      </article>;
    })}{meetings.length === 0 && <p className="surface p-8 text-center text-sm text-zinc-600">No meeting invitations yet.</p>}</section>
  </div></main>;
}
