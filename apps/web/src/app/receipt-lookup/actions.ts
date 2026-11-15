"use server";

import { findVerifiedPublicReceipt, normalizeReceiptNumber,
  type PublicDonationReceipt } from "@/lib/donations/public-receipt";

export type ReceiptLookupState = {
  receipt: PublicDonationReceipt | null;
  message: string | null;
};

export async function lookupVerifiedReceipt(
  _previous: ReceiptLookupState,
  form: FormData,
): Promise<ReceiptLookupState> {
  const raw = form.get("receiptNumber");
  if (typeof raw !== "string" || !normalizeReceiptNumber(raw)) {
    return { receipt: null, message: "Enter a valid receipt number." };
  }
  try {
    const receipt = await findVerifiedPublicReceipt(raw);
    return receipt
      ? { receipt, message: null }
      : { receipt: null, message: "No verified receipt matches that number." };
  } catch (error) {
    return { receipt: null, message: error instanceof Error && error.message === "receipt_lookup_limited"
      ? "Too many lookups. Please wait five minutes and try again."
      : "Receipt lookup is unavailable. Please try again." };
  }
}
