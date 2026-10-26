import assert from 'node:assert/strict';
import test from 'node:test';
import { createManagementApi, parseINRToPaise, formatPaiseINR } from './index.js';
import { enrollConsentedDonor } from './donor-enrollment.js';

test('INR input becomes exact integer paise without floating point rounding', () => {
  assert.equal(parseINRToPaise('300'), 30000);
  assert.equal(parseINRToPaise('0.01'), 1);
  assert.equal(parseINRToPaise('1000.50'), 100050);
  for (const value of ['0', '1.999', '-2', '1e4', '1,000', '1.', '9007199254740992']) {
    assert.throws(() => parseINRToPaise(value), /invalid_inr_amount/);
  }
});

test('paise display stays exact beyond safe floating point range', () => {
  assert.equal(formatPaiseINR('9007199254740993'), '₹9,00,71,99,25,47,409.93');
  assert.equal(formatPaiseINR('-123456789'), '-₹12,34,567.89');
  assert.equal(formatPaiseINR(1), '₹0.01');
  assert.throws(() => formatPaiseINR(9007199254740993), /invalid_paise_amount/);
});

test('verification sends the actual amount and stable operation ID, not a role claim', async () => {
  const calls = [];
  const api = createManagementApi({
    rpc: async (name, args) => {
      calls.push({ name, args });
      return { data: 'MEM2-R-EXAMPLE', error: null };
    },
  });
  const operationId = 'a3000000-0000-0000-0000-000000000001';
  await api.verifyMonthlyClaim({
    claimId: 'claim-1',
    accountId: 'bank-1',
    actualAmountINR: '300.00',
    operationId,
  });
  assert.deepEqual(calls, [
    {
      name: 'verify_monthly_claim',
      args: {
        p_claim_id: 'claim-1',
        p_account_id: 'bank-1',
        p_actual_amount_paise: 30000,
        p_operation_id: operationId,
      },
    },
  ]);
  assert.throws(
    () =>
      api.verifyMonthlyClaim({
        claimId: 'claim-1',
        accountId: 'bank-1',
        actualAmountINR: '300.00',
      }),
    /operation_id_required/,
  );
});

test('Treasurer rejection sends a reason and operation without an amount or receipt', async () => {
  const calls = [];
  const api = createManagementApi({
    rpc: async (name, args) => {
      calls.push({ name, args });
      return { data: null, error: null };
    },
  });
  const operationId = 'a3000000-0000-4000-8000-000000000019';
  await api.rejectMonthlyClaim({
    claimId: 'claim-1',
    reason: '  Reference absent from bank statement  ',
    operationId,
  });
  assert.deepEqual(calls, [
    {
      name: 'reject_monthly_claim',
      args: {
        p_claim_id: 'claim-1',
        p_reason: 'Reference absent from bank statement',
        p_operation_id: operationId,
      },
    },
  ]);
  assert.throws(
    () => api.rejectMonthlyClaim({ claimId: 'claim-1', reason: 'x', operationId }),
    /invalid_rejection_reason/,
  );
  assert.throws(
    () => api.rejectMonthlyClaim({ claimId: 'claim-1', reason: 'Valid reason' }),
    /operation_id_required/,
  );
});

test('enrollment goes through signed-in consent server endpoint, not old RPC', async () => {
  let request;
  const client = {
    auth: { getSession: async () => ({ data: { session: { access_token: 'actor-jwt' } } }) },
  };
  const input = {
    name: 'Donor',
    whatsapp: '+919000000000',
    suggestedAmountINR: '1000',
    consentMethod: 'in-person',
    consentRecordedAt: '2026-10-15T09:00:00Z',
    evidenceReference: 'paper-form-123',
  };
  const id = await enrollConsentedDonor({
    client,
    input,
    fetchImpl: async (url, init) => {
      request = { url, ...init };
      return { ok: true, json: async () => ({ data: { donorId: 'donor-1' } }) };
    },
  });
  assert.equal(id, 'donor-1');
  assert.equal(request.headers.Authorization, 'Bearer actor-jwt');
  assert.deepEqual(JSON.parse(request.body), input);
  assert.equal(createManagementApi({ rpc: async () => {} }).enrollMonthlyDonor, undefined);
});

test('RPC failures reach the caller', async () => {
  const api = createManagementApi({
    rpc: async () => ({ data: null, error: new Error('not_authorized') }),
  });
  await assert.rejects(api.listMonthlyDonors(), /not_authorized/);
});

test('staff correction uses exact expected paise, reason and retry operation', async () => {
  const calls = [];
  const api = createManagementApi({
    rpc: async (name, args) => {
      calls.push({ name, args });
      return { data: null, error: null };
    },
  });
  const operationId = 'a3000000-0000-4000-8000-000000000011';
  await api.updateMonthlyDonorSuggestion({
    donorId: 'donor-1',
    expectedAmountPaise: '9007199254740993',
    newAmountINR: '1250.25',
    reason: '  Donor requested change  ',
    operationId,
  });
  assert.deepEqual(calls, [
    {
      name: 'update_monthly_donor_suggestion',
      args: {
        p_donor_id: 'donor-1',
        p_expected_amount_paise: '9007199254740993',
        p_new_amount_paise: 125025,
        p_reason: 'Donor requested change',
        p_operation_id: operationId,
      },
    },
  ]);
  assert.throws(
    () =>
      api.updateMonthlyDonorSuggestion({
        donorId: 'donor-1',
        expectedAmountPaise: 9007199254740993,
        newAmountINR: '1250.25',
        reason: 'Donor requested change',
        operationId,
      }),
    /invalid_expected_amount/,
  );
  assert.throws(
    () =>
      api.updateMonthlyDonorSuggestion({
        donorId: 'donor-1',
        expectedAmountPaise: 10000,
        newAmountINR: '1250.25',
        reason: 'x',
        operationId,
      }),
    /invalid_staff_reason/,
  );
});

test('staff opt-out sends a source and stable operation without a payment', async () => {
  const calls = [];
  const api = createManagementApi({
    rpc: async (name, args) => {
      calls.push({ name, args });
      return { data: null, error: null };
    },
  });
  const operationId = 'a3000000-0000-4000-8000-000000000013';
  await api.optOutMonthlyDonor({
    donorId: 'donor-1',
    sourceReference: '  Donor requested STOP  ',
    operationId,
  });
  assert.deepEqual(calls, [
    {
      name: 'staff_opt_out_monthly_donor',
      args: {
        p_donor_id: 'donor-1',
        p_source_reference: 'Donor requested STOP',
        p_operation_id: operationId,
      },
    },
  ]);
  assert.throws(
    () =>
      api.optOutMonthlyDonor({
        donorId: 'donor-1',
        sourceReference: 'Donor requested STOP',
      }),
    /operation_id_required/,
  );
});
