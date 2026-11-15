#!/usr/bin/env node
// Temporary local browser fixture. Press Enter to reset the named disposable database.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { closeSync, openSync, unlinkSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const backend = fileURLToPath(new URL('../', import.meta.url));
const web = fileURLToPath(new URL('../../apps/web/', import.meta.url));
const container = 'supabase_db_masjid-e-mamoor-2-fresh';
const fixturePath = '/private/tmp/masjid-phase7-report-browser-fixture.json';
const port = 18091;

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

async function rpc(client, name, args) {
  const { data, error } = await client.rpc(name, args);
  if (error) throw new Error(`${name}: ${error.code}`);
  return data;
}

if (process.env.FRESH_BUILD_TEST_DATABASE_CONFIRM !== 'disposable')
  throw new Error('Set FRESH_BUILD_TEST_DATABASE_CONFIRM=disposable');
assert.equal(
  sql(
    'select (select count(*) from auth.users),(select count(*) from auth.sessions),(select count(*) from public.app_users),(select count(*) from public.finance_effects),(select count(*) from storage.objects)',
  ),
  '0|0|0|0|0',
);
const status = JSON.parse(
  execFileSync('supabase', ['status', '-o', 'json'], { cwd: backend, encoding: 'utf8' }),
);
assert.equal(status.API_URL, 'http://127.0.0.1:55321');
const admin = createClient(status.API_URL, status.SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const actor = {};
let webServer;
let log;
try {
  for (const role of ['president', 'member']) {
    const username = `report${role}${randomUUID().replaceAll('-', '').slice(0, 12)}`;
    const email = `${username}@accounts.masjid.invalid`;
    const password = `${randomUUID()}Aa1!`;
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error || !data?.user?.id) throw new Error(`create ${role} failed`);
    const id = data.user.id;
    sql(`insert into public.app_users(id,role) values ('${id}','${role}');
insert into app_private.username_aliases(user_id,username,must_change_password)
values ('${id}','${username}',false);`);
    actor[role] = { id, username, email, password };
  }
  const president = createClient(status.API_URL, status.ANON_KEY, {
    auth: { persistSession: false },
  });
  const { error: signInError } = await president.auth.signInWithPassword({
    email: actor.president.email,
    password: actor.president.password,
  });
  if (signInError) throw signInError;
  const accountId = await rpc(president, 'create_finance_account', {
    p_name: 'Synthetic browser report cash',
    p_kind: 'cash',
    p_upi_id: null,
    p_bank_account_number: null,
    p_ifsc: null,
    p_operation_id: randomUUID(),
  });
  const treasurerUsername = `reporttreasurer${randomUUID().replaceAll('-', '').slice(0, 12)}`;
  const treasurerEmail = `${treasurerUsername}@accounts.masjid.invalid`;
  const treasurerPassword = `${randomUUID()}Aa1!`;
  const { data: treasurerData, error: treasurerError } = await admin.auth.admin.createUser({
    email: treasurerEmail,
    password: treasurerPassword,
    email_confirm: true,
  });
  if (treasurerError || !treasurerData?.user?.id) throw new Error('create treasurer failed');
  const treasurerId = treasurerData.user.id;
  sql(`insert into public.app_users(id,role) values ('${treasurerId}','treasurer');
insert into app_private.username_aliases(user_id,username,must_change_password)
values ('${treasurerId}','${treasurerUsername}',false);`);
  const treasurer = createClient(status.API_URL, status.ANON_KEY, {
    auth: { persistSession: false },
  });
  const { error: treasurerSignInError } = await treasurer.auth.signInWithPassword({
    email: treasurerEmail,
    password: treasurerPassword,
  });
  if (treasurerSignInError) throw treasurerSignInError;
  const openingId = await rpc(treasurer, 'submit_account_opening', {
    p_account_id: accountId,
    p_amount_paise: 12345,
    p_evidence_reference: 'Synthetic report browser opening',
    p_operation_id: randomUUID(),
  });
  await rpc(president, 'verify_account_opening', {
    p_opening_id: openingId,
    p_operation_id: randomUUID(),
  });
  await president.auth.signOut();
  await treasurer.auth.signOut();
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(new Date());
  const year = Number(parts.find((part) => part.type === 'year').value);
  const month = Number(parts.find((part) => part.type === 'month').value);
  const start = `${year}-${String(month).padStart(2, '0')}-01`;
  const end = `${month === 12 ? year + 1 : year}-${String(month === 12 ? 1 : month + 1).padStart(2, '0')}-01`;
  writeFileSync(
    fixturePath,
    JSON.stringify({ actor, accountId, start, end, webUrl: `http://127.0.0.1:${port}` }),
    { mode: 0o600 },
  );
  log = openSync('/private/tmp/masjid-phase7-report-browser-web.log', 'w', 0o600);
  webServer = spawn(
    process.execPath,
    ['node_modules/next/dist/bin/next', 'dev', '--webpack', '-p', String(port)],
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
        REPORT_EXPORTS_APPROVED: 'true',
      },
      stdio: ['ignore', log, log],
    },
  );
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (webServer.exitCode !== null) throw new Error('web server exited early');
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/management/report-capabilities`);
      if (response.ok && (await response.json()).exportsApproved === true) {
        ready = true;
        break;
      }
    } catch {
      /* server starting */
    }
    await delay(300);
  }
  if (!ready) throw new Error('web server did not become ready');
  console.log(`Fixture ready at http://127.0.0.1:${port}/login`);
  const input = createInterface({ input: process.stdin, output: process.stdout });
  await input.question(
    'Press Enter after browser checks to reset synthetic users and stop server.\n',
  );
  input.close();
} finally {
  if (webServer) {
    webServer.kill('SIGTERM');
    await delay(500);
    if (webServer.exitCode === null) webServer.kill('SIGKILL');
  }
  if (log !== undefined) closeSync(log);
  try {
    const reset = spawnSync('supabase', ['db', 'reset', '--local', '--no-seed'], {
      cwd: backend,
      encoding: 'utf8',
      env: process.env,
    });
    if (reset.status !== 0) throw new Error(`disposable reset failed: ${reset.stderr.trim()}`);
    console.log(
      `Final synthetic counts: ${sql('select (select count(*) from auth.users),(select count(*) from auth.sessions),(select count(*) from public.app_users),(select count(*) from public.masjid_accounts),(select count(*) from public.finance_effects),(select count(*) from public.finance_report_runs),(select count(*) from storage.objects)')}`,
    );
  } finally {
    try {
      unlinkSync(fixturePath);
    } catch {
      /* absent */
    }
  }
}
