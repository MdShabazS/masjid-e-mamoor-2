import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentAccount } from "@/lib/accounts/server";
import { hasPermission } from "@/lib/members/server";
import { createClient } from "@/lib/supabase/server";
import { updateMeetingAction } from "../../actions";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> };
type Option = { application_user_id: string; display_name: string; role_label: string };
function indiaInput(value: string | null) {
  if (!value) return "";
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(value));
  const part = (name: string) => parts.find((entry) => entry.type === name)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
}
export default async function EditMeetingPage({ params, searchParams }: Props) {
  const [account, allowed, route, query] = await Promise.all([
    getCurrentAccount(), hasPermission("committee.meetings.manage"), params, searchParams,
  ]);
  if (!account || account.status !== "active" || !allowed
    || !["president", "vice_president", "secretary"].includes(account.role)) redirect("/meetings");
  if (!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(route.id)) notFound();
  const supabase = await createClient();
  const [{ data: meeting, error }, { data: options, error: optionsError }] = await Promise.all([
    supabase.rpc("get_committee_meeting", { p_meeting_id: route.id }),
    supabase.rpc("list_committee_meeting_participant_options"),
  ]);
  if (error || !meeting || optionsError) notFound();
  const detail = meeting as { meeting: { title: string; meeting_type: string; details: string | null;
    location: string | null; scheduled_start: string; scheduled_end: string | null; status: string };
    participants: { application_user_id: string }[] };
  if (detail.meeting.status !== "scheduled") redirect("/meetings");
  const invited = new Set(detail.participants.map((item) => item.application_user_id));
  return <main className="min-h-screen px-5 py-8 sm:px-8"><div className="mx-auto max-w-3xl">
    <header className="border-b border-emerald-950/10 pb-8"><Link href="/meetings" className="text-sm text-emerald-800">← Meetings</Link>
      <p className="eyebrow mt-6">Masjid E Mamoor 2</p><h1 className="page-title">Edit meeting</h1>
      <p className="page-intro">Changes to the schedule and invitees are recorded in meeting history.</p></header>
    {query.error && <p role="alert" className="mt-6 rounded-xl bg-red-50 p-4 text-sm text-red-800">Check the details and invited members, then try again.</p>}
    <form action={updateMeetingAction} className="surface mt-7 grid gap-5 p-6 sm:p-8">
      <input type="hidden" name="meetingId" value={route.id} />
      <label className="field-label">Title<input className="field-input" name="title" required maxLength={200} defaultValue={detail.meeting.title} /></label>
      <label className="field-label">Meeting type<input className="field-input" name="meetingType" required maxLength={100} defaultValue={detail.meeting.meeting_type} /></label>
      <label className="field-label">Details<textarea className="field-input min-h-24" name="details" maxLength={5000} defaultValue={detail.meeting.details ?? ""} /></label>
      <label className="field-label">Location<input className="field-input" name="location" maxLength={500} defaultValue={detail.meeting.location ?? ""} /></label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="field-label">Starts (India time)<input className="field-input" type="datetime-local" name="start" required defaultValue={indiaInput(detail.meeting.scheduled_start)} /></label>
        <label className="field-label">Ends (optional, India time)<input className="field-input" type="datetime-local" name="end" defaultValue={indiaInput(detail.meeting.scheduled_end)} /></label>
      </div>
      <fieldset className="rounded-xl border border-zinc-200 p-4"><legend className="px-1 font-semibold">Invitees</legend>
        <div className="grid max-h-72 gap-2 overflow-y-auto sm:grid-cols-2">{(options as Option[]).map((person) =>
          <label key={person.application_user_id} className="flex items-start gap-2 rounded-lg border border-zinc-100 p-2 text-sm">
            <input className="mt-1" type="checkbox" name="participant" value={person.application_user_id} defaultChecked={invited.has(person.application_user_id)} />
            <span>{person.display_name}<span className="block text-xs text-zinc-500">{person.role_label}</span></span>
          </label>)}</div>
      </fieldset>
      <button className="button-primary justify-self-start">Save meeting</button>
    </form>
  </div></main>;
}
