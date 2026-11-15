import { randomUUID } from 'node:crypto';
import { apiError, uuid, ContractError } from '../../packages/contracts/index.js';
import { IdentityError } from '../identity/service.js';

const STATUS = {
  AUTH_REQUIRED: 401,
  INVALID_CREDENTIALS: 401,
  ACCOUNT_INACTIVE: 403,
  FORBIDDEN: 403,
  VALIDATION_FAILED: 400,
  OPERATION_CONFLICT: 409,
  RATE_LIMITED: 429,
  RECONCILIATION_REQUIRED: 503,
  SERVICE_UNAVAILABLE: 503,
};
const BASE = {
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
};
function answer(body, status) {
  return new Response(JSON.stringify(body), { status, headers: BASE });
}
function bearer(request) {
  const value = request.headers.get('authorization') ?? '';
  if (!/^Bearer [^\s]+$/.test(value)) throw new IdentityError('AUTH_REQUIRED');
  return value.slice(7);
}
async function json(request) {
  if (request.headers.get('content-type')?.split(';')[0] !== 'application/json')
    throw new ContractError();
  const body = await request.text();
  if (body.length > 4096) throw new ContractError();
  let value;
  try {
    value = JSON.parse(body);
  } catch {
    throw new ContractError();
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ContractError();
  return value;
}
function fields(data, allowed) {
  if (Object.keys(data).some((key) => !allowed.includes(key))) throw new ContractError();
  return data;
}

// Requires a durable shared limiter implementation at deployment. No default
// fail-open mode; no privileged key or raw SQL error is returned to callers.
export function identityHandler({ identity, limiter, trustedProxyIp }) {
  if (!identity || !limiter?.consume || !trustedProxyIp)
    throw new Error('identity route dependencies missing');
  return async function handle(request) {
    const requestId = randomUUID();
    try {
      const url = new URL(request.url);
      if (url.protocol !== 'https:' && url.hostname !== 'localhost' && url.hostname !== '127.0.0.1')
        throw new IdentityError('SERVICE_UNAVAILABLE');
      const ip = trustedProxyIp(request);
      if (!ip || typeof ip !== 'string') throw new IdentityError('SERVICE_UNAVAILABLE');
      const path = url.pathname;
      if (path === '/v1/me' && request.method === 'GET') {
        const result = await identity.me({ accessToken: bearer(request) });
        return answer({ data: result, requestId }, 200);
      }
      if (path === '/v1/session' && request.method === 'POST') {
        const body = fields(await json(request), ['username', 'password']);
        if (
          typeof body.username !== 'string' ||
          typeof body.password !== 'string' ||
          body.username.length > 128 ||
          body.password.length > 128
        )
          throw new ContractError();
        if (!(await limiter.consume(`session:${ip}:${body.username.trim().toLowerCase()}`)))
          throw new IdentityError('RATE_LIMITED');
        const result = await identity.signIn(body);
        return answer({ data: result, requestId }, 200);
      }
      if (path === '/v1/session/change-password' && request.method === 'POST') {
        const body = fields(await json(request), ['refreshToken', 'newPassword']);
        if (!(await limiter.consume(`password:${ip}`))) throw new IdentityError('RATE_LIMITED');
        const result = await identity.changePassword({ accessToken: bearer(request), ...body });
        return answer({ data: result, requestId }, 200);
      }
      if (path === '/v1/users' && request.method === 'POST') {
        const body = fields(await json(request), ['username', 'role']);
        if (!(await limiter.consume(`admin:${ip}`))) throw new IdentityError('RATE_LIMITED');
        const result = await identity.provision({ actorToken: bearer(request), ...body });
        return answer({ data: result, requestId }, 201);
      }
      const match = /^\/v1\/users\/([^/]+)\/(reset|state)$/.exec(path);
      if (match && request.method === 'POST') {
        const targetId = uuid(match[1]),
          actorToken = bearer(request);
        if (!(await limiter.consume(`admin:${ip}`))) throw new IdentityError('RATE_LIMITED');
        const body = await json(request);
        const result =
          match[2] === 'reset'
            ? await identity.resetPassword({ actorToken, targetId, ...fields(body, []) })
            : await identity.setAccountState({
                actorToken,
                targetId,
                ...fields(body, ['role', 'active']),
              });
        return answer({ data: result, requestId }, 200);
      }
      return answer(apiError('NOT_FOUND', requestId), 404);
    } catch (error) {
      const code =
        error instanceof ContractError
          ? 'VALIDATION_FAILED'
          : error instanceof IdentityError
            ? error.code
            : 'SERVICE_UNAVAILABLE';
      return answer(apiError(code, requestId, code === 'SERVICE_UNAVAILABLE'), STATUS[code] ?? 503);
    }
  };
}
