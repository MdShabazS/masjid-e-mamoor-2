import assert from 'node:assert/strict';
import test from 'node:test';
import { signInUsername, changeInitialPassword } from './identity.js';

test('username login installs server session and exposes password gate', async () => {
  let installed;
  const client = {
    auth: {
      setSession: async (value) => {
        installed = value;
        return { error: null };
      },
    },
  };
  const result = await signInUsername({
    client,
    username: 'treasurer',
    password: 'password',
    fetchImpl: async (_url, init) => {
      assert.deepEqual(JSON.parse(init.body), { username: 'treasurer', password: 'password' });
      return {
        ok: true,
        json: async () => ({
          data: {
            session: { access_token: 'access', refresh_token: 'refresh' },
            mustChangePassword: true,
          },
        }),
      };
    },
  });
  assert.equal(result.mustChangePassword, true);
  assert.deepEqual(installed, { access_token: 'access', refresh_token: 'refresh' });
});

test('password change uses actor bearer and signs out rotated session', async () => {
  let signedOut = 0;
  const client = {
    auth: {
      getSession: async () => ({
        data: { session: { access_token: 'token', refresh_token: 'refresh' } },
      }),
      signOut: async () => {
        signedOut++;
      },
    },
  };
  await changeInitialPassword({
    client,
    newPassword: 'long new password',
    fetchImpl: async (_url, init) => {
      assert.equal(init.headers.Authorization, 'Bearer token');
      assert.equal(JSON.parse(init.body).refreshToken, 'refresh');
      return { ok: true, json: async () => ({ data: { changed: true } }) };
    },
  });
  assert.equal(signedOut, 1);
});

test('identity errors keep a code and show safe text', async () => {
  await assert.rejects(
    signInUsername({
      client: { auth: { setSession: async () => ({ error: null }) } },
      username: 'member',
      password: 'wrong',
      fetchImpl: async () => ({
        ok: false,
        json: async () => ({ error: { code: 'RATE_LIMITED' } }),
      }),
    }),
    (error) => error.code === 'RATE_LIMITED' && /try again in a few minutes/i.test(error.message),
  );
});
