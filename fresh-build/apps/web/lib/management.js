'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { userMessage } from '../../../packages/api-client/messages.js';
import { getBrowserClient } from './supabase.js';

export async function rpc(name, args = {}) {
  const { data, error } = await getBrowserClient().rpc(name, args);
  if (error) throw error;
  return data;
}

export function indiaToday() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
}

/** Signed-in state plus role for a management page; `load` runs after sign-in and on reload. */
export function useManagementPage(load) {
  const [session, setSession] = useState('checking');
  const [role, setRole] = useState(null);
  const [userId, setUserId] = useState(null);
  const [error, setError] = useState('');
  const loadRef = useRef(load);
  loadRef.current = load;

  const reload = useCallback(async () => {
    const nextRole = await rpc('current_app_role');
    setRole(nextRole);
    await loadRef.current?.(nextRole);
  }, []);

  useEffect(() => {
    let active = true;
    getBrowserClient()
      .auth.getUser()
      .then(async ({ data, error: authError }) => {
        if (!active) return;
        if (authError || !data?.user) {
          setSession('signed-out');
          return;
        }
        setUserId(data.user.id);
        try {
          await reload();
          if (active) setSession('ready');
        } catch (cause) {
          if (active) {
            setError(userMessage(cause));
            setSession('ready');
          }
        }
      })
      .catch(() => {
        if (active) setSession('signed-out');
      });
    return () => {
      active = false;
    };
  }, [reload]);

  return { session, role, userId, error, setError, reload };
}

/** Runs a command with a stable retry ID for identical input, then refreshes the page data. */
export function useCommand(reload, setError) {
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const operations = useRef(new Map());
  const run = useCallback(
    async (name, args, success) => {
      setBusy(true);
      setError('');
      setNotice('');
      const key = `${name}:${JSON.stringify(args)}`;
      const operationId = operations.current.get(key) ?? crypto.randomUUID();
      operations.current.set(key, operationId);
      try {
        await rpc(name, { ...args, p_operation_id: operationId });
        operations.current.delete(key);
      } catch (cause) {
        setError(userMessage(cause));
        setBusy(false);
        return false;
      }
      setNotice(success);
      try {
        await reload();
      } catch {
        setError('Saved, but the page could not refresh. Reload before another action.');
      }
      setBusy(false);
      return true;
    },
    [reload, setError],
  );
  return { busy, notice, run, setNotice };
}

export function Messages({ error, notice }) {
  return (
    <>
      {error && (
        <p role="alert" className="notice error">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="notice">
          {notice}
        </p>
      )}
    </>
  );
}

/** Active members by username; replaces typing an account ID. */
export function MemberSelect({
  label,
  value = undefined,
  onChange = undefined,
  excludeSelf = false,
  emptyLabel = 'Choose',
  name = undefined,
}) {
  const [members, setMembers] = useState(null);
  useEffect(() => {
    rpc('list_active_members')
      .then((rows) => setMembers(rows ?? []))
      .catch(() => setMembers([]));
  }, []);
  return (
    <label className="field">
      {label}
      {/* Without `value` it is an uncontrolled form field read through `name`. */}
      <select
        name={name}
        {...(value === undefined
          ? { defaultValue: '' }
          : { value, onChange: (event) => onChange(event.target.value) })}
      >
        <option value="">{members ? emptyLabel : 'Loading members…'}</option>
        {(members ?? [])
          .filter((member) => !(excludeSelf && member.is_self))
          .map((member) => (
            <option key={member.member_id} value={member.member_id}>
              {member.username} · {member.role.replaceAll('_', ' ')}
            </option>
          ))}
      </select>
    </label>
  );
}
