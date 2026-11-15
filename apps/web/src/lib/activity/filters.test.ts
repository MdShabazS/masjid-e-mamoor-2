import { describe, expect, it } from "vitest";
import { resolveActivityPeriod } from "./filters";

describe("member activity date filters", () => {
  it("uses the India month at a UTC day boundary", () => {
    expect(resolveActivityPeriod({}, new Date("2026-10-31T20:00:00Z"))).toEqual({
      startDate: "2026-11-01", endDate: "2026-11-30", label: "2026-11",
    });
  });
  it("accepts leap year and custom inclusive dates", () => {
    expect(resolveActivityPeriod({ period: "month", month: "2028-02" }).endDate).toBe("2028-02-29");
    expect(resolveActivityPeriod({ period: "custom", from: "2026-10-01", to: "2026-10-01" }).startDate).toBe("2026-10-01");
  });
  it("rejects impossible and reversed dates", () => {
    expect(() => resolveActivityPeriod({ period: "custom", from: "2026-02-30", to: "2026-03-01" })).toThrow("invalid_activity_range");
    expect(() => resolveActivityPeriod({ period: "custom", from: "2026-10-02", to: "2026-10-01" })).toThrow("invalid_activity_range");
  });
});
