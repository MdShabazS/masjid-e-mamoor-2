// Independent exact-paise reconciliation for the canonical report projection.
const KINDS = new Set([
  'account_opening',
  'monthly_contribution',
  'one_time_donation',
  'expense_payment',
  'transfer',
  'correction',
  'salary_payment',
  'advance_disbursement',
  'advance_return',
  'advance_settlement',
]);
// Salary and settled advance bills are spending; an advance paid or returned only moves money
// between a real account and the reserved advance account, so it is reported like a transfer.
const EXPENSE_KINDS = new Set(['expense_payment', 'salary_payment', 'advance_settlement']);
const TRANSFER_KINDS = new Set(['transfer', 'advance_disbursement', 'advance_return']);
const integer = (value) => {
  if (typeof value !== 'string' || !/^-?(0|[1-9]\d*)$/.test(value))
    throw new Error('invalid_amount_paise');
  return BigInt(value);
};

export function summarizeAccount(lines, accountId, openingPaise = '0') {
  const totals = {
    openingPaise: integer(openingPaise),
    periodOpeningsPaise: 0n,
    incomePaise: 0n,
    expensePaise: 0n,
    transferPaise: 0n,
  };
  const seen = new Set();
  for (const line of lines) {
    if (line.accountId !== accountId) continue;
    if (!KINDS.has(line.sourceType) || !line.effectId || seen.has(line.effectId))
      throw new Error('invalid_or_duplicate_effect');
    seen.add(line.effectId);
    const amount = integer(line.amountPaise);
    if (line.sourceType === 'account_opening') {
      if (amount < 0n) throw new Error('invalid_effect_sign');
      totals.periodOpeningsPaise += amount;
    } else if (
      line.sourceType === 'monthly_contribution' ||
      line.sourceType === 'one_time_donation'
    ) {
      if (amount <= 0n) throw new Error('invalid_effect_sign');
      totals.incomePaise += amount;
    } else if (EXPENSE_KINDS.has(line.sourceType)) {
      if (amount >= 0n) throw new Error('invalid_effect_sign');
      totals.expensePaise -= amount;
    } else if (line.sourceType === 'correction') {
      if (
        !line.sourceId ||
        ![1, 2].includes(line.leg) ||
        amount === 0n ||
        !['income', 'expense'].includes(line.category)
      )
        throw new Error('invalid_correction_line');
      if (line.category === 'income') totals.incomePaise += amount;
      else totals.expensePaise -= amount;
    } else {
      if (amount === 0n || ![1, 2].includes(line.leg)) throw new Error('invalid_transfer_leg');
      if ((line.leg === 1) !== amount < 0n) throw new Error('invalid_transfer_leg');
      totals.transferPaise += amount;
    }
  }
  return Object.fromEntries(
    Object.entries({
      ...totals,
      closingPaise:
        totals.openingPaise +
        totals.periodOpeningsPaise +
        totals.incomePaise -
        totals.expensePaise +
        totals.transferPaise,
    }).map(([k, v]) => [k, v.toString()]),
  );
}

export function verifyTransferPairs(lines) {
  const transfers = new Map();
  for (const line of lines) {
    if (!TRANSFER_KINDS.has(line.sourceType)) continue;
    const key = `${line.sourceType}:${line.sourceId}`;
    const transfer = transfers.get(key) ?? new Map();
    if (!line.sourceId || transfer.has(line.leg)) throw new Error('invalid_transfer_pair');
    transfer.set(line.leg, integer(line.amountPaise));
    transfers.set(key, transfer);
  }
  for (const transfer of transfers.values()) {
    if (
      transfer.size !== 2 ||
      !transfer.has(1) ||
      !transfer.has(2) ||
      transfer.get(1) >= 0n ||
      transfer.get(2) <= 0n ||
      transfer.get(1) + transfer.get(2) !== 0n
    )
      throw new Error('invalid_transfer_pair');
  }
  return true;
}
