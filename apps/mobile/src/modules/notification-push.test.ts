import {
  getEasProjectId,
  getPushInstallationId,
  registerCurrentPushDevice,
  resolvePushPlatform,
  unregisterCurrentPushDevice,
} from "./notification-push";
import { secureStore } from "../lib/secure-store";
import * as Crypto from "expo-crypto";
import * as Notifications from "expo-notifications";
import { supabase } from "../lib/supabase";

jest.mock("../lib/secure-store", () => ({
  secureStore: { getItem: jest.fn(), setItem: jest.fn() },
}));

jest.mock("expo-crypto", () => ({ randomUUID: jest.fn(() => "install-uuid") }));

jest.mock("expo-constants", () => ({
  __esModule: true,
  default: { expoConfig: { extra: { eas: { projectId: "project-1" } } }, easConfig: null },
}));

jest.mock("expo-notifications", () => ({
  AndroidImportance: { DEFAULT: 3 },
  setNotificationChannelAsync: jest.fn(),
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  getExpoPushTokenAsync: jest.fn(),
}));

jest.mock("../lib/supabase", () => ({ supabase: { rpc: jest.fn() } }));

const rpc = supabase.rpc as jest.Mock;
const getPermissions = Notifications.getPermissionsAsync as jest.Mock;
const requestPermissions = Notifications.requestPermissionsAsync as jest.Mock;
const getExpoToken = Notifications.getExpoPushTokenAsync as jest.Mock;

describe("push notification registration primitives", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    rpc.mockResolvedValue({ data: true, error: null });
  });

  it("allows only supported native platforms", () => {
    expect(resolvePushPlatform("android")).toBe("android");
    expect(resolvePushPlatform("ios")).toBe("ios");
    expect(resolvePushPlatform("web")).toBeNull();
  });

  it("uses the configured EAS project ID", () => {
    expect(getEasProjectId()).toBe("project-1");
  });

  it("persists one stable installation identifier without exposing it as a token", async () => {
    (secureStore.getItem as jest.Mock).mockResolvedValueOnce(null);

    await expect(getPushInstallationId()).resolves.toBe("install-uuid");
    expect(Crypto.randomUUID).toHaveBeenCalledTimes(1);
    expect(secureStore.setItem).toHaveBeenCalledWith(
      "notification.installation-id",
      "install-uuid",
    );

    (secureStore.getItem as jest.Mock).mockResolvedValueOnce("existing-id");
    await expect(getPushInstallationId()).resolves.toBe("existing-id");
    expect(Crypto.randomUUID).toHaveBeenCalledTimes(1);
  });

  it("registers only the current device token through the authenticated RPC", async () => {
    getPermissions.mockResolvedValue({ status: "granted" });
    getExpoToken.mockResolvedValue({ data: "ExponentPushToken[valid-test-token]" });
    (secureStore.getItem as jest.Mock).mockResolvedValue("install-uuid");

    await expect(registerCurrentPushDevice("android")).resolves.toBe(true);

    expect(Notifications.setNotificationChannelAsync).toHaveBeenCalledWith(
      "default",
      expect.objectContaining({ name: "Masjid E Mamoor 2 updates" }),
    );
    expect(getExpoToken).toHaveBeenCalledWith({ projectId: "project-1" });
    expect(rpc).toHaveBeenCalledWith("register_my_notification_push_device", {
      p_device_id: "install-uuid",
      p_platform: "android",
      p_expo_push_token: "ExponentPushToken[valid-test-token]",
    });
  });

  it("asks only while permission is undetermined and skips registration when denied", async () => {
    getPermissions.mockResolvedValue({ status: "undetermined" });
    requestPermissions.mockResolvedValue({ status: "denied" });

    await expect(registerCurrentPushDevice("ios")).resolves.toBe(false);
    expect(requestPermissions).toHaveBeenCalledTimes(1);
    expect(getExpoToken).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("unregisters the installation without passing account identity", async () => {
    (secureStore.getItem as jest.Mock).mockResolvedValue("install-uuid");

    await unregisterCurrentPushDevice();

    expect(rpc).toHaveBeenCalledWith("unregister_my_notification_push_device", {
      p_device_id: "install-uuid",
    });
  });
});
