import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import * as Crypto from 'expo-crypto';
import * as Location from 'expo-location';
import { locationArgs, parseSiteCoordinates } from '../../../packages/api-client/attendance.js';
import { userMessage } from '../../../packages/api-client/messages.js';
import { indiaToday } from './Pickers';

/** A fresh foreground reading, never a cached one. Stored only as distance and accuracy. */
async function currentFix() {
  const { granted, canAskAgain } = await Location.requestForegroundPermissionsAsync();
  if (!granted)
    throw new Error(
      canAskAgain
        ? 'Allow location access to check in at the masjid.'
        : 'Location is off for this app. Turn it on in Android settings to check in.',
    );
  if (!(await Location.hasServicesEnabledAsync()))
    throw new Error('Turn on your phone’s location, then try again.');
  return locationArgs(await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }));
}

function Button({ label, onPress, disabled = false, secondary = false }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.button, secondary && styles.secondary, disabled && styles.disabled]}
    >
      <Text style={secondary ? styles.secondaryText : styles.buttonText}>{label}</Text>
    </Pressable>
  );
}

const outcomeLabels = { attended: 'Attended', declined: 'Declined', absent: 'Absent' };

function Roster({
  client,
  meeting,
  finalized,
  canMark,
  busy,
  command = undefined,
  refreshKey = undefined,
}) {
  const [rows, setRows] = useState(null);
  const [selected, setSelected] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const { data, error: failure } = await client.rpc('list_committee_meeting_roster', {
      p_meeting_id: meeting.meeting_id,
    });
    if (failure) setError(userMessage(failure, 'Could not load the roster.'));
    else setRows(data ?? []);
  }, [client, meeting.meeting_id]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  async function mark() {
    const saved = await command(
      async () => ({
        name: 'mark_committee_attendance',
        args: {
          p_meeting_id: meeting.meeting_id,
          p_member_id: selected,
          ...(await currentFix()),
          p_reason: reason.trim(),
        },
        key: `mark:${meeting.meeting_id}:${selected}:${reason.trim()}`,
      }),
      'Marked present from your location at the masjid.',
    );
    if (saved) {
      setSelected('');
      setReason('');
    }
  }

  if (error)
    return (
      <Text accessibilityRole="alert" style={styles.error}>
        {error}
      </Text>
    );
  if (!rows) return <Text style={styles.muted}>Loading roster…</Text>;
  return (
    <View style={styles.group}>
      <Text style={styles.label}>Attendance roster</Text>
      {rows.length === 0 && <Text style={styles.muted}>Nobody has been invited.</Text>}
      {rows.map((row) => {
        const markable = canMark && !row.attendance_source && row.invite_status !== 'declined';
        return (
          <Pressable
            key={row.member_id}
            accessibilityRole={markable ? 'radio' : 'text'}
            accessibilityState={{ selected: selected === row.member_id }}
            disabled={!markable}
            onPress={() => setSelected(row.member_id)}
            style={[styles.row, selected === row.member_id && styles.selected]}
          >
            <Text style={styles.body}>{row.username}</Text>
            <Text style={styles.muted}>
              {row.outcome
                ? outcomeLabels[row.outcome]
                : row.attendance_source === 'gps'
                  ? 'Checked in by location'
                  : row.attendance_source === 'organizer'
                    ? 'Marked by organizer'
                    : row.invite_status === 'declined'
                      ? 'Declined'
                      : 'Not checked in'}
            </Text>
          </Pressable>
        );
      })}
      {canMark && !finalized && !!selected && (
        <View style={styles.group}>
          <Text style={styles.label}>Why can’t their phone check in? (3–500 characters)</Text>
          <TextInput
            accessibilityLabel="Reason for marking present"
            style={styles.input}
            value={reason}
            maxLength={500}
            onChangeText={setReason}
          />
          <Button
            label="Mark present (you must be at the masjid)"
            disabled={busy || reason.trim().length < 3}
            onPress={mark}
          />
        </View>
      )}
    </View>
  );
}

function FinalizeButton({ busy, onConfirm, disabled = false }) {
  return (
    <Button
      label="Finalize attendance"
      disabled={busy || disabled}
      onPress={() =>
        Alert.alert(
          'Finalize this meeting?',
          'Everyone invited who did not attend or decline becomes absent. This cannot be changed.',
          [
            { text: 'Go back', style: 'cancel' },
            { text: 'Finalize', style: 'destructive', onPress: onConfirm },
          ],
        )
      }
    />
  );
}

