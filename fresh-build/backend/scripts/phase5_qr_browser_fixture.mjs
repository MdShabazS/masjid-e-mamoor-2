#!/usr/bin/env node
// Disposable local browser fixture. Press Enter to remove all synthetic data.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { closeSync, openSync, writeFileSync, unlinkSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const backend = fileURLToPath(new URL('../', import.meta.url));
const web = fileURLToPath(new URL('../../apps/web/', import.meta.url));
const fixturePath = '/private/tmp/masjid-phase5-qr-browser-fixture.json';
const imagePath = '/private/tmp/masjid-phase5-qr-browser.png';
const webPort = 18089;
const container = 'supabase_db_masjid-e-mamoor-2-fresh';
function sql(query) {
  const result = spawnSync(
    'docker',
    [
      'exec',
      '-i',
      container,
      'psql',
      '-X',
      '-U',
      'postgres',
      '-d',
      'postgres',
      '-v',
      'ON_ERROR_STOP=1',
      '-Atq',
    ],
    { input: query, encoding: 'utf8' },
  );
  if (result.status !== 0) throw new Error(result.stderr.trim());
  return result.stdout.trim();
}
if (process.env.FRESH_BUILD_TEST_DATABASE_CONFIRM !== 'disposable')
  throw new Error('Set FRESH_BUILD_TEST_DATABASE_CONFIRM=disposable');
assert.equal(
  sql(
    'select (select count(*) from auth.users),(select count(*) from public.payment_qr_versions),(select count(*) from storage.objects)',
  ),
  '0|0|0',
);
const status = JSON.parse(
  execFileSync('supabase', ['status', '-o', 'json'], { cwd: backend, encoding: 'utf8' }),
);
assert.match(status.API_URL, /^http:\/\/127\.0\.0\.1:55321$/);
const admin = createClient(status.API_URL, status.SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const actors = {};
let webServer;
let webLog;
try {
  for (const role of ['president', 'treasurer']) {
    const password = `${randomUUID()}Aa1!`;
    const username = `qr${role}${randomUUID().replaceAll('-', '').slice(0, 12)}`;
    const email = `${username}@accounts.masjid.invalid`;
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error || !data?.user?.id) throw new Error(`create ${role} failed`);
    const id = data.user.id;
    sql(
      `insert into public.app_users(id,role) values ('${id}','${role}'); insert into app_private.username_aliases(user_id,username,must_change_password) values ('${id}','${username}',false);`,
    );
    actors[role] = { id, email, password, username };
  }
  const president = createClient(status.API_URL, status.ANON_KEY, {
    auth: { persistSession: false },
  });
  const { error: loginError } = await president.auth.signInWithPassword({
    email: actors.president.email,
    password: actors.president.password,
  });
  if (loginError) throw loginError;
  const { data: accountId, error: accountError } = await president.rpc('create_finance_account', {
    p_name: 'Synthetic browser QR account',
    p_kind: 'upi',
    p_upi_id: 'synthetic@bank',
    p_bank_account_number: null,
    p_ifsc: null,
    p_operation_id: randomUUID(),
  });
  if (accountError || !accountId)
    throw new Error(`create account failed: ${accountError?.message}`);
  await president.auth.signOut();
  execFileSync('swift', ['scripts/phase5_synthetic_qr.swift'], { cwd: backend, stdio: 'ignore' });
  writeFileSync(
    fixturePath,
    JSON.stringify({ actors, accountId, imagePath, webUrl: `http://localhost:${webPort}` }),
    { mode: 0o600 },
  );
  webLog = openSync('/private/tmp/masjid-phase5-qr-browser-web.log', 'w');
  webServer = spawn(
    process.execPath,
    ['node_modules/next/dist/bin/next', 'dev', '--webpack', '-p', String(webPort)],
    {
      cwd: web,
      env: {
        ...process.env,
        NEXT_PUBLIC_SUPABASE_URL: status.API_URL,
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: status.ANON_KEY,
        SUPABASE_URL: status.API_URL,
        SUPABASE_PUBLISHABLE_KEY: status.ANON_KEY,
        SUPABASE_SERVICE_ROLE_KEY: status.SERVICE_ROLE_KEY,
        IDENTITY_INTERNAL_DOMAIN: 'accounts.masjid.invalid',
      },
      stdio: ['ignore', webLog, webLog],
    },
  );
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (webServer.exitCode !== null) throw new Error('web server exited');
    try {
      if ((await fetch(`http://localhost:${webPort}/login`)).status === 200) {
        ready = true;
        break;
      }
    } catch {
      /* starting */
    }
    await delay(300);
  }
  if (!ready) throw new Error('web server not ready');
  console.log(`Fixture ready: http://localhost:${webPort}/login`);
  const input = createInterface({ input: process.stdin, output: process.stdout });
  await input.question('Press Enter to clean up synthetic users, QR and server.\n');
  input.close();
} finally {
  if (webServer) {
    webServer.kill('SIGTERM');
    await delay(500);
    if (webServer.exitCode === null) webServer.kill('SIGKILL');
  }
  if (webLog !== undefined) closeSync(webLog);
  try {
    const reset = spawnSync('supabase', ['db', 'reset', '--local', '--no-seed'], {
      cwd: backend,
      encoding: 'utf8',
    });
    if (reset.status !== 0) throw new Error(`disposable reset failed: ${reset.stderr.trim()}`);
    console.log(
      `Final counts: ${sql('select (select count(*) from auth.users),(select count(*) from public.payment_qr_versions),(select count(*) from storage.objects)')}`,
    );
  } finally {
    try {
      unlinkSync(fixturePath);
    } catch {
      /* absent */
    }
    try {
      unlinkSync(imagePath);
    } catch {
      /* absent */
    }
  }
}
