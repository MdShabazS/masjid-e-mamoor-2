'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { parseINRToPaise } from '../../../../../packages/api-client/index.js';
import {
  appendFinancePage,
  financePageCursor,
} from '../../../../../packages/api-client/finance-pagination.js';
import { getBrowserClient } from '../../../lib/supabase.js';

const readers = new Set(['system_admin', 'president', 'vice_president', 'secretary', 'treasurer']);
const HISTORY_LIMIT = 50;
const OBSERVATION_LIMIT = 25;
function money(value) {
  const n = BigInt(value),
    abs = n < 0n ? -n : n;
  return `${n < 0n ? '-' : ''}₹${(abs / 100n).toLocaleString('en-IN')}.${String(abs % 100n).padStart(2, '0')}`;
}
function nonnegativePaise(value) {
  if (value === '0' || value === '0.00' || value === '0.0') return 0;
  return parseINRToPaise(value);
}
export default function FinanceAccountsPage() {
  const [session, setSession] = useState('checking'),
    [role, setRole] = useState(null);
  const [accounts, setAccounts] = useState([]),
    [openings, setOpenings] = useState([]);
  const [selected, setSelected] = useState(''),
    [history, setHistory] = useState([]),
    [observations, setObservations] = useState([]);
  const [historyHasMore, setHistoryHasMore] = useState(false),
    [observationHasMore, setObservationHasMore] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false),
    [observationLoading, setObservationLoading] = useState(false);
  const [correctableEffects, setCorrectableEffects] = useState([]);
  const [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false);
  const [name, setName] = useState(''),
    [kind, setKind] = useState('cash'),
    [upi, setUpi] = useState('');
  const [bank, setBank] = useState(''),
    [ifsc, setIfsc] = useState('');
  const [beneficiaryUpi, setBeneficiaryUpi] = useState(''),
    [beneficiaryBank, setBeneficiaryBank] = useState(''),
    [beneficiaryIfsc, setBeneficiaryIfsc] = useState(''),
    [beneficiaryEvidence, setBeneficiaryEvidence] = useState('');
  const [beneficiaryVersions, setBeneficiaryVersions] = useState([]);
  const [qrFile, setQrFile] = useState(null),
    [qrPreview, setQrPreview] = useState(''),
    [qrPayeeConfirmed, setQrPayeeConfirmed] = useState(false);
  const [activeQr, setActiveQr] = useState(null),
    [qrLoading, setQrLoading] = useState(false);
  const [openingAmount, setOpeningAmount] = useState(''),
    [openingProof, setOpeningProof] = useState('');
  const [from, setFrom] = useState(''),
    [to, setTo] = useState(''),
    [transferAmount, setTransferAmount] = useState('');
  const [transferProof, setTransferProof] = useState('');
  const [observed, setObserved] = useState(''),
    [observationProof, setObservationProof] = useState('');
  const [explanation, setExplanation] = useState('');
  const [effectId, setEffectId] = useState(''),
    [replacementAccount, setReplacementAccount] = useState('');
  const [replacementAmount, setReplacementAmount] = useState(''),
    [correctionReason, setCorrectionReason] = useState('');
  const operations = useRef(new Map());
  const qrOperation = useRef(null);
  const accountRequest = useRef(0);
  useEffect(() => {
    if (!qrFile) {
      setQrPreview('');
      return;
    }
    const preview = URL.createObjectURL(qrFile);
    setQrPreview(preview);
    return () => URL.revokeObjectURL(preview);
  }, [qrFile]);
  useEffect(() => {
    return () => {
      if (activeQr?.url) URL.revokeObjectURL(activeQr.url);
    };
  }, [activeQr]);
  async function rpc(name, args = {}) {
    const { data, error: failure } = await getBrowserClient().rpc(name, args);
    if (failure) throw new Error(failure.message || 'Action unavailable');
    return data;
  }
  async function load() {
    const nextRole = await rpc('current_app_role');
    setRole(nextRole);
    if (!readers.has(nextRole)) return;
    const [items, pending] = await Promise.all([
      rpc('list_finance_accounts'),
      ['president', 'treasurer'].includes(nextRole)
        ? rpc('list_pending_finance_openings')
        : Promise.resolve([]),
    ]);
    setAccounts(items ?? []);
    setOpenings(pending ?? []);
  }
  async function loadAccount(id) {
    const request = ++accountRequest.current;
    setHistoryLoading(false);
    setObservationLoading(false);
    setHistory([]);
    setObservations([]);
    setHistoryHasMore(false);
    setObservationHasMore(false);
    setCorrectableEffects([]);
    setBeneficiaryVersions([]);
    if (!id) {
      return;
    }
    let effects, reconciliations, eligible, versions;
    try {
      [effects, reconciliations, eligible, versions] = await Promise.all([
        rpc('list_finance_account_history', { p_account_id: id, p_limit: HISTORY_LIMIT }),
        rpc('list_finance_reconciliations', { p_account_id: id, p_limit: OBSERVATION_LIMIT }),
        role === 'treasurer'
          ? rpc('list_correctable_finance_effects', { p_account_id: id })
          : Promise.resolve([]),
        ['president', 'treasurer'].includes(role)
          ? rpc('list_account_beneficiary_versions', { p_account_id: id })
          : Promise.resolve([]),
      ]);
    } catch (cause) {
      if (request !== accountRequest.current) return;
      throw cause;
    }
    if (request !== accountRequest.current) return;
    setHistory(effects ?? []);
    setObservations(reconciliations ?? []);
    setHistoryHasMore((effects?.length ?? 0) === HISTORY_LIMIT);
    setObservationHasMore((reconciliations?.length ?? 0) === OBSERVATION_LIMIT);
    setCorrectableEffects(eligible ?? []);
    setBeneficiaryVersions(versions ?? []);
  }
  async function loadMoreHistory() {
    if (!selected || !historyHasMore || historyLoading || !history.length) return;
    const request = accountRequest.current;
    setHistoryLoading(true);
    setError('');
    try {
      const page = await rpc('list_finance_account_history', {
        p_account_id: selected,
        p_limit: HISTORY_LIMIT,
        ...financePageCursor(history, 'effect_id', 'occurred_at'),
      });
      if (request !== accountRequest.current) return;
      setHistory((previous) => appendFinancePage(previous, page ?? [], 'effect_id'));
      setHistoryHasMore((page?.length ?? 0) === HISTORY_LIMIT);
    } catch (cause) {
      if (request === accountRequest.current) setError(cause.message);
    } finally {
      if (request === accountRequest.current) setHistoryLoading(false);
    }
  }
  async function loadMoreObservations() {
    if (!selected || !observationHasMore || observationLoading || !observations.length) return;
    const request = accountRequest.current;
    setObservationLoading(true);
    setError('');
    try {
      const page = await rpc('list_finance_reconciliations', {
        p_account_id: selected,
        p_limit: OBSERVATION_LIMIT,
        ...financePageCursor(observations, 'reconciliation_id', 'recorded_at'),
      });
      if (request !== accountRequest.current) return;
      setObservations((previous) => appendFinancePage(previous, page ?? [], 'reconciliation_id'));
      setObservationHasMore((page?.length ?? 0) === OBSERVATION_LIMIT);
    } catch (cause) {
      if (request === accountRequest.current) setError(cause.message);
    } finally {
      if (request === accountRequest.current) setObservationLoading(false);
    }
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
  async function execute(command, args, success) {
    setBusy(true);
    setError('');
    setNotice('');
    const key = `${command}:${JSON.stringify(args)}`;
    const operationId = operations.current.get(key) ?? crypto.randomUUID();
    operations.current.set(key, operationId);
    try {
      await rpc(command, { ...args, p_operation_id: operationId });
      operations.current.delete(key);
      setNotice(success);
      try {
        await load();
        if (selected) await loadAccount(selected);
      } catch {
        setError('Saved, but refreshing the account view failed. Reload before retrying.');
      }
      return true;
    } catch (cause) {
      setError(cause.message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function createAccount(event) {
    event.preventDefault();
    const args = {
      p_name: name.trim(),
      p_kind: kind,
      p_upi_id: kind === 'upi' ? upi.trim() : null,
      p_bank_account_number: kind === 'bank' ? bank.trim() : null,
      p_ifsc: kind === 'bank' ? ifsc.trim() : null,
    };
    if (
      await execute(
        'create_finance_account',
        args,
        'Account created. Treasurer can submit an opening balance.',
      )
    ) {
      setName('');
      setUpi('');
      setBank('');
      setIfsc('');
    }
  }
  async function submitOpening(event) {
    event.preventDefault();
    try {
      if (
        await execute(
          'submit_account_opening',
          {
            p_account_id: selected,
            p_amount_paise: nonnegativePaise(openingAmount),
            p_evidence_reference: openingProof.trim(),
          },
          'Opening submitted for President verification. No money has posted yet.',
        )
      ) {
        setOpeningAmount('');
        setOpeningProof('');
      }
    } catch (cause) {
      setError(cause.message);
    }
  }
  async function correctBeneficiary(event) {
    event.preventDefault();
    const account = accounts.find((item) => item.account_id === selected);
    if (!account || !['upi', 'bank'].includes(account.account_kind)) return;
    if (
      await execute(
        'correct_account_beneficiary',
        {
          p_account_id: selected,
          p_upi_id: account.account_kind === 'upi' ? beneficiaryUpi.trim() : null,
          p_bank_account_number: account.account_kind === 'bank' ? beneficiaryBank.trim() : null,
          p_ifsc: account.account_kind === 'bank' ? beneficiaryIfsc.trim() : null,
          p_evidence_reference: beneficiaryEvidence.trim(),
        },
        'Beneficiary corrected before use. The prior version remains in the audit history.',
      )
    ) {
      setBeneficiaryUpi('');
      setBeneficiaryBank('');
      setBeneficiaryIfsc('');
      setBeneficiaryEvidence('');
    }
  }
  async function activateQr(event) {
    event.preventDefault();
    if (!selected || !qrFile || !qrPayeeConfirmed || !beneficiaryVersions.some((v) => v.is_current))
      return;
    setBusy(true);
    setError('');
    setNotice('');
    const operationId = qrOperation.current ?? crypto.randomUUID();
    qrOperation.current = operationId;
    try {
      const { data: auth, error: authError } = await getBrowserClient().auth.getSession();
      if (authError || !auth?.session?.access_token)
        throw new Error('Sign in again before uploading.');
      const form = new FormData();
      form.set('accountId', selected);
      form.set('operationId', operationId);
      form.set('payeeConfirmed', 'true');
      form.set('file', qrFile);
      const response = await fetch('/api/management/payment-qr', {
        method: 'POST',
        headers: { Authorization: `Bearer ${auth.session.access_token}` },
        body: form,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result?.error?.code ?? 'QR activation failed');
      setNotice(`Payment QR activated. File digest: ${result.data.sha256}`);
      setQrFile(null);
      setQrPayeeConfirmed(false);
      setActiveQr(null);
      qrOperation.current = null;
    } catch (cause) {
      setError(cause.message);
    } finally {
      setBusy(false);
    }
  }
  async function viewActiveQr() {
    const accountId = selected;
    const request = accountRequest.current;
    setQrLoading(true);
    setActiveQr(null);
    setError('');
    try {
      const { data: auth, error: authError } = await getBrowserClient().auth.getSession();
      if (authError || !auth?.session?.access_token)
        throw new Error('Sign in again to view the QR.');
      const response = await fetch(
        `/api/management/payment-qr?accountId=${encodeURIComponent(accountId)}`,
        { headers: { Authorization: `Bearer ${auth.session.access_token}` }, cache: 'no-store' },
      );
      if (!response.ok) {
        const result = await response.json();
        throw new Error(
          result?.error?.code === 'QR_NOT_FOUND'
            ? 'No active QR for this account.'
            : (result?.error?.code ?? 'QR retrieval failed'),
        );
      }
      const image = await response.blob();
      if (request !== accountRequest.current) return;
      setActiveQr({
        url: URL.createObjectURL(image),
        sha256: response.headers.get('X-QR-SHA256'),
        versionId: response.headers.get('X-QR-Version-ID'),
      });
    } catch (cause) {
      if (request === accountRequest.current) setError(cause.message);
    } finally {
      if (request === accountRequest.current) setQrLoading(false);
    }
  }
  async function transfer(event) {
    event.preventDefault();
    try {
      if (
        await execute(
          'post_finance_transfer',
          {
            p_from_account_id: from,
            p_to_account_id: to,
            p_amount_paise: parseINRToPaise(transferAmount),
            p_evidence_reference: transferProof.trim(),
          },
          'Transfer posted with equal and opposite account effects.',
        )
      ) {
        setTransferAmount('');
        setTransferProof('');
      }
    } catch (cause) {
      setError(cause.message);
    }
  }
  async function reconcile(event) {
    event.preventDefault();
    try {
      if (
        await execute(
          'record_finance_reconciliation',
          {
            p_account_id: selected,
            p_observed_balance_paise: nonnegativePaise(observed),
            p_evidence_reference: observationProof.trim(),
            p_explanation: explanation.trim() || null,
          },
          'Observation recorded. A variance does not change the ledger balance.',
        )
      ) {
        setObserved('');
        setObservationProof('');
        setExplanation('');
      }
    } catch (cause) {
      setError(cause.message);
    }
  }
  async function correct(event) {
    event.preventDefault();
    try {
      const original = correctableEffects.find((item) => item.effect_id === effectId);
      if (!original || !correctionReason.trim())
        throw new Error('Select an original income or expense effect and give a reason.');
      const replacement = replacementAccount ? parseINRToPaise(replacementAmount) : null;
      if (replacementAccount && !replacement)
        throw new Error('Enter a nonzero replacement amount.');
      if (
        await execute(
          'correct_finance_posting',
          {
            p_original_effect_id: effectId,
            p_replacement_account_id: replacementAccount || null,
            p_replacement_amount_paise:
              replacement === null
                ? null
                : original.effective_kind === 'expense_payment'
                  ? `-${replacement}`
                  : replacement,
            p_reason: correctionReason.trim(),
          },
          'Correction recorded as an immutable reversal and optional replacement.',
        )
      ) {
        setEffectId('');
        setReplacementAmount('');
        setReplacementAccount('');
        setCorrectionReason('');
      }
    } catch (cause) {
      setError(cause.message);
    }
  }
  const active = accounts.filter((account) => account.active);
  const selectedAccount = accounts.find((account) => account.account_id === selected);
  return (
    <main className="management">
      <Link href="/finance">← Finance</Link>
      <h1>Accounts and ledger</h1>
      <p className="muted">
        Only verified openings and posted money movements affect balances. Corrections preserve the
        original history.
      </p>
      {session === 'checking' && <p>Checking account…</p>}
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
      {session === 'ready' && !readers.has(role) && <p>Your role cannot view account balances.</p>}
      {session === 'ready' && readers.has(role) && (
        <>
          <section className="panel">
            <h2>Accounts</h2>
            {accounts.length === 0 ? (
              <p>No accounts configured.</p>
            ) : (
              <ul>
                {accounts.map((account) => (
                  <li key={account.account_id}>
                    {account.account_name} · {account.account_kind} · {money(account.balance_paise)}
                    {!account.active ? ' · inactive' : ''}
                  </li>
                ))}
              </ul>
            )}
            <label className="field">
              Inspect an account
              <select
                value={selected}
                onChange={async (event) => {
                  const id = event.target.value;
                  setSelected(id);
                  setEffectId('');
                  setBeneficiaryVersions([]);
                  setQrFile(null);
                  setQrPayeeConfirmed(false);
                  setActiveQr(null);
                  setQrLoading(false);
                  qrOperation.current = null;
                  setError('');
                  try {
                    await loadAccount(id);
                  } catch (cause) {
                    setError(cause.message);
                  }
                }}
              >
                <option value="">Choose account</option>
                {accounts.map((account) => (
                  <option key={account.account_id} value={account.account_id}>
                    {account.account_name} ({account.account_kind})
                  </option>
                ))}
              </select>
            </label>
          </section>
          {selected && ['president', 'treasurer'].includes(role) && (
            <section className="panel">
              <h2>Beneficiary history</h2>
              {beneficiaryVersions.length === 0 ? (
                <p>No beneficiary version loaded.</p>
              ) : (
                <ol>
                  {beneficiaryVersions.map((version) => (
                    <li key={version.version_no}>
                      Version {version.version_no}
                      {version.is_current ? ' · current' : ''} ·{' '}
                      {version.upi_id ||
                        (version.bank_last_four
                          ? `Bank ending ${version.bank_last_four} · ${version.ifsc}`
                          : 'Cash')}
                      {' · '}
                      {version.evidence_reference}
                    </li>
                  ))}
                </ol>
              )}
            </section>
          )}
          {selected && ['president', 'treasurer'].includes(role) && (
            <section className="panel">
              <h2>Current payment QR</h2>
              <p className="muted">Review the private image for this account before using it.</p>
              <button type="button" disabled={qrLoading} onClick={viewActiveQr}>
                {qrLoading ? 'Loading QR…' : 'Load active QR'}
              </button>
              {activeQr && (
                <div>
                  <img src={activeQr.url} alt="Current payment QR" width="240" height="240" />
                  <p>File digest: {activeQr.sha256}</p>
                  <p>Version: {activeQr.versionId}</p>
                </div>
              )}
            </section>
          )}
          {role === 'president' &&
            selectedAccount?.active &&
            ['upi', 'bank'].includes(selectedAccount.account_kind) && (
              <form className="panel" onSubmit={correctBeneficiary}>
                <h2>Correct beneficiary before use</h2>
                <p className="muted">
                  Once an opening, payment QR or posting exists, create a replacement account.
                </p>
                {selectedAccount.account_kind === 'upi' ? (
                  <label className="field">
                    New UPI ID
                    <input
                      required
                      value={beneficiaryUpi}
                      onChange={(event) => setBeneficiaryUpi(event.target.value)}
                    />
                  </label>
                ) : (
                  <>
                    <label className="field">
                      New bank account number
                      <input
                        required
                        inputMode="numeric"
                        value={beneficiaryBank}
                        onChange={(event) => setBeneficiaryBank(event.target.value)}
                      />
                    </label>
                    <label className="field">
                      New IFSC
                      <input
                        required
                        value={beneficiaryIfsc}
                        onChange={(event) => setBeneficiaryIfsc(event.target.value)}
                      />
                    </label>
                  </>
                )}
                <label className="field">
                  Evidence reference
                  <input
                    required
                    minLength={3}
                    maxLength={240}
                    value={beneficiaryEvidence}
                    onChange={(event) => setBeneficiaryEvidence(event.target.value)}
                  />
                </label>
                <button className="primary" disabled={busy}>
                  Save correction
                </button>
              </form>
            )}
          {role === 'president' &&
            selectedAccount?.active &&
            ['upi', 'bank'].includes(selectedAccount.account_kind) && (
              <form className="panel" onSubmit={activateQr}>
                <h2>Activate payment QR</h2>
                <p className="muted">
                  Select the QR for {selectedAccount.account_name}. Scan it with a payment app and
                  check its payee against the current beneficiary above before activating. Existing
                  requests keep their earlier QR snapshot.
                </p>
                <label className="field">
                  QR image (PNG or JPEG, up to 5 MB)
                  <input
                    type="file"
                    accept="image/png,image/jpeg"
                    required
                    onChange={(event) => {
                      setQrFile(event.target.files?.[0] ?? null);
                      setQrPayeeConfirmed(false);
                      qrOperation.current = null;
                    }}
                  />
                </label>
                {qrPreview && (
                  <img src={qrPreview} alt="Selected payment QR preview" width="240" height="240" />
                )}
                <label className="field">
                  <input
                    type="checkbox"
                    checked={qrPayeeConfirmed}
                    onChange={(event) => setQrPayeeConfirmed(event.target.checked)}
                    required
                  />
                  I scanned this QR and confirmed its payee matches the selected account.
                </label>
                <button
                  className="primary"
                  disabled={
                    busy ||
                    !qrFile ||
                    !qrPayeeConfirmed ||
                    !beneficiaryVersions.some((v) => v.is_current)
                  }
                >
                  Verify file and activate QR
                </button>
              </form>
            )}
          {role === 'president' && (
            <form className="panel" onSubmit={createAccount}>
              <h2>Create account</h2>
              <label className="field">
                Name
                <input
                  required
                  maxLength={120}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              <label className="field">
                Kind
                <select value={kind} onChange={(e) => setKind(e.target.value)}>
                  <option value="cash">Cash</option>
                  <option value="upi">UPI</option>
                  <option value="bank">Bank</option>
                </select>
              </label>
              {kind === 'upi' && (
                <label className="field">
                  UPI ID
                  <input required value={upi} onChange={(e) => setUpi(e.target.value)} />
                </label>
              )}
              {kind === 'bank' && (
                <>
                  <label className="field">
                    Account number
                    <input required value={bank} onChange={(e) => setBank(e.target.value)} />
                  </label>
                  <label className="field">
                    IFSC
                    <input required value={ifsc} onChange={(e) => setIfsc(e.target.value)} />
                  </label>
                </>
              )}
              <button className="primary" disabled={busy}>
                Create account
              </button>
            </form>
          )}
          {role === 'president' && (
            <section className="panel">
              <h2>Verify pending openings</h2>
              {openings.length === 0 ? (
                <p>No pending openings.</p>
              ) : (
                openings.map((item) => (
                  <article key={item.opening_id}>
                    <p>
                      {item.account_name} · {money(item.amount_paise)} · {item.evidence_reference}
                    </p>
                    <button
                      disabled={busy}
                      onClick={() =>
                        execute(
                          'verify_account_opening',
                          {
                            p_opening_id: item.opening_id,
                          },
                          'Opening verified and posted to the ledger.',
                        )
                      }
                    >
                      Verify opening
                    </button>
                  </article>
                ))
              )}
            </section>
          )}
          {role === 'treasurer' && selected && (
            <form className="panel" onSubmit={submitOpening}>
              <h2>Submit opening balance</h2>
              <label className="field">
                Counted amount (₹)
                <input
                  required
                  inputMode="decimal"
                  value={openingAmount}
                  onChange={(e) => setOpeningAmount(e.target.value)}
                />
              </label>
              <label className="field">
                Evidence reference
                <input
                  required
                  minLength={3}
                  maxLength={240}
                  value={openingProof}
                  onChange={(e) => setOpeningProof(e.target.value)}
                />
              </label>
              <button className="primary" disabled={busy}>
                Submit to President
              </button>
            </form>
          )}
          {role === 'treasurer' && (
            <form className="panel" onSubmit={transfer}>
              <h2>Transfer between accounts</h2>
              <label className="field">
                From
                <select required value={from} onChange={(e) => setFrom(e.target.value)}>
                  <option value="">Choose source</option>
                  {active.map((a) => (
                    <option key={a.account_id} value={a.account_id}>
                      {a.account_name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                To
                <select required value={to} onChange={(e) => setTo(e.target.value)}>
                  <option value="">Choose destination</option>
                  {active
                    .filter((a) => a.account_id !== from)
                    .map((a) => (
                      <option key={a.account_id} value={a.account_id}>
                        {a.account_name}
                      </option>
                    ))}
                </select>
              </label>
              <label className="field">
                Amount (₹)
                <input
                  required
                  inputMode="decimal"
                  value={transferAmount}
                  onChange={(e) => setTransferAmount(e.target.value)}
                />
              </label>
              <label className="field">
                Evidence reference
                <input
                  required
                  minLength={3}
                  maxLength={240}
                  value={transferProof}
                  onChange={(e) => setTransferProof(e.target.value)}
                />
              </label>
              <button className="primary" disabled={busy || !from || !to || from === to}>
                Post transfer
              </button>
            </form>
          )}
          {selected && (
            <section className="panel">
              <h2>Recent ledger effects</h2>
              {history.length === 0 ? (
                <p>No posted effects.</p>
              ) : (
                <ul>
                  {history.map((item) => (
                    <li key={item.effect_id}>
                      {new Date(item.occurred_at).toLocaleString('en-IN', {
                        timeZone: 'Asia/Kolkata',
                      })}
                      {' · '}
                      {item.source_type} · {money(item.amount_paise)}
                    </li>
                  ))}
                </ul>
              )}
              {historyHasMore && (
                <button type="button" disabled={historyLoading} onClick={loadMoreHistory}>
                  {historyLoading ? 'Loading…' : 'Load older ledger entries'}
                </button>
              )}
            </section>
          )}
          {role === 'treasurer' && selected && (
            <form className="panel" onSubmit={correct}>
              <h2>Correct or void a posting</h2>
              <label className="field">
                Eligible ledger effect
                <select value={effectId} onChange={(e) => setEffectId(e.target.value)}>
                  <option value="">Choose an uncorrected posting</option>
                  {correctableEffects.map((item) => (
                    <option value={item.effect_id} key={item.effect_id}>
                      {item.effective_kind} · {money(item.amount_paise)} · {item.effect_id}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                Replacement account (leave blank to void)
                <select
                  value={replacementAccount}
                  onChange={(e) => setReplacementAccount(e.target.value)}
                >
                  <option value="">Void without replacement</option>
                  {active.map((a) => (
                    <option value={a.account_id} key={a.account_id}>
                      {a.account_name}
                    </option>
                  ))}
                </select>
              </label>
              {replacementAccount && (
                <label className="field">
                  Corrected absolute amount (₹)
                  <input
                    required
                    inputMode="decimal"
                    value={replacementAmount}
                    onChange={(e) => setReplacementAmount(e.target.value)}
                  />
                </label>
              )}
              <label className="field">
                Reason
                <input
                  required
                  minLength={3}
                  maxLength={500}
                  value={correctionReason}
                  onChange={(e) => setCorrectionReason(e.target.value)}
                />
              </label>
              <button className="primary" disabled={busy || !effectId}>
                Record correction
              </button>
            </form>
          )}
          {role === 'treasurer' && selected && (
            <form className="panel" onSubmit={reconcile}>
              <h2>Record observed balance</h2>
              <label className="field">
                Observed amount (₹)
                <input
                  required
                  inputMode="decimal"
                  value={observed}
                  onChange={(e) => setObserved(e.target.value)}
                />
              </label>
              <label className="field">
                Evidence reference
                <input
                  required
                  minLength={3}
                  maxLength={240}
                  value={observationProof}
                  onChange={(e) => setObservationProof(e.target.value)}
                />
              </label>
              <label className="field">
                Variance explanation (required if different)
                <textarea
                  maxLength={1000}
                  value={explanation}
                  onChange={(e) => setExplanation(e.target.value)}
                />
              </label>
              <button className="primary" disabled={busy}>
                Record observation
              </button>
            </form>
          )}
          {selected && (
            <section className="panel">
              <h2>Recent observations</h2>
              {observations.length === 0 ? (
                <p>No observations yet.</p>
              ) : (
                <ul>
                  {observations.map((item) => (
                    <li key={item.reconciliation_id}>
                      Observed {money(item.observed_balance_paise)} · Book{' '}
                      {money(item.book_balance_paise)}
                      {' · '}Variance {money(item.variance_paise)}
                      {item.explanation ? ` · ${item.explanation}` : ''}
                    </li>
                  ))}
                </ul>
              )}
              {observationHasMore && (
                <button type="button" disabled={observationLoading} onClick={loadMoreObservations}>
                  {observationLoading ? 'Loading…' : 'Load older observations'}
                </button>
              )}
            </section>
          )}
        </>
      )}
    </main>
  );
}
