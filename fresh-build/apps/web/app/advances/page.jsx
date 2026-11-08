'use client';
import Link from 'next/link';
import { useState } from 'react';
import { formatPaiseINR, parseINRToPaise } from '../../../../packages/api-client/index.js';
import { userMessage } from '../../../../packages/api-client/messages.js';
import { Messages, indiaToday, rpc, useCommand, useManagementPage } from '../../lib/management.js';

const REQUESTERS = new Set([
  'president',
  'vice_president',
  'secretary',
  'treasurer',
  'committee_member',
  'member',
]);
const statusLabels = {
  submitted: 'Waiting for approval',
  approved: 'Approved, not paid',
  rejected: 'Rejected',
  paid: 'Paid, awaiting bills or return',
  settled: 'Settled',
};

function AccountSelect({ label, accounts, value, onChange }) {
  return (
    <label className="field">
      {label}
      <select value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
        <option value="">Choose</option>
        {accounts.map((account) => (
          <option key={account.account_id} value={account.account_id}>
            {account.account_name} ({account.account_kind}) ·{' '}
            {formatPaiseINR(account.balance_paise)}
          </option>
        ))}
      </select>
    </label>
  );
}

export default function AdvancesPage() {
  const [rows, setRows] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [forms, setForms] = useState({});
  const [request, setRequest] = useState({ recipient: '', purpose: '', amount: '' });
  const page = useManagementPage(async (role) => {
    if (role === 'data_entry') return;
    setRows((await rpc('list_advances')) ?? []);
    if (role === 'treasurer')
      setAccounts(
        ((await rpc('list_finance_accounts')) ?? []).filter(
          (account) => account.active && account.account_kind !== 'advance',
        ),
      );
  });
  const { busy, notice, run } = useCommand(page.reload, page.setError);
  const form = (id) => forms[id] ?? {};
  const update = (id, patch) => setForms({ ...forms, [id]: { ...forms[id], ...patch } });
  const clear = (id) => (saved) => saved && setForms((current) => ({ ...current, [id]: {} }));
  const deciders = ['president', 'vice_president'].includes(page.role);

  function attempt(work) {
    try {
      work();
    } catch (cause) {
      page.setError(userMessage(cause));
    }
  }

  function settle(row, kind) {
    const entry = form(row.advance_id);
    attempt(() => {
      if ((entry.reference?.trim().length ?? 0) < 3)
        throw new Error('Enter the bill or receipt reference.');
      if (kind === 'return' && !entry.returnAccount)
        throw new Error('Choose the account the money went into.');
      run(
        'settle_advance',
        {
          p_id: row.advance_id,
          p_kind: kind,
          p_amount_paise: parseINRToPaise(entry.amount?.trim() ?? ''),
          p_account_id: kind === 'return' ? entry.returnAccount : null,
          p_reference: entry.reference.trim(),
        },
        kind === 'bill' ? 'Bills recorded as spending.' : 'Returned money recorded.',
      ).then(clear(row.advance_id));
    });
  }

  return (
    <main className="management">
      <Link href="/finance">← Finance</Link>
      <h1>Advances</h1>
      <p className="muted">
        An advance is not spending until bills are recorded. Unused money must be returned.
      </p>
      {page.session === 'checking' && <p>Checking your account…</p>}
      {page.session === 'signed-out' && (
        <p>
          <Link href="/login">Sign in</Link> to continue.
        </p>
      )}
      <Messages error={page.error} notice={notice} />
      {page.session === 'ready' && page.role === 'data_entry' && (
        <p>Advances are not assigned to this account.</p>
      )}
      {page.session === 'ready' && REQUESTERS.has(page.role) && (
        <form
          className="panel"
          onSubmit={(event) => {
            event.preventDefault();
            attempt(() =>
              run(
                'submit_advance_request',
                {
                  p_recipient: request.recipient.trim(),
                  p_purpose: request.purpose.trim(),
                  p_amount_paise: parseINRToPaise(request.amount.trim()),
                },
                'Advance request sent for approval.',
              ).then((saved) => saved && setRequest({ recipient: '', purpose: '', amount: '' })),
            );
          }}
        >
          <h2>Request an advance</h2>
          <label className="field">
            Who receives the money
            <input
              required
              maxLength={120}
              value={request.recipient}
              onChange={(e) => setRequest({ ...request, recipient: e.target.value })}
            />
          </label>
          <label className="field">
            What it is for
            <textarea
              required
              maxLength={500}
              value={request.purpose}
              onChange={(e) => setRequest({ ...request, purpose: e.target.value })}
            />
          </label>
          <label className="field">
            Amount (₹)
            <input
              required
              inputMode="decimal"
              value={request.amount}
              onChange={(e) => setRequest({ ...request, amount: e.target.value })}
            />
          </label>
          <button className="primary" disabled={busy}>
            Send for approval
          </button>
        </form>
      )}
      {page.session === 'ready' && page.role !== 'data_entry' && (
        <section className="panel">
          <h2>{deciders || page.role === 'treasurer' ? 'All advances' : 'Your advances'}</h2>
          {rows.length === 0 && <p>No advances yet.</p>}
          {rows.map((row) => {
            const entry = form(row.advance_id);
            return (
              <article key={row.advance_id} className="panel">
                <h3>
                  {row.recipient_name} · {formatPaiseINR(row.amount_paise)}
                </h3>
                <p>{row.purpose}</p>
                <p className="muted">
                  {statusLabels[row.status]} · requested by {row.requested_by_username}
                  {['paid', 'settled'].includes(row.status) &&
                    ` · bills ${formatPaiseINR(row.bills_paise)} · returned ${formatPaiseINR(row.returned_paise)} · outstanding ${formatPaiseINR(row.outstanding_paise)}`}
                </p>
                {row.rejection_reason && (
                  <p className="notice error">Reason: {row.rejection_reason}</p>
                )}
                {deciders && row.status === 'submitted' && !row.is_mine && (
                  <>
                    <button
                      className="primary"
                      disabled={busy}
                      onClick={() =>
                        run(
                          'decide_advance_request',
                          { p_id: row.advance_id, p_decision: 'approve', p_reason: null },
                          'Advance approved. The Treasurer can pay it.',
                        )
                      }
                    >
                      Approve
                    </button>
                    <label className="field">
                      Rejection reason
                      <input
                        maxLength={500}
                        value={entry.reason ?? ''}
                        onChange={(e) => update(row.advance_id, { reason: e.target.value })}
                      />
                    </label>
                    <button
                      disabled={busy || (entry.reason?.trim().length ?? 0) < 3}
                      onClick={() =>
                        run(
                          'decide_advance_request',
                          {
                            p_id: row.advance_id,
                            p_decision: 'reject',
                            p_reason: entry.reason.trim(),
                          },
                          'Advance rejected.',
                        ).then(clear(row.advance_id))
                      }
                    >
                      Reject
                    </button>
                  </>
                )}
                {page.role === 'treasurer' && row.status === 'approved' && (
                  <>
                    <AccountSelect
                      label="Pay from account"
                      accounts={accounts}
                      value={entry.account}
                      onChange={(account) => update(row.advance_id, { account })}
                    />
                    <label className="field">
                      Payment date
                      <input
                        type="date"
                        max={indiaToday()}
                        value={entry.date ?? ''}
                        onChange={(e) => update(row.advance_id, { date: e.target.value })}
                      />
                    </label>
                    <label className="field">
                      Proof reference
                      <input
                        maxLength={240}
                        value={entry.proof ?? ''}
                        onChange={(e) => update(row.advance_id, { proof: e.target.value })}
                      />
                    </label>
                    <button
                      className="primary"
                      disabled={
                        busy ||
                        !entry.account ||
                        !entry.date ||
                        (entry.proof?.trim().length ?? 0) < 3
                      }
                      onClick={() => {
                        if (!window.confirm(`Pay ${formatPaiseINR(row.amount_paise)} now?`)) return;
                        run(
                          'pay_advance',
                          {
                            p_id: row.advance_id,
                            p_account_id: entry.account,
                            p_date: entry.date,
                            p_proof: entry.proof.trim(),
                          },
                          'Advance paid. It stays outstanding until settled.',
                        ).then(clear(row.advance_id));
                      }}
                    >
                      Pay advance
                    </button>
                  </>
                )}
                {page.role === 'treasurer' && row.status === 'paid' && (
                  <>
                    <label className="field">
                      Amount (₹)
                      <input
                        inputMode="decimal"
                        value={entry.amount ?? ''}
                        onChange={(e) => update(row.advance_id, { amount: e.target.value })}
                      />
                    </label>
                    <label className="field">
                      Bill or receipt reference
                      <input
                        maxLength={240}
                        value={entry.reference ?? ''}
                        onChange={(e) => update(row.advance_id, { reference: e.target.value })}
                      />
                    </label>
                    <button disabled={busy} onClick={() => settle(row, 'bill')}>
                      Record bills
                    </button>
                    <AccountSelect
                      label="Return into account"
                      accounts={accounts}
                      value={entry.returnAccount}
                      onChange={(returnAccount) => update(row.advance_id, { returnAccount })}
                    />
                    <button disabled={busy} onClick={() => settle(row, 'return')}>
                      Record money returned
                    </button>
                  </>
                )}
              </article>
            );
          })}
        </section>
      )}
    </main>
  );
}
