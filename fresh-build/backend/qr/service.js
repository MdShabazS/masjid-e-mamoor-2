import { inspectQrAsset, readBoundedRequest } from './asset.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const roles = new Set(['president']);

function failure(status, code) {
  return Response.json({ error: { code } }, { status, headers: { 'Cache-Control': 'no-store' } });
}

export function createPaymentQrHandler({
  createClient,
  url,
  publishableKey,
  secretKey,
  limiter,
  onInternalError = /** @type {(stage: string, error: unknown) => void} */ (() => {}),
}) {
  return async function handlePaymentQr(request) {
    if (!url || !publishableKey || !secretKey) return failure(503, 'SERVICE_UNAVAILABLE');
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
      if (!(await limiter.consume(`qr:${userData.user.id}`))) return failure(429, 'RATE_LIMITED');

      stage = 'parse';
      const contentType = request.headers.get('content-type') ?? '';
      if (!/^multipart\/form-data;\s*boundary=/i.test(contentType))
        return failure(400, 'INVALID_QR_INPUT');
      let form;
      try {
        const raw = await readBoundedRequest(request);
        form = /** @type {any} */ (
          await new Request('http://local.invalid', {
            method: 'POST',
            headers: { 'Content-Type': contentType },
            body: raw,
          }).formData()
        );
      } catch (error) {
        return failure(
          error.message === 'QR_IMAGE_TOO_LARGE' ? 413 : 400,
          error.message === 'QR_IMAGE_TOO_LARGE' ? 'QR_IMAGE_TOO_LARGE' : 'INVALID_QR_INPUT',
        );
      }
      const keys = [...form.keys()];
      if (
        keys.length !== 4 ||
        keys.some((key) => !['accountId', 'operationId', 'payeeConfirmed', 'file'].includes(key))
      )
        return failure(400, 'INVALID_QR_INPUT');
      const accountId = form.get('accountId');
      const operationId = form.get('operationId');
      const file = form.get('file');
      if (
        typeof accountId !== 'string' ||
        typeof operationId !== 'string' ||
        !UUID.test(accountId) ||
        !UUID.test(operationId) ||
        form.get('payeeConfirmed') !== 'true' ||
        !file ||
        typeof file.arrayBuffer !== 'function'
      )
        return failure(400, 'INVALID_QR_INPUT');

      stage = 'account';
      const { data: eligible, error: accountError } = await actor.rpc(
        'payment_qr_account_eligible',
        { p_account_id: accountId },
      );
      if (accountError) {
        onInternalError?.('account_query', accountError);
        return failure(503, 'SERVICE_UNAVAILABLE');
      }
      if (!eligible) return failure(400, 'QR_ACCOUNT_NOT_ACTIVE');
      const service = createClient(url, secretKey, { auth: { persistSession: false } });
      const bytes = Buffer.from(await file.arrayBuffer());
      stage = 'image';
      let inspected;
      try {
        inspected = await inspectQrAsset(bytes, file.type);
      } catch {
        return failure(400, 'INVALID_QR_IMAGE');
      }
      const path = `payment-qr/${operationId.toLowerCase()}.${inspected.extension}`;
      stage = 'storage';
      const bucket = service.storage.from('qr-private');
      const { error: uploadError } = await bucket.upload(path, bytes, {
        contentType: inspected.contentType,
        upsert: false,
        cacheControl: '0',
      });
      const { data: downloaded, error: downloadError } = await bucket.download(path);
      if (downloadError || !downloaded) return failure(503, 'QR_STORAGE_UNAVAILABLE');
      const storedBytes = Buffer.from(await downloaded.arrayBuffer());
      if (!storedBytes.equals(bytes))
        return failure(
          uploadError ? 409 : 503,
          uploadError ? 'QR_OPERATION_CONFLICT' : 'QR_STORAGE_MISMATCH',
        );
      const { error: registerError } = await service.rpc('register_verified_qr_asset', {
        p_asset_path: path,
        p_sha256_hex: inspected.sha256,
        p_bytes: inspected.bytes,
      });
      if (registerError)
        return failure(registerError.code === '23505' ? 409 : 503, 'QR_REGISTRATION_FAILED');
      stage = 'activation';
      const { data: versionId, error: activationError } = await actor.rpc('activate_payment_qr', {
        p_account_id: accountId,
        p_asset_path: path,
        p_sha256_hex: inspected.sha256,
        p_operation_id: operationId,
      });
      if (activationError)
        return failure(activationError.code === '23505' ? 409 : 400, 'QR_ACTIVATION_REJECTED');
      return Response.json(
        { data: { versionId, sha256: inspected.sha256, bytes: inspected.bytes } },
        { headers: { 'Cache-Control': 'no-store' } },
      );
    } catch (error) {
      onInternalError?.(stage, error);
      return failure(503, 'SERVICE_UNAVAILABLE');
    }
  };
}
