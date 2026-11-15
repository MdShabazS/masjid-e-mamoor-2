import { createClient } from "npm:@supabase/supabase-js@2.116.0";

type Delivery = {
  delivery_id: string;
  notification_id: string;
  expo_push_token: string;
  title: string;
  body: string;
  target_path: string;
};

type Receipt = { delivery_id: string; expo_ticket_id: string };

const EXPO_SEND_URL = "https://exp.host/--/api/v2/push/send";
const EXPO_RECEIPTS_URL = "https://exp.host/--/api/v2/push/getReceipts";

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function equalSecret(left: string, right: string) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

function expoHeaders(accessToken: string | undefined) {
  return {
    "Content-Type": "application/json",
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
  };
}

async function readJson(response: Response): Promise<Record<string, unknown> | null> {
  try {
    const value: unknown = await response.json();
    return value !== null && typeof value === "object" && !Array.isArray(value)
      ? value as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

function transportError(status?: number) {
  if (status === 429) return "TOO_MANY_REQUESTS";
  if (status !== undefined && status >= 500) return "ServerError";
  if (status === undefined) return "NetworkError";
  return "InvalidRequest";
}

async function recordTicket(
  supabase: ReturnType<typeof createClient>,
  deliveryId: string,
  status: string,
  ticketId: string | null,
  errorCode: string | null,
) {
  const { error } = await supabase.rpc("record_notification_push_ticket", {
    p_delivery_id: deliveryId,
    p_ticket_status: status,
    p_ticket_id: ticketId,
    p_error_code: errorCode,
  });
  if (error) throw new Error("ticket_result_record_failed");
}

async function sendClaimed(supabase: ReturnType<typeof createClient>, deliveries: Delivery[]) {
  for (let offset = 0; offset < deliveries.length; offset += 100) {
    const batch = deliveries.slice(offset, offset + 100);
    let response: Response;
    try {
      response = await fetch(EXPO_SEND_URL, {
        method: "POST",
        headers: expoHeaders(Deno.env.get("EXPO_PUSH_ACCESS_TOKEN")),
        body: JSON.stringify(batch.map((delivery) => ({
          to: delivery.expo_push_token,
          title: "Masjid E Mamoor 2",
          body: "You have a new update.",
          data: { target_path: delivery.target_path },
          priority: "high",
          sound: "default",
        }))),
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      for (const delivery of batch) {
        await recordTicket(supabase, delivery.delivery_id, "error", null, "NetworkError");
      }
      continue;
    }

    const payload = await readJson(response);
    const tickets = Array.isArray(payload?.data) ? payload.data : [];
    if (!response.ok || tickets.length !== batch.length) {
      const code = transportError(response.status);
      for (const delivery of batch) {
        await recordTicket(supabase, delivery.delivery_id, "error", null, code);
      }
      continue;
    }

    for (let index = 0; index < batch.length; index += 1) {
      const ticket = tickets[index] as Record<string, unknown> | undefined;
      const details = ticket?.details as Record<string, unknown> | undefined;
      await recordTicket(
        supabase,
        batch[index].delivery_id,
        ticket?.status === "ok" ? "ok" : "error",
        typeof ticket?.id === "string" ? ticket.id : null,
        typeof details?.error === "string" ? details.error : "InvalidRequest",
      );
    }
  }
}

async function recordReceipt(
  supabase: ReturnType<typeof createClient>,
  deliveryId: string,
  status: string,
  errorCode: string | null,
) {
  const { error } = await supabase.rpc("record_notification_push_receipt", {
    p_delivery_id: deliveryId,
    p_receipt_status: status,
    p_error_code: errorCode,
  });
  if (error) throw new Error("receipt_result_record_failed");
}

async function checkReceipts(supabase: ReturnType<typeof createClient>) {
  const { data, error } = await supabase.rpc("claim_notification_push_receipts", {
    p_limit: 100,
  });
  if (error) throw new Error("receipt_claim_failed");
  const receipts = (data ?? []) as Receipt[];
  if (receipts.length === 0) return;

  let response: Response;
  try {
    response = await fetch(EXPO_RECEIPTS_URL, {
      method: "POST",
      headers: expoHeaders(Deno.env.get("EXPO_PUSH_ACCESS_TOKEN")),
      body: JSON.stringify({ ids: receipts.map((receipt) => receipt.expo_ticket_id) }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    for (const receipt of receipts) {
      await recordReceipt(supabase, receipt.delivery_id, "error", "NetworkError");
    }
    return;
  }

  const payload = await readJson(response);
  const receiptMap = payload?.data as Record<string, unknown> | undefined;
  if (!response.ok || !receiptMap) {
    const code = transportError(response.status);
    for (const receipt of receipts) {
      await recordReceipt(supabase, receipt.delivery_id, "error", code);
    }
    return;
  }

  for (const receipt of receipts) {
    const result = receiptMap[receipt.expo_ticket_id] as Record<string, unknown> | undefined;
    if (!result) {
      await recordReceipt(supabase, receipt.delivery_id, "pending", null);
      continue;
    }
    const details = result.details as Record<string, unknown> | undefined;
    await recordReceipt(
      supabase,
      receipt.delivery_id,
      result.status === "ok" ? "ok" : "error",
      typeof details?.error === "string" ? details.error : "ReceiptError",
    );
  }
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const expectedSecret = Deno.env.get("NOTIFICATION_PUSH_DISPATCH_SECRET") ?? "";
  const providedSecret = request.headers.get("x-notification-push-secret") ?? "";
  if (expectedSecret.length < 32 || !equalSecret(expectedSecret, providedSecret)) {
    return json({ error: "not_authorized" }, 401);
  }

  const url = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceRoleKey) return json({ error: "service_unavailable" }, 503);

  const supabase = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  try {
    const { data, error } = await supabase.rpc("claim_notification_push_batch", {
      p_limit: 100,
    });
    if (error) throw new Error("push_claim_failed");
    const deliveries = (data ?? []) as Delivery[];
    await sendClaimed(supabase, deliveries);
    await checkReceipts(supabase);
    return json({ processed: deliveries.length });
  } catch {
    return json({ error: "dispatch_failed" }, 503);
  }
});
