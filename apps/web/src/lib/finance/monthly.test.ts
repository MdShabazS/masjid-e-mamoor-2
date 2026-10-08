import { describe, expect, it } from "vitest";

import {
  isCompletedFinanceReportMonth,
  normalizeFinanceReportMonthInput,
  previousCompletedFinanceMonthInput,
} from "./monthly";

const OCTOBER_2026 = new Date(
  "2026-10-08T05:00:00.000Z",
);

describe("Finance monthly report month handling", () => {
  it("accepts completed months", () => {
    expect(
      isCompletedFinanceReportMonth(
        "2026-09-01",
        OCTOBER_2026,
      ),
    ).toBe(true);

    expect(
      isCompletedFinanceReportMonth(
        "2025-12-01",
        OCTOBER_2026,
      ),
    ).toBe(true);
  });

  it("rejects current, future, and malformed months", () => {
    expect(
      isCompletedFinanceReportMonth(
        "2026-10-01",
        OCTOBER_2026,
      ),
    ).toBe(false);

    expect(
      isCompletedFinanceReportMonth(
        "2026-11-01",
        OCTOBER_2026,
      ),
    ).toBe(false);

    expect(
      isCompletedFinanceReportMonth(
        "2026-09-02",
        OCTOBER_2026,
      ),
    ).toBe(false);

    expect(
      isCompletedFinanceReportMonth(
        "2026-13-01",
        OCTOBER_2026,
      ),
    ).toBe(false);
  });

  it("normalizes month input only for completed months", () => {
    expect(
      normalizeFinanceReportMonthInput(
        "2026-09",
        OCTOBER_2026,
      ),
    ).toBe("2026-09-01");

    expect(
      normalizeFinanceReportMonthInput(
        "2026-10",
        OCTOBER_2026,
      ),
    ).toBeNull();
  });

  it("calculates the previous India calendar month", () => {
    expect(
      previousCompletedFinanceMonthInput(
        OCTOBER_2026,
      ),
    ).toBe("2026-09");

    expect(
      previousCompletedFinanceMonthInput(
        new Date("2027-01-15T00:00:00.000Z"),
      ),
    ).toBe("2026-12");
  });
});
