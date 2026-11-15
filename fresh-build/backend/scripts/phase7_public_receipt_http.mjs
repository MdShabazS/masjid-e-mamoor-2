#!/usr/bin/env node
// Disposable local end-to-end test of the explicitly enabled public receipt route.
import assert from 'node:assert/strict';
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { closeSync, openSync, readFileSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const backend = fileURLToPath(new URL('../', import.meta.url));
const root = fileURLToPath(new URL('../../', import.meta.url));
const container = 'supabase_db_masjid-e-mamoor-2-fresh';
const route = 'http://127.0.0.1:18090/api/public/receipt';

function sql(query) {
  const result = spawnSync('docker', ['exec', '-i', container, 'psql', '-X', '-U', 'postgres',
    '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-Atq'], { input: query, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`SQL fixture failed: ${result.stderr.trim()}`);
  return result.stdout.trim();
}

async function main() {
  if (process.env.FRESH_BUILD_TEST_DATABASE_CONFIRM !== 'disposable')
    throw new Error('Set FRESH_BUILD_TEST_DATABASE_CONFIRM=disposable');
  assert.equal(sql('select (select count(*) from auth.users),(select count(*) from public.finance_effects),(select count(*) from storage.objects)'), '0|0|0');
  const status = JSON.parse(execFileSync('supabase', ['status', '-o', 'json'], {
    cwd: backend, encoding: 'utf8',
  }));
  assert.equal(status.API_URL, 'http://127.0.0.1:55321');
  let server;
  let log;
  try {
    const fixture = readFileSync(`${backend}/tests/phase7_report.sql`, 'utf8');
    assert.match(fixture, /\brollback;\s*$/i);
    sql(fixture.replace(/\brollback;\s*$/i, 'commit;'));
    const codes = sql(`select
      (select code from public.monthly_receipts limit 1),
      (select receipt_code::text from public.one_time_donations where donor_name='Report Donor'),
      (select receipt_code::text from public.one_time_donations where donor_name='Later donor'),
      (select r.code from public.finance_correction_receipts r join public.finance_corrections c
        on c.id=r.correction_id where c.reason='Counted cash revised'),
      (select r.code from public.finance_correction_receipts r join public.finance_corrections c
        on c.id=r.correction_id where c.reason='Later count revision')`).split('|');
    assert.equal(codes.length, 5);
    log = openSync('/private/tmp/masjid-phase7-public-receipt-web.log', 'w', 0o600);
    server = spawn('npm', ['run', 'start', '--workspace=@masjid/fresh-web', '--', '--hostname', '127.0.0.1'], {
      cwd: root,
      env: { ...process.env, PORT: '18090', SUPABASE_URL: status.API_URL,
        SUPABASE_SERVICE_ROLE_KEY: status.SERVICE_ROLE_KEY,
        PUBLIC_RECEIPT_LOOKUP_APPROVED: 'true' },
      stdio: ['ignore', log, log],
    });
    let ready = false;
    for (let attempt = 0; attempt < 60; attempt++) {
      if (server.exitCode !== null) throw new Error('web server exited early');
      try {
        const probe = await fetch('http://127.0.0.1:18090/receipt');
        if (probe.status === 200 && (await probe.text()).includes('Verify receipt')) {
          ready = true;
          break;
        }
      } catch {
        // Server is still starting.
      }
      await delay(250);
    }
    if (!ready) throw new Error('public receipt web page did not become ready');
    const lookup = (code) => fetch(route, { method: 'POST',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code }) });
    for (const [code, amountINR] of [[codes[0], '30.00'], [codes[2], '5.00'], [codes[4], '8.00']]) {
      const response = await lookup(code);
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('cache-control'), 'no-store');
      const result = await response.json();
      assert.equal(result.status, 'verified');
      assert.equal(result.amountINR, amountINR);
      assert.match(result.date, /^\d{4}-\d{2}-\d{2}$/);
      assert.deepEqual(Object.keys(result).sort(), ['amountINR', 'date', 'status']);
    }
    for (const code of [codes[1], codes[3], 'MEM2-R-' + 'A'.repeat(32)]) {
      const response = await lookup(code);
      assert.equal(response.status, 404);
      assert.deepEqual(await response.json(), { error: { code: 'RECEIPT_NOT_FOUND' } });
    }
    for (let attempt = 0; attempt < 4; attempt++) assert.equal((await lookup(codes[0])).status, 200);
    assert.equal((await lookup(codes[0])).status, 429, 'sixth same-code request is throttled');
    assert.equal(sql('select count(*) from storage.objects'), '0');
    console.log('public receipt HTTP: three active amounts/dates, void/superseded/unknown generic response, same-code throttle, no Storage objects passed');
  } finally {
    if (server && server.exitCode === null) {
      const exited = new Promise((resolve) => server.once('exit', resolve));
      server.kill('SIGTERM');
      await Promise.race([exited, delay(5000)]);
    }
    if (log !== undefined) closeSync(log);
    const reset = spawnSync('supabase', ['db', 'reset', '--local', '--no-seed'], {
      cwd: backend, encoding: 'utf8', env: process.env,
    });
    if (reset.status !== 0) throw new Error(`disposable reset failed: ${reset.stderr.trim()}`);
    console.log('fresh local database reset completed after public receipt HTTP test');
  }
}

await main();
