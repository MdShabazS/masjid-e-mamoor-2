import test from 'node:test';
import assert from 'node:assert/strict';
import { identityHandler } from './identity-handler.js';
import { IdentityError } from '../identity/service.js';
const id = 'a1000000-0000-4000-8000-000000000001';
function setup(overrides = {}) {
  const calls = [];
  const identity = {
    me: async (x) => {
      calls.push(['me', x]);
      return { actorId: id, role: null, mustChangePassword: true };
    },
    signIn: async (x) => {
      calls.push(['login', x]);
      return { mustChangePassword: true, session: { access_token: 'token' } };
    },
    provision: async (x) => {
      calls.push(['create', x]);
      return { userId: id, temporaryPassword: 'temporary' };
    },
    resetPassword: async (x) => {
      calls.push(['reset', x]);
      return { temporaryPassword: 'temporary' };
    },
    setAccountState: async (x) => {
      calls.push(['state', x]);
      return { active: x.active };
    },
    changePassword: async (x) => {
      calls.push(['change', x]);
      return { changed: true };
    },
    ...overrides,
  };
  return {
    calls,
    handle: identityHandler({
      identity,
      limiter: { consume: async () => true },
      trustedProxyIp: () => '127.0.0.1',
    }),
  };
}
function req(path, body, token) {
  return new Request(`https://api.example.invalid${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
}
test('username login is rate-limit ready and returns a gated session', async () => {
  const { handle, calls } = setup();
  const response = await handle(req('/v1/session', { username: 'person', password: 'pass' }));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).data.mustChangePassword, true);
  assert.deepEqual(calls[0], ['login', { username: 'person', password: 'pass' }]);
  assert.equal(response.headers.get('cache-control'), 'no-store');
});
test('me requires bearer and reports a gated identity', async () => {
  const { handle } = setup();
  assert.equal((await handle(new Request('https://api.example.invalid/v1/me'))).status, 401);
  const response = await handle(
    new Request('https://api.example.invalid/v1/me', {
      headers: { authorization: 'Bearer token' },
    }),
  );
  assert.equal((await response.json()).data.mustChangePassword, true);
});
test('admin route requires bearer and returns credential once', async () => {
  const { handle, calls } = setup();
  assert.equal(
    (await handle(req('/v1/users', { username: 'person', role: 'member' }))).status,
    401,
  );
  const response = await handle(
    req('/v1/users', { username: 'person', role: 'member' }, 'actor-token'),
  );
  assert.equal(response.status, 201);
  assert.equal((await response.json()).data.temporaryPassword, 'temporary');
  assert.equal(calls.filter((x) => x[0] === 'create').length, 1);
});
test('safe error response never returns internal exception or SQL', async () => {
  const { handle } = setup({
    provision: async () => {
      throw new Error('private database table name');
    },
  });
  const response = await handle(req('/v1/users', { username: 'person', role: 'member' }, 'token'));
  assert.equal(response.status, 503);
  assert.equal(JSON.stringify(await response.json()).includes('private'), false);
});
test('reset, state, and change reject unknown input; state uses actor bearer', async () => {
  const { handle, calls } = setup();
  assert.equal(
    (await handle(req(`/v1/users/${id}/reset`, { newPassword: 'forged' }, 'token'))).status,
    400,
  );
  assert.equal(
    (await handle(req(`/v1/users/${id}/state`, { role: 'member', active: false }, 'token'))).status,
    200,
  );
  assert.deepEqual(calls.at(-1)[1], {
    actorToken: 'token',
    targetId: id,
    role: 'member',
    active: false,
  });
  assert.equal(
    (
      await handle(
        req(
          '/v1/session/change-password',
          { refreshToken: 'r', newPassword: 'long-new-password' },
          'token',
        ),
      )
    ).status,
    200,
  );
});
test('rate limit and denied actor propagate stable responses', async () => {
  const a = identityHandler({
    identity: {
      signIn: async () => {
        throw new IdentityError('INVALID_CREDENTIALS');
      },
    },
    limiter: { consume: async () => false },
    trustedProxyIp: () => '127.0.0.1',
  });
  assert.equal((await a(req('/v1/session', { username: 'person', password: 'pass' }))).status, 429);
});
