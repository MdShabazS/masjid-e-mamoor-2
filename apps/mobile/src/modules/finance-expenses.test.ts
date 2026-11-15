import { randomUUID } from "expo-crypto";

import { supabase } from "../lib/supabase";
import {
  decideFinanceExpense,
  closeFinanceExpense,
  financeExpensesQueryKey,
  financeExpenseStatusLabel,
  listFinanceExpenses,
  listFinanceExpenseRevisions,
  resubmitFinanceExpense,
  listExpensePaymentAccounts,
  payFinanceExpense,
  uploadFinanceExpenseBill,
  submitFinanceExpense,
} from "./finance";

jest.mock("expo-crypto", () => ({
  randomUUID: jest.fn(() => "operation-123"),
}));

jest.mock("../lib/supabase", () => ({
  supabase: {
    from: jest.fn(),
    rpc: jest.fn(),
    storage: { from: jest.fn() },
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
  paid_amount_paise: 0,
  missing_bill_reason: null,
  revision_number: 1,
  closed_at: null,
  closed_by_application_user_id: null,
  close_reason: null,
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
        paidAmountPaise: 0,
        missingBillReason: null,
        revisionNumber: 1,
        closedAt: null,
        closedByApplicationUserId: null,
        closeReason: null,
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

  it("loads expense account choices without balances", async () => {
    mockRpc.mockResolvedValue({ data: [{ id: dbExpense.finance_account_id,
      name: "Main cash", account_type: "cash" }], error: null });
    await expect(listExpensePaymentAccounts()).resolves.toEqual([{
      id: dbExpense.finance_account_id, name: "Main cash", accountType: "cash",
    }]);
    expect(mockRpc).toHaveBeenCalledWith("list_expense_payment_accounts");
  });

  it("reads immutable rejected revision history", async () => {
    mockFrom.mockReturnValue({
      select: jest.fn().mockReturnValue({
        order: jest.fn().mockResolvedValue({
          data: [{ id: "revision-1", finance_expense_id: dbExpense.id,
            revision_number: 1, amount_paise: 125050,
            description: dbExpense.description,
            rejection_reason: "Incorrect amount",
            decided_at: "2026-10-08T09:00:00Z" }], error: null,
        }),
      }),
    });
    await expect(listFinanceExpenseRevisions()).resolves.toEqual([{
      id: "revision-1", financeExpenseId: dbExpense.id,
      revisionNumber: 1, amountPaise: 125050,
      description: dbExpense.description,
      rejectionReason: "Incorrect amount", decidedAt: "2026-10-08T09:00:00Z",
    }]);
    expect(mockFrom).toHaveBeenCalledWith("finance_expense_revisions");
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
      "submit_finance_expense_with_evidence",
      {
        p_finance_account_id:
          "22222222-2222-2222-2222-222222222222",
        p_amount_paise: 125050,
        p_description:
          "Electrical maintenance",
        p_payee: "ABC Electricals",
        p_business_date: "2026-10-08",
        p_operation_id: "operation-123",
        p_missing_bill_reason: null,
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

  it("requires a valid missing-bill explanation", async () => {
    await expect(submitFinanceExpense({
      financeAccountId: dbExpense.finance_account_id,
      amount: "100",
      description: "Maintenance",
      businessDate: "2026-10-13",
      missingBillReason: "short",
    })).rejects.toThrow("finance_expense_missing_bill_reason_invalid");
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("checks bill contents before a private upload and registration", async () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue({
      arrayBuffer: async () => png.buffer,
    } as Response);
    const upload = jest.fn().mockResolvedValue({ error: null });
    const storageFrom = supabase.storage.from as jest.Mock;
    storageFrom.mockReturnValue({ upload });
    mockRpc.mockResolvedValue({ data: {}, error: null });
    mockRandomUUID.mockReturnValue("44444444-4444-4444-4444-444444444444");
    try {
      await uploadFinanceExpenseBill(dbExpense.id, {
        uri: "file:///bill.png", mimeType: "image/png", size: png.length,
      });
      const objectPath = `${dbExpense.id}/44444444-4444-4444-4444-444444444444.png`;
      expect(storageFrom).toHaveBeenCalledWith("finance-expense-bills");
      expect(upload).toHaveBeenCalledWith(objectPath, png, {
        contentType: "image/png", upsert: false,
      });
      expect(mockRpc).toHaveBeenCalledWith("register_finance_expense_bill", {
        p_finance_expense_id: dbExpense.id,
        p_storage_object_path: objectPath,
      });
      fetchMock.mockResolvedValue({ arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer } as Response);
      await expect(uploadFinanceExpenseBill(dbExpense.id, {
        uri: "file:///fake.png", mimeType: "image/png", size: 3,
      })).rejects.toThrow("finance_expense_bill_invalid");
      expect(upload).toHaveBeenCalledTimes(1);
    } finally {
      fetchMock.mockRestore();
    }
  });

  it("approves through the decision RPC", async () => {
    mockRpc.mockResolvedValue({
      data: {
        ...dbExpense,
        status: "approved",
        decided_by_application_user_id:
          "44444444-4444-4444-4444-444444444444",
        decided_at:
          "2026-10-08T07:00:00Z",
        posted_transaction_id: null,
      },
      error: null,
    });

    await expect(
      decideFinanceExpense({
        financeExpenseId: dbExpense.id,
        decision: "approve",
      }),
    ).resolves.toMatchObject({
      status: "approved",
      paidAmountPaise: 0,
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

  it("records a partial Treasurer payment with an idempotency ID", async () => {
    mockRpc.mockResolvedValue({
      data: { ...dbExpense, status: "partially_paid", paid_amount_paise: 25000 },
      error: null,
    });
    await expect(payFinanceExpense({
      financeExpenseId: dbExpense.id,
      amount: "250.00",
      businessDate: "2026-10-13",
    })).resolves.toMatchObject({ status: "partially_paid", paidAmountPaise: 25000 });
    expect(mockRpc).toHaveBeenCalledWith("pay_finance_expense", {
      p_finance_expense_id: dbExpense.id,
      p_amount_paise: 25000,
      p_business_date: "2026-10-13",
      p_operation_id: "operation-123",
    });
  });

  it("closes a partial expense and preserves the paid amount", async () => {
    mockRpc.mockResolvedValue({ data: { ...dbExpense,
      status: "closed", paid_amount_paise: 25000,
      close_reason: "Final invoice was lower than estimated.",
      closed_at: "2026-10-13T09:00:00Z",
      closed_by_application_user_id: "44444444-4444-4444-4444-444444444444",
    }, error: null });
    await expect(closeFinanceExpense({
      financeExpenseId: dbExpense.id,
      reason: " Final invoice was lower than estimated. ",
    })).resolves.toMatchObject({
      status: "closed", paidAmountPaise: 25000,
      closeReason: "Final invoice was lower than estimated.",
    });
    expect(mockRpc).toHaveBeenCalledWith("close_finance_expense", {
      p_finance_expense_id: dbExpense.id,
      p_reason: "Final invoice was lower than estimated.",
      p_operation_id: "operation-123",
    });
  });

  it("resubmits a rejected expense as a new revision", async () => {
    mockRpc.mockResolvedValue({ data: { ...dbExpense,
      status: "submitted", revision_number: 2, amount_paise: 90000,
      missing_bill_reason: "Vendor gave no paper receipt." }, error: null });
    await expect(resubmitFinanceExpense({
      financeExpenseId: dbExpense.id,
      financeAccountId: dbExpense.finance_account_id,
      amount: "900.00",
      description: " Revised maintenance ",
      payee: " Local supplier ",
      businessDate: "2026-10-13",
      missingBillReason: " Vendor gave no paper receipt. ",
    })).resolves.toMatchObject({ status: "submitted", revisionNumber: 2 });
    expect(mockRpc).toHaveBeenCalledWith("resubmit_finance_expense", {
      p_finance_expense_id: dbExpense.id,
      p_finance_account_id: dbExpense.finance_account_id,
      p_amount_paise: 90000,
      p_description: "Revised maintenance",
      p_payee: "Local supplier",
      p_business_date: "2026-10-13",
      p_missing_bill_reason: "Vendor gave no paper receipt.",
      p_operation_id: "operation-123",
    });
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
