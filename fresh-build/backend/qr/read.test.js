import assert from 'node:assert/strict';
import { test } from 'node:test';
import sharp from 'sharp';
import { inspectQrAsset } from './asset.js';
import { createPaymentQrReadHandler } from './read.js';

const accountId = '11111111-1111-4111-8111-111111111111';
const versionId = '22222222-2222-4222-8222-222222222222';
const image = await sharp({ create: { width: 64, height: 64, channels: 3, background: 'white' } })
  .png()
  .toBuffer();
const inspected = await inspectQrAsset(image, 'image/png');

function request(token = 'synthetic-token', id = accountId) {
  return new Request(`http://local.invalid/api/management/payment-qr?accountId=${id}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

function fixture({
  role = 'president',
  rows,
  bytes = image,
  limited = false,
  changed = false,
  gate = { account_active: true, must_change_password: false },
} = {}) {
  const calls = [];
  let lookups = 0;
  const actor = {
    auth: { getUser: async () => ({ data: { user: { id: accountId } } }) },
    rpc: async (name, args) => {
      calls.push([name, args]);
      if (name === 'current_identity_gate') return { data: [gate] };
      if (name === 'current_app_role') return { data: role };
      if (name === 'active_payment_qr_for_staff')
        return {
          data:
            changed && ++lookups === 2
              ? []
              : rows === undefined
                ? [
                    {
                      version_id: versionId,
                      asset_path: 'payment-qr/fixture.png',
                      sha256_hex: inspected.sha256,
                      asset_bytes: image.length,
                    },
                  ]
                : rows,
        };
      throw new Error(name);
    },
  };
  const service = {
    storage: {
      from: () => ({
        download: async (path) => {
          calls.push(['download', path]);
          return { data: new Blob([bytes]), error: null };
        },
      }),
    },
  };
  const handler = createPaymentQrReadHandler({
    createClient: (_, key) => (key === 'public-key' ? actor : service),
    url: 'https://fixture.invalid',
    publishableKey: 'public-key',
    secretKey: 'secret-key',
    limiter: { consume: async () => !limited },
  });
  return { calls, handler };
}

test('private QR read fails closed without config, valid account or bearer', async () => {
  const unavailable = createPaymentQrReadHandler({});
  assert.equal((await unavailable(request())).status, 503);
  const { handler } = fixture();
  assert.equal((await handler(request('', 'bad'))).status, 400);
  assert.equal((await handler(request(''))).status, 401);
});

test('only President and Treasurer can read an active QR', async () => {
  for (const role of ['president', 'treasurer']) {
    const { handler } = fixture({ role });
    const response = await handler(request());
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('Content-Type'), 'image/png');
    assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
    assert.equal(response.headers.get('X-QR-SHA256'), inspected.sha256);
    assert.equal(response.headers.get('X-QR-Version-ID'), versionId);
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), image);
  }
  for (const role of ['member', 'data_entry', 'system_admin']) {
    const { calls, handler } = fixture({ role });
    assert.equal((await handler(request())).status, 403);
    assert.equal(
      calls.some(([name]) => name === 'download'),
      false,
    );
  }
});

test('QR read denies inactive and temporary-password sessions before private download', async () => {
  for (const gate of [
    { account_active: false, must_change_password: false },
    { account_active: true, must_change_password: true },
  ]) {
    const { calls, handler } = fixture({ gate });
    assert.equal((await handler(request())).status, 403);
    assert.equal(
      calls.some(([name]) => name === 'download'),
      false,
    );
  }
});

test('missing version, rate limit and changed private bytes fail closed', async () => {
  assert.equal((await fixture({ rows: [] }).handler(request())).status, 404);
  assert.equal((await fixture({ limited: true }).handler(request())).status, 429);
  const changed = await sharp({
    create: { width: 64, height: 64, channels: 3, background: 'black' },
  })
    .png()
    .toBuffer();
  const response = await fixture({ bytes: changed }).handler(request());
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error.code, 'QR_STORAGE_MISMATCH');
  const replaced = await fixture({ changed: true }).handler(request());
  assert.equal(replaced.status, 409);
  assert.equal((await replaced.json()).error.code, 'QR_CHANGED_RETRY');
});
