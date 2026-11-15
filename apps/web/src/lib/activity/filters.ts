export type ActivityPeriod = { startDate: string; endDate: string; label: string };
const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value)
  && !Number.isNaN(Date.parse(`${value}T00:00:00Z`))
  && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;

export function resolveActivityPeriod(
  params: { period?: string; month?: string; year?: string; from?: string; to?: string },
  today: Date = new Date(),
): ActivityPeriod {
  const india = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(today);
  const fallbackMonth = india.slice(0, 7);
  if (params.period === "custom") {
    const from = params.from ?? "";
    const to = params.to ?? "";
    if (!validDate(from) || !validDate(to) || from > to
      || (Date.parse(to) - Date.parse(from)) / 86400000 > 3660) {
      throw new Error("invalid_activity_range");
    }
    return { startDate: from, endDate: to, label: `${from} to ${to}` };
  }
  if (params.period === "year") {
    const year = params.year ?? fallbackMonth.slice(0, 4);
    if (!/^\d{4}$/.test(year) || Number(year) < 2000 || Number(year) > 2100) {
      throw new Error("invalid_activity_range");
    }
    return { startDate: `${year}-01-01`, endDate: `${year}-12-31`, label: year };
  }
  const month = params.month ?? fallbackMonth;
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    throw new Error("invalid_activity_range");
  }
  const [year, number] = month.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, number, 0)).getUTCDate();
  return { startDate: `${month}-01`, endDate: `${month}-${lastDay}`, label: month };
}
