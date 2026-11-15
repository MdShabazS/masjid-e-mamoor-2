import { createClient } from '@supabase/supabase-js';
import { identityHandler } from '../../../../../../backend/api/identity-handler.js';
import { createIdentityService } from '../../../../../../backend/identity/service.js';
import { supabaseIdentityAdapters } from '../../../../../../backend/identity/supabase-adapters.js';
import { createIdentityLimiter } from '../../../../../../backend/identity/rate-limit.js';
import { trustedClientIp } from '../../../../lib/trusted-client-ip.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function route(request) {
  const url = process.env.SUPABASE_URL;
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;
  const secretKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !publishableKey || !secretKey)
    return Response.json(
      { error: { code: 'SERVICE_UNAVAILABLE' } },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  const adapters = supabaseIdentityAdapters({ createClient, url, publishableKey, secretKey });
  const identity = createIdentityService({
    ...adapters,
    internalDomain: process.env.IDENTITY_INTERNAL_DOMAIN || 'accounts.masjid.invalid',
  });
  const service = createClient(url, secretKey, { auth: { persistSession: false } });
  const handler = identityHandler({
    identity,
    limiter: createIdentityLimiter(service),
    trustedProxyIp: trustedClientIp,
  });
  const target = new URL(request.url);
  target.pathname = target.pathname.replace(/^\/api\/v1\//, '/v1/');
  return handler(new Request(target, request));
}
export const GET = route;
export const POST = route;
