import assert from 'node:assert/strict';
import test from 'node:test';
import { runTaskCommand } from './task-command.js';

test('task mutation saved before a failed refresh is not retried', async () => {
  const operations = new Map();
  const calls = [];
  const result = await runTaskCommand({
    operations,
    key: 'cash:one',
    name: 'submit_cash_task_count',
    args: { p_amount_paise: 2350 },
    createId: () => 'id-one',
    rpc: async (name, args) => calls.push({ name, args }),
    refresh: async () => {
      throw new Error('network timeout');
    },
  });
  assert.deepEqual(result, { saved: true, refreshed: false });
  assert.equal(operations.size, 0);
  assert.deepEqual(calls, [
    { name: 'submit_cash_task_count', args: { p_amount_paise: 2350, p_operation_id: 'id-one' } },
  ]);
});

test('task mutation failure preserves its operation ID for exact retry', async () => {
  const operations = new Map();
  const calls = [];
  let attempts = 0;
  const input = {
    operations,
    key: 'cash:one',
    name: 'submit_cash_task_count',
    args: { p_amount_paise: 2350 },
    createId: () => `id-${++attempts}`,
    rpc: async (_name, args) => {
      calls.push(args.p_operation_id);
      if (calls.length === 1) throw new Error('uncertain network response');
    },
    refresh: async () => {},
  };
  const failed = await runTaskCommand(input);
  assert.equal(failed.saved, false);
  assert.equal(operations.get('cash:one'), 'id-1');
  assert.deepEqual(await runTaskCommand(input), { saved: true, refreshed: true });
  assert.deepEqual(calls, ['id-1', 'id-1']);
  assert.equal(operations.size, 0);
});
