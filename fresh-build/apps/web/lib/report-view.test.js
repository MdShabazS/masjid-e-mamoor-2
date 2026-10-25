import assert from 'node:assert/strict';
import { createHash, webcrypto } from 'node:crypto';
import { test } from 'node:test';
import { formatPaise, reportPeriod, validRunId, verifyCsvDigest } from './report-view.js';

test('report dates reject invalid, non-calendar and overlong ranges', () => {
  assert.deepEqual(reportPeriod('month', '2026-02-01', '2026-03-01'), {
    p_kind: 'month',
    p_start: '2026-02-01',
    p_end_exclusive: '2026-03-01',
    p_include_proofs: false,
  });
  assert.throws(() => reportPeriod('month', '2026-02-01', '2026-02-28'));
  assert.throws(() => reportPeriod('range', '2026-02-30', '2026-03-02'));
  assert.throws(() => reportPeriod('range', '2026-01-01', '2027-02-01'));
  assert.throws(() => reportPeriod('year', '2026-01-01', '2026-12-31'));
});

test('report amounts preserve paise beyond number safe integer', () => {
  assert.equal(formatPaise('9007199254740993'), '₹9,00,71,99,25,47,409.93');
  assert.equal(formatPaise('-25'), '-₹0.25');
});

test('CSV digest and run ID are checked before download', async () => {
  const bytes = new TextEncoder().encode('a,b\n1,2\n');
  const digest = createHash('sha256').update(bytes).digest('hex');
  assert.equal(await verifyCsvDigest(bytes, digest, webcrypto.subtle), true);
  assert.equal(await verifyCsvDigest(bytes, '0'.repeat(64), webcrypto.subtle), false);
  assert.equal(validRunId('00000000-0000-4000-8000-000000000001'), true);
  assert.equal(validRunId('invalid'), false);
});
