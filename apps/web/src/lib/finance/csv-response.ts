import "server-only";

import { financeDateRangeCsv } from "@masjid-e-mamoor/shared";
import { isValidFinanceReportRange } from "./date-range";
import { getFinanceMonthlyReportCapabilities } from "./server";
import { createClient } from "@/lib/supabase/server";

export async function financeCsvResponse(start: string, end: string): Promise<Response> {
  const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
  if (!isValidFinanceReportRange(start, end))
    return new Response("Select a valid date range of at most 366 days.", { status: 400, headers });
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return new Response("Sign in to download this report.", { status: 401, headers });
  try {
    const capabilities = await getFinanceMonthlyReportCapabilities();
    if (!capabilities.canRead) return new Response("Not authorized", { status: 403, headers });
    const { data, error } = await supabase.rpc("get_finance_date_range_report", {
      p_start_date: start, p_end_date: end,
    });
    if (error) {
      if (error.code === "42501") return new Response("Not authorized", { status: 403, headers });
      if (error.code === "22023") return new Response("Invalid date range.", { status: 400, headers });
      if (error.code === "54000") return new Response("Too many ledger entries in this range.", { status: 413, headers });
      throw error;
    }
    const csv = financeDateRangeCsv(data);
    if (new TextEncoder().encode(csv).byteLength > 8 * 1024 * 1024)
      return new Response("Report is too large to export.", { status: 413, headers });
    return new Response(csv, { status: 200, headers: {
      ...headers, "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="masjid-e-mamoor-2-finance-${start}-to-${end}.csv"`,
    } });
  } catch {
    return new Response("The report could not be generated. Try again.", { status: 502, headers });
  }
}
