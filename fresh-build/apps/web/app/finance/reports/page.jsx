'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import {
  formatPaise,
  reportPeriod,
  validRunId,
  verifyCsvDigest,
} from '../../../lib/report-view.js';
import { getBrowserClient } from '../../../lib/supabase.js';

const READERS = new Set(['system_admin', 'president', 'vice_president', 'secretary', 'treasurer']);
const REQUESTERS = new Set(['president', 'vice_president', 'secretary', 'treasurer']);

async function rpc(name, args) {
  const { data, error } = await getBrowserClient().rpc(name, args);
  if (error) throw new Error(error.message || 'Report is unavailable.');
  return data;
}

export default function FinanceReportsPage() {
  const [status, setStatus] = useState('checking');
  const [role, setRole] = useState(null);
  const [kind, setKind] = useState('month');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [runId, setRunId] = useState('');
  const [balances, setBalances] = useState([]);
  const [lines, setLines] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [artifactMode, setArtifactMode] = useState(false);
  const [artifactStatus, setArtifactStatus] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const operation = useRef(null);

  async function ensureApproved() {
    const response = await fetch('/api/management/report-capabilities', { cache: 'no-store' });
    if (!response.ok || !(await response.json()).exportsApproved) {
      setLoaded(false);
      setStatus('disabled');
      throw new Error('Report export awaits masjid privacy and publication approval.');
    }
  }

  useEffect(() => {
    let active = true;
    async function initialize() {
      try {
        const response = await fetch('/api/management/report-capabilities', { cache: 'no-store' });
        const capabilities = response.ok ? await response.json() : null;
        if (!capabilities?.exportsApproved) {
          if (active) setStatus('disabled');
          return;
        }
        if (active) setArtifactMode(Boolean(capabilities.artifactMode));
        const { data, error: authError } = await getBrowserClient().auth.getUser();
        if (authError || !data?.user) {
          if (active) setStatus('signed-out');
          return;
        }
        const gateRows = await rpc('current_identity_gate', {});
        const gate = Array.isArray(gateRows) ? gateRows[0] : gateRows;
        if (!gate?.account_active || gate.must_change_password) {
          if (active) setStatus('forbidden');
          return;
        }
        const nextRole = await rpc('current_app_role', {});
        if (active) {
          setRole(nextRole);
          setStatus(READERS.has(nextRole) ? 'ready' : 'forbidden');
        }
      } catch {
        if (active) setStatus('unavailable');
      }
    }
    initialize();
    return () => {
      active = false;
    };
  }, []);

  async function load(id) {
    if (!validRunId(id)) throw new Error('Enter a valid report ID.');
    const [nextBalances, nextLines] = await Promise.all([
      getBrowserClient().rpc('list_finance_report_balances', { p_run_id: id }).range(0, 499),
      getBrowserClient().rpc('list_finance_report_lines', { p_run_id: id }).range(0, 99),
    ]);
    if (nextBalances.error || nextLines.error)
      throw new Error(
        nextBalances.error?.message || nextLines.error?.message || 'Report unavailable.',
      );
    setBalances(nextBalances.data ?? []);
    setLines(nextLines.data ?? []);
    if (artifactMode) {
      const rows = await rpc('finance_report_artifact_status', { p_run_id: id });
      setArtifactStatus(Array.isArray(rows) ? rows : []);
    } else setArtifactStatus([]);
    setLoaded(true);
    setRunId(id);
    setNotice(
      'Snapshot loaded. The on-screen lines are limited to the first 100; the CSV contains the complete verified snapshot.',
    );
  }

  async function requestReport(event) {
    event.preventDefault();
    setError('');
    setNotice('');
    setBusy(true);
    setLoaded(false);
    try {
      await ensureApproved();
      const args = reportPeriod(kind, start, end);
      const key = JSON.stringify(args);
      if (operation.current?.key !== key) operation.current = { key, id: crypto.randomUUID() };
      const id = await rpc('request_finance_report', {
        ...args,
        p_operation_id: operation.current.id,
      });
      await load(id);
      operation.current = null;
    } catch (cause) {
      setError(cause.message);
    } finally {
      setBusy(false);
    }
  }

  async function openReport(event) {
    event.preventDefault();
    setError('');
    setNotice('');
    setBusy(true);
    setLoaded(false);
    try {
      await ensureApproved();
      await load(runId);
    } catch (cause) {
      setError(cause.message);
    } finally {
      setBusy(false);
    }
  }

  async function download(format) {
    setError('');
    setBusy(true);
    try {
      await ensureApproved();
      if (!validRunId(runId)) throw new Error('Load a report first.');
      const { data } = await getBrowserClient().auth.getSession();
      const token = data?.session?.access_token;
      if (!token) throw new Error('Sign in again before downloading.');
      const response = await fetch(
        `/api/management/report-${format}?runId=${encodeURIComponent(runId)}`,
        {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        },
      );
      if (response.status === 202) {
        setNotice('The private file is still being prepared. Refresh its status and try again.');
        return;
      }
      if (!response.ok)
        throw new Error('The private download was denied or is temporarily unavailable.');
      const bytes = await response.arrayBuffer();
      if (!(await verifyCsvDigest(bytes, response.headers.get('X-Report-SHA256'))))
        throw new Error('Download integrity check failed. Try again.');
      const url = URL.createObjectURL(
        new Blob([bytes], {
          type: format === 'pdf' ? 'application/pdf' : 'text/csv;charset=utf-8',
        }),
      );
      try {
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `finance-report-${runId}.${format}`;
        document.body.append(anchor);
        anchor.click();
        anchor.remove();
      } finally {
        URL.revokeObjectURL(url);
      }
      setNotice(
        `Verified ${format.toUpperCase()} downloaded. Keep this private finance file secure.`,
      );
    } catch (cause) {
      setError(cause.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="management">
      <Link href="/finance">← Finance</Link>
      <h1>Private finance reports</h1>
      <p className="muted">
        Reports are fixed snapshots of verified ledger effects. Dates are interpreted in India time.
        The end date is excluded.
      </p>
      {status === 'checking' && <p>Checking report access…</p>}
      {status === 'disabled' && (
        <p role="status" className="notice">
          Report export awaits masjid privacy and publication approval.
        </p>
      )}
      {status === 'signed-out' && (
        <p>
          <Link href="/login">Sign in</Link> to continue.
        </p>
      )}
      {status === 'forbidden' && (
        <p role="alert" className="notice error">
          This account cannot view private finance reports.
        </p>
      )}
      {status === 'unavailable' && (
        <p role="alert" className="notice error">
          Report access is unavailable. Try again later.
        </p>
      )}
      {status === 'ready' && (
        <>
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
          {REQUESTERS.has(role) && (
            <form className="panel" onSubmit={requestReport}>
              <h2>Request a snapshot</h2>
              <label className="field">
                Period
                <select value={kind} onChange={(event) => setKind(event.target.value)}>
                  <option value="month">Calendar month</option>
                  <option value="year">Calendar year</option>
                  <option value="range">Date range</option>
                </select>
              </label>
              <label className="field">
                Start date{' '}
                <input
                  type="date"
                  required
                  value={start}
                  onChange={(event) => setStart(event.target.value)}
                />
              </label>
              <label className="field">
                End date, excluded{' '}
                <input
                  type="date"
                  required
                  value={end}
                  onChange={(event) => setEnd(event.target.value)}
                />
              </label>
              <button className="primary" disabled={busy}>
                Request and review report
              </button>
            </form>
          )}
          <form className="panel" onSubmit={openReport}>
            <h2>Open an existing snapshot</h2>
            <label className="field">
              Report ID{' '}
              <input
                required
                value={runId}
                onChange={(event) => {
                  setRunId(event.target.value.trim());
                  setLoaded(false);
                }}
              />
            </label>
            <button disabled={busy}>Open report</button>
          </form>
          {loaded && (
            <section className="panel">
              <h2>Account totals</h2>
              {artifactMode && (
                <div role="status" className="notice">
                  <p>
                    Private files:{' '}
                    {['csv', 'pdf']
                      .map((format) => {
                        const item = artifactStatus.find((row) => row.format === format);
                        return `${format.toUpperCase()} ${item?.status ?? 'queued'}`;
                      })
                      .join(' · ')}
                  </p>
                  <button type="button" disabled={busy} onClick={() => load(runId)}>
                    Refresh file status
                  </button>
                </div>
              )}
              <div className="report-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Account</th>
                      <th>Opening</th>
                      <th>Period opening</th>
                      <th>Income</th>
                      <th>Expense</th>
                      <th>Transfer</th>
                      <th>Closing</th>
                    </tr>
                  </thead>
                  <tbody>
                    {balances.map((row) => (
                      <tr key={row.account_id}>
                        <th>{row.account_name}</th>
                        <td>{formatPaise(row.opening_paise)}</td>
                        <td>{formatPaise(row.period_openings_paise)}</td>
                        <td>{formatPaise(row.income_paise)}</td>
                        <td>{formatPaise(row.expense_paise)}</td>
                        <td>{formatPaise(row.transfer_paise)}</td>
                        <td>{formatPaise(row.closing_paise)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button
                className="primary"
                type="button"
                disabled={busy}
                onClick={() => download('csv')}
              >
                Download verified CSV
              </button>
              <button type="button" disabled={busy} onClick={() => download('pdf')}>
                Download verified PDF
              </button>
            </section>
          )}
          {loaded && (
            <section className="panel">
              <h2>First {lines.length} entries</h2>
              <div className="report-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Category</th>
                      <th>Description</th>
                      <th>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((row) => (
                      <tr key={row.effect_id}>
                        <td>
                          {new Date(row.occurred_at).toLocaleString('en-IN', {
                            timeZone: 'Asia/Kolkata',
                          })}
                        </td>
                        <td>{row.category}</td>
                        <td>{row.description}</td>
                        <td>{formatPaise(row.amount_paise)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}
    </main>
  );
}
