#!/usr/bin/env node
// Disposable local issued-session check of the private report artifact lifecycle.
import assert from 'node:assert/strict';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { closeSync, openSync, writeFileSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import {
  inspectReportArtifactRecovery,
  recoverReportArtifact,
} from '../reports/artifact-recovery.js';

const backend = fileURLToPath(new URL('../', import.meta.url));
const root = fileURLToPath(new URL('../../', import.meta.url));
const container = 'supabase_db_masjid-e-mamoor-2-fresh';
const base = 'http://127.0.0.1:18092';
const cronSecret = 'synthetic-report-worker-secret-32-characters';

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
  if (error) throw new Error(`${name}: ${error.code} ${error.message}`);
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
  let runId;
  let backupTemp;
  try {
    for (const role of ['president', 'treasurer', 'member']) {
      const email = `phase7artifact-${role}-${randomUUID()}@fixture.invalid`;
      const password = `${randomUUID()}Aa1!`;
      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (createError || !created?.user?.id) throw new Error(`create ${role} failed`);
      const id = created.user.id;
      sql(`insert into public.app_users(id,role) values ('${id}','${role}');
insert into app_private.username_aliases(user_id,username,must_change_password)
values ('${id}','phase7artifact${role}${id.slice(0, 8)}',false);`);
      const client = createClient(status.API_URL, status.ANON_KEY, {
        auth: { persistSession: false },
      });
      const { data: signedIn, error: signInError } = await client.auth.signInWithPassword({
        email,
        password,
      });
      if (signInError || !signedIn?.session?.access_token)
        throw new Error(`sign in ${role} failed`);
      actors[role] = { id, token: signedIn.session.access_token, client };
    }
    const accountId = await rpc(actors.president.client, 'create_finance_account', {
      p_name: 'Artifact synthetic cash',
      p_kind: 'cash',
      p_upi_id: null,
      p_bank_account_number: null,
      p_ifsc: null,
      p_operation_id: randomUUID(),
    });
    const openingId = await rpc(actors.treasurer.client, 'submit_account_opening', {
      p_account_id: accountId,
      p_amount_paise: 12345,
      p_evidence_reference: 'Synthetic artifact opening',
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
    const month = Number(parts.find((part) => part.type === 'month').value);
    const start = `${year}-${String(month).padStart(2, '0')}-01`;
    const end = `${month === 12 ? year + 1 : year}-${String(month === 12 ? 1 : month + 1).padStart(2, '0')}-01`;
    runId = await rpc(actors.president.client, 'request_finance_report', {
      p_kind: 'month',
      p_start: start,
      p_end_exclusive: end,
      p_include_proofs: false,
      p_operation_id: randomUUID(),
    });

    log = openSync('/private/tmp/masjid-phase7-artifact-web.log', 'w', 0o600);
    server = spawn(
      'npm',
      ['run', 'start', '--workspace=@masjid/fresh-web', '--', '--hostname', '127.0.0.1'],
      {
        cwd: root,
        env: {
          ...process.env,
          PORT: '18092',
          SUPABASE_URL: status.API_URL,
          SUPABASE_PUBLISHABLE_KEY: status.ANON_KEY,
          SUPABASE_SERVICE_ROLE_KEY: status.SERVICE_ROLE_KEY,
          QUEUE_CRON_SECRET: cronSecret,
          REPORT_EXPORTS_APPROVED: 'true',
          REPORT_ARTIFACT_WORKER_ENABLED: 'true',
        },
        stdio: ['ignore', log, log],
      },
    );
    let ready = false;
    for (let attempt = 0; attempt < 60; attempt++) {
      if (server.exitCode !== null) throw new Error('web server exited early');
      try {
        if ((await fetch(`${base}/api/management/report-pdf`)).status === 400) {
          ready = true;
          break;
        }
      } catch {
        /* server is starting */
      }
      await delay(250);
    }
    if (!ready) throw new Error('artifact web route did not become ready');
    const read = (format, role) =>
      fetch(`${base}/api/management/report-${format}?runId=${runId}`, {
        headers: role ? { Authorization: `Bearer ${actors[role].token}` } : {},
      });
    assert.equal((await read('pdf', 'president')).status, 202);
    assert.equal((await read('csv', 'president')).status, 202);
    assert.equal((await read('pdf', 'member')).status, 403);
    assert.equal((await read('csv', null)).status, 401);
    const tick = () =>
      fetch(`${base}/api/jobs/report-artifacts/tick`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${cronSecret}` },
      });
    assert.equal(
      (await fetch(`${base}/api/jobs/report-artifacts/tick`, { method: 'POST' })).status,
      403,
    );
    for (const format of ['csv', 'pdf']) {
      const response = await tick();
      assert.equal(response.status, 200, `worker tick ${format}`);
      const body = await response.json();
      assert.deepEqual(body.artifact, { runId, format, status: 'ready' });
    }
    const artifactStatus = await rpc(actors.president.client, 'finance_report_artifact_status', {
      p_run_id: runId,
    });
    assert.deepEqual(
      artifactStatus.map((row) => [row.format, row.status]),
      [
        ['csv', 'ready'],
        ['pdf', 'ready'],
      ],
    );
    const { error: memberStatusError } = await actors.member.client.rpc(
      'finance_report_artifact_status',
      {
        p_run_id: runId,
      },
    );
    assert.equal(memberStatusError?.code, '42501');
    for (const format of ['csv', 'pdf']) {
      const response = await read(format, 'president');
      assert.equal(response.status, 200);
      const bytes = Buffer.from(await response.arrayBuffer());
      assert.equal(
        response.headers.get('X-Report-SHA256'),
        createHash('sha256').update(bytes).digest('hex'),
      );
      if (format === 'csv') assert.match(bytes.toString(), /"123\.45"/);
      else assert.match(bytes.toString('latin1', 0, 8), /%PDF/);
    }
    assert.equal(
      sql("select count(*) from storage.objects where bucket_id='finance-reports-private'"),
      '2',
    );
    const objects = sql(
      "select name from storage.objects where bucket_id='finance-reports-private' order by name",
    ).split('\n');
    const { error: directDownloadError } = await actors.member.client.storage
      .from('finance-reports-private')
      .download(objects[0]);
    assert.ok(directDownloadError, 'Member cannot fetch a private object directly');

    backupTemp = await mkdtemp('/private/tmp/mem2-report-artifact-drill-');
    const cert = `${backupTemp}/recovery.pem`;
    const key = `${backupTemp}/recovery.key`;
    const mac = `${backupTemp}/mac.key`;
    const dump = `${backupTemp}/database.dump`;
    const encrypted = `${backupTemp}/report.cms`;
    const staging = `${backupTemp}/verified`;
    const certificate = spawnSync(
      'openssl',
      [
        'req',
        '-x509',
        '-newkey',
        'rsa:2048',
        '-nodes',
        '-subj',
        '/CN=Local report drill',
        '-keyout',
        key,
        '-out',
        cert,
        '-days',
        '1',
      ],
      { encoding: 'utf8' },
    );
    if (certificate.status !== 0) throw new Error('synthetic recovery certificate failed');
    writeFileSync(mac, randomBytes(32), { mode: 0o600 });
    const dumpResult = spawnSync(
      'docker',
      [
        'exec',
        '-i',
        container,
        'pg_dump',
        '-U',
        'postgres',
        '-Fc',
        '-d',
        'postgres',
        '--schema=public',
        '--schema=auth',
        '--schema=storage',
        '--schema=app_private',
      ],
      { maxBuffer: 64 * 1024 * 1024 },
    );
    if (dumpResult.status !== 0 || !dumpResult.stdout.subarray(0, 5).equals(Buffer.from('PGDMP')))
      throw new Error('synthetic custom-format database dump failed');
    writeFileSync(dump, dumpResult.stdout, { mode: 0o600 });
    const archiveEnv = {
      ...process.env,
      SUPABASE_URL: status.API_URL,
      SUPABASE_SERVICE_ROLE_KEY: status.SERVICE_ROLE_KEY,
      REPORT_ARTIFACT_BACKUP_ENABLED: 'true',
    };
    const archive = spawnSync(
      process.execPath,
      [
        'backend/scripts/report_artifact_objects.mjs',
        'backup',
        '--dump',
        dump,
        '--certificate',
        cert,
        '--mac-key',
        mac,
        '--output',
        encrypted,
      ],
      { cwd: root, env: archiveEnv, encoding: 'utf8' },
    );
    if (archive.status !== 0) throw new Error(`encrypted object capture failed: ${archive.stderr}`);
    assert.equal(JSON.parse(archive.stdout).objectCount, 2);
    const verified = spawnSync(
      'python3',
      [
        'backend/backup/archive.py',
        'verify',
        '--archive',
        encrypted,
        '--certificate',
        cert,
        '--private-key',
        key,
        '--mac-key',
        mac,
        '--staging',
        staging,
      ],
      { cwd: root, encoding: 'utf8' },
    );
    if (verified.status !== 0)
      throw new Error(`encrypted archive verification failed: ${verified.stderr}`);
    const manifest = JSON.parse(await readFile(`${staging}/MANIFEST.json`, 'utf8'));
    assert.equal(manifest.objects.length, 2);
    for (const objectPath of objects) {
      const { error } = await admin.storage.from('finance-reports-private').remove([objectPath]);
      assert.equal(error, null);
    }
    const replayArgs = [
      'backend/scripts/report_artifact_objects.mjs',
      'replay',
      '--staging',
      staging,
    ];
    const preview = spawnSync(process.execPath, replayArgs, {
      cwd: root,
      env: archiveEnv,
      encoding: 'utf8',
    });
    if (preview.status !== 0) throw new Error(`report replay preview failed: ${preview.stderr}`);
    assert.deepEqual(JSON.parse(preview.stdout), {
      mode: 'dry_run',
      ready: 2,
      missing: 2,
      uploaded: 0,
    });
    const replay = spawnSync(
      process.execPath,
      [...replayArgs, '--apply', '--confirm-target', status.API_URL],
      {
        cwd: root,
        env: { ...archiveEnv, REPORT_ARTIFACT_REPLAY_ENABLED: 'true' },
        encoding: 'utf8',
      },
    );
    if (replay.status !== 0) throw new Error(`report object replay failed: ${replay.stderr}`);
    assert.deepEqual(JSON.parse(replay.stdout), {
      mode: 'applied',
      ready: 2,
      missing: 2,
      uploaded: 2,
    });
    for (const format of ['csv', 'pdf']) {
      const response = await read(format, 'president');
      assert.equal(response.status, 200);
      const bytes = Buffer.from(await response.arrayBuffer());
      assert.equal(
        response.headers.get('X-Report-SHA256'),
        createHash('sha256').update(bytes).digest('hex'),
      );
    }

    const burstRunIds = [];
    for (let index = 0; index < 4; index++) {
      burstRunIds.push(
        await rpc(actors.president.client, 'request_finance_report', {
          p_kind: 'month',
          p_start: start,
          p_end_exclusive: end,
          p_include_proofs: false,
          p_operation_id: randomUUID(),
        }),
      );
    }
    const burstResponses = await Promise.all(Array.from({ length: 8 }, tick));
    const burstArtifacts = [];
    for (const response of burstResponses) {
      assert.equal(response.status, 200, 'parallel artifact worker tick');
      const body = await response.json();
      assert.equal(body.artifact?.status, 'ready');
      burstArtifacts.push(`${body.artifact.runId}/${body.artifact.format}`);
    }
    assert.equal(new Set(burstArtifacts).size, 8);
    assert.deepEqual(
      burstArtifacts.sort(),
      burstRunIds.flatMap((id) => [`${id}/csv`, `${id}/pdf`]).sort(),
    );
    for (const burstRunId of burstRunIds) {
      for (const format of ['csv', 'pdf']) {
        const response = await fetch(
          `${base}/api/management/report-${format}?runId=${burstRunId}`,
          { headers: { Authorization: `Bearer ${actors.president.token}` } },
        );
        assert.equal(response.status, 200);
        const bytes = Buffer.from(await response.arrayBuffer());
        assert.equal(
          response.headers.get('X-Report-SHA256'),
          createHash('sha256').update(bytes).digest('hex'),
        );
      }
    }

    const recoveryRunId = await rpc(actors.president.client, 'request_finance_report', {
      p_kind: 'month',
      p_start: start,
      p_end_exclusive: end,
      p_include_proofs: false,
      p_operation_id: randomUUID(),
    });
    const [claim] = await rpc(admin, 'claim_finance_report_artifact', {});
    assert.equal(claim.run_id, recoveryRunId);
    assert.equal(claim.format, 'csv');
    const orphanPath = `${recoveryRunId}/csv/${claim.lease_token}.csv`;
    const { error: orphanError } = await admin.storage
      .from('finance-reports-private')
      .upload(orphanPath, Buffer.from('synthetic orphan'), {
        contentType: 'text/csv',
        upsert: false,
      });
    assert.equal(orphanError, null);
    assert.equal(
      await rpc(admin, 'fail_finance_report_artifact', {
        p_run_id: recoveryRunId,
        p_format: 'csv',
        p_lease_token: claim.lease_token,
        p_failure_code: 'upload_ambiguous',
        p_terminal: true,
      }),
      true,
    );
    const inspected = await inspectReportArtifactRecovery({
      client: admin,
      runId: recoveryRunId,
      format: 'csv',
    });
    assert.equal(inspected.path, orphanPath);
    assert.equal(inspected.objectPresent, true);
    await assert.rejects(
      recoverReportArtifact({
        client: admin,
        runId: recoveryRunId,
        format: 'csv',
        operatorNote: 'Local fixture operator',
      }),
      /artifact_recovery_cooldown/,
    );
    sql(`update public.finance_report_artifacts set updated_at=now()-interval '11 minutes'
      where run_id='${recoveryRunId}' and format='csv'`);
    const { error: objectGuardError } = await admin.rpc('requeue_failed_finance_report_artifact', {
      p_run_id: recoveryRunId,
      p_format: 'csv',
      p_expected_path: orphanPath,
      p_expected_failure_code: 'upload_ambiguous',
      p_operator_note: 'Local fixture operator',
    });
    assert.equal(objectGuardError?.message, 'artifact_object_still_exists');
    const { error: memberRecoveryError } = await actors.member.client.rpc(
      'requeue_failed_finance_report_artifact',
      {
        p_run_id: recoveryRunId,
        p_format: 'csv',
        p_expected_path: orphanPath,
        p_expected_failure_code: 'upload_ambiguous',
        p_operator_note: 'Member',
      },
    );
    assert.ok(memberRecoveryError);
    assert.deepEqual(
      await recoverReportArtifact({
        client: admin,
        runId: recoveryRunId,
        format: 'csv',
        operatorNote: 'Local fixture operator',
      }),
      { runId: recoveryRunId, format: 'csv', status: 'queued', removedOrphan: true },
    );
    assert.equal(
      sql(`select count(*) from public.finance_report_artifact_recoveries
        where run_id='${recoveryRunId}' and format='csv'`),
      '1',
    );
    assert.equal(sql(`select count(*) from storage.objects where name='${orphanPath}'`), '0');
    for (let attempt = 0; attempt < 2; attempt++) assert.equal((await tick()).status, 200);
    const recovered = await rpc(actors.president.client, 'finance_report_artifact_status', {
      p_run_id: recoveryRunId,
    });
    assert.deepEqual(
      recovered.map((item) => item.status),
      ['ready', 'ready'],
    );
    sql(`update public.app_users set role='member' where id='${actors.president.id}'`);
    assert.equal((await read('pdf', 'president')).status, 403);
    console.log(
      'artifact HTTP: private files, 8 concurrent worker ticks, role denial, backup replay and ambiguous-orphan recovery passed',
    );
  } finally {
    if (server && server.exitCode === null) {
      const exited = new Promise((resolve) => server.once('exit', resolve));
      server.kill('SIGTERM');
      await Promise.race([exited, delay(5000)]);
    }
    if (log !== undefined) closeSync(log);
    if (backupTemp) await rm(backupTemp, { recursive: true, force: true });
    const paths = sql("select name from storage.objects where bucket_id='finance-reports-private'")
      .split('\n')
      .filter(Boolean);
    if (paths.length) {
      const { error } = await admin.storage.from('finance-reports-private').remove(paths);
      if (error) throw new Error('private artifact cleanup failed');
    }
    const reset = spawnSync('supabase', ['db', 'reset', '--local', '--no-seed'], {
      cwd: backend,
      encoding: 'utf8',
      env: process.env,
    });
    if (reset.status !== 0) throw new Error(`disposable reset failed: ${reset.stderr.trim()}`);
    console.log('fresh local database reset completed after artifact HTTP test');
  }
}

await main();
