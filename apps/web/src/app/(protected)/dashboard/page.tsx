import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { canManageAccounts, getCurrentAccount, listAccounts } from "@/lib/accounts/server";
import { getDonationManagementCapabilities } from "@/lib/donations/server";
import { getFinanceAccountCapabilities } from "@/lib/finance/server";
import { hasAdminMemberReadAccess } from "@/lib/members/server";
import { canUseReferrals } from "@/lib/referrals/server";
import { getCommitteeTaskCapabilities } from "@/lib/work/server";

const criticalRoles = ["president", "vice_president", "secretary", "finance", "auditor"] as const;

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims) redirect("/login");

  const [
    account,
    canOpenMemberManagement,
    donationCapabilities,
    financeCapabilities,
    canOpenAccountManagement,
    canOpenReferrals,
    workCapabilities,
  ] = await Promise.all([
    getCurrentAccount(),
    hasAdminMemberReadAccess(),
    getDonationManagementCapabilities(),
    getFinanceAccountCapabilities(),
    canManageAccounts(),
    canUseReferrals(),
    getCommitteeTaskCapabilities(),
  ]);
  if (!account) redirect("/login");

  const accounts = canOpenAccountManagement ? await listAccounts() : [];
  const canOpenDonationManagement = donationCapabilities.canVerify || donationCapabilities.canManageObligations || donationCapabilities.canCreateAnonymousDonation || donationCapabilities.canCreateJummahCashDonation;
  const health = getAccountHealth(accounts);
  const modules = [
    { href: "/profile", title: "My Profile", description: "Manage your identity, member details, and password.", visible: true },
    { href: "/donations", title: "Donations", description: "View your obligations and submit payments.", visible: true },
    { href: "/referrals", title: "Referrals", description: "Track member referrals and onboarding progress.", visible: canOpenReferrals },
    { href: "/members", title: "Members", description: "Review member information within your authorized scope.", visible: canOpenMemberManagement },
    { href: "/work", title: "Work", description: workCapabilities.canAssign ? "Create, assign, and manage committee tasks." : "Review and update your assigned committee tasks.", visible: workCapabilities.canRead },
    { href: "/donations/manage", title: "Donation Management", description: "Review payments and manage donation operations.", visible: canOpenDonationManagement },
    { href: "/finance/accounts", title: "Finance Accounts", description: "Review Finance accounts, balances, and authorized account lifecycle actions.", visible: financeCapabilities.canReadAccounts },
    { href: "/accounts", title: "Account Administration", description: "Manage usernames, roles, status, and password setup.", visible: canOpenAccountManagement },
  ].filter((module) => module.visible);

  return (
    <main className="min-h-screen px-5 py-8 sm:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="border-b border-emerald-950/10 pb-8"><p className="eyebrow">Masjid E Mamoor 2</p><h1 className="page-title">Management dashboard</h1><p className="page-intro">A clear view of the work available to your account.</p></header>
        <section className="welcome-panel mt-6"><div><p className="welcome-kicker">Assalamu Alaikum</p><h2 className="welcome-title">Masjid E Mamoor 2</h2><p className="welcome-copy">Management Overview</p></div><span className="welcome-role">{roleLabel(account.role)}</span></section>
        <section className="mt-8"><div><p className="eyebrow">Workspace</p><h2 className="section-title">Available modules</h2></div><div className="module-grid mt-4">{modules.map((module) => <Link key={module.href} href={module.href} className="module-card"><span className="module-card-title">{module.title}</span><span className="module-card-copy">{module.description}</span><span className="module-card-link">Open module →</span></Link>)}</div></section>
        {canOpenAccountManagement ? <AccountHealth accounts={accounts} health={health} /> : null}
      </div>
    </main>
  );
}

