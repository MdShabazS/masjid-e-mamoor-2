const createRoles = new Set(['president', 'vice_president', 'secretary', 'data_entry']);
const radians = (degrees) => (degrees * Math.PI) / 180;
const localDay = (instant) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(instant));

export function canCreateMeeting(actor) {
  return actor?.active === true && createRoles.has(actor.role);
}

export function reminderEligible({ meeting, invite, now }) {
  const start = Date.parse(meeting.startsAt);
  const at = Date.parse(now);
  return (
    meeting.status === 'active' &&
    ['invited', 'accepted'].includes(invite.status) &&
    Number.isFinite(start) &&
    Number.isFinite(at) &&
    at >= start - 3600000 &&
    at < start
  );
}

export function metersBetween(a, b) {
  if (![a.latitude, a.longitude, b.latitude, b.longitude].every(Number.isFinite))
    throw new Error('invalid_coordinates');
  const dLat = radians(b.latitude - a.latitude),
    dLon = radians(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(radians(a.latitude)) * Math.cos(radians(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

// A client location is evidence to validate, not independently trustworthy proof.
export function checkInEligible({
  meeting,
  invite,
  center,
  fix,
  now,
  maximumAgeMs = 120000,
  maximumAccuracyMeters = 35,
}) {
  if (!center?.verified || !Number.isFinite(center.latitude) || !Number.isFinite(center.longitude))
    return { eligible: false, reason: 'site_unconfigured' };
  if (meeting.status !== 'active' || !['invited', 'accepted'].includes(invite.status))
    return { eligible: false, reason: 'not_invited' };
  const at = Date.parse(now),
    captured = Date.parse(fix?.capturedAt);
  if (
    !Number.isFinite(at) ||
    !Number.isFinite(captured) ||
    !meeting.scheduledDate ||
    localDay(now) !== meeting.scheduledDate
  )
    return { eligible: false, reason: 'wrong_day' };
  if (
    fix?.mocked ||
    fix?.source !== 'foreground' ||
    captured > at + 5000 ||
    at - captured > maximumAgeMs
  )
    return { eligible: false, reason: 'stale_or_untrusted_fix' };
  if (
    !Number.isFinite(fix.accuracyMeters) ||
    fix.accuracyMeters <= 0 ||
    fix.accuracyMeters > maximumAccuracyMeters
  )
    return { eligible: false, reason: 'low_accuracy' };
  const distance = metersBetween(center, fix);
  if (distance > 100) return { eligible: false, reason: 'outside_site', distanceMeters: distance };
  return { eligible: true, distanceMeters: distance };
}

export function canFinalize({ meeting, actor, now }) {
  if (
    meeting.status !== 'active' ||
    meeting.finalizedAt ||
    !actor?.active ||
    (actor.id !== meeting.creatorId && actor.role !== 'data_entry')
  )
    return false;
  return localDay(now) > meeting.scheduledDate;
}
