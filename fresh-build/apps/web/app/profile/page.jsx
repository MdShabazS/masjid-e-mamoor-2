'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { getBrowserClient } from '../../lib/supabase.js';

export default function ProfilePage() {
  const [status, setStatus] = useState('checking');
  const [role, setRole] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [selected, setSelected] = useState('');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [current, setCurrent] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const operation = useRef(null);
  const selectedAccount = useRef('');

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const client = getBrowserClient();
        const { data: identity, error: authError } = await client.auth.getUser();
        if (authError || !identity?.user) {
          if (active) setStatus('signed-out');
          return;
        }
        const { data: gateRows, error: gateError } = await client.rpc('current_identity_gate');
        const gate = Array.isArray(gateRows) ? gateRows[0] : gateRows;
        if (gateError || !gate?.account_active || gate.must_change_password) {
          if (active) setStatus('blocked');
          return;
        }
        const { data: currentRole, error: roleError } = await client.rpc('current_app_role');
        if (roleError) throw roleError;
        if (!active) return;
        setRole(currentRole);
        if (currentRole === 'president') {
          const { data: rows, error: accountError } = await client.rpc('list_finance_accounts');
          if (accountError) throw accountError;
          if (active)
            setAccounts(
              (rows ?? []).filter(
                (row) => row.active && ['upi', 'bank'].includes(row.account_kind),
              ),
            );
        }
        if (active) setStatus('ready');
      } catch (cause) {
        if (active) {
          setError(cause.message || 'Profile unavailable.');
          setStatus('error');
        }
      }
    }
    load();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!file) {
      setPreview('');
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(
    () => () => {
      if (current?.url) URL.revokeObjectURL(current.url);
    },
    [current],
  );

  async function accessToken() {
    const { data, error: authError } = await getBrowserClient().auth.getSession();
    if (authError || !data?.session?.access_token) throw new Error('Sign in again.');
    return data.session.access_token;
  }

  function chooseAccount(id) {
    selectedAccount.current = id;
    setSelected(id);
    setFile(null);
    setConfirmed(false);
    setCurrent(null);
    setNotice('');
    setError('');
    operation.current = null;
  }

  async function viewCurrent() {
    if (!selected) return;
    const accountId = selected;
    setBusy(true);
    setError('');
    setCurrent(null);
    try {
      const token = await accessToken();
      const response = await fetch(
        `/api/management/payment-qr?accountId=${encodeURIComponent(accountId)}`,
        {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        },
      );
      if (!response.ok) {
        const result = await response.json();
        if (result?.error?.code === 'QR_NOT_FOUND') {
          setNotice('No active QR for this account.');
          return;
        }
        throw new Error(result?.error?.code ?? 'Could not load the current QR.');
      }
      const blob = await response.blob();
      if (selectedAccount.current !== accountId) return;
      setCurrent({
        url: URL.createObjectURL(blob),
        versionId: response.headers.get('X-QR-Version-ID'),
      });
      setNotice('Showing the active QR for this account.');
    } catch (cause) {
      setError(cause.message || 'Could not load the current QR.');
    } finally {
      setBusy(false);
    }
  }

  async function updateQr(event) {
    event.preventDefault();
    if (!selected || !file || !confirmed || busy) return;
    setBusy(true);
    setError('');
    setNotice('');
    const operationId = operation.current ?? crypto.randomUUID();
    operation.current = operationId;
    try {
      const token = await accessToken();
      const form = new FormData();
      form.set('accountId', selected);
      form.set('operationId', operationId);
      form.set('payeeConfirmed', 'true');
      form.set('file', file);
      const response = await fetch('/api/management/payment-qr', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result?.error?.code ?? 'QR update failed.');
      setFile(null);
      setConfirmed(false);
      setCurrent(null);
      operation.current = null;
      setNotice(
        'New payment QR is active for future requests. Existing requests keep their original QR.',
      );
    } catch (cause) {
      setError(cause.message || 'QR update failed.');
    } finally {
      setBusy(false);
    }
  }

  const account = accounts.find((item) => item.account_id === selected);
  return (
    <main className="management">
      <Link href="/contributors">← Management</Link>
      <h1>My profile</h1>
      {status === 'checking' && <p>Checking your account…</p>}
      {status === 'signed-out' && (
        <p>
          <Link href="/login">Sign in</Link> to continue.
        </p>
      )}
      {status === 'blocked' && <p>Complete your account setup before opening this profile.</p>}
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
      {status === 'ready' && role !== 'president' && (
        <p>Payment QR updates are available to the President.</p>
      )}
      {status === 'ready' && role === 'president' && (
        <section className="panel">
          <h2>Payment QR</h2>
          <p className="muted">
            A newly activated QR becomes the current QR for future donation requests. Earlier
            requests retain their saved QR.
          </p>
          <label className="field">
            Masjid payment account
            <select
              disabled={busy}
              value={selected}
              onChange={(event) => chooseAccount(event.target.value)}
            >
              <option value="">Choose an account</option>
              {accounts.map((item) => (
                <option key={item.account_id} value={item.account_id}>
                  {item.account_name} ({item.account_kind})
                </option>
              ))}
            </select>
          </label>
          {accounts.length === 0 && <p>No active bank or UPI account is configured.</p>}
          {account && (
            <>
              <button type="button" disabled={busy} onClick={viewCurrent}>
                View current QR
              </button>
              {current && (
                <p>
                  <img src={current.url} alt="Current payment QR" width="240" height="240" />
                  <br />
                  Version: {current.versionId}
                </p>
              )}
              <form onSubmit={updateQr}>
                <label className="field">
                  Replacement QR image (PNG or JPEG, up to 5 MB)
                  <input
                    type="file"
                    accept="image/png,image/jpeg"
                    required
                    onChange={(event) => {
                      setFile(event.target.files?.[0] ?? null);
                      setConfirmed(false);
                      operation.current = null;
                    }}
                  />
                </label>
                {preview && (
                  <img src={preview} alt="New payment QR preview" width="240" height="240" />
                )}
                <label className="checkbox">
                  <input
                    type="checkbox"
                    required
                    checked={confirmed}
                    onChange={(event) => setConfirmed(event.target.checked)}
                  />
                  I scanned this image and confirmed its payee matches the selected masjid account
                  and official bank record.
                </label>
                <button className="primary" disabled={busy || !file || !confirmed}>
                  Activate new QR
                </button>
              </form>
            </>
          )}
        </section>
      )}
    </main>
  );
}
