import { randomBytes } from 'node:crypto';

const ROLES = new Set([
  'system_admin',
  'president',
  'vice_president',
  'secretary',
  'treasurer',
  'committee_member',
  'member',
  'data_entry',
]);
const USERNAME = /^[a-z][a-z0-9._-]{2,31}$/;

export function normalizeUsername(input) {
  const value = typeof input === 'string' ? input.trim().toLowerCase() : '';
  if (!USERNAME.test(value)) throw new IdentityError('VALIDATION_FAILED');
  return value;
}

export class IdentityError extends Error {
  constructor(code) {
    super(code);
    this.name = 'IdentityError';
    this.code = code;
  }
}

function data(result, code = 'SERVICE_UNAVAILABLE') {
  if (result?.error) throw new IdentityError(code);
  return result?.data;
}

function gate(result) {
  const value = Array.isArray(result) ? result[0] : result;
  if (!value || !value.account_active) throw new IdentityError('ACCOUNT_INACTIVE');
  return value;
}

// This module runs only in a trusted server process. The caller supplies a
// server Auth admin adapter and JWT-bound client factory; never bundle it in
// Android or a browser. Internal email is an implementation detail.
export function createIdentityService({
  authAdmin,
  publicAuth,
  clientForToken,
  internalDomain = 'accounts.masjid.invalid',
  generatePassword = () => randomBytes(24).toString('base64url'),
}) {
  async function requireAdmin(token) {
    const client = clientForToken(token);
    const actor = data(await client.auth.getUser(token), 'AUTH_REQUIRED')?.user;
    if (!actor?.id) throw new IdentityError('AUTH_REQUIRED');
    const role = data(await client.rpc('current_app_role'), 'FORBIDDEN');
    if (role !== 'system_admin') throw new IdentityError('FORBIDDEN');
    return client;
  }

  return {
    async me({ accessToken }) {
      const client = clientForToken(accessToken);
      const user = data(await client.auth.getUser(accessToken), 'AUTH_REQUIRED')?.user;
      if (!user?.id) throw new IdentityError('AUTH_REQUIRED');
      const state = gate(data(await client.rpc('current_identity_gate')));
      const role = state.must_change_password
        ? null
        : data(await client.rpc('current_app_role'), 'FORBIDDEN');
      return { actorId: user.id, role, mustChangePassword: state.must_change_password };
    },

    async provision({ actorToken, username, role }) {
      const normalized = normalizeUsername(username);
      if (!ROLES.has(role)) throw new IdentityError('VALIDATION_FAILED');
      const actor = await requireAdmin(actorToken);
      const temporaryPassword = generatePassword();
      const created = data(
        await authAdmin.createUser({
          email: `${normalized}@${internalDomain}`,
          password: temporaryPassword,
          email_confirm: true,
        }),
      );
      const userId = created?.user?.id;
      if (!userId) throw new IdentityError('SERVICE_UNAVAILABLE');
      try {
        data(
          await actor.rpc('admin_register_identity', {
            p_user_id: userId,
            p_username: normalized,
            p_role: role,
          }),
          'OPERATION_CONFLICT',
        );
      } catch (error) {
        // A compensating delete prevents an orphan Auth credential. If this
        // fails, alert operations and keep login blocked by the missing gate.
        const removed = await authAdmin.deleteUser(userId);
        if (removed?.error) throw new IdentityError('RECONCILIATION_REQUIRED');
        throw error;
      }
      return { userId, username: normalized, temporaryPassword, mustChangePassword: true };
    },

    async signIn({ username, password }) {
      // Public route needs its own IP/account rate limiter. Keep failure shape
      // identical for unknown usernames and wrong passwords.
      let normalized;
      try {
        normalized = normalizeUsername(username);
      } catch {
        throw new IdentityError('INVALID_CREDENTIALS');
      }
      const result = await publicAuth().signInWithPassword({
        email: `${normalized}@${internalDomain}`,
        password,
      });
      if (result?.error || !result?.data?.session) throw new IdentityError('INVALID_CREDENTIALS');
      const session = result.data.session;
      const client = clientForToken(session.access_token);
      const state = gate(data(await client.rpc('current_identity_gate')));
      return {
        session,
        mustChangePassword: state.must_change_password,
        credentialVersion: state.credential_version,
      };
    },

    async changePassword({ accessToken, refreshToken, newPassword }) {
      if (typeof newPassword !== 'string' || newPassword.length < 12 || newPassword.length > 128)
        throw new IdentityError('VALIDATION_FAILED');
      const client = clientForToken(accessToken);
      const user = data(await client.auth.getUser(accessToken), 'AUTH_REQUIRED')?.user;
      if (!user?.id) throw new IdentityError('AUTH_REQUIRED');
      const state = gate(data(await client.rpc('current_identity_gate')));
      if (!state.must_change_password) throw new IdentityError('OPERATION_CONFLICT');
      data(
        await client.auth.setSession({ access_token: accessToken, refresh_token: refreshToken }),
        'AUTH_REQUIRED',
      );
      data(await client.auth.updateUser({ password: newPassword }));
      // Revoke the temporary session before clearing the gate. Otherwise its
      // still-valid access JWT can gain normal access when the gate clears.
      data(await authAdmin.signOut(accessToken, 'global'));
      // A failed completion remains gated. The server can retry completion
      // with the same verified actor and version; it never trusts a UID body.
      data(
        await authAdmin.rpc('complete_password_change', {
          p_user_id: user.id,
          p_expected_version: state.credential_version,
        }),
        'OPERATION_CONFLICT',
      );
      return { changed: true };
    },

    async resetPassword({ actorToken, targetId }) {
      const actor = await requireAdmin(actorToken);
      data(await actor.rpc('admin_require_password_reset', { p_target_id: targetId }), 'FORBIDDEN');
      const temporaryPassword = generatePassword();
      data(await authAdmin.updateUserById(targetId, { password: temporaryPassword }));
      return { temporaryPassword, mustChangePassword: true };
    },

    async setAccountState({ actorToken, targetId, role, active }) {
      if (!ROLES.has(role) || typeof active !== 'boolean')
        throw new IdentityError('VALIDATION_FAILED');
      const actor = await requireAdmin(actorToken);
      data(
        await actor.rpc('admin_set_account_state', {
          p_target_id: targetId,
          p_role: role,
          p_active: active,
        }),
        'FORBIDDEN',
      );
      return { targetId, role, active };
    },
  };
}
