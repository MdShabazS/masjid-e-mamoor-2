import assert from 'node:assert/strict';
import test from 'node:test';
import { canCreateMeeting, reminderEligible, checkInEligible, canFinalize } from './index.js';
const meeting = {
  status: 'active',
  creatorId: 'p',
  scheduledDate: '2026-10-16',
  startsAt: '2026-10-16T04:30:00Z',
  finalizedAt: null,
};
const invite = { status: 'accepted' };
const center = { latitude: 15.1394, longitude: 76.9214, verified: true };
const fix = {
  ...center,
  accuracyMeters: 10,
  source: 'foreground',
  mocked: false,
  capturedAt: '2026-10-16T06:30:00Z',
};

test('meeting creator grants and one-hour reminder exclude declines', () => {
  assert.equal(canCreateMeeting({ role: 'data_entry', active: true }), true);
  assert.equal(canCreateMeeting({ role: 'member', active: true }), false);
  assert.equal(reminderEligible({ meeting, invite, now: '2026-10-16T03:45:00Z' }), true);
  assert.equal(
    reminderEligible({ meeting, invite: { status: 'declined' }, now: '2026-10-16T03:45:00Z' }),
    false,
  );
  assert.equal(reminderEligible({ meeting, invite, now: '2026-10-16T04:30:00Z' }), false);
});

test('site is disabled until confirmed and checks local day, age, accuracy, distance', () => {
  const input = { meeting, invite, center, fix, now: '2026-10-16T06:30:30Z' };
  assert.equal(checkInEligible(input).eligible, true);
  assert.equal(checkInEligible({ ...input, center: null }).reason, 'site_unconfigured');
  assert.equal(checkInEligible({ ...input, now: '2026-10-15T18:25:00Z' }).reason, 'wrong_day');
  assert.equal(
    checkInEligible({ ...input, fix: { ...fix, capturedAt: '2026-10-16T06:20:00Z' } }).reason,
    'stale_or_untrusted_fix',
  );
  assert.equal(
    checkInEligible({ ...input, fix: { ...fix, accuracyMeters: 60 } }).reason,
    'low_accuracy',
  );
  assert.equal(
    checkInEligible({ ...input, fix: { ...fix, latitude: 15.15 } }).reason,
    'outside_site',
  );
  assert.equal(
    checkInEligible({ ...input, fix: { ...fix, mocked: true } }).reason,
    'stale_or_untrusted_fix',
  );
});

test('finalization waits until complete India date and creator or fallback role', () => {
  const p = { id: 'p', role: 'president', active: true };
  assert.equal(canFinalize({ meeting, actor: p, now: '2026-10-16T18:29:59Z' }), false);
  assert.equal(canFinalize({ meeting, actor: p, now: '2026-10-16T18:30:00Z' }), true);
  assert.equal(
    canFinalize({
      meeting,
      actor: { id: 'l', role: 'data_entry', active: true },
      now: '2026-10-16T18:30:00Z',
    }),
    true,
  );
  assert.equal(
    canFinalize({
      meeting,
      actor: { id: 'm', role: 'member', active: true },
      now: '2026-10-16T18:30:00Z',
    }),
    false,
  );
});
