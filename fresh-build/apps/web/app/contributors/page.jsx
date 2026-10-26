'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { createManagementApi, formatPaiseINR } from '../../../../packages/api-client/index.js';
import { getBrowserClient } from '../../lib/supabase.js';
import { enrollConsentedDonor } from '../../../../packages/api-client/donor-enrollment.js';

const allowedToEnroll = new Set([
  'president',
  'vice_president',
  'secretary',
  'treasurer',
  'committee_member',
  'data_entry',
]);
const donorStaffRoles = new Set(['president', 'treasurer']);

function DonorStaffControls({ donor, busy, onCorrection, onOptOut }) {
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [stopSource, setStopSource] = useState('');
  const [stopConfirmed, setStopConfirmed] = useState(false);
  async function correct(event) {
    event.preventDefault();
    if (await onCorrection(donor, amount.trim(), reason.trim())) {
      setAmount('');
      setReason('');
    }
  }
  async function optOut(event) {
    event.preventDefault();
    if (!stopConfirmed) return;
    if (await onOptOut(donor, stopSource.trim())) {
      setStopSource('');
      setStopConfirmed(false);
    }
  }
  return (
    <div>
      <form onSubmit={correct}>
        <label className="field">
          Revised voluntary suggestion (₹)
          <input
            inputMode="decimal"
            required
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
        </label>
        <label className="field">
          Donor request or correction reference
          <input
            required
            minLength={3}
            maxLength={240}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </label>
        <button disabled={busy}>Save revised suggestion</button>
      </form>
      <form onSubmit={optOut}>
        <label className="field">
          Opt-out request reference
          <input
            required
            minLength={3}
            maxLength={240}
            value={stopSource}
            onChange={(event) => setStopSource(event.target.value)}
          />
        </label>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={stopConfirmed}
            onChange={(event) => setStopConfirmed(event.target.checked)}
          />
          <span>I verified this donor asked to stop future requests.</span>
        </label>
        <button disabled={busy || !stopConfirmed}>Record opt-out</button>
      </form>
    </div>
  );
}

