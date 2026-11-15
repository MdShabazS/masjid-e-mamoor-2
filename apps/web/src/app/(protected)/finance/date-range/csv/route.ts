import { financeCsvResponse } from "@/lib/finance/csv-response";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  return financeCsvResponse(params.get("start") ?? "", params.get("end") ?? "");
}
