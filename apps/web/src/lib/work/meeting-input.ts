export function indiaMeetingInstant(value: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const [, y, m, d, h, minute] = match;
  const year = Number(y); const month = Number(m); const day = Number(d);
  const hour = Number(h); const minutes = Number(minute);
  const calendar = new Date(Date.UTC(year, month - 1, day));
  if (calendar.getUTCFullYear() !== year || calendar.getUTCMonth() !== month - 1
    || calendar.getUTCDate() !== day || hour > 23 || minutes > 59) return null;
  const instant = new Date(`${value}:00+05:30`);
  return Number.isNaN(instant.getTime()) ? null : instant.toISOString();
}

export function parseMeetingCreation(form: FormData) {
  const title = String(form.get("title") ?? "").trim();
  const meetingType = String(form.get("meetingType") ?? "").trim();
  const details = String(form.get("details") ?? "").trim();
  const location = String(form.get("location") ?? "").trim();
  const scheduledStart = indiaMeetingInstant(String(form.get("start") ?? ""));
  const rawEnd = String(form.get("end") ?? "");
  const scheduledEnd = rawEnd ? indiaMeetingInstant(rawEnd) : null;
  const participantIds = [...new Set(form.getAll("participant").map(String))];
  if (!title || title.length > 200 || !meetingType || meetingType.length > 100
    || details.length > 5000 || location.length > 500 || !scheduledStart
    || (rawEnd && !scheduledEnd) || (scheduledEnd && scheduledEnd <= scheduledStart)
    || participantIds.length === 0
    || participantIds.some((id) => !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id))) {
    throw new Error("invalid_meeting");
  }
  return { title, meetingType, details: details || null, location: location || null,
    scheduledStart, scheduledEnd, participantIds };
}
