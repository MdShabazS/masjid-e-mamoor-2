import { createHash } from 'node:crypto';
import { lstat, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const BUCKETS = {
  'finance-reports-private': {
    pattern: new RegExp(`^${UUID}/(csv/${UUID}\\.csv|pdf/${UUID}\\.pdf)$`),
    maxBytes: 15_000_000,
  },
  'qr-private': {
    pattern: new RegExp(`^payment-qr/${UUID}\\.(png|jpg|jpeg)$`),
    maxBytes: 5 * 1024 * 1024,
  },
};
const PAGE = 500;
const MAX_OBJECTS = 10_000;
const MAX_TOTAL_BYTES = 2_000_000_000;
const SEGMENT = /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/;

function hash(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function validPath(bucket, name) {
  return (
    typeof bucket === 'string' &&
    Object.hasOwn(BUCKETS, bucket) &&
    typeof name === 'string' &&
    BUCKETS[bucket].pattern.test(name) &&
    name.split('/').every((part) => SEGMENT.test(part))
  );
}

function contentType(name) {
  if (name.endsWith('.png')) return 'image/png';
  if (name.endsWith('.jpg') || name.endsWith('.jpeg')) return 'image/jpeg';
  if (name.endsWith('.pdf')) return 'application/pdf';
  if (name.endsWith('.csv')) return 'text/csv';
  throw new Error('private_backup_invalid_type');
}

async function assertBuckets(client) {
  if (!client?.storage?.listBuckets || !client.storage.from)
    throw new Error('private_backup_client_unavailable');
  const { data, error } = await client.storage.listBuckets();
  if (error || !Array.isArray(data)) throw new Error('private_backup_buckets_unavailable');
  const privateNames = data
    .filter((item) => item.public === false)
    .map((item) => item.id)
    .sort();
  if (JSON.stringify(privateNames) !== JSON.stringify(Object.keys(BUCKETS).sort()))
    throw new Error('private_backup_bucket_set_changed');
}

async function inventoryBucket(client, bucketName) {
  const bucket = client.storage.from(bucketName);
  const found = [];
  const pending = [''];
  while (pending.length) {
    const prefix = pending.pop();
    for (let offset = 0; ; offset += PAGE) {
      if (offset > MAX_OBJECTS) throw new Error('private_backup_inventory_limit');
      const { data, error } = await bucket.list(prefix, {
        limit: PAGE,
        offset,
        sortBy: { column: 'name', order: 'asc' },
      });
      if (error || !Array.isArray(data)) throw new Error('private_backup_inventory_unavailable');
      for (const entry of data) {
        if (!SEGMENT.test(entry?.name ?? '')) throw new Error('private_backup_invalid_path');
        const name = prefix ? `${prefix}/${entry.name}` : entry.name;
        if (entry.id === null) {
          if (name.split('/').length > 3) throw new Error('private_backup_invalid_depth');
          pending.push(name);
        } else if (typeof entry.id === 'string' && entry.id) {
          if (!validPath(bucketName, name)) throw new Error('private_backup_invalid_path');
          found.push(name);
        } else throw new Error('private_backup_invalid_entry');
        if (found.length + pending.length > MAX_OBJECTS)
          throw new Error('private_backup_inventory_limit');
      }
      if (data.length < PAGE) break;
    }
  }
  found.sort();
  if (new Set(found).size !== found.length) throw new Error('private_backup_duplicate_path');
  return found;
}

async function inventory(client) {
  await assertBuckets(client);
  const items = [];
  for (const bucket of Object.keys(BUCKETS)) {
    for (const name of await inventoryBucket(client, bucket)) items.push({ bucket, path: name });
  }
  if (items.length > MAX_OBJECTS) throw new Error('private_backup_inventory_limit');
  return items;
}

async function remoteBytes(client, item) {
  const { data, error } = await client.storage.from(item.bucket).download(item.path);
  if (error || !data) throw new Error('private_backup_object_missing');
  const bytes = Buffer.from(await data.arrayBuffer());
  if (bytes.length < 1 || bytes.length > BUCKETS[item.bucket].maxBytes)
    throw new Error('private_backup_object_size');
  if (item.bytes !== undefined && (item.bytes !== bytes.length || item.sha256 !== hash(bytes)))
    throw new Error('private_backup_object_mismatch');
  return bytes;
}

async function archiveBytes(root, item) {
  if ((await lstat(root)).isSymbolicLink()) throw new Error('private_backup_symlink');
  let current = root;
  for (const segment of [item.bucket, ...item.path.split('/')]) {
    current = path.join(current, segment);
    if ((await lstat(current)).isSymbolicLink()) throw new Error('private_backup_symlink');
  }
  const bytes = await readFile(current);
  if (bytes.length !== item.bytes || hash(bytes) !== item.sha256)
    throw new Error('private_backup_file_mismatch');
  return bytes;
}

function manifestRecords(manifest) {
  const items = manifest?.objects;
  if (!Array.isArray(items) || items.length > MAX_OBJECTS)
    throw new Error('private_backup_invalid_manifest');
  let total = 0;
  let previous = '';
  for (const item of items) {
    if (
      !item ||
      Object.keys(item).sort().join(',') !== 'bucket,bytes,path,sha256' ||
      !validPath(item.bucket, item.path) ||
      !Number.isInteger(item.bytes) ||
      item.bytes < 1 ||
      item.bytes > BUCKETS[item.bucket].maxBytes ||
      !/^[0-9a-f]{64}$/.test(item.sha256)
    )
      throw new Error('private_backup_invalid_manifest');
    const key = `${item.bucket}/${item.path}`;
    if (key <= previous) throw new Error('private_backup_invalid_manifest');
    previous = key;
    total += item.bytes;
    if (total > MAX_TOTAL_BYTES) throw new Error('private_backup_size_limit');
  }
  return items;
}

export async function capturePrivateObjects({ client, directory }) {
  const initial = await inventory(client);
  await mkdir(directory, { mode: 0o700 });
  try {
    const items = [];
    let total = 0;
    for (const item of initial) {
      const bytes = await remoteBytes(client, item);
      total += bytes.length;
      if (total > MAX_TOTAL_BYTES) throw new Error('private_backup_size_limit');
      const record = { ...item, sha256: hash(bytes), bytes: bytes.length };
      const destination = path.join(directory, 'objects', item.bucket, ...item.path.split('/'));
      await mkdir(path.dirname(destination), { recursive: true, mode: 0o700 });
      await writeFile(destination, bytes, { flag: 'wx', mode: 0o600 });
      items.push(record);
    }
    if (JSON.stringify(await inventory(client)) !== JSON.stringify(initial))
      throw new Error('private_backup_inventory_changed');
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

export async function replayPrivateObjects({ client, manifest, objectsRoot, apply = false }) {
  const expected = manifestRecords(manifest);
  const present = await inventory(client);
  const known = new Map(expected.map((item) => [`${item.bucket}/${item.path}`, item]));
  if (present.some((item) => !known.has(`${item.bucket}/${item.path}`)))
    throw new Error('private_replay_unexpected_target_object');
  for (const item of expected) await archiveBytes(objectsRoot, item);
  for (const item of present) await remoteBytes(client, known.get(`${item.bucket}/${item.path}`));
  const existing = new Set(present.map((item) => `${item.bucket}/${item.path}`));
  const missing = expected.filter((item) => !existing.has(`${item.bucket}/${item.path}`));
  if (!apply) return { objects: expected.length, missing: missing.length, uploaded: 0 };
  for (const item of missing) {
    const bytes = await archiveBytes(objectsRoot, item);
    const { error } = await client.storage.from(item.bucket).upload(item.path, bytes, {
      contentType: contentType(item.path),
      upsert: false,
    });
    if (error) throw new Error('private_replay_upload_failed');
    await remoteBytes(client, item);
  }
  const actual = await inventory(client);
  if (
    JSON.stringify(actual) !==
    JSON.stringify(expected.map(({ bucket, path: name }) => ({ bucket, path: name })))
  )
    throw new Error('private_replay_target_changed');
  return { objects: expected.length, missing: missing.length, uploaded: missing.length };
}
