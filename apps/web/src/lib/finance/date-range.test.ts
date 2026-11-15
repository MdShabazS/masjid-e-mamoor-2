import { describe, expect, it } from "vitest";
import { isValidFinanceReportRange } from "./date-range";

describe("Finance report range", () => {
  it("accepts inclusive single day and 366-day leap-year periods", () => {
    expect(isValidFinanceReportRange("2024-02-29", "2024-02-29")).toBe(true);
    expect(isValidFinanceReportRange("2024-01-01", "2024-12-31")).toBe(true);
  });
  it("rejects malformed, impossible, reversed and oversized dates", () => {
    expect(isValidFinanceReportRange("2024-02-30", "2024-03-01")).toBe(false);
    expect(isValidFinanceReportRange("2024-03-02", "2024-03-01")).toBe(false);
    expect(isValidFinanceReportRange("2024-01-01", "2025-01-01")).toBe(false);
    expect(isValidFinanceReportRange("2024-01-01", "2024-xx-31")).toBe(false);
  });
});
