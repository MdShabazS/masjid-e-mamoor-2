'use client';
import Link from 'next/link';
import { useState } from 'react';
import {
  ROLE_LABELS,
  assignableRoles,
  createAccount,
  resetAccountPassword,
  setAccountStatus,
} from '../../../../packages/api-client/identity.js';
import { userMessage } from '../../../../packages/api-client/messages.js';
import { getBrowserClient } from '../../lib/supabase.js';
import { rpc, useManagementPage } from '../../lib/management.js';

const MANAGERS = new Set(['system_admin', 'president']);

/** Shown once: the person must change it at first sign-in, and the app cannot show it again. */
function TemporaryPassword({ issued, onDone }) {
  const [copied, setCopied] = useState(false);
  return (
    <section className="panel" role="status">
      <h2>Give this to {issued.username} privately</h2>
      <p className="muted">
        This temporary password is shown only now. {issued.username} must change it at first
        sign-in. Share it in person or by phone, never in a group chat.
      </p>
      <p>
        Username: <strong>{issued.username}</strong>
      </p>
      <p>
        Temporary password: <code className="secret">{issued.password}</code>
      </p>
      <p className="button-row">
        <button
          onClick={() =>
            navigator.clipboard
              ?.writeText(issued.password)
              .then(() => setCopied(true))
              .catch(() => setCopied(false))
          }
        >
          {copied ? 'Copied' : 'Copy password'}
        </button>
        <button className="primary" onClick={onDone}>
          I have given it to them
        </button>
      </p>
    </section>
  );
}

export default function AccountsPage() {
  const [accounts, setAccounts] = useState([]);
  const [username, setUsername] = useState('');
  const [newRole, setNewRole] = useState('member');
  const [roleEdits, setRoleEdits] = useState({});
  const [issued, setIssued] = useState(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const page = useManagementPage(async (role) => {
    if (MANAGERS.has(role)) setAccounts((await rpc('list_managed_accounts')) ?? []);
  });
  const roles = assignableRoles(page.role);

  async function act(work, success) {
    // A shown password belongs to one action; never leave it beside a later one.
    setIssued(null);
    setBusy(true);
    page.setError('');
    setNotice('');
    try {
      await work();
      if (success) setNotice(success);
      await page.reload();
    } catch (cause) {
      page.setError(userMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="management">
      <Link href="/contributors">← Management</Link>
      <h1>People and roles</h1>
      {page.session === 'checking' && <p>Checking your account…</p>}
      {page.session === 'signed-out' && (
        <p>
          <Link href="/login">Sign in</Link> to continue.
        </p>
      )}
      {page.error && (
        <p role="alert" className="notice error">
          {page.error}
        </p>
      )}
      {notice && (
        <p role="status" className="notice">
          {notice}
        </p>
      )}
      {page.session === 'ready' && !MANAGERS.has(page.role) && (
        <p>Only the President and the System Admin manage accounts.</p>
      )}
      {issued && <TemporaryPassword issued={issued} onDone={() => setIssued(null)} />}
      {page.session === 'ready' && MANAGERS.has(page.role) && (
        <>
          <form
            className="panel"
            onSubmit={(event) => {
              event.preventDefault();
              const name = username.trim().toLowerCase();
              act(async () => {
                const result = await createAccount({
                  client: getBrowserClient(),
                  username: name,
                  role: newRole,
                });
                setIssued({ username: result.username, password: result.temporaryPassword });
                setUsername('');
              }, 'Account created.');
            }}
          >
            <h2>Add a person</h2>
            <p className="muted">
              {page.role === 'president'
                ? 'You can add every role except President and System Admin.'
                : 'As System Admin you can add any role, including the President.'}
            </p>
            <label className="field">
              Username (3–32 letters, numbers, dot, dash or underscore; starts with a letter)
              <input
                required
                pattern="[a-zA-Z][a-zA-Z0-9._\-]{2,31}"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </label>
            <label className="field">
              Role
              <select value={newRole} onChange={(e) => setNewRole(e.target.value)}>
                {roles.map((role) => (
                  <option key={role} value={role}>
                    {ROLE_LABELS[role]}
                  </option>
                ))}
              </select>
            </label>
            <button className="primary" disabled={busy}>
              Add person
            </button>
          </form>
          <section className="panel">
            <h2>Everyone with an account</h2>
            <ul className="roster">
              {accounts.map((account) => {
                const edit = roleEdits[account.user_id] ?? account.role;
                return (
                  <li key={account.user_id}>
                    <span>
                      <strong>{account.username}</strong> · {ROLE_LABELS[account.role]}
                      <br />
                      <small>
                        {account.active ? 'Active' : 'Deactivated'}
                        {account.must_change_password ? ' · must set a new password' : ''}
                      </small>
                    </span>
                    {account.manageable ? (
                      <span className="button-row">
                        <select
                          aria-label={`Role for ${account.username}`}
                          value={edit}
                          onChange={(e) =>
                            setRoleEdits({ ...roleEdits, [account.user_id]: e.target.value })
                          }
                        >
                          {roles.map((role) => (
                            <option key={role} value={role}>
                              {ROLE_LABELS[role]}
                            </option>
                          ))}
                        </select>
                        <button
                          disabled={busy || edit === account.role}
                          onClick={() =>
                            act(
                              () =>
                                setAccountStatus({
                                  client: getBrowserClient(),
                                  targetId: account.user_id,
                                  role: edit,
                                  active: account.active,
                                }),
                              `${account.username} is now ${ROLE_LABELS[edit]}.`,
                            )
                          }
                        >
                          Save role
                        </button>
                        <button
                          disabled={busy || !account.active}
                          onClick={() =>
                            act(async () => {
                              const result = await resetAccountPassword({
                                client: getBrowserClient(),
                                targetId: account.user_id,
                              });
                              setIssued({
                                username: account.username,
                                password: result.temporaryPassword,
                              });
                            }, 'Password reset. Their current sign-in stops working until they set a new password.')
                          }
                        >
                          Reset password
                        </button>
                        <button
                          disabled={busy}
                          onClick={() =>
                            (account.active
                              ? window.confirm(
                                  `Deactivate ${account.username}? They can no longer sign in. Their history is kept.`,
                                )
                              : true) &&
                            act(
                              () =>
                                setAccountStatus({
                                  client: getBrowserClient(),
                                  targetId: account.user_id,
                                  role: account.role,
                                  active: !account.active,
                                }),
                              account.active
                                ? `${account.username} is deactivated. Their history is kept.`
                                : `${account.username} is active again.`,
                            )
                          }
                        >
                          {account.active ? 'Deactivate' : 'Reactivate'}
                        </button>
                      </span>
                    ) : (
                      <small>
                        {account.user_id === page.userId
                          ? 'Your account'
                          : 'Managed by the System Admin'}
                      </small>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        </>
      )}
    </main>
  );
}
