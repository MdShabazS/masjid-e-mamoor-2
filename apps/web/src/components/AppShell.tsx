import Link from "next/link";
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { canManageAccounts, getCurrentAccount } from "@/lib/accounts/server";
import { getDonationManagementCapabilities } from "@/lib/donations/server";
import { hasAdminMemberReadAccess } from "@/lib/members/server";
import { canUseReferrals } from "@/lib/referrals/server";
import { formatUnreadBadge } from "@/lib/notifications/presentation";
import { getMyUnreadNotificationCount } from "@/lib/notifications/server";
import { getCommitteeTaskCapabilities } from "@/lib/work/server";
import { signOut } from "@/app/login/actions";
import { SidebarNav } from "./SidebarNav";

export async function AppShell({ children }: { children: ReactNode }) {
  const account = await getCurrentAccount();
  if (!account || account.status !== "active") redirect("/login");

  const [members, donations, accounts, referrals, work, unreadCount] = await Promise.all([
    hasAdminMemberReadAccess(),
    getDonationManagementCapabilities(),
    canManageAccounts(),
    canUseReferrals(),
    getCommitteeTaskCapabilities(),
    getMyUnreadNotificationCount(),
  ]);
  const unreadBadge = formatUnreadBadge(unreadCount);

  const donationManagement = donations.canVerify || donations.canManageObligations || donations.canCreateAnonymousDonation || donations.canCreateJummahCashDonation;
  const groups = [
    { label: "Overview", links: [{ href: "/dashboard", label: "Dashboard", visible: true }, { href: "/profile", label: "My Profile", visible: true }] },
    { label: "Community", links: [{ href: "/members", label: "Members", visible: members }, { href: "/referrals", label: "Referrals", visible: referrals }] },
    { label: "Operations", links: [{ href: "/work", label: "Work", visible: work.canRead }] },
    { label: "Finance", links: [{ href: "/donations", label: "Donations", visible: true }, { href: "/donations/manage", label: "Donation Management", visible: donationManagement }] },
    { label: "Administration", links: [{ href: "/accounts", label: "Account Administration", visible: accounts }] },
  ];

  return <div className="app-shell"><aside className="app-sidebar"><div className="brand-zone"><span className="brand-mark" aria-hidden="true"><span /></span><div className="brand-copy"><p className="brand-name">Masjid E Mamoor 2</p><p className="brand-subtitle">Management System</p></div><Link href="/notifications" className="notification-bell" aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></svg>{unreadBadge ? <span className="notification-badge" aria-hidden="true">{unreadBadge}</span> : null}</Link></div><SidebarNav groups={groups} /><div className="sidebar-account"><p className="sidebar-username">{account?.username ?? "Username not set"}</p><p className="sidebar-role">{roleLabel(account?.role ?? "")}</p><Link href="/profile" className="sidebar-action">Profile</Link><form action={signOut}><button type="submit" className="sidebar-action">Sign out</button></form></div></aside><div className="app-content"><div className="mobile-brand"><span className="brand-mark" aria-hidden="true"><span /></span><span className="brand-name">Masjid E Mamoor 2</span></div>{children}</div></div>;
}

function roleLabel(role: string) { return ({ system_admin: "System Admin", president: "President", vice_president: "Vice President", secretary: "Secretary", finance: "Finance", auditor: "Auditor", committee_member: "Committee Member", member: "Member" }[role] ?? role); }
