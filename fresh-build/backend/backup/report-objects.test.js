import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { captureReadyReportObjects, replayReadyReportObjects } from './report-objects.js';

const runId = 'd6134c9b-47bb-4f8e-9b5d-c288f12afe51';
const lease = '17b65226-7537-4adf-83e8-57cf5b6aa250';
const csvPath = `${runId}/csv/${lease}.csv`;
const pdfPath = `${runId}/pdf/${lease}.pdf`;
const bytesFor = {
  [csvPath]: Buffer.from('a,b\n1,2\n'),
  [pdfPath]: Buffer.from('%PDF-1.4 fixture'),
};

function fixture() {
  const objects = new Map(Object.entries(bytesFor));
  const rows = Object.entries(bytesFor).map(([object_path, bytes]) => ({
    run_id: runId,
    format: object_path.endsWith('.csv') ? 'csv' : 'pdf',
    status: 'ready',
    object_path,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    byte_count: bytes.length,
  }));
  const calls = [];
  const bucket = {
    async download(name) {
      calls.push(['download', name]);
      const bytes = objects.get(name);
      return bytes
        ? { data: new Blob([bytes]), error: null }
        : { data: null, error: new Error('missing') };
    },
    async list(prefix) {
      calls.push(['list', prefix]);
      return {
        data: [...objects.keys()]
          .filter((name) => name.startsWith(`${prefix}/`))
          .map((name) => ({ name: name.slice(prefix.length + 1) })),
        error: null,
      };
    },
    async upload(name, bytes, options) {
      calls.push(['upload', name, options]);
      if (objects.has(name)) return { error: new Error('duplicate') };
      objects.set(name, Buffer.from(bytes));
      return { error: null };
    },
  };
  const client = {
    from(table) {
      assert.equal(table, 'finance_report_artifacts');
      return {
        select: () => ({
          eq: () => ({
            order: () => ({
              order: () => ({
                range: async (start, end) => ({
                  data: rows.filter((row) => row.status === 'ready').slice(start, end + 1),
                  error: null,
                }),
              }),
            }),
          }),
        }),
      };
    },
    storage: { from: (name) => (assert.equal(name, 'finance-reports-private'), bucket) },
  };
  return { client, objects, rows, calls };
}

test('capture and replay only missing ready objects with exact bytes and no overwrite', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'mem2-report-backup-test-'));
  try {
    const { client, objects, calls } = fixture();
    const directory = path.join(root, 'capture');
    const inventory = await captureReadyReportObjects({ client, directory });
    assert.equal(inventory.length, 2);
    assert.equal(
      (await readFile(path.join(directory, 'objects/finance-reports-private', csvPath))).toString(),
      'a,b\n1,2\n',
    );
    objects.delete(csvPath);
    const manifest = { objects: inventory };
    assert.deepEqual(
      await replayReadyReportObjects({
        client,
        manifest,
        objectsRoot: path.join(directory, 'objects'),
      }),
      { ready: 2, missing: 1, uploaded: 0 },
    );
    assert.equal(objects.has(csvPath), false);
    assert.deepEqual(
      await replayReadyReportObjects({
        client,
        manifest,
        objectsRoot: path.join(directory, 'objects'),
        apply: true,
      }),
      { ready: 2, missing: 1, uploaded: 1 },
    );
    assert.deepEqual(objects.get(csvPath), bytesFor[csvPath]);
    assert.equal(calls.filter(([name]) => name === 'upload').length, 1);
    assert.equal(calls.find(([name]) => name === 'upload')[2].upsert, false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('capture refuses corrupt bytes and removes partial plaintext', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'mem2-report-backup-test-'));
  try {
    const { client, objects } = fixture();
    objects.set(pdfPath, Buffer.from('corrupt'));
    const directory = path.join(root, 'capture');
    await assert.rejects(
      captureReadyReportObjects({ client, directory }),
      /report_backup_object_mismatch/,
    );
    await assert.rejects(readFile(path.join(directory, 'inventory.json')));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('replay rejects changed metadata, altered archive bytes and remote mismatch before upload', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'mem2-report-backup-test-'));
  try {
    const { client, objects, rows, calls } = fixture();
    const directory = path.join(root, 'capture');
    const inventory = await captureReadyReportObjects({ client, directory });
    const manifest = { objects: inventory };
    objects.delete(csvPath);
    rows[0].sha256 = 'a'.repeat(64);
    await assert.rejects(
      replayReadyReportObjects({
        client,
        manifest,
        objectsRoot: path.join(directory, 'objects'),
        apply: true,
      }),
      /report_backup_manifest_drift/,
    );
    rows[0].sha256 = inventory[0].sha256;
    const local = path.join(directory, 'objects/finance-reports-private', csvPath);
    await writeFile(local, 'tampered');
    await assert.rejects(
      replayReadyReportObjects({
        client,
        manifest,
        objectsRoot: path.join(directory, 'objects'),
        apply: true,
      }),
      /report_backup_file_mismatch/,
    );
    await writeFile(local, bytesFor[csvPath]);
    objects.set(pdfPath, Buffer.from('wrong-existing-object'));
    await assert.rejects(
      replayReadyReportObjects({
        client,
        manifest,
        objectsRoot: path.join(directory, 'objects'),
        apply: true,
      }),
      /report_backup_object_mismatch/,
    );
    assert.equal(
      calls.some(([name]) => name === 'upload'),
      false,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('backup and replay CLI mutations require explicit flags and target', () => {
  const script = fileURLToPath(new URL('../scripts/report_artifact_objects.mjs', import.meta.url));
  const env = {
    ...process.env,
    SUPABASE_URL: 'http://127.0.0.1:55321',
    SUPABASE_SERVICE_ROLE_KEY: 'synthetic-key',
  };
  const run = (args, override = {}) =>
    spawnSync(process.execPath, [script, ...args], {
      env: { ...env, ...override },
      encoding: 'utf8',
    });
  assert.match(run(['backup']).stderr, /report_artifact_backup_disabled/);
  assert.match(
    run(['replay', '--apply', '--staging', '/tmp/none']).stderr,
    /report_artifact_replay_disabled/,
  );
  assert.match(
    run(['replay', '--apply', '--staging', '/tmp/none', '--confirm-target', 'wrong'], {
      REPORT_ARTIFACT_REPLAY_ENABLED: 'true',
    }).stderr,
    /exact_replay_target_confirmation_required/,
  );
});

test('replay refuses symlinked archive bytes before any upload', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'mem2-report-backup-test-'));
  try {
    const { client, objects, calls } = fixture();
    const directory = path.join(root, 'capture');
    const inventory = await captureReadyReportObjects({ client, directory });
    objects.delete(csvPath);
    const local = path.join(directory, 'objects/finance-reports-private', csvPath);
    await rm(local);
    const alternate = path.join(root, 'other.csv');
    await writeFile(alternate, bytesFor[csvPath]);
    await symlink(alternate, local);
    await assert.rejects(
      replayReadyReportObjects({
        client,
        manifest: { objects: inventory },
        objectsRoot: path.join(directory, 'objects'),
        apply: true,
      }),
      /report_backup_symlink/,
    );
    assert.equal(
      calls.some(([name]) => name === 'upload'),
      false,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
