import Link from "next/link";
import { redirect } from "next/navigation";
import { searchMembers } from "./actions";
import {
  hasAdminMemberReadAccess,
  listMemberProfiles,
} from "@/lib/members/server";
import { AppShell } from "@/components/AppShell";

type MembersPageProps = { searchParams: Promise<{ search?: string }> };

export default async function MembersPage({ searchParams }: MembersPageProps) {
  if (!(await hasAdminMemberReadAccess())) redirect("/dashboard");
  const params = await searchParams;
  const search = String(params.search ?? "").trim();
  const { members } = await listMemberProfiles(search);

  return (
    <AppShell><main className="min-h-screen px-6 py-10">
      <div className="mx-auto max-w-6xl">
        <div className="flex items-start justify-between gap-6">
          <div><p className="eyebrow">Community</p><h1 className="page-title">Members</h1><p className="page-intro">Review member information within your authorized scope.</p></div>
          <Link href="/dashboard" className="button-secondary">Dashboard</Link>
        </div>
        <form action={searchMembers} className="mt-8 flex flex-col gap-3 sm:flex-row">
          <input name="search" defaultValue={search} placeholder="Search name or phone" className="field-input min-w-0 flex-1" />
          <button type="submit" className="button-primary">Search</button>
        </form>
        <div className="mt-6 overflow-hidden rounded-2xl border border-black/10 bg-white">
          <div className="hidden grid-cols-[1fr_180px_120px] gap-4 border-b border-black/10 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500 sm:grid"><span>Member</span><span>Phone</span><span>Status</span></div>
          {members.length === 0 ? <div className="px-5 py-12 text-center text-sm text-zinc-500">No members found.</div> : members.map((member) => (
            <Link key={member.id} href={`/members/${member.id}`} className="grid gap-2 border-b border-black/5 px-5 py-4 text-sm hover:bg-zinc-50 sm:grid-cols-[1fr_180px_120px] sm:gap-4">
              <div><p className="font-medium">{member.displayName}</p><p className="mt-1 text-xs text-zinc-500">Member profile</p></div>
              <span className="text-zinc-600">{member.phone ?? "No phone recorded"}</span>
              <span className={member.status === "active" ? "status-badge status-active w-fit" : "status-badge w-fit"}>{member.status}</span>
            </Link>
          ))}
        </div>
      </div>
    </main></AppShell>
  );
}
