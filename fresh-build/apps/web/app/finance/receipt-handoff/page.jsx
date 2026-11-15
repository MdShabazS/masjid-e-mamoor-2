'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { prepareManualReceiptHandoff } from '../../../../../packages/api-client/receipt-handoff.js';
import { getBrowserClient } from '../../../lib/supabase.js';

const HANDOFF_ROLES = new Set(['treasurer', 'committee_member']);

export default function ReceiptHandoffPage() {
  const [session, setSession] = useState('checking');
  const [role, setRole] = useState(null);
  const [enabled, setEnabled] = useState(false);
  const [receiptCode, setReceiptCode] = useState('');
  const [recipientReference, setRecipientReference] = useState('');
  const [evidenceReference, setEvidenceReference] = useState('');
  const [channel, setChannel] = useState('in_person');
  const [result, setResult] = useState('delivered');
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const operation = useRef(null);

  useEffect(() => {
    let active = true;
    const client = getBrowserClient();
    async function load() {
      try {
        const { data, error: authError } = await client.auth.getUser();
        if (!active) return;
        if (authError || !data?.user) {
          setSession('signed-out');
          return;
        }
        const { data: currentRole, error: roleError } = await client.rpc('current_app_role');
        if (roleError) throw roleError;
        if (!active) return;
        setRole(currentRole);
        if (HANDOFF_ROLES.has(currentRole)) {
          const { data: allowed, error: capabilityError } = await client.rpc(
            'manual_receipt_handoff_enabled',
          );
          if (capabilityError) throw capabilityError;
          if (active) setEnabled(allowed === true);
        }
        if (active) setSession('ready');
      } catch {
        if (active) {
          setError(
            'Receipt handoff status could not be checked. Reload before recording a handoff.',
          );
          setSession('unavailable');
        }
      }
    }
    load();
    return () => {
      active = false;
    };
  }, []);

  async function submit(event) {
    event.preventDefault();
    setError('');
    setNotice('');
    if (!confirmed) {
      setError('Confirm the outcome against the approved receipt and evidence first.');
      return;
    }
    let args;
    try {
      args = prepareManualReceiptHandoff({
        receiptCode,
        recipientReference,
        evidenceReference,
        channel,
        result,
      });
    } catch (cause) {
      setError(cause.message);
      return;
    }
    const key = JSON.stringify(args);
    if (operation.current?.key !== key) operation.current = { key, id: crypto.randomUUID() };
    setBusy(true);
    try {
      const { error: failure } = await getBrowserClient().rpc('record_manual_receipt_handoff', {
        ...args,
        p_operation_id: operation.current.id,
      });
      if (failure) throw failure;
      operation.current = null;
      setNotice('Manual handoff outcome recorded. This app did not send a message.');
      setReceiptCode('');
      setRecipientReference('');
      setEvidenceReference('');
      setConfirmed(false);
    } catch (cause) {
      setError(cause.message || 'Handoff could not be recorded. Check the receipt status.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="management">
      <Link href="/finance">← Finance</Link>
      <h1>Manual receipt handoff</h1>
      <p className="muted">
        Record the outcome after you have handled an approved copy of an already issued receipt.
        This page does not generate a receipt or send email or WhatsApp.
      </p>
      {session === 'checking' && <p>Checking account and approval…</p>}
      {session === 'signed-out' && (
        <p>
          <Link href="/login">Sign in</Link> to continue.
        </p>
      )}
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
      {session === 'ready' && !HANDOFF_ROLES.has(role) && (
        <p>Only the Treasurer or an authorized committee member can record a handoff.</p>
      )}
      {session === 'ready' && HANDOFF_ROLES.has(role) && !enabled && (
        <p>Receipt handoff is disabled until the Board approves the receipt and delivery policy.</p>
      )}
      {session === 'ready' && HANDOFF_ROLES.has(role) && enabled && (
        <form className="panel" onSubmit={submit}>
          <label className="field">
            Issued receipt code
            <input required value={receiptCode} onChange={(e) => setReceiptCode(e.target.value)} />
          </label>
          <label className="field">
            Recipient reference
            <input
              required
              minLength={3}
              maxLength={120}
              value={recipientReference}
              onChange={(e) => setRecipientReference(e.target.value)}
            />
          </label>
          <label className="field">
            Manual channel
            <select value={channel} onChange={(e) => setChannel(e.target.value)}>
              <option value="in_person">In person</option>
              <option value="email">Email sent outside this app</option>
              <option value="other_manual">Other approved manual channel</option>
            </select>
          </label>
          <label className="field">
            Actual outcome
            <select value={result} onChange={(e) => setResult(e.target.value)}>
              <option value="delivered">Delivered</option>
              <option value="failed">Failed</option>
              <option value="uncertain">Uncertain</option>
            </select>
          </label>
          <label className="field">
            Evidence reference
            <input
              required
              minLength={3}
              maxLength={240}
              value={evidenceReference}
              onChange={(e) => setEvidenceReference(e.target.value)}
            />
          </label>
          <label className="field">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            I checked this outcome against the approved receipt and delivery evidence.
          </label>
          <button className="primary" disabled={busy || !confirmed}>
            {busy ? 'Recording…' : 'Record manual handoff'}
          </button>
        </form>
      )}
    </main>
  );
}
