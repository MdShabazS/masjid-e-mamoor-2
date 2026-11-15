import { createClient } from '@supabase/supabase-js';
import { assertJobAuthorization } from '../../../../../../../backend/jobs/tick.js';
import { runReportArtifactTick } from '../../../../../../../backend/reports/artifact-worker.js';

export const runtime = 'nodejs';

export async function POST(request) {
  const secret = process.env.QUEUE_CRON_SECRET;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (
    !secret ||
    !url ||
    !key ||
    process.env.REPORT_EXPORTS_APPROVED !== 'true' ||
    process.env.REPORT_ARTIFACT_WORKER_ENABLED !== 'true'
  )
    return new Response('Unavailable', { status: 503 });
  try {
    assertJobAuthorization(request.headers.get('authorization'), secret);
    const client = createClient(url, key, { auth: { persistSession: false } });
    const artifact = await runReportArtifactTick({ client, enabled: true });
    return Response.json({ artifact }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return new Response(error.message === 'job_unauthorized' ? 'Forbidden' : 'Unavailable', {
      status: error.message === 'job_unauthorized' ? 403 : 503,
    });
  }
}
