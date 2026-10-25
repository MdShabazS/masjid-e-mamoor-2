import test from 'node:test';
import assert from 'node:assert/strict';
import { createIdentityService, IdentityError } from './service.js';

function fixture({
  role = 'system_admin',
  gate = { account_active: true, must_change_password: true, credential_version: 2 },
  registrationError = false,
  deleteError = false,
  updateError = false,
  signOutError = false,
} = {}) {
  const calls = [];
  const actor = {
    auth: {
      getUser: async () => ({ data: { user: { id: 'actor-1' } } }),
      setSession: async () => ({ data: {} }),
      updateUser: async () => {
        calls.push('update-password');
        return updateError ? { error: {} } : { data: {} };
      },
    },
    rpc: async (name, args) => {
      calls.push([name, args]);
      if (name === 'current_app_role') return { data: role };
      if (name === 'current_identity_gate') return { data: [gate] };
      if (name === 'admin_register_identity' && registrationError) return { error: {} };
      return { data: null };
    },
  };
  const admin = {
    createUser: async (input) => {
      calls.push(['create', input]);
      return { data: { user: { id: 'new-1' } } };
    },
    deleteUser: async (id) => {
      calls.push(['delete', id]);
      return deleteError ? { error: {} } : { data: {} };
    },
    updateUserById: async (id, payload) => {
      calls.push(['reset-auth', id, payload]);
      return updateError ? { error: {} } : { data: {} };
    },
    signOut: async (token, scope) => {
      calls.push(['sign-out', token, scope]);
      return signOutError ? { error: {} } : { data: {} };
    },
    rpc: async (name, args) => {
      calls.push([name, args]);
      return { data: null };
    },
  };
  const service = createIdentityService({
    authAdmin: admin,
    clientForToken: () => actor,
    publicAuth: () => ({
      signInWithPassword: async (input) => {
        calls.push(['sign-in', input]);
        return { data: { session: { access_token: 'token' } } };
      },
    }),
    generatePassword: () => 'temporary-secret',
  });
  return { service, calls };
}

test('SA creates a normalized named account, temporary credential and DB gate', async () => {
  const { service, calls } = fixture();
  const result = await service.provision({
    actorToken: 'actor-token',
    username: ' Entry.User ',
    role: 'data_entry',
  });
  assert.deepEqual(result, {
    userId: 'new-1',
    username: 'entry.user',
    temporaryPassword: 'temporary-secret',
    mustChangePassword: true,
  });
  assert.equal(calls.find((x) => x[0] === 'create')[1].email, 'entry.user@accounts.masjid.invalid');
  assert.deepEqual(calls.find((x) => x[0] === 'admin_register_identity')[1], {
    p_user_id: 'new-1',
    p_username: 'entry.user',
    p_role: 'data_entry',
  });
});

test('wrong role cannot create Auth user; failed DB registration compensates', async () => {
  const denied = fixture({ role: 'treasurer' });
  await assert.rejects(
    denied.service.provision({ actorToken: 't', username: 'someone', role: 'member' }),
    (e) => e instanceof IdentityError && e.code === 'FORBIDDEN',
  );
  assert.equal(
    denied.calls.some((x) => x[0] === 'create'),
    false,
  );
  const failed = fixture({ registrationError: true });
  await assert.rejects(
    failed.service.provision({ actorToken: 't', username: 'someone', role: 'member' }),
    (e) => e.code === 'OPERATION_CONFLICT',
  );
  assert.deepEqual(failed.calls.at(-1), ['delete', 'new-1']);
  const reconciliation = fixture({ registrationError: true, deleteError: true });
  await assert.rejects(
    reconciliation.service.provision({ actorToken: 't', username: 'someone', role: 'member' }),
    (e) => e.code === 'RECONCILIATION_REQUIRED',
  );
});

test('sign-in maps username privately and requires an active gate', async () => {
  const { service, calls } = fixture();
  const result = await service.signIn({ username: 'Entry.User', password: 'secret' });
  assert.equal(result.mustChangePassword, true);
  assert.deepEqual(calls[0], [
    'sign-in',
    { email: 'entry.user@accounts.masjid.invalid', password: 'secret' },
  ]);
  const inactive = fixture({ gate: { account_active: false } });
  await assert.rejects(
    inactive.service.signIn({ username: 'entry.user', password: 'secret' }),
    (e) => e.code === 'ACCOUNT_INACTIVE',
  );
  await assert.rejects(
    service.signIn({ username: 'bad email', password: 'secret' }),
    (e) => e.code === 'INVALID_CREDENTIALS',
  );
});

test('password gate clears only after Auth success; failed Auth reset leaves gate set', async () => {
  const good = fixture();
  await good.service.changePassword({
    accessToken: 't',
    refreshToken: 'r',
    newPassword: 'new-password-123',
  });
  const updateIndex = good.calls.indexOf('update-password');
  const completeIndex = good.calls.findIndex((x) => x[0] === 'complete_password_change');
  const signOutIndex = good.calls.findIndex((x) => x[0] === 'sign-out');
  assert.ok(signOutIndex > updateIndex && completeIndex > signOutIndex);
  assert.deepEqual(good.calls[signOutIndex], ['sign-out', 't', 'global']);
  assert.equal(good.calls[completeIndex][1].p_expected_version, 2);
  const failed = fixture({ updateError: true });
  await assert.rejects(
    failed.service.changePassword({
      accessToken: 't',
      refreshToken: 'r',
      newPassword: 'new-password-123',
    }),
    (e) => e.code === 'SERVICE_UNAVAILABLE',
  );
  assert.equal(
    failed.calls.some((x) => x[0] === 'complete_password_change'),
    false,
  );
  const revocationFailed = fixture({ signOutError: true });
  await assert.rejects(
    revocationFailed.service.changePassword({
      accessToken: 't',
      refreshToken: 'r',
      newPassword: 'new-password-123',
    }),
    (e) => e.code === 'SERVICE_UNAVAILABLE',
  );
  assert.equal(
    revocationFailed.calls.some((x) => x[0] === 'complete_password_change'),
    false,
  );
  await assert.rejects(
    failed.service.resetPassword({ actorToken: 't', targetId: 'new-1' }),
    (e) => e.code === 'SERVICE_UNAVAILABLE',
  );
  assert.ok(
    failed.calls.findIndex((x) => x[0] === 'admin_require_password_reset') <
      failed.calls.findIndex((x) => x[0] === 'reset-auth'),
  );
});

test('role and active state changes are SA-only commands', async () => {
  const { service, calls } = fixture();
  await service.setAccountState({
    actorToken: 't',
    targetId: 'new-1',
    role: 'member',
    active: false,
  });
  assert.deepEqual(calls.at(-1), [
    'admin_set_account_state',
    {
      p_target_id: 'new-1',
      p_role: 'member',
      p_active: false,
    },
  ]);
});
