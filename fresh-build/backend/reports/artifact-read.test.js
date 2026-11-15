import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { readReportArtifact } from './artifact-read.js';
import { sample } from './pdf-fixture.js';

const path = `${sample.runId}/csv/17b65226-7537-4adf-83e8-57cf5b6aa250.csv`;

function fixture(status, { mismatch = false } = {}) {
  const bytes = Buffer.from('private csv');
  const artifact =
    status === 'missing'
      ? null
      : {
          status,
          object_path: path,
          sha256: mismatch ? 'a'.repeat(64) : createHash('sha256').update(bytes).digest('hex'),
          byte_count: bytes.length,
        };
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: artifact, error: null }),
          }),
        }),
      }),
    }),
    storage: { from: () => ({ download: async () => ({ data: new Blob([bytes]), error: null }) }) },
  };
}

test('private artifact read distinguishes pending and failed without bytes', async () => {
  for (const state of ['missing', 'queued', 'processing'])
    assert.deepEqual(await readReportArtifact(fixture(state), sample.runId, 'csv'), {
      status: 'pending',
    });
  assert.deepEqual(await readReportArtifact(fixture('failed'), sample.runId, 'csv'), {
    status: 'failed',
  });
});

test('ready artifact is checked against saved length and SHA-256', async () => {
  const ready = await readReportArtifact(fixture('ready'), sample.runId, 'csv');
  assert.equal(ready.status, 'ready');
  assert.equal(ready.bytes.toString(), 'private csv');
  await assert.rejects(
    readReportArtifact(fixture('ready', { mismatch: true }), sample.runId, 'csv'),
    /artifact_digest_mismatch/,
  );
});
