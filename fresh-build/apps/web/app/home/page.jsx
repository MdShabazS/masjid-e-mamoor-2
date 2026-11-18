'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ROLE_LABELS } from '../../../../packages/api-client/identity.js';
import { userMessage } from '../../../../packages/api-client/messages.js';
import { getBrowserClient } from '../../lib/supabase.js';
import { Messages, useManagementPage } from '../../lib/management.js';

const FINANCE_LEADERS = ['president', 'vice_president', 'secretary', 'treasurer'];
const EVERYONE = [
  'system_admin',
  'president',
  'vice_president',
  'secretary',
  'treasurer',
  'committee_member',
  'member',
  'data_entry',
];

// Each role sees only the screens it can act on; every page still checks the role itself.
const SECTIONS = [
  {
    title: 'Money',
    items: [
      { href: '/finance', label: 'Finance', note: 'Donations, expenses, cash', roles: EVERYONE },
      {
        href: '/finance/review',
        label: 'Review',
        note: 'Verify donations, approve and pay expenses',
        roles: ['president', 'treasurer'],
      },
      {
        href: '/finance/accounts',
        label: 'Accounts',
        note: 'Balances, openings, transfers',
        roles: ['system_admin', ...FINANCE_LEADERS],
      },
      { href: '/advances', label: 'Advances', note: 'Request, approve, settle', roles: EVERYONE },
      { href: '/salary', label: 'Salaries', note: 'Staff and monthly pay', roles: EVERYONE },
      {
        href: '/finance/reports',
        label: 'Reports',
        note: 'Monthly and yearly totals',
        roles: FINANCE_LEADERS,
      },
    ],
  },
  {
    title: 'Donors',
    items: [
      {
        href: '/contributors',
        label: 'Monthly contributors',
        note: 'Enroll and see the roster',
        roles: EVERYONE,
      },
      { href: '/claims', label: 'Payment references', note: 'Monthly payments', roles: EVERYONE },
    ],
  },
  {
    title: 'Work',
    items: [
      { href: '/tasks', label: 'Tasks', note: 'Join, complete, review', roles: EVERYONE },
      { href: '/meetings', label: 'Meetings', note: 'Invitations and check-in', roles: EVERYONE },
      {
        href: '/prayers',
        label: 'Prayer register',
        note: 'Mark the Hafiz’s prayers',
        roles: FINANCE_LEADERS,
      },
      { href: '/activity', label: 'Activity points', note: 'Your contribution', roles: EVERYONE },
    ],
  },
  {
    title: 'Messages and people',
    items: [
      { href: '/inbox', label: 'Notifications', note: 'Member announcements', roles: EVERYONE },
      {
        href: '/content',
        label: 'Write announcements',
        note: 'Public and member posts',
        roles: ['president', 'vice_president', 'secretary', 'data_entry'],
      },
      {
        href: '/accounts',
        label: 'People and roles',
        note: 'Add people, reset passwords',
        roles: ['system_admin', 'president'],
      },
      { href: '/profile', label: 'My profile', note: 'Your account', roles: EVERYONE },
    ],
  },
];

export default function HomePage() {
  const router = useRouter();
  const page = useManagementPage(null);
  const [busy, setBusy] = useState(false);

  async function signOut() {
    setBusy(true);
    try {
      await getBrowserClient().auth.signOut();
      router.replace('/login');
    } catch (cause) {
      page.setError(userMessage(cause, 'Could not sign out.'));
      setBusy(false);
    }
  }

  return (
    <main className="management home">
      <h1>Assalamu alaikum</h1>
      {page.session === 'checking' && <p>Checking your account…</p>}
      {page.session === 'signed-out' && (
        <p>
          <Link href="/login">Sign in</Link> to continue.
        </p>
      )}
      <Messages error={page.error} notice="" />
      {page.session === 'ready' && page.role && (
        <>
          <p className="muted">Signed in as {ROLE_LABELS[page.role] ?? page.role}.</p>
          {SECTIONS.map((section) => {
            const items = section.items.filter((item) => item.roles.includes(page.role));
            if (!items.length) return null;
            return (
              <section key={section.title} className="home-section">
                <h2>{section.title}</h2>
                <ul className="home-grid">
                  {items.map((item) => (
                    <li key={item.href}>
                      <Link className="home-tile" href={item.href}>
                        <strong>{item.label}</strong>
                        <span>{item.note}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
          <p>
            <button disabled={busy} onClick={signOut}>
              Sign out
            </button>
          </p>
        </>
      )}
    </main>
  );
}
