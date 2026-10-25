const formatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Kolkata',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});
export function indiaParts(instant) {
  const date = new Date(instant);
  if (!Number.isFinite(date.valueOf())) throw new Error('invalid_instant');
  return Object.fromEntries(
    formatter
      .formatToParts(date)
      .filter((x) => x.type !== 'literal')
      .map((x) => [x.type, Number(x.value)]),
  );
}
export function firstFridayWindow(instant) {
  const x = indiaParts(instant);
  const firstDay = new Date(Date.UTC(x.year, x.month - 1, 1)).getUTCDay();
  const friday = 1 + ((5 - firstDay + 7) % 7);
  return {
    period: `${x.year}-${String(x.month).padStart(2, '0')}`,
    due: x.day === friday && (x.hour > 10 || (x.hour === 10 && x.minute >= 0)),
  };
}
export function reminderDue({ requestSentAt, now, donorActive, consentApproved, verifiedCount }) {
  const sent = Date.parse(requestSentAt),
    current = Date.parse(now);
  if (!Number.isFinite(sent) || !Number.isFinite(current)) throw new Error('invalid_instant');
  return (
    donorActive === true &&
    consentApproved === true &&
    verifiedCount === 0 &&
    current >= sent + 5 * 24 * 60 * 60 * 1000
  );
}
export function threeUnpaidPeriods(periods) {
  if (!Array.isArray(periods) || periods.length < 3) return false;
  const last = periods.slice(-3);
  const indexes = last.map((x) => {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(x.period)) throw new Error('invalid_period');
    const [y, m] = x.period.split('-').map(Number);
    return y * 12 + m;
  });
  return (
    indexes[1] === indexes[0] + 1 &&
    indexes[2] === indexes[1] + 1 &&
    last.every((x) => x.requestSent === true && x.netVerifiedPaise === '0')
  );
}
