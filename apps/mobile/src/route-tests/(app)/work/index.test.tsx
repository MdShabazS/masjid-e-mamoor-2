import { useQuery } from "@tanstack/react-query";
import { act, fireEvent, render } from "@testing-library/react-native";
import { router } from "expo-router";

import { useAuth } from "../../../auth/AuthProvider";
import type { MobileCapabilities } from "../../../modules/capabilities";
import type { CommitteeTaskSummary } from "../../../modules/work";
import WorkScreen from "../../../../app/(app)/work/index";

jest.mock("@tanstack/react-query", () => ({ useQuery: jest.fn() }));
jest.mock("expo-router", () => ({ router: { push: jest.fn() } }));
jest.mock("../../../auth/AuthProvider", () => ({ useAuth: jest.fn() }));
jest.mock("../../../modules/capabilities", () => ({
  loadCapabilities: jest.fn(),
}));
jest.mock("../../../modules/work", () => ({
  committeeTaskListQueryKey: (accountId: string | undefined) => ["committee-tasks", accountId],
  listCommitteeTasks: jest.fn(),
}));
jest.mock("react-native-keyboard-controller", () => {
  const ReactNative = jest.requireActual("react-native");
  return { KeyboardAwareScrollView: ReactNative.ScrollView };
});

const mockUseQuery = useQuery as jest.Mock;
const mockUseAuth = useAuth as jest.Mock;
const mockPush = router.push as jest.Mock;
const refetch = jest.fn();

const capabilities: MobileCapabilities = {
  canManageAccounts: false,
  canReadFinanceAccounts: false,
  canManageFinanceAccounts: false,
  canReadFinanceMonthlyReports: false,
  canManageFinanceMonthlyReports: false,
  canReadFinanceTransactions: false,
  canCreateFinanceTransfers: false,
  canApproveFinanceTransfers: false,
  canCreateFinanceExpenses: false,
  canApproveFinanceExpenses: false,
  canCreateFinanceCorrections: false,
  canCreateFinanceReversals: false,
  canReadFinanceReconciliation: false,
  canManageFinanceReconciliation: false,
  canReadMembers: false,
  canUpdateMembers: false,
  canCreateReferral: false,
  canUseReferrals: false,
  canManageReferrals: false,
  canReadDonations: false,
  canSubmitPayment: false,
  canUploadProof: false,
  canCreateAdditionalDonation: false,
  canReviewPayments: false,
  canAllocatePayments: false,
  canVerifyAndAllocatePayments: false,
  canManageObligations: false,
  canCreateAnonymousDonation: false,
  canCreateJummahCashDonation: false,
  canManageDonations: false,
  canReadCommitteeTasks: true,
  canManageCommitteeTasks: true,
  canAssignCommitteeTasks: false,
  canReadCommitteeMeetings: false,
  canAdministerCommitteeMeetings: false,
  canRecordCommitteeMeetingAttendance: false,
};

let capabilityQuery = queryResult(capabilities);
let taskQuery = queryResult<CommitteeTaskSummary[]>([]);

beforeEach(() => {
  jest.clearAllMocks();
  mockUseAuth.mockReturnValue({
    account: {
      id: "committee-1",
      role: "committee_member",
      username: "committee.one",
    },
  });
  capabilityQuery = queryResult(capabilities);
  taskQuery = queryResult([], refetch);
  mockUseQuery.mockImplementation(({ queryKey }: { queryKey: unknown[] }) =>
    queryKey[0] === "capabilities" ? capabilityQuery : taskQuery,
  );
});

describe("Work list screen", () => {
  it("renders assigned, open, overdue, and completed task groups", async () => {
    taskQuery = queryResult([
      task({ id: "assigned", title: "Assigned work" }),
      task({
        id: "open",
        title: "Volunteer work",
        assignmentMode: "open",
        status: "open",
        assigneeIds: [],
        isOverdue: true,
      }),
      task({ id: "completed", title: "Completed work", status: "completed" }),
    ]);

    const view = await render(<WorkScreen />);

    expect(view.getByText("My tasks · 1")).toBeTruthy();
    expect(view.getByText("Open volunteer tasks · 1")).toBeTruthy();
    expect(view.getByText("Completed · 1")).toBeTruthy();
    expect(view.getByLabelText("Status: Overdue")).toBeTruthy();

    await act(async () => fireEvent.press(view.getByText("Volunteer work")));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/work/[id]",
      params: { id: "open" },
    });
    await view.unmount();
  });

  it("shows task creation only to assign-capable managers", async () => {
    taskQuery = queryResult([task({ id: "assigned" })]);
    const restrictedView = await render(<WorkScreen />);
    expect(restrictedView.queryByRole("button", { name: "Create task" })).toBeNull();
    await restrictedView.unmount();

    capabilityQuery = queryResult({ ...capabilities, canAssignCommitteeTasks: true });
    const managerView = await render(<WorkScreen />);
    await act(async () =>
      fireEvent.press(managerView.getByRole("button", { name: "Create task" })),
    );
    expect(mockPush).toHaveBeenCalledWith("/work/create");
    await managerView.unmount();
  });

  it("exposes the canonical Meetings entry only with meeting read capability", async () => {
    taskQuery = queryResult([task({ id: "assigned" })]);
    const restrictedView = await render(<WorkScreen />);
    expect(restrictedView.queryByRole("button", { name: "View committee meetings" })).toBeNull();
    await restrictedView.unmount();

    capabilityQuery = queryResult({ ...capabilities, canReadCommitteeMeetings: true });
    const allowedView = await render(<WorkScreen />);
    await act(async () =>
      fireEvent.press(allowedView.getByRole("button", { name: "View committee meetings" })),
    );
    expect(mockPush).toHaveBeenCalledWith("/work/meetings");
    await allowedView.unmount();
  });

  it("renders loading, empty, and retryable error states", async () => {
    taskQuery = { ...queryResult<CommitteeTaskSummary[]>(undefined), isLoading: true };
    const loading = await render(<WorkScreen />);
    expect(loading.getByLabelText("Loading tasks")).toBeTruthy();
    await loading.unmount();

    taskQuery = queryResult([]);
    const empty = await render(<WorkScreen />);
    expect(empty.getByText("No work available")).toBeTruthy();
    await empty.unmount();

    taskQuery = {
      ...queryResult<CommitteeTaskSummary[]>(undefined, refetch),
      isError: true,
    };
    const error = await render(<WorkScreen />);
    await act(async () => fireEvent.press(error.getByRole("button", { name: "Retry" })));
    expect(refetch).toHaveBeenCalledTimes(1);
    await error.unmount();
  });
});

function task(overrides: Partial<CommitteeTaskSummary>): CommitteeTaskSummary {
  return {
    id: "task",
    title: "Committee task",
    description: null,
    priority: "normal",
    status: "assigned",
    assignmentMode: "direct",
    dueDate: null,
    isOverdue: false,
    sourceMeetingId: null,
    sourceMeetingDecisionId: null,
    createdByApplicationUserId: "manager",
    completedByApplicationUserId: null,
    completedAt: null,
    createdAt: "2026-10-01T10:00:00Z",
    updatedAt: "2026-10-01T10:00:00Z",
    assigneeIds: ["committee-1"],
    ...overrides,
  };
}

function queryResult<T>(data: T | undefined, queryRefetch = jest.fn()) {
  return {
    data,
    isError: false,
    isLoading: false,
    isRefetching: false,
    refetch: queryRefetch,
  };
}
