#!/usr/bin/env node
// Disposable local integration check of the actual Next.js private PDF route.
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
const route = 'http://127.0.0.1:18089/api/management/report-pdf';
const csvRoute = 'http://127.0.0.1:18089/api/management/report-csv';

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
  try {
    for (const role of [
      'president',
      'vice_president',
      'secretary',
      'treasurer',
      'system_admin',
      'member',
    ]) {
      const email = `phase7pdf-${role}-${randomUUID()}@fixture.invalid`;
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
values ('${id}','phase7pdf${role}${id.slice(0, 8)}',false);`);
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
      p_name: 'मस्जिद synthetic PDF cash',
      p_kind: 'cash',
      p_upi_id: null,
      p_bank_account_number: null,
      p_ifsc: null,
      p_operation_id: randomUUID(),
    });
    const openingId = await rpc(actors.treasurer.client, 'submit_account_opening', {
      p_account_id: accountId,
      p_amount_paise: 12345,
      p_evidence_reference: 'Synthetic PDF opening',
      p_operation_id: randomUUID(),
    });
    await rpc(actors.president.client, 'verify_account_opening', {
      p_opening_id: openingId,
      p_operation_id: randomUUID(),
    });
    const now = new Date();
    const localParts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(now);
    const localPart = (type) => localParts.find((part) => part.type === type).value;
    const localDate = `${localPart('year')}-${localPart('month')}-${localPart('day')}`;
    const donationId = await rpc(actors.president.client, 'submit_one_time_donation', {
      p_name: 'Synthetic revision donor',
      p_kind: 'other',
      p_referrer_id: null,
      p_date: localDate,
      p_method: 'cash',
      p_amount_paise: 1500,
      p_evidence: 'Synthetic counted cash',
      p_operation_id: randomUUID(),
    });
    await rpc(actors.treasurer.client, 'decide_one_time_donation', {
      p_id: donationId,
      p_decision: 'verify',
      p_actual_paise: 1500,
      p_account_id: accountId,
      p_reason: null,
      p_operation_id: randomUUID(),
    });
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

    log = openSync('/private/tmp/masjid-phase7-pdf-web.log', 'w', 0o600);
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
    if (!ready) throw new Error('report PDF web route did not become ready');
    const read = (role, id = runId) =>
      fetch(`${route}?runId=${id}`, {
        headers: role ? { Authorization: `Bearer ${actors[role].token}` } : {},
      });
    const readCsv = (role, id = runId) =>
      fetch(`${csvRoute}?runId=${id}`, {
        headers: role ? { Authorization: `Bearer ${actors[role].token}` } : {},
      });
    assert.equal((await read(null)).status, 401);
    assert.equal((await read('member')).status, 403);
    assert.equal((await read('president', 'invalid')).status, 400);
    assert.equal((await readCsv(null)).status, 401);
    assert.equal((await readCsv('member')).status, 403);
    const originalBalances = await rpc(actors.president.client, 'list_finance_report_balances', {
      p_run_id: runId,
    });
    assert.equal(
      originalBalances.find((row) => row.account_id === accountId)?.closing_paise,
      '13845',
    );
    const originalCsv = await readCsv('president');
    assert.equal(originalCsv.status, 200);
    const originalCsvBytes = Buffer.from(await originalCsv.arrayBuffer());
    assert.equal(
      originalCsv.headers.get('X-Report-SHA256'),
      createHash('sha256').update(originalCsvBytes).digest('hex'),
    );
    assert.match(originalCsvBytes.toString('utf8'), /"138\.45"/);
    assert.match(originalCsvBytes.toString('utf8'), /"15\.00"/);
    const originalPdfDigests = [];
    for (const role of ['president', 'treasurer']) {
      const response = await read(role);
      assert.equal(response.status, 200, `${role} PDF download`);
      assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
      const bytes = Buffer.from(await response.arrayBuffer());
      assert.equal(
        response.headers.get('X-Report-SHA256'),
        createHash('sha256').update(bytes).digest('hex'),
      );
      assert.equal(response.headers.get('Content-Type'), 'application/pdf');
      assert.match(bytes.toString('latin1', 0, 8), /%PDF/);
      assert.ok(bytes.length > 1000);
      originalPdfDigests.push(response.headers.get('X-Report-SHA256'));
    }
    const history = await rpc(actors.treasurer.client, 'list_finance_account_history', {
      p_account_id: accountId,
      p_limit: 25,
    });
    const donationEffect = history.find(
      (row) => row.source_type === 'one_time_donation' && row.source_id === donationId,
    );
    assert.ok(donationEffect?.effect_id);
    await rpc(actors.treasurer.client, 'correct_finance_posting', {
      p_original_effect_id: donationEffect.effect_id,
      p_replacement_account_id: accountId,
      p_replacement_amount_paise: 800,
      p_reason: 'Synthetic revised cash count',
      p_operation_id: randomUUID(),
    });
    const revisedRunId = await rpc(actors.president.client, 'request_finance_report', {
      p_kind: 'month',
      p_start: start,
      p_end_exclusive: end,
      p_include_proofs: false,
      p_operation_id: randomUUID(),
    });
    assert.notEqual(revisedRunId, runId);
    const [oldAfterCorrection, revisedBalances, oldLines, revisedLines] = await Promise.all([
      rpc(actors.president.client, 'list_finance_report_balances', { p_run_id: runId }),
      rpc(actors.president.client, 'list_finance_report_balances', { p_run_id: revisedRunId }),
      rpc(actors.president.client, 'list_finance_report_lines', { p_run_id: runId }),
      rpc(actors.president.client, 'list_finance_report_lines', { p_run_id: revisedRunId }),
    ]);
    assert.deepEqual(oldAfterCorrection, originalBalances);
    assert.equal(oldLines.length, 2);
    assert.equal(revisedLines.length, 4);
    assert.equal(
      revisedBalances.find((row) => row.account_id === accountId)?.closing_paise,
      '13145',
    );
    const oldCsvAgain = await readCsv('president');
    assert.equal(oldCsvAgain.status, 200);
    assert.deepEqual(Buffer.from(await oldCsvAgain.arrayBuffer()), originalCsvBytes);
    const revisedCsv = await readCsv('president', revisedRunId);
    assert.equal(revisedCsv.status, 200);
    const revisedCsvBytes = Buffer.from(await revisedCsv.arrayBuffer());
    assert.equal(
      revisedCsv.headers.get('X-Report-SHA256'),
      createHash('sha256').update(revisedCsvBytes).digest('hex'),
    );
    assert.match(revisedCsvBytes.toString('utf8'), /"131\.45"/);
    assert.match(revisedCsvBytes.toString('utf8'), /"-15\.00"/);
    assert.match(revisedCsvBytes.toString('utf8'), /"8\.00"/);
    const revisedPdf = await read('president', revisedRunId);
    assert.equal(revisedPdf.status, 200);
    const revisedPdfBytes = Buffer.from(await revisedPdf.arrayBuffer());
    assert.equal(
      revisedPdf.headers.get('X-Report-SHA256'),
      createHash('sha256').update(revisedPdfBytes).digest('hex'),
    );
    assert.notEqual(revisedPdf.headers.get('X-Report-SHA256'), originalPdfDigests[0]);

    const secondAccountId = await rpc(actors.president.client, 'create_finance_account', {
      p_name: 'Synthetic second cash',
      p_kind: 'cash',
      p_upi_id: null,
      p_bank_account_number: null,
      p_ifsc: null,
      p_operation_id: randomUUID(),
    });
    const secondOpeningId = await rpc(actors.treasurer.client, 'submit_account_opening', {
      p_account_id: secondAccountId,
      p_amount_paise: 5000,
      p_evidence_reference: 'Synthetic second count',
      p_operation_id: randomUUID(),
    });
    await rpc(actors.president.client, 'verify_account_opening', {
      p_opening_id: secondOpeningId,
      p_operation_id: randomUUID(),
    });
    const transferId = await rpc(actors.treasurer.client, 'post_finance_transfer', {
      p_from_account_id: accountId,
      p_to_account_id: secondAccountId,
      p_amount_paise: 2000,
      p_evidence_reference: 'Synthetic cash move',
      p_operation_id: randomUUID(),
    });
    const expenseId = await rpc(actors.treasurer.client, 'submit_expense_request', {
      p_title: 'Synthetic report repair',
      p_description: 'Mixed-source export fixture',
      p_category: 'maintenance',
      p_amount_paise: 1000,
      p_bill: 'Synthetic bill reference',
      p_missing_reason: null,
      p_operation_id: randomUUID(),
    });
    await rpc(actors.president.client, 'decide_expense_request', {
      p_id: expenseId,
      p_decision: 'approve',
      p_reason: null,
      p_operation_id: randomUUID(),
    });
    await rpc(actors.treasurer.client, 'post_expense_payment', {
      p_id: expenseId,
      p_account_id: secondAccountId,
      p_amount_paise: 1000,
      p_method: 'cash',
      p_date: localDate,
      p_proof: 'Synthetic payment proof',
      p_operation_id: randomUUID(),
    });
    const mixedRunId = await rpc(actors.president.client, 'request_finance_report', {
      p_kind: 'month',
      p_start: start,
      p_end_exclusive: end,
      p_include_proofs: false,
      p_operation_id: randomUUID(),
    });
    const [mixedLines, mixedBalances] = await Promise.all([
      rpc(actors.president.client, 'list_finance_report_lines', { p_run_id: mixedRunId }),
      rpc(actors.president.client, 'list_finance_report_balances', { p_run_id: mixedRunId }),
    ]);
    assert.equal(mixedLines.length, 8);
    const transferLines = mixedLines.filter((line) => line.source_id === transferId);
    assert.deepEqual(transferLines.map((line) => line.amount_paise).sort(), ['-2000', '2000']);
    assert.equal(mixedLines.filter((line) => line.source_type === 'expense_payment').length, 1);
    assert.equal(mixedBalances.find((row) => row.account_id === accountId)?.closing_paise, '11145');
    assert.deepEqual(
      mixedBalances
        .filter((row) => [accountId, secondAccountId].includes(row.account_id))
        .map((row) => [
          row.account_id,
          row.period_openings_paise,
          row.income_paise,
          row.expense_paise,
          row.transfer_paise,
          row.closing_paise,
        ])
        .sort((left, right) => left[0].localeCompare(right[0])),
      [
        [accountId, '12345', '800', '0', '-2000', '11145'],
        [secondAccountId, '5000', '0', '1000', '2000', '6000'],
      ].sort((left, right) => left[0].localeCompare(right[0])),
    );
    const mixedCsv = await readCsv('president', mixedRunId);
    assert.equal(mixedCsv.status, 200);
    const mixedCsvBytes = Buffer.from(await mixedCsv.arrayBuffer());
    assert.equal(
      mixedCsv.headers.get('X-Report-SHA256'),
      createHash('sha256').update(mixedCsvBytes).digest('hex'),
    );
    assert.match(mixedCsvBytes.toString('utf8'), /"expense_payment"/);
    assert.match(mixedCsvBytes.toString('utf8'), /"-20\.00"/);
    assert.match(mixedCsvBytes.toString('utf8'), /"20\.00"/);
    const mixedPdf = await read('treasurer', mixedRunId);
    assert.equal(mixedPdf.status, 200);
    assert.equal(
      mixedPdf.headers.get('X-Report-SHA256'),
      createHash('sha256')
        .update(Buffer.from(await mixedPdf.arrayBuffer()))
        .digest('hex'),
    );

    const secondHistory = await rpc(actors.treasurer.client, 'list_finance_account_history', {
      p_account_id: secondAccountId,
      p_limit: 25,
    });
    const expenseEffect = secondHistory.find((row) => row.source_type === 'expense_payment');
    assert.ok(expenseEffect?.effect_id);
    await rpc(actors.treasurer.client, 'correct_finance_posting', {
      p_original_effect_id: expenseEffect.effect_id,
      p_replacement_account_id: secondAccountId,
      p_replacement_amount_paise: -800,
      p_reason: 'Synthetic expense paid amount revised',
      p_operation_id: randomUUID(),
    });
    const correctedMixedRunId = await rpc(actors.president.client, 'request_finance_report', {
      p_kind: 'month',
      p_start: start,
      p_end_exclusive: end,
      p_include_proofs: false,
      p_operation_id: randomUUID(),
    });
    const [oldMixedLines, correctedMixedLines, oldMixedBalances, correctedMixedBalances] =
      await Promise.all([
        rpc(actors.president.client, 'list_finance_report_lines', { p_run_id: mixedRunId }),
        rpc(actors.president.client, 'list_finance_report_lines', {
          p_run_id: correctedMixedRunId,
        }),
        rpc(actors.president.client, 'list_finance_report_balances', { p_run_id: mixedRunId }),
        rpc(actors.president.client, 'list_finance_report_balances', {
          p_run_id: correctedMixedRunId,
        }),
      ]);
    assert.deepEqual(oldMixedLines, mixedLines);
    assert.deepEqual(oldMixedBalances, mixedBalances);
    assert.equal(correctedMixedLines.length, 10);
    assert.deepEqual(
      correctedMixedLines
        .filter((line) => line.source_type === 'correction' && line.account_id === secondAccountId)
        .map((line) => line.amount_paise)
        .sort(),
      ['-800', '1000'],
    );
    assert.equal(
      correctedMixedBalances.find((row) => row.account_id === secondAccountId)?.closing_paise,
      '6200',
    );
    assert.equal(
      correctedMixedBalances.find((row) => row.account_id === secondAccountId)?.expense_paise,
      '800',
    );
    assert.equal((await readCsv(null, correctedMixedRunId)).status, 401);
    assert.equal((await read('member', correctedMixedRunId)).status, 403);
    const correctedMixedCsv = await readCsv('president', correctedMixedRunId);
    assert.equal(correctedMixedCsv.status, 200);
    const correctedMixedCsvBytes = Buffer.from(await correctedMixedCsv.arrayBuffer());
    assert.equal(
      correctedMixedCsv.headers.get('X-Report-SHA256'),
      createHash('sha256').update(correctedMixedCsvBytes).digest('hex'),
    );
    assert.match(correctedMixedCsvBytes.toString('utf8'), /"62\.00"/);
    assert.match(correctedMixedCsvBytes.toString('utf8'), /"-8\.00"/);
    const correctedMixedPdf = await read('treasurer', correctedMixedRunId);
    assert.equal(correctedMixedPdf.status, 200);
    assert.equal(
      correctedMixedPdf.headers.get('X-Report-SHA256'),
      createHash('sha256')
        .update(Buffer.from(await correctedMixedPdf.arrayBuffer()))
        .digest('hex'),
    );
    const frozenMixedCsv = await readCsv('president', mixedRunId);
    assert.equal(frozenMixedCsv.status, 200);
    assert.deepEqual(Buffer.from(await frozenMixedCsv.arrayBuffer()), mixedCsvBytes);

    // A test-only approved consent version and QR let the existing monthly
    // lifecycle run without enabling enrollment or messaging for real data.
    sql(`insert into app_private.approved_consent_versions(version,approved_at,approved_by)
values ('phase7-http-fixture',now(),'${actors.president.id}');
insert into public.payment_qr_versions(id,account_id,asset_path,asset_sha256,created_by)
values ('${randomUUID()}','${secondAccountId}','phase7/synthetic-qr.png',repeat('b',64),'${actors.president.id}');`);
    const donorId = await rpc(admin, 'enroll_versioned_monthly_donor', {
      p_name: 'Synthetic monthly report donor',
      p_whatsapp: '+919000000007',
      p_suggested_amount_paise: 3000,
      p_referrer_id: actors.president.id,
      p_entered_by: actors.president.id,
      p_consent_method: 'in-person',
      p_consent_recorded_at: new Date(Date.now() - 60_000).toISOString(),
      p_consent_version: 'phase7-http-fixture',
      p_evidence_reference: 'Synthetic signed consent',
    });
    const { error: directQueueError } = await admin.rpc('queue_monthly_request', {
      p_donor_id: donorId,
      p_period_date: start,
    });
    assert.equal(directQueueError?.code, '42501', 'direct queue entry is revoked');
    const firstDay = new Date(`${start}T00:00:00Z`).getUTCDay();
    const firstFriday = 1 + ((5 - firstDay + 7) % 7);
    const dispatchAt = `${start.slice(0, 8)}${String(firstFriday).padStart(2, '0')}T10:05:00+05:30`;
    const queuedCount = await rpc(admin, 'dispatch_first_friday_monthly_requests', {
      p_now: dispatchAt,
    });
    assert.equal(queuedCount, 1);
    assert.equal(
      sql(`select account_id from public.monthly_requests where donor_id='${donorId}'`),
      secondAccountId,
    );
    assert.equal(sql('select count(*) from public.monthly_message_outbox'), '1');
    const claimId = await rpc(actors.president.client, 'submit_monthly_claim', {
      p_donor_id: donorId,
      p_period_date: start,
      p_transaction_id: 'PHASE7-HTTP-MONTHLY-1',
    });
    assert.equal(sql('select count(*) from public.finance_effects'), '10', 'claim is not money');
    const monthlyReceipt = await rpc(actors.treasurer.client, 'verify_monthly_claim', {
      p_claim_id: claimId,
      p_account_id: secondAccountId,
      p_actual_amount_paise: 3000,
      p_operation_id: randomUUID(),
    });
    assert.match(monthlyReceipt, /^MEM2-R-[0-9A-F]{32}$/);
    const monthlyRunId = await rpc(actors.president.client, 'request_finance_report', {
      p_kind: 'month',
      p_start: start,
      p_end_exclusive: end,
      p_include_proofs: false,
      p_operation_id: randomUUID(),
    });
    const [monthlyLines, monthlyBalances, frozenCorrectedLines] = await Promise.all([
      rpc(actors.president.client, 'list_finance_report_lines', { p_run_id: monthlyRunId }),
      rpc(actors.president.client, 'list_finance_report_balances', { p_run_id: monthlyRunId }),
      rpc(actors.president.client, 'list_finance_report_lines', {
        p_run_id: correctedMixedRunId,
      }),
    ]);
    assert.deepEqual(frozenCorrectedLines, correctedMixedLines);
    assert.equal(monthlyLines.length, 11);
    assert.deepEqual(
      monthlyLines
        .filter((line) => line.source_type === 'monthly_contribution')
        .map((line) => [line.account_id, line.amount_paise, line.category]),
      [[secondAccountId, '3000', 'income']],
    );
    assert.equal(
      monthlyBalances.find((row) => row.account_id === accountId)?.closing_paise,
      '11145',
    );
    assert.deepEqual(
      monthlyBalances
        .filter((row) => row.account_id === secondAccountId)
        .map((row) => [row.income_paise, row.expense_paise, row.transfer_paise, row.closing_paise]),
      [['3000', '800', '2000', '9200']],
    );
    assert.equal((await readCsv(null, monthlyRunId)).status, 401);
    assert.equal((await read('member', monthlyRunId)).status, 403);
    const monthlyCsv = await readCsv('president', monthlyRunId);
    assert.equal(monthlyCsv.status, 200);
    const monthlyCsvBytes = Buffer.from(await monthlyCsv.arrayBuffer());
    assert.equal(
      monthlyCsv.headers.get('X-Report-SHA256'),
      createHash('sha256').update(monthlyCsvBytes).digest('hex'),
    );
    assert.match(monthlyCsvBytes.toString('utf8'), /"monthly_contribution"/);
    assert.match(monthlyCsvBytes.toString('utf8'), /"30\.00"/);
    assert.match(monthlyCsvBytes.toString('utf8'), /"92\.00"/);
    const monthlyPdf = await read('treasurer', monthlyRunId);
    assert.equal(monthlyPdf.status, 200);
    const monthlyPdfBytes = Buffer.from(await monthlyPdf.arrayBuffer());
    assert.equal(monthlyPdf.headers.get('Content-Type'), 'application/pdf');
    assert.match(monthlyPdfBytes.toString('latin1', 0, 8), /%PDF/);
    assert.equal(
      monthlyPdf.headers.get('X-Report-SHA256'),
      createHash('sha256').update(monthlyPdfBytes).digest('hex'),
    );
    for (const role of ['vice_president', 'secretary', 'system_admin']) {
      const allowedCsv = await readCsv(role, monthlyRunId);
      assert.equal(allowedCsv.status, 200, `${role} private CSV`);
      const csvBytes = Buffer.from(await allowedCsv.arrayBuffer());
      assert.equal(
        allowedCsv.headers.get('X-Report-SHA256'),
        createHash('sha256').update(csvBytes).digest('hex'),
      );
      const allowedPdf = await read(role, monthlyRunId);
      assert.equal(allowedPdf.status, 200, `${role} private PDF`);
      const pdfBytes = Buffer.from(await allowedPdf.arrayBuffer());
      assert.equal(
        allowedPdf.headers.get('X-Report-SHA256'),
        createHash('sha256').update(pdfBytes).digest('hex'),
      );
    }
    const frozenCorrectedCsv = await readCsv('president', correctedMixedRunId);
    assert.equal(frozenCorrectedCsv.status, 200);
    assert.deepEqual(Buffer.from(await frozenCorrectedCsv.arrayBuffer()), correctedMixedCsvBytes);

    const yearRunId = await rpc(actors.treasurer.client, 'request_finance_report', {
      p_kind: 'year',
      p_start: `${year}-01-01`,
      p_end_exclusive: `${year + 1}-01-01`,
      p_include_proofs: false,
      p_operation_id: randomUUID(),
    });
    const [yearLines, yearBalances] = await Promise.all([
      rpc(actors.president.client, 'list_finance_report_lines', { p_run_id: yearRunId }),
      rpc(actors.president.client, 'list_finance_report_balances', { p_run_id: yearRunId }),
    ]);
    assert.deepEqual(yearLines, monthlyLines);
    assert.deepEqual(yearBalances, monthlyBalances);
    assert.equal((await read('member', yearRunId)).status, 403);
    const yearCsv = await readCsv('president', yearRunId);
    assert.equal(yearCsv.status, 200);
    const yearCsvBytes = Buffer.from(await yearCsv.arrayBuffer());
    assert.equal(
      yearCsv.headers.get('X-Report-SHA256'),
      createHash('sha256').update(yearCsvBytes).digest('hex'),
    );
    assert.match(yearCsvBytes.toString('utf8'), /"monthly_contribution"/);
    assert.match(yearCsvBytes.toString('utf8'), /"92\.00"/);
    const yearPdf = await read('treasurer', yearRunId);
    assert.equal(yearPdf.status, 200);
    const yearPdfBytes = Buffer.from(await yearPdf.arrayBuffer());
    assert.match(yearPdfBytes.toString('latin1', 0, 8), /%PDF/);
    assert.equal(
      yearPdf.headers.get('X-Report-SHA256'),
      createHash('sha256').update(yearPdfBytes).digest('hex'),
    );

    const dayAfter = (date, days) =>
      new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
    const crossMonthRunId = await rpc(actors.treasurer.client, 'request_finance_report', {
      p_kind: 'range',
      p_start: dayAfter(start, -1),
      p_end_exclusive: dayAfter(localDate, 1),
      p_include_proofs: false,
      p_operation_id: randomUUID(),
    });
    const [crossMonthLines, crossMonthBalances] = await Promise.all([
      rpc(actors.president.client, 'list_finance_report_lines', { p_run_id: crossMonthRunId }),
      rpc(actors.president.client, 'list_finance_report_balances', { p_run_id: crossMonthRunId }),
    ]);
    assert.deepEqual(crossMonthLines, monthlyLines);
    assert.deepEqual(crossMonthBalances, monthlyBalances);
    assert.equal((await read('member', crossMonthRunId)).status, 403);
    const crossMonthCsv = await readCsv('treasurer', crossMonthRunId);
    assert.equal(crossMonthCsv.status, 200);
    const crossMonthCsvBytes = Buffer.from(await crossMonthCsv.arrayBuffer());
    assert.equal(
      crossMonthCsv.headers.get('X-Report-SHA256'),
      createHash('sha256').update(crossMonthCsvBytes).digest('hex'),
    );
    assert.match(crossMonthCsvBytes.toString('utf8'), /"monthly_contribution"/);
    assert.match(crossMonthCsvBytes.toString('utf8'), /"111\.45"/);
    assert.match(crossMonthCsvBytes.toString('utf8'), /"92\.00"/);
    const crossMonthPdf = await read('president', crossMonthRunId);
    assert.equal(crossMonthPdf.status, 200);
    const crossMonthPdfBytes = Buffer.from(await crossMonthPdf.arrayBuffer());
    assert.match(crossMonthPdfBytes.toString('latin1', 0, 8), /%PDF/);
    assert.equal(
      crossMonthPdf.headers.get('X-Report-SHA256'),
      createHash('sha256').update(crossMonthPdfBytes).digest('hex'),
    );

    const rangeRunId = await rpc(actors.president.client, 'request_finance_report', {
      p_kind: 'range',
      p_start: dayAfter(localDate, 1),
      p_end_exclusive: dayAfter(localDate, 2),
      p_include_proofs: false,
      p_operation_id: randomUUID(),
    });
    const [rangeLines, rangeBalances] = await Promise.all([
      rpc(actors.president.client, 'list_finance_report_lines', { p_run_id: rangeRunId }),
      rpc(actors.president.client, 'list_finance_report_balances', { p_run_id: rangeRunId }),
    ]);
    assert.deepEqual(rangeLines, []);
    assert.deepEqual(
      rangeBalances
        .map((row) => [
          row.account_id,
          row.opening_paise,
          row.period_openings_paise,
          row.income_paise,
          row.expense_paise,
          row.transfer_paise,
          row.closing_paise,
        ])
        .sort((left, right) => left[0].localeCompare(right[0])),
      [
        [accountId, '11145', '0', '0', '0', '0', '11145'],
        [secondAccountId, '9200', '0', '0', '0', '0', '9200'],
      ].sort((left, right) => left[0].localeCompare(right[0])),
    );
    assert.equal((await readCsv('member', rangeRunId)).status, 403);
    const rangeCsv = await readCsv('treasurer', rangeRunId);
    assert.equal(rangeCsv.status, 200);
    const rangeCsvBytes = Buffer.from(await rangeCsv.arrayBuffer());
    assert.equal(
      rangeCsv.headers.get('X-Report-SHA256'),
      createHash('sha256').update(rangeCsvBytes).digest('hex'),
    );
    assert.doesNotMatch(rangeCsvBytes.toString('utf8'), /"effect","/);
    assert.match(rangeCsvBytes.toString('utf8'), /"111\.45"/);
    assert.match(rangeCsvBytes.toString('utf8'), /"92\.00"/);
    const rangePdf = await read('president', rangeRunId);
    assert.equal(rangePdf.status, 200);
    const rangePdfBytes = Buffer.from(await rangePdf.arrayBuffer());
    assert.match(rangePdfBytes.toString('latin1', 0, 8), /%PDF/);
    assert.equal(
      rangePdf.headers.get('X-Report-SHA256'),
      createHash('sha256').update(rangePdfBytes).digest('hex'),
    );
    const frozenMonthlyCsv = await readCsv('president', monthlyRunId);
    assert.equal(frozenMonthlyCsv.status, 200);
    assert.deepEqual(Buffer.from(await frozenMonthlyCsv.arrayBuffer()), monthlyCsvBytes);

    // Seed one historical opening at the prior month's last day. The app cannot
    // backdate an immutable posted effect, so this is a disposable report-source
    // fixture with a matching verified opening rather than a user workflow.
    const priorDate = dayAfter(start, -1);
    const priorAccountId = await rpc(actors.president.client, 'create_finance_account', {
      p_name: 'Synthetic prior-month cash',
      p_kind: 'cash',
      p_upi_id: null,
      p_bank_account_number: null,
      p_ifsc: null,
      p_operation_id: randomUUID(),
    });
    const priorOpeningId = randomUUID();
    sql(`insert into public.account_openings
      (id,account_id,amount_paise,evidence_reference,submitted_by,submit_operation_id,
       submitted_at,verified_by,verify_operation_id,verified_at)
      values ('${priorOpeningId}','${priorAccountId}',5000,'Synthetic historical opening',
       '${actors.treasurer.id}','${randomUUID()}','${priorDate} 12:00:00+05:30',
       '${actors.president.id}','${randomUUID()}','${priorDate} 12:05:00+05:30');
      insert into public.finance_effects
      (account_id,source_type,source_id,leg,amount_paise,occurred_at)
      values ('${priorAccountId}','account_opening','${priorOpeningId}',0,5000,
       '${priorDate} 12:05:00+05:30');`);
    await rpc(actors.treasurer.client, 'post_finance_transfer', {
      p_from_account_id: accountId,
      p_to_account_id: priorAccountId,
      p_amount_paise: 700,
      p_evidence_reference: 'Synthetic current-month transfer',
      p_operation_id: randomUUID(),
    });
    const twoSidedRunId = await rpc(actors.president.client, 'request_finance_report', {
      p_kind: 'range',
      p_start: priorDate,
      p_end_exclusive: dayAfter(localDate, 1),
      p_include_proofs: false,
      p_operation_id: randomUUID(),
    });
    const [twoSidedLines, twoSidedBalances] = await Promise.all([
      rpc(actors.president.client, 'list_finance_report_lines', { p_run_id: twoSidedRunId }),
      rpc(actors.president.client, 'list_finance_report_balances', { p_run_id: twoSidedRunId }),
    ]);
    assert.equal(twoSidedLines.length, 14);
    assert.equal(twoSidedLines.filter((line) => line.source_type === 'account_opening').length, 3);
    assert.deepEqual(
      twoSidedLines
        .filter((line) => line.source_id === priorOpeningId)
        .map((line) => [line.account_id, line.amount_paise]),
      [[priorAccountId, '5000']],
    );
    assert.deepEqual(
      twoSidedBalances
        .map((row) => [row.account_id, row.closing_paise])
        .sort((left, right) => left[0].localeCompare(right[0])),
      [
        [accountId, '10445'],
        [secondAccountId, '9200'],
        [priorAccountId, '5700'],
      ].sort((left, right) => left[0].localeCompare(right[0])),
    );
    assert.equal((await readCsv('member', twoSidedRunId)).status, 403);
    const twoSidedCsv = await readCsv('treasurer', twoSidedRunId);
    assert.equal(twoSidedCsv.status, 200);
    const twoSidedCsvBytes = Buffer.from(await twoSidedCsv.arrayBuffer());
    assert.equal(
      twoSidedCsv.headers.get('X-Report-SHA256'),
      createHash('sha256').update(twoSidedCsvBytes).digest('hex'),
    );
    assert.match(twoSidedCsvBytes.toString('utf8'), /"50\.00"/);
    assert.match(twoSidedCsvBytes.toString('utf8'), /"57\.00"/);
    const twoSidedPdf = await read('president', twoSidedRunId);
    assert.equal(twoSidedPdf.status, 200);
    const twoSidedPdfBytes = Buffer.from(await twoSidedPdf.arrayBuffer());
    assert.equal(
      twoSidedPdf.headers.get('X-Report-SHA256'),
      createHash('sha256').update(twoSidedPdfBytes).digest('hex'),
    );
    const partialRunId = await rpc(actors.treasurer.client, 'request_finance_report', {
      p_kind: 'range',
      p_start: localDate,
      p_end_exclusive: dayAfter(localDate, 1),
      p_include_proofs: false,
      p_operation_id: randomUUID(),
    });
    const [partialLines, partialBalances] = await Promise.all([
      rpc(actors.treasurer.client, 'list_finance_report_lines', { p_run_id: partialRunId }),
      rpc(actors.treasurer.client, 'list_finance_report_balances', { p_run_id: partialRunId }),
    ]);
    assert.equal(partialLines.length, 13);
    assert.equal(
      partialLines.some((line) => line.source_id === priorOpeningId),
      false,
    );
    assert.deepEqual(
      partialBalances
        .filter((row) => row.account_id === priorAccountId)
        .map((row) => [row.opening_paise, row.transfer_paise, row.closing_paise]),
      [['5000', '700', '5700']],
    );
    const partialCsv = await readCsv('president', partialRunId);
    assert.equal(partialCsv.status, 200);
    const partialCsvBytes = Buffer.from(await partialCsv.arrayBuffer());
    assert.equal(
      partialCsv.headers.get('X-Report-SHA256'),
      createHash('sha256').update(partialCsvBytes).digest('hex'),
    );
    const frozenMonthlyCsvAfter = await readCsv('president', monthlyRunId);
    assert.equal(frozenMonthlyCsvAfter.status, 200);
    assert.deepEqual(Buffer.from(await frozenMonthlyCsvAfter.arrayBuffer()), monthlyCsvBytes);
    sql(
      `update app_private.username_aliases set must_change_password=true where user_id='${actors.treasurer.id}'`,
    );
    assert.equal((await read('treasurer')).status, 403, 'temporary-password gate');
    sql(`update public.app_users set role='member' where id='${actors.president.id}'`);
    assert.equal((await read('president')).status, 403, 'live role change');
    assert.equal(sql('select count(*) from storage.objects'), '0');
    console.log(
      'issued-session PDF/CSV HTTP: five reader roles, mixed-source month/year, two-sided and partial cross-month and empty carried-forward ranges reconcile; digests, frozen exports, access denials and no Storage objects passed',
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
    console.log('fresh local database reset completed after PDF HTTP test');
  }
}

await main();
