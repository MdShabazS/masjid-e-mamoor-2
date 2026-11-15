import {
  extractWebhookEvents,
  isStop,
  makeTemplateRequest,
  sendTemplate,
  toE164,
  verifyMetaSignature,
} from './transport.js';

/** db is a server-only adapter over the five service-role RPCs in the migration. */
export async function dispatchOne({ db, config, renderParameters, fetchImpl, now = new Date() }) {
  if (
    !config?.token ||
    !config?.phoneNumberId ||
    !config?.apiVersion ||
    typeof renderParameters !== 'function'
  )
    return { state: 'disabled' };
  const item = await db.claim(now.toISOString());
  if (!item) return { state: 'idle' };
  if (item.phone_number_id !== config.phoneNumberId) {
    await db.finish(item.outbox_id, item.lease_id, null, 'provider_rejected', false);
    return { state: 'failed' };
  }
  if (!(await db.preflight(item.outbox_id, item.lease_id))) return { state: 'cancelled' };
  let providerId;
  try {
    const parameters = renderParameters(item);
    const request = makeTemplateRequest({
      phoneNumberId: item.phone_number_id,
      templateName: item.template_name,
      languageCode: item.language_code,
      to: item.to_e164,
      parameters,
      apiVersion: config.apiVersion,
    });
    providerId = await sendTemplate(request, config.token, fetchImpl);
  } catch (error) {
    // A network exception is ambiguous: Meta may have accepted the request.
    // No automatic retry without a definite rate-limit response.
    const code =
      error.message === 'provider_rate_limited'
        ? 'rate_limited'
        : error.message === 'provider_rejected'
          ? 'provider_rejected'
          : error.message === 'provider_unavailable'
            ? 'provider_unavailable'
            : 'transport_unknown';
    await db.finish(item.outbox_id, item.lease_id, null, code, code === 'rate_limited');
    return { state: code === 'rate_limited' ? 'retry_queued' : 'failed' };
  }
  // If persistence fails after provider acceptance, preserve the ambiguous lease
  // for operator reconciliation; never submit a second provider request here.
  await db.finish(item.outbox_id, item.lease_id, providerId, null, false);
  return { state: 'accepted', providerId };
}

/** Call only from a server route that supplies the raw request body and secret. */
export async function processSignedWebhook({ rawBody, signature, appSecret, db, phoneNumberId }) {
  if (
    !Buffer.isBuffer(rawBody) ||
    rawBody.length > 1024 * 1024 ||
    !verifyMetaSignature(rawBody, signature, appSecret)
  )
    throw new Error('invalid_webhook_signature');
  const events = extractWebhookEvents(JSON.parse(rawBody.toString('utf8')), phoneNumberId);
  let processed = 0;
  for (const event of events) {
    if (event.kind === 'inbound') {
      await db.recordInbound(
        event.id,
        toE164(event.from),
        isStop(event.text) ? 'STOP' : event.text,
      );
      processed++;
    } else {
      await db.recordStatus(event.id, event.state, event.timestamp);
      processed++;
    }
  }
  return processed;
}
