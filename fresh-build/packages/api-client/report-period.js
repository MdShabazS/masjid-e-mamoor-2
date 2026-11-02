const DATE = /^\d{4}-\d{2}-\d{2}$/;

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

/** A whole month from its first day, YYYY-MM-01. */
export function monthReport(firstDay) {
  const a = new Date(`${firstDay}T00:00:00Z`);
  if (Number.isNaN(a.valueOf())) throw new Error('Choose a month.');
  const end = new Date(Date.UTC(a.getUTCFullYear(), a.getUTCMonth() + 1, 1));
  return reportPeriod('month', firstDay, end.toISOString().slice(0, 10));
}

export function yearReport(year) {
  return reportPeriod('year', `${year}-01-01`, `${Number(year) + 1}-01-01`);
}

/** People choose the last day they want included; the database takes an exclusive end. */
export function rangeReport(start, lastDay) {
  if (!DATE.test(start) || !DATE.test(lastDay)) throw new Error('Choose both dates.');
  const end = new Date(Date.parse(`${lastDay}T00:00:00Z`) + 86400000);
  return reportPeriod('range', start, end.toISOString().slice(0, 10));
}
