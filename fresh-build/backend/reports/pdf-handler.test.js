import assert from 'node:assert/strict';
import test from 'node:test';
import { createReportPdfHandler } from './pdf-handler.js';
import { sample } from './pdf-fixture.js';

const request = (token = 'valid') =>
  new Request(`https://example.test/api/management/report-pdf?runId=${sample.runId}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

function fixture({
  role = 'president',
  gate = true,
  limit = true,
  drift = false,
  changeRole = false,
} = {}) {
  const calls = [];
  let checks = 0;
  const actor = {
    auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }) },
    rpc(name) {
      calls.push(name);
      if (name === 'current_identity_gate')
        return Promise.resolve({ data: { account_active: gate, must_change_password: false } });
      if (name === 'current_app_role')
        return Promise.resolve({ data: changeRole && ++checks > 1 ? 'member' : role });
      return {
        range: async () => ({
          data:
            name === 'list_finance_report_lines'
              ? sample.lines
              : [{ ...sample.balances[0], closing_paise: drift ? '12344' : '12345' }],
        }),
      };
    },
  };
  const service = {
    from: () => ({
      select: () => ({ eq: () => ({ single: async () => ({ data: sample.metadata }) }) }),
    }),
  };
  const handler = createReportPdfHandler({
    createClient: (_url, key) => (key === 'secret' ? service : actor),
    url: 'https://db.test',
    publishableKey: 'public',
    serviceKey: 'secret',
    limiter: { consume: async () => limit },
    enabled: true,
  });
  return { handler, calls };
}

test('PDF endpoint requires approval, valid run, bearer, allowed role and rate limit', async () => {
  assert.equal((await createReportPdfHandler({ enabled: false })(request())).status, 503);
  assert.equal((await fixture().handler(request(''))).status, 401);
  for (const [options, status] of [
    [{ role: 'member' }, 403],
    [{ gate: false }, 403],
    [{ limit: false }, 429],
  ]) {
    const { handler, calls } = fixture(options);
    assert.equal((await handler(request())).status, status);
    assert.ok(!calls.includes('list_finance_report_lines'));
  }
});

test('PDF endpoint serves private verified bytes and fails closed on drift or role change', async () => {
  const response = await fixture().handler(request());
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'application/pdf');
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.match(response.headers.get('x-report-sha256'), /^[0-9a-f]{64}$/);
  assert.match(Buffer.from(await response.arrayBuffer()).toString('latin1', 0, 8), /%PDF/);
  assert.equal((await fixture({ drift: true }).handler(request())).status, 503);
  assert.equal((await fixture({ changeRole: true }).handler(request())).status, 403);
});
