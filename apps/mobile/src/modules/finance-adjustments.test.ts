import { randomUUID } from "expo-crypto";

import { supabase } from "../lib/supabase";
import {
  canCorrectFinanceTransaction,
  canReverseFinanceTransaction,
  decideFinanceAdjustment,
  financeAdjustmentsQueryKey,
  financeAdjustmentStatusLabel,
  financeAdjustmentTypeLabel,
  listFinanceAdjustments,
  submitFinanceCorrection,
  submitFinanceReversal,
} from "./finance";

jest.mock("expo-crypto", () => ({
  randomUUID: jest.fn(
    () => "operation-adjustment-123",
  ),
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

const dbAdjustment = {
  id: "11111111-1111-1111-1111-111111111111",
  adjustment_type: "correction",
  target_transaction_id:
    "22222222-2222-2222-2222-222222222222",
  reason: "Correct account allocation",
  correction_finance_account_id:
    "33333333-3333-3333-3333-333333333333",
  correction_direction: "inflow",
  correction_amount_paise: 250000,
  business_date: "2026-10-08",
  status: "submitted",
  submitted_by_application_user_id:
    "44444444-4444-4444-4444-444444444444",
  decided_by_application_user_id: null,
  decided_at: null,
  rejection_reason: null,
  applied_transaction_id: null,
  created_at: "2026-10-08T10:00:00Z",
  updated_at: "2026-10-08T10:00:00Z",
};

describe("Finance adjustments", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockRandomUUID.mockReturnValue(
      "operation-adjustment-123",
    );
  });

  it("scopes its query key to the application user", () => {
    expect(
      financeAdjustmentsQueryKey(
        "application-user-1",
      ),
    ).toEqual([
      "finance",
      "adjustments",
      "application-user-1",
    ]);

    expect(
      financeAdjustmentsQueryKey(),
    ).toEqual([
      "finance",
      "adjustments",
      "anonymous",
    ]);
  });

  it("lists and maps adjustments newest first", async () => {
    const idOrder =
      jest.fn().mockResolvedValue({
        data: [dbAdjustment],
        error: null,
      });

    const createdOrder =
      jest.fn().mockReturnValue({
        order: idOrder,
      });

    mockFrom.mockReturnValue({
      select: jest.fn().mockReturnValue({
        order: createdOrder,
      }),
    });

    await expect(
      listFinanceAdjustments(),
    ).resolves.toEqual([
      {
        id: dbAdjustment.id,
        adjustmentType: "correction",
        targetTransactionId:
          dbAdjustment.target_transaction_id,
        reason:
          "Correct account allocation",
        correctionFinanceAccountId:
          dbAdjustment
            .correction_finance_account_id,
        correctionDirection: "inflow",
        correctionAmountPaise: 250000,
        businessDate: "2026-10-08",
        status: "submitted",
        submittedByApplicationUserId:
          dbAdjustment
            .submitted_by_application_user_id,
        decidedByApplicationUserId: null,
        decidedAt: null,
        rejectionReason: null,
        appliedTransactionId: null,
        createdAt:
          "2026-10-08T10:00:00Z",
        updatedAt:
          "2026-10-08T10:00:00Z",
      },
    ]);

    expect(mockFrom).toHaveBeenCalledWith(
      "finance_adjustments",
    );

    expect(
      createdOrder,
    ).toHaveBeenCalledWith(
      "created_at",
      {
        ascending: false,
      },
    );

    expect(idOrder).toHaveBeenCalledWith(
      "id",
      {
        ascending: false,
      },
    );
  });

  it("fails closed when adjustment history cannot load", async () => {
    mockFrom.mockReturnValue({
      select: jest.fn().mockReturnValue({
        order: jest.fn().mockReturnValue({
          order: jest.fn().mockResolvedValue({
            data: null,
            error: {
              message: "denied",
            },
          }),
        }),
      }),
    });

    await expect(
      listFinanceAdjustments(),
    ).rejects.toThrow(
      "finance_adjustments_unavailable",
    );
  });

  it("submits a normalized correction", async () => {
    mockRpc.mockResolvedValue({
      data: dbAdjustment,
      error: null,
    });

    await expect(
      submitFinanceCorrection({
        targetTransactionId:
          " 22222222-2222-2222-2222-222222222222 ",
        reason:
          " Correct account allocation ",
        correctionFinanceAccountId:
          " 33333333-3333-3333-3333-333333333333 ",
        correctionDirection: "inflow",
        amount: "2500.00",
        businessDate: "2026-10-08",
      }),
    ).resolves.toMatchObject({
      adjustmentType: "correction",
      correctionAmountPaise: 250000,
    });

    expect(mockRpc).toHaveBeenCalledWith(
      "submit_finance_adjustment",
      {
        p_target_transaction_id:
          "22222222-2222-2222-2222-222222222222",
        p_adjustment_type: "correction",
        p_reason:
          "Correct account allocation",
        p_correction_finance_account_id:
          "33333333-3333-3333-3333-333333333333",
        p_correction_direction: "inflow",
        p_correction_amount_paise: 250000,
        p_business_date: "2026-10-08",
        p_operation_id:
          "operation-adjustment-123",
      },
    );
  });

  it("rejects invalid correction input before RPC", async () => {
    await expect(
      submitFinanceCorrection({
        targetTransactionId:
          dbAdjustment.target_transaction_id,
        reason: "Correction",
        correctionFinanceAccountId:
          dbAdjustment
            .correction_finance_account_id,
        correctionDirection: "inflow",
        amount: "0",
        businessDate: "2026-10-08",
      }),
    ).rejects.toThrow(
      "finance_correction_amount_invalid",
    );

    await expect(
      submitFinanceCorrection({
        targetTransactionId:
          dbAdjustment.target_transaction_id,
        reason: "",
        correctionFinanceAccountId:
          dbAdjustment
            .correction_finance_account_id,
        correctionDirection: "inflow",
        amount: "100",
        businessDate: "2026-10-08",
      }),
    ).rejects.toThrow(
      "finance_adjustment_reason_invalid",
    );

    await expect(
      submitFinanceCorrection({
        targetTransactionId:
          dbAdjustment.target_transaction_id,
        reason: "Correction",
        correctionFinanceAccountId: "",
        correctionDirection: "inflow",
        amount: "100",
        businessDate: "2026-10-08",
      }),
    ).rejects.toThrow(
      "finance_correction_account_required",
    );

    await expect(
      submitFinanceCorrection({
        targetTransactionId:
          dbAdjustment.target_transaction_id,
        reason: "Correction",
        correctionFinanceAccountId:
          dbAdjustment
            .correction_finance_account_id,
        correctionDirection: "inflow",
        amount: "100",
        businessDate: "2026-02-30",
      }),
    ).rejects.toThrow(
      "finance_adjustment_business_date_invalid",
    );

    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("submits a reversal without correction effect fields", async () => {
    const reversal = {
      ...dbAdjustment,
      adjustment_type: "reversal",
      correction_finance_account_id: null,
      correction_direction: null,
      correction_amount_paise: null,
    };

    mockRpc.mockResolvedValue({
      data: reversal,
      error: null,
    });

    await expect(
      submitFinanceReversal({
        targetTransactionId:
          dbAdjustment.target_transaction_id,
        reason:
          "Original transaction must be reversed",
        businessDate: "2026-10-08",
      }),
    ).resolves.toMatchObject({
      adjustmentType: "reversal",
      correctionFinanceAccountId: null,
      correctionDirection: null,
      correctionAmountPaise: null,
    });

    expect(mockRpc).toHaveBeenCalledWith(
      "submit_finance_adjustment",
      {
        p_target_transaction_id:
          dbAdjustment.target_transaction_id,
        p_adjustment_type: "reversal",
        p_reason:
          "Original transaction must be reversed",
        p_correction_finance_account_id: null,
        p_correction_direction: null,
        p_correction_amount_paise: null,
        p_business_date: "2026-10-08",
        p_operation_id:
          "operation-adjustment-123",
      },
    );
  });

  it("validates reversal input before RPC", async () => {
    await expect(
      submitFinanceReversal({
        targetTransactionId: "",
        reason: "Reverse",
        businessDate: "2026-10-08",
      }),
    ).rejects.toThrow(
      "finance_adjustment_target_required",
    );

    await expect(
      submitFinanceReversal({
        targetTransactionId:
          dbAdjustment.target_transaction_id,
        reason: "",
        businessDate: "2026-10-08",
      }),
    ).rejects.toThrow(
      "finance_adjustment_reason_invalid",
    );

    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("approves through the adjustment decision RPC", async () => {
    mockRpc.mockResolvedValue({
      data: {
        ...dbAdjustment,
        status: "applied",
        decided_by_application_user_id:
          "55555555-5555-5555-5555-555555555555",
        decided_at:
          "2026-10-08T11:00:00Z",
        applied_transaction_id:
          "66666666-6666-6666-6666-666666666666",
      },
      error: null,
    });

    await expect(
      decideFinanceAdjustment({
        financeAdjustmentId:
          dbAdjustment.id,
        decision: "approve",
      }),
    ).resolves.toMatchObject({
      status: "applied",
      appliedTransactionId:
        "66666666-6666-6666-6666-666666666666",
    });

    expect(mockRpc).toHaveBeenCalledWith(
      "decide_finance_adjustment",
      {
        p_finance_adjustment_id:
          dbAdjustment.id,
        p_decision: "approve",
        p_reason: null,
        p_operation_id:
          "operation-adjustment-123",
      },
    );
  });

  it("requires and normalizes a rejection reason", async () => {
    await expect(
      decideFinanceAdjustment({
        financeAdjustmentId:
          dbAdjustment.id,
        decision: "reject",
        reason: "   ",
      }),
    ).rejects.toThrow(
      "finance_adjustment_rejection_reason_required",
    );

    expect(mockRpc).not.toHaveBeenCalled();

    mockRpc.mockResolvedValue({
      data: {
        ...dbAdjustment,
        status: "rejected",
        decided_by_application_user_id:
          "55555555-5555-5555-5555-555555555555",
        decided_at:
          "2026-10-08T11:00:00Z",
        rejection_reason:
          "Supporting details are insufficient",
      },
      error: null,
    });

    await decideFinanceAdjustment({
      financeAdjustmentId:
        dbAdjustment.id,
      decision: "reject",
      reason:
        " Supporting details are insufficient ",
    });

    expect(mockRpc).toHaveBeenCalledWith(
      "decide_finance_adjustment",
      {
        p_finance_adjustment_id:
          dbAdjustment.id,
        p_decision: "reject",
        p_reason:
          "Supporting details are insufficient",
        p_operation_id:
          "operation-adjustment-123",
      },
    );
  });

  it("mirrors backend target eligibility rules", () => {
    expect(
      canCorrectFinanceTransaction({
        transactionCategory: "EXPENSE",
      }),
    ).toBe(true);

    expect(
      canCorrectFinanceTransaction({
        transactionCategory:
          "CORRECTION",
      }),
    ).toBe(true);

    expect(
      canCorrectFinanceTransaction({
        transactionCategory:
          "TRANSFER_IN",
      }),
    ).toBe(false);

    expect(
      canCorrectFinanceTransaction({
        transactionCategory:
          "TRANSFER_OUT",
      }),
    ).toBe(false);

    expect(
      canReverseFinanceTransaction({
        transactionCategory: "EXPENSE",
      }),
    ).toBe(true);

    expect(
      canReverseFinanceTransaction({
        transactionCategory:
          "CORRECTION",
      }),
    ).toBe(true);

    expect(
      canReverseFinanceTransaction({
        transactionCategory: "REVERSAL",
      }),
    ).toBe(false);

    expect(
      canReverseFinanceTransaction({
        transactionCategory:
          "TRANSFER_IN",
      }),
    ).toBe(false);
  });

  it("formats adjustment labels", () => {
    expect(
      financeAdjustmentTypeLabel(
        "correction",
      ),
    ).toBe("Correction");

    expect(
      financeAdjustmentTypeLabel(
        "reversal",
      ),
    ).toBe("Reversal");

    expect(
      financeAdjustmentStatusLabel(
        "submitted",
      ),
    ).toBe("Submitted");

    expect(
      financeAdjustmentStatusLabel(
        "applied",
      ),
    ).toBe("Applied");

    expect(
      financeAdjustmentStatusLabel(
        "rejected",
      ),
    ).toBe("Rejected");
  });
});
