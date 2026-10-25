import assert from 'node:assert/strict';
import test from 'node:test';
import { summarizeAccount, verifyTransferPairs } from './index.js';

const lines = [
  { effectId: 'o', accountId: 'cash', sourceType: 'account_opening', amountPaise: '5000' },
  { effectId: 'd', accountId: 'cash', sourceType: 'one_time_donation', amountPaise: '1500' },
  { effectId: 'm', accountId: 'cash', sourceType: 'monthly_contribution', amountPaise: '300' },
  { effectId: 'e', accountId: 'cash', sourceType: 'expense_payment', amountPaise: '-750' },
  {
    effectId: 't1',
    accountId: 'cash',
    sourceType: 'transfer',
    sourceId: 'transfer1',
    leg: 1,
    amountPaise: '-1000',
  },
  {
    effectId: 't2',
    accountId: 'bank',
    sourceType: 'transfer',
    sourceId: 'transfer1',
    leg: 2,
    amountPaise: '1000',
  },
];

test('account closes from opening plus posted effects, with transfers separate', () => {
  assert.deepEqual(summarizeAccount(lines, 'cash', '125'), {
    openingPaise: '125',
    periodOpeningsPaise: '5000',
    incomePaise: '1800',
    expensePaise: '750',
    transferPaise: '-1000',
    closingPaise: '5175',
  });
  assert.equal(summarizeAccount(lines, 'bank').closingPaise, '1000');
  assert.equal(verifyTransferPairs(lines), true);
});

test('partial and duplicate transfer legs cannot be published', () => {
  assert.throws(() => verifyTransferPairs(lines.slice(0, -1)), /invalid_transfer_pair/);
  assert.throws(() => verifyTransferPairs([...lines, lines.at(-1)]), /invalid_transfer_pair/);
});

test('duplicate effects, sign drift and decimal money are rejected', () => {
  assert.throws(
    () => summarizeAccount([...lines, lines[1]], 'cash'),
    /invalid_or_duplicate_effect/,
  );
  assert.throws(
    () => summarizeAccount([{ ...lines[3], amountPaise: '750' }], 'cash'),
    /invalid_effect_sign/,
  );
  assert.throws(
    () => summarizeAccount([{ ...lines[1], amountPaise: '1.5' }], 'cash'),
    /invalid_amount_paise/,
  );
});

test('correction reversal and replacement reconcile by source category', () => {
  const corrected = [
    ...lines,
    {
      effectId: 'c1',
      accountId: 'cash',
      sourceType: 'correction',
      sourceId: 'fix',
      leg: 1,
      category: 'income',
      amountPaise: '-1500',
    },
    {
      effectId: 'c2',
      accountId: 'cash',
      sourceType: 'correction',
      sourceId: 'fix',
      leg: 2,
      category: 'income',
      amountPaise: '900',
    },
  ];
  const total = summarizeAccount(corrected, 'cash', '125');
  assert.equal(total.incomePaise, '1200');
  assert.equal(total.closingPaise, '4575');
  assert.throws(
    () => summarizeAccount([{ ...corrected.at(-1), category: null }], 'cash'),
    /invalid_correction_line/,
  );
});
