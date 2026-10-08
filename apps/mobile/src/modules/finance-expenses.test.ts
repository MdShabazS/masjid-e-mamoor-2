import { randomUUID } from "expo-crypto";

import { supabase } from "../lib/supabase";
import {
  decideFinanceExpense,
  financeExpensesQueryKey,
  financeExpenseStatusLabel,
  listFinanceExpenses,
  submitFinanceExpense,
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

const dbExpense = {
  id: "11111111-1111-1111-1111-111111111111",
  finance_account_id:
    "22222222-2222-2222-2222-222222222222",
  amount_paise: 125050,
  currency: "INR",
  description: "Electrical maintenance",
  payee: "ABC Electricals",
  business_date: "2026-10-08",
  status: "submitted",
  submitted_by_application_user_id:
    "33333333-3333-3333-3333-333333333333",
  decided_by_application_user_id: null,
  decided_at: null,
  rejection_reason: null,
  posted_transaction_id: null,
  created_at: "2026-10-08T06:00:00Z",
  updated_at: "2026-10-08T06:00:00Z",
};

describe("Finance expenses", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRandomUUID.mockReturnValue(
      "operation-123",
    );
  });

  it("scopes its query key to the application user", () => {
    expect(
      financeExpensesQueryKey(
        "application-user-1",
      ),
    ).toEqual([
      "finance",
      "expenses",
      "application-user-1",
    ]);

    expect(
      financeExpensesQueryKey(),
    ).toEqual([
      "finance",
      "expenses",
      "anonymous",
    ]);
  });

  it("lists and maps expenses newest first", async () => {
    const secondOrder =
      jest.fn().mockResolvedValue({
        data: [dbExpense],
        error: null,
      });

    const firstOrder =
      jest.fn().mockReturnValue({
        order: secondOrder,
      });

    const select =
      jest.fn().mockReturnValue({
        order: firstOrder,
      });

    mockFrom.mockReturnValue({ select });

    await expect(
      listFinanceExpenses(),
    ).resolves.toEqual([
      {
        id: dbExpense.id,
        financeAccountId:
          dbExpense.finance_account_id,
        amountPaise: 125050,
        currency: "INR",
        description:
          "Electrical maintenance",
        payee: "ABC Electricals",
        businessDate: "2026-10-08",
        status: "submitted",
        submittedByApplicationUserId:
          dbExpense
            .submitted_by_application_user_id,
        decidedByApplicationUserId: null,
        decidedAt: null,
        rejectionReason: null,
        postedTransactionId: null,
        createdAt:
          "2026-10-08T06:00:00Z",
        updatedAt:
          "2026-10-08T06:00:00Z",
      },
    ]);

    expect(mockFrom).toHaveBeenCalledWith(
      "finance_expenses",
    );
  });

  it("fails closed when expenses cannot load", async () => {
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
      listFinanceExpenses(),
    ).rejects.toThrow(
      "finance_expenses_unavailable",
    );
  });

  it("submits a normalized idempotent expense", async () => {
    mockRpc.mockResolvedValue({
      data: dbExpense,
      error: null,
    });

    await expect(
      submitFinanceExpense({
        financeAccountId:
          " 22222222-2222-2222-2222-222222222222 ",
        amount: "1250.50",
        description:
          " Electrical maintenance ",
        payee: " ABC Electricals ",
        businessDate: "2026-10-08",
      }),
    ).resolves.toMatchObject({
      id: dbExpense.id,
      amountPaise: 125050,
      description:
        "Electrical maintenance",
      payee: "ABC Electricals",
    });

    expect(mockRpc).toHaveBeenCalledWith(
      "submit_finance_expense",
      {
        p_finance_account_id:
          "22222222-2222-2222-2222-222222222222",
        p_amount_paise: 125050,
        p_description:
          "Electrical maintenance",
        p_payee: "ABC Electricals",
        p_business_date: "2026-10-08",
        p_operation_id: "operation-123",
      },
    );
  });

  it("rejects invalid input before RPC", async () => {
    await expect(
      submitFinanceExpense({
        financeAccountId:
          "22222222-2222-2222-2222-222222222222",
        amount: "0",
        description: "Test",
        businessDate: "2026-10-08",
      }),
    ).rejects.toThrow(
      "finance_expense_amount_invalid",
    );

    await expect(
      submitFinanceExpense({
        financeAccountId:
          "22222222-2222-2222-2222-222222222222",
        amount: "100",
        description: "",
        businessDate: "2026-10-08",
      }),
    ).rejects.toThrow(
      "finance_expense_description_invalid",
    );

    await expect(
      submitFinanceExpense({
        financeAccountId:
          "22222222-2222-2222-2222-222222222222",
        amount: "100",
        description: "Test",
        businessDate: "2026-02-30",
      }),
    ).rejects.toThrow(
      "finance_expense_business_date_invalid",
    );

    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("approves through the decision RPC", async () => {
    mockRpc.mockResolvedValue({
      data: {
        ...dbExpense,
        status: "posted",
        decided_by_application_user_id:
          "44444444-4444-4444-4444-444444444444",
        decided_at:
          "2026-10-08T07:00:00Z",
        posted_transaction_id:
          "55555555-5555-5555-5555-555555555555",
      },
      error: null,
    });

    await expect(
      decideFinanceExpense({
        financeExpenseId: dbExpense.id,
        decision: "approve",
      }),
    ).resolves.toMatchObject({
      status: "posted",
    });

    expect(mockRpc).toHaveBeenCalledWith(
      "decide_finance_expense",
      {
        p_finance_expense_id:
          dbExpense.id,
        p_decision: "approve",
        p_reason: null,
        p_operation_id: "operation-123",
      },
    );
  });

  it("requires a rejection reason", async () => {
    await expect(
      decideFinanceExpense({
        financeExpenseId: dbExpense.id,
        decision: "reject",
        reason: "   ",
      }),
    ).rejects.toThrow(
      "finance_expense_reason_required",
    );

    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("normalizes the rejection reason", async () => {
    mockRpc.mockResolvedValue({
      data: {
        ...dbExpense,
        status: "rejected",
        decided_by_application_user_id:
          "44444444-4444-4444-4444-444444444444",
        decided_at:
          "2026-10-08T07:00:00Z",
        rejection_reason:
          "Missing invoice details",
      },
      error: null,
    });

    await decideFinanceExpense({
      financeExpenseId: dbExpense.id,
      decision: "reject",
      reason: " Missing invoice details ",
    });

    expect(mockRpc).toHaveBeenCalledWith(
      "decide_finance_expense",
      {
        p_finance_expense_id:
          dbExpense.id,
        p_decision: "reject",
        p_reason:
          "Missing invoice details",
        p_operation_id: "operation-123",
      },
    );
  });

  it("formats lifecycle labels", () => {
    expect(
      financeExpenseStatusLabel("submitted"),
    ).toBe("Submitted");

    expect(
      financeExpenseStatusLabel("posted"),
    ).toBe("Posted");

    expect(
      financeExpenseStatusLabel("rejected"),
    ).toBe("Rejected");
  });
});
