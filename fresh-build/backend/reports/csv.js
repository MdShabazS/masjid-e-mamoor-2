import { createHash } from 'node:crypto';
import { summarizeAccount, verifyTransferPairs } from '../../packages/reports/index.js';

const MAX_LINES = 10000;
const MAX_ACCOUNTS = 500;
const MONEY = /^-?(0|[1-9]\d*)$/;
const COLUMNS = [
  'row_type',
  'run_id',
  'account_id',
  'account_name',
  'effect_id',
  'occurred_at',
  'source_type',
  'category',
  'description',
  'proof_reference',
  'amount_rupees',
  'opening_rupees',
  'period_openings_rupees',
  'income_rupees',
  'expense_rupees',
  'transfer_rupees',
  'closing_rupees',
];
const AMOUNT_COLUMNS = new Set(COLUMNS.filter((name) => name.endsWith('_rupees')));

function rupees(value) {
  if (typeof value !== 'string' || !MONEY.test(value)) throw new Error('invalid_report_amount');
  const number = BigInt(value);
  const abs = number < 0n ? -number : number;
  return `${number < 0n ? '-' : ''}${abs / 100n}.${String(abs % 100n).padStart(2, '0')}`;
}

function cell(value, numeric = false) {
  const raw = value == null ? '' : String(value);
  // Spreadsheet apps can evaluate formula-looking text even inside a quoted CSV cell.
  const safe = !numeric && /^[\s\u0000-\u001f]*[=+\-@]/u.test(raw) ? `'${raw}` : raw;
  return `"${safe.replaceAll('"', '""')}"`;
}

function row(fields) {
  return COLUMNS.map((name) => cell(fields[name], AMOUNT_COLUMNS.has(name))).join(',');
}

export function renderReportCsv({ runId, lines, balances }) {
  if (!/^[0-9a-f-]{36}$/i.test(runId) || !Array.isArray(lines) || !Array.isArray(balances))
    throw new Error('invalid_report_snapshot');
  if (lines.length > MAX_LINES || balances.length > MAX_ACCOUNTS)
    throw new Error('report_too_large');
  const accountIds = new Set();
  const effectIds = new Set();
  for (const balance of balances) {
    if (
      !balance.account_id ||
      accountIds.has(balance.account_id) ||
      typeof balance.account_name !== 'string'
    )
      throw new Error('invalid_report_account');
    accountIds.add(balance.account_id);
  }
  for (const line of lines) {
    if (!line.effect_id || effectIds.has(line.effect_id) || !accountIds.has(line.account_id))
      throw new Error('invalid_report_line');
    effectIds.add(line.effect_id);
  }
  const normalized = lines.map((line) => ({
    effectId: line.effect_id,
    accountId: line.account_id,
    sourceType: line.source_type,
    sourceId: line.source_id,
    leg: line.leg,
    category: line.category,
    amountPaise: line.amount_paise,
  }));
  verifyTransferPairs(normalized);
  for (const balance of balances) {
    const calculated = summarizeAccount(normalized, balance.account_id, balance.opening_paise);
    for (const [property, field] of [
      ['openingPaise', 'opening_paise'],
      ['periodOpeningsPaise', 'period_openings_paise'],
      ['incomePaise', 'income_paise'],
      ['expensePaise', 'expense_paise'],
      ['transferPaise', 'transfer_paise'],
      ['closingPaise', 'closing_paise'],
    ]) {
      if (calculated[property] !== balance[field]) throw new Error('report_reconciliation_failed');
    }
  }
  const names = new Map(balances.map((balance) => [balance.account_id, balance.account_name]));
  const rows = [COLUMNS.map((name) => cell(name)).join(',')];
  for (const line of lines) {
    rows.push(
      row({
        row_type: 'effect',
        run_id: runId,
        account_id: line.account_id,
        account_name: names.get(line.account_id),
        effect_id: line.effect_id,
        occurred_at: line.occurred_at,
        source_type: line.source_type,
        category: line.category,
        description: line.description,
        proof_reference: line.proof_reference,
        amount_rupees: rupees(line.amount_paise),
      }),
    );
  }
  for (const balance of balances) {
    rows.push(
      row({
        row_type: 'balance',
        run_id: runId,
        account_id: balance.account_id,
        account_name: balance.account_name,
        opening_rupees: rupees(balance.opening_paise),
        period_openings_rupees: rupees(balance.period_openings_paise),
        income_rupees: rupees(balance.income_paise),
        expense_rupees: rupees(balance.expense_paise),
        transfer_rupees: rupees(balance.transfer_paise),
        closing_rupees: rupees(balance.closing_paise),
      }),
    );
  }
  const bytes = Buffer.from('\uFEFF' + rows.join('\r\n') + '\r\n', 'utf8');
  return { bytes, sha256: createHash('sha256').update(bytes).digest('hex') };
}
