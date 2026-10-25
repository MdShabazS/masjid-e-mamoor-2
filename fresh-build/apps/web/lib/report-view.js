const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export function formatPaise(value) {
  const amount = BigInt(value);
  const absolute = amount < 0n ? -amount : amount;
  return `${amount < 0n ? '-' : ''}₹${(absolute / 100n).toLocaleString('en-IN')}.${String(absolute % 100n).padStart(2, '0')}`;
}

export function reportPeriod(kind, start, end) {
  if (!DATE.test(start) || !DATE.test(end)) throw new Error('Choose valid dates.');
  const a = new Date(`${start}T00:00:00Z`);
  const b = new Date(`${end}T00:00:00Z`);
  if (
    Number.isNaN(a.valueOf()) ||
    Number.isNaN(b.valueOf()) ||
    a.toISOString().slice(0, 10) !== start ||
    b.toISOString().slice(0, 10) !== end
  )
    throw new Error('Choose valid dates.');
  const days = (b.getTime() - a.getTime()) / 86400000;
  if (days < 1 || days > 366) throw new Error('Report range must be 1 to 366 days.');
  const nextMonth = new Date(Date.UTC(a.getUTCFullYear(), a.getUTCMonth() + 1, 1))
    .toISOString()
    .slice(0, 10);
  const nextYear = `${a.getUTCFullYear() + 1}-01-01`;
  if (kind === 'month' && (a.getUTCDate() !== 1 || end !== nextMonth))
    throw new Error('A monthly report must cover one complete calendar month.');
  if (kind === 'year' && (start.slice(5) !== '01-01' || end !== nextYear))
    throw new Error('A yearly report must cover one complete calendar year.');
  if (!['month', 'year', 'range'].includes(kind)) throw new Error('Choose a report period.');
  return { p_kind: kind, p_start: start, p_end_exclusive: end, p_include_proofs: false };
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
