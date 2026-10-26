'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { parseINRToPaise } from '../../../../packages/api-client/index.js';
import { getBrowserClient } from '../../lib/supabase.js';

const donationActors = new Set([
  'president',
  'vice_president',
  'secretary',
  'treasurer',
  'committee_member',
  'data_entry',
]);
const expenseActors = new Set([
  'president',
  'vice_president',
  'secretary',
  'treasurer',
  'committee_member',
  'member',
]);
const financeReaders = new Set([
  'system_admin',
  'president',
  'vice_president',
  'secretary',
  'treasurer',
]);
function formatPaise(value) {
  const paise = BigInt(value),
    absolute = paise < 0n ? -paise : paise;
  return `${paise < 0n ? '-' : ''}₹${(absolute / 100n).toLocaleString('en-IN')}.${(absolute % 100n)
    .toString()
    .padStart(2, '0')}`;
}
function VerifyCashCountForm({ count, accounts, busy, onVerify }) {
  const [amount, setAmount] = useState('');
  const [account, setAccount] = useState('');
  const [counted, setCounted] = useState(false);
  const [error, setError] = useState('');
  async function submit(event) {
    event.preventDefault();
    setError('');
    if (!counted) {
      setError('Physically count the cash before verification.');
      return;
    }
    try {
      const args = {
        p_count_id: count.count_id,
        p_actual_amount_paise: parseINRToPaise(amount),
        p_account_id: account,
      };
      if (await onVerify(args)) {
        setAmount('');
        setAccount('');
        setCounted(false);
      }
    } catch (cause) {
      setError(cause.message);
    }
  }
  return (
    <form className="panel" onSubmit={submit}>
      <h3>{count.title}</h3>
      <p>
        Slip: {count.evidence_reference} · Date: {count.counted_date}
        {' · '}Counter claimed: {formatPaise(count.claimed_amount_paise)}
      </p>
      <label className="field">
        Cash physically received (₹)
        <input
          inputMode="decimal"
          required
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
        />
      </label>
      <label className="field">
        Active Cash account
        <select required value={account} onChange={(event) => setAccount(event.target.value)}>
          <option value="">Select account</option>
          {accounts
            .filter((item) => item.active && item.account_kind === 'cash')
            .map((item) => (
              <option key={item.account_id} value={item.account_id}>
                {item.account_name}
              </option>
            ))}
        </select>
      </label>
      <label className="field">
        <input
          type="checkbox"
          required
          checked={counted}
          onChange={(event) => setCounted(event.target.checked)}
        />
        I counted this cash and checked the numbered slip.
      </label>
      {error && (
        <p role="alert" className="notice error">
          {error}
        </p>
      )}
      <button
        className="primary"
        disabled={busy || !accounts.some((item) => item.active && item.account_kind === 'cash')}
      >
        Verify and post cash
      </button>
    </form>
  );
}
function RejectCashCountForm({ count, busy, onReject }) {
  const [reason, setReason] = useState('');
  async function submit(event) {
    event.preventDefault();
    if (await onReject({ p_count_id: count.count_id, p_reason: reason.trim() })) setReason('');
  }
  return (
    <form className="panel" onSubmit={submit}>
      <h4>Reject this pending count</h4>
      <p className="muted">
        Rejection posts no money. The counter must use a new numbered slip for the correction.
      </p>
      <label className="field">
        Reason for rejection
        <input
          required
          minLength={3}
          maxLength={240}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
      </label>
      <button disabled={busy || reason.trim().length < 3}>Reject count</button>
    </form>
  );
}
export default function FinancePage() {
  const [session, setSession] = useState('checking'),
    [role, setRole] = useState(null);
  const [accounts, setAccounts] = useState([]),
    [cashCounts, setCashCounts] = useState([]),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [donor, setDonor] = useState(''),
    [donationAmount, setDonationAmount] = useState('');
  const [donationDate, setDonationDate] = useState(''),
    [donationEvidence, setDonationEvidence] = useState('');
  const [donationMethod, setDonationMethod] = useState('cash');
  const [directDonor, setDirectDonor] = useState(''),
    [directDate, setDirectDate] = useState('');
  const [directAmount, setDirectAmount] = useState(''),
    [directEvidence, setDirectEvidence] = useState('');
  const [directAccount, setDirectAccount] = useState(''),
    [directCounted, setDirectCounted] = useState(false);
  const [expenseTitle, setExpenseTitle] = useState(''),
    [expenseDescription, setExpenseDescription] = useState('');
  const [category, setCategory] = useState(''),
    [expenseAmount, setExpenseAmount] = useState('');
  const [bill, setBill] = useState(''),
    [missingReason, setMissingReason] = useState('');
  const operationIds = useRef(new Map());
  async function rpc(name, args) {
    const { data, error: rpcError } = await getBrowserClient().rpc(name, args);
    if (rpcError) throw new Error(rpcError.message || 'Action unavailable');
    return data;
  }
  async function load() {
    const nextRole = await rpc('current_app_role', {});
    setRole(nextRole);
    if (financeReaders.has(nextRole)) setAccounts((await rpc('list_finance_accounts', {})) ?? []);
    if (nextRole === 'treasurer')
      setCashCounts((await rpc('list_cash_collection_workflow', {})) ?? []);
  }
  useEffect(() => {
    let active = true;
    getBrowserClient()
      .auth.getUser()
      .then(async ({ data, error: authError }) => {
        if (!active) return;
        if (authError || !data?.user) {
          setSession('signed-out');
          return;
        }
        try {
          await load();
          if (active) setSession('ready');
        } catch (cause) {
          if (active) setError(cause.message);
        }
      })
      .catch(() => {
        if (active) setSession('signed-out');
      });
    return () => {
      active = false;
    };
  }, []);
  async function submit(name, args, key) {
    setBusy(true);
    setError('');
    setNotice('');
    const id = operationIds.current.get(key) ?? crypto.randomUUID();
    operationIds.current.set(key, id);
    try {
      await rpc(name, { ...args, p_operation_id: id });
      operationIds.current.delete(key);
      setNotice(
        'Submitted for authorized review. No money or receipt is posted by this submission.',
      );
      try {
        await load();
      } catch {
        setError('Submission succeeded, but balances could not refresh. Reload the page.');
      }
      return true;
    } catch (cause) {
      setError(cause.message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function postDirectCash(event) {
    event.preventDefault();
    if (!directCounted) {
      setError('Confirm that the cash was physically counted before posting.');
      return;
    }
    let amountPaise;
    try {
      amountPaise = parseINRToPaise(directAmount);
    } catch (cause) {
      setError(cause.message);
      return;
    }
    const args = {
      p_name: directDonor.trim(),
      p_kind: 'other',
      p_referrer_id: null,
      p_date: directDate,
      p_amount_paise: amountPaise,
      p_evidence: directEvidence.trim(),
      p_account_id: directAccount,
    };
    const key = `direct-cash:${JSON.stringify(args)}`;
    const id = operationIds.current.get(key) ?? crypto.randomUUID();
    operationIds.current.set(key, id);
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await rpc('post_direct_treasurer_cash', { ...args, p_operation_id: id });
      operationIds.current.delete(key);
      setNotice('Cash posted once to the selected account. The receipt is valid after posting.');
      setDirectDonor('');
      setDirectDate('');
      setDirectAmount('');
      setDirectEvidence('');
      setDirectAccount('');
      setDirectCounted(false);
      try {
        await load();
      } catch {
        setError('Cash posted, but balances could not refresh. Reload the page.');
      }
    } catch (cause) {
      setError(cause.message);
    } finally {
      setBusy(false);
    }
  }
  async function verifyCashCount(args) {
    const key = `verify-cash-count:${JSON.stringify(args)}`;
    const id = operationIds.current.get(key) ?? crypto.randomUUID();
    operationIds.current.set(key, id);
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await rpc('verify_cash_task_count', { ...args, p_operation_id: id });
      operationIds.current.delete(key);
      setNotice('The physically counted amount was posted once and its receipt is valid.');
      try {
        await load();
      } catch {
        setError('Cash posted, but the list could not refresh. Reload the page.');
      }
      return true;
    } catch (cause) {
      setError(cause.message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function rejectCashCount(args) {
    const key = `reject-cash-count:${JSON.stringify(args)}`;
    const id = operationIds.current.get(key) ?? crypto.randomUUID();
    operationIds.current.set(key, id);
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await rpc('reject_cash_task_count', { ...args, p_operation_id: id });
      operationIds.current.delete(key);
      setNotice('Count rejected with a reason. No money was posted.');
      try {
        await load();
      } catch {
        setError('Rejection succeeded, but the list could not refresh. Reload the page.');
      }
      return true;
    } catch (cause) {
      setError(cause.message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function saveDonation(event) {
    event.preventDefault();
    try {
      const args = {
        p_name: donor.trim(),
        p_kind: 'other',
        p_referrer_id: null,
        p_date: donationDate,
        p_method: donationMethod,
        p_amount_paise: parseINRToPaise(donationAmount),
        p_evidence: donationEvidence.trim(),
      };
      if (await submit('submit_one_time_donation', args, `donation:${JSON.stringify(args)}`)) {
        setDonor('');
        setDonationAmount('');
        setDonationDate('');
        setDonationEvidence('');
      }
    } catch (cause) {
      setError(cause.message);
    }
  }
  async function saveExpense(event) {
    event.preventDefault();
    try {
      const args = {
        p_title: expenseTitle.trim(),
        p_description: expenseDescription.trim(),
        p_category: category.trim(),
        p_amount_paise: parseINRToPaise(expenseAmount),
        p_bill: bill.trim() || null,
        p_missing_reason: missingReason.trim() || null,
      };
      if (await submit('submit_expense_request', args, `expense:${JSON.stringify(args)}`)) {
        setExpenseTitle('');
        setExpenseDescription('');
        setCategory('');
        setExpenseAmount('');
        setBill('');
        setMissingReason('');
      }
    } catch (cause) {
      setError(cause.message);
    }
  }
  return (
    <main className="management">
      <Link href="/">← Masjid E Mamoor 2</Link>
      <h1>Finance submissions</h1>
      <p className="muted">
        A Treasurer must verify received donations. Expense approval and payment are separate
        actions.
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
      {session === 'ready' && (
        <>
          {financeReaders.has(role) && (
            <p>
              <Link href="/finance/accounts">
                Manage accounts, openings, transfers, corrections and observations →
              </Link>
            </p>
          )}
          {['president', 'treasurer'].includes(role) && (
            <p>
              <Link href="/finance/review">Review donations and expenses →</Link>
            </p>
          )}
          {financeReaders.has(role) && (
            <p>
              <Link href="/finance/reports">Private finance reports →</Link>
            </p>
          )}
          {['treasurer', 'committee_member'].includes(role) && (
            <p>
              <Link href="/finance/receipt-handoff">Manual receipt handoff →</Link>
            </p>
          )}
          {financeReaders.has(role) && (
            <section className="panel">
              <h2>Account balances</h2>
              {accounts.length === 0 ? (
                <p>No accounts configured.</p>
              ) : (
                <ul>
                  {accounts.map((account) => (
                    <li key={account.account_id}>
                      {account.account_name} ({account.account_kind}) ·{' '}
                      {formatPaise(account.balance_paise)}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
          {donationActors.has(role) && (
            <form className="panel" onSubmit={saveDonation}>
              <h2>Submit a one-time donation for review</h2>
              <label className="field">
                Donor name
                <input
                  required
                  maxLength={200}
                  value={donor}
                  onChange={(e) => setDonor(e.target.value)}
                />
              </label>
              <label className="field">
                Date in India
                <input
                  type="date"
                  required
                  value={donationDate}
                  onChange={(e) => setDonationDate(e.target.value)}
                />
              </label>
              <label className="field">
                Payment method
                <select value={donationMethod} onChange={(e) => setDonationMethod(e.target.value)}>
                  <option value="cash">Cash</option>
                  <option value="upi">UPI</option>
                  <option value="bank">Bank</option>
                </select>
              </label>
              <label className="field">
                Claimed amount (₹)
                <input
                  inputMode="decimal"
                  required
                  value={donationAmount}
                  onChange={(e) => setDonationAmount(e.target.value)}
                />
              </label>
              <label className="field">
                Evidence reference
                <input
                  required
                  minLength={3}
                  maxLength={240}
                  value={donationEvidence}
                  onChange={(e) => setDonationEvidence(e.target.value)}
                />
              </label>
              <button className="primary" disabled={busy}>
                Submit donation
              </button>
            </form>
          )}
          {role === 'treasurer' && (
            <form className="panel" onSubmit={postDirectCash}>
              <h2>Post counted cash directly</h2>
              <p className="muted">
                For a named cash donation already received and counted. This posts income
                immediately; use the review form above if the amount still needs checking.
              </p>
              <label className="field">
                Donor name
                <input
                  required
                  maxLength={200}
                  value={directDonor}
                  onChange={(e) => setDirectDonor(e.target.value)}
                />
              </label>
              <label className="field">
                Date in India
                <input
                  type="date"
                  required
                  value={directDate}
                  onChange={(e) => setDirectDate(e.target.value)}
                />
              </label>
              <label className="field">
                Counted amount (₹)
                <input
                  inputMode="decimal"
                  required
                  value={directAmount}
                  onChange={(e) => setDirectAmount(e.target.value)}
                />
              </label>
              <label className="field">
                Numbered cash slip or evidence reference
                <input
                  required
                  minLength={3}
                  maxLength={240}
                  value={directEvidence}
                  onChange={(e) => setDirectEvidence(e.target.value)}
                />
              </label>
              <label className="field">
                Cash account
                <select
                  required
                  value={directAccount}
                  onChange={(e) => setDirectAccount(e.target.value)}
                >
                  <option value="">Select an active Cash account</option>
                  {accounts
                    .filter((account) => account.active && account.account_kind === 'cash')
                    .map((account) => (
                      <option key={account.account_id} value={account.account_id}>
                        {account.account_name}
                      </option>
                    ))}
                </select>
              </label>
              <label className="field">
                <input
                  type="checkbox"
                  required
                  checked={directCounted}
                  onChange={(e) => setDirectCounted(e.target.checked)}
                />
                I physically counted this cash and checked the evidence reference.
              </label>
              <button
                className="primary"
                disabled={
                  busy ||
                  !accounts.some((account) => account.active && account.account_kind === 'cash')
                }
              >
                Post counted cash
              </button>
            </form>
          )}
          {role === 'treasurer' && (
            <section className="panel">
              <h2>Pending collection task cash counts</h2>
              {cashCounts.filter((count) => count.count_status === 'pending').length === 0 ? (
                <p>No pending cash counts.</p>
              ) : (
                cashCounts
                  .filter((count) => count.count_status === 'pending')
                  .map((count) => (
                    <div key={count.count_id}>
                      <VerifyCashCountForm
                        count={count}
                        accounts={accounts}
                        busy={busy}
                        onVerify={verifyCashCount}
                      />
                      <RejectCashCountForm count={count} busy={busy} onReject={rejectCashCount} />
                    </div>
                  ))
              )}
              {cashCounts
                .filter((count) => count.count_status === 'rejected')
                .map((count) => (
                  <p key={count.count_id} className="muted">
                    Rejected: {count.title} · {count.evidence_reference} · {count.rejection_reason}
                  </p>
                ))}
            </section>
          )}
          {expenseActors.has(role) && (
            <form className="panel" onSubmit={saveExpense}>
              <h2>Submit an expense request</h2>
              <label className="field">
                Title
                <input
                  required
                  maxLength={160}
                  value={expenseTitle}
                  onChange={(e) => setExpenseTitle(e.target.value)}
                />
              </label>
              <label className="field">
                Description
                <textarea
                  required
                  maxLength={2000}
                  value={expenseDescription}
                  onChange={(e) => setExpenseDescription(e.target.value)}
                />
              </label>
              <label className="field">
                Category
                <input
                  required
                  maxLength={80}
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                />
              </label>
              <label className="field">
                Requested amount (₹)
                <input
                  inputMode="decimal"
                  required
                  value={expenseAmount}
                  onChange={(e) => setExpenseAmount(e.target.value)}
                />
              </label>
              <label className="field">
                Bill reference
                <input maxLength={240} value={bill} onChange={(e) => setBill(e.target.value)} />
              </label>
              <label className="field">
                Reason bill is unavailable
                <input
                  maxLength={500}
                  value={missingReason}
                  onChange={(e) => setMissingReason(e.target.value)}
                />
              </label>
              <button className="primary" disabled={busy}>
                Submit expense
              </button>
            </form>
          )}
        </>
      )}
    </main>
  );
}
