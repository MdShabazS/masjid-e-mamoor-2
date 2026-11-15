function unwrap(result) {
  if (result.error) throw new Error('whatsapp_storage_unavailable');
  return result.data;
}

/** Instantiate only with a server-only Supabase client. Never ship this to Android/browser. */
export function createWhatsAppDbAdapter(client) {
  return {
    async claim(now) {
      const rows = unwrap(await client.rpc('claim_next_monthly_whatsapp', { p_now: now }));
      return rows?.[0] ?? null;
    },
    async preflight(outboxId, leaseId) {
      return unwrap(
        await client.rpc('preflight_monthly_whatsapp', {
          p_outbox_id: outboxId,
          p_lease_id: leaseId,
        }),
      );
    },
    async finish(outboxId, leaseId, providerId, errorCode, retryable) {
      return unwrap(
        await client.rpc('finish_monthly_whatsapp', {
          p_outbox_id: outboxId,
          p_lease_id: leaseId,
          p_provider_message_id: providerId,
          p_error_code: errorCode,
          p_retryable: retryable,
        }),
      );
    },
    async recordInbound(id, from, text) {
      return unwrap(
        await client.rpc('record_signed_whatsapp_inbound', {
          p_message_id: id,
          p_from_e164: from,
          p_text: text,
        }),
      );
    },
    async recordStatus(id, state, timestamp) {
      // The provider normally includes a timestamp; no invented status time.
      if (!timestamp) throw new Error('provider_status_timestamp_missing');
      return unwrap(
        await client.rpc('record_signed_whatsapp_status', {
          p_provider_message_id: id,
          p_state: state,
          p_provider_timestamp: timestamp,
        }),
      );
    },
    async health() {
      return unwrap(await client.rpc('monthly_whatsapp_delivery_health'));
    },
  };
}
