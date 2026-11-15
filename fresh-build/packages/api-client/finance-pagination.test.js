import assert from 'node:assert/strict';
import test from 'node:test';
import { appendFinancePage, financePageCursor } from './finance-pagination.js';

test('ledger and observation pages use the last descending time and ID', () => {
  assert.deepEqual(
    financePageCursor(
      [
        { effect_id: 'new', occurred_at: '2026-10-18T10:00:00Z' },
        { effect_id: 'old', occurred_at: '2026-10-18T09:00:00Z' },
      ],
      'effect_id',
      'occurred_at',
    ),
    {
      p_before_at: '2026-10-18T09:00:00Z',
      p_before_id: 'old',
    },
  );
  assert.deepEqual(
    financePageCursor(
      [{ reconciliation_id: 'one', recorded_at: '2026-10-18T08:00:00Z' }],
      'reconciliation_id',
      'recorded_at',
    ),
    {
      p_before_at: '2026-10-18T08:00:00Z',
      p_before_id: 'one',
    },
  );
  assert.throws(() => financePageCursor([], 'effect_id', 'occurred_at'), /cursor_missing/);
});

test('overlapping page retry does not duplicate displayed rows', () => {
  assert.deepEqual(
    appendFinancePage([{ effect_id: 'a' }], [{ effect_id: 'a' }, { effect_id: 'b' }], 'effect_id'),
    [{ effect_id: 'a' }, { effect_id: 'b' }],
  );
});
