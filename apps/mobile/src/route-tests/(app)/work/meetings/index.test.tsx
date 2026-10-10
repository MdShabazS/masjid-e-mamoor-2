import { useQuery } from "@tanstack/react-query";
import { act, fireEvent, render } from "@testing-library/react-native";
import { router } from "expo-router";

import { useAuth } from "../../../../auth/AuthProvider";
import type { MobileCapabilities } from "../../../../modules/capabilities";
import type { CommitteeMeetingSummary } from "../../../../modules/meetings";
import CommitteeMeetingsScreen from "../../../../../app/(app)/work/meetings/index";

jest.mock("@tanstack/react-query", () => ({ useQuery: jest.fn() }));
jest.mock("expo-router", () => ({ router: { push: jest.fn() } }));
jest.mock("../../../../auth/AuthProvider", () => ({ useAuth: jest.fn() }));
jest.mock("../../../../modules/capabilities", () => ({ loadCapabilities: jest.fn() }));
jest.mock("../../../../modules/meetings", () => ({
  committeeMeetingListQueryKey: (accountId: string | undefined) => [
    "committee-meetings",
    accountId,
  ],
  listCommitteeMeetings: jest.fn(),
}));
jest.mock("react-native-keyboard-controller", () => {
  const ReactNative = jest.requireActual("react-native");
  return { KeyboardAwareScrollView: ReactNative.ScrollView };
});

const mockUseQuery = useQuery as jest.Mock;
const mockUseAuth = useAuth as jest.Mock;
const mockPush = router.push as jest.Mock;
const refetch = jest.fn();

const capabilities = {
  canReadCommitteeMeetings: true,
  canAdministerCommitteeMeetings: false,
} as MobileCapabilities;

let capabilityQuery = queryResult(capabilities);
let meetingQuery = queryResult<CommitteeMeetingSummary[]>([]);

beforeEach(() => {
  jest.clearAllMocks();
  mockUseAuth.mockReturnValue({ account: { id: "committee-1" } });
  capabilityQuery = queryResult(capabilities);
  meetingQuery = queryResult([], refetch);
  mockUseQuery.mockImplementation(({ queryKey }: { queryKey: unknown[] }) =>
    queryKey[0] === "capabilities" ? capabilityQuery : meetingQuery,
  );
});

describe("Committee meetings list", () => {
  it("renders upcoming, past, and cancelled groups and opens canonical detail", async () => {
    meetingQuery = queryResult([
      meeting({
        id: "upcoming",
        title: "Upcoming meeting",
        scheduledStart: "2099-10-20T10:00:00Z",
      }),
      meeting({ id: "past", title: "Past meeting", scheduledStart: "2020-10-01T10:00:00Z" }),
      meeting({ id: "cancelled", title: "Cancelled meeting", status: "cancelled" }),
    ]);
    const view = await render(<CommitteeMeetingsScreen />);

    expect(view.getByText("Upcoming")).toBeTruthy();
    expect(view.getAllByText("Past").length).toBeGreaterThan(0);
    expect(view.getAllByText("Cancelled").length).toBeGreaterThan(0);
    expect(view.queryByRole("button", { name: "Create meeting" })).toBeNull();

    await act(async () => fireEvent.press(view.getByText("Upcoming meeting")));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/work/meetings/[id]",
      params: { id: "upcoming" },
    });
    await view.unmount();
  });

  it("shows create navigation only to meeting administrators", async () => {
    capabilityQuery = queryResult({ ...capabilities, canAdministerCommitteeMeetings: true });
    meetingQuery = queryResult([meeting()]);
    const view = await render(<CommitteeMeetingsScreen />);

    await act(async () => fireEvent.press(view.getByRole("button", { name: "Create meeting" })));
    expect(mockPush).toHaveBeenCalledWith("/work/meetings/create");
    await view.unmount();
  });

  it("renders loading, empty, and retryable error states", async () => {
    meetingQuery = { ...queryResult<CommitteeMeetingSummary[]>(undefined), isLoading: true };
    const loading = await render(<CommitteeMeetingsScreen />);
    expect(loading.getByLabelText("Loading meetings")).toBeTruthy();
    await loading.unmount();

    meetingQuery = queryResult([]);
    const empty = await render(<CommitteeMeetingsScreen />);
    expect(empty.getByText("No meetings available")).toBeTruthy();
    await empty.unmount();

    meetingQuery = { ...queryResult<CommitteeMeetingSummary[]>(undefined, refetch), isError: true };
    const error = await render(<CommitteeMeetingsScreen />);
    await act(async () => fireEvent.press(error.getByRole("button", { name: "Retry" })));
    expect(refetch).toHaveBeenCalledTimes(1);
    await error.unmount();
  });
});

function meeting(overrides: Partial<CommitteeMeetingSummary> = {}): CommitteeMeetingSummary {
  return {
    id: "meeting-1",
    title: "Committee meeting",
    meetingType: "general",
    details: null,
    location: "Hall",
    scheduledStart: "2099-10-20T10:00:00Z",
    scheduledEnd: null,
    status: "scheduled",
    createdByApplicationUserId: "manager-1",
    cancelledByApplicationUserId: null,
    cancelledAt: null,
    cancellationReason: null,
    createdAt: "2099-10-01T10:00:00Z",
    updatedAt: "2099-10-01T10:00:00Z",
    participantIds: ["committee-1"],
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
