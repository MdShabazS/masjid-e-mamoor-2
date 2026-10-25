'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { getBrowserClient } from '../../lib/supabase.js';

export default function InboxPage() {
  const [state, setState] = useState('loading');
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(null);

  const reload = useCallback(async () => {
    const client = getBrowserClient();
    const { data: identity, error: authError } = await client.auth.getUser();
    if (authError || !identity.user) {
      setState('signed-out');
      return;
    }
    const { data, error: readError } = await client.rpc('list_my_member_inbox', { p_limit: 25 });
    if (readError) throw readError;
    setItems(data ?? []);
    setState('ready');
  }, []);

  useEffect(() => {
    let active = true;
    reload().catch((cause) => {
      if (active) {
        setError(cause.message || 'Unable to load notifications.');
        setState('error');
      }
    });
    return () => {
      active = false;
    };
  }, [reload]);

  async function markRead(id) {
    setBusy(id);
    setError('');
    try {
      const { data, error: rpcError } = await getBrowserClient().rpc(
        'mark_my_member_notification_read',
        { p_id: id },
      );
      if (rpcError || !data) throw rpcError || new Error('Notification is unavailable.');
      await reload();
    } catch (cause) {
      setError(cause.message || 'Could not mark as read.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="management">
      <Link href="/">← Masjid E Mamoor 2</Link>
      <h1>Notifications</h1>
      <p className="muted">
        Your in-app announcements stay here even if device alerts are unavailable.
      </p>
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      {state === 'loading' && <p role="status">Loading notifications…</p>}
      {state === 'signed-out' && (
        <p className="panel">
          Please <Link href="/login">sign in</Link> to view notifications.
        </p>
      )}
      {state === 'ready' && (
        <section className="panel" aria-label="Your notifications">
          <button type="button" onClick={() => reload().catch((cause) => setError(cause.message))}>
            Refresh
          </button>
          {items.length === 0 ? (
            <p>No notifications yet.</p>
          ) : (
            <ul className="roster">
              {items.map((item) => (
                <li key={item.notification_id}>
                  <span>
                    <strong>{item.title}</strong>
                    <br />
                    <small>
                      {new Intl.DateTimeFormat('en-IN', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                        timeZone: 'Asia/Kolkata',
                      }).format(new Date(item.created_at))}
                    </small>
                  </span>
                  {item.read_at ? (
                    <span className="muted">Read</span>
                  ) : (
                    <button
                      type="button"
                      disabled={busy === item.notification_id}
                      onClick={() => markRead(item.notification_id)}
                    >
                      Mark read
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </main>
  );
}
