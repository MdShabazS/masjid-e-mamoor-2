import assert from 'node:assert/strict';
import test from 'node:test';
import { createHmac } from 'node:crypto';
import { dispatchOne, processSignedWebhook } from './worker.js';

const item = {
  outbox_id: 'o1',
  lease_id: 'l1',
  phone_number_id: '1234567890',
  to_e164: '+919876543210',
  template_name: 'monthly_request',
  language_code: 'en',
};
const config = {
  token: 'server-only-access-token',
  phoneNumberId: '1234567890',
  apiVersion: 'v23.0',
};
const parameters = () => ['Donor', '₹500.00'];

test('missing number/credentials never leases a message', async () => {
  let calls = 0;
  const db = {
    claim: async () => {
      calls++;
      return item;
    },
  };
  assert.deepEqual(await dispatchOne({ db, config: {}, renderParameters: parameters }), {
    state: 'disabled',
  });
  assert.equal(calls, 0);
});

test('STOP recheck before send suppresses provider call', async () => {
  let providerCalls = 0;
  const db = { claim: async () => item, preflight: async () => false };
  assert.deepEqual(
    await dispatchOne({
      db,
      config,
      renderParameters: parameters,
      fetchImpl: async () => {
        providerCalls++;
      },
    }),
    { state: 'cancelled' },
  );
  assert.equal(providerCalls, 0);
});

test('accepted provider ID marks sent; definite 429 retries and ambiguous error fails', async () => {
  const finished = [];
  const db = {
    claim: async () => item,
    preflight: async () => true,
    finish: async (...args) => {
      finished.push(args);
    },
  };
  const accepted = await dispatchOne({
    db,
    config,
    renderParameters: parameters,
    fetchImpl: async () => ({ ok: true, json: async () => ({ messages: [{ id: 'wamid.abc' }] }) }),
  });
  assert.equal(accepted.providerId, 'wamid.abc');
  assert.deepEqual(finished.pop().slice(2), ['wamid.abc', null, false]);
  const limited = await dispatchOne({
    db,
    config,
    renderParameters: parameters,
    fetchImpl: async () => ({ ok: false, status: 429 }),
  });
  assert.equal(limited.state, 'retry_queued');
  assert.deepEqual(finished.pop().slice(2), [null, 'rate_limited', true]);
  const ambiguous = await dispatchOne({
    db,
    config,
    renderParameters: parameters,
    fetchImpl: async () => {
      throw new Error('connection reset');
    },
  });
  assert.equal(ambiguous.state, 'failed');
  assert.deepEqual(finished.pop().slice(2), [null, 'transport_unknown', false]);
});

test('forged webhook cannot call DB; signed STOP is normalized and deduped by DB', async () => {
  const body = Buffer.from(
    JSON.stringify({
      object: 'whatsapp_business_account',
      entry: [
        {
          changes: [
            {
              field: 'messages',
              value: {
                messages: [
                  { id: 'wamid.1', from: '919876543210', type: 'text', text: { body: ' STOP ' } },
                ],
              },
            },
          ],
        },
      ],
    }),
  );
  let calls = 0;
  const db = {
    recordInbound: async (id, from, text) => {
      calls++;
      assert.deepEqual([id, from, text], ['wamid.1', '+919876543210', 'STOP']);
    },
  };
  await assert.rejects(
    () =>
      processSignedWebhook({
        rawBody: body,
        signature: 'sha256=' + '0'.repeat(64),
        appSecret: 'secret',
        db,
      }),
    /invalid_webhook_signature/,
  );
  assert.equal(calls, 0);
  const signature = 'sha256=' + createHmac('sha256', 'secret').update(body).digest('hex');
  assert.equal(
    await processSignedWebhook({ rawBody: body, signature, appSecret: 'secret', db }),
    1,
  );
  assert.equal(calls, 1);
});
