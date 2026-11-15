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
  site_not_configured:
    'Location check-in is not set up yet. Ask the organizer to mark you present.',
  invalid_location: 'Could not read a valid location. Try again.',
  mock_location: 'This phone is using a simulated location. Turn it off and try again.',
  stale_location: 'That location reading is too old. Try again.',
  low_accuracy_location: 'Your location is not accurate enough. Move outdoors and try again.',
  outside_masjid_area: 'You are more than 100 m from the masjid.',
  wrong_meeting_day: 'This can only be done on the day of the meeting.',
  check_in_not_allowed: 'You cannot check in to this meeting.',
  manual_attendance_not_allowed: 'Only the organizer can mark someone who has not declined.',
  meeting_day_not_over: 'A meeting can be finalized only after its day has ended.',
  meeting_already_finalized: 'This meeting is already finalized.',
  finalization_not_allowed: 'This account cannot finalize this meeting.',
  fallback_reason_required: 'Enter why the organizer could not finalize.',
  invalid_site: 'Check the coordinates and how they were verified.',
  salary_already_paid: 'This staff member is already paid for that month.',
  salary_staff_unchanged: 'Nothing changed. Enter a different amount.',
  salary_staff_not_found: 'This staff member is not on the active salary list.',
  invalid_salary_staff: 'Enter a name, role and positive monthly amount.',
  invalid_salary_payment: 'Check the month, account, amount, date and proof reference.',
  invalid_advance: 'Enter who receives it, what it is for and a positive amount.',
  invalid_advance_decision: 'A rejection needs a reason of at least 3 characters.',
  wrong_advance_approver: 'Someone else must approve this. You cannot approve your own advance.',
  advance_not_decidable: 'This advance has already been decided.',
  advance_not_approved: 'This advance is not approved for payment.',
  advance_not_outstanding: 'This advance has nothing left to settle.',
  advance_oversettled: 'That is more than the amount still outstanding.',
  advance_account_reserved: 'The advances account cannot be used for this.',
  member_not_found: 'That member is not active.',
  invalid_activity_period: 'Choose a month or a year.',
  role_not_manageable: 'You cannot manage that role.',
  OPERATION_CONFLICT:
    'That username is taken or this request is out of date. Try another username.',
  VALIDATION_FAILED:
    'Check the username: 3–32 letters, numbers, dot, dash or underscore, starting with a letter.',
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
