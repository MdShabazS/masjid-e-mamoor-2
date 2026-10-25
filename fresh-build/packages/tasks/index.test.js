import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createTask,
  invite,
  join,
  release,
  submitCompletion,
  reviewCompletion,
  taskPoints,
} from './index.js';
const p = { id: 'p', role: 'president', active: true };
const member = (id) => ({ id, role: 'member', active: true });
const task = () =>
  createTask({
    id: 't',
    creator: p,
    title: 'Clean',
    description: 'Courtyard',
    mode: 'mixed',
    totalCap: 2,
    invitedCap: 1,
    volunteerCap: 1,
  });

test('source cap and total cap allocate an eligible FIFO waiter', () => {
  let t = invite(task(), p, member('a'));
  t = invite(t, p, member('b'));
  t = join(t, member('a'), 'invited', 1);
  t = join(t, member('b'), 'invited', 2);
  t = join(t, member('c'), 'volunteer', 3);
  t = join(t, member('d'), 'volunteer', 4);
  assert.deepEqual(
    t.participants.map((x) => x.status),
    ['confirmed', 'waitlisted', 'confirmed', 'waitlisted'],
  );
  t = release(t, member('a'));
  assert.equal(t.participants[1].status, 'confirmed');
  assert.equal(t.participants[3].status, 'waitlisted');
  t = release(t, member('c'));
  assert.equal(t.participants[3].status, 'confirmed');
  assert.equal(t.participants.filter((x) => x.status === 'confirmed').length, 2);
});

test('only creator acceptance of submitted work earns a point', () => {
  let t = join(task(), member('a'), 'volunteer', 1);
  t = submitCompletion(t, member('a'), 'done');
  assert.equal(taskPoints([t], 'a'), 0);
  assert.throws(() => reviewCompletion(t, member('a'), 'a', 'accept'), /review_not_authorized/);
  t = reviewCompletion(t, p, 'a', 'return', 'Needs another pass');
  assert.equal(taskPoints([t], 'a'), 0);
  t = submitCompletion(t, member('a'));
  t = reviewCompletion(t, p, 'a', 'accept');
  assert.equal(taskPoints([t], 'a'), 1);
  assert.equal(taskPoints([{ ...t, status: 'cancelled' }], 'a'), 0);
});

test('creator cannot participate and malformed capacities are denied', () => {
  assert.throws(() => join(task(), p, 'volunteer', 1), /not_eligible/);
  assert.throws(
    () =>
      createTask({
        creator: p,
        title: 'x',
        description: 'y',
        mode: 'mixed',
        totalCap: 3,
        invitedCap: 1,
        volunteerCap: 1,
      }),
    /invalid_task_capacity/,
  );
  assert.throws(() => join(task(), member('a'), 'invited', 1), /invitation_required/);
});
