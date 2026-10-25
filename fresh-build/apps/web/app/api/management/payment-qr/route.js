import { createClient } from '@supabase/supabase-js';
import { createPaymentQrHandler } from '../../../../../../backend/qr/service.js';
import { createPaymentQrReadHandler } from '../../../../../../backend/qr/read.js';
import { createIdentityLimiter } from '../../../../../../backend/identity/rate-limit.js';

export const runtime = 'nodejs';

export async function POST(request) {
  const url = process.env.SUPABASE_URL;
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;
  const secretKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const limiter =
    url && secretKey
      ? createIdentityLimiter(createClient(url, secretKey, { auth: { persistSession: false } }))
      : null;
  return createPaymentQrHandler({ createClient, url, publishableKey, secretKey, limiter })(request);
}

export async function GET(request) {
  const url = process.env.SUPABASE_URL;
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;
  const secretKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const limiter =
    url && secretKey
      ? createIdentityLimiter(createClient(url, secretKey, { auth: { persistSession: false } }))
      : null;
  return createPaymentQrReadHandler({ createClient, url, publishableKey, secretKey, limiter })(
    request,
  );
}
