import { Buffer } from "node:buffer";
import { StorageAccessFramework } from "expo-file-system/legacy";
import { supabase } from "../lib/supabase";
import { downloadFinanceDateRangeCsv, downloadFinanceDateRangePdf, financeMonthRange,
  pdfBytesToBase64, validFinanceDateRange } from "./finance-date-range";

jest.mock("../lib/supabase", () => ({ supabase: { functions: { invoke: jest.fn() }, rpc: jest.fn() } }));
jest.mock("expo-file-system/legacy", () => ({
  EncodingType: { Base64: "base64", UTF8: "utf8" },
  StorageAccessFramework: {
    requestDirectoryPermissionsAsync: jest.fn(), createFileAsync: jest.fn(), writeAsStringAsync: jest.fn(),
  },
}));
const invoke = supabase.functions.invoke as jest.Mock;
const rpc = supabase.rpc as jest.Mock;
const permissions = StorageAccessFramework.requestDirectoryPermissionsAsync as jest.Mock;
const createFile = StorageAccessFramework.createFileAsync as jest.Mock;
const writeFile = StorageAccessFramework.writeAsStringAsync as jest.Mock;
beforeEach(() => { jest.clearAllMocks(); });

test("validates inclusive India business date ranges", () => {
  expect(validFinanceDateRange("2024-02-29", "2024-02-29")).toBe(true);
  expect(validFinanceDateRange("2024-01-01", "2024-12-31")).toBe(true);
  expect(validFinanceDateRange("2024-02-30", "2024-03-01")).toBe(false);
  expect(validFinanceDateRange("2024-01-01", "2025-01-01")).toBe(false);
});

test("base64 encoding preserves PDF bytes across chunk boundaries", () => {
  const bytes = Uint8Array.from({ length: 12293 }, (_, index) => index % 256);
  expect(pdfBytesToBase64(bytes)).toBe(Buffer.from(bytes).toString("base64"));
});

test("saves an authenticated PDF into the Android folder selected by the user", async () => {
  const bytes = Uint8Array.from([37, 80, 68, 70, 45, 49, 50, 51]);
  invoke.mockResolvedValue({ data: { arrayBuffer: async () => bytes.buffer }, error: null });
  permissions.mockResolvedValue({ granted: true, directoryUri: "content://folder" });
  createFile.mockResolvedValue("content://folder/report.pdf");
  await expect(downloadFinanceDateRangePdf("2024-01-01", "2024-01-02")).resolves.toBe(true);
  expect(invoke).toHaveBeenCalledWith("render-finance-date-range", {
    body: { start_date: "2024-01-01", end_date: "2024-01-02" },
  });
  expect(createFile).toHaveBeenCalledWith("content://folder",
    "masjid-e-mamoor-2-finance-2024-01-01-to-2024-01-02", "application/pdf");
  expect(writeFile).toHaveBeenCalledWith("content://folder/report.pdf", Buffer.from(bytes).toString("base64"),
    { encoding: "base64" });
});

test("never writes a non-PDF response", async () => {
  invoke.mockResolvedValue({ data: { arrayBuffer: async () => Uint8Array.from([1, 2, 3, 4, 5, 6]).buffer }, error: null });
  await expect(downloadFinanceDateRangePdf("2024-01-01", "2024-01-02")).rejects.toThrow("invalid_report_pdf");
  expect(permissions).not.toHaveBeenCalled();
});

test("saves a posted-ledger CSV in the selected folder", async () => {
  rpc.mockResolvedValue({ data: {
    schema_version: 1, masjid_name: "Masjid E Mamoor 2", currency: "INR",
    period_start: "2024-02-01", period_end: "2024-02-29",
    summary: { transaction_count: 0, opening_balance_paise: "0", closing_balance_paise: "0",
      donation_inflow_paise: "0", expense_outflow_paise: "0", adjustments_net_paise: "0",
      transfer_in_paise: "0", transfer_out_paise: "0" },
    donation_breakdown: { recurring_paise: "0", additional_paise: "0",
      anonymous_paise: "0", jummah_paise: "0" }, accounts: [], ledger: [],
  }, error: null });
  permissions.mockResolvedValue({ granted: true, directoryUri: "content://folder" });
  createFile.mockResolvedValue("content://folder/report.csv");
  expect(financeMonthRange("2024-02")).toEqual({ start: "2024-02-01", end: "2024-02-29" });
  await expect(downloadFinanceDateRangeCsv("2024-02-01", "2024-02-29")).resolves.toBe(true);
  expect(rpc).toHaveBeenCalledWith("get_finance_date_range_report", {
    p_start_date: "2024-02-01", p_end_date: "2024-02-29",
  });
  expect(createFile).toHaveBeenCalledWith("content://folder",
    "masjid-e-mamoor-2-finance-2024-02-01-to-2024-02-29", "text/csv");
  expect(writeFile).toHaveBeenCalledWith("content://folder/report.csv",
    expect.stringContaining("Masjid E Mamoor 2"), { encoding: "utf8" });
});
