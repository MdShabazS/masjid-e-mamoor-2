export function formatIsoDateInput(value: string, previousValue = "") {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  const deleting = value.length < previousValue.length;

  if (digits.length <= 3) return digits;

  if (digits.length === 4) {
    return deleting ? digits : `${digits}-`;
  }

  if (digits.length <= 5) {
    return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  }

  if (digits.length === 6) {
    const formatted = `${digits.slice(0, 4)}-${digits.slice(4, 6)}`;
    return deleting ? formatted : `${formatted}-`;
  }

  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
}

export function formatIsoMonthInput(value: string, previousValue = "") {
  const digits = value.replace(/\D/g, "").slice(0, 6);
  const deleting = value.length < previousValue.length;

  if (digits.length <= 3) return digits;

  if (digits.length === 4) {
    return deleting ? digits : `${digits}-`;
  }

  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}`;
}

export function isValidIsoMonth(value: string) {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

export function isValidIsoDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (year < 1 || month < 1 || month > 12 || day < 1) return false;

  const leapYear =
    year % 400 === 0 || (year % 4 === 0 && year % 100 !== 0);

  const daysInMonth = [
    31,
    leapYear ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];

  return day <= daysInMonth[month - 1];
}

export function isoDateInputError(value: string) {
  if (!value) return null;
  if (value.length !== 10) return "Enter the complete date as YYYY-MM-DD.";
  return isValidIsoDate(value) ? null : "Enter a valid calendar date.";
}

export function isoMonthInputError(value: string) {
  if (!value) return null;
  if (value.length !== 7) return "Enter the complete month as YYYY-MM.";
  return isValidIsoMonth(value) ? null : "Enter a valid calendar month.";
}
