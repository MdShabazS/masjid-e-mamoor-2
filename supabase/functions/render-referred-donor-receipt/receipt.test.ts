import { PDFDocument } from "npm:pdf-lib@1.17.1";
import { renderVerifiedDonationReceipt, type VerifiedContribution } from "./receipt.ts";

const verified: VerifiedContribution = {
  donor_name: "Ahmed", amount_paise: 100000, payment_method: "upi",
  business_date: "2026-10-14", receipt_number: "MEM2-2026-00000001",
  donation_date: "2026-10-14", purpose: "General donation",
  reviewed_at: "2026-10-14T10:00:00Z", status: "verified",
  posted_transaction_id: "d3000000-0000-0000-0000-000000000001",
};

Deno.test("verified contributions produce an A4 PDF receipt", async () => {
  const bytes = await renderVerifiedDonationReceipt(verified);
  if (new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-") throw new Error("missing PDF signature");
  const pdf = await PDFDocument.load(bytes);
  if (pdf.getPages().length !== 1 || pdf.getPage(0).getWidth() < 595) {
    throw new Error("invalid receipt page");
  }
});

Deno.test("pending contributions cannot receive a receipt", async () => {
  try {
    await renderVerifiedDonationReceipt({ ...verified, status: "submitted" });
  } catch { return; }
  throw new Error("pending receipt accepted");
});
