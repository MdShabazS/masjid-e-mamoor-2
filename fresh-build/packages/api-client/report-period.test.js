import assert from 'node:assert/strict';
import test from 'node:test';
import { monthReport, rangeReport, yearReport } from './report-period.js';

test('month and year cover whole calendar periods, including year end', () => {
  assert.equal(monthReport('2026-12-01').p_end_exclusive, '2027-01-01');
  assert.equal(monthReport('2028-02-01').p_end_exclusive, '2028-03-01');
  assert.deepEqual(yearReport(2026), {
    p_kind: 'year',
    p_start: '2026-01-01',
    p_end_exclusive: '2027-01-01',
    p_include_proofs: false,
  });
});

test('a range includes its chosen last day and rejects bad spans', () => {
  assert.equal(rangeReport('2026-11-02', '2026-11-02').p_end_exclusive, '2026-11-03');
  assert.throws(() => rangeReport('2026-11-02', '2026-11-01'), /1 to 366/);
  assert.throws(() => rangeReport('2026-01-01', '2027-06-01'), /1 to 366/);
  assert.throws(() => rangeReport('', '2026-11-01'), /both dates/);
});