function AccountHealth({ accounts, health }: { accounts: Awaited<ReturnType<typeof listAccounts>>; health: ReturnType<typeof getAccountHealth> }) {
  return <section className="mt-10 border-t border-emerald-950/10 pt-8"><div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"><div><p className="eyebrow">Administration</p><h2 className="section-title">Account health</h2><p className="mt-2 text-sm text-zinc-600">A quick read on account coverage and password setup.</p></div><Link href="/accounts" className="button-secondary w-fit">Manage all accounts</Link></div><div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6"><Metric label="Total accounts" value={health.total} /><Metric label="Active" value={health.active} tone="good" /><Metric label="Deactivated" value={health.deactivated} tone={health.deactivated ? "warn" : undefined} /><Metric label="Password pending" value={health.passwordPending} tone={health.passwordPending ? "warn" : undefined} /><Metric label="Missing usernames" value={health.missingUsername} tone={health.missingUsername ? "warn" : undefined} /><Metric label="Missing core roles" value={health.missingCoreRoles} tone={health.missingCoreRoles ? "warn" : undefined} /></div><div className="mt-5 grid gap-5 lg:grid-cols-[0.85fr_1.15fr]"><div className="surface p-6"><h3 className="font-semibold text-emerald-950">Core role coverage</h3><div className="mt-4 grid gap-3">{criticalRoles.map((role) => { const count = accounts.filter((account) => account.role === role).length; return <div key={role} className="flex items-center justify-between border-b border-zinc-100 pb-3 text-sm last:border-0 last:pb-0"><span>{roleLabel(role)}</span><span className={count ? "status-badge status-active" : "status-badge status-warning"}>{count ? `${count} assigned` : "Missing"}</span></div>; })}</div></div><div className="surface overflow-hidden"><div className="flex items-center justify-between border-b border-zinc-100 px-6 py-5"><h3 className="font-semibold text-emerald-950">Account directory</h3><Link href="/accounts" className="text-sm font-medium text-emerald-800">View all</Link></div><div className="divide-y divide-zinc-100">{accounts.slice(0, 6).map((account) => <div key={account.id} className="grid gap-1 px-6 py-4 sm:grid-cols-[1fr_1fr_auto] sm:items-center"><div><p className="font-medium text-zinc-950">{account.username ?? "No username"}</p><p className="text-sm text-zinc-500">{account.displayName ?? "No display name"}</p></div><p className="text-sm text-zinc-600">{roleLabel(account.role)}</p><div className="flex flex-wrap gap-1 sm:justify-end"><span className={`status-badge ${account.status === "active" ? "status-active" : "status-warning"}`}>{statusLabel(account.status)}</span><span className={`status-badge ${account.mustChangePassword ? "status-warning" : "status-active"}`}>{account.mustChangePassword ? "Password pending" : "Password ready"}</span></div></div>)}{accounts.length === 0 ? <p className="px-6 py-6 text-sm text-zinc-500">No accounts are available to display.</p> : null}</div></div></div></section>;
}

function Metric({ label, value, tone }: { label: string; value: number; tone?: "good" | "warn" }) { return <div className="surface p-5"><p className="text-sm text-zinc-500">{label}</p><p className={`mt-2 text-3xl font-semibold ${tone === "warn" ? "text-amber-700" : tone === "good" ? "text-emerald-800" : "text-emerald-950"}`}>{value}</p></div>; }
function getAccountHealth(accounts: Awaited<ReturnType<typeof listAccounts>>) { return { total: accounts.length, active: accounts.filter((account) => account.status === "active").length, deactivated: accounts.filter((account) => account.status === "deactivated").length, passwordPending: accounts.filter((account) => account.mustChangePassword).length, missingUsername: accounts.filter((account) => !account.username).length, missingCoreRoles: criticalRoles.filter((role) => !accounts.some((account) => account.role === role)).length }; }
const roleLabel = (role: string) => ({ system_admin: "System Admin", president: "President", vice_president: "Vice President", secretary: "Secretary", finance: "Finance", auditor: "Auditor", committee_member: "Committee Member", member: "Member" }[role] ?? role);
const statusLabel = (status: string) => status.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