export default function ContributorsPage() {
  const [session, setSession] = useState('checking');
  const [role, setRole] = useState(null);
  const [donors, setDonors] = useState([]);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const operationIds = useRef(new Map());

  async function load(client) {
    const api = createManagementApi(client);
    const [list, currentRole] = await Promise.all([api.listMonthlyDonors(), api.getMyRole()]);
    setDonors(list ?? []);
    setRole(currentRole);
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
            setSession('signed-out');
            return;
          }
          const { data: rows, error: gateError } = await client.rpc('current_identity_gate');
          if (!active) return;
          const gate = Array.isArray(rows) ? rows[0] : rows;
          if (gateError || !gate?.account_active) {
            setSession('signed-out');
            return;
          }
          if (gate.must_change_password) {
            setSession('password-change');
            return;
          }
          await load(client);
          if (active) setSession('signed-in');
        })
        .catch((cause) => {
          if (active) {
            setNotice(cause.message || 'Could not load contributors.');
            setSession('error');
          }
        });
    } catch (cause) {
      setNotice(cause.message);
      setSession('unconfigured');
    }
    return () => {
      active = false;
    };
  }, []);

  async function enroll(event) {
    event.preventDefault();
    setBusy(true);
    setNotice('');
    try {
      const client = getBrowserClient();
      const form = new FormData(event.currentTarget);
      if (form.get('consent') !== 'yes')
        throw new Error('Record the contributor’s consent evidence before enrollment.');
      await enrollConsentedDonor({
        client,
        input: {
          name: String(form.get('name')),
          whatsapp: String(form.get('whatsapp')),
          suggestedAmountINR: String(form.get('amount')),
          referrerId: String(form.get('referrer') || '') || null,
          consentMethod: String(form.get('consentMethod')),
          consentRecordedAt: new Date().toISOString(),
          evidenceReference: String(form.get('evidence')),
        },
      });
      event.currentTarget.reset();
      await load(client);
      setNotice('Contributor enrolled with consent recorded.');
    } catch (cause) {
      setNotice(cause.message || 'Could not enroll contributor.');
    } finally {
      setBusy(false);
    }
  }

  async function runStaffAction(key, action, successMessage) {
    setBusy(true);
    setNotice('');
    const operationId = operationIds.current.get(key) ?? crypto.randomUUID();
    operationIds.current.set(key, operationId);
    try {
      const client = getBrowserClient();
      await action(createManagementApi(client), operationId);
      operationIds.current.delete(key);
      try {
        await load(client);
        setNotice(successMessage);
      } catch {
        setNotice(`${successMessage} Reload to refresh the roster.`);
      }
      return true;
    } catch (cause) {
      setNotice(cause.message || 'Could not save contributor change.');
      return false;
    } finally {
      setBusy(false);
    }
  }

  function correctSuggestion(donor, newAmountINR, reason) {
    const args = {
      donorId: donor.donor_id,
      expectedAmountPaise: donor.suggested_amount_paise,
      newAmountINR,
      reason,
    };
    return runStaffAction(
      `suggestion:${JSON.stringify(args)}`,
      (api, operationId) => api.updateMonthlyDonorSuggestion({ ...args, operationId }),
      'Voluntary suggestion updated. Historical payments and consent were not changed.',
    );
  }

  function optOutDonor(donor, sourceReference) {
    const args = { donorId: donor.donor_id, sourceReference };
    return runStaffAction(
      `opt-out:${JSON.stringify(args)}`,
      (api, operationId) => api.optOutMonthlyDonor({ ...args, operationId }),
      'Donor opt-out recorded. Future monthly requests are disabled.',
    );
  }

  async function signOut() {
    setBusy(true);
    setNotice('');
    try {
      const { error } = await getBrowserClient().auth.signOut();
      if (error) throw error;
      setDonors([]);
      setRole(null);
      setSession('signed-out');
    } catch (cause) {
      setNotice(cause.message || 'Could not sign out.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="management">
      <Link href="/">← Masjid E Mamoor 2</Link>
      <h1>Monthly contributors</h1>
      <p>
        <Link href="/claims">Open payment claims →</Link> · <Link href="/finance">Finance</Link>
        {' · '}
        <Link href="/tasks">Tasks</Link>
        {' · '}
        <Link href="/meetings">Meetings</Link> · <Link href="/inbox">Notifications</Link>
        {' · '}
        <Link href="/profile">My profile</Link>
      </p>
      <p className="muted">
        Suggested amounts are voluntary. A verified contribution records the amount received; no
        remaining balance is requested.
      </p>
      {session === 'checking' && <p>Checking your account…</p>}
      {session === 'signed-out' && (
        <p className="panel">
          Please <Link href="/login">sign in</Link> to continue.
        </p>
      )}
      {session === 'password-change' && (
        <p className="panel">
          Change your temporary password at <Link href="/login">management sign in</Link> before
          viewing contributors.
        </p>
      )}
      {session === 'error' && (
        <p className="notice error" role="alert">
          {notice}
        </p>
      )}
      {session === 'unconfigured' && (
        <p className="notice error" role="alert">
          {notice}
        </p>
      )}
      {session === 'signed-in' && (
        <>
          <button type="button" disabled={busy} onClick={signOut}>
            Sign out
          </button>
          {notice && (
            <p className="notice" role="status">
              {notice}
            </p>
          )}
          <div className="management-grid">
            {allowedToEnroll.has(role) ? (
              <form className="panel" onSubmit={enroll}>
                <h2>Enroll a contributor</h2>
                <label className="field">
                  Name
                  <input name="name" required maxLength={200} />
                </label>
                <label className="field">
                  WhatsApp number
                  <input
                    name="whatsapp"
                    type="tel"
                    placeholder="+919876543210"
                    pattern="\+[1-9][0-9]{7,14}"
                    required
                  />
                </label>
                <label className="field">
                  Suggested monthly amount (₹)
                  <input
                    name="amount"
                    inputMode="decimal"
                    pattern="(0|[1-9][0-9]*)(\.[0-9]{1,2})?"
                    required
                  />
                </label>
                <label className="field">
                  Referrer account ID (if referred)
                  <input name="referrer" />
                </label>
                <label className="field">
                  How the contributor agreed
                  <select name="consentMethod" required defaultValue="">
                    <option value="" disabled>
                      Select method
                    </option>
                    <option value="in-person">In person</option>
                    <option value="phone-call">Phone call</option>
                    <option value="message">Their message</option>
                  </select>
                </label>
                <label className="field">
                  Consent evidence reference
                  <input name="evidence" required minLength={3} maxLength={240} />
                </label>
                <label className="checkbox">
                  <input type="checkbox" name="consent" value="yes" required />
                  <span>
                    I recorded the contributor’s agreement and evidence. WhatsApp messages require
                    separate opt-in from the recipient.
                  </span>
                </label>
                <button className="primary" disabled={busy}>
                  {busy ? 'Saving…' : 'Save contributor'}
                </button>
              </form>
            ) : (
              <div className="panel">
                <h2>Read-only access</h2>
                <p className="muted">Your role can view the contributor roster.</p>
              </div>
            )}
            <section className="panel">
              <h2>Contributor roster</h2>
              {donors.length === 0 ? (
                <p className="muted">No contributors are listed yet.</p>
              ) : (
                <ul className="roster">
                  {donors.map((donor) => (
                    <li key={donor.donor_id}>
                      <span>
                        <strong>{donor.donor_name}</strong>
                        <br />
                        <small>{donor.active ? 'Active' : 'Inactive'}</small>
                      </span>
                      <span>{formatPaiseINR(donor.suggested_amount_paise)}</span>
                      {donor.active && donorStaffRoles.has(role) && (
                        <DonorStaffControls
                          donor={donor}
                          busy={busy}
                          onCorrection={correctSuggestion}
                          onOptOut={optOutDonor}
                        />
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </>
      )}
    </main>
  );
}
