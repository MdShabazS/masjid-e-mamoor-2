const MESSAGES = {
  invalid_inr_amount: 'Enter a positive rupee amount with at most two decimal places.',
  invalid_rejection_reason: 'Enter a reason between 3 and 500 characters.',
  invalid_staff_reason: 'Enter a reference between 3 and 240 characters.',
  invalid_reference: 'Enter a reference between 3 and 200 characters.',
  insufficient_balance: 'This account does not have enough balance.',
  insufficient_account_balance: 'This account does not have enough balance.',
  expense_overpayment: 'This payment is more than the amount still owed on the expense.',
  expense_not_approved: 'This expense is not approved for payment.',
  expense_not_decidable: 'This expense has already been decided.',
  wrong_expense_approver: 'Someone else must decide this expense. You cannot approve your own.',
  donation_already_decided: 'This donation has already been decided.',
  verified_matching_account_required:
    'Choose an active account of the right type with a verified opening balance.',
  invalid_direct_cash: 'Check the donor, date, amount and slip, and use a Cash account.',
  invalid_report_period: 'Choose a valid report period.',
  unchanged_prayer_mark: 'This prayer already has that mark.',
  operation_id_conflict: 'This request changed while retrying. Check the list and try again.',
  AUTH_REQUIRED: 'Your sign-in has expired. Sign in again.',
  FORBIDDEN: 'This account cannot perform that action.',
  RATE_LIMITED: 'Too many attempts. Try again in a few minutes.',
  SERVICE_UNAVAILABLE: 'The service is unavailable. Try again later.',
  ENROLLMENT_DISABLED: 'Contributor enrollment is off until the Board approves the consent notice.',
  ENROLLMENT_REJECTED: 'Check the contributor details and try again.',
  DUPLICATE_REVIEW: 'This contributor may already be enrolled. Check the roster.',
  QR_NOT_FOUND: 'No active QR for this account.',
  QR_IMAGE_TOO_LARGE: 'Choose an image no larger than 5 MB.',
  INVALID_QR_IMAGE: 'That file is not a readable PNG or JPEG image.',
  QR_ACCOUNT_NOT_ACTIVE: 'This account cannot use a payment QR.',
  QR_CHANGED_RETRY: 'The QR just changed. Try again.',
};

/** Turn a thrown client, API or database error into text a volunteer can act on. */
export function userMessage(cause, fallback = 'That action could not be completed. Try again.') {
  const text = typeof cause === 'string' ? cause : (cause?.message ?? '');
  if (/network request failed|failed to fetch|timed? ?out/i.test(text))
    return 'No connection. Check the internet and try again.';
  if (cause?.code === '42501' || /permission denied|not authorized/i.test(text))
    return MESSAGES.FORBIDDEN;
  if (MESSAGES[text]) return MESSAGES[text];
  // Bare machine codes and parser errors are not useful to the person reading them.
  if (!text || /^[A-Za-z0-9_]+$/.test(text) || /JSON/.test(text)) return fallback;
  return text;
}
