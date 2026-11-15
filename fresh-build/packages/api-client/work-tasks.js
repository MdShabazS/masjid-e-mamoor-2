import { parseINRToPaise } from './index.js';

const modes = new Set(['open', 'direct', 'mixed']);

function validDate(value) {
  const parsed = new Date(`${value}T00:00:00Z`);
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

function capacity(value, name, min) {
  const number = Number(value);
  if (!/^\d+$/.test(String(value)) || !Number.isInteger(number) || number < min || number > 10000)
    throw new Error(`${name} must be a whole number from ${min} to 10000.`);
  return number;
}

export function buildWorkTaskArgs(draft) {
  const title = draft.title?.trim() ?? '';
  const description = draft.description?.trim() ?? '';
  const location = draft.location?.trim() || null;
  const date = draft.date?.trim() || null;
  if (!title || title.length > 160) throw new Error('Task title must be 1–160 characters.');
  if (!description || description.length > 2000)
    throw new Error('Task description must be 1–2000 characters.');
  if (location && location.length > 240)
    throw new Error('Location must be at most 240 characters.');
  if (date) {
    if (!validDate(date)) throw new Error('Use a valid task date in YYYY-MM-DD format.');
  }
  if (!modes.has(draft.mode)) throw new Error('Choose a participation mode.');
  const total = capacity(draft.total, 'Total places', 1);
  const invited = capacity(draft.invited, 'Invited places', draft.mode === 'open' ? 0 : 1);
  const volunteer = capacity(draft.volunteer, 'Volunteer places', draft.mode === 'direct' ? 0 : 1);
  if (
    total > invited + volunteer ||
    (draft.mode === 'open' && invited !== 0) ||
    (draft.mode === 'direct' && volunteer !== 0)
  )
    throw new Error('Places must fit the selected invitation and volunteer limits.');
  return {
    p_title: title,
    p_description: description,
    p_date: date,
    p_location: location,
    p_mode: draft.mode,
    p_total: total,
    p_invited: invited,
    p_volunteer: volunteer,
  };
}

export function buildCashCountArgs(taskId, draft) {
  const date = draft.date?.trim() ?? '';
  const evidence = draft.evidence?.trim() ?? '';
  if (!validDate(date)) throw new Error('Use a valid count date in YYYY-MM-DD format.');
  if (evidence.length < 3 || evidence.length > 240)
    throw new Error('Numbered cash slip or evidence reference must be 3–240 characters.');
  let amount;
  try {
    amount = parseINRToPaise(draft.amount?.trim() ?? '');
  } catch {
    throw new Error('Enter a positive amount in rupees with at most two decimal places.');
  }
  return {
    p_task_id: taskId,
    p_date: date,
    p_amount_paise: amount,
    p_evidence: evidence,
  };
}

export function buildCashVerificationArgs(countId, draft, cashAccounts) {
  if (!draft.physicallyCounted)
    throw new Error('Physically count the cash and check its numbered slip first.');
  if (
    !cashAccounts.some(
      (account) =>
        account.account_id === draft.accountId && account.active && account.account_kind === 'cash',
    )
  )
    throw new Error('Select an active Cash account.');
  let amount;
  try {
    amount = parseINRToPaise(draft.amount?.trim() ?? '');
  } catch {
    throw new Error('Enter the positive amount physically received in rupees.');
  }
  return {
    p_count_id: countId,
    p_actual_amount_paise: amount,
    p_account_id: draft.accountId,
  };
}

export function buildCashRejectionArgs(countId, reason) {
  const trimmed = reason?.trim() ?? '';
  if (trimmed.length < 3 || trimmed.length > 240)
    throw new Error('Rejection reason must be 3–240 characters.');
  return { p_count_id: countId, p_reason: trimmed };
}
