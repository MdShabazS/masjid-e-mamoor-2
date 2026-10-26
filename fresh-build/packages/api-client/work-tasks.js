const modes = new Set(['open', 'direct', 'mixed']);

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
    const parsed = new Date(`${date}T00:00:00Z`);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      !Number.isFinite(parsed.getTime()) ||
      parsed.toISOString().slice(0, 10) !== date
    )
      throw new Error('Use a valid task date in YYYY-MM-DD format.');
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
