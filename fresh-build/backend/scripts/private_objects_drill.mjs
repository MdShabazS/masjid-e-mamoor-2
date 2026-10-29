#!/usr/bin/env node
// Disposable local Storage drill. Requires an empty fresh stack and uses synthetic bytes only.
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { capturePrivateObjects, replayPrivateObjects } from '../backup/private-objects.js';

const backend = fileURLToPath(new URL('../', import.meta.url));
const container = 'supabase_db_masjid-e-mamoor-2-fresh';
const archiveScript = fileURLToPath(new URL('../backup/archive.py', import.meta.url));
const privateCli = fileURLToPath(new URL('./private_objects.mjs', import.meta.url));

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { ...options, maxBuffer: 50 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(`${command}_drill_failed`);
  return result.stdout;
}

function sql(query, database = 'postgres') {
  const result = spawnSync(
    'docker',
    ['exec', '-i', container, 'psql', '-X', '-U', 'postgres', '-d', database, '-Atq', '-c', query],
    { encoding: 'utf8' },
  );
  if (result.status !== 0) throw new Error('disposable_database_unavailable');
  return result.stdout.trim();
}

function counts() {
  return sql(`select (select count(*) from auth.users),
    (select count(*) from public.finance_report_artifacts),
    (select count(*) from public.payment_qr_versions),
    (select count(*) from storage.objects)`);
}

