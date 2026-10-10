import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { act, fireEvent, render } from "@testing-library/react-native";
import { router } from "expo-router";

import { useAuth } from "../../auth/AuthProvider";
import type { MobileCapabilities } from "../../modules/capabilities";
import HomeScreen from "../../../app/(app)/index";

jest.mock("@tanstack/react-query", () => ({
  useMutation: jest.fn(),
  useQuery: jest.fn(),
  useQueryClient: jest.fn(),
}));

jest.mock("expo-router", () => ({
  router: {
    push: jest.fn(),
  },
}));

jest.mock("../../auth/AuthProvider", () => ({
  useAuth: jest.fn(),
}));

jest.mock("../../modules/capabilities", () => ({
  loadCapabilities: jest.fn(),
}));

jest.mock("../../modules/work", () => ({
  claimOpenCommitteeTask: jest.fn(),
  committeeTaskListQueryKey: (accountId: string | undefined) => ["committee-tasks", accountId],
  createCommitteeOperationId: () => "operation-test",
  listCommitteeTasks: jest.fn(),
  startCommitteeTask: jest.fn(),
}));

jest.mock("../../modules/meetings", () => ({
  committeeMeetingListQueryKey: (accountId: string | undefined) => [
    "committee-meetings",
    accountId,
  ],
  listCommitteeMeetings: jest.fn(),
}));

jest.mock("../../modules/notifications", () => ({
  formatUnreadBadge: (count: number) => (count > 0 ? String(count) : null),

  getMyUnreadNotificationCount: jest.fn(),

  listMyNotifications: jest.fn(),

  markMyNotificationRead: jest.fn(),

  notificationInvalidationKeys: (accountId: string | undefined) => [
    ["notifications", accountId, "all"],
    ["notifications", accountId, "unread"],
    ["notifications", accountId, "unread-count"],
  ],

  notificationListQueryKey: (accountId: string | undefined, filter: string) => [
    "notifications",
    accountId,
    filter,
  ],

  notificationUnreadCountQueryKey: (accountId: string | undefined) => [
    "notifications",
    accountId,
    "unread-count",
  ],

  safeNotificationTarget: (target: string | null | undefined) => target || "/notifications",
}));

jest.mock("react-native-keyboard-controller", () => {
  const ReactNative = jest.requireActual("react-native");

  return {
    KeyboardAwareScrollView: ReactNative.ScrollView,
  };
});

const mockUseQuery = useQuery as jest.Mock;

const mockUseMutation = useMutation as jest.Mock;

const mockUseQueryClient = useQueryClient as jest.Mock;

const mockUseAuth = useAuth as jest.Mock;

const mockPush = router.push as jest.Mock;

const capabilityRefetch = jest.fn();

const taskRefetch = jest.fn();

const meetingRefetch = jest.fn();

const notificationRefetch = jest.fn();

const unreadRefetch = jest.fn();

const invalidateQueries = jest.fn();

const baseCapabilities: MobileCapabilities = {
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
  canReadCommitteeTasks: false,
  canManageCommitteeTasks: false,
  canAssignCommitteeTasks: false,
  canReadCommitteeMeetings: false,
  canAdministerCommitteeMeetings: false,
  canRecordCommitteeMeetingAttendance: false,
};

const account = {
  id: "account-1",
  authUserId: "auth-1",
  username: "qa.president",
  status: "active" as const,
  role: "president" as const,
  mustChangePassword: false,
  memberProfile: null,
};

let capabilityQuery = queryResult<MobileCapabilities>(baseCapabilities);

let taskQuery = queryResult<unknown[]>([]);

let meetingQuery = queryResult<unknown[]>([]);

let notificationListQuery = queryResult<unknown[]>([]);

let notificationCountQuery = queryResult(0);

