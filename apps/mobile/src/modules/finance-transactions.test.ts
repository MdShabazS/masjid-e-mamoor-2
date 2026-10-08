import { supabase } from "../lib/supabase";
import {
  financeTransactionCategoryLabel,
  financeTransactionDirectionLabel,
  financeTransactionsQueryKey,
  listFinanceTransactions,
  signedFinanceTransactionAmount,
} from "./finance";

jest.mock("../lib/supabase", () => ({
  supabase: {
    from: jest.fn(),
  },
}));

const mockFrom =
  supabase.from as unknown as jest.Mock;

const dbTransaction = {
  id: "11111111-1111-1111-1111-111111111111",
  finance_account_id:
    "22222222-2222-2222-2222-222222222222",
  transaction_category: "EXPENSE",
  direction: "outflow",
  amount_paise: 125050,
  currency: "INR",
  business_date: "2026-10-08",
  reference_type: "finance_expense",
  reference_id:
    "33333333-3333-3333-3333-333333333333",
  related_transaction_id: null,
  operation_id: "operation-123",
  created_by_application_user_id:
    "44444444-4444-4444-4444-444444444444",
  created_at: "2026-10-08T09:30:00Z",
};

describe("Finance transactions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("scopes its query key to the application user", () => {
    expect(
      financeTransactionsQueryKey(
        "application-user-1",
      ),
    ).toEqual([
      "finance",
      "transactions",
      "application-user-1",
    ]);

    expect(
      financeTransactionsQueryKey(),
    ).toEqual([
      "finance",
      "transactions",
      "anonymous",
    ]);
  });

  it("lists and maps ledger transactions newest first", async () => {
    const idOrder =
      jest.fn().mockResolvedValue({
        data: [dbTransaction],
        error: null,
      });

    const createdOrder =
      jest.fn().mockReturnValue({
        order: idOrder,
      });

    const businessOrder =
      jest.fn().mockReturnValue({
        order: createdOrder,
      });

    mockFrom.mockReturnValue({
      select: jest.fn().mockReturnValue({
        order: businessOrder,
      }),
    });

    await expect(
      listFinanceTransactions(),
    ).resolves.toEqual([
      {
        id: dbTransaction.id,
        financeAccountId:
          dbTransaction.finance_account_id,
        transactionCategory: "EXPENSE",
        direction: "outflow",
        amountPaise: 125050,
        currency: "INR",
        businessDate: "2026-10-08",
        referenceType: "finance_expense",
        referenceId:
          dbTransaction.reference_id,
        relatedTransactionId: null,
        operationId: "operation-123",
        createdByApplicationUserId:
          dbTransaction
            .created_by_application_user_id,
        createdAt:
          "2026-10-08T09:30:00Z",
      },
    ]);

    expect(mockFrom).toHaveBeenCalledWith(
      "financial_transactions",
    );

    expect(businessOrder).toHaveBeenCalledWith(
      "business_date",
      {
        ascending: false,
      },
    );

    expect(createdOrder).toHaveBeenCalledWith(
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

  it("maps adjustment lineage", async () => {
    const correction = {
      ...dbTransaction,
      id: "55555555-5555-5555-5555-555555555555",
      transaction_category: "CORRECTION",
      direction: "inflow",
      related_transaction_id:
        dbTransaction.id,
      reference_type: "finance_adjustment",
      reference_id:
        "66666666-6666-6666-6666-666666666666",
    };

    const idOrder =
      jest.fn().mockResolvedValue({
        data: [correction],
        error: null,
      });

    const createdOrder =
      jest.fn().mockReturnValue({
        order: idOrder,
      });

    const businessOrder =
      jest.fn().mockReturnValue({
        order: createdOrder,
      });

    mockFrom.mockReturnValue({
      select: jest.fn().mockReturnValue({
        order: businessOrder,
      }),
    });

    await expect(
      listFinanceTransactions(),
    ).resolves.toEqual([
      expect.objectContaining({
        transactionCategory:
          "CORRECTION",
        direction: "inflow",
        relatedTransactionId:
          dbTransaction.id,
        referenceType:
          "finance_adjustment",
      }),
    ]);
  });

  it("fails closed when ledger access fails", async () => {
    mockFrom.mockReturnValue({
      select: jest.fn().mockReturnValue({
        order: jest.fn().mockReturnValue({
          order: jest.fn().mockReturnValue({
            order: jest
              .fn()
              .mockResolvedValue({
                data: null,
                error: {
                  message: "denied",
                },
              }),
          }),
        }),
      }),
    });

    await expect(
      listFinanceTransactions(),
    ).rejects.toThrow(
      "finance_transactions_unavailable",
    );
  });

  it("formats all transaction categories", () => {
    expect(
      financeTransactionCategoryLabel(
        "DONATION_RECURRING",
      ),
    ).toBe("Recurring donation");

    expect(
      financeTransactionCategoryLabel(
        "DONATION_ADDITIONAL",
      ),
    ).toBe("Additional donation");

    expect(
      financeTransactionCategoryLabel(
        "DONATION_ANONYMOUS",
      ),
    ).toBe("Anonymous donation");

    expect(
      financeTransactionCategoryLabel(
        "DONATION_JUMMAH",
      ),
    ).toBe("Jummah donation");

    expect(
      financeTransactionCategoryLabel(
        "EXPENSE",
      ),
    ).toBe("Expense");

    expect(
      financeTransactionCategoryLabel(
        "TRANSFER_IN",
      ),
    ).toBe("Transfer in");

    expect(
      financeTransactionCategoryLabel(
        "TRANSFER_OUT",
      ),
    ).toBe("Transfer out");

    expect(
      financeTransactionCategoryLabel(
        "CORRECTION",
      ),
    ).toBe("Correction");

    expect(
      financeTransactionCategoryLabel(
        "REVERSAL",
      ),
    ).toBe("Reversal");
  });

  it("formats transaction directions", () => {
    expect(
      financeTransactionDirectionLabel(
        "inflow",
      ),
    ).toBe("Inflow");

    expect(
      financeTransactionDirectionLabel(
        "outflow",
      ),
    ).toBe("Outflow");
  });

  it("calculates signed ledger effects", () => {
    expect(
      signedFinanceTransactionAmount({
        direction: "inflow",
        amountPaise: 50000,
      }),
    ).toBe(50000);

    expect(
      signedFinanceTransactionAmount({
        direction: "outflow",
        amountPaise: 50000,
      }),
    ).toBe(-50000);
  });
});
