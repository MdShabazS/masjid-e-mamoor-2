import { createHash } from 'node:crypto';
import { lstat, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const BUCKET = 'qr-private';
const PREFIX = 'payment-qr';
const PAGE = 500;
const MAX_OBJECTS = 10_000;
const MAX_BYTES = 5 * 1024 * 1024;
const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const OBJECT_PATH = new RegExp(`^${PREFIX}/${UUID}\\.(png|jpg|jpeg)$`);

function digest(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function validRecord(item) {
  return (
    item &&
    Object.keys(item).sort().join(',') === 'bucket,bytes,path,sha256' &&
    item.bucket === BUCKET &&
    OBJECT_PATH.test(item.path) &&
    /^[0-9a-f]{64}$/.test(item.sha256) &&
    Number.isInteger(item.bytes) &&
    item.bytes > 0 &&
    item.bytes <= MAX_BYTES
  );
}

async function paths(bucket) {
  const found = [];
  for (let offset = 0; offset <= MAX_OBJECTS; offset += PAGE) {
    const { data, error } = await bucket.list(PREFIX, {
      limit: PAGE,
      offset,
      sortBy: { column: 'name', order: 'asc' },
    });
    if (error || !Array.isArray(data)) throw new Error('qr_backup_inventory_unavailable');
    for (const entry of data) {
      const name = `${PREFIX}/${entry?.name ?? ''}`;
      if (!OBJECT_PATH.test(name)) throw new Error('qr_backup_invalid_object_path');
      found.push(name);
    }
    if (found.length > MAX_OBJECTS) throw new Error('qr_backup_inventory_limit');
    if (data.length < PAGE) break;
  }
  found.sort();
  if (new Set(found).size !== found.length) throw new Error('qr_backup_duplicate_path');
  return found;
}

async function remoteBytes(bucket, item) {
  const { data, error } = await bucket.download(item.path);
  if (error || !data) throw new Error('qr_backup_object_missing');
  const bytes = Buffer.from(await data.arrayBuffer());
  if (bytes.length !== item.bytes || digest(bytes) !== item.sha256)
    throw new Error('qr_backup_object_mismatch');
  return bytes;
}

async function fileBytes(root, item) {
  let current = root;
  for (const segment of [BUCKET, ...item.path.split('/')]) {
    current = path.join(current, segment);
    if ((await lstat(current)).isSymbolicLink()) throw new Error('qr_backup_symlink');
  }
  const bytes = await readFile(current);
  if (bytes.length !== item.bytes || digest(bytes) !== item.sha256)
    throw new Error('qr_backup_file_mismatch');
  return bytes;
}

function records(manifest) {
  const items = manifest?.objects;
  if (
    !Array.isArray(items) ||
    items.length > MAX_OBJECTS ||
    items.some((item) => !validRecord(item)) ||
    items.some((item, index) => index > 0 && items[index - 1].path >= item.path)
  )
    throw new Error('qr_backup_invalid_manifest');
  return items;
}

export async function captureQrObjects({ client, directory }) {
  if (!client?.storage) throw new Error('qr_backup_client_unavailable');
  const bucket = client.storage.from(BUCKET);
  const initial = await paths(bucket);
  await mkdir(directory, { mode: 0o700 });
  try {
    const items = [];
    for (const name of initial) {
      const { data, error } = await bucket.download(name);
      if (error || !data) throw new Error('qr_backup_object_missing');
      const bytes = Buffer.from(await data.arrayBuffer());
      if (bytes.length < 1 || bytes.length > MAX_BYTES) throw new Error('qr_backup_object_size');
      const item = { bucket: BUCKET, path: name, sha256: digest(bytes), bytes: bytes.length };
      const destination = path.join(directory, 'objects', BUCKET, ...name.split('/'));
      await mkdir(path.dirname(destination), { recursive: true, mode: 0o700 });
      await writeFile(destination, bytes, { flag: 'wx', mode: 0o600 });
      items.push(item);
    }
    if (JSON.stringify(await paths(bucket)) !== JSON.stringify(initial))
      throw new Error('qr_backup_inventory_changed');
    await writeFile(path.join(directory, 'inventory.json'), JSON.stringify(items), {
      flag: 'wx',
      mode: 0o600,
    });
    return items;
  } catch (error) {
    await rm(directory, { recursive: true, force: true });
    throw error;
  }
}

export async function replayQrObjects({ client, manifest, objectsRoot, apply = false }) {
  if (!client?.storage) throw new Error('qr_backup_client_unavailable');
  const expected = records(manifest);
  const bucket = client.storage.from(BUCKET);
  const present = await paths(bucket);
  const known = new Map(expected.map((item) => [item.path, item]));
  if (present.some((name) => !known.has(name)))
    throw new Error('qr_replay_unexpected_target_object');
  // Validate every archive file and existing target object before any upload.
  for (const item of expected) await fileBytes(objectsRoot, item);
  for (const name of present) await remoteBytes(bucket, known.get(name));
  const existing = new Set(present);
  const missing = expected.filter((item) => !existing.has(item.path));
  if (!apply) return { objects: expected.length, missing: missing.length, uploaded: 0 };
  for (const item of missing) {
    const bytes = await fileBytes(objectsRoot, item);
    const { error } = await bucket.upload(item.path, bytes, {
      contentType: item.path.endsWith('.png') ? 'image/png' : 'image/jpeg',
      upsert: false,
    });
    if (error) throw new Error('qr_replay_upload_failed');
    await remoteBytes(bucket, item);
  }
  if (JSON.stringify(await paths(bucket)) !== JSON.stringify(expected.map((item) => item.path)))
    throw new Error('qr_replay_target_changed');
  return { objects: expected.length, missing: missing.length, uploaded: missing.length };
}
