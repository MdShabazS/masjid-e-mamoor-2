import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AppState, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { createDraftQueue } from '../../../packages/offline-drafts/index.js';

const fields = {
  donation: [
    ['name', 'Donor name'],
    ['date', 'Donation date (YYYY-MM-DD)'],
    ['amountINR', 'Claimed amount (₹)'],
    ['evidence', 'Evidence reference'],
  ],
  expense: [
    ['title', 'Expense title'],
    ['description', 'Description'],
    ['category', 'Category'],
    ['amountINR', 'Requested amount (₹)'],
    ['bill', 'Bill reference (or give reason below)'],
    ['missingReason', 'Reason bill is unavailable'],
  ],
  task: [
    ['title', 'Task title'],
    ['description', 'Description'],
    ['date', 'Scheduled date (YYYY-MM-DD)'],
    ['location', 'Location'],
    ['total', 'Total places'],
    ['invited', 'Invited places'],
    ['volunteer', 'Volunteer places'],
  ],
};
const initial = {
  donation: { kind: 'other', method: 'cash' },
  expense: {},
  task: { mode: 'open', total: '1', invited: '0', volunteer: '1' },
};

export default function OfflineDrafts({ client, actorId, role }) {
  const [kind, setKind] = useState('donation');
  const [form, setForm] = useState(initial.donation);
  const [drafts, setDrafts] = useState([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const queue = useMemo(
    () =>
      actorId
        ? createDraftQueue({ store: SecureStore, actorId, uuid: Crypto.randomUUID, client })
        : null,
    [actorId, client],
  );
  const allowed =
    kind === 'donation'
      ? [
          'president',
          'vice_president',
          'secretary',
          'treasurer',
          'committee_member',
          'data_entry',
        ].includes(role)
      : kind === 'expense'
        ? [
            'president',
            'vice_president',
            'secretary',
            'treasurer',
            'committee_member',
            'member',
          ].includes(role)
        : ['president', 'vice_president', 'secretary'].includes(role);
  const reload = useCallback(async () => {
    if (queue) setDrafts(await queue.list());
  }, [queue]);
  const sync = useCallback(async () => {
    if (!queue) return;
    try {
      const result = await queue.sync();
      await reload();
      if (result.state !== 'busy')
        setMessage(
          result.state === 'session_required'
            ? 'Sign in again to sync this account’s drafts.'
            : result.state === 'offline'
              ? 'Connection unavailable. Drafts remain on this device.'
              : `${result.sent} submitted · ${result.pending} pending · ${result.conflict} conflicts · ${result.rejected} rejected`,
        );
    } catch {
      setMessage('Sync unavailable. Drafts remain on this device.');
    }
  }, [queue, reload]);
  useEffect(() => {
    reload().catch(() => setMessage('Could not unlock saved drafts on this device.'));
    // Foreground return also covers restored connectivity. The button supports
    // a reconnect while the app remains open; failed sends retain the same ID.
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') sync();
    });
    const interval = setInterval(() => {
      if (AppState.currentState === 'active') sync();
    }, 60000);
    return () => {
      subscription.remove();
      clearInterval(interval);
    };
  }, [reload, sync]);
  if (!queue) return null;
  async function save() {
    setBusy(true);
    setMessage('');
    try {
      const payload =
        kind === 'task'
          ? {
              ...form,
              total: Number(form.total),
              invited: Number(form.invited),
              volunteer: Number(form.volunteer),
            }
          : form;
      await queue.add(kind, payload);
      await reload();
      setForm(initial[kind]);
      setMessage('Saved securely on this device. Sync when online.');
    } catch (error) {
      setMessage(
        error.message === 'invalid_draft_store'
          ? 'Secure storage unavailable.'
          : 'Check every required field and try again.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <View style={styles.card}>
      <Text style={styles.heading}>Offline submission drafts</Text>
      <Text style={styles.note}>
        Only initial submissions are saved. A pending draft is not an approved expense, posted
        donation or issued receipt.
      </Text>
      <View style={styles.row}>
        {Object.keys(fields).map((next) => (
          <Pressable
            key={next}
            accessibilityRole="button"
            accessibilityState={{ selected: kind === next }}
            onPress={() => {
              setKind(next);
              setForm(initial[next]);
            }}
            style={[styles.tab, kind === next && styles.active]}
          >
            <Text>{next}</Text>
          </Pressable>
        ))}
      </View>
      {allowed && (
        <>
          {fields[kind].map(([key, label]) => (
            <View key={key}>
              <Text style={styles.label}>{label}</Text>
              <TextInput
                style={styles.input}
                value={form[key] ?? ''}
                onChangeText={(value) => setForm((current) => ({ ...current, [key]: value }))}
              />
            </View>
          ))}
          {kind === 'donation' && (
            <View style={styles.row}>
              {['cash', 'upi', 'bank'].map((method) => (
                <Pressable
                  key={method}
                  onPress={() => setForm((current) => ({ ...current, method }))}
                  style={[styles.tab, form.method === method && styles.active]}
                >
                  <Text>{method}</Text>
                </Pressable>
              ))}
            </View>
          )}
          {kind === 'task' && (
            <View style={styles.row}>
              {['open', 'direct', 'mixed'].map((mode) => (
                <Pressable
                  key={mode}
                  onPress={() => setForm((current) => ({ ...current, mode }))}
                  style={[styles.tab, form.mode === mode && styles.active]}
                >
                  <Text>{mode}</Text>
                </Pressable>
              ))}
            </View>
          )}
          <Pressable style={styles.action} disabled={busy} onPress={save}>
            <Text style={styles.actionText}>Save draft</Text>
          </Pressable>
        </>
      )}
      {!allowed && (
        <Text style={styles.note}>This role cannot create this type of submission.</Text>
      )}
      <Pressable style={styles.action} onPress={sync}>
        <Text style={styles.actionText}>Sync pending drafts</Text>
      </Pressable>
      {!!message && (
        <Text accessibilityRole="alert" style={styles.note}>
          {message}
        </Text>
      )}
      {drafts.map((draft) => (
        <View style={styles.draft} key={draft.id}>
          <Text>
            {draft.kind} · {draft.state}
          </Text>
          <Text style={styles.note}>
            {draft.payload.title ?? draft.payload.name} · {draft.createdAt.slice(0, 10)}
          </Text>
          {draft.state !== 'pending' && (
            <Pressable
              accessibilityRole="button"
              onPress={async () => {
                try {
                  await queue.remove(draft.id);
                  setMessage('Reviewed draft removed from this device.');
                } catch {
                  setMessage(
                    'Draft removal was interrupted. Check the saved list before retrying.',
                  );
                }
                await reload().catch(() =>
                  setMessage('Could not unlock saved drafts on this device.'),
                );
              }}
            >
              <Text style={styles.remove}>Remove reviewed draft</Text>
            </Pressable>
          )}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: 'white', padding: 20, borderRadius: 18, gap: 12 },
  heading: { fontSize: 20, fontWeight: '700', color: '#182e2a' },
  note: { fontSize: 13, lineHeight: 19, color: '#5e6e68' },
  row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  tab: { borderWidth: 1, borderColor: '#d9e1d9', borderRadius: 8, padding: 10 },
  active: { backgroundColor: '#e8f3ed', borderColor: '#145b49' },
  label: { fontSize: 14, color: '#182e2a', marginBottom: 4 },
  input: { borderWidth: 1, borderColor: '#d9e1d9', borderRadius: 8, padding: 10, color: '#182e2a' },
  action: { backgroundColor: '#145b49', borderRadius: 8, padding: 12, alignItems: 'center' },
  actionText: { color: 'white', fontWeight: '700' },
  draft: { borderTopWidth: 1, borderColor: '#d9e1d9', paddingTop: 10 },
  remove: { color: '#a32b28', marginTop: 8 },
});
