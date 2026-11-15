import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentAccount } from "@/lib/accounts/server";
import { hasPermission } from "@/lib/members/server";
import { createClient } from "@/lib/supabase/server";
import { createMeetingAction } from "../actions";

type Props = { searchParams: Promise<{ error?: string }> };
type Option = { application_user_id: string; display_name: string; role_label: string };
export default async function NewMeetingPage({ searchParams }: Props) {
  const [account, canManage, params] = await Promise.all([
    getCurrentAccount(), hasPermission("committee.meetings.manage"), searchParams,
  ]);
  if (!account || account.status !== "active" || !canManage
    || !["president", "vice_president", "secretary"].includes(account.role)) redirect("/meetings");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_committee_meeting_participant_options");
  if (error) throw new Error("meeting_participants_unavailable");
  const options = (data ?? []) as Option[];
  return <main className="min-h-screen px-5 py-8 sm:px-8"><div className="mx-auto max-w-3xl">
    <header className="border-b border-emerald-950/10 pb-8">
      <Link href="/meetings" className="text-sm font-medium text-emerald-800">← Meetings</Link>
      <p className="eyebrow mt-6">Masjid E Mamoor 2</p><h1 className="page-title">Create meeting</h1>
      <p className="page-intro">Schedule the meeting in India time and choose who to invite. Every eligible active account is selected initially.</p>
    </header>
    {params.error && <p role="alert" className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{params.error === "invalid" ? "Check the meeting dates and select at least one invitee." : "The meeting could not be saved. Please try again."}</p>}
    <form action={createMeetingAction} className="surface mt-7 grid gap-5 p-6 sm:p-8">
      <label className="field-label">Title<input className="field-input" name="title" required maxLength={200} /></label>
      <label className="field-label">Meeting type<input className="field-input" name="meetingType" defaultValue="general" required maxLength={100} /></label>
      <label className="field-label">Details<textarea className="field-input min-h-24" name="details" maxLength={5000} /></label>
      <label className="field-label">Location<input className="field-input" name="location" maxLength={500} /></label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="field-label">Starts (India time)<input className="field-input" type="datetime-local" name="start" required /></label>
        <label className="field-label">Ends (optional, India time)<input className="field-input" type="datetime-local" name="end" /></label>
      </div>
      <fieldset className="rounded-xl border border-zinc-200 p-4"><legend className="px-1 font-semibold">Invitees</legend>
        <p className="mb-3 text-sm text-zinc-600">Uncheck anyone who should not be invited.</p>
        <div className="grid max-h-72 gap-2 overflow-y-auto sm:grid-cols-2">
          {options.map((person) => <label key={person.application_user_id} className="flex items-start gap-2 rounded-lg border border-zinc-100 p-2 text-sm">
            <input className="mt-1" type="checkbox" name="participant" value={person.application_user_id} defaultChecked />
            <span>{person.display_name}<span className="block text-xs text-zinc-500">{person.role_label}</span></span>
          </label>)}
        </div>
        {options.length === 0 && <p className="text-sm text-zinc-600">No eligible invitees are available.</p>}
      </fieldset>
      <button className="button-primary justify-self-start" disabled={options.length === 0}>Create meeting</button>
    </form>
  </div></main>;
}
