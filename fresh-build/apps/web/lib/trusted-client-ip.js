import { isIP } from 'node:net';

// Vercel overwrites x-forwarded-for at ingress; other runtimes cannot claim
// that trust boundary and retain the deliberately shared fallback bucket.
export function trustedClientIp(request, hostedOnVercel = process.env.VERCEL === '1') {
  if (!hostedOnVercel) return 'shared';
  const value = request.headers.get('x-forwarded-for')?.trim();
  return value && isIP(value) ? value : null;
}
