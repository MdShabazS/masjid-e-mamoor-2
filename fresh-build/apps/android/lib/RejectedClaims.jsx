import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { createManagementApi } from '../../../packages/api-client/index.js';

export default function RejectedClaims({ client, revision, onResubmitted }) {
  const [claims, setClaims] = useState([]);
  const [offset, setOffset] = useState(0);
  const [more, setMore] = useState(false);
  const [status, setStatus] = useState('checking');
  const [selectedId, setSelectedId] = useState(null);
  const [transactionId, setTransactionId] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setStatus('checking');
    createManagementApi(client)
      .listRejectedMonthlyClaims()
      .then((rows) => {
        if (!active) return;
        setClaims(rows ?? []);
        setOffset(rows?.length ?? 0);
        setMore((rows?.length ?? 0) === 50);
        setStatus('ready');
      })
      .catch(() => {
        if (active) setStatus('unavailable');
      });
    return () => {
      active = false;
    };
  }, [client, revision]);

  async function loadMore() {
    setBusy(true);
    setError('');
    try {
      const rows = await createManagementApi(client).listRejectedMonthlyClaims({
        offset,
      });
      setOffset((current) => current + rows.length);
      setClaims((current) => {
        const known = new Set(current.map((claim) => claim.rejected_claim_id));
        return [...current, ...rows.filter((claim) => !known.has(claim.rejected_claim_id))];
      });
      setMore(rows.length === 50);
    } catch (cause) {
      setError(cause.message || 'Could not load older rejected claims.');
    } finally {
      setBusy(false);
    }
  }

  async function resubmit() {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const api = createManagementApi(client);
      await api.resubmitRejectedMonthlyClaim({ claimId: selectedId, transactionId });
      setClaims((current) => current.filter((claim) => claim.rejected_claim_id !== selectedId));
      setSelectedId(null);
      setTransactionId('');
      try {
        const rows = await api.listRejectedMonthlyClaims();
        setClaims(rows ?? []);
        setOffset(rows?.length ?? 0);
        setMore((rows?.length ?? 0) === 50);
        await onResubmitted();
        setNotice('Linked replacement submitted for Treasurer review. No money was posted.');
      } catch {
        setMore(false);
        setNotice('Replacement submitted. Reopen the claim lists before another action.');
      }
    } catch (cause) {
      setError(cause.message || 'Could not resubmit rejected claim.');
    } finally {
      setBusy(false);
    }
  }

  const selected = claims.find((claim) => claim.rejected_claim_id === selectedId);
  return (
    <View style={styles.card}>
      <Text style={styles.heading}>Rejected claims needing a new reference</Text>
      <Text style={styles.muted}>
        You can replace claims you submitted. The Treasurer can replace any rejected claim. A
        replacement goes back to review and does not post money.
      </Text>
      {status === 'checking' && <Text style={styles.muted}>Loading rejected claims…</Text>}
      {status === 'unavailable' && (
        <Text style={styles.error}>Could not load rejected claims. Reopen this screen.</Text>
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
      {status === 'ready' && claims.length === 0 && (
        <Text style={styles.muted}>No rejected claims need replacement.</Text>
      )}
      {status === 'ready' &&
        claims.map((claim) => (
          <Pressable
            key={claim.rejected_claim_id}
            accessibilityRole="radio"
            accessibilityState={{ selected: selectedId === claim.rejected_claim_id }}
            onPress={() => {
              setSelectedId(claim.rejected_claim_id);
              setTransactionId('');
            }}
            style={[styles.choice, selectedId === claim.rejected_claim_id && styles.selected]}
          >
            <Text style={styles.name}>
              {claim.donor_name} · {claim.period_date}
            </Text>
            <Text style={styles.muted}>Original: {claim.original_reference}</Text>
            <Text style={styles.muted}>Reason: {claim.rejection_reason}</Text>
          </Pressable>
        ))}
      {status === 'ready' && selected && (
        <View style={styles.field}>
          <Text style={styles.label}>Corrected transaction reference</Text>
          <TextInput
            value={transactionId}
            onChangeText={setTransactionId}
            maxLength={200}
            autoCapitalize="none"
            style={styles.input}
          />
          <Pressable
            accessibilityRole="button"
            disabled={busy || transactionId.trim().length < 3}
            onPress={resubmit}
            style={[styles.button, (busy || transactionId.trim().length < 3) && styles.disabled]}
          >
            <Text style={styles.buttonText}>
              {busy ? 'Submitting…' : 'Submit linked replacement'}
            </Text>
          </Pressable>
        </View>
      )}
      {status === 'ready' && more && (
        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={loadMore}
          style={styles.button}
        >
          <Text style={styles.buttonText}>Load older rejected claims</Text>
        </Pressable>
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
  error: { color: '#a32b28' },
  notice: { color: '#145b49' },
  choice: { padding: 12, gap: 3, borderWidth: 1, borderColor: '#d9e1d9', borderRadius: 10 },
  selected: { backgroundColor: '#e8f3ed', borderColor: '#145b49' },
  name: { color: '#182e2a', fontWeight: '700', fontSize: 15 },
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
  button: { backgroundColor: '#145b49', padding: 15, borderRadius: 10, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  disabled: { opacity: 0.55 },
});