async function main() {
  if (process.env.FRESH_BUILD_TEST_DATABASE_CONFIRM !== 'disposable')
    throw new Error('disposable_database_confirmation_required');
  assert.equal(counts(), '0|0|0|0', 'fresh stack must contain no users, reports, QR or objects');
  const status = JSON.parse(
    execFileSync('supabase', ['status', '-o', 'json'], { cwd: backend, encoding: 'utf8' }),
  );
  assert.equal(status.API_URL, 'http://127.0.0.1:55321');
  const client = createClient(status.API_URL, status.SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const id = randomUUID();
  const restoreDatabase = `mem2_restore_${randomUUID().replaceAll('-', '').slice(0, 20)}`;
  const objects = [
    {
      bucket: 'qr-private',
      path: `payment-qr/${id}.png`,
      bytes: Buffer.from('synthetic-private-qr-image'),
    },
    {
      bucket: 'finance-reports-private',
      path: `${id}/pdf/${id}.pdf`,
      bytes: Buffer.from('synthetic-private-report-pdf'),
    },
  ];
  const temp = await mkdtemp(path.join(os.tmpdir(), 'mem2-private-drill-'));
  try {
    for (const item of objects) {
      const { error } = await client.storage.from(item.bucket).upload(item.path, item.bytes, {
        upsert: false,
        contentType: item.path.endsWith('.png') ? 'image/png' : 'application/pdf',
      });
      if (error) throw new Error('drill_upload_failed');
    }
    const captured = await capturePrivateObjects({ client, directory: path.join(temp, 'capture') });
    assert.equal(captured.length, 2);
    const dump = path.join(temp, 'database.dump');
    await writeFile(
      dump,
      run('docker', [
        'exec',
        '-i',
        container,
        'pg_dump',
        '-Fc',
        '-U',
        'postgres',
        '-d',
        'postgres',
        '-n',
        'public',
        '-n',
        'app_private',
        '-n',
        'auth',
        '-n',
        'storage',
      ]),
      { mode: 0o600 },
    );
    const cert = path.join(temp, 'recovery.pem');
    const key = path.join(temp, 'recovery.key');
    const mac = path.join(temp, 'mac.key');
    await writeFile(mac, randomBytes(32), { mode: 0o600 });
    run('openssl', [
      'req',
      '-x509',
      '-newkey',
      'rsa:2048',
      '-nodes',
      '-subj',
      '/CN=Disposable recovery test',
      '-keyout',
      key,
      '-out',
      cert,
      '-days',
      '1',
    ]);
    const archive = path.join(temp, 'private.cms');
    const maintenanceEnv = {
      ...process.env,
      SUPABASE_URL: status.API_URL,
      SUPABASE_SERVICE_ROLE_KEY: status.SERVICE_ROLE_KEY,
    };
    const backup = JSON.parse(
      run(
        'node',
        [
          privateCli,
          'backup',
          '--dump',
          dump,
          '--certificate',
          cert,
          '--mac-key',
          mac,
          '--output',
          archive,
        ],
        { env: { ...maintenanceEnv, PRIVATE_OBJECT_BACKUP_ENABLED: 'true' }, encoding: 'utf8' },
      ),
    );
    assert.equal(backup.objectCount, 2);
    const staging = path.join(temp, 'verified');
    run('python3', [
      archiveScript,
      'verify',
      '--archive',
      archive,
      '--certificate',
      cert,
      '--private-key',
      key,
      '--mac-key',
      mac,
      '--staging',
      staging,
    ]);
    assert.deepEqual(
      JSON.parse(await readFile(path.join(staging, 'MANIFEST.json'))).objects,
      captured,
    );
    // Restore the database bytes extracted from the encrypted archive into a
    // separate empty database. Never run pg_restore against the source DB.
    const restoreStarted = Date.now();
    run('docker', [
      'exec',
      container,
      'createdb',
      '-U',
      'postgres',
      '-T',
      'template0',
      restoreDatabase,
    ]);
    sql('drop schema public cascade', restoreDatabase);
    run(
      'docker',
      [
        'exec',
        '-i',
        container,
        'pg_restore',
        '-U',
        'postgres',
        '-d',
        restoreDatabase,
        '--no-owner',
        '--no-privileges',
        '--single-transaction',
        '--exit-on-error',
      ],
      { input: await readFile(path.join(staging, 'database.dump')) },
    );
    assert.equal(
      sql(
        `select (select count(*) from auth.users),
        (select count(*) from public.finance_report_artifacts),
        (select count(*) from public.payment_qr_versions),
        (select count(*) from storage.objects)`,
        restoreDatabase,
      ),
      '0|0|0|2',
    );
    const objectPaths = sql(
      "select bucket_id || '/' || name from storage.objects order by bucket_id, name",
      restoreDatabase,
    ).split('\n');
    assert.deepEqual(objectPaths, objects.map((item) => `${item.bucket}/${item.path}`).sort());
    console.log(`Disposable database restore verified in ${Date.now() - restoreStarted} ms.`);
    for (const item of objects) {
      const { error } = await client.storage.from(item.bucket).remove([item.path]);
      if (error) throw new Error('drill_remove_failed');
    }
    const replay = {
      client,
      manifest: { objects: captured },
      objectsRoot: path.join(temp, 'capture', 'objects'),
    };
    assert.deepEqual(await replayPrivateObjects(replay), { objects: 2, missing: 2, uploaded: 0 });
    assert.deepEqual(
      JSON.parse(
        run('node', [privateCli, 'replay', '--staging', staging], {
          env: maintenanceEnv,
          encoding: 'utf8',
        }),
      ),
      { mode: 'dry_run', objects: 2, missing: 2, uploaded: 0 },
    );
    assert.deepEqual(
      JSON.parse(
        run(
          'node',
          [
            privateCli,
            'replay',
            '--staging',
            staging,
            '--apply',
            '--confirm-target',
            status.API_URL,
          ],
          {
            env: { ...maintenanceEnv, PRIVATE_OBJECT_REPLAY_ENABLED: 'true' },
            encoding: 'utf8',
          },
        ),
      ),
      { mode: 'applied', objects: 2, missing: 2, uploaded: 2 },
    );
    assert.deepEqual(await replayPrivateObjects({ ...replay, apply: true }), {
      objects: 2,
      missing: 0,
      uploaded: 0,
    });
    for (const item of objects) {
      const { data, error } = await client.storage.from(item.bucket).download(item.path);
      if (error || !data) throw new Error('drill_readback_failed');
      assert.deepEqual(Buffer.from(await data.arrayBuffer()), item.bytes);
    }
    console.log('Both private buckets captured in an encrypted DB/object archive and replayed.');
  } finally {
    try {
      run('docker', [
        'exec',
        container,
        'dropdb',
        '-U',
        'postgres',
        '--if-exists',
        restoreDatabase,
      ]);
    } catch {
      console.error('Disposable restore database cleanup failed');
    }
    for (const item of objects) {
      const { error } = await client.storage.from(item.bucket).remove([item.path]);
      if (error) console.error('Disposable Storage cleanup failed');
    }
    await rm(temp, { recursive: true, force: true });
  }
  assert.equal(counts(), '0|0|0|0', 'disposable stack must be empty after drill');
  assert.equal(
    sql(`select count(*) from pg_database where datname = '${restoreDatabase}'`),
    '0',
    'disposable restore database must be removed',
  );
  console.log('Final Auth/report/QR/Storage counts: 0|0|0|0');
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
