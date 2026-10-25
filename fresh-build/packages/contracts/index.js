import { createHmac, timingSafeEqual } from 'node:crypto';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX = 9223372036854775807n;
export class ContractError extends Error {
  constructor(code = 'VALIDATION_FAILED') {
    super(code);
    this.code = code;
  }
}
function object(input, keys) {
  if (
    !input ||
    typeof input !== 'object' ||
    Array.isArray(input) ||
    Object.keys(input).some((k) => !keys.includes(k))
  )
    throw new ContractError();
  return input;
}
export function uuid(value) {
  if (typeof value !== 'string' || !UUID.test(value)) throw new ContractError();
  return value.toLowerCase();
}
export function paise(value, { zero = false } = {}) {
  if (typeof value !== 'string' || !/^(0|[1-9][0-9]*)$/.test(value)) throw new ContractError();
  const amount = BigInt(value);
  if (amount > MAX || (!zero && amount === 0n)) throw new ContractError();
  return value;
}
function reference(value, max = 240) {
  if (typeof value !== 'string' || value.trim().length < 3 || value.trim().length > max)
    throw new ContractError();
  return value.trim();
}
function textField(value, max) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max)
    throw new ContractError();
  return value.trim();
}
function isoInstant(value) {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?(?:Z|[+-]\d\d:\d\d)$/.test(value)
  )
    throw new ContractError();
  const time = Date.parse(value);
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  if (
    !Number.isFinite(time) ||
    new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10) !== value.slice(0, 10)
  )
    throw new ContractError();
  return value;
}
export function parseDonorEnrollment(input) {
  const x = object(input, [
    'operationId',
    'name',
    'whatsapp',
    'suggestedAmountPaise',
    'referrerId',
    'consentMethod',
    'consentRecordedAt',
    'evidenceReference',
  ]);
  if (
    typeof x.whatsapp !== 'string' ||
    !/^\+[1-9][0-9]{7,14}$/.test(x.whatsapp) ||
    !['in-person', 'phone-call', 'message'].includes(x.consentMethod)
  )
    throw new ContractError();
  return {
    operationId: uuid(x.operationId),
    name: textField(x.name, 200),
    whatsapp: x.whatsapp,
    suggestedAmountPaise: paise(x.suggestedAmountPaise),
    referrerId: x.referrerId == null ? null : uuid(x.referrerId),
    consentMethod: x.consentMethod,
    consentRecordedAt: isoInstant(x.consentRecordedAt),
    evidenceReference: reference(x.evidenceReference),
  };
}
export function parseMonthlyClaim(input) {
  const x = object(input, ['operationId', 'donorId', 'periodDate', 'transactionReference']);
  if (typeof x.periodDate !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])-01$/.test(x.periodDate))
    throw new ContractError();
  return {
    operationId: uuid(x.operationId),
    donorId: uuid(x.donorId),
    periodDate: x.periodDate,
    transactionReference: reference(x.transactionReference, 200),
  };
}
export function parseOpening(input) {
  const x = object(input, ['accountId', 'amountPaise', 'evidenceReference', 'operationId']);
  return {
    accountId: uuid(x.accountId),
    amountPaise: paise(x.amountPaise, { zero: true }),
    evidenceReference: reference(x.evidenceReference),
    operationId: uuid(x.operationId),
  };
}
export function parseTransfer(input) {
  const x = object(input, [
    'fromAccountId',
    'toAccountId',
    'amountPaise',
    'evidenceReference',
    'operationId',
  ]);
  const fromAccountId = uuid(x.fromAccountId),
    toAccountId = uuid(x.toAccountId);
  if (fromAccountId === toAccountId) throw new ContractError();
  return {
    fromAccountId,
    toAccountId,
    amountPaise: paise(x.amountPaise),
    evidenceReference: reference(x.evidenceReference),
    operationId: uuid(x.operationId),
  };
}
export function parseVerification(input) {
  const x = object(input, [
    'operationId',
    'expectedRevision',
    'accountId',
    'actualAmountPaise',
    'evidenceReference',
  ]);
  if (!Number.isSafeInteger(x.expectedRevision) || x.expectedRevision < 1)
    throw new ContractError();
  return {
    operationId: uuid(x.operationId),
    expectedRevision: x.expectedRevision,
    accountId: uuid(x.accountId),
    actualAmountPaise: paise(x.actualAmountPaise),
    evidenceReference: textField(x.evidenceReference, 200),
  };
}
export function apiError(code, requestId, retryable = false) {
  const safe = new Set([
    'AUTH_REQUIRED',
    'INVALID_CREDENTIALS',
    'PASSWORD_CHANGE_REQUIRED',
    'ACCOUNT_INACTIVE',
    'FORBIDDEN',
    'NOT_FOUND',
    'VALIDATION_FAILED',
    'OPERATION_CONFLICT',
    'STALE_REVISION',
    'RATE_LIMITED',
    'SERVICE_UNAVAILABLE',
    'INSUFFICIENT_BALANCE',
  ]);
  const publicCode = safe.has(code) ? code : 'SERVICE_UNAVAILABLE';
  return {
    error: {
      code: publicCode,
      message: publicCode.replaceAll('_', ' ').toLowerCase(),
      requestId: uuid(requestId),
      retryable: retryable === true,
    },
  };
}

// Opaque, authenticated keyset cursor. The server limits page size and binds
// cursor to query scope; changing a sort key or filter invalidates the cursor.
export function makeCursor({ createdAt, id, scope }, secret) {
  if (!secret || secret.length < 32 || !scope || typeof scope !== 'string')
    throw new ContractError();
  uuid(id);
  if (!Number.isFinite(Date.parse(createdAt))) throw new ContractError();
  const body = Buffer.from(JSON.stringify([createdAt, id, scope])).toString('base64url');
  const mac = createHmac('sha256', secret).update(body).digest('base64url');
  return `${body}.${mac}`;
}
export function readCursor(token, scope, secret) {
  if (
    typeof token !== 'string' ||
    token.length > 512 ||
    !token.includes('.') ||
    !secret ||
    secret.length < 32
  )
    throw new ContractError();
  const [body, mac, ...rest] = token.split('.');
  if (rest.length || !body || !mac) throw new ContractError();
  const expected = createHmac('sha256', secret).update(body).digest();
  let actual;
  try {
    actual = Buffer.from(mac, 'base64url');
  } catch {
    throw new ContractError();
  }
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
    throw new ContractError();
  let values;
  try {
    values = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch {
    throw new ContractError();
  }
  if (!Array.isArray(values) || values.length !== 3 || values[2] !== scope)
    throw new ContractError();
  return { createdAt: new Date(values[0]).toISOString(), id: uuid(values[1]) };
}
export function pageLimit(value) {
  const number = Number(value ?? 25);
  if (!Number.isInteger(number) || number < 1 || number > 100) throw new ContractError();
  return number;
}
