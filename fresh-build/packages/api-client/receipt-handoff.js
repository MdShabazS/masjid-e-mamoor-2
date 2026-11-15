const RECEIPT_CODE = /^(?:MEM2-R-[0-9A-F]{32}|[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12})$/;
const CHANNELS = new Set(['in_person', 'email', 'other_manual']);
const RESULTS = new Set(['delivered', 'failed', 'uncertain']);

export function prepareManualReceiptHandoff(input) {
  const receiptCode = input.receiptCode?.trim() ?? '';
  const recipientReference = input.recipientReference?.trim() ?? '';
  const evidenceReference = input.evidenceReference?.trim() ?? '';
  if (!RECEIPT_CODE.test(receiptCode)) throw new Error('Enter a valid issued receipt code.');
  if (recipientReference.length < 3 || recipientReference.length > 120)
    throw new Error('Enter a recipient reference between 3 and 120 characters.');
  if (!CHANNELS.has(input.channel)) throw new Error('Choose an approved manual channel.');
  if (!RESULTS.has(input.result)) throw new Error('Choose the actual handoff result.');
  if (evidenceReference.length < 3 || evidenceReference.length > 240)
    throw new Error('Enter an evidence reference between 3 and 240 characters.');
  return {
    p_receipt_code: receiptCode,
    p_recipient_reference: recipientReference,
    p_channel: input.channel,
    p_result: input.result,
    p_evidence_reference: evidenceReference,
  };
}
