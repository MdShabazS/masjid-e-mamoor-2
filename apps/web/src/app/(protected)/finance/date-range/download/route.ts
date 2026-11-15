import { isValidFinanceReportRange } from "@/lib/finance/date-range";
import { getFinanceMonthlyReportCapabilities } from "@/lib/finance/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const start = url.searchParams.get("start") ?? "";
  const end = url.searchParams.get("end") ?? "";
  if (!isValidFinanceReportRange(start, end)) {
    return new Response("Select a valid date range of at most 366 days.", { status: 400 });
  }
  const capabilities = await getFinanceMonthlyReportCapabilities();
  if (!capabilities.canRead) return new Response("Not authorized", { status: 403 });
  const supabase = await createClient();
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error || !session?.access_token) return new Response("Sign in to download this report.", { status: 401 });
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !key) return new Response("Report service is not configured.", { status: 503 });
  let result: Response;
  try {
    result = await fetch(`${supabaseUrl}/functions/v1/render-finance-date-range`, {
      method: "POST", cache: "no-store", headers: {
        Authorization: `Bearer ${session.access_token}`, apikey: key,
        "Content-Type": "application/json",
      }, body: JSON.stringify({ start_date: start, end_date: end }),
    });
  } catch { return new Response("Report service is unavailable.", { status: 502 }); }
  if (!result.ok || result.headers.get("Content-Type")?.split(";")[0] !== "application/pdf" || !result.body) {
    return new Response("The report could not be generated. Check the date range or try again.", {
      status: result.status === 400 ? 400 : 502, headers: { "Cache-Control": "no-store" },
    });
  }
  return new Response(result.body, { status: 200, headers: {
    "Content-Type": "application/pdf",
    "Content-Disposition": `attachment; filename="masjid-e-mamoor-2-finance-${start}-to-${end}.pdf"`,
    "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff",
  } });
}
