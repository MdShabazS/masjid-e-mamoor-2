import assert from 'node:assert/strict';
import test from 'node:test';
import { createPublicReceiptLookup } from './public-lookup.js';

const monthly = 'MEM2-R-' + 'A'.repeat(32);
const oneTime = '9871a273-7389-44af-ae1f-cb3d0dcd07be';
const request = (code = monthly) =>
  new Request('https://example.test/api/public/receipt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  });

function fixture({
  rows = [{ receipt_date: '2026-10-21', amount_paise: '12345' }],
  allowed = true,
  dbError = null,
} = {}) {
  const calls = [];
  const handler = createPublicReceiptLookup({
    createClient: () => ({
      rpc: async (name, args) => {
        calls.push({ name, args });
        return { data: rows, error: dbError };
      },
    }),
    url: 'https://db.test',
    serviceKey: 'server-only',
    limiter: {
      consume: async (key) => {
        calls.push({ key });
        return allowed;
      },
    },
    enabled: true,
  });
  return { handler, calls };
}

test('receipt lookup stays disabled without approval and requires JSON', async () => {
  assert.equal((await createPublicReceiptLookup({ enabled: false })(request())).status, 503);
  const { handler, calls } = fixture();
  const wrongType = new Request('https://example.test/api/public/receipt', {
    method: 'POST',
    body: monthly,
  });
  assert.equal((await handler(wrongType)).status, 415);
  assert.equal(calls.length, 0);
});

test('active monthly and UUID receipts return only date, verified state and exact amount', async () => {
  for (const code of [monthly, oneTime]) {
    const { handler, calls } = fixture();
    const response = await handler(request(code));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
    assert.deepEqual(await response.json(), {
      status: 'verified',
      date: '2026-10-21',
      amountINR: '123.45',
    });
    assert.equal(calls.find((call) => call.name)?.args.p_code, code);
    assert.deepEqual(
      calls.filter((call) => call.key).map((call) => call.key),
      ['receipt:global', `receipt-code:${code}`],
    );
  }
});

test('unknown, superseded and malformed codes have the same public response', async () => {
  for (const [code, rows] of [
    [monthly, []],
    [oneTime, []],
    ['MEM2-R-bad', []],
  ]) {
    const { handler } = fixture({ rows });
    const response = await handler(request(code));
    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), { error: { code: 'RECEIPT_NOT_FOUND' } });
  }
});

test('receipt lookup rejects oversized bodies, extra fields and exhausted shared limit', async () => {
  const { handler } = fixture();
  const oversized = new Request('https://example.test/api/public/receipt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: monthly, padding: 'x'.repeat(300) }),
  });
  assert.equal((await handler(oversized)).status, 400);
  const extra = new Request('https://example.test/api/public/receipt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: monthly, requestedFields: ['phone'] }),
  });
  assert.equal((await handler(extra)).status, 404);
  assert.equal((await fixture({ allowed: false }).handler(request())).status, 429);
});

test('receipt lookup fails closed on database errors or malformed projection', async () => {
  assert.equal((await fixture({ dbError: new Error('db') }).handler(request())).status, 503);
  assert.equal(
    (
      await fixture({ rows: [{ receipt_date: '2026-10-21', amount_paise: '-1' }] }).handler(
        request(),
      )
    ).status,
    503,
  );
  assert.equal(
    (
      await fixture({
        rows: [
          { receipt_date: '2026-10-21', amount_paise: '1' },
          { receipt_date: '2026-10-21', amount_paise: '1' },
        ],
      }).handler(request())
    ).status,
    503,
  );
});
