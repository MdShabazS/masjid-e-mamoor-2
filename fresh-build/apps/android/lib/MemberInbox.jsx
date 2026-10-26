import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export default function MemberInbox({ client }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');

  async function reload() {
    const { data, error: rpcError } = await client.rpc('list_my_member_inbox', { p_limit: 25 });
    if (rpcError) throw new Error(rpcError.message || 'Could not load notifications.');
    setItems(data ?? []);
  }

  useEffect(() => {
    let active = true;
    client
      .rpc('list_my_member_inbox', { p_limit: 25 })
      .then(({ data, error: rpcError }) => {
        if (!active) return;
        if (rpcError) setError(rpcError.message || 'Could not load notifications.');
        else setItems(data ?? []);
        setLoading(false);
      })
      .catch((cause) => {
        if (active) {
          setError(cause.message || 'Could not load notifications.');
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

  async function markRead(id) {
    setBusyId(id);
    setError('');
    try {
      const { data, error: rpcError } = await client.rpc('mark_my_member_notification_read', {
        p_id: id,
      });
      if (rpcError || !data) throw new Error(rpcError?.message || 'Notification unavailable.');
      try {
        await reload();
      } catch {
        setItems((current) =>
          current.map((item) =>
            item.notification_id === id ? { ...item, read_at: new Date().toISOString() } : item,
          ),
        );
        setError('Marked read, but the list could not refresh.');
      }
    } catch (cause) {
      setError(cause.message || 'Could not mark notification read.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <View style={styles.card}>
      <Text style={styles.heading}>Notifications</Text>
      <Text style={styles.muted}>
        Announcements remain here even when device alerts are unavailable.
      </Text>
      <Pressable
        accessibilityRole="button"
        disabled={loading || busyId !== null}
        onPress={refresh}
        style={[styles.button, (loading || busyId !== null) && styles.disabled]}
      >
        <Text style={styles.buttonText}>Refresh notifications</Text>
      </Pressable>
      {loading && <Text style={styles.muted}>Loading notifications…</Text>}
      {!!error && (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      )}
      {!loading && items.length === 0 && <Text style={styles.muted}>No notifications yet.</Text>}
      {items.map((item) => (
        <View key={item.notification_id} style={styles.item}>
          <Text style={styles.title}>{item.title}</Text>
          <Text style={styles.muted}>
            {new Intl.DateTimeFormat('en-IN', {
              dateStyle: 'medium',
              timeStyle: 'short',
              timeZone: 'Asia/Kolkata',
            }).format(new Date(item.created_at))}
          </Text>
          <Text style={styles.muted}>{item.read_at ? 'Read' : 'Unread'}</Text>
          {!item.read_at && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Mark ${item.title} as read`}
              disabled={busyId !== null}
              onPress={() => markRead(item.notification_id)}
              style={[styles.button, busyId !== null && styles.disabled]}
            >
              <Text style={styles.buttonText}>Mark read</Text>
            </Pressable>
          )}
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
  title: { color: '#182e2a', fontSize: 16, fontWeight: '600' },
  muted: { color: '#5e6e68', fontSize: 14, lineHeight: 21 },
  item: { borderTopWidth: 1, borderColor: '#d9e1d9', paddingTop: 10, gap: 7 },
  button: { backgroundColor: '#145b49', padding: 12, borderRadius: 10, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: '700' },
  disabled: { opacity: 0.55 },
  error: { color: '#a32b28' },
});
