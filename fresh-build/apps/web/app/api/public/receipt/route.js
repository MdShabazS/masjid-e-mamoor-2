import { createClient } from '@supabase/supabase-js';
import { createIdentityLimiter } from '../../../../../../backend/identity/rate-limit.js';
import { createPublicReceiptLookup } from '../../../../../../backend/receipts/public-lookup.js';

export const runtime = 'nodejs';

export async function POST(request) {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const limiter =
    url && serviceKey
      ? createIdentityLimiter(createClient(url, serviceKey, { auth: { persistSession: false } }))
      : null;
  return createPublicReceiptLookup({
    createClient,
    url,
    serviceKey,
    limiter,
    enabled: process.env.PUBLIC_RECEIPT_LOOKUP_APPROVED === 'true',
  })(request);
}
