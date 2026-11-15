import assert from 'node:assert/strict';
import test from 'node:test';
import { createReportCsvHandler } from './handler.js';

const runId = '9871a273-7389-44af-ae1f-cb3d0dcd07be';
const request = (token = 'valid', id = runId) =>
  new Request(`https://example.test/api/management/report-csv?runId=${id}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

function fixture({
  role = 'president',
  gate = true,
  limit = true,
  drift = false,
  auth = true,
  changeRole = false,
} = {}) {
  const calls = [];
  let checks = 0;
  const actor = {
    auth: {
      getUser: async () => ({
        data: auth ? { user: { id: 'user-1' } } : null,
        error: auth ? null : new Error('denied'),
      }),
    },
    rpc(name) {
      calls.push(name);
      if (name === 'current_identity_gate') {
        return Promise.resolve({ data: { account_active: gate, must_change_password: false } });
      }
      if (name === 'current_app_role') {
        checks++;
        return Promise.resolve({ data: changeRole && checks > 1 ? 'member' : role });
      }
      const data =
        name === 'list_finance_report_lines'
          ? [
              {
                effect_id: 'e1',
                account_id: 'a1',
                source_type: 'account_opening',
                source_id: 'o1',
                leg: 1,
                category: 'opening',
                amount_paise: '12345',
                occurred_at: '2026-10-20T00:00:00Z',
                description: 'Opening balance',
              },
            ]
          : [
              {
                account_id: 'a1',
                account_name: 'Cash',
                opening_paise: '0',
                period_openings_paise: '12345',
                income_paise: '0',
                expense_paise: '0',
                transfer_paise: '0',
                closing_paise: drift ? '12344' : '12345',
              },
            ];
      return { range: async () => ({ data }) };
    },
  };
  const handler = createReportCsvHandler({
    createClient: () => actor,
    url: 'https://db.test',
    publishableKey: 'public',
    limiter: { consume: async () => limit },
    enabled: true,
  });
  return { handler, calls };
}

test('CSV endpoint fails closed without approval, bearer or valid run ID', async () => {
  const disabled = createReportCsvHandler({ enabled: false });
  assert.equal((await disabled(request())).status, 503);
  const { handler } = fixture();
  assert.equal((await handler(request('', runId))).status, 401);
  assert.equal((await handler(request('valid', '../bad'))).status, 400);
});

test('CSV endpoint denies wrong role, inactive identity, invalid token and rate limit before data reads', async () => {
  for (const options of [{ role: 'member' }, { gate: false }, { auth: false }, { limit: false }]) {
    const { handler, calls } = fixture(options);
    const response = await handler(request());
    assert.equal(
      response.status,
      options.auth === false ? 401 : options.limit === false ? 429 : 403,
    );
    assert.ok(!calls.includes('list_finance_report_lines'));
  }
});

test('CSV endpoint returns private exact bytes and hash for an authorized session', async () => {
  const { handler } = fixture();
  const response = await handler(request());
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.match(response.headers.get('content-disposition'), /attachment/);
  assert.match(response.headers.get('x-report-sha256'), /^[a-f0-9]{64}$/);
  assert.match(await response.text(), /"123\.45"/);
});

test('CSV endpoint withholds mismatched totals and rechecks a changed role', async () => {
  assert.equal((await fixture({ drift: true }).handler(request())).status, 503);
  assert.equal((await fixture({ changeRole: true }).handler(request())).status, 403);
});
