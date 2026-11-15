import { createClient } from '@supabase/supabase-js';
import { processSignedWebhook } from '../../../../../../backend/whatsapp/worker.js';
import { verifyWebhookChallenge } from '../../../../../../backend/whatsapp/transport.js';
import { createWhatsAppDbAdapter } from '../../../../../../backend/whatsapp/supabase-adapter.js';

export const runtime = 'nodejs';

export async function GET(request) {
  const query = Object.fromEntries(new URL(request.url).searchParams);
  const challenge = verifyWebhookChallenge(query, process.env.META_WEBHOOK_VERIFY_TOKEN);
  return challenge === null
    ? new Response('Forbidden', { status: 403 })
    : new Response(challenge, {
        status: 200,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
}

export async function POST(request) {
  const appSecret = process.env.META_APP_SECRET;
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const phoneNumberId = process.env.META_PHONE_NUMBER_ID;
  if (!appSecret || !url || !serviceKey || !phoneNumberId)
    return new Response('Unavailable', { status: 503 });
  const length = Number(request.headers.get('content-length'));
  if (length > 1024 * 1024) return new Response('Too large', { status: 413 });
  const rawBody = Buffer.from(await request.arrayBuffer());
  if (rawBody.length > 1024 * 1024) return new Response('Too large', { status: 413 });
  const client = createClient(url, serviceKey, { auth: { persistSession: false } });
  try {
    await processSignedWebhook({
      rawBody,
      signature: request.headers.get('x-hub-signature-256'),
      appSecret,
      phoneNumberId,
      db: createWhatsAppDbAdapter(client),
    });
    return new Response('OK', { status: 200 });
  } catch (error) {
    const invalid = ['invalid_webhook_signature', 'invalid_webhook', 'invalid_sender'];
    return new Response(invalid.includes(error.message) ? 'Invalid request' : 'Unavailable', {
      status: invalid.includes(error.message) ? 401 : 503,
    });
  }
}
