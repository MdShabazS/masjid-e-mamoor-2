'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getBrowserClient } from '../../lib/supabase.js';
import { signInUsername, changeInitialPassword } from '../../../../packages/api-client/identity.js';

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let active = true;
    async function restoreGate() {
      try {
        const client = getBrowserClient();
        const { data: identity, error: authError } = await client.auth.getUser();
        if (authError || !identity?.user) return;
        const { data: rows, error: gateError } = await client.rpc('current_identity_gate');
        const gate = Array.isArray(rows) ? rows[0] : rows;
        if (gateError || !gate?.account_active) {
          await client.auth.signOut();
          return;
        }
        if (!active) return;
        if (gate.must_change_password) setMustChangePassword(true);
        else router.replace('/contributors');
      } catch {
        // The sign-in form remains available if a saved session cannot be read.
      } finally {
        if (active) setReady(true);
      }
    }
    restoreGate();
    return () => {
      active = false;
    };
  }, [router]);
  async function signIn(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const form = new FormData(event.currentTarget);
      const result = await signInUsername({
        client: getBrowserClient(),
        username: String(form.get('username')),
        password: String(form.get('password')),
      });
      if (result.mustChangePassword) setMustChangePassword(true);
      else router.replace('/contributors');
    } catch (cause) {
      setError(cause.message || 'Unable to sign in.');
    } finally {
      setBusy(false);
    }
  }
  async function changePassword(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await changeInitialPassword({
        client: getBrowserClient(),
        newPassword: String(new FormData(event.currentTarget).get('newPassword')),
      });
      setMustChangePassword(false);
      setNotice('Password changed. Sign in with your new password.');
    } catch (cause) {
      setError(cause.message || 'Unable to change password.');
    } finally {
      setBusy(false);
    }
  }
  async function leaveTemporarySession() {
    setBusy(true);
    setError('');
    try {
      const { error: signOutError } = await getBrowserClient().auth.signOut();
      if (signOutError) throw signOutError;
      setMustChangePassword(false);
      setNotice('Signed out. Use your assigned username to sign in.');
    } catch (cause) {
      setError(cause.message || 'Unable to sign out.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="management">
      <Link href="/">← Masjid E Mamoor 2</Link>
      <h1>{mustChangePassword ? 'Change temporary password' : 'Management sign in'}</h1>
      <p className="muted">Use your assigned username and password.</p>
      <form
        key={mustChangePassword ? 'change-password' : 'sign-in'}
        className="panel"
        method="post"
        onSubmit={mustChangePassword ? changePassword : signIn}
        style={{ maxWidth: 460 }}
      >
        {!mustChangePassword && (
          <label className="field">
            Username
            <input name="username" autoComplete="username" required />
          </label>
        )}
        {mustChangePassword ? (
          <label className="field">
            New password
            <input
              name="newPassword"
              type="password"
              autoComplete="new-password"
              minLength={12}
              maxLength={128}
              required
            />
          </label>
        ) : (
          <label className="field">
            Password
            <input name="password" type="password" autoComplete="current-password" required />
          </label>
        )}
        {error && (
          <p className="notice error" role="alert">
            {error}
          </p>
        )}
        {notice && (
          <p className="notice" role="status">
            {notice}
          </p>
        )}
        <button className="primary" disabled={busy || !ready}>
          {!ready
            ? 'Loading…'
            : busy
              ? 'Please wait…'
              : mustChangePassword
                ? 'Change password'
                : 'Sign in'}
        </button>
        {mustChangePassword && (
          <button type="button" disabled={busy} onClick={leaveTemporarySession}>
            Sign out
          </button>
        )}
      </form>
    </main>
  );
}
