import {
  formatIsoDateInput,
  formatIsoMonthInput,
  isValidIsoDate,
  isValidIsoMonth,
  isoDateInputError,
  isoMonthInputError,
} from "./date-input";

describe("date input helpers", () => {
  test("formats dates while typing", () => {
    expect(formatIsoDateInput("2026", "202")).toBe("2026-");
    expect(formatIsoDateInput("202602", "2026-0")).toBe("2026-02-");
    expect(formatIsoDateInput("20260201")).toBe("2026-02-01");
    expect(formatIsoDateInput("2026/02/01")).toBe("2026-02-01");
  });

  test("allows natural date deletion", () => {
    expect(formatIsoDateInput("2026", "2026-")).toBe("2026");
    expect(formatIsoDateInput("2026-02", "2026-02-")).toBe("2026-02");
  });

  test("formats months while typing", () => {
    expect(formatIsoMonthInput("2026", "202")).toBe("2026-");
    expect(formatIsoMonthInput("202602")).toBe("2026-02");
  });

  test("validates real calendar dates", () => {
    expect(isValidIsoDate("2026-02-01")).toBe(true);
    expect(isValidIsoDate("2024-02-29")).toBe(true);
    expect(isValidIsoDate("2026-00-00")).toBe(false);
    expect(isValidIsoDate("2026-13-01")).toBe(false);
    expect(isValidIsoDate("2026-02-29")).toBe(false);
    expect(isValidIsoDate("2026-02-30")).toBe(false);
    expect(isValidIsoDate("2026-04-31")).toBe(false);
  });

  test("validates real calendar months", () => {
    expect(isValidIsoMonth("2026-01")).toBe(true);
    expect(isValidIsoMonth("2026-12")).toBe(true);
    expect(isValidIsoMonth("2026-00")).toBe(false);
    expect(isValidIsoMonth("2026-13")).toBe(false);
  });

  test("returns useful validation errors", () => {
    expect(isoDateInputError("")).toBeNull();
    expect(isoDateInputError("2026-02")).toBeTruthy();
    expect(isoDateInputError("2026-02-30")).toBeTruthy();
    expect(isoDateInputError("2026-02-28")).toBeNull();

    expect(isoMonthInputError("")).toBeNull();
    expect(isoMonthInputError("2026-")).toBeTruthy();
    expect(isoMonthInputError("2026-13")).toBeTruthy();
    expect(isoMonthInputError("2026-12")).toBeNull();
  });
});
