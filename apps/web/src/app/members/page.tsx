import Link from "next/link";
import { redirect } from "next/navigation";
import { searchMembers } from "./actions";
import {
  hasAdminMemberReadAccess,
  listMemberProfiles,
} from "@/lib/members/server";

type MembersPageProps = { searchParams: Promise<{ search?: string }> };

export default async function MembersPage({ searchParams }: MembersPageProps) {
  if (!(await hasAdminMemberReadAccess())) redirect("/dashboard");
  const params = await searchParams;
  const search = String(params.search ?? "").trim();
  const { members } = await listMemberProfiles(search);

  return (
    <main className="min-h-screen px-6 py-10">
      <div className="mx-auto max-w-6xl">
        <div className="flex items-start justify-between gap-6">
          <div><p className="text-sm font-medium text-zinc-500">Membership</p><h1 className="mt-1 text-3xl font-semibold">Members</h1></div>
          <Link href="/dashboard" className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-50">Dashboard</Link>
        </div>
        <form action={searchMembers} className="mt-8 flex gap-3">
          <input name="search" defaultValue={search} placeholder="Search name or phone" className="min-w-0 flex-1 rounded-lg border border-zinc-300 px-4 py-2 text-sm" />
          <button type="submit" className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white">Search</button>
        </form>
        <div className="mt-6 overflow-hidden rounded-2xl border border-black/10 bg-white">
          <div className="grid grid-cols-[1fr_180px_120px] gap-4 border-b border-black/10 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500"><span>Member</span><span>Phone</span><span>Status</span></div>
          {members.length === 0 ? <div className="px-5 py-12 text-center text-sm text-zinc-500">No members found.</div> : members.map((member) => (
            <Link key={member.id} href={`/members/${member.id}`} className="grid grid-cols-[1fr_180px_120px] gap-4 border-b border-black/5 px-5 py-4 text-sm hover:bg-zinc-50">
              <div><p className="font-medium">{member.displayName}</p><p className="mt-1 text-xs text-zinc-500">{member.id}</p></div>
              <span className="text-zinc-600">{member.phone ?? "—"}</span>
              <span className={member.status === "active" ? "font-medium text-emerald-700" : "font-medium text-zinc-500"}>{member.status}</span>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
