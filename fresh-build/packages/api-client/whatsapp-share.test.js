import assert from 'node:assert/strict';
import test from 'node:test';
import { donorMessage, monthName, whatsappLink } from './whatsapp-share.js';

test('month name from a period date', () => {
  assert.equal(monthName('2026-11-01'), 'November 2026');
  assert.throws(() => monthName('2026-11-15'));
  assert.throws(() => monthName('2026-13-01'));
});

test('monthly request names the donor, month and voluntary amount', () => {
  const text = donorMessage('monthly_request', {
    name: 'Rahim',
    suggestedAmountPaise: 30000,
    period: '2026-11-01',
  });
  assert.match(text, /Assalamu alaikum Rahim\./);
  assert.match(text, /November 2026/);
  assert.match(text, /₹300\. Any amount is welcome\./);
});

test('reminder offers a way to stop and never states an amount owed', () => {
  const text = donorMessage('reminder', {
    name: 'Rahim',
    suggestedAmountPaise: 30050,
    period: '2026-11-01',
  });
  assert.match(text, /rather not receive these messages/);
  assert.doesNotMatch(text, /₹/);
});

test('receipts and unknown kinds are refused', () => {
  assert.throws(() =>
    donorMessage('receipt', { name: 'R', suggestedAmountPaise: 100, period: '2026-11-01' }),
  );
});

test('wa.me link keeps only digits and encodes the text', () => {
  assert.equal(
    whatsappLink('+91 98765-00011', 'Hi & salaam'),
    'https://wa.me/919876500011?text=Hi%20%26%20salaam',
  );
  assert.throws(() => whatsappLink('123', 'x'));
});
