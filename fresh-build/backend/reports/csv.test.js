import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { renderReportCsv } from './csv.js';

const runId = '9871a273-7389-44af-ae1f-cb3d0dcd07be';
const balances = [
  {
    account_id: 'cash',
    account_name: '=HYPERLINK("bad")',
    opening_paise: '0',
    period_openings_paise: '12345',
    income_paise: '150',
    expense_paise: '0',
    transfer_paise: '0',
    closing_paise: '12495',
  },
];
const lines = [
  {
    effect_id: 'opening',
    account_id: 'cash',
    source_type: 'account_opening',
    source_id: 'opening',
    leg: 1,
    category: 'opening',
    amount_paise: '12345',
    occurred_at: '2026-10-20T00:00:00Z',
    description: 'Opening balance',
  },
  {
    effect_id: 'donation',
    account_id: 'cash',
    source_type: 'one_time_donation',
    source_id: 'donation',
    leg: 1,
    category: 'income',
    amount_paise: '150',
    occurred_at: '2026-10-20T01:00:00Z',
    description: '=1+1\r\n"quoted"',
  },
];

test('CSV preserves exact paise, reconciles every account and hashes returned bytes', () => {
  const { bytes, sha256 } = renderReportCsv({ runId, lines, balances });
  const csv = bytes.toString('utf8');
  assert.ok(csv.startsWith('\uFEFF'));
  assert.match(csv, /"123\.45"/);
  assert.match(csv, /"124\.95"/);
  assert.match(csv, /"'=HYPERLINK\(""bad""\)"/);
  assert.match(csv, /"'=1\+1\r\n""quoted"""/);
  assert.equal(sha256, createHash('sha256').update(bytes).digest('hex'));
});

test('CSV fails closed on missing or duplicate effects and changed totals', () => {
  assert.throws(
    () => renderReportCsv({ runId, lines: lines.slice(0, 1), balances }),
    /report_reconciliation_failed/,
  );
  assert.throws(
    () => renderReportCsv({ runId, lines: [...lines, lines[1]], balances }),
    /invalid_report_line/,
  );
  assert.throws(
    () => renderReportCsv({ runId, lines, balances: [{ ...balances[0], closing_paise: '12494' }] }),
    /report_reconciliation_failed/,
  );
  assert.throws(
    () =>
      renderReportCsv({
        runId,
        lines: [{ ...lines[0], amount_paise: '123.45' }, lines[1]],
        balances,
      }),
    /invalid_amount_paise/,
  );
});

test('CSV rejects incomplete transfer pairs and output larger than the bounded snapshot', () => {
  const transfer = {
    ...lines[1],
    effect_id: 'transfer-leg',
    source_type: 'transfer',
    source_id: 'transfer-1',
    leg: 1,
    category: 'transfer',
    amount_paise: '-100',
  };
  assert.throws(
    () => renderReportCsv({ runId, lines: [...lines, transfer], balances }),
    /invalid_transfer_pair/,
  );
  assert.throws(
    () => renderReportCsv({ runId, lines: [], balances: Array(501).fill(balances[0]) }),
    /report_too_large/,
  );
});

test('CSV keeps negative and beyond-safe-integer money as exact numeric text', () => {
  const huge = '900719925474099299';
  const expense = {
    ...lines[1],
    effect_id: 'expense',
    source_type: 'expense_payment',
    category: 'expense',
    amount_paise: '-100',
  };
  const account = {
    ...balances[0],
    account_name: 'Cash',
    opening_paise: huge,
    income_paise: '0',
    expense_paise: '100',
    closing_paise: '900719925474111544',
  };
  const { bytes } = renderReportCsv({ runId, lines: [lines[0], expense], balances: [account] });
  const csv = bytes.toString('utf8');
  assert.match(csv, /"-1\.00"/);
  assert.doesNotMatch(csv, /"'-1\.00"/);
  assert.match(csv, /"9007199254740992\.99"/);
});
