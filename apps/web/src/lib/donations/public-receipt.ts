import "server-only";

import { createHmac } from "node:crypto";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

const receiptPattern = /^MEM2-\d{4}-\d{8,}$/;

export interface PublicDonationReceipt {
  receiptNumber: string;
  donorName: string;
  amountPaise: number;
  donationDate: string;
  paymentMethod: string;
  purpose: string;
  verifiedAt: string;
}

export function normalizeReceiptNumber(value: string): string | null {
  const normalized = value.trim().toUpperCase();
  return normalized.length <= 40 && receiptPattern.test(normalized) ? normalized : null;
}

export async function findVerifiedPublicReceipt(
  input: string,
): Promise<PublicDonationReceipt | null> {
  const receiptNumber = normalizeReceiptNumber(input);
  if (!receiptNumber) return null;

  // The service key remains on the server. Return a fixed public projection,
  // never the optional donor phone, member identities, or internal audit data.
  const admin = createAdminClient();
  const requestHeaders = await headers();
  const network = ["x-vercel-forwarded-for", "x-forwarded-for", "x-real-ip", "cf-connecting-ip"]
    .map((name) => requestHeaders.get(name)?.split(",")[0]?.trim())
    .find(Boolean)?.slice(0, 120) ?? "unknown";
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("receipt_lookup_unavailable");
  const digest = (value: string) => createHmac("sha256", secret).update(value).digest("hex");
  const { data: limit, error: limitError } = await admin.rpc("consume_public_receipt_lookup", {
    p_subject_hash: digest(`receipt-lookup-network:${network}`),
    p_receipt_hash: digest(`receipt-lookup-number:${receiptNumber}`),
  });
  const decision = Array.isArray(limit) ? limit[0] : limit;
  if (limitError || !decision || typeof decision.allowed !== "boolean")
    throw new Error("receipt_lookup_unavailable");
  if (!decision.allowed) throw new Error("receipt_lookup_limited");
  const { data, error } = await admin.from("referred_donor_contributions")
    .select("receipt_number,donor_name,amount_paise,donation_date,payment_method,purpose,reviewed_at,posted_transaction_id")
    .eq("receipt_number", receiptNumber)
    .eq("status", "verified")
    .maybeSingle();

  if (error) throw new Error("receipt_lookup_unavailable");
  if (!data || !data.posted_transaction_id || !data.reviewed_at) return null;
  return {
    receiptNumber: String(data.receipt_number), donorName: String(data.donor_name),
    amountPaise: Number(data.amount_paise), donationDate: String(data.donation_date),
    paymentMethod: String(data.payment_method), purpose: String(data.purpose),
    verifiedAt: String(data.reviewed_at),
  };
}
