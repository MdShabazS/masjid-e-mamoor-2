import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { lstat, mkdtemp, readFile, rm, symlink, truncate, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { capturePrivateObjects, replayPrivateObjects } from './private-objects.js';

const ID = '11111111-1111-4111-8111-111111111111';
const QR = `payment-qr/${ID}.png`;
const PDF = `${ID}/pdf/${ID}.pdf`;
const CSV = `${ID}/csv/${ID}.csv`;
const qrBytes = Buffer.from('synthetic qr image bytes');
const pdfBytes = Buffer.from('synthetic report pdf bytes');
const csvBytes = Buffer.from('synthetic report csv bytes');

function sha(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function fixture() {
  const objects = new Map([
    [`qr-private/${QR}`, qrBytes],
    [`finance-reports-private/${PDF}`, pdfBytes],
    [`finance-reports-private/${CSV}`, csvBytes],
  ]);
  const uploads = [];
  const buckets = [
    { id: 'qr-private', public: false },
    { id: 'finance-reports-private', public: false },
  ];
  const client = {
    storage: {
      listBuckets: async () => ({ data: buckets, error: null }),
      from(bucket) {
        return {
          async list(prefix, options) {
            const names = new Map();
            for (const key of objects.keys()) {
              if (!key.startsWith(`${bucket}/`)) continue;
              const relative = key.slice(bucket.length + 1);
              if (prefix && !relative.startsWith(`${prefix}/`)) continue;
              const rest = prefix ? relative.slice(prefix.length + 1) : relative;
              if (!rest) continue;
              const [name, ...tail] = rest.split('/');
              names.set(name, { name, id: tail.length ? null : 'file-id' });
            }
            return {
              data: [...names.values()]
                .sort((a, b) => a.name.localeCompare(b.name))
                .slice(options.offset, options.offset + options.limit),
              error: null,
            };
          },
          async download(name) {
            const bytes = objects.get(`${bucket}/${name}`);
            if (!bytes) return { data: null, error: new Error('missing') };
            return { data: new Blob([bytes]), error: null };
          },
          async upload(name, bytes, options) {
            assert.equal(options.upsert, false);
            const key = `${bucket}/${name}`;
            if (objects.has(key)) return { error: new Error('duplicate') };
            objects.set(key, Buffer.from(bytes));
            uploads.push({ key, options });
            return { error: null };
          },
        };
      },
    },
  };
  return { client, objects, uploads, buckets };
}

test('captures every object in both private buckets and replays only missing exact bytes', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'mem2-private-test-'));
  try {
    const { client, objects, uploads } = fixture();
    const capture = path.join(root, 'capture');
    const records = await capturePrivateObjects({ client, directory: capture });
    assert.equal(records.length, 3);
    assert.deepEqual(JSON.parse(await readFile(path.join(capture, 'inventory.json'))), records);
    assert.deepEqual(
      await readFile(path.join(capture, 'objects/finance-reports-private', PDF)),
      pdfBytes,
    );
    assert.equal(records.find((item) => item.path === QR).sha256, sha(qrBytes));
    objects.delete(`finance-reports-private/${PDF}`);
    objects.delete(`qr-private/${QR}`);
    const args = {
      client,
      manifest: { objects: records },
      objectsRoot: path.join(capture, 'objects'),
    };
    assert.deepEqual(await replayPrivateObjects(args), { objects: 3, missing: 2, uploaded: 0 });
    assert.equal(uploads.length, 0);
    assert.deepEqual(await replayPrivateObjects({ ...args, apply: true }), {
      objects: 3,
      missing: 2,
      uploaded: 2,
    });
    assert.deepEqual(objects.get(`qr-private/${QR}`), qrBytes);
    assert.deepEqual(objects.get(`finance-reports-private/${PDF}`), pdfBytes);
    assert.equal(uploads.length, 2);
    assert.deepEqual(await replayPrivateObjects({ ...args, apply: true }), {
      objects: 3,
      missing: 0,
      uploaded: 0,
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('rejects an unknown private bucket and unrecognized paths before capture', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'mem2-private-test-'));
  try {
    const { client, objects, buckets } = fixture();
    buckets.push({ id: 'new-private', public: false });
    await assert.rejects(
      capturePrivateObjects({ client, directory: path.join(root, 'one') }),
      /private_backup_bucket_set_changed/,
    );
    buckets.pop();
    objects.set('qr-private/unexpected.txt', Buffer.from('orphan'));
    await assert.rejects(
      capturePrivateObjects({ client, directory: path.join(root, 'two') }),
      /private_backup_invalid_path/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('rejects same-path content changes before packaging the capture', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'mem2-private-test-'));
  try {
    const { client, objects } = fixture();
    const originalFrom = client.storage.from;
    let changed = false;
    let downloads = 0;
    client.storage.from = (bucket) => {
      const handle = originalFrom(bucket);
      return {
        ...handle,
        async download(name, options, parameters) {
          assert.deepEqual(options, {});
          assert.deepEqual(parameters, { cache: 'no-store' });
          downloads++;
          const response = await handle.download(name);
          if (bucket === 'qr-private' && name === QR && !changed) {
            objects.set(`finance-reports-private/${PDF}`, Buffer.from('changed report bytes'));
            changed = true;
          }
          return response;
        },
      };
    };
    const capture = path.join(root, 'capture');
    await assert.rejects(
      capturePrivateObjects({ client, directory: capture }),
      /private_backup_object_mismatch/,
    );
    assert.equal(changed, true);
    assert.ok(downloads > 3);
    await assert.rejects(lstat(capture), { code: 'ENOENT' });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('refuses unexpected target objects, corrupt archive bytes, and mismatched existing bytes', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'mem2-private-test-'));
  try {
    const { client, objects, uploads } = fixture();
    const capture = path.join(root, 'capture');
    const records = await capturePrivateObjects({ client, directory: capture });
    const args = {
      client,
      manifest: { objects: records },
      objectsRoot: path.join(capture, 'objects'),
      apply: true,
    };
    objects.set(
      `finance-reports-private/${ID}/pdf/22222222-2222-4222-8222-222222222222.pdf`,
      Buffer.from('extra'),
    );
    await assert.rejects(replayPrivateObjects(args), /private_replay_unexpected_target_object/);
    objects.delete(`finance-reports-private/${ID}/pdf/22222222-2222-4222-8222-222222222222.pdf`);
    objects.set(`qr-private/${QR}`, Buffer.from('corrupt'));
    await assert.rejects(replayPrivateObjects(args), /private_backup_object_mismatch/);
    objects.set(`qr-private/${QR}`, qrBytes);
    await writeFile(path.join(capture, 'objects/finance-reports-private', CSV), 'corrupt');
    await assert.rejects(replayPrivateObjects(args), /private_backup_file_mismatch/);
    assert.equal(uploads.length, 0);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('rejects manifest drift before any upload', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'mem2-private-test-'));
  try {
    const { client, uploads } = fixture();
    const capture = path.join(root, 'capture');
    const records = await capturePrivateObjects({ client, directory: capture });
    const args = { client, objectsRoot: path.join(capture, 'objects'), apply: true };
    await assert.rejects(
      replayPrivateObjects({ ...args, manifest: { objects: records.slice().reverse() } }),
      /private_backup_invalid_manifest/,
    );
    await assert.rejects(
      replayPrivateObjects({ ...args, manifest: { objects: [{ ...records[0], path: '../bad' }] } }),
      /private_backup_invalid_manifest/,
    );
    await assert.rejects(
      replayPrivateObjects({
        ...args,
        manifest: { objects: [{ ...records[0], bucket: '__proto__' }] },
      }),
      /private_backup_invalid_manifest/,
    );
    assert.equal(uploads.length, 0);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('rejects oversized remote and archive objects before loading their bytes', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'mem2-private-test-'));
  try {
    const { client } = fixture();
    let readOversized = false;
    const originalFrom = client.storage.from;
    client.storage.from = (bucket) => {
      const handle = originalFrom(bucket);
      if (bucket !== 'qr-private') return handle;
      return {
        ...handle,
        async download(name) {
          if (name !== QR) return handle.download(name);
          return {
            data: {
              size: 5 * 1024 * 1024 + 1,
              async arrayBuffer() {
                readOversized = true;
                throw new Error('oversized bytes should not be read');
              },
            },
            error: null,
          };
        },
      };
    };
    await assert.rejects(
      capturePrivateObjects({ client, directory: path.join(root, 'oversized-capture') }),
      /private_backup_object_size/,
    );
    assert.equal(readOversized, false);

    client.storage.from = originalFrom;
    const capture = path.join(root, 'capture');
    const records = await capturePrivateObjects({ client, directory: capture });
    await truncate(path.join(capture, 'objects/qr-private', QR), 5 * 1024 * 1024 + 1);
    await assert.rejects(
      replayPrivateObjects({
        client,
        manifest: { objects: records },
        objectsRoot: path.join(capture, 'objects'),
      }),
      /private_backup_file_mismatch/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('rejects a symlinked archive root and requires explicit CLI mutation flags', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'mem2-private-test-'));
  try {
    const { client } = fixture();
    const capture = path.join(root, 'capture');
    const records = await capturePrivateObjects({ client, directory: capture });
    const link = path.join(root, 'linked-objects');
    await symlink(path.join(capture, 'objects'), link);
    await assert.rejects(
      replayPrivateObjects({ client, manifest: { objects: records }, objectsRoot: link }),
      /private_backup_symlink/,
    );
    const { spawnSync } = await import('node:child_process');
    const { fileURLToPath } = await import('node:url');
    const script = fileURLToPath(new URL('../scripts/private_objects.mjs', import.meta.url));
    const env = {
      ...process.env,
      SUPABASE_URL: 'http://127.0.0.1:55321',
      SUPABASE_SERVICE_ROLE_KEY: 'synthetic-test-only',
    };
    const backup = spawnSync(process.execPath, [script, 'backup'], { env, encoding: 'utf8' });
    assert.equal(backup.status, 1);
    assert.match(backup.stderr, /private_object_backup_disabled/);
    const replay = spawnSync(process.execPath, [script, 'replay', '--staging', root, '--apply'], {
      env,
      encoding: 'utf8',
    });
    assert.equal(replay.status, 1);
    assert.match(replay.stderr, /private_object_replay_disabled/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
