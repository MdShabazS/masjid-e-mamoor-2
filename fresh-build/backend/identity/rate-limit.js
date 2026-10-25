import { createHash } from 'node:crypto';

export function createIdentityLimiter(client) {
  if (!client?.rpc) throw new Error('rate_limit_store_required');
  return {
    async consume(key) {
      const [kind] = key.split(':');
      const [limit, window] =
        kind === 'session'
          ? [5, 300]
          : kind === 'password'
            ? [5, 600]
            : kind === 'receipt'
              ? [60, 60]
              : kind === 'receipt-code'
                ? [5, 60]
                : kind === 'qr'
                  ? [5, 3600]
                  : [30, 60];
      const hash = createHash('sha256').update(key).digest('hex');
      const { data, error } = await client.rpc('consume_identity_rate_limit', {
        p_hash: hash,
        p_limit: limit,
        p_window_seconds: window,
      });
      if (error || typeof data !== 'boolean') throw new Error('rate_limit_store_unavailable');
      return data;
    },
  };
}
