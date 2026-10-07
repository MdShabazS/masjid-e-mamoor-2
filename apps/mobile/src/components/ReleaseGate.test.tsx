import { useQuery } from "@tanstack/react-query";
import { act, fireEvent, render } from "@testing-library/react-native";
import { createElement } from "react";
import { AppState, Linking, Text } from "react-native";

import type { MobileReleaseStatus } from "../modules/release";
import { ReleaseGate } from "./ReleaseGate";

jest.mock("@tanstack/react-query", () => ({
  useQuery: jest.fn(),
}));

jest.mock("../modules/release", () => ({
  getMobileReleaseStatus: jest.fn(),
  mobileReleaseQueryKey: ["mobile-release-status"],
  safeHttpsStoreUrl: (
    value: string | null | undefined,
    platform: "android" | "ios" | null | undefined,
  ) => {
    if (!value || !platform) return null;
    try {
      const url = new URL(value);
      if (url.protocol !== "https:" || url.username || url.password || url.port) {
        return null;
      }
      const allowedHost = platform === "android" ? "play.google.com" : "apps.apple.com";
      return url.hostname === allowedHost ? url.toString() : null;
    } catch {
      return null;
    }
  },
}));

const mockUseQuery = useQuery as jest.Mock;
const mockRefetch = jest.fn();
const removeAppStateListener = jest.fn();

const baseStatus: MobileReleaseStatus = {
  platform: "android",
  currentVersion: "1.0.0",
  latestVersion: "1.1.0",
  minimumSupportedVersion: "1.0.0",
  updateStatus: "none",
  storeUrl: "https://play.google.com/store/apps/details?id=example",
  updateMessage: "A newer version is available.",
  policyUpdatedAt: "2026-10-07T08:00:00Z",
};

describe("ReleaseGate", () => {
  let appStateHandler: ((state: string) => void) | undefined;
  let openUrl: jest.SpyInstance;
  let queryResult: {
    data: MobileReleaseStatus | null | undefined;
    error: Error | null;
    isFetching: boolean;
    refetch: typeof mockRefetch;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    appStateHandler = undefined;
    queryResult = {
      data: baseStatus,
      error: null,
      isFetching: false,
      refetch: mockRefetch,
    };
    mockRefetch.mockResolvedValue({ data: baseStatus });
    mockUseQuery.mockImplementation(() => queryResult);

    jest.spyOn(AppState, "addEventListener").mockImplementation((_type, handler) => {
      appStateHandler = handler as (state: string) => void;
      return {
        remove: removeAppStateListener,
      } as ReturnType<typeof AppState.addEventListener>;
    });
    openUrl = jest.spyOn(Linking, "openURL").mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("renders the app normally when no update is needed", async () => {
    const view = await renderGate();

    expect(view.getByText("Application content")).toBeTruthy();
    expect(view.queryByText("A newer version is ready")).toBeNull();
  });

  it("shows a non-blocking optional update and dismisses it", async () => {
    queryResult.data = { ...baseStatus, updateStatus: "optional" };
    const view = await renderGate();

    expect(view.getByText("Application content")).toBeTruthy();
    expect(view.getByText("A newer version is ready")).toBeTruthy();

    await act(async () => fireEvent.press(view.getByText("Later")));
    expect(view.queryByText("A newer version is ready")).toBeNull();
  });

  it("prompts again when a newer latest version is returned", async () => {
    queryResult.data = { ...baseStatus, updateStatus: "optional" };
    const view = await renderGate();

    await act(async () => fireEvent.press(view.getByText("Later")));

    queryResult = {
      ...queryResult,
      data: {
        ...baseStatus,
        latestVersion: "1.2.0",
        updateStatus: "optional",
      },
    };
    await view.rerender(releaseGateElement());

    expect(view.getByText("Version 1.2.0 is available.")).toBeTruthy();
  });

  it("blocks application content for a required update without dismissal", async () => {
    queryResult.data = {
      ...baseStatus,
      minimumSupportedVersion: "1.1.0",
      updateStatus: "required",
    };
    const view = await renderGate();

    expect(view.getByText("Please update to continue")).toBeTruthy();
    expect(view.queryByText("Application content")).toBeNull();
    expect(view.queryByText("Later")).toBeNull();
    expect(view.getByText("Installed")).toBeTruthy();
    expect(view.getByText("Minimum required")).toBeTruthy();
  });

  it("opens only a valid HTTPS store URL", async () => {
    queryResult.data = { ...baseStatus, updateStatus: "optional" };
    const view = await renderGate();

    await act(async () => fireEvent.press(view.getByText("Update now")));
    expect(openUrl).toHaveBeenCalledWith(baseStatus.storeUrl);
  });

  it("rejects unsafe store URLs", async () => {
    queryResult.data = {
      ...baseStatus,
      storeUrl: "https://example.com/fake-update",
      updateStatus: "optional",
    };
    const view = await renderGate();

    expect(view.getByText("A newer version is ready")).toBeTruthy();
    expect(view.queryByText("Update now")).toBeNull();
    expect(openUrl).not.toHaveBeenCalled();
  });

  it("keeps a required update blocked when the store URL is missing", async () => {
    queryResult.data = {
      ...baseStatus,
      minimumSupportedVersion: "1.1.0",
      storeUrl: null,
      updateStatus: "required",
    };
    const view = await renderGate();

    expect(view.queryByText("Application content")).toBeNull();
    expect(view.getByText(/app store link is not available/i)).toBeTruthy();

    await act(async () => fireEvent.press(view.getByText("Retry")));
    expect(mockRefetch).toHaveBeenCalledWith({ cancelRefetch: false });
    expect(view.queryByText("Application content")).toBeNull();
  });

  it("fails open when the initial RPC check fails", async () => {
    queryResult = {
      ...queryResult,
      data: undefined,
      error: new Error("network_error"),
    };
    const view = await renderGate();

    expect(view.getByText("Application content")).toBeTruthy();
    expect(view.queryByText("Please update to continue")).toBeNull();
  });

  it("stays blocked when a later check fails after a required decision", async () => {
    queryResult = {
      ...queryResult,
      data: {
        ...baseStatus,
        minimumSupportedVersion: "1.1.0",
        updateStatus: "required",
      },
      error: new Error("network_error"),
    };
    const view = await renderGate();

    expect(view.getByText("Please update to continue")).toBeTruthy();
    expect(view.queryByText("Application content")).toBeNull();
  });

  it("re-checks authoritatively when the app enters the foreground", async () => {
    await renderGate();

    await act(async () => appStateHandler?.("active"));
    expect(mockRefetch).toHaveBeenCalledWith({ cancelRefetch: false });
  });

  it("does not start a duplicate foreground check while fetching", async () => {
    queryResult.isFetching = true;
    await renderGate();

    await act(async () => appStateHandler?.("active"));
    expect(mockRefetch).not.toHaveBeenCalled();
  });

  it("removes the AppState listener on unmount", async () => {
    const view = await renderGate();

    await view.unmount();
    expect(removeAppStateListener).toHaveBeenCalledTimes(1);
  });
});

function releaseGateElement() {
  return createElement(ReleaseGate, null, createElement(Text, null, "Application content"));
}

async function renderGate() {
  return render(releaseGateElement());
}