/** Check-in and organizer controls for one meeting. `command` is the screen's retrying runner. */
export default function MeetingAttendance({ client, meeting, mine, busy, command, refreshKey }) {
  const [rosterOpen, setRosterOpen] = useState(false);
  const today = indiaToday();
  if (meeting.status !== 'active' || !mine) return null;
  const isToday = meeting.meeting_date === today;
  const dayOver = meeting.meeting_date < today;
  const canCheckIn =
    isToday && !mine.attendance_source && ['invited', 'accepted'].includes(meeting.my_rsvp);

  return (
    <View style={styles.group}>
      {!!mine.outcome && (
        <Text style={styles.label}>Final attendance: {outcomeLabels[mine.outcome]}</Text>
      )}
      {!mine.outcome && !!mine.attendance_source && (
        <Text style={styles.notice}>You are marked present for this meeting.</Text>
      )}
      {canCheckIn && (
        <Button
          label={busy ? 'Checking location…' : 'Check in at the masjid'}
          disabled={busy}
          onPress={() =>
            command(
              async () => ({
                name: 'check_in_committee_meeting',
                args: { p_meeting_id: meeting.meeting_id, ...(await currentFix()) },
                key: `check-in:${meeting.meeting_id}`,
              }),
              'You are checked in.',
            )
          }
        />
      )}
      {mine.is_creator && (
        <>
          <Button
            label={rosterOpen ? 'Hide roster' : 'View attendance roster'}
            secondary
            onPress={() => setRosterOpen(!rosterOpen)}
          />
          {rosterOpen && (
            <Roster
              client={client}
              meeting={meeting}
              finalized={mine.finalized}
              canMark={isToday}
              busy={busy}
              command={command}
              refreshKey={refreshKey}
            />
          )}
          {dayOver && !mine.finalized && (
            <FinalizeButton
              busy={busy}
              onConfirm={() =>
                command(
                  async () => ({
                    name: 'finalize_committee_meeting',
                    args: { p_meeting_id: meeting.meeting_id, p_reason: null },
                    key: `finalize:${meeting.meeting_id}`,
                  }),
                  'Attendance finalized.',
                )
              }
            />
          )}
          {mine.finalized && <Text style={styles.muted}>Attendance is finalized.</Text>}
        </>
      )}
    </View>
  );
}

/** Data entry employee: finalize meetings an organizer left open. Never creates presence. */
export function FinalizationFallback({ client }) {
  const [meetings, setMeetings] = useState([]);
  const [reasons, setReasons] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const operations = useRef(new Map());

  const load = useCallback(async () => {
    const { data, error: failure } = await client.rpc('list_meetings_pending_finalization');
    if (failure) throw failure;
    setMeetings(data ?? []);
  }, [client]);

  useEffect(() => {
    load().catch((cause) => setError(userMessage(cause, 'Could not load open meetings.')));
  }, [load]);

  async function finalize(item) {
    const reason = reasons[item.meeting_id].trim();
    const key = `${item.meeting_id}:${reason}`;
    const operationId = operations.current.get(key) ?? Crypto.randomUUID();
    operations.current.set(key, operationId);
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const { error: failure } = await client.rpc('finalize_committee_meeting', {
        p_meeting_id: item.meeting_id,
        p_reason: reason,
        p_operation_id: operationId,
      });
      if (failure) throw failure;
      operations.current.delete(key);
      setNotice('Attendance finalized with your recorded reason.');
      await load();
    } catch (cause) {
      setError(userMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.card}>
      <Text style={styles.heading}>Meetings waiting to be finalized</Text>
      <Text style={styles.muted}>
        Use this only when the organizer has not finalized. You cannot mark anyone present.
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
      {meetings.length === 0 && <Text style={styles.muted}>No meetings are waiting.</Text>}
      {meetings.map((item) => (
        <View key={item.meeting_id} style={styles.group}>
          <Text style={styles.label}>
            {item.title} · {item.meeting_date} · organizer {item.organizer}
          </Text>
          <Roster client={client} meeting={item} finalized canMark={false} busy={busy} />
          <TextInput
            accessibilityLabel={`Reason for finalizing ${item.title}`}
            placeholder="Why the organizer could not finalize"
            placeholderTextColor="#5e6e68"
            style={styles.input}
            value={reasons[item.meeting_id] ?? ''}
            maxLength={500}
            onChangeText={(value) =>
              setReasons((current) => ({ ...current, [item.meeting_id]: value }))
            }
          />
          <FinalizeButton
            busy={busy}
            disabled={(reasons[item.meeting_id]?.trim().length ?? 0) < 3}
            onConfirm={() => finalize(item)}
          />
        </View>
      ))}
    </View>
  );
}

