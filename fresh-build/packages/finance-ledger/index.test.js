import test from 'node:test';
import assert from 'node:assert/strict';
import {
  paise,
  openingEffect,
  transferEffects,
  accountBalance,
  reconcile,
  correctionEffects,
} from './index.js';

test('paise accepts integer decimal strings only, within signed bigint', () => {
  assert.equal(paise('9223372036854775807'), 9223372036854775807n);
  for (const amount of ['0', '-1', '1.50', '01', '9223372036854775808', 1])
    assert.throws(() => paise(amount), /invalid_paise/);
});

test('pending opening is not money; verified opening plus deposit preserves sum', () => {
  const pending = openingEffect({
    accountId: 'cash',
    amountPaise: '100000',
    openingId: 'open',
    verified: false,
  });
  assert.equal(accountBalance(pending, 'cash'), '0');
  const verified = openingEffect({
    accountId: 'cash',
    amountPaise: '100000',
    openingId: 'open',
    verified: true,
  });
  const pair = transferEffects({
    fromAccountId: 'cash',
    toAccountId: 'bank',
    amountPaise: '30000',
    transferId: 'deposit',
    availablePaise: accountBalance(verified, 'cash'),
  });
  const effects = [...verified, ...pair];
  assert.equal(accountBalance(effects, 'cash'), '70000');
  assert.equal(accountBalance(effects, 'bank'), '30000');
  assert.equal(
    pair.reduce((s, e) => s + BigInt(e.amountPaise), 0n),
    0n,
  );
  assert.deepEqual(reconcile(effects, 'cash', '69000'), {
    bookBalancePaise: '70000',
    observedBalancePaise: '69000',
    variancePaise: '-1000',
  });
});

test('zero and overdrawn transfers are rejected without effects', () => {
  for (const amount of ['0', '-1', '9223372036854775808'])
    assert.throws(() =>
      transferEffects({
        fromAccountId: 'cash',
        toAccountId: 'bank',
        amountPaise: amount,
        transferId: 'x',
        availablePaise: '100',
      }),
    );
  assert.throws(
    () =>
      transferEffects({
        fromAccountId: 'cash',
        toAccountId: 'cash',
        amountPaise: '1',
        transferId: 'x',
        availablePaise: '100',
      }),
    /same_account/,
  );
  assert.throws(
    () =>
      transferEffects({
        fromAccountId: 'cash',
        toAccountId: 'bank',
        amountPaise: '101',
        transferId: 'x',
        availablePaise: '100',
      }),
    /insufficient_balance/,
  );
});

test('correction retains original and posts reversal/replacement with exact account totals', () => {
  const original = { id: 'income-1', accountId: 'cash', amountPaise: '1200' };
  const corrected = correctionEffects({
    original,
    correctionId: 'fix-1',
    replacementAccountId: 'bank',
    replacementAmountPaise: '900',
    sourceKind: 'one_time_donation',
  });
  assert.equal(accountBalance([{ ...original }, ...corrected], 'cash'), '0');
  assert.equal(accountBalance(corrected, 'bank'), '900');
  assert.deepEqual(
    corrected.map((e) => e.amountPaise),
    ['-1200', '900'],
  );
  const expense = correctionEffects({
    original: { id: 'expense-1', accountId: 'cash', amountPaise: '-400' },
    correctionId: 'fix-2',
    sourceKind: 'expense_payment',
  });
  assert.equal(expense[0].amountPaise, '400');
  assert.throws(
    () =>
      correctionEffects({
        original,
        correctionId: 'bad',
        replacementAccountId: 'bank',
        replacementAmountPaise: '-900',
        sourceKind: 'one_time_donation',
      }),
    /invalid_correction/,
  );
});
