import { createClient } from "npm:@supabase/supabase-js@2.116.0";
import { renderVerifiedDonationReceipt, type VerifiedContribution } from "./receipt.ts";

function fail(status: number, code: string) {
  return Response.json({ code }, { status, headers: { "Cache-Control": "no-store" } });
}

Deno.serve(async request => {
  if (request.method !== "POST") return fail(405, "method_not_allowed");
  const bearer = request.headers.get("Authorization")?.trim() ?? "";
  const token = /^Bearer\s+(\S+)$/i.exec(bearer)?.[1];
  if (!token) return fail(401, "auth_required");
  let body: unknown;
  try { body = await request.json(); } catch { return fail(400, "invalid_request"); }
  const id = (body as { id?: unknown } | null)?.id;
  if (typeof id !== "string" || !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(id)) {
    return fail(400, "invalid_contribution_id");
  }
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !key) return fail(500, "configuration_error");
  const client = createClient(url, key, {
    global: { headers: { Authorization: bearer } },
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
  });
  const { data: user, error: authError } = await client.auth.getUser(token);
  if (authError || !user.user) return fail(401, "auth_failed");
  const { data, error } = await client.from("referred_donor_contributions")
    .select("donor_name,amount_paise,payment_method,business_date,donation_date,purpose,receipt_number,reviewed_at,status,posted_transaction_id")
    .eq("id", id).eq("status", "verified").maybeSingle();
  if (error) return fail(500, "receipt_unavailable");
  if (!data) return fail(404, "receipt_not_found");
  try {
    const bytes = await renderVerifiedDonationReceipt(data as VerifiedContribution);
    if (bytes.length > 1024 * 1024 || bytes.slice(0, 5).some((v, i) => v !== [37, 80, 68, 70, 45][i])) {
      return fail(500, "invalid_pdf");
    }
    return new Response(bytes as BodyInit, { headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${data.receipt_number}.pdf"`,
      "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff",
    } });
  } catch { return fail(500, "receipt_render_failed"); }
});
