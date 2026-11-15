import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GET } from '../app/api/management/report-capabilities/route.js';

test('report capabilities fail closed and are never cached', async () => {
  const old = process.env.REPORT_EXPORTS_APPROVED;
  try {
    delete process.env.REPORT_EXPORTS_APPROVED;
    let response = GET();
    assert.equal((await response.json()).exportsApproved, false);
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
    process.env.REPORT_EXPORTS_APPROVED = 'TRUE';
    response = GET();
    assert.equal((await response.json()).exportsApproved, false);
    process.env.REPORT_EXPORTS_APPROVED = 'true';
    response = GET();
    assert.equal((await response.json()).exportsApproved, true);
  } finally {
    if (old === undefined) delete process.env.REPORT_EXPORTS_APPROVED;
    else process.env.REPORT_EXPORTS_APPROVED = old;
  }
});
