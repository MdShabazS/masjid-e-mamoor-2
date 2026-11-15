import { beforeEach, describe, expect, it, vi } from "vitest";

const { createClient, getFinanceMonthlyReportCapabilities, getUser, rpc } = vi.hoisted(() => ({
  createClient: vi.fn(), getFinanceMonthlyReportCapabilities: vi.fn(),
  getUser: vi.fn(), rpc: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({ createClient }));
vi.mock("./server", () => ({ getFinanceMonthlyReportCapabilities }));

import { financeCsvResponse } from "./csv-response";

describe("authenticated Finance CSV response", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createClient.mockResolvedValue({ auth: { getUser }, rpc });
    getUser.mockResolvedValue({ data: { user: { id: "member" } }, error: null });
    getFinanceMonthlyReportCapabilities.mockResolvedValue({ canRead: true });
  });

  it("does not query the ledger when the caller is unauthenticated or unauthorized", async () => {
    getUser.mockResolvedValueOnce({ data: { user: null }, error: null });
    expect((await financeCsvResponse("2026-10-01", "2026-10-31")).status).toBe(401);
    getFinanceMonthlyReportCapabilities.mockResolvedValueOnce({ canRead: false });
    expect((await financeCsvResponse("2026-10-01", "2026-10-31")).status).toBe(403);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("exports only a permission-checked posted ledger with private no-store headers", async () => {
    rpc.mockResolvedValue({ data: {
      schema_version: 1, masjid_name: "Masjid E Mamoor 2", currency: "INR",
      period_start: "2026-10-01", period_end: "2026-10-31",
      summary: { transaction_count: 0, opening_balance_paise: "0", closing_balance_paise: "0",
        donation_inflow_paise: "0", expense_outflow_paise: "0", adjustments_net_paise: "0",
        transfer_in_paise: "0", transfer_out_paise: "0" },
      donation_breakdown: { recurring_paise: "0", additional_paise: "0",
        anonymous_paise: "0", jummah_paise: "0" }, accounts: [], ledger: [],
    }, error: null });
    const response = await financeCsvResponse("2026-10-01", "2026-10-31");
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.headers.get("Content-Disposition")).toContain(".csv");
    expect(rpc).toHaveBeenCalledWith("get_finance_date_range_report", {
      p_start_date: "2026-10-01", p_end_date: "2026-10-31",
    });
  });
});
