import { supabase } from "../lib/supabase";
import {
  type FinanceMonthlyReport,
  financeMonthlyReportsQueryKey,
  financeMonthlyReportStatusLabel,
  formatFinanceReportMonth,
  generateFinanceMonthlyReport,
  getFinanceMonthlyReportPdfUrl,
  listFinanceMonthlyReports,
  normalizeFinanceReportMonth,
} from "./finance";

jest.mock("../lib/supabase", () => ({
  supabase: {
    from: jest.fn(),
    storage: {
      from: jest.fn(),
    },
    functions: {
      invoke: jest.fn(),
    },
  },
}));

const mockFrom = supabase.from as unknown as jest.Mock;
const mockStorageFrom =
  supabase.storage.from as unknown as jest.Mock;
const mockFunctionsInvoke =
  supabase.functions.invoke as unknown as jest.Mock;

function report(
  overrides: Partial<FinanceMonthlyReport> = {},
): FinanceMonthlyReport {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    reportMonth: "2026-09-01",
    revision: 2,
    status: "ready",
    generationSource: "scheduled",
    attemptCount: 1,
    openingBalancePaise: 10000,
    donationInflowPaise: 5000,
    expenseOutflowPaise: 2000,
    adjustmentsNetPaise: 0,
    transferInPaise: 1000,
    transferOutPaise: 1000,
    closingBalancePaise: 13000,
    cashClosingPaise: 3000,
    bankClosingPaise: 7000,
    upiClosingPaise: 2000,
    otherClosingPaise: 1000,
    transactionCount: 6,
    storageBucket: "finance-monthly-reports",
    storageObjectPath: "2026/09/report-r2.pdf",
    fileSizeBytes: 12345,
    generatedAt: "2026-10-01T00:00:00Z",
    lastErrorCode: null,
    createdAt: "2026-10-01T00:00:00Z",
    updatedAt: "2026-10-01T00:00:00Z",
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("Finance Monthly Reports", () => {
  it("scopes its query key to the application user", () => {
    expect(
      financeMonthlyReportsQueryKey("user-1"),
    ).toEqual([
      "finance",
      "monthly-reports",
      "user-1",
    ]);

    expect(
      financeMonthlyReportsQueryKey(),
    ).toEqual([
      "finance",
      "monthly-reports",
      "anonymous",
    ]);
  });

  it("lists and maps monthly reports newest first", async () => {
    const secondOrder = jest.fn().mockResolvedValue({
      data: [
        {
          id: "11111111-1111-1111-1111-111111111111",
          report_month: "2026-09-01",
          revision: 2,
          status: "ready",
          generation_source: "scheduled",
          attempt_count: 1,
          opening_balance_paise: 10000,
          donation_inflow_paise: 5000,
          expense_outflow_paise: 2000,
          adjustments_net_paise: 0,
          transfer_in_paise: 1000,
          transfer_out_paise: 1000,
          closing_balance_paise: 13000,
          cash_closing_paise: 3000,
          bank_closing_paise: 7000,
          upi_closing_paise: 2000,
          other_closing_paise: 1000,
          transaction_count: 6,
          storage_bucket: "finance-monthly-reports",
          storage_object_path:
            "2026/09/report-r2.pdf",
          file_size_bytes: 12345,
          generated_at: "2026-10-01T00:00:00Z",
          last_error_code: null,
          created_at: "2026-10-01T00:00:00Z",
          updated_at: "2026-10-01T00:00:00Z",
        },
      ],
      error: null,
    });

    const firstOrder = jest.fn().mockReturnValue({
      order: secondOrder,
    });

    const select = jest.fn().mockReturnValue({
      order: firstOrder,
    });

    mockFrom.mockReturnValue({
      select,
    });

    const result =
      await listFinanceMonthlyReports();

    expect(mockFrom).toHaveBeenCalledWith(
      "finance_monthly_reports",
    );

    expect(firstOrder).toHaveBeenCalledWith(
      "report_month",
      { ascending: false },
    );

    expect(secondOrder).toHaveBeenCalledWith(
      "revision",
      { ascending: false },
    );

    expect(result).toEqual([report()]);
  });

  it("fails closed when monthly reports cannot load", async () => {
    const secondOrder = jest.fn().mockResolvedValue({
      data: null,
      error: { message: "forbidden" },
    });

    const firstOrder = jest.fn().mockReturnValue({
      order: secondOrder,
    });

    mockFrom.mockReturnValue({
      select: jest.fn().mockReturnValue({
        order: firstOrder,
      }),
    });

    await expect(
      listFinanceMonthlyReports(),
    ).rejects.toThrow(
      "finance_monthly_reports_unavailable",
    );
  });

  it("normalizes a manual report month", () => {
    expect(
      normalizeFinanceReportMonth("2026-09"),
    ).toBe("2026-09-01");

    expect(
      normalizeFinanceReportMonth(" 2026-09 "),
    ).toBe("2026-09-01");
  });

  it("rejects an invalid manual report month", () => {
    expect(() =>
      normalizeFinanceReportMonth("2026-13"),
    ).toThrow(
      "finance_monthly_report_month_invalid",
    );

    expect(() =>
      normalizeFinanceReportMonth("2026-09-01"),
    ).toThrow(
      "finance_monthly_report_month_invalid",
    );
  });

  it("invokes the authenticated monthly report renderer", async () => {
    mockFunctionsInvoke.mockResolvedValue({
      data: {
        status: "ready",
        report_id:
          "11111111-1111-1111-1111-111111111111",
      },
      error: null,
    });

    await expect(
      generateFinanceMonthlyReport("2026-09"),
    ).resolves.toEqual({
      status: "ready",
      report_id:
        "11111111-1111-1111-1111-111111111111",
    });

    expect(mockFunctionsInvoke).toHaveBeenCalledWith(
      "render-finance-monthly-report",
      {
        body: {
          report_month: "2026-09-01",
        },
      },
    );
  });

  it("fails closed when the monthly renderer fails", async () => {
    mockFunctionsInvoke.mockResolvedValue({
      data: null,
      error: {
        message: "not authorized",
      },
    });

    await expect(
      generateFinanceMonthlyReport("2026-09"),
    ).rejects.toThrow(
      "finance_monthly_report_generate_failed",
    );
  });

  it("creates a short-lived signed URL for ready PDFs", async () => {
    const createSignedUrl = jest
      .fn()
      .mockResolvedValue({
        data: {
          signedUrl:
            "https://example.test/report.pdf",
        },
        error: null,
      });

    mockStorageFrom.mockReturnValue({
      createSignedUrl,
    });

    await expect(
      getFinanceMonthlyReportPdfUrl(report()),
    ).resolves.toBe(
      "https://example.test/report.pdf",
    );

    expect(mockStorageFrom).toHaveBeenCalledWith(
      "finance-monthly-reports",
    );

    expect(createSignedUrl).toHaveBeenCalledWith(
      "2026/09/report-r2.pdf",
      60,
    );
  });

  it("does not issue a storage URL for unfinished reports", async () => {
    await expect(
      getFinanceMonthlyReportPdfUrl(
        report({
          status: "generating",
          fileSizeBytes: null,
          generatedAt: null,
        }),
      ),
    ).rejects.toThrow(
      "finance_monthly_report_not_ready",
    );

    expect(mockStorageFrom).not.toHaveBeenCalled();
  });

  it("formats month and lifecycle labels", () => {
    expect(
      formatFinanceReportMonth("2026-09-01"),
    ).toBe("September 2026");

    expect(
      financeMonthlyReportStatusLabel("generating"),
    ).toBe("Generating");

    expect(
      financeMonthlyReportStatusLabel("ready"),
    ).toBe("Ready");

    expect(
      financeMonthlyReportStatusLabel("failed"),
    ).toBe("Failed");
  });
});
