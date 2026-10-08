import { randomUUID } from "expo-crypto";

import { supabase } from "../lib/supabase";
import {
  decideFinanceTransfer,
  financeTransfersQueryKey,
  financeTransferStatusLabel,
  listFinanceTransfers,
  submitFinanceTransfer,
} from "./finance";

jest.mock("expo-crypto", () => ({
  randomUUID: jest.fn(() => "operation-123"),
}));

jest.mock("../lib/supabase", () => ({
  supabase: {
    from: jest.fn(),
    rpc: jest.fn(),
  },
}));

const mockFrom =
  supabase.from as unknown as jest.Mock;

const mockRpc =
  supabase.rpc as unknown as jest.Mock;

const mockRandomUUID =
  randomUUID as unknown as jest.Mock;

const dbTransfer = {
  id: "11111111-1111-1111-1111-111111111111",
  source_finance_account_id:
    "22222222-2222-2222-2222-222222222222",
  destination_finance_account_id:
    "33333333-3333-3333-3333-333333333333",
  amount_paise: 2000000,
  currency: "INR",
  reason: "Deposit cash into bank",
  business_date: "2026-10-08",
  status: "submitted",
  submitted_by_application_user_id:
    "44444444-4444-4444-4444-444444444444",
  decided_by_application_user_id: null,
  decided_at: null,
  rejection_reason: null,
  source_transaction_id: null,
  destination_transaction_id: null,
  created_at: "2026-10-08T08:00:00Z",
  updated_at: "2026-10-08T08:00:00Z",
};

