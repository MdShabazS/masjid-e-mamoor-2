'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { parseINRToPaise } from '../../../../../packages/api-client/index.js';
import { getBrowserClient } from '../../../lib/supabase.js';

function money(value) {
  const n = BigInt(value),
    abs = n < 0n ? -n : n;
  return `${n < 0n ? '-' : ''}₹${(abs / 100n).toLocaleString('en-IN')}.${String(abs % 100n).padStart(2, '0')}`;
}
export default function FinanceReviewPage() {
  const [session, setSession] = useState('checking'),
    [role, setRole] = useState(null);
  const [donations, setDonations] = useState([]),
    [expenses, setExpenses] = useState([]),
    [accounts, setAccounts] = useState([]);
  const [actual, setActual] = useState({}),
    [account, setAccount] = useState({}),
    [reason, setReason] = useState({});
  const [payment, setPayment] = useState({}),
    [paymentDate, setPaymentDate] = useState({});
  const [proof, setProof] = useState({}),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const operations = useRef(new Map());
  async function rpc(name, args = {}) {
    const { data, error: failure } = await getBrowserClient().rpc(name, args);
    if (failure) throw new Error(failure.message || 'Action unavailable');
    return data;
  }
  async function load() {
    const currentRole = await rpc('current_app_role');
    setRole(currentRole);
    if (!['president', 'treasurer'].includes(currentRole)) return;
    const [nextExpenses, nextAccounts, nextDonations] = await Promise.all([
      rpc('list_actionable_expenses'),
      rpc('list_finance_accounts'),
      currentRole === 'treasurer' ? rpc('list_pending_one_time_donations') : Promise.resolve([]),
    ]);
    setExpenses(nextExpenses ?? []);
    setAccounts((nextAccounts ?? []).filter((item) => item.active));
    setDonations(nextDonations ?? []);
  }
  useEffect(() => {
    let active = true;
    getBrowserClient()
      .auth.getUser()
      .then(async ({ data, error: failure }) => {
        if (!active) return;
        if (failure || !data?.user) {
          setSession('signed-out');
          return;
        }
        try {
          await load();
          if (active) setSession('ready');
        } catch (cause) {
          if (active) {
            setError(cause.message);
            setSession('ready');
          }
        }
      })
      .catch(() => {
        if (active) setSession('signed-out');
      });
    return () => {
      active = false;
    };
  }, []);
  async function execute(name, args, message) {
    setBusy(true);
    setError('');
    setNotice('');
    const key = `${name}:${JSON.stringify(args)}`;
    const id = operations.current.get(key) ?? crypto.randomUUID();
    operations.current.set(key, id);
    try {
      await rpc(name, { ...args, p_operation_id: id });
      operations.current.delete(key);
      setNotice(message);
      try {
        await load();
      } catch {
        setError('Saved, but the queue did not refresh. Reload before retrying.');
      }
    } catch (cause) {
      setError(cause.message);
    } finally {
      setBusy(false);
    }
  }
  function verifyDonation(item) {
    try {
      if (!account[item.donation_id])
        throw new Error('Choose the account that received this donation.');
      execute(
        'decide_one_time_donation',
        {
          p_id: item.donation_id,
          p_decision: 'verify',
          p_actual_paise: parseINRToPaise(actual[item.donation_id] ?? ''),
          p_account_id: account[item.donation_id],
          p_reason: null,
        },
        'Actual amount verified and posted. Receipt code was created.',
      );
    } catch (cause) {
      setError(cause.message);
    }
  }
  function postPayment(item) {
    try {
      const chosen = accounts.find((a) => a.account_id === account[item.expense_id]);
      if (!chosen) throw new Error('Choose the account used for this payment.');
      if (!paymentDate[item.expense_id] || (proof[item.expense_id] ?? '').trim().length < 3)
        throw new Error('Enter the payment date and proof reference.');
      execute(
        'post_expense_payment',
        {
          p_id: item.expense_id,
          p_account_id: chosen.account_id,
          p_amount_paise: parseINRToPaise(payment[item.expense_id] ?? ''),
          p_method: chosen.account_kind,
          p_date: paymentDate[item.expense_id],
          p_proof: (proof[item.expense_id] ?? '').trim(),
        },
        'Payment posted against the approved expense.',
      );
    } catch (cause) {
      setError(cause.message);
    }
  }
  return (
    <main className="management">
      <Link href="/finance">← Finance</Link>
      <h1>Donation and expense review</h1>
      <p className="muted">
        Verify only money actually received. An expense approval does not post a payment.
      </p>
      {session === 'checking' && <p>Checking account…</p>}
      {session === 'signed-out' && (
        <p>
          <Link href="/login">Sign in</Link> to continue.
        </p>
      )}
      {error && (
        <p role="alert" className="notice error">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="notice">
          {notice}
        </p>
      )}
      {session === 'ready' && !['president', 'treasurer'].includes(role) && (
        <p>No finance decisions are assigned to your role.</p>
      )}
      {session === 'ready' && role === 'treasurer' && (
        <section className="panel">
          <h2>Pending one-time donations</h2>
          {donations.length === 0 ? (
            <p>No pending donations.</p>
          ) : (
            donations.map((item) => (
              <article className="panel" key={item.donation_id}>
                <h3>{item.donor_name}</h3>
                <p>
                  {item.donation_date} · {item.payment_method} · claimed{' '}
                  {money(item.claimed_amount_paise)}
                </p>
                <p>Evidence: {item.evidence_reference}</p>
                <label className="field">
                  Actual received (₹)
                  <input
                    inputMode="decimal"
                    value={actual[item.donation_id] ?? ''}
                    onChange={(e) => setActual({ ...actual, [item.donation_id]: e.target.value })}
                  />
                </label>
                <label className="field">
                  Receiving account
                  <select
                    value={account[item.donation_id] ?? ''}
                    onChange={(e) => setAccount({ ...account, [item.donation_id]: e.target.value })}
                  >
                    <option value="">Choose</option>
                    {accounts
                      .filter((a) => a.account_kind === item.payment_method)
                      .map((a) => (
                        <option key={a.account_id} value={a.account_id}>
                          {a.account_name}
                        </option>
                      ))}
                  </select>
                </label>
                <button disabled={busy} onClick={() => verifyDonation(item)}>
                  Verify received amount
                </button>
                <label className="field">
                  Rejection reason
                  <input
                    maxLength={240}
                    value={reason[item.donation_id] ?? ''}
                    onChange={(e) => setReason({ ...reason, [item.donation_id]: e.target.value })}
                  />
                </label>
                <button
                  disabled={busy || (reason[item.donation_id] ?? '').trim().length < 3}
                  onClick={() =>
                    execute(
                      'decide_one_time_donation',
                      {
                        p_id: item.donation_id,
                        p_decision: 'reject',
                        p_actual_paise: null,
                        p_account_id: null,
                        p_reason: reason[item.donation_id].trim(),
                      },
                      'Donation claim rejected without posting money.',
                    )
                  }
                >
                  Reject claim
                </button>
              </article>
            ))
          )}
        </section>
      )}
      {session === 'ready' && ['president', 'treasurer'].includes(role) && (
        <section className="panel">
          <h2>Actionable expenses</h2>
          {expenses.length === 0 ? (
            <p>No expenses need action.</p>
          ) : (
            expenses.map((item) => (
              <article className="panel" key={item.expense_id}>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
                <p>
                  {item.category} · requested {money(item.requested_amount_paise)} · paid{' '}
                  {money(item.effective_paid_paise)} · {item.status}
                </p>
                <p>
                  {item.bill_reference
                    ? `Bill: ${item.bill_reference}`
                    : `Missing bill: ${item.missing_bill_reason}`}
                </p>
                {item.status === 'submitted' && (
                  <>
                    <button
                      disabled={busy}
                      onClick={() =>
                        execute(
                          'decide_expense_request',
                          {
                            p_id: item.expense_id,
                            p_decision: 'approve',
                            p_reason: null,
                          },
                          'Expense approved. Treasurer may record a payment.',
                        )
                      }
                    >
                      Approve
                    </button>
                    <label className="field">
                      Rejection reason
                      <input
                        maxLength={500}
                        value={reason[item.expense_id] ?? ''}
                        onChange={(e) =>
                          setReason({ ...reason, [item.expense_id]: e.target.value })
                        }
                      />
                    </label>
                    <button
                      disabled={busy || (reason[item.expense_id] ?? '').trim().length < 3}
                      onClick={() =>
                        execute(
                          'decide_expense_request',
                          {
                            p_id: item.expense_id,
                            p_decision: 'reject',
                            p_reason: reason[item.expense_id].trim(),
                          },
                          'Expense rejected without payment.',
                        )
                      }
                    >
                      Reject
                    </button>
                  </>
                )}
                {role === 'treasurer' && ['approved', 'partially_paid'].includes(item.status) && (
                  <>
                    <label className="field">
                      Pay from account
                      <select
                        value={account[item.expense_id] ?? ''}
                        onChange={(e) =>
                          setAccount({ ...account, [item.expense_id]: e.target.value })
                        }
                      >
                        <option value="">Choose</option>
                        {accounts.map((a) => (
                          <option key={a.account_id} value={a.account_id}>
                            {a.account_name} ({a.account_kind})
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="field">
                      Payment (₹)
                      <input
                        inputMode="decimal"
                        value={payment[item.expense_id] ?? ''}
                        onChange={(e) =>
                          setPayment({ ...payment, [item.expense_id]: e.target.value })
                        }
                      />
                    </label>
                    <label className="field">
                      Payment date in India
                      <input
                        type="date"
                        value={paymentDate[item.expense_id] ?? ''}
                        onChange={(e) =>
                          setPaymentDate({ ...paymentDate, [item.expense_id]: e.target.value })
                        }
                      />
                    </label>
                    <label className="field">
                      Proof reference
                      <input
                        maxLength={240}
                        value={proof[item.expense_id] ?? ''}
                        onChange={(e) => setProof({ ...proof, [item.expense_id]: e.target.value })}
                      />
                    </label>
                    <button disabled={busy} onClick={() => postPayment(item)}>
                      Record actual payment
                    </button>
                  </>
                )}
              </article>
            ))
          )}
        </section>
      )}
    </main>
  );
}
