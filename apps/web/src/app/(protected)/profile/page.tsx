import Link from "next/link";
import { redirect } from "next/navigation";
import { saveOwnProfile } from "./actions";
import { ChangeOwnPasswordForm } from "./ProfileForms";
import { OwnUsernameForm } from "../accounts/AccountAdminForms";
import { getCurrentAccount } from "@/lib/accounts/server";
import { getOwnMemberProfile } from "@/lib/members/server";

type Props = { searchParams: Promise<{ error?: string; saved?: string }> };

export default async function ProfilePage({ searchParams }: Props) {
  const [account, member, query] = await Promise.all([
    getCurrentAccount(),
    getOwnMemberProfile(),
    searchParams,
  ]);
  if (!account) redirect("/login");

  return (
    <main className="min-h-screen px-5 py-8 sm:px-8">
      <div className="mx-auto max-w-5xl">
        <Link href="/dashboard" className="inline-flex text-sm font-medium text-emerald-800 hover:text-emerald-950">← Dashboard</Link>
        <div className="mt-6">
          <p className="eyebrow">Account</p>
          <h1 className="page-title">My profile</h1>
          <p className="page-intro">Your application identity, membership information, and security settings.</p>
        </div>

        <section className="surface mt-8 grid gap-6 p-6 sm:grid-cols-[1fr_auto] sm:p-8">
          <div>
            <p className="text-sm text-zinc-500">Signed in as</p>
            <h2 className="mt-1 text-2xl font-semibold text-emerald-950">{account.username ?? "Username not set"}</h2>
            <div className="mt-4 flex flex-wrap gap-2 text-sm">
              <span className="status-badge status-active">{roleLabel(account.role)}</span>
              <span className="status-badge">{statusLabel(account.status)}</span>
              <span className={`status-badge ${account.mustChangePassword ? "status-warning" : "status-active"}`}>
                {account.mustChangePassword ? "Password setup pending" : "Password up to date"}
              </span>
            </div>
          </div>
          <dl className="grid gap-3 text-sm sm:min-w-56">
            <div><dt className="text-zinc-500">Account created</dt><dd className="mt-1 font-medium text-zinc-900">{formatDate(account.createdAt)}</dd></div>
            <div><dt className="text-zinc-500">Account status</dt><dd className="mt-1 font-medium text-zinc-900">{statusLabel(account.status)}</dd></div>
          </dl>
        </section>

        {query.saved ? <p className="mt-4 text-sm text-emerald-800">Profile updated.</p> : null}
        {query.error ? <p className="mt-4 text-sm text-red-700">The profile could not be updated.</p> : null}

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <section className="surface p-6 sm:p-8">
            <p className="eyebrow">Membership</p>
            <h2 className="section-title">Member information</h2>
            {member ? (
              <form action={saveOwnProfile} className="mt-6 grid gap-5">
                <label className="field-label">Display name<input name="displayName" defaultValue={member.displayName} className="field-input" required /></label>
                <label className="field-label">Phone<input name="phone" defaultValue={member.phone ?? ""} className="field-input" placeholder="+919876543210" /></label>
                <p className="helper-text">Role, membership status, financial data, and administrative fields are not editable here.</p>
                <button type="submit" className="button-primary w-fit">Save profile</button>
              </form>
            ) : (
              <div className="mt-6 rounded-xl border border-emerald-100 bg-emerald-50/60 p-4 text-sm text-emerald-950">
                Administrative account — no member membership record is attached.
              </div>
            )}
          </section>

          <section className="surface p-6 sm:p-8">
            <p className="eyebrow">Security</p>
            <h2 className="section-title">Change password</h2>
            <p className="mt-2 text-sm text-zinc-600">Use a strong password you do not reuse elsewhere.</p>
            <ChangeOwnPasswordForm />
          </section>
        </div>
        <section className="mt-6">
          <OwnUsernameForm username={account.username} />
        </section>
      </div>
    </main>
  );
}

const roleLabel = (role: string) => ({
  system_admin: "System Admin",
  president: "President",
  vice_president: "Vice President",
  secretary: "Secretary",
  finance: "Finance",
  auditor: "Auditor",
  committee_member: "Committee Member",
  member: "Member",
}[role] ?? role);

const statusLabel = (status: string) => status.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date(value));
}
