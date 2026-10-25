#!/usr/bin/env node
// Server-side QR object archive and clean-target replay; no browser credentials.
import { spawnSync } from 'node:child_process';
import { access, lstat, mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { captureQrObjects, replayQrObjects } from '../backup/qr-objects.js';

const archiveScript = fileURLToPath(new URL('../backup/archive.py', import.meta.url));

function argument(name) {
  const index = process.argv.indexOf(name);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  return value && !value.startsWith('--') ? value : undefined;
}

function required(name) {
  const value = argument(name);
  if (!value) throw new Error(`missing_${name.slice(2).replaceAll('-', '_')}`);
  return path.resolve(value);
}

async function backup(client) {
  if (process.env.QR_OBJECT_BACKUP_ENABLED !== 'true') throw new Error('qr_object_backup_disabled');
  const dump = required('--dump');
  const certificate = required('--certificate');
  const macKey = required('--mac-key');
  const output = required('--output');
  for (const candidate of [output, `${output}.sha256`, `${output}.hmac`]) {
    try {
      await lstat(candidate);
      throw new Error('backup_output_exists');
    } catch (error) {
      if (error?.message === 'backup_output_exists') throw error;
      if (error?.code !== 'ENOENT') throw error;
    }
  }
  const temp = await mkdtemp(path.join(os.tmpdir(), 'mem2-qr-archive-'));
  try {
    const capture = path.join(temp, 'capture');
    const items = await captureQrObjects({ client, directory: capture });
    const result = spawnSync(
      'python3',
      [
        archiveScript,
        'build',
        '--dump',
        dump,
        '--inventory',
        path.join(capture, 'inventory.json'),
        '--objects',
        path.join(capture, 'objects'),
        '--certificate',
        certificate,
        '--mac-key',
        macKey,
        '--output',
        output,
      ],
      { encoding: 'utf8' },
    );
    if (result.status !== 0) throw new Error('encrypted_qr_archive_failed');
    return { objectCount: items.length, archive: output };
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
}

async function replay(client) {
  const staging = required('--staging');
  const apply = process.argv.includes('--apply');
  if (apply && process.env.QR_OBJECT_REPLAY_ENABLED !== 'true')
    throw new Error('qr_object_replay_disabled');
  if (apply && argument('--confirm-target') !== process.env.SUPABASE_URL)
    throw new Error('exact_replay_target_confirmation_required');
  const manifest = JSON.parse(await readFile(path.join(staging, 'MANIFEST.json'), 'utf8'));
  if (manifest.version !== 1) throw new Error('unsupported_qr_archive');
  await access(path.join(staging, 'database.dump'));
  return {
    mode: apply ? 'applied' : 'dry_run',
    ...(await replayQrObjects({
      client,
      manifest,
      objectsRoot: path.join(staging, 'objects'),
      apply,
    })),
  };
}

async function main() {
  const action = process.argv[2];
  if (!['backup', 'replay'].includes(action)) throw new Error('expected_backup_or_replay');
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY)
    throw new Error('service_credentials_required');
  const client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const result = action === 'backup' ? await backup(client) : await replay(client);
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
