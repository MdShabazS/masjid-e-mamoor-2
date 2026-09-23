import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  additionalDonationCreateSchema,
  anonymousDonationCreateSchema,
  donationMonthInputSchema,
  donationObligationGenerationSchema,
  donationObligationRuleCreateSchema,
  donationObligationWaiverSchema,
  donationPaymentRejectSchema,
  donationPaymentSubmitSchema,
  jummahCashDonationCreateSchema,
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
      anonymousDonationCreateSchema.parse({
        amountPaise: 1,
        operationId: "anonymous-op-1",
      }).amountPaise,
    ).toBe(1);

    expect(
      jummahCashDonationCreateSchema.parse({
        amountPaise: 1,
        operationId: "jummah-op-1",
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

  it("rejects invalid anonymous donation payloads", () => {
    expect(() =>
      anonymousDonationCreateSchema.parse({
        amountPaise: 0,
        operationId: "anonymous-op-2",
      }),
    ).toThrow();

    expect(() =>
      anonymousDonationCreateSchema.parse({
        amountPaise: -1,
        operationId: "anonymous-op-3",
      }),
    ).toThrow();

    expect(() =>
      anonymousDonationCreateSchema.parse({
        amountPaise: 1,
        operationId: "",
      }),
    ).toThrow();
  });

  it("rejects invalid Jummah cash donation payloads", () => {
    expect(() =>
      jummahCashDonationCreateSchema.parse({
        amountPaise: 0,
        operationId: "jummah-op-2",
      }),
    ).toThrow();

    expect(() =>
      jummahCashDonationCreateSchema.parse({
        amountPaise: -1,
        operationId: "jummah-op-3",
      }),
    ).toThrow();

    expect(() =>
      jummahCashDonationCreateSchema.parse({
        amountPaise: 1,
        operationId: "",
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

  it("uses protected private storage for donation payment proofs", () => {
    const storageFoundation = readFileSync(
      repoFile(
        "supabase/migrations/20260921235500_donation_payment_proof_storage.sql",
      ),
      "utf8",
    );

    const storageHardening = readFileSync(
      repoFile(
        "supabase/migrations/20260922000500_donation_payment_proof_storage_hardening.sql",
      ),
      "utf8",
    );

    const donationPage = readFileSync(
      resolve(
        process.cwd(),
        "src/app/donations/page.tsx",
      ),
      "utf8",
    );

    const donationActions = readFileSync(
      resolve(
        process.cwd(),
        "src/app/donations/actions.ts",
      ),
      "utf8",
    );

    expect(storageFoundation).toContain(
      "'donation-payment-proofs'",
    );

    expect(storageFoundation).toMatch(
      /'donation-payment-proofs'[\s\S]*?false[\s\S]*?5242880/,
    );

    expect(storageFoundation).toContain(
      "donation_payment_proofs_storage_insert",
    );

    expect(storageFoundation).toContain(
      "donation_payment_proofs_storage_select",
    );

    expect(storageFoundation).not.toMatch(
      /donation_payment_proofs_storage_[\w]*update/i,
    );

    expect(storageFoundation).not.toMatch(
      /donation_payment_proofs_storage_[\w]*delete/i,
    );

    expect(storageHardening).toContain(
      "so.owner_id = auth.uid()::text",
    );

    expect(storageHardening).toContain(
      "register_donation_payment_proof",
    );

    expect(donationActions).toContain(
      ".from(DONATION_PROOF_BUCKET)",
    );

    expect(donationActions).toContain(
      '"register_donation_payment_proof"',
    );

    expect(donationActions).toContain(
      "upsert: false",
    );

    expect(donationPage).toContain(
      'type="file"',
    );

    expect(donationPage).toContain(
      'accept="image/jpeg,image/png,application/pdf"',
    );

    expect(donationPage).toContain(
      '"donations.payments.proof_upload"',
    );

    expect(donationPage).toContain(
      "ownMemberProfile?.id",
    );

    expect(donationActions).toContain(
      'createHash("sha256")',
    );

    expect(donationActions).toContain(
      "validateDonationProofBytes",
    );

    expect(donationActions).toContain(
      "proof_registration_pending",
    );

    const nextConfig = readFileSync(
      resolve(
        process.cwd(),
        "next.config.ts",
      ),
      "utf8",
    );

    expect(nextConfig).toContain(
      'bodySizeLimit: "6mb"',
    );
  });

  it("adds private proof viewing without changing storage or RLS boundaries", () => {
    const migrationFiles = readdirSync(
      repoFile("supabase/migrations"),
    );

    const server = readFileSync(
      resolve(
        process.cwd(),
        "src/lib/donations/server.ts",
      ),
      "utf8",
    );
    const route = readFileSync(
      resolve(
        process.cwd(),
        "src/app/donations/proofs/[proofId]/route.ts",
      ),
      "utf8",
    );
    const donationPage = readFileSync(
      resolve(
        process.cwd(),
        "src/app/donations/page.tsx",
      ),
      "utf8",
    );
    const managementPage = readFileSync(
      resolve(
        process.cwd(),
        "src/app/donations/manage/page.tsx",
      ),
      "utf8",
    );
    const donationActions = readFileSync(
      resolve(
        process.cwd(),
        "src/app/donations/actions.ts",
      ),
      "utf8",
    );
    const donationInput = readFileSync(
      resolve(
        process.cwd(),
        "src/lib/donations/input.ts",
      ),
      "utf8",
    );
    const appProofViewingFiles = [
      server,
      route,
      donationPage,
      managementPage,
    ].join("\n");

    expect(
      migrationFiles.filter((file) =>
        /proof.*(view|signed|url)|signed.*proof|private.*proof/i.test(
          file,
        ),
      ),
    ).toEqual([]);

    expect(server).toContain(
      "DonationPaymentProof",
    );
    expect(server).toContain(
      "getDonationPaymentProofs",
    );
    expect(server).toContain(
      "createDonationPaymentProofSignedUrl",
    );
    expect(server).toContain(
      '.from("donation_payment_proofs")',
    );
    expect(server).toContain(
      '.eq("id", proofId)',
    );
    expect(server).toContain(
      ".maybeSingle()",
    );
    expect(server).toContain(
      ".from(proof.storageBucket)",
    );
    expect(server).toContain(
      ".createSignedUrl(proof.storageObjectPath, 60)",
    );
    expect(server).not.toContain(
      "createSignedUrl(storageObjectPath",
    );
    expect(server).not.toContain(
      "createSignedUrl(objectPath",
    );

    expect(route).toContain(
      "createDonationPaymentProofSignedUrl(proofId)",
    );
    expect(route).toContain(
      "NextResponse.redirect",
    );
    expect(route).toContain(
      '"Cache-Control", "no-store"',
    );
    expect(route).toContain(
      "status: 404",
    );
    expect(route).not.toContain(
      "storageBucket",
    );
    expect(route).not.toContain(
      "storageObjectPath",
    );

    expect(donationPage).toContain(
      "getDonationPaymentProofs",
    );
    expect(donationPage).toContain(
      "proofsByPaymentId",
    );
    expect(donationPage).toContain(
      "View proof",
    );
    expect(donationPage).toContain(
      "/donations/proofs/${proof.id}",
    );
    expect(donationPage).toContain(
      "uploadPaymentProof",
    );
    expect(donationPage).toContain(
      'type="file"',
    );
    expect(donationPage).toContain(
      'accept="image/jpeg,image/png,application/pdf"',
    );

    expect(managementPage).toContain(
      "getDonationPaymentProofs",
    );
    expect(managementPage).toContain(
      "proofsByPaymentId",
    );
    expect(managementPage).toContain(
      "View proof",
    );
    expect(managementPage).toContain(
      "No proof attached",
    );
    expect(managementPage).toContain(
      "/donations/proofs/${proof.id}",
    );

    expect(donationActions).toContain(
      ".from(DONATION_PROOF_BUCKET)",
    );
    expect(donationActions).toContain(
      '"register_donation_payment_proof"',
    );
    expect(donationInput).toContain(
      'DONATION_PROOF_BUCKET =\n  "donation-payment-proofs"',
    );

    expect(appProofViewingFiles).not.toContain(
      "getPublicUrl",
    );
    expect(appProofViewingFiles).not.toMatch(
      /service[_-]?role/i,
    );
    expect(appProofViewingFiles).not.toMatch(
      /create\s+policy|alter\s+policy|drop\s+policy|storage\.objects/i,
    );
  });

  it("adds anonymous donation creation without broadening direct writes", () => {
    const migration = readFileSync(
      repoFile(
        "supabase/migrations/20260922141324_anonymous_donation_v1.sql",
      ),
      "utf8",
    );

    expect(migration).toContain(
      "create_anonymous_donation",
    );
    expect(migration).toMatch(
      /create or replace function public\.create_anonymous_donation[\s\S]*?security definer/i,
    );
    expect(migration).toContain(
      "'donations.anonymous.create'",
    );
    expect(migration).toContain(
      "'anonymous_donation_create'",
    );
    expect(migration).toContain(
      "'additional_donation_create'",
    );
    expect(migration).toContain(
      "'payment_reject'",
    );
    expect(migration).toContain(
      "pg_advisory_xact_lock",
    );
    expect(migration).toContain(
      "operation_id_conflict",
    );
    expect(migration).toContain(
      "target_member_profile_id is not null",
    );
    expect(migration).toContain(
      "additional_donation_id",
    );
    expect(migration).toMatch(
      /member_profile_id,\s+source_payment_id,\s+donation_kind,[\s\S]*?values\s*\(\s*null,\s*null,\s*'anonymous'/i,
    );
    expect(migration).not.toContain(
      "active_member_profile_required",
    );
    expect(migration).toMatch(
      /revoke all on function public\.create_anonymous_donation\(\s*bigint,\s*text\s*\)\s*from public,\s*anon,\s*authenticated;/i,
    );
    expect(migration).toMatch(
      /grant execute on function public\.create_anonymous_donation\(\s*bigint,\s*text\s*\)\s*to authenticated;/i,
    );
    expect(migration).not.toMatch(
      /grant\s+(insert|update|delete|all)\s+on\s+table\s+public\.additional_donations\s+to\s+authenticated/i,
    );
  });

  it("wires anonymous donations through the trusted RPC and capability gate", () => {
    const server = readFileSync(
      resolve(
        process.cwd(),
        "src/lib/donations/server.ts",
      ),
      "utf8",
    );
    const actions = readFileSync(
      resolve(
        process.cwd(),
        "src/app/donations/actions.ts",
      ),
      "utf8",
    );
    const managementPage = readFileSync(
      resolve(
        process.cwd(),
        "src/app/donations/manage/page.tsx",
      ),
      "utf8",
    );

    expect(server).toContain(
      "createAnonymousDonation",
    );
    expect(server).toContain(
      '"create_anonymous_donation"',
    );
    expect(server).toContain(
      "p_amount_paise",
    );
    expect(server).toContain(
      "p_operation_id",
    );
    expect(server).toContain(
      '"donations.anonymous.create"',
    );
    expect(server).toContain(
      "canCreateAnonymousDonation",
    );
    expect(server).toContain(
      "recorded_by_application_user_id",
    );

    expect(actions).toContain(
      "anonymousDonationCreateSchema",
    );
    expect(actions).toContain(
      "recordAnonymousDonation",
    );
    expect(actions).toContain(
      "createAnonymousDonation",
    );
    expect(actions).toContain(
      "/donations/manage?anonymous_created=1",
    );
    expect(actions).toContain(
      "anonymous_donation_failed",
    );

    expect(managementPage).toContain(
      "capabilities.canCreateAnonymousDonation",
    );
    expect(managementPage).toContain(
      "recordAnonymousDonation",
    );
    expect(managementPage).toContain(
      "The donor identity is not stored.",
    );
    expect(managementPage).toContain(
      "Record anonymous donation",
    );
    expect(managementPage).not.toContain(
      'name="donor',
    );
    expect(managementPage).not.toContain(
      'name="member',
    );
  });

  it("adds Jummah cash collection without broadening direct writes", () => {
    const migration = readFileSync(
      repoFile(
        "supabase/migrations/20260922144930_jummah_cash_v1.sql",
      ),
      "utf8",
    );

    expect(migration).toContain(
      "create_jummah_cash_donation",
    );
    expect(migration).toMatch(
      /create or replace function public\.create_jummah_cash_donation[\s\S]*?security definer/i,
    );
    expect(migration).toMatch(
      /set search_path = public,\s*extensions/i,
    );
    expect(migration).toContain(
      "'donations.jummah.create'",
    );
    expect(migration).toContain(
      "'jummah_cash_create'",
    );
    expect(migration).toContain(
      "'anonymous_donation_create'",
    );
    expect(migration).toContain(
      "'additional_donation_create'",
    );
    expect(migration).toContain(
      "'payment_reject'",
    );
    expect(migration).toContain(
      "pg_advisory_xact_lock",
    );
    expect(migration).toContain(
      "operation_id_conflict",
    );
    expect(migration).toContain(
      "target_member_profile_id is not null",
    );
    expect(migration).toContain(
      "additional_donation_id",
    );
    expect(migration).toMatch(
      /member_profile_id,\s+source_payment_id,\s+donation_kind,[\s\S]*?values\s*\(\s*null,\s*null,\s*'jummah_cash'/i,
    );
    expect(migration).not.toContain(
      "active_member_profile_required",
    );
    expect(migration).toMatch(
      /revoke all on function public\.create_jummah_cash_donation\(\s*bigint,\s*text\s*\)\s*from public,\s*anon,\s*authenticated;/i,
    );
    expect(migration).toMatch(
      /grant execute on function public\.create_jummah_cash_donation\(\s*bigint,\s*text\s*\)\s*to authenticated;/i,
    );
    expect(migration).not.toMatch(
      /grant\s+(insert|update|delete|all)\s+on\s+table\s+public\.additional_donations\s+to\s+authenticated/i,
    );
  });

  it("wires Jummah cash through the trusted RPC and capability gate", () => {
    const server = readFileSync(
      resolve(
        process.cwd(),
        "src/lib/donations/server.ts",
      ),
      "utf8",
    );
    const actions = readFileSync(
      resolve(
        process.cwd(),
        "src/app/donations/actions.ts",
      ),
      "utf8",
    );
    const managementPage = readFileSync(
      resolve(
        process.cwd(),
        "src/app/donations/manage/page.tsx",
      ),
      "utf8",
    );
    const dashboardPage = readFileSync(
      resolve(
        process.cwd(),
        "src/app/dashboard/page.tsx",
      ),
      "utf8",
    );

    expect(server).toContain(
      "createJummahCashDonation",
    );
    expect(server).toContain(
      '"create_jummah_cash_donation"',
    );
    expect(server).toContain(
      "p_amount_paise",
    );
    expect(server).toContain(
      "p_operation_id",
    );
    expect(server).toContain(
      '"donations.jummah.create"',
    );
    expect(server).toContain(
      "canCreateJummahCashDonation",
    );

    expect(actions).toContain(
      "jummahCashDonationCreateSchema",
    );
    expect(actions).toContain(
      "recordJummahCashDonation",
    );
    expect(actions).toContain(
      "createJummahCashDonation",
    );
    expect(actions).toContain(
      "parseRupeesToPaise",
    );
    expect(actions).toContain(
      "/donations/manage?jummah_created=1",
    );
    expect(actions).toContain(
      "invalid_jummah_cash",
    );
    expect(actions).toContain(
      "jummah_cash_failed",
    );

    expect(managementPage).toContain(
      "capabilities.canCreateJummahCashDonation",
    );
    expect(managementPage).toContain(
      "recordJummahCashDonation",
    );
    expect(managementPage).toContain(
      "Jummah cash collection",
    );
    expect(managementPage).toContain(
      "Record the total cash collected for Jummah.",
    );
    expect(managementPage).toContain(
      "Record Jummah collection",
    );
    expect(managementPage).toContain(
      "Jummah cash collection recorded.",
    );
    expect(managementPage).not.toContain(
      'name="donor',
    );
    expect(managementPage).not.toContain(
      'name="phone',
    );
    expect(managementPage).not.toContain(
      'name="member',
    );
    expect(managementPage).not.toContain(
      'name="createdAt',
    );
    expect(managementPage).not.toContain(
      'name="notes',
    );

    expect(dashboardPage).toContain(
      "canCreateJummahCashDonation",
    );
  });
});
