import {
  formatInrPaise,
  isValidPdfBytes,
  needsPageBreak,
  renderFinanceMonthlyReportPdf,
  sha256Hex,
  validateReportMonth,
  wrapTextByWidth,
} from "./pdf.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function assertEquals<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${expected}, received ${actual}`);
  }
}

function assertBytesEqual(
  actual: Uint8Array,
  expected: Uint8Array,
  message: string,
): void {
  assertEquals(actual.length, expected.length, `${message} length`);
  for (let index = 0; index < actual.length; index += 1) {
    if (actual[index] !== expected[index]) {
      throw new Error(`${message}: mismatch at byte ${index}`);
    }
  }
}

const metadata = {
  reportMonth: "2042-07-01",
  revision: 3,
  snapshotSha256: "a".repeat(64),
  generationSource: "manual",
  storageObjectPath: "2042/07/masjid-e-mamoor-finance-2042-07-v3.pdf",
};

const emptySnapshot = {
  schema_version: 1,
  currency: "INR",
  report_month: "2042-07-01",
  period_start: "2042-07-01",
  period_end: "2042-07-31",
  summary: {
    opening_balance_paise: 0,
    donation_inflow_paise: 0,
    expense_outflow_paise: 0,
    adjustments_net_paise: 0,
    transfer_in_paise: 0,
    transfer_out_paise: 0,
    closing_balance_paise: 0,
    transaction_count: 0,
  },
  donation_breakdown: {
    recurring_paise: 0,
    additional_paise: 0,
    anonymous_paise: 0,
    jummah_paise: 0,
  },
  closing_by_account_type: {
    cash_paise: 0,
    bank_paise: 0,
    upi_paise: 0,
    other_paise: 0,
  },
  accounts: [],
  donations: [],
  expenses: [],
  transfers: [],
  adjustments: [],
  outstanding_obligations: {
    as_of_date: "2042-07-31",
    total_outstanding_paise: 0,
    outstanding_obligation_count: 0,
    obligations: [],
  },
  workflow: {
    expenses: { submitted: 0, rejected: 0 },
    transfers: { submitted: 0, rejected: 0 },
    adjustments: { submitted: 0, rejected: 0 },
  },
  ledger: [],
};

Deno.test("validates exact report month values", () => {
  assert(validateReportMonth("2026-10-01"), "valid month rejected");
  assert(!validateReportMonth("2026-10-02"), "non-month-start accepted");
  assert(!validateReportMonth("2026-13-01"), "invalid month accepted");
  assert(!validateReportMonth("0000-01-01"), "year zero accepted");
  assert(!validateReportMonth(20261001), "non-string month accepted");
});

Deno.test("formats paise using Indian grouping and rupee symbol", () => {
  assertEquals(formatInrPaise(12_345_678), "₹1,23,456.78", "positive INR");
  assertEquals(formatInrPaise(5), "₹0.05", "sub-rupee INR");
  assertEquals(formatInrPaise(0), "₹0.00", "zero INR");
});

Deno.test("formats negative paise without losing the sign", () => {
  assertEquals(formatInrPaise(-12_345), "-₹123.45", "negative INR");
});

Deno.test("wraps words within a measured width", () => {
  const lines = wrapTextByWidth(
    "Monthly finance reports remain readable across pages",
    18,
    (value) => value.length,
  );
  assert(lines.length > 1, "text did not wrap");
  assert(lines.every((line) => line.length <= 18), "line exceeded width");
});

Deno.test("splits an unbroken long token", () => {
  const lines = wrapTextByWidth(
    "0123456789abcdef",
    5,
    (value) => value.length,
  );
  assertEquals(lines.join(""), "0123456789abcdef", "token content changed");
  assert(lines.every((line) => line.length <= 5), "token piece exceeded width");
});

Deno.test("detects page boundaries", () => {
  assert(needsPageBreak(80, 25, 60), "page break was missed");
  assert(!needsPageBreak(100, 25, 60), "unnecessary page break requested");
});

Deno.test("computes lowercase SHA-256 hex", async () => {
  const hash = await sha256Hex(new TextEncoder().encode("abc"));
  assertEquals(
    hash,
    "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    "SHA-256 mismatch",
  );
});

Deno.test("validates basic PDF magic and size", () => {
  assert(
    isValidPdfBytes(new TextEncoder().encode("%PDF-1.7")),
    "valid PDF magic rejected",
  );
  assert(!isValidPdfBytes(new Uint8Array()), "empty PDF accepted");
  assert(
    !isValidPdfBytes(new TextEncoder().encode("not-pdf")),
    "invalid PDF magic accepted",
  );
});

