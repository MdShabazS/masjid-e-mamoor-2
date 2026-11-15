// Exact paise arithmetic for shared validation and independent fixture checks.
// Persistence, permission and concurrency remain database responsibilities.
const MAX = 9223372036854775807n;

export function paise(value, { allowZero = false } = {}) {
  if (typeof value !== 'string' || !/^(0|[1-9][0-9]*)$/.test(value))
    throw new Error('invalid_paise');
  const amount = BigInt(value);
  if (amount > MAX || (!allowZero && amount === 0n)) throw new Error('invalid_paise');
  return amount;
}

export function accountBalance(effects, accountId) {
  return effects
    .filter((e) => e.accountId === accountId)
    .reduce((sum, e) => sum + BigInt(e.amountPaise), 0n)
    .toString();
}

export function openingEffect({ accountId, amountPaise, openingId, verified }) {
  const amount = paise(amountPaise, { allowZero: true });
  return verified
    ? [
        {
          accountId,
          sourceType: 'account_opening',
          sourceId: openingId,
          leg: 0,
          amountPaise: amount.toString(),
        },
      ]
    : [];
}

export function transferEffects({
  fromAccountId,
  toAccountId,
  amountPaise,
  transferId,
  availablePaise,
}) {
  const amount = paise(amountPaise);
  if (fromAccountId === toAccountId) throw new Error('same_account');
  if (BigInt(availablePaise) < amount) throw new Error('insufficient_balance');
  return [
    {
      accountId: fromAccountId,
      sourceType: 'transfer',
      sourceId: transferId,
      leg: 1,
      amountPaise: (-amount).toString(),
    },
    {
      accountId: toAccountId,
      sourceType: 'transfer',
      sourceId: transferId,
      leg: 2,
      amountPaise: amount.toString(),
    },
  ];
}

export function reconcile(effects, accountId, observedPaise) {
  const book = BigInt(accountBalance(effects, accountId));
  const observed = paise(observedPaise, { allowZero: true });
  return {
    bookBalancePaise: book.toString(),
    observedBalancePaise: observed.toString(),
    variancePaise: (observed - book).toString(),
  };
}

export function correctionEffects({
  original,
  correctionId,
  replacementAccountId = null,
  replacementAmountPaise = null,
  sourceKind,
}) {
  if (
    !['monthly_contribution', 'one_time_donation', 'expense_payment'].includes(sourceKind) ||
    !original?.accountId ||
    !original?.id ||
    !correctionId
  )
    throw new Error('invalid_correction');
  const before = BigInt(original.amountPaise);
  if (
    before === 0n ||
    (sourceKind === 'expense_payment' ? before >= 0n : before <= 0n) ||
    before > MAX ||
    before < -MAX
  )
    throw new Error('invalid_correction');
  const effects = [
    {
      accountId: original.accountId,
      sourceType: 'correction',
      sourceId: correctionId,
      leg: 1,
      amountPaise: (-before).toString(),
    },
  ];
  if ((replacementAccountId === null) !== (replacementAmountPaise === null))
    throw new Error('invalid_correction');
  if (replacementAccountId !== null) {
    const after = BigInt(replacementAmountPaise);
    if (
      after === 0n ||
      after > MAX ||
      after < -MAX ||
      (sourceKind === 'expense_payment' ? after >= 0n : after <= 0n)
    )
      throw new Error('invalid_correction');
    effects.push({
      accountId: replacementAccountId,
      sourceType: 'correction',
      sourceId: correctionId,
      leg: 2,
      amountPaise: after.toString(),
    });
  }
  return effects;
}
