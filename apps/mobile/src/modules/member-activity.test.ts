import { activityCustomRange, activityMonthRange, activityYearRange, currentIndiaMonth } from "./member-activity";

jest.mock("../lib/supabase", () => ({ supabase: { rpc: jest.fn() } }));

describe("member activity ranges", () => {
  it("uses India month at UTC midnight boundary", () => {
    expect(currentIndiaMonth(new Date("2026-10-31T20:00:00Z"))).toBe("2026-11");
  });
  it("handles leap year and inclusive custom dates", () => {
    expect(activityMonthRange("2028-02")).toEqual({ from: "2028-02-01", to: "2028-02-29" });
    expect(activityYearRange("2026")).toEqual({ from: "2026-01-01", to: "2026-12-31" });
    expect(activityCustomRange("2026-10-01", "2026-10-01")).toEqual({ from: "2026-10-01", to: "2026-10-01" });
  });
  it("rejects reversed and impossible dates", () => {
    expect(() => activityCustomRange("2026-10-02", "2026-10-01")).toThrow("invalid_activity_range");
    expect(() => activityCustomRange("2026-02-30", "2026-03-01")).toThrow("invalid_activity_range");
  });
});
