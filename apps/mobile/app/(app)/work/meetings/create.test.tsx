import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { act, fireEvent, render } from "@testing-library/react-native";
import { router } from "expo-router";

import { useAuth } from "../../../../src/auth/AuthProvider";
import CreateCommitteeMeetingScreen from "./create";

jest.mock("@tanstack/react-query", () => ({
  useMutation: jest.fn(),
  useQuery: jest.fn(),
  useQueryClient: jest.fn(),
}));
jest.mock("expo-router", () => ({ router: { replace: jest.fn() } }));
jest.mock("../../../../src/auth/AuthProvider", () => ({ useAuth: jest.fn() }));
jest.mock("../../../../src/modules/capabilities", () => ({ loadCapabilities: jest.fn() }));
jest.mock("../../../../src/modules/meetings", () => ({
  committeeMeetingListQueryKey: (accountId: string) => ["committee-meetings", accountId],
  committeeMeetingParticipantOptionsQueryKey: () => ["committee-meetings", "participant-options"],
  createCommitteeMeeting: jest.fn(),
  createCommitteeMeetingOperationId: () => "meeting-operation",
  listCommitteeMeetingParticipantOptions: jest.fn(),
}));
jest.mock("react-native-keyboard-controller", () => {
  const ReactNative = jest.requireActual("react-native");
  return { KeyboardAwareScrollView: ReactNative.ScrollView };
});

const mockUseMutation = useMutation as jest.Mock;
const mockUseQuery = useQuery as jest.Mock;
const mockUseQueryClient = useQueryClient as jest.Mock;
const mockUseAuth = useAuth as jest.Mock;
const mockReplace = router.replace as jest.Mock;
const invalidateQueries = jest.fn().mockResolvedValue(undefined);
const mutate = jest.fn();
let mutationOptions: Record<string, unknown>;

beforeEach(() => {
  jest.clearAllMocks();
  mockUseAuth.mockReturnValue({ account: { id: "manager-1" } });
  mockUseQueryClient.mockReturnValue({ invalidateQueries });
  mockUseQuery.mockImplementation(({ queryKey }: { queryKey: unknown[] }) =>
    queryKey[0] === "capabilities"
      ? queryResult({ canAdministerCommitteeMeetings: true })
      : queryResult([
          {
            applicationUserId: "committee-1",
            displayName: "Committee One",
            roleLabel: "Committee Member",
          },
        ]),
  );
  mockUseMutation.mockImplementation((options) => {
    mutationOptions = options;
    return { isPending: false, mutate };
  });
});

describe("Create committee meeting", () => {
  it("submits the existing meeting form once and invalidates the authorized list", async () => {
    const view = await render(<CreateCommitteeMeetingScreen />);

    await act(async () =>
      fireEvent.changeText(view.getByPlaceholderText("Meeting title"), "Monthly meeting"),
    );
    await act(async () =>
      fireEvent.changeText(
        view.getByPlaceholderText("2026-10-20T13:00:00+05:30"),
        "2026-10-20T13:00:00+05:30",
      ),
    );
    await act(async () => fireEvent.press(view.getByRole("checkbox")));
    await act(async () => fireEvent.press(view.getByRole("button", { name: "Create meeting" })));
    expect(mutate).toHaveBeenCalledTimes(1);

    await act(async () => {
      await (mutationOptions.onSuccess as (meeting: { id: string }) => Promise<void>)({
        id: "meeting-new",
      });
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["committee-meetings", "manager-1"],
    });
    expect(mockReplace).toHaveBeenCalledWith({
      pathname: "/work/meetings/[id]",
      params: { id: "meeting-new" },
    });
    await view.unmount();
  });
});

function queryResult<T>(data: T) {
  return {
    data,
    isError: false,
    isLoading: false,
    isRefetching: false,
    refetch: jest.fn(),
  };
}
