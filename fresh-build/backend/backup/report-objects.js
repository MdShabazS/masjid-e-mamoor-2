import { createHash } from 'node:crypto';
import { lstat, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const BUCKET = 'finance-reports-private';
const MAX_BYTES = 15_000_000;
const PAGE = 500;
const MAX_ARTIFACTS = 10_000;
const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const PATH = new RegExp(`^(${UUID})/(csv|pdf)/(${UUID})\\.\\2$`);

function digest(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function record(row) {
  const name = row.object_path;
  const match = PATH.exec(name ?? '');
  if (
    row.status !== 'ready' ||
    !match ||
    match[1] !== row.run_id ||
    match[2] !== row.format ||
    !/^[0-9a-f]{64}$/.test(row.sha256 ?? '') ||
    !Number.isInteger(row.byte_count) ||
    row.byte_count < 1 ||
    row.byte_count > MAX_BYTES
  )
    throw new Error('invalid_ready_report_artifact');
  return { bucket: BUCKET, path: name, sha256: row.sha256, bytes: row.byte_count };
}

async function readyRecords(client) {
  if (!client?.from || !client?.storage) throw new Error('report_backup_client_unavailable');
  const rows = [];
  for (let start = 0; start <= MAX_ARTIFACTS; start += PAGE) {
    const { data, error } = await client
      .from('finance_report_artifacts')
      .select('run_id,format,status,object_path,sha256,byte_count')
      .eq('status', 'ready')
      .order('run_id')
      .order('format')
      .range(start, start + PAGE - 1);
    if (error || !Array.isArray(data)) throw new Error('report_backup_inventory_unavailable');
    rows.push(...data);
    if (data.length < PAGE) break;
    if (rows.length >= MAX_ARTIFACTS) throw new Error('report_backup_inventory_limit');
  }
  const records = rows.map(record);
  if (new Set(records.map((item) => item.path)).size !== records.length)
    throw new Error('duplicate_report_artifact_path');
  return records;
}

async function storedBytes(bucket, item) {
  const { data, error } = await bucket.download(item.path);
  if (error || !data) throw new Error('report_backup_object_missing');
  const bytes = Buffer.from(await data.arrayBuffer());
  if (bytes.length !== item.bytes || digest(bytes) !== item.sha256)
    throw new Error('report_backup_object_mismatch');
  return bytes;
}

async function fileBytes(root, item) {
  const relative = path.join(item.bucket, ...item.path.split('/'));
  let current = root;
  for (const part of relative.split(path.sep)) {
    current = path.join(current, part);
    const stat = await lstat(current);
    if (stat.isSymbolicLink()) throw new Error('report_backup_symlink');
  }
  const bytes = await readFile(current);
  if (bytes.length !== item.bytes || digest(bytes) !== item.sha256)
    throw new Error('report_backup_file_mismatch');
  return bytes;
}

function assertManifest(records, expected) {
  if (
    !Array.isArray(records) ||
    records.length !== expected.length ||
    records.length > MAX_ARTIFACTS ||
    records.some(
      (item, i) =>
        !item ||
        Object.keys(item).sort().join(',') !== 'bucket,bytes,path,sha256' ||
        item.bucket !== expected[i].bucket ||
        item.path !== expected[i].path ||
        item.sha256 !== expected[i].sha256 ||
        item.bytes !== expected[i].bytes,
    )
  )
    throw new Error('report_backup_manifest_drift');
}

export async function captureReadyReportObjects({ client, directory }) {
  const expected = await readyRecords(client);
  await mkdir(directory, { mode: 0o700 });
  try {
    const root = path.join(directory, 'objects');
    const bucket = client.storage.from(BUCKET);
    for (const item of expected) {
      const bytes = await storedBytes(bucket, item);
      const destination = path.join(root, item.bucket, ...item.path.split('/'));
      await mkdir(path.dirname(destination), { recursive: true, mode: 0o700 });
      await writeFile(destination, bytes, { flag: 'wx', mode: 0o600 });
    }
    assertManifest(await readyRecords(client), expected);
    await writeFile(path.join(directory, 'inventory.json'), JSON.stringify(expected), {
      flag: 'wx',
      mode: 0o600,
    });
    return expected;
  } catch (error) {
    await rm(directory, { recursive: true, force: true });
    throw error;
  }
}

export async function replayReadyReportObjects({ client, manifest, objectsRoot, apply = false }) {
  const expected = await readyRecords(client);
  assertManifest(manifest?.objects, expected);
  const bucket = client.storage.from(BUCKET);
  const missing = [];
  for (const item of expected) {
    await fileBytes(objectsRoot, item);
    const prefix = item.path.slice(0, item.path.lastIndexOf('/'));
    const { data, error } = await bucket.list(prefix, { limit: 100, offset: 0 });
    if (error || !Array.isArray(data) || data.length >= 100)
      throw new Error('report_replay_storage_inspection_failed');
    if (data.some((entry) => `${prefix}/${entry.name}` === item.path))
      await storedBytes(bucket, item);
    else missing.push(item);
  }
  if (!apply) return { ready: expected.length, missing: missing.length, uploaded: 0 };
  for (const item of missing) {
    const bytes = await fileBytes(objectsRoot, item);
    const { error } = await bucket.upload(item.path, bytes, {
      contentType: item.path.endsWith('.pdf') ? 'application/pdf' : 'text/csv',
      upsert: false,
    });
    if (error) throw new Error('report_replay_upload_failed');
    await storedBytes(bucket, item);
  }
  assertManifest(await readyRecords(client), expected);
  return { ready: expected.length, missing: missing.length, uploaded: missing.length };
}
