import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import * as Crypto from 'expo-crypto';
import { fetch as expoFetch } from 'expo/fetch';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { formatPaiseINR } from '../../../packages/api-client/index.js';
import { userMessage } from '../../../packages/api-client/messages.js';
import {
  monthReport,
  rangeReport,
  yearReport,
} from '../../../packages/api-client/report-period.js';
import { DateField, MonthField, indiaToday } from './Pickers';

const REQUESTERS = new Set(['president', 'vice_president', 'secretary', 'treasurer']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const LINES_SHOWN = 50;

function apiBase() {
  return process.env.EXPO_PUBLIC_WEB_API_URL.replace(/\/+$/, '');
}

function Button({ label, onPress, disabled = false, selected = false }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled, selected }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.button, selected && styles.selected, disabled && styles.disabled]}
    >
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
}

export default function FinanceReports({ client, role }) {
  const [status, setStatus] = useState('checking');
  const [kind, setKind] = useState('month');
  const [month, setMonth] = useState('');
  const [year, setYear] = useState(Number(indiaToday().slice(0, 4)));
  const [start, setStart] = useState('');
  const [lastDay, setLastDay] = useState('');
  const [runId, setRunId] = useState('');
  const [typedId, setTypedId] = useState('');
  const [balances, setBalances] = useState([]);
  const [lines, setLines] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const operation = useRef(null);

  useEffect(() => {
    let active = true;
    fetch(`${apiBase()}/api/management/report-capabilities`)
      .then((response) => (response.ok ? response.json() : null))
      .then((capabilities) => {
        if (active) setStatus(capabilities?.exportsApproved ? 'ready' : 'disabled');
      })
      .catch(() => {
        if (active) setStatus('unavailable');
      });
    return () => {
      active = false;
    };
  }, []);

  async function load(id) {
    const [nextBalances, nextLines] = await Promise.all([
      client.rpc('list_finance_report_balances', { p_run_id: id }).range(0, 499),
      client.rpc('list_finance_report_lines', { p_run_id: id }).range(0, LINES_SHOWN - 1),
    ]);
    if (nextBalances.error || nextLines.error) throw nextBalances.error || nextLines.error;
    setBalances(nextBalances.data ?? []);
    setLines(nextLines.data ?? []);
    setRunId(id);
  }

  async function run(work) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await work();
    } catch (cause) {
      setError(userMessage(cause, 'The report is unavailable.'));
    } finally {
      setBusy(false);
    }
  }

  function period() {
    if (kind === 'month') {
      if (!month) throw new Error('Confirm the month.');
      return monthReport(month);
    }
    return kind === 'year' ? yearReport(year) : rangeReport(start, lastDay);
  }

  const request = () =>
    run(async () => {
      const args = period();
      const key = JSON.stringify(args);
      if (operation.current?.key !== key) operation.current = { key, id: Crypto.randomUUID() };
      const { data, error: failure } = await client.rpc('request_finance_report', {
        ...args,
        p_operation_id: operation.current.id,
      });
      if (failure) throw failure;
      operation.current = null;
      await load(data);
      setNotice('Report ready. It is a fixed snapshot of verified ledger entries.');
    });

  const open = () =>
    run(async () => {
      if (!UUID.test(typedId.trim())) throw new Error('Enter a valid report ID.');
      await load(typedId.trim());
    });

  const download = (format) =>
    run(async () => {
      const { data } = await client.auth.getSession();
      const token = data?.session?.access_token;
      if (!token) throw new Error('Sign in again before downloading.');
      const response = await expoFetch(
        `${apiBase()}/api/management/report-${format}?runId=${encodeURIComponent(runId)}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (response.status === 202) {
        setNotice('The private file is still being prepared. Try again shortly.');
        return;
      }
      if (!response.ok) throw new Error('The download was denied or is unavailable.');
      const bytes = new Uint8Array(await response.arrayBuffer());
      const digest = await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, bytes);
      const actual = [...new Uint8Array(digest)]
        .map((part) => part.toString(16).padStart(2, '0'))
        .join('');
      if (actual !== response.headers.get('X-Report-SHA256')?.toLowerCase())
        throw new Error('The download failed its integrity check. Try again.');
      const file = new File(Paths.cache, `finance-report-${runId}.${format}`);
      file.create({ overwrite: true });
      try {
        file.write(bytes);
        await Sharing.shareAsync(file.uri, {
          mimeType: format === 'pdf' ? 'application/pdf' : 'text/csv',
        });
        setNotice(`Verified ${format.toUpperCase()} ready. Keep this private finance file secure.`);
      } finally {
        // The share sheet has finished with it, so no private copy stays in the cache.
        file.delete();
      }
    });

  return (
    <View style={styles.card}>
      <Text style={styles.heading}>Private finance reports</Text>
      {status === 'checking' && <Text style={styles.muted}>Checking report access…</Text>}
      {status === 'disabled' && (
        <Text style={styles.muted}>
          Reports are off until the masjid approves their privacy and publication rules.
        </Text>
      )}
      {status === 'unavailable' && (
        <Text style={styles.error}>Could not check report access. Reopen this screen.</Text>
      )}
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
      {status === 'ready' && REQUESTERS.has(role) && (
        <View style={styles.group}>
          <View style={styles.row}>
            {[
              ['month', 'Month'],
              ['year', 'Year'],
              ['range', 'Dates'],
            ].map(([id, label]) => (
              <View key={id} style={styles.fill}>
                <Button label={label} selected={kind === id} onPress={() => setKind(id)} />
              </View>
            ))}
          </View>
          {kind === 'month' && <MonthField label="Month" value={month} onChange={setMonth} />}
          {kind === 'year' && (
            <View style={styles.row}>
              <Button label="‹" onPress={() => setYear(year - 1)} />
              <Text style={[styles.fill, styles.year]}>{year}</Text>
              <Button label="›" onPress={() => setYear(year + 1)} />
            </View>
          )}
          {kind === 'range' && (
            <>
              <DateField label="First day" value={start} onChange={setStart} />
              <DateField label="Last day" value={lastDay} onChange={setLastDay} />
            </>
          )}
          <Button label={busy ? 'Working…' : 'Create report'} disabled={busy} onPress={request} />
        </View>
      )}
      {status === 'ready' && (
        <View style={styles.group}>
          <Text style={styles.label}>Open an existing report by ID</Text>
          <TextInput
            style={styles.input}
            value={typedId}
            onChangeText={setTypedId}
            autoCapitalize="none"
            maxLength={36}
            accessibilityLabel="Report ID"
          />
          <Button label="Open report" disabled={busy || !typedId.trim()} onPress={open} />
        </View>
      )}
      {!!runId && (
        <View style={styles.group}>
          <Text selectable style={styles.muted}>
            Report ID: {runId}
          </Text>
          {balances.map((balance) => (
            <View key={balance.account_id} style={styles.item}>
              <Text style={styles.title}>{balance.account_name}</Text>
              <Text style={styles.muted}>
                Opening {formatPaiseINR(balance.opening_paise)} · Income{' '}
                {formatPaiseINR(balance.income_paise)} · Expense{' '}
                {formatPaiseINR(balance.expense_paise)} · Transfers{' '}
                {formatPaiseINR(balance.transfer_paise)}
              </Text>
              <Text style={styles.money}>Closing {formatPaiseINR(balance.closing_paise)}</Text>
            </View>
          ))}
          {balances.length === 0 && <Text style={styles.muted}>No accounts in this report.</Text>}
          {lines.map((line) => (
            <Text key={line.effect_id} style={styles.muted}>
              {line.occurred_at?.slice(0, 10)} · {line.source_type.replaceAll('_', ' ')} ·{' '}
              {formatPaiseINR(line.amount_paise)}
              {line.description ? ` · ${line.description}` : ''}
            </Text>
          ))}
          {lines.length === LINES_SHOWN && (
            <Text style={styles.muted}>
              Showing the first {LINES_SHOWN} lines. The file has all.
            </Text>
          )}
          <Button label="Share PDF" disabled={busy} onPress={() => download('pdf')} />
          <Button label="Share CSV" disabled={busy} onPress={() => download('csv')} />
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
  heading: { fontSize: 21, fontWeight: '700', color: '#182e2a' },
  title: { fontSize: 16, fontWeight: '700', color: '#182e2a' },
  muted: { color: '#5e6e68', fontSize: 14, lineHeight: 21 },
  money: { color: '#145b49', fontWeight: '700' },
  group: { gap: 10 },
  row: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  fill: { flex: 1 },
  year: { textAlign: 'center', fontSize: 18, fontWeight: '700', color: '#182e2a' },
  item: { borderTopWidth: 1, borderTopColor: '#d9e1d9', paddingTop: 10, gap: 4 },
  label: { color: '#182e2a', fontWeight: '600', fontSize: 14 },
  input: {
    borderWidth: 1,
    borderColor: '#d9e1d9',
    borderRadius: 10,
    padding: 13,
    fontSize: 16,
    color: '#182e2a',
  },
  button: { backgroundColor: '#145b49', padding: 13, borderRadius: 10, alignItems: 'center' },
  selected: { backgroundColor: '#0c3e31' },
  buttonText: { color: '#fff', fontWeight: '700' },
  disabled: { opacity: 0.55 },
  error: { color: '#a32b28' },
  notice: { color: '#145b49' },
});
