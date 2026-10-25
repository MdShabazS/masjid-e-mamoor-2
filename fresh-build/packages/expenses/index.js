import { canDecideExpense, canPayApprovedExpense } from '../contributions/access.js';

function positivePaise(value) {
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error('invalid_amount_paise');
  return value;
}

function text(value, field) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`invalid_${field}`);
  return value.trim();
}

export function submitExpense(input) {
  if (input.requester?.active !== true || !input.requester.id || !input.requester.role) {
    throw new Error('active_requester_required');
  }
  if (!input.billReference && !input.missingBillReason) {
    throw new Error('bill_or_explanation_required');
  }
  return {
    id: text(input.id, 'expense_id'),
    requesterId: input.requester.id,
    requesterRoleAtSubmission: input.requester.role,
    accountId: text(input.accountId, 'account_id'),
    title: text(input.title, 'title'),
    description: text(input.description, 'description'),
    amountPaise: positivePaise(input.amountPaise),
    billReference: input.billReference ?? null,
    missingBillReason: input.missingBillReason ?? null,
    status: 'submitted',
    review: null,
    payments: [],
  };
}

export function decideExpense(expense, input) {
  const operationId = text(input.operationId, 'operation_id');
  if (expense.review?.operationId === operationId) {
    if (
      expense.review.actorId !== input.actor?.id ||
      expense.review.decision !== input.decision ||
      expense.review.reason !== (input.reason ?? null)
    ) {
      throw new Error('operation_id_conflict');
    }
    return { expense, created: false };
  }
  if (!canDecideExpense(input.actor, expense)) throw new Error('approval_not_authorized');
  if (!['approve', 'reject'].includes(input.decision)) throw new Error('invalid_decision');
  if (input.decision === 'reject') text(input.reason, 'rejection_reason');
  const next = structuredClone(expense);
  next.status = input.decision === 'approve' ? 'approved' : 'rejected';
  next.review = {
    operationId,
    actorId: input.actor.id,
    decision: input.decision,
    reason: input.reason ?? null,
  };
  return { expense: next, created: true };
}

export function recordExpensePayment(expense, input) {
  const operationId = text(input.operationId, 'operation_id');
  const prior = expense.payments.find((payment) => payment.operationId === operationId);
  if (input.actor?.active !== true || input.actor.role !== 'treasurer') {
    throw new Error('treasurer_required');
  }
  if (prior) {
    if (
      prior.actorId !== input.actor.id ||
      prior.amountPaise !== input.amountPaise ||
      prior.accountId !== input.accountId
    )
      throw new Error('operation_id_conflict');
    return { expense, payment: prior, created: false };
  }
  if (!canPayApprovedExpense(input.actor, expense) && expense.status !== 'partially_paid')
    throw new Error('expense_not_approved');
  const amountPaise = positivePaise(input.amountPaise);
  const paid = expense.payments.reduce((sum, payment) => sum + payment.amountPaise, 0);
  if (amountPaise > expense.amountPaise - paid) throw new Error('expense_overpayment');
  const payment = {
    operationId,
    actorId: input.actor.id,
    amountPaise,
    accountId: text(input.accountId, 'account_id'),
    paidAt: text(input.paidAt, 'payment_time'),
  };
  const next = structuredClone(expense);
  next.payments.push(payment);
  next.status = paid + amountPaise === expense.amountPaise ? 'paid' : 'partially_paid';
  return { expense: next, payment, created: true };
}
