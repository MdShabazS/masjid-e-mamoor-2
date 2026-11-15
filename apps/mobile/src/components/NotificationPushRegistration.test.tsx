import { act, render, waitFor } from "@testing-library/react-native";
import * as Notifications from "expo-notifications";
import { NotificationPushRegistration } from "./NotificationPushRegistration";
import { useAuth } from "../auth/AuthProvider";
import { registerCurrentPushDevice } from "../modules/notification-push";

jest.mock("expo-notifications", () => ({
  setNotificationHandler: jest.fn(),
  getLastNotificationResponseAsync: jest.fn(),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
}));

jest.mock("expo-router", () => ({
  router: { push: jest.fn() },
  useRouter: () => jest.requireMock("expo-router").router,
}));
jest.mock("../auth/AuthProvider", () => ({ useAuth: jest.fn() }));
jest.mock("../modules/notification-push", () => ({ registerCurrentPushDevice: jest.fn() }));
jest.mock("../lib/supabase", () => ({ supabase: { rpc: jest.fn() } }));

const mockUseAuth = useAuth as jest.Mock;
const mockGetLastResponse = Notifications.getLastNotificationResponseAsync as jest.Mock;
const mockRouterPush = jest.requireMock("expo-router").router.push as jest.Mock;

const response = (targetPath: unknown) => ({
  notification: {
    request: {
      identifier: "notification-response-1",
      content: { data: { target_path: targetPath } },
    },
  },
});

beforeEach(() => {
  jest.clearAllMocks();
  mockUseAuth.mockReturnValue({
    account: { id: "account-1", status: "active", mustChangePassword: false },
    session: { user: { id: "auth-1" } },
  });
  mockGetLastResponse.mockResolvedValue(null);
  jest.mocked(registerCurrentPushDevice).mockResolvedValue(true);
});

describe("NotificationPushRegistration", () => {
  it("registers after authentication and opens a safe notification target", async () => {
    mockGetLastResponse.mockResolvedValue(response("/work/tasks"));

    await render(<NotificationPushRegistration />);

    await waitFor(() => {
      expect(registerCurrentPushDevice).toHaveBeenCalledTimes(1);
      expect(mockRouterPush).toHaveBeenCalledWith("/work/tasks");
    });
  });

  it("holds a tapped target until sign-in and forced password change are complete", async () => {
    mockUseAuth.mockReturnValue({ account: null, session: null });
    mockGetLastResponse.mockResolvedValue(response("/work/tasks"));
    const view = await render(<NotificationPushRegistration />);

    await waitFor(() => expect(Notifications.addNotificationResponseReceivedListener).toHaveBeenCalled());
    expect(mockRouterPush).not.toHaveBeenCalled();

    mockUseAuth.mockReturnValue({
      account: { id: "account-1", status: "active", mustChangePassword: true },
      session: { user: { id: "auth-1" } },
    });
    await act(async () => {
      await view.rerender(<NotificationPushRegistration />);
    });
    expect(mockRouterPush).not.toHaveBeenCalled();

    mockUseAuth.mockReturnValue({
      account: { id: "account-1", status: "active", mustChangePassword: false },
      session: { user: { id: "auth-1" } },
    });
    await act(async () => {
      await view.rerender(<NotificationPushRegistration />);
    });
    await waitFor(() => expect(mockRouterPush).toHaveBeenCalledWith("/work/tasks"));
  });

  it("sanitizes unsafe push targets before navigation", async () => {
    mockGetLastResponse.mockResolvedValue(response("https://malicious.invalid"));

    await render(<NotificationPushRegistration />);

    await waitFor(() => expect(mockRouterPush).toHaveBeenCalledWith("/notifications"));
  });
});
