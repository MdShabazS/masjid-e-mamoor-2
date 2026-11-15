import { financeCsvResponse } from "@/lib/finance/csv-response";

export async function GET(request: Request) {
  const month = new URL(request.url).searchParams.get("month") ?? "";
  if (!/^(?:20\d{2})-(?:0[1-9]|1[0-2])$/.test(month))
    return new Response("Select a valid report month.", { status: 400 });
  const [year, monthNumber] = month.split("-").map(Number);
  const end = new Date(Date.UTC(year, monthNumber, 0)).toISOString().slice(0, 10);
  return financeCsvResponse(`${month}-01`, end);
}
