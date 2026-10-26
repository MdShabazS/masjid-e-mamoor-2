import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import * as Crypto from 'expo-crypto';

export default function MeetingInvites({ client }) {
  const [meetings, setMeetings] = useState([]);
  const [reasons, setReasons] = useState({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const operations = useRef(new Map());

  async function reload() {
    const { data, error: rpcError } = await client.rpc('list_visible_committee_meetings');
    if (rpcError) throw new Error(rpcError.message || 'Could not load meetings.');
    setMeetings(data ?? []);
  }

  useEffect(() => {
    let active = true;
    client
      .rpc('list_visible_committee_meetings')
      .then(({ data, error: rpcError }) => {
        if (!active) return;
        if (rpcError) setError(rpcError.message || 'Could not load meetings.');
        else setMeetings(data ?? []);
        setLoading(false);
      })
      .catch((cause) => {
        if (active) {
          setError(cause.message || 'Could not load meetings.');
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [client]);

  async function refresh() {
    setLoading(true);
    setError('');
    try {
      await reload();
    } catch (cause) {
      setError(cause.message);
    } finally {
      setLoading(false);
    }
  }

  async function respond(meetingId, response) {
    const reason = response === 'decline' ? reasons[meetingId]?.trim() || null : null;
    const key = `${meetingId}:${response}:${reason ?? ''}`;
    const operationId = operations.current.get(key) ?? Crypto.randomUUID();
    operations.current.set(key, operationId);
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const { error: rpcError } = await client.rpc('respond_committee_meeting', {
        p_meeting_id: meetingId,
        p_response: response,
        p_reason: reason,
        p_operation_id: operationId,
      });
      if (rpcError) throw new Error(rpcError.message || 'Could not save response.');
      operations.current.delete(key);
    } catch (cause) {
      setError(cause.message || 'Could not save response. Retry the same response.');
      setBusy(false);
      return;
    }
    try {
      await reload();
      setNotice(response === 'accept' ? 'Invitation accepted.' : 'Invitation declined.');
    } catch {
      setMeetings((current) =>
        current.map((meeting) =>
          meeting.meeting_id === meetingId
            ? { ...meeting, my_rsvp: response === 'accept' ? 'accepted' : 'declined' }
            : meeting,
        ),
      );
      setError('Response saved, but the meeting list could not refresh.');
    }
    setBusy(false);
  }

  return (
    <View style={styles.card}>
      <Text style={styles.heading}>Committee meetings</Text>
      <Pressable
        accessibilityRole="button"
        disabled={busy || loading}
        onPress={refresh}
        style={[styles.button, (busy || loading) && styles.disabled]}
      >
        <Text style={styles.buttonText}>Refresh meetings</Text>
      </Pressable>
      {loading && <Text style={styles.muted}>Loading meetings…</Text>}
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
      {!loading && meetings.length === 0 && <Text style={styles.muted}>No meetings to show.</Text>}
      {meetings.map((meeting) => {
        const canRespond =
          meeting.status === 'active' &&
          meeting.my_rsvp === 'invited' &&
          new Date(meeting.starts_at).getTime() > Date.now();
        return (
          <View key={meeting.meeting_id} style={styles.meeting}>
            <Text style={styles.title}>{meeting.title}</Text>
            <Text style={styles.muted}>{meeting.description}</Text>
            <Text style={styles.muted}>
              {new Intl.DateTimeFormat('en-IN', {
                dateStyle: 'medium',
                timeStyle: 'short',
                timeZone: 'Asia/Kolkata',
              }).format(new Date(meeting.starts_at))}{' '}
              · {meeting.status}
              {meeting.location_label ? ` · ${meeting.location_label}` : ''}
            </Text>
            <Text style={styles.muted}>My response: {meeting.my_rsvp ?? 'Organizer'}</Text>
            {canRespond && (
              <View style={styles.group}>
                <Pressable
                  accessibilityRole="button"
                  disabled={busy}
                  onPress={() => respond(meeting.meeting_id, 'accept')}
                  style={[styles.button, busy && styles.disabled]}
                >
                  <Text style={styles.buttonText}>Accept invitation</Text>
                </Pressable>
                <Text style={styles.label}>Decline reason (optional)</Text>
                <TextInput
                  style={styles.input}
                  maxLength={500}
                  value={reasons[meeting.meeting_id] ?? ''}
                  onChangeText={(value) =>
                    setReasons((current) => ({ ...current, [meeting.meeting_id]: value }))
                  }
                />
                <Pressable
                  accessibilityRole="button"
                  disabled={busy}
                  onPress={() => respond(meeting.meeting_id, 'decline')}
                  style={[styles.button, styles.secondary, busy && styles.disabled]}
                >
                  <Text style={styles.secondaryText}>Decline invitation</Text>
                </Pressable>
              </View>
            )}
          </View>
        );
      })}
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
  meeting: { borderTopWidth: 1, borderColor: '#d9e1d9', paddingTop: 12, gap: 8 },
  title: { color: '#182e2a', fontSize: 17, fontWeight: '700' },
  muted: { color: '#5e6e68', fontSize: 14, lineHeight: 21 },
  group: { gap: 8 },
  label: { color: '#182e2a', fontWeight: '600' },
  input: {
    borderWidth: 1,
    borderColor: '#d9e1d9',
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    color: '#182e2a',
  },
  button: { backgroundColor: '#145b49', padding: 13, borderRadius: 10, alignItems: 'center' },
  secondary: { backgroundColor: '#e8f3ed' },
  buttonText: { color: '#fff', fontWeight: '700' },
  secondaryText: { color: '#145b49', fontWeight: '700' },
  disabled: { opacity: 0.55 },
  error: { color: '#a32b28' },
  notice: { color: '#145b49' },
});
