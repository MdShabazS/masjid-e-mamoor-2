import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { act, fireEvent, render } from "@testing-library/react-native";
import { Alert } from "react-native";
import { router, useLocalSearchParams } from "expo-router";

import { useAuth } from "../../../../auth/AuthProvider";
import type { MobileCapabilities } from "../../../../modules/capabilities";
import type { CommitteeTaskDetail } from "../../../../modules/work";
import CommitteeTaskDetailScreen from "../../../../../app/(app)/work/[id]/index";

jest.mock("@tanstack/react-query", () => ({
  useMutation: jest.fn(),
  useQuery: jest.fn(),
  useQueryClient: jest.fn(),
}));
jest.mock("expo-router", () => ({
  router: { push: jest.fn() },
  useLocalSearchParams: jest.fn(),
}));
jest.mock("../../../../auth/AuthProvider", () => ({ useAuth: jest.fn() }));
jest.mock("../../../../modules/capabilities", () => ({
  loadCapabilities: jest.fn(),
}));
jest.mock("../../../../modules/work", () => ({
  addCommitteeTaskProgress: jest.fn(),
  claimOpenCommitteeTask: jest.fn(),
  committeeTaskDetailQueryKey: (taskId: string) => ["committee-tasks", "detail", taskId],
  committeeTaskListQueryKey: (accountId: string | undefined) => ["committee-tasks", accountId],
  completeCommitteeTask: jest.fn(),
  createCommitteeOperationId: () => "operation-id",
  getCommitteeTask: jest.fn(),
  startCommitteeTask: jest.fn(),
}));
jest.mock("react-native-keyboard-controller", () => {
  const ReactNative = jest.requireActual("react-native");
  return { KeyboardAwareScrollView: ReactNative.ScrollView };
});

const mockUseMutation = useMutation as jest.Mock;
const mockUseQuery = useQuery as jest.Mock;
const mockUseQueryClient = useQueryClient as jest.Mock;
const mockUseAuth = useAuth as jest.Mock;
const mockParams = useLocalSearchParams as jest.Mock;
const mockPush = router.push as jest.Mock;
const invalidateQueries = jest.fn().mockResolvedValue(undefined);
const capabilityRefetch = jest.fn();
const taskRefetch = jest.fn();

const baseCapabilities = {
  canReadCommitteeTasks: true,
  canManageCommitteeTasks: true,
  canAssignCommitteeTasks: false,
} as MobileCapabilities;

