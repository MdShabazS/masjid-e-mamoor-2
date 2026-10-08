import { supabase } from "../lib/supabase";
import {
  completeFinanceReconciliation,
  financeReconciliationDiscrepancyStatusLabel,
  financeReconciliationEvidenceTypeLabel,
  financeReconciliationItemsQueryKey,
  financeReconciliationsQueryKey,
  financeReconciliationStatusLabel,
  financeReconciliationTypeLabel,
  listFinanceReconciliationItems,
  listFinanceReconciliations,
  recordFinanceReconciliationItem,
  startFinanceReconciliation,
} from "./finance";

jest.mock("expo-crypto", () => ({
  randomUUID: jest.fn(() => "operation-test-id"),
}));

jest.mock("../lib/supabase", () => ({
  supabase: {
    from: jest.fn(),
    rpc: jest.fn(),
  },
}));


const fromMock = supabase.from as unknown as jest.Mock;
const rpcMock = supabase.rpc as unknown as jest.Mock;

const reconciliationRow = {
  id: "reconciliation-1",
  reconciliation_type: "monthly",
  period_month: "2026-09-01",
  as_of_business_date: "2026-09-30",
  status: "in_progress",
  start_notes: "September reconciliation",
  completion_notes: null,
  created_by_application_user_id: "user-finance",
  completed_by_application_user_id: null,
  started_at: "2026-10-08T10:00:00Z",
  completed_at: null,
  updated_at: "2026-10-08T10:00:00Z",
};

const reconciliationItemRow = {
  id: "item-1",
  reconciliation_id: "reconciliation-1",
  finance_account_id: "account-bank",
  account_name_snapshot: "Main Bank",
  account_type_snapshot: "bank",
  currency: "INR",
  system_balance_paise: 125000,
  external_balance_paise: 124500,
  difference_paise: -500,
  evidence_type: "bank_statement",
  evidence_reference: "September statement",
  investigation_note: "Bank fee not yet posted",
  discrepancy_status: "investigated",
  recorded_by_application_user_id: "user-finance",
  recorded_at: "2026-10-08T10:30:00Z",
  created_at: "2026-10-08T10:00:00Z",
  updated_at: "2026-10-08T10:30:00Z",
};

