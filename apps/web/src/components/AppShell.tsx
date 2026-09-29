import Link from "next/link";
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { canManageAccounts, getCurrentAccount } from "@/lib/accounts/server";
import { getDonationManagementCapabilities } from "@/lib/donations/server";
import { hasAdminMemberReadAccess } from "@/lib/members/server";
import { canUseReferrals } from "@/lib/referrals/server";
import { signOut } from "@/app/login/actions";
import { SidebarNav } from "./SidebarNav";

export async function AppShell({ children }: { children: ReactNode }) {
  const account = await getCurrentAccount();
  if (!account || account.status !== "active") redirect("/login");

  const [members, donations, accounts, referrals] = await Promise.all([
    hasAdminMemberReadAccess(),
    getDonationManagementCapabilities(),
    canManageAccounts(),
    canUseReferrals(),
  ]);

  const donationManagement = donations.canVerify || donations.canManageObligations || donations.canCreateAnonymousDonation || donations.canCreateJummahCashDonation;
  const groups = [
    { label: "Overview", links: [{ href: "/dashboard", label: "Dashboard", visible: true }, { href: "/profile", label: "My Profile", visible: true }] },
    { label: "Community", links: [{ href: "/members", label: "Members", visible: members }, { href: "/referrals", label: "Referrals", visible: referrals }] },
    { label: "Finance", links: [{ href: "/donations", label: "Donations", visible: true }, { href: "/donations/manage", label: "Donation Management", visible: donationManagement }] },
    { label: "Administration", links: [{ href: "/accounts", label: "Account Administration", visible: accounts }] },
  ];

  return <div className="app-shell"><aside className="app-sidebar"><div className="brand-zone"><span className="brand-mark" aria-hidden="true"><span /></span><div><p className="brand-name">Masjid E Mamoor 2</p><p className="brand-subtitle">Management System</p></div></div><SidebarNav groups={groups} /><div className="sidebar-account"><p className="sidebar-username">{account?.username ?? "Username not set"}</p><p className="sidebar-role">{roleLabel(account?.role ?? "")}</p><Link href="/profile" className="sidebar-action">Profile</Link><form action={signOut}><button type="submit" className="sidebar-action">Sign out</button></form></div></aside><div className="app-content"><div className="mobile-brand"><span className="brand-mark" aria-hidden="true"><span /></span><span className="brand-name">Masjid E Mamoor 2</span></div>{children}</div></div>;
}

function roleLabel(role: string) { return ({ system_admin: "System Admin", president: "President", vice_president: "Vice President", secretary: "Secretary", finance: "Finance", auditor: "Auditor", committee_member: "Committee Member", member: "Member" }[role] ?? role); }