let capabilityQuery = queryResult(baseCapabilities, capabilityRefetch);
let taskQuery = queryResult<CommitteeTaskDetail>(taskDetail(), taskRefetch);
let mutations: ReturnType<typeof mutationState>[] = [];
let mutationOptions: Record<string, unknown>[] = [];

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, "alert");
  mockUseAuth.mockReturnValue({ account: { id: "committee-1" } });
  mockParams.mockReturnValue({ id: "task-1" });
  mockUseQueryClient.mockReturnValue({ invalidateQueries });
  capabilityQuery = queryResult(baseCapabilities, capabilityRefetch);
  taskQuery = queryResult(taskDetail(), taskRefetch);
  mockUseQuery.mockImplementation(({ queryKey }: { queryKey: unknown[] }) =>
    queryKey[0] === "capabilities" ? capabilityQuery : taskQuery,
  );
  mutations = [mutationState(), mutationState(), mutationState(), mutationState()];
  mutationOptions = [];
  mockUseMutation.mockImplementation((options) => {
    mutationOptions.push(options);
    return mutations[mutationOptions.length - 1];
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("Committee task detail", () => {
  it("shows meeting context and allows an eligible open-task claim", async () => {
    taskQuery = queryResult(
      taskDetail({
        assignmentMode: "open",
        status: "open",
        assigneeIds: [],
        assignees: [],
        sourceMeetingId: "meeting-1",
        sourceMeetingDecisionId: "decision-1",
      }),
      taskRefetch,
    );

    const view = await render(<CommitteeTaskDetailScreen />);

    expect(view.getByText("Follow-up from a committee meeting decision")).toBeTruthy();
    expect(view.getByRole("button", { name: "Claim task" })).toBeTruthy();
    expect(view.queryByRole("button", { name: "Edit task" })).toBeNull();
    expect(view.queryByRole("button", { name: "Start task" })).toBeNull();

    await act(async () => fireEvent.press(view.getByRole("button", { name: "Claim task" })));
    const actions = (Alert.alert as jest.Mock).mock.calls[0][2];
    await act(async () => actions[1].onPress());
    expect(mutations[1].mutate).toHaveBeenCalledWith("operation-id");

    await act(async () => {
      await (mutationOptions[1].onSuccess as () => Promise<void>)();
    });
    expect(invalidateQueries).toHaveBeenCalledTimes(2);
    await view.unmount();
  });

  it("shows assigned-user actions without manager controls", async () => {
    const view = await render(<CommitteeTaskDetailScreen />);

    expect(view.getByRole("button", { name: "Start task" })).toBeTruthy();
    expect(view.getByRole("button", { name: "Add progress" })).toBeTruthy();
    expect(view.queryByRole("button", { name: "Complete task" })).toBeNull();
    expect(view.queryByRole("button", { name: "Edit task" })).toBeNull();
    await view.unmount();
  });

  it("shows manager edit navigation and state-valid completion controls", async () => {
    mockUseAuth.mockReturnValue({ account: { id: "manager-1" } });
    capabilityQuery = queryResult({
      ...baseCapabilities,
      canAssignCommitteeTasks: true,
    });
    taskQuery = queryResult(taskDetail({ status: "in_progress" }));

    const view = await render(<CommitteeTaskDetailScreen />);

    expect(view.queryByRole("button", { name: "Start task" })).toBeNull();
    expect(view.getByRole("button", { name: "Add progress" })).toBeTruthy();
    expect(view.getByRole("button", { name: "Complete task" })).toBeTruthy();
    await act(async () => fireEvent.press(view.getByRole("button", { name: "Edit task" })));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/work/[id]/edit",
      params: { id: "task-1" },
    });
    await view.unmount();
  });

  it("disables all mutation actions while one mutation is pending", async () => {
    mutations[0] = mutationState(true);
    taskQuery = queryResult(taskDetail({ status: "in_progress" }));

    const view = await render(<CommitteeTaskDetailScreen />);

    expect(
      view.getByRole("button", { name: "Add progress" }).props.accessibilityState.disabled,
    ).toBe(true);
    expect(
      view.getByRole("button", { name: "Complete task" }).props.accessibilityState.disabled,
    ).toBe(true);
    await view.unmount();
  });
});

function mutationState(isPending = false) {
  return { isPending, mutate: jest.fn() };
}

function queryResult<T>(data: T | undefined, refetch = jest.fn()) {
  return {
    data,
    isError: false,
    isLoading: false,
    isRefetching: false,
    refetch,
  };
}

function taskDetail(overrides: Partial<CommitteeTaskDetail> = {}): CommitteeTaskDetail {
  return {
    id: "task-1",
    title: "Prepare committee agenda",
    description: "Compile agenda items before the meeting.",
    priority: "high",
    status: "assigned",
    assignmentMode: "direct",
    dueDate: "2099-10-12",
    isOverdue: false,
    sourceMeetingId: null,
    sourceMeetingDecisionId: null,
    createdByApplicationUserId: "manager-1",
    completedByApplicationUserId: null,
    completedAt: null,
    createdAt: "2099-10-01T10:00:00Z",
    updatedAt: "2099-10-01T10:00:00Z",
    assigneeIds: ["committee-1"],
    assignees: [
      {
        id: "assignment-1",
        applicationUserId: "committee-1",
        displayName: "Committee One",
        roleLabel: "Committee Member",
        assignedAt: "2099-10-01T10:00:00Z",
        removedAt: null,
      },
    ],
    activity: [],
    ...overrides,
  };
}