/** System Admin: the single verified center that check-in measures against. */
export function MasjidSiteSetting({ client }) {
  const [site, setSite] = useState(null);
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [evidence, setEvidence] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const operation = useRef(null);

  const load = useCallback(async () => {
    const { data, error: failure } = await client.rpc('get_masjid_site');
    if (failure) throw failure;
    setSite(data?.[0] ?? null);
  }, [client]);

  useEffect(() => {
    load().catch((cause) => setError(userMessage(cause, 'Could not load the masjid location.')));
  }, [load]);

  async function save() {
    setError('');
    setNotice('');
    setBusy(true);
    try {
      const args = {
        ...parseSiteCoordinates(latitude, longitude),
        p_evidence: evidence.trim(),
      };
      const key = JSON.stringify(args);
      if (operation.current?.key !== key) operation.current = { key, id: Crypto.randomUUID() };
      const { error: failure } = await client.rpc('set_masjid_site', {
        ...args,
        p_operation_id: operation.current.id,
      });
      if (failure) throw failure;
      operation.current = null;
      setLatitude('');
      setLongitude('');
      setEvidence('');
      setConfirmed(false);
      setNotice('Masjid location saved. Check-in now measures from this point.');
      await load();
    } catch (cause) {
      setError(userMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.card}>
      <Text style={styles.heading}>Masjid location for check-in</Text>
      <Text style={styles.muted}>
        {site
          ? `Current: ${site.latitude}, ${site.longitude} · ${site.radius_m} m · ${site.evidence_reference}`
          : 'Not set. Nobody can check in by location until this is set.'}
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
      <Text style={styles.label}>Latitude</Text>
      <TextInput
        accessibilityLabel="Latitude"
        style={styles.input}
        value={latitude}
        keyboardType="numbers-and-punctuation"
        onChangeText={setLatitude}
      />
      <Text style={styles.label}>Longitude</Text>
      <TextInput
        accessibilityLabel="Longitude"
        style={styles.input}
        value={longitude}
        keyboardType="numbers-and-punctuation"
        onChangeText={setLongitude}
      />
      <Text style={styles.label}>How this point was verified</Text>
      <TextInput
        accessibilityLabel="How this point was verified"
        style={styles.input}
        value={evidence}
        maxLength={240}
        onChangeText={setEvidence}
      />
      <View style={styles.confirm}>
        <Switch
          value={confirmed}
          onValueChange={setConfirmed}
          accessibilityLabel="Confirm the point was checked at the masjid"
        />
        <Text style={styles.body}>I checked this exact point at the masjid.</Text>
      </View>
      <Button
        label={busy ? 'Saving…' : 'Save masjid location'}
        disabled={busy || !confirmed || evidence.trim().length < 3}
        onPress={save}
      />
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
  group: { gap: 8 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#d9e1d9',
    borderRadius: 10,
  },
  selected: { backgroundColor: '#e8f3ed', borderColor: '#145b49' },
  label: { color: '#182e2a', fontWeight: '600' },
  body: { color: '#182e2a', flexShrink: 1 },
  muted: { color: '#5e6e68', fontSize: 14, lineHeight: 21, flexShrink: 1 },
  input: {
    borderWidth: 1,
    borderColor: '#d9e1d9',
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    color: '#182e2a',
  },
  confirm: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  button: { backgroundColor: '#145b49', padding: 13, borderRadius: 10, alignItems: 'center' },
  secondary: { backgroundColor: '#e8f3ed' },
  buttonText: { color: '#fff', fontWeight: '700' },
  secondaryText: { color: '#145b49', fontWeight: '700' },
  disabled: { opacity: 0.55 },
  error: { color: '#a32b28' },
  notice: { color: '#145b49' },
});
