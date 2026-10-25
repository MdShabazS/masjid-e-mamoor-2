import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  paise,
  parseTransfer,
  parseOpening,
  parseDonorEnrollment,
  parseMonthlyClaim,
  parseVerification,
  makeCursor,
  readCursor,
  pageLimit,
  apiError,
} from './index.js';
const a = 'a1000000-0000-4000-8000-000000000001';
const b = 'a1000000-0000-4000-8000-000000000002';
const secret = 'a-secret-at-least-thirty-two-bytes-long';
test('wire paise rejects floats, overflow and unsafe numbers; opening accepts zero', () => {
  assert.equal(paise('9223372036854775807'), '9223372036854775807');
  assert.equal(
    parseOpening({ accountId: a, amountPaise: '0', evidenceReference: 'statement', operationId: b })
      .amountPaise,
    '0',
  );
  for (const x of [12.5, 12, '1.00', '-1', '9223372036854775808']) assert.throws(() => paise(x));
});
test('transfer validation rejects same accounts, unknown fields and missing proof', () => {
  const input = {
    fromAccountId: a,
    toAccountId: b,
    amountPaise: '1',
    evidenceReference: 'voucher',
    operationId: a,
  };
  assert.equal(parseTransfer(input).amountPaise, '1');
  assert.throws(() => parseTransfer({ ...input, toAccountId: a }));
  assert.throws(() => parseTransfer({ ...input, actorRole: 'treasurer' }));
  assert.throws(() => parseTransfer({ ...input, evidenceReference: ' ' }));
});
test('cursor is scoped, authenticated and bounded', () => {
  const cursor = makeCursor(
    { createdAt: '2026-10-15T00:00:00Z', id: a, scope: 'accounts' },
    secret,
  );
  assert.deepEqual(readCursor(cursor, 'accounts', secret), {
    createdAt: '2026-10-15T00:00:00.000Z',
    id: a,
  });
  assert.throws(() => readCursor(cursor, 'donors', secret));
  assert.throws(() => readCursor(cursor.slice(0, -1) + 'X', 'accounts', secret));
  assert.equal(pageLimit(undefined), 25);
  assert.throws(() => pageLimit(1000));
});
test('error result never returns raw database error', () => {
  assert.equal(
    apiError('permission denied for private table', a).error.code,
    'SERVICE_UNAVAILABLE',
  );
});
test('donor contract rejects caller-selected consent version, actor and malformed evidence', () => {
  const input = {
    operationId: a,
    name: ' Donor ',
    whatsapp: '+919000000000',
    suggestedAmountPaise: '10000',
    referrerId: b,
    consentMethod: 'phone-call',
    consentRecordedAt: '2026-10-16T01:00:00Z',
    evidenceReference: 'record-123',
  };
  assert.equal(parseDonorEnrollment(input).name, 'Donor');
  for (const extra of [{ consentVersion: 'draft' }, { enteredBy: a }, { role: 'president' }])
    assert.throws(() => parseDonorEnrollment({ ...input, ...extra }));
  for (const change of [
    { suggestedAmountPaise: 10000 },
    { consentMethod: 'assumed' },
    { consentRecordedAt: '2026-02-30T00:00:00Z' },
    { evidenceReference: ' ' },
  ])
    assert.throws(() => parseDonorEnrollment({ ...input, ...change }));
});
test('claim contract requires an India-month key and immutable operation ID', () => {
  const input = {
    operationId: a,
    donorId: b,
    periodDate: '2026-10-01',
    transactionReference: ' bank-123 ',
  };
  assert.equal(parseMonthlyClaim(input).transactionReference, 'bank-123');
  for (const change of [
    { periodDate: '2026-10-16' },
    { periodDate: '2026-13-01' },
    { operationId: 'replay' },
    { actualAmountPaise: '10000' },
  ])
    assert.throws(() => parseMonthlyClaim({ ...input, ...change }));
});

test('verification body matches the versioned API and requires revision and evidence', () => {
  const input = {
    operationId: a,
    expectedRevision: 2,
    accountId: b,
    actualAmountPaise: '12500',
    evidenceReference: 'bank statement 42',
  };
  const spec = JSON.parse(
    readFileSync(new URL('../../backend/api/openapi.v1.json', import.meta.url), 'utf8'),
  );
  assert.deepEqual(
    Object.keys(input).sort(),
    spec.components.schemas.VerifyClaimInput.required.sort(),
  );
  assert.deepEqual(parseVerification(input), input);
  for (const change of [
    { expectedRevision: 0 },
    { expectedRevision: 1.5 },
    { actualAmountPaise: '0' },
    { evidenceReference: '' },
    { claimId: b },
  ]) {
    assert.throws(() => parseVerification({ ...input, ...change }));
  }
});
