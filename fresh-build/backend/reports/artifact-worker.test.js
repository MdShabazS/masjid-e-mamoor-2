import assert from 'node:assert/strict';
import test from 'node:test';
import { runReportArtifactTick } from './artifact-worker.js';
import { sample } from './pdf-fixture.js';

const lease = '17b65226-7537-4adf-83e8-57cf5b6aa250';

function fixture({
  drift = false,
  uploadError = false,
  finishOutcome = 'success',
  oversizedReadback = false,
  removeThrows = false,
} = {}) {
  const calls = [];
  let stored;
  const bucket = {
    async upload(path, bytes, options) {
      calls.push(['upload', path, options]);
      if (uploadError) return { error: new Error('network_unknown') };
      stored = Buffer.from(bytes);
      return { error: null };
    },
    async download(path) {
      calls.push(['download', path]);
      if (oversizedReadback)
        return {
          data: {
            size: 15_000_001,
            arrayBuffer: () => {
              throw new Error('oversized_readback_was_buffered');
            },
          },
          error: null,
        };
      return { data: new Blob([stored]), error: null };
    },
    async remove(paths) {
      calls.push(['remove', paths]);
      if (removeThrows) throw new Error('storage_cleanup_unavailable');
      return { error: null };
    },
  };
  const client = {
    storage: {
      from: (name) => {
        assert.equal(name, 'finance-reports-private');
        return bucket;
      },
    },
    from(name) {
      assert.equal(name, 'finance_report_runs');
      return {
        select: () => ({ eq: () => ({ single: async () => ({ data: sample.metadata }) }) }),
      };
    },
    rpc(name, args) {
      calls.push([name, args]);
      if (name === 'claim_finance_report_artifact')
        return Promise.resolve({
          data: [{ run_id: sample.runId, format: 'csv', lease_token: lease }],
        });
      if (name === 'finish_finance_report_artifact' && finishOutcome !== 'success')
        return Promise.reject(new Error('finish_response_lost'));
      if (name === 'finish_finance_report_artifact' || name === 'fail_finance_report_artifact')
        return Promise.resolve({
          data: name !== 'fail_finance_report_artifact' || finishOutcome !== 'committed',
        });
      return {
        range: async () => ({
          data:
            name === 'worker_finance_report_lines'
              ? sample.lines
              : [{ ...sample.balances[0], closing_paise: drift ? '12344' : '12345' }],
        }),
      };
    },
  };
  return { client, calls };
}

test('disabled artifact worker does not claim a report', async () => {
  assert.equal(await runReportArtifactTick({ enabled: false }), null);
});

test('worker verifies private bytes before recording ready digest', async () => {
  const { client, calls } = fixture();
  assert.deepEqual(await runReportArtifactTick({ client, enabled: true }), {
    runId: sample.runId,
    format: 'csv',
    status: 'ready',
  });
  const finish = calls.find(([name]) => name === 'finish_finance_report_artifact')[1];
  assert.equal(finish.p_object_path, `${sample.runId}/csv/${lease}.csv`);
  assert.equal(finish.p_byte_count > 0, true);
  assert.match(finish.p_sha256, /^[0-9a-f]{64}$/);
  assert.ok(calls.some(([name]) => name === 'download'));
});

test('render drift fails without upload and is retryable', async () => {
  const { client, calls } = fixture({ drift: true });
  assert.equal((await runReportArtifactTick({ client, enabled: true })).status, 'failed');
  assert.ok(!calls.some(([name]) => name === 'upload'));
  const failure = calls.find(([name]) => name === 'fail_finance_report_artifact')[1];
  assert.equal(failure.p_failure_code, 'render_failed');
  assert.equal(failure.p_terminal, false);
});

test('uncertain upload fails terminally and attempts private cleanup', async () => {
  const { client, calls } = fixture({ uploadError: true });
  assert.equal((await runReportArtifactTick({ client, enabled: true })).status, 'failed');
  assert.ok(calls.some(([name]) => name === 'remove'));
  const failure = calls.find(([name]) => name === 'fail_finance_report_artifact')[1];
  assert.equal(failure.p_failure_code, 'upload_ambiguous');
  assert.equal(failure.p_terminal, true);
});

test('oversized readback is rejected before buffering and the object is cleaned up', async () => {
  const { client, calls } = fixture({ oversizedReadback: true });
  assert.equal((await runReportArtifactTick({ client, enabled: true })).status, 'failed');
  assert.ok(calls.some(([name]) => name === 'remove'));
  const failure = calls.find(([name]) => name === 'fail_finance_report_artifact')[1];
  assert.equal(failure.p_failure_code, 'upload_ambiguous');
  assert.equal(failure.p_terminal, true);
});

test('cleanup exception still records a terminal ambiguous attempt', async () => {
  const { client, calls } = fixture({ uploadError: true, removeThrows: true });
  assert.equal((await runReportArtifactTick({ client, enabled: true })).status, 'failed');
  const failure = calls.find(([name]) => name === 'fail_finance_report_artifact')[1];
  assert.equal(failure.p_failure_code, 'upload_ambiguous');
  assert.equal(failure.p_terminal, true);
});

test('uncertain finish keeps the object for terminal operator recovery', async () => {
  const { client, calls } = fixture({ finishOutcome: 'uncommitted' });
  assert.deepEqual(await runReportArtifactTick({ client, enabled: true }), {
    runId: sample.runId,
    format: 'csv',
    status: 'failed',
    code: 'upload_ambiguous',
  });
  assert.ok(!calls.some(([name]) => name === 'remove'));
  const failure = calls.find(([name]) => name === 'fail_finance_report_artifact')[1];
  assert.equal(failure.p_terminal, true);
});

test('lost ready response never deletes the object already referenced by the database', async () => {
  const { client, calls } = fixture({ finishOutcome: 'committed' });
  await assert.rejects(
    runReportArtifactTick({ client, enabled: true }),
    /artifact_failure_state_unavailable/,
  );
  assert.ok(!calls.some(([name]) => name === 'remove'));
});
