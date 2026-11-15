import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildCashCountArgs,
  buildCashRejectionArgs,
  buildCashVerificationArgs,
  buildWorkTaskArgs,
} from './work-tasks.js';

const valid = {
  title: ' Clean room ',
  description: ' Morning work ',
  date: '2026-10-27',
  location: ' Hall ',
  mode: 'mixed',
  total: '3',
  invited: '1',
  volunteer: '2',
};

test('task input trims text and sends exact RPC argument names and integer capacities', () => {
  assert.deepEqual(buildWorkTaskArgs(valid), {
    p_title: 'Clean room',
    p_description: 'Morning work',
    p_date: '2026-10-27',
    p_location: 'Hall',
    p_mode: 'mixed',
    p_total: 3,
    p_invited: 1,
    p_volunteer: 2,
  });
});

test('task input rejects invalid dates, fractional caps, over-capacity and mode mismatch', () => {
  for (const patch of [
    { date: '2026-02-30' },
    { date: '27/10/2026' },
    { total: '2.5' },
    { total: '4' },
    { mode: 'open' },
    { invited: '-1' },
    { volunteer: '10001' },
  ])
    assert.throws(() => buildWorkTaskArgs({ ...valid, ...patch }));
});

test('task input allows an undated open task with no invited capacity', () => {
  const args = buildWorkTaskArgs({
    ...valid,
    date: '',
    location: '',
    mode: 'open',
    total: '2',
    invited: '0',
    volunteer: '2',
  });
  assert.equal(args.p_date, null);
  assert.equal(args.p_location, null);
});

test('cash count input sends exact RPC arguments and integer paise', () => {
  assert.deepEqual(
    buildCashCountArgs('task-id', {
      date: '2026-10-27',
      amount: '23.50',
      evidence: '  SLIP-23  ',
    }),
    {
      p_task_id: 'task-id',
      p_date: '2026-10-27',
      p_amount_paise: 2350,
      p_evidence: 'SLIP-23',
    },
  );
});

test('cash count input rejects invalid date, amount and slip', () => {
  const validCount = { date: '2026-10-27', amount: '23.50', evidence: 'SLIP-23' };
  for (const patch of [
    { date: '2026-02-30' },
    { date: '27/10/2026' },
    { amount: '0' },
    { amount: '23.501' },
    { amount: '-1' },
    { evidence: 'ab' },
    { evidence: 'x'.repeat(241) },
  ])
    assert.throws(() => buildCashCountArgs('task-id', { ...validCount, ...patch }));
});

test('Treasurer cash verification uses a checked active account and exact received paise', () => {
  const accounts = [
    { account_id: 'cash-id', active: true, account_kind: 'cash' },
    { account_id: 'bank-id', active: true, account_kind: 'bank' },
    { account_id: 'closed-id', active: false, account_kind: 'cash' },
  ];
  const draft = { physicallyCounted: true, accountId: 'cash-id', amount: '23.50' };
  assert.deepEqual(buildCashVerificationArgs('count-id', draft, accounts), {
    p_count_id: 'count-id',
    p_actual_amount_paise: 2350,
    p_account_id: 'cash-id',
  });
  for (const patch of [
    { physicallyCounted: false },
    { accountId: 'bank-id' },
    { accountId: 'closed-id' },
    { amount: '0' },
    { amount: '23.501' },
  ])
    assert.throws(() => buildCashVerificationArgs('count-id', { ...draft, ...patch }, accounts));
});

test('Treasurer cash rejection requires a bounded reason and no amount', () => {
  assert.deepEqual(buildCashRejectionArgs('count-id', '  Slip missing  '), {
    p_count_id: 'count-id',
    p_reason: 'Slip missing',
  });
  assert.throws(() => buildCashRejectionArgs('count-id', 'no'));
  assert.throws(() => buildCashRejectionArgs('count-id', 'x'.repeat(241)));
});
