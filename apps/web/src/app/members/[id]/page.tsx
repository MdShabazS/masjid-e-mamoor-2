import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { saveMember, toggleMemberStatus } from "../actions";
import {
  getMemberProfile,
  hasAdminMemberReadAccess,
  hasPermission,
} from "@/lib/members/server";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; saved?: string }> };

export default async function MemberDetailPage({ params, searchParams }: Props) {
  if (!(await hasAdminMemberReadAccess())) redirect("/dashboard");
  const { id } = await params;
  const member = await getMemberProfile(id);
  if (!member) notFound();
  const updateAllowed = await hasPermission("membership.members.update");
  const query = await searchParams;

  return (
    <main className="min-h-screen px-6 py-10">
      <div className="mx-auto max-w-3xl">
        <Link href="/members" className="text-sm font-medium text-zinc-600 hover:text-zinc-900">← Back to members</Link>
        <h1 className="mt-6 text-3xl font-semibold">{member.displayName}</h1>
        {query.saved ? <p className="mt-2 text-sm text-emerald-700">Changes saved.</p> : null}
        {query.error ? <p className="mt-2 text-sm text-red-700">The requested operation could not be completed.</p> : null}

        <section className="mt-8 rounded-2xl border border-black/10 bg-white p-6">
          <form action={updateAllowed ? saveMember : undefined} className="grid gap-5">
            <input type="hidden" name="memberProfileId" value={member.id} />
            <label className="grid gap-2 text-sm"><span className="font-medium">Display name</span><input name="displayName" defaultValue={member.displayName} disabled={!updateAllowed} className="rounded-lg border border-zinc-300 px-3 py-2 disabled:bg-zinc-100" /></label>
            <label className="grid gap-2 text-sm"><span className="font-medium">Phone</span><input name="phone" defaultValue={member.phone ?? ""} disabled={!updateAllowed} className="rounded-lg border border-zinc-300 px-3 py-2 disabled:bg-zinc-100" /></label>
            {updateAllowed ? <><label className="grid gap-2 text-sm"><span className="font-medium">Reason</span><input name="reason" placeholder="Optional reason" className="rounded-lg border border-zinc-300 px-3 py-2" /></label><button type="submit" className="w-fit rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white">Save changes</button></> : null}
          </form>

          <div className="mt-8 border-t border-black/10 pt-6 flex items-center justify-between gap-4">
            <div><p className="text-sm font-medium">Membership status</p><p className="mt-1 text-sm text-zinc-600">{member.status}</p></div>
            {updateAllowed ? <form action={toggleMemberStatus}><input type="hidden" name="memberProfileId" value={member.id} /><input type="hidden" name="status" value={member.status === "active" ? "inactive" : "active"} /><button type="submit" className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-50">{member.status === "active" ? "Deactivate" : "Activate"}</button></form> : null}
          </div>
        </section>
      </div>
    </main>
  );
}
