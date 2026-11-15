import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { act, fireEvent, render } from "@testing-library/react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Alert } from "react-native";

import { useAuth } from "../../../../../auth/AuthProvider";
import type { MobileCapabilities } from "../../../../../modules/capabilities";
import type { CommitteeMeetingDetail } from "../../../../../modules/meetings";
import type { CommitteeAssigneeOption } from "../../../../../modules/work";
import CommitteeMeetingDetailScreen from "../../../../../../app/(app)/meetings/[id]/index";

jest.mock("@tanstack/react-query", () => ({
  useMutation: jest.fn(),
  useQuery: jest.fn(),
  useQueryClient: jest.fn(),
}));
jest.mock("expo-router", () => ({
  router: { push: jest.fn() },
  useLocalSearchParams: jest.fn(),
}));
jest.mock("../../../../../auth/AuthProvider", () => ({ useAuth: jest.fn() }));
jest.mock("../../../../../modules/capabilities", () => ({ loadCapabilities: jest.fn() }));
jest.mock("../../../../../modules/meetings", () => ({
  cancelCommitteeMeeting: jest.fn(),
  committeeMeetingAttendanceQueryKey: (id: string) => ["committee-meetings", "attendance", id],
  committeeMeetingDecisionsQueryKey: (id: string) => ["committee-meetings", "decisions", id],
  committeeMeetingResponsesQueryKey: (id: string) => ["committee-meetings", "responses", id],
  committeeMeetingDetailQueryKey: (id: string) => ["committee-meetings", "detail", id],
  committeeMeetingInvalidationKeys: (accountId: string, id: string) => [
    ["committee-meetings", accountId],
    ["committee-meetings", "detail", id],
  ],
  createCommitteeMeetingDecision: jest.fn(),
  createCommitteeMeetingOperationId: () => "meeting-operation",
  getCommitteeMeeting: jest.fn(),
  getCommitteeMeetingAttendance: jest.fn(),
  listCommitteeMeetingDecisions: jest.fn(),
  listCommitteeMeetingResponses: jest.fn(),
  respondToCommitteeMeeting: jest.fn(),
  recordSelfCommitteeMeetingAttendance: jest.fn(),
  recordManualCommitteeMeetingAttendance: jest.fn(),
}));
jest.mock("../../../../../modules/work", () => ({
  committeeAssigneeOptionsQueryKey: () => ["committee-tasks", "assignee-options"],
  committeeTaskListQueryKey: (accountId: string) => ["committee-tasks", accountId],
  createCommitteeMeetingFollowupTask: jest.fn(),
  createCommitteeOperationId: () => "task-operation",
  createOpenCommitteeMeetingFollowupTask: jest.fn(),
  listCommitteeAssigneeOptions: jest.fn(),
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

const baseCapabilities = {
  canReadCommitteeMeetings: true,
  canAdministerCommitteeMeetings: false,
  canRecordCommitteeMeetingAttendance: false,
  canAssignCommitteeTasks: false,
} as MobileCapabilities;

let capabilityQuery = queryResult(baseCapabilities);
let detailQuery = queryResult<CommitteeMeetingDetail>(meetingDetail());
let attendanceQuery = queryResult([attendance("committee-1", "present")]);
let decisionQuery = queryResult([decision()]);
let responseQuery = queryResult([]);
let assigneeQuery = queryResult<CommitteeAssigneeOption[]>([]);
let mutations: ReturnType<typeof mutationState>[] = [];
let mutationOptions: Record<string, unknown>[] = [];

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, "alert");
  mockUseAuth.mockReturnValue({ account: { id: "committee-1" } });
  mockParams.mockReturnValue({ id: "meeting-1" });
  mockUseQueryClient.mockReturnValue({ invalidateQueries });
  capabilityQuery = queryResult(baseCapabilities);
  detailQuery = queryResult(meetingDetail());
  attendanceQuery = queryResult([attendance("committee-1", "present")]);
  decisionQuery = queryResult([decision()]);
  responseQuery = queryResult([]);
  assigneeQuery = queryResult<CommitteeAssigneeOption[]>([]);
  mockUseQuery.mockImplementation(({ queryKey }: { queryKey: unknown[] }) => {
    if (queryKey[0] === "capabilities") return capabilityQuery;
    if (queryKey[0] === "committee-tasks") return assigneeQuery;
    if (queryKey[1] === "attendance") return attendanceQuery;
    if (queryKey[1] === "decisions") return decisionQuery;
    if (queryKey[1] === "responses") return responseQuery;
    return detailQuery;
  });
  mutations = [mutationState(), mutationState(), mutationState(), mutationState(), mutationState(), mutationState()];
  mutationOptions = [];
  mockUseMutation.mockImplementation((options) => {
    const index = mutationOptions.length % mutations.length;
    mutationOptions.push(options);
    return mutations[index];
  });
});

