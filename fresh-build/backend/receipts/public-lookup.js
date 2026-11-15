const MONTHLY = /^MEM2-R-[0-9A-F]{32}$/;
const ONE_TIME = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_BODY_BYTES = 256;

function response(status, data) {
  return Response.json(data, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

async function boundedBody(request) {
  if (Number(request.headers.get('content-length')) > MAX_BODY_BYTES || !request.body)
    throw new Error('invalid_body');
  const reader = request.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_BODY_BYTES) throw new Error('invalid_body');
      chunks.push(value);
    }
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
  return JSON.parse(Buffer.concat(chunks, total).toString('utf8'));
}

export function createPublicReceiptLookup({
  createClient,
  url,
  serviceKey,
  limiter,
  trustedClientIp,
  enabled,
  onInternalError = /** @type {(error: unknown) => void} */ (() => {}),
}) {
  return async function lookup(request) {
    if (!enabled || !url || !serviceKey || !limiter || !trustedClientIp)
      return response(503, { error: { code: 'PUBLICATION_DISABLED' } });
    if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type') ?? ''))
      return response(415, { error: { code: 'INVALID_INPUT' } });
    try {
      const ip = trustedClientIp(request);
      if (!ip || typeof ip !== 'string')
        return response(503, { error: { code: 'SERVICE_UNAVAILABLE' } });
      if (!(await limiter.consume(`receipt:${ip}`)))
        return response(429, { error: { code: 'RATE_LIMITED' } });
      let body;
      try {
        body = await boundedBody(request);
      } catch {
        return response(400, { error: { code: 'INVALID_INPUT' } });
      }
      const code = body?.code;
      if (
        !body ||
        typeof body !== 'object' ||
        Array.isArray(body) ||
        Object.keys(body).length !== 1 ||
        typeof code !== 'string' ||
        !(MONTHLY.test(code) || ONE_TIME.test(code))
      )
        return response(404, { error: { code: 'RECEIPT_NOT_FOUND' } });
      if (!(await limiter.consume(`receipt-code:${code}`)))
        return response(429, { error: { code: 'RATE_LIMITED' } });
      const server = createClient(url, serviceKey, { auth: { persistSession: false } });
      const { data, error } = await server.rpc('lookup_active_receipt', { p_code: code });
      if (error) throw error;
      if (!Array.isArray(data) || data.length > 1) throw new Error('invalid_receipt_projection');
      if (!data.length) return response(404, { error: { code: 'RECEIPT_NOT_FOUND' } });
      const row = data[0];
      if (!DATE.test(row?.receipt_date ?? '') || !/^[1-9]\d*$/.test(row?.amount_paise ?? ''))
        throw new Error('invalid_receipt_projection');
      const paise = BigInt(row.amount_paise);
      return response(200, {
        status: 'verified',
        date: row.receipt_date,
        amountINR: `${paise / 100n}.${String(paise % 100n).padStart(2, '0')}`,
      });
    } catch (error) {
      onInternalError(error);
      return response(503, { error: { code: 'SERVICE_UNAVAILABLE' } });
    }
  };
}
