import { describe, expect, it } from "vitest";
import { financeDateRangeCsv } from "@masjid-e-mamoor/shared";

const snapshot = {
  schema_version: 1, masjid_name: "Masjid E Mamoor 2", currency: "INR",
  period_start: "2026-10-01", period_end: "2026-10-31",
  summary: { opening_balance_paise: "0", donation_inflow_paise: "125050",
    expense_outflow_paise: "0", adjustments_net_paise: "0", transfer_in_paise: "0",
    transfer_out_paise: "0", closing_balance_paise: "125050", transaction_count: 1 },
  donation_breakdown: { recurring_paise: "0", additional_paise: "125050",
    anonymous_paise: "0", jummah_paise: "0" },
  accounts: [{ name: "Masjid Cash", account_type: "cash", status: "active",
    opening_balance_paise: "0", closing_balance_paise: "125050" }],
  ledger: [{ id: "entry-id", business_date: "2026-10-14", account_name: "Masjid Cash",
    transaction_category: "DONATION_ADDITIONAL", direction: "inflow", amount_paise: "125050",
    donor_name: "=HYPERLINK(\"bad\")", donation_purpose: "Building,\nrepair",
    donation_payment_method: "upi", receipt_number: "MEM2-2026-00000001",
    donation_status: "verified", reference_type: "referred_donor_contribution",
    reference_id: "donation-id", related_transaction_id: null }],
};

describe("Finance spreadsheet export", () => {
  it("includes exact rupees, a complete ledger and fixed-width CSV rows without formula injection", () => {
    const csv = financeDateRangeCsv(snapshot);
    const lines = csv.replace(/^\uFEFF/, "").trim().split("\r\n");
    expect(lines.every((line) => (line.match(/"(?:[^"]|"")*"/g) ?? []).length === 18)).toBe(true);
    expect(csv).toContain('"1,250.50"'.replace(",", ""));
    expect(csv).toContain('"\'=HYPERLINK(""bad"")"');
    expect(csv).toContain('"Building, repair"');
    expect(csv).toContain('"MEM2-2026-00000001"');
    expect(csv).toContain('"entry-id"');
  });

  it("rejects a mismatched ledger count and malformed monetary input", () => {
    expect(() => financeDateRangeCsv({ ...snapshot, summary: { ...snapshot.summary, transaction_count: 2 } })).toThrow();
    expect(() => financeDateRangeCsv({ ...snapshot, ledger: [{ ...snapshot.ledger[0], amount_paise: "=1+1" }] })).toThrow();
    expect(() => financeDateRangeCsv({ ...snapshot, ledger: [{ ...snapshot.ledger[0], amount_paise: null }] })).toThrow();
  });

  it("preserves large paise values exactly without floating point rounding", () => {
    const csv = financeDateRangeCsv({
      ...snapshot,
      summary: { ...snapshot.summary, donation_inflow_paise: "9007199254740993" },
      ledger: [{ ...snapshot.ledger[0], amount_paise: "9007199254740993" }],
    });
    expect(csv.match(/"90071992547409\.93"/g)).toHaveLength(2);
  });
});
