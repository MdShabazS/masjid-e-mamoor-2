import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentAccount } from "@/lib/accounts/server";
import { createClient } from "@/lib/supabase/server";
import { updateAndroidReleaseAction } from "./actions";
type Props = { searchParams: Promise<{ error?: string; updated?: string }> };
export default async function AndroidReleasesPage({ searchParams }: Props) {
  const [account, params] = await Promise.all([getCurrentAccount(), searchParams]);
  if (!account || account.status !== "active" || account.role !== "system_admin") redirect("/dashboard");
  const supabase = await createClient();
  const { data, error } = await supabase.from("mobile_release_policies")
    .select("latest_version, minimum_supported_version, store_url, update_message, updated_at")
    .eq("platform", "android").single();
  if (error || !data) throw new Error("android_release_policy_unavailable");
  return <main className="min-h-screen px-5 py-8 sm:px-8"><div className="mx-auto max-w-3xl">
    <header className="border-b border-emerald-950/10 pb-8"><Link href="/dashboard" className="text-sm text-emerald-800">← Dashboard</Link>
      <p className="eyebrow mt-6">System administration</p><h1 className="page-title">Android release</h1>
      <p className="page-intro">Publish the new direct APK link after installation testing. Raising the minimum version blocks older apps until they update.</p>
    </header>
    {params.updated && <p role="status" className="mt-6 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-900">Release policy saved.</p>}
    {params.error && <p role="alert" className="mt-6 rounded-xl bg-red-50 p-4 text-sm text-red-800">{params.error === "invalid" ? "Check version numbers, HTTPS link, and message." : "The policy could not be saved. Versions cannot go backwards."}</p>}
    <form action={updateAndroidReleaseAction} className="surface mt-7 grid gap-5 p-6 sm:p-8">
      <label className="field-label">Latest APK version<input name="latest" className="field-input" required pattern="[0-9]+\.[0-9]+\.[0-9]+" defaultValue={data.latest_version} /></label>
      <label className="field-label">Oldest allowed version<input name="minimum" className="field-input" required pattern="[0-9]+\.[0-9]+\.[0-9]+" defaultValue={data.minimum_supported_version} /></label>
      <label className="field-label">Direct APK download link (HTTPS)<input name="url" className="field-input" type="url" required maxLength={500} defaultValue={data.store_url ?? ""} placeholder="https://.../app.apk" /></label>
      <label className="field-label">Update message<textarea name="message" className="field-input min-h-24" required maxLength={500} defaultValue={data.update_message ?? "A new version is available."} /></label>
      <p className="text-sm text-zinc-600">Current policy updated {new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }).format(new Date(data.updated_at))}. Enter a tested APK link before making an update mandatory.</p>
      <button className="button-primary justify-self-start">Save Android policy</button>
    </form>
  </div></main>;
}
