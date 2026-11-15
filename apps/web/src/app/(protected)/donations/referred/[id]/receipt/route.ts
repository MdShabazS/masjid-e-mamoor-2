import { createClient } from "@/lib/supabase/server";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(id)) {
    return new Response("Invalid donation ID", { status: 400 });
  }
  const client = await createClient();
  const { data: { session }, error } = await client.auth.getSession();
  if (error || !session?.access_token) return new Response("Sign in to download the receipt.", { status: 401 });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return new Response("Receipt service unavailable.", { status: 503 });
  let response: Response;
  try {
    response = await fetch(`${url}/functions/v1/render-referred-donor-receipt`, {
      method: "POST", cache: "no-store",
      headers: { Authorization: `Bearer ${session.access_token}`, apikey: key, "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
  } catch { return new Response("Receipt service unavailable.", { status: 502 }); }
  if (!response.ok || response.headers.get("Content-Type")?.split(";")[0] !== "application/pdf" || !response.body) {
    return new Response("Receipt unavailable or not authorized.", {
      status: response.status === 404 ? 404 : 502, headers: { "Cache-Control": "no-store" },
    });
  }
  const filename = response.headers.get("Content-Disposition")?.match(/^attachment; filename="(MEM2-\d{4}-\d{8,}\.pdf)"$/)?.[1]
    ?? "masjid-e-mamoor-2-donation-receipt.pdf";
  return new Response(response.body, { headers: {
    "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${filename}"`,
    "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff",
  } });
}
