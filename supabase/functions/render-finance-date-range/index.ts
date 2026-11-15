import { createClient } from "npm:@supabase/supabase-js@2.116.0";
import { isValidPdfBytes, renderFinanceDateRangePdf } from "../render-finance-monthly-report/pdf.ts";

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
function validDate(value: unknown): value is string {
  if (typeof value !== "string" || !datePattern.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
function jsonError(status: number, code: string) {
  return Response.json({ code }, { status, headers: { "Cache-Control": "no-store" } });
}
Deno.serve(async (request) => {
  if (request.method !== "POST") return jsonError(405, "method_not_allowed");
  let body: unknown;
  try { body = await request.json(); } catch { return jsonError(400, "invalid_request"); }
  const input = body as { start_date?: unknown; end_date?: unknown } | null;
  if (!input || typeof input !== "object" || !validDate(input.start_date)
    || !validDate(input.end_date) || input.end_date < input.start_date) {
    return jsonError(400, "invalid_report_range");
  }
  const authorization = request.headers.get("Authorization")?.trim() ?? "";
  const token = /^Bearer\s+(\S+)$/i.exec(authorization)?.[1];
  if (!token) return jsonError(401, "auth_required");
  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !anonKey) return jsonError(500, "configuration_error");
  const client = createClient(url, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
  });
  const { data: userData, error: userError } = await client.auth.getUser(token);
  if (userError || !userData.user) return jsonError(401, "auth_failed");
  const { data, error } = await client.rpc("get_finance_date_range_report", {
    p_start_date: input.start_date, p_end_date: input.end_date,
  });
  if (error) {
    if (error.code === "42501") return jsonError(403, "not_authorized");
    if (error.code === "22023") return jsonError(400, "invalid_report_range");
    if (error.code === "54000") return jsonError(413, "report_range_too_large");
    return jsonError(500, "report_data_unavailable");
  }
  try {
    const bytes = await renderFinanceDateRangePdf(data);
    if (!isValidPdfBytes(bytes)) return jsonError(413, "report_pdf_too_large");
    return new Response(bytes as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="masjid-e-mamoor-2-finance-${input.start_date}-to-${input.end_date}.pdf"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch { return jsonError(500, "report_render_failed"); }
});
