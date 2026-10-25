#!/usr/bin/env node
// Run only against the named disposable fresh-build stack. No real QR is used.
import assert from 'node:assert/strict';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { closeSync, mkdtempSync, openSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';
import { createPaymentQrHandler } from '../qr/service.js';
import { createPaymentQrReadHandler } from '../qr/read.js';
import { createIdentityLimiter } from '../identity/rate-limit.js';
import { removeStaleQrObject } from '../ops/qr-cleanup.js';

const backend = fileURLToPath(new URL('../', import.meta.url));
const web = fileURLToPath(new URL('../../apps/web/', import.meta.url));
const container = 'supabase_db_masjid-e-mamoor-2-fresh';
const webPort = 18088;

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

function uploadRequest(token, accountId, operationId, image) {
  const form = new FormData();
  form.set('accountId', accountId);
  form.set('operationId', operationId);
  form.set('payeeConfirmed', 'true');
  form.set('file', new Blob([image], { type: 'image/png' }), 'synthetic.png');
  return new Request('http://local.invalid/api/management/payment-qr', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
}

function readRequest(token, accountId) {
  return new Request(`http://local.invalid/api/management/payment-qr?accountId=${accountId}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

async function main() {
  if (process.env.FRESH_BUILD_TEST_DATABASE_CONFIRM !== 'disposable')
    throw new Error('Set FRESH_BUILD_TEST_DATABASE_CONFIRM=disposable');
  assert.equal(
    sql(
      'select (select count(*) from auth.users),(select count(*) from public.payment_qr_versions),(select count(*) from storage.objects)',
    ),
    '0|0|0',
    'fresh stack must have no users, QR versions or objects',
  );
  const status = JSON.parse(
    execFileSync('supabase', ['status', '-o', 'json'], { cwd: backend, encoding: 'utf8' }),
  );
  assert.match(status.API_URL, /^http:\/\/127\.0\.0\.1:55321$/);
  const admin = createClient(status.API_URL, status.SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
  const publicClient = createClient(status.API_URL, status.ANON_KEY, {
    auth: { persistSession: false },
  });
  const actors = {};
  let webServer;
  let webLog;
  let backupTemp;
  try {
    for (const role of ['president', 'treasurer', 'member', 'data_entry']) {
      const email = `phase5-${role}-${randomUUID()}@fixture.invalid`;
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
values ('${id}','phase5${role}${id.slice(0, 8)}',false);`);
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
    const { data: accountId, error: accountError } = await actors.president.client.rpc(
      'create_finance_account',
      {
        p_name: 'Synthetic QR account',
        p_kind: 'upi',
        p_upi_id: 'synthetic@bank',
        p_bank_account_number: null,
        p_ifsc: null,
        p_operation_id: randomUUID(),
      },
    );
    if (accountError || !accountId) throw new Error('synthetic UPI account creation failed');
    const { data: eligible, error: eligibleError } = await actors.president.client.rpc(
      'payment_qr_account_eligible',
      { p_account_id: accountId },
    );
    assert.equal(eligibleError, null);
    assert.equal(eligible, true);
    const { error: memberEligibilityError } = await actors.member.client.rpc(
      'payment_qr_account_eligible',
      { p_account_id: accountId },
    );
    assert.equal(memberEligibilityError?.code, '42501');
    const handler = createPaymentQrHandler({
      createClient,
      url: status.API_URL,
      publishableKey: status.ANON_KEY,
      secretKey: status.SERVICE_ROLE_KEY,
      limiter: createIdentityLimiter(admin),
      onInternalError: (stage, error) => {
        console.error(`QR fixture internal stage ${stage}: ${error?.message ?? 'unknown error'}`);
      },
    });
    const readHandler = createPaymentQrReadHandler({
      createClient,
      url: status.API_URL,
      publishableKey: status.ANON_KEY,
      secretKey: status.SERVICE_ROLE_KEY,
      limiter: createIdentityLimiter(admin),
      onInternalError: (stage, error) => {
        console.error(
          `QR read fixture internal stage ${stage}: ${error?.message ?? 'unknown error'}`,
        );
      },
    });
    const image = await sharp({
      create: { width: 128, height: 128, channels: 3, background: 'white' },
    })
      .png()
      .toBuffer();
    const memberDenied = await handler(
      uploadRequest(actors.member.token, accountId, randomUUID(), image),
    );
    assert.equal(memberDenied.status, 403, 'member upload must be denied');
    const operation = randomUUID();
    const first = await handler(uploadRequest(actors.president.token, accountId, operation, image));
    const firstBody = await first.json();
    assert.equal(
      first.status,
      200,
      `first upload: HTTP ${first.status} ${firstBody?.error?.code ?? ''}`,
    );
    const firstData = firstBody.data;
    assert.equal(firstData.sha256, createHash('sha256').update(image).digest('hex'));
    const donorId = randomUUID();
    sql(`insert into app_private.approved_consent_versions(version,approved_at,approved_by)
values ('synthetic-qr-fixture',now(),'${actors.president.id}');
insert into public.monthly_donors(id,name,whatsapp,suggested_amount_paise,referrer_id,
  entered_by,consent_method,consent_recorded_at,consent_version,consent_evidence_ref)
values ('${donorId}','Synthetic QR snapshot donor','+919000001234',10000,
  '${actors.member.id}','${actors.president.id}','synthetic fixture',now(),
  'synthetic-qr-fixture','synthetic local test only');
select public.queue_monthly_request('${donorId}','2026-11-01');`);
    const originalRequest = sql(`select qr_version_id::text || '|' || qr_sha256
from public.monthly_requests where donor_id='${donorId}'`);
    assert.equal(originalRequest, `${firstData.versionId}|${firstData.sha256}`);
    for (const role of ['president', 'treasurer']) {
      const response = await readHandler(readRequest(actors[role].token, accountId));
      assert.equal(response.status, 200, `${role} private QR review`);
      assert.equal(response.headers.get('X-QR-Version-ID'), firstData.versionId);
      assert.deepEqual(Buffer.from(await response.arrayBuffer()), image);
    }
    assert.equal((await readHandler(readRequest(actors.member.token, accountId))).status, 403);
    assert.equal((await readHandler(readRequest('', accountId))).status, 401);
    const retry = await handler(uploadRequest(actors.president.token, accountId, operation, image));
    assert.equal(retry.status, 200, 'same-operation retry');
    assert.equal((await retry.json()).data.versionId, firstData.versionId);
    const changed = await sharp({
      create: { width: 128, height: 128, channels: 3, background: 'black' },
    })
      .png()
      .toBuffer();
    const conflict = await handler(
      uploadRequest(actors.president.token, accountId, operation, changed),
    );
    assert.equal(conflict.status, 409, 'same operation with different bytes');
    const second = await handler(
      uploadRequest(actors.president.token, accountId, randomUUID(), changed),
    );
    assert.equal(second.status, 200, 'replacement QR');
    const secondData = (await second.json()).data;
    assert.notEqual(secondData.versionId, firstData.versionId);
    const currentRead = await readHandler(readRequest(actors.treasurer.token, accountId));
    assert.equal(currentRead.status, 200, 'replacement private QR review');
    assert.equal(currentRead.headers.get('X-QR-Version-ID'), secondData.versionId);
    assert.deepEqual(Buffer.from(await currentRead.arrayBuffer()), changed);
    assert.equal(
      sql(`select qr_version_id::text || '|' || qr_sha256
from public.monthly_requests where donor_id='${donorId}'`),
      originalRequest,
      'queued request must retain its first QR version and digest after replacement',
    );
    assert.equal(
      sql(
        `select retired_at is not null from public.payment_qr_versions where id='${firstData.versionId}'`,
      ),
      't',
      'the original QR remains referenced as a retired version',
    );

    assert.equal(
      sql(`select count(*) filter(where retired_at is null),count(*) filter(where retired_at is not null)
from public.payment_qr_versions where account_id='${accountId}'`),
      '1|1',
      'exactly one active version and one retired version',
    );
    assert.equal(sql('select count(*) from app_private.qr_assets'), '2');
    assert.equal(sql('select count(*) from public.finance_effects'), '0');
    const path = `payment-qr/${operation}.png`;
    const { data: trustedBytes, error: trustedError } = await admin.storage
      .from('qr-private')
      .download(path);
    assert.equal(trustedError, null);
    assert.deepEqual(Buffer.from(await trustedBytes.arrayBuffer()), image);
    for (const client of [publicClient, actors.member.client]) {
      const { data, error } = await client.storage.from('qr-private').download(path);
      assert.equal(data, null);
      assert.ok(error, 'untrusted private download must fail');
    }
    // The direct-handler section used four of this actor's five hourly upload
    // attempts. Reset only its disposable fixture bucket so the real HTTP route
    // can independently prove retry and conflict without changing the limit.
    const qrBucket = createHash('sha256').update(`qr:${actors.president.id}`).digest('hex');
    sql(`delete from app_private.identity_rate_buckets where bucket_hash='${qrBucket}'`);
    webLog = openSync('/private/tmp/masjid-phase5-qr-web.log', 'w');
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
        },
        stdio: ['ignore', webLog, webLog],
      },
    );
    const webUrl = `http://127.0.0.1:${webPort}/api/management/payment-qr`;
    let ready = false;
    for (let attempt = 0; attempt < 80; attempt += 1) {
      if (webServer.exitCode !== null) throw new Error('QR web server exited before readiness');
      try {
        const probe = await fetch(`${webUrl}?accountId=${accountId}`);
        if (probe.status === 401) {
          ready = true;
          break;
        }
      } catch {
        // The local web server may still be starting.
      }
      await delay(250);
    }
    if (!ready) throw new Error('QR web route did not become ready');
    const webRead = async (role) =>
      fetch(`${webUrl}?accountId=${accountId}`, {
        headers: role ? { Authorization: `Bearer ${actors[role].token}` } : {},
      });
    assert.equal((await webRead('member')).status, 403);
    assert.equal((await webRead('data_entry')).status, 403);
    assert.equal((await webRead(null)).status, 401);
    for (const role of ['president', 'treasurer']) {
      const response = await webRead(role);
      assert.equal(response.status, 200, `${role} web QR read`);
      assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
      assert.equal(
        response.headers.get('X-QR-SHA256'),
        createHash('sha256').update(changed).digest('hex'),
      );
      assert.deepEqual(Buffer.from(await response.arrayBuffer()), changed);
    }
    const webUpload = async (role, operationId, bytes) => {
      const form = new FormData();
      form.set('accountId', accountId);
      form.set('operationId', operationId);
      form.set('payeeConfirmed', 'true');
      form.set('file', new Blob([bytes], { type: 'image/png' }), 'synthetic.png');
      return fetch(webUrl, {
        method: 'POST',
        headers: role ? { Authorization: `Bearer ${actors[role].token}` } : {},
        body: form,
      });
    };
    assert.equal((await webUpload('treasurer', randomUUID(), image)).status, 403);
    assert.equal((await webUpload('member', randomUUID(), image)).status, 403);
    assert.equal((await webUpload('data_entry', randomUUID(), image)).status, 403);
    assert.equal((await webUpload(null, randomUUID(), image)).status, 401);
    const third = await sharp({
      create: { width: 128, height: 128, channels: 3, background: 'grey' },
    })
      .png()
      .toBuffer();
    const webOperation = randomUUID();
    const uploaded = await webUpload('president', webOperation, third);
    const uploadedBody = await uploaded.json();
    assert.equal(uploaded.status, 200, `President web upload: ${uploadedBody?.error?.code ?? ''}`);
    assert.equal(uploadedBody.data.sha256, createHash('sha256').update(third).digest('hex'));
    const webRetry = await webUpload('president', webOperation, third);
    assert.equal(webRetry.status, 200, 'web upload operation retry');
    assert.equal((await webRetry.json()).data.versionId, uploadedBody.data.versionId);
    const webConflict = await webUpload('president', webOperation, image);
    assert.equal(webConflict.status, 409, 'web upload operation conflict');
    const latest = await webRead('treasurer');
    assert.equal(latest.status, 200, 'Treasurer web read after President upload');
    assert.equal(latest.headers.get('X-QR-Version-ID'), uploadedBody.data.versionId);
    assert.deepEqual(Buffer.from(await latest.arrayBuffer()), third);
    assert.equal(
      sql(`select qr_version_id::text || '|' || qr_sha256
from public.monthly_requests where donor_id='${donorId}'`),
      originalRequest,
      'the web replacement must not change an earlier request snapshot',
    );
    sql(`update storage.objects set created_at=now()-interval '25 hours'
where bucket_id='qr-private' and name='${path}'`);
    assert.equal((await removeStaleQrObject(admin, path)).state, 'skipped');
    assert.equal(
      sql(`select count(*) from storage.objects where bucket_id='qr-private' and name='${path}'`),
      '1',
      'an old referenced QR image must remain in Storage',
    );
    const ambiguousPath = `payment-qr/${randomUUID()}.png`;
    const { error: ambiguousUploadError } = await admin.storage
      .from('qr-private')
      .upload(ambiguousPath, image, { contentType: 'image/png', upsert: false });
    assert.equal(ambiguousUploadError, null);
    sql(`update storage.objects set created_at=now()-interval '25 hours'
where bucket_id='qr-private' and name='${ambiguousPath}'`);
    const lostResponseService = {
      rpc: admin.rpc.bind(admin),
      storage: {
        from: (bucket) => ({
          remove: async (paths) => {
            const { error } = await admin.storage.from(bucket).remove(paths);
            assert.equal(error, null);
            return { error: new Error('simulated lost Storage response') };
          },
        }),
      },
    };
    assert.equal((await removeStaleQrObject(lostResponseService, ambiguousPath)).state, 'removed');
    assert.equal(
      sql(`select (select count(*) from storage.objects where bucket_id='qr-private' and name='${ambiguousPath}') || '|' ||
        (select count(*) from app_private.qr_cleanup_claims where asset_path='${ambiguousPath}' and removed_at is not null)`),
      '0|1',
      'lost Storage response must be reconciled against actual database state',
    );
    const retryPath = `payment-qr/${randomUUID()}.png`;
    const { error: retryUploadError } = await admin.storage
      .from('qr-private')
      .upload(retryPath, image, { contentType: 'image/png', upsert: false });
    assert.equal(retryUploadError, null);
    sql(`update storage.objects set created_at=now()-interval '25 hours'
where bucket_id='qr-private' and name='${retryPath}'`);
    const failedRemovalService = {
      rpc: admin.rpc.bind(admin),
      storage: {
        from: () => ({ remove: async () => ({ error: new Error('simulated Storage outage') }) }),
      },
    };
    await assert.rejects(
      removeStaleQrObject(failedRemovalService, retryPath),
      /qr_cleanup_storage_remove_failed/,
    );
    assert.equal(
      sql(`select (select count(*) from storage.objects where bucket_id='qr-private' and name='${retryPath}') || '|' ||
        (select count(*) from app_private.qr_cleanup_claims where asset_path='${retryPath}' and removed_at is null)`),
      '1|1',
      'Storage outage must retain both object and pending claim',
    );
    assert.equal((await removeStaleQrObject(admin, retryPath)).state, 'removed');
    assert.equal(
      sql(
        `select count(*) from storage.objects where bucket_id='qr-private' and name='${retryPath}'`,
      ),
      '0',
      'operator retry must remove the pending object',
    );
    const orphanPath = `payment-qr/${randomUUID()}.png`;
    const { error: orphanUploadError } = await admin.storage
      .from('qr-private')
      .upload(orphanPath, image, { contentType: 'image/png', upsert: false });
    assert.equal(orphanUploadError, null);
    assert.equal((await removeStaleQrObject(admin, orphanPath)).state, 'skipped');
    sql(`update storage.objects set created_at=now()-interval '25 hours'
where bucket_id='qr-private' and name='${orphanPath}'`);
    const { error: memberClaimError } = await actors.member.client.rpc('claim_stale_qr_object', {
      p_asset_path: orphanPath,
    });
    assert.ok(memberClaimError, 'an untrusted role must not claim a cleanup path');
    const { data: claimed, error: claimError } = await admin.rpc('claim_stale_qr_object', {
      p_asset_path: orphanPath,
    });
    assert.equal(claimError, null);
    assert.equal(claimed, true);
    const { error: lateRegisterError } = await admin.rpc('register_verified_qr_asset', {
      p_asset_path: orphanPath,
      p_sha256_hex: firstData.sha256,
      p_bytes: image.length,
    });
    assert.equal(lateRegisterError?.code, '23505', 'a claimed path must reject late registration');
    const { error: lateActivationError } = await actors.president.client.rpc(
      'activate_payment_qr',
      {
        p_account_id: accountId,
        p_asset_path: orphanPath,
        p_sha256_hex: firstData.sha256,
        p_operation_id: randomUUID(),
      },
    );
    assert.equal(lateActivationError?.code, '23505', 'a claimed path must reject activation');
    assert.equal((await removeStaleQrObject(admin, orphanPath)).state, 'removed');
    assert.equal(
      sql(`select (select count(*) from storage.objects where bucket_id='qr-private' and name='${orphanPath}') || '|' ||
        (select count(*) from app_private.qr_cleanup_claims where asset_path='${orphanPath}' and removed_at is not null)`),
      '0|1',
      'Storage image must be removed and its operation tombstoned',
    );
    const { error: lateUploadError } = await admin.storage
      .from('qr-private')
      .upload(orphanPath, image, { contentType: 'image/png', upsert: false });
    assert.equal(lateUploadError, null, 'a simulated late network retry can recreate the path');
    assert.equal((await removeStaleQrObject(admin, orphanPath)).state, 'skipped');
    sql(`update storage.objects set created_at=now()-interval '25 hours'
where bucket_id='qr-private' and name='${orphanPath}'`);
    assert.equal((await removeStaleQrObject(admin, orphanPath)).state, 'removed');
    assert.equal(
      sql(
        `select count(*) from storage.objects where bucket_id='qr-private' and name='${orphanPath}'`,
      ),
      '0',
      'the aged late retry must also be removable',
    );
    const registeredPath = `payment-qr/${randomUUID()}.png`;
    const { error: registeredUploadError } = await admin.storage
      .from('qr-private')
      .upload(registeredPath, changed, { contentType: 'image/png', upsert: false });
    assert.equal(registeredUploadError, null);
    const { error: registeredAssetError } = await admin.rpc('register_verified_qr_asset', {
      p_asset_path: registeredPath,
      p_sha256_hex: createHash('sha256').update(changed).digest('hex'),
      p_bytes: changed.length,
    });
    assert.equal(registeredAssetError, null);
    sql(`update storage.objects set created_at=now()-interval '25 hours'
where bucket_id='qr-private' and name='${registeredPath}';
update app_private.qr_assets set verified_at=now()-interval '25 hours'
where asset_path='${registeredPath}'`);
    assert.equal((await removeStaleQrObject(admin, registeredPath)).state, 'removed');
    assert.equal(
      sql(`select (select count(*) from storage.objects where bucket_id='qr-private' and name='${registeredPath}') || '|' ||
        (select count(*) from app_private.qr_assets where asset_path='${registeredPath}')`),
      '0|0',
      'a stale registered image without a version must lose both object and registry row',
    );
    backupTemp = mkdtempSync('/private/tmp/mem2-qr-replay-');
    const cert = `${backupTemp}/recovery.pem`;
    const key = `${backupTemp}/recovery.key`;
    const mac = `${backupTemp}/archive-mac.key`;
    const dump = `${backupTemp}/database.dump`;
    const encrypted = `${backupTemp}/qr.cms`;
    const staging = `${backupTemp}/staging`;
    const certificate = spawnSync(
      'openssl',
      [
        'req',
        '-x509',
        '-newkey',
        'rsa:2048',
        '-nodes',
        '-subj',
        '/CN=Local QR drill',
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
      QR_OBJECT_BACKUP_ENABLED: 'true',
    };
    const archive = spawnSync(
      process.execPath,
      [
        'backend/scripts/qr_objects.mjs',
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
      { cwd: fileURLToPath(new URL('../../', import.meta.url)), env: archiveEnv, encoding: 'utf8' },
    );
    if (archive.status !== 0) throw new Error(`encrypted QR capture failed: ${archive.stderr}`);
    assert.equal(JSON.parse(archive.stdout).objectCount, 3);
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
      { cwd: fileURLToPath(new URL('../../', import.meta.url)), encoding: 'utf8' },
    );
    if (verified.status !== 0)
      throw new Error(`encrypted QR archive verification failed: ${verified.stderr}`);
    const manifest = JSON.parse(readFileSync(`${staging}/MANIFEST.json`, 'utf8'));
    assert.equal(manifest.objects.length, 3);
    const currentPath = `payment-qr/${webOperation}.png`;
    const { error: removedForDrill } = await admin.storage.from('qr-private').remove([currentPath]);
    assert.equal(removedForDrill, null);
    const replayArgs = ['backend/scripts/qr_objects.mjs', 'replay', '--staging', staging];
    const preview = spawnSync(process.execPath, replayArgs, {
      cwd: fileURLToPath(new URL('../../', import.meta.url)),
      env: archiveEnv,
      encoding: 'utf8',
    });
    if (preview.status !== 0) throw new Error(`QR replay preview failed: ${preview.stderr}`);
    assert.deepEqual(JSON.parse(preview.stdout), {
      mode: 'dry_run',
      objects: 3,
      missing: 1,
      uploaded: 0,
    });
    const replay = spawnSync(
      process.execPath,
      [...replayArgs, '--apply', '--confirm-target', status.API_URL],
      {
        cwd: fileURLToPath(new URL('../../', import.meta.url)),
        env: { ...archiveEnv, QR_OBJECT_REPLAY_ENABLED: 'true' },
        encoding: 'utf8',
      },
    );
    if (replay.status !== 0) throw new Error(`QR replay failed: ${replay.stderr}`);
    assert.deepEqual(JSON.parse(replay.stdout), {
      mode: 'applied',
      objects: 3,
      missing: 1,
      uploaded: 1,
    });
    const restoredRead = await webRead('treasurer');
    assert.equal(restoredRead.status, 200);
    assert.equal(
      restoredRead.headers.get('X-QR-SHA256'),
      createHash('sha256').update(third).digest('hex'),
    );
    assert.deepEqual(Buffer.from(await restoredRead.arrayBuffer()), third);
    const { data: untrustedRestored, error: untrustedRestoredError } =
      await actors.member.client.storage.from('qr-private').download(currentPath);
    assert.equal(untrustedRestored, null);
    assert.ok(untrustedRestoredError);
    sql(`update public.app_users set role='member' where id='${actors.president.id}'`);
    assert.equal((await webUpload('president', randomUUID(), image)).status, 403);
    assert.equal(sql('select count(*) from public.finance_effects'), '0');
    console.log(
      'issued-session QR lifecycle and real local web route: role denial, exact bytes/digest, retry, conflict, replacement, frozen request snapshot, live role change, private review and zero money effects passed',
    );
  } finally {
    if (webServer && webServer.exitCode === null) {
      const exited = new Promise((resolve) => webServer.once('exit', resolve));
      webServer.kill('SIGTERM');
      await Promise.race([exited, delay(5000)]);
    }
    if (webLog !== undefined) closeSync(webLog);
    if (backupTemp) rmSync(backupTemp, { recursive: true, force: true });
    const reset = spawnSync('supabase', ['db', 'reset', '--local', '--no-seed'], {
      cwd: backend,
      encoding: 'utf8',
    });
    if (reset.status !== 0) throw new Error(`disposable reset failed: ${reset.stderr.trim()}`);
    console.log('fresh local database reset completed after QR lifecycle');
  }
}

await main();
