import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  additionalDonationCreateSchema,
  donationMonthInputSchema,
  donationObligationGenerationSchema,
  donationObligationRuleCreateSchema,
  donationObligationWaiverSchema,
  donationPaymentRejectSchema,
  donationPaymentSubmitSchema,
} from "@masjid-e-mamoor/validation";

const repoFile = (path: string) =>
  resolve(process.cwd(), "../..", path);

describe("donation validation", () => {
  it("canonicalizes a browser month to the first day", () => {
    expect(donationMonthInputSchema.parse("2026-09")).toBe(
      "2026-09-01",
    );
  });

  it("rejects malformed or impossible month values", () => {
    expect(() =>
      donationMonthInputSchema.parse("2026-00"),
    ).toThrow();

    expect(() =>
      donationMonthInputSchema.parse("2026-13"),
    ).toThrow();

    expect(() =>
      donationMonthInputSchema.parse("2026-9"),
    ).toThrow();

    expect(() =>
      donationMonthInputSchema.parse("2026-09-01"),
    ).toThrow();
  });

  it("enforces the one-rupee minimum for submitted payments", () => {
    expect(
      donationPaymentSubmitSchema.parse({
        amountPaise: 100,
        paymentMethod: "upi",
        operationId: "payment-op-1",
      }),
    ).toMatchObject({
      amountPaise: 100,
      paymentMethod: "upi",
    });

    expect(() =>
      donationPaymentSubmitSchema.parse({
        amountPaise: 99,
        paymentMethod: "upi",
        operationId: "payment-op-2",
      }),
    ).toThrow();
  });

  it("allows positive paise values for non-payment donation operations", () => {
    expect(
      additionalDonationCreateSchema.parse({
        amountPaise: 1,
        operationId: "additional-op-1",
      }).amountPaise,
    ).toBe(1);

    expect(
      donationObligationWaiverSchema.parse({
        obligationId:
          "11111111-1111-4111-8111-111111111111",
        waivedAmountPaise: 1,
        reason: "Approved adjustment",
        operationId: "waiver-op-1",
      }).waivedAmountPaise,
    ).toBe(1);
  });

  it("canonicalizes rule and generation month inputs", () => {
    expect(
      donationObligationRuleCreateSchema.parse({
        effectiveFromMonth: "2026-10",
        monthlyAmountPaise: 50000,
        operationId: "rule-op-1",
      }).effectiveFromMonth,
    ).toBe("2026-10-01");

    expect(
      donationObligationGenerationSchema.parse({
        effectiveMonth: "2026-10",
        operationId: "generation-op-1",
      }).effectiveMonth,
    ).toBe("2026-10-01");
  });

  it("requires a rejection reason", () => {
    expect(() =>
      donationPaymentRejectSchema.parse({
        paymentId:
          "11111111-1111-4111-8111-111111111111",
        reason: "   ",
        operationId: "reject-op-1",
      }),
    ).toThrow();
  });
});

describe("donation SQL security boundaries", () => {
  it("keeps direct authenticated financial writes closed", () => {
    const foundation = readFileSync(
      repoFile(
        "supabase/migrations/20260921230000_donation_domain_foundation.sql",
      ),
      "utf8",
    );

    expect(foundation).toMatch(
      /revoke\s+all\s+on\s+table\s+public\.donation_payments\s+from\s+public,\s*anon,\s*authenticated;/i,
    );

    expect(foundation).toMatch(
      /revoke\s+all\s+on\s+table\s+public\.donation_obligations\s+from\s+public,\s*anon,\s*authenticated;/i,
    );

    expect(foundation).toMatch(
      /revoke\s+all\s+on\s+table\s+public\.donation_payment_allocations\s+from\s+public,\s*anon,\s*authenticated;/i,
    );

    expect(foundation).toContain(
      "donation_operation_idempotency",
    );
  });

  it("uses trusted SECURITY DEFINER donation operations", () => {
    const operations = readFileSync(
      repoFile(
        "supabase/migrations/20260921233000_donation_trusted_operations.sql",
      ),
      "utf8",
    );

    expect(operations).toContain(
      "submit_donation_payment",
    );
    expect(operations).toContain(
      "start_donation_payment_review",
    );
    expect(operations).toContain(
      "reject_donation_payment",
    );
    expect(operations).toContain(
      "verify_and_allocate_donation_payment",
    );
    expect(operations).toContain(
      "waive_donation_obligation",
    );
    expect(operations).toContain(
      "create_additional_donation",
    );
    expect(operations).toContain(
      "create_donation_obligation_rule",
    );
    expect(operations).toContain(
      "generate_monthly_donation_obligations",
    );

    expect(operations).toMatch(
      /security\s+definer/i,
    );
    expect(operations).toContain(
      "pg_advisory_xact_lock",
    );
    expect(operations).toContain(
      "operation_id_conflict",
    );
  });

  it("preserves deterministic FIFO allocation", () => {
    const operations = readFileSync(
      repoFile(
        "supabase/migrations/20260921233000_donation_trusted_operations.sql",
      ),
      "utf8",
    );

    expect(operations).toMatch(
      /order by\s+o\.effective_month\s+asc,\s*o\.id\s+asc/i,
    );

    expect(operations).toContain(
      "donation-member-allocation:",
    );
  });

  it("keeps the generator conflict correction append-only", () => {
    const correction = readFileSync(
      repoFile(
        "supabase/migrations/20260921234500_donation_generator_conflict_fix.sql",
      ),
      "utf8",
    );

    expect(correction).toMatch(
      /on conflict on constraint\s+donation_obligations_member_month_uidx\s+do nothing;/i,
    );
  });

  it("does not expose proof upload before protected storage is implemented", () => {
    const donationPage = readFileSync(
      repoFile(
        "apps/web/src/app/donations/page.tsx",
      ),
      "utf8",
    );

    const donationActions = readFileSync(
      repoFile(
        "apps/web/src/app/donations/actions.ts",
      ),
      "utf8",
    );

    expect(donationPage).not.toContain(
      'type="file"',
    );

    expect(donationActions).not.toMatch(
      /\.storage\s*\./,
    );
  });
});
