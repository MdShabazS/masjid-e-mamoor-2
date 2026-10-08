const REPORT_MONTH_PATTERN = /^(\d{4})-(\d{2})-01$/;
const MONTH_INPUT_PATTERN = /^(\d{4})-(\d{2})$/;

function indiaYearMonth(now: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(now);

  const year = Number(
    parts.find((part) => part.type === "year")?.value,
  );
  const month = Number(
    parts.find((part) => part.type === "month")?.value,
  );

  return { year, month };
}

export function isCompletedFinanceReportMonth(
  value: string,
  now = new Date(),
) {
  const match = REPORT_MONTH_PATTERN.exec(value);

  if (!match) {
    return false;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);

  if (
    !Number.isInteger(year) ||
    year < 2000 ||
    !Number.isInteger(month) ||
    month < 1 ||
    month > 12
  ) {
    return false;
  }

  const current = indiaYearMonth(now);

  return (
    year < current.year ||
    (year === current.year && month < current.month)
  );
}

export function normalizeFinanceReportMonthInput(
  value: string,
  now = new Date(),
) {
  const match = MONTH_INPUT_PATTERN.exec(value);

  if (!match) {
    return null;
  }

  const reportMonth = `${match[1]}-${match[2]}-01`;

  return isCompletedFinanceReportMonth(reportMonth, now)
    ? reportMonth
    : null;
}

export function previousCompletedFinanceMonthInput(
  now = new Date(),
) {
  const current = indiaYearMonth(now);

  if (current.month === 1) {
    return `${current.year - 1}-12`;
  }

  return `${current.year}-${String(
    current.month - 1,
  ).padStart(2, "0")}`;
}
