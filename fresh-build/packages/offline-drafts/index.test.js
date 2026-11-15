import assert from 'node:assert/strict';
import test from 'node:test';
import { createDraftQueue, validateDraft, rpcForDraft } from './index.js';

const actor = '7a7977e0-d9db-40d8-a260-d9a40a6c0ec0';
const id = 'ebce2cca-a525-473e-952a-3e9592235b70';
const nextId = '44e4211a-42c2-4d45-a897-c86ba896c010';
const expense = {
  title: 'Fuel',
  description: 'Travel',
  category: 'Transport',
  amountINR: '100.25',
  bill: 'bill-123',
};
function memoryStore() {
  const values = new Map();
  return {
    values,
    getItemAsync: async (k) => values.get(k) ?? null,
    setItemAsync: async (k, v) => {
      values.set(k, v);
    },
    deleteItemAsync: async (k) => {
      values.delete(k);
    },
  };
}

test('only three reviewed drafts can be stored; amount is exact and payload is constrained', () => {
  assert.equal(validateDraft('expense', expense).amountPaise, 10025);
  assert.throws(() => validateDraft('approve_expense', expense), /offline_action_not_allowed/);
  assert.throws(() => validateDraft('expense', { ...expense, admin: true }), /invalid_draft/);
  assert.throws(
    () =>
      validateDraft('donation', {
        name: 'A',
        kind: 'other',
        date: '2026-02-30',
        method: 'cash',
        amountINR: '2',
        evidence: 'receipt',
      }),
    /invalid_draft/,
  );
  assert.equal(
    rpcForDraft({ id, kind: 'expense', payload: validateDraft('expense', expense) })[1]
      .p_operation_id,
    id,
  );
});

test('restart preserves actor-scoped operation ID and uncertain response retries same ID', async () => {
  const store = memoryStore(),
    seen = [];
  const client = {
    auth: { getUser: async () => ({ data: { user: { id: actor } } }) },
    rpc: async (name, args) => {
      seen.push([name, args]);
      if (seen.length === 1) throw new Error('connection lost');
      return { data: 'server-id', error: null };
    },
  };
  const first = createDraftQueue({ store, actorId: actor, uuid: () => id, client });
  await first.add('expense', expense);
  const afterRestart = createDraftQueue({ store, actorId: actor, uuid: () => id, client });
  assert.equal((await afterRestart.list())[0].id, id);
  assert.equal((await afterRestart.sync()).pending, 1);
  assert.equal((await afterRestart.sync()).sent, 1);
  assert.equal(seen.length, 2);
  assert.equal(seen[0][1].p_operation_id, seen[1][1].p_operation_id);
  assert.deepEqual(await afterRestart.list(), []);
});

test('interrupted reviewed removal clears private content before index update', async () => {
  const store = memoryStore();
  const queue = createDraftQueue({ store, actorId: actor, uuid: () => id });
  await queue.add('expense', expense);
  const originalSet = store.setItemAsync;
  store.setItemAsync = async (key, value) => {
    if (key.endsWith('_index')) throw new Error('storage interrupted');
    return originalSet(key, value);
  };
  await assert.rejects(queue.remove(id), /storage interrupted/);
  assert.deepEqual(await queue.list(), []);
  assert.equal([...store.values.keys()].filter((key) => key.endsWith(`_${id}`)).length, 0);
  store.setItemAsync = originalSet;
  const restarted = createDraftQueue({ store, actorId: actor, uuid: () => nextId });
  await restarted.add('expense', expense);
  assert.deepEqual(
    (await restarted.list()).map((draft) => draft.id),
    [nextId],
  );
});

test('interrupted post-submit cleanup does not retain or replay private content', async () => {
  const store = memoryStore();
  let calls = 0;
  const client = {
    auth: { getUser: async () => ({ data: { user: { id: actor } } }) },
    rpc: async () => {
      calls++;
      return { data: 'server-id', error: null };
    },
  };
  const queue = createDraftQueue({ store, actorId: actor, uuid: () => id, client });
  await queue.add('expense', expense);
  const originalSet = store.setItemAsync;
  store.setItemAsync = async (key, value) => {
    if (key.endsWith('_index')) throw new Error('storage interrupted');
    return originalSet(key, value);
  };
  await assert.rejects(queue.sync(), /storage interrupted/);
  assert.deepEqual(await queue.list(), []);
  assert.equal([...store.values.keys()].filter((key) => key.endsWith(`_${id}`)).length, 0);
  store.setItemAsync = originalSet;
  const restarted = createDraftQueue({ store, actorId: actor, uuid: () => nextId, client });
  assert.equal((await restarted.sync()).sent, 0);
  assert.equal(calls, 1);
});

test('failed private-item deletion keeps the same operation for an idempotent retry', async () => {
  const store = memoryStore();
  const seen = [];
  const client = {
    auth: { getUser: async () => ({ data: { user: { id: actor } } }) },
    rpc: async (_name, args) => {
      seen.push(args.p_operation_id);
      return { data: 'server-id', error: null };
    },
  };
  const queue = createDraftQueue({ store, actorId: actor, uuid: () => id, client });
  await queue.add('expense', expense);
  const originalDelete = store.deleteItemAsync;
  store.deleteItemAsync = async () => {
    throw new Error('storage interrupted');
  };
  await assert.rejects(queue.sync(), /storage interrupted/);
  assert.deepEqual(
    (await queue.list()).map((draft) => draft.id),
    [id],
  );
  store.deleteItemAsync = originalDelete;
  const restarted = createDraftQueue({ store, actorId: actor, uuid: () => nextId, client });
  assert.equal((await restarted.sync()).sent, 1);
  assert.deepEqual(seen, [id, id]);
  assert.deepEqual(await restarted.list(), []);
});

test('another session cannot replay an actor draft; conflict and rejection remain visible', async () => {
  const store = memoryStore();
  let calls = 0;
  const client = {
    auth: { getUser: async () => ({ data: { user: { id: 'other' } } }) },
    rpc: async () => {
      calls++;
      return { error: { code: '23505' } };
    },
  };
  const q = createDraftQueue({ store, actorId: actor, uuid: () => id, client });
  await q.add('expense', expense);
  assert.deepEqual(await q.sync(), { state: 'session_required' });
  assert.equal(calls, 0);
  client.auth.getUser = async () => ({ data: { user: { id: actor } } });
  assert.equal((await q.sync()).conflict, 1);
  assert.equal((await q.list())[0].state, 'conflict');
  assert.equal((await q.sync()).conflict, 0);
  assert.equal(await q.remove(id), true);
});

test('task and donation never map to verification or receipt RPCs', () => {
  const task = validateDraft('task', {
    title: 'Clean',
    description: 'Hall',
    date: '2026-10-15',
    mode: 'open',
    total: 2,
    invited: 0,
    volunteer: 2,
  });
  assert.equal(rpcForDraft({ id, kind: 'task', payload: task })[0], 'create_work_task');
  const donation = validateDraft('donation', {
    name: 'Guest',
    kind: 'other',
    date: '2026-10-15',
    method: 'cash',
    amountINR: '5.00',
    evidence: 'cash-123',
  });
  assert.equal(
    rpcForDraft({ id, kind: 'donation', payload: donation })[0],
    'submit_one_time_donation',
  );
});
