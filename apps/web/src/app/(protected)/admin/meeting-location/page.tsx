import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentAccount } from "@/lib/accounts/server";
import { createClient } from "@/lib/supabase/server";
import { updateMeetingLocationAction } from "./actions";

type Props = { searchParams: Promise<{ error?: string; updated?: string }> };
export default async function MeetingLocationPage({ searchParams }: Props) {
  const [account, params] = await Promise.all([getCurrentAccount(), searchParams]);
  if (!account || account.status !== "active" || account.role !== "system_admin") redirect("/dashboard");
  const supabase = await createClient();
  const { data: location, error: rpcError } = await supabase.rpc("get_meeting_attendance_location");
  if (rpcError) throw new Error("meeting_location_unavailable");
  const current = location as { center_latitude: number | null; center_longitude: number | null; updated_at: string | null };
  return <main className="min-h-screen px-5 py-8 sm:px-8"><div className="mx-auto max-w-3xl">
    <header className="border-b border-emerald-950/10 pb-8"><Link href="/dashboard" className="text-sm text-emerald-800">← Dashboard</Link>
      <p className="eyebrow mt-6">System administration</p><h1 className="page-title">Meeting attendance location</h1>
      <p className="page-intro">Verify the exact masjid marker before enabling the 100 m GPS check-in. The provided Plus Code is 3JWM+23 Bellahalli, Karnataka.</p>
    </header>
    {params.updated && <p role="status" className="mt-6 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-900">Location saved. GPS check-in is now enabled.</p>}
    {params.error && <p role="alert" className="mt-6 rounded-xl bg-red-50 p-4 text-sm text-red-800">{params.error === "invalid" ? "Enter valid decimal coordinates." : "The location could not be saved."}</p>}
    <form action={updateMeetingLocationAction} className="surface mt-7 grid gap-5 p-6 sm:p-8">
      <p className="text-sm text-zinc-600">{current.center_latitude == null ? "No verified center yet. Check-in remains disabled." : `Current center: ${current.center_latitude}, ${current.center_longitude}`}</p>
      <label className="field-label">Latitude<input name="latitude" type="number" step="any" min="-90" max="90" required className="field-input" defaultValue={current.center_latitude ?? ""} /></label>
      <label className="field-label">Longitude<input name="longitude" type="number" step="any" min="-180" max="180" required className="field-input" defaultValue={current.center_longitude ?? ""} /></label>
      <p className="text-sm text-zinc-600">Open the provided <a className="text-emerald-800 underline" href="https://maps.app.goo.gl/25eCSYcDBWRi4o5F7" target="_blank" rel="noopener noreferrer">Maps marker</a>, verify it on site, and copy its decimal latitude and longitude. Changing the point creates an audit record.</p>
      <button className="button-primary justify-self-start">Save verified location</button>
    </form>
  </div></main>;
}
