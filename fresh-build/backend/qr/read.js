import { inspectQrAsset, MAX_QR_BYTES } from './asset.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const roles = new Set(['president', 'treasurer']);

function failure(status, code) {
  return Response.json({ error: { code } }, { status, headers: { 'Cache-Control': 'no-store' } });
}

export function createPaymentQrReadHandler({
  createClient,
  url,
  publishableKey,
  secretKey,
  limiter,
  onInternalError = /** @type {(stage: string, error: unknown) => void} */ (() => {}),
}) {
  return async function handlePaymentQrRead(request) {
    if (!url || !publishableKey || !secretKey || !limiter)
      return failure(503, 'SERVICE_UNAVAILABLE');
    const accountId = new URL(request.url).searchParams.get('accountId');
    if (!accountId || !UUID.test(accountId)) return failure(400, 'INVALID_ACCOUNT');
    const authorization = request.headers.get('authorization') ?? '';
    if (!/^Bearer [^\s]+$/.test(authorization)) return failure(401, 'AUTH_REQUIRED');
    const actor = createClient(url, publishableKey, {
      auth: { persistSession: false },
      global: { headers: { Authorization: authorization } },
    });
    let stage = 'identity';
    try {
      const { data: userData, error: userError } = await actor.auth.getUser(authorization.slice(7));
      if (userError || !userData?.user?.id) return failure(401, 'AUTH_REQUIRED');
      const { data: gateRows, error: gateError } = await actor.rpc('current_identity_gate');
      const gate = Array.isArray(gateRows) ? gateRows[0] : gateRows;
      if (gateError || !gate?.account_active || gate.must_change_password)
        return failure(403, 'FORBIDDEN');
      const { data: role, error: roleError } = await actor.rpc('current_app_role');
      if (roleError || !roles.has(role)) return failure(403, 'FORBIDDEN');
      if (!(await limiter.consume(`qrread:${userData.user.id}`)))
        return failure(429, 'RATE_LIMITED');
      stage = 'lookup';
      const { data: rows, error: lookupError } = await actor.rpc('active_payment_qr_for_staff', {
        p_account_id: accountId,
      });
      if (lookupError) {
        onInternalError?.('lookup', lookupError);
        return failure(503, 'SERVICE_UNAVAILABLE');
      }
      const version = rows?.[0];
      if (!version) return failure(404, 'QR_NOT_FOUND');
      stage = 'storage';
      const service = createClient(url, secretKey, { auth: { persistSession: false } });
      const { data: image, error: downloadError } = await service.storage
        .from('qr-private')
        .download(version.asset_path);
      if (downloadError || !image || image.size > MAX_QR_BYTES)
        return failure(503, 'QR_STORAGE_UNAVAILABLE');
      const bytes = Buffer.from(await image.arrayBuffer());
      const declaredType = version.asset_path.endsWith('.png') ? 'image/png' : 'image/jpeg';
      let inspected;
      try {
        inspected = await inspectQrAsset(bytes, declaredType);
      } catch {
        return failure(503, 'QR_STORAGE_MISMATCH');
      }
      if (
        inspected.sha256 !== version.sha256_hex ||
        inspected.bytes !== Number(version.asset_bytes)
      )
        return failure(503, 'QR_STORAGE_MISMATCH');
      stage = 'current_version';
      const { data: latest, error: latestError } = await actor.rpc('active_payment_qr_for_staff', {
        p_account_id: accountId,
      });
      if (latestError) return failure(503, 'SERVICE_UNAVAILABLE');
      if (latest?.[0]?.version_id !== version.version_id) return failure(409, 'QR_CHANGED_RETRY');
      return new Response(bytes, {
        headers: {
          'Content-Type': inspected.contentType,
          'Content-Length': String(bytes.length),
          'Cache-Control': 'private, no-store',
          'X-Content-Type-Options': 'nosniff',
          'X-QR-SHA256': inspected.sha256,
          'X-QR-Version-ID': version.version_id,
        },
      });
    } catch (error) {
      onInternalError?.(stage, error);
      return failure(503, 'SERVICE_UNAVAILABLE');
    }
  };
}