beforeEach(() => {
  jest.clearAllMocks();

  mockUseAuth.mockReturnValue({
    account,
  });

  mockUseQueryClient.mockReturnValue({
    invalidateQueries,
  });

  mockUseMutation.mockImplementation(() => ({
    isPending: false,
    mutate: jest.fn(),
    variables: undefined,
  }));

  capabilityQuery = queryResult(baseCapabilities, capabilityRefetch);

  taskQuery = queryResult([], taskRefetch);

  meetingQuery = queryResult([], meetingRefetch);

  notificationListQuery = queryResult([], notificationRefetch);

  notificationCountQuery = queryResult(0, unreadRefetch);

  mockUseQuery.mockImplementation(({ queryKey }: { queryKey: unknown[] }) => {
    if (queryKey[0] === "capabilities") {
      return capabilityQuery;
    }

    if (queryKey[0] === "committee-tasks") {
      return taskQuery;
    }

    if (queryKey[0] === "committee-meetings") {
      return meetingQuery;
    }

    if (queryKey[0] === "notifications" && queryKey[2] === "unread-count") {
      return notificationCountQuery;
    }

    if (queryKey[0] === "notifications") {
      return notificationListQuery;
    }

    throw new Error(`Unexpected query: ${String(queryKey[0])}`);
  });
});

