import { beforeEach, describe, expect, it, vi } from "vitest";

const { createAdminClient, headers, rpc, from, select, eq, maybeSingle } = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  headers: vi.fn(),
  rpc: vi.fn(),
  from: vi.fn(),
  select: vi.fn(),
  eq: vi.fn(),
  maybeSingle: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient }));
vi.mock("next/headers", () => ({ headers }));

import { findVerifiedPublicReceipt, normalizeReceiptNumber } from "./public-receipt";

describe("public receipt lookup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SUPABASE_SERVICE_ROLE_KEY = "unit-test-key";
    headers.mockResolvedValue(new Headers({ "x-vercel-forwarded-for": "192.0.2.1" }));
    rpc.mockResolvedValue({ data: { allowed: true, retry_after_seconds: 0 }, error: null });
    createAdminClient.mockReturnValue({ from, rpc });
    from.mockReturnValue({ select });
    select.mockReturnValue({ eq });
    eq.mockReturnValue({ eq, maybeSingle });
  });

  it("normalizes exact receipt numbers and rejects malformed input without a database query", async () => {
    expect(normalizeReceiptNumber(" mem2-2026-00000001 ")).toBe("MEM2-2026-00000001");
    for (const value of ["MEM2-2026-1", "MEM2-2026-00000001%", "MEM2-2026-00000001' OR 1=1"])
      expect(await findVerifiedPublicReceipt(value)).toBeNull();
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("queries only a verified receipt and returns a fixed public projection", async () => {
    maybeSingle.mockResolvedValue({ data: {
      receipt_number: "MEM2-2026-00000001", donor_name: "Ahmed", amount_paise: 100000,
      donation_date: "2026-10-14", payment_method: "upi", purpose: "General",
      reviewed_at: "2026-10-14T10:00:00Z", posted_transaction_id: "posted-id",
      donor_phone: "should never leave the server",
    }, error: null });
    const receipt = await findVerifiedPublicReceipt("mem2-2026-00000001");
    expect(from).toHaveBeenCalledWith("referred_donor_contributions");
    expect(rpc).toHaveBeenCalledWith("consume_public_receipt_lookup", {
      p_subject_hash: expect.stringMatching(/^[0-9a-f]{64}$/),
      p_receipt_hash: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
    expect(select.mock.calls[0][0]).not.toContain("donor_phone");
    expect(eq).toHaveBeenNthCalledWith(1, "receipt_number", "MEM2-2026-00000001");
    expect(eq).toHaveBeenNthCalledWith(2, "status", "verified");
    expect(receipt).toEqual({
      receiptNumber: "MEM2-2026-00000001", donorName: "Ahmed", amountPaise: 100000,
      donationDate: "2026-10-14", paymentMethod: "upi", purpose: "General",
      verifiedAt: "2026-10-14T10:00:00Z",
    });
  });

  it("does not disclose a receipt that is not posted or reviewed", async () => {
    maybeSingle.mockResolvedValue({ data: { posted_transaction_id: null, reviewed_at: null }, error: null });
    expect(await findVerifiedPublicReceipt("MEM2-2026-00000001")).toBeNull();
  });

  it("fails closed when the distributed limit denies or cannot record a lookup", async () => {
    rpc.mockResolvedValueOnce({ data: { allowed: false, retry_after_seconds: 300 }, error: null });
    await expect(findVerifiedPublicReceipt("MEM2-2026-00000001")).rejects.toThrow("receipt_lookup_limited");
    rpc.mockResolvedValueOnce({ data: null, error: { message: "database unavailable" } });
    await expect(findVerifiedPublicReceipt("MEM2-2026-00000001")).rejects.toThrow("receipt_lookup_unavailable");
    expect(from).not.toHaveBeenCalled();
  });
});
