import test from 'node:test';
import assert from 'node:assert/strict';
import { trustedClientIp } from './trusted-client-ip.js';
import { identityHandler } from '../../../backend/api/identity-handler.js';
import { IdentityError } from '../../../backend/identity/service.js';

function signInRequest(ip, password = 'wrong') {
  return new Request('https://example.invalid/v1/session', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
    body: JSON.stringify({ username: 'known-member', password }),
  });
}

test('untrusted runtimes ignore caller-supplied forwarding headers', () => {
  assert.equal(trustedClientIp(signInRequest('198.51.100.10'), false), 'shared');
  assert.equal(trustedClientIp(signInRequest('203.0.113.20'), false), 'shared');
});

test('Vercel client IP separates sign-in buckets and rejects invalid headers', async () => {
  const attempts = new Map();
  const handle = identityHandler({
    trustedProxyIp: (request) => trustedClientIp(request, true),
    limiter: {
      consume: async (key) => {
        const count = (attempts.get(key) ?? 0) + 1;
        attempts.set(key, count);
        return count <= 5;
      },
    },
    identity: {
      signIn: async ({ password }) => {
        if (password !== 'correct') throw new IdentityError('INVALID_CREDENTIALS');
        return { signedIn: true };
      },
    },
  });
  for (let attempt = 0; attempt < 5; attempt += 1)
    assert.equal((await handle(signInRequest('198.51.100.10'))).status, 401);
  assert.equal((await handle(signInRequest('198.51.100.10', 'correct'))).status, 429);
  assert.equal((await handle(signInRequest('203.0.113.20', 'correct'))).status, 200);
  assert.equal((await handle(signInRequest('198.51.100.10, 203.0.113.20', 'correct'))).status, 503);
  assert.equal(trustedClientIp(signInRequest('not-an-ip'), true), null);
});
