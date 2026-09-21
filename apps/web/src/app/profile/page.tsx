import Link from "next/link";
import { redirect } from "next/navigation";
import { saveOwnProfile } from "./actions";
import { getOwnMemberProfile } from "@/lib/members/server";

type Props = { searchParams: Promise<{ error?: string; saved?: string }> };

export default async function ProfilePage({ searchParams }: Props) {
  const member = await getOwnMemberProfile();
  if (!member) redirect("/dashboard");
  const query = await searchParams;

  return (
    <main className="min-h-screen px-6 py-10">
      <div className="mx-auto max-w-2xl">
        <Link href="/dashboard" className="text-sm font-medium text-zinc-600 hover:text-zinc-900">← Dashboard</Link>
        <h1 className="mt-6 text-3xl font-semibold">My Profile</h1>
        {query.saved ? <p className="mt-2 text-sm text-emerald-700">Profile updated.</p> : null}
        {query.error ? <p className="mt-2 text-sm text-red-700">The profile could not be updated.</p> : null}
        <form action={saveOwnProfile} className="mt-8 grid gap-5 rounded-2xl border border-black/10 bg-white p-6">
          <label className="grid gap-2 text-sm"><span className="font-medium">Display name</span><input name="displayName" defaultValue={member.displayName} className="rounded-lg border border-zinc-300 px-3 py-2" required /></label>
          <label className="grid gap-2 text-sm"><span className="font-medium">Phone</span><input name="phone" defaultValue={member.phone ?? ""} className="rounded-lg border border-zinc-300 px-3 py-2" placeholder="+919876543210" /></label>
          <p className="text-xs text-zinc-500">Role, membership status, financial data and administrative fields are not editable from self-service.</p>
          <button type="submit" className="w-fit rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white">Save profile</button>
        </form>
      </div>
    </main>
  );
}