describe("Finance transfers", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockRandomUUID.mockReturnValue(
      "operation-123",
    );
  });

  it("scopes its query key to the application user", () => {
    expect(
      financeTransfersQueryKey(
        "application-user-1",
      ),
    ).toEqual([
      "finance",
      "transfers",
      "application-user-1",
    ]);

    expect(
      financeTransfersQueryKey(),
    ).toEqual([
      "finance",
      "transfers",
      "anonymous",
    ]);
  });

  it("lists and maps transfers newest first", async () => {
    const secondOrder =
      jest.fn().mockResolvedValue({
        data: [dbTransfer],
        error: null,
      });

    const firstOrder =
      jest.fn().mockReturnValue({
        order: secondOrder,
      });

    mockFrom.mockReturnValue({
      select: jest.fn().mockReturnValue({
        order: firstOrder,
      }),
    });

    await expect(
      listFinanceTransfers(),
    ).resolves.toEqual([
      {
        id: dbTransfer.id,
        sourceFinanceAccountId:
          dbTransfer.source_finance_account_id,
        destinationFinanceAccountId:
          dbTransfer
            .destination_finance_account_id,
        amountPaise: 2000000,
        currency: "INR",
        reason: "Deposit cash into bank",
        businessDate: "2026-10-08",
        status: "submitted",
        submittedByApplicationUserId:
          dbTransfer
            .submitted_by_application_user_id,
        decidedByApplicationUserId: null,
        decidedAt: null,
        rejectionReason: null,
        sourceTransactionId: null,
        destinationTransactionId: null,
        createdAt:
          "2026-10-08T08:00:00Z",
        updatedAt:
          "2026-10-08T08:00:00Z",
      },
    ]);

    expect(mockFrom).toHaveBeenCalledWith(
      "finance_transfers",
    );
  });

  it("fails closed when transfers cannot load", async () => {
    mockFrom.mockReturnValue({
      select: jest.fn().mockReturnValue({
        order: jest.fn().mockReturnValue({
          order: jest.fn().mockResolvedValue({
            data: null,
            error: { message: "denied" },
          }),
        }),
      }),
    });

    await expect(
      listFinanceTransfers(),
    ).rejects.toThrow(
      "finance_transfers_unavailable",
    );
  });

  it("submits a normalized transfer", async () => {
    mockRpc.mockResolvedValue({
      data: dbTransfer,
      error: null,
    });

    await expect(
      submitFinanceTransfer({
        sourceFinanceAccountId:
          " 22222222-2222-2222-2222-222222222222 ",
        destinationFinanceAccountId:
          " 33333333-3333-3333-3333-333333333333 ",
        amount: "20000.00",
        reason:
          " Deposit cash into bank ",
        businessDate: "2026-10-08",
      }),
    ).resolves.toMatchObject({
      amountPaise: 2000000,
      reason: "Deposit cash into bank",
    });

    expect(mockRpc).toHaveBeenCalledWith(
      "submit_finance_transfer",
      {
        p_source_finance_account_id:
          "22222222-2222-2222-2222-222222222222",
        p_destination_finance_account_id:
          "33333333-3333-3333-3333-333333333333",
        p_amount_paise: 2000000,
        p_reason:
          "Deposit cash into bank",
        p_business_date: "2026-10-08",
        p_operation_id: "operation-123",
      },
    );
  });

  it("rejects a self-transfer before RPC", async () => {
    await expect(
      submitFinanceTransfer({
        sourceFinanceAccountId:
          "22222222-2222-2222-2222-222222222222",
        destinationFinanceAccountId:
          "22222222-2222-2222-2222-222222222222",
        amount: "100",
        reason: "Test transfer",
        businessDate: "2026-10-08",
      }),
    ).rejects.toThrow(
      "finance_transfer_self_transfer",
    );

    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("rejects invalid transfer input before RPC", async () => {
    await expect(
      submitFinanceTransfer({
        sourceFinanceAccountId:
          "22222222-2222-2222-2222-222222222222",
        destinationFinanceAccountId:
          "33333333-3333-3333-3333-333333333333",
        amount: "0",
        reason: "Test",
        businessDate: "2026-10-08",
      }),
    ).rejects.toThrow(
      "finance_transfer_amount_invalid",
    );

    await expect(
      submitFinanceTransfer({
        sourceFinanceAccountId:
          "22222222-2222-2222-2222-222222222222",
        destinationFinanceAccountId:
          "33333333-3333-3333-3333-333333333333",
        amount: "100",
        reason: "",
        businessDate: "2026-10-08",
      }),
    ).rejects.toThrow(
      "finance_transfer_reason_invalid",
    );

    await expect(
      submitFinanceTransfer({
        sourceFinanceAccountId:
          "22222222-2222-2222-2222-222222222222",
        destinationFinanceAccountId:
          "33333333-3333-3333-3333-333333333333",
        amount: "100",
        reason: "Test",
        businessDate: "2026-02-30",
      }),
    ).rejects.toThrow(
      "finance_transfer_business_date_invalid",
    );

    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("approves through the decision RPC", async () => {
    mockRpc.mockResolvedValue({
      data: {
        ...dbTransfer,
        status: "approved",
        decided_by_application_user_id:
          "55555555-5555-5555-5555-555555555555",
        decided_at:
          "2026-10-08T09:00:00Z",
        source_transaction_id:
          "66666666-6666-6666-6666-666666666666",
        destination_transaction_id:
          "77777777-7777-7777-7777-777777777777",
      },
      error: null,
    });

    await expect(
      decideFinanceTransfer({
        financeTransferId:
          dbTransfer.id,
        decision: "approve",
      }),
    ).resolves.toMatchObject({
      status: "approved",
      sourceTransactionId:
        "66666666-6666-6666-6666-666666666666",
      destinationTransactionId:
        "77777777-7777-7777-7777-777777777777",
    });

    expect(mockRpc).toHaveBeenCalledWith(
      "decide_finance_transfer",
      {
        p_finance_transfer_id:
          dbTransfer.id,
        p_decision: "approve",
        p_reason: null,
        p_operation_id: "operation-123",
      },
    );
  });

  it("requires a reason when rejecting", async () => {
    await expect(
      decideFinanceTransfer({
        financeTransferId:
          dbTransfer.id,
        decision: "reject",
        reason: "   ",
      }),
    ).rejects.toThrow(
      "finance_transfer_rejection_reason_required",
    );

    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("normalizes the rejection reason", async () => {
    mockRpc.mockResolvedValue({
      data: {
        ...dbTransfer,
        status: "rejected",
        decided_by_application_user_id:
          "55555555-5555-5555-5555-555555555555",
        decided_at:
          "2026-10-08T09:00:00Z",
        rejection_reason:
          "Transfer not required",
      },
      error: null,
    });

    await decideFinanceTransfer({
      financeTransferId:
        dbTransfer.id,
      decision: "reject",
      reason: " Transfer not required ",
    });

    expect(mockRpc).toHaveBeenCalledWith(
      "decide_finance_transfer",
      {
        p_finance_transfer_id:
          dbTransfer.id,
        p_decision: "reject",
        p_reason:
          "Transfer not required",
        p_operation_id: "operation-123",
      },
    );
  });

  it("formats transfer lifecycle labels", () => {
    expect(
      financeTransferStatusLabel("submitted"),
    ).toBe("Submitted");

    expect(
      financeTransferStatusLabel("approved"),
    ).toBe("Approved");

    expect(
      financeTransferStatusLabel("rejected"),
    ).toBe("Rejected");
  });
});
