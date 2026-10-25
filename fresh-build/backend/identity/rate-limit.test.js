import assert from 'node:assert/strict';
import test from 'node:test';
import { createIdentityLimiter } from './rate-limit.js';

test('shared limiter sends only a SHA-256 bucket key and fails closed', async () => {
  let input;
  const limiter = createIdentityLimiter({
    rpc: async (name, args) => {
      assert.equal(name, 'consume_identity_rate_limit');
      input = args;
      return { data: true, error: null };
    },
  });
  assert.equal(await limiter.consume('session:shared:some.username'), true);
  assert.match(input.p_hash, /^[0-9a-f]{64}$/);
  assert.equal(input.p_limit, 5);
  assert.equal(input.p_window_seconds, 300);
  assert.equal(JSON.stringify(input).includes('some.username'), false);
  assert.equal(await limiter.consume('qr:synthetic-user-id'), true);
  assert.equal(input.p_limit, 5);
  assert.equal(input.p_window_seconds, 3600);
  assert.equal(await limiter.consume('receipt:global'), true);
  assert.equal(input.p_limit, 60);
  assert.equal(input.p_window_seconds, 60);
  assert.equal(await limiter.consume('receipt-code:synthetic-code'), true);
  assert.equal(input.p_limit, 5);
  assert.equal(input.p_window_seconds, 60);
  assert.equal(JSON.stringify(input).includes('synthetic-code'), false);
  const failed = createIdentityLimiter({ rpc: async () => ({ error: { message: 'offline' } }) });
  await assert.rejects(
    () => failed.consume('session:shared:another'),
    /rate_limit_store_unavailable/,
  );
});
