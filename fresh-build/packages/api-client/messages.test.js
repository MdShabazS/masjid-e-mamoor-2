import assert from 'node:assert/strict';
import test from 'node:test';
import { userMessage } from './messages.js';

test('maps known codes and network failures to readable text', () => {
  assert.match(userMessage(new Error('invalid_inr_amount')), /rupee amount/);
  assert.match(userMessage(new TypeError('Network request failed')), /No connection/);
  assert.match(userMessage({ code: '42501', message: 'x' }), /cannot perform/);
});

test('hides unknown machine codes and parser errors but keeps sentences', () => {
  assert.equal(userMessage(new Error('some_internal_code'), 'Fallback.'), 'Fallback.');
  assert.equal(userMessage(new SyntaxError('JSON Parse error: <'), 'Fallback.'), 'Fallback.');
  assert.equal(userMessage(new Error('Choose an account first.')), 'Choose an account first.');
});
