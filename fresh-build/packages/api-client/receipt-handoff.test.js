import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareManualReceiptHandoff } from './receipt-handoff.js';

const valid = {
  receiptCode: 'f4000000-0000-0000-0000-000000000001',
  recipientReference: 'donor:synthetic',
  channel: 'in_person',
  result: 'delivered',
  evidenceReference: 'signed copy reference',
};

test('manual receipt handoff trims references and never accepts an amount', () => {
  assert.deepEqual(
    prepareManualReceiptHandoff({ ...valid, recipientReference: '  donor:synthetic  ', amount: 1 }),
    {
      p_receipt_code: valid.receiptCode,
      p_recipient_reference: valid.recipientReference,
      p_channel: valid.channel,
      p_result: valid.result,
      p_evidence_reference: valid.evidenceReference,
    },
  );
});

test('manual receipt handoff rejects WhatsApp and invalid evidence', () => {
  assert.throws(() => prepareManualReceiptHandoff({ ...valid, channel: 'whatsapp' }), /channel/);
  assert.throws(
    () => prepareManualReceiptHandoff({ ...valid, evidenceReference: ' ' }),
    /evidence/,
  );
  assert.throws(() => prepareManualReceiptHandoff({ ...valid, receiptCode: 'guess' }), /code/);
});
