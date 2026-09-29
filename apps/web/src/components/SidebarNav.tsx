"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavGroup = { label: string; links: { href: string; label: string; visible: boolean }[] };

export function SidebarNav({ groups }: { groups: NavGroup[] }) {
  const pathname = usePathname();

  return <nav className="sidebar-nav" aria-label="Main navigation">{groups.map((group) => { const links = group.links.filter((link) => link.visible); if (!links.length) return null; return <div key={group.label} className="nav-group"><p className="nav-group-label">{group.label}</p>{links.map((link) => { const active = pathname === link.href || (link.href !== "/dashboard" && pathname.startsWith(`${link.href}/`)); return <Link key={link.href} href={link.href} aria-current={active ? "page" : undefined} className={`nav-link ${active ? "nav-link-active" : ""}`}>{link.label}</Link>; })}</div>; })}</nav>;
}
