import { act, render } from "@testing-library/react-native";
import { createElement } from "react";
import { AppState } from "react-native";
import { useQueryClient } from "@tanstack/react-query";

import { supabase } from "../lib/supabase";
import { NotificationRealtime } from "./NotificationRealtime";

jest.mock("@tanstack/react-query", () => ({
  useQueryClient: jest.fn(),
}));

jest.mock("../lib/supabase", () => ({
  supabase: {
    realtime: {
      setAuth: jest.fn(),
    },
    channel: jest.fn(),
    removeChannel: jest.fn(),
  },
}));

const mockUseQueryClient = useQueryClient as jest.Mock;
const mockInvalidateQueries = jest.fn();
const mockSetAuth = supabase.realtime.setAuth as jest.Mock;
const mockChannel = supabase.channel as jest.Mock;
const mockOn = jest.fn();
const mockSubscribe = jest.fn();
const mockRemoveChannel = supabase.removeChannel as jest.Mock;
const mockAppStateRemove = jest.fn();

describe("NotificationRealtime", () => {
  let broadcastHandler: (() => void) | undefined;
  let subscribeHandler: ((status: string) => void) | undefined;
  let appStateHandler: ((state: string) => void) | undefined;

  let channelObject: {
    on: typeof mockOn;
    subscribe: typeof mockSubscribe;
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockUseQueryClient.mockReturnValue({
      invalidateQueries: mockInvalidateQueries,
    });

    broadcastHandler = undefined;
    subscribeHandler = undefined;
    appStateHandler = undefined;

    channelObject = {
      on: mockOn,
      subscribe: mockSubscribe,
    };

    mockChannel.mockReturnValue(channelObject);

    mockOn.mockImplementation((_type, _filter, handler) => {
      broadcastHandler = handler as () => void;
      return channelObject;
    });

    mockSubscribe.mockImplementation((handler) => {
      subscribeHandler = handler as (status: string) => void;
      return channelObject;
    });

    mockSetAuth.mockResolvedValue(undefined);
    mockRemoveChannel.mockResolvedValue("ok");
    mockInvalidateQueries.mockResolvedValue(undefined);

    jest.spyOn(AppState, "addEventListener").mockImplementation(
      (_type, handler) => {
        appStateHandler = handler as (state: string) => void;

        return {
          remove: mockAppStateRemove,
        } as ReturnType<typeof AppState.addEventListener>;
      },
    );
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("subscribes to the authenticated private per-user channel", async () => {
    await render(
      createElement(NotificationRealtime, {
        applicationUserId:
          "96000000-0000-0000-0000-000000000001",
      }),
    );

    expect(mockChannel).toHaveBeenCalledWith(
      "notifications:96000000-0000-0000-0000-000000000001",
      {
        config: {
          private: true,
        },
      },
    );

    expect(mockOn).toHaveBeenCalledWith(
      "broadcast",
      {
        event: "notification_created",
      },
      expect.any(Function),
    );

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockSetAuth).toHaveBeenCalledTimes(1);
    expect(mockSubscribe).toHaveBeenCalledTimes(1);

    expect(
      mockSetAuth.mock.invocationCallOrder[0],
    ).toBeLessThan(
      mockSubscribe.mock.invocationCallOrder[0],
    );
  });

  it("does not subscribe when Realtime authentication fails", async () => {
    mockSetAuth.mockRejectedValueOnce(new Error("auth_failed"));

    await render(
      createElement(NotificationRealtime, {
        applicationUserId:
          "96000000-0000-0000-0000-000000000001",
      }),
    );

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockSetAuth).toHaveBeenCalledTimes(1);
    expect(mockSubscribe).not.toHaveBeenCalled();
  });

  it("debounces broadcasts into authoritative notification invalidation", async () => {
    jest.useFakeTimers();

    await render(
      createElement(NotificationRealtime, {
        applicationUserId:
          "96000000-0000-0000-0000-000000000001",
      }),
    );

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(broadcastHandler).toBeDefined();

    await act(async () => {
      broadcastHandler?.();
      broadcastHandler?.();
      broadcastHandler?.();
    });

    expect(mockInvalidateQueries).not.toHaveBeenCalled();

    await act(async () => {
      await jest.advanceTimersByTimeAsync(249);
    });

    expect(mockInvalidateQueries).not.toHaveBeenCalled();

    await act(async () => {
      await jest.advanceTimersByTimeAsync(1);
    });

    expect(mockInvalidateQueries).toHaveBeenCalledTimes(3);
  });

  it("reconciles durable state whenever the channel reaches SUBSCRIBED", async () => {
    jest.useFakeTimers();

    await render(
      createElement(NotificationRealtime, {
        applicationUserId:
          "96000000-0000-0000-0000-000000000001",
      }),
    );

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(subscribeHandler).toBeDefined();

    await act(async () => {
      subscribeHandler?.("SUBSCRIBED");
    });

    expect(mockInvalidateQueries).not.toHaveBeenCalled();

    await act(async () => {
      await jest.advanceTimersByTimeAsync(250);
    });

    expect(mockInvalidateQueries).toHaveBeenCalledTimes(3);
  });

  it("reconciles notification state when the app returns to foreground", async () => {
    jest.useFakeTimers();

    await render(
      createElement(NotificationRealtime, {
        applicationUserId:
          "96000000-0000-0000-0000-000000000001",
      }),
    );

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(appStateHandler).toBeDefined();

    await act(async () => {
      appStateHandler?.("active");
    });

    expect(mockInvalidateQueries).not.toHaveBeenCalled();

    await act(async () => {
      await jest.advanceTimersByTimeAsync(250);
    });

    expect(mockInvalidateQueries).toHaveBeenCalledTimes(3);
  });

  it("removes lifecycle listeners, channel, and pending refresh work on unmount", async () => {
    jest.useFakeTimers();

    const view = await render(
      createElement(NotificationRealtime, {
        applicationUserId:
          "96000000-0000-0000-0000-000000000001",
      }),
    );

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    await act(async () => {
      broadcastHandler?.();
    });

    await view.unmount();

    await act(async () => {
      await jest.advanceTimersByTimeAsync(300);
    });

    expect(mockInvalidateQueries).not.toHaveBeenCalled();
    expect(mockAppStateRemove).toHaveBeenCalledTimes(1);
    expect(mockRemoveChannel).toHaveBeenCalledWith(channelObject);
  });
});
