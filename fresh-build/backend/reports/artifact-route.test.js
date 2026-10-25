import assert from 'node:assert/strict';
import test from 'node:test';
import { POST } from '../../apps/web/app/api/jobs/report-artifacts/tick/route.js';

const envKeys = [
  'QUEUE_CRON_SECRET',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'REPORT_EXPORTS_APPROVED',
  'REPORT_ARTIFACT_WORKER_ENABLED',
];

test('artifact worker route is disabled by default and rejects missing authorization', async () => {
  const before = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
  try {
    for (const key of envKeys) delete process.env[key];
    const request = new Request('https://example.test/api/jobs/report-artifacts/tick', {
      method: 'POST',
    });
    assert.equal((await POST(request)).status, 503);
    process.env.QUEUE_CRON_SECRET = 'a'.repeat(40);
    process.env.SUPABASE_URL = 'https://example.test';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'synthetic-test-key';
    process.env.REPORT_EXPORTS_APPROVED = 'true';
    process.env.REPORT_ARTIFACT_WORKER_ENABLED = 'true';
    assert.equal((await POST(request)).status, 403);
  } finally {
    for (const key of envKeys) {
      if (before[key] === undefined) delete process.env[key];
      else process.env[key] = before[key];
    }
  }
});
