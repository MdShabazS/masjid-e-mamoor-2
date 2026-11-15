import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { captureQrObjects, replayQrObjects } from './qr-objects.js';

const imagePath = 'payment-qr/10000000-0000-4000-8000-000000000001.png';
const image = Buffer.from('synthetic PNG bytes');

function fixture() {
  const objects = new Map([[imagePath, image]]);
  const calls = [];
  const bucket = {
    async list(prefix, { limit, offset }) {
      assert.equal(prefix, 'payment-qr');
      calls.push(['list', offset]);
      return {
        data: [...objects.keys()]
          .sort()
          .slice(offset, offset + limit)
          .map((name) => ({ name: name.slice(prefix.length + 1) })),
        error: null,
      };
    },
    async download(name) {
      calls.push(['download', name]);
      const bytes = objects.get(name);
      return bytes
        ? { data: new Blob([bytes]), error: null }
        : { data: null, error: new Error('missing') };
    },
    async upload(name, bytes, options) {
      calls.push(['upload', name, options]);
      if (objects.has(name)) return { error: new Error('duplicate') };
      objects.set(name, Buffer.from(bytes));
      return { error: null };
    },
  };
  return {
    client: { storage: { from: (name) => (assert.equal(name, 'qr-private'), bucket) } },
    objects,
    calls,
  };
}

test('capture and replay exact private QR bytes without overwrite', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'mem2-qr-backup-test-'));
  try {
    const { client, objects, calls } = fixture();
    const directory = path.join(root, 'capture');
    const items = await captureQrObjects({ client, directory });
    assert.equal(items.length, 1);
    assert.deepEqual(await readFile(path.join(directory, 'objects/qr-private', imagePath)), image);
    objects.delete(imagePath);
    const args = {
      client,
      manifest: { objects: items },
      objectsRoot: path.join(directory, 'objects'),
    };
    assert.deepEqual(await replayQrObjects(args), { objects: 1, missing: 1, uploaded: 0 });
    assert.deepEqual(await replayQrObjects({ ...args, apply: true }), {
      objects: 1,
      missing: 1,
      uploaded: 1,
    });
    assert.deepEqual(objects.get(imagePath), image);
    assert.equal(calls.filter(([name]) => name === 'upload').length, 1);
    assert.equal(calls.find(([name]) => name === 'upload')[2].upsert, false);
    assert.deepEqual(await replayQrObjects({ ...args, apply: true }), {
      objects: 1,
      missing: 0,
      uploaded: 0,
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('capture rejects unexpected QR paths and removes partial plaintext', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'mem2-qr-backup-test-'));
  try {
    const { client, objects } = fixture();
    objects.set('payment-qr/../bad.png', Buffer.from('bad'));
    const directory = path.join(root, 'capture');
    await assert.rejects(captureQrObjects({ client, directory }), /qr_backup_invalid_object_path/);
    await assert.rejects(readFile(path.join(directory, 'inventory.json')));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('replay rejects archive tampering, extra target objects and mismatched existing bytes', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'mem2-qr-backup-test-'));
  try {
    const { client, objects, calls } = fixture();
    const directory = path.join(root, 'capture');
    const items = await captureQrObjects({ client, directory });
    const args = {
      client,
      manifest: { objects: items },
      objectsRoot: path.join(directory, 'objects'),
      apply: true,
    };
    objects.set(imagePath, Buffer.from('wrong'));
    await assert.rejects(replayQrObjects(args), /qr_backup_object_mismatch/);
    objects.set(imagePath, image);
    objects.set('payment-qr/20000000-0000-4000-8000-000000000002.jpg', Buffer.from('extra'));
    await assert.rejects(replayQrObjects(args), /qr_replay_unexpected_target_object/);
    objects.delete('payment-qr/20000000-0000-4000-8000-000000000002.jpg');
    objects.delete(imagePath);
    const file = path.join(directory, 'objects/qr-private', imagePath);
    await writeFile(file, 'tampered');
    await assert.rejects(replayQrObjects(args), /qr_backup_file_mismatch/);
    assert.equal(
      calls.some(([name]) => name === 'upload'),
      false,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('replay rejects symlinked archive bytes and malformed manifest', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'mem2-qr-backup-test-'));
  try {
    const { client, objects } = fixture();
    const directory = path.join(root, 'capture');
    const items = await captureQrObjects({ client, directory });
    objects.delete(imagePath);
    const args = {
      client,
      manifest: { objects: items },
      objectsRoot: path.join(directory, 'objects'),
      apply: true,
    };
    await assert.rejects(
      replayQrObjects({ ...args, manifest: { objects: [{ ...items[0], path: '../escape' }] } }),
      /qr_backup_invalid_manifest/,
    );
    const file = path.join(directory, 'objects/qr-private', imagePath);
    await rm(file);
    const alternate = path.join(root, 'alternate.png');
    await writeFile(alternate, image);
    await symlink(alternate, file);
    await assert.rejects(replayQrObjects(args), /qr_backup_symlink/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('QR archive CLI requires explicit backup and target replay flags', () => {
  const script = fileURLToPath(new URL('../scripts/qr_objects.mjs', import.meta.url));
  const env = {
    ...process.env,
    SUPABASE_URL: 'http://127.0.0.1:55321',
    SUPABASE_SERVICE_ROLE_KEY: 'synthetic',
  };
  const run = (args, override = {}) =>
    spawnSync(process.execPath, [script, ...args], {
      env: { ...env, ...override },
      encoding: 'utf8',
    });
  assert.match(run(['backup']).stderr, /qr_object_backup_disabled/);
  assert.match(
    run(['replay', '--apply', '--staging', '/tmp/none']).stderr,
    /qr_object_replay_disabled/,
  );
  assert.match(
    run(['replay', '--apply', '--staging', '/tmp/none', '--confirm-target', 'wrong'], {
      QR_OBJECT_REPLAY_ENABLED: 'true',
    }).stderr,
    /exact_replay_target_confirmation_required/,
  );
});
