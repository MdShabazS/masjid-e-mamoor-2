import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import * as Crypto from 'expo-crypto';
import { DateField, indiaToday } from './Pickers';
import { userMessage } from '../../../packages/api-client/messages.js';

const slots = [
  ['fajr', 'Fajr'],
  ['dhuhr', 'Dhuhr'],
  ['asr', 'Asr'],
  ['maghrib', 'Maghrib'],
  ['isha', 'Isha'],
];

function nextDay(date) {
  return new Date(Date.parse(`${date}T00:00:00Z`) + 86400000).toISOString().slice(0, 10);
}

function validDate(date) {
  const parsed = Date.parse(`${date}T00:00:00Z`);
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    Number.isFinite(parsed) &&
    new Date(parsed).toISOString().slice(0, 10) === date
  );
}

export default function HafizPrayer({ client }) {
  const [date, setDate] = useState(indiaToday);
  const [marks, setMarks] = useState({});
  const [attested, setAttested] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const operations = useRef(new Map());

  const load = useCallback(async () => {
    const { data, error: failure } = await client.rpc('list_hafiz_prayer_marks', {
      p_start: date,
      p_end_exclusive: nextDay(date),
    });
    if (failure) throw failure;
    setMarks(Object.fromEntries((data ?? []).map((row) => [row.prayer_slot, row.mark])));
  }, [client, date]);

  useEffect(() => {
    setMarks({});
    if (validDate(date)) load().catch((cause) => setError(userMessage(cause)));
  }, [date, load]);

  async function record(slot, mark) {
    const key = `${date}:${slot}:${mark}`;
    const operationId = operations.current.get(key) ?? Crypto.randomUUID();
    operations.current.set(key, operationId);
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const { error: failure } = await client.rpc('record_hafiz_prayer', {
        p_date: date,
        p_slot: slot,
        p_mark: mark,
        p_attested_after_prayer: attested,
        p_operation_id: operationId,
      });
      if (failure) throw failure;
      operations.current.delete(key);
      setMarks((current) => ({ ...current, [slot]: mark }));
      setNotice('Prayer mark saved. Earlier values stay in the change history.');
    } catch (cause) {
      setError(userMessage(cause, 'Could not save the prayer mark.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.card}>
      <Text style={styles.heading}>Hafiz prayer register</Text>
      <DateField label="Prayer date" value={date} max={indiaToday()} onChange={setDate} />
      <View style={styles.confirm}>
        <Switch
          value={attested}
          onValueChange={setAttested}
          accessibilityLabel="Confirm the prayer time has passed"
        />
        <Text style={styles.body}>This prayer has taken place and I can attest to it.</Text>
      </View>
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
      {slots.map(([slot, label]) => (
        <View key={slot} style={styles.row}>
          <Text style={styles.slot}>{label}</Text>
          {['present', 'absent'].map((mark) => (
            <Pressable
              key={mark}
              accessibilityRole="radio"
              accessibilityLabel={`${label} ${mark}`}
              accessibilityState={{ selected: marks[slot] === mark, disabled: busy || !attested }}
              disabled={busy || !attested || !validDate(date) || marks[slot] === mark}
              onPress={() => record(slot, mark)}
              style={[
                styles.choice,
                marks[slot] === mark && styles.selected,
                !attested && styles.disabled,
              ]}
            >
              <Text style={styles.body}>{mark === 'present' ? 'Present' : 'Absent'}</Text>
            </Pressable>
          ))}
        </View>
      ))}
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
  confirm: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  body: { color: '#182e2a', flexShrink: 1, lineHeight: 21 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  slot: { flex: 1, color: '#182e2a', fontWeight: '700', fontSize: 15 },
  choice: { padding: 12, borderWidth: 1, borderColor: '#d9e1d9', borderRadius: 10 },
  selected: { backgroundColor: '#e8f3ed', borderColor: '#145b49' },
  disabled: { opacity: 0.55 },
  error: { color: '#a32b28' },
  notice: { color: '#145b49' },
});
