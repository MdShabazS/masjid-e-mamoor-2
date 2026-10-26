import assert from 'node:assert/strict';
import test from 'node:test';
import { buildWorkTaskArgs } from './work-tasks.js';

const valid = {
  title: ' Clean room ',
  description: ' Morning work ',
  date: '2026-10-27',
  location: ' Hall ',
  mode: 'mixed',
  total: '3',
  invited: '1',
  volunteer: '2',
};

test('task input trims text and sends exact RPC argument names and integer capacities', () => {
  assert.deepEqual(buildWorkTaskArgs(valid), {
    p_title: 'Clean room',
    p_description: 'Morning work',
    p_date: '2026-10-27',
    p_location: 'Hall',
    p_mode: 'mixed',
    p_total: 3,
    p_invited: 1,
    p_volunteer: 2,
  });
});

test('task input rejects invalid dates, fractional caps, over-capacity and mode mismatch', () => {
  for (const patch of [
    { date: '2026-02-30' },
    { date: '27/10/2026' },
    { total: '2.5' },
    { total: '4' },
    { mode: 'open' },
    { invited: '-1' },
    { volunteer: '10001' },
  ])
    assert.throws(() => buildWorkTaskArgs({ ...valid, ...patch }));
});

test('task input allows an undated open task with no invited capacity', () => {
  const args = buildWorkTaskArgs({
    ...valid,
    date: '',
    location: '',
    mode: 'open',
    total: '2',
    invited: '0',
    volunteer: '2',
  });
  assert.equal(args.p_date, null);
  assert.equal(args.p_location, null);
});
