'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { formatPaiseINR, parseINRToPaise } from '../../../../packages/api-client/index.js';
import { userMessage } from '../../../../packages/api-client/messages.js';
import { Messages, indiaToday, rpc, useCommand, useManagementPage } from '../../lib/management.js';

const roleLabels = { hafiz: 'Hafiz', muezzin: 'Muezzin', other: 'Other staff' };

export default function SalaryPage() {
  const [month, setMonth] = useState(indiaToday().slice(0, 7));
  const [rows, setRows] = useState([]);
  const [hidden, setHidden] = useState(false);
  const [accounts, setAccounts] = useState([]);
  const [forms, setForms] = useState({});
  const [staff, setStaff] = useState({ name: '', role: 'hafiz', amount: '' });
  const page = useManagementPage(async (role) => {
    try {
      setRows((await rpc('list_salary_records', { p_month: `${month}-01` })) ?? []);
      setHidden(false);
    } catch (cause) {
      if (cause?.code !== '42501') throw cause;
      setHidden(true);
    }
    if (role === 'treasurer')
      setAccounts(
        ((await rpc('list_finance_accounts')) ?? []).filter(
          (account) => account.active && account.account_kind !== 'advance',
        ),
      );
  });
  const { busy, notice, run } = useCommand(page.reload, page.setError);
  const { session, reload, setError } = page;
  // Sign-in already loaded the first month; reload only when the month changes later.
  const shownMonth = useRef(month);
  useEffect(() => {
    if (session !== 'ready' || shownMonth.current === month) return;
    shownMonth.current = month;
    reload().catch((cause) => setError(userMessage(cause)));
  }, [month, session, reload, setError]);
  const manager = ['president', 'treasurer'].includes(page.role);
  const form = (id) => forms[id] ?? {};
  const update = (id, patch) => setForms({ ...forms, [id]: { ...forms[id], ...patch } });
  const clear = (id) => (saved) => saved && setForms((current) => ({ ...current, [id]: {} }));

  function attempt(work) {
    try {
      work();
    } catch (cause) {
      page.setError(userMessage(cause));
    }
  }

  return (
    <main className="management">
      <Link href="/finance">← Finance</Link>
      <h1>Staff salaries</h1>
      {page.session === 'checking' && <p>Checking your account…</p>}
      {page.session === 'signed-out' && (
        <p>
          <Link href="/login">Sign in</Link> to continue.
        </p>
      )}
      <Messages error={page.error} notice={notice} />
      {page.session === 'ready' && hidden && (
        <p className="muted">
          Salary details appear here after the Board approves showing them to members.
        </p>
      )}
      {page.session === 'ready' && !hidden && (
        <>
          <label className="field">
            Month
            <input
              type="month"
              value={month}
              onChange={(e) => e.target.value && setMonth(e.target.value)}
            />
          </label>
          <section className="panel">
            {rows.length === 0 && <p>No staff on the salary list.</p>}
            {rows.map((row) => {
              const entry = form(row.staff_id);
              return (
                <article key={row.staff_id} className="panel">
                  <h3>
                    {row.staff_name} · {roleLabels[row.staff_role]}
                    {row.active ? '' : ' · inactive'}
                  </h3>
                  <p className="muted">
                    Monthly {formatPaiseINR(row.monthly_amount_paise)} ·{' '}
                    {row.paid_amount_paise
                      ? `Paid ${formatPaiseINR(row.paid_amount_paise)} on ${row.payment_date} by ${row.payment_method}`
                      : 'Not paid for this month'}
                  </p>
                  {page.role === 'treasurer' && row.active && !row.paid_amount_paise && (
                    <>
                      <label className="field">
                        Pay from account
                        <select
                          value={entry.account ?? ''}
                          onChange={(e) => update(row.staff_id, { account: e.target.value })}
                        >
                          <option value="">Choose</option>
                          {accounts.map((account) => (
                            <option key={account.account_id} value={account.account_id}>
                              {account.account_name} ({account.account_kind}) ·{' '}
                              {formatPaiseINR(account.balance_paise)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="field">
                        Amount paid (₹)
                        <input
                          inputMode="decimal"
                          value={entry.amount ?? ''}
                          onChange={(e) => update(row.staff_id, { amount: e.target.value })}
                        />
                      </label>
                      <label className="field">
                        Payment date
                        <input
                          type="date"
                          max={indiaToday()}
                          value={entry.date ?? ''}
                          onChange={(e) => update(row.staff_id, { date: e.target.value })}
                        />
                      </label>
                      <label className="field">
                        Proof reference
                        <input
                          maxLength={240}
                          value={entry.proof ?? ''}
                          onChange={(e) => update(row.staff_id, { proof: e.target.value })}
                        />
                      </label>
                      <button
                        className="primary"
                        disabled={busy}
                        onClick={() =>
                          attempt(() => {
                            if (
                              !entry.account ||
                              !entry.date ||
                              (entry.proof?.trim().length ?? 0) < 3
                            )
                              throw new Error('Choose the account, date and proof reference.');
                            const amount = parseINRToPaise(entry.amount?.trim() ?? '');
                            if (!window.confirm(`Post ${formatPaiseINR(amount)} as salary?`))
                              return;
                            run(
                              'record_salary_payment',
                              {
                                p_staff_id: row.staff_id,
                                p_month: `${month}-01`,
                                p_account_id: entry.account,
                                p_amount_paise: amount,
                                p_date: entry.date,
                                p_proof: entry.proof.trim(),
                              },
                              'Salary payment posted.',
                            ).then(clear(row.staff_id));
                          })
                        }
                      >
                        Record salary payment
                      </button>
                    </>
                  )}
                  {manager && (
                    <>
                      <label className="field">
                        New monthly amount (₹)
                        <input
                          inputMode="decimal"
                          value={entry.newAmount ?? ''}
                          onChange={(e) => update(row.staff_id, { newAmount: e.target.value })}
                        />
                      </label>
                      <label className="field">
                        Reason for the change
                        <input
                          maxLength={240}
                          value={entry.reason ?? ''}
                          onChange={(e) => update(row.staff_id, { reason: e.target.value })}
                        />
                      </label>
                      <button
                        disabled={busy || (entry.reason?.trim().length ?? 0) < 3}
                        onClick={() =>
                          attempt(() =>
                            run(
                              'update_salary_staff',
                              {
                                p_staff_id: row.staff_id,
                                p_monthly_amount_paise: parseINRToPaise(
                                  entry.newAmount?.trim() ?? '',
                                ),
                                p_active: true,
                                p_reason: entry.reason.trim(),
                              },
                              'Salary amount updated. Earlier payments are unchanged.',
                            ).then(clear(row.staff_id)),
                          )
                        }
                      >
                        {row.active ? 'Save amount' : 'Save amount and reactivate'}
                      </button>{' '}
                      {row.active && (
                        <button
                          disabled={busy || (entry.reason?.trim().length ?? 0) < 3}
                          onClick={() =>
                            run(
                              'update_salary_staff',
                              {
                                p_staff_id: row.staff_id,
                                p_monthly_amount_paise: Number(row.monthly_amount_paise),
                                p_active: false,
                                p_reason: entry.reason.trim(),
                              },
                              'Salary stopped. History is kept.',
                            ).then(clear(row.staff_id))
                          }
                        >
                          Stop salary (staff left)
                        </button>
                      )}
                    </>
                  )}
                </article>
              );
            })}
          </section>
          {manager && (
            <form
              className="panel"
              onSubmit={(event) => {
                event.preventDefault();
                attempt(() =>
                  run(
                    'add_salary_staff',
                    {
                      p_name: staff.name.trim(),
                      p_role: staff.role,
                      p_monthly_amount_paise: parseINRToPaise(staff.amount.trim()),
                    },
                    'Staff member added.',
                  ).then((saved) => saved && setStaff({ name: '', role: 'hafiz', amount: '' })),
                );
              }}
            >
              <h2>Add a staff member</h2>
              <label className="field">
                Name
                <input
                  required
                  maxLength={120}
                  value={staff.name}
                  onChange={(e) => setStaff({ ...staff, name: e.target.value })}
                />
              </label>
              <label className="field">
                Role
                <select
                  value={staff.role}
                  onChange={(e) => setStaff({ ...staff, role: e.target.value })}
                >
                  {Object.entries(roleLabels).map(([id, label]) => (
                    <option key={id} value={id}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                Monthly salary (₹)
                <input
                  required
                  inputMode="decimal"
                  value={staff.amount}
                  onChange={(e) => setStaff({ ...staff, amount: e.target.value })}
                />
              </label>
              <button className="primary" disabled={busy}>
                Add staff member
              </button>
            </form>
          )}
        </>
      )}
    </main>
  );
}
