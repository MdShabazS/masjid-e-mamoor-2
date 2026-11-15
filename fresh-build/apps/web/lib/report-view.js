const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export { reportPeriod } from '../../../packages/api-client/report-period.js';

export function formatPaise(value) {
  const amount = BigInt(value);
  const absolute = amount < 0n ? -amount : amount;
  return `${amount < 0n ? '-' : ''}₹${(absolute / 100n).toLocaleString('en-IN')}.${String(absolute % 100n).padStart(2, '0')}`;
}

export function validRunId(id) {
  return UUID.test(id);
}

export async function verifyCsvDigest(bytes, expected, subtle = globalThis.crypto?.subtle) {
  if (!/^[a-f0-9]{64}$/i.test(expected ?? '') || !subtle) return false;
  const actual = [...new Uint8Array(await subtle.digest('SHA-256', bytes))]
    .map((part) => part.toString(16).padStart(2, '0'))
    .join('');
  return actual.toLowerCase() === expected.toLowerCase();
}
