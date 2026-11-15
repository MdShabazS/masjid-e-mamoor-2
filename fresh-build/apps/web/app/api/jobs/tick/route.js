import { createClient } from '@supabase/supabase-js';
import { runQueueTick } from '../../../../../../backend/jobs/tick.js';

export const runtime = 'nodejs';
export async function POST(request) {
  const secret = process.env.QUEUE_CRON_SECRET;
  const url = process.env.SUPABASE_URL,
    key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret || !url || !key) return new Response('Unavailable', { status: 503 });
  try {
    const client = createClient(url, key, { auth: { persistSession: false } });
    const result = await runQueueTick({
      authorization: request.headers.get('authorization'),
      secret,
      client,
    });
    return Response.json({ data: result }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return new Response(error.message === 'job_unauthorized' ? 'Forbidden' : 'Unavailable', {
      status: error.message === 'job_unauthorized' ? 403 : 503,
    });
  }
}