describe("Finance reconciliation mobile module", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("builds stable reconciliation query keys", () => {
    expect(
      financeReconciliationsQueryKey("user-1"),
    ).toEqual([
      "finance",
      "reconciliations",
      "user-1",
    ]);

    expect(
      financeReconciliationItemsQueryKey(
        "reconciliation-1",
        "user-1",
      ),
    ).toEqual([
      "finance",
      "reconciliations",
      "reconciliation-1",
      "items",
      "user-1",
    ]);
  });

  it("lists reconciliation history and maps database rows", async () => {
    const secondOrder = jest
      .fn()
      .mockResolvedValue({
        data: [reconciliationRow],
        error: null,
      });

    const firstOrder = jest.fn().mockReturnValue({
      order: secondOrder,
    });

    const select = jest.fn().mockReturnValue({
      order: firstOrder,
    });

    fromMock.mockReturnValue({ select });

    await expect(
      listFinanceReconciliations(),
    ).resolves.toEqual([
      {
        id: "reconciliation-1",
        reconciliationType: "monthly",
        periodMonth: "2026-09-01",
        asOfBusinessDate: "2026-09-30",
        status: "in_progress",
        startNotes: "September reconciliation",
        completionNotes: null,
        createdByApplicationUserId: "user-finance",
        completedByApplicationUserId: null,
        startedAt: "2026-10-08T10:00:00Z",
        completedAt: null,
        updatedAt: "2026-10-08T10:00:00Z",
      },
    ]);

    expect(fromMock).toHaveBeenCalledWith(
      "finance_reconciliations",
    );
    expect(firstOrder).toHaveBeenCalledWith(
      "started_at",
      { ascending: false },
    );
    expect(secondOrder).toHaveBeenCalledWith(
      "id",
      { ascending: false },
    );
  });

  it("lists reconciliation items and maps discrepancy evidence", async () => {
    const secondOrder = jest
      .fn()
      .mockResolvedValue({
        data: [reconciliationItemRow],
        error: null,
      });

    const firstOrder = jest.fn().mockReturnValue({
      order: secondOrder,
    });

    const eq = jest.fn().mockReturnValue({
      order: firstOrder,
    });

    const select = jest.fn().mockReturnValue({ eq });

    fromMock.mockReturnValue({ select });

    await expect(
      listFinanceReconciliationItems(
        "reconciliation-1",
      ),
    ).resolves.toEqual([
      {
        id: "item-1",
        reconciliationId: "reconciliation-1",
        financeAccountId: "account-bank",
        accountNameSnapshot: "Main Bank",
        accountTypeSnapshot: "bank",
        currency: "INR",
        systemBalancePaise: 125000,
        externalBalancePaise: 124500,
        differencePaise: -500,
        evidenceType: "bank_statement",
        evidenceReference: "September statement",
        investigationNote: "Bank fee not yet posted",
        discrepancyStatus: "investigated",
        recordedByApplicationUserId: "user-finance",
        recordedAt: "2026-10-08T10:30:00Z",
        createdAt: "2026-10-08T10:00:00Z",
        updatedAt: "2026-10-08T10:30:00Z",
      },
    ]);

    expect(fromMock).toHaveBeenCalledWith(
      "finance_reconciliation_items",
    );
    expect(eq).toHaveBeenCalledWith(
      "reconciliation_id",
      "reconciliation-1",
    );
  });

  it("starts reconciliation through the trusted RPC", async () => {
    rpcMock.mockResolvedValue({
      data: reconciliationRow,
      error: null,
    });

    const result = await startFinanceReconciliation({
      reconciliationType: "monthly",
      periodMonth: "2026-09-01",
      asOfBusinessDate: "2026-09-30",
      notes: "  September reconciliation  ",
    });

    expect(rpcMock).toHaveBeenCalledWith(
      "start_finance_reconciliation",
      {
        p_reconciliation_type: "monthly",
        p_period_month: "2026-09-01",
        p_as_of_business_date: "2026-09-30",
        p_notes: "September reconciliation",
        p_operation_id: "operation-test-id",
      },
    );

    expect(result.id).toBe("reconciliation-1");
    expect(result.reconciliationType).toBe("monthly");
    expect(result.status).toBe("in_progress");
  });

  it("records external evidence through the trusted RPC", async () => {
    rpcMock.mockResolvedValue({
      data: reconciliationItemRow,
      error: null,
    });

    const result =
      await recordFinanceReconciliationItem({
        reconciliationId: "reconciliation-1",
        financeAccountId: "account-bank",
        externalBalancePaise: 124500,
        evidenceType: "bank_statement",
        evidenceReference:
          "  September statement  ",
        investigationNote:
          "  Bank fee not yet posted  ",
      });

    expect(rpcMock).toHaveBeenCalledWith(
      "record_finance_reconciliation_item",
      {
        p_reconciliation_id: "reconciliation-1",
        p_finance_account_id: "account-bank",
        p_external_balance_paise: 124500,
        p_evidence_type: "bank_statement",
        p_evidence_reference:
          "September statement",
        p_investigation_note:
          "Bank fee not yet posted",
        p_operation_id: "operation-test-id",
      },
    );

    expect(result.differencePaise).toBe(-500);
    expect(result.discrepancyStatus).toBe(
      "investigated",
    );
  });

  it("converts optional blank evidence notes to null", async () => {
    rpcMock.mockResolvedValue({
      data: {
        ...reconciliationItemRow,
        evidence_reference: null,
        investigation_note: null,
      },
      error: null,
    });

    await recordFinanceReconciliationItem({
      reconciliationId: "reconciliation-1",
      financeAccountId: "account-bank",
      externalBalancePaise: 125000,
      evidenceType: "bank_statement",
      evidenceReference: "   ",
      investigationNote: "   ",
    });

    expect(rpcMock).toHaveBeenCalledWith(
      "record_finance_reconciliation_item",
      expect.objectContaining({
        p_evidence_reference: null,
        p_investigation_note: null,
      }),
    );
  });

  it("completes reconciliation through the trusted RPC", async () => {
    rpcMock.mockResolvedValue({
      data: {
        ...reconciliationRow,
        status: "completed",
        completion_notes: "Completed review",
        completed_by_application_user_id:
          "user-finance",
        completed_at: "2026-10-08T11:00:00Z",
      },
      error: null,
    });

    const result =
      await completeFinanceReconciliation({
        reconciliationId: "reconciliation-1",
        notes: "  Completed review  ",
      });

    expect(rpcMock).toHaveBeenCalledWith(
      "complete_finance_reconciliation",
      {
        p_reconciliation_id: "reconciliation-1",
        p_notes: "Completed review",
        p_operation_id: "operation-test-id",
      },
    );

    expect(result.status).toBe("completed");
    expect(result.completionNotes).toBe(
      "Completed review",
    );
  });

  it("surfaces reconciliation RPC failures with stable errors", async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: { message: "database failure" },
    });

    await expect(
      completeFinanceReconciliation({
        reconciliationId: "reconciliation-1",
      }),
    ).rejects.toThrow(
      "finance_reconciliation_complete_failed",
    );
  });

  it("labels reconciliation states and evidence consistently", () => {
    expect(
      financeReconciliationTypeLabel("monthly"),
    ).toBe("Monthly");

    expect(
      financeReconciliationTypeLabel("on_demand"),
    ).toBe("On-demand");

    expect(
      financeReconciliationStatusLabel("in_progress"),
    ).toBe("In progress");

    expect(
      financeReconciliationStatusLabel("completed"),
    ).toBe("Completed");

    expect(
      financeReconciliationEvidenceTypeLabel(
        "bank_statement",
      ),
    ).toBe("Bank statement");

    expect(
      financeReconciliationEvidenceTypeLabel(
        "cash_count",
      ),
    ).toBe("Cash count");

    expect(
      financeReconciliationDiscrepancyStatusLabel(
        "matched",
      ),
    ).toBe("Matched");

    expect(
      financeReconciliationDiscrepancyStatusLabel(
        "open",
      ),
    ).toBe("Open discrepancy");

    expect(
      financeReconciliationDiscrepancyStatusLabel(
        "investigated",
      ),
    ).toBe("Investigated");
  });
});
