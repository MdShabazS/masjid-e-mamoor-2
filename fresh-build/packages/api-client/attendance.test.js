import assert from 'node:assert/strict';
import test from 'node:test';
import { locationArgs, parseSiteCoordinates } from './attendance.js';

test('sends the fix capture time and mock flag', () => {
  const args = locationArgs({
    coords: { latitude: 15.1, longitude: 76.9, accuracy: 8 },
    timestamp: Date.UTC(2026, 10, 2, 5),
    mocked: true,
  });
  assert.equal(args.p_captured_at, '2026-11-02T05:00:00.000Z');
  assert.equal(args.p_mocked, true);
  assert.equal(args.p_accuracy_m, 8);
});

test('a missing mock flag is not treated as mocked, and a partial fix is refused', () => {
  const coords = { latitude: 15.1, longitude: 76.9, accuracy: 8 };
  assert.equal(locationArgs({ coords, timestamp: 1 }).p_mocked, false);
  assert.throws(() => locationArgs({ coords: { latitude: 15.1 }, timestamp: 1 }));
  assert.throws(() => locationArgs(null));
});

test('site coordinates must be precise and in range', () => {
  assert.deepEqual(parseSiteCoordinates(' 15.1394 ', '76.9214'), {
    p_latitude: 15.1394,
    p_longitude: 76.9214,
  });
  assert.throws(() => parseSiteCoordinates('15.1', '76.9214'), /4 decimal/);
  assert.throws(() => parseSiteCoordinates('95.1394', '76.9214'), /out of range/);
  assert.throws(() => parseSiteCoordinates('', ''), /decimals/);
});
