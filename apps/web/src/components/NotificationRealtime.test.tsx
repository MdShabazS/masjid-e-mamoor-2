import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { NotificationRealtime } from "./NotificationRealtime";

const mocks = vi.hoisted(() => ({
  refresh: vi.fn(),
  setAuth: vi.fn(),
  channel: vi.fn(),
  on: vi.fn(),
  subscribe: vi.fn(),
  removeChannel: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: mocks.refresh,
  }),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    realtime: {
      setAuth: mocks.setAuth,
    },
    channel: mocks.channel,
    removeChannel: mocks.removeChannel,
  }),
}));

describe("NotificationRealtime", () => {
  let broadcastHandler: (() => void) | undefined;
  let subscribeHandler: ((status: string) => void) | undefined;
  let channelObject: {
    on: typeof mocks.on;
    subscribe: typeof mocks.subscribe;
  };

  beforeEach(() => {
    vi.clearAllMocks();

    broadcastHandler = undefined;
    subscribeHandler = undefined;

    channelObject = {
      on: mocks.on,
      subscribe: mocks.subscribe,
    };

    mocks.channel.mockReturnValue(channelObject);

    mocks.on.mockImplementation((_type, _filter, handler) => {
      broadcastHandler = handler as () => void;
      return channelObject;
    });

    mocks.subscribe.mockImplementation((handler) => {
      subscribeHandler = handler as (status: string) => void;
      return channelObject;
    });

    mocks.setAuth.mockResolvedValue(undefined);
    mocks.removeChannel.mockResolvedValue("ok");
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("subscribes to the authenticated private per-user notification channel", async () => {
    render(
      <NotificationRealtime applicationUserId="96000000-0000-0000-0000-000000000001" />,
    );

    expect(mocks.channel).toHaveBeenCalledWith(
      "notifications:96000000-0000-0000-0000-000000000001",
      {
        config: {
          private: true,
        },
      },
    );

    expect(mocks.on).toHaveBeenCalledWith(
      "broadcast",
      {
        event: "notification_created",
      },
      expect.any(Function),
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(mocks.setAuth).toHaveBeenCalledTimes(1);
    expect(mocks.subscribe).toHaveBeenCalledTimes(1);

    expect(
      mocks.setAuth.mock.invocationCallOrder[0],
    ).toBeLessThan(mocks.subscribe.mock.invocationCallOrder[0]);
  });

  it("reconciles durable notification state after the private channel subscribes", async () => {
    vi.useFakeTimers();

    render(
      <NotificationRealtime applicationUserId="96000000-0000-0000-0000-000000000001" />,
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(subscribeHandler).toBeDefined();

    act(() => {
      subscribeHandler?.("SUBSCRIBED");
    });

    expect(mocks.refresh).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(250);
    });

    expect(mocks.refresh).toHaveBeenCalledTimes(1);
  });

  it("does not subscribe when Realtime authentication fails", async () => {
    mocks.setAuth.mockRejectedValueOnce(new Error("auth_failed"));

    render(
      <NotificationRealtime applicationUserId="96000000-0000-0000-0000-000000000001" />,
    );

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mocks.setAuth).toHaveBeenCalledTimes(1);
    expect(mocks.subscribe).not.toHaveBeenCalled();
  });

  it("debounces broadcast events into an authoritative router refresh", async () => {
    vi.useFakeTimers();

    render(
      <NotificationRealtime applicationUserId="96000000-0000-0000-0000-000000000001" />,
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(broadcastHandler).toBeDefined();

    act(() => {
      broadcastHandler?.();
      broadcastHandler?.();
      broadcastHandler?.();
    });

    expect(mocks.refresh).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(249);
    });

    expect(mocks.refresh).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1);
    });

    expect(mocks.refresh).toHaveBeenCalledTimes(1);
  });

  it("removes the channel and cancels pending refresh work on unmount", async () => {
    vi.useFakeTimers();

    const view = render(
      <NotificationRealtime applicationUserId="96000000-0000-0000-0000-000000000001" />,
    );

    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      broadcastHandler?.();
    });

    view.unmount();

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(mocks.refresh).not.toHaveBeenCalled();
    expect(mocks.removeChannel).toHaveBeenCalledWith(channelObject);
  });
});
