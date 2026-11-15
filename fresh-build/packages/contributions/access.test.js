import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canDecideExpense,
  canEnrollContributor,
  canPayApprovedExpense,
  canReadDetailedFinance,
} from './access.js';

const actor = (id, role) => ({ id, role, active: true });

test('the named data entry role can enroll donors but cannot verify finance', () => {
  assert.equal(canEnrollContributor(actor('employee', 'data_entry')), true);
  assert.equal(canReadDetailedFinance(actor('employee', 'data_entry')), false);
  assert.equal(canEnrollContributor({ ...actor('employee', 'data_entry'), active: false }), false);
});

test('System Admin can read detailed finance but cannot approve or pay', () => {
  const admin = actor('admin', 'system_admin');
  const expense = {
    requesterId: 'member',
    requesterRoleAtSubmission: 'member',
    status: 'submitted',
  };
  assert.equal(canReadDetailedFinance(admin), true);
  assert.equal(canDecideExpense(admin, expense), false);
  assert.equal(canPayApprovedExpense(admin, { ...expense, status: 'approved' }), false);
});

test('President submissions go to a different Treasurer; other submissions to President', () => {
  const presidentRequest = {
    requesterId: 'p1',
    requesterRoleAtSubmission: 'president',
    status: 'submitted',
  };
  const memberRequest = {
    requesterId: 'm1',
    requesterRoleAtSubmission: 'member',
    status: 'submitted',
  };
  assert.equal(canDecideExpense(actor('t1', 'treasurer'), presidentRequest), true);
  assert.equal(canDecideExpense(actor('p2', 'president'), presidentRequest), false);
  assert.equal(canDecideExpense(actor('p2', 'president'), memberRequest), true);
  assert.equal(canDecideExpense(actor('m1', 'president'), memberRequest), false);
  assert.equal(
    canDecideExpense(actor('p2', 'president'), {
      ...memberRequest,
      requesterRoleAtSubmission: null,
    }),
    false,
  );
});

test('payment requires approved state and a Treasurer', () => {
  const approved = { requesterId: 'member', status: 'approved' };
  assert.equal(canPayApprovedExpense(actor('treasurer', 'treasurer'), approved), true);
  assert.equal(canPayApprovedExpense(actor('member', 'member'), approved), false);
  assert.equal(
    canPayApprovedExpense(actor('treasurer', 'treasurer'), { ...approved, status: 'submitted' }),
    false,
  );
});
