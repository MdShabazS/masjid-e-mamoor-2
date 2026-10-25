import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import * as Crypto from 'expo-crypto';
import { formatPaiseINR, parseINRToPaise } from '../../../packages/api-client/index.js';
import {
  appendFinancePage,
  financePageCursor,
} from '../../../packages/api-client/finance-pagination.js';

const readers = new Set(['system_admin', 'president', 'vice_president', 'secretary', 'treasurer']);
const green = '#145b49';
const HISTORY_LIMIT = 25;
const OBSERVATION_LIMIT = 10;

function Button({ label, onPress, disabled = false, selected = false }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled, selected: !!selected }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.button, selected && styles.selected, disabled && styles.disabled]}
    >
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
}

function Field({ label, value, onChangeText, ...props }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        accessibilityLabel={label}
        style={styles.input}
        placeholderTextColor="#5e6e68"
        {...props}
      />
    </View>
  );
}

function openingPaise(value) {
  return ['0', '0.0', '0.00'].includes(value) ? 0 : parseINRToPaise(value);
}

export default function FinanceAccounts({ client, role }) {
  const [accounts, setAccounts] = useState([]);
  const [pending, setPending] = useState([]);
  const [selected, setSelected] = useState('');
  const [history, setHistory] = useState([]);
  const [observations, setObservations] = useState([]);
  const [historyHasMore, setHistoryHasMore] = useState(false);
  const [observationHasMore, setObservationHasMore] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [observationLoading, setObservationLoading] = useState(false);
  const [beneficiaryVersions, setBeneficiaryVersions] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [name, setName] = useState('');
  const [kind, setKind] = useState('cash');
  const [upi, setUpi] = useState('');
  const [bank, setBank] = useState('');
  const [ifsc, setIfsc] = useState('');
  const [beneficiaryUpi, setBeneficiaryUpi] = useState('');
  const [beneficiaryBank, setBeneficiaryBank] = useState('');
  const [beneficiaryIfsc, setBeneficiaryIfsc] = useState('');
  const [beneficiaryEvidence, setBeneficiaryEvidence] = useState('');
  const [openingAmount, setOpeningAmount] = useState('');
  const [openingProof, setOpeningProof] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [transferProof, setTransferProof] = useState('');
  const [observed, setObserved] = useState('');
  const [observationProof, setObservationProof] = useState('');
  const [explanation, setExplanation] = useState('');
  const operationIds = useRef(new Map());
  const accountRequest = useRef(0);

  async function rpc(command, args = {}) {
    const { data, error: failure } = await client.rpc(command, args);
    if (failure) throw new Error(failure.message || 'Finance action unavailable.');
    return data;
  }

  async function refresh() {
    const [items, openings] = await Promise.all([
      rpc('list_finance_accounts'),
      ['president', 'treasurer'].includes(role)
        ? rpc('list_pending_finance_openings')
        : Promise.resolve([]),
    ]);
    setAccounts(items ?? []);
    setPending(openings ?? []);
  }

  async function refreshSelected(accountId) {
    const request = ++accountRequest.current;
    setHistory([]);
    setObservations([]);
    setBeneficiaryVersions([]);
    setHistoryHasMore(false);
    setObservationHasMore(false);
    setHistoryLoading(false);
    setObservationLoading(false);
    if (!accountId) {
      return;
    }
    let effects, records, versions;
    try {
      [effects, records, versions] = await Promise.all([
        rpc('list_finance_account_history', { p_account_id: accountId, p_limit: HISTORY_LIMIT }),
        rpc('list_finance_reconciliations', {
          p_account_id: accountId,
          p_limit: OBSERVATION_LIMIT,
        }),
        ['president', 'treasurer'].includes(role)
          ? rpc('list_account_beneficiary_versions', { p_account_id: accountId })
          : Promise.resolve([]),
      ]);
    } catch (cause) {
      if (request !== accountRequest.current) return;
      throw cause;
    }
    if (request !== accountRequest.current) return;
    setHistory(effects ?? []);
    setObservations(records ?? []);
    setHistoryHasMore((effects?.length ?? 0) === HISTORY_LIMIT);
    setObservationHasMore((records?.length ?? 0) === OBSERVATION_LIMIT);
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
    if (!client || !readers.has(role)) return;
    let active = true;
    Promise.all([
      client.rpc('list_finance_accounts'),
      ['president', 'treasurer'].includes(role)
        ? client.rpc('list_pending_finance_openings')
        : Promise.resolve({ data: [], error: null }),
    ])
      .then(([items, openings]) => {
        if (items.error || openings.error)
          throw new Error(items.error?.message || openings.error?.message);
        if (active) {
          setAccounts(items.data ?? []);
          setPending(openings.data ?? []);
        }
      })
      .catch((cause) => {
        if (active) setError(cause.message);
      });
    return () => {
      active = false;
    };
  }, [client, role]);

  async function execute(command, args, message) {
    setBusy(true);
    setError('');
    setNotice('');
    const key = `${command}:${JSON.stringify(args)}`;
    const operationId = operationIds.current.get(key) ?? Crypto.randomUUID();
    operationIds.current.set(key, operationId);
    try {
      await rpc(command, { ...args, p_operation_id: operationId });
      operationIds.current.delete(key);
      setNotice(message);
      try {
        await refresh();
        if (selected) await refreshSelected(selected);
      } catch {
        setError('Saved, but refreshing finance failed. Reload before retrying.');
      }
      return true;
    } catch (cause) {
      setError(cause.message);
      return false;
    } finally {
      setBusy(false);
    }
  }

  if (!readers.has(role)) return null;
  const activeAccounts = accounts.filter((account) => account.active);
  const selectedAccount = accounts.find((account) => account.account_id === selected);

  return (
    <View style={styles.card}>
      <Text style={styles.heading}>Accounts and ledger</Text>
      <Text style={styles.muted}>
        Only verified openings and posted money movements change balances.
      </Text>
      {!!error && (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      )}
      {!!notice && (
        <Text accessibilityRole="alert" style={styles.notice}>
          {notice}
        </Text>
      )}
      <Button
        label="Refresh accounts"
        onPress={() => refresh().catch((cause) => setError(cause.message))}
        disabled={busy}
      />
      {accounts.length === 0 && <Text style={styles.muted}>No accounts configured.</Text>}
      {accounts.map((account) => (
        <Button
          key={account.account_id}
          label={`${account.account_name} (${account.account_kind}) · ${formatPaiseINR(account.balance_paise)}${account.active ? '' : ' · inactive'}`}
          selected={selected === account.account_id}
          onPress={() => {
            setSelected(account.account_id);
            refreshSelected(account.account_id).catch((cause) => setError(cause.message));
          }}
          disabled={busy}
        />
      ))}

      {role === 'president' && (
        <View style={styles.section}>
          <Text style={styles.subheading}>Create account</Text>
          <Field label="Account name" value={name} onChangeText={setName} maxLength={120} />
          <Text style={styles.label}>Account kind</Text>
          {['cash', 'upi', 'bank'].map((value) => (
            <Button
              key={value}
              label={value.toUpperCase()}
              selected={kind === value}
              onPress={() => setKind(value)}
              disabled={busy}
            />
          ))}
          {kind === 'upi' && (
            <Field label="UPI ID" value={upi} onChangeText={setUpi} autoCapitalize="none" />
          )}
          {kind === 'bank' && (
            <>
              <Field
                label="Bank account number"
                value={bank}
                onChangeText={setBank}
                keyboardType="number-pad"
              />
              <Field label="IFSC" value={ifsc} onChangeText={setIfsc} autoCapitalize="characters" />
            </>
          )}
          <Button
            label="Create account"
            disabled={busy || !name.trim()}
            onPress={async () => {
              if (
                await execute(
                  'create_finance_account',
                  {
                    p_name: name.trim(),
                    p_kind: kind,
                    p_upi_id: kind === 'upi' ? upi.trim() : null,
                    p_bank_account_number: kind === 'bank' ? bank.trim() : null,
                    p_ifsc: kind === 'bank' ? ifsc.trim() : null,
                  },
                  'Account created. Treasurer can submit its opening.',
                )
              ) {
                setName('');
                setUpi('');
                setBank('');
                setIfsc('');
              }
            }}
          />
        </View>
      )}

      {role === 'president' &&
        selectedAccount?.active &&
        ['upi', 'bank'].includes(selectedAccount.account_kind) && (
          <View style={styles.section}>
            <Text style={styles.subheading}>Correct beneficiary before use</Text>
            <Text style={styles.muted}>
              After an opening, payment QR or posting, create a replacement account.
            </Text>
            {selectedAccount.account_kind === 'upi' ? (
              <Field
                label="New UPI ID"
                value={beneficiaryUpi}
                onChangeText={setBeneficiaryUpi}
                autoCapitalize="none"
              />
            ) : (
              <>
                <Field
                  label="New bank account number"
                  value={beneficiaryBank}
                  onChangeText={setBeneficiaryBank}
                  keyboardType="number-pad"
                />
                <Field
                  label="New IFSC"
                  value={beneficiaryIfsc}
                  onChangeText={setBeneficiaryIfsc}
                  autoCapitalize="characters"
                />
              </>
            )}
            <Field
              label="Evidence reference"
              value={beneficiaryEvidence}
              onChangeText={setBeneficiaryEvidence}
              maxLength={240}
            />
            <Button
              label="Save beneficiary correction"
              disabled={
                busy ||
                !beneficiaryEvidence.trim() ||
                (selectedAccount.account_kind === 'upi'
                  ? !beneficiaryUpi.trim()
                  : !beneficiaryBank.trim() || !beneficiaryIfsc.trim())
              }
              onPress={async () => {
                if (
                  await execute(
                    'correct_account_beneficiary',
                    {
                      p_account_id: selected,
                      p_upi_id:
                        selectedAccount.account_kind === 'upi' ? beneficiaryUpi.trim() : null,
                      p_bank_account_number:
                        selectedAccount.account_kind === 'bank' ? beneficiaryBank.trim() : null,
                      p_ifsc:
                        selectedAccount.account_kind === 'bank' ? beneficiaryIfsc.trim() : null,
                      p_evidence_reference: beneficiaryEvidence.trim(),
                    },
                    'Beneficiary corrected; prior version retained.',
                  )
                ) {
                  setBeneficiaryUpi('');
                  setBeneficiaryBank('');
                  setBeneficiaryIfsc('');
                  setBeneficiaryEvidence('');
                }
              }}
            />
          </View>
        )}

      {role === 'president' && (
        <View style={styles.section}>
          <Text style={styles.subheading}>Verify pending openings</Text>
          {pending.length === 0 && <Text style={styles.muted}>No pending openings.</Text>}
          {pending.map((item) => (
            <View key={item.opening_id} style={styles.section}>
              <Text>
                {item.account_name} · {formatPaiseINR(item.amount_paise)}
              </Text>
              <Text style={styles.muted}>{item.evidence_reference}</Text>
              <Button
                label="Verify opening"
                disabled={busy}
                onPress={() =>
                  execute(
                    'verify_account_opening',
                    { p_opening_id: item.opening_id },
                    'Opening verified and posted.',
                  )
                }
              />
            </View>
          ))}
        </View>
      )}

      {role === 'treasurer' && selectedAccount?.active && (
        <View style={styles.section}>
          <Text style={styles.subheading}>Submit opening</Text>
          <Field
            label="Counted amount (₹)"
            value={openingAmount}
            onChangeText={setOpeningAmount}
            keyboardType="decimal-pad"
          />
          <Field
            label="Evidence reference"
            value={openingProof}
            onChangeText={setOpeningProof}
            maxLength={240}
          />
          <Button
            label="Submit for President verification"
            disabled={busy || !openingAmount || !openingProof.trim()}
            onPress={async () => {
              try {
                if (
                  await execute(
                    'submit_account_opening',
                    {
                      p_account_id: selected,
                      p_amount_paise: openingPaise(openingAmount),
                      p_evidence_reference: openingProof.trim(),
                    },
                    'Opening submitted. Balance is unchanged until verification.',
                  )
                ) {
                  setOpeningAmount('');
                  setOpeningProof('');
                }
              } catch (cause) {
                setError(cause.message);
              }
            }}
          />
        </View>
      )}

      {role === 'treasurer' && (
        <View style={styles.section}>
          <Text style={styles.subheading}>Transfer between accounts</Text>
          <Text style={styles.label}>From</Text>
          {activeAccounts.map((account) => (
            <Button
              key={account.account_id}
              label={account.account_name}
              selected={from === account.account_id}
              onPress={() => setFrom(account.account_id)}
              disabled={busy}
            />
          ))}
          <Text style={styles.label}>To</Text>
          {activeAccounts.map((account) => (
            <Button
              key={account.account_id}
              label={account.account_name}
              selected={to === account.account_id}
              onPress={() => setTo(account.account_id)}
              disabled={busy}
            />
          ))}
          <Field
            label="Amount (₹)"
            value={transferAmount}
            onChangeText={setTransferAmount}
            keyboardType="decimal-pad"
          />
          <Field
            label="Proof reference"
            value={transferProof}
            onChangeText={setTransferProof}
            maxLength={240}
          />
          <Button
            label="Post transfer"
            disabled={
              busy || !from || !to || from === to || !transferAmount || !transferProof.trim()
            }
            onPress={async () => {
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
                    'Transfer posted with two balanced ledger effects.',
                  )
                ) {
                  setTransferAmount('');
                  setTransferProof('');
                }
              } catch (cause) {
                setError(cause.message);
              }
            }}
          />
        </View>
      )}

      {role === 'treasurer' && selected && (
        <View style={styles.section}>
          <Text style={styles.subheading}>Record account observation</Text>
          <Field
            label="Observed balance (₹)"
            value={observed}
            onChangeText={setObserved}
            keyboardType="decimal-pad"
          />
          <Field
            label="Evidence reference"
            value={observationProof}
            onChangeText={setObservationProof}
            maxLength={240}
          />
          <Field
            label="Variance explanation, if different"
            value={explanation}
            onChangeText={setExplanation}
            maxLength={1000}
            multiline
          />
          <Button
            label="Record observation"
            disabled={busy || !observed || !observationProof.trim()}
            onPress={async () => {
              try {
                if (
                  await execute(
                    'record_finance_reconciliation',
                    {
                      p_account_id: selected,
                      p_observed_balance_paise: openingPaise(observed),
                      p_evidence_reference: observationProof.trim(),
                      p_explanation: explanation.trim() || null,
                    },
                    'Observation recorded. It did not change the ledger.',
                  )
                ) {
                  setObserved('');
                  setObservationProof('');
                  setExplanation('');
                }
              } catch (cause) {
                setError(cause.message);
              }
            }}
          />
        </View>
      )}

      {!!selected && (
        <View style={styles.section}>
          {['president', 'treasurer'].includes(role) && (
            <>
              <Text style={styles.subheading}>Beneficiary history</Text>
              {beneficiaryVersions.map((version) => (
                <Text key={version.version_no} style={styles.muted}>
                  Version {version.version_no}
                  {version.is_current ? ' · current' : ''} ·{' '}
                  {version.upi_id ||
                    (version.bank_last_four
                      ? `Bank ending ${version.bank_last_four} · ${version.ifsc}`
                      : 'Cash')}
                  {' · '}
                  {version.evidence_reference}
                </Text>
              ))}
            </>
          )}
          <Text style={styles.subheading}>Recent ledger effects</Text>
          {history.length === 0 && <Text style={styles.muted}>No posted effects.</Text>}
          {history.map((effect) => (
            <Text key={effect.effect_id} style={styles.muted}>
              {effect.source_type} · {formatPaiseINR(effect.amount_paise)}
            </Text>
          ))}
          {historyHasMore && (
            <Button
              label={historyLoading ? 'Loading…' : 'Load older ledger entries'}
              disabled={historyLoading}
              onPress={loadMoreHistory}
            />
          )}
          <Text style={styles.subheading}>Recent observations</Text>
          {observations.length === 0 && <Text style={styles.muted}>No observations recorded.</Text>}
          {observations.map((item) => (
            <Text key={item.reconciliation_id} style={styles.muted}>
              Observed {formatPaiseINR(item.observed_balance_paise)} · variance{' '}
              {formatPaiseINR(item.variance_paise)}
            </Text>
          ))}
          {observationHasMore && (
            <Button
              label={observationLoading ? 'Loading…' : 'Load older observations'}
              disabled={observationLoading}
              onPress={loadMoreObservations}
            />
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 20,
    gap: 14,
    borderWidth: 1,
    borderColor: '#d9e1d9',
  },
  section: { borderTopWidth: 1, borderTopColor: '#d9e1d9', paddingTop: 14, gap: 10 },
  heading: { fontSize: 21, fontWeight: '700', color: '#182e2a' },
  subheading: { fontSize: 17, fontWeight: '700', color: '#182e2a' },
  muted: { color: '#5e6e68', fontSize: 14, lineHeight: 21 },
  label: { color: '#182e2a', fontWeight: '600', fontSize: 14 },
  field: { gap: 6 },
  input: {
    borderWidth: 1,
    borderColor: '#d9e1d9',
    borderRadius: 10,
    padding: 13,
    fontSize: 16,
    color: '#182e2a',
  },
  button: { backgroundColor: green, padding: 12, borderRadius: 10, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  selected: { backgroundColor: '#0c3e31' },
  disabled: { opacity: 0.5 },
  error: { color: '#a32b28', backgroundColor: '#fff0ed', padding: 12, borderRadius: 8 },
  notice: { color: green, backgroundColor: '#e8f3ed', padding: 12, borderRadius: 8 },
});
