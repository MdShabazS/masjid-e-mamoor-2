import assert from 'node:assert/strict';
import test from 'node:test';
import { decideExpense, recordExpensePayment, submitExpense } from './index.js';

const president = { id: 'p1', role: 'president', active: true };
const treasurer = { id: 't1', role: 'treasurer', active: true };
const member = { id: 'm1', role: 'member', active: true };
const expense = (requester = member) =>
  submitExpense({
    id: 'expense-1',
    requester,
    accountId: 'bank-1',
    title: 'Repair',
    description: 'Replace wiring',
    amountPaise: 100000,
    missingBillReason: 'Vendor bill pending',
  });

test('submission snapshots requester role and needs bill evidence or explanation', () => {
  assert.equal(expense().requesterRoleAtSubmission, 'member');
  assert.throws(
    () =>
      submitExpense({
        id: 'x',
        requester: member,
        accountId: 'bank-1',
        title: 'Repair',
        description: 'Work',
        amountPaise: 100,
      }),
    /bill_or_explanation_required/,
  );
});

test('President decides ordinary requests; Treasurer decides President requests', () => {
  const ordinary = expense();
  assert.throws(
    () =>
      decideExpense(ordinary, { actor: treasurer, decision: 'approve', operationId: 'review-1' }),
    /approval_not_authorized/,
  );
  const approved = decideExpense(ordinary, {
    actor: president,
    decision: 'approve',
    operationId: 'review-1',
  });
  assert.equal(approved.expense.status, 'approved');
  assert.equal(
    decideExpense(approved.expense, {
      actor: president,
      decision: 'approve',
      operationId: 'review-1',
    }).created,
    false,
  );
  const presidential = expense(president);
  assert.throws(
    () =>
      decideExpense(presidential, {
        actor: president,
        decision: 'approve',
        operationId: 'review-2',
      }),
    /approval_not_authorized/,
  );
  assert.equal(
    decideExpense(presidential, { actor: treasurer, decision: 'approve', operationId: 'review-2' })
      .expense.status,
    'approved',
  );
});

test('only actual Treasurer payments reduce the approved unpaid amount', () => {
  const approved = decideExpense(expense(), {
    actor: president,
    decision: 'approve',
    operationId: 'review-1',
  }).expense;
  assert.throws(
    () =>
      recordExpensePayment(approved, {
        actor: president,
        amountPaise: 30000,
        operationId: 'pay-1',
      }),
    /treasurer_required/,
  );
  const first = recordExpensePayment(approved, {
    actor: treasurer,
    accountId: 'bank-1',
    amountPaise: 30000,
    paidAt: '2026-10-15T09:00:00Z',
    operationId: 'pay-1',
  });
  assert.equal(first.expense.status, 'partially_paid');
  assert.equal(
    recordExpensePayment(first.expense, {
      actor: treasurer,
      accountId: 'bank-1',
      amountPaise: 30000,
      operationId: 'pay-1',
    }).created,
    false,
  );
  assert.throws(
    () =>
      recordExpensePayment(first.expense, {
        actor: treasurer,
        accountId: 'bank-1',
        amountPaise: 70001,
        operationId: 'pay-2',
      }),
    /expense_overpayment/,
  );
  const final = recordExpensePayment(first.expense, {
    actor: treasurer,
    accountId: 'bank-1',
    amountPaise: 70000,
    paidAt: '2026-10-16T09:00:00Z',
    operationId: 'pay-2',
  });
  assert.equal(final.expense.status, 'paid');
  assert.equal(
    final.expense.payments.reduce((sum, item) => sum + item.amountPaise, 0),
    final.expense.amountPaise,
  );
  assert.equal(approved.payments.length, 0);
});

test('rejection cannot be paid and requires a reason', () => {
  const request = expense();
  assert.throws(
    () => decideExpense(request, { actor: president, decision: 'reject', operationId: 'review-3' }),
    /invalid_rejection_reason/,
  );
  const rejected = decideExpense(request, {
    actor: president,
    decision: 'reject',
    reason: 'Incorrect amount',
    operationId: 'review-3',
  }).expense;
  assert.throws(
    () =>
      recordExpensePayment(rejected, {
        actor: treasurer,
        accountId: 'bank-1',
        amountPaise: 100000,
        operationId: 'pay-3',
      }),
    /expense_not_approved/,
  );
});
