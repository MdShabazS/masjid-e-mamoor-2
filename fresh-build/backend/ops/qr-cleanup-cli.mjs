#!/usr/bin/env node
// Review backend/ops/qr_orphan_inventory.sql before selecting a path.
import { createClient } from '@supabase/supabase-js';
import { removeStaleQrObject } from './qr-cleanup.js';

const [assetPath, mode] = process.argv.slice(2);
if (!assetPath || (mode && mode !== '--execute')) {
  throw new Error('Usage: node backend/ops/qr-cleanup-cli.mjs <asset-path> [--execute]');
}
if (!mode) {
  console.log(JSON.stringify({ state: 'dry_run', assetPath }));
} else {
  if (process.env.QR_CLEANUP_CONFIRM_PATH !== assetPath)
    throw new Error('Set QR_CLEANUP_CONFIRM_PATH to the exact reviewed asset path.');
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase service connection is not configured.');
  const service = createClient(url, key, { auth: { persistSession: false } });
  console.log(JSON.stringify(await removeStaleQrObject(service, assetPath)));
}
