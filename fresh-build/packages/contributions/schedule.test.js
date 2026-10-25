import test from 'node:test';
import assert from 'node:assert/strict';
import { firstFridayWindow, reminderDue, threeUnpaidPeriods } from './schedule.js';
test('first Friday at 10:00 Asia/Kolkata and month boundary', () => {
  assert.deepEqual(firstFridayWindow('2026-10-02T04:29:00Z'), { period: '2026-10', due: false });
  assert.deepEqual(firstFridayWindow('2026-10-02T04:30:00Z'), { period: '2026-10', due: true });
  assert.equal(firstFridayWindow('2026-10-09T04:30:00Z').due, false);
  assert.equal(firstFridayWindow('2026-09-30T20:00:00Z').period, '2026-10');
});
test('five full days after actual delivery; verification or STOP suppresses', () => {
  const x = {
    requestSentAt: '2026-10-02T05:00:00Z',
    now: '2026-10-07T05:00:00Z',
    donorActive: true,
    consentApproved: true,
    verifiedCount: 0,
  };
  assert.equal(reminderDue(x), true);
  assert.equal(reminderDue({ ...x, now: '2026-10-07T04:59:59Z' }), false);
  assert.equal(reminderDue({ ...x, verifiedCount: 1 }), false);
  assert.equal(reminderDue({ ...x, donorActive: false }), false);
});
test('three consecutive requested unpaid months; month rollover and paid break', () => {
  const rows = ['2026-11', '2026-12', '2027-01'].map((period) => ({
    period,
    requestSent: true,
    netVerifiedPaise: '0',
  }));
  assert.equal(threeUnpaidPeriods(rows), true);
  assert.equal(
    threeUnpaidPeriods([rows[0], { ...rows[1], netVerifiedPaise: '1' }, rows[2]]),
    false,
  );
  assert.equal(threeUnpaidPeriods([rows[0], rows[2], { ...rows[2], period: '2027-02' }]), false);
});