afterEach(() => jest.restoreAllMocks());

describe("Committee meeting detail", () => {
  it("allows an invited member to decline with a reason", async () => {
    const view = await render(<CommitteeMeetingDetailScreen />);
    const decline = view.getByRole("button", { name: "Decline invitation" });
    expect(decline.props.accessibilityState.disabled).toBe(true);
    await act(async () => fireEvent.changeText(
      view.getByPlaceholderText("Why you cannot attend"), "Family commitment",
    ));
    await act(async () => fireEvent.press(decline));
    expect(mutations[2].mutate).toHaveBeenCalledWith({
      response: "declined", reason: "Family commitment",
    });
    await view.unmount();
  });
  it("renders read-only attendance, append-only decisions, and meeting history", async () => {
    const view = await render(<CommitteeMeetingDetailScreen />);

    expect(view.getAllByText("Committee meeting").length).toBeGreaterThan(0);
    expect(view.getByLabelText("Status: Present")).toBeTruthy();
    expect(view.getByLabelText("Status: Not yet recorded")).toBeTruthy();
    expect(view.getByText("Approve maintenance schedule")).toBeTruthy();
    expect(view.queryByRole("button", { name: "Record decision" })).toBeNull();
    expect(view.queryByRole("button", { name: "Present" })).toBeNull();
    expect(view.queryByRole("button", { name: "Edit meeting" })).toBeNull();
    expect(view.queryByText("Edit decision")).toBeNull();
    expect(view.queryByText("Delete decision")).toBeNull();
    await view.unmount();
  });

  it("shows GPS check-in only to an invited unrecorded participant on the scheduled day", async () => {
    detailQuery = queryResult(meetingDetail({ scheduledStart: new Date().toISOString() }));
    attendanceQuery = queryResult([]);
    const view = await render(<CommitteeMeetingDetailScreen />);
    expect(view.getByRole("button", { name: "Check in with GPS" })).toBeTruthy();
    expect(view.queryByRole("button", { name: "Absent" })).toBeNull();
    expect(view.queryByRole("button", { name: "Mark present manually" })).toBeNull();
    await act(async () => fireEvent.press(view.getByRole("button", { name: "Check in with GPS" })));
    expect(mutations[0].mutate).toHaveBeenCalled();
    await view.unmount();
  });

  it("requires a reason for the creator's manual exception", async () => {
    detailQuery = queryResult(meetingDetail({ scheduledStart: new Date().toISOString(), createdByApplicationUserId: "committee-1" }));
    attendanceQuery = queryResult([]);
    const view = await render(<CommitteeMeetingDetailScreen />);
    expect(view.queryByRole("button", { name: "Mark present manually" })).toBeNull();
    await act(async () => fireEvent.changeText(view.getByPlaceholderText("Why is GPS check-in unavailable?"), "GPS signal unavailable"));
    expect(view.getAllByRole("button", { name: "Mark present manually" })).toHaveLength(2);
    await act(async () => fireEvent.press(view.getAllByRole("button", { name: "Mark present manually" })[1]));
    expect(mutations[1].mutate).toHaveBeenCalledWith("committee-2");
    await view.unmount();
  });

  it("shows manager create/edit/cancel and direct/open follow-up controls", async () => {
    capabilityQuery = queryResult({
      ...baseCapabilities,
      canAdministerCommitteeMeetings: true,
      canRecordCommitteeMeetingAttendance: true,
      canAssignCommitteeTasks: true,
    });
    assigneeQuery = queryResult([
      {
        applicationUserId: "committee-1",
        displayName: "Committee One",
        roleLabel: "Committee Member",
      },
    ]);
    const view = await render(<CommitteeMeetingDetailScreen />);

    await act(async () => fireEvent.press(view.getByRole("button", { name: "Edit meeting" })));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/meetings/[id]/edit",
      params: { id: "meeting-1" },
    });
    expect(view.getByRole("button", { name: "Direct assignment" })).toBeTruthy();
    expect(view.getByRole("button", { name: "Open volunteer" })).toBeTruthy();

    const cancelButton = view.getByRole("button", { name: "Cancel meeting" });
    expect(cancelButton.props.accessibilityState.disabled).toBe(true);
    await act(async () =>
      fireEvent.changeText(view.getByPlaceholderText("Cancellation reason"), "Schedule conflict"),
    );
    await act(async () => fireEvent.press(view.getByRole("button", { name: "Cancel meeting" })));
    const actions = (Alert.alert as jest.Mock).mock.calls.at(-1)[2];
    await act(async () => actions[1].onPress());
    expect(mutations[4].mutate).toHaveBeenCalledWith("Schedule conflict");
    await view.unmount();
  });

  it("disables attendance and other mutation actions while a mutation is pending", async () => {
    capabilityQuery = queryResult({
      ...baseCapabilities,
      canAdministerCommitteeMeetings: true,
      canRecordCommitteeMeetingAttendance: true,
    });
    detailQuery = queryResult(meetingDetail({ scheduledStart: new Date().toISOString() }));
    attendanceQuery = queryResult([]);
    mutations[0] = mutationState(true);
    const view = await render(<CommitteeMeetingDetailScreen />);

    expect(
      view.getByRole("button", { name: "Check in with GPS" }).props.accessibilityState.disabled,
    ).toBe(true);
    expect(
      view.getByRole("button", { name: "Record decision" }).props.accessibilityState.disabled,
    ).toBe(true);
    await view.unmount();
  });

  it("keeps cancelled meeting history readable while hiding mutation controls", async () => {
    capabilityQuery = queryResult({
      ...baseCapabilities,
      canAdministerCommitteeMeetings: true,
      canRecordCommitteeMeetingAttendance: true,
      canAssignCommitteeTasks: true,
    });
    detailQuery = queryResult(
      meetingDetail({
        status: "cancelled",
        cancellationReason: "Schedule conflict",
      }),
    );
    const view = await render(<CommitteeMeetingDetailScreen />);

    expect(view.getByText("Schedule conflict")).toBeTruthy();
    expect(view.queryByRole("button", { name: "Edit meeting" })).toBeNull();
    expect(view.queryByRole("button", { name: "Present" })).toBeNull();
    expect(view.queryByRole("button", { name: "Record decision" })).toBeNull();
    expect(view.getByText("Follow-up task")).toBeTruthy();
    await view.unmount();
  });
});

