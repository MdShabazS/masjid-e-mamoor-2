import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { inspectReportArtifactRecovery, recoverReportArtifact } from './artifact-recovery.js';

const runId = 'd6134c9b-47bb-4f8e-9b5d-c288f12afe51';
const lease = '17b65226-7537-4adf-83e8-57cf5b6aa250';
const path = `${runId}/csv/${lease}.csv`;

function fixture({ status = 'failed', pathValue = path, exists = true, removeError = false } = {}) {
  const calls = [];
  let present = exists;
  const bucket = {
    async list(prefix) {
      calls.push(['list', prefix]);
      return { data: present ? [{ name: `${lease}.csv` }] : [], error: null };
    },
    async remove(paths) {
      calls.push(['remove', paths]);
      if (removeError) return { error: new Error('remove failed') };
      present = false;
      return { error: null };
    },
  };
  const client = {
    from(name) {
      assert.equal(name, 'finance_report_artifacts');
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              single: async () => ({
                data: {
                  status,
                  attempts: 3,
                  failure_code: 'upload_ambiguous',
                  last_attempt_path: pathValue,
                  lease_token: null,
                  lease_expires_at: null,
                  updated_at: '2020-01-01T00:00:00Z',
                },
              }),
            }),
          }),
        }),
      };
    },
    storage: { from: (name) => (assert.equal(name, 'finance-reports-private'), bucket) },
    async rpc(name, args) {
      calls.push([name, args]);
      return { data: true, error: null };
    },
  };
  return { client, calls };
}

test('dry run reports exact orphan without changing state', async () => {
  const { client, calls } = fixture();
  const state = await inspectReportArtifactRecovery({ client, runId, format: 'csv' });
  assert.equal(state.path, path);
  assert.equal(state.objectPresent, true);
  assert.equal(calls.length, 1);
});

test('recovery removes only the expected orphan before audited requeue', async () => {
  const { client, calls } = fixture();
  const result = await recoverReportArtifact({
    client,
    runId,
    format: 'csv',
    operatorNote: 'Treasurer',
  });
  assert.deepEqual(result, { runId, format: 'csv', status: 'queued', removedOrphan: true });
  assert.deepEqual(calls[1], ['remove', [path]]);
  assert.equal(calls[3][0], 'requeue_failed_finance_report_artifact');
  assert.equal(calls[3][1].p_expected_path, path);
  assert.equal(calls[3][1].p_operator_note, 'Treasurer');
});

test('recovery rejects active or malformed state and stops on failed object removal', async () => {
  for (const options of [{ status: 'ready' }, { pathValue: `${runId}/csv/other.csv` }]) {
    const { client, calls } = fixture(options);
    await assert.rejects(
      recoverReportArtifact({ client, runId, format: 'csv', operatorNote: 'Operator' }),
    );
    assert.equal(calls.length, 0);
  }
  const { client, calls } = fixture({ removeError: true });
  await assert.rejects(
    recoverReportArtifact({ client, runId, format: 'csv', operatorNote: 'Operator' }),
    /artifact_orphan_removal_failed/,
  );
  assert.equal(
    calls.some(([name]) => name === 'requeue_failed_finance_report_artifact'),
    false,
  );
});

test('operator CLI keeps mutation disabled and requires exact confirmation and note', () => {
  const script = fileURLToPath(new URL('../scripts/recover_report_artifact.mjs', import.meta.url));
  const base = ['--run', runId, '--format', 'csv', '--apply'];
  const env = {
    ...process.env,
    SUPABASE_URL: 'http://127.0.0.1:1',
    SUPABASE_SERVICE_ROLE_KEY: 'synthetic-key',
  };
  const run = (args, override = {}) =>
    spawnSync(process.execPath, [script, ...args], {
      encoding: 'utf8',
      env: { ...env, ...override },
    });
  assert.match(run(base).stderr, /artifact_recovery_disabled/);
  assert.match(
    run(base, { REPORT_ARTIFACT_RECOVERY_ENABLED: 'true' }).stderr,
    /exact_recovery_confirmation_required/,
  );
  assert.match(
    run([...base, '--confirm', `${runId}/csv`, '--operator', '--apply'], {
      REPORT_ARTIFACT_RECOVERY_ENABLED: 'true',
    }).stderr,
    /invalid_recovery_operator_note/,
  );
});