describe("Home dashboard", () => {
  it("surfaces actionable tasks, meetings, notifications and authorized navigation", async () => {
    capabilityQuery = queryResult({
      ...baseCapabilities,
      canManageAccounts: true,
      canReadMembers: true,
      canReadCommitteeTasks: true,
      canAssignCommitteeTasks: true,
      canReadCommitteeMeetings: true,
    });

    taskQuery = queryResult([
      {
        id: "task-1",
        title: "Prepare committee agenda",
        description: "Prepare the agenda before the monthly meeting.",
        priority: "high",
        status: "assigned",
        assignmentMode: "direct",
        dueDate: "2099-10-12",
        isOverdue: false,
        sourceMeetingId: null,
        sourceMeetingDecisionId: null,
        createdByApplicationUserId: "creator",
        completedByApplicationUserId: null,
        completedAt: null,
        createdAt: "2099-10-01T10:00:00Z",
        updatedAt: "2099-10-01T10:00:00Z",
        assigneeIds: ["account-1"],
      },
    ]);

    meetingQuery = queryResult([
      {
        id: "meeting-1",
        title: "Monthly committee meeting",
        meetingType: "general",
        details: null,
        location: "Community hall",
        scheduledStart: "2099-10-20T10:00:00Z",
        scheduledEnd: null,
        status: "scheduled",
        createdByApplicationUserId: "creator",
        cancelledByApplicationUserId: null,
        cancelledAt: null,
        cancellationReason: null,
        createdAt: "2099-10-01T10:00:00Z",
        updatedAt: "2099-10-01T10:00:00Z",
        participantIds: ["account-1"],
      },
    ]);

    notificationListQuery = queryResult([
      {
        id: "notification-1",
        actorApplicationUserId: "creator",
        kind: "meeting_updated",
        title: "Meeting updated",
        body: "Monthly committee meeting details were updated.",
        targetPath: "/work/meetings/meeting-1",
        sourceType: "committee_meeting",
        sourceEntityId: "meeting-1",
        sourceActivityId: null,
        sourceMeetingActivityId: null,
        metadata: {},
        readAt: null,
        createdAt: "2099-10-02T10:00:00Z",
      },
    ]);

    notificationCountQuery = queryResult(3);

    const view = await render(<HomeScreen />);

    expect(view.getByText("Needs your attention")).toBeTruthy();

    expect(view.getByText("Prepare committee agenda")).toBeTruthy();

    expect(
      view.getByRole("button", {
        name: "Accept & start",
      }),
    ).toBeTruthy();

    expect(view.getByText("Monthly committee meeting")).toBeTruthy();

    expect(view.getByText("Meeting updated")).toBeTruthy();

    expect(view.getByText("Account Administration")).toBeTruthy();

    expect(view.getByText("Members")).toBeTruthy();

    await act(async () => fireEvent.press(view.getByText("Account Administration")));

    expect(mockPush).toHaveBeenCalledWith("/accounts");

    await act(async () =>
      fireEvent.press(
        view.getByRole("button", {
          name: "View task",
        }),
      ),
    );

    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/work/[id]",
      params: {
        id: "task-1",
      },
    });

    await act(async () =>
      fireEvent.press(
        view.getByRole("button", {
          name: "View meeting",
        }),
      ),
    );

    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/work/meetings/[id]",
      params: {
        id: "meeting-1",
      },
    });

    await act(async () => fireEvent.press(view.getByLabelText("Notifications, 3 unread")));

    expect(mockPush).toHaveBeenCalledWith("/notifications");

    await view.unmount();
  });

  it("keeps inaccessible sections hidden", async () => {
    capabilityQuery = queryResult({
      ...baseCapabilities,
      canUseReferrals: true,
      canReadDonations: true,
    });

    const view = await render(<HomeScreen />);

    expect(view.getByText("My Profile")).toBeTruthy();

    expect(view.getByText("Referrals")).toBeTruthy();

    expect(view.getByText("Donations")).toBeTruthy();

    expect(view.queryByText("Account Administration")).toBeNull();

    expect(view.queryByText("All work")).toBeNull();

    expect(view.queryByText("Meetings")).toBeNull();

    expect(view.getByText("Nothing urgent right now")).toBeTruthy();

    await view.unmount();
  });

  it("does not surface cached restricted task data", async () => {
    capabilityQuery = queryResult({
      ...baseCapabilities,
      canReadCommitteeMeetings: true,
    });

    taskQuery = queryResult([
      {
        id: "stale-task",
        title: "Stale restricted task",
        status: "assigned",
        assignmentMode: "direct",
        priority: "normal",
        dueDate: null,
        isOverdue: false,
        assigneeIds: ["account-1"],
        updatedAt: "2099-10-01T10:00:00Z",
      },
    ]);

    const view = await render(<HomeScreen />);

    expect(view.queryByText("Stale restricted task")).toBeNull();

    expect(view.queryByText("All work")).toBeNull();

    expect(view.getByRole("button", { name: "Meetings" })).toBeTruthy();

    await view.unmount();
  });

  it("renders capability loading and error recovery states", async () => {
    capabilityQuery = {
      ...queryResult<MobileCapabilities>(undefined, capabilityRefetch),
      isLoading: true,
    };

    const loadingView = await render(<HomeScreen />);

    expect(loadingView.getByLabelText("Preparing your dashboard")).toBeTruthy();

    await loadingView.unmount();

    capabilityQuery = {
      ...queryResult<MobileCapabilities>(undefined, capabilityRefetch),
      isError: true,
    };

    const errorView = await render(<HomeScreen />);

    expect(errorView.getByRole("alert")).toBeTruthy();

    await act(async () =>
      fireEvent.press(
        errorView.getByRole("button", {
          name: "Retry",
        }),
      ),
    );

    expect(capabilityRefetch).toHaveBeenCalledTimes(1);

    await errorView.unmount();
  });

  it("shows a simple caught-up state when there is no pending activity", async () => {
    capabilityQuery = queryResult({
      ...baseCapabilities,
      canReadCommitteeTasks: true,
      canReadCommitteeMeetings: true,
    });

    const view = await render(<HomeScreen />);

    expect(view.getByText("Nothing urgent right now")).toBeTruthy();

    expect(view.getByText("Tasks")).toBeTruthy();

    expect(view.getByRole("button", { name: "Meetings" })).toBeTruthy();

    expect(view.getAllByRole("button", { name: "Notifications" })).toHaveLength(2);

    await view.unmount();
  });
});

function queryResult<T>(data: T | undefined, refetch = jest.fn()) {
  return {
    data,
    isError: false,
    isLoading: false,
    isRefetching: false,
    refetch,
  };
}
