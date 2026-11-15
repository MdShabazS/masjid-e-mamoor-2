import assert from 'node:assert/strict';
import test from 'node:test';
import { runQueueTick } from './tick.js';

test('tick denies absent/short secret before RPC and calls only queue functions', async () => {
  const secret = 'private-cron-token-more-than-32-bytes';
  let calls = 0;
  const client = {
    rpc: async (name) => {
      calls++;
      assert.match(name, /^(dispatch_first_friday_monthly_requests|queue_due_)/);
      return { data: 0 };
    },
  };
  await assert.rejects(
    () => runQueueTick({ authorization: 'Bearer wrong', secret, client }),
    /job_unauthorized/,
  );
  assert.equal(calls, 0);
  const result = await runQueueTick({ authorization: `Bearer ${secret}`, secret, client });
  assert.equal(calls, 4);
  assert.equal(Object.keys(result).length, 4);
});

test('storage failure stops tick without reporting success', async () => {
  const secret = 'private-cron-token-more-than-32-bytes';
  await assert.rejects(
    () =>
      runQueueTick({
        authorization: `Bearer ${secret}`,
        secret,
        client: { rpc: async () => ({ error: { message: 'offline' } }) },
      }),
    /job_storage_unavailable/,
  );
});
