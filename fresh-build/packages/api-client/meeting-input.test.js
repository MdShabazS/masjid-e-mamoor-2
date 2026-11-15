import assert from 'node:assert/strict';
import test from 'node:test';
import { buildMeetingArgs } from './meeting-input.js';

const draft = {
  title: ' Committee ',
  description: ' Agenda ',
  date: '2026-10-27',
  time: '09:15',
  location: ' Hall ',
};

test('meeting input uses India time and exact guarded RPC arguments', () => {
  assert.deepEqual(buildMeetingArgs(draft, Date.parse('2026-10-26T00:00:00Z')), {
    p_title: 'Committee',
    p_description: 'Agenda',
    p_date: '2026-10-27',
    p_starts_at: '2026-10-27T03:45:00.000Z',
    p_location: 'Hall',
  });
});

test('meeting input rejects impossible, malformed and past India date/time', () => {
  for (const patch of [
    { date: '2026-02-30' },
    { time: '24:01' },
    { time: '09:60' },
    { title: '' },
    { description: '' },
  ])
    assert.throws(() => buildMeetingArgs({ ...draft, ...patch }, 0));
  assert.throws(() => buildMeetingArgs(draft, Date.parse('2026-10-28T00:00:00Z')));
});
