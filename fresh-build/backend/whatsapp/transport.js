import { createHmac, timingSafeEqual } from 'node:crypto';

/** Verify the exact raw POST bytes before JSON parsing or accepting any event. */
export function verifyMetaSignature(rawBody, header, appSecret) {
  if (!appSecret || !Buffer.isBuffer(rawBody) || !/^sha256=[a-f0-9]{64}$/i.test(header ?? ''))
    return false;
  const expected = createHmac('sha256', appSecret).update(rawBody).digest();
  const received = Buffer.from(header.slice(7), 'hex');
  return received.length === expected.length && timingSafeEqual(expected, received);
}

export function verifyWebhookChallenge(query, expectedToken) {
  if (
    !expectedToken ||
    query?.['hub.mode'] !== 'subscribe' ||
    typeof query?.['hub.verify_token'] !== 'string' ||
    typeof query?.['hub.challenge'] !== 'string'
  )
    return null;
  const left = Buffer.from(query['hub.verify_token']);
  const right = Buffer.from(expectedToken);
  return left.length === right.length && timingSafeEqual(left, right)
    ? query['hub.challenge']
    : null;
}

/** Extract only recognized events from a verified payload. Unknown fields are ignored. */
export function extractWebhookEvents(payload, expectedPhoneNumberId) {
  if (payload?.object !== 'whatsapp_business_account' || !Array.isArray(payload.entry))
    throw new Error('invalid_webhook');
  const events = [];
  for (const entry of payload.entry)
    for (const change of entry.changes ?? []) {
      if (change.field !== 'messages') continue;
      const value = change.value ?? {};
      // One Meta app can subscribe to more than one number. Never apply another
      // number's STOP or delivery event to this masjid's donor records.
      if (expectedPhoneNumberId && value.metadata?.phone_number_id !== expectedPhoneNumberId)
        continue;
      for (const message of value.messages ?? []) {
        if (typeof message.id !== 'string' || typeof message.from !== 'string') continue;
        events.push({
          kind: 'inbound',
          id: message.id,
          from: message.from,
          text: message.type === 'text' ? (message.text?.body ?? '') : '',
        });
      }
      for (const status of value.statuses ?? []) {
        if (
          typeof status.id !== 'string' ||
          !['sent', 'delivered', 'read', 'failed'].includes(status.status)
        )
          continue;
        events.push({
          kind: 'status',
          id: status.id,
          state: status.status,
          timestamp: status.timestamp ?? null,
        });
      }
    }
  return events;
}

export function isStop(text) {
  return /^(stop|unsubscribe|cancel)$/i.test(String(text ?? '').trim());
}

export function toE164(whatsappFrom) {
  if (typeof whatsappFrom !== 'string' || !/^[1-9]\d{7,14}$/.test(whatsappFrom))
    throw new Error('invalid_sender');
  return `+${whatsappFrom}`;
}

export function retryDelaySeconds(attempt) {
  if (!Number.isInteger(attempt) || attempt < 1 || attempt > 5) throw new Error('invalid_attempt');
  return Math.min(60 * 2 ** (attempt - 1), 3600);
}

/** Template binding comes from server configuration after Meta approval. */
export function makeTemplateRequest({
  phoneNumberId,
  templateName,
  languageCode,
  to,
  parameters,
  apiVersion,
}) {
  if (
    !/^\d{5,30}$/.test(phoneNumberId ?? '') ||
    !/^[a-z][a-z0-9_]{1,127}$/.test(templateName ?? '') ||
    !/^[a-z]{2}(?:_[A-Z]{2})?$/.test(languageCode ?? '') ||
    !/^\+[1-9]\d{7,14}$/.test(to ?? '') ||
    !/^v\d+\.\d+$/.test(apiVersion ?? '') ||
    !Array.isArray(parameters) ||
    !parameters.every((x) => typeof x === 'string' && x.length <= 1024)
  )
    throw new Error('whatsapp_not_configured');
  return {
    url: `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`,
    body: {
      messaging_product: 'whatsapp',
      to: to.slice(1),
      type: 'template',
      template: {
        name: templateName,
        language: { code: languageCode },
        components: [
          { type: 'body', parameters: parameters.map((text) => ({ type: 'text', text })) },
        ],
      },
    },
  };
}

export async function sendTemplate(request, token, fetchImpl = fetch) {
  if (typeof token !== 'string' || token.length < 16) throw new Error('whatsapp_not_configured');
  const response = await fetchImpl(request.url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(request.body),
  });
  if (!response.ok)
    throw new Error(
      response.status === 429
        ? 'provider_rate_limited'
        : response.status >= 500
          ? 'provider_unavailable'
          : 'provider_rejected',
    );
  const result = await response.json();
  const id = result?.messages?.[0]?.id;
  if (typeof id !== 'string' || id.length < 3 || id.length > 240)
    throw new Error('provider_response_invalid');
  return id;
}
