import assert from 'node:assert/strict';
import { test } from 'node:test';
import { removeStaleQrObject } from './qr-cleanup.js';

const path = 'payment-qr/10000000-0000-4000-8000-000000000001.png';

function fixture({ claim = true, removeError = null, finish = true } = {}) {
  const calls = [];
  const service = {
    rpc: async (name, args) => {
      calls.push([name, args.p_asset_path]);
      return { data: name === 'claim_stale_qr_object' ? claim : finish, error: null };
    },
    storage: {
      from: (bucket) => {
        assert.equal(bucket, 'qr-private');
        return {
          remove: async (paths) => {
            calls.push(['remove', paths[0]]);
            return { error: removeError };
          },
        };
      },
    },
  };
  return { service, calls };
}

test('unreferenced claimed QR is removed through Storage then finalized', async () => {
  const { service, calls } = fixture();
  assert.deepEqual(await removeStaleQrObject(service, path), { state: 'removed', assetPath: path });
  assert.deepEqual(
    calls.map(([name]) => name),
    ['claim_stale_qr_object', 'remove', 'finish_qr_object_cleanup'],
  );
});

test('unclaimed or referenced QR is never sent to Storage removal', async () => {
  const { service, calls } = fixture({ claim: false });
  assert.deepEqual(await removeStaleQrObject(service, path), { state: 'skipped', assetPath: path });
  assert.deepEqual(
    calls.map(([name]) => name),
    ['claim_stale_qr_object'],
  );
});

test('Storage failure retains pending claim for a later retry', async () => {
  const { service, calls } = fixture({
    removeError: new Error('storage unavailable'),
    finish: false,
  });
  await assert.rejects(removeStaleQrObject(service, path), /qr_cleanup_storage_remove_failed/);
  assert.deepEqual(
    calls.map(([name]) => name),
    ['claim_stale_qr_object', 'remove', 'finish_qr_object_cleanup'],
  );
});

test('ambiguous Storage timeout is finalized only when the database sees no object', async () => {
  const { service, calls } = fixture({
    removeError: new Error('response lost after removal'),
    finish: true,
  });
  assert.deepEqual(await removeStaleQrObject(service, path), {
    state: 'removed',
    assetPath: path,
  });
  assert.deepEqual(
    calls.map(([name]) => name),
    ['claim_stale_qr_object', 'remove', 'finish_qr_object_cleanup'],
  );
});

test('unexpected finish result fails closed', async () => {
  const { service } = fixture({ finish: false });
  await assert.rejects(removeStaleQrObject(service, path), /qr_cleanup_finish_failed/);
});

test('invalid path is rejected before any service call', async () => {
  const { service, calls } = fixture();
  await assert.rejects(
    removeStaleQrObject(service, '../payment-qr/x.png'),
    /invalid_qr_cleanup_path/,
  );
  assert.deepEqual(calls, []);
});