function mutationState(isPending = false, variables?: unknown) {
  return { isPending, mutate: jest.fn(), variables };
}

function queryResult<T>(data: T | undefined, refetch = jest.fn()) {
  return { data, isError: false, isLoading: false, isRefetching: false, refetch };
}

function meetingDetail(overrides: Partial<CommitteeMeetingDetail> = {}): CommitteeMeetingDetail {
  return {
    id: "meeting-1",
    title: "Committee meeting",
    meetingType: "general",
    details: "Monthly agenda",
    location: "Hall",
    scheduledStart: "2099-10-20T13:00:00Z",
    scheduledEnd: "2099-10-20T14:00:00Z",
    status: "scheduled",
    createdByApplicationUserId: "manager-1",
    cancelledByApplicationUserId: null,
    cancelledAt: null,
    cancellationReason: null,
    createdAt: "2099-10-01T10:00:00Z",
    updatedAt: "2099-10-01T10:00:00Z",
    participantIds: ["committee-1", "committee-2"],
    participants: [
      {
        applicationUserId: "committee-1",
        displayName: "Committee One",
        roleLabel: "Committee Member",
        assignedAt: "2099-10-01T10:00:00Z",
      },
      {
        applicationUserId: "committee-2",
        displayName: "Committee Two",
        roleLabel: "Committee Member",
        assignedAt: "2099-10-01T10:00:00Z",
      },
    ],
    attendance: [],
    activity: [
      {
        id: "activity-1",
        meetingId: "meeting-1",
        actorApplicationUserId: "manager-1",
        activityType: "meeting_created",
        details: {},
        operationId: "operation-1",
        createdAt: "2099-10-01T10:00:00Z",
      },
    ],
    ...overrides,
  };
}

function attendance(applicationUserId: string, attendanceStatus: "present" | "absent") {
  return {
    id: `attendance-${applicationUserId}`,
    meetingId: "meeting-1",
    applicationUserId,
    attendanceStatus,
    recordedByApplicationUserId: "secretary-1",
    recordedAt: "2099-10-20T13:30:00Z",
    operationId: `operation-${applicationUserId}`,
  };
}

function decision() {
  return {
    id: "decision-1",
    meetingId: "meeting-1",
    decisionText: "Approve maintenance schedule",
    createdByApplicationUserId: "secretary-1",
    operationId: "decision-operation",
    createdAt: "2099-10-20T13:45:00Z",
  };
}
