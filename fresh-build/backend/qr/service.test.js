import assert from 'node:assert/strict';
import { test } from 'node:test';
import sharp from 'sharp';
import { createPaymentQrHandler } from './service.js';

const account = '11111111-1111-4111-8111-111111111111';
const operation = '22222222-2222-4222-8222-222222222222';
const png = await sharp({ create: { width: 64, height: 64, channels: 3, background: 'white' } })
  .png()
  .toBuffer();
const otherPng = await sharp({
  create: { width: 64, height: 64, channels: 3, background: 'black' },
})
  .png()
  .toBuffer();

function request(bytes = png) {
  const form = new FormData();
  form.append('accountId', account);
  form.append('operationId', operation);
  form.append('payeeConfirmed', 'true');
  form.append('file', new Blob([bytes], { type: 'image/png' }), 'qr.png');
  return new Request('http://local.invalid/api/management/payment-qr', {
    method: 'POST',
    headers: { Authorization: 'Bearer synthetic-token' },
    body: form,
  });
}

function fixture(
  role = 'president',
  eligible = true,
  gate = { account_active: true, must_change_password: false },
) {
  const calls = [];
  let stored;
  const actor = {
    auth: { getUser: async () => ({ data: { user: { id: account } } }) },
    rpc: async (name, args) => {
      calls.push([name, args]);
      if (name === 'current_identity_gate') return { data: [gate] };
      if (name === 'current_app_role') return { data: role };
      if (name === 'payment_qr_account_eligible') return { data: eligible };
      if (name === 'activate_payment_qr') return { data: operation };
      throw new Error(name);
    },
  };
  const service = {
    storage: {
      from: () => ({
        upload: async (path, bytes, options) => {
          calls.push(['upload', path, options]);
          if (stored) return { error: { statusCode: 409 } };
          stored = Buffer.from(bytes);
          return { error: null };
        },
        download: async (path) => {
          calls.push(['download', path]);
          return stored
            ? { data: new Blob([stored]), error: null }
            : { data: null, error: { statusCode: 404 } };
        },
      }),
    },
    rpc: async (name, args) => {
      calls.push([name, args]);
      return { error: null };
    },
  };
  const handler = createPaymentQrHandler({
    createClient: (_, key) => (key === 'public-key' ? actor : service),
    url: 'https://fixture.invalid',
    publishableKey: 'public-key',
    secretKey: 'secret-key',
    limiter: { consume: async () => true },
  });
  return { calls, handler };
}

test('QR route fails closed without server configuration or bearer session', async () => {
  const unavailable = createPaymentQrHandler({ url: '', publishableKey: '', secretKey: '' });
  assert.equal((await unavailable(request())).status, 503);
  const { handler } = fixture();
  assert.equal(
    (await handler(new Request('http://local.invalid', { method: 'POST' }))).status,
    401,
  );
});

test('QR route denies a member before reading or uploading bytes', async () => {
  const { calls, handler } = fixture('member');
  assert.equal((await handler(request())).status, 403);
  assert.equal(
    calls.some(([name]) => name === 'upload'),
    false,
  );
});

test('QR upload denies inactive and temporary-password sessions before Storage access', async () => {
  for (const gate of [
    { account_active: false, must_change_password: false },
    { account_active: true, must_change_password: true },
  ]) {
    const { calls, handler } = fixture('president', true, gate);
    assert.equal((await handler(request())).status, 403);
    assert.equal(
      calls.some(([name]) => name === 'upload'),
      false,
    );
  }
});

test('QR route denies Data Entry before private Storage access', async () => {
  const { calls, handler } = fixture('data_entry');
  assert.equal((await handler(request())).status, 403);
  assert.equal(
    calls.some(([name]) => name === 'upload'),
    false,
  );
});

test('QR route rejects an ineligible account before private Storage write', async () => {
  const { calls, handler } = fixture('president', false);
  assert.equal((await handler(request())).status, 400);
  assert.equal(
    calls.some(([name]) => name === 'upload'),
    false,
  );
});

test('QR route uploads, rereads, registers and activates exact bytes; same operation retries', async () => {
  const { calls, handler } = fixture();
  const first = await handler(request());
  assert.equal(first.status, 200);
  const data = (await first.json()).data;
  assert.equal(data.versionId, operation);
  assert.equal(data.bytes, png.length);
  assert.match(data.sha256, /^[a-f0-9]{64}$/);
  assert.deepEqual(
    calls
      .filter(([name]) =>
        ['upload', 'download', 'register_verified_qr_asset', 'activate_payment_qr'].includes(name),
      )
      .map(([name]) => name),
    ['upload', 'download', 'register_verified_qr_asset', 'activate_payment_qr'],
  );
  assert.equal(calls.find(([name]) => name === 'upload')[2].upsert, false);
  assert.equal(
    calls.find(([name]) => name === 'register_verified_qr_asset')[1].p_sha256_hex,
    data.sha256,
  );
  assert.equal((await handler(request())).status, 200);
  assert.equal((await handler(request(otherPng))).status, 409);
});

test('QR route rejects invalid image before Storage access', async () => {
  const { calls, handler } = fixture();
  assert.equal((await handler(request(Buffer.alloc(80)))).status, 400);
  assert.equal(
    calls.some(([name]) => name === 'upload'),
    false,
  );
});
