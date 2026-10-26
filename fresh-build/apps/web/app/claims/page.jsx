'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { createManagementApi } from '../../../../packages/api-client/index.js';
import { getBrowserClient } from '../../lib/supabase.js';

const submitRoles = new Set([
  'president',
  'vice_president',
  'secretary',
  'treasurer',
  'committee_member',
  'data_entry',
]);

export default function ClaimsPage() {
  const [state, setState] = useState('checking');
  const [role, setRole] = useState(null);
  const [donors, setDonors] = useState([]);
  const [claims, setClaims] = useState([]);
  const [rejectedClaims, setRejectedClaims] = useState([]);
  const [rejectedOffset, setRejectedOffset] = useState(0);
  const [moreRejected, setMoreRejected] = useState(false);
  const [accounts, setAccounts] = useState([]);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [operation, setOperation] = useState(null);
  const rejectionOperations = useRef(new Map());

  async function refresh(client, currentRole) {
    const api = createManagementApi(client);
    const [list, pending, destinations, rejected] = await Promise.all([
      api.listMonthlyDonors(),
      currentRole === 'treasurer' ? api.listPendingMonthlyClaims() : [],
      currentRole === 'treasurer' ? api.listActiveMasjidAccounts() : [],
      submitRoles.has(currentRole) ? api.listRejectedMonthlyClaims() : [],
    ]);
    setDonors(list ?? []);
    setClaims(pending ?? []);
    setAccounts(destinations ?? []);
    setRejectedClaims(rejected ?? []);
    setRejectedOffset(rejected?.length ?? 0);
    setMoreRejected((rejected?.length ?? 0) === 50);
  }

  useEffect(() => {
    let active = true;
    try {
      const client = getBrowserClient();
      client.auth
        .getUser()
        .then(async ({ data, error }) => {
          if (!active) return;
          if (error || !data.user) {
            setState('signed-out');
            return;
          }
          const currentRole = await createManagementApi(client).getMyRole();
          if (!active) return;
          setRole(currentRole);
          setState('signed-in');
          await refresh(client, currentRole);
        })
        .catch((cause) => {
          if (active) {
            setNotice(cause.message);
            setState('error');
          }
        });
    } catch (cause) {
      setNotice(cause.message);
      setState('error');
    }
    return () => {
      active = false;
    };
  }, []);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setNotice('');
    try {
      const form = new FormData(event.currentTarget);
      const periodDate = String(form.get('period'));
      if (!/^\d{4}-\d{2}-01$/.test(periodDate))
        throw new Error('Choose the first day of the month.');
      await createManagementApi(getBrowserClient()).submitMonthlyClaim({
        donorId: String(form.get('donor')),
        periodDate,
        transactionId: String(form.get('transaction')).trim(),
      });
      event.currentTarget.reset();
      await refresh(getBrowserClient(), role);
      setNotice('Reference submitted for Treasurer review. No money has been posted yet.');
    } catch (cause) {
      setNotice(cause.message || 'Could not submit claim.');
    } finally {
      setBusy(false);
    }
  }

  async function verify(event, claimId) {
    event.preventDefault();
    setBusy(true);
    setNotice('');
    const form = new FormData(event.currentTarget);
    const accountId = String(form.get('account'));
    const actualAmountINR = String(form.get('amount'));
    const id =
      operation?.claimId === claimId &&
      operation.accountId === accountId &&
      operation.actualAmountINR === actualAmountINR
        ? operation.id
        : crypto.randomUUID();
    setOperation({ claimId, accountId, actualAmountINR, id });
    try {
      const code = await createManagementApi(getBrowserClient()).verifyMonthlyClaim({
        claimId,
        accountId,
        actualAmountINR,
        operationId: id,
      });
      setOperation(null);
      await refresh(getBrowserClient(), role);
      setNotice(`Verified and posted. Receipt code: ${code}`);
    } catch (cause) {
      setNotice(cause.message || 'Could not verify claim.');
    } finally {
      setBusy(false);
    }
  }

  async function reject(event, claimId) {
    event.preventDefault();
    const form = event.currentTarget;
    const reason = String(new FormData(form).get('reason') ?? '').trim();
    const key = JSON.stringify({ claimId, reason });
    const operationId = rejectionOperations.current.get(key) ?? crypto.randomUUID();
    rejectionOperations.current.set(key, operationId);
    setBusy(true);
    setNotice('');
    try {
      const client = getBrowserClient();
      await createManagementApi(client).rejectMonthlyClaim({ claimId, reason, operationId });
      rejectionOperations.current.delete(key);
      setClaims((current) => current.filter((claim) => claim.claim_id !== claimId));
      form.reset();
      try {
        await refresh(client, role);
        setNotice('Claim rejected with a recorded reason. No money was posted or receipt issued.');
      } catch {
        setNotice('Claim rejected. Reload the review list before taking another action.');
      }
    } catch (cause) {
      setNotice(cause.message || 'Could not reject claim.');
    } finally {
      setBusy(false);
    }
  }

  async function loadMoreRejected() {
    setBusy(true);
    setNotice('');
    try {
      const page = await createManagementApi(getBrowserClient()).listRejectedMonthlyClaims({
        offset: rejectedOffset,
      });
      setRejectedOffset((current) => current + page.length);
      setRejectedClaims((current) => {
        const known = new Set(current.map((claim) => claim.rejected_claim_id));
        return [...current, ...page.filter((claim) => !known.has(claim.rejected_claim_id))];
      });
      setMoreRejected(page.length === 50);
    } catch (cause) {
      setNotice(cause.message || 'Could not load older rejected claims.');
    } finally {
      setBusy(false);
    }
  }

  async function resubmit(event, claimId) {
    event.preventDefault();
    const form = event.currentTarget;
    const transactionId = String(new FormData(form).get('transaction') ?? '').trim();
    setBusy(true);
    setNotice('');
    try {
      const client = getBrowserClient();
      await createManagementApi(client).resubmitRejectedMonthlyClaim({ claimId, transactionId });
      setRejectedClaims((current) =>
        current.filter((claim) => claim.rejected_claim_id !== claimId),
      );
      form.reset();
      try {
        await refresh(client, role);
        setNotice('Linked replacement submitted for Treasurer review. No money was posted.');
      } catch {
        setMoreRejected(false);
        setNotice('Replacement submitted. Reload the claim lists before another action.');
      }
    } catch (cause) {
      setNotice(cause.message || 'Could not resubmit rejected claim.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="management">
      <Link href="/contributors">← Contributors</Link>
      <h1>Payment claims</h1>
      <p className="muted">
        The Treasurer must check the destination account and record the amount actually received.
      </p>
      {state === 'checking' && <p>Checking your account…</p>}
      {state === 'signed-out' && (
        <p>
          Please <Link href="/login">sign in</Link>.
        </p>
      )}
      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
      {state === 'signed-in' && (
        <div className="management-grid">
          {submitRoles.has(role) ? (
            <form className="panel" onSubmit={submit}>
              <h2>Submit a reference</h2>
              <label className="field">
                Contributor
                <select name="donor" required defaultValue="">
                  <option value="" disabled>
                    Choose contributor
                  </option>
                  {donors
                    .filter((d) => d.active)
                    .map((d) => (
                      <option key={d.donor_id} value={d.donor_id}>
                        {d.donor_name}
                      </option>
                    ))}
                </select>
              </label>
              <label className="field">
                Month (first day)
                <input name="period" type="date" required />
              </label>
              <label className="field">
                Transaction reference
                <input name="transaction" required minLength={3} maxLength={200} />
              </label>
              <button className="primary" disabled={busy}>
                Submit for review
              </button>
            </form>
          ) : (
            <section className="panel">
              <h2>Access</h2>
              <p>Your role cannot submit claims.</p>
            </section>
          )}
          <section className="panel">
            <h2>Pending Treasurer review</h2>
            {role !== 'treasurer' ? (
              <p className="muted">Treasurer access required.</p>
            ) : claims.length === 0 ? (
              <p className="muted">No pending claims.</p>
            ) : (
              <ul className="claim-list">
                {claims.map((claim) => (
                  <li key={claim.claim_id}>
                    <strong>{claim.donor_name}</strong> · {claim.period_date}
                    <br />
                    <small>Reference: {claim.transaction_id}</small>
                    <form onSubmit={(event) => verify(event, claim.claim_id)}>
                      <label className="field">
                        Checked account
                        <select name="account" required defaultValue="">
                          <option value="" disabled>
                            Choose account
                          </option>
                          {accounts.map((account) => (
                            <option key={account.account_id} value={account.account_id}>
                              {account.account_name} ({account.account_kind})
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="field">
                        Actual amount (₹)
                        <input
                          name="amount"
                          required
                          inputMode="decimal"
                          pattern="(0|[1-9][0-9]*)(\.[0-9]{1,2})?"
                        />
                      </label>
                      <button className="primary" disabled={busy}>
                        Verify and issue receipt
                      </button>
                    </form>
                    <form onSubmit={(event) => reject(event, claim.claim_id)}>
                      <label className="field">
                        Rejection reason
                        <input name="reason" required minLength={3} maxLength={500} />
                      </label>
                      <label className="checkbox">
                        <input type="checkbox" required />
                        <span>
                          I checked this reference and will not post payment from this claim.
                        </span>
                      </label>
                      <button disabled={busy}>Reject without posting</button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
          </section>
          {submitRoles.has(role) && (
            <section className="panel">
              <h2>Rejected claims needing a new reference</h2>
              <p className="muted">
                You can replace claims you submitted. The Treasurer can replace any rejected claim.
                A replacement goes back to review and does not post money.
              </p>
              {rejectedClaims.length === 0 ? (
                <p className="muted">No rejected claims need replacement.</p>
              ) : (
                <ul className="claim-list">
                  {rejectedClaims.map((claim) => (
                    <li key={claim.rejected_claim_id}>
                      <strong>{claim.donor_name}</strong> · {claim.period_date}
                      <br />
                      <small>Original reference: {claim.original_reference}</small>
                      <p>Reason: {claim.rejection_reason}</p>
                      <form onSubmit={(event) => resubmit(event, claim.rejected_claim_id)}>
                        <label className="field">
                          Corrected transaction reference
                          <input name="transaction" required minLength={3} maxLength={200} />
                        </label>
                        <button disabled={busy}>Submit linked replacement</button>
                      </form>
                    </li>
                  ))}
                </ul>
              )}
              {moreRejected && (
                <button type="button" disabled={busy} onClick={loadMoreRejected}>
                  Load older rejected claims
                </button>
              )}
            </section>
          )}
        </div>
      )}
    </main>
  );
}
