#!/usr/bin/env node
// Disposable local integration check of the actual Next.js private CSV route.
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { closeSync, openSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const backend = fileURLToPath(new URL('../', import.meta.url));
const root = fileURLToPath(new URL('../../', import.meta.url));
const container = 'supabase_db_masjid-e-mamoor-2-fresh';
const route = 'http://127.0.0.1:18089/api/management/report-csv';

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

async function main() {
  if (process.env.FRESH_BUILD_TEST_DATABASE_CONFIRM !== 'disposable')
    throw new Error('Set FRESH_BUILD_TEST_DATABASE_CONFIRM=disposable');
  assert.equal(
    sql(
      'select (select count(*) from auth.users),(select count(*) from public.finance_effects),(select count(*) from storage.objects)',
    ),
    '0|0|0',
  );
  const status = JSON.parse(
    execFileSync('supabase', ['status', '-o', 'json'], {
      cwd: backend,
      encoding: 'utf8',
    }),
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
      const email = `phase7csv-${role}-${randomUUID()}@fixture.invalid`;
      const password = `${randomUUID()}Aa1!`;
      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (createError || !created?.user?.id) throw new Error(`create ${role} failed`);
      const id = created.user.id;
      assert.match(id, /^[0-9a-f-]{36}$/i);
      sql(`insert into public.app_users(id,role) values ('${id}','${role}');
insert into app_private.username_aliases(user_id,username,must_change_password)
values ('${id}','phase7csv${role}${id.slice(0, 8)}',false);`);
      const client = createClient(status.API_URL, status.ANON_KEY, {
        auth: { persistSession: false },
      });
      const { data: login, error: loginError } = await client.auth.signInWithPassword({
        email,
        password,
      });
      if (loginError || !login?.session?.access_token) throw new Error(`sign in ${role} failed`);
      actors[role] = { id, token: login.session.access_token, client };
    }
    const accountId = await rpc(actors.president.client, 'create_finance_account', {
      p_name: 'Synthetic CSV report cash',
      p_kind: 'cash',
      p_upi_id: null,
      p_bank_account_number: null,
      p_ifsc: null,
      p_operation_id: randomUUID(),
    });
    const openingId = await rpc(actors.treasurer.client, 'submit_account_opening', {
      p_account_id: accountId,
      p_amount_paise: 12345,
      p_evidence_reference: 'Synthetic CSV opening',
      p_operation_id: randomUUID(),
    });
    await rpc(actors.president.client, 'verify_account_opening', {
      p_opening_id: openingId,
      p_operation_id: randomUUID(),
    });
    const now = new Date();
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
    }).formatToParts(now);
    const year = Number(parts.find((part) => part.type === 'year').value);
    const monthNumber = Number(parts.find((part) => part.type === 'month').value);
    const start = `${year}-${String(monthNumber).padStart(2, '0')}-01`;
    const nextYear = monthNumber === 12 ? year + 1 : year;
    const nextMonth = monthNumber === 12 ? 1 : monthNumber + 1;
    const end = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;
    const runId = await rpc(actors.president.client, 'request_finance_report', {
      p_kind: 'month',
      p_start: start,
      p_end_exclusive: end,
      p_include_proofs: false,
      p_operation_id: randomUUID(),
    });
    assert.match(runId, /^[0-9a-f-]{36}$/i);

    log = openSync('/private/tmp/masjid-phase7-csv-web.log', 'w', 0o600);
    server = spawn(
      'npm',
      ['run', 'start', '--workspace=@masjid/fresh-web', '--', '--hostname', '127.0.0.1'],
      {
        cwd: root,
        env: {
          ...process.env,
          PORT: '18089',
          SUPABASE_URL: status.API_URL,
          SUPABASE_PUBLISHABLE_KEY: status.ANON_KEY,
          SUPABASE_SERVICE_ROLE_KEY: status.SERVICE_ROLE_KEY,
          REPORT_EXPORTS_APPROVED: 'true',
        },
        stdio: ['ignore', log, log],
      },
    );
    let ready = false;
    for (let attempt = 0; attempt < 60; attempt++) {
      if (server.exitCode !== null) throw new Error('web server exited early');
      try {
        const probe = await fetch(route);
        if (probe.status === 400) {
          ready = true;
          break;
        }
      } catch {
        // The built local web server may still be starting.
      }
      await delay(250);
    }
    if (!ready) throw new Error('report CSV web route did not become ready');
    const read = (role, id = runId) =>
      fetch(`${route}?runId=${id}`, {
        headers: role ? { Authorization: `Bearer ${actors[role].token}` } : {},
      });
    assert.equal((await read(null)).status, 401);
    assert.equal((await read('member')).status, 403);
    assert.equal((await read('president', 'invalid')).status, 400);
    for (const role of ['president', 'treasurer']) {
      const response = await read(role);
      assert.equal(response.status, 200, `${role} CSV download`);
      assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
      const bytes = Buffer.from(await response.arrayBuffer());
      assert.equal(
        response.headers.get('X-Report-SHA256'),
        createHash('sha256').update(bytes).digest('hex'),
      );
      const csv = bytes.toString('utf8');
      assert.match(csv, /"123\.45"/);
      assert.match(csv, new RegExp(runId));
      assert.match(csv, new RegExp(accountId));
    }
    sql(
      `update app_private.username_aliases set must_change_password=true where user_id='${actors.treasurer.id}'`,
    );
    assert.equal((await read('treasurer')).status, 403, 'temporary-password gate');
    sql(`update public.app_users set role='member' where id='${actors.president.id}'`);
    assert.equal((await read('president')).status, 403, 'live role change');
    assert.equal(sql('select count(*) from storage.objects'), '0');
    console.log(
      'issued-session CSV HTTP: two exact downloads/digests, anonymous/member denial, password gate, live role change and no Storage objects passed',
    );
  } finally {
    if (server && server.exitCode === null) {
      const exited = new Promise((resolve) => server.once('exit', resolve));
      server.kill('SIGTERM');
      await Promise.race([exited, delay(5000)]);
    }
    if (log !== undefined) closeSync(log);
    const reset = spawnSync('supabase', ['db', 'reset', '--local', '--no-seed'], {
      cwd: backend,
      encoding: 'utf8',
      env: process.env,
    });
    if (reset.status !== 0) throw new Error(`disposable reset failed: ${reset.stderr.trim()}`);
    console.log('fresh local database reset completed after CSV HTTP test');
  }
}

await main();
