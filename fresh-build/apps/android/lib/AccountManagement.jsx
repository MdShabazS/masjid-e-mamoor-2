import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  ROLE_LABELS,
  assignableRoles,
  createAccount,
  resetAccountPassword,
  setAccountStatus,
} from '../../../packages/api-client/identity.js';
import { userMessage } from '../../../packages/api-client/messages.js';

const baseUrl = () => process.env.EXPO_PUBLIC_WEB_API_URL.replace(/\/+$/, '');

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

function RoleChoice({ roles, value, onChange }) {
  return (
    <View style={styles.wrap}>
      {roles.map((role) => (
        <Pressable
          key={role}
          accessibilityRole="radio"
          accessibilityState={{ selected: value === role }}
          onPress={() => onChange(role)}
          style={[styles.chip, value === role && styles.chipOn]}
        >
          <Text style={value === role ? styles.chipTextOn : styles.chipText}>
            {ROLE_LABELS[role]}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

/** President and System Admin: add people, reset passwords, change roles, deactivate. */
export default function AccountManagement({ client, role, actorId }) {
  const [accounts, setAccounts] = useState([]);
  const [username, setUsername] = useState('');
  const [newRole, setNewRole] = useState('member');
  const [openId, setOpenId] = useState(null);
  const [editRole, setEditRole] = useState('');
  const [issued, setIssued] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const roles = assignableRoles(role);

  const load = useCallback(async () => {
    const { data, error: failure } = await client.rpc('list_managed_accounts');
    if (failure) throw failure;
    setAccounts(data ?? []);
  }, [client]);

  useEffect(() => {
    load().catch((cause) => setError(userMessage(cause, 'Could not load accounts.')));
  }, [load]);

  async function act(work, success) {
    // A shown password belongs to one action; never leave it beside a later one.
    setIssued(null);
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await work();
      if (success) setNotice(success);
      await load();
    } catch (cause) {
      setError(userMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.card}>
      <Text style={styles.heading}>People and roles</Text>
      <Text style={styles.muted}>
        {role === 'president'
          ? 'Add and manage everyone except Presidents and the System Admin.'
          : 'As System Admin you can add the President and manage any role.'}
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
      {issued && (
        <View style={styles.issued}>
          <Text style={styles.title}>Give this to {issued.username} privately</Text>
          <Text style={styles.muted}>
            Shown only now. They must change it at first sign-in. Long-press to copy.
          </Text>
          <Text selectable style={styles.secret}>
            {issued.password}
          </Text>
          <Button label="I have given it to them" onPress={() => setIssued(null)} />
        </View>
      )}
      <View style={styles.group}>
        <Text style={styles.title}>Add a person</Text>
        <Text style={styles.label}>Username</Text>
        <TextInput
          accessibilityLabel="Username"
          style={styles.input}
          value={username}
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={32}
          onChangeText={setUsername}
        />
        <Text style={styles.label}>Role</Text>
        <RoleChoice roles={roles} value={newRole} onChange={setNewRole} />
        <Button
          label={busy ? 'Saving…' : 'Add person'}
          disabled={busy || username.trim().length < 3}
          onPress={() =>
            act(async () => {
              const result = await createAccount({
                client,
                baseUrl: baseUrl(),
                username: username.trim().toLowerCase(),
                role: newRole,
              });
              setIssued({ username: result.username, password: result.temporaryPassword });
              setUsername('');
            }, 'Account created.')
          }
        />
      </View>
      <Text style={styles.title}>Everyone with an account</Text>
      {accounts.map((account) => (
        <View key={account.user_id} style={styles.item}>
          <Pressable
            accessibilityRole="button"
            disabled={!account.manageable}
            onPress={() => {
              setOpenId(openId === account.user_id ? null : account.user_id);
              setEditRole(account.role);
            }}
          >
            <Text style={styles.body}>
              {account.username} · {ROLE_LABELS[account.role]}
            </Text>
            <Text style={styles.muted}>
              {account.active ? 'Active' : 'Deactivated'}
              {account.must_change_password ? ' · must set a new password' : ''}
              {account.manageable
                ? ' · tap to manage'
                : account.user_id === actorId
                  ? ' · your account'
                  : ' · managed by the System Admin'}
            </Text>
          </Pressable>
          {openId === account.user_id && account.manageable && (
            <View style={styles.group}>
              <RoleChoice roles={roles} value={editRole} onChange={setEditRole} />
              <Button
                label="Save role"
                disabled={busy || editRole === account.role}
                onPress={() =>
                  act(
                    () =>
                      setAccountStatus({
                        client,
                        baseUrl: baseUrl(),
                        targetId: account.user_id,
                        role: editRole,
                        active: account.active,
                      }),
                    `${account.username} is now ${ROLE_LABELS[editRole]}.`,
                  )
                }
              />
              <Button
                label="Reset password"
                secondary
                disabled={busy || !account.active}
                onPress={() =>
                  act(async () => {
                    const result = await resetAccountPassword({
                      client,
                      baseUrl: baseUrl(),
                      targetId: account.user_id,
                    });
                    setIssued({ username: account.username, password: result.temporaryPassword });
                  }, 'Password reset. Their current sign-in stops working.')
                }
              />
              <Button
                label={account.active ? 'Deactivate' : 'Reactivate'}
                secondary
                disabled={busy}
                onPress={() => {
                  const run = () =>
                    act(
                      () =>
                        setAccountStatus({
                          client,
                          baseUrl: baseUrl(),
                          targetId: account.user_id,
                          role: account.role,
                          active: !account.active,
                        }),
                      account.active
                        ? `${account.username} is deactivated. Their history is kept.`
                        : `${account.username} is active again.`,
                    );
                  if (!account.active) run();
                  else
                    Alert.alert(
                      `Deactivate ${account.username}?`,
                      'They can no longer sign in. Their history is kept.',
                      [
                        { text: 'Keep active', style: 'cancel' },
                        { text: 'Deactivate', style: 'destructive', onPress: run },
                      ],
                    );
                }}
              />
            </View>
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
  heading: { fontSize: 21, fontWeight: '700', color: '#182e2a' },
  title: { fontSize: 16, fontWeight: '700', color: '#182e2a' },
  body: { color: '#182e2a', fontWeight: '600', fontSize: 15 },
  muted: { color: '#5e6e68', fontSize: 14, lineHeight: 21 },
  label: { color: '#182e2a', fontWeight: '600', fontSize: 14 },
  group: { gap: 8 },
  item: { borderTopWidth: 1, borderTopColor: '#d9e1d9', paddingTop: 10, gap: 8 },
  issued: {
    gap: 8,
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#e8f3ed',
    borderWidth: 1,
    borderColor: '#145b49',
  },
  secret: { fontSize: 20, fontWeight: '700', color: '#145b49', letterSpacing: 1 },
  input: {
    borderWidth: 1,
    borderColor: '#d9e1d9',
    borderRadius: 10,
    padding: 13,
    fontSize: 16,
    color: '#182e2a',
  },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#d9e1d9',
    borderRadius: 999,
  },
  chipOn: { backgroundColor: '#e8f3ed', borderColor: '#145b49' },
  chipText: { color: '#182e2a' },
  chipTextOn: { color: '#145b49', fontWeight: '700' },
  button: { backgroundColor: '#145b49', padding: 13, borderRadius: 10, alignItems: 'center' },
  secondary: { backgroundColor: '#e8f3ed' },
  buttonText: { color: '#fff', fontWeight: '700' },
  secondaryText: { color: '#145b49', fontWeight: '700' },
  disabled: { opacity: 0.55 },
  error: { color: '#a32b28' },
  notice: { color: '#145b49' },
});
