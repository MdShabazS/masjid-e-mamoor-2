import { randomBytes } from 'node:crypto';

const periodPattern = /^\d{4}-(0[1-9]|1[0-2])$/;
const receiptPattern = /^MEM2-R-[0-9A-F]{32}$/;

function requiredText(value, field) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`invalid_${field}`);
  return value.trim();
}

function positivePaise(value) {
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error('invalid_amount_paise');
  return value;
}

function period(value) {
  if (!periodPattern.test(value)) throw new Error('invalid_period');
  return value;
}

function copy(state) {
  return structuredClone(state);
}

/** Consent must be recorded before a monthly contributor is enrolled. */
export function enrollContributor(input) {
  if (!input.consent || input.consent.granted !== true) throw new Error('consent_required');
  if (typeof input.whatsapp !== 'string' || !/^\+[1-9][0-9]{7,14}$/.test(input.whatsapp)) {
    throw new Error('invalid_whatsapp');
  }
  return {
    id: requiredText(input.id, 'contributor_id'),
    name: requiredText(input.name, 'name'),
    whatsapp: requiredText(input.whatsapp, 'whatsapp'),
    suggestedAmountPaise: positivePaise(input.suggestedAmountPaise),
    referrerId: input.referrerId ?? null,
    enteredById: requiredText(input.enteredById, 'entry_actor'),
    consent: {
      recordedAt: requiredText(input.consent.recordedAt, 'consent_time'),
      method: requiredText(input.consent.method, 'consent_method'),
      recordedById: requiredText(input.consent.recordedById, 'consent_actor'),
    },
    active: true,
    requests: [],
    claims: [],
    contributions: [],
  };
}

/** The new suggestion applies now, but prior requests and receipts are snapshots. */
export function changeSuggestedAmount(state, amountPaise) {
  const next = copy(state);
  next.suggestedAmountPaise = positivePaise(amountPaise);
  return next;
}

export function optOut(state) {
  return { ...copy(state), active: false };
}

/** Called by a trusted scheduler; the QR and account are captured together. */
export function queueMonthlyRequest(state, input) {
  const month = period(input.period);
  if (!state.active) throw new Error('contributor_opted_out');
  const previous = state.requests.find((request) => request.period === month);
  if (previous) return { state, request: previous, created: false };
  const request = {
    period: month,
    suggestedAmountPaise: state.suggestedAmountPaise,
    qrVersionId: requiredText(input.qrVersionId, 'qr_version'),
    accountId: requiredText(input.accountId, 'account'),
    queuedAt: requiredText(input.queuedAt, 'queue_time'),
  };
  const next = copy(state);
  next.requests.push(request);
  return { state: next, request, created: true };
}

/** A transaction ID is a claim, never proof that money arrived. */
export function recordPaymentClaim(state, input) {
  const month = period(input.period);
  const id = requiredText(input.id, 'claim_id');
  const transactionId = requiredText(input.transactionId, 'transaction_id');
  if (state.claims.some((claim) => claim.id === id || claim.transactionId === transactionId)) {
    throw new Error('duplicate_claim');
  }
  const next = copy(state);
  next.claims.push({
    id,
    period: month,
    transactionId,
    status: 'pending',
    submittedAt: requiredText(input.submittedAt, 'submission_time'),
  });
  return next;
}

/** Verify only against actual funds. Persistence must atomically save state,
 * ledger posting and receipt under a unique operation ID and transaction ID. */
export function verifyPaymentClaim(state, input) {
  const operationId = requiredText(input.operationId, 'operation_id');
  if (input.actor?.active !== true || input.actor.role !== 'treasurer') {
    throw new Error('treasurer_required');
  }
  const earlier = state.contributions.find((item) => item.operationId === operationId);
  if (earlier) {
    if (
      earlier.claimId !== input.claimId ||
      earlier.amountPaise !== input.actualAmountPaise ||
      earlier.accountId !== input.accountId ||
      earlier.verifiedById !== input.actor.id
    ) {
      throw new Error('operation_id_conflict');
    }
    return { state, contribution: earlier, created: false };
  }
  const actualAmountPaise = positivePaise(input.actualAmountPaise);
  const accountId = requiredText(input.accountId, 'account');
  const claim = state.claims.find((item) => item.id === input.claimId);
  if (!claim || claim.status !== 'pending') throw new Error('claim_not_pending');
  const receiptCode = `MEM2-R-${randomBytes(16).toString('hex').toUpperCase()}`;
  if (!receiptPattern.test(receiptCode)) throw new Error('invalid_receipt_code');
  const contribution = {
    operationId,
    claimId: claim.id,
    period: claim.period,
    amountPaise: actualAmountPaise,
    accountId,
    transactionId: claim.transactionId,
    receiptCode,
    verifiedById: requiredText(input.actor.id, 'verification_actor'),
    verifiedAt: requiredText(input.verifiedAt, 'verification_time'),
  };
  const next = copy(state);
  next.claims.find((item) => item.id === claim.id).status = 'verified';
  next.contributions.push(contribution);
  return { state: next, contribution, created: true };
}

export function monthIsContributed(state, month) {
  return state.contributions.some((item) => item.period === period(month));
}

export function shouldRemind(state, month) {
  return (
    state.active &&
    state.requests.some((item) => item.period === period(month)) &&
    !monthIsContributed(state, month)
  );
}
