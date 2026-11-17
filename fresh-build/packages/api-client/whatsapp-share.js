// Messages a volunteer sends to a donor from their own WhatsApp (owner decision 17 Nov 2026).
// Replaced by the WhatsApp Business API later; the wording should then become the approved templates.

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/** "2026-11-01" → "November 2026". */
export function monthName(period) {
  const match = /^(\d{4})-(\d{2})-01$/.exec(period ?? '');
  if (!match || Number(match[2]) < 1 || Number(match[2]) > 12)
    throw new Error('invalid_whatsapp_send');
  return `${MONTHS[Number(match[2]) - 1]} ${match[1]}`;
}

function rupees(paise) {
  const value = Number(paise) / 100;
  return value.toLocaleString('en-IN', {
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

export function donorMessage(kind, { name, suggestedAmountPaise, period }) {
  const month = monthName(period);
  if (kind === 'monthly_request')
    return [
      `Assalamu alaikum ${name}.`,
      `This is a message from Masjid E Mamoor 2 about your voluntary monthly contribution for ${month}.`,
      `Suggested amount: ₹${rupees(suggestedAmountPaise)}. Any amount is welcome.`,
      'After paying, please send me the UPI or bank transaction reference so the Treasurer can confirm it.',
      'JazakAllah khair.',
    ].join('\n');
  if (kind === 'reminder')
    return [
      `Assalamu alaikum ${name}.`,
      `A gentle reminder about your voluntary monthly contribution to Masjid E Mamoor 2 for ${month}.`,
      'If you have already paid, please send me the transaction reference.',
      'If you would rather not receive these messages, just tell me.',
      'JazakAllah khair.',
    ].join('\n');
  throw new Error('invalid_whatsapp_send');
}

/** A wa.me link opens the phone's WhatsApp with the message typed and the donor chosen. */
export function whatsappLink(phone, text) {
  const digits = String(phone ?? '').replace(/[^0-9]/g, '');
  if (digits.length < 8 || digits.length > 15) throw new Error('invalid_whatsapp_send');
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}