Deno.test("renders all empty snapshot sections cleanly", async () => {
  const bytes = await renderFinanceMonthlyReportPdf(emptySnapshot, metadata);
  assert(isValidPdfBytes(bytes), "empty-state report is not a valid PDF");
  assert(bytes.length > 1_000, "empty-state report is unexpectedly small");
});

Deno.test("renders a representative multi-page immutable snapshot", async () => {
  const ledger = Array.from({ length: 75 }, (_, index) => ({
    id: `00000000-0000-0000-0000-${String(index).padStart(12, "0")}`,
    account_name: index % 2 === 0 ? "General Bank" : "Masjid Cash",
    transaction_category: index % 2 === 0 ? "DONATION_RECURRING" : "EXPENSE",
    direction: index % 2 === 0 ? "inflow" : "outflow",
    amount_paise: 125_050 + index,
    business_date: `2042-07-${String((index % 28) + 1).padStart(2, "0")}`,
    reference_type: "synthetic_test_reference",
    reference_id: `reference-${index}`,
  }));

  const snapshot = {
    ...emptySnapshot,
    summary: {
      opening_balance_paise: 1_000_000,
      donation_inflow_paise: 750_000,
      expense_outflow_paise: 250_000,
      adjustments_net_paise: -5_000,
      transfer_in_paise: 100_000,
      transfer_out_paise: 100_000,
      closing_balance_paise: 1_495_000,
      transaction_count: ledger.length,
    },
    donation_breakdown: {
      recurring_paise: 500_000,
      additional_paise: 100_000,
      anonymous_paise: 50_000,
      jummah_paise: 100_000,
    },
    closing_by_account_type: {
      cash_paise: 195_000,
      bank_paise: 1_000_000,
      upi_paise: 300_000,
      other_paise: 0,
    },
    accounts: [{
      name: "General Bank",
      account_type: "bank",
      opening_balance_paise: 900_000,
      month_inflow_paise: 350_000,
      month_outflow_paise: 250_000,
      closing_balance_paise: 1_000_000,
    }],
    donations: [{
      business_date: "2042-07-04",
      category: "DONATION_ADDITIONAL",
      member_name: null,
      account_name: "General Bank",
      amount_paise: 100_000,
    }],
    expenses: [{
      business_date: "2042-07-10",
      description:
        "A deliberately long maintenance description that verifies table wrapping without overlapping adjacent rows or page content",
      payee: "Facilities Vendor",
      account_name: "General Bank",
      amount_paise: 250_000,
    }],
    transfers: [{
      business_date: "2042-07-12",
      source_account_name: "General Bank",
      destination_account_name: "Masjid Cash",
      reason: "Approved operating cash movement",
      amount_paise: 100_000,
    }],
    adjustments: [{
      business_date: "2042-07-15",
      adjustment_type: "correction",
      reason: "Correct posted account attribution",
      target_transaction_id: ledger[0].id,
      correction_direction: "outflow",
      correction_amount_paise: 5_000,
    }],
    outstanding_obligations: {
      as_of_date: "2042-07-31",
      total_outstanding_paise: 75_000,
      outstanding_obligation_count: 1,
      obligations: [{
        member_name: "Community Member",
        effective_month: "2042-07-01",
        authoritative_amount_paise: 100_000,
        allocated_amount_paise: 25_000,
        waived_amount_paise: 0,
        outstanding_amount_paise: 75_000,
      }],
    },
    workflow: {
      expenses: { submitted: 2, rejected: 1 },
      transfers: { submitted: 1, rejected: 0 },
      adjustments: { submitted: 0, rejected: 1 },
    },
    ledger,
  };

  const bytes = await renderFinanceMonthlyReportPdf(snapshot, metadata);
  assert(isValidPdfBytes(bytes), "representative report is not a valid PDF");
  assert(bytes.length < 20 * 1024 * 1024, "representative report is oversized");
});

Deno.test("rendering identical immutable input is byte deterministic", async () => {
  const first = await renderFinanceMonthlyReportPdf(emptySnapshot, metadata);
  const second = await renderFinanceMonthlyReportPdf(emptySnapshot, metadata);
  assertBytesEqual(first, second, "deterministic PDF bytes");
  assertEquals(
    await sha256Hex(first),
    await sha256Hex(second),
    "deterministic PDF hash",
  );
});
