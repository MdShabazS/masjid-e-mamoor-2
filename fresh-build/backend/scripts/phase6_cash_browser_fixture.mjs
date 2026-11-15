#!/usr/bin/env node
// Local browser fixture. Press Enter to reset its disposable database and stop the server.
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
const fixturePath = '/private/tmp/masjid-phase6-cash-browser-fixture.json';
const port = 18092;
function sql(query) {
  const result = spawnSync(
    'docker',
    [
      'exec',
      '-i',
      'supabase_db_masjid-e-mamoor-2-fresh',
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
    'select (select count(*) from auth.users),(select count(*) from public.app_users),(select count(*) from public.finance_effects)',
  ),
  '0|0|0',
);
const status = JSON.parse(
  execFileSync('supabase', ['status', '-o', 'json'], { cwd: backend, encoding: 'utf8' }),
);
assert.equal(status.API_URL, 'http://127.0.0.1:55321');
const admin = createClient(status.API_URL, status.SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const actors = {};
let server;
let log;
try {
  for (const role of ['president', 'treasurer', 'member']) {
    const username = `cashbrowser${role}${randomUUID().replaceAll('-', '').slice(0, 8)}`;
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
    actors[role] = { id, username, password };
  }
  const president = createClient(status.API_URL, status.ANON_KEY, {
    auth: { persistSession: false },
  });
  const treasurer = createClient(status.API_URL, status.ANON_KEY, {
    auth: { persistSession: false },
  });
  for (const [client, role] of [
    [president, 'president'],
    [treasurer, 'treasurer'],
  ]) {
    const { error } = await client.auth.signInWithPassword({
      email: `${actors[role].username}@accounts.masjid.invalid`,
      password: actors[role].password,
    });
    if (error) throw error;
  }
  const accountId = await rpc(president, 'create_finance_account', {
    p_name: 'Synthetic browser collection cash',
    p_kind: 'cash',
    p_upi_id: null,
    p_bank_account_number: null,
    p_ifsc: null,
    p_operation_id: randomUUID(),
  });
  const openingId = await rpc(treasurer, 'submit_account_opening', {
    p_account_id: accountId,
    p_amount_paise: 10000,
    p_evidence_reference: 'Synthetic browser cash opening',
    p_operation_id: randomUUID(),
  });
  await rpc(president, 'verify_account_opening', {
    p_opening_id: openingId,
    p_operation_id: randomUUID(),
  });
  await president.auth.signOut();
  await treasurer.auth.signOut();
  writeFileSync(
    fixturePath,
    JSON.stringify({ actors, accountId, webUrl: `http://localhost:${port}` }),
    { mode: 0o600 },
  );
  log = openSync('/private/tmp/masjid-phase6-cash-browser-web.log', 'w', 0o600);
  server = spawn(
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
      },
      stdio: ['ignore', log, log],
    },
  );
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (server.exitCode !== null) throw new Error('web server exited early');
    try {
      if ((await fetch(`http://127.0.0.1:${port}/login`)).status === 200) {
        ready = true;
        break;
      }
    } catch {
      // Wait for the local server.
    }
    await delay(300);
  }
  if (!ready) throw new Error('web server did not become ready');
  console.log(`Fixture ready at http://localhost:${port}/login`);
  const input = createInterface({ input: process.stdin, output: process.stdout });
  await input.question(
    'Press Enter after browser checks to reset synthetic users and stop the server.\n',
  );
  input.close();
} finally {
  if (server) {
    server.kill('SIGTERM');
    await delay(500);
    if (server.exitCode === null) server.kill('SIGKILL');
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
      `Final synthetic counts: ${sql('select (select count(*) from auth.users),(select count(*) from auth.sessions),(select count(*) from public.app_users),(select count(*) from public.finance_effects),(select count(*) from public.cash_task_counts),(select count(*) from public.cash_slip_claims),(select count(*) from storage.objects)')}`,
    );
  } finally {
    try {
      unlinkSync(fixturePath);
    } catch {
      /* absent */
    }
  }
}
