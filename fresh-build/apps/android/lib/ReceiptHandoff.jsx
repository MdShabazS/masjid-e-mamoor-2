import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import * as Crypto from 'expo-crypto';
import { prepareManualReceiptHandoff } from '../../../packages/api-client/receipt-handoff.js';

const channels = [
  ['in_person', 'In person'],
  ['email', 'Email sent outside this app'],
  ['other_manual', 'Other approved manual channel'],
];
const outcomes = [
  ['delivered', 'Delivered'],
  ['failed', 'Failed'],
  ['uncertain', 'Uncertain'],
];

function Field({ label, value, onChangeText, maxLength }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        maxLength={maxLength}
        autoCapitalize="none"
        style={styles.input}
      />
    </View>
  );
}

function Choices({ label, options, value, onChange }) {
  return (
    <View style={styles.field} accessibilityRole="radiogroup">
      <Text style={styles.label}>{label}</Text>
      {options.map(([key, title]) => (
        <Pressable
          key={key}
          accessibilityRole="radio"
          accessibilityState={{ selected: value === key }}
          onPress={() => onChange(key)}
          style={[styles.choice, value === key && styles.selected]}
        >
          <Text style={styles.body}>{title}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export default function ReceiptHandoff({ client }) {
  const [enabled, setEnabled] = useState(false);
  const [status, setStatus] = useState('checking');
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
    client
      .rpc('manual_receipt_handoff_enabled')
      .then(({ data, error: failure }) => {
        if (!active) return;
        if (failure) {
          setStatus('unavailable');
          return;
        }
        setEnabled(data === true);
        setStatus('ready');
      })
      .catch(() => {
        if (active) setStatus('unavailable');
      });
    return () => {
      active = false;
    };
  }, [client]);

  async function record() {
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
    if (operation.current?.key !== key) operation.current = { key, id: Crypto.randomUUID() };
    setBusy(true);
    try {
      const { error: failure } = await client.rpc('record_manual_receipt_handoff', {
        ...args,
        p_operation_id: operation.current.id,
      });
      if (failure) throw failure;
      operation.current = null;
      setReceiptCode('');
      setRecipientReference('');
      setEvidenceReference('');
      setConfirmed(false);
      setNotice('Manual handoff outcome recorded. This app did not send a message.');
    } catch (cause) {
      setError(cause.message || 'Handoff could not be recorded. Check the receipt status.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.card}>
      <Text style={styles.heading}>Manual receipt handoff</Text>
      <Text style={styles.muted}>
        Record the outcome after sharing an approved copy of an already issued receipt. This app
        does not generate a receipt or send email or WhatsApp.
      </Text>
      {status === 'checking' && <Text style={styles.muted}>Checking approval…</Text>}
      {status === 'unavailable' && (
        <Text style={styles.error}>
          Approval could not be checked. Reopen this screen before recording.
        </Text>
      )}
      {status === 'ready' && !enabled && (
        <Text style={styles.muted}>
          Receipt handoff is disabled until the Board approves the receipt and delivery policy.
        </Text>
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
      {status === 'ready' && enabled && (
        <>
          <Field
            label="Issued receipt code"
            value={receiptCode}
            onChangeText={setReceiptCode}
            maxLength={64}
          />
          <Field
            label="Recipient reference"
            value={recipientReference}
            onChangeText={setRecipientReference}
            maxLength={120}
          />
          <Choices
            label="Manual channel"
            options={channels}
            value={channel}
            onChange={setChannel}
          />
          <Choices label="Actual outcome" options={outcomes} value={result} onChange={setResult} />
          <Field
            label="Evidence reference"
            value={evidenceReference}
            onChangeText={setEvidenceReference}
            maxLength={240}
          />
          <View style={styles.confirm}>
            <Switch
              value={confirmed}
              onValueChange={setConfirmed}
              accessibilityLabel="Checked handoff against approved receipt and delivery evidence"
            />
            <Text style={styles.body}>
              I checked this outcome against the approved receipt and delivery evidence.
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            disabled={busy || !confirmed}
            onPress={record}
            style={[styles.button, (busy || !confirmed) && styles.disabled]}
          >
            <Text style={styles.buttonText}>{busy ? 'Recording…' : 'Record manual handoff'}</Text>
          </Pressable>
        </>
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
  heading: { color: '#182e2a', fontSize: 21, fontWeight: '700' },
  muted: { color: '#5e6e68', fontSize: 14, lineHeight: 21 },
  field: { gap: 6 },
  label: { color: '#182e2a', fontWeight: '600', fontSize: 14 },
  input: {
    borderWidth: 1,
    borderColor: '#d9e1d9',
    borderRadius: 10,
    padding: 13,
    fontSize: 16,
    color: '#182e2a',
  },
  choice: { padding: 12, borderWidth: 1, borderColor: '#d9e1d9', borderRadius: 10 },
  selected: { backgroundColor: '#e8f3ed', borderColor: '#145b49' },
  body: { color: '#182e2a', flex: 1, lineHeight: 21 },
  confirm: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  button: { backgroundColor: '#145b49', padding: 15, borderRadius: 10, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  disabled: { opacity: 0.55 },
  error: { color: '#a32b28' },
  notice: { color: '#145b49' },
});
