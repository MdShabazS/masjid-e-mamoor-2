import assert from 'node:assert/strict';
import test from 'node:test';
import {
  changeSuggestedAmount,
  enrollContributor,
  monthIsContributed,
  optOut,
  queueMonthlyRequest,
  recordPaymentClaim,
  shouldRemind,
  verifyPaymentClaim,
} from './index.js';

function donor() {
  return enrollContributor({
    id: 'donor-1',
    name: 'Donor',
    whatsapp: '+919000000000',
    suggestedAmountPaise: 100000,
    referrerId: 'member-1',
    enteredById: 'employee-1',
    consent: {
      granted: true,
      method: 'in-person',
      recordedAt: '2026-10-01T10:00:00Z',
      recordedById: 'employee-1',
    },
  });
}

function requested(state = donor()) {
  return queueMonthlyRequest(state, {
    period: '2026-10',
    qrVersionId: 'qr-1',
    accountId: 'bank-1',
    queuedAt: '2026-10-02T04:30:00Z',
  }).state;
}

function claimed(state = requested()) {
  return recordPaymentClaim(state, {
    id: 'claim-1',
    period: '2026-10',
    transactionId: 'UPI-123',
    submittedAt: '2026-10-03T10:00:00Z',
  });
}

function verify(state, actor = { id: 'treasurer-1', role: 'treasurer', active: true }) {
  return verifyPaymentClaim(state, {
    claimId: 'claim-1',
    operationId: 'verify-1',
    actualAmountPaise: 30000,
    accountId: 'bank-1',
    actor,
    verifiedAt: '2026-10-03T12:00:00Z',
  });
}

test('enrollment requires recorded consent', () => {
  assert.throws(() => enrollContributor({ ...donor(), consent: null }), /consent_required/);
  assert.throws(
    () =>
      enrollContributor({
        ...donor(),
        consent: { ...donor().consent, granted: true },
        whatsapp: '9000000000',
      }),
    /invalid_whatsapp/,
  );
});

test('request retries preserve its original amount and QR/account snapshot', () => {
  const first = requested();
  const changed = changeSuggestedAmount(first, 150000);
  const retried = queueMonthlyRequest(changed, {
    period: '2026-10',
    qrVersionId: 'qr-2',
    accountId: 'bank-2',
    queuedAt: '2026-10-04T00:00:00Z',
  });
  assert.equal(retried.created, false);
  assert.equal(retried.request.suggestedAmountPaise, 100000);
  assert.equal(retried.request.qrVersionId, 'qr-1');
  assert.equal(retried.request.accountId, 'bank-1');
  assert.equal(changed.suggestedAmountPaise, 150000);
});

test('a transaction claim never posts money or suppresses the reminder', () => {
  const state = claimed();
  assert.equal(state.contributions.length, 0);
  assert.equal(monthIsContributed(state, '2026-10'), false);
  assert.equal(shouldRemind(state, '2026-10'), true);
  assert.throws(
    () =>
      recordPaymentClaim(state, {
        id: 'claim-2',
        period: '2026-10',
        transactionId: 'UPI-123',
        submittedAt: '2026-10-03T11:00:00Z',
      }),
    /duplicate_claim/,
  );
});

test('only an active Treasurer verifies the actual received amount', () => {
  const state = claimed();
  assert.throws(
    () => verify(state, { id: 'employee-1', role: 'data_entry', active: true }),
    /treasurer_required/,
  );
  assert.throws(
    () => verify(state, { id: 'treasurer-1', role: 'treasurer', active: false }),
    /treasurer_required/,
  );
  const { state: posted, contribution } = verify(state);
  assert.equal(contribution.amountPaise, 30000);
  assert.match(contribution.receiptCode, /^MEM2-R-[0-9A-F]{32}$/);
  assert.equal(posted.claims[0].status, 'verified');
  assert.equal(monthIsContributed(posted, '2026-10'), true);
  assert.equal(shouldRemind(posted, '2026-10'), false);
  assert.equal(state.claims[0].status, 'pending');
  assert.equal('remainingBalancePaise' in contribution, false);
});

test('replay returns the same receipt and cannot double-post', () => {
  const first = verify(claimed());
  const replay = verify(first.state);
  assert.equal(replay.created, false);
  assert.equal(replay.contribution.receiptCode, first.contribution.receiptCode);
  assert.equal(replay.state.contributions.length, 1);
  assert.throws(
    () =>
      verifyPaymentClaim(first.state, {
        claimId: 'claim-1',
        operationId: 'verify-1',
        actualAmountPaise: 31000,
        accountId: 'bank-1',
        actor: { id: 'treasurer-1', role: 'treasurer', active: true },
      }),
    /operation_id_conflict/,
  );
  assert.throws(
    () =>
      verifyPaymentClaim(first.state, {
        claimId: 'claim-1',
        operationId: 'verify-1',
        actualAmountPaise: 30000,
        accountId: 'bank-2',
        actor: { id: 'treasurer-1', role: 'treasurer', active: true },
      }),
    /operation_id_conflict/,
  );
});

test('an opted-out contributor cannot get a new request or reminder', () => {
  const state = optOut(requested());
  assert.equal(shouldRemind(state, '2026-10'), false);
  assert.throws(() => queueMonthlyRequest(state, { period: '2026-11' }), /contributor_opted_out/);
});
