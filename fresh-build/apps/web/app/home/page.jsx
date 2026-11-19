'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ROLE_LABELS } from '../../../../packages/api-client/identity.js';
import { formatPaiseINR } from '../../../../packages/api-client/index.js';
import { userMessage } from '../../../../packages/api-client/messages.js';
import { getBrowserClient } from '../../lib/supabase.js';
import { Messages, indiaToday, rpc, useManagementPage } from '../../lib/management.js';

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

const quietly = (promise) => promise.catch(() => null);
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/** What is waiting for this person now. Each call is skipped quietly if the role cannot see it. */
async function loadWaiting(role) {
  const today = indiaToday();
  const leader = FINANCE_LEADERS.includes(role);
  const [donations, expenses, openings, advances, meetings, tasks, inbox, accounts] =
    await Promise.all([
      role === 'treasurer' ? quietly(rpc('list_pending_one_time_donations')) : null,
      ['president', 'treasurer'].includes(role) ? quietly(rpc('list_actionable_expenses')) : null,
      role === 'president' ? quietly(rpc('list_pending_finance_openings')) : null,
      role !== 'system_admin' ? quietly(rpc('list_advances')) : null,
      quietly(rpc('list_visible_committee_meetings')),
      role !== 'system_admin' ? quietly(rpc('list_visible_work_tasks')) : null,
      quietly(rpc('list_my_member_inbox', { p_limit: 25 })),
      leader || role === 'system_admin' ? quietly(rpc('list_finance_accounts')) : null,
    ]);
  const items = [];
  const add = (count, text, href, urgent = false) =>
    count && items.push({ count, text, href, urgent });
  add(
    donations?.length,
    plural(donations?.length ?? 0, 'donation to verify', 'donations to verify'),
    '/finance/review',
    true,
  );
  if (role === 'president') {
    const n = (expenses ?? []).filter((e) => e.status === 'submitted').length;
    add(n, plural(n, 'expense to approve', 'expenses to approve'), '/finance/review', true);
    add(
      openings?.length,
      plural(openings?.length ?? 0, 'opening balance to verify', 'opening balances to verify'),
      '/finance/accounts',
      true,
    );
  }
  if (role === 'treasurer') {
    const n = (expenses ?? []).filter((e) =>
      ['approved', 'partially_paid'].includes(e.status),
    ).length;
    add(
      n,
      plural(n, 'approved expense to pay', 'approved expenses to pay'),
      '/finance/review',
      true,
    );
  }
  if (['president', 'vice_president'].includes(role)) {
    const n = (advances ?? []).filter((a) => a.status === 'submitted' && !a.is_mine).length;
    add(n, plural(n, 'advance to decide', 'advances to decide'), '/advances', true);
  }
  if (role === 'treasurer') {
    const pay = (advances ?? []).filter((a) => a.status === 'approved').length;
    const settle = (advances ?? []).filter((a) => a.status === 'paid').length;
    add(pay, plural(pay, 'approved advance to pay', 'approved advances to pay'), '/advances', true);
    add(
      settle,
      plural(settle, 'advance waiting for bills', 'advances waiting for bills'),
      '/advances',
    );
  }
  const active = (meetings ?? []).filter((m) => m.status === 'active');
  for (const m of active.filter(
    (m) => m.meeting_date === today && ['invited', 'accepted'].includes(m.my_rsvp),
  ))
    items.push({
      count: 'Today',
      text: `${m.title}: check in at the masjid`,
      href: '/meetings',
      urgent: true,
    });
  const invites = active.filter((m) => m.my_rsvp === 'invited' && m.meeting_date > today).length;
  add(
    invites,
    plural(invites, 'meeting invitation to answer', 'meeting invitations to answer'),
    '/meetings',
  );
  const returned = (tasks ?? []).filter(
    (t) => t.status === 'active' && t.my_status === 'returned',
  ).length;
  add(
    returned,
    plural(returned, 'task returned for changes', 'tasks returned for changes'),
    '/tasks',
    true,
  );
  const toDo = (tasks ?? []).filter(
    (t) => t.status === 'active' && t.my_status === 'confirmed',
  ).length;
  add(toDo, plural(toDo, 'task to complete', 'tasks to complete'), '/tasks');
  const unread = (inbox ?? []).filter((n) => !n.read_at).length;
  add(unread, plural(unread, 'new notification', 'new notifications'), '/inbox');
  const money = (accounts ?? []).filter((a) => a.active !== false && a.account_kind !== 'advance');
  const total = money.reduce((sum, a) => sum + BigInt(a.balance_paise ?? 0), 0n);
  return { items, balance: money.length ? formatPaiseINR(total) : null, accounts: money.length };
}

export default function HomePage() {
  const router = useRouter();
  const [waiting, setWaiting] = useState(null);
  const page = useManagementPage(async (role) => setWaiting(await loadWaiting(role)));
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
      <p className="greeting">Assalamu alaikum</p>
      {page.session === 'checking' && <p>Checking your account…</p>}
      {page.session === 'signed-out' && (
        <p>
          <Link href="/login">Sign in</Link> to continue.
        </p>
      )}
      <Messages error={page.error} notice="" />
      {page.session === 'ready' && page.role && (
        <>
          <h1>{ROLE_LABELS[page.role] ?? page.role}</h1>
          {waiting?.balance && (
            <Link className="summary" href="/finance/accounts">
              <span>
                Money in {waiting.accounts === 1 ? 'the account' : `${waiting.accounts} accounts`}
              </span>
              <strong>{waiting.balance}</strong>
            </Link>
          )}
          <section className="home-section" aria-labelledby="waiting-title">
            <h2 id="waiting-title">Needs you now</h2>
            {!waiting && <p className="muted">Checking what is waiting…</p>}
            {waiting && waiting.items.length === 0 && (
              <p className="all-clear">Nothing is waiting for you. JazakAllah khair.</p>
            )}
            {waiting && waiting.items.length > 0 && (
              <ul className="todo-list">
                {waiting.items.map((item) => (
                  <li key={item.text}>
                    <Link className={item.urgent ? 'todo urgent' : 'todo'} href={item.href}>
                      <span className="count">{item.count}</span>
                      <span className="text">{item.text.replace(/^\d+ /, '')}</span>
                      <span className="chev" aria-hidden="true">
                        ›
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
          {SECTIONS.map((section) => {
            const items = section.items.filter((item) => item.roles.includes(page.role));
            if (!items.length) return null;
            return (
              <section key={section.title} className="home-section">
                <h2>{section.title}</h2>
                <ul className="nav-list">
                  {items.map((item) => (
                    <li key={item.href}>
                      <Link href={item.href}>
                        <span>
                          <strong>{item.label}</strong>
                          <small>{item.note}</small>
                        </span>
                        <span className="chev" aria-hidden="true">
                          ›
                        </span>
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
