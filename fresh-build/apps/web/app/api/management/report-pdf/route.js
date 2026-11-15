import { createClient } from '@supabase/supabase-js';
import { createIdentityLimiter } from '../../../../../../backend/identity/rate-limit.js';
import { createReportPdfHandler } from '../../../../../../backend/reports/pdf-handler.js';

export const runtime = 'nodejs';

export async function GET(request) {
  const url = process.env.SUPABASE_URL;
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const limiter =
    url && serviceKey
      ? createIdentityLimiter(createClient(url, serviceKey, { auth: { persistSession: false } }))
      : null;
  return createReportPdfHandler({
    createClient,
    url,
    publishableKey,
    serviceKey,
    limiter,
    enabled: process.env.REPORT_EXPORTS_APPROVED === 'true',
    artifactMode: process.env.REPORT_ARTIFACT_WORKER_ENABLED === 'true',
  })(request);
}
