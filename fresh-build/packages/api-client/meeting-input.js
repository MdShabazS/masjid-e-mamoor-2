export function buildMeetingArgs(draft, now = Date.now()) {
  const title = draft.title?.trim() ?? '';
  const description = draft.description?.trim() ?? '';
  const location = draft.location?.trim() || null;
  const date = draft.date?.trim() ?? '';
  const time = draft.time?.trim() ?? '';
  if (!title || title.length > 160) throw new Error('Meeting title must be 1–160 characters.');
  if (!description || description.length > 2000)
    throw new Error('Meeting description must be 1–2000 characters.');
  if (location && location.length > 240)
    throw new Error('Location must be at most 240 characters.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time))
    throw new Error('Use a valid India date and time.');
  const dateCheck = new Date(`${date}T00:00:00Z`);
  const starts = new Date(`${date}T${time}:00+05:30`);
  if (
    !Number.isFinite(dateCheck.getTime()) ||
    dateCheck.toISOString().slice(0, 10) !== date ||
    !Number.isFinite(starts.getTime()) ||
    starts.getTime() <= now
  )
    throw new Error('Meeting must start at a valid future India date and time.');
  return {
    p_title: title,
    p_description: description,
    p_date: date,
    p_starts_at: starts.toISOString(),
    p_location: location,
  };
}
