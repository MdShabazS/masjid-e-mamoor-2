import { PDFDocument, StandardFonts, rgb } from "npm:pdf-lib@1.17.1";

export interface VerifiedContribution {
  donor_name: string;
  amount_paise: number | string;
  payment_method: string;
  business_date: string;
  donation_date: string;
  purpose: string;
  receipt_number: string;
  reviewed_at: string;
  status: string;
  posted_transaction_id: string;
}

function printable(value: string) {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7e\xa0-\xff]/g, "?").slice(0, 160);
}

export async function renderVerifiedDonationReceipt(record: VerifiedContribution): Promise<Uint8Array> {
  if (record.status !== "verified" || !record.posted_transaction_id ||
      !/^MEM2-\d{4}-\d{8,}$/.test(record.receipt_number) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(record.business_date) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(record.donation_date) || !record.purpose?.trim() ||
      !["cash", "upi", "bank_transfer"].includes(record.payment_method) ||
      !Number.isSafeInteger(Number(record.amount_paise)) || Number(record.amount_paise) <= 0 ||
      !record.donor_name?.trim()) {
    throw new Error("Unverified or invalid donation receipt");
  }
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Masjid E Mamoor 2 donation receipt ${record.receipt_number}`);
  pdf.setAuthor("Masjid E Mamoor 2");
  const page = pdf.addPage([595.28, 841.89]);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const green = rgb(0.055, 0.275, 0.22);
  page.drawRectangle({ x: 0, y: 742, width: 595.28, height: 100, color: green });
  page.drawText("MASJID E MAMOOR 2", { x: 42, y: 794, size: 20, font: bold, color: rgb(1, 1, 1) });
  page.drawText("DONATION RECEIPT", { x: 42, y: 765, size: 12, font: regular, color: rgb(1, 1, 1) });
  page.drawText("Receipt number", { x: 42, y: 694, size: 10, font: regular });
  page.drawText(record.receipt_number, { x: 42, y: 670, size: 16, font: bold, color: green });
  page.drawLine({ start: { x: 42, y: 643 }, end: { x: 553, y: 643 }, thickness: 0.8, color: rgb(.8, .85, .82) });
  const details = [
    ["Donor", printable(record.donor_name)],
    ["Amount received", `INR ${(Number(record.amount_paise) / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`],
    ["Payment method", record.payment_method.replaceAll("_", " ").toUpperCase()],
    ["Donation date", record.donation_date],
    ["Purpose", printable(record.purpose)],
    ["Verified on", new Date(record.reviewed_at).toISOString().slice(0, 10)],
  ];
  let y = 608;
  for (const [label, value] of details) {
    page.drawText(label, { x: 42, y, size: 10, font: regular, color: rgb(.36, .41, .39) });
    page.drawText(value, { x: 42, y: y - 23, size: 13, font: bold, color: green, maxWidth: 510 });
    y -= 65;
  }
  page.drawText("This receipt records a verified donation posted to the masjid's finance ledger.", {
    x: 42, y: 151, size: 10, font: regular, color: rgb(.36, .41, .39), maxWidth: 510,
  });
  page.drawText("It does not certify eligibility for any tax deduction.", {
    x: 42, y: 132, size: 10, font: regular, color: rgb(.36, .41, .39),
  });
  page.drawLine({ start: { x: 42, y: 94 }, end: { x: 553, y: 94 }, thickness: 0.8, color: rgb(.8, .85, .82) });
  page.drawText("Masjid E Mamoor 2 | Verified contribution", { x: 42, y: 76, size: 9, font: regular, color: green });
  return pdf.save();
}
